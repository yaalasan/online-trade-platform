# Fastflow UX Overhaul — Ledger

Protocol: read this before any task. Skip anything marked `Status: DONE`. One commit per task (`ux(<phase>.<task>): <short name>`). Every phase ends with a stop for go-ahead.

---

## 0.1 — Stack inventory
Status: DONE
Date: 2026-07-21
Files touched: docs/ux-audit.md (new)
What changed: Documented the real stack — hand-written CSS only (no Tailwind/Bootstrap/framework, one 42 KB `styles.css`), one 121 KB `app.js`, Inter via Google Fonts, Unsplash remote images. Established that the app is a client-rendered SPA with NO templates and NO per-product URL; the "PDP" is a modal built by `galleryHtml()` in `app.js`. Counted internal primitive duplication (≈5 button, ≥10 input, ≈6 card definitions) and found `product_media` IS read by the PDP.
Verified by: file listing + grep of index.html/app.js/styles.css; DB PRAGMA on products/product_media; live health check.

## 0.2 — Gallery teardown
Status: DONE
Date: 2026-07-21
Files touched: docs/ux-audit.md
What changed: Precisely described the existing thumb+arrow gallery and enumerated 14 concrete defects vs Phase 2 (silent wrap, no keyboard, no lightbox, no zoom, thumb_url==url, no alt_text column, no srcset/WebP, color-only active state, <44px touch targets, no snap/counter, weak empty state, no failure fallback, cover-crop, no default ordering). Confirmed video code path exists but is unused and autoplays without mute.
Verified by: reading galleryHtml + wiring (app.js 1369–1545), CSS pd-* rules, and product_media rows (thumb_url==url on all 6).

