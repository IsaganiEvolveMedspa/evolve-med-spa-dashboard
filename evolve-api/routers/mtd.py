import calendar
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import date, datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Query, Request

from config import FULL_SALES, FULL_CASH, FULL_SCHEDULE, FULL_APPT
from db import run_query, serialize_rows
from utils.filters import build_date_filter, build_sched_filter, merge_params, loc_in, hhmm_to_hours
from utils.cogs import fetch_cogs_and_accrual, cogs_margin_pct
from utils.ad_spend import mtd_ad_spend, client_acquisition_cost
from utils.payroll import compute_salary_by_center, salary_margin_pct
from utils.operating_days import cash_run_rate, recognized_run_rate
from utils.sss import sss_growth_yoy
from utils.new_customers import new_existing_visits
from utils.memberships import new_memberships
from utils.errors import log_and_raise_from_request

router = APIRouter()

# Cash collections payment-type filter: restrict to recognized collection types.
#
# The payment_type column stores a comma-separated string of ALL payment methods
# used on a single invoice (e.g. " Card, Custom - Aspire, Gift Card(12345)").
# The FIRST value in the list determines whether the row should be counted —
# matching the UI filter which INCLUDES Cash, Card, Check, Custom-Financial,
# Custom-Non-Financial and EXCLUDES rows that start with:
#   Gift Cards, Prepaid Cards, Packages, Memberships, Loyalty Points, Cashback.
#
# NOTE: payment_type values have a leading space (e.g. " Card", " Gift Card(...)").
# LTRIM() is required so the LIKE patterns match correctly against the actual data.
# All valid rows start with: 'card', 'cash', 'check', or 'custom - *'.
# Excluded rows start with:  'gift card', 'prepaid card', 'package - ', 'membership - '.
_CASH_PAY_FILTER = (
    "AND LOWER(LTRIM(payment_type)) NOT LIKE 'gift card%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'prepaid card%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'package -%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'membership -%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'loyalty%'"
    " AND LOWER(LTRIM(payment_type)) NOT LIKE 'cashback%'"
)

# ── Shared sales-mix SELECT fragment ─────────────────────────────────────────
_MIX_COLS = """
    SUM(CASE WHEN item_category = 'Body Contouring'
              OR item_sub_category = 'Body Contouring'     THEN sales_exc_tax ELSE 0 END)  AS body_contouring,
    SUM(CASE WHEN item_category = 'Facials'                THEN sales_exc_tax ELSE 0 END)  AS facials,
    SUM(CASE WHEN item_sub_category = 'Filler'             THEN sales_exc_tax ELSE 0 END)  AS filler,
    SUM(CASE WHEN item_category = 'Laser Hair Removal'
              OR item_sub_category = 'Laser Hair Removal'  THEN sales_exc_tax ELSE 0 END)  AS laser_hair_removal,
    SUM(CASE WHEN item_category = 'Memberships'            THEN sales_exc_tax ELSE 0 END)  AS memberships,
    SUM(CASE WHEN item_sub_category = 'Toxin'              THEN sales_exc_tax ELSE 0 END)  AS neurotoxins,
    SUM(CASE WHEN
            item_category NOT IN (
                'Facials','Memberships','Injectables','Skin Rejuvenation',
                'Retail','Laser Hair Removal','Body Contouring'
            )
            AND item_sub_category NOT IN (
                'Body Contouring','Filler','Laser Hair Removal',
                'Toxin','Other Injectables','PRF'
            )
         THEN sales_exc_tax ELSE 0 END)                                                    AS other,
    SUM(CASE WHEN item_sub_category = 'Other Injectables'  THEN sales_exc_tax ELSE 0 END)  AS other_injectables,
    SUM(CASE WHEN item_sub_category = 'PRF'                THEN sales_exc_tax ELSE 0 END)  AS prf,
    SUM(CASE WHEN item_category = 'Retail'                 THEN sales_exc_tax ELSE 0 END)  AS retail,
    SUM(CASE WHEN item_category = 'Skin Rejuvenation'      THEN sales_exc_tax ELSE 0 END)  AS skin_rejuvenation,
    SUM(sales_exc_tax)                                                                      AS total
"""

# Budget lookup as a SQL Server VALUES table
_BUDGET_VALUES = """(VALUES
    ('Bel Air, MD',      167500.0),
    ('Bridgewater, NJ',   50000.0),
    ('Denville, NJ',     165000.0),
    ('Frederick, MD',    147500.0),
    ('Hoboken, NJ',      267500.0),
    ('Jersey City, NJ',  250000.0),
    ('Lancaster, PA',     50000.0),
    ('Montclair, NJ',    192500.0),
    ('Old Bridge, NJ',    97500.0),
    ('Red Bank, NJ',     160000.0),
    ('Ridgewood, NJ',    150000.0),
    ('Short Hills, NJ',  167500.0),
    ('Tribeca, NY',       50000.0),
    ('Waldorf, MD',       35000.0)
) AS budget_lookup(location, monthly_budget)"""

