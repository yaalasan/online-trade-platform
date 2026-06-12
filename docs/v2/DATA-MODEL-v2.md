# Data Model v2

> Supersedes `docs/DATA-MODEL.md`. Every change traces to a finding from the teardown.
> Ledger and escrow models live in `LEDGER-v2.md` / `ESCROW-v2.md` and are referenced, not duplicated.

## 0. Change log (finding → fix)

| # | Finding | Fix in v2 |
|---|---------|-----------|
| #1 | Double-release race; no lock on money tables | `version` optimistic lock on `Escrow`/`Order`/`AccountBalance`; partial-unique on in-flight intents (`ESCROW-v2`) |
| #2 | Provider call inside DB txn | Saga: intent→worker→webhook (`ESCROW-v2`) — schema adds `EscrowIntent`, `ProviderEvent` |
| #3 | Ledger can't balance / free-text accounts | Typed `Account`/`JournalEntry`/`JournalLine`, signed amounts, write-time balance constraint (`LEDGER-v2`) |
| #4 | Partitioning impossible (PK lacks partition col) | Composite PKs `@@id([id, createdAt])` on all partitioned tables |
| #5 | One conversation per RFQ leaks competitors | Conversation keyed per **(rfqId, manufacturerId)** |
| #6 | Cascade deletes through retained records | `onDelete: Restrict` on financial/audit paths; soft-delete + legal hold; cascade only on truly-owned children |
| #7 | `Review.orderId @unique` allows one review total | `@@unique([orderId, authorCompanyId])` |
| #8 | Quote unique locks out re-bidding | Partial unique on active statuses + `revision` |
| #9 | Immutable PII audit vs. erasure | Audit stores token refs, not PII; PII in shreddable vault (`COMPLIANCE-v2`) |
| #10 | `region` column ≠ residency | `region` becomes a *routing/shard* attribute backing physical isolation (`COMPLIANCE-v2`/`ARCHITECTURE-v2`) |
| #11 | quantity overflow, FX provenance, no chargeback/reserve | `BigInt` quantities, `FxRateSnapshot`, `Chargeback`/reserve accounts |
| #12 | Webhook idempotency | `ProviderEvent` unique + `JournalEntry.@@unique([sourceType,sourceId])` |
| #14 | Single company per user | `Membership` join table; drop `User.companyId` |
| #16 | Missing entities | `Address`, `Shipment`, `Beneficiary`/`PayoutAccount`, `Payout`, `TaxInvoice`, `PriceTier`, `Contract`, `SampleOrder`, `SanctionsCheck`, `NotificationPreference`, `Subscription`, `WebhookEvent` |
| #17 | review-per-side bug | see #7 |
| #18 | One quote → one order; OrderLine not FK'd | `Order` ↔ many awarded quotes via `OrderLine.quoteId`/`productId` FKs |
| #19 | Company uniqueness holes | `registrationNo` required for VERIFIED tier; drop name-uniqueness; `NULLS NOT DISTINCT` |
| #21 | No optimistic concurrency on money | `version` on `Order`, `Escrow`, `AccountBalance` |
| #22 | Idempotency key ownership unclear | Idempotency keyed to business op: `@@unique([orderId, kind])` on funding/release intents |
| #ULID | Text PKs / hot index | `@db.Char(26)` fixed-width ULID; high-write tables use composite PK incorporating `createdAt` |
| rating | Inline `ratingAvg` write contention | `ReputationScore` async aggregate table |

---

## 1. IAM — multi-company identity (fixes #14)

