"""
Regenerate data/new_guests_daily.json from the daily Zenoti "Business KPI" exports.

Each source file is one calendar day's chain export with per-center rows and an
authoritative "New Guest Count" column (Zenoti's own figure — the source of truth
for New Customer Visits and the ASP (New) denominator; see utils/new_guests.py).

The date is NOT a column in these exports — it lives only in the filename
("Business KPI <Month> <Day>.csv"). We parse it from there. YEAR is fixed below.

Output shape (read at runtime with stdlib json only — no pandas/openpyxl in prod):
    { "YYYY-MM-DD": { "Center Name": <new_guest_count int>, ... }, ... }

Run after dropping new daily files into data/new_guests/:
    python scripts/build_new_guests_json.py
"""
import csv
import json
import os
import re

HERE   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRCDIR = os.path.join(HERE, "data", "new_guests")
OUT    = os.path.join(HERE, "data", "new_guests_daily.json")

CENTER_COL = "Center Name"
COUNT_COL  = "New Guest Count"

# These exports are all 2026 (June/July). Bump/extend if later-year files arrive.
YEAR = 2026
MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}
FNAME_RE = re.compile(r"Business KPI\s+([A-Za-z]+)\s+(\d{1,2})\.csv$", re.IGNORECASE)


def _iso_from_filename(name: str) -> str | None:
    m = FNAME_RE.search(name)
    if not m:
        return None
    month = MONTHS.get(m.group(1).lower())
    if not month:
        return None
    return f"{YEAR:04d}-{month:02d}-{int(m.group(2)):02d}"


def build() -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for fname in sorted(os.listdir(SRCDIR)):
        if not fname.lower().endswith(".csv"):
            continue
        iso = _iso_from_filename(fname)
        if iso is None:
            print(f"  ! skipping (unparseable date): {fname}")
            continue
        path = os.path.join(SRCDIR, fname)
        # utf-8-sig strips the BOM these exports prepend to the first header cell.
        with open(path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if CENTER_COL not in reader.fieldnames or COUNT_COL not in reader.fieldnames:
                raise ValueError(f"{fname} missing '{CENTER_COL}'/'{COUNT_COL}'")
            per_center: dict[str, int] = {}
            for row in reader:
                center = (row.get(CENTER_COL) or "").strip()
                raw    = (row.get(COUNT_COL) or "").strip()
                if not center:
                    continue
                try:
                    per_center[center] = int(float(raw or 0))
                except ValueError:
                    per_center[center] = 0
        out[iso] = per_center
    return out


def main() -> None:
    data = build()
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0, sort_keys=True)
    dates = sorted(data)
    total = sum(v for day in data.values() for v in day.values())
    print(f"Wrote {OUT}")
    print(f"  {len(dates)} days: {dates[0]} .. {dates[-1]}" if dates else "  (no days)")
    print(f"  total new guests across all days/centers: {total}")


if __name__ == "__main__":
    main()
