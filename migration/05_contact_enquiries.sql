\c fastflow

-- General contact-form enquiries (Step 3). Unlike product_inquiries these
-- carry no product_id — they are open leads from the public /contact form.
CREATE TABLE contact_enquiries (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id    integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    name       text NOT NULL,
    email      text NOT NULL,
    company    text NOT NULL DEFAULT '',
    category   text NOT NULL DEFAULT '',
    message    text NOT NULL,
    created_at text NOT NULL
);

CREATE INDEX idx_contact_enquiries_created ON contact_enquiries (site_id, created_at);

-- Same per-tenant isolation every other tenant table gets in 04_rls.sql.
ALTER TABLE contact_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_enquiries FORCE  ROW LEVEL SECURITY;
CREATE POLICY contact_enquiries_isolation ON contact_enquiries
    USING (site_id = current_setting('app.site_id')::int)
    WITH CHECK (site_id = current_setting('app.site_id')::int);
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_enquiries TO fastflow_app;