```prisma
model User {
  id            String     @id @db.Char(26)
  clerkId       String     @unique
  emailRef      String     @unique          // tokenized email ref → PII vault (fixes #9); raw email not stored here
  emailVerified Boolean    @default(false)
  fullNameRef   String                      // tokenized PII ref
  locale        String     @default("en")
  status        UserStatus @default(INVITED)
  homeRegion    Region     @default(GLOBAL) // data-residency home (fixes #10)
  memberships   Membership[]
  mfaFactors    MfaFactor[]
  sessions      Session[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  deletedAt     DateTime?
  @@index([status])
}

model Membership {                          // a person can act for many companies (fixes #14)
  id        String   @id @db.Char(26)
  userId    String   @db.Char(26)
  companyId String   @db.Char(26)
  user      User     @relation(fields: [userId], references: [id])
  company   Company  @relation(fields: [companyId], references: [id])
  roles     MembershipRole[]
  status    String   @default("ACTIVE")     // ACTIVE | INVITED | REVOKED
  createdAt DateTime @default(now())
  @@unique([userId, companyId])
  @@index([companyId])
}

model MembershipRole {
  membershipId String @db.Char(26)
  roleId       String @db.Char(26)
  membership   Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Restrict)
  @@id([membershipId, roleId])
}
// Role / Permission / RolePermission unchanged except onDelete: Restrict (fixes #6)
// MfaFactor: SMS allowed for low-risk only; money actions require WEBAUTHN (policy, see SECURITY)
```

## 2. Company / KYB (fixes #6, #10, #19)

```prisma
model Company {
  id             String           @id @db.Char(26)
  legalNameRef   String                              // tokenized (fixes #9)
  displayName    String
  type           CompanyType
  country        String                              // ISO-3166
  region         Region           @default(GLOBAL)   // residency routing (fixes #10)
  tier           VerificationTier @default(UNVERIFIED)
  kybStatus      KybStatus        @default(NOT_STARTED)
  registrationNo String?                             // REQUIRED to reach VERIFIED (app-enforced)
  memberships    Membership[]
  addresses      Address[]
  manufacturer   Manufacturer?
  trader         Trader?
  payoutAccounts PayoutAccount[]
  subscription   Subscription?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  deletedAt      DateTime?

  // NULLS NOT DISTINCT so two NULL registrationNo in a country still conflict appropriately (fixes #19)
  @@unique([country, registrationNo])
  @@index([type, tier])
  @@index([kybStatus])
  // NOTE: legal-name uniqueness REMOVED — legal names legitimately repeat (fixes #19)
}

model Address {                                       // first-class (fixes #16)
  id         String  @id @db.Char(26)
  companyId  String  @db.Char(26)
  company    Company @relation(fields: [companyId], references: [id], onDelete: Restrict)
  kind       String                                   // BILLING | SHIPPING | FACTORY | CUSTOMS
  line1      String
  line2      String?
  city       String
  state      String?
  postalCode String?
  country    String
  validated  Boolean @default(false)                  // address-verification provider result
  @@index([companyId, kind])
}

model SanctionsCheck {                                // auditable AML/sanctions record (fixes #16)
  id         String   @id @db.Char(26)
  subjectType String                                  // COMPANY | USER | PAYOUT_ACCOUNT
  subjectId  String   @db.Char(26)
  provider   String
  result     String                                   // CLEAR | HIT | POTENTIAL
  matchData  Json
  screenedAt DateTime
  expiresAt  DateTime
  @@index([subjectType, subjectId])
}
// KybCase, Certification unchanged except onDelete: Restrict and documentId → FK to Document
```

## 3. Catalog — tiered pricing, FK integrity (fixes #16, #18, rating)