# Same budget figures as a Python dict, so the header can compute a
# location-aware budget without a parameterized SQL round-trip.
_BUDGET_BY_LOCATION = {
    'Bel Air, MD':     167500.0,
    'Bridgewater, NJ':  50000.0,
    'Denville, NJ':    165000.0,
    'Frederick, MD':   147500.0,
    'Hoboken, NJ':     267500.0,
    'Jersey City, NJ': 250000.0,
    'Lancaster, PA':    50000.0,
    'Montclair, NJ':   192500.0,
    'Old Bridge, NJ':   97500.0,
    'Red Bank, NJ':    160000.0,
    'Ridgewood, NJ':   150000.0,
    'Short Hills, NJ': 167500.0,
    'Tribeca, NY':      50000.0,
    'Waldorf, MD':      35000.0,
}



@router.get("/api/mtd-kpi-header")
def get_mtd_kpi_header(
    request:    Request,
    start_date: Optional[str]       = Query(None),
    end_date:   Optional[str]       = Query(None),
    locations:  Optional[List[str]] = Query(None),
    debug:      Optional[str]       = Query(None),
):
    """Single-row KPI banner shown on every tab."""
    try:
        if not end_date:
            r = run_query(f"SELECT MAX(CAST(payment_date AS DATE)) AS d FROM {FULL_CASH}")
            end_date = str(r[0]["d"]) if r and r[0].get("d") else str(datetime.utcnow().date())
        e = end_date
        e_dt_tmp = datetime.strptime(e, "%Y-%m-%d").date()
        s = start_date or str(e_dt_tmp.replace(day=1))

        where, params = build_date_filter(s, e, locations, date_col="payment_date")
        where_sales, params_sales = build_date_filter(s, e, locations, date_col="sale_date")
        e_dt      = datetime.strptime(e, "%Y-%m-%d").date()
        s_dt      = datetime.strptime(s, "%Y-%m-%d").date()

        # "Prior Day Sales" = the most recent day that actually has cash data at or
        # before end_date (for the selected locations) — NOT end_date - 1. Cash data
        # lags the calendar, so anchoring to end_date - 1 returns $0 whenever the
        # selected range runs ahead of the loaded data (e.g. end_date=month-end but
        # data only through the 22nd). Resolve the real latest data day instead.
        y_loc_pre, y_loc_pre_p = loc_in(locations)
        last_cash_sql = f"""
        SELECT MAX(CAST(payment_date AS DATE)) AS d
        FROM {FULL_CASH}
        WHERE CAST(payment_date AS DATE) <= '{e}'
        {y_loc_pre}
        {_CASH_PAY_FILTER}
        """
        _lc = run_query(last_cash_sql, y_loc_pre_p or None)
        yesterday = (
            str(_lc[0]["d"]) if _lc and _lc[0].get("d")
            else str(e_dt - timedelta(days=1))
        )

        # Prior Day Sales is NET SALES (accrual), so resolve its "prior day" from the
        # latest closed SALE day (sale_date), not the latest cash day.
        last_sale_sql = f"""
        SELECT MAX(CAST(sale_date AS DATE)) AS d
        FROM {FULL_SALES}
        WHERE CAST(sale_date AS DATE) <= '{e}'
          AND LOWER(status) = 'closed'
        {y_loc_pre}
        """
        _ls = run_query(last_sale_sql, y_loc_pre_p or None)
        last_sale_day = (
            str(_ls[0]["d"]) if _ls and _ls[0].get("d") else yesterday
        )

        lm_end_dt   = e_dt.replace(day=1) - timedelta(days=1)
        lm_start_dt = lm_end_dt.replace(day=1)

        # Prior-year window must cover the SAME elapsed days as the (partial) current
        # month. Anchoring py_end to e_dt (often month-end) compares a partial current
        # month against a FULL prior-year month, biasing YoY negative. Anchor instead to
        # `yesterday` — the latest day that actually has current cash data.
        _lc_dt = datetime.strptime(yesterday, "%Y-%m-%d").date()
        try:
            py_start = str(s_dt.replace(year=s_dt.year - 1))
            py_end   = str(_lc_dt.replace(year=_lc_dt.year - 1))
        except ValueError:
            py_start = str(s_dt - timedelta(days=365))
            py_end   = str(_lc_dt - timedelta(days=365))

        sched_block, sched_x = build_sched_filter(s, e, locations)
        appt_loc, appt_loc_p = loc_in(locations)
        y_loc,    y_loc_p    = loc_in(locations)

        # Location-aware monthly budget (was hardcoded 1,950,000 — wrong under any
        # location filter). Sum the per-location budget dict for selected centers.
        # Computed in Python (no SQL placeholders) to avoid any param-binding risk.
        if locations:
            monthly_budget_val = float(sum(_BUDGET_BY_LOCATION.get(l, 0.0) for l in locations))
        else:
            monthly_budget_val = float(sum(_BUDGET_BY_LOCATION.values()))

        sql = f"""
        WITH guest_classification AS (
            -- One row per guest_name: is_new=1 if ANY row in period has first_visit='yes'.
            -- Ensures new+existing always partitions total exactly (no double-count).
            SELECT
                guest_name,
                MAX(CASE WHEN LOWER(first_visit) = 'yes' THEN 1 ELSE 0 END) AS is_new
            FROM {FULL_CASH}
            {where}
            {_CASH_PAY_FILTER}
            GROUP BY guest_name
        ),
        mtd AS (
            SELECT
                SUM(c.sales_collected_exc_tax)                                                                AS mtd_revenue,
                SUM(c.sales_collected_exc_tax) * 1.0
                    / NULLIF(COUNT(DISTINCT CAST(c.payment_date AS DATE)), 0)                                 AS avg_daily_revenue,
                COUNT(DISTINCT CASE WHEN c.sales_collected_exc_tax > 0
                                     THEN CONCAT(c.guest_name, '|', CAST(c.payment_date AS DATE)) END)        AS total_customer_visits,
                COUNT(DISTINCT CASE WHEN gc.is_new = 1 THEN c.guest_name END)                                 AS new_client_count,
                COUNT(DISTINCT CASE WHEN gc.is_new = 0 THEN c.guest_name END)                                 AS existing_client_count,
                COUNT(DISTINCT CASE WHEN LOWER(c.member) = 'yes'        THEN c.guest_name END)                AS member_count,
                COUNT(DISTINCT CASE WHEN LOWER(c.member) = 'no'         THEN c.guest_name END)                AS non_member_count,
                COUNT(DISTINCT CASE WHEN c.item_category = 'Memberships' THEN c.guest_name END)               AS new_members,
                -- New Customer Visits (cash basis): first-visit guests whose purchase this
                -- month is NOT a membership (a guest whose only purchase is a membership is
                -- not counted as a new service visit). Replaces the slow Bi_FactCollections
                -- first-ever scan with the already-scanned, always-current cash data.
                COUNT(DISTINCT CASE WHEN gc.is_new = 1 AND c.item_category != 'Memberships'
                                     THEN c.guest_name END)                                                   AS new_visits,
                -- Membership Adoption Rate = New Memberships / Non-Member unique guests * 100.
                -- Denominator uses the `member` flag (non-members only), per KPI spec —
                -- NOT all guests. NOTE: spec's true numerator is memberships *created*
                -- this month from Bi_DimMembershipUser_s3 (Creation Date = Start Date in
                -- month); this cash-derived count is a proxy until that table is wired.
                COUNT(DISTINCT CASE WHEN c.item_category = 'Memberships' THEN c.guest_name END) * 1.0
                    / NULLIF(COUNT(DISTINCT CASE WHEN LOWER(c.member) = 'no'
                                                  THEN c.guest_name END), 0) * 100                             AS membership_adoption_rate,
                SUM(CASE WHEN c.item_category != 'Memberships' THEN c.sales_collected_exc_tax ELSE 0 END) * 1.0
                    / NULLIF(COUNT(DISTINCT CASE WHEN c.item_category != 'Memberships'
                                                  AND c.sales_collected_exc_tax > 0
                                                  THEN CONCAT(c.guest_name, '|', CAST(c.payment_date AS DATE)) END), 0)
                                                                                                              AS blended_asp,
                -- ASP = cash sales / visits (unique guest_name per day, invoice value > 0)
                SUM(CASE WHEN gc.is_new = 1 AND c.item_category != 'Memberships'
                          THEN c.sales_collected_exc_tax ELSE 0 END) * 1.0
                    / NULLIF(COUNT(DISTINCT CASE WHEN gc.is_new = 1 AND c.item_category != 'Memberships'
                                                  AND c.sales_collected_exc_tax > 0
                                                  THEN CONCAT(c.guest_name, '|', CAST(c.payment_date AS DATE)) END), 0)
                                                                                                              AS asp_new_clients,
                SUM(CASE WHEN gc.is_new = 0 AND c.item_category != 'Memberships'
                          THEN c.sales_collected_exc_tax ELSE 0 END) * 1.0
                    / NULLIF(COUNT(DISTINCT CASE WHEN gc.is_new = 0 AND c.item_category != 'Memberships'
                                                  AND c.sales_collected_exc_tax > 0
                                                  THEN CONCAT(c.guest_name, '|', CAST(c.payment_date AS DATE)) END), 0)
                                                                                                              AS asp_existing_clients
            FROM {FULL_CASH} c
            JOIN guest_classification gc ON gc.guest_name = c.guest_name
            {where}
            {_CASH_PAY_FILTER}
        ),
        yesterday_data AS (
            -- Prior Day Sales = NET SALES (accrual, closed) on the latest sale day.
            SELECT
                COALESCE(SUM(CASE WHEN LOWER(status) = 'closed' THEN sales_exc_tax ELSE 0 END), 0)  AS yesterday_revenue,
                COALESCE(COUNT(DISTINCT CASE WHEN LOWER(status) = 'closed' THEN guest_name END), 0) AS yesterday_clients
            FROM {FULL_SALES}
            WHERE CAST(sale_date AS DATE) = '{last_sale_day}'
            {y_loc}
        ),
        last_month_data AS (
            SELECT
                COALESCE(SUM(sales_collected_exc_tax), 0)  AS last_month_revenue,
                COALESCE(COUNT(DISTINCT guest_name), 0)    AS last_month_clients
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) BETWEEN '{lm_start_dt}' AND '{lm_end_dt}'
            {y_loc}
            {_CASH_PAY_FILTER}
        ),
        prior_year AS (
            SELECT COALESCE(SUM(sales_collected_exc_tax), 0) AS py_revenue
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) >= '{py_start}'
              AND CAST(payment_date AS DATE) <= '{py_end}'
            {y_loc}
            {_CASH_PAY_FILTER}
        ),
        schedule_util AS (
            SELECT
                LOWER(job_name)                                                                     AS role,
                SUM({hhmm_to_hours('booked_hours')}) * 1.0
                    / NULLIF(SUM({hhmm_to_hours('scheduled_hours')} - {hhmm_to_hours('block_out_hours_paid')}), 0) * 100      AS utilization_pct
            FROM {FULL_SCHEDULE}
            {sched_block}
            GROUP BY job_name
        ),
        provider_rev AS (
            -- Pre-aggregate schedule and accrual sales to (center, employee, day) grain
            -- before joining to avoid fan-out multiplying booked_hours per sales row.
            SELECT
                SUM(CASE WHEN sch.job_name = 'Treatment Provider' THEN COALESCE(sa.daily_revenue, 0) ELSE 0 END) * 1.0
                    / NULLIF(SUM(CASE WHEN sch.job_name = 'Treatment Provider' THEN sch.booked_hours ELSE 0 END), 0)
                    AS rev_per_provider_hr,
                SUM(CASE WHEN sch.job_name = 'Esthetician' THEN COALESCE(sa.daily_revenue, 0) ELSE 0 END) * 1.0
                    / NULLIF(SUM(CASE WHEN sch.job_name = 'Esthetician' THEN sch.booked_hours ELSE 0 END), 0)
                    AS rev_per_esthetician_hr
            FROM (
                SELECT
                    center_name,
                    employee_name,
                    job_name,
                    CAST(date AS DATE)                   AS work_date,
                    SUM({hhmm_to_hours('booked_hours')}) AS booked_hours
                FROM {FULL_SCHEDULE}
                {sched_block}
                GROUP BY center_name, employee_name, job_name, CAST(date AS DATE)
            ) sch
            LEFT JOIN (
                SELECT
                    center_name,
                    serviced_by,
                    CAST(sale_date AS DATE) AS sale_date,
                    SUM(sales_exc_tax) AS daily_revenue
                FROM {FULL_SALES}
                {where_sales}
                GROUP BY center_name, serviced_by, CAST(sale_date AS DATE)
            ) sa
              ON sa.serviced_by  = sch.employee_name
             AND sa.sale_date    = sch.work_date
             AND sa.center_name  = sch.center_name
        ),
        rebooking AS (
            SELECT
                COUNT(DISTINCT CASE WHEN LOWER(rebooked) = 'yes' THEN invoice_no END) * 1.0
                    / NULLIF(COUNT(DISTINCT invoice_no), 0) * 100 AS rebooking_rate
            FROM {FULL_APPT}
            WHERE CAST(appointment_date AS DATE) BETWEEN '{s}' AND '{e}'
              AND LOWER(status) = 'closed'
              AND add_on = 'No'
              {appt_loc}
        )
        SELECT
            m.mtd_revenue,
            m.avg_daily_revenue,
            m.total_customer_visits,
            m.new_client_count,
            m.existing_client_count,
            m.member_count,
            m.non_member_count,
            m.new_members,
            m.new_visits,
            m.membership_adoption_rate,
            m.blended_asp,
            m.asp_new_clients,
            m.asp_existing_clients,
            y.yesterday_revenue,
            y.yesterday_clients,
            lm.last_month_revenue,
            lm.last_month_clients,
            p.py_revenue,
            (m.mtd_revenue - p.py_revenue) * 1.0 / NULLIF(p.py_revenue, 0) * 100 AS same_store_yoy,
            (SELECT TOP 1 utilization_pct FROM schedule_util WHERE role = 'treatment provider') AS provider_utilization,
            (SELECT TOP 1 utilization_pct FROM schedule_util WHERE role = 'esthetician')        AS esthetician_utilization,
            pv.rev_per_provider_hr    AS rev_per_provider,
            pv.rev_per_esthetician_hr AS rev_per_esthetician,
            ROUND((1 - 0.20 - 0.22 * 1.12) * 100, 1)                                          AS gross_margin_pct,
            {monthly_budget_val}                                                                  AS monthly_budget,
            rb.rebooking_rate
        FROM mtd m
        CROSS JOIN yesterday_data  y
        CROSS JOIN last_month_data lm
        CROSS JOIN prior_year      p
        CROSS JOIN provider_rev    pv
        CROSS JOIN rebooking       rb
        """
        # params order: guest_classification where, mtd where, yesterday_data y_loc,
        # last_month_data y_loc, prior_year y_loc, sched_block (schedule_util),
        # sched_block (provider_rev sch), where_sales (provider_rev accrual sales), appt_loc.
        # NOTE: sched_block appears TWICE (schedule_util + provider_rev) → sched_x twice.
        all_params = merge_params(params, params, y_loc_p, y_loc_p, y_loc_p, sched_x, sched_x, params_sales, appt_loc_p)

        # The main KPI query and the enrichment helpers are independent (each runs its
        # own pooled DB connection and depends only on s/e/locations + the already-
        # resolved yesterday/last_sale_day). Run them concurrently — sequential execution
        # made the header ~27s and tripped the Railway gateway (502s). Parallel, the header
        # is bounded by the single slowest query. mtd_ad_spend is file-based (no DB) so it
        # stays inline. new_members / new_visits now come from the main cash query itself
        # (no separate Bi_* warehouse scans), so there are no slow helpers left to cap.
        # Per-step wall-clock timings (each thread writes its own distinct key — atomic in
        # CPython) are returned under "_timings" only when ?debug is set.
        timings: dict[str, float] = {}

        def timed(label, fn):
            def wrapper(*a, **k):
                t0 = time.perf_counter()
                try:
                    return fn(*a, **k)
                finally:
                    timings[label] = round(time.perf_counter() - t0, 2)
            return wrapper

        # new_visits / existing have two sources: the main cash query computes fast
        # values (m.new_visits, m.existing_client_count) that are always available, and
        # new_existing_visits() computes the authoritative "first-ever sale date per
        # guest_name (non-membership)" off BRONZE_ZENOTI_SALES_ACCRUAL. The latter can be
        # heavy on a cold table, so we wait at most SLOW_CAP for it and otherwise keep the
        # cash values (its cache fills in the background). shutdown(wait=False) so a slow
        # straggler never blocks the response.
        SLOW_CAP = 12.0   # only the FIRST (cold) sales-accrual scan can hit this;
                          # stale-while-revalidate serves cached values instantly after.
        t_all = time.perf_counter()
        pool = ThreadPoolExecutor(max_workers=8)
        try:
            f_main     = pool.submit(timed("main_sql", run_query), sql, all_params or None)
            f_cogs     = pool.submit(timed("cogs", fetch_cogs_and_accrual), s, e, locations)
            f_salary   = pool.submit(timed("salary", compute_salary_by_center), s, e, locations)
            f_cash_rr  = pool.submit(timed("cash_run_rate", cash_run_rate), s, e, locations, yesterday)
            f_recog_rr = pool.submit(timed("recog_run_rate", recognized_run_rate), s, e, locations, last_sale_day)
            f_sss      = pool.submit(timed("sss", sss_growth_yoy), s, e, locations, yesterday)
            f_visits   = pool.submit(timed("new_existing", new_existing_visits), s, e, locations)
            f_memb     = pool.submit(timed("memberships", new_memberships), s, e, locations)

            rows            = f_main.result()
            cm              = f_cogs.result()
            sal             = f_salary.result()
            result_cash_rr  = f_cash_rr.result()
            result_recog_rr = f_recog_rr.result()
            result_sss      = f_sss.result()
            new_memb        = f_memb.result()
            try:
                result_visits = f_visits.result(timeout=max(0.1, SLOW_CAP - (time.perf_counter() - t_all)))
            except FuturesTimeout:
                result_visits = None       # keep the cash fallback; cache fills in background
        finally:
            pool.shutdown(wait=False)
        timings["_parallel_wall"] = round(time.perf_counter() - t_all, 2)

        result = rows[0] if rows else {}
        # COGS Margin % = total cost_of_goods / sales accrual, aggregated over selected centers.
        tot_cogs    = sum(v.get("cogs", 0)    for v in cm.values())
        tot_accrual = sum(v.get("accrual", 0) for v in cm.values())
        cogs_m = cogs_margin_pct(tot_cogs, tot_accrual)
        result["cogs_margin_pct"] = cogs_m
        # Real payroll/salary margin (salary model) replaces the modeled 24.64%.
        tot_salary = sum(v["salary"]        for v in sal.values())
        tot_sales  = sum(v["sales_accrual"] for v in sal.values())
        payroll_m  = salary_margin_pct(tot_salary, tot_sales)
        result["payroll_margin_pct"] = payroll_m
        # Gross margin % = 100 − real COGS margin % − real payroll margin %.
        result["gross_margin_pct"] = (100 - (cogs_m or 0) - (payroll_m or 0)) if tot_sales else None
        # Membership Adoption = New Memberships / Non-Member unique guests * 100.
        #   New Memberships = memberships CREATED this month AND STARTING this month, from
        #     Bi_DimMembershipUser_s3 (COUNT DISTINCT UserMembershipId, IsDeleted=0).
        #   Non-Members     = distinct cash guests with the `member` flag = 'no'.
        # Reads 0 if Bi_DimMembershipUser_s3 has no current-month rows (data-freshness gap).
        non_member = result.get("non_member_count") or 0
        result["new_members"] = new_memb
        result["membership_adoption_rate"] = (new_memb / non_member * 100) if non_member else None
        # Cash Sales run rate = Σ_loc (MTD cash / working days elapsed) × total working days.
        result["cash_run_rate"] = result_cash_rr
        # Recognized Revenue run rate — same working-days projection on recognized revenue.
        result["recognized_run_rate"] = result_recog_rr
        # SSS Growth YoY % = projected run rate vs prior-year same month, same-store only.
        result["same_store_yoy"] = result_sss
        # New / Existing Customer Visits from BRONZE_ZENOTI_SALES_ACCRUAL (first-ever sale
        # date per guest_name, non-membership first purchase): new = first sale this month,
        # existing = first sale before this month + a sale this month. If the scan didn't
        # finish within the cap, fall back to the cash values (m.new_visits / m.existing).
        if result_visits is not None:
            result["new_visits"]            = result_visits.get("new")
            result["existing_client_count"] = result_visits.get("existing")
            # ASP New/Existing on the SAME sales-accrual segmentation (per customer):
            # segment non-membership MTD sales / segment customer count.
            if result_visits.get("asp_new") is not None:
                result["asp_new_clients"] = result_visits.get("asp_new")
            if result_visits.get("asp_existing") is not None:
                result["asp_existing_clients"] = result_visits.get("asp_existing")
        # MTD Ad Spend (chain-level, from bundled Google/FB ad export) + CAC = ad spend / new visits.
        result["mtd_ad_spend"] = mtd_ad_spend(s, e)
        result["client_acquisition_cost"] = client_acquisition_cost(
            result.get("mtd_ad_spend"), result.get("new_visits") or result.get("new_client_count"))
        if debug:
            result["_timings"] = timings
        return result

    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/mtd-summary")
