# Fastflow — Subsystem Designs

Each subsystem follows the required output format:
**1) Business explanation · 2) System design · 3) Database design · 4) API endpoints ·
5) Security · 6) Scalability · 7) Example implementation.**

Architecture items 1–5 of the brief (system architecture, DB schema, ERD, API spec, RBAC) live in
`ARCHITECTURE.md`, `DATA-MODEL.md`, and `API.md`. This file covers the 12 functional subsystems.

---

## 1. Escrow Payment

**1. Business.** Cross-border strangers won't pre-pay an unknown factory. Escrow holds the buyer's
funds until agreed milestones (e.g. inspection pass / shipment) are met, then releases to the seller
minus the platform fee. This is the core trust primitive that makes the marketplace transactable.

**2. System design.** We are **not** a money transmitter: Stripe/Airwallex are the regulated
processors that hold/segregate funds; we orchestrate the *state machine* and keep a **double-entry
ledger** mirroring fund movements. Order escrow lifecycle:
`AWAITING_PAYMENT → IN_ESCROW → (inspection) → release | refund | dispute-freeze`.
Releases are triggered by an explicit buyer action, or **auto-release** on inspection-pass + a timer,
unless an open dispute has frozen the escrow. Every transition: same-txn ledger postings + outbox event + audit.

**3. Database.** `Order`, `Payment` (kind=ESCROW_FUNDING/RELEASE/REFUND/PAYOUT/PLATFORM_FEE),
`EscrowAccount` (held/released/frozen), `LedgerEntry` (DEBIT/CREDIT, balanced per `txnGroup`). See `DATA-MODEL.md`.

**4. API.** `POST /orders/{id}/escrow/fund`, `POST /orders/{id}/escrow/release`,
`POST /orders/{id}/refund`, provider webhooks `POST /webhooks/stripe`, `POST /webhooks/airwallex`.

**5. Security.** Idempotency keys on every money op; webhook **signature verification**; release
requires buyer-side + MFA step-up + `escrow.frozen=false`; ledger append-only; nightly reconciliation
asserts `Σdebits = Σcredits` per group and that ledger matches provider balances; PCI avoided entirely.

**6. Scalability.** Payments isolated as the first extracted service (regulatory blast-radius). Ledger
is moderate-volume, kept on primary, strongly consistent. Provider rate limits handled with queues + retries.

**7. Example (NestJS, idempotent release in a transaction + outbox):**
```ts
async releaseEscrow(orderId: string, actor: Principal, idem: string) {
  return this.prisma.$transaction(async (tx) => {
    const dup = await tx.idempotencyKey.findUnique({ where: { key: idem } });
    if (dup) return JSON.parse(dup.responseHash!);

    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { escrow: true } });
    this.authz.assert(actor, 'order:release_escrow', order);          // RBAC + ABAC (buyer side)
    if (order.escrow!.frozen || order.status === 'DISPUTED')
      throw new ConflictException('Escrow frozen by dispute');

    const amount = order.escrow!.heldAmount;
    const fee = this.fees.platformFee(order);
    await this.provider.releaseEscrow(order.escrow!.providerRef!, amount - fee); // Stripe/Airwallex

    const grp = ulid();
    await tx.ledgerEntry.createMany({ data: [
      { id: ulid(), account: `escrow:${orderId}`,        direction: 'DEBIT',  amount, currency: order.currency, txnGroup: grp },
      { id: ulid(), account: `payout:${order.sellerCompanyId}`, direction: 'CREDIT', amount: amount - fee, currency: order.currency, txnGroup: grp },
      { id: ulid(), account: 'platform:fees',            direction: 'CREDIT', amount: fee, currency: order.currency, txnGroup: grp },
    ]});
    await tx.escrowAccount.update({ where: { orderId }, data: { heldAmount: 0, releasedAmount: amount }});
    await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED' }});
    await this.outbox.emit(tx, { type: 'payment.released', aggregate: { type:'order', id: orderId }, data: { amount, fee }});
    const res = { ok: true, released: amount - fee };
    await tx.idempotencyKey.create({ data: { key: idem, scope: 'escrow.release', responseHash: JSON.stringify(res) }});
    return res;
  });
}
```

