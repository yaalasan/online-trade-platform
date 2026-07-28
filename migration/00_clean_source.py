#!/usr/bin/env python3
"""Pre-migration cleanup of referential-integrity orphans in the SQLite source.

SQLite did not enforce foreign keys, so the live data accumulated dangling rows
(from earlier product/user deletions). Postgres DOES enforce them, so these must
be resolved before migration. Run this against a COPY of data.db, never the live
file. It is idempotent.

Actions (minimal, documented):
  * Delete quotes whose product_id no longer exists, plus their child rows in
    orders / messages / trust_events. (Orphaned RFQs for deleted products.)
  * Null out audit_logs.actor_id that points to deleted users, preserving the
    audit record itself (actor_id is nullable).
"""
import argparse, sqlite3, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", required=True, help="path to a COPY of data.db")
    a = ap.parse_args()
    db = sqlite3.connect(a.sqlite)
    cur = db.cursor()

    # Quotes pointing at missing products -> collect, then delete children + quote.
    dead = [r[0] for r in cur.execute(
        "SELECT q.id FROM quotes q "
        "LEFT JOIN products p ON p.id = q.product_id WHERE p.id IS NULL")]
    if dead:
        marks = ",".join("?" * len(dead))
        for child in ("orders", "messages", "trust_events"):
            cur.execute(f"DELETE FROM {child} WHERE quote_id IN ({marks})", dead)
        cur.execute(f"DELETE FROM quotes WHERE id IN ({marks})", dead)
    print(f"orphaned quotes removed: {dead or 'none'}")

    # Audit logs whose actor was deleted -> keep the record, drop the actor link.
    n = cur.execute(
        "UPDATE audit_logs SET actor_id = NULL "
        "WHERE actor_id IS NOT NULL "
        "AND actor_id NOT IN (SELECT id FROM users)").rowcount
    print(f"audit_logs actor_id nulled: {n}")

    db.commit()
    db.close()

if __name__ == "__main__":
    sys.exit(main())
