"""
Same-Store Sales (SSS) Growth YoY %.

  SSS YoY % = ( Σ Projected Run Rate (current full month)  −  Σ Prior-Year Same-Month sales )
              / Σ Prior-Year Same-Month sales  × 100
  over SAME-STORE locations only (open > 12 months as of the reporting month).

  - Projected Run Rate (per location) = (MTD cash / working days elapsed) × total working days
    (same working-days projection as the Cash Sales run rate).
  - Prior-Year Same-Month sales (per location) = full prior-year calendar-month cash.
  - Same-store = first cash date on/before (reporting month start − 12 months).
  Cash basis throughout (sales_collected_exc_tax, with the cash payment-type filter).
"""
import calendar
import logging
from datetime import datetime
from typing import Optional

from config import FULL_CASH
from db import run_query
from utils.operating_days import _open_days, _count_between, _CASH_PAY_FILTER

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


def sss_growth_yoy(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    try:
        return _sss_growth_yoy(s, e, locations, latest_date)
    except Exception as exc:  # never let SSS take down the KPI header
        log.warning("sss_growth_yoy failed; returning None: %s", exc)
        return None


def _sss_growth_yoy(s: str, e: str, locations: Optional[list[str]], latest_date: str) -> Optional[float]:
    table = _open_days()
    if not table:
        return None

    s_dt        = datetime.strptime(s, "%Y-%m-%d").date()
    month_start = s_dt.replace(day=1)
    month_end   = s_dt.replace(day=calendar.monthrange(s_dt.year, s_dt.month)[1])
    py_start    = month_start.replace(year=month_start.year - 1)
    py_end      = month_end.replace(year=month_end.year - 1)
    # Same-store cutoff: open > 12 months => first cash on/before (month_start − 12 months).
    cutoff      = py_start

    cur_mtd  = _sum_by_center(month_start.isoformat(), latest_date, locations)   # MTD cash per loc
    py_full  = _sum_by_center(py_start.isoformat(), py_end.isoformat(), locations)  # PY full-month cash

    # Same-store filter: a center counts iff it had cash ON/BEFORE the cutoff
    # (open > 12 months). Previously this did MIN(payment_date) GROUP BY center
    # over ALL history with no date bound — a full-table scan of the cash table
    # that pushed the KPI header past the 10s query timeout. We only need set
    # membership, so bound the scan to rows on/before the cutoff date.
    loc, params = _loc_clause(locations)
    same_store_sql = f"""
        SELECT DISTINCT center_name
        FROM {FULL_CASH}
        WHERE payment_date < DATEADD(DAY, 1, '{cutoff.isoformat()}')
        {_CASH_PAY_FILTER} {loc}
    """
    same_store = {r["center_name"] for r in run_query(same_store_sql, params or None)}

    ms_iso  = month_start.isoformat()
    me_iso  = month_end.isoformat()
    tot_proj, tot_py = 0.0, 0.0
    for center, py_sales in py_full.items():
        if center not in same_store:
            continue                                  # not same-store (open ≤ 12 months)
        days = table.get(center, [])
        elapsed_wd = _count_between(days, ms_iso, latest_date)
        total_wd   = _count_between(days, ms_iso, me_iso)
        if elapsed_wd <= 0 or py_sales <= 0:
            continue
        proj = cur_mtd.get(center, 0.0) / elapsed_wd * total_wd   # projected full-month run rate
        tot_proj += proj
        tot_py   += py_sales

    return ((tot_proj - tot_py) / tot_py * 100) if tot_py else None
