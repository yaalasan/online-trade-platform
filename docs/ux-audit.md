# Fastflow UX Audit — Phase 0 (Discovery)

Date: 2026-07-21
Scope: Flask marketplace (`main.py` + `index.html` + `static/app.js` + `static/styles.css`).
Method: static code/DB inspection + live render via headless Chromium (Playwright) at 1440 / 768 / 390 px. Screenshots in `docs/ux-shots/`.

> **Read this first — the work order's framing is partly out of date.**
> This repo just went through a "removing fake info" pass (commit `99b2b3b`). Several problems the work order describes as current were already fixed in that pass. Where that's the case it's called out inline as **[ALREADY ADDRESSED]** with what remains. Nothing below is guessed — every claim is from the code or a live render.

---

## Architecture reality check (this reframes the whole work order)

**There is no server-rendered PDP template, and there are no per-product URLs.** The entire buyer surface is a **single-page app**:

- `index.html` is a static shell (one `<title>`, one meta description, no canonical, no `hreflang`, no Open Graph).
- `static/app.js` (2438 lines, 121 KB) renders everything client-side, including the "product detail page", which is a **modal overlay** (`openProductDetail()` → `openModal(...)`), not a route. The URL never changes when you open a product.
- Flask serves `index.html` for the app and JSON from `/api/*`. It does **not** render HTML templates (no `templates/` dir exists).

Consequences for the work order:

| Work order assumption | Reality | Impact |
|---|---|---|
| "Where does the PDP template live?" | Nowhere — PDP is `galleryHtml()` + markup strings in `app.js` (~lines 1369–1545). | Phase 2/3 edits happen in `app.js` + `styles.css`, not a template. |
| "Preserve `hreflang` for en/zh/ru." | **No `hreflang` exists.** Language switch is client-side text swap; all three languages share one URL. | Can't "preserve" what isn't there. True multilingual SEO would need routing — **out of scope**, flagged in FOUND. |
| "Do not break canonical / PDP SEO." | Products have **no crawlable URL and no SEO markup at all.** | A product cannot currently be linked, shared, or indexed. Flagged in FOUND as a strategic gap, not a Phase-0 fix. |

I recommend we keep the SPA (no framework/build step per constraints) but, in a later phase, add shareable deep links (`/product/<id>` that boots the SPA and auto-opens the modal). Not doing anything about it now — just naming it.

---

## 0.1 — Stack inventory

### CSS approach
**Hand-written CSS only.** One stylesheet: `static/styles.css` (1591 lines, ~42 KB). **No Tailwind, no Bootstrap, no CSS framework, no CDN CSS.** So the work order's "if two frameworks load, pick one" (Phase 1.2) is a **no-op** — there is nothing to de-duplicate at the framework level. The real consolidation target is *internal* duplication (below).

### Everything loaded on homepage and PDP (same page — PDP is a modal)
| Resource | Source | Size |
|---|---|---|
| `styles.css` | `/static/styles.css` (self-hosted) | ~42 KB |
| `app.js` | `/static/app.js` (self-hosted) | ~121 KB |
| Inter font CSS | `fonts.googleapis.com/css2?family=Inter:wght@400..800` | ~1 KB CSS + font files |
| `favicon.svg` | self-hosted | <1 KB |
| Hero + 3 "how it works" images | **images.unsplash.com** (remote) | 4 remote stock photos |
| Product/PDP images | **images.unsplash.com** via `product_media.url` | remote |

### Conflicting resets / duplicated frameworks
None at framework level (only one stylesheet). One reset block at the top of `styles.css`. **No conflict.**

### Distinct definitions per visual concept (internal duplication — this is the real Phase 1 target)
- **Buttons:** `.primary`, `.secondary`, `.text-button`, `.cta`/`.pd-cta`, plus ad-hoc button styling — rules scattered across lines ~112–141, 499–535, 1452, 1590. No single canonical button. **≈4–5 overlapping definitions.**
- **Inputs:** styled in at least **10 places** (lines 84, 144, 155, 283, 293–302, 499–506, 653, 1367–1368). No single input primitive.
- **Cards:** `.product-card`, `.supplier-card`, `.stat-card`, `.account-card`, `.feature-card`/service tiles, `.workspace` — each hand-rolled. **≈6 card variants**, no shared base.
- **Fonts:** body = `Inter` (fine). But PDP CSS references **`"Space Grotesk"`** (`.pd-title`, `.pd-price`, `.pd-avatar`, `.pd-sh`, …) which **is never loaded** → silently falls back to Inter. Phantom font.

### PDP template location & how media is passed
- No template. `app.js` `openProductDetail(id)` → `GET /api/products/<id>` → response includes `product.media` (array from `product_media`) + `product.specs` + `image_url`. Rendered by `galleryHtml(media, fallbackUrl, alt)` (app.js ~1369).

