import calendar
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import date, datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Query, Request

from config import FULL_SALES, FULL_CASH, FULL_SCHEDULE, FULL_APPT, FULL_MEMBERSHIP_SALES
from db import run_query, serialize_rows
from utils.filters import build_date_filter, build_sched_filter, merge_params, loc_in, hhmm_to_hours
from utils.cogs import fetch_cogs_and_accrual, cogs_margin_pct
from utils.ad_spend import mtd_ad_spend, client_acquisition_cost
from utils.payroll import compute_salary_by_center, salary_margin_pct
from utils.operating_days import cash_run_rate, recognized_run_rate
from utils.sss import sss_growth_yoy
from utils.new_customers import new_existing_visits
from utils.new_guests import guest_counts, guest_counts_by_center
from utils.rebooking_kpi import rebooking_rate_kpi, rebooking_rate_by_center
from utils.memberships import new_memberships, existing_members
from utils.rev_hour import esthetician_rev_per_hour, provider_rev_per_hour
from utils.errors import log_and_raise_from_request

router = APIRouter()

# Cash collections payment-type filter: restrict to recognized collection types.
#
# The payment_type column stores a comma-separated string of ALL payment methods
# used on a single invoice (e.g. " Card, Custom - Aspire, Gift Card(12345)").
# Cash sales INCLUDES a row if it contains AT LEAST ONE real financial tender —
# Cash, Card, Check, or Custom - * (Alle, Aspire, Xperience, RepeatMD, refunds, …) —
# anywhere in the list, EVEN when a redemption tender (Gift Card, Prepaid Card,
# Package, Membership, Loyalty, Cashback) is also present. Only rows with NO
# financial tender at all (redemption-only, e.g. a lone "Gift Card(123)") are dropped.
#
# We must match WHOLE tenders, not substrings: a naive '%card%' would wrongly hit
# "Gift Card"/"Prepaid Card" and '%cash%' would hit "Cashback", so a lone gift-card
# row would leak in. Instead we normalize the value to ",tok1,tok2,,…" (lowercased,
# trimmed, the ", " separators collapsed to ",") and match delimited tokens:
# ',card,', ',cash,', ',check,', and the ',custom - ' prefix. See _PT_NORM below.
_PT_NORM = "(',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',')"
_CASH_PAY_FILTER = (
    f" AND ({_PT_NORM} LIKE '%,card,%'"
    f" OR {_PT_NORM} LIKE '%,cash,%'"
    f" OR {_PT_NORM} LIKE '%,check,%'"
    f" OR {_PT_NORM} LIKE '%,custom - %')"
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

# ── Full Month Budget, per month → per location ──────────────────────────────
# Source: Evolve Marketing Dashboard (Power BI | Daily Revenue), "Sales Targets
# ($)" column. Keyed by "YYYY-MM". Each month's values sum to that month's Full
# Month Budget (Jun-26 = 1,950,000; Jul-26 = 1,700,000). Add new months here as
# they are set; _budget_month_key() resolves a report date to the right month.
_BUDGET_BY_MONTH: dict[str, dict[str, float]] = {
    "2026-06": {
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
    },
    "2026-07": {
        'Bel Air, MD':     125000.0,
        'Bridgewater, NJ':  42500.0,
        'Denville, NJ':    165000.0,
        'Frederick, MD':   120000.0,
        'Hoboken, NJ':     242500.0,
        'Jersey City, NJ': 237500.0,
        'Lancaster, PA':    40000.0,
        'Montclair, NJ':   167500.0,
        'Old Bridge, NJ':   70000.0,
        'Red Bank, NJ':    145000.0,
        'Ridgewood, NJ':   130000.0,
        'Short Hills, NJ': 140000.0,
        'Tribeca, NY':      42500.0,
        'Waldorf, MD':      32500.0,
    },
}


def _budget_month_key(e: str) -> str:
    """Resolve a report end-date ('YYYY-MM-DD') to a defined budget month key.

    Uses the report's own month when it has budgets; otherwise the latest
    defined month that is not after it; otherwise the earliest defined month.
    Keeps behaviour sane for dates outside the configured range.
    """
    keys = sorted(_BUDGET_BY_MONTH)
    want = e[:7]
    if want in _BUDGET_BY_MONTH:
        return want
    earlier = [k for k in keys if k <= want]
    return earlier[-1] if earlier else keys[0]


def _budget_dict(e: str) -> dict[str, float]:
    """Per-location Full Month Budget for the report month of end-date `e`."""
    return _BUDGET_BY_MONTH[_budget_month_key(e)]


def _budget_values_sql(e: str) -> str:
    """The month's budget as a SQL Server VALUES table (same shape as before)."""
    rows = ",\n    ".join(
        f"('{loc.replace(chr(39), chr(39) * 2)}', {amt})"
        for loc, amt in _budget_dict(e).items()
    )
    return f"(VALUES\n    {rows}\n) AS budget_lookup(location, monthly_budget)"


# ── Monthly goals, per month → per location ──────────────────────────────────
# Source: Evolve Marketing Dashboard (Power BI | Daily Revenue). New/Existing
# Customers are counts; ASP (New)/(Existing) are dollar targets per customer.
# Keyed by "YYYY-MM"; resolved with the same _budget_month_key() logic so goals
# and budget always track the same month.
_GOALS_BY_MONTH: dict[str, dict[str, dict[str, float]]] = {
    "2026-06": {
        'Hoboken, NJ': { 'new_customers': 46, 'existing_customers': 615, 'asp_new': 337, 'asp_existing': 343 },
        'Jersey City, NJ': { 'new_customers': 87, 'existing_customers': 405, 'asp_new': 516, 'asp_existing': 380 },
        'Montclair, NJ': { 'new_customers': 61, 'existing_customers': 479, 'asp_new': 333, 'asp_existing': 291 },
        'Short Hills, NJ': { 'new_customers': 51, 'existing_customers': 364, 'asp_new': 400, 'asp_existing': 341 },
        'Denville, NJ': { 'new_customers': 54, 'existing_customers': 349, 'asp_new': 580, 'asp_existing': 337 },
        'Red Bank, NJ': { 'new_customers': 48, 'existing_customers': 346, 'asp_new': 432, 'asp_existing': 330 },
        'Tribeca, NY': { 'new_customers': 59, 'existing_customers': 113, 'asp_new': 245, 'asp_existing': 248 },
        'Bel Air, MD': { 'new_customers': 68, 'existing_customers': 315, 'asp_new': 322, 'asp_existing': 329 },
        'Frederick, MD': { 'new_customers': 43, 'existing_customers': 278, 'asp_new': 394, 'asp_existing': 363 },
        'Ridgewood, NJ': { 'new_customers': 62, 'existing_customers': 310, 'asp_new': 421, 'asp_existing': 300 },
        'Waldorf, MD': { 'new_customers': 11, 'existing_customers': 58, 'asp_new': 245, 'asp_existing': 258 },
        'Old Bridge, NJ': { 'new_customers': 48, 'existing_customers': 152, 'asp_new': 442, 'asp_existing': 380 },
        'Bridgewater, NJ': { 'new_customers': 27, 'existing_customers': 43, 'asp_new': 376, 'asp_existing': 492 },
        'Lancaster, PA': { 'new_customers': 26, 'existing_customers': 29, 'asp_new': 170, 'asp_existing': 566 },
    },
    "2026-07": {
        'Hoboken, NJ': { 'new_customers': 22, 'existing_customers': 530, 'asp_new': 345, 'asp_existing': 297 },
        'Jersey City, NJ': { 'new_customers': 77, 'existing_customers': 358, 'asp_new': 648, 'asp_existing': 356 },
        'Montclair, NJ': { 'new_customers': 43, 'existing_customers': 519, 'asp_new': 363, 'asp_existing': 270 },
        'Short Hills, NJ': { 'new_customers': 44, 'existing_customers': 304, 'asp_new': 393, 'asp_existing': 294 },
        'Denville, NJ': { 'new_customers': 37, 'existing_customers': 353, 'asp_new': 436, 'asp_existing': 331 },
        'Red Bank, NJ': { 'new_customers': 43, 'existing_customers': 304, 'asp_new': 290, 'asp_existing': 326 },
        'Tribeca, NY': { 'new_customers': 52, 'existing_customers': 101, 'asp_new': 207, 'asp_existing': 218 },
        'Bel Air, MD': { 'new_customers': 56, 'existing_customers': 255, 'asp_new': 351, 'asp_existing': 247 },
        'Frederick, MD': { 'new_customers': 43, 'existing_customers': 265, 'asp_new': 358, 'asp_existing': 278 },
        'Ridgewood, NJ': { 'new_customers': 57, 'existing_customers': 290, 'asp_new': 345, 'asp_existing': 257 },
        'Waldorf, MD': { 'new_customers': 9, 'existing_customers': 42, 'asp_new': 242, 'asp_existing': 270 },
        'Old Bridge, NJ': { 'new_customers': 46, 'existing_customers': 144, 'asp_new': 277, 'asp_existing': 313 },
        'Bridgewater, NJ': { 'new_customers': 25, 'existing_customers': 40, 'asp_new': 563, 'asp_existing': 425 },
        'Lancaster, PA': { 'new_customers': 24, 'existing_customers': 26, 'asp_new': 349, 'asp_existing': 805 },
    },
}


def _goals_for(e: str, locations: Optional[List[str]]) -> dict[str, Optional[float]]:
    """Aggregate monthly goals for the report month + selected locations.

    Customer goals are summed. ASP goals are customer-count-weighted averages
    (ASP-new weighted by new-customer goal, ASP-existing by existing-customer
    goal) so the chain/filtered figure is a true blended target, not a naive
    mean.

    A location missing from the month's goal table is simply skipped — the total
    still reflects the locations that do have goals. The zero-basis fallback then
    depends on the view:
    • Filtered to specific location(s) → return 0.0 so the client shows "0"
      (a filtered location with no goal is a real zero, not "no data").
    • Chain / all locations → return None so the card is hidden when the month
      has no goals defined at all.
    """
    month = _GOALS_BY_MONTH.get(_budget_month_key(e), {})
    filtered = bool(locations)
    locs = locations if locations else list(month.keys())
    new_c = exist_c = asp_new_num = asp_exist_num = 0.0
    for loc in locs:
        g = month.get(loc)
        if not g:
            continue
        new_c        += g['new_customers']
        exist_c      += g['existing_customers']
        asp_new_num  += g['asp_new'] * g['new_customers']
        asp_exist_num += g['asp_existing'] * g['existing_customers']
    zero: Optional[float] = 0.0 if filtered else None
    return {
        "new_customers_goal":      new_c or zero,
        "existing_customers_goal": exist_c or zero,
        "asp_new_goal":            (asp_new_num / new_c) if new_c else zero,
        "asp_existing_goal":       (asp_exist_num / exist_c) if exist_c else zero,
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

        # last_sale_day = latest closed SALE day (sale_date) <= end_date. Drives the
        # recognized-revenue run-rate projection (how many working days have elapsed) —
        # NOT the Prior Day Sales card (see prior_day_sale below).
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

        # "Prior Day Sales" date depends on whether the SELECTED month is complete:
        #   • Fully-past (complete) month -> that month's LAST payment day
        #       (e.g. June 2026 filter -> Jun 30).
        #   • Current / incomplete month -> the latest day that actually has cash
        #       data (`yesterday`, resolved above via MAX(payment_date) <= end_date).
        #       This self-adjusts to the cash-settlement lag instead of assuming a
        #       fixed offset, so it never lands on an empty (not-yet-loaded) day.
        # Value is RAW cash collected on that day (no tender filter), payment_date basis.
        today_dt       = datetime.utcnow().date()
        sel_month_last = s_dt.replace(day=calendar.monthrange(s_dt.year, s_dt.month)[1])
        if sel_month_last < today_dt:
            # complete past month -> last payment day at or before the month end
            prior_day_sql = f"""
            SELECT MAX(CAST(payment_date AS DATE)) AS d
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) <= '{sel_month_last}'
            {y_loc_pre}
            """
            _pd = run_query(prior_day_sql, y_loc_pre_p or None)
            prior_day_sale = (
                str(_pd[0]["d"]) if _pd and _pd[0].get("d") else str(sel_month_last)
            )
        else:
            # current / incomplete month -> latest day that actually has cash data
            # (self-adjusts to the settlement lag; never lands on an empty day)
            prior_day_sale = yesterday

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

        # Location-aware, month-aware monthly budget (was hardcoded 1,950,000 —
        # wrong under any location filter, and wrong once budgets change month to
        # month). Sum the per-location budget for the report month + selected
        # centers. Computed in Python (no SQL placeholders) to avoid param-binding
        # risk. See _BUDGET_BY_MONTH.
        budget_by_loc = _budget_dict(e)
        if locations:
            monthly_budget_val = float(sum(budget_by_loc.get(l, 0.0) for l in locations))
        else:
            monthly_budget_val = float(sum(budget_by_loc.values()))

        # Month + location-aware goals (New/Existing Customers, ASP New/Existing),
        # injected as SQL literals like monthly_budget. NULL renders as SQL NULL so
        # the client shows "—" when a month has no goal defined. See _goals_for().
        goals = _goals_for(e, locations)
        def _goal_lit(v: Optional[float]) -> str:
            return "NULL" if v is None else f"{v:.4f}"

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
                -- Distinct guests (not guest-days) transacting this month; the total that
                -- New + Existing partition when Existing = total distinct − New.
                COUNT(DISTINCT CASE WHEN c.sales_collected_exc_tax > 0 THEN c.guest_name END)                AS total_customer_count,
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
                -- Non-membership MTD cash sales per segment — the ASP numerators.
                -- ASP (New/Existing) is computed downstream in Python as this segment
                -- sales ÷ the segment's Customer Visits (Business KPI new_guest_count /
                -- unique_guest_count), so the denominator is the authoritative visit
                -- count, not a cash distinct-customer count. New uses is_new=1 guests;
                -- Existing uses is_new=0 guests.
                SUM(CASE WHEN gc.is_new = 1 AND c.item_category != 'Memberships'
                          THEN c.sales_collected_exc_tax ELSE 0 END)                                          AS new_nonmemb_sales,
                SUM(CASE WHEN gc.is_new = 0 AND c.item_category != 'Memberships'
                          THEN c.sales_collected_exc_tax ELSE 0 END)                                          AS existing_nonmemb_sales
            FROM {FULL_CASH} c
            JOIN guest_classification gc ON gc.guest_name = c.guest_name
            {where}
            {_CASH_PAY_FILTER}
        ),
        yesterday_data AS (
            -- Prior Day Sales = RAW CASH COLLECTED (payment_date, exc-tax) on
            -- prior_day_sale (complete month -> its last payment day; current month ->
            -- today minus 2 days; see resolution above). NO tender filter.
            SELECT
                COALESCE(SUM(sales_collected_exc_tax), 0) AS yesterday_revenue,
                COALESCE(COUNT(DISTINCT guest_name), 0)   AS yesterday_clients
            FROM {FULL_CASH}
            WHERE CAST(payment_date AS DATE) = '{prior_day_sale}'
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
            m.total_customer_count,
            m.new_client_count,
            m.existing_client_count,
            m.member_count,
            m.non_member_count,
            m.new_members,
            m.new_visits,
            m.membership_adoption_rate,
            m.blended_asp,
            m.new_nonmemb_sales,
            m.existing_nonmemb_sales,
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
            {_goal_lit(goals["new_customers_goal"])}                                              AS new_customers_goal,
            {_goal_lit(goals["existing_customers_goal"])}                                         AS existing_customers_goal,
            {_goal_lit(goals["asp_new_goal"])}                                                    AS asp_new_goal,
            {_goal_lit(goals["asp_existing_goal"])}                                               AS asp_existing_goal,
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
        # is bounded by the single slowest query. mtd_ad_spend is a lean SUM over the two
        # ad BRONZE tables so it stays inline. new_members / new_visits now come from the main cash query itself
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
            f_exist_memb = pool.submit(timed("existing_members", existing_members), s, e, locations)
            f_esth_rh  = pool.submit(timed("esth_rev_hr", esthetician_rev_per_hour), s, e, locations)
            f_prov_rh  = pool.submit(timed("prov_rev_hr", provider_rev_per_hour), s, e, locations)

            rows            = f_main.result()
            cm              = f_cogs.result()
            sal             = f_salary.result()
            result_cash_rr  = f_cash_rr.result()
            result_recog_rr = f_recog_rr.result()
            result_sss      = f_sss.result()
            new_memb        = f_memb.result()
            exist_memb      = f_exist_memb.result()
            esth_rev_hr     = f_esth_rh.result()
            prov_rev_hr     = f_prov_rh.result()
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
        #     BRONZE_ZENOTI_MEMBERSHIPS_SALES (sale_type='Sale'; see utils/memberships.py).
        #   Non-Members     = distinct cash guests with the `member` flag = 'no'.
        # Reads 0 if the memberships-sales table has no matching rows for the window.
        non_member = result.get("non_member_count") or 0
        result["new_members"] = new_memb
        # Existing Members = total distinct members transacting this month (new + recurring),
        # from BRONZE_ZENOTI_MEMBERSHIPS_SALES. Returning-base parallel to Existing Customers
        # (total distinct customers); New Members is NOT subtracted out.
        result["existing_members"] = exist_memb
        result["membership_adoption_rate"] = (new_memb / non_member * 100) if non_member else None
        # Rev/hr Esthetician & Provider — decoupled (all role sales ÷ role booked hours),
        # replacing the per-day-join values that dropped role attribution (~20% for
        # estheticians). Falls back to the main-query per-day value if the scan errors.
        if esth_rev_hr is not None:
            result["rev_per_esthetician"] = esth_rev_hr
        if prov_rev_hr is not None:
            result["rev_per_provider"] = prov_rev_hr
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
        # New Customer Visits falls back to the accrual scan (result_visits) when the
        # Business KPI export doesn't cover the range; the KPI value below overrides it.
        # Existing Customer Visits does NOT fall back (set unconditionally below).
        if result_visits is not None:
            result["new_visits"] = result_visits.get("new")
        # Official guest counts (Zenoti daily "Business KPI" export, read live from
        # dbo.BRONZE_ZENOTI_BUSINESS_KPI):
        #   New      = SUM(new_guest_count)    — falls back to accrual/cash for uncovered ranges.
        #   Existing = SUM(unique_guest_count) — NO fallback; strictly this sum (0 if no rows).
        kpi = guest_counts(s, e, locations)
        if kpi["new"] is not None:
            result["new_visits"] = kpi["new"]
        result["existing_client_count"] = kpi["existing"]
        # ASP (New/Existing) = segment non-membership MTD cash sales ÷ that segment's
        # Customer Visits. Numerators come from the main query (new/existing_nonmemb_sales);
        # denominators are the authoritative visit counts resolved just above (Business KPI,
        # else accrual, else the cash query), so ASP always ties to the displayed visit count.
        new_den   = result.get("new_visits")
        exist_den = result.get("existing_client_count")
        new_sales   = result.get("new_nonmemb_sales")
        exist_sales = result.get("existing_nonmemb_sales")
        result["asp_new_clients"] = (
            round(float(new_sales) / new_den, 2) if new_den and new_sales is not None else None)
        result["asp_existing_clients"] = (
            round(float(exist_sales) / exist_den, 2) if exist_den and exist_sales is not None else None)
        # MTD Ad Spend (chain-level, live SUM over BRONZE_ZENOTI_GOOGLE_ADS + BRONZE_ZENOTI_FB_ADS) + CAC = ad spend / new visits.
        result["mtd_ad_spend"] = mtd_ad_spend(s, e)
        result["client_acquisition_cost"] = client_acquisition_cost(
            result.get("mtd_ad_spend"), result.get("new_visits") or result.get("new_client_count"))
        # Rebook Rate % — override the appointments-based SQL rate with the official
        # Business KPI export: AVERAGE of per-center daily "Rebooking Source %",
        # EXCLUDING zeros; a location filter with all-zero shows 0. Falls back to the
        # SQL rate (rb.rebooking_rate) for ranges with no export.
        rb_kpi = rebooking_rate_kpi(s, e, locations)
        if rb_kpi is not None:
            result["rebooking_rate"] = rb_kpi
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
        # Per-center New Memberships from the memberships-sales table, reconciled to the
        # header KPI (utils/memberships.new_memberships): sale_type='Sale', created in
        # [s,e] AND starting this calendar month. Its center column is sale_center.
        mbr_month_start = str(end_dt.replace(day=1))
        mbr_month_end   = str(end_dt.replace(day=calendar.monthrange(end_dt.year, end_dt.month)[1]))
        mbr_loc_and, mbr_loc_p = loc_in(locations, col="sale_center")

        sql = f"""
        WITH guest_classification AS (
            -- One row per guest_name: is_new=1 if ANY row in period has first_visit='yes'.
            -- SAME rule + cash-pay filter as the header (get_mtd_kpi_header) so the
            -- per-center ASP numerators classify guests identically to the chain total.
            SELECT
                guest_name,
                MAX(CASE WHEN LOWER(first_visit) = 'yes' THEN 1 ELSE 0 END) AS is_new
            FROM {FULL_CASH}
            {where}
            {_CASH_PAY_FILTER}
            GROUP BY guest_name
        ),
        budget_lookup AS (
            SELECT location, monthly_budget FROM {_budget_values_sql(e)}
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
                -- Non-members via the `member` flag (spec), not by purchase category.
                COUNT(DISTINCT CASE WHEN LOWER(member) = 'no'           THEN guest_code END)                  AS non_members,
                COUNT(DISTINCT guest_code)                                                                     AS total_guests
            FROM {FULL_CASH}
            {where}
            GROUP BY center_name
        ),
        asp_seg AS (
            -- Non-membership MTD cash sales per center, split by new/existing guest —
            -- the ASP (New)/(Existing) numerators. SAME definition and cash-pay filter
            -- as the header (new_nonmemb_sales / existing_nonmemb_sales); divided in
            -- Python by the Business KPI visit counts so per-location ASP ties to the
            -- header/total spec (not the operations accrual ÷ invoices figure).
            SELECT
                c.center_name,
                SUM(CASE WHEN gc.is_new = 1 AND c.item_category != 'Memberships'
                          THEN c.sales_collected_exc_tax ELSE 0 END)                                           AS new_nonmemb_sales,
                SUM(CASE WHEN gc.is_new = 0 AND c.item_category != 'Memberships'
                          THEN c.sales_collected_exc_tax ELSE 0 END)                                           AS existing_nonmemb_sales
            FROM {FULL_CASH} c
            JOIN guest_classification gc ON gc.guest_name = c.guest_name
            {where}
            {_CASH_PAY_FILTER}
            GROUP BY c.center_name
        ),
        membership_new AS (
            -- New Memberships per center from BRONZE_ZENOTI_MEMBERSHIPS_SALES — SAME rule
            -- as the header KPI (sale_type='Sale', created in [s,e] AND starting this month),
            -- so the per-location "Mbr Adopt" reconciles with the header Membership Adoption.
            SELECT sale_center AS center_name, COUNT(*) AS new_members
            FROM {FULL_MEMBERSHIP_SALES}
            WHERE LOWER(LTRIM(RTRIM(sale_type))) = 'sale'
              AND CAST(sale_date  AS DATE) BETWEEN '{s}' AND '{e}'
              AND CAST(start_date AS DATE) BETWEEN '{mbr_month_start}' AND '{mbr_month_end}'
              {mbr_loc_and}
            GROUP BY sale_center
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
            COALESCE(mn.new_members, 0)                                                 AS new_members,
            c.non_members,
            -- Adoption = New Memberships (memberships-sales table, same rule as the header
            -- KPI) / Non-Members (cash member flag). Reconciled to the header source.
            COALESCE(mn.new_members, 0) * 1.0 / NULLIF(c.non_members, 0) * 100           AS membership_adoption,
            COALESCE(a.new_nonmemb_sales, 0)                                            AS new_nonmemb_sales,
            COALESCE(a.existing_nonmemb_sales, 0)                                       AS existing_nonmemb_sales
        FROM current_period c
        LEFT JOIN budget_lookup   b  ON c.center_name = b.location
        LEFT JOIN asp_seg         a  ON c.center_name = a.center_name
        LEFT JOIN membership_new  mn ON c.center_name = mn.center_name
        LEFT JOIN prior_week  pw ON c.center_name = pw.center_name
        LEFT JOIN prior_month pm ON c.center_name = pm.center_name
        LEFT JOIN prior_year  py ON c.center_name = py.center_name
        ORDER BY c.center_name
        """
        # params (textual %s order): guest_classification (where), current_period (where),
        # asp_seg (where), membership_new (mbr_loc_p), prior_week (loc_p),
        # prior_month (loc_p), prior_year (loc_p)
        all_params = merge_params(params, params, params, mbr_loc_p, loc_p, loc_p, loc_p)
        rows = run_query(sql, all_params or None)
        # Per-location New / Existing Customer Visits come from the SAME source as the
        # chain total (Business KPI table, latest snapshot) — see guest_counts_by_center.
        # This is the single source of truth for these two columns, so the location rows
        # reconcile with the header total. Centers absent from the snapshot default to 0.
        gc = guest_counts_by_center(s, e, locations)
        # Per-center Rebook Rate % from the Business KPI export (same source as the
        # header/total rebooking_rate_kpi). Centers with no non-zero KPI rate are
        # absent → row keeps None so the client falls back to the SQL appointments
        # rate, exactly mirroring the header's KPI-else-SQL fallback.
        rb = rebooking_rate_by_center(s, e, locations)
        for row in rows:
            g = gc.get(row["location"], {})
            row["new_visits"]            = g.get("new", 0)
            row["existing_client_count"] = g.get("existing", 0)
            row["rebooking_rate"]        = rb.get(row["location"])
            # ASP (New/Existing) = segment non-membership cash sales (from asp_seg) ÷ that
            # segment's Business KPI Customer Visits — SAME spec as the header
            # (asp_new_clients / asp_existing_clients), so per-location rows reconcile with
            # the header/total ASP instead of the operations accrual-÷-invoices figure.
            nd, ed = row["new_visits"], row["existing_client_count"]
            ns, es = row.get("new_nonmemb_sales"), row.get("existing_nonmemb_sales")
            row["asp_new_clients"]      = round(float(ns) / nd, 2) if nd and ns is not None else None
            row["asp_existing_clients"] = round(float(es) / ed, 2) if ed and es is not None else None
        return rows

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
    """Daily + cumulative CASH SALES (collections), budget pace, and trending projection for the MTD chart."""
    try:
        if not end_date:
            r = run_query(f"SELECT MAX(CAST(payment_date AS DATE)) AS d FROM {FULL_CASH}")
            end_date = str(r[0]["d"]) if r and r[0].get("d") else str(datetime.utcnow().date())
        e     = end_date
        e_dt  = datetime.strptime(e, "%Y-%m-%d").date()
        s     = start_date or str(e_dt.replace(day=1))

        where, params    = build_date_filter(s, e, locations, date_col="payment_date")
        days_in_month    = calendar.monthrange(e_dt.year, e_dt.month)[1]
        days_elapsed     = (e_dt - e_dt.replace(day=1)).days + 1

        # ── Budget total for selected locations ──────────────────────────────
        if locations:
            bw_ph     = ",".join(["%s"] * len(locations))
            budget_sql = f"""
            WITH b AS (SELECT location, monthly_budget FROM {_budget_values_sql(e)})
            SELECT COALESCE(SUM(monthly_budget), 0) AS total_budget
            FROM b WHERE location IN ({bw_ph})
            """
            budget_rows = run_query(budget_sql, list(locations))
        else:
            budget_sql = f"""
            WITH b AS (SELECT location, monthly_budget FROM {_budget_values_sql(e)})
            SELECT COALESCE(SUM(monthly_budget), 0) AS total_budget FROM b
            """
            budget_rows = run_query(budget_sql)
        monthly_budget = float(budget_rows[0]["total_budget"]) if budget_rows else 0.0

        # ── Daily + cumulative CASH SALES (collections) — matches the Cash Sales
        #    card (/api/mtd-kpi-header -> mtd_revenue). Uses the SAME cash table,
        #    payment_date basis, and tender filter (_CASH_PAY_FILTER), so the
        #    Sales-to-Budget MTD total reconciles to the card exactly.
        #    (Previously NET SALES from the accrual table, which did not match the
        #    cash-basis card; switched per request to keep the two figures equal.)
        sql = f"""
        SELECT
            CAST(payment_date AS DATE)                                              AS day,
            SUM(sales_collected_exc_tax)                                            AS daily_sales,
            SUM(SUM(sales_collected_exc_tax)) OVER (
                ORDER BY CAST(payment_date AS DATE)
                ROWS UNBOUNDED PRECEDING
            )                                                                       AS cumulative_sales
        FROM {FULL_CASH}
        {where}
        {_CASH_PAY_FILTER}
        GROUP BY CAST(payment_date AS DATE)
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
