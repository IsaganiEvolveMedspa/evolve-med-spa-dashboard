"""
Same-Store Sales (SSS) Growth YoY %.

  SSS YoY % = ( Σ Current-year MTD sales  −  Σ Prior-year same-period sales )
              / Σ Prior-year same-period sales  × 100
  over SAME-STORE locations only (open > 12 months as of the reporting month).

  - Current MTD       = cash sales from month start through the latest data day.
  - Prior-year period = the SAME elapsed window one year earlier (month start −1yr
    through latest data day −1yr), so we compare like-for-like MTD, not a partial
    month against a full prior month.
  - Same-store        = location open ~12 calendar months as of the reporting
    month, i.e. it opened in the reporting month one year earlier OR any earlier
    month (real open date on/before the LAST day of that prior-year month), and
    not closed during the period. This is a calendar-month rule, so a store that
    opened mid-month a year ago (e.g. Jul 8, 2025) counts for the July 2026 report
    but is correctly excluded in earlier months (it is < 12 months old in, say,
    May 2026). Open/close dates come from data/store_dates.json (see utils/store_dates).
  Cash basis throughout (sales_collected_exc_tax, with the cash payment-type filter).
"""
import logging
from calendar import monthrange
from datetime import datetime, timedelta
from typing import Optional

from config import FULL_CASH
from db import run_query
from utils.operating_days import _CASH_PAY_FILTER
from utils.store_dates import same_store_centers

log = logging.getLogger(__name__)


def _loc_clause(locations: Optional[list[str]]):
    if not locations:
        return "", []
    ph = ", ".join(["%s"] * len(locations))
    return f"AND center_name IN ({ph})", list(locations)


def _sum_by_center(start_iso: str, end_iso: str, locations):
    loc, params = _loc_clause(locations)
    sql = f"""
        SELECT center_name, SUM(sales_collected_exc_tax) AS cash
        FROM {FULL_CASH}
        WHERE CAST(payment_date AS DATE) BETWEEN '{start_iso}' AND '{end_iso}'
        {_CASH_PAY_FILTER}
        {loc}
        GROUP BY center_name
    """
    return {r["center_name"]: float(r["cash"] or 0) for r in run_query(sql, params or None)}


def _shift_year(d, years: int):
    """Same calendar date `years` earlier; Feb 29 -> falls back ~365 days."""
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d - timedelta(days=365 * abs(years))


def sss_growth_yoy(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    try:
        return _sss_growth_yoy(s, e, locations, latest_date)
    except Exception as exc:  # never let SSS take down the KPI header
        log.warning("sss_growth_yoy failed; returning None: %s", exc)
        return None


def _sss_growth_yoy(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    s_dt        = datetime.strptime(s, "%Y-%m-%d").date()
    latest_dt   = datetime.strptime(latest_date, "%Y-%m-%d").date()
    month_start = s_dt.replace(day=1)

    # Prior-year SAME elapsed MTD window.
    py_start  = _shift_year(month_start, -1)
    py_latest = _shift_year(latest_dt, -1)
    # Same-store cutoff (calendar-month rule): a location counts once it has been
    # open ~12 calendar months as of the reporting month — i.e. it opened in the
    # reporting month one year earlier, or any earlier month. We accept any open
    # date on/before the LAST day of the prior-year reporting month (py_start's
    # month), not just on/before its 1st, so a store that opened mid-month a year
    # ago is included this month and excluded in earlier months.
    cutoff    = py_start.replace(day=monthrange(py_start.year, py_start.month)[1])

    cur = _sum_by_center(month_start.isoformat(), latest_date,         locations)  # current MTD
    pri = _sum_by_center(py_start.isoformat(),    py_latest.isoformat(), locations)  # prior-year same MTD

    # Same-store set from real open/close dates: open on/before the cutoff (~12
    # calendar months as of the reporting month) and not closed by the current
    # period end.
    same_store = same_store_centers(cutoff.isoformat(), latest_date)

    # Compare current-year MTD vs prior-year same MTD, summed over same-store locations only.
    tot_cur = sum(v for c, v in cur.items() if c in same_store)
    tot_pri = sum(v for c, v in pri.items() if c in same_store)
    return ((tot_cur - tot_pri) / tot_pri * 100) if tot_pri else None
