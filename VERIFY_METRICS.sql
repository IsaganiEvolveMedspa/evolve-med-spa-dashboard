/* ============================================================================
   Evolve Dashboard — Metric Verification Script (with component breakdown)
   Run on database: sql-prod-cus-evolve   (pick it in the DB dropdown, not master)

   Every row shows:  metric | numerator | denominator | computed_value | dashboard_shows
   For ratios, numerator/denominator are the two inputs; for plain totals the
   value sits in numerator and denominator is NULL.
   Date window auto-aligns to the latest cash data (same basis the app uses).
   Read-only: only DECLARE / SELECT / PRINT.
   ============================================================================ */

DECLARE @e   DATE = (SELECT MAX(CAST(payment_date AS DATE)) FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS);
DECLARE @s   DATE = DATEFROMPARTS(YEAR(@e), MONTH(@e), 1);
DECLARE @pys DATE = DATEADD(YEAR, -1, @s);
DECLARE @pye DATE = DATEADD(YEAR, -1, @e);
DECLARE @dim INT  = DAY(EOMONTH(@e));
DECLARE @budget FLOAT = 1950000.0;

-- COGS components (shown explicitly below)
DECLARE @total_cogs    FLOAT = (SELECT SUM(cost_of_goods) FROM dbo.BRONZE_ZENOTI_COST_OF_GOODS
                                WHERE CAST(transaction_date AS DATE) BETWEEN @s AND @e);
-- accrual = line-item net sales (matches the fixed utils/cogs.py). Do NOT dedupe by
-- invoice_id/total_sales_exc_tax — invoice_id is per-line, which inflated this ~300x.
DECLARE @accrual_sales FLOAT = (SELECT SUM(sales_exc_tax) FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL
                                WHERE CAST(sale_date AS DATE) BETWEEN @s AND @e);
-- Prior-year cash uses the SAME cash filter as current AND the same elapsed days
-- (@pye = one year before the latest current-data day), matching the fixed mtd.py.
DECLARE @py_cash FLOAT = (SELECT SUM(sales_collected_exc_tax) FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS
                          WHERE CAST(payment_date AS DATE) BETWEEN @pys AND @pye
                            AND ((',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,card,%'
                              OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,cash,%'
                              OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,check,%'
                              OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,custom - %'));

PRINT 'Window: ' + CONVERT(VARCHAR, @s) + ' to ' + CONVERT(VARCHAR, @e);

/* ---------- A) CASH-BASED REVENUE & ASP ---------- */
;WITH gc AS (
    SELECT guest_name, MAX(CASE WHEN LOWER(first_visit)='yes' THEN 1 ELSE 0 END) AS is_new
    FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS
    WHERE CAST(payment_date AS DATE) BETWEEN @s AND @e
      AND ((',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,card,%'
        OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,cash,%'
        OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,check,%'
        OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(payment_type))), ', ', ',') + ',') LIKE '%,custom - %')
    GROUP BY guest_name
),
c AS (
    SELECT c.*, gc.is_new
    FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS c
    JOIN gc ON gc.guest_name = c.guest_name
    WHERE CAST(c.payment_date AS DATE) BETWEEN @s AND @e
      AND ((',' + REPLACE(LOWER(LTRIM(RTRIM(c.payment_type))), ', ', ',') + ',') LIKE '%,card,%'
        OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(c.payment_type))), ', ', ',') + ',') LIKE '%,cash,%'
        OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(c.payment_type))), ', ', ',') + ',') LIKE '%,check,%'
        OR  (',' + REPLACE(LOWER(LTRIM(RTRIM(c.payment_type))), ', ', ',') + ',') LIKE '%,custom - %')
)
SELECT 'Cash Sales (MTD)' AS metric,
       CAST(SUM(sales_collected_exc_tax) AS DECIMAL(18,2)) AS numerator,
       CAST(NULL AS DECIMAL(18,2))                          AS denominator,
       CAST(SUM(sales_collected_exc_tax) AS DECIMAL(18,2)) AS computed_value,
       '$1.29M' AS dashboard_shows FROM c
