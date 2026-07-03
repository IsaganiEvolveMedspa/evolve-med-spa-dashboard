"""
Working-days run rate (Cash Sales), per location.

  run rate = Σ_location  ( MTD cash_location / working days elapsed )  ×  total working days in month

Working days come from the Operating Schedule (data/operating_days.json, built from
the supporting-schedules Excel via scripts/build_operating_days_json.py):
  - elapsed working days = open days from month start through the latest data date
  - total working days   = open days in the full calendar month
Chain run rate = sum of the per-location run rates.
"""
import calendar
import json
import os
from datetime import datetime
from functools import lru_cache
from typing import Optional

from config import FULL_CASH, FULL_SALES
from db import run_query
from utils.filters import build_date_filter

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "operating_days.json")

# Same cash payment-type filter the cash KPIs use (keep in sync with mtd.py):
# include a row if it has any real financial tender (Cash, Card, Check, Custom - *),
# even alongside a gift card / prepaid / package / membership / loyalty / cashback
# tender; only redemption-only rows are dropped. Whole-tender matching via the
# normalized ",tok1,tok2," string avoids '%card%' hitting "Gift Card".
_PT_NORM = "(',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',')"
_CASH_PAY_FILTER = (
    f" AND ({_PT_NORM} LIKE '%,card,%'"
    f" OR {_PT_NORM} LIKE '%,cash,%'"
    f" OR {_PT_NORM} LIKE '%,check,%'"
    f" OR {_PT_NORM} LIKE '%,custom - %')"
)


@lru_cache(maxsize=1)
def _open_days() -> dict[str, list[str]]:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _count_between(dates: list[str], start_iso: str, end_iso: str) -> int:
    return sum(1 for d in dates if start_iso <= d <= end_iso)


def _project_run_rate(per_center: dict[str, float], s: str, latest_date: str) -> Optional[float]:
    """Project per-location MTD totals to full month via working days; sum to chain."""
    table = _open_days()
    if not table:
        return None
    s_dt = datetime.strptime(s, "%Y-%m-%d").date()
    month_start = s_dt.replace(day=1).isoformat()
    month_end   = s_dt.replace(day=calendar.monthrange(s_dt.year, s_dt.month)[1]).isoformat()

    total, seen = 0.0, False
    for loc, mtd in per_center.items():
        days = table.get(loc, [])
        elapsed_wd = _count_between(days, month_start, latest_date)
        total_wd   = _count_between(days, month_start, month_end)
        if elapsed_wd > 0:
            total += mtd / elapsed_wd * total_wd
            seen = True
    return round(total, 2) if seen else None


def cash_run_rate(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    """Working-days projected Cash Sales run rate (chain = Σ per-location)."""
    where, params = build_date_filter(s, e, locations, date_col="payment_date")
    sql = f"""
        SELECT center_name, SUM(sales_collected_exc_tax) AS v
        FROM {FULL_CASH}
        {where}
        {_CASH_PAY_FILTER}
        GROUP BY center_name
    """
    per = {r["center_name"]: float(r["v"] or 0) for r in run_query(sql, params or None)}
    return _project_run_rate(per, s, latest_date)


def recognized_run_rate(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    """Working-days projected Recognized Revenue run rate (SUM(sales_inc_tax), accrual)."""
    where, params = build_date_filter(s, e, locations, date_col="sale_date")
    sql = f"""
        SELECT center_name, SUM(sales_inc_tax) AS v
        FROM {FULL_SALES}
        {where}
        GROUP BY center_name
    """
    per = {r["center_name"]: float(r["v"] or 0) for r in run_query(sql, params or None)}
    return _project_run_rate(per, s, latest_date)
