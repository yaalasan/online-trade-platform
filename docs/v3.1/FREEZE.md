# Architecture FREEZE — v3 + v3.1

**Status:** FROZEN for implementation. **Date:** 2026-06-12.
**Scope of this document:** (1) closes **R1, R2, R3** (the money-loss / misallocation / escalation P0s
found in the v3 review); (2) declares the authoritative document set; (3) records what is **carried
open** at freeze so the decision is explicit, not hidden; (4) defines change control after freeze.

R4, R5, R6 are **NOT closed** by this freeze and are carried as known risk (see §3). They were
consciously excluded from this cut.

---

## 1. Freeze manifest — what is authoritative

Precedence, highest wins on any overlap:

1. **`docs/v3.1/FREEZE.md`** (this doc) — R1–R3 closures.
2. **`docs/v3/P0-FIXES.md`** — P0-1…P0-9 closures.
3. **`docs/v2/*`** — `ARCHITECTURE-v2`, `DATA-MODEL-v2`, `ESCROW-v2`, `LEDGER-v2`, `COMPLIANCE-v2`.
4. **`docs/*` (v1)** — historical context only; superseded wherever v2/v3/v3.1 speak.

The frozen design = v2 baseline **as amended by** v3 (P0-1…P0-9) **as amended by** v3.1 (R1–R3 below).
Implementation builds against this composite. No other interpretation is authoritative.

---

## 2. v3.1 closures (R1–R3)

### R1 — Funding-chargeback guard now covers ALL seller-ward money-exit paths

**Current failure.** The P0-2 guard sat only on `FUNDED → RELEASED`. The dispute-settlement path
(`FROZEN → SETTLING`) and the payout disbursement (P0-4 Step B) bypassed it → a funding chargeback
concurrent with a settlement, or landing in the `RELEASED → PAID` window, paid the seller from
clawed-back money (double loss, two routes).

**Invariant.** *No **seller-ward** money movement may execute while an open funding chargeback/inquiry
exists against the order's funding. Buyer-ward movements (refunds) are never blocked. The guard is one
function, enforced at **every** seller-ward gate, and decision is separated from disbursement.*

**New design — one guard, every seller-ward gate, plus a payable hold.**
- A single domain check `assertNoOpenFundingDispute(orderId)` is invoked at **all three** seller-ward gates:
  1. `FUNDED → RELEASED`,
  2. settlement execution of the **seller leg** (`SETTLING` → drain clearing to `payout.payable`),
  3. **Payout Step B**, before any bank disbursement.
- **Directionality:** the guard blocks only seller-ward flow. **Refund (buyer-ward) legs are exempt** —
  returning funds to the buyer reduces exposure and is always safe.
- **Post-RELEASED protection (closes the `RELEASED → PAID` window):** because escrow is terminal at
  `RELEASED` but funds sit in `payout.payable`, a late funding chargeback sets a **`PayableHold`** on that
  order's payable. The payout worker disburses only when `no open funding dispute AND no active PayableHold`.
- **Decision ≠ disbursement (closes concurrent dispute + chargeback):** a dispute may be *resolved*
  (decision recorded) while a funding chargeback is still open, but the **seller-ward execution waits**
  until the chargeback clears. If the chargeback resolves **LOST**, the funds (parked in clearing per R2)
  return to the network/buyer, never the seller.

```prisma
model PayableHold {
  id        String   @id @db.Char(26)
  orderId   String   @db.Char(26)
  reason    String                       // FUNDING_DISPUTE | FRAUD_REVIEW
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  @@index([orderId, active])
}
```
```ts
// invoked at FUNDED→RELEASED, settlement seller-leg, and Payout Step B
async function assertSellerwardAllowed(orderId: string) {
  const open = await chargebacks.openFundingDispute(orderId);          // OPEN | INQUIRY
  const held = await payableHolds.active(orderId);
  if (open || held) throw new ConflictException('Seller-ward movement blocked: funding dispute/hold');
}
```

