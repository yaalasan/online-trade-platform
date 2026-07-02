# Fastflow — Fix Plan (audit-accurate, single source of truth)

You are modifying the **live** Fastflow system. It is **two separate stacks**, do not conflate them:
- **Flask + SQLite** (`main.py`, `app.js`, `index.html`) → `fastflow.global`, the **buyer marketplace**.
- **Next.js 15 + Prisma/Postgres** (`web/`) → `portal.fastflow.global`, the **supplier portal**.
They bridge over internal JSON; Flask falls back to SQLite if the portal is unreachable.

This plan is derived from a real code audit. Task line-refs point at the actual code. Ignore any
other spec files in the repo.

---

## OPERATING PROTOCOL (idempotent — don't redo finished work)

1. Branch `fix/overhaul`. Never push to the production branch.
2. Ledger file `FIX_PROGRESS.md` at repo root. If missing, create it from the checklist at the
   bottom (all unchecked). If present, read it FIRST — it's your memory.
3. Per task: if ledger says `[x]`, run only its **Done-check**; pass → print `SKIP <id>` and move on.
   If `[ ]`, run the Done-check anyway (may already pass from prior work) → if pass, mark `[x]` and
   `SKIP`; else implement, re-verify the Done-check, mark `[x]` with evidence (file:line/command), commit.
4. One commit per task: `fix(<id>): <summary>`. Never re-run a closed task in the same session.
5. Inspect only what a task needs. Don't re-scan the repo per task. Print a DONE/SKIP summary at the end.

---

## P0 — SECURITY (breaking now)

### [S1] Enforce CSRF on Flask (Flask stack)
**Reality:** `verify_csrf_token()` defined at main.py:788, CSRF cookie set on every response, but the
function is **never called** on any route. All mutations are unprotected.
**Done-check:** a state-mutating request (e.g. POST /api/products/<id>/inquiry) without a valid CSRF
token is rejected 403; with the token it succeeds.
**Do:** call `verify_csrf_token()` on every state-mutating route (register, login, product
create/update/specs, quote, order, message, verification, contact, inquiry) via a before-request hook
for non-SAFE methods on `/api/`. Then make `app.js` read the CSRF cookie and send it as an
`X-CSRF-Token` header on every mutating `fetch` (double-submit). **Verify anonymous visitors get the
cookie and can still submit public forms (inquiry, contact, register) — test in an incognito browser,
not curl.** Leave the portal's better-auth CSRF as-is; just confirm it's on.

