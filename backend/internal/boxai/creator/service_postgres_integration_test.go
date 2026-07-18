//go:build integration

package creator

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	dbmigrations "github.com/Wei-Shaw/sub2api/migrations"
	_ "github.com/lib/pq"
)

func TestCreatorPostgresMigrationIsolationAndTombstones(t *testing.T) {
	dsn := os.Getenv("BOXAI_CREATOR_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set BOXAI_CREATOR_TEST_DATABASE_URL to run Creator Postgres integration")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	if _, err = db.ExecContext(ctx, `
		DROP TABLE IF EXISTS boxai_creator_objects;
		DROP TABLE IF EXISTS boxai_creator_records;
		DROP TABLE IF EXISTS users;
		CREATE TABLE users (id BIGINT PRIMARY KEY);
		INSERT INTO users(id) VALUES (1), (2);
	`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DROP TABLE IF EXISTS boxai_creator_objects; DROP TABLE IF EXISTS boxai_creator_records; DROP TABLE IF EXISTS users`)
	})
	migration, err := dbmigrations.FS.ReadFile("901_boxai_creator_cloud.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.ExecContext(ctx, string(migration)); err != nil {
		t.Fatal(err)
	}
	if _, err = db.ExecContext(ctx, string(migration)); err != nil {
		t.Fatalf("migration is not idempotent: %v", err)
	}

	svc := &Service{db: db}
	t1 := time.Now().UTC().Add(-3 * time.Minute).Truncate(time.Microsecond)
	t2 := t1.Add(time.Minute)
	t3 := t2.Add(time.Minute)
	if rev, putErr := svc.PutRecord(ctx, 1, "image_task", "same-id", []byte(`{"value":"old"}`), t1); putErr != nil || rev != 1 {
		t.Fatalf("first upsert revision=%d err=%v", rev, putErr)
	}
	if rev, putErr := svc.PutRecord(ctx, 1, "image_task", "same-id", []byte(`{"value":"new"}`), t2); putErr != nil || rev != 2 {
		t.Fatalf("newer upsert revision=%d err=%v", rev, putErr)
	}
	if rev, putErr := svc.PutRecord(ctx, 1, "image_task", "same-id", []byte(`{"value":"stale"}`), t1); putErr != nil || rev != 2 {
		t.Fatalf("stale replay revision=%d err=%v", rev, putErr)
	}
	if rev, putErr := svc.PutRecord(ctx, 2, "image_task", "same-id", []byte(`{"value":"other-user"}`), t2); putErr != nil || rev != 1 {
		t.Fatalf("second user upsert revision=%d err=%v", rev, putErr)
	}
	if err = svc.DeleteRecord(ctx, 1, "image_task", "same-id", t3); err != nil {
		t.Fatal(err)
	}
	// Equal timestamp: a tombstone already present must beat a later-arriving put.
	if _, err = svc.PutRecord(ctx, 1, "image_task", "same-id", []byte(`{"value":"must-not-revive"}`), t3); err != nil {
		t.Fatal(err)
	}
	// Equal timestamp in the opposite arrival order: a later-arriving delete
	// must replace the live put, making the rule deterministic.
	if _, err = svc.PutRecord(ctx, 1, "project", "equal-id", []byte(`{"value":"live"}`), t2); err != nil {
		t.Fatal(err)
	}
	if err = svc.DeleteRecord(ctx, 1, "project", "equal-id", t2); err != nil {
		t.Fatal(err)
	}

	visible, err := svc.Snapshot(ctx, 1, "image_task", false)
	if err != nil || len(visible.Records) != 0 {
		t.Fatalf("deleted record remained visible: %+v err=%v", visible, err)
	}
	withDeleted, err := svc.Snapshot(ctx, 1, "image_task", true)
	if err != nil || len(withDeleted.Records) != 1 || withDeleted.Records[0].DeletedAt == nil || withDeleted.Records[0].Revision != 3 {
		t.Fatalf("user 1 tombstone mismatch: %+v err=%v", withDeleted, err)
	}
	otherUser, err := svc.Snapshot(ctx, 2, "image_task", true)
	if err != nil || len(otherUser.Records) != 1 || otherUser.Records[0].DeletedAt != nil || string(otherUser.Records[0].Payload) != `{"value": "other-user"}` {
		t.Fatalf("user 2 isolation mismatch: %+v err=%v", otherUser, err)
	}
	equalTimestamp, err := svc.Snapshot(ctx, 1, "project", true)
	if err != nil || len(equalTimestamp.Records) != 1 || equalTimestamp.Records[0].DeletedAt == nil || equalTimestamp.Records[0].Revision != 2 {
		t.Fatalf("equal timestamp tombstone mismatch: %+v err=%v", equalTimestamp, err)
	}

	staleAt := time.Now().UTC().Add(-48 * time.Hour)
	if _, err = db.ExecContext(ctx, `INSERT INTO boxai_creator_objects(user_id,client_id,object_key,kind,mime_type,size_bytes,status,updated_at) VALUES(1,'stale-pending','creator/1/stale','image','image/png',12,'pending',$1),(2,'other-pending','creator/2/live','image','image/png',12,'pending',NOW())`, staleAt); err != nil {
		t.Fatal(err)
	}
	store := &fakeObjectStore{}
	objectService := &Service{db: db, objects: store, enabled: true}
	processed, err := objectService.cleanupStalePending(ctx, time.Now().UTC().Add(-pendingObjectTTL))
	if err != nil || processed != 1 || store.deleteCalls != 1 {
		t.Fatalf("pending cleanup processed=%d deletes=%d err=%v", processed, store.deleteCalls, err)
	}
	var deletedAt, purgedAt, expiredAt *time.Time
	if err = db.QueryRowContext(ctx, `SELECT deleted_at,purged_at,expired_at FROM boxai_creator_objects WHERE user_id=1 AND client_id='stale-pending'`).Scan(&deletedAt, &purgedAt, &expiredAt); err != nil || deletedAt == nil || purgedAt == nil || expiredAt == nil {
		t.Fatalf("stale pending object was not expired and purged: deleted=%v purged=%v expired=%v err=%v", deletedAt, purgedAt, expiredAt, err)
	}
	deletedAt, purgedAt, expiredAt = nil, nil, nil
	if err = db.QueryRowContext(ctx, `SELECT deleted_at,purged_at,expired_at FROM boxai_creator_objects WHERE user_id=2 AND client_id='other-pending'`).Scan(&deletedAt, &purgedAt, &expiredAt); err != nil || deletedAt != nil || purgedAt != nil || expiredAt != nil {
		t.Fatalf("another user's fresh pending object changed: deleted=%v purged=%v expired=%v err=%v", deletedAt, purgedAt, expiredAt, err)
	}
	if _, _, err = objectService.BeginUpload(ctx, 1, "stale-pending", ObjectInput{Kind: "image", MimeType: "image/png", SizeBytes: 12}); err != nil {
		t.Fatalf("expired upload did not resume: %v", err)
	}
	deletedAt, purgedAt, expiredAt = nil, nil, nil
	if err = db.QueryRowContext(ctx, `SELECT deleted_at,purged_at,expired_at FROM boxai_creator_objects WHERE user_id=1 AND client_id='stale-pending'`).Scan(&deletedAt, &purgedAt, &expiredAt); err != nil || deletedAt != nil || purgedAt != nil || expiredAt != nil {
		t.Fatalf("resumed upload retained cleanup markers: deleted=%v purged=%v expired=%v err=%v", deletedAt, purgedAt, expiredAt, err)
	}
}
