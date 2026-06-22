# Deploying Fastflow to a single VPS

Target architecture (one Linux server):

```
                 ┌─────────────── nginx (TLS, ports 80/443) ───────────────┐
fastflow.global ─┤ fastflow.global, www  ->  Flask (gunicorn) 127.0.0.1:5000 │
                 │ portal.fastflow.global -> Next.js (node)   127.0.0.1:3000 │
                 └──────────────────────────────────────────────────────────┘
                                         └─ PostgreSQL (local, portal DB)
                                         └─ SQLite data.db (Flask)
```

- **fastflow.global** (+ www) → public buyer marketplace (Flask)
- **portal.fastflow.global** → supplier portal (Next.js + Clerk + Postgres)

You run every command below **on the server** unless it says "Namecheap" or "Clerk dashboard".
Assumes **Ubuntu 22.04/24.04** and that you deploy into `/opt/fastflow` as a `fastflow` user.

---

## 0. Before you start — collect these

- A VPS with a **public IPv4**. Recommended: **Hetzner Cloud CX22** (2 vCPU / 4 GB / 40 GB,
  ~€4.5/mo) — the 4 GB comfortably runs both apps + Postgres *and* builds the Next.js portal
  without running out of memory.
  - **Image:** Ubuntu 24.04 LTS
  - **Location:** closest to your buyers (Hetzner: US-East Ashburn, US-West Hillsboro, Germany,
    Finland, Singapore)
  - Add your **SSH key** at creation. Note the public IPv4 → this is `SERVER_IP` everywhere below.
  - On a smaller 2 GB box, also do step 2b (swap) so the build doesn't get OOM-killed.
- A **Clerk** account (free) — you'll create a *Production* instance in step 8.

---

## 1. DNS at Namecheap (do this first — propagation takes time)

Namecheap → **Domain List** → **Manage** next to `fastflow.global` → **Advanced DNS**.

Delete the default "parking"/redirect records, then **Add New Record**:

| Type      | Host     | Value         | TTL       |
|-----------|----------|---------------|-----------|
| A Record  | `@`      | `SERVER_IP`   | Automatic |
| A Record  | `www`    | `SERVER_IP`   | Automatic |
| A Record  | `portal` | `SERVER_IP`   | Automatic |

(Leave the Clerk records for step 8.) Check propagation:
`dig +short fastflow.global` should return `SERVER_IP` before you run certbot in step 7.

---

## 2. Server base packages

```bash
ssh root@SERVER_IP
adduser --disabled-password --gecos "" fastflow      # service user
apt update && apt -y upgrade
apt -y install python3-venv python3-pip postgresql nginx certbot python3-certbot-nginx git ufw

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs

# Firewall: SSH + web
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

### 2b. Swap (skip on the 4 GB CX22; recommended on a 2 GB box)

A 2 GB swap file stops the Next.js build (`npm run build`) from being OOM-killed on smaller boxes.
Harmless to add on a 4 GB box too.

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persist across reboots
free -h   # confirm Swap shows 2.0Gi
```

---

## 3. Get the code

```bash
mkdir -p /opt/fastflow && chown fastflow:fastflow /opt/fastflow
# As the fastflow user from here on:
sudo -u fastflow -H bash
cd /opt
git clone <YOUR_REPO_URL> fastflow      # or rsync/scp your local copy to /opt/fastflow
cd /opt/fastflow
```

> No git remote? From your laptop:
> `rsync -av --exclude .venv --exclude node_modules --exclude .next ./ fastflow@SERVER_IP:/opt/fastflow/`

---

## 4. PostgreSQL (for the portal)

```bash
sudo -u postgres psql <<'SQL'
CREATE USER fastflow WITH PASSWORD 'PUT_A_STRONG_PASSWORD_HERE';
CREATE DATABASE fastflow OWNER fastflow;
SQL
```

Use that same password in the portal `DATABASE_URL` (step 6).

---

## 5. Flask marketplace

```bash
cd /opt/fastflow
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt          # Flask + gunicorn

cp deploy/flask.env.example .env
# Generate a secret and edit .env:
./.venv/bin/python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
nano .env        # paste SECRET_KEY, keep PRODUCTION=1 and PORTAL_URL=https://portal.fastflow.global
```

The app auto-creates `data.db` with its schema on first start, so a fresh server starts with an
**empty** marketplace. To carry over your current catalog/demo data, copy your local DB up
(it's gitignored, so it isn't in the clone):

```bash
# from your laptop:
scp data.db fastflow@SERVER_IP:/opt/fastflow/data.db
```

---

## 6. Next.js supplier portal

```bash
cd /opt/fastflow/web
npm ci

cp /opt/fastflow/deploy/portal.env.example .env
nano .env    # set DATABASE_URL password, Clerk PROD keys (step 8), NEXT_PUBLIC_MAIN_SITE_URL,
             # PLATFORM_ADMIN_EMAILS (your email -> platform admin)

npx prisma migrate deploy     # creates the portal schema in Postgres
npm run build                 # prisma generate + next build
```

> You can do the build now with placeholder Clerk keys and swap in the real `pk_live_/sk_live_`
> keys in step 8, then `sudo systemctl restart fastflow-portal`.

---

## 7. nginx + services + HTTPS

```bash
# back to a sudo-capable shell (exit the fastflow user shell)
exit

# systemd services
cp /opt/fastflow/deploy/systemd/fastflow-web.service    /etc/systemd/system/
cp /opt/fastflow/deploy/systemd/fastflow-portal.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now fastflow-web fastflow-portal
systemctl status fastflow-web fastflow-portal --no-pager   # both should be "active (running)"

# nginx site
cp /opt/fastflow/deploy/nginx/fastflow.conf /etc/nginx/sites-available/fastflow.conf
ln -s /etc/nginx/sites-available/fastflow.conf /etc/nginx/sites-enabled/fastflow.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# TLS (needs DNS from step 1 to resolve to this server already)
certbot --nginx -d fastflow.global -d www.fastflow.global -d portal.fastflow.global
```

