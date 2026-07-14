# Same-Store Sales (SSS) Growth YoY

**Metric ID:** `same_store_yoy`
**Source code:** `evolve-api/utils/sss.py`, `evolve-api/utils/store_dates.py`
**Exposed by:** `/api/mtd-kpi-header` (field `same_store_yoy`)
**Displayed on:** Overview → Financial group ("SSS Growth YoY %")
**Basis:** Cash (`sales_collected_exc_tax`, cash tenders only)
**Last verified:** 2026-07-14 (data through 2026-07-13)
**Rule change:** 2026-07-14 — same-store cutoff switched from day-precise
(`month_start − 12 months`) to **calendar-month** (last day of the prior-year
reporting month). Live % figures below predate this and need re-verification.

---

## 1. What this metric measures

Same-Store Sales Growth Year-over-Year answers one question:

> "Ignoring the effect of opening new locations, is our *existing* business growing or shrinking compared to a year ago?"

This is one of the most important metrics in any multi-location retail/service
business. Total company revenue almost always rises simply because you keep
opening stores — that growth is real, but it hides whether the **established**
locations are healthy. A chain can post "+15% total revenue" while every mature
location is actually declining; the new stores paper over it.

SSS removes that distortion by comparing **only the locations that existed in
*both* periods**. If same-store sales are flat or negative while total sales are
up, it tells leadership: *"Our growth is coming from new store openings, not from
the core business getting stronger."*

---

## 2. Formula

```
SSS YoY % = (Current-year MTD sales − Prior-year same-period sales)
            ─────────────────────────────────────────────────────  × 100
                     Prior-year same-period sales
```

...summed **only over same-store locations**.

Three design decisions make this correct:

| Element | What it does | Why it matters |
|---|---|---|
| **Month-to-date (MTD)** | Counts month start → latest day with data | Mid-month, you can't compare a partial month to a full one |
| **Same *elapsed* window last year** | Prior period = same day-of-month range, one year earlier | Apples-to-apples: 13 days vs 13 days, not 13 vs 31 |
| **Same-store filter** | Only locations open in *both* windows | Removes the new-store distortion |

---

## 3. How the code computes it

`_sss_growth_yoy(s, e, locations, latest_date)` in `utils/sss.py`:

1. `month_start` = first day of the selected month.
2. `latest_dt` = latest day that actually has cash data (passed in as `latest_date`,
   which the router resolves via `MAX(payment_date)`).
3. **Prior-year window** = `month_start − 1yr` through `latest_dt − 1yr`
   (`_shift_year`, which falls back ~365 days for Feb 29).
4. **Same-store cutoff** = **last day of the prior-year reporting month**
   (`py_start` advanced to its month end). Calendar-month rule: a location counts
   once it has been open ~12 calendar months as of the reporting month — i.e. it
   opened in the reporting month one year earlier, or any earlier month. So a
   store that opened mid-month a year ago (e.g. Jul 8, 2025) counts for the July
   2026 report, and is excluded in earlier months where it is < 12 months old.
5. Sum current-year cash per center (`_sum_by_center`) for `month_start … latest_date`.
6. Sum prior-year cash per center for `py_start … py_latest`.
7. `same_store` = `same_store_centers(cutoff, latest_date)` — see below.
8. Sum current & prior **only over same-store centers**, then apply the formula.
9. Returns `None` if the prior total is zero (avoids divide-by-zero). The whole
   function is wrapped so an error never takes down the KPI header — it just
   returns `None`.

### The same-store filter (`store_dates.py`)

A location qualifies as "same-store" for the reporting month only if:

1. It **opened on or before the last day of the prior-year reporting month**
   (calendar-month rule — see step 4 above), **and**
2. It is **not closed** on/before the current period end.

Open/close dates come from `evolve-api/data/store_dates.json` — real opening
dates, not a first-cash proxy.

---

## 4. Worked example (July 2026, data through Jul 13)

> ⚠️ **Rule changed 2026-07-14 to the calendar-month cutoff.** The dollar/percent
> figures in this section were computed under the *old* day-precise cutoff
> (`2025-07-01`, which excluded Bridgewater & Lancaster). Under the new rule those
> two stores are **included** for July 2026, so the same-store % below is stale and
> must be re-verified against live data. The store-eligibility table has been
> updated to the new rule.

### Which stores count (cutoff = last day of prior-year reporting month = 2025-07-31)

