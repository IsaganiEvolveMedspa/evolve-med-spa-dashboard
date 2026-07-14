"""
Working-days run rate (Cash Sales), per location.

  run rate = Σ_location  ( MTD cash_location / working days elapsed )  ×  total working days in month

Working days come from the Operating Schedule (data/operating_days.json, built from
the supporting-schedules Excel via scripts/build_operating_days_json.py):
  - elapsed working days = open days from month start through the latest data date
  - total working days   = open days in the full calendar month
Chain run rate = sum of the per-location run rates.

Holiday handling (data/us_holidays.json):
  The operating schedule is a purely WEEKLY pattern and cannot express a holiday.
  us_holidays.json flags US holidays the chain is CLOSED for (closure=true); those
  dates are removed from BOTH the working-day counts AND the MTD sales sums, so a
  closed day neither dilutes the daily pace nor is projected at normal pace.
  Only CHAIN-WIDE closures should be closure=true (e.g. New Year's Day, Christmas —
  data-confirmed $0 across all locations). Holidays the chain still operates
  (Juneteenth, Veterans Day, …) stay closure=false so their real revenue still counts.
  Partial closures (some locations open on a holiday, e.g. July 4) are per-(location,
  date) and are intentionally NOT handled here — those remain real, if slow, operating
  days. See utils' confirmed-closure note for the per-location alternative.
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
_HOLIDAYS_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                              "data", "us_holidays.json")

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


@lru_cache(maxsize=1)
def _holiday_dates() -> frozenset:
    """ISO dates the chain is CLOSED for a holiday (excluded from working days + sales).

    Reads data/us_holidays.json. Only entries with "closure": true are excluded, so
    federal holidays the chain still operates keep their revenue. Both the actual and
    the observed date are excluded when present (e.g. a Sat holiday observed the prior
    Fri). Chain-wide only — see the module docstring for the partial-closure caveat.
    """
    try:
        with open(_HOLIDAYS_JSON, encoding="utf-8") as f:
            cal = json.load(f)
    except (OSError, ValueError):
        return frozenset()
    out: set[str] = set()
    for entries in cal.values():
        for h in entries:
            if not h.get("closure"):
                continue
            if h.get("date"):
                out.add(h["date"])
            if h.get("observed"):
                out.add(h["observed"])
    return frozenset(out)


def _count_between(dates: list[str], start_iso: str, end_iso: str) -> int:
    """Open days in [start, end], excluding chain-wide holiday closures."""
    hols = _holiday_dates()
    return sum(1 for d in dates if start_iso <= d <= end_iso and d not in hols)


def _holiday_not_in_clause(date_col: str, s: str, e: str) -> str:
    """SQL fragment excluding chain-wide holiday dates in [s, e] from an aggregate.

    Keeps the MTD sales sum consistent with the working-day counts: a day removed from
    the denominator is also removed from the numerator. For genuine ($0) closures this
    is a no-op on the sum, but it guards against a mismatch if a flagged day ever has
    stray cash. Dates are safe string literals (same convention as utils/filters).
    """
    hols = sorted(d for d in _holiday_dates() if s <= d <= e)
    if not hols:
        return ""
    lits = ", ".join(f"'{d}'" for d in hols)
    return f" AND CAST({date_col} AS DATE) NOT IN ({lits})"


def _run_rate_per_center(per_center: dict[str, float], s: str, latest_date: str) -> dict[str, float]:
    """Per-location MTD → full-month projection via working days (unrounded).

    run rate_loc = MTD_loc / elapsed working days × total working days in month.
    elapsed/total working days exclude chain-wide holiday closures via _count_between,
    so a closed holiday no longer inflates elapsed_wd (which would have understated the
    daily pace) nor total_wd (which would have over-projected). Centers with no elapsed
    working days are omitted — they can't be projected. Values are unrounded so the chain
    sum rounds exactly once (see _project_run_rate).
    """
    table = _open_days()
    if not table:
        return {}
    s_dt = datetime.strptime(s, "%Y-%m-%d").date()
    month_start = s_dt.replace(day=1).isoformat()
    month_end   = s_dt.replace(day=calendar.monthrange(s_dt.year, s_dt.month)[1]).isoformat()

    out: dict[str, float] = {}
    for loc, mtd in per_center.items():
        days = table.get(loc, [])
        elapsed_wd = _count_between(days, month_start, latest_date)
        total_wd   = _count_between(days, month_start, month_end)
        if elapsed_wd > 0:
            out[loc] = mtd / elapsed_wd * total_wd
    return out


def _project_run_rate(per_center: dict[str, float], s: str, latest_date: str) -> Optional[float]:
    """Chain run rate = Σ per-location working-days projections."""
    rr = _run_rate_per_center(per_center, s, latest_date)
    return round(sum(rr.values()), 2) if rr else None


def _cash_per_center(s: str, e: str, locations: Optional[list[str]]) -> dict[str, float]:
    """MTD cash per center with the shared cash-pay filter + holiday exclusion."""
    where, params = build_date_filter(s, e, locations, date_col="payment_date")
    sql = f"""
        SELECT center_name, SUM(sales_collected_exc_tax) AS v
        FROM {FULL_CASH}
        {where}
        {_CASH_PAY_FILTER}
        {_holiday_not_in_clause("payment_date", s, e)}
        GROUP BY center_name
    """
    return {r["center_name"]: float(r["v"] or 0) for r in run_query(sql, params or None)}


def cash_run_rate(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    """Working-days projected Cash Sales run rate (chain = Σ per-location)."""
    return _project_run_rate(_cash_per_center(s, e, locations), s, latest_date)


def cash_run_rate_by_center(s: str, e: str, locations: Optional[list[str]],
                            latest_date: str) -> dict[str, float]:
    """Per-location working-days Cash Sales run rate (chain total = sum of these).

    Same basis as cash_run_rate so the location table's "Proj. Run Rate" reconciles
    with the chain figure shown in the header / totals row. Values rounded for display.
    """
    rr = _run_rate_per_center(_cash_per_center(s, e, locations), s, latest_date)
    return {loc: round(v, 2) for loc, v in rr.items()}


def recognized_run_rate(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    """Working-days projected Recognized Revenue run rate (SUM(sales_inc_tax), accrual)."""
    where, params = build_date_filter(s, e, locations, date_col="sale_date")
    sql = f"""
        SELECT center_name, SUM(sales_inc_tax) AS v
        FROM {FULL_SALES}
        {where}
        {_holiday_not_in_clause("sale_date", s, e)}
        GROUP BY center_name
    """
    per = {r["center_name"]: float(r["v"] or 0) for r in run_query(sql, params or None)}
    return _project_run_rate(per, s, latest_date)
