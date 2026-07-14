"""
Official New & Existing Guest Counts — the source of truth for New Customer
Visits and Existing Customer Visits.

Source (month-dependent, see config.business_kpi_table_for):
  • Current calendar month → dbo.BRONZE_ZENOTI_BUSINESS_KPI (live warehouse).
  • Any earlier (completed) month → dbo.TEST_ZENOTI_BUSINESS_KPI, which holds the
    historical month rows. Same schema/format, so only the table name changes.
The daily Zenoti "Business KPI" export, one row per day/center, with authoritative
`unique_guest_count` and `new_guest_count` columns (Zenoti's own figures).
Previously New read a bundled CSV/JSON export (data/new_guests_daily.json, built
from the daily Business KPI CSVs by scripts/build_new_guests_json.py); the BRONZE
table is live, so we query it directly and no rebuild step is needed — the same
migration Rebook Rate made (see utils/rebooking_kpi.py). This removes the
staleness where the visit counts froze whenever the daily CSVs weren't
re-imported into the JSON.

  New Customer Visits      = SUM(new_guest_count)    for the requested month.
  Existing Customer Visits = SUM(unique_guest_count) for the requested month.

`business_kpi_date` is a period-LABEL string (e.g. '2026-07-01_to_2026-07-12'),
NOT a date — it's a cumulative MTD snapshot whose end date advances, added as a new
row each update. So rows are matched by month prefix (business_kpi_date LIKE
'YYYY-MM%') from the requested start date (exact days disregarded), then reduced to
the LATEST snapshot (max parsed end date) so cumulative snapshots aren't double
counted. Both figures are summed over that snapshot's rows for the selected centers
(all centers when no filter is given).

Unlike Ad Spend, these figures ARE per-center, so they honor the location filter.

Coverage:
  • New — returns None when the range has NO row present in the table, so the
    caller can fall back to the computed sales-accrual/cash figure for ranges the
    warehouse doesn't cover.
  • Existing — NO fallback: it is always SUM(unique_guest_count), and 0 when the
    range matches no rows. This is intentional (see mtd.py) — Existing Customer
    Visits reflects only the Business KPI table.
A partially-covered range sums only the days present (fine for MTD-to-date).
"""
import logging
from typing import Optional

from config import business_kpi_table_for
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
        # business_kpi_date holds a period-LABEL string like '2026-07-01_to_2026-07-12'
        # (a cumulative MTD snapshot: fixed month-start, advancing end date), NOT a
        # castable date. New snapshots for the month are added as their own rows
        # (…_to_07-12, then …_to_07-13, …), so we must:
        #   1. LIKE 'YYYY-MM%' to select the month's rows (`s` is a validated
        #      YYYY-MM-DD router param, so s[:7] is a safe 'YYYY-MM' literal).
        #   2. Keep only the LATEST snapshot (max parsed end date) so cumulative
        #      snapshots aren't double-counted. The end date is the text after '_to_';
        #      TRY_CAST parses it whether or not the day is zero-padded ('2026-07-1').
        month = s[:7]
        table = business_kpi_table_for(s)
        sql = f"""
            WITH snap AS (
                SELECT center_name, new_guest_count, unique_guest_count,
                       TRY_CAST(SUBSTRING(business_kpi_date,
                                          CHARINDEX('_to_', business_kpi_date) + 4,
                                          LEN(business_kpi_date)) AS DATE) AS end_dt
                FROM {table}
                WHERE business_kpi_date LIKE '{month}%'
            )
            SELECT SUM(TRY_CAST(new_guest_count AS FLOAT))    AS new_guests,
                   SUM(TRY_CAST(unique_guest_count AS FLOAT)) AS unique_guests,
                   COUNT(*)                                   AS day_rows
            FROM snap
            WHERE end_dt = (SELECT MAX(end_dt) FROM snap)
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        r = rows[0] if rows else {}
        day_rows = (r.get("day_rows") or 0) if r else 0
        new_val = r.get("new_guests")
        uniq_val = r.get("unique_guests")
        # New Customer Visits keeps coverage semantics: None when the range has no
        # export rows, so the caller can fall back to the computed figure.
        new_n = None if day_rows == 0 else (int(new_val) if new_val is not None else 0)
        # Existing Customer Visits = SUM(unique_guest_count) straight from the table.
        # NO fallback — it is always this sum (0 when the range matches no rows).
        existing_n = int(uniq_val) if uniq_val is not None else 0
        return {"new": new_n, "existing": existing_n}
    except Exception as exc:                  # never take down the KPI header
        log.warning("guest_counts failed: %s", exc)
        return {"new": None, "existing": None}


def new_guest_count(s: str, e: str, locations: Optional[list[str]]) -> Optional[int]:
    """Official New Guest Count only — thin wrapper over guest_counts()."""
    return guest_counts(s, e, locations)["new"]


def guest_counts_by_center(s: str, e: str, locations: Optional[list[str]]) -> dict[str, dict]:
    """Per-center version of guest_counts(): {center_name: {"new", "existing"}}.

    Same source and snapshot logic as guest_counts() (the chain total) — match the
    month's rows (business_kpi_date LIKE 'YYYY-MM%'), keep only the LATEST snapshot
    (max parsed end date after '_to_'), then SUM per center. This is the single
    source of truth for the per-LOCATION New/Existing Customer Visits, so those rows
    reconcile with the chain total. No fallback: New and Existing are both straight
    sums from the Business KPI table (a center absent from the snapshot simply isn't
    in the returned map — callers default it to 0). Returns {} on any error so the
    caller degrades gracefully rather than taking down the summary."""
    try:
        loc_and, loc_p = loc_in(locations, col="center_name")
        month = s[:7]
        table = business_kpi_table_for(s)
        sql = f"""
            WITH snap AS (
                SELECT center_name, new_guest_count, unique_guest_count,
                       TRY_CAST(SUBSTRING(business_kpi_date,
                                          CHARINDEX('_to_', business_kpi_date) + 4,
                                          LEN(business_kpi_date)) AS DATE) AS end_dt
                FROM {table}
                WHERE business_kpi_date LIKE '{month}%'
            )
            SELECT center_name,
                   SUM(TRY_CAST(new_guest_count    AS FLOAT)) AS new_guests,
                   SUM(TRY_CAST(unique_guest_count AS FLOAT)) AS unique_guests
            FROM snap
            WHERE end_dt = (SELECT MAX(end_dt) FROM snap)
              {loc_and}
            GROUP BY center_name
        """
        rows = run_query(sql, loc_p or None)
        out: dict[str, dict] = {}
        for r in rows:
            center = (r.get("center_name") or "").strip()
            if not center:
                continue
            new_val = r.get("new_guests")
            uniq_val = r.get("unique_guests")
            out[center] = {
                "new": int(new_val) if new_val is not None else 0,
                "existing": int(uniq_val) if uniq_val is not None else 0,
            }
        return out
    except Exception as exc:                  # never take down the summary
        log.warning("guest_counts_by_center failed: %s", exc)
        return {}
