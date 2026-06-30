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
from typing import Optional

from config import FULL_FACT_COLLECTIONS, FULL_SALES
from db import run_query

# Non-membership marker on a collection row.
NON_MEMBERSHIP = "Not Applicable"


def new_customer_visits(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Distinct guests whose first (non-membership) sale date is in [s, e]."""
    loc_clause, params = "", []
    if locations:
        ph = ", ".join(["%s"] * len(locations))
        loc_clause = (
            f"AND f.CenterId IN (SELECT DISTINCT CAST(center_id AS VARCHAR(64)) "
            f"FROM {FULL_SALES} WHERE center_name IN ({ph}))"
        )
        params = list(locations)

    sql = f"""
        WITH first_sale AS (
            SELECT UserId, MIN(CAST(SaleDateInCenter AS DATE)) AS first_dt
            FROM {FULL_FACT_COLLECTIONS}
            WHERE IsDeleted = 0 AND (Void = 0 OR Void IS NULL) AND Amount > 0
            GROUP BY UserId
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
