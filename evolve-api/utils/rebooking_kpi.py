"""
Official Rebooking Rate (Zenoti daily "Business KPI" export) — the source of truth
for the "Rebook Rate %" KPI card.

Source: data/new_guests/*.csv (one file per day), pre-aggregated per day/center into
data/rebooking_daily.json by scripts/build_rebooking_json.py. Read here with stdlib
json only, so production needs no CSV/Excel deps.

Rule (per product spec):
  • Rebook Rate = AVERAGE of the per-center daily "Rebooking Source %" over the days
    in [s, e] and the selected centers, EXCLUDING zero rates from the average
    (non-operating centers / closed days shouldn't drag the average down).
  • EXCEPTION: when a location filter is applied and the selection has no non-zero
    rate (i.e. the location(s) genuinely rebooked 0%), show 0 instead of dropping it.

Coverage: returns None when the requested range has NO day present in the export
(callers fall back to the appointments-based SQL rate). A partially-covered range
uses only the days we have.
"""
import json
import os
from functools import lru_cache
from typing import Optional

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "rebooking_daily.json")


@lru_cache(maxsize=1)
def _daily() -> dict[str, dict[str, float]]:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def rebooking_rate_kpi(s: str, e: str, locations: Optional[list[str]]) -> Optional[float]:
    """Average per-center daily rebooking % for ISO dates s..e inclusive, over
    `locations` (all centers when None), EXCLUDING zero rates from the average.
    Returns 0.0 when a location filter is given but every rate is zero; None when
    no day in [s, e] exists in the export (caller falls back to the SQL rate)."""
    daily = _daily()
    days_in_range = [cc for d, cc in daily.items() if s <= d <= e]
    if not days_in_range:
        return None

    loc_set = set(locations) if locations else None
    values: list[float] = []
    for cc in days_in_range:
        for center, pct in cc.items():
            if loc_set is None or center in loc_set:
                values.append(pct)

    nonzero = [v for v in values if v > 0]
    if nonzero:
        return round(sum(nonzero) / len(nonzero), 2)
    # No non-zero rates in the selection. If a location filter is applied, that's a
    # genuine 0% for the selected location(s) -> show 0. Otherwise treat as no data.
    return 0.0 if loc_set is not None else None
