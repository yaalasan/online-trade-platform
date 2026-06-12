# Ledger Design v2

> Fixes findings **#3** (ledger can't balance / free-text accounts / detection-only),
> **#11** (FX provenance, quantity overflow), **#12** (webhook idempotency into the ledger),
> and the chargeback/reserve gaps. This is now a real **double-entry, multi-currency,
> immutable journal** — not a pair of mutable balance columns.

## 0. Principles (non-negotiable)

1. **The ledger is the single source of truth for money.** No other table holds an authoritative balance. `EscrowAccount.heldAmount` from v1 is **deleted**; balances are *derived* from the journal and materialized for reads.
2. **Money = integer minor units + ISO-4217 currency.** No float, no Decimal for movement (Decimal only for FX *rates*).
3. **Every account is single-currency.** Cross-currency movement is modeled with explicit FX legs against currency-position accounts — never by mixing currencies in one balancing set.
4. **Journal entries are immutable and balanced at write time.** Corrections are *new* reversing entries, never updates/deletes.
5. **Posting is idempotent**, keyed on the originating business event (provider webhook id, order action id).

## 1. Account model (fixes #3 "free-text account")

Accounts are **typed and pre-defined**; you cannot post to a string that doesn't exist.

```prisma
enum AccountType { ASSET LIABILITY EQUITY REVENUE EXPENSE CONTRA }
enum AccountOwner { PLATFORM COMPANY PROVIDER SYSTEM }

model Account {
  id        String       @id @db.Char(26)            // ULID stored fixed-width (fixes #ULID-PK)
  code      String                                   // e.g. "escrow.held", "payout.payable", "fx.position", "platform.revenue.fees", "reserve.chargeback"
  type      AccountType
  ownerType AccountOwner
  ownerId   String?                                  // companyId / providerId / null for platform
  currency  String       @db.Char(3)                 // every account is single-currency
  active    Boolean      @default(true)
  createdAt DateTime     @default(now())
  lines     JournalLine[]
  balance   AccountBalance?

  @@unique([code, ownerType, ownerId, currency])     // one canonical account per (purpose, owner, currency)
  @@index([ownerType, ownerId])
}
```

**Chart of accounts (representative):**

| Code | Type | Owner | Meaning |
|------|------|-------|---------|
| `cash.provider.stripe` / `.airwallex` | ASSET | PROVIDER | funds we control at the PSP |
| `escrow.held` | LIABILITY | COMPANY(buyer) | buyer money held in trust (we owe it back or forward) |
| `payout.payable` | LIABILITY | COMPANY(seller) | money owed to a seller, not yet paid out |
| `platform.revenue.fees` | REVENUE | PLATFORM | platform commission earned |
| `fx.position.<ccy>` | EQUITY | PLATFORM | per-currency FX position; absorbs spread/PnL |
| `reserve.chargeback` | LIABILITY | PLATFORM | rolling reserve held against chargeback risk |
| `loss.chargeback` | EXPENSE | PLATFORM | realized chargeback losses |
| `clearing.<provider>` | ASSET | PROVIDER | in-flight provider settlement |

## 2. Journal model (fixes #3 "can't balance", "detection-only", "direction enum")

```prisma
model JournalEntry {
  id            String        @id @db.Char(26)
  // idempotency: at most one entry per originating event (fixes #12)
  sourceType    String                                // "webhook" | "order_action" | "payout" | "reversal"
  sourceId      String                                // provider event id / action id
  reverses      String?                               // journalEntryId this reverses (corrections only)
  description   String
  effectiveAt   DateTime                              // business effective time (may differ from createdAt)
  createdAt     DateTime      @default(now())
  lines         JournalLine[]

  @@unique([sourceType, sourceId])                    // idempotent posting — replay-safe
  @@index([effectiveAt])
}

model JournalLine {
  id             String       @id @db.Char(26)
  journalEntryId String       @db.Char(26)
  entry          JournalEntry @relation(fields: [journalEntryId], references: [id])
  accountId      String       @db.Char(26)
  account        Account      @relation(fields: [accountId], references: [id])
  amount         BigInt                               // SIGNED minor units: +debit, -credit (fixes #3 direction enum)
  currency       String       @db.Char(3)             // must equal account.currency
  createdAt      DateTime     @default(now())

  @@index([accountId, createdAt])                     // balance/statement queries
  @@index([journalEntryId])
}

model AccountBalance {                                // materialized read model, derived from lines
  accountId String   @id @db.Char(26)
  account   Account  @relation(fields: [accountId], references: [id])
  currency  String   @db.Char(3)
  balance   BigInt   @default(0)
  version   Int      @default(0)                      // optimistic lock (fixes #21 on money tables)
  updatedAt DateTime @updatedAt
}
```

### 2.1 Balance enforced **at write time**, not nightly (fixes #3 "detection-only")

A journal entry is valid iff, **for every currency in the entry, the signed lines sum to zero.** Enforced two ways (belt + suspenders):

1. **Application:** a `postJournal()` builder that refuses to persist an unbalanced entry.
2. **Database:** a `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` that runs at COMMIT and aborts the transaction if any `(journalEntryId, currency)` group is non-zero.

