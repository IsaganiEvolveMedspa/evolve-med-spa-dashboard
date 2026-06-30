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
from datetime import datetime
from typing import Optional

from config import FULL_MEMBERSHIP, FULL_SALES
from db import run_query


def new_memberships(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Count of memberships created this month AND starting this month (optionally per location)."""
    e_dt = datetime.strptime(e, "%Y-%m-%d").date()

    loc_clause, params = "", []
    if locations:
        ph = ", ".join(["%s"] * len(locations))
        # Map selected center_name(s) -> CenterId via the sales table.
        loc_clause = (
            f"AND m.CenterId IN (SELECT DISTINCT CAST(center_id AS VARCHAR(64)) "
            f"FROM {FULL_SALES} WHERE center_name IN ({ph}))"
        )
        params = list(locations)

    sql = f"""
        SELECT COUNT(DISTINCT m.UserMembershipId) AS new_members
        FROM {FULL_MEMBERSHIP} m
        WHERE m.IsDeleted = 0
          AND CAST(m.CreationDate AS DATE) BETWEEN '{s}' AND '{e}'
          AND YEAR(m.StartDate)  = {e_dt.year}
          AND MONTH(m.StartDate) = {e_dt.month}
          {loc_clause}
    """
    rows = run_query(sql, params or None)
    return int(rows[0]["new_members"]) if rows and rows[0].get("new_members") is not None else 0