```prisma
model Product {
  id             String        @id @db.Char(26)
  manufacturerId String        @db.Char(26)
  manufacturer   Manufacturer  @relation(fields: [manufacturerId], references: [id], onDelete: Restrict)
  categoryId     String        @db.Char(26)
  status         ProductStatus @default(DRAFT)
  basePrice      BigInt
  currency       String        @db.Char(3)
  moq            BigInt                               // BigInt (fixes #11 overflow)
  priceTiers     PriceTier[]                          // volume pricing (fixes #16)
  translations   ProductTranslation[]
  media          ProductMedia[]
  version        Int           @default(1)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?
  @@index([manufacturerId, status])
  @@index([status, updatedAt])
}

model PriceTier {
  id         String  @id @db.Char(26)
  productId  String  @db.Char(26)
  product    Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  minQty     BigInt
  unitPrice  BigInt
  currency   String  @db.Char(3)
  @@unique([productId, minQty])
}

model ReputationScore {                               // async aggregate, no inline write contention (fixes rating)
  companyId   String   @id @db.Char(26)
  ratingAvg   Decimal  @db.Decimal(3,2) @default(0)
  ratingCount Int      @default(0)
  quality     Decimal  @db.Decimal(3,2) @default(0)
  comm        Decimal  @db.Decimal(3,2) @default(0)
  delivery    Decimal  @db.Decimal(3,2) @default(0)
  recomputedAt DateTime @default(now())
}
// Manufacturer.ratingAvg/ratingCount REMOVED → ReputationScore (recomputed on review.posted event)
```

## 4. Sourcing — re-biddable quotes, private threads (fixes #5, #8)

```prisma
model Quote {
  id             String      @id @db.Char(26)
  rfqId          String      @db.Char(26)
  manufacturerId String      @db.Char(26)
  revision       Int         @default(1)              // allows counter-offers (fixes #8)
  unitPrice      BigInt
  currency       String      @db.Char(3)
  moq            BigInt
  leadTimeDays   Int
  validUntil     DateTime?
  status         QuoteStatus @default(DRAFT)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  @@index([manufacturerId, status])
  // partial-unique: at most one ACTIVE quote per supplier per RFQ, re-bidding allowed (fixes #8)
  // SQL: CREATE UNIQUE INDEX quote_active ON "Quote"(rfqId, manufacturerId)
  //      WHERE status IN ('DRAFT','SUBMITTED','SHORTLISTED');
}

model Conversation {                                  // per (RFQ, manufacturer) — private (fixes #5)
  id             String   @id @db.Char(26)
  rfqId          String?  @db.Char(26)
  manufacturerId String?  @db.Char(26)                // the specific counterparty
  orderId        String?  @db.Char(26)
  subject        String?
  participants   ConversationParticipant[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([rfqId, manufacturerId])                   // one private thread per supplier per RFQ
  @@index([orderId])
}
```

## 5. Orders — multi-quote awards, FK'd lines, optimistic lock (fixes #18, #21)

```prisma
model Order {
  id              String      @id @db.Char(26)
  buyerCompanyId  String      @db.Char(26)
  sellerCompanyId String      @db.Char(26)
  status          OrderStatus @default(CREATED)
  incoterm        String      @default("FOB")
  currency        String      @db.Char(3)
  subtotal        BigInt
  platformFee     BigInt      @default(0)
  taxTotal        BigInt      @default(0)
  total           BigInt
  version         Int         @default(0)             // optimistic lock on money path (fixes #21)
  shipToAddressId String?     @db.Char(26)
  lines           OrderLine[]
  escrow          Escrow?
  shipments       Shipment[]
  taxInvoices     TaxInvoice[]
  contract        Contract?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  @@index([buyerCompanyId, status])
  @@index([sellerCompanyId, status])
}

model OrderLine {                                     // FK-linked to quote + product (fixes #18)
  id         String  @id @db.Char(26)
  orderId    String  @db.Char(26)
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Restrict)
  quoteId    String? @db.Char(26)                     // which awarded quote this line came from
  productId  String? @db.Char(26)
  descr      String
  quantity   BigInt                                   // BigInt (fixes #11)
  unitPrice  BigInt
  lineTotal  BigInt
  @@index([orderId])
  @@index([quoteId])
}
```

## 6. Fulfillment — shipment, payout, tax (fixes #16)