---

## 2. KYC / KYB

**1. Business.** Trust requires knowing *who* is on the platform. KYB verifies the business (license,
registration, UBO, sanctions); KYC verifies individuals acting for it. Verification **tier** gates what
a company may do (list, quote, transaction size).

**2. System design.** Tiered: `UNVERIFIED → BASIC → VERIFIED → PREMIUM`. A `KybCase` orchestrates
document collection → automated vendor checks (registry lookup, sanctions/PEP, UBO) → risk score →
manual review queue for borderline/high-risk → decision. Decisions emit `company.kyb_verified` which
unlocks tier-gated permissions. Re-verification on expiry or risk events.

**3. Database.** `Company.tier`/`kybStatus`, `KybCase` (provider, riskScore, reviewer, decision),
`Document` (kind=BUSINESS_LICENSE/KYC_ID), `Certification`. See `DATA-MODEL.md`.

**4. API.** `POST /companies/{id}/kyb` (submit/update), `POST /admin/kyb/{caseId}/decide`,
`GET /companies/{id}/kyb` (status).

**5. Security.** KYC documents are most-sensitive PII: field-level encryption, strict `DocumentAccessGrant`,
audited access, retention + erasure policy. Reviewer actions logged with elevated retention. Sanctions
screening is mandatory and re-run on payout.

**6. Scalability.** Vendor calls async (queue + webhooks); manual-review queue is a bounded ops workload;
caching of tier on `Company` avoids hot-path vendor calls.

**7. Example (tier gate guard):**
```ts
@RequireTier(VerificationTier.VERIFIED)          // custom guard reads principal.company.tier
@RequirePermission('product:publish')
@Post('products/:id/publish')
publish(@Param('id') id: string, @CurrentUser() u: Principal) { ... }
```

---

## 3. Audit Logging

**1. Business.** Regulators, disputes, and incident response all require an immutable record of *who
did what, when, to which entity*. Auditability is a stated platform goal.

**2. System design.** Append-only, **hash-chained** log. Every business transition writes an audit row
in the same transaction as the change (or via the audit consumer of the outbox). `hash =
sha256(prevHash + canonical(row))` makes tampering detectable by replay. Authorization **denials** are
also audited (security signal).

**3. Database.** `AuditLog` (actor, action, entityType/Id, before/after JSON, ip, prevHash, hash),
month-partitioned, never deleted. See `DATA-MODEL.md`.

**4. API.** `GET /admin/audit?entityType=&entityId=&actorId=&from=&to=` (perm `audit:read`),
`GET /admin/audit/verify` (integrity replay).

**5. Security.** Write-only for services; read gated to ops; cold partitions archived to S3 with Object
Lock (WORM). PII in `before/after` minimized/redacted per field policy.

**6. Scalability.** Append-heavy → range partition by month + auto-archive. High write volume absorbed
via async audit consumer; never on the synchronous request critical path for non-security events.

**7. Example (hash chain writer):**
```ts
async record(tx, e: AuditInput) {
  const prev = await tx.auditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { hash: true }});
  const row = { id: ulid(), ...e, prevHash: prev?.hash ?? null };
  const hash = sha256(`${row.prevHash ?? ''}|${canonicalize(row)}`);
  return tx.auditLog.create({ data: { ...row, hash }});
}
```

---

## 4. Event-Driven Architecture

**1. Business.** Decouple the money/write path from everything reactive (search, notifications, fraud,
analytics) so each scales independently and one slow consumer never blocks a checkout.

**2. System design.** **Transactional outbox** → relay → SNS/SQS (Kafka for hot streams later) →
idempotent consumers. At-least-once delivery; consumers dedupe on `event.id`. Versioned envelope
(`ARCHITECTURE.md` §3). DLQ on every consumer with alerting + replay tooling.

**3. Database.** `OutboxEvent` (payload, publishedAt, attempts) + per-consumer `processed_events` dedupe
set (Redis/Postgres). See `DATA-MODEL.md`.

