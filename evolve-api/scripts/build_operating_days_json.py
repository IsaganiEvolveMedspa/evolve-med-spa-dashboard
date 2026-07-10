"""
Regenerate data/operating_days.json from
data/Supporting Schedules For Railway(Operating Schedule).csv.

The CSV is the per-location daily 1/0 open-flag schedule (source of truth). Layout:
    row 0            month labels (Jan-26, ...)          — ignored
    row 1            "Daily", <date per column>          — date header (M/D/YYYY)
    row 2            day-of-month numbers                — ignored
    row 3            weekday names                       — ignored
    rows 4..K        <location>, <1/0 open flag per col> — the schedule
    rows K+..        blank / "Monthly" totals section    — ignored

Emits:
    { center_name : [ list of ISO dates the location is OPEN ] }

Used by utils/operating_days.py to compute working-days-based run rate:
    run rate = (MTD sales / working days elapsed) × total working days in month.

Run after refreshing the CSV:
    python scripts/build_operating_days_json.py
"""
import csv
import json
import os
from collections import defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(HERE, "data",
                        "Supporting Schedules For Railway(Operating Schedule).csv")
OUT = os.path.join(HERE, "data", "operating_days.json")

# Non-location cell values that mark the end of the location block (or header rows).
_STOP_TOKENS = {"", "daily", "monthly"}


def _parse_date(cell: str):
    """Return ISO date for an 'M/D/YYYY' cell, else None."""
    cell = (cell or "").strip()
    if "/" not in cell:
        return None
    try:
        return datetime.strptime(cell, "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def main():
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))

    # Date header lives in row index 1 (col 0 == "Daily"); map column -> ISO date.
    date_cols = {j: iso for j, cell in enumerate(rows[1])
                 if (iso := _parse_date(cell))}

    out: dict[str, list[str]] = defaultdict(list)
    # Location rows start right after the weekday header (row index 3). Stop at the
    # first structural break (blank / numeric / "Monthly") so the monthly-totals
    # section below the schedule is never mistaken for daily flags.
    for r in rows[4:]:
        loc = (r[0] if r else "").strip()
        if loc.lower() in _STOP_TOKENS or loc.replace(".", "").isdigit():
            break
        for j, iso in date_cols.items():
            if j < len(r) and r[j].strip() == "1":
                out[loc].append(iso)

    out = {k: sorted(v) for k, v in out.items()}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=0, sort_keys=True)

    print(f"wrote {len(out)} locations, "
          f"{sum(len(v) for v in out.values())} open-day entries -> {OUT}")


if __name__ == "__main__":
    main()