```prisma
model Shipment {
  id           String   @id @db.Char(26)
  orderId      String   @db.Char(26)
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Restrict)
  carrier      String?
  trackingNo   String?
  containerNo  String?
  blNumber     String?                                // bill of lading
  status       String   @default("PREPARING")         // PREPARING | IN_TRANSIT | CUSTOMS | DELIVERED
  shippedAt    DateTime?
  deliveredAt  DateTime?
  customsDocs  Document[]
  @@index([orderId, status])
  @@index([trackingNo])
}

model PayoutAccount {                                 // where seller money exits (fixes #16 "money has no exit")
  id          String   @id @db.Char(26)
  companyId   String   @db.Char(26)
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  provider    String                                  // AIRWALLEX | STRIPE
  beneficiaryRef String                               // provider beneficiary id (KYC'd at provider)
  currency    String   @db.Char(3)
  bankRef     String                                  // tokenized bank details → vault
  verified    Boolean  @default(false)
  sanctionsCheckedAt DateTime?
  @@index([companyId])
}

model Payout {
  id            String   @id @db.Char(26)
  orderId       String   @db.Char(26)
  payoutAccountId String @db.Char(26)
  amount        BigInt
  currency      String   @db.Char(3)
  status        String   @default("PENDING")          // PENDING | PAID | FAILED
  providerRef   String?  @unique
  createdAt     DateTime @default(now())
  @@index([orderId])
}

model TaxInvoice {                                    // VAT / fapiao (fixes #16 compliance)
  id          String   @id @db.Char(26)
  orderId     String   @db.Char(26)
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Restrict)
  kind        String                                  // FAPIAO | VAT | COMMERCIAL
  number      String
  amount      BigInt
  taxAmount   BigInt
  currency    String   @db.Char(3)
  issuedAt    DateTime
  documentId  String?  @db.Char(26)
  @@unique([kind, number])
  @@index([orderId])
}

model Contract {                                      // e-signed terms (fixes #16)
  id          String   @id @db.Char(26)
  orderId     String   @unique @db.Char(26)
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Restrict)
  documentId  String   @db.Char(26)
  buyerSignedAt  DateTime?
  sellerSignedAt DateTime?
  esignProvider  String?
  @@index([orderId])
}

model SampleOrder {                                   // pre-order sampling stage (fixes #16)
  id            String   @id @db.Char(26)
  rfqId         String?  @db.Char(26)
  productId     String?  @db.Char(26)
  buyerCompanyId String  @db.Char(26)
  sellerCompanyId String @db.Char(26)
  status        String   @default("REQUESTED")        // REQUESTED | PAID | SHIPPED | RECEIVED
  escrowId      String?  @db.Char(26)
  createdAt     DateTime @default(now())
}
```

## 7. Platform monetization (fixes #16 "no platform billing")

```prisma
model Subscription {
  id          String   @id @db.Char(26)
  companyId   String   @unique @db.Char(26)
  company     Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  plan        String                                  // FREE | PREMIUM | ENTERPRISE
  status      String   @default("ACTIVE")
  providerRef String?                                 // Stripe subscription id
  currentPeriodEnd DateTime?
}

model NotificationPreference {                        // referenced by Notifications subsystem (fixes #16)
  userId    String   @db.Char(26)
  channel   NotificationChannel
  category  String                                    // "rfq" | "order" | "payment" ...
  enabled   Boolean  @default(true)
  @@id([userId, channel, category])
}
```

## 8. Append-heavy tables — partition-ready PKs (fixes #4)

The partition key (`createdAt`) is now part of the primary key, which is what Postgres declarative
range partitioning requires. Unique constraints on these tables also include the partition key.

