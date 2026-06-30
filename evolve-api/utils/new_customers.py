"""
New & Existing Customer Visits (from BRONZE_ZENOTI_SALES_ACCRUAL).

Both are based on each guest's first-ever sale date, and both require the guest
to have a sale within the reporting month (>0 invoice in MTD) AND a non-membership
first purchase ("membershipversionid = Not Applicable" equivalent — the sales table
has no membershipversionid column, so a membership first purchase is detected via
item_category = 'Memberships'; a membership-only first sale is excluded).

  New Customer      = first-ever sale date falls IN the reporting month.
  Existing Customer = first-ever sale date is BEFORE the reporting month
                      (i.e. has a past-purchase record not in this month → returning).

Performance: only guests who transacted in [s, e] can be new/existing this month,
so we pre-filter to those candidates before the full-history MIN(). Cached +
single-flight; the KPI header caps how long it waits for it.
"""
import logging
from typing import Optional

from config import FULL_SALES
from db import run_query
from utils.slowcache import TTLSingleFlight

log = logging.getLogger(__name__)

# 10-min TTL + single-flight: one computation per (s,e,locations) at a time.
_CACHE = TTLSingleFlight(ttl_seconds=600)

_ZERO = {"new": 0, "existing": 0}


def new_existing_visits(s: str, e: str, locations: Optional[list[str]]) -> dict:
    """Return {"new": int, "existing": int} for the month (cached + single-flight)."""
    key = (s, e, tuple(sorted(locations)) if locations else None)
    hit, val = _CACHE.get_fresh(key)
    if hit:
        return val
    if not _CACHE.begin(key):                 # another thread is computing
        any_hit, any_val = _CACHE.get_any(key)
        return any_val if any_hit else dict(_ZERO)
    try:
        val = _compute(s, e, locations)
        _CACHE.finish(key, val)
        return val
    except Exception as exc:                  # never let this take down the KPI header
        log.warning("new_existing_visits failed; returning zeros: %s", exc)
        _CACHE.abort(key)
        return dict(_ZERO)


def _compute(s: str, e: str, locations: Optional[list[str]]) -> dict:
    loc_clause, params = "", []
    if locations:
        ph = ", ".join(["%s"] * len(locations))
        loc_clause = f"AND s.center_name IN ({ph})"
        params = list(locations) * 3          # loc_clause appears 3 times below

    sql = f"""
        WITH cand AS (
            -- guests with a sale in the window (>0 invoice within MTD)
            SELECT DISTINCT s.guest_name
            FROM {FULL_SALES} s
            WHERE s.sale_date >= '{s}' AND s.sale_date < DATEADD(DAY, 1, '{e}')
              AND s.guest_name IS NOT NULL
              {loc_clause}
        ),
        first_sale AS (
            -- each candidate guest's first-ever sale date
            SELECT s.guest_name, MIN(CAST(s.sale_date AS DATE)) AS first_dt
            FROM {FULL_SALES} s
            JOIN cand c ON c.guest_name = s.guest_name
            WHERE 1 = 1
              {loc_clause}
            GROUP BY s.guest_name
        ),
        first_nonmemb AS (
            -- keep only guests whose first-date purchase is non-membership
            SELECT DISTINCT fs.guest_name, fs.first_dt
            FROM first_sale fs
            JOIN {FULL_SALES} s
              ON s.guest_name = fs.guest_name
             AND CAST(s.sale_date AS DATE) = fs.first_dt
            WHERE (s.item_category IS NULL OR s.item_category <> 'Memberships')
              {loc_clause}
        )
        SELECT
            SUM(CASE WHEN first_dt BETWEEN '{s}' AND '{e}' THEN 1 ELSE 0 END) AS new_visits,
            SUM(CASE WHEN first_dt <  '{s}'                THEN 1 ELSE 0 END) AS existing_visits
        FROM first_nonmemb
    """
    rows = run_query(sql, params or None)
    r = rows[0] if rows else {}
    return {
        "new":      int(r.get("new_visits") or 0),
        "existing": int(r.get("existing_visits") or 0),
    }
