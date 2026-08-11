-- 06: admin "Show on website" publish toggle.
--
-- Additive and safe to re-run. Existing rows default to published (1) so the
-- current catalogue stays visible after the migration; the admin dashboard sets
-- it per-product for new listings. No `\c` line, so this targets whatever
-- database the connection is on (local dev: fastflow, production: fastflow_web).

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_published integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_products_is_published ON products (is_published);
