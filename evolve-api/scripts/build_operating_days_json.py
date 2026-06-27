"""
Regenerate data/operating_days.json from data/Supporting Schedules For Railway.xlsx.

From the 'Operating Schedule' sheet (per-location daily 1/0 open flags), emits:
    { center_name : [ list of ISO dates the location is OPEN ] }

Used by utils/operating_days.py to compute working-days-based run rate:
    run rate = (MTD sales / working days elapsed) × total working days in month.

Run after refreshing the Excel:
    python scripts/build_operating_days_json.py
"""
import json
import os
from collections import defaultdict

import openpyxl

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(HERE, "data", "Supporting Schedules For Railway.xlsx")
OUT  = os.path.join(HERE, "data", "operating_days.json")


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["Operating Schedule"]
    rows = list(ws.iter_rows(values_only=True))

    # Daily dates live in row index 2, columns 2..N; location rows start at index 5
    # (col 1 = location name, cols 2..N = 1/0 open flags aligned to the date row).
    date_cols = {j: d for j, d in enumerate(rows[2]) if hasattr(d, "date")}

    out: dict[str, list[str]] = defaultdict(list)
    for r in rows[5:]:
        loc = r[1]
        if not loc or not str(loc).strip():
            continue
        loc = str(loc).strip()
        for j, d in date_cols.items():
            if r[j] in (1, 1.0, "1"):
                out[loc].append(d.date().isoformat())

    out = {k: sorted(v) for k, v in out.items()}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=0, sort_keys=True)

    print(f"wrote {len(out)} locations, "
          f"{sum(len(v) for v in out.values())} open-day entries -> {OUT}")


if __name__ == "__main__":
    main()
