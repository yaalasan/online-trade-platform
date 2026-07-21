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

_Phase 1 complete — stopped for go-ahead before Phase 2._
