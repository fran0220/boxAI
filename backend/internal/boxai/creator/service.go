// Package creator implements BoxAI Creator's user-isolated cloud metadata and private object storage.
package creator

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	MaxPayloadBytes       = 8 << 20
	MaxObjectBytes        = 512 << 20
	MaxRecordsPerUser     = 20_000
	MaxRecordBytesPerUser = 256 << 20
	MaxObjectsPerUser     = 5_000
	MaxObjectBytesPerUser = 5 << 30
	PresignTTL            = 15 * time.Minute
	pendingObjectTTL      = 24 * time.Hour
	pendingCleanupEvery   = time.Hour
	pendingCleanupBatch   = 1_000
)

var (
	ErrUnavailable       = errors.New("Creator cloud object storage is not configured")
	ErrInvalidRecord     = errors.New("invalid record")
	ErrInvalidRecordKind = errors.New("invalid record kind")
	ErrInvalidRecordPath = errors.New("invalid record path")
	ErrInvalidClientID   = errors.New("invalid client_id")
	ErrInvalidObject     = errors.New("invalid object metadata")
	ErrInvalidDimensions = errors.New("invalid object dimensions")
	ErrObjectConflict    = errors.New("object client_id already contains different content")
	ErrObjectNotUploaded = errors.New("uploaded object was not found")
	ErrObjectSize        = errors.New("uploaded object size does not match")
	ErrQuotaExceeded     = errors.New("Creator cloud account quota exceeded")
)

type Record struct {
	Kind            string          `json:"kind"`
	ClientID        string          `json:"client_id"`
	Payload         json.RawMessage `json:"payload"`
	ClientUpdatedAt time.Time       `json:"client_updated_at"`
	Revision        int64           `json:"revision"`
	DeletedAt       *time.Time      `json:"deleted_at,omitempty"`
}
type Object struct {
	ClientID  string     `json:"client_id"`
	Kind      string     `json:"kind"`
	MimeType  string     `json:"mime_type"`
	SizeBytes int64      `json:"size_bytes"`
	Width     *int       `json:"width,omitempty"`
	Height    *int       `json:"height,omitempty"`
	Status    string     `json:"status"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}
type ObjectInput struct {
	Kind      string `json:"kind"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
	Width     *int   `json:"width"`
	Height    *int   `json:"height"`
}
type Snapshot struct {
	Records []Record `json:"records"`
	Objects []Object `json:"objects"`
}

type objectStore interface {
	PresignPut(context.Context, string, string, int64) (string, error)
	PresignGet(context.Context, string) (string, error)
	Head(context.Context, string) (int64, error)
	Delete(context.Context, string) error
}
type Service struct {
	db      *sql.DB
	objects objectStore
	enabled bool
}

func NewFromEnv(db *sql.DB) (*Service, error) {
	enabled, err := strconv.ParseBool(strings.TrimSpace(os.Getenv("BOXAI_CREATOR_CLOUD_ENABLED")))
	if os.Getenv("BOXAI_CREATOR_CLOUD_ENABLED") == "" {
		enabled = false
		err = nil
	}
	if err != nil {
		return nil, fmt.Errorf("invalid BOXAI_CREATOR_CLOUD_ENABLED: %w", err)
	}
	svc := &Service{db: db, enabled: enabled}
	if !enabled {
		return svc, nil
	}
	vals := []string{os.Getenv("R2_ENDPOINT"), os.Getenv("R2_REGION"), os.Getenv("R2_BUCKET"), os.Getenv("R2_ACCESS_KEY_ID"), os.Getenv("R2_SECRET_ACCESS_KEY")}
	for _, v := range vals {
		if strings.TrimSpace(v) == "" {
			return nil, errors.New("Creator cloud is enabled but R2 configuration is incomplete")
		}
	}
	u, err := url.Parse(vals[0])
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return nil, errors.New("Creator cloud R2 endpoint must be a valid HTTPS URL")
	}
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(), awsconfig.WithRegion(vals[1]), awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(vals[3], vals[4], "")))
	if err != nil {
		return nil, fmt.Errorf("initialize Creator cloud R2 client: %w", err)
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) { o.BaseEndpoint = aws.String(u.String()); o.UsePathStyle = true })
	svc.objects = &s3Store{client: client, presigner: s3.NewPresignClient(client), bucket: vals[2]}
	if db != nil {
		svc.startPendingCleanup()
	}
	return svc, nil
}
func MustNewFromEnv(db *sql.DB) *Service {
	s, err := NewFromEnv(db)
	if err != nil {
		panic(err)
	}
	return s
}
func ValidRecordKind(k string) bool {
	switch k {
	case "image_task", "agent_conversation", "video_job", "asset", "project":
		return true
	}
	return false
}

