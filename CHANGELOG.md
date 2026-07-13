# Changelog

All notable changes to the Evolve dashboard & API are recorded here.

## 2026-07-13

Theme of the day: move stale, file-based metrics onto **live BRONZE warehouse tables**,
reconcile **Membership Adoption** across the header and per-location tables, add a new
**Existing Members** metric, and apply dashboard formatting fixes — all reflected in
`Evolve_Dashboard_Metric_Computations.docx`.

Commits: `bb75b04`, `c1539f1`, `57fa4a8`, `c8da839`, `f00b9ce`, `59813d7`, `bd24fee`, `5d9588c`.

### New Customer Visits & Existing Customer Visits — live DB table + temporary CSV override
- **Problem:** New Customer Visits was frozen in July. It read `data/new_guests_daily.json`
  (rebuilt by hand from CSVs); the Jul 3–9 CSVs were never re-imported, so it stuck at
  Jul 1–2 (= 32).
- Migrated **New** to the live warehouse `dbo.BRONZE_ZENOTI_BUSINESS_KPI` —
  `SUM(new_guest_count)` over `business_kpi_date` in range (same pattern as Rebook Rate).
- **Existing** first became `Total distinct customers − New` (returning-only partition),
  then was changed to `SUM(unique_guest_count)` from the same table to match the tooltip
  definition. Both are now served by a single `guest_counts()` → `{new, existing}` helper.
- Added a **temporary CSV override**: when `data/business_kpi_override_<YYYY-MM>.csv` exists
  for the request's report month, it fully replaces the DB query
  (`New = SUM("New Guest Count")`, `Existing = SUM("Unique Guest count")`, location-filtered).
  Override files added for **2026-06** and **2026-07** while the warehouse Business KPI values
  are being corrected. Delete a month's file to revert that month to the live DB.
- **Current source of truth:** month-override CSV (if present) → else live
  `BRONZE_ZENOTI_BUSINESS_KPI` → else the computed sales-accrual/cash fallback.
- Files: `evolve-api/utils/new_guests.py`, `evolve-api/routers/mtd.py`,
  `evolve-api/data/business_kpi_override_2026-06.csv`,
  `evolve-api/data/business_kpi_override_2026-07.csv`.

### Existing Members — new metric
- Added `existing_members()` = `COUNT(DISTINCT guest_code)` with a membership sale this month
  (new sign-ups **and** recurring auto-bills) from `dbo.BRONZE_ZENOTI_MEMBERSHIPS_SALES`.
- Wired into the parallel KPI loader and exposed as `result["existing_members"]` in
  `/api/mtd-kpi-header`. Not yet surfaced as a dashboard tile (Memberships view is still
  Coming Soon). New Members is a subset (`sale_type='Sale'`).
- Files: `evolve-api/utils/memberships.py`, `evolve-api/routers/mtd.py`.

### Membership Adoption (per-location) — reconciled to the memberships-sales source
- **Problem:** the header tile used `BRONZE_ZENOTI_MEMBERSHIPS_SALES`, but the per-location
  "Mbr Adopt" column used a cash proxy (`item_category='Memberships'`), so they didn't tie out.
- Added a `membership_new` CTE that pulls per-`sale_center` new memberships from
  `BRONZE_ZENOTI_MEMBERSHIPS_SALES` with the **same rule as the header** (`sale_type='Sale'`,
  created in `[s,e]` **and** starting this month); `new_members` and `membership_adoption`
  now derive from it via `LEFT JOIN`. Fixed the SQL parameter ordering for the new CTE.
- Denominator caveat (pre-existing, unchanged): per-location uses `DISTINCT guest_code`
  where `member='no'` while the header uses `DISTINCT guest_name` — so location rows still
  won't sum *exactly* to the header.
- Files: `evolve-api/routers/mtd.py`, `evolve-api/config.py`.

### MTD Ad Spend / CAC — refreshed, then migrated live
- Refreshed the stale workbook from the latest export (coverage Jul 3 → Jul 9):
  July MTD went **$11,737 → $36,824.53** (Google $11,991.03 + Facebook $24,833.50).
- Then **migrated off Excel entirely** to the live warehouse tables
  `dbo.BRONZE_ZENOTI_GOOGLE_ADS` + `dbo.BRONZE_ZENOTI_FB_ADS` —
  `SUM(amount_spend)` over `report_date` in range. No more manual workbook refresh.
- CAC (MTD Ad Spend ÷ New Customer Visits) follows automatically.
- Files: `evolve-api/utils/ad_spend.py`, `evolve-api/config.py`,
  `evolve-api/data/Google Ads.xlsx`, `evolve-api/data/ad_spend_daily.json`.

### Dashboard UI
- **Sales-to-Budget** stat readouts — removed cents from **Cash Sales MTD**, **Budget (MTD)**,
  and **Projected (Run Rate)** (whole dollars).
- **Location Performance tables** — centered all headers and values (header row, body cells,
  and total row).
- **MoM deltas** — `prevMonthRange` now takes `latestDate` so the prior-month comparison is
  like-for-like (partial-month vs partial-month) across every tile.
- File: `evolve-dashboard.jsx`.

### Documentation
- Updated `Evolve_Dashboard_Metric_Computations.docx`: revised the New Customer Visits,
  Existing Customer Visits, MTD Ad Spend, and CAC sections (formula + table + status note)
  with the new sources and real July ad-spend example values; added a new **Existing Members**
  section; appended "Fixes applied" bullets.

### Also committed today (outside the metric work, bundled in `bb75b04`)
- Run-rate / operating-days work: `VERIFY_RUNRATE_2026-07.sql`, an Operating Schedule CSV,
  `evolve-api/data/operating_days.json`, `evolve-api/scripts/build_operating_days_json.py`.
