package creator

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

type fakeObjectStore struct {
	presignPutURL string
	headSize      int64
	deleteErr     error
	presignCalls  int
	deleteCalls   int
}

func (f *fakeObjectStore) PresignPut(context.Context, string, string, int64) (string, error) {
	f.presignCalls++
	return f.presignPutURL, nil
}
func (f *fakeObjectStore) PresignGet(context.Context, string) (string, error) { return "get", nil }
func (f *fakeObjectStore) Head(context.Context, string) (int64, error)        { return f.headSize, nil }
func (f *fakeObjectStore) Delete(context.Context, string) error {
	f.deleteCalls++
	return f.deleteErr
}

func TestRecordAndObjectKindsAreSeparateContracts(t *testing.T) {
	for _, kind := range []string{"image_task", "agent_conversation", "video_job", "asset", "project"} {
		if !ValidRecordKind(kind) {
			t.Fatalf("record kind %q rejected", kind)
		}
	}
	for _, kind := range []string{"task", "conversation", "image", "video", "other"} {
		if ValidRecordKind(kind) {
			t.Fatalf("record kind %q accepted", kind)
		}
	}
	for _, input := range []ObjectInput{
		{Kind: "image", MimeType: "image/png", SizeBytes: 1},
		{Kind: "video", MimeType: "video/mp4", SizeBytes: 1},
		{Kind: "audio", MimeType: "audio/mpeg", SizeBytes: 1},
		{Kind: "asset", MimeType: "application/octet-stream", SizeBytes: 1},
	} {
		if err := validateObject(input); err != nil {
			t.Fatalf("object metadata rejected: %+v: %v", input, err)
		}
	}
}

func TestObjectMetadataValidation(t *testing.T) {
	good := ObjectInput{Kind: "asset", MimeType: "image/png", SizeBytes: 1024}
	if err := validateObject(good); err != nil {
		t.Fatalf("valid metadata rejected: %v", err)
	}
	bad := []ObjectInput{
		{Kind: "other", MimeType: "image/png", SizeBytes: 1},
		{Kind: "asset", MimeType: "text/html", SizeBytes: 1},
		{Kind: "image", MimeType: "video/mp4", SizeBytes: 1},
		{Kind: "asset", MimeType: "image/png", SizeBytes: MaxObjectBytes + 1},
	}
	for _, in := range bad {
		if validateObject(in) == nil {
			t.Fatalf("invalid metadata accepted: %+v", in)
		}
	}
}

func TestObjectKeyIsStableTenantScopedAndDoesNotExposeClientID(t *testing.T) {
	got := objectKey(7, "customer-image-1")
	if got != objectKey(7, "customer-image-1") {
		t.Fatal("object key is not stable")
	}
	if got == objectKey(8, "customer-image-1") || got == objectKey(7, "customer-image-2") {
		t.Fatal("object key is not tenant and object scoped")
	}
	if strings.Contains(got, "customer-image-1") {
		t.Fatal("object key exposes a caller-controlled client id")
	}
}

