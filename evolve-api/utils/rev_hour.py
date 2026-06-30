"""
Decoupled Revenue / booked-hour for Estheticians.

The header's main query computes rev/hr via a per-day + center schedule↔sales
join, which drops esthetician sales on days/centers not matched to a schedule
row (~20% leak observed). For estheticians we instead compute it DECOUPLED:

    rev/hr esthetician = Σ sales_exc_tax by esthetician-role employees
                         ÷ Σ esthetician booked hours

i.e. total role revenue over total role booked hours (no per-day/center join),
which captures the full esthetician revenue. Still respects the location filter
(both the employee set and the sales are scoped to the selected centers).
"""
import logging
from typing import Optional

from config import FULL_SCHEDULE, FULL_SALES
from db import run_query
from utils.filters import build_date_filter, merge_params, hhmm_to_hours

log = logging.getLogger(__name__)


def esthetician_rev_per_hour(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    """Σ esthetician-role sales ÷ Σ esthetician booked hours (decoupled). None if no hours."""
    try:
        sched_where, sched_p = build_date_filter(s, e, locations, date_col="date")
        sales_where, sales_p = build_date_filter(s, e, locations, date_col="sale_date")
        sched_and = "AND" if sched_where else "WHERE"
        sales_and = "AND" if sales_where else "WHERE"

        sql = f"""
            SELECT
                (SELECT SUM(sales_exc_tax)
                   FROM {FULL_SALES} {sales_where}
                   {sales_and} serviced_by IN (
                       SELECT DISTINCT employee_name FROM {FULL_SCHEDULE} {sched_where}
                       {sched_and} LOWER(job_name) = 'esthetician'
                   )) AS rev,
                (SELECT SUM({hhmm_to_hours('booked_hours')})
                   FROM {FULL_SCHEDULE} {sched_where}
                   {sched_and} LOWER(job_name) = 'esthetician') AS hrs
        """
        # param order matches appearance: sales_where, inner sched_where, hrs sched_where
        params = merge_params(sales_p, sched_p, sched_p)
        rows = run_query(sql, params or None)
        if not rows:
            return None
        rev = rows[0].get("rev")
        hrs = rows[0].get("hrs")
        return (float(rev) / float(hrs)) if rev and hrs else None
    except Exception as exc:
        log.warning("esthetician_rev_per_hour failed; returning None: %s", exc)
        return None