UNION ALL SELECT 'Cash Run Rate (Projected)',
       CAST(SUM(sales_collected_exc_tax) AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CAST(payment_date AS DATE)) AS DECIMAL(18,2)),
       CAST(SUM(sales_collected_exc_tax)/NULLIF(COUNT(DISTINCT CAST(payment_date AS DATE)),0)*@dim AS DECIMAL(18,2)), '$1.30M' FROM c
UNION ALL SELECT '% to Budget',
       CAST(SUM(sales_collected_exc_tax) AS DECIMAL(18,2)),
       CAST(@budget AS DECIMAL(18,2)),
       CAST(SUM(sales_collected_exc_tax)/NULLIF(@budget,0)*100 AS DECIMAL(18,2)), '67%' FROM c
UNION ALL SELECT 'Prior Day Sales',
       CAST((SELECT SUM(sales_collected_exc_tax) FROM c WHERE CAST(payment_date AS DATE)=(SELECT MAX(CAST(payment_date AS DATE)) FROM c)) AS DECIMAL(18,2)),
       CAST(NULL AS DECIMAL(18,2)),
       CAST((SELECT SUM(sales_collected_exc_tax) FROM c WHERE CAST(payment_date AS DATE)=(SELECT MAX(CAST(payment_date AS DATE)) FROM c)) AS DECIMAL(18,2)), '$75K'
UNION ALL SELECT 'ASP (New)',
       CAST(SUM(CASE WHEN is_new=1 AND item_category<>'Memberships' THEN sales_collected_exc_tax ELSE 0 END) AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CASE WHEN is_new=1 AND item_category<>'Memberships' AND sales_collected_exc_tax>0 THEN CONCAT(guest_name,'|',CAST(payment_date AS DATE)) END) AS DECIMAL(18,2)),
       CAST(SUM(CASE WHEN is_new=1 AND item_category<>'Memberships' THEN sales_collected_exc_tax ELSE 0 END)
          / NULLIF(COUNT(DISTINCT CASE WHEN is_new=1 AND item_category<>'Memberships' AND sales_collected_exc_tax>0 THEN CONCAT(guest_name,'|',CAST(payment_date AS DATE)) END),0) AS DECIMAL(18,2)), '$408' FROM c
UNION ALL SELECT 'ASP (Existing)',
       CAST(SUM(CASE WHEN is_new=0 AND item_category<>'Memberships' THEN sales_collected_exc_tax ELSE 0 END) AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CASE WHEN is_new=0 AND item_category<>'Memberships' AND sales_collected_exc_tax>0 THEN CONCAT(guest_name,'|',CAST(payment_date AS DATE)) END) AS DECIMAL(18,2)),
       CAST(SUM(CASE WHEN is_new=0 AND item_category<>'Memberships' THEN sales_collected_exc_tax ELSE 0 END)
          / NULLIF(COUNT(DISTINCT CASE WHEN is_new=0 AND item_category<>'Memberships' AND sales_collected_exc_tax>0 THEN CONCAT(guest_name,'|',CAST(payment_date AS DATE)) END),0) AS DECIMAL(18,2)), '$285' FROM c
UNION ALL SELECT 'Membership Adoption %',
       CAST(COUNT(DISTINCT CASE WHEN item_category='Memberships' THEN guest_name END) AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CASE WHEN LOWER(member)='no' THEN guest_name END) AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CASE WHEN item_category='Memberships' THEN guest_name END)*100.0
          / NULLIF(COUNT(DISTINCT CASE WHEN LOWER(member)='no' THEN guest_name END),0) AS DECIMAL(18,2)), '0.18% (after fix)' FROM c