**4. API.** Internal only: relay worker + consumer handlers. Admin: `GET /admin/events/dlq`, `POST /admin/events/{id}/replay`.

**5. Security.** Bus access via IAM least-privilege; payloads avoid raw PII (carry IDs, fetch with authz);
event signing for cross-service trust.

**6. Scalability.** Relay uses `FOR UPDATE SKIP LOCKED` for parallel publishers; partition outbox by
time; FIFO per aggregate where ordering matters; migrate to Kafka for replay/throughput at Stage 2.

**7. Example (relay loop):**
```ts
const batch = await tx.$queryRaw`
  SELECT * FROM "OutboxEvent" WHERE "publishedAt" IS NULL
  ORDER BY "createdAt" LIMIT 200 FOR UPDATE SKIP LOCKED`;
for (const ev of batch) { await bus.publish(ev); await tx.outboxEvent.update({ where:{id:ev.id}, data:{ publishedAt:new Date() }}); }
```

---

## 5. Notification System

**1. Business.** Timely, multi-channel, localized updates (RFQ received, quote submitted, escrow funded,
inspection result, dispute action) drive conversion and trust. Must respect user preferences and locale.

**2. System design.** Event consumer → template render (locale-aware) → channel dispatch (Email/SES,
SMS, Push, In-app) → delivery tracking. Preference center + quiet hours; idempotent (dedupe on event id +
template + user).

**3. Database.** `Notification` (channel, template, payload, locale, sentAt, readAt) + per-user
preferences (channel opt-in). Month-partitioned. See `DATA-MODEL.md`.

**4. API.** `GET /notifications?unread=true`, `POST /notifications/{id}/read`,
`PATCH /users/me/notification-preferences`.

**5. Security.** No sensitive content in SMS/email bodies (link to authenticated app); unsubscribe +
preference enforcement; provider keys in Secrets Manager; rate-limited to prevent notification spam.

**6. Scalability.** Fan-out via queue per channel; provider throughput managed with backpressure; in-app
notifications cached in Redis; cold rows partitioned/archived.

**7. Example (consumer):**
```ts
@OnEvent('quote.submitted')
async onQuote(ev: Event) {
  const rfqOwner = await this.rfqs.ownerUser(ev.data.rfqId);
  if (!this.prefs.allows(rfqOwner, 'EMAIL', 'quote.submitted')) return;
  await this.dispatch({ userId: rfqOwner.id, channel:'EMAIL', template:'quote_received',
    locale: rfqOwner.locale, payload: ev.data, dedupeKey: ev.id });
}
```

---

## 6. Document Management

**1. Business.** Trade runs on documents — licenses, certificates, proforma invoices, packing lists,
contracts, inspection reports. They must be stored securely, versioned, integrity-checked, and shared
only with authorized counterparties.

**2. System design.** Direct-to-S3 signed uploads → async AV/sanitize pipeline → integrity hash →
access via signed, time-boxed, **authorized + audited** GET. Versioning + `DocumentAccessGrant` for
controlled sharing. Auto-generation of trade docs (PI, packing list) from order data via templates.

**3. Database.** `Document` (s3Key, sha256, kind, version, polymorphic attach), `DocumentAccessGrant`.
See `DATA-MODEL.md`.

**4. API.** `POST /documents` (→ presigned PUT), `GET /documents/{id}/download` (→ presigned GET),
`POST /documents/{id}/grant`, `POST /orders/{id}/documents/generate` (PI/packing list).

**5. Security.** Private bucket + SSE-KMS; AV scan + MIME sniff + image re-encode; never trust extension;
EXIF strip; legal-hold via Object Lock; every download audited; access by grant, not by URL guessing.

**6. Scalability.** S3 is effectively infinite; CDN for non-sensitive media via signed cookies; dedupe by
`sha256`; thumbnails generated async.

