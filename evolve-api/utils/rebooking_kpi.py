"""
Official Rebooking Rate — the source of truth for the "Rebook Rate %" KPI card.

Source: dbo.BRONZE_ZENOTI_BUSINESS_KPI (live warehouse), one row per day/center
with a `rebooking_source_percentage` column (nvarchar, whole-percent values).
Previously this read a bundled CSV/JSON export (data/rebooking_daily.json, built
from the daily Business KPI CSVs); the BRONZE table is live, so we query it
directly and no rebuild step is needed.

Rule (unchanged):
  • Rebook Rate = AVERAGE of each center's daily rebooking_source_percentage over
    the days in [s, e] and the selected centers, EXCLUDING zero/blank rates
    (non-operating centers / closed days shouldn't drag the average down).
  • Returns None when the range has no usable (non-zero) rate, so the caller in
    mtd.py falls back to the appointments-based SQL rate.
"""
import logging
from typing import Optional

from config import FULL_BUSINESS_KPI
from db import run_query
from utils.filters import loc_in

log = logging.getLogger(__name__)


def rebooking_rate_kpi(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    """Average per-center daily rebooking % for ISO dates s..e inclusive, over
    `locations` (all centers when None), EXCLUDING zero/blank rates. Returns None
    when no non-zero rate exists in the window (caller falls back to the SQL rate).

    rebooking_source_percentage is stored as nvarchar whole-percents (e.g. '22.22'),
    so TRY_CAST to FLOAT both parses it and safely drops non-numeric/blank cells.
    """
    try:
        loc_and, loc_p = loc_in(locations, col="center_name")
        sql = f"""
            SELECT AVG(TRY_CAST(rebooking_source_percentage AS FLOAT)) AS rebook_rate_pct
            FROM {FULL_BUSINESS_KPI}
            WHERE CAST(business_kpi_date AS DATE) BETWEEN '{s}' AND '{e}'
              AND TRY_CAST(rebooking_source_percentage AS FLOAT) > 0
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        val = rows[0].get("rebook_rate_pct") if rows else None
        return round(float(val), 2) if val is not None else None
    except Exception as exc:                                 # never take down the KPI header
        log.warning("rebooking_rate_kpi failed; returning None: %s", exc)
        return None