| Location | Open date | Same-store? | Reason |
|---|---|---|---|
| Hoboken, NJ | 2020-05-31 | ✅ | Open before cutoff |
| Jersey City, NJ | 2020-10-31 | ✅ | " |
| Montclair, NJ | 2021-01-31 | ✅ | " |
| Short Hills, NJ | 2021-04-30 | ✅ | " |
| Denville, NJ | 2021-07-31 | ✅ | " |
| Red Bank, NJ | 2021-12-31 | ✅ | " |
| Tribeca, NY | 2021-12-31 | ✅ | " |
| Bel Air, MD | 2022-03-31 | ✅ | " |
| Frederick, MD | 2022-03-31 | ✅ | " |
| Ridgewood, NJ | 2022-05-31 | ✅ | " |
| Waldorf, MD | 2024-07-31 | ✅ | Open ~1yr before cutoff |
| Old Bridge, NJ | 2024-09-30 | ✅ | Open before cutoff |
| **Bridgewater, NJ** | **2025-07-08** | ✅ | Opened in Jul 2025 → 12 months as of Jul 2026 |
| **Lancaster, PA** | **2025-07-11** | ✅ | Opened in Jul 2025 → 12 months as of Jul 2026 |
| Scarsdale, NY | closed 2025-06-30 | ❌ | Closed before the period |
| Corporate Center | (not a real store) | ❌ | Not in store_dates.json |

**14 stores qualify** for July 2026 under the calendar-month rule (was 12 under
the old day-precise rule).

### Caveat: the mid-month partial prior-year window

Bridgewater opened **Jul 8, 2025** and Lancaster **Jul 11, 2025**, so in the
prior-year comparison window (**Jul 1–13, 2025**) they had only ~2–5 ramp-up days
of near-zero sales, versus a full 13 days this year. Including them (per the
chosen calendar-month rule) therefore inflates July 2026's same-store YoY upward
this month; the distortion disappears from August 2026 onward, when the
prior-year window is a full month for both stores. This is a known, accepted
trade-off of the calendar-month definition.

In earlier reporting months (e.g. May 2026) both stores are **< 12 months old**
and correctly excluded — same-store there is the 12 mature locations only.

Their revenue still appears in the **headline Cash Sales figure** — it's just
correctly kept out of the same-store comparison.

---

## 5. Correctness audit (2026-07-14)

- ✅ **Like-for-like window.** Current ends on `latest_date` (Jul 13, 2026);
  prior ends on `latest_date − 1yr` (Jul 13, 2025). Both 13 days. Does *not*
  compare a partial month to a full prior month (the most common SSS bug).
- ✅ **Same-store set matches the calendar-month rule.** Cutoff = last day of the
  prior-year reporting month (`2025-07-31` for July 2026). Verified against
  `store_dates.json`: includes the 12 mature stores **plus** Bridgewater and
  Lancaster (opened Jul 2025 → 12 months as of Jul 2026); excludes Scarsdale
  (closed) and Corporate Center (not a store). In May 2026 the same check
  correctly drops Bridgewater/Lancaster as < 12 months old.
- ✅ **Consistent basis.** Same cash-tender filter and `sales_collected_exc_tax`
  field on both sides.
- ⚠️ **Mid-month partial-window distortion (July 2026 only).** Because
  Bridgewater/Lancaster opened mid-July 2025, including them per the calendar
  rule inflates July 2026 same-store YoY upward; it self-corrects from Aug 2026.
  See §4 caveat.

**Conclusion: metric follows the chosen calendar-month rule.** The headline % must
be re-verified live after this change.

---

## 6. Known limitation — weekday alignment

SSS compares the **same calendar dates** (Jul 1–13 both years) but does **not**
align days of the week:

- Jul 13, **2026** = Monday
- Jul 13, **2025** = Sunday

Because the two 13-day windows contain a slightly different mix of weekends vs.
weekdays, a point or so of the −2% can be **calendar noise** rather than a true
decline. This is inherent to same-calendar-date MTD YoY, is the standard
documented approach, and is **not a bug**. Interpret a small reading like −2% as
"roughly flat, possibly a touch soft," not "the business is collapsing."

A more advanced approach (out of scope for a headline KPI) would align the same
number of each weekday, or use a fiscal 4-4-5 calendar.

---

## 7. Bottom line for leadership

> Same-store sales compare only locations open at least ~12 calendar months.
> Bridgewater and Lancaster (opened July 2025) enter the same-store base in
> July 2026. Because they opened mid-July last year, July 2026's reading is
> flattered by their near-empty prior-year window; the comparison normalizes
> from August 2026 onward. Read July 2026 same-store as artificially high, and
> re-verify the live number after the rule change.