func TestBeginUploadReturnsReadyObjectIdempotentlyAndRejectsContentChange(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{presignPutURL: "put"}
	svc := &Service{db: db, objects: store, enabled: true}
	input := ObjectInput{Kind: "image", MimeType: "image/png", SizeBytes: 12}

	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(7)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COUNT.*FROM boxai_creator_objects").WithArgs(int64(7), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"count", "bytes"}).AddRow(int64(0), int64(0)))
	mock.ExpectQuery("INSERT INTO boxai_creator_objects").
		WithArgs(int64(7), "image-1", objectKey(7, "image-1"), "image", "image/png", int64(12), nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{"client_id", "kind", "mime_type", "size_bytes", "width", "height", "status", "object_key"}).
			AddRow("image-1", "image", "image/png", int64(12), nil, nil, "ready", objectKey(7, "image-1")))
	mock.ExpectCommit()
	object, uploadURL, err := svc.BeginUpload(t.Context(), 7, "image-1", input)
	if err != nil || uploadURL != "" || object.Status != "ready" || store.presignCalls != 0 {
		t.Fatalf("ready replay: object=%+v url=%q calls=%d err=%v", object, uploadURL, store.presignCalls, err)
	}

	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(7)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COUNT.*FROM boxai_creator_objects").WithArgs(int64(7), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"count", "bytes"}).AddRow(int64(0), int64(0)))
	mock.ExpectQuery("INSERT INTO boxai_creator_objects").
		WithArgs(int64(7), "image-1", objectKey(7, "image-1"), "image", "image/png", int64(13), nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{"client_id", "kind", "mime_type", "size_bytes", "width", "height", "status", "object_key"}).
			AddRow("image-1", "image", "image/png", int64(12), nil, nil, "ready", objectKey(7, "image-1")))
	mock.ExpectCommit()
	_, _, err = svc.BeginUpload(t.Context(), 7, "image-1", ObjectInput{Kind: "image", MimeType: "image/png", SizeBytes: 13})
	if !errors.Is(err, ErrObjectConflict) {
		t.Fatalf("content change error = %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestBeginUploadDoesNotResurrectObjectTombstone(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{presignPutURL: "put"}
	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(7)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COUNT.*FROM boxai_creator_objects").WithArgs(int64(7), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"count", "bytes"}).AddRow(int64(0), int64(0)))
	mock.ExpectQuery("INSERT INTO boxai_creator_objects").
		WithArgs(int64(7), "image-1", objectKey(7, "image-1"), "image", "image/png", int64(12), nil, nil).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	_, _, err = (&Service{db: db, objects: store, enabled: true}).BeginUpload(
		t.Context(), 7, "image-1", ObjectInput{Kind: "image", MimeType: "image/png", SizeBytes: 12},
	)
	if !errors.Is(err, ErrObjectConflict) || store.presignCalls != 0 {
		t.Fatalf("tombstone upload err=%v presign_calls=%d", err, store.presignCalls)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestSnapshotIncludesRecordAndObjectTombstonesWhenRequested(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	deletedAt := time.Now().UTC().Truncate(time.Microsecond)
	mock.ExpectQuery("SELECT kind,client_id,payload,client_updated_at,revision,deleted_at FROM boxai_creator_records").
		WithArgs(int64(42), "image_task", true).
		WillReturnRows(sqlmock.NewRows([]string{"kind", "client_id", "payload", "client_updated_at", "revision", "deleted_at"}).
			AddRow("image_task", "task-1", []byte(`{}`), deletedAt, int64(2), deletedAt))
	mock.ExpectQuery("SELECT client_id,kind,mime_type,size_bytes,width,height,status,deleted_at FROM boxai_creator_objects").
		WithArgs(int64(42), true).
		WillReturnRows(sqlmock.NewRows([]string{"client_id", "kind", "mime_type", "size_bytes", "width", "height", "status", "deleted_at"}).
			AddRow("image-1", "image", "image/png", int64(12), nil, nil, "ready", deletedAt))

	snapshot, err := (&Service{db: db}).Snapshot(t.Context(), 42, "image_task", true)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Records) != 1 || snapshot.Records[0].DeletedAt == nil || len(snapshot.Objects) != 1 || snapshot.Objects[0].DeletedAt == nil {
		t.Fatalf("tombstones missing: %+v", snapshot)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestPutRecordTreatsStaleReplayAsSuccessfulNoop(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	at := time.Now().UTC().Add(-time.Minute).Truncate(time.Microsecond)
	payload := []byte(`{"ok":true}`)
	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(3)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COUNT.*FROM boxai_creator_records").
		WithArgs(int64(3), "image_task", "task-1", payload).
		WillReturnRows(sqlmock.NewRows([]string{"count", "bytes", "new_bytes"}).AddRow(int64(1), int64(10), int64(11)))
	mock.ExpectQuery("INSERT INTO boxai_creator_records").
		WithArgs(int64(3), "image_task", "task-1", sqlmock.AnyArg(), at).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery("SELECT revision FROM boxai_creator_records").
		WithArgs(int64(3), "image_task", "task-1").
		WillReturnRows(sqlmock.NewRows([]string{"revision"}).AddRow(int64(5)))
	mock.ExpectCommit()
	revision, err := (&Service{db: db}).PutRecord(t.Context(), 3, "image_task", "task-1", payload, at)
	if err != nil || revision != 5 {
		t.Fatalf("revision=%d err=%v", revision, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteObjectTombstonesMetadataBeforeR2AndRemainsRetryable(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{deleteErr: errors.New("r2 unavailable")}
	mock.ExpectQuery("UPDATE boxai_creator_objects SET deleted_at=COALESCE").
		WithArgs(int64(9), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"object_key", "purged_at"}).AddRow("creator/9/key", nil))
	svc := &Service{db: db, objects: store, enabled: true}
	err = svc.DeleteObject(t.Context(), 9, "image-1")
	if err == nil || store.deleteCalls != 1 {
		t.Fatalf("delete calls=%d err=%v", store.deleteCalls, err)
	}
	store.deleteErr = nil
	mock.ExpectQuery("UPDATE boxai_creator_objects SET deleted_at=COALESCE").
		WithArgs(int64(9), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"object_key", "purged_at"}).AddRow("creator/9/key", nil))
	mock.ExpectExec("UPDATE boxai_creator_objects SET purged_at").
		WithArgs(int64(9), "image-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err = svc.DeleteObject(t.Context(), 9, "image-1"); err != nil || store.deleteCalls != 2 {
		t.Fatalf("retry delete calls=%d err=%v", store.deleteCalls, err)
	}
	purgedAt := time.Now().UTC()
	mock.ExpectQuery("UPDATE boxai_creator_objects SET deleted_at=COALESCE").
		WithArgs(int64(9), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"object_key", "purged_at"}).AddRow("creator/9/key", purgedAt))
	if err = svc.DeleteObject(t.Context(), 9, "image-1"); err != nil || store.deleteCalls != 2 {
		t.Fatalf("purged replay delete calls=%d err=%v", store.deleteCalls, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteObjectDoesNotTouchR2WhenTombstoneWriteFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{}
	mock.ExpectQuery("UPDATE boxai_creator_objects SET deleted_at=COALESCE").
		WithArgs(int64(9), "image-1").
		WillReturnError(errors.New("database unavailable"))
	err = (&Service{db: db, objects: store, enabled: true}).DeleteObject(t.Context(), 9, "image-1")
	if err == nil || store.deleteCalls != 0 {
		t.Fatalf("delete calls=%d err=%v", store.deleteCalls, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestCompleteDoesNotReportReadyWhenConcurrentTombstoneWins(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{headSize: 12}
	mock.ExpectQuery("SELECT client_id,kind,mime_type,size_bytes").WithArgs(int64(6), "image-1").
		WillReturnRows(sqlmock.NewRows([]string{"client_id", "kind", "mime_type", "size_bytes", "width", "height", "status", "object_key"}).
			AddRow("image-1", "image", "image/png", int64(12), nil, nil, "pending", "creator/6/key"))
	mock.ExpectExec("UPDATE boxai_creator_objects SET status='ready'").WithArgs(int64(6), "image-1").
		WillReturnResult(sqlmock.NewResult(0, 0))
	object, err := (&Service{db: db, objects: store, enabled: true}).Complete(t.Context(), 6, "image-1")
	if !errors.Is(err, sql.ErrNoRows) || object.Status == "ready" {
		t.Fatalf("object=%+v err=%v", object, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestCreatorQuotasRejectBeforeMutationOrPresign(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{presignPutURL: "put"}
	svc := &Service{db: db, objects: store, enabled: true}

	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(4)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COUNT.*FROM boxai_creator_objects").WithArgs(int64(4), "asset-1").
		WillReturnRows(sqlmock.NewRows([]string{"count", "bytes"}).AddRow(int64(MaxObjectsPerUser), int64(0)))
	mock.ExpectRollback()
	_, _, err = svc.BeginUpload(t.Context(), 4, "asset-1", ObjectInput{Kind: "asset", MimeType: "application/octet-stream", SizeBytes: 1})
	if !errors.Is(err, ErrQuotaExceeded) || store.presignCalls != 0 {
		t.Fatalf("object quota err=%v presign_calls=%d", err, store.presignCalls)
	}

	payload := []byte(`{"name":"project"}`)
	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(4)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COUNT.*FROM boxai_creator_records").WithArgs(int64(4), "project", "project-1", payload).
		WillReturnRows(sqlmock.NewRows([]string{"count", "bytes", "new_bytes"}).AddRow(int64(MaxRecordsPerUser), int64(0), int64(len(payload))))
	mock.ExpectRollback()
	_, err = svc.PutRecord(t.Context(), 4, "project", "project-1", payload, time.Now())
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("record quota err=%v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestCleanupStalePendingTombstonesThenPurgesR2(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	store := &fakeObjectStore{}
	cutoff := time.Now().UTC().Add(-pendingObjectTTL)
	mock.ExpectQuery("SELECT user_id,client_id FROM boxai_creator_objects").WithArgs(cutoff, pendingCleanupBatch).
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "client_id"}).AddRow(int64(5), "pending-1"))
	mock.ExpectBegin()
	mock.ExpectExec("SELECT pg_advisory_xact_lock").WithArgs(int64(5)).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("UPDATE boxai_creator_objects SET deleted_at=COALESCE").WithArgs(int64(5), "pending-1", cutoff).
		WillReturnRows(sqlmock.NewRows([]string{"object_key"}).AddRow("creator/5/key"))
	mock.ExpectExec("UPDATE boxai_creator_objects SET purged_at").WithArgs(int64(5), "pending-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	processed, err := (&Service{db: db, objects: store, enabled: true}).cleanupStalePending(t.Context(), cutoff)
	if err != nil || processed != 1 || store.deleteCalls != 1 {
		t.Fatalf("processed=%d delete_calls=%d err=%v", processed, store.deleteCalls, err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestDisabledCloudIsNonFatalAndObjectsUnavailable(t *testing.T) {
	t.Setenv("BOXAI_CREATOR_CLOUD_ENABLED", "false")
	s, err := NewFromEnv(nil)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = s.BeginUpload(t.Context(), 1, "asset-1", ObjectInput{})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("got %v", err)
	}
}

func TestEnabledCloudRequiresCompleteConfiguration(t *testing.T) {
	t.Setenv("BOXAI_CREATOR_CLOUD_ENABLED", "true")
	for _, key := range []string{"R2_ENDPOINT", "R2_REGION", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"} {
		t.Setenv(key, "")
	}
	if _, err := NewFromEnv(nil); err == nil {
		t.Fatal("expected invalid enabled configuration to fail")
	}
}

func TestR2PresignedPutGetDeleteIntegration(t *testing.T) {
	if os.Getenv("BOXAI_R2_INTEGRATION") != "1" {
		t.Skip("set BOXAI_R2_INTEGRATION=1 with private R2 credentials")
	}
	t.Setenv("BOXAI_CREATOR_CLOUD_ENABLED", "true")
	svc, err := NewFromEnv(nil)
	if err != nil {
		t.Fatal(err)
	}
	key := objectKey(0, "integration-smoke-"+time.Now().UTC().Format("20060102T150405.000000000"))
	payload := []byte("BoxAI Creator R2 integration smoke\n")
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	defer func() { _ = svc.objects.Delete(context.Background(), key) }()

	putURL, err := svc.objects.PresignPut(ctx, key, "application/octet-stream", int64(len(payload)))
	if err != nil {
		t.Fatal(err)
	}
	preflight, err := http.NewRequestWithContext(ctx, http.MethodOptions, putURL, nil)
	if err != nil {
		t.Fatal(err)
	}
	preflight.Header.Set("Origin", "https://you-box.com")
	preflight.Header.Set("Access-Control-Request-Method", http.MethodPut)
	preflight.Header.Set("Access-Control-Request-Headers", "content-type")
	preflightResponse, err := (&http.Client{Timeout: 20 * time.Second}).Do(preflight)
	if err != nil {
		t.Fatal(err)
	}
	_ = preflightResponse.Body.Close()
	if preflightResponse.StatusCode < 200 || preflightResponse.StatusCode >= 300 || preflightResponse.Header.Get("Access-Control-Allow-Origin") != "https://you-box.com" {
		t.Fatalf("browser PUT preflight status = %d allow_origin = %q", preflightResponse.StatusCode, preflightResponse.Header.Get("Access-Control-Allow-Origin"))
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, putURL, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/octet-stream")
	response, err := (&http.Client{Timeout: 20 * time.Second}).Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		t.Fatalf("presigned PUT status = %d", response.StatusCode)
	}

	size, err := svc.objects.Head(ctx, key)
	if err != nil || size != int64(len(payload)) {
		t.Fatalf("uploaded object size = %d, err = %v", size, err)
	}
	getURL, err := svc.objects.PresignGet(ctx, key)
	if err != nil {
		t.Fatal(err)
	}
	response, err = (&http.Client{Timeout: 20 * time.Second}).Get(getURL)
	if err != nil {
		t.Fatal(err)
	}
	got, readErr := io.ReadAll(io.LimitReader(response.Body, int64(len(payload)+1)))
	_ = response.Body.Close()
	if readErr != nil || response.StatusCode != http.StatusOK || !bytes.Equal(got, payload) {
		t.Fatalf("presigned GET status = %d body_match = %t err = %v", response.StatusCode, bytes.Equal(got, payload), readErr)
	}
	if err = svc.objects.Delete(ctx, key); err != nil {
		t.Fatal(err)
	}
	if _, err = svc.objects.Head(ctx, key); err == nil {
		t.Fatal("deleted R2 smoke object still exists")
	}
}