func validObjectKind(k string) bool {
	switch k {
	case "image", "video", "audio", "asset":
		return true
	}
	return false
}
func validID(s string) bool {
	if len(s) < 1 || len(s) > 128 {
		return false
	}
	for _, r := range s {
		if !(r == '-' || r == '_' || r == '.' || r >= '0' && r <= '9' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z') {
			return false
		}
	}
	return true
}
func validateObject(v ObjectInput) error {
	if !validObjectKind(v.Kind) || v.SizeBytes < 1 || v.SizeBytes > MaxObjectBytes || len(v.MimeType) > 128 || (!strings.HasPrefix(v.MimeType, "image/") && !strings.HasPrefix(v.MimeType, "video/") && !strings.HasPrefix(v.MimeType, "audio/") && v.MimeType != "application/octet-stream") {
		return ErrInvalidObject
	}
	if (v.Kind == "image" && !strings.HasPrefix(v.MimeType, "image/")) ||
		(v.Kind == "video" && !strings.HasPrefix(v.MimeType, "video/")) ||
		(v.Kind == "audio" && !strings.HasPrefix(v.MimeType, "audio/")) {
		return ErrInvalidObject
	}
	for _, n := range []*int{v.Width, v.Height} {
		if n != nil && (*n < 1 || *n > 32768) {
			return ErrInvalidDimensions
		}
	}
	return nil
}