UNION ALL SELECT 'New Customer Visits',
       CAST(COUNT(DISTINCT CASE WHEN is_new=1 THEN guest_name END) AS DECIMAL(18,2)),
       CAST(NULL AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CASE WHEN is_new=1 THEN guest_name END) AS DECIMAL(18,2)), '605' FROM c
UNION ALL SELECT 'Existing Customer Visits',
       CAST(COUNT(DISTINCT CASE WHEN is_new=0 THEN guest_name END) AS DECIMAL(18,2)),
       CAST(NULL AS DECIMAL(18,2)),
       CAST(COUNT(DISTINCT CASE WHEN is_new=0 THEN guest_name END) AS DECIMAL(18,2)), '3,183' FROM c
UNION ALL SELECT 'SSS Growth YoY %',
       CAST(SUM(sales_collected_exc_tax) AS DECIMAL(18,2)),       -- current cash
       CAST(@py_cash AS DECIMAL(18,2)),                            -- prior-year cash
       CAST((SUM(sales_collected_exc_tax)-@py_cash)/NULLIF(@py_cash,0)*100 AS DECIMAL(18,2)), '+1.6% (after fix)' FROM c;

/* ---------- B) RECOGNIZED REVENUE (accrual) ---------- */
SELECT 'Recognized Revenue (MTD)' AS metric,
       CAST(SUM(sales_inc_tax) AS DECIMAL(18,2)) AS numerator,
       CAST(NULL AS DECIMAL(18,2))               AS denominator,
       CAST(SUM(sales_inc_tax) AS DECIMAL(18,2)) AS computed_value, '$1.58M' AS dashboard_shows
FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL WHERE CAST(sale_date AS DATE) BETWEEN @s AND @e;

/* ---------- C) COGS MARGIN (with components) ----------
   accrual_sales = SUM(sales_exc_tax) (line-item net sales). Expect ~$1.3-1.4M and a
   margin of ~24-25% once current-month COGS data is loaded. */
SELECT 'COGS Margin %' AS metric,
       CAST(@total_cogs    AS DECIMAL(18,2)) AS total_cogs,
       CAST(@accrual_sales AS DECIMAL(18,2)) AS accrual_sales,
       CAST(@total_cogs / NULLIF(@accrual_sales,0) * 100 AS DECIMAL(18,2)) AS computed_value,
       '~24-25% (after fix)' AS dashboard_shows;

/* ---------- D) APPOINTMENT METRICS (invoice-based) ---------- */
SELECT 'No-Show Rate %' AS metric,
    CAST(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)='no show' THEN invoice_no END) AS DECIMAL(18,2)) AS numerator,
    CAST(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)<>'deleted' THEN invoice_no END) AS DECIMAL(18,2)) AS denominator,
    CAST(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)='no show' THEN invoice_no END)*100.0
       / NULLIF(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)<>'deleted' THEN invoice_no END),0) AS DECIMAL(18,2)) AS computed_value, '0.6%' AS dashboard_shows
FROM dbo.BRONZE_ZENOTI_APPOINTMENTS WHERE CAST(appointment_date AS DATE) BETWEEN @s AND @e
UNION ALL SELECT 'Cancellation Rate %',
    CAST(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)='cancelled' THEN invoice_no END) AS DECIMAL(18,2)),
    CAST(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)<>'deleted' THEN invoice_no END) AS DECIMAL(18,2)),
    CAST(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)='cancelled' THEN invoice_no END)*100.0
       / NULLIF(COUNT(DISTINCT CASE WHEN add_on='No' AND LOWER(status)<>'deleted' THEN invoice_no END),0) AS DECIMAL(18,2)), '21.5%'
