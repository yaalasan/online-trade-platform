-- 07: team members for the public "About us" page (admin-managed).
--
-- Tenant-scoped with the same RLS pattern as every other content table
-- (05_contact_inquiries). Idempotent. No `\c` line, so it targets whatever
-- database the connection is on (local dev: fastflow, production: fastflow_web).

CREATE TABLE IF NOT EXISTS team_members (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id      integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    name         text NOT NULL,
    role         text NOT NULL,
    bio          text NOT NULL DEFAULT '',
    photo_url    text NOT NULL DEFAULT '',
    sort_order   integer NOT NULL DEFAULT 0,
    is_published integer NOT NULL DEFAULT 1,
    created_at   text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_members_order ON team_members (site_id, sort_order);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_members_isolation ON team_members;
CREATE POLICY team_members_isolation ON team_members
    USING (site_id = current_setting('app.site_id')::int)
    WITH CHECK (site_id = current_setting('app.site_id')::int);
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO fastflow_app;