func (s *Service) Snapshot(ctx context.Context, uid int64, kind string, includeDeleted bool) (Snapshot, error) {
	if kind != "" && !ValidRecordKind(kind) {
		return Snapshot{}, ErrInvalidRecordKind
	}
	out := Snapshot{Records: []Record{}, Objects: []Object{}}
	rows, err := s.db.QueryContext(ctx, `SELECT kind,client_id,payload,client_updated_at,revision,deleted_at FROM boxai_creator_records WHERE user_id=$1 AND ($2='' OR kind=$2) AND ($3 OR deleted_at IS NULL) ORDER BY updated_at,kind,client_id`, uid, kind, includeDeleted)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var r Record
		if err = rows.Scan(&r.Kind, &r.ClientID, &r.Payload, &r.ClientUpdatedAt, &r.Revision, &r.DeletedAt); err != nil {
			return out, err
		}
		out.Records = append(out.Records, r)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	rows, err = s.db.QueryContext(ctx, `SELECT client_id,kind,mime_type,size_bytes,width,height,status,deleted_at FROM boxai_creator_objects WHERE user_id=$1 AND ((status='ready' AND deleted_at IS NULL) OR ($2 AND deleted_at IS NOT NULL)) ORDER BY updated_at,client_id`, uid, includeDeleted)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var o Object
		if err = rows.Scan(&o.ClientID, &o.Kind, &o.MimeType, &o.SizeBytes, &o.Width, &o.Height, &o.Status, &o.DeletedAt); err != nil {
			return out, err
		}
		out.Objects = append(out.Objects, o)
	}
	return out, rows.Err()
}
func (s *Service) PutRecord(ctx context.Context, uid int64, kind, id string, payload json.RawMessage, at time.Time) (int64, error) {
	if !ValidRecordKind(kind) || !validID(id) || len(payload) == 0 || len(payload) > MaxPayloadBytes || !json.Valid(payload) {
		return 0, ErrInvalidRecord
	}
	at = normalizeClientTime(at)
	tx, err := s.beginUserMutation(ctx, uid)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()
	var recordCount, usedBytes, newBytes int64
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*),COALESCE(SUM(octet_length(payload::text)),0),octet_length($4::jsonb::text) FROM boxai_creator_records WHERE user_id=$1 AND NOT (kind=$2 AND client_id=$3)`, uid, kind, id, payload).Scan(&recordCount, &usedBytes, &newBytes)
	if err != nil {
		return 0, err
	}
	if recordCount >= MaxRecordsPerUser || usedBytes+newBytes > MaxRecordBytesPerUser {
		return 0, ErrQuotaExceeded
	}
	var rev int64
	err = tx.QueryRowContext(ctx, `INSERT INTO boxai_creator_records(user_id,kind,client_id,payload,client_updated_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,kind,client_id) DO UPDATE SET payload=EXCLUDED.payload,client_updated_at=EXCLUDED.client_updated_at,revision=boxai_creator_records.revision+1,deleted_at=NULL,updated_at=NOW() WHERE EXCLUDED.client_updated_at>boxai_creator_records.client_updated_at RETURNING revision`, uid, kind, id, payload, at).Scan(&rev)
	if errors.Is(err, sql.ErrNoRows) {
		err = tx.QueryRowContext(ctx, `SELECT revision FROM boxai_creator_records WHERE user_id=$1 AND kind=$2 AND client_id=$3`, uid, kind, id).Scan(&rev)
	}
	if err != nil {
		return 0, err
	}
	if err = tx.Commit(); err != nil {
		return 0, err
	}
	return rev, nil
}
func (s *Service) DeleteRecord(ctx context.Context, uid int64, kind, id string, at time.Time) error {
	if !ValidRecordKind(kind) || !validID(id) {
		return ErrInvalidRecordPath
	}
	at = normalizeClientTime(at)
	// A tombstone wins an equal-timestamp race regardless of arrival order:
	// delete-after-put applies, while PutRecord's strict greater-than check
	// prevents an equal put from reviving a tombstone.
	_, err := s.db.ExecContext(ctx, `INSERT INTO boxai_creator_records(user_id,kind,client_id,payload,client_updated_at,deleted_at) VALUES($1,$2,$3,'{}'::jsonb,$4,NOW()) ON CONFLICT(user_id,kind,client_id) DO UPDATE SET payload='{}'::jsonb,client_updated_at=EXCLUDED.client_updated_at,revision=boxai_creator_records.revision+1,deleted_at=NOW(),updated_at=NOW() WHERE EXCLUDED.client_updated_at>boxai_creator_records.client_updated_at OR (EXCLUDED.client_updated_at=boxai_creator_records.client_updated_at AND boxai_creator_records.deleted_at IS NULL)`, uid, kind, id, at)
	return err
}

func normalizeClientTime(at time.Time) time.Time {
	now := time.Now().UTC()
	if at.IsZero() || at.After(now.Add(5*time.Minute)) {
		return now
	}
	return at.UTC()
}

func objectKey(uid int64, id string) string {
	return fmt.Sprintf("creator/%d/%x", uid, sha256.Sum256([]byte(id)))
}

func (s *Service) beginUserMutation(ctx context.Context, uid int64) (*sql.Tx, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	// Serialize quota accounting per Creator account so concurrent uploads or
	// record writes cannot each observe capacity before the others commit.
	if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('boxai_creator_quota:' || $1::text, 0))`, uid); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	return tx, nil
}