FROM dbo.BRONZE_ZENOTI_APPOINTMENTS WHERE CAST(appointment_date AS DATE) BETWEEN @s AND @e
UNION ALL SELECT 'Rebook Rate %',
    CAST(COUNT(DISTINCT CASE WHEN LOWER(rebooked)='yes' THEN invoice_no END) AS DECIMAL(18,2)),
    CAST(COUNT(DISTINCT invoice_no) AS DECIMAL(18,2)),
    CAST(COUNT(DISTINCT CASE WHEN LOWER(rebooked)='yes' THEN invoice_no END)*100.0
       / NULLIF(COUNT(DISTINCT invoice_no),0) AS DECIMAL(18,2)), '32.2%'
FROM dbo.BRONZE_ZENOTI_APPOINTMENTS
WHERE CAST(appointment_date AS DATE) BETWEEN @s AND @e AND LOWER(status)='closed' AND add_on='No';

/* ---------- E) UTILIZATION & REV/HR (schedule + accrual) ---------- */
;WITH sch AS (
    SELECT center_name, employee_name, job_name, CAST(date AS DATE) AS work_date,
        SUM(CASE WHEN booked_hours LIKE '%:%'
                 THEN CAST(SUBSTRING(booked_hours,1,CHARINDEX(':',booked_hours)-1) AS FLOAT)
                    + CAST(SUBSTRING(booked_hours,CHARINDEX(':',booked_hours)+1,LEN(booked_hours)) AS FLOAT)/60.0
                 ELSE COALESCE(TRY_CAST(booked_hours AS FLOAT),0) END) AS booked,
        SUM(CASE WHEN scheduled_hours LIKE '%:%'
                 THEN CAST(SUBSTRING(scheduled_hours,1,CHARINDEX(':',scheduled_hours)-1) AS FLOAT)
                    + CAST(SUBSTRING(scheduled_hours,CHARINDEX(':',scheduled_hours)+1,LEN(scheduled_hours)) AS FLOAT)/60.0
                 ELSE COALESCE(TRY_CAST(scheduled_hours AS FLOAT),0) END)
      - SUM(CASE WHEN block_out_hours_paid LIKE '%:%'
                 THEN CAST(SUBSTRING(block_out_hours_paid,1,CHARINDEX(':',block_out_hours_paid)-1) AS FLOAT)
                    + CAST(SUBSTRING(block_out_hours_paid,CHARINDEX(':',block_out_hours_paid)+1,LEN(block_out_hours_paid)) AS FLOAT)/60.0
                 ELSE COALESCE(TRY_CAST(block_out_hours_paid AS FLOAT),0) END) AS avail
    FROM dbo.BRONZE_ZENOTI_EMPLOYEE_SCHEDULES
    WHERE CAST(date AS DATE) BETWEEN @s AND @e
      AND job_name IN ('Treatment Provider','Esthetician')
    GROUP BY center_name, employee_name, job_name, CAST(date AS DATE)
),
sa AS (
    SELECT center_name, serviced_by, CAST(sale_date AS DATE) AS sale_date, SUM(sales_exc_tax) AS rev
    FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL
    WHERE CAST(sale_date AS DATE) BETWEEN @s AND @e
    GROUP BY center_name, serviced_by, CAST(sale_date AS DATE)
),
joined AS (
    SELECT s2.*, COALESCE(sa.rev,0) AS rev
    FROM sch s2 LEFT JOIN sa
      ON sa.serviced_by=s2.employee_name AND sa.sale_date=s2.work_date AND sa.center_name=s2.center_name
)
SELECT 'Utilization Provider %' AS metric,
    CAST(SUM(CASE WHEN job_name='Treatment Provider' THEN booked ELSE 0 END) AS DECIMAL(18,2)) AS booked_hrs,
    CAST(SUM(CASE WHEN job_name='Treatment Provider' THEN avail  ELSE 0 END) AS DECIMAL(18,2)) AS available_hrs,
    CAST(SUM(CASE WHEN job_name='Treatment Provider' THEN booked ELSE 0 END)*100.0
       / NULLIF(SUM(CASE WHEN job_name='Treatment Provider' THEN avail ELSE 0 END),0) AS DECIMAL(18,2)) AS computed_value, '71.7%' AS dashboard_shows
