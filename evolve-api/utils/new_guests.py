"""
Official New & Existing Guest Counts — the source of truth for New Customer
Visits and Existing Customer Visits.

Source: dbo.BRONZE_ZENOTI_BUSINESS_KPI (live warehouse) — the daily Zenoti
"Business KPI" export, one row per day/center, with authoritative
`unique_guest_count` and `new_guest_count` columns (Zenoti's own figures).
Previously New read a bundled CSV/JSON export (data/new_guests_daily.json, built
from the daily Business KPI CSVs by scripts/build_new_guests_json.py); the BRONZE
table is live, so we query it directly and no rebuild step is needed — the same
migration Rebook Rate made (see utils/rebooking_kpi.py). This removes the
staleness where the visit counts froze whenever the daily CSVs weren't
re-imported into the JSON.

  New Customer Visits      = SUM(new_guest_count)    for dates in [s, e].
  Existing Customer Visits = SUM(unique_guest_count) for dates in [s, e].

Each daily row's `unique_guest_count` is that day/center's distinct guests. Both
figures are summed over the days in [s, e] and the selected centers (all centers
when no filter is given) — a per-day-distinct (guest-visits) basis.

Unlike Ad Spend, these figures ARE per-center, so they honor the location filter.

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


def guest_counts(s: str, e: str, locations: Optional[list[str]]) -> dict:
    """Return {"new", "existing"} official guest counts for ISO dates s..e
    inclusive, over `locations` (all centers when None). Each value is None when
    no row in [s, e] exists in the warehouse table, so the caller falls back to
    the computed figure.

    new_guest_count / unique_guest_count are stored as nvarchar (like
    rebooking_source_percentage), so TRY_CAST to FLOAT both parses them and
    safely drops any non-numeric/blank cells. Dates are inlined (validated router
    params); location values stay parameterised via loc_in().
    """
    try:
        loc_and, loc_p = loc_in(locations, col="center_name")
        sql = f"""
            SELECT SUM(TRY_CAST(new_guest_count AS FLOAT))    AS new_guests,
                   SUM(TRY_CAST(unique_guest_count AS FLOAT)) AS unique_guests,
                   COUNT(*)                                   AS day_rows
            FROM {FULL_BUSINESS_KPI}
            WHERE TRY_CAST(business_kpi_date AS DATE) BETWEEN '{s}' AND '{e}'
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        r = rows[0] if rows else {}
        # No export rows for this range → let the caller fall back to the computed counts.
        if not r or (r.get("day_rows") or 0) == 0:
            return {"new": None, "existing": None}
        new_val = r.get("new_guests")
        uniq_val = r.get("unique_guests")
        new_n = int(new_val) if new_val is not None else 0
        # Existing Customer Visits = SUM(unique_guest_count) — total distinct
        # guest-visits per day/center summed over the range.
        existing_n = int(uniq_val) if uniq_val is not None else None
        return {"new": new_n, "existing": existing_n}
    except Exception as exc:                  # never take down the KPI header
        log.warning("guest_counts failed; returning Nones: %s", exc)
        return {"new": None, "existing": None}


def new_guest_count(s: str, e: str, locations: Optional[list[str]]) -> Optional[int]:
    """Official New Guest Count only — thin wrapper over guest_counts()."""
    return guest_counts(s, e, locations)["new"]