```sql
CREATE OR REPLACE FUNCTION assert_entry_balanced() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "JournalLine"
    WHERE "journalEntryId" = NEW."journalEntryId"
    GROUP BY currency
    HAVING SUM(amount) <> 0
  ) THEN
    RAISE EXCEPTION 'Journal entry % is not balanced per currency', NEW."journalEntryId";
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT ON "JournalLine"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_entry_balanced();
```

The imbalance is now **impossible to commit**, not discovered a day later. The nightly job downgrades to a *defense-in-depth reconciliation* (ledger vs. PSP balance), not the primary control.

## 3. Multi-currency settlement (fixes #3 "cross-currency unrepresentable")

A cross-border order (buyer pays USD, seller paid CNY) is **one journal entry with two currency sub-balances, joined by FX position accounts**. Each currency nets to zero independently.

**Example: release $10,000 USD escrow → seller in CNY at 7.20, platform fee 2% ($200).**

| Account | Amount | Ccy | Note |
|---------|-------:|-----|------|
| `escrow.held` (buyer) | −1,000,000 | USD | release the held liability (debit liability ↓) |
| `platform.revenue.fees` | −20,000 | USD | wait — fee booked separately, see below |
| `fx.position.USD` | +1,000,000 | USD | USD leg parks in FX position |
| **USD subtotal** | **0** | USD | ✅ balanced |
| `fx.position.CNY` | −7,056,000 | CNY | CNY leg drawn from FX position ((10000−200)×7.20×100) |
| `payout.payable` (seller) | +7,056,000 | CNY | seller now owed CNY |
| **CNY subtotal** | **0** | CNY | ✅ balanced |

The platform fee and FX spread accumulate in `platform.revenue.fees` (USD) and `fx.position.*` respectively; FX PnL is explicit and reportable, not hidden in rounding. **FX rate provenance** (fixes #11) is captured on the entry:

```prisma
model FxRateSnapshot {
  id         String   @id @db.Char(26)
  baseCcy    String   @db.Char(3)
  quoteCcy   String   @db.Char(3)
  rate       Decimal  @db.Decimal(18,8)
  source     String                       // provider / rate vendor
  fetchedAt  DateTime
  expiresAt  DateTime                      // a quote uses a locked rate within validity; slippage owner = platform
  journalRef String?  @db.Char(26)         // entry that consumed this rate
}
```

Rounding policy: convert at the **line** level using banker's rounding to minor units; the residual sub-cent goes to `fx.position` (never silently dropped). Quantity/amount overflow (fixes #11): `quantity BigInt`, and `unitPrice * quantity` computed in 128-bit/decimal in app before truncating to `BigInt` minor units with an explicit overflow guard.

## 4. Idempotent posting from provider webhooks (fixes #12)

Inbound PSP webhooks are at-least-once and out-of-order. Two-stage:

```prisma
model ProviderEvent {                       // every inbound webhook lands here first
  id           String   @id @db.Char(26)
  provider     String                       // STRIPE | AIRWALLEX
  providerEventId String                    // e.g. evt_... from Stripe
  type         String
  payload      Json
  signatureOk  Boolean
  processedAt  DateTime?
  createdAt    DateTime @default(now())
  @@unique([provider, providerEventId])     // dedupe inbound (fixes #12)
  @@index([processedAt])
}
```

Flow: verify signature → upsert `ProviderEvent` (unique blocks dupes) → if unprocessed, post the journal entry with `sourceType='webhook', sourceId=providerEventId` (the `@@unique([sourceType,sourceId])` is the second idempotency wall) → mark processed. A duplicate webhook is a no-op at two independent layers.

## 5. Chargebacks & reserves (fixes #11 "no clawback / reserve")

```prisma
model Chargeback {
  id            String   @id @db.Char(26)
  paymentId     String   @db.Char(26)
  orderId       String   @db.Char(26)
  provider      String
  providerRef   String   @unique
  amount        BigInt
  currency      String   @db.Char(3)
  status        String                       // OPENED | DISPUTED | WON | LOST
  reasonCode    String?
  openedAt      DateTime
  resolvedAt    DateTime?
}
```

- A **rolling reserve** (`reserve.chargeback` liability) is funded as a % of each release and released on a delay window. Modeled as ordinary journal entries; no special-case code.
- On a **LOST** chargeback after payout: post a clawback entry — debit `loss.chargeback` / `reserve.chargeback`, credit `cash.provider`, and raise a receivable against the seller (`receivable.seller`) for recovery. The money is always traceable; the platform's exposure is an explicit account balance, not a surprise.

## 6. Reconciliation (now secondary)

Nightly + intraday jobs assert: (a) `Σ JournalLine.amount = 0` per currency across the *entire* ledger (global invariant), (b) per-account `AccountBalance` equals `SUM(lines)`, (c) `cash.provider.*` matches the PSP's reported balance via their balance/transactions API. Any drift pages on-call and **freezes payouts** automatically (a kill-switch flag), because drift means either a bug or fraud.

## 7. What was deleted from v1

- `LedgerEntry` (free-text account + direction enum) → replaced by `Account` + `JournalEntry` + `JournalLine`.
- `EscrowAccount.heldAmount/releasedAmount` mutable balances → removed; balance derived from `escrow.held`/`payout.payable` accounts.
- "Nightly reconciliation verifies balance" as the *primary* control → replaced by write-time deferred constraint.

See `ESCROW-v2.md` for how the escrow state machine *uses* this ledger, and `DATA-MODEL-v2.md` for the full integrated schema.