def get_mtd_summary(
    request:    Request,
    start_date: Optional[str]       = Query(None),
    end_date:   Optional[str]       = Query(None),
    locations:  Optional[List[str]] = Query(None),
):
    """Per-location MTD revenue vs prior week / prior month / prior year + membership stats."""
    try:
        if not end_date:
            r = run_query(f"SELECT MAX(CAST(payment_date AS DATE)) AS d FROM {FULL_CASH}")
            end_date = str(r[0]["d"]) if r and r[0].get("d") else str(datetime.utcnow().date())
        e = end_date
        e_dt_fix = datetime.strptime(e, "%Y-%m-%d").date()
        s = start_date or str(e_dt_fix.replace(day=1))

        end_dt   = datetime.strptime(e, "%Y-%m-%d").date()
        start_dt = datetime.strptime(s, "%Y-%m-%d").date()

        pw_end   = str(end_dt   - timedelta(weeks=1))
        pw_start = str(start_dt - timedelta(weeks=1))

        pm_s_month = start_dt.month - 1 or 12
        pm_s_year  = start_dt.year - (1 if start_dt.month == 1 else 0)
        pm_e_month = end_dt.month   - 1 or 12
        pm_e_year  = end_dt.year   - (1 if end_dt.month   == 1 else 0)
        pm_start = str(date(pm_s_year, pm_s_month, min(start_dt.day, calendar.monthrange(pm_s_year, pm_s_month)[1])))
        pm_end   = str(date(pm_e_year, pm_e_month, min(end_dt.day,   calendar.monthrange(pm_e_year, pm_e_month)[1])))

        try:
            py_start = str(start_dt.replace(year=start_dt.year - 1))
            py_end   = str(end_dt.replace(year=end_dt.year - 1))
        except ValueError:
            py_start = str(start_dt - timedelta(days=365))
            py_end   = str(end_dt   - timedelta(days=365))

        where, params     = build_date_filter(s, e, locations, date_col="payment_date")
        days_in_month     = calendar.monthrange(end_dt.year, end_dt.month)[1]
        days_elapsed      = (end_dt - end_dt.replace(day=1)).days + 1
        loc_and, loc_p    = loc_in(locations)

        sql = f"""
        WITH budget_lookup AS (
            SELECT location, monthly_budget FROM {_BUDGET_VALUES}
        ),
        current_period AS (
            SELECT
                center_name,
                SUM(sales_collected_exc_tax)                                                                  AS cash_sales,
                SUM(sales_collected_exc_tax) * 1.0
                    / NULLIF(COUNT(DISTINCT CAST(payment_date AS DATE)), 0)                                   AS avg_daily_sales,
                SUM(CASE WHEN item_category != 'Memberships' THEN sales_collected_exc_tax ELSE 0 END)        AS cash_sales_excl_mbr,
                SUM(CASE WHEN CAST(payment_date AS DATE)
                             BETWEEN DATEADD(DAY, -6, '{e}') AND '{e}'
                         THEN sales_collected_exc_tax ELSE 0 END)                                             AS current_week_revenue,
                COUNT(DISTINCT CASE WHEN item_category = 'Memberships'  THEN guest_code END)                  AS new_members,
                -- Non-members via the `member` flag (spec), not by purchase category.
                COUNT(DISTINCT CASE WHEN LOWER(member) = 'no'           THEN guest_code END)                  AS non_members,
                COUNT(DISTINCT guest_code)                                                                     AS total_guests
            FROM {FULL_CASH}
            {where}
            GROUP BY center_name
        ),
        prior_week AS (
            SELECT center_name, SUM(sales_collected_exc_tax) AS pw_revenue
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) >= '{pw_start}'
              AND CAST(payment_date AS DATE) <= '{pw_end}'
            {loc_and}
            GROUP BY center_name
        ),
        prior_month AS (
            SELECT center_name, SUM(sales_collected_exc_tax) AS pm_revenue
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) >= '{pm_start}'
              AND CAST(payment_date AS DATE) <= '{pm_end}'
            {loc_and}
            GROUP BY center_name
        ),
        prior_year AS (
            SELECT center_name, SUM(sales_collected_exc_tax) AS py_revenue
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) >= '{py_start}'
              AND CAST(payment_date AS DATE) <= '{py_end}'
            {loc_and}
            GROUP BY center_name
        )
        SELECT
            c.center_name                                                               AS location,
            c.cash_sales,
            c.avg_daily_sales,
            c.avg_daily_sales * {days_in_month}                                         AS trending,
            b.monthly_budget,
            c.cash_sales - b.monthly_budget                                             AS surplus_shortfall,
            c.cash_sales * 1.0 / NULLIF(b.monthly_budget, 0) * 100                    AS pct_to_goal_mtd,
            c.avg_daily_sales * {days_in_month} * 1.0 / NULLIF(b.monthly_budget, 0) * 100
                                                                                        AS pct_to_goal_total,
            c.cash_sales_excl_mbr,
            c.current_week_revenue,
            COALESCE(pw.pw_revenue, 0)                                                   AS prior_week_revenue,
            c.current_week_revenue - COALESCE(pw.pw_revenue, 0)                         AS prior_week_variance,
            (c.current_week_revenue - COALESCE(pw.pw_revenue, 0)) * 1.0
                / NULLIF(COALESCE(pw.pw_revenue, 0), 0) * 100                           AS prior_week_variance_pct,
            COALESCE(pm.pm_revenue, 0)                                                   AS pm_revenue,
            c.cash_sales - COALESCE(pm.pm_revenue, 0)                                   AS pm_variance,
            (c.cash_sales - COALESCE(pm.pm_revenue, 0)) * 1.0
                / NULLIF(COALESCE(pm.pm_revenue, 0), 0) * 100                           AS pm_variance_pct,
            COALESCE(py.py_revenue, 0)                                                   AS py_revenue,
            c.cash_sales - COALESCE(py.py_revenue, 0)                                   AS py_variance,
            (c.cash_sales - COALESCE(py.py_revenue, 0)) * 1.0
                / NULLIF(COALESCE(py.py_revenue, 0), 0) * 100                           AS py_variance_pct,
            c.new_members,
            c.non_members,
            -- Adoption = New Memberships / Non-Members (member flag), per spec.
            c.new_members * 1.0 / NULLIF(c.non_members, 0) * 100                       AS membership_adoption
        FROM current_period c
        LEFT JOIN budget_lookup b  ON c.center_name = b.location
        LEFT JOIN prior_week  pw ON c.center_name = pw.center_name
        LEFT JOIN prior_month pm ON c.center_name = pm.center_name
        LEFT JOIN prior_year  py ON c.center_name = py.center_name
        ORDER BY c.center_name
        """
        # params: current_period (where), prior_week (loc_p), prior_month (loc_p), prior_year (loc_p)
        all_params = merge_params(params, loc_p, loc_p, loc_p)
        return run_query(sql, all_params or None)

    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/mtd-sales-mix")
