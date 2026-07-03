"""
Regenerate data/ad_spend_daily.json from the ad-spend sources.

Aggregates Google + Facebook ad spend to one chain-level total per calendar day
("Report: Date" -> SUM("Cost: Amount spend")). The API reads the JSON at runtime
(stdlib json only) so production needs no Excel/openpyxl dependency.

Sources ("both sheets" feeding MTD Ad Spend and CAC):
  - Google:   data/google_ads.csv   (up-to-date Google export)
  - Facebook: data/Google Ads.xlsx  ('Fb' tab)

Run after refreshing either source:
    python scripts/build_ad_spend_json.py
"""
import csv
import json
import os
from collections import defaultdict

import openpyxl

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_GOOGLE = os.path.join(HERE, "data", "google_ads.csv")
XLSX       = os.path.join(HERE, "data", "Google Ads.xlsx")
OUT        = os.path.join(HERE, "data", "ad_spend_daily.json")

DATE_COL  = "Report: Date"
SPEND_COL = "Cost: Amount spend"

# Facebook still comes from the Excel workbook; Google now comes from the CSV.
FB_TAB = "fb"


def _norm_date(d) -> str:
    return d.date().isoformat() if hasattr(d, "date") else str(d)[:10]


def _add_google_csv(daily: dict[str, float]) -> float:
    total = 0.0
    # utf-8-sig strips the BOM some exports prepend to the first header cell.
    with open(CSV_GOOGLE, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if DATE_COL not in reader.fieldnames or SPEND_COL not in reader.fieldnames:
            raise ValueError(f"{CSV_GOOGLE} missing '{DATE_COL}'/'{SPEND_COL}'")
        for row in reader:
            d, spend = row.get(DATE_COL), row.get(SPEND_COL)
            if not d or spend in (None, ""):
                continue
            daily[_norm_date(d)] += float(spend)
            total += float(spend)
    return total


def _add_fb_xlsx(daily: dict[str, float]) -> float:
    total = 0.0
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    for sheet in wb.sheetnames:
        if sheet.strip().lower() != FB_TAB:
            continue
        ws = wb[sheet]
        rows = ws.iter_rows(values_only=True)
        try:
            header = next(rows)
        except StopIteration:
            continue
        if DATE_COL not in header or SPEND_COL not in header:
            continue
        di, si = header.index(DATE_COL), header.index(SPEND_COL)
        for r in rows:
            d, spend = r[di], r[si]
            if d is None or spend is None:
                continue
            daily[_norm_date(d)] += float(spend)
            total += float(spend)
    return total


def main():
    daily: dict[str, float] = defaultdict(float)
    g = _add_google_csv(daily)
    fb = _add_fb_xlsx(daily)

    daily = {k: round(v, 2) for k, v in sorted(daily.items())}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(daily, f, indent=0, sort_keys=True)

    print(f"Google (csv): {round(g, 2)}  Facebook (xlsx): {round(fb, 2)}")
    print(f"wrote {len(daily)} days, total spend {round(sum(daily.values()), 2)} -> {OUT}")


if __name__ == "__main__":
    main()
