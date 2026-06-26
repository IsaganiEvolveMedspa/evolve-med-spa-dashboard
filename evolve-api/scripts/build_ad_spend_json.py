"""
Regenerate data/ad_spend_daily.json from data/Google Ads.xlsx.

Aggregates Google + Facebook ad spend to one chain-level total per calendar day
("Report: Date" -> SUM("Cost: Amount spend")). The API reads the JSON at runtime
(stdlib json only) so production needs no Excel/openpyxl dependency.

Run after refreshing the Excel:
    python scripts/build_ad_spend_json.py
"""
import json
import os
from collections import defaultdict

import openpyxl

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(HERE, "data", "Google Ads.xlsx")
OUT  = os.path.join(HERE, "data", "ad_spend_daily.json")

DATE_COL  = "Report: Date"
SPEND_COL = "Cost: Amount spend"


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    daily: dict[str, float] = defaultdict(float)

    for sheet in wb.sheetnames:                       # 'google', 'Fb', ...
        ws = wb[sheet]
        rows = ws.iter_rows(values_only=True)
        try:
            header = next(rows)
        except StopIteration:
            continue
        if DATE_COL not in header or SPEND_COL not in header:
            continue  # skip empty / non-conforming sheets (e.g. blank Fb)
        di, si = header.index(DATE_COL), header.index(SPEND_COL)
        for r in rows:
            d, spend = r[di], r[si]
            if d is None or spend is None:
                continue
            key = d.date().isoformat() if hasattr(d, "date") else str(d)[:10]
            daily[key] += float(spend)

    daily = {k: round(v, 2) for k, v in sorted(daily.items())}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(daily, f, indent=0, sort_keys=True)

    print(f"wrote {len(daily)} days, total spend {round(sum(daily.values()), 2)} -> {OUT}")


if __name__ == "__main__":
    main()
