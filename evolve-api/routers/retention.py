"""
Retention router.

GET /api/new-guest-return-rate
==============================
Per-location (and chain-roll-up) "New Guest Return Rate · 90 Day".

Definition (from KPIs-Definations.xlsx primitives):
  New guest      = first_visit = 'yes'  (first paid visit in the center)
  Returned (90d) = the SAME guest paid again 1..90 days after that first visit
  Rate           = returned_90d / new_guests * 100

Source: Cash table (FULL_CASH), keyed by guest_name.
  - guest_name is used (not guest_code) because guest_code can be NULL.
  - cash rows are already collected payments, so sales_collected_exc_tax > 0
    is the "real visit/payment" guard (mirrors mtd.py cash conventions).

90-day window caveat — the "matured cohort":
  A 90-day return is only fully observable for guests whose first visit was at
  least 90 days before the period end. Guests newer than that haven't had a full
  window yet, so including them deflates the rate. The query returns BOTH the raw
  counts (new_guests / returned_90d) and the matured-cohort figures
  (matured_new_guests / matured_returned_90d / new_guest_return_rate_90d). Use the
  matured rate for the headline KPI; surface the raw counts if you want to show
  how many guests are still inside their window.

  The return-check scans the full cash table (not just the selected window), so a
  June new guest returning in August is still captured — the date range only
  constrains WHO is a new guest, never when they may return.
"""

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Query, Request

from config import FULL_CASH
from db import run_query, serialize_rows
from utils.filters import loc_in
from utils.errors import log_and_raise_from_request

router = APIRouter()

# Mirror mtd.py's cash payment-type filter so "visits" exclude gift cards,
# prepaid, packages, memberships, loyalty, cashback. Kept local to avoid a
# cross-module import; keep in sync with mtd._CASH_PAY_FILTER if that changes.
_CASH_PAY_FILTER = (
    "AND LOWER(LTRIM(payment_type)) NOT LIKE 'gift card%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'prepaid card%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'package -%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'membership -%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'loyalty%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'cashback%'"
)


@router.get("/api/new-guest-return-rate")
def get_new_guest_return_rate(
    request:    Request,
    start_date: Optional[str]       = Query(None),
    end_date:   Optional[str]       = Query(None),
    locations:  Optional[List[str]] = Query(None),
):
    """Per-location 90-day new-guest return rate (with matured-cohort rate)."""
    try:
        today = datetime.utcnow().date()
        e = end_date   or str(today)
        s = start_date or str(today.replace(day=1))

        # loc filter for the new_guests CTE only; the returned CTE inherits the
        # cohort via the join, so no second location parameter is needed.
        loc_and, loc_params = loc_in(locations)

        sql = f"""
        WITH new_guests AS (
            -- New guests: first_visit='yes', first PAID visit date in the window.
            SELECT
                center_name,
                guest_name,
                MIN(CAST(payment_date AS DATE)) AS first_visit_date
            FROM {FULL_CASH}
            WHERE LOWER(first_visit) = 'yes'
              AND sales_collected_exc_tax > 0
              AND CAST(payment_date AS DATE) BETWEEN '{s}' AND '{e}'
              {_CASH_PAY_FILTER}
              {loc_and}
            GROUP BY center_name, guest_name
        ),
        returned AS (
            -- Same guest paid again 1..90 days after their first visit.
            SELECT DISTINCT ng.center_name, ng.guest_name
            FROM new_guests ng
            JOIN {FULL_CASH} v
              ON v.guest_name  = ng.guest_name
             AND v.center_name = ng.center_name
             AND v.sales_collected_exc_tax > 0
             AND CAST(v.payment_date AS DATE) >  ng.first_visit_date
             AND CAST(v.payment_date AS DATE) <= DATEADD(DAY, 90, ng.first_visit_date)
        )
        SELECT
            ng.center_name AS location,
            COUNT(DISTINCT ng.guest_name) AS new_guests,
            COUNT(DISTINCT r.guest_name)  AS returned_90d,
            COUNT(DISTINCT CASE WHEN ng.first_visit_date <= DATEADD(DAY, -90, CAST('{e}' AS DATE))
                                THEN ng.guest_name END) AS matured_new_guests,
            COUNT(DISTINCT CASE WHEN ng.first_visit_date <= DATEADD(DAY, -90, CAST('{e}' AS DATE))
                                THEN r.guest_name END)  AS matured_returned_90d,
            COUNT(DISTINCT CASE WHEN ng.first_visit_date <= DATEADD(DAY, -90, CAST('{e}' AS DATE))
                                THEN r.guest_name END) * 100.0
                / NULLIF(COUNT(DISTINCT CASE WHEN ng.first_visit_date <= DATEADD(DAY, -90, CAST('{e}' AS DATE))
                                THEN ng.guest_name END), 0) AS new_guest_return_rate_90d
        FROM new_guests ng
        LEFT JOIN returned r
          ON r.center_name = ng.center_name AND r.guest_name = ng.guest_name
        GROUP BY ng.center_name
        ORDER BY ng.center_name
        """
        return serialize_rows(run_query(sql, loc_params or None))

    except Exception as exc:
        log_and_raise_from_request(exc, request)