### Is `product_media` actually read by the PDP? **Yes.**
- API `product_detail()` (main.py:1579) calls `_get_media()` → `SELECT ... FROM product_media WHERE product_id=? ORDER BY sort_order`. Frontend prefers `product.media`, falls back to `image_url`. So the multi-image data layer **exists and is wired** — contrary to "still rendering a single `image_url`". The problem is the *data and the gallery UX*, not the plumbing (see 0.2).

### JS on the PDP / dead code
- Only `app.js`. Gallery wiring (app.js ~1505–1538) handles thumbnail click + prev/next. **No dead JS found on the PDP path.** Missing behaviors (keyboard, lightbox, zoom) are *absent*, not dead.

---

## 0.2 — Gallery teardown (precise)

**Markup** (`galleryHtml`, app.js 1369): `.pd-gallery-wrap` → `.pd-main-stage` (one `<img>`/`<video>` + two absolute `.pd-arrow` buttons) → `.pd-thumb-rail` (one `<button.pd-thumb>` per item). Rendered only when >1 item; single-item products show just the stage (correct). Zero-item → `.pd-no-img` box showing the product name.

**Image sourcing / sizes:** `product_media.url` and `product_media.thumb_url`. **In the DB, `thumb_url` == `url`** for every row (6/6) — i.e. the "thumbnail" is the full ~900 px Unsplash file rendered into a 56×42 px box (`styles.css:1320`). Confirmed defect from Phase 2.4.

**Video:** code path exists (`type==='video'` → `<video>`), but **no video rows exist**, so it's untested. Bug spotted: on thumbnail switch the swap uses `<video ... autoplay>` with no `muted` (app.js:1521) — violates "never autoplay with sound" (browsers will usually block it, so it manifests as "video won't play" rather than noise).

**What actually breaks / is missing (against Phase 2 spec):**
1. **Arrows wrap silently** — `goTo()` uses `(i+len)%len` (app.js:1516). Spec wants **disable at the ends**. ❌
2. **No keyboard nav** — no ArrowLeft/Right, no Escape handlers anywhere on the gallery/modal. ❌
3. **No lightbox** — clicking the main stage does nothing; no fullscreen, no focus trap. ❌
4. **No zoom** — no hover-magnify (desktop), no pinch (mobile). ❌
5. **Thumbnails are full-size images scaled in CSS** (thumb_url==url). ❌ (perf + Phase 2.4)
6. **No `alt_text` column** — `product_media` has no alt at all, let alone per-language. Stage `alt` = product name; thumb `alt=""`. ❌ (Phase 2.1)
7. **No `srcset`/`sizes`/WebP**, no `width`/`height` on `<img>` (CLS risk mitigated only by the `aspect-ratio` box). ❌ (Phase 2.4)
8. **Active thumbnail is color-only** (teal border, `styles.css:1322`) — fails the colorblind requirement. ❌ (Phase 2.2)
9. **Touch targets too small** — thumb rail 42 px tall (`styles.css:1320`), below the 44 px minimum. ❌ (Phase 2.2)
10. **No mobile scroll-snap / counter** (`3/8`). ❌ (Phase 2.2)
11. **Empty state is weak** — dark box with product name, not a supplier-facing line. ❌ (Phase 2.5)
12. **No image-load-failure fallback** — a dead URL leaves a broken tile. ❌ (Phase 2.5)
13. **`object-fit: cover`** on the stage (`styles.css:1317`) crops product shots to 4:3 — can hide detail buyers need. ⚠ (Phase 2.2 tradeoff)
14. **No default ordering rule** — sorts by `sort_order` only; no full-shot→scale→detail heuristic. ❌ (Phase 2.6)

**Net:** the gallery is not "nonexistent" — it's a minimal thumb+arrow switcher missing every advanced behavior in Phase 2, plus a data-quality problem (identical thumb/full URLs, no alt, no video, all Unsplash).

---

## 0.3 — Rendered evidence (screenshots in `docs/ux-shots/`)

Horizontal-overflow check: **no page-level horizontal scroll at 1440 / 768 / 390** (`document.scrollWidth == innerWidth` at all three). Elements that extend past the viewport at 768/390 are the **category rail pills**, which live in an intentional `overflow-x:auto` scroller — not a layout bug.

### PDP (modal) — `pdp-1440.png`, `pdp-390.png`
- 1440: centered modal. Product 5 "Industrial Metals" shows a **lightbulb Unsplash photo** (image ↔ product mismatch). Single image, so no thumb rail / arrows (correct for 1 item). "Specifications" table renders a single row whose visible content is **`bold`** — this is leftover **XSS-probe junk data** in the DB (see FOUND), safely escaped by `escapeHtml`.
- 390: stacks to one column cleanly; CTA full-width; trust ticks and supplier block readable. No overflow. Good baseline to build Phase 2/3 on.

