-- BOXAI: public status surface visibility for channel monitors.
-- Forward-only, idempotent. Enabled monitors default to public.
--
-- public_visible controls whether an enabled monitor appears on the
-- unauthenticated marketing status page (GET /api/v1/public/status).
-- Admin console and authenticated user views still list all enabled monitors.

ALTER TABLE channel_monitors
    ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_channel_monitors_public_visible
    ON channel_monitors (enabled, public_visible)
    WHERE enabled = TRUE AND public_visible = TRUE;