certbot installs the certs, rewrites the config to listen on 443, and adds the HTTP→HTTPS redirect.
Auto-renewal is installed by the package (`systemctl status certbot.timer`).

---

## 8. Clerk production (for the portal auth)

The portal currently uses **test** keys (`pk_test_…`) which only work on localhost. For `portal.fastflow.global`:

1. Clerk dashboard → create a **Production** instance (or "Deploy to production" on your app).
2. Set the application domain to **`portal.fastflow.global`**.
3. Clerk shows a set of **DNS records** (CNAMEs like `clerk`, `clkmail`, `clk._domainkey`, `clk2._domainkey`). Add each at **Namecheap → Advanced DNS** exactly as shown (Host = the subdomain, Value = Clerk's target, Type = CNAME).
4. Wait for Clerk to verify those records (green checks).
5. Copy the production **Publishable** and **Secret** keys into `/opt/fastflow/web/.env`
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
6. Webhooks → add endpoint `https://portal.fastflow.global/api/webhooks/clerk`, copy its signing secret → `CLERK_WEBHOOK_SECRET`.
7. Rebuild + restart:
   ```bash
   cd /opt/fastflow/web && npm run build
   sudo systemctl restart fastflow-portal
   ```

---

## 9. Verify

```bash
curl -I https://fastflow.global              # 200, public marketplace
curl -I https://portal.fastflow.global       # 200/307 (redirects to /sign-in)
```

In a browser:
- `https://fastflow.global` → marketplace loads, search works, language switcher EN/中文/РУ.
- `https://portal.fastflow.global` → sign up with your `PLATFORM_ADMIN_EMAILS` address → you land in the dashboard as platform admin.
- Publish a product in the portal → it appears on the public marketplace (the Flask↔portal bridge via `PORTAL_API_URL`).

---

## Updating after a code change

```bash
cd /opt/fastflow && git pull
# Flask:
./.venv/bin/pip install -r requirements.txt && sudo systemctl restart fastflow-web
# Portal:
cd web && npm ci && npx prisma migrate deploy && npm run build && sudo systemctl restart fastflow-portal
```

## Logs / troubleshooting

```bash
journalctl -u fastflow-web -f         # Flask/gunicorn
journalctl -u fastflow-portal -f      # Next.js
tail -f /var/log/nginx/error.log
```

- **502 on a domain** → that app's service isn't running (`systemctl status …`).
- **Portal 500 / auth loops** → wrong/missing Clerk prod keys, or Clerk DNS not verified yet.
- **certbot fails** → DNS for that name isn't pointing at the server yet; re-check `dig +short <name>`.
- **Secure-cookie / http redirect issues** → confirm `PRODUCTION=1` is set (enables ProxyFix + secure cookies).

## Notes

- The Flask side uses **SQLite** (`data.db`) — fine for the marketplace's mostly-read traffic with 3 gunicorn workers. Back it up with a simple `cp data.db data.db.$(date +%F)` cron if it holds real data.
- The portal data lives in **Postgres**; back it up with `pg_dump fastflow`.
- Want zero-downtime / containers instead? This same layout maps cleanly to Docker Compose later — ask and I'll add it.

---

## China considerations (audience: foreign buyers + mainland manufacturers)

**Recommended now:** an **offshore VPS in Singapore or Hong Kong**, deployed with the steps above
**unchanged** (keep Clerk + Unsplash). Rationale:

- Your paying customers (**buyers**) are **international** — no benefit to mainland hosting, and Unsplash
  images load fine for them. **No ICP needed.**
- Mainland **manufacturers are onboarded manually by you/staff** at first, so the portal's only real
  users early on are operators — Clerk works fine for them (VPN if ever needed).
- Singapore = great global connectivity for buyers + reachable from China for your team. Providers:
  Vultr / DigitalOcean / Linode Singapore (or HK).

**Only consider the mainland path below if** mainland manufacturers later start **self-registering at
scale** and need mainland-fast access. Then these two firewall realities kick in:

- **ICP filing (ICP备案) is mandatory** to host on a *mainland* data center (Alibaba/Tencent/Huawei,
  Beijing/Shanghai/Shenzhen). It's tied to a mainland business entity and takes ~1–3 weeks. Without
  it the data center blocks ports 80/443. **Start it in parallel — it's the long pole.**
- **Some third-party services are blocked behind the Great Firewall** and must be replaced before
  the mainland launch (they fail *inside* the mainland, and are slow even from Hong Kong):
  - **Unsplash images** (`images.unsplash.com`) — the Flask hero/product images. Self-host them or
    serve from a China CDN (e.g. Alibaba OSS + CDN). Easy fix.
  - **Clerk** — the entire portal auth. Clerk's scripts/domains are blocked in the mainland, so
    supplier sign-in won't work there. Plan to replace it (e.g. self-hosted Casdoor/Authing, or
    another China-viable auth) before the mainland cutover. Bigger fix.

Migration path **if** you ever go mainland:
1. Open a mainland cloud account with your entity; provision an ECS in a mainland region.
2. File ICP for `fastflow.global` through that provider (≈1–3 weeks).
3. Land the dependency fixes (self-hosted images + replaced auth) before/at cutover.
4. Re-run this runbook on the mainland box; repoint Namecheap DNS to its IP.

Using **Alibaba Cloud** for the offshore box too (HK/Singapore region) keeps the same account/console
if you later add a mainland region — but it's optional; any Singapore/HK VPS works.