### Homepage — `home-1440.png`, `home-hero-1440.png`
- Renders fully populated: hero (Unsplash), feature cards, 3-step "how it works" (Unsplash), category rail, **6 product cards**, **6 supplier cards**, membership, FAQ, contact form, footer.
- **Stats strip is VISIBLE and reads: `6+ Products`, `4+ Verified suppliers`, `2+ Live RFQ requests`, `0 Orders tracked`.**

**This directly contradicts the work order's Phase 4 premise** ("0+ Products, 0+ Verified suppliers, … empty sections"):
- **[ALREADY ADDRESSED]** The strip is now gated (`app.js:1183`, unhides only if `products>0 || verified_suppliers>0`) and real seed data exists. It is **not** all-zeros.
- **What remains for Phase 4.1:** the gate is `>0`, so the strip appears as soon as *any* metric is positive, and the **`0 Orders tracked`** card still shows a bare zero. Fix = hide individual zero/low cards (or the whole strip below a per-metric threshold), never show `0`.
- **[ALREADY ADDRESSED]** Product and supplier sections are **not empty** (6 + 6 cards). Phase 4.2's "bare headings" state isn't reproducible with current seed data — but the empty-state code path still deserves a real empty state for the genuinely-empty case.
- **[ALREADY ADDRESSED — 4.4]** The "My Fastflow / Account" (`#dashboard`) and "Operations / Recent audit trail" (`.audit-section`) blocks are **already `hidden` for logged-out users** (`app.js:1620–1635`): dashboard shows only when logged in; audit trail is admin-only. Not visible to the public. No fix needed; will re-verify logged-out in Phase 4.
- **Still valid — 4.3:** hero + 3 step images are **Unsplash stock** (`index.html:91,162,173,184`) — recognizable, undercuts the verification pitch. Real fix or token-based abstract treatment needed (may need assets from you).

### Nav bloat (Phase 5.5 — confirmed valid)
Header exposes **24 interactive entries**, including duplicates: `About` + `About Us`, and `Contact` appears **twice** (top utility bar and main nav), plus Search, Membership, FAQ, Supplier Portal, Sign in, Join Free, three language toggles, and the category rail. Real consolidation target.

---

## Cross-cutting findings

- **CJK/Cyrillic font:** body stack is `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (`styles.css:73`). Inter covers Latin + Cyrillic; **CJK has no explicit fallback** and relies on the terminal generic `sans-serif` mapping to a system CJK font. It renders, but not deliberately — Phase 1.1 should add an explicit CJK fallback (e.g. `"Noto Sans SC", "PingFang SC", "Microsoft YaHei"`).
- **Phantom font:** `"Space Grotesk"` used in PDP CSS, never loaded → falls back to Inter. Decide in Phase 1: load it or drop it.
- **`!important` audit:** to be counted during Phase 1 consolidation.

---

## FOUND (out-of-scope issues discovered during discovery)

- **FOUND-1 — Leftover XSS-probe / junk data in DB.** `product_specs` for product 5 = label `<script>alert(1)</script>`, value `<b>bold</b>`. Safely escaped at render (no XSS), but it's live garbage on a real product. Recommend deleting it. (Also implies test data was run against the prod-shaped DB.)
- **FOUND-2 — Products have no shareable URL / zero SEO.** No `/product/<id>` route, no canonical, no `hreflang`, no OG tags. A buyer cannot link or share a product; search engines can't index them. Strategic gap; needs a routing decision (propose deep-link-into-SPA later).
- **FOUND-3 — Image↔product mismatch in seed data.** "Industrial Metals" → lightbulb photo, etc. All media are generic Unsplash. Undercuts credibility the same way the hero stock does.
- **FOUND-4 — `thumb_url` never distinct from `url`.** No thumbnail pipeline exists; every thumb is the full file. Ties into Phase 2.4 but is also a data-model gap (no variant generation on upload).
- **FOUND-5 — Video autoplay-with-sound on thumb switch** (`app.js:1521`, `autoplay` without `muted`).

---

## Recommended correction to the plan (before Phase 1)

1. Phase 1.2 "eliminate a duplicate framework" → **reframe** as "consolidate internal button/input/card duplication"; there is no second framework.
2. Phase 2/3 "edit the PDP template" → **all PDP work lands in `app.js` + `styles.css`** (SPA, modal-based).
3. Phase 4.1/4.2/4.4 are **largely already done**; remaining work is the `0 Orders` card, a true empty-state, and re-verifying logged-out. 4.3 (stock imagery) is the one fully-open Phase 4 item and may need assets from you.
4. Add the SEO/deep-link gap (FOUND-2) as an explicit later decision — it's the single biggest strategic miss and the work order assumed it was already solved.

**Phase 0 complete. No code changed. Awaiting go-ahead for Phase 1.**
