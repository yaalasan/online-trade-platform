# Product

## Platform

web

## Users

Primary users are **international B2B buyers** — importers, trading firms, dealers,
and procurement staff — who need to source machinery and vehicle parts from Chinese
manufacturers but lack the on-the-ground presence to find, vet, and ship from them
safely. They arrive to evaluate whether Fastflow can source a specific product
(construction machinery, e-bikes, motorbikes, auto/moto spare parts) or a custom
specification, and to open a conversation. English-speaking buyers worldwide are
the core audience; the site also ships 中文 and Русский as secondary conveniences,
not as region-specific storefronts.

The buyer's job on the live site is **evaluate and inquire**, not transact: browse
the catalog, judge credibility, and submit a sourcing request. There are no buyer
accounts or checkout on the public site.

## Product Purpose

Fastflow is the public site of **Shanghai Fast Flow International Trade Co., Ltd.**,
a Shanghai-based sourcing-and-export company (founded 2022). It exists to win the
trust of a global buyer who cannot personally vet a Chinese factory, and to convert
that trust into a sourcing request. Success is a qualified inquiry that Fastflow's
team can turn into a brokered, inspected, shipped order.

## Positioning

Fastflow is a **sourcing & export agency, and is the counterparty** — not a neutral
marketplace. A buyer sends a specification; Fastflow's team finds and shortlists
manufacturers, audits the factory (licence, capability, capacity), inspects goods
before shipment, and arranges export logistics end to end. The defensible position
is this single accountable partner who catches problems in China, not at the
buyer's door — versus a directory or marketplace where the buyer carries all the
supplier risk themselves.

Note: an earlier concept (in the old README and `web/` Next.js portal) framed this
as a self-serve marketplace where suppliers list and buyers transact directly. That
is **superseded**. The self-serve supplier portal is disabled in production; the
live product is the agency site.

## Operating Context

- Buyer discovers the site (often via search or referral), browses **catalog
  categories**, opens a product, and submits a **sourcing request via the contact
  form**. The request lands in a `contact_inquiries` table and is emailed to staff;
  Fastflow follows up off-platform (email / phone / WhatsApp).
- Fastflow's service arc, presented on the site, is the real workflow: product
  sourcing → supplier audit → quality inspection → export consulting → logistics
  coordination → ongoing supply-chain support.
- Standard commercial terms buyers evaluate against (all in `site_config.py`, and
  factual): MOQ 1–5 units for finished machinery / on-request for parts; T/T 30%
  advance + 70% before shipment, L/C accepted; lead time 7–20 working days
  (custom/OEM quoted separately); samples available at buyer's cost; shipping by
  express (DHL/FedEx/UPS), air, sea (FCL/LCL), rail, or cross-border trucking.
- Contact points are real and specific: Shanghai office (Room 1805, No.2 Building,
  No.588 Longchang Road, Yangpu District), tel/mobile/WhatsApp, and
  sales@ / manager@fastflow.global.

## Capabilities and Constraints

- **Stack (incumbent, load-bearing):** Flask + raw psycopg3 + server-rendered Jinja
  on Postgres (`fastflow_web` in prod). Live at `fastflow.global` behind nginx. No
  ORM; raw SQL by convention. See `docs/ARCHITECTURE.md`.
- **Multi-tenant by design, single-tenant in reality.** `site_config.py` defines
  `fastflow`, `asia`, and `tools` tenants sharing one catalog via Postgres
  Row-Level Security keyed on `app.site_id`. Only **fastflow.global** is live;
  `asia` and `tools` carry placeholder copy. Nothing site-specific belongs in
  templates — copy, categories, services, and FAQ live in `site_config.py`.
- **Security constraints that bound all UI work:** tenant isolation is RLS, never
  manual `WHERE site_id`. CSP is strict — `default-src 'self'`, **no inline
  `<script>`** (JS must live in `static/js/*.js` and load via `<script src>`),
  inline styles allowed, external iframes/images need explicit CSP allow-listing.
  `X-Content-Type-Options: nosniff` requires correct Content-Types.
- **Content model:** products (with publish gating), product media (images on disk
  at `UPLOAD_DIR`, served at `/media/<file>`), category tile photos, team members,
  hero/About images — all managed through an admin-only CMS under `/admin/*`. FAQ
  and category taxonomy are code (`site_config.py` / `CATEGORY_GROUPS`), not CMS.
- **Media policy:** images are hosted; **videos are not stored** — admins paste a
  YouTube/Vimeo link rendered as an iframe (a deliberate VPS-bandwidth choice).
- **Public surface is read + inquire only.** No buyer auth, no cart, no checkout,
  no self-serve supplier listing on the live site.
- **Catalog categories** (live taxonomy): Construction Machinery, Electric Bikes,
  Motorbikes, Auto Spare Parts, Moto Spare Parts, plus a "Custom sourcing" CTA tile.
  Category display names must match product `category` values exactly.

## Brand Commitments

- Name: **Fastflow** / **FASTFLOW**, rendered as a two-tone logo splitting
  **FAST** + **FLOW**. Legal entity: Shanghai Fast Flow International Trade Co., Ltd.
- Tagline in use: "Verified sourcing for global buyers."
- Trilingual delivery is a commitment: English (primary), 中文, Русский.
- Voice (as written today): plain, concrete, operational — it describes exactly
  what the team does ("we find the supplier, audit the factory, inspect the goods,
  and ship it to you") rather than making abstract claims. Preserve this register.

## Evidence on Hand

- **Real, usable:** uploaded product photography in the catalog; real named team
  members (roles/photos) on the About page; real client cases / testimonials the
  company may display.
- **Not confirmed — do not fabricate:** no certifications, licences, quality
  standards, or export credentials have been confirmed as available to show. Future
  work must **not** invent certification badges, ISO marks, audit seals, client
  logos beyond the real cases, or membership/accreditation claims.
- Historical/reference material in-repo (treat as history, not current spec):
  `docs/v2`, `docs/v3`, `docs/v3.1` describe superseded payment/escrow/marketplace
  concepts; the `web/` Next.js portal is the disabled self-serve channel.

## Product Principles

1. **Trust is the product.** Every surface has to make a distant buyer believe this
   specific company will catch problems in China before they reach the buyer's door.
2. **One accountable partner, not a directory.** Position Fastflow as the counterparty
   who owns the outcome end to end — never blur back into "marketplace."
3. **Concrete over abstract.** Show the real workflow, real terms, real goods, and
   real people; claims are earned with specifics, not adjectives.
4. **Inquiry is the only conversion.** The whole site funnels to a qualified sourcing
   request; reduce every friction and doubt in that path.
5. **Honesty about proof.** Use only evidence that exists; never manufacture
   credentials to fill a credibility gap.

## Accessibility & Inclusion

Trilingual (EN / 中文 / Русский) is the established inclusion commitment. No further
product-specific accessibility standard has been established; treat WCAG AA as the
default floor for any new work.
