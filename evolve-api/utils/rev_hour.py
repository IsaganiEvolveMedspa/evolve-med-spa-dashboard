"""
Revenue / booked-hour by role (Esthetician, Treatment Provider) — reference method.

Single source of truth for BOTH the KPI header card (chain-level) and the
per-location Operations table (per-center), so the two always reconcile with each
other and with the agreed reference calculation (the source-of-truth Excel/SQL).

Reference calculation, per (center, employee):
  • Schedule aggregated to (center, employee) for job_name = <role> with a positive
    scheduled_hours (a real working shift). Booked hours parsed via hhmm_to_hours,
    which now handles HH:MM and HH:MM:SS TRY_CAST-safely.
  • Revenue attributed by sold_by (the seller of record on the sales-accrual line).
  • Sales joined to schedule on employee_name + center ONLY — no per-day join — so a
    sale on a non-scheduled day (walk-in on an off day, later-closed invoice, …) still
    counts.
  • Role membership at a center = having a <role> schedule row there in the period;
    that seller's full-window sales at that center then count toward the role.

    rev/hr <role> (per center) = Σ sold_by sales ÷ Σ <role> booked hours
    rev/hr <role> (chain)      = the same totals summed across centers

We match on employee_name (schedule employee_id is sparsely populated, which used to
collapse the denominator to NULL). role_lower is a fixed code constant, not user
input; dates are validated router params (inlined like elsewhere in this codebase);
location values stay parameterised via loc_in().
"""
import logging
from typing import Optional

from config import FULL_SCHEDULE, FULL_SALES
from db import run_query
from utils.filters import hhmm_to_hours, is_positive_duration, loc_in, merge_params

log = logging.getLogger(__name__)


def _role_rev_hours_by_center(
    s: str, e: str, locations: Optional[list[str]], role_lower: str
) -> dict[str, dict]:
    """{center: {"revenue": float, "hours": float}} for a role, reference method."""
    sched_loc, sched_p = loc_in(locations, col="center_name")
    sales_loc, sales_p = loc_in(locations, col="sa.center_name")
    hours_expr = hhmm_to_hours("booked_hours")
    sql = f"""
        WITH sched AS (
            SELECT center_name, employee_name,
                   SUM({hours_expr}) AS booked_hours
            FROM {FULL_SCHEDULE}
            WHERE CAST(date AS DATE) BETWEEN '{s}' AND '{e}'
              AND LOWER(job_name) = '{role_lower}'
              AND {is_positive_duration('scheduled_hours')}
              AND employee_name IS NOT NULL
              {sched_loc}
            GROUP BY center_name, employee_name
        ),
        sales AS (
            SELECT sa.center_name, sa.sold_by AS employee_name,
                   SUM(sa.sales_exc_tax) AS revenue
            FROM {FULL_SALES} sa
            WHERE CAST(sa.sale_date AS DATE) BETWEEN '{s}' AND '{e}'
              {sales_loc}
              AND EXISTS (
                  SELECT 1 FROM sched sc
                  WHERE sc.employee_name = sa.sold_by
                    AND sc.center_name   = sa.center_name
              )
            GROUP BY sa.center_name, sa.sold_by
        )
        SELECT sch.center_name,
               SUM(COALESCE(sa.revenue, 0)) AS revenue,
               SUM(sch.booked_hours)        AS hours
        FROM sched sch
        LEFT JOIN sales sa
               ON sa.employee_name = sch.employee_name
              AND sa.center_name   = sch.center_name
        GROUP BY sch.center_name
    """
    # Param order by appearance: sched CTE loc filter, then sales CTE loc filter.
    params = merge_params(sched_p, sales_p)
    out: dict[str, dict] = {}
    for r in run_query(sql, params or None):
        center = (r.get("center_name") or "").strip()
        if not center:
            continue
        out[center] = {
            "revenue": float(r.get("revenue") or 0),
            "hours":   float(r.get("hours") or 0),
        }
    return out


def _role_rev_per_hour_by_center(
    s: str, e: str, locations: Optional[list[str]], role_lower: str
) -> dict[str, Optional[float]]:
    return {
        c: (v["revenue"] / v["hours"] if v["hours"] else None)
        for c, v in _role_rev_hours_by_center(s, e, locations, role_lower).items()
    }


def _role_rev_per_hour(
    s: str, e: str, locations: Optional[list[str]], role_lower: str
) -> Optional[float]:
    """Chain rev/hr = Σ revenue ÷ Σ booked hours across centers."""
    per = _role_rev_hours_by_center(s, e, locations, role_lower)
    tot_rev = sum(v["revenue"] for v in per.values())
    tot_hrs = sum(v["hours"] for v in per.values())
    return (tot_rev / tot_hrs) if tot_hrs else None


# ── Chain-level (KPI header card) ────────────────────────────────────────────
def esthetician_rev_per_hour(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    try:
        return _role_rev_per_hour(s, e, locations, "esthetician")
    except Exception as exc:                       # never take down the KPI header
        log.warning("esthetician_rev_per_hour failed; returning None: %s", exc)
        return None


def provider_rev_per_hour(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    try:
        return _role_rev_per_hour(s, e, locations, "treatment provider")
    except Exception as exc:
        log.warning("provider_rev_per_hour failed; returning None: %s", exc)
        return None


# ── Per-center (Operations table) ────────────────────────────────────────────
def esthetician_rev_per_hour_by_center(
    s: str, e: str, locations: Optional[list[str]]
) -> dict[str, Optional[float]]:
    try:
        return _role_rev_per_hour_by_center(s, e, locations, "esthetician")
    except Exception as exc:                       # never take down the summary
        log.warning("esthetician_rev_per_hour_by_center failed; returning {}: %s", exc)
        return {}


def provider_rev_per_hour_by_center(
    s: str, e: str, locations: Optional[list[str]]
) -> dict[str, Optional[float]]:
    try:
        return _role_rev_per_hour_by_center(s, e, locations, "treatment provider")
    except Exception as exc:
        log.warning("provider_rev_per_hour_by_center failed; returning {}: %s", exc)
        return {}
