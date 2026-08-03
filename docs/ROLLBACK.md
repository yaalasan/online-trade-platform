# Rollback — revert fastflow.global to the old app

Two-minute reversal of the v2 (Postgres) cutover, back to the old SQLite app.
Executed cutover on 2026-08-03; these steps are the real, tested paths (no
placeholders).

## What the cutover changed (and what it did NOT)
- **Only one line of nginx changed:** in `/etc/nginx/sites-available/fastflow.conf`
  the `fastflow.global` block's `proxy_pass` went `127.0.0.1:5000` → `127.0.0.1:8001`.
  The `portal.fastflow.global` block (→ :3000) and all Certbot-managed TLS lines
  were left untouched.
- **The old app is still running.** `fastflow-web.service` (gunicorn on
  `127.0.0.1:5000`, SQLite `/opt/fastflow/data.db`) was never stopped or disabled.
  Rollback does not need to start anything — only to re-point nginx.
- **The old SQLite `data.db` is untouched.** The migration worked from a copy
  (`/tmp/cutover-src.db`). Rolling nginx back also rolls the data back.
- New app: `fastflow-web-v2.service` (gunicorn on `127.0.0.1:8001`, Postgres
  `fastflow_web`). New Postgres DB and roles are independent of the portal's
  `fastflow` DB.
- Pre-cutover backups: `/root/cutover-backup-20260803-022353/`
  (verified SQLite snapshot + `appdir.tgz` + full nginx dump + old unit).

## When to use
Anything wrong after the flip: 5xx on the live domain, contact form not storing,
admin login broken, wrong tenant served, missing content, etc.

## Steps (run as root on the server)

```bash
# 1. Re-point nginx to the OLD app. Either flip the one line back:
sed -i 's|http://127.0.0.1:8001;|http://127.0.0.1:5000;|' \
    /etc/nginx/sites-available/fastflow.conf
#    ...or restore the exact pre-cutover file saved during the flip:
# cp /etc/nginx/sites-available/fastflow.conf.OLD.bak \
#    /etc/nginx/sites-available/fastflow.conf

nginx -t                       # must pass before reload
systemctl reload nginx

# 2. Confirm the old app is serving (it was never stopped).
systemctl is-active fastflow-web
curl -sS -o /dev/null -w '%{http_code}\n' https://fastflow.global/

# 3. (Optional) stop the new app so it is not holding resources.
systemctl stop fastflow-web-v2
```

If nginx `reload` ever fails to restore service, fall back to a full restart:

```bash
systemctl restart nginx
```

## Verifying rollback
- `https://fastflow.global/` returns the OLD site (200).
- `https://portal.fastflow.global/` still 200 (was never touched either way).

## Full teardown of v2 (only once you are sure you will not retry)
```bash
systemctl disable --now fastflow-web-v2
# /opt/fastflow-v2, /etc/fastflow/web-v2.env, and the Postgres `fastflow_web`
# database can be removed later; leaving them costs little and speeds a retry.
# Do NOT drop the portal's `fastflow` database.
```
