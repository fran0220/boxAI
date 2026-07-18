# Creator cloud (Postgres + private R2)

Product-first sync for Creator workspace data: **metadata in Postgres**, **binaries in private Cloudflare R2**. Browser keeps IndexedDB / localStorage as cache and durable outbox only.

## Status

| Item | Location |
|------|----------|
| Schema | `backend/migrations/901_boxai_creator_cloud.sql` |
| Service | `backend/internal/boxai/creator/` |
| HTTP | `backend/internal/handler/boxai_creator_cloud.go` |
| Routes | `backend/internal/server/routes/user.go` → `/api/v1/boxai/creator/*` |
| Client | `web/src/lib/creator-cloud.ts` (+ playground/assets-db hooks) |
| Env | `BOXAI_CREATOR_CLOUD_ENABLED`, `R2_*` in `deploy/.env.example` |

## Enable (production)

1. Create private R2 bucket + S3 API tokens (account already used for you-box).
2. On youbox `/opt/boxAI/.env` (or via Deploy-managed compose env):

```bash
BOXAI_CREATOR_CLOUD_ENABLED=true
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_REGION=auto
R2_BUCKET=<private-bucket>
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

3. Deploy a backend build that includes migration `901`.
4. Confirm apex allowlist includes `/api/v1/boxai/creator/*` (`deploy/nginx-you-box.com.conf`).
5. With cloud disabled, API returns **503** `ErrUnavailable` — clients stay local-only.

Never point Creator cloud at a **public** R2 bucket or `r2.dev` public URL for binaries.

## Data model

| Table | Purpose |
|-------|---------|
| `boxai_creator_records` | JSON payloads keyed by `(user_id, kind, client_id)`; soft-delete via `deleted_at` |
| `boxai_creator_objects` | Object metadata + R2 key; status `pending` → `ready`; soft-delete / purge timestamps |

Record kinds: `image_task`, `agent_conversation`, `video_job`, `asset`, `project`.

## API (authenticated)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/snapshot?kind=&include_deleted=` | Pull records + objects for user |
| `PUT` | `/records/:kind/:client_id` | Upsert metadata (revision / client_updated_at) |
| `DELETE` | `/records/:kind/:client_id` | Tombstone |
| `POST` | `/objects/:client_id/upload` | Presign PUT to private R2 |
| `POST` | `/objects/:client_id/complete` | Mark ready after upload |
| `GET` | `/objects/:client_id/url` | Presign GET |
| `DELETE` | `/objects/:client_id` | Tombstone object |

Related: `POST /api/v1/boxai/creator/ensure-key` (idempotent `boxai-creator` API key).

## Client behaviour

- Namespace cache by authenticated user id.
- Outbox for offline upserts/deletes; flush when online.
- Tombstones win over stale offline upserts.
- Object upload: request presign → PUT body to R2 → `complete`.

## Ops / limits

- Max payload / object size enforced in service (see `creator` package constants).
- Quota exceeded → HTTP 413.
- The backend expires incomplete pending objects after 24 hours and deletes their R2 data.
- R2 credentials are **server-only**; never expose secret access keys to `web/`.

## Related

- Topology: [WEB_PLATFORM.md](./WEB_PLATFORM.md)
- Env / compose: [PRODUCTION.md](./PRODUCTION.md)
- Fork markers: [FORK_DELTA.md](../FORK_DELTA.md)
