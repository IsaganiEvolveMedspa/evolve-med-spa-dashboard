"""
MTD Ad Spend helper (chain-level).

Source: the live warehouse tables dbo.BRONZE_ZENOTI_GOOGLE_ADS (Google) and
dbo.BRONZE_ZENOTI_FB_ADS (Facebook), each carrying `report_date` + `amount_spend`.
Both tables are fully reingested every day (drop + reload), so they hold exactly
one row per campaign/ad per report_date — no accumulating snapshots — and a plain
SUM over the date range is correct (same formula the old Excel export used:
SUM("Cost: Amount spend") over dates in range, Google + Facebook combined).

Previously this read a bundled Excel export (data/Google Ads.xlsx) pre-aggregated
into data/ad_spend_daily.json by scripts/build_ad_spend_json.py; the BRONZE tables
are live, so we query them directly and no rebuild step is needed — the same
migration New Guest Count and Rebook Rate made (see utils/new_guests.py). This
removes the staleness where MTD Ad Spend / CAC froze whenever the daily workbook
wasn't re-imported into the JSON.

  MTD Ad Spend            = SUM(amount_spend) for dates in [s, e], Google + FB
  Client Acquisition Cost = MTD Ad Spend / New Customers

NOTE: the ad data has no usable per-location split (campaigns are mostly chain-wide),
so this is a CHAIN-LEVEL figure. It ignores any location filter.
"""
import logging
from typing import Optional

from config import FULL_FB_ADS, FULL_GOOGLE_ADS
from db import run_query

log = logging.getLogger(__name__)


def mtd_ad_spend(s: str, e: str) -> Optional[float]:
    """Sum chain-level ad spend (Google + Facebook) for ISO dates s..e inclusive.

    None when neither table has any row in [s, e] (so the caller can treat ad
    spend / CAC as unavailable for ranges the warehouse doesn't cover). Returns
    the sum — possibly 0 — whenever at least one row is present.

    amount_spend may be stored as nvarchar, so TRY_CAST to FLOAT both parses it
    and safely drops any non-numeric/blank cells. Dates are inlined (validated
    router params), matching the other BRONZE helpers (new_guests / rebooking).
    """
    try:
        sql = f"""
            SELECT SUM(TRY_CAST(amount_spend AS FLOAT)) AS ad_spend,
                   COUNT(*)                              AS rows_present
            FROM (
                SELECT amount_spend, report_date FROM {FULL_GOOGLE_ADS}
                UNION ALL
                SELECT amount_spend, report_date FROM {FULL_FB_ADS}
            ) a
            WHERE CAST(report_date AS DATE) BETWEEN '{s}' AND '{e}'
        """
        rows = run_query(sql)
        r = rows[0] if rows else {}
        # No ad rows for this range → treat as unavailable (CAC then also None).
        if not r or (r.get("rows_present") or 0) == 0:
            return None
        val = r.get("ad_spend")
        return round(float(val), 2) if val is not None else 0.0
    except Exception as exc:                  # never take down the KPI header
        log.warning("mtd_ad_spend failed; returning None: %s", exc)
        return None


def client_acquisition_cost(ad_spend: Optional[float], new_customers: Optional[float]) -> Optional[float]:
    """CAC = MTD Ad Spend / New Customers; None when either input is missing/zero."""
    if ad_spend is None or not new_customers:
        return None
    return round(ad_spend / new_customers, 2)
