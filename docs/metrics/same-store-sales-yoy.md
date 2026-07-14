# Same-Store Sales (SSS) Growth YoY

**Metric ID:** `same_store_yoy`
**Source code:** `evolve-api/utils/sss.py`, `evolve-api/utils/store_dates.py`
**Exposed by:** `/api/mtd-kpi-header` (field `same_store_yoy`)
**Displayed on:** Overview → Financial group ("SSS Growth YoY %")
**Basis:** Cash (`sales_collected_exc_tax`, cash tenders only)
**Last verified:** 2026-07-14 (data through 2026-07-13)

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
4. **Same-store cutoff** = prior-year month start (`py_start`).
5. Sum current-year cash per center (`_sum_by_center`) for `month_start … latest_date`.
6. Sum prior-year cash per center for `py_start … py_latest`.
7. `same_store` = `same_store_centers(cutoff, latest_date)` — see below.
8. Sum current & prior **only over same-store centers**, then apply the formula.
9. Returns `None` if the prior total is zero (avoids divide-by-zero). The whole
   function is wrapped so an error never takes down the KPI header — it just
   returns `None`.

### The same-store filter (`store_dates.py`)

A location qualifies as "same-store" for the reporting month only if:

1. It **opened on or before** the cutoff (`month_start − 12 months`), **and**
2. It is **not closed** on/before the current period end.

Open/close dates come from `evolve-api/data/store_dates.json` — real opening
dates, not a first-cash proxy.

---

## 4. Worked example (July 2026, data through Jul 13)

Verified live against production.

### Headline (ALL stores)
- Current MTD (Jul 1–13, 2026): **$454,237**
- Prior-year same window (Jul 1–13, 2025): **$453,925**
- Raw change: **+0.07%** → essentially flat

### Same-store only (the displayed metric)
- **−2.02%**

The company as a whole is flat YoY, but that "flat" is propped up by two
brand-new stores. Strip those out and the **mature 12-store base is down ~2%**.

### Which stores count (cutoff = 2025-07-01)

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
| **Bridgewater, NJ** | **2025-07-08** | ❌ | Opened *after* cutoff — brand new |
| **Lancaster, PA** | **2025-07-11** | ❌ | Opened *after* cutoff — brand new |
| Scarsdale, NY | closed 2025-06-30 | ❌ | Closed before the period |
| Corporate Center | (not a real store) | ❌ | Not in store_dates.json |

**12 stores qualify.** The two new stores are the entire cause of the effect.

### Why the two new stores create a "phantom" positive

- Bridgewater opened **Jul 8, 2025**; Lancaster opened **Jul 11, 2025**.
- The prior-year comparison window is **Jul 1–13, 2025**.

So in last year's window those stores existed for only ~2–5 days with essentially
zero sales. This year (Jul 1–13, 2026) they're fully operational. Including them
would divide "a mature store's 13 days" by "≈$0 last year" → a fake, enormous
YoY number. Correctly **excluding** them reveals the truth: the 12 established
stores generated ~2% less cash in the first 13 days of July 2026 than in the same
13 days of 2025.

Their revenue still appears in the **headline Cash Sales figure** — it's just
correctly kept out of the same-store comparison.

---

## 5. Correctness audit (2026-07-14)

- ✅ **Like-for-like window.** Current ends on `latest_date` (Jul 13, 2026);
  prior ends on `latest_date − 1yr` (Jul 13, 2025). Both 13 days. Does *not*
  compare a partial month to a full prior month (the most common SSS bug).
- ✅ **Same-store set is right.** Filter logic in `store_dates.py` verified
  against `store_dates.json`: includes the 12 mature stores, excludes the 2 new
  ones, the 1 closed one, and Corporate Center.
- ✅ **Consistent basis.** Same cash-tender filter and `sales_collected_exc_tax`
  field on both sides.
- ✅ **Sign sanity-check.** All-store raw (+0.07%) vs same-store (−2.02%) diverge
  in exactly the direction expected when new stores add excluded revenue.

**Conclusion: the metric is correct and should be negative.** No code change needed.

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

> Total revenue is flat year-over-year, but only because two new stores
> (Bridgewater, Lancaster) opened last July. Our 12 established locations are
> running about 2% behind last year on a like-for-like basis — worth watching,
> though some of it may be weekday-mix timing.
