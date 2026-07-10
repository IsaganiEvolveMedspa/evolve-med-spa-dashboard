"""
Official New Guest Count — the source of truth for New Customer Visits.

Source: dbo.BRONZE_ZENOTI_BUSINESS_KPI (live warehouse) — the daily Zenoti
"Business KPI" export, one row per day/center, with an authoritative
`new_guest_count` column (Zenoti's own figure). Previously this read a bundled
CSV/JSON export (data/new_guests_daily.json, built from the daily Business KPI
CSVs by scripts/build_new_guests_json.py); the BRONZE table is live, so we query
it directly and no rebuild step is needed — the same migration Rebook Rate made
(see utils/rebooking_kpi.py). This removes the staleness where New Customer
Visits froze whenever the daily CSVs weren't re-imported into the JSON.

  New Customer Visits = SUM(new_guest_count) for dates in [s, e], over the
                        selected centers (all centers when no filter is given).

Unlike Ad Spend, this figure IS per-center, so it honors the location filter.

Coverage: returns None when the range has NO row present in the table (so callers
fall back to the computed sales-accrual/cash figure for ranges the warehouse
doesn't cover). Returns the sum — possibly 0 — whenever at least one day in [s, e]
is present. A partially-covered range sums only the days we have (fine for
MTD-to-date).
"""
import logging
from typing import Optional

from config import FULL_BUSINESS_KPI
from db import run_query
from utils.filters import loc_in

log = logging.getLogger(__name__)


def new_guest_count(s: str, e: str, locations: Optional[list[str]]) -> Optional[int]:
    """Sum official New Guest Count for ISO dates s..e inclusive, over `locations`
    (all centers when None). None when no row in [s, e] exists in the warehouse
    table, so the caller falls back to the computed figure.

    new_guest_count is stored as nvarchar (like rebooking_source_percentage), so
    TRY_CAST to FLOAT both parses it and safely drops any non-numeric/blank cells.
    Dates are inlined (validated router params); location values stay parameterised
    via loc_in().
    """
    try:
        loc_and, loc_p = loc_in(locations, col="center_name")
        sql = f"""
            SELECT SUM(TRY_CAST(new_guest_count AS FLOAT)) AS new_guests,
                   COUNT(*)                                AS day_rows
            FROM {FULL_BUSINESS_KPI}
            WHERE CAST(business_kpi_date AS DATE) BETWEEN '{s}' AND '{e}'
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        r = rows[0] if rows else {}
        # No export rows for this range → let the caller fall back to the computed count.
        if not r or (r.get("day_rows") or 0) == 0:
            return None
        val = r.get("new_guests")
        return int(val) if val is not None else 0
    except Exception as exc:                  # never take down the KPI header
        log.warning("new_guest_count failed; returning None: %s", exc)
        return None