### [S2] Fix double HTML-escaping (Flask stack)
**Reality:** `clean_str()` html-escapes before DB write (main.py:194); `escapeHtml()` re-escapes on
render (app.js:1028). `AT&T` → stored `AT&amp;T` → shown `AT&amp;amp;T`. Affects specs, inquiries, all user text.
**Done-check:** a spec value `"> 3000mm & <L>"` stores raw in SQLite and renders on-screen exactly as
`> 3000mm & <L>` (no `&amp;`).
**Do:** remove `html_escape()` from `clean_str()` — keep trimming/length caps only. Keep `escapeHtml()`
on render (that's the correct output-side defense). Write a **one-off migration** that `html.unescape()`s
existing affected columns **exactly once** (product name/specs label+value, inquiry name/email/message,
supplier fields). Guard against unescaping twice. Only escape manually at non-HTML outputs (emails/exports).

### [S3] Close `/api/translate` abuse (Flask stack)
**Reality:** main.py:937, unauthenticated, 20/min. Anyone can drain the Claude quota.
**Done-check:** anonymous cross-origin calls are refused; page translation still works for real visitors.
**Do:** restrict to same-origin (check Origin/Referer against your domains), rate-limit on the **real
client IP behind Cloudflare** (`CF-Connecting-IP`/ProxyFix, not `remote_addr`), cap input length, and
**cache translations at rest** (store translated fields keyed by source hash) so the endpoint isn't
called on every page view. Do not require login (public browsing needs it).

### [S4] IDOR weak fallback (Flask stack)
**Reality:** `_owns_product()` (main.py:755) allows write if `product.supplier == user["company"]`
(free-text) when `supplier_id` is null. Same company-name string = write access.
**Done-check:** ownership passes only on numeric `supplier_id == user["id"]`.
**Do:** confirm the startup backfill (main.py:686) has populated `supplier_id`, then drop the
company-name branch so writes require the numeric match. Log any rows still lacking `supplier_id`.

---

## P0 — OPS / CONFIG (quick unblocks)

### [O1] Portal build ownership (portal stack)
**Reality:** portal product-page changes are invisible; `.next/` likely owned by root while the service
runs as `fastflow`, serving a stale cached build.
**Done-check:** `.next/` is owned by `fastflow:fastflow` and the portal serves the current build.
**Do:** `sudo chown -R fastflow:fastflow /opt/fastflow/web/.next && sudo systemctl restart fastflow-portal`.
Document this as a post-build step so it doesn't recur.

### [O2] Dead R2 upload path — activate or remove (both stacks)
**Reality:** `product_uploads.py` only loads when 5 R2 env vars are set; they aren't, so it's dead and
`MediaUploader.tsx` POSTs to a 404. The portal already uploads images fine via its own server actions.
**Done-check:** no component posts to a dead endpoint.
**Decision (default = REMOVE):** since portal image upload already works via server actions, **remove**
`product_uploads.py` and `MediaUploader.tsx` and any references, to cut dead weight. Only keep/activate
(set the R2 env vars) if you specifically want direct-to-R2 uploads — if so, wire the presign to the
portal's real product IDs, not Flask's.

### [O3] Portal→Flask inquiry 404 (portal stack)
**Reality:** `web/app/api/products/[id]/inquiry/route.ts` defaults to `https://fastflow.global` (no
`FLASK_API_URL` in portal `.env`) and passes a **Prisma UUID** to a Flask route expecting an **integer**
→ 404 for portal products.
**Done-check:** an inquiry on a portal product persists successfully and reaches the supplier.
**Do:** portal products live in Postgres, not Flask — **handle portal inquiries in the portal's own
store/server action**, not by proxying to Flask's integer route. Route Flask-marketplace inquiries to
Flask, portal inquiries to Postgres. Add `FLASK_API_URL` to the portal `.env` only if a real proxy path
remains.

---

## P1 — LANDING PAGE (content/copy — Flask stack, low risk)

### [L1] Fabricated hero stats
**Reality:** hardcoded `30+ / 500+ / 12,000+ / 15+ Years` (index.html:98–111) never reflect real data.
**Done-check:** hero shows no unbacked fabricated numbers.
**Do:** remove them, or replace with claims you can defend. (The live stats strip stays hidden — fine.)

### [L2] Hero + copy rewrite, cut "AI" spam
**Reality:** "AI" appears ~20× but the only real AI feature is translation. Matching/chatbot/risk/docs
are marketing with no implementation.
**Done-check:** "AI" appears ≤3× in index.html and hero uses the copy below.
**Do:** hero → eyebrow `Cross-border sourcing, handled`; H1 `Source from verified Chinese factories —
without the guesswork`; sub `Tell us what you need. Get matched with vetted suppliers in days, then let
us handle quotes, compliance, and shipping.`; CTAs `Find suppliers` / `List your factory`. Rewrite the
four "strengths" to describe what exists (translation, verification, sourcing help) — don't advertise
unbuilt AI features. Delete "one-stop/full-process/intelligent/empowering". Update i18n strings too.

### [L3] Empty Team section
**Reality:** `#team-grid` (index.html:337) is empty, renders a blank titled section.
**Done-check:** the Team section is populated or removed (not a blank block).
**Do:** hide/remove it, or populate from real data.

### [L4] Fake testimonials
**Reality:** three placeholder quotes (index.html:438–464).
**Done-check:** testimonials removed or carry verifiable attribution.
**Do:** remove, or replace with real, attributed references.

---

## P1 — PRODUCT PAGE (make the rich page actually render)

### [B1] Portal product schema gaps (portal stack)
**Reality:** `types.ts` defines `variants, priceTiers, packaging, descriptionBlocks, faqs`, but the
**Prisma schema has none of them** (schema.prisma), so `ProductDetailClient` maps them to `[]` and those
sections render nothing. `specifications` exists as `Json?`; `ProductImage[]` (multi-image) exists.
**Done-check:** those five relations/fields exist in Prisma, migrated, and the portal product page renders
them when populated.
**Do:** add the missing models/relations + a Prisma migration, wire the product server actions to read/
write them, and connect them into `ProductDetailClient`. Keep specs flexible (no hardcoded fields).

### [B2] Buyer-site multi-image gallery (Flask stack) — DECIDED: YES
**Reality:** Flask products have a single `image_url` (main.py:220); the buyer `openProductDetail` modal
shows only that one image.
**This is the DISPLAY half; the INPUT half is [M2].** Build the `product_media` table + gallery under
[M2] (input) and render it here. Buyer product view renders a gallery (main stage + thumbnail rail,
video-first supported) from `product_media`, ordered by `sort_order`, with the primary image first.
**Done-check:** buyer product view renders multiple media from `product_media` as a gallery.

---

## PART M — Media input & marketplace (model on Made-in-China)

The root problem: **there is no multi-media INPUT anywhere** — the portal add-product form and the
Flask admin form both accept only a single photo URL. Fix the input first; the galleries (B1/B2) then
have data to show. Model the UX on Made-in-China's product form and marketplace.

### [M1] Portal add/edit-product: multi-media uploader (portal stack)
**Reality:** the portal product form has no multi-image/video control (effectively one image), yet
`ProductImage[]` and a working image-upload server action (8MB + MIME allowlist) already exist.
**Done-check:** in the portal form, a supplier can add ≥2 images (multi-select or drag-drop), see a
preview grid, reorder them, mark a primary, optionally add a video; all persist and appear in the
product gallery.
**Do:** add a multi-file uploader UI to the add/edit-product form wired to the EXISTING ProductImage
upload server action (don't build new storage). Preview grid with remove, drag-reorder (persist
`sort_order`), and a "set as primary" toggle. For video, extend the server action's MIME allowlist to
mp4/webm and add a `type` on the image/media record (or a small `ProductMedia` model) — reuse the same
storage backend. No R2 needed; the portal's own upload path already works.

### [M2] Flask admin add/edit-product: multi-media input + `product_media` (Flask stack)
**Reality:** single `image_url` paste field (main.py); no way to add more than one photo; R2 is inactive.
**Done-check:** admin can attach multiple media to a product; the single-URL field is gone; buyer
product view + marketplace cards read from `product_media`; `image_url` backfilled as the primary row.
**Do:** create `product_media (id, product_id, type['image'|'video'], url, thumb_url, sort_order,
is_primary)`, mirroring the `product_specs` pattern. Replace the single URL field with a **repeatable
media-row input**: paste multiple image/video URLs, add/remove rows, drag-reorder, mark primary
(low-friction, matches the current URL-paste workflow, needs no file storage). Migrate existing
`image_url` into `product_media` as row 0 / primary, then have `POST/PATCH /api/products` and
`GET /api/products/<id>` read/write `media[]`. (Optional: enable direct file upload only if the R2 env
vars from [O2] are set; otherwise URL paste stands.) Apply the store-raw rule from [S2] to URLs.

### [M3] Marketplace homepage — category browse + secured-trading flow (Flask stack)
**Reality:** homepage leads with fabricated stats and marketing copy; no category→product-card browse.
**Done-check:** homepage shows category sections (each with subcategory tabs + a grid of product cards:
image, title, price *range*, MOQ, "Start Order"/inquiry), a "How it works" 4-step secured-trading
section, and trust markers — all from real data, no fabricated numbers.
**Do:** restructure the buyer homepage browse area into **category sections** (tabs per subcategory +
card grid) driven by `/api/marketplace`. Product card = image (primary from `product_media`), title,
price range, MOQ, CTA. Add a 4-step **How it works** block: Search → Confirm with supplier → Pay the
platform (escrow) → Funds release on delivery. Surface trust markers (verified/audited supplier,
trade-guarantee). Depends on [M2] for card images and [L1]/[L2] for copy.
**Note (larger follow-on, not this batch):** the escrow "algorithm" itself (buyer pays platform →
ship → release) has schema bones already — `orders` (incoterm/payment_status/inspection_status) and
`trust_events` — but no UI and no payment integration. Track separately; don't scope it here.

---

## LEDGER TEMPLATE (create `FIX_PROGRESS.md` from this if missing)
```
# Fastflow Fix Progress  ([x]=done+verified, [ ]=todo; add evidence when marking done)
- [ ] S1  csrf-enforce-flask
- [ ] S2  double-escape-fix+migration
- [ ] S3  translate-abuse-close
- [ ] S4  idor-drop-companyname-fallback
- [ ] O1  portal-next-chown
- [ ] O2  dead-r2-upload-remove-or-activate
- [ ] O3  portal-inquiry-uuid-fix
- [ ] L1  hero-fabricated-stats
- [ ] L2  hero-copy+ai-spam
- [ ] L3  team-section
- [ ] L4  testimonials
- [ ] B1  portal-schema-gaps
- [ ] B2  buyer-gallery-render        # display half of M2
- [ ] M1  portal-multimedia-uploader
- [ ] M2  flask-product_media-input
- [ ] M3  marketplace-homepage-browse
```

## Order
S1, S2, S3, S4 → O1, O2, O3 → M2 (schema+input) → B2 (render) → M1 → B1 → L1–L4 → M3.
Rationale: media input ([M2]) unblocks the buyer gallery ([B2]) and the marketplace cards ([M3]);
[M1] does the same on the portal; copy/landing ([L*]) and [M3] finish the buyer-facing surface.
```
