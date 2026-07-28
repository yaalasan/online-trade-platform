#!/usr/bin/env python3
"""Fastflow SQLite -> Postgres data migration (run ONCE, on a clean schema)."""
import argparse, sqlite3, sys, psycopg

GLOBAL, SCOPED = False, True
TABLES = [
    ("users", GLOBAL), ("translations_cache", GLOBAL),
    ("products", SCOPED), ("quotes", SCOPED), ("orders", SCOPED),
    ("messages", SCOPED), ("supplier_verifications", SCOPED),
    ("audit_logs", SCOPED), ("trust_events", SCOPED),
    ("product_specs", SCOPED), ("product_inquiries", SCOPED),
    ("product_media", SCOPED),
]
SITE_ID = 1

def cols(src, t):
    return [r[1] for r in src.execute(f"PRAGMA table_info({t})").fetchall()]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sqlite", required=True)
    ap.add_argument("--pg", required=True)
    a = ap.parse_args()
    src = sqlite3.connect(f"file:{a.sqlite}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    total = 0
    with psycopg.connect(a.pg) as dst, dst.cursor() as cur:
        for t, scoped in TABLES:
            c = cols(src, t)
            rows = src.execute(f"SELECT * FROM {t}").fetchall()
            if not rows:
                print(f"  {t:24s} 0 rows"); continue
            tcols = c + (["site_id"] if scoped else [])
            ins = (f"INSERT INTO {t} ({', '.join(tcols)}) OVERRIDING SYSTEM VALUE "
                   f"VALUES ({', '.join(['%s']*len(tcols))})")
            data = [[r[x] for x in c] + ([SITE_ID] if scoped else []) for r in rows]
            cur.executemany(ins, data)
            total += len(data); print(f"  {t:24s} {len(data)} rows")
        for t, _ in TABLES:
            if "id" not in cols(src, t): continue
            cur.execute(
                "SELECT setval(pg_get_serial_sequence(%s,'id'),"
                f" COALESCE((SELECT MAX(id) FROM {t}),1),"
                f" (SELECT MAX(id) FROM {t}) IS NOT NULL)", (t,))
        dst.commit()
    src.close()
    print(f"\nDone. {total} rows migrated. Now run 04_rls.sql.")

if __name__ == "__main__":
    sys.exit(main())
