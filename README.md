# Fastflow — B2B Global Sourcing Platform

Fastflow connects international buyers with Chinese manufacturers through a
**brokered** model: suppliers list their companies and products, buyers discover
them and submit sourcing requests, and Fastflow staff broker the introductions.

The project is two applications that share one catalog:

| App | Audience | Stack | Default URL |
|-----|----------|-------|-------------|
| **Buyer site** (`/`, `index.html`, `main.py`) | Buyers — the public, Alibaba-style storefront (trilingual EN/中文/РУ) | Flask + SQLite | http://localhost:5000 |
| **Supplier portal** (`web/`) | Manufacturers/suppliers + Fastflow staff | Next.js 15 + Prisma + Postgres + better-auth | http://localhost:3000 |

They are connected by a small read-only JSON **API bridge**: a manufacturer who
registers in the portal and publishes a product appears on the buyer site
automatically, and a buyer's sourcing request on the buyer site flows back into
the portal's staff "broker queue."

```
                 publishes products            reads catalog (JSON bridge)
  Supplier portal ───────────────►  Postgres  ◄─────────────── Buyer site (Flask)
   (Next.js, :3000)                                              (:5000)
        ▲                                                          │
        └───────────────  buyer sourcing request  ◄───────────────┘
                          POST /api/public/inquiries
```

---

## Repository layout

```
.
├── main.py              # Flask buyer site (SQLite, search, RFQs, portal bridge)
├── index.html           # Buyer-site markup (trilingual)
├── static/              # Buyer-site JS + CSS
├── requirements.txt     # Flask
├── run-demo.sh          # Launch the Flask buyer site detached
├── docs/                # Architecture / data-model / security notes (incl. historical v2–v3)
└── web/                 # Next.js supplier portal
    ├── prisma/          # Schema + migrations
    └── src/
        ├── app/         # Routes incl. /dashboard and /api/public (the bridge)
        ├── server/      # Server actions
        └── lib/         # Catalog read-model, auth, storage, validation
```

---

## Prerequisites

- **Python** 3.11+ (for the Flask buyer site)
- **Node.js** 18.18+ and **npm** (for the portal)
- **PostgreSQL** 14+ (portal database)
- (Optional) an SMS provider (Alibaba Dysms / Tencent Cloud SMS) for phone login in
  production — dev uses `SMS_PROVIDER=console`. Auth itself is self-hosted, no account needed.

---

## Quick start

### 1. Buyer site (Flask)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit values (see Environment variables)
python main.py                # → http://localhost:5000
```

The buyer site runs on its own and works standalone (it falls back to local
SQLite demo data if the portal is offline).

### 2. Supplier portal (Next.js)

```bash
cd web
npm install
cp .env.example .env          # then fill in DATABASE_URL + BETTER_AUTH_SECRET/URL
npx prisma migrate deploy     # create the Postgres schema
npx prisma generate
npm run dev                   # → http://localhost:3000
```

Sign up, create your company (choose **Manufacturer**), add products and set them
**Active**, and they will surface on the buyer site.

Sign in by **email + password** or **phone + SMS OTP** (Chinese suppliers use phone;
in dev the code prints to the terminal). 

> The email in `PLATFORM_ADMIN_EMAILS` becomes a platform admin on first sign-up
> (access to the broker queue and KYB approvals).

---

## Environment variables

### Buyer site (root `.env`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SECRET_KEY` | Flask session signing key (**required in production**) | dev: ephemeral |
| `PORTAL_API_URL` | Where the portal's JSON bridge lives | `http://localhost:3000` |
| `PORTAL_URL` | Portal URL for the "Supplier Portal" buttons | = `PORTAL_API_URL` |
| `PORTAL_TIMEOUT` | Bridge request timeout (seconds) | `2.5` |
| `PRODUCTION` | `1`/`true` enables production cookie/security settings | unset |
| `FLASK_DEBUG` | `1`/`true` enables debug mode (dev only) | unset |
| `BIND_ALL` | `1`/`true` binds `0.0.0.0` instead of localhost | unset |

### Portal (`web/.env`)

See `web/.env.example`. Key values: `DATABASE_URL`, `BETTER_AUTH_SECRET` (session
signing key), `BETTER_AUTH_URL` (the portal's public origin), `SMS_PROVIDER`
(`console` in dev), `PLATFORM_ADMIN_EMAILS`, and `NEXT_PUBLIC_MAIN_SITE_URL` (link
back to the buyer site, default `http://localhost:5000`).

---

## How the connection works (API bridge)

The portal exposes read-only endpoints under `web/src/app/api/public/`:

- `GET /api/public/products` — active products (search/filter/paginate)
- `GET /api/public/products/[id]` — product detail
- `GET /api/public/suppliers`, `GET /api/public/suppliers/[id]`
- `POST /api/public/inquiries` — create an anonymous buyer lead (broker queue)

The Flask buyer site calls these (best-effort, with a timeout and SQLite
fallback) and merges the results into its `/api/marketplace`, `/api/suppliers`,
and `/api/categories` responses. Buyer requests submitted on the Flask contact
form are forwarded to `POST /api/public/inquiries`.

---

## Demo accounts (buyer site, development only)

The Flask site seeds sample accounts for local exploration. **These are not for
production** — set a real `SECRET_KEY` and remove the seed users before any
public deployment.

- Buyer: `buyer@example.com` / `Password123`
- Supplier: `aurora@example.com` / `Password123`
- Admin: `admin@example.com` / `Password123`

---

## Documentation

Design and architecture notes live in [`docs/`](docs/). Note that `docs/v2`,
`docs/v3`, and `docs/v3.1` describe earlier iterations (including payments/escrow
concepts) that were **superseded by the brokered model** — they are kept for
history, not as the current spec.

---

## Security notes

- Secrets (`web/.env`, root `.env`) and the database (`data.db`) are git-ignored
  and must never be committed. Only `*.env.example` templates are tracked.
- Portal media uploads write to `web/public/uploads` (local disk) via a swappable
  storage adapter — switch to S3/R2 before production.
- The public inquiry endpoints are rate-limited in-memory (single-node); use a
  shared store (e.g. Redis) for multi-node deployments.

---

## Status & roadmap

Implemented: supplier/manufacturer profiles, product catalog, KYB verification,
platform-staff broker queue, the buyer site, and the buyer↔portal bridge.

Not yet done: production `next build`/deploy, object-storage for media, product
**video** support, and merging feature branches into `main`.

---

## License

See [`LICENSE`](LICENSE). _(No license file is present yet — add one to clarify
how others may use this code.)_
