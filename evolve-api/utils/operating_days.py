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

from config import FULL_CASH
from db import run_query
from utils.filters import build_date_filter

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "operating_days.json")

# Same cash payment-type filter the cash KPIs use (keep in sync with mtd.py).
_CASH_PAY_FILTER = (
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'gift card%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'prepaid card%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'package -%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'membership -%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'loyalty%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'cashback%'"
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


def cash_run_rate(
    s: str,
    e: str,
    locations: Optional[list[str]],
    latest_date: str,
) -> Optional[float]:
    """Working-days projected Cash Sales run rate (chain = Σ per-location)."""
    table = _open_days()
    if not table:
        return None

    s_dt = datetime.strptime(s, "%Y-%m-%d").date()
    month_start = s_dt.replace(day=1).isoformat()
    month_end   = s_dt.replace(day=calendar.monthrange(s_dt.year, s_dt.month)[1]).isoformat()

    where, params = build_date_filter(s, e, locations, date_col="payment_date")
    sql = f"""
        SELECT center_name, SUM(sales_collected_exc_tax) AS cash
        FROM {FULL_CASH}
        {where}
        {_CASH_PAY_FILTER}
        GROUP BY center_name
    """

    total, seen = 0.0, False
    for r in run_query(sql, params or None):
        loc  = r["center_name"]
        cash = float(r["cash"] or 0)
        days = table.get(loc, [])
        elapsed_wd = _count_between(days, month_start, latest_date)
        total_wd   = _count_between(days, month_start, month_end)
        if elapsed_wd > 0:
            total += cash / elapsed_wd * total_wd
            seen = True
    return round(total, 2) if seen else None