func (s *Service) BeginUpload(ctx context.Context, uid int64, id string, in ObjectInput) (Object, string, error) {
	if !s.enabled || s.objects == nil {
		return Object{}, "", ErrUnavailable
	}
	if !validID(id) {
		return Object{}, "", ErrInvalidClientID
	}
	if err := validateObject(in); err != nil {
		return Object{}, "", err
	}
	tx, err := s.beginUserMutation(ctx, uid)
	if err != nil {
		return Object{}, "", err
	}
	defer func() { _ = tx.Rollback() }()
	var objectCount, usedBytes int64
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*),COALESCE(SUM(size_bytes),0) FROM boxai_creator_objects WHERE user_id=$1 AND deleted_at IS NULL AND client_id<>$2`, uid, id).Scan(&objectCount, &usedBytes)
	if err != nil {
		return Object{}, "", err
	}
	if objectCount >= MaxObjectsPerUser || usedBytes+in.SizeBytes > MaxObjectBytesPerUser {
		return Object{}, "", ErrQuotaExceeded
	}
	var o Object
	var key string
	err = tx.QueryRowContext(ctx, `INSERT INTO boxai_creator_objects(user_id,client_id,object_key,kind,mime_type,size_bytes,width,height,status,deleted_at,purged_at,expired_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',NULL,NULL,NULL) ON CONFLICT(user_id,client_id) DO UPDATE SET object_key=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.object_key ELSE EXCLUDED.object_key END,kind=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.kind ELSE EXCLUDED.kind END,mime_type=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.mime_type ELSE EXCLUDED.mime_type END,size_bytes=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.size_bytes ELSE EXCLUDED.size_bytes END,width=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.width ELSE EXCLUDED.width END,height=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.height ELSE EXCLUDED.height END,status=CASE WHEN boxai_creator_objects.status='ready' THEN 'ready' ELSE 'pending' END,deleted_at=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.deleted_at ELSE NULL END,purged_at=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.purged_at ELSE NULL END,expired_at=CASE WHEN boxai_creator_objects.status='ready' THEN boxai_creator_objects.expired_at ELSE NULL END,updated_at=NOW() WHERE boxai_creator_objects.deleted_at IS NULL OR (boxai_creator_objects.status='pending' AND boxai_creator_objects.expired_at IS NOT NULL) RETURNING client_id,kind,mime_type,size_bytes,width,height,status,object_key`, uid, id, objectKey(uid, id), in.Kind, in.MimeType, in.SizeBytes, in.Width, in.Height).Scan(&o.ClientID, &o.Kind, &o.MimeType, &o.SizeBytes, &o.Width, &o.Height, &o.Status, &key)
	if errors.Is(err, sql.ErrNoRows) {
		return o, "", ErrObjectConflict
	}
	if err != nil {
		return o, "", err
	}
	if err = tx.Commit(); err != nil {
		return Object{}, "", err
	}
	if o.Status == "ready" {
		if !sameObjectMetadata(o, in) {
			return Object{}, "", ErrObjectConflict
		}
		return o, "", nil
	}
	u, err := s.objects.PresignPut(ctx, key, o.MimeType, o.SizeBytes)
	return o, u, err
}

func sameObjectMetadata(o Object, in ObjectInput) bool {
	// Width/height are descriptive and may be discovered after the immutable
	// bytes have already uploaded. The content-bearing fields must still match.
	return o.Kind == in.Kind && o.MimeType == in.MimeType && o.SizeBytes == in.SizeBytes
}

