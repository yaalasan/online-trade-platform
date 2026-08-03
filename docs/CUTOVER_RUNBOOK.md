# fastflow.global cutover runbook (old SQLite app → new Postgres/RLS app)

Staged, rollback-safe. **Run one PART at a time and paste the output back**
before moving on — do not run straight through. The agent cannot SSH to the box
(password-only), so every server command here is run by a human operator.

Local code for the cutover is already done and verified on `feat/frontend-rebuild`:
supplier identity removed from public HTML + APIs, and `APP_ENV=production`
gating unknown hosts to 404. See the artifacts in `deploy/`.

Server layout this runbook assumes (confirm in Part 1):
- New code dir `/opt/fastflow-v2`, new service `fastflow-web-v2` on `127.0.0.1:8001`
- Old app left untouched: old code dir, old `fastflow-web` unit, old nginx block
- EnvironmentFile `/etc/fastflow/web-v2.env` (root:600)

---

## PART 1 — preflight (READ-ONLY) → STOP AND REPORT
```bash
grep PRETTY_NAME /etc/os-release; python3 --version; psql --version 2>/dev/null || echo "psql: NOT installed"
systemctl list-units --type=service --all | grep -iE 'fastflow|gunicorn|flask'
systemctl cat fastflow-web 2>/dev/null || echo "no fastflow-web unit"
sudo -u postgres psql -lqt 2>/dev/null | grep -i fastflow || echo "no fastflow Postgres DB"
sudo -u postgres psql -d fastflow -c "\dt" 2>/dev/null | head -30
ls -la /opt/fastflow 2>/dev/null
find /opt /home /srv /var/www -maxdepth 4 -name '*.db' 2>/dev/null -exec ls -lh {} \;
nginx -T 2>/dev/null | awk '/server_name[^;]*fastflow\.global/,/}/' | head -60
ls -l /etc/letsencrypt/live/ 2>/dev/null
df -h /; dig +short fastflow.global A
```

> **Resolve the contradiction first.** The task premise is "production is still
> the old SQLite app," but prior notes say Postgres may already be present. If
> Part 1 shows a populated Postgres `fastflow` DB already serving the site, STOP
> — Parts 2–3 (fresh DB + SQLite migration) may be wrong and we replan.

### Backups (run after preflight, verify before proceeding)
```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p /root/cutover-backup-$TS
# [CONFIRM] data.db path from preflight
cp /opt/fastflow/data.db /root/cutover-backup-$TS/data.db
sha256sum /opt/fastflow/data.db /root/cutover-backup-$TS/data.db
tar czf /root/cutover-backup-$TS/appdir.tgz /opt/fastflow            # [CONFIRM] dir
cp -a /etc/nginx/sites-available/fastflow.global /root/cutover-backup-$TS/  # [CONFIRM]
systemctl cat fastflow-web > /root/cutover-backup-$TS/fastflow-web.service 2>/dev/null
# Verify the SQLite backup opens and row counts match:
for t in $(sqlite3 /opt/fastflow/data.db ".tables"); do
  echo "$t: $(sqlite3 /opt/fastflow/data.db "SELECT COUNT(*) FROM $t") vs $(sqlite3 /root/cutover-backup-$TS/data.db "SELECT COUNT(*) FROM $t")"
done
```
Report the per-table row counts. **STOP.**

---

## PART 2 — Postgres schema (no RLS yet) → STOP AND REPORT
```bash
# Install Postgres if psql was absent (Ubuntu):
# apt-get update && apt-get install -y postgresql
cd /opt/fastflow-v2   # new checkout of feat/frontend-rebuild
# Generate FRESH passwords (do NOT reuse local dev creds); keep them for the env file:
OWNER_PW=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))")
APP_PW=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))")
echo "owner=$OWNER_PW"; echo "app=$APP_PW"   # capture these into /etc/fastflow/web-v2.env
# 01_setup.sql expects the two passwords — apply as the postgres superuser:
sudo -u postgres psql -v owner_pw="'$OWNER_PW'" -v app_pw="'$APP_PW'" -f migration/01_setup.sql
# Schema + contact inquiries as the owner:
PGPASSWORD=$OWNER_PW psql -h localhost -U fastflow_owner -d fastflow -f migration/02_schema.sql
PGPASSWORD=$OWNER_PW psql -h localhost -U fastflow_owner -d fastflow -f migration/05_contact_inquiries.sql
# Confirm the three sites seeded, apex form, no www:
PGPASSWORD=$OWNER_PW psql -h localhost -U fastflow_owner -d fastflow -c "SELECT id,host FROM sites ORDER BY id;"
```
> Do NOT run `04_rls.sql` yet. Report the applied output. **STOP.**

