-- BOXAI: Creator cloud metadata. Binary data remains in private R2.
CREATE TABLE IF NOT EXISTS boxai_creator_records (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    client_id VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_updated_at TIMESTAMPTZ NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, kind, client_id),
    CHECK (kind IN ('image_task','agent_conversation','video_job','asset','project'))
);

CREATE TABLE IF NOT EXISTS boxai_creator_objects (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(128) NOT NULL,
    object_key VARCHAR(512) NOT NULL UNIQUE,
    kind VARCHAR(32) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 536870912),
    width INTEGER CHECK (width IS NULL OR (width > 0 AND width <= 32768)),
    height INTEGER CHECK (height IS NULL OR (height > 0 AND height <= 32768)),
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
    deleted_at TIMESTAMPTZ,
    purged_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, client_id)
);

ALTER TABLE boxai_creator_objects
    ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;
ALTER TABLE boxai_creator_objects
    ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS boxai_creator_records_snapshot_idx
    ON boxai_creator_records (user_id, kind) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS boxai_creator_objects_snapshot_idx
    ON boxai_creator_objects (user_id) WHERE status = 'ready' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS boxai_creator_objects_pending_cleanup_idx
    ON boxai_creator_objects (updated_at) WHERE status = 'pending' AND purged_at IS NULL AND (deleted_at IS NULL OR expired_at IS NOT NULL);
