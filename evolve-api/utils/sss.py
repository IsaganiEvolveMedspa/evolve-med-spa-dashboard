"""
Same-Store Sales (SSS) Growth YoY %.

  SSS YoY % = ( Σ Current-year MTD sales  −  Σ Prior-year same-period sales )
              / Σ Prior-year same-period sales  × 100
  over SAME-STORE locations only (open > 12 months as of the reporting month).

  - Current MTD       = cash sales from month start through the latest data day.
  - Prior-year period = the SAME elapsed window one year earlier (month start −1yr
    through latest data day −1yr), so we compare like-for-like MTD, not a partial
    month against a full prior month.
  - Same-store        = location open > 12 months, i.e. it had cash on/before
    (reporting month start − 12 months).
  Cash basis throughout (sales_collected_exc_tax, with the cash payment-type filter).
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from config import FULL_CASH
from db import run_query
from utils.operating_days import _CASH_PAY_FILTER

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
    # Same-store cutoff: open > 12 months => first cash on/before (month_start − 12 months).
    cutoff    = py_start

    cur = _sum_by_center(month_start.isoformat(), latest_date,         locations)  # current MTD
    pri = _sum_by_center(py_start.isoformat(),    py_latest.isoformat(), locations)  # prior-year same MTD

    # Same-store set: locations open > 12 months = had cash on/before the cutoff.
    loc, params = _loc_clause(locations)
    same_store_sql = f"""
        SELECT DISTINCT center_name
        FROM {FULL_CASH}
        WHERE payment_date < DATEADD(DAY, 1, '{cutoff.isoformat()}')
        {_CASH_PAY_FILTER} {loc}
    """
    same_store = {r["center_name"] for r in run_query(same_store_sql, params or None)}

    # Compare current-year MTD vs prior-year same MTD, summed over same-store locations only.
    tot_cur = sum(v for c, v in cur.items() if c in same_store)
    tot_pri = sum(v for c, v in pri.items() if c in same_store)
    return ((tot_cur - tot_pri) / tot_pri * 100) if tot_pri else None