FROM sch
UNION ALL SELECT 'Utilization Esthetician %',
    CAST(SUM(CASE WHEN job_name='Esthetician' THEN booked ELSE 0 END) AS DECIMAL(18,2)),
    CAST(SUM(CASE WHEN job_name='Esthetician' THEN avail  ELSE 0 END) AS DECIMAL(18,2)),
    CAST(SUM(CASE WHEN job_name='Esthetician' THEN booked ELSE 0 END)*100.0
       / NULLIF(SUM(CASE WHEN job_name='Esthetician' THEN avail ELSE 0 END),0) AS DECIMAL(18,2)), '48.5%'
FROM sch
UNION ALL SELECT 'Rev/Hr Provider',
    CAST(SUM(CASE WHEN job_name='Treatment Provider' THEN rev    ELSE 0 END) AS DECIMAL(18,2)),
    CAST(SUM(CASE WHEN job_name='Treatment Provider' THEN booked ELSE 0 END) AS DECIMAL(18,2)),
    CAST(SUM(CASE WHEN job_name='Treatment Provider' THEN rev    ELSE 0 END)
       / NULLIF(SUM(CASE WHEN job_name='Treatment Provider' THEN booked ELSE 0 END),0) AS DECIMAL(18,2)), '$633'
FROM joined
UNION ALL SELECT 'Rev/Hr Esthetician',
    CAST(SUM(CASE WHEN job_name='Esthetician' THEN rev    ELSE 0 END) AS DECIMAL(18,2)),
    CAST(SUM(CASE WHEN job_name='Esthetician' THEN booked ELSE 0 END) AS DECIMAL(18,2)),
    CAST(SUM(CASE WHEN job_name='Esthetician' THEN rev    ELSE 0 END)
       / NULLIF(SUM(CASE WHEN job_name='Esthetician' THEN booked ELSE 0 END),0) AS DECIMAL(18,2)), '$182'
FROM joined;

/* ---------- F) PAYROLL / SALARY MARGIN ----------
   Salary margin needs 250 inlined wage/FFS rates, so it lives in its own generated
   file: VERIFY_PAYROLL.sql (regenerate via scripts/build_payroll_json.py + the
   generator). Run that script for per-location salary, components, and salary_margin_pct. */

/* ---------- G) CASH RUN RATE (working days) ----------
   Working-days run rate inlines the current month's per-location open days, so it lives
   in its own generated file: VERIFY_RUNRATE.sql (regenerate monthly from operating_days.json).
   Returns per-location mtd_cash | elapsed_wd | total_wd | run_rate, plus a CHAIN TOTAL.
   NOTE: the "Cash Run Rate (Projected)" row in section A above uses the OLD data-days x calendar
   formula and is superseded by VERIFY_RUNRATE.sql. */

/* ---------- H) PER-LOCATION ESTHETICIAN REV / BOOKED HOUR (reference method) ----------
   Replicates utils/rev_hour._role_rev_hours_by_center(role='esthetician') and the
   per-location override in routers/operations.py — the method BOTH the Operations-table
   "Esth Rev/Hr" column and the KPI header card now use (card = CHAIN TOTAL row below).
   Read-only.

   Method (matches the agreed reference SQL):
     • schedule aggregated per (center, employee) for job_name = 'Esthetician' with a
       positive scheduled_hours (a real working shift); booked hours via an HH:MM(:SS)-safe
       TRY_CAST parser;
     • revenue attributed by sold_by, joined to schedule on employee_name + center ONLY
       (no per-day join), so an off-schedule-day sale still counts;
     • per-center rev/hr = SUM(revenue) / SUM(booked_hours); CHAIN TOTAL = the same totals.

   Window = month-to-date through the latest day with SALES data (MAX(sale_date)), so @end
   auto-advances as data lands. Anchoring on revenue keeps the numerator (sales) and the
   denominator (booked hours) on the SAME realized period — it never divides earned revenue
   by not-yet-worked / future-booked schedule hours, which a calendar-today or month-end
   window can do. The dashboard sends month-end; this matches it as long as there are no
   future-dated booked esthetician hours in the month (the normal case). If they ever
   diverge, the month-end dashboard figure is being diluted by future hours — flag it.
   SUPERSEDES the "Rev/Hr Esthetician" / "Rev/Hr Provider" rows in section E above, which
   use the OLD per-day-join-on-serviced_by method. */
