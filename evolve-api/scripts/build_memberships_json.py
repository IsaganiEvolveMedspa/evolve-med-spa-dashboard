"""
Build data/memberships.json from the Zenoti Membership CSV exports.

The Bi_DimMembershipUser_s3 warehouse table is stale (no current-month rows), so
the Membership Adoption numerator is sourced from the Zenoti "Memberships" report
exports instead (data/memberships_*.csv).

We keep only NEW sign-ups — Sale Type = 'Sale' (the 'Recurring' rows are monthly
auto-bills of existing memberships, not new members). Output is one small JSON row
per new membership with the fields the adoption metric needs.

Re-run after dropping new CSV exports in data/:
    python scripts/build_memberships_json.py
"""
import csv
import glob
import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUT = os.path.join(DATA_DIR, "memberships.json")


def iso(d: str):
    d = (d or "").strip()
    if not d:
        return None
    try:
        m, day, y = d.split("/")
        return f"{int(y):04d}-{int(m):02d}-{int(day):02d}"
    except ValueError:
        return None


def main():
    seen = set()
    rows = []
    for path in sorted(glob.glob(os.path.join(DATA_DIR, "memberships_*.csv"))):
        with open(path, encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                if (r.get("Sale Type") or "").strip() != "Sale":
                    continue                                  # skip recurring auto-bills
                inv = (r.get("Invoice No") or "").strip()
                if inv and inv in seen:
                    continue                                  # dedupe across overlapping exports
                if inv:
                    seen.add(inv)
                rows.append({
                    "center":     (r.get("Sale Center") or "").strip(),
                    "sale_date":  iso(r.get("Sale Date")),
                    "start_date": iso(r.get("Start Date")),
                    "guest_code": (r.get("Guest Code") or "").strip(),
                    "invoice":    inv,
                    "status":     (r.get("Membership Status") or "").strip(),
                })
    rows = [r for r in rows if r["sale_date"]]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=1)
    print(f"SAVED {OUT}: {len(rows)} new-membership rows")
    # quick sanity: count per month
    from collections import Counter
    c = Counter(r["sale_date"][:7] for r in rows)
    for k in sorted(c):
        print(f"  {k}: {c[k]}")


if __name__ == "__main__":
    main()
