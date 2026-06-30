"""
New Customer Visits.

  New customer = a guest (guest_name) whose FIRST sale date falls in the reporting
  month, where that first purchase is NOT a membership. If the guest's first sale
  is a membership only, they are not counted.

Source: BRONZE_ZENOTI_SALES_ACCRUAL (recognized sales, has sale_date + guest_name).
  - first sale date = MIN(sale_date) per guest_name across all history (closed sales)
  - "non-membership first purchase" = the first-date rows include a row whose
    item_category is not 'Memberships'
  - location filter uses center_name directly (when locations are selected, "first
    sale" is scoped to those centers, i.e. new to the selected center(s))

Performance: only guests who transacted in [s, e] can have their FIRST sale in the
window, so we pre-filter to those candidate guests before the full-history MIN()
aggregation. Cached + single-flight (see slowcache) since it can still be heavy on
a cold table, and the KPI header caps how long it waits for it.
"""
import logging
from typing import Optional

from config import FULL_SALES
from db import run_query
from utils.slowcache import TTLSingleFlight

log = logging.getLogger(__name__)

# 10-min TTL + single-flight: one computation per (s,e,locations) at a time; other
# callers get the cached/last value instead of each launching their own scan.
_CACHE = TTLSingleFlight(ttl_seconds=600)


def new_customer_visits(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Distinct guests whose first (non-membership) sale date is in [s, e]."""
    key = (s, e, tuple(sorted(locations)) if locations else None)
    hit, val = _CACHE.get_fresh(key)
    if hit:
        return val
    if not _CACHE.begin(key):                 # another thread is computing
        any_hit, any_val = _CACHE.get_any(key)
        return any_val if any_hit else 0
    try:
        val = _new_customer_visits(s, e, locations)
        _CACHE.finish(key, val)
        return val
    except Exception as exc:                  # never let this one helper take down the KPI header
        log.warning("new_customer_visits failed; returning 0: %s", exc)
        _CACHE.abort(key)
        return 0


def _new_customer_visits(s: str, e: str, locations: Optional[list[str]]) -> int:
    loc_clause, params = "", []
    if locations:
        ph = ", ".join(["%s"] * len(locations))
        loc_clause = f"AND s.center_name IN ({ph})"
        params = list(locations) * 3          # loc_clause appears 3 times below

    sql = f"""
        WITH cand AS (
            -- guests with a (closed) sale in the window — only these can be "new this month"
            SELECT DISTINCT s.guest_name
            FROM {FULL_SALES} s
            WHERE s.sale_date >= '{s}' AND s.sale_date < DATEADD(DAY, 1, '{e}')
              AND s.guest_name IS NOT NULL
              AND LOWER(s.status) = 'closed'
              {loc_clause}
        ),
        first_sale AS (
            -- each candidate guest's first-ever (closed) sale date
            SELECT s.guest_name, MIN(CAST(s.sale_date AS DATE)) AS first_dt
            FROM {FULL_SALES} s
            JOIN cand c ON c.guest_name = s.guest_name
            WHERE LOWER(s.status) = 'closed'
              {loc_clause}
            GROUP BY s.guest_name
        )
        SELECT COUNT(DISTINCT fs.guest_name) AS new_visits
        FROM first_sale fs
        JOIN {FULL_SALES} s
          ON s.guest_name = fs.guest_name
         AND CAST(s.sale_date AS DATE) = fs.first_dt
        WHERE fs.first_dt BETWEEN '{s}' AND '{e}'
          AND LOWER(s.status) = 'closed'
          -- first purchase is non-membership (a membership-only first sale is excluded)
          AND (s.item_category IS NULL OR s.item_category <> 'Memberships')
          {loc_clause}
    """
    rows = run_query(sql, params or None)
    return int(rows[0]["new_visits"]) if rows and rows[0].get("new_visits") is not None else 0
