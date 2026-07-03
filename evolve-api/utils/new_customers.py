"""
New & Existing Customer Visits (from BRONZE_ZENOTI_SALES_ACCRUAL).

Both are based on each guest's first-ever sale date, and both require the guest
to have a sale within the reporting month (>0 invoice in MTD) AND a non-membership
first purchase ("membershipversionid = Not Applicable" equivalent — the sales table
has no membershipversionid column, so a membership first purchase is detected via
item_category = 'Memberships'; a membership-only first sale is excluded).

  New Customer      = first-ever sale date falls IN the reporting month.
  Existing Customer = first-ever sale date is BEFORE the reporting month
                      (i.e. has a past-purchase record not in this month → returning).

Also returns ASP per segment (per customer): each segment's non-membership MTD
sales / that segment's customer count — same classification as the counts, so
ASP New/Existing tie out with New/Existing Customer Visits.

Performance: only guests who transacted in [s, e] can be new/existing this month,
so we pre-filter to those candidates before the full-history MIN(). Cached +
single-flight; the KPI header caps how long it waits for it.
"""
import logging
import threading
from typing import Optional

from config import FULL_SALES
from db import run_query
from utils.slowcache import TTLSingleFlight

log = logging.getLogger(__name__)

# 30-min TTL + single-flight. Stale-while-revalidate: a stale value is served
# instantly while a background thread refreshes it, so the header never blocks on
# (or falls back away from) this scan after the first warm-up — which fixes the
# "new visits flickers 1134 <-> 778" issue when the cache went cold under load.
_CACHE = TTLSingleFlight(ttl_seconds=1800)

_ZERO = {"new": 0, "existing": 0}


def _refresh(key, s, e, locations):
    try:
        _CACHE.finish(key, _compute(s, e, locations))
    except Exception as exc:
        log.warning("new_existing_visits background refresh failed: %s", exc)
        _CACHE.abort(key)


def new_existing_visits(s: str, e: str, locations: Optional[list[str]]) -> dict:
    """Return {"new","existing","asp_new","asp_existing"} (cached, stale-while-revalidate)."""
    key = (s, e, tuple(sorted(locations)) if locations else None)

    fresh, val = _CACHE.get_fresh(key)
    if fresh:
        return val

    has_any, any_val = _CACHE.get_any(key)
    if has_any:
        # Serve the stale value immediately; kick off one background refresh.
        if _CACHE.begin(key):
            threading.Thread(target=_refresh, args=(key, s, e, locations), daemon=True).start()
        return any_val

    # No cached value yet — compute synchronously (single-flight); this is the only
    # path that can block, and only on the first request per (s,e,locations).
    if not _CACHE.begin(key):
        return dict(_ZERO)
    try:
        val = _compute(s, e, locations)
        _CACHE.finish(key, val)
        return val
    except Exception as exc:                  # never let this take down the KPI header
        log.warning("new_existing_visits failed; returning zeros: %s", exc)
        _CACHE.abort(key)
        return dict(_ZERO)


def _compute(s: str, e: str, locations: Optional[list[str]]) -> dict:
    loc_clause, params = "", []
    if locations:
        ph = ", ".join(["%s"] * len(locations))
        loc_clause = f"AND s.center_name IN ({ph})"
        params = list(locations) * 4          # loc_clause appears 4 times below

    sql = f"""
        WITH cand AS (
            -- guests with a sale in the window (>0 invoice within MTD)
            SELECT DISTINCT s.guest_name
            FROM {FULL_SALES} s
            WHERE s.sale_date >= '{s}' AND s.sale_date < DATEADD(DAY, 1, '{e}')
              AND s.guest_name IS NOT NULL
              {loc_clause}
        ),
        first_sale AS (
            -- each candidate guest's first-ever sale date
            SELECT s.guest_name, MIN(CAST(s.sale_date AS DATE)) AS first_dt
            FROM {FULL_SALES} s
            JOIN cand c ON c.guest_name = s.guest_name
            WHERE 1 = 1
              {loc_clause}
            GROUP BY s.guest_name
        ),
        first_nonmemb AS (
            -- keep only guests whose first-date purchase is non-membership
            SELECT DISTINCT fs.guest_name, fs.first_dt
            FROM first_sale fs
            JOIN {FULL_SALES} s
              ON s.guest_name = fs.guest_name
             AND CAST(s.sale_date AS DATE) = fs.first_dt
            WHERE (s.item_category IS NULL OR s.item_category <> 'Memberships')
              {loc_clause}
        ),
        mtd_sales AS (
            -- each candidate guest's non-membership sales within the month (for ASP)
            SELECT s.guest_name, SUM(s.sales_exc_tax) AS amt
            FROM {FULL_SALES} s
            JOIN first_nonmemb fn ON fn.guest_name = s.guest_name
            WHERE s.sale_date >= '{s}' AND s.sale_date < DATEADD(DAY, 1, '{e}')
              AND (s.item_category IS NULL OR s.item_category <> 'Memberships')
              {loc_clause}
            GROUP BY s.guest_name
        )
        SELECT
            SUM(CASE WHEN fn.first_dt BETWEEN '{s}' AND '{e}' THEN 1 ELSE 0 END)                  AS new_visits,
            SUM(CASE WHEN fn.first_dt <  '{s}'                THEN 1 ELSE 0 END)                  AS existing_visits,
            SUM(CASE WHEN fn.first_dt BETWEEN '{s}' AND '{e}' THEN COALESCE(ms.amt, 0) ELSE 0 END) AS new_sales,
            SUM(CASE WHEN fn.first_dt <  '{s}'                THEN COALESCE(ms.amt, 0) ELSE 0 END) AS existing_sales
        FROM first_nonmemb fn
        LEFT JOIN mtd_sales ms ON ms.guest_name = fn.guest_name
    """
    rows = run_query(sql, params or None)
    r = rows[0] if rows else {}
    new_n   = int(r.get("new_visits") or 0)
    exist_n = int(r.get("existing_visits") or 0)
    new_s   = float(r.get("new_sales") or 0)
    exist_s = float(r.get("existing_sales") or 0)
    return {
        "new":          new_n,
        "existing":     exist_n,
        # Non-membership MTD sales per segment. Exposed so callers can recompute ASP
        # against an external denominator (e.g. the official CSV New Guest Count for
        # ASP New) without re-scanning the sales table.
        "new_sales":      new_s,
        "existing_sales": exist_s,
        # ASP per customer (non-membership sales this month / customers in segment)
        "asp_new":      round(new_s / new_n, 2)     if new_n   else None,
        "asp_existing": round(exist_s / exist_n, 2) if exist_n else None,
    }