def get_mtd_sales_mix(
    request:    Request,
    start_date: Optional[str]       = Query(None),
    end_date:   Optional[str]       = Query(None),
    locations:  Optional[List[str]] = Query(None),
):
    """Revenue by service category for the MTD window."""
    try:
        today = datetime.utcnow().date()
        e = end_date   or str(today)
        s = start_date or str(today.replace(day=1))
        where, params = build_date_filter(s, e, locations)

        sql = f"""
        SELECT
            center_name AS location,
            {_MIX_COLS}
        FROM {FULL_SALES}
        {where}
        GROUP BY center_name
        ORDER BY center_name
        """
        return run_query(sql, params or None)

    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/mtd-daily-trend")
def get_mtd_daily_trend(
    request:    Request,
    start_date: Optional[str]       = Query(None),
    end_date:   Optional[str]       = Query(None),
    locations:  Optional[List[str]] = Query(None),
):
    """Daily + cumulative NET SALES (accrual), budget pace, and trending projection for the MTD chart."""
    try:
        if not end_date:
            r = run_query(f"SELECT MAX(CAST(sale_date AS DATE)) AS d FROM {FULL_SALES}")
            end_date = str(r[0]["d"]) if r and r[0].get("d") else str(datetime.utcnow().date())
        e     = end_date
        e_dt  = datetime.strptime(e, "%Y-%m-%d").date()
        s     = start_date or str(e_dt.replace(day=1))

        where, params    = build_date_filter(s, e, locations, date_col="sale_date")
        days_in_month    = calendar.monthrange(e_dt.year, e_dt.month)[1]
        days_elapsed     = (e_dt - e_dt.replace(day=1)).days + 1

        # ── Budget total for selected locations ──────────────────────────────
        if locations:
            bw_ph     = ",".join(["%s"] * len(locations))
            budget_sql = f"""
            WITH b AS (SELECT location, monthly_budget FROM {_BUDGET_VALUES})
            SELECT COALESCE(SUM(monthly_budget), 0) AS total_budget
            FROM b WHERE location IN ({bw_ph})
            """
            budget_rows = run_query(budget_sql, list(locations))
        else:
            budget_sql = f"""
            WITH b AS (SELECT location, monthly_budget FROM {_BUDGET_VALUES})
            SELECT COALESCE(SUM(monthly_budget), 0) AS total_budget FROM b
            """
            budget_rows = run_query(budget_sql)
        monthly_budget = float(budget_rows[0]["total_budget"]) if budget_rows else 0.0

        # ── Daily + cumulative NET SALES (accrual, closed) — matches the chart's
        #    "Net Sales" label. Was cash (sales_collected_exc_tax from the cash table),
        #    which mislabeled the chart and pulled in cash-batch spikes (e.g. Jun 25).
        sql = f"""
        SELECT
            CAST(sale_date AS DATE)                                                 AS day,
            SUM(CASE WHEN LOWER(status) = 'closed' THEN sales_exc_tax ELSE 0 END)   AS daily_sales,
            SUM(SUM(CASE WHEN LOWER(status) = 'closed' THEN sales_exc_tax ELSE 0 END)) OVER (
                ORDER BY CAST(sale_date AS DATE)
                ROWS UNBOUNDED PRECEDING
            )                                                                       AS cumulative_sales
        FROM {FULL_SALES}
        {where}
        GROUP BY CAST(sale_date AS DATE)
        ORDER BY day
        """
        daily_rows = run_query(sql, params or None)

        total_sales = float(daily_rows[-1]["cumulative_sales"]) if daily_rows else 0.0
        avg_daily   = total_sales / days_elapsed if days_elapsed else 0.0
        trending    = round(avg_daily * days_in_month, 2)

        return {
            "daily":          serialize_rows(daily_rows),
            "monthly_budget": monthly_budget,
            "trending":       trending,
            "days_in_month":  days_in_month,
        }

    except Exception as exc:
        log_and_raise_from_request(exc, request)
