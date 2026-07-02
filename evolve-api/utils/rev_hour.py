"""
Revenue / booked-hour by role (Esthetician, Treatment Provider).

Role is defined by the employee schedule's job_name, matched by employee_name:

    rev/hr <role> = Σ sales_exc_tax where sold_by is <role> staff
                    ÷ Σ booked hours of <role> staff

Both sides resolve role membership the SAME way — the set of employee_names that
carry <role> on any schedule row in the period — so numerator and denominator
stay consistent (total role revenue over total role booked hours, no per-day /
center join). Still respects the location filter (schedule set and sales are
scoped to the selected centers).

We match on employee_name, NOT employee_id: the schedule's employee_id is
sparsely populated, and keying booked hours on it silently collapsed the
denominator to NULL whenever the id was missing. Revenue is attributed via
sold_by (the seller of record on the sales-accrual line).
"""
import logging
from typing import Optional

from config import FULL_SCHEDULE, FULL_SALES
from db import run_query
from utils.filters import build_date_filter, merge_params, hhmm_to_hours

log = logging.getLogger(__name__)


def _role_rev_per_hour(s: str, e: str, locations: Optional[list[str]], role_lower: str) -> Optional[float]:
    """Σ role sales (sold_by) ÷ Σ role booked hours. None if no hours.

    Role membership is the set of employee_names carrying <role> (schedule
    job_name) on ANY row in the period. Numerator = sales_accrual rows whose
    sold_by is in that set; denominator = ALL booked hours of those same names
    (so NULL-job schedule rows for a role member are still counted). Matching on
    employee_name (not employee_id) keeps numerator and denominator symmetric and
    avoids the NULL-employee_id collapse. role_lower is a fixed code constant, not
    user input."""
    try:
        sched_where, sched_p = build_date_filter(s, e, locations, date_col="date")
        sales_where, sales_p = build_date_filter(s, e, locations, date_col="sale_date")
        sched_and = "AND" if sched_where else "WHERE"
        sales_and = "AND" if sales_where else "WHERE"

        sql = f"""
            SELECT
                (SELECT SUM(sales_exc_tax)
                   FROM {FULL_SALES} {sales_where}
                   {sales_and} sold_by IN (
                       SELECT DISTINCT employee_name FROM {FULL_SCHEDULE} {sched_where}
                       {sched_and} LOWER(job_name) = '{role_lower}'
                   )) AS rev,
                (SELECT SUM({hhmm_to_hours('booked_hours')})
                   FROM {FULL_SCHEDULE} {sched_where}
                   {sched_and} employee_name IN (
                       SELECT DISTINCT employee_name FROM {FULL_SCHEDULE} {sched_where}
                       {sched_and} LOWER(job_name) = '{role_lower}' AND employee_name IS NOT NULL
                   )) AS hrs
        """
        # param order by appearance: sales_where, numerator sched_where,
        # hrs-outer sched_where, hrs-inner sched_where
        params = merge_params(sales_p, sched_p, sched_p, sched_p)
        rows = run_query(sql, params or None)
        if not rows:
            return None
        rev = rows[0].get("rev")
        hrs = rows[0].get("hrs")
        return (float(rev) / float(hrs)) if rev and hrs else None
    except Exception as exc:
        log.warning("_role_rev_per_hour(%s) failed; returning None: %s", role_lower, exc)
        return None


def esthetician_rev_per_hour(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    return _role_rev_per_hour(s, e, locations, "esthetician")


def provider_rev_per_hour(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    return _role_rev_per_hour(s, e, locations, "treatment provider")
