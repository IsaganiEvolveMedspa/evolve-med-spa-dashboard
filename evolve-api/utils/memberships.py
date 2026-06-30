"""
New-membership count for Membership Adoption Rate.

Numerator = memberships CREATED this month AND STARTING the same month.

Source: bundled Zenoti "Memberships" report exports (data/memberships.json, built
from data/memberships_*.csv via scripts/build_memberships_json.py). The warehouse
table Bi_DimMembershipUser_s3 is stale (no current-month rows), so we use the
report export instead. Only NEW sign-ups are kept (Sale Type = 'Sale'); recurring
auto-bills are excluded by the generator.

Denominator (non-member unique guests) comes from the cash report's `member` flag
and is computed in the main KPI query, not here.
"""
import json
import logging
import os
from datetime import datetime
from functools import lru_cache
from typing import Optional

log = logging.getLogger(__name__)

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "memberships.json")


@lru_cache(maxsize=1)
def _rows() -> list[dict]:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return []


def new_memberships(s: str, e: str, locations: Optional[list[str]]) -> int:
    """Count new memberships created in [s, e] AND starting the same calendar month
    (optionally scoped to selected centers). 0 if the bundled file is missing/empty."""
    try:
        e_dt        = datetime.strptime(e, "%Y-%m-%d").date()
        month_start = e_dt.replace(day=1).isoformat()
        if e_dt.month == 12:
            next_month = e_dt.replace(year=e_dt.year + 1, month=1, day=1).isoformat()
        else:
            next_month = e_dt.replace(month=e_dt.month + 1, day=1).isoformat()

        loc_set = set(locations) if locations else None
        cnt = 0
        for r in _rows():
            sd = r.get("sale_date")
            st = r.get("start_date")
            if not sd or not (s <= sd <= e):                 # created this month (MTD window)
                continue
            if not st or not (month_start <= st < next_month):  # starts the same calendar month
                continue
            if loc_set and r.get("center") not in loc_set:
                continue
            cnt += 1
        return cnt
    except Exception as exc:                                 # never take down the KPI header
        log.warning("new_memberships failed; returning 0: %s", exc)
        return 0
