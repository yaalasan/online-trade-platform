# Fastflow Design — v2

v2 reworks the v1 blueprint (`../ARCHITECTURE.md`, `../DATA-MODEL.md`, …) to close the findings from the
adversarial review (ex-Amazon / ex-Stripe / ex-Alibaba lenses). v1 is kept for diff/history; **v2 is
authoritative** where they overlap.

| Doc | Purpose | Key findings closed |
|-----|---------|---------------------|
| [ARCHITECTURE-v2.md](ARCHITECTURE-v2.md) | Saga money path, replica routing, residency cells, outbox staging, schedulers, kill-switch | #2, #4, #10, #12, #23 |
| [DATA-MODEL-v2.md](DATA-MODEL-v2.md) | Integrated schema: multi-company identity, private threads, re-biddable quotes, FK'd order lines, partition-ready PKs, missing entities | #4–#8, #11, #14, #16–#19, #21–#22, ULID/rating |
| [ESCROW-v2.md](ESCROW-v2.md) | Idempotent escrow saga/state machine; triple-wall double-release prevention; auto-release timers; chargeback/clawback | #1, #2, #11, #23 |
| [LEDGER-v2.md](LEDGER-v2.md) | Typed-account, signed, multi-currency double-entry; balance enforced at write time; idempotent webhook posting; reserves | #3, #11, #12 |
| [COMPLIANCE-v2.md](COMPLIANCE-v2.md) | PII vault + crypto-shred erasure; residency confinement; retention schedule; legal hold; sanctions; tax/fapiao | #6, #9, #10, #11, #16 |

## The three design-level fixes that mattered most

1. **The money path is now safe.** No PSP call inside a DB transaction (saga); escrow release has three
   independent anti-double-release walls; the ledger balances *at write time* and is multi-currency-correct.
2. **The scaling plan now actually runs.** Every table the docs promise to partition has `createdAt` in
   its primary key; outbox has a partial index + retention; replica routing is a typed, enforced mechanism.
3. **Compliance is built, not asserted.** PII lives in a shreddable vault (erasure without deleting
   financial/audit history); residency is physical per-jurisdiction cells; no cascade reaches a retained
   record; tax/fapiao and sanctions are first-class entities.

Open items deliberately left for implementation specs: tax-engine adapter selection, exact FX rate-lock
window/slippage policy, OpenSearch mapping per locale, and the cell-migration runbook.
