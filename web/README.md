# Fastflow Supplier Portal

The supplier/manufacturer + staff workspace for Fastflow. Buyers do **not** use
this app — they use the Flask buyer site (see the [root README](../README.md)).
This portal publishes the catalog that the buyer site reads over an API bridge.

**Stack:** Next.js 15 (App Router) · Prisma · PostgreSQL · better-auth · Tailwind.

## Setup

```bash
npm install
cp .env.example .env      # set DATABASE_URL, BETTER_AUTH_SECRET/URL, SMS_PROVIDER, PLATFORM_ADMIN_EMAILS
npx prisma migrate deploy # apply migrations
npx prisma generate
npm run dev               # http://localhost:3000
```

Auth is **self-hosted** (better-auth) — no third-party provider, so it works from
mainland China. Two login methods: **email + password** and **phone + SMS OTP**
(the path for Chinese suppliers; see `src/lib/sms.ts`). In dev, `SMS_PROVIDER=console`
prints OTP codes to the terminal. The email in `PLATFORM_ADMIN_EMAILS` becomes a
platform admin on first sign-up (broker queue + KYB approvals).

Bootstrap or reset a password from the CLI:

```bash
node scripts/set-password.mjs you@example.com 'a-strong-password'
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations (no shadow DB) |
| `npm run db:studio` | Open Prisma Studio |

## Layout

- `src/app/dashboard/` — authenticated workspace (profile, products, KYB, broker queue)
- `src/app/api/public/` — read-only JSON bridge consumed by the buyer site
- `src/lib/` — catalog read-model, auth/RBAC, storage adapter, validation
- `src/server/` — server actions
- `prisma/` — schema + migrations

## Notes

- Media uploads write to `public/uploads` via a swappable storage adapter
  (`src/lib/storage.ts`) — switch to S3/R2 before production.
- `web/.env` holds secrets and is git-ignored; only `.env.example` is tracked.