**Tradeoffs.** Legitimate seller payouts are delayed whenever any funding inquiry/hold is open, even
spurious ones; settlement gains an explicit "resolved-but-not-yet-disbursed" state; one more table
(`PayableHold`) and a guard call on three paths.

**Residual risk.** A seller-ward movement confirmed *microseconds before* a freeze/hold webhook arrives is
still exposed; mitigated by the P0-2 settlement hold (don't auto-release until past the inquiry window) and
the reserve/clawback path for anything that slips post-disbursement. Network-initiated disputes that never
webhook rely on the reconciliation sweep.

---

### R2 — Settlement posts per-leg balanced entries through a clearing account (no limbo)

**Current failure.** P0-3 specified "one balanced settlement journal entry," but the payout and refund legs
confirm via **separate, asynchronous webhooks**. A single atomic entry was impossible: posting up front
misallocated funds if a leg later failed (`SETTLE_PARTIAL` → buyer's portion in limbo, books wrong);
posting only at the end left confirmed legs unrecorded.

**Invariant.** *Every committed journal entry is balanced per currency **at write time**; the held amount is
**conserved** at every instant (`held = clearing + settled`); no leg outcome can misallocate or vanish
funds — a stuck leg is an explicit, accounted clearing balance, never limbo.*

**New design — a settlement clearing account, drained per leg.**
- **On `SETTLING` start (one balanced entry):** `escrow.held(order) → settlement.clearing(order)` for the
  **full** held amount. Escrow held = 0; clearing = held. Balanced, atomic, nothing in flight is unaccounted.
- **Each leg drains clearing on its own confirmation (each a balanced entry):**
  - payout leg confirmed → `settlement.clearing → payout.payable(seller)` (subject to R1 seller-ward guard);
  - refund leg confirmed → `settlement.clearing → cash.provider` (buyer-ward, never blocked);
  - fee → `settlement.clearing → platform.revenue.fees`.
- **`SETTLED`** ⇔ `settlement.clearing(order)` balance returns to **0** (all legs drained).
- **`SETTLE_PARTIAL`** ⇔ clearing > 0 with a stuck leg. This is now a **real, balanced, queryable
  liability**, not phantom limbo. Deterministic terminal: retry the leg → reassign to an alternate
  instrument → convert a dead buyer-refund leg to **buyer credit/ledger receivable** → escalate. The money
  is conserved and visible in `settlement.clearing` the entire time.

```
SETTLING:   escrow.held 1,000,000  →  settlement.clearing +1,000,000        [balanced]
payout ok:  settlement.clearing -600,000  →  payout.payable(seller) +600,000 [balanced, R1-guarded]
refund ok:  settlement.clearing -380,000  →  cash.provider +380,000          [balanced]
fee:        settlement.clearing  -20,000  →  platform.revenue.fees +20,000   [balanced]
SETTLED ⇔   settlement.clearing(order) == 0
```

**Tradeoffs.** Two-or-three balanced entries per settlement instead of one; a per-order clearing account and
its zero-out check; `SETTLE_PARTIAL` requires a compensation runbook (retry/alternate/credit).

**Residual risk.** A permanently dead buyer-refund instrument parks funds in `settlement.clearing` until
compensation routes it to buyer credit — recoverable and accounted, but it needs an owned compensation
process (the alternate-instrument / credit conversion is asserted here, not yet specified end-to-end).

---

### R3 — Self-dealing enforced by actor disjointness across the order lifecycle

**Current failure.** P0-6's per-request check ("active company is exactly one side") never caught the same
`userId` acting buyer-side in one request and seller-side in another. A single user controlling memberships
in both the buyer and seller company could self-deal across operations — detectable from `userId` alone,
no UBO graph needed.

**Invariant.** *Across an order's entire lifecycle, no single `userId` may perform actions on **both** the
buyer side and the seller side; and no order may have its buyer and seller sides controlled by a user who
holds active membership in both companies.*

**New design — record side-actors, assert disjointness at every cross-side transition.**
- Persist the acting user on each side: `Order.buyerActorUserId` (creator), and seller-side actor on the
  awarded `Quote` / acceptance. Extend to dispute, settlement approval, and payout initiation (all seller-
  or buyer-side classified).
- At **every** cross-side transition (quote acceptance, order confirmation, settlement approval, payout
  initiation), assert the acting `userId` ∉ the set of recorded **opposite-side** actor userIds for that order.
- **Membership-level hard block + fraud signal:** if the acting user holds an **active membership in both**
  the order's buyer and seller company, reject and emit a `FraudSignal` (`type=self_dealing`).

```ts
async function assertNotSelfDealing(orderId: string, actor: Principal, side: 'BUYER'|'SELLER') {
  const opp = await orders.actorUserIds(orderId, side === 'BUYER' ? 'SELLER' : 'BUYER');
  if (opp.has(actor.userId)) throw new ForbiddenException('Self-dealing: actor on both sides');
  const { buyerCompanyId, sellerCompanyId } = await orders.parties(orderId);
  if (await memberships.activeIn(actor.userId, buyerCompanyId) &&
      await memberships.activeIn(actor.userId, sellerCompanyId)) {
    await fraud.raise({ type: 'self_dealing', userId: actor.userId, orderId });
    throw new ForbiddenException('Actor controls both sides');
  }
}
```

**Tradeoffs.** Must record and carry side-actor sets per order; legitimate edge cases (a consultant
genuinely representing two unrelated firms that happen to transact) are blocked and pushed to a manual
exception path.

**Residual risk.** Two **distinct users** colluding, or two companies with the same beneficial owner using
different users, are **not** caught here — that's the UBO/collusion-graph problem, explicitly out of scope
for this freeze. R3 closes only the same-`userId`-both-sides case (the one detectable without UBO).

---

## 3. Carried OPEN at freeze (known risk, accepted to ship this cut)

These are **not fixed** by v3.1. The freeze proceeds with them explicitly owned:

| Ref | Risk carried | Why acceptable to carry NOW | Required before the gated milestone |
|-----|--------------|------------------------------|--------------------------------------|
| **R4** | Conversation/message bodies hosted whole in one region's cell → counterparty personal data resident cross-border | No cross-border live traffic in the first build; single-cell launch | Per-message regional storage or message proxying **before** any second (CN/EU) cell goes live |
| **R5** | Global payout kill-switch on rollup drift freezes all sellers | Acceptable bias toward *freeze over loss* at low volume | Per-account/per-partition kill-switch isolation **before** scale milestone |
| **R6** | Duplicate-payout "self-healing sweep" assumes reversible rails | Single-flight intent makes occurrence rare at launch volume | Pre-settlement reconciliation proven to *close* (not shrink) the window **before** high-volume payouts |
| P1 / P2 | Backlog in `docs/v3/P0-FIXES.md` §"Still OPEN" | Not launch-blocking | Triaged per that list |

**Hard gate:** R4 blocks multi-region; R5 and R6 block the scale/high-volume payout milestone. The freeze is
valid for a **single-cell, controlled-volume** build only. Crossing either milestone re-opens the freeze for
the corresponding item.

---

## 4. Change control after freeze

- The frozen composite (§1) is the build contract. Changes require a versioned amendment doc
  (`v3.2`, …) with the same **failure → invariant → design → tradeoffs → residual** structure and a
  precedence note — never silent edits to frozen files.
- New invariants are added to the cross-cutting invariant checklist (`P0-FIXES.md` §"Cross-cutting") and
  must ship with automated tests.
- Any change touching money movement, authorization, or residency requires a fresh adversarial review
  before it is considered closed.

**Frozen.** Implementation may begin against v2 ⊕ v3 ⊕ v3.1, single-cell, controlled volume, with R4/R5/R6
tracked as gating risks for their respective milestones.
