"""
Store open / close dates (bundled reference data — data/store_dates.json).

Used for the same-store filter. "Open date" is the real location opening date
(not the first-cash proxy); "close" is the closure date (null if still open).

  same_store_centers(open_cutoff_iso, period_end_iso) -> set of center_name that
  were open ON/BEFORE the cutoff (i.e. > 12 months as of the reporting month) and
  are NOT closed on/before the period end.
"""
import json
import os
from functools import lru_cache

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "store_dates.json")


@lru_cache(maxsize=1)
def store_dates() -> dict:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def same_store_centers(open_cutoff_iso: str, period_end_iso: str) -> set[str]:
    """Centers open on/before the cutoff and not closed on/before period_end."""
    out: set[str] = set()
    for center, d in store_dates().items():
        op = d.get("open")
        cl = d.get("close")
        if not op or op > open_cutoff_iso:
            continue                       # not open long enough (< 12 months)
        if cl and cl <= period_end_iso:
            continue                       # closed during/before the period
        out.add(center)
    return out
