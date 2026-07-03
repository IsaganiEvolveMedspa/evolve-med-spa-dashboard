"""
Official New Guest Count (Zenoti daily "Business KPI" export) — the source of truth
for New Customer Visits and the ASP (New) denominator.

Source: data/new_guests/*.csv (one file per day), pre-aggregated per day/center into
data/new_guests_daily.json by scripts/build_new_guests_json.py. Read here with stdlib
json only, so production needs no CSV/Excel deps.

  New Customer Visits = SUM("New Guest Count") for dates in [s, e], over the selected
                        centers (all centers when no location filter is given).

Unlike Ad Spend, this figure IS per-center, so it honors the location filter.

Coverage: returns None when the requested range has NO day present in the file (so
callers fall back to the computed sales-accrual figure for months we don't have an
export for). Returns the sum — possibly 0 — whenever at least one day in [s, e] is
present. A partially-covered range sums only the days we have (fine for MTD-to-date).
"""
import json
import os
from functools import lru_cache
from typing import Optional

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "new_guests_daily.json")


@lru_cache(maxsize=1)
def _daily() -> dict[str, dict[str, int]]:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def new_guest_count(s: str, e: str, locations: Optional[list[str]]) -> Optional[int]:
    """Sum official New Guest Count for ISO dates s..e inclusive, over `locations`
    (all centers when None). None when no day in [s, e] exists in the export."""
    daily = _daily()
    days_in_range = [cc for d, cc in daily.items() if s <= d <= e]
    if not days_in_range:
        return None
    loc_set = set(locations) if locations else None
    total = 0
    for cc in days_in_range:
        if loc_set is None:
            total += sum(cc.values())
        else:
            total += sum(v for center, v in cc.items() if center in loc_set)
    return total