**7. Example (presigned upload issue):**
```ts
@Post('documents')
async createUpload(@Body() dto: NewDocDto, @CurrentUser() u: Principal) {
  this.authz.assert(u, 'document:upload');
  const key = `docs/${u.companyId}/${ulid()}`;
  const url = await this.s3.presignPut(key, { maxBytes: 25_000_000, contentType: dto.mimeType, expires: 300 });
  const doc = await this.docs.createPending({ key, kind: dto.kind, ownerCompanyId: u.companyId!, uploadedBy: u.userId });
  return { documentId: doc.id, uploadUrl: url };   // client PUTs directly to S3
}
```

---

## 7. Search Architecture

**1. Business.** Buyers discover suppliers/products by keyword, category, certification, location,
capacity, price — fast, faceted, multilingual, across millions of products.

**2. System design.** **CQRS**: Postgres is the write store; **OpenSearch** is the read/discovery store.
The `product.published`/`updated` events drive an **incremental indexer**; per-locale indices with
language analyzers; facets (category, certs, country, MOQ, price band); relevance tuned with verified/
reputation boosts. Periodic reconcile job repairs drift using `version` stamps.

**3. Database.** Source of truth in `Product`/`ProductTranslation`; search docs denormalize supplier
tier/rating for ranking. Indexer cursor uses `@@index([status, updatedAt])`.

**4. API.** `GET /search/products?q=&category=&certs=&country=&minMoq=&locale=&cursor=`,
`GET /search/suppliers?...`. Public, rate-limited.

**5. Security.** Only `PUBLISHED` products indexed; no PII in search; query DSL typed (no injection);
per-IP rate limits; result-level field allowlist.

**6. Scalability.** Horizontal OpenSearch; blue/green reindex for mapping changes; cache hot queries in
Redis; eventual consistency (seconds) acceptable for discovery — **never** used for authz/money.

**7. Example (indexer consumer):**
```ts
@OnEvent('product.published') @OnEvent('product.updated')
async index(ev: Event) {
  const p = await this.catalog.readForIndex(ev.data.productId);   // reads primary
  for (const t of p.translations)
    await this.os.index(`products_${t.locale}`, p.id, {
      name: t.name, description: t.description, category: p.categoryPath,
      country: p.country, certs: p.certs, moq: p.moq, priceBand: band(p.basePrice),
      supplierTier: p.tier, rating: p.ratingAvg, version: p.version });
}
```

---

## 8. Messaging Architecture

**1. Business.** Buyers and suppliers negotiate on the platform (specs, samples, terms). Keeping
communication on-platform is essential for trust, dispute evidence, and abuse prevention.

**2. System design.** `Conversation` (per RFQ/order) with explicit participants; append-only `Message`
with attachments. Real-time via WebSocket gateway (Socket.IO/native WS) backed by Redis pub/sub for
fan-out; REST for history (cursor paging). Read receipts via `lastReadAt`. Translation hook (AI) on read.

**3. Database.** `Conversation`, `ConversationParticipant`, `Message` (append-only), attachment
`Document`s. `@@index([conversationId, createdAt])`. See `DATA-MODEL.md`.

**4. API.** `GET /conversations`, `GET /conversations/{id}/messages?cursor=`,
`POST /conversations/{id}/messages`, `POST /conversations/{id}/read`; WS channel `conv:{id}`.

**5. Security.** Participants-only (ABAC); attachments via document pipeline (AV-scanned); content
moderation + abuse rate limits; immutable history for dispute evidence; PII redaction in notifications.

**6. Scalability.** Extract Messaging service + Kafka at Stage 2; partition messages by time; WS fan-out
sharded via Redis/Kafka; presence in Redis.

**7. Example (post message + realtime + outbox):**
```ts
async post(convId: string, sender: Principal, body: string, attachmentIds: string[]) {
  await this.authz.assertParticipant(sender, convId);
  const msg = await this.prisma.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { id: ulid(), conversationId: convId, senderId: sender.userId, body }});
    if (attachmentIds.length) await tx.document.updateMany({ where: { id: { in: attachmentIds }}, data: { messageId: m.id }});
    await this.outbox.emit(tx, { type:'message.sent', aggregate:{type:'conversation',id:convId}, data:{ messageId:m.id }});
    return m;
  });
  this.ws.to(`conv:${convId}`).emit('message', msg);   // realtime fan-out
  return msg;
}
```