```prisma
model AuditLog {
  id          String   @db.Char(26)
  actorType   String
  actorId     String?  @db.Char(26)
  action      String
  entityType  String
  entityId    String?  @db.Char(26)
  // NO inline PII (fixes #9): store token refs / field-level pointers, never raw before/after PII
  changeRef   String?                                 // pointer to encrypted change record in PII vault
  changedKeys String[]                                // field names changed (non-PII metadata)
  ip          String?
  prevHash    String?
  hash        String
  createdAt   DateTime @default(now())
  @@id([id, createdAt])                               // partition-ready (fixes #4)
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
}

model Message {
  id             String   @db.Char(26)
  conversationId String   @db.Char(26)
  senderId       String   @db.Char(26)
  body           String
  createdAt      DateTime @default(now())
  @@id([id, createdAt])                               // partition-ready (fixes #4)
  @@index([conversationId, createdAt])
}

model Notification {
  id        String   @db.Char(26)
  userId    String   @db.Char(26)
  channel   NotificationChannel
  template  String
  payload   Json
  readAt    DateTime?
  sentAt    DateTime?
  createdAt DateTime @default(now())
  @@id([id, createdAt])
  @@index([userId, readAt])
}

model OutboxEvent {
  id          String    @db.Char(26)
  aggregate   String
  aggregateId String    @db.Char(26)
  type        String
  payload     Json
  publishedAt DateTime?
  attempts    Int       @default(0)
  createdAt   DateTime  @default(now())
  @@id([id, createdAt])
  // partial index for the relay scan (fixes the "index covers all history" point):
  // CREATE INDEX outbox_unpub ON "OutboxEvent"(createdAt) WHERE "publishedAt" IS NULL;
}

model FraudSignal {
  id        String       @db.Char(26)
  companyId String?      @db.Char(26)
  userId    String?      @db.Char(26)
  type      String
  severity  Int
  decision  RiskDecision @default(REVIEW)
  context   Json
  createdAt DateTime     @default(now())
  @@id([id, createdAt])
  @@index([companyId, createdAt])
}
```

`ProviderEvent`, `Account`, `JournalEntry`, `JournalLine`, `AccountBalance`, `Escrow`, `EscrowIntent`,
`ScheduledAction`, `Chargeback`, `FxRateSnapshot` are defined in `LEDGER-v2.md` / `ESCROW-v2.md`.

## 9. Delete & retention policy (fixes #6)

- **No `onDelete: Cascade` on any path that reaches `Order`, `Payment`/`JournalEntry`, `AuditLog`, `KybCase`, `TaxInvoice`, `Contract`.** Those use `Restrict`.
- `Cascade` retained **only** for truly-owned, non-retained children (e.g. `PriceTier`→`Product`, `MembershipRole`→`Membership`, `ConversationParticipant`→`Conversation`).
- Retention + legal hold + erasure are specified in `COMPLIANCE-v2.md`. Erasure is **crypto-shredding in the PII vault**, leaving FK-intact tombstones — never a physical cascade through financial history.

## 10. Constraints (SQL)

```sql
ALTER TABLE "Review"      ADD CONSTRAINT review_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "OrderLine"   ADD CONSTRAINT line_total_calc CHECK ("lineTotal" = quantity * "unitPrice");
ALTER TABLE "JournalLine" ADD CONSTRAINT amount_nonzero CHECK (amount <> 0);
-- one review per side:
CREATE UNIQUE INDEX review_one_per_side ON "Review"("orderId","authorCompanyId");
-- re-biddable quotes:
CREATE UNIQUE INDEX quote_active ON "Quote"("rfqId","manufacturerId")
  WHERE status IN ('DRAFT','SUBMITTED','SHORTLISTED');
-- one pending escrow movement per kind:
CREATE UNIQUE INDEX escrow_one_pending ON "EscrowIntent"("escrowId",kind) WHERE status='PENDING';
-- company uniqueness incl. NULL registrationNo (PG15+):
CREATE UNIQUE INDEX company_country_reg ON "Company"(country, "registrationNo") NULLS NOT DISTINCT
  WHERE "deletedAt" IS NULL;
```

See `ARCHITECTURE-v2.md` for how reads/writes, residency, and the saga workers are wired, and
`COMPLIANCE-v2.md` for retention/erasure/tax/residency.
