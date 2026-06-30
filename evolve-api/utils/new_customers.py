"""
New Customer Visits.

  New customer = a guest (UserId) whose FIRST sale date falls in the reporting month,
  where that first purchase is NOT a membership (MembershipVersionId = 'Not Applicable').
  If the first purchase is a membership, the guest is not counted.

Source: Bi_FactCollections_s3 (transaction-grain collections).
  - first sale date = MIN(SaleDateInCenter) per UserId across all history
  - excludes deleted / voided rows and zero-amount rows
  - location filter maps center_name -> CenterId via the sales table
"""
import logging
from typing import Optional

from config import FULL_FACT_COLLECTIONS, FULL_SALES
from db import run_query
from utils.slowcache import TTLSingleFlight

log = logging.getLogger(__name__)

# Non-membership marker on a collection row.
NON_MEMBERSHIP = "Not Applicable"

# Fact table is large/un-indexed for this access pattern (first-ever sale per
# user) and changes slowly; cache for 10 min with single-flight (see slowcache).
_CACHE = TTLSingleFlight(ttl_seconds=600)


def new_customer_visits(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Distinct guests whose first (non-membership) sale date is in [s, e].

    Cached + single-flight: a cold computation can take ~30s scanning the fact
    table, so only one runs per (s,e,locations) at a time and the result is cached
    for 10 min. Concurrent/subsequent callers get the cached value instead of each
    launching their own 30s scan (which would exhaust DB connections).
    """
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
        loc_clause = (
            f"AND f.CenterId IN (SELECT DISTINCT CAST(center_id AS VARCHAR(64)) "
            f"FROM {FULL_SALES} WHERE center_name IN ({ph}))"
        )
        params = list(locations)

    sql = f"""
        WITH candidates AS (
            SELECT DISTINCT UserId
            FROM {FULL_FACT_COLLECTIONS}
            WHERE IsDeleted = 0 AND (Void = 0 OR Void IS NULL) AND Amount > 0
              AND SaleDateInCenter >= '{s}'
              AND SaleDateInCenter <  DATEADD(DAY, 1, '{e}')
        ),
        first_sale AS (
            SELECT f.UserId, MIN(CAST(f.SaleDateInCenter AS DATE)) AS first_dt
            FROM {FULL_FACT_COLLECTIONS} f
            JOIN candidates c ON c.UserId = f.UserId
            WHERE f.IsDeleted = 0 AND (f.Void = 0 OR f.Void IS NULL) AND f.Amount > 0
            GROUP BY f.UserId
        )
        SELECT COUNT(DISTINCT fs.UserId) AS new_visits
        FROM first_sale fs
        JOIN {FULL_FACT_COLLECTIONS} f
          ON f.UserId = fs.UserId
         AND CAST(f.SaleDateInCenter AS DATE) = fs.first_dt
        WHERE fs.first_dt BETWEEN '{s}' AND '{e}'
          AND f.IsDeleted = 0 AND (f.Void = 0 OR f.Void IS NULL) AND f.Amount > 0
          AND f.MembershipVersionId = '{NON_MEMBERSHIP}'
          {loc_clause}
    """
    rows = run_query(sql, params or None)
    return int(rows[0]["new_visits"]) if rows and rows[0].get("new_visits") is not None else 0
