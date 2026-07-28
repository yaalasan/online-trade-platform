\c fastflow

GRANT SELECT, INSERT, UPDATE, DELETE ON users              TO fastflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON translations_cache TO fastflow_app;

DO $mig$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','quotes','orders','messages','supplier_verifications',
    'audit_logs','trust_events','product_specs','product_inquiries','product_media'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I '
      'USING (site_id = current_setting(''app.site_id'')::int) '
      'WITH CHECK (site_id = current_setting(''app.site_id'')::int)',
      t || '_isolation', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO fastflow_app', t);
  END LOOP;
END $mig$;
