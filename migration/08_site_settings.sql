-- 08: per-site key/value settings (admin-managed single values such as the
-- About-page intro photo). Same tenant RLS pattern as the other content tables.
-- Idempotent. No `\c` line (targets the connected DB: dev fastflow / prod fastflow_web).

CREATE TABLE IF NOT EXISTS site_settings (
    site_id integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    key     text NOT NULL,
    value   text NOT NULL DEFAULT '',
    PRIMARY KEY (site_id, key)
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_settings_isolation ON site_settings;
CREATE POLICY site_settings_isolation ON site_settings
    USING (site_id = current_setting('app.site_id')::int)
    WITH CHECK (site_id = current_setting('app.site_id')::int);
GRANT SELECT, INSERT, UPDATE, DELETE ON site_settings TO fastflow_app;
