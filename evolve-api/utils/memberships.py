"""
New-membership count for Membership Adoption Rate.

Per the KPI spec, the numerator is memberships CREATED this month whose membership
START is also this month, from Bi_DimMembershipUser_s3 (not the cash-line proxy).

  new memberships = COUNT(DISTINCT UserMembershipId)
                    WHERE IsDeleted = 0
                      AND CreationDate is in the reporting month (MTD: between s and e)
                      AND StartDate is in the same calendar month

Location filter: the membership table keys location by CenterId (a Zenoti GUID), so
selected center_name(s) are mapped to CenterId via the sales table's center_id/center_name.
"""
import calendar
import logging
from datetime import datetime
from typing import Optional

from config import FULL_MEMBERSHIP, FULL_SALES
from db import run_query
from utils.slowcache import TTLSingleFlight

log = logging.getLogger(__name__)

# BI dim table is slow-changing; cache for 10 min with single-flight (see slowcache).
_CACHE = TTLSingleFlight(ttl_seconds=600)


def new_memberships(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Count of memberships created this month AND starting this month (optionally per location).

    Cached + single-flight: only one computation per (s,e,locations) runs at a time;
    concurrent callers get the last cached value (or 0) instead of piling on the scan.
    """
    key = (s, e, tuple(sorted(locations)) if locations else None)
    hit, val = _CACHE.get_fresh(key)
    if hit:
        return val
    if not _CACHE.begin(key):                 # another thread is computing
        any_hit, any_val = _CACHE.get_any(key)
        return any_val if any_hit else 0
    try:
        val = _new_memberships(s, e, locations)
        _CACHE.finish(key, val)
        return val
    except Exception as exc:                  # never let this take down the KPI header
        log.warning("new_memberships failed; returning 0: %s", exc)
        _CACHE.abort(key)
        return 0


def _new_memberships(s: str, e: str, locations: Optional[list[str]]) -> int:
    e_dt        = datetime.strptime(e, "%Y-%m-%d").date()
    month_start = e_dt.replace(day=1).isoformat()
    # First day of the following month (exclusive upper bound for StartDate).
    if e_dt.month == 12:
        next_month = e_dt.replace(year=e_dt.year + 1, month=1, day=1)
    else:
        next_month = e_dt.replace(month=e_dt.month + 1, day=1)
    next_month_start = next_month.isoformat()

    loc_clause, params = "", []
    if locations:
        ph = ", ".join(["%s"] * len(locations))
        # Map selected center_name(s) -> CenterId via the sales table.
        loc_clause = (
            f"AND m.CenterId IN (SELECT DISTINCT CAST(center_id AS VARCHAR(64)) "
            f"FROM {FULL_SALES} WHERE center_name IN ({ph}))"
        )
        params = list(locations)

    # Sargable: half-open date ranges instead of CAST(...)/YEAR()/MONTH() so an index
    # on CreationDate / StartDate can seek (and returns instantly when there are no
    # rows for the month) rather than scanning the whole dim table.
    sql = f"""
        SELECT COUNT(DISTINCT m.UserMembershipId) AS new_members
        FROM {FULL_MEMBERSHIP} m
        WHERE m.IsDeleted = 0
          AND m.CreationDate >= '{s}' AND m.CreationDate < DATEADD(DAY, 1, '{e}')
          AND m.StartDate    >= '{month_start}' AND m.StartDate < '{next_month_start}'
          {loc_clause}
    """
    rows = run_query(sql, params or None)
    return int(rows[0]["new_members"]) if rows and rows[0].get("new_members") is not None else 0
