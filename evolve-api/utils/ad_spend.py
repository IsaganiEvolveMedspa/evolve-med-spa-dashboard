"""
MTD Ad Spend helper (chain-level).

Source: data/Google Ads.xlsx (Google + Facebook), pre-aggregated to one chain-level
total per day in data/ad_spend_daily.json (regenerate via scripts/build_ad_spend_json.py).

  MTD Ad Spend            = SUM(daily ad spend) for dates in [s, e]
  Client Acquisition Cost = MTD Ad Spend / New Customers

NOTE: the ad data has no usable per-location split (campaigns are mostly chain-wide),
so this is a CHAIN-LEVEL figure. It ignores any location filter.
"""
import json
import os
from functools import lru_cache
from typing import Optional

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "ad_spend_daily.json")


@lru_cache(maxsize=1)
def _daily() -> dict[str, float]:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def mtd_ad_spend(s: str, e: str) -> Optional[float]:
    """Sum chain-level ad spend for ISO dates s..e inclusive. None if no data file."""
    daily = _daily()
    if not daily:
        return None
    return round(sum(v for d, v in daily.items() if s <= d <= e), 2)


def client_acquisition_cost(ad_spend: Optional[float], new_customers: Optional[float]) -> Optional[float]:
    """CAC = MTD Ad Spend / New Customers; None when either input is missing/zero."""
    if ad_spend is None or not new_customers:
        return None
    return round(ad_spend / new_customers, 2)
