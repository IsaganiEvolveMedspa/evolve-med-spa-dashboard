"""
Official Rebooking Rate — the source of truth for the "Rebook Rate %" KPI card.

Source: dbo.BRONZE_ZENOTI_BUSINESS_KPI (live warehouse). Each row is a CUMULATIVE
MTD snapshot per center, keyed by `business_kpi_date` — a period-LABEL string like
'2026-07-01_to_2026-07-12' (fixed month start, advancing end date), NOT a castable
date. New snapshots for the month are appended as their own rows, so we must select
the month's rows (business_kpi_date LIKE 'YYYY-MM%') and keep only the LATEST
snapshot (max parsed end date); otherwise earlier cumulative snapshots skew the
average. This mirrors utils/new_guests.py, the proven reader for this same table.

Rule:
  • Rebook Rate = AVERAGE of each center's rebooking_source_percentage in the
    LATEST MTD snapshot, over the selected centers, EXCLUDING zero/blank rates
    (non-operating centers / no-rebooking days shouldn't drag the average down).
    Because the snapshot is cumulative MTD, each center's percentage is already the
    month-to-date rate, so this reproduces the Business KPI report's per-center
    period figures (an unweighted mean across centers).
  • Returns None when the month has no usable (non-zero) rate, so the caller in
    mtd.py falls back to the appointments-based SQL rate.

NOTE (2026-07-14): previously this filtered `TRY_CAST(business_kpi_date AS DATE)
BETWEEN s AND e`, but business_kpi_date is a '_to_' period label, not a date, so
that cast was NULL for every row — the query matched nothing, always returned None,
and the card silently fell back to the appointments-based rate. Fixed to the
snapshot logic below (same as utils/new_guests.py).
"""
import logging
from typing import Optional

from config import FULL_BUSINESS_KPI
from db import run_query
from utils.filters import loc_in

log = logging.getLogger(__name__)


def rebooking_rate_kpi(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    """Average per-center rebooking % from the LATEST MTD snapshot for the month of
    `s`, over `locations` (all centers when None), EXCLUDING zero/blank rates.
    Returns None when no non-zero rate exists (caller falls back to the SQL rate).

    `s` is a validated YYYY-MM-DD router param, so s[:7] is a safe 'YYYY-MM' literal.
    `e` is accepted for signature compatibility; the snapshot is selected by month +
    latest end date (exact days disregarded), matching utils/new_guests. The end
    date is the text after '_to_'; TRY_CAST parses it whether or not the day is
    zero-padded ('2026-07-1'). rebooking_source_percentage is nvarchar whole-percents
    (e.g. '22.22'), so TRY_CAST to FLOAT both parses it and drops non-numeric/blank
    cells.
    """
    try:
        loc_and, loc_p = loc_in(locations, col="center_name")
        month = s[:7]
        sql = f"""
            WITH snap AS (
                SELECT center_name, rebooking_source_percentage,
                       TRY_CAST(SUBSTRING(business_kpi_date,
                                          CHARINDEX('_to_', business_kpi_date) + 4,
                                          LEN(business_kpi_date)) AS DATE) AS end_dt
                FROM {FULL_BUSINESS_KPI}
                WHERE business_kpi_date LIKE '{month}%'
            )
            SELECT AVG(TRY_CAST(rebooking_source_percentage AS FLOAT)) AS rebook_rate_pct
            FROM snap
            WHERE end_dt = (SELECT MAX(end_dt) FROM snap)
              AND TRY_CAST(rebooking_source_percentage AS FLOAT) > 0
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        val = rows[0].get("rebook_rate_pct") if rows else None
        return round(float(val), 2) if val is not None else None
    except Exception as exc:                                 # never take down the KPI header
        log.warning("rebooking_rate_kpi failed; returning None: %s", exc)
        return None


def rebooking_rate_by_center(s: str, e: str, locations: Optional[list[str]]) -> dict[str, float]:
    """Per-center version of rebooking_rate_kpi(): {center_name: rate}.

    Same source and snapshot logic (LATEST MTD snapshot for the month of `s`), but
    keyed per center instead of averaged. Because the snapshot is cumulative MTD,
    each center's rebooking_source_percentage is already its month-to-date rate, so
    the per-center figure is that value directly. Zero/blank rates are EXCLUDED (that
    center is simply absent from the map, so the caller falls back to the SQL rate
    for it) — identical to how the chain average excludes them. The unweighted mean
    of this map over the selected centers is exactly rebooking_rate_kpi(), so the
    per-location rows reconcile with the header/total. Returns {} on any error."""
    try:
        loc_and, loc_p = loc_in(locations, col="center_name")
        month = s[:7]
        sql = f"""
            WITH snap AS (
                SELECT center_name, rebooking_source_percentage,
                       TRY_CAST(SUBSTRING(business_kpi_date,
                                          CHARINDEX('_to_', business_kpi_date) + 4,
                                          LEN(business_kpi_date)) AS DATE) AS end_dt
                FROM {FULL_BUSINESS_KPI}
                WHERE business_kpi_date LIKE '{month}%'
            )
            SELECT center_name,
                   TRY_CAST(rebooking_source_percentage AS FLOAT) AS rebook_rate_pct
            FROM snap
            WHERE end_dt = (SELECT MAX(end_dt) FROM snap)
              AND TRY_CAST(rebooking_source_percentage AS FLOAT) > 0
              {loc_and}
        """
        rows = run_query(sql, loc_p or None)
        out: dict[str, float] = {}
        for r in rows:
            center = (r.get("center_name") or "").strip()
            val = r.get("rebook_rate_pct")
            if center and val is not None:
                out[center] = round(float(val), 2)
        return out
    except Exception as exc:                                 # never take down the summary
        log.warning("rebooking_rate_by_center failed: %s", exc)
        return {}
