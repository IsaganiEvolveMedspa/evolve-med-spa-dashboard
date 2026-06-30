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

log = logging.getLogger(__name__)

# Non-membership marker on a collection row.
NON_MEMBERSHIP = "Not Applicable"


def new_customer_visits(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Distinct guests whose first (non-membership) sale date is in [s, e].

    Performance note: the first-ever sale date must be computed across all
    history, but only users who actually transacted in [s, e] can possibly have
    their FIRST sale in that window. So we pre-filter to those candidate users
    (`candidates`) before the full-history MIN(date) aggregation — this keeps the
    aggregation off the whole fact table (which previously timed out the entire
    KPI header on every load, regardless of date range).
    """
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
    try:
        rows = run_query(sql, params or None)
        return int(rows[0]["new_visits"]) if rows and rows[0].get("new_visits") is not None else 0
    except Exception as exc:  # never let this one helper take down the KPI header
        log.warning("new_customer_visits failed; returning 0: %s", exc)
        return 0