---

## PART 3 — migrate data → STOP AND REPORT BEFORE DELETING
```bash
cp /opt/fastflow/data.db /tmp/cutover-src.db   # work from a COPY
# Preview the cleaner FIRST — it shows exactly what it would delete/null:
python3 migration/00_clean_source.py /tmp/cutover-src.db --dry-run   # [CONFIRM] flag name
```
**Paste the preview and wait for approval before executing the clean.** Then:
```bash
python3 migration/00_clean_source.py /tmp/cutover-src.db      # execute clean
python3 migration/03_migrate.py /tmp/cutover-src.db           # load into Postgres
PGPASSWORD=$APP_PW psql -h localhost -U fastflow_app -d fastflow -c \
  "SELECT set_config('app.site_id','1',false); SELECT 'products' t, count(*) FROM products;"  # spot-check
PGPASSWORD=$OWNER_PW psql -h localhost -U fastflow_owner -d fastflow -f migration/04_rls.sql
```
### Isolation smoke test (as fastflow_app)
```bash
PGPASSWORD=$APP_PW psql -h localhost -U fastflow_app -d fastflow <<'SQL'
SELECT set_config('app.site_id','1',false); SELECT count(*) site1 FROM products;
SELECT set_config('app.site_id','2',false); SELECT count(*) site2 FROM products;
-- forged cross-tenant insert must be rejected by WITH CHECK:
SELECT set_config('app.site_id','1',false);
INSERT INTO products (site_id,category,name,supplier,location,description,price,created_at)
VALUES (2,'x','x','x','x','x','x', now()::text);
SQL
# Owner with NO app.site_id set must be blocked by FORCE RLS:
PGPASSWORD=$OWNER_PW psql -h localhost -U fastflow_owner -d fastflow -c "SELECT count(*) FROM products;"
```
Report counts + that the forged insert errored and the unset-owner select was blocked. **STOP.**

---

## PART 5 — deploy the code (alongside old) → STOP AND REPORT
```bash
# New checkout, fresh venv:
git clone <repo> /opt/fastflow-v2 && cd /opt/fastflow-v2 && git checkout feat/frontend-rebuild
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
chown -R fastflow:fastflow /opt/fastflow-v2

# EnvironmentFile (root:600) from deploy/web-v2.env.example, real values filled:
install -o root -g root -m 600 /dev/null /etc/fastflow/web-v2.env
$EDITOR /etc/fastflow/web-v2.env   # DATABASE_URL uses $APP_PW; APP_ENV=production; SMTP/portal/SECRET_KEY

# New unit from deploy/fastflow-web-v2.service (strip the // header comments):
cp deploy/fastflow-web-v2.service /etc/systemd/system/fastflow-web-v2.service
systemctl daemon-reload && systemctl enable --now fastflow-web-v2
systemctl status fastflow-web-v2 --no-pager | head -20

# Smoke test the new app DIRECTLY (before nginx), with the real Host header:
curl -sS -H 'Host: fastflow.global' -o /dev/null -w 'home:%{http_code}\n' http://127.0.0.1:8001/
curl -sS -H 'Host: bogus.example'   -o /dev/null -w 'bogus:%{http_code}\n' http://127.0.0.1:8001/   # want 404
```
Report the smoke test. Do NOT touch nginx. **STOP.**

---

## PART 6 — switch nginx + verify
```bash
cp /etc/nginx/sites-available/fastflow.global /etc/nginx/sites-available/fastflow.global.OLD.bak
cp /opt/fastflow-v2/deploy/nginx-fastflow.global.conf /etc/nginx/sites-available/fastflow.global  # fill [CONFIRM]
nginx -t && systemctl reload nginx
```
Then verify on the live domain (see checklist below). If anything fails →
`docs/ROLLBACK.md`.

Verify:
- All five pages 200 over HTTPS; category pages show the empty state
- `curl -s https://fastflow.global/products/... | grep -i` supplier/location → none in HTML/meta
- Submit a real enquiry → row in Postgres `contact_inquiries`, email to sales@fastflow.global, `notified_at` stamped
- `/admin/inquiries` redirects to `/login` when logged out; `/login` works; non-admin → 403
- `curl -H 'Host: bogus' https://fastflow.global/` → 404
- `curl -sI https://fastflow.global/` shows CSP incl. `media-src 'self' https:`, HSTS, X-Frame-Options
- Old indexed URLs: compare old SPA routes vs new; if previously-crawlable paths now 404, add nginx redirects to the nearest new page

Old-URL handling and the redirect decision get reported here as the final item.
