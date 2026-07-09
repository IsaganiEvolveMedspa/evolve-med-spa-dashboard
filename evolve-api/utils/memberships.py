"""
New-membership count for Membership Adoption Rate.

Numerator = memberships CREATED this month AND STARTING the same month.

Source: dbo.BRONZE_ZENOTI_MEMBERSHIPS_SALES (live warehouse). Only NEW sign-ups
are counted (sale_type = 'Sale'); recurring auto-bills (other sale types) are
excluded. Previously this read a bundled CSV/JSON export because the older
warehouse table was stale; the BRONZE_ZENOTI_MEMBERSHIPS_SALES table is live, so
we query it directly and no rebuild step is needed.

Denominator (non-member unique guests) comes from the cash report's `member` flag
and is computed in the main KPI query, not here.
"""
import calendar
import logging
from datetime import datetime
from typing import Optional

from config import FULL_MEMBERSHIP_SALES
from db import run_query
from utils.filters import loc_in

log = logging.getLogger(__name__)


def new_memberships(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Count new memberships created in [s, e] AND starting the same calendar month
    (optionally scoped to selected centers). Returns 0 on any error so it never
    takes down the KPI header.

    Rules (unchanged from the previous export-based implementation):
      • sale_type = 'Sale'                    → new sign-ups only, no auto-bills
      • sale_date  within [s, e]              → created in the MTD window
      • start_date within the calendar month of `e` → starts the same month
    """
    try:
        e_dt        = datetime.strptime(e, "%Y-%m-%d").date()
        month_start = e_dt.replace(day=1).isoformat()
        month_end   = e_dt.replace(
            day=calendar.monthrange(e_dt.year, e_dt.month)[1]
        ).isoformat()

        # Location filter targets this table's center column (sale_center), not the
        # cash table's center_name. Dates are inlined (validated router params);
        # location values stay parameterised via loc_in().
        loc_and, loc_p = loc_in(locations, col="sale_center")
        sql = f"""
            SELECT COUNT(*) AS new_members
            FROM {FULL_MEMBERSHIP_SALES}
            WHERE LOWER(LTRIM(RTRIM(sale_type))) = 'sale'
              AND CAST(sale_date  AS DATE) BETWEEN '{s}' AND '{e}'
              AND CAST(start_date AS DATE) BETWEEN '{month_start}' AND '{month_end}'
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        val = rows[0].get("new_members") if rows else None
        return int(val) if val is not None else 0
    except Exception as exc:                                 # never take down the KPI header
        log.warning("new_memberships failed; returning 0: %s", exc)
        return 0
