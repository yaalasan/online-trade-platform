\c fastflow

-- General contact-form inquiries (Step 3). Named to match product_inquiries;
-- unlike those, these carry no product_id — they are open leads from the
-- public /contact form.
CREATE TABLE contact_inquiries (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id    integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    name       text NOT NULL,
    email      text NOT NULL,
    company    text NOT NULL DEFAULT '',
    category   text NOT NULL DEFAULT '',
    message    text NOT NULL,
    created_at text NOT NULL,
    -- Stamped when the staff notification is delivered; stays NULL if delivery
    -- fails, so a background job can retry pending inquiries. The inquiry row is
    -- committed independently of notification, so a failed send never loses it.
    notified_at text
);

CREATE INDEX idx_contact_inquiries_created ON contact_inquiries (site_id, created_at);

-- Same per-tenant isolation every other tenant table gets in 04_rls.sql.
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries FORCE  ROW LEVEL SECURITY;
CREATE POLICY contact_inquiries_isolation ON contact_inquiries
    USING (site_id = current_setting('app.site_id')::int)
    WITH CHECK (site_id = current_setting('app.site_id')::int);
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_inquiries TO fastflow_app;