---

## 9. Fraud Prevention

**1. Business.** Marketplaces attract account-takeover, fake suppliers, payment fraud, collusion,
review manipulation. Undetected fraud destroys trust and incurs chargebacks/liability.

**2. System design.** Event-driven **risk engine**: consumes auth, signup, order, payment, message,
review events → rule engine (velocity, device fingerprint, sanctions, chargeback history, anomalous
graph) + ML scoring → `RiskDecision` ALLOW/REVIEW/DENY. REVIEW → ops queue; DENY → block + step-up.
Decisions are explainable and audited. Feeds escrow-release and payout gates.

**3. Database.** `FraudSignal` (type, severity, decision, context JSON), links to company/user; feeds
case management. See `DATA-MODEL.md`.

**4. API.** Internal scoring; `GET /admin/risk/cases`, `POST /admin/risk/{id}/decide`. Hooks invoked by
payment/escrow/KYB flows.

**5. Security.** Decisions auditable + explainable (no opaque hard-blocks without trace); PII-min in
signals; rules/models versioned; adversarial-aware (don't leak thresholds to clients).

**6. Scalability.** Async scoring off the hot path; Kafka for high-throughput signal streams; ML in a
separate service (extraction candidate); Redis for velocity counters.

**7. Example (velocity rule):**
```ts
@OnEvent('order.created')
async score(ev: Event) {
  const key = `vel:order:${ev.data.buyerCompanyId}`;
  const n = await this.redis.incrWithTtl(key, 3600);
  if (n > THRESHOLD)
    await this.signals.create({ type:'velocity', companyId: ev.data.buyerCompanyId, severity: 70,
      decision:'REVIEW', context:{ window:'1h', count:n }});
}
```

---

## 10. Dispute Resolution

**1. Business.** When goods don't match, are late, or aren't delivered, buyers need recourse and sellers
need fair process. Structured disputes + escrow leverage make the platform safe to transact on.

**2. System design.** Opening a dispute **freezes the order's escrow**. State machine: `OPEN →
UNDER_REVIEW → AWAITING_EVIDENCE → RESOLVED_{BUYER|SELLER|SPLIT}|WITHDRAWN`. Both sides submit evidence
(messages, inspection reports, documents). Ops adjudicate; resolution drives escrow release/refund/split
via the ledger. SLA timers + escalation.

**3. Database.** `Dispute`, `DisputeEvidence`; `EscrowAccount.frozen`. See `DATA-MODEL.md`.

**4. API.** `POST /orders/{id}/disputes`, `POST /disputes/{id}/evidence`,
`POST /admin/disputes/{id}/resolve` (perm `dispute:resolve`).

**5. Security.** Only order parties can open/submit; only ops resolve (MFA + audited); escrow cannot
release while frozen (enforced in release guard); resolution is auditable + immutable.

**6. Scalability.** Low volume, high value — kept on primary; ops queue with SLA; evidence files via
document pipeline.

**7. Example (open dispute freezes escrow):**
```ts
async open(orderId: string, actor: Principal, reason: string, amount?: bigint) {
  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where:{id:orderId}, include:{escrow:true}});
    this.authz.assertOrderParty(actor, order);
    await tx.escrowAccount.update({ where:{orderId}, data:{ frozen:true }});
    await tx.order.update({ where:{id:orderId}, data:{ status:'DISPUTED' }});
    const d = await tx.dispute.create({ data:{ id:ulid(), orderId, openedBy:actor.companyId!, reason, amount }});
    await this.outbox.emit(tx, { type:'dispute.opened', aggregate:{type:'order',id:orderId}, data:{ disputeId:d.id }});
    return d;
  });
}
```

---

## 11. Inspection Workflows

**1. Business.** Pre-shipment inspection by a neutral third party is how buyers gain confidence in goods
they can't physically see. Inspection pass is a common **escrow-release milestone**.

**2. System design.** Buyer/seller request inspection on an order → schedule with a QC provider →
inspector submits structured `InspectionReport` (checklist + photos PDF) → `PASSED/FAILED` drives order
state and (optionally auto-) escrow release or dispute path.

**3. Database.** `Inspection` (status, provider, factory), `InspectionReport` (passed, findings JSON,
documentId). See `DATA-MODEL.md`.

**4. API.** `POST /orders/{id}/inspections`, `PATCH /inspections/{id}/schedule`,
`POST /inspections/{id}/report`, `GET /inspections/{id}`.

**5. Security.** Report submission restricted to assigned provider (scoped token); report PDF via
document pipeline; results audited; tampering prevented by integrity hash.

**6. Scalability.** Low volume; provider integrations async; reports in S3.

**7. Example (report → release trigger):**
```ts
@OnEvent('inspection.passed')
async maybeRelease(ev: Event) {
  const order = await this.orders.get(ev.data.orderId);
  if (order.autoReleaseOnInspection && !order.escrow.frozen)
    await this.escrow.scheduleAutoRelease(order.id, { delayHours: 72 });  // buyer can still dispute
}
```

---

## 12. Review & Reputation System

**1. Business.** Reputation is the long-run trust signal that ranks good suppliers and deters bad
behavior. Reviews must be credible — tied to **real completed transactions**, resistant to manipulation.

**2. System design.** A review can only be created after an order reaches `COMPLETED` (verified
transaction), one per side. Sub-scores (quality/communication/delivery) feed a **reputation model**
(time-decayed, volume-weighted, fraud-adjusted) producing `Manufacturer.ratingAvg/ratingCount` (a read
model) used as a search ranking boost. Moderation for abuse; manipulation signals feed Fraud.

**3. Database.** `Review` (rating 1–5 + sub-scores, author/target company, status), denormalized
`Manufacturer.ratingAvg/Count`. See `DATA-MODEL.md`.

**4. API.** `POST /orders/{id}/reviews`, `GET /companies/{id}/reviews?cursor=`,
`POST /admin/reviews/{id}/moderate`.

**5. Security.** Verified-purchase gate (no review without completed order); one-per-order constraint
(DB unique); moderation + fraud checks on review velocity/graph; immutable after a window.

**6. Scalability.** Reputation recomputation async on `review.posted`; cached aggregate; reviews
paginated; ranking signal pushed to OpenSearch.

**7. Example (verified-purchase gate + aggregate update):**
```ts
async createReview(orderId: string, author: Principal, dto: ReviewDto) {
  const order = await this.orders.getOrThrow(orderId);
  if (order.status !== 'COMPLETED') throw new ConflictException('Review requires completed order');
  this.authz.assertOrderParty(author, order);
  return this.prisma.$transaction(async (tx) => {
    const r = await tx.review.create({ data: { id: ulid(), orderId,
      authorCompanyId: author.companyId!, targetCompanyId: counterparty(order, author),
      rating: dto.rating, qualityScore: dto.quality, commScore: dto.comm, deliveryScore: dto.delivery }});
    await this.reputation.recompute(tx, r.targetCompanyId);   // updates ratingAvg/Count read model
    await this.outbox.emit(tx, { type:'review.posted', aggregate:{type:'company',id:r.targetCompanyId}, data:{ reviewId:r.id }});
    return r;
  });
}
```

---

## Build sequencing (recommended)

1. **Foundation:** monorepo, IAM (Clerk) + RBAC/ABAC, Company/User, audit + outbox, CI/CD, observability.
2. **Trust core:** KYB tiers, Document pipeline (S3 + AV), Catalog + Search.
3. **Transaction core:** RFQ → Quote → Order → **Escrow** (Stripe/Airwallex) + ledger.
4. **Assurance:** Inspections, Disputes, Reviews/Reputation, Fraud engine.
5. **Scale-out:** extract Search/Payments/Messaging services, partition hot tables, multi-region seams.

Each step ships behind feature flags with its own audit + tests; no money path goes live without
reconciliation + dispute + fraud gates in place.