## 0.3 — Rendered evidence
Status: DONE
Date: 2026-07-21
Files touched: docs/ux-audit.md, docs/ux-shots/*.png (new)
What changed: Rendered homepage + PDP modal at 1440/768/390 via headless Chromium. No page-level horizontal scroll at any width. Documented that the live homepage stats read "6+/4+/2+/0" (NOT the all-zero state the work order assumed) and that product/supplier sections and the internal Account/Audit gating are already handled — so several Phase 4 premises are already addressed. Confirmed nav bloat (24 entries, duplicate About/Contact) and Unsplash stock imagery.
Verified by: Playwright screenshots + DOM probes of stats-strip visibility, product/supplier counts, nav entries.

### FOUND (discovered, not yet fixed)
- FOUND-1: Leftover XSS-probe junk in DB (`product_specs` product 5 = `<script>alert(1)</script>` / `<b>bold</b>`; safely escaped). Recommend deleting.
- FOUND-2: Products have no shareable URL and zero SEO (no route, canonical, hreflang, OG). Strategic gap; needs routing decision.
- FOUND-3: Seed images mismatch products (lightbulb for "Industrial Metals"); all media are generic Unsplash.
- FOUND-4: `thumb_url` never distinct from `url` — no thumbnail pipeline.
- FOUND-5: Video autoplays without `muted` on thumbnail switch (app.js:1521).

---

## 1.1 — Define tokens
Status: DONE
Date: 2026-07-21
Files touched: static/css/tokens.css (new), index.html
What changed: Created `static/css/tokens.css` as the single source of truth — raw industrial-slate palette + one orange accent, semantic aliases (`--surface`, `--surface-raised`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-contrast`, `--success`, `--warning`, `--info`), a 6-step type scale each with an explicit line-height, a font stack with explicit CJK + Cyrillic fallbacks, a 4px space scale (`--space-1..8`), 3 radius / 3 border-width / 3 shadow values, motion durations + one easing, and a global `prefers-reduced-motion` block. Legacy variable names are aliased to the new tokens so existing call sites keep working. Wired into `index.html` before `styles.css`.
Verified by: in-process Flask + Playwright render — `getComputedStyle` shows `--accent` resolving and `.primary` bg = rgb(232,64,12); body font-family now includes Noto Sans SC / PingFang SC / Microsoft YaHei.

## 1.2 — Consolidate
Status: DONE
Date: 2026-07-21
Files touched: static/styles.css
What changed: No CSS framework is loaded (hand-written CSS only), so there was no framework duplication to remove — the actual duplication was the design-token block, previously redefined literally in `styles.css :root`. Removed it (kept only structural layout vars: `--nav-h/--util-h/--cat-h/--header-total/--max-w`) and pointed `body` font at `--font-sans`. Payload: `styles.css` −~55 lines; `tokens.css` +~185 lines; net single-source, no framework payload change (none existed).
Verified by: **Acceptance test passed** — editing only `--accent-raw` in `tokens.css` recolored the entire UI (search button, category pills, CTAs, logo, icons) from orange to blue and back. Screenshots: docs/ux-shots/home-tokens.png vs docs/ux-shots/home-accentflip.png.

## 1.3 — Rebuild primitives
Status: DONE
Date: 2026-07-21
Files touched: static/css/tokens.css, static/styles.css
What changed: Added the missing pieces to make one canonical, token-driven implementation of each primitive: `.ghost` button variant; `disabled` + `.is-loading` (spinner) states for all button variants; `disabled` + `aria-invalid` states for input/select/textarea; canonical `.card` and `.badge` (success/warning/info) primitives. `.primary`/`.secondary`/`.text-button` and `.modal`/`.modal-content` were already token-driven. Added `--info`/`--info-soft` tokens and removed the last hardcoded hex (`.translated-badge`). Appended at end of file so additions win predictably in the cascade.
Verified by: rendered swatch of every variant/state — docs/ux-shots/primitives-swatch.png (ghost outline, faded disabled, white spinner on primary vs orange spinner on ghost, four badges, disabled/invalid inputs, card).
Note (scope): existing complex components `.product-card`/`.supplier-card` are NOT yet migrated onto `.card` — that call-site migration belongs to Phase 5.1 (catalog cards) to avoid churn; the canonical primitive is now available for them and for Phase 2/3 new markup.

## 1.4 — Focus states
Status: DONE
Date: 2026-07-21
Files touched: static/styles.css
What changed: Appended `:focus-visible` rules for `a/button/summary/[tabindex]` and `input/select/textarea` using the `--focus-ring` token (2px white halo + 2px accent ring). Explicit selectors tie/beat the existing `:focus` rules in source order; `:focus-visible` means mouse users are unaffected.
Verified by: keyboard Tab landing on the Search button yields computed `box-shadow: rgb(255,255,255) 0 0 0 3px, rgb(232,64,12) 0 0 0 5px` — orange-on-white ≈3.4:1 (meets 3:1). Screenshot: docs/ux-shots/focus-crop.png.

### Documented exceptions
- `!important` used only inside the global `prefers-reduced-motion` block in tokens.css (animation/transition duration overrides). This is the standard, sanctioned use — reduced-motion must beat every component transition. No other `!important` added in Phase 1.

---

## 2.1 — Data layer
Status: DONE
Date: 2026-07-21
Files touched: main.py
What changed: Added `product_media.alt_text` via idempotent startup migration; `_get_media` returns it, `_save_media` persists it. Media already supported ordered rows (`sort_order`), `is_primary`, and `image`/`video` types. Per-language alt is free text authored by suppliers; the gallery composes a localized `"<name> — photo N of M"` fallback when it's empty.
Verified by: PRAGMA shows the new column; `/api/products/5` returns `alt_text` in each media row.

## 2.2 — Layout
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: Rebuilt the gallery (`galleryHtml` + `.gal*` CSS). Fixed-aspect-ratio stage (contain-fit so product detail is never cropped, addressing the Phase-0 cover-crop finding); horizontal scroll-snap thumbnail strip (64px targets ≥44px, never wraps); active thumb marked by accent border + inset ring + lift (not colour alone); prev/next disable at the ends (removed the silent modulo wrap); overlay `N / M` counter. New i18n keys in en/zh/ru. ArrowLeft/Right navigate when the stage is focused.
Verified by: renders at 1440 + 390 with 1/2/12 items and a video in position 3 (docs/ux-shots/gal-desktop-12.png, gal-mobile-12.png); single-item = no rail/arrows/counter; disable-at-ends confirmed (prev off at 1/12, next off at 12/12).

## 2.3 — Interaction
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: Click/Enter on the stage (or expand button) opens a fullscreen lightbox — dimmed backdrop, large image, close/prev/next, counter, focus trapped, Escape closes and returns focus to the stage, arrow keys navigate, prev/next disable at ends. Desktop hover-magnify shows the zoomed region BESIDE the original (lens on source + side panel) so context is kept; mobile pinch works inside the lightbox (`touch-action: pinch-zoom`). Video plays inline with controls, never autoplays with sound; expand/zoom suppressed on video frames (fixes the old autoplay-without-mute bug).
Verified by: docs/ux-shots/gal-magnify.png (panel beside original), gal-lightbox.png; scripted checks — focus starts on close, ArrowRight advances lightbox, Escape restores focus, magnify panel display=block, video has no autoplay attr.

## 2.4 — Image pipeline
Status: DONE
Date: 2026-07-21
Files touched: static/app.js
What changed: 5-width `srcset` + `sizes`; eager primary with `fetchpriority="high"` vs `loading="lazy"` for the rest; real 160px thumbnails (no more full-size-scaled-in-CSS — the Phase-0 defect); 2048px lightbox source; WebP/AVIF via Unsplash `auto=format` content-negotiation (no build step). Added explicit `width`/`height` on the stage `<img>` to reserve the 4:3 box.
Verified by: helper output shows correct srcset/sizes/fetchpriority/thumb-160/full-2048; **gallery CLS on real click-to-open = 0.0000** (stage height stable at 351px through image load).
Limitation: for non-`images.unsplash.com` supplier URLs there are no server-side variants (no upload/resize pipeline exists) — those fall back to a single `src`. Real variant generation on upload is supplier-portal scope, out of this work order.

## 2.5 — Empty and failure states
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: Zero media → dashed placeholder with supplier initials + supplier-facing line, no orphan controls. One image → stage only. Image-load failure → graceful "Image unavailable" tile that preserves the reserved box (stage + lightbox). Fixed a real bug uncovered here: the inline `onerror` handler I first used is blocked by CSP (`default-src 'self'`); failures are now caught by a JS listener (`galGuardImg`) that also detects images already broken before wiring.
Verified by: docs/ux-shots/gal-empty.png, gal-fail.png; scripted — fail tile shows with stage height 351px preserved; empty placeholder text renders.

## 2.6 — Ordering rule
Status: DONE (partial — semantic ordering BLOCKED)
Date: 2026-07-21
Files touched: main.py
What changed: `_get_media` orders by `is_primary DESC, sort_order ASC, id ASC` — the primary (clearest full-product shot the broker/supplier marked) always leads, then the supplier's explicit order. `galOrder` mirrors this on the frontend.
Verified by: a primary planted at `sort_order 3` still renders first via the API.
BLOCKED: the full heuristic — full-shot → scale/dimension ref → detail close-up → context/application → certs/packaging — needs a per-media `role` field that suppliers would tag in the portal. We don't capture it and it can't be reliably inferred from a URL. **Need from you:** decide whether to add a `role` enum to `product_media` (+ portal authoring UI) in a later phase.

### Phase 2 acceptance
- Fully keyboard-operable: PASS end-to-end (card → Enter opens PDP → stage ArrowRight navigates → Enter opens lightbox, focus on close → lightbox ArrowRight → Escape closes and returns focus to stage).
- Zero CLS on load: PASS (0.0000 on real click-to-open).
- Works at 390px: PASS. Works with 1/2/12 items: PASS. Video in position 3: PASS.

---

## 3.1 — Hierarchy
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: Rebuilt the PDP modal as a grid (`gallery`/`buy`/`main` areas). Above the fold: gallery + a buy card carrying category, title, supplier name + verification badge, price, MOQ, and key facts (lead time, capacity), then the primary CTA. Description, specs, and the inquiry form moved into the scrolling `main` column below.
Verified by: docs/ux-shots/pd3-desktop.png (core buying info above the fold).

## 3.2 — Sticky CTA
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: The buy card is `position: sticky` in the right column on desktop, so the CTA stays visible while specs/inquiry scroll. On mobile the grid reorders the buy card directly under the gallery AND a `.pd-mobilecta` sticky bottom bar (price + Request quote) pins to the viewport bottom.
Verified by: computed `position: sticky` on `.pd-side`; docs/ux-shots/pd3-mobile.png shows the pinned bottom bar.

## 3.3 — Specifications table + collapsibles
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: Specs render as a real `<table class="pd-spec">` (th scope=row / td), not a div blob. Description and Specifications are `<details class="pd-collapse" open>` — expanded by default, collapsible with a rotating chevron and a keyboard-focusable summary.
Verified by: docs/ux-shots/pd3-validation.png shows the spec table (Material/Tolerance/Certification); 2 `details.pd-collapse` present.

## 3.4 — Supplier trust signals
Status: DONE (one slot BLOCKED, no fabrication)
Date: 2026-07-21
Files touched: main.py, static/app.js, static/styles.css
What changed: A supplier trust card surfaces verification status (badge), location, and "On Fastflow since &lt;year&gt;" (`supplier_since`, from the account's `created_at`). Response rate is shown as a real slot reading "Not yet rated" — it is **not** tracked, so no number is invented.
Verified by: trust grid renders `['Verified supplier','Response rate','On Fastflow since']` with the response slot = "Not yet rated".
BLOCKED: real response-rate / years-in-business data doesn't exist. **Need from you:** whether to start tracking supplier response times (and add a company-founded field) so these become real numbers.

## 3.5 — RFQ form
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: `submitProductInquiry` now shows per-field inline errors that state what's wrong and how to fix it (`aria-invalid` + amber field styling + focus moves to the first bad field), a real loading spinner on the submit button (`.is-loading` + `aria-busy`), and a success state that names the supplier, the reply channel (their email → your address), and when to expect a reply. Server/network errors surface in a form-level `role="alert"` slot; copy is specific, never apologetic-vague.
Verified by: empty submit → 3 field errors + focus on name; valid submit → success card "Inquiry sent to Aurora Alloys / …reply within 1–2 business days…" (docs/ux-shots/pd3-validation.png, pd3-success.png).

### FOUND (fixed during Phase 3)
- FOUND-6: the PDP inquiry POST omitted the `X-CSRF-Token` header while the endpoint enforces CSRF on all POST `/api/` — every submit was failing with 400. The RFQ (the page's single job) had been non-functional. **Fixed** in 3.5 (header now sent).
- FOUND-7: the inquiry submit button carried `data-product-id`, which the global delegate (app.js) uses to open the PDP — so clicking submit re-opened the modal instead of submitting. **Fixed** (attribute removed; handler binds by class).

---

## 4.1 — Kill zero-state counters
Status: DONE
Date: 2026-07-21
Files touched: index.html, static/app.js
What changed: Each stat card now has an id and is gated per-metric in `loadOverview` — a card shows only when its value is ≥ 1, and the whole strip hides if none qualify. The "0 Orders tracked" card no longer appears; `0`/`0+` is never displayed.
Verified by: live homepage shows `6+ / 4+ / 2+` (products/verified/RFQs) with the orders card hidden. docs/ux-shots/p4-stats.png.

## 4.2 — Empty sections invite action
Status: DONE
Date: 2026-07-21
Files touched: static/app.js, static/styles.css
What changed: Product and supplier empty results now render a real empty state (dashed card, localized lead line + a "Tell us what you're sourcing" CTA that scrolls to the contact/RFQ form) via `emptyStateHtml()`, instead of a dead-end "No results" line. Leads localized in en/zh/ru.
Verified by: forcing an empty product query shows the lead + working CTA. docs/ux-shots/p4-empty.png.

## 4.3 — Replace stock photography
Status: DONE
Date: 2026-07-21
Files touched: index.html, static/styles.css
What changed: Hero and the three "How it works" step images (Unsplash) are replaced with pure-CSS, token-derived abstract art — a slate blueprint grid + accent glow + concentric "verification target" rings in the hero, and per-step gradient panels (slate/teal/accent) with grid + arc motifs. `index.html` now has zero Unsplash references.
Verified by: docs/ux-shots/p4-hero.png, p4-how.png; page scan shows no Unsplash in index.html.
Note: product-card images still come from seed data using Unsplash URLs — that's FOUND-3 (data quality: real product photos), separate from decorative stock; not in scope for 4.3.

## 4.4 — Internal UI hidden from logged-out visitors
Status: DONE (already correct — verified, no change needed)
Date: 2026-07-21
Files touched: none
What changed: Confirmed the "My Fastflow / Account" (`#dashboard`) and "Operations / Recent audit trail" (`.audit-section`) blocks are hidden for logged-out visitors and the audit trail is admin-only (gated in `renderUserPanel`, from a prior session). The work order's premise (these visible to the public) reflected an older state.
Verified by: logged-out render — `dashboardVisible=false`, `auditVisible=false`.

---

## 5.1 — Consistent card aspect ratio + skeletons
Status: DONE
Date: 2026-07-22
Files touched: static/styles.css
What changed: `.product-image` uses `aspect-ratio: 4/3` (was a fixed 200px) so framing is identical across the whole catalog at every width, and `.shimmer-img` uses the same ratio so there's no layout jump when real cards replace the skeleton. Skeleton loaders (`renderProductSkeleton`) already existed.
Verified by: measured `.product-image` ratio = 1.333.

## 5.2 — B2B filters + shareable URL state
Status: DONE (MOQ range BLOCKED — see below)
Date: 2026-07-22
Files touched: main.py, index.html, static/app.js, static/styles.css
What changed: `/api/marketplace` accepts `location` (LIKE), `verified=1`, and `lead_max` (parsed from the free-text "N days" `lead_time`), applied to DB rows and portal-merged rows; it returns `all_locations` for a stable dropdown. A filter bar (Verified only / Location / Lead time / Clear) drives the state, which — together with `q` and `category` — is mirrored to the URL (`history.replaceState`) and restored on load (`readFiltersFromURL`), so a filtered result is a shareable link. Localized en/zh/ru.
Verified by: API `verified=1` → 4, `lead_max=15` → only the 14-day item; UI toggle sets `?verified=1` and shows 4 cards; opening `?verified=1&location=China&lead_max=30` restores the controls and shows the 2 matching verified China products. docs/ux-shots/p5-filters.png.
BLOCKED: **MOQ range** filter. MOQ is heterogeneous free text ("2,000 kg" / pcs / tons) — a numeric range across mixed units is meaningless. **Need from you:** normalize MOQ into a number + unit (schema change + supplier-portal input) if you want MOQ range filtering.

## 5.3 — Debounced search
Status: DONE
Date: 2026-07-22
Files touched: static/app.js
What changed: The header search now filters live with a 300ms debounce (products or suppliers per the type select). The skeleton is the visible loading state; the zero-results state is the actionable empty state from 4.2. Enter/Search still scroll to results; live updates don't force-scroll on each keystroke.
Verified by: typing "steel" → 2 cards in place; gibberish → empty state with the "Tell us what you're sourcing" CTA.

## 5.4 — Language switcher preserves page + scroll
Status: DONE
Date: 2026-07-22
Files touched: static/app.js
What changed: `setLanguage` already swapped UI strings in place without navigating; it now also re-runs `loadMarketplace()`/`loadSuppliers()` so already-rendered product/supplier cards translate into the new language (they previously stayed in the old language). Neither call scrolls, so the viewport is preserved.
Verified by: switching EN→ZH/RU keeps `scrollY` (~900, never 0/homepage) and translates the how-it-works heading, category rail, and product cards. (A small viewport shift can occur purely from text reflowing at different lengths — that's the browser keeping content stable, not a scroll reset.)

## 5.5 — Nav consolidation
Status: DONE
Date: 2026-07-22
Files touched: index.html
What changed: The utility bar duplicated About and Contact (also in the main nav). Removed the utility-bar links so the utility row is just the language switch, leaving one clean nav set (About Us · Membership · FAQ · Contact + Supplier Portal · Sign in · Join Free). The search + category rail remain the one obvious path in; Join Free / product CTAs the one path to a quote.
Verified by: header scan shows no duplicate About/Contact; utility row = language only.

### FOUND (fixed during Phase 5)
- FOUND-8: the CSP (`default-src 'self'`, no `style-src`/`font-src`) **blocked the Google Fonts stylesheet the page links**, so Inter never loaded and the whole UI silently fell back to system fonts (undermining the Phase 1 type system). **Fixed**: added `style-src` (self + `unsafe-inline` for the SPA's inline style attributes + `fonts.googleapis.com`) and `font-src` (self + `fonts.gstatic.com`); script policy unchanged. Verified Inter loads with zero CSP violations.

---

_Phase 5 complete — stopped for go-ahead before Phase 6._