DECLARE @rh_end   DATE = (SELECT MAX(CAST(sale_date AS DATE)) FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL);
DECLARE @rh_start DATE = DATEFROMPARTS(YEAR(@rh_end), MONTH(@rh_end), 1);

;WITH sched AS (
    SELECT center_name, employee_name,
           SUM(
               CASE
                   WHEN booked_hours IS NULL OR booked_hours = '' THEN 0
                   WHEN CHARINDEX(':', booked_hours) > 0 THEN
                         COALESCE(TRY_CAST(LEFT(booked_hours, CHARINDEX(':', booked_hours) - 1) AS FLOAT), 0)
                       + COALESCE(TRY_CAST(SUBSTRING(booked_hours, CHARINDEX(':', booked_hours) + 1, 2) AS FLOAT), 0) / 60.0
                       + COALESCE(TRY_CAST(NULLIF(SUBSTRING(booked_hours, CHARINDEX(':', booked_hours) + 4, 2), '') AS FLOAT), 0) / 3600.0
                   ELSE COALESCE(TRY_CAST(booked_hours AS FLOAT), 0)
               END
           ) AS booked_hours
    FROM dbo.BRONZE_ZENOTI_EMPLOYEE_SCHEDULES
    WHERE CAST(date AS DATE) BETWEEN @rh_start AND @rh_end
      AND LOWER(job_name) = 'esthetician'
      AND scheduled_hours IS NOT NULL
      AND scheduled_hours NOT IN ('', '0', '0:00', '00:00')
      AND employee_name IS NOT NULL
    GROUP BY center_name, employee_name
),
sales AS (
    SELECT sa.center_name, sa.sold_by AS employee_name,
           SUM(sa.sales_exc_tax) AS revenue
    FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL sa
    WHERE CAST(sa.sale_date AS DATE) BETWEEN @rh_start AND @rh_end
      AND EXISTS (
            SELECT 1 FROM sched sc
            WHERE sc.employee_name = sa.sold_by
              AND sc.center_name   = sa.center_name
      )
    GROUP BY sa.center_name, sa.sold_by
),
per_emp AS (
    SELECT sch.center_name,
           sch.booked_hours,
           COALESCE(sa.revenue, 0) AS revenue
    FROM sched sch
    LEFT JOIN sales sa
           ON sa.employee_name = sch.employee_name
          AND sa.center_name   = sch.center_name
)
SELECT
    center_name,
    CAST(SUM(revenue)      AS DECIMAL(18,2))                                AS esth_revenue,
    CAST(SUM(booked_hours) AS DECIMAL(18,2))                                AS esth_booked_hours,
    CAST(SUM(revenue) / NULLIF(SUM(booked_hours), 0) AS DECIMAL(18,2))      AS rev_per_booked_hour
FROM per_emp
GROUP BY center_name
UNION ALL
SELECT 'CHAIN TOTAL',
    CAST(SUM(revenue)      AS DECIMAL(18,2)),
    CAST(SUM(booked_hours) AS DECIMAL(18,2)),
    CAST(SUM(revenue) / NULLIF(SUM(booked_hours), 0) AS DECIMAL(18,2))
FROM per_emp
ORDER BY CASE WHEN center_name = 'CHAIN TOTAL' THEN 1 ELSE 0 END, rev_per_booked_hour DESC;