func (s *Service) Complete(ctx context.Context, uid int64, id string) (Object, error) {
	if !s.enabled || s.objects == nil {
		return Object{}, ErrUnavailable
	}
	if !validID(id) {
		return Object{}, ErrInvalidClientID
	}
	var o Object
	var key string
	err := s.db.QueryRowContext(ctx, `SELECT client_id,kind,mime_type,size_bytes,width,height,status,object_key FROM boxai_creator_objects WHERE user_id=$1 AND client_id=$2 AND deleted_at IS NULL`, uid, id).Scan(&o.ClientID, &o.Kind, &o.MimeType, &o.SizeBytes, &o.Width, &o.Height, &o.Status, &key)
	if err != nil {
		return o, err
	}
	if o.Status == "ready" {
		return o, nil
	}
	n, err := s.objects.Head(ctx, key)
	if err != nil {
		return o, fmt.Errorf("%w: %v", ErrObjectNotUploaded, err)
	}
	if n != o.SizeBytes {
		return o, ErrObjectSize
	}
	result, err := s.db.ExecContext(ctx, `UPDATE boxai_creator_objects SET status='ready',updated_at=NOW() WHERE user_id=$1 AND client_id=$2 AND deleted_at IS NULL`, uid, id)
	if err != nil {
		return o, err
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return o, err
	}
	if updated != 1 {
		return o, sql.ErrNoRows
	}
	o.Status = "ready"
	return o, nil
}
func (s *Service) URL(ctx context.Context, uid int64, id string) (string, error) {
	if !s.enabled || s.objects == nil {
		return "", ErrUnavailable
	}
	if !validID(id) {
		return "", ErrInvalidClientID
	}
	var key string
	err := s.db.QueryRowContext(ctx, `SELECT object_key FROM boxai_creator_objects WHERE user_id=$1 AND client_id=$2 AND status='ready' AND deleted_at IS NULL`, uid, id).Scan(&key)
	if err != nil {
		return "", err
	}
	return s.objects.PresignGet(ctx, key)
}
func (s *Service) DeleteObject(ctx context.Context, uid int64, id string) error {
	if !s.enabled || s.objects == nil {
		return ErrUnavailable
	}
	if !validID(id) {
		return ErrInvalidClientID
	}
	var key string
	var purgedAt *time.Time
	// Hide metadata first, then delete immutable bytes. If R2 is unavailable the
	// client receives an error and its durable outbox retries this idempotent
	// path; retries can still read the stable key from the tombstoned row. This
	// avoids live metadata ever pointing at bytes that were already removed.
	err := s.db.QueryRowContext(ctx, `UPDATE boxai_creator_objects SET deleted_at=COALESCE(deleted_at,NOW()),updated_at=CASE WHEN deleted_at IS NULL THEN NOW() ELSE updated_at END WHERE user_id=$1 AND client_id=$2 RETURNING object_key,purged_at`, uid, id).Scan(&key, &purgedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if purgedAt != nil {
		return nil
	}
	if err = s.objects.Delete(ctx, key); err != nil {
		return fmt.Errorf("delete Creator object: %w", err)
	}
	_, err = s.db.ExecContext(ctx, `UPDATE boxai_creator_objects SET purged_at=NOW() WHERE user_id=$1 AND client_id=$2 AND deleted_at IS NOT NULL`, uid, id)
	return err
}

type pendingObject struct {
	userID   int64
	clientID string
}

func (s *Service) startPendingCleanup() {
	go func() {
		run := func() {
			for {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				processed, err := s.cleanupStalePending(ctx, time.Now().UTC().Add(-pendingObjectTTL))
				cancel()
				if err != nil {
					log.Printf("[CreatorCloud] pending object cleanup failed: %v", err)
					return
				}
				if processed < pendingCleanupBatch {
					return
				}
			}
		}
		run()
		ticker := time.NewTicker(pendingCleanupEvery)
		defer ticker.Stop()
		for range ticker.C {
			run()
		}
	}()
}

func (s *Service) cleanupStalePending(ctx context.Context, cutoff time.Time) (int, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT user_id,client_id FROM boxai_creator_objects WHERE status='pending' AND purged_at IS NULL AND (deleted_at IS NULL OR expired_at IS NOT NULL) AND updated_at<$1 ORDER BY updated_at LIMIT $2`, cutoff, pendingCleanupBatch)
	if err != nil {
		return 0, err
	}
	objects := make([]pendingObject, 0, pendingCleanupBatch)
	for rows.Next() {
		var o pendingObject
		if err = rows.Scan(&o.userID, &o.clientID); err != nil {
			_ = rows.Close()
			return 0, err
		}
		objects = append(objects, o)
	}
	if err = rows.Err(); err != nil {
		_ = rows.Close()
		return 0, err
	}
	if err = rows.Close(); err != nil {
		return 0, err
	}
	var cleanupErr error
	for _, o := range objects {
		if _, err = s.cleanupPendingObject(ctx, o.userID, o.clientID, cutoff); err != nil {
			cleanupErr = errors.Join(cleanupErr, err)
		}
	}
	return len(objects), cleanupErr
}

func (s *Service) cleanupPendingObject(ctx context.Context, uid int64, id string, cutoff time.Time) (bool, error) {
	tx, err := s.beginUserMutation(ctx, uid)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()
	var key string
	err = tx.QueryRowContext(ctx, `UPDATE boxai_creator_objects SET deleted_at=COALESCE(deleted_at,NOW()),expired_at=COALESCE(expired_at,NOW()),updated_at=NOW() WHERE user_id=$1 AND client_id=$2 AND status='pending' AND purged_at IS NULL AND (deleted_at IS NULL OR expired_at IS NOT NULL) AND updated_at<$3 RETURNING object_key`, uid, id, cutoff).Scan(&key)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	// Keep the account mutation lock through the object-store delete. A retrying
	// BeginUpload for this stable key cannot race ahead and have its new bytes
	// removed by an older cleanup attempt.
	if err = s.objects.Delete(ctx, key); err != nil {
		return false, fmt.Errorf("delete pending object: %w", err)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE boxai_creator_objects SET purged_at=NOW() WHERE user_id=$1 AND client_id=$2 AND expired_at IS NOT NULL`, uid, id); err != nil {
		return false, err
	}
	if err = tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}
