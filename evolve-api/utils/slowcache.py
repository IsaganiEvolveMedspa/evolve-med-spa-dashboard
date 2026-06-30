"""
TTL + single-flight cache for expensive, slow-changing queries.

Used by the BI-table metrics (new customer visits, new memberships) that scan
large un-indexed warehouse tables and can take 15-30s. These values change
slowly (daily at most), so:

  - get_fresh(key)  -> (hit, value) if a value is cached and within the TTL.
  - begin(key)      -> True if THIS thread should compute (single-flight); False
                       if another thread is already computing it (caller should
                       fall back to a stale/default value and not pile on).
  - finish(key, v)  -> store the freshly computed value and release the slot.

Single-flight prevents many concurrent header loads from each kicking off the
same 30s scan (which would exhaust DB connections). Only one computation per key
runs at a time; everyone else gets the last cached value (or the default).
"""
import threading
import time
from typing import Any, Optional


class TTLSingleFlight:
    def __init__(self, ttl_seconds: int = 600):
        self.ttl = ttl_seconds
        self._data: dict[Any, tuple[Any, float]] = {}   # key -> (value, stored_at)
        self._inflight: set[Any] = set()
        self._guard = threading.Lock()

    def get_fresh(self, key: Any) -> tuple[bool, Any]:
        """Return (True, value) if cached and within TTL, else (False, None)."""
        with self._guard:
            entry = self._data.get(key)
            if entry and (time.time() - entry[1]) < self.ttl:
                return True, entry[0]
            return False, None

    def get_any(self, key: Any) -> tuple[bool, Any]:
        """Return (True, value) if any value is cached (even stale), else (False, None)."""
        with self._guard:
            entry = self._data.get(key)
            return (True, entry[0]) if entry else (False, None)

    def begin(self, key: Any) -> bool:
        """Claim the compute slot for `key`. True = caller computes; False = someone else is."""
        with self._guard:
            if key in self._inflight:
                return False
            self._inflight.add(key)
            return True

    def finish(self, key: Any, value: Any) -> None:
        with self._guard:
            self._data[key] = (value, time.time())
            self._inflight.discard(key)

    def abort(self, key: Any) -> None:
        with self._guard:
            self._inflight.discard(key)
