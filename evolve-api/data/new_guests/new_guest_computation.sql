/*───────────────────────────────────────────────────────────────────────────
  New Guest computation in SQL  (SQL Server / T-SQL)

  Faithful translation of the Power BI measures (source of truth — DO NOT edit
  the DAX; this only reproduces it in SQL):

    First Visited - New   = cohort override OR MIN(PaymentDateInCenter) per user
    Adjusted Payment Date = pre-2022 payments remapped to First Visited - New
    First Visit (flag)     = 1 when a row's Adjusted Payment Date = user's first
                             (adjusted) visit date, else 0
    New Guest Excl $0      = COUNT(DISTINCT UserId) where First Visit = 1
                             OR MembershipVersionId = 'Not Applicable'

  Design (correct + fast): materialize the per-user first-visit date once per
  refresh (the expensive full-history MIN), then a live view applies the cheap
  row-level adjusted-date + flag logic. See evolve-api CLAUDE notes.

  ── DECISIONS BAKED IN ──────────────────────────────────────────────────────
   • No "Historical Cohorts" source in SQL → First Visited - New is approximated
     as MIN(PaymentDateInCenter). This drops the pre-2022 revision; recent-month
     New Guest counts are unaffected. If a cohort table is added later, LEFT JOIN
     it in step 1 and COALESCE(revised, MIN(...)).
   • Non-membership marker = 'Not Applicable' (per the commented variant). The
     ACTIVE measure used 'Non Applicable' — VERIFY the real literal:
        SELECT DISTINCT MembershipVersionId FROM dbo.Bi_FactCollections_s3;
     and change @NON_MEMBERSHIP below if needed.

  ── ⚠ VALIDATE BEFORE TRUSTING ──────────────────────────────────────────────
   1. OR vs AND: the ACTIVE measure uses  first_visit=1 OR membership='...'.
      The commented variant uses first_visit=1 AND membership='...'. These differ
      by orders of magnitude. Replicated here as OR (faithful to the active one).
      If the count doesn't tie out, switch to AND (see the flagged line below).
   2. Tie the June total to the known-good CSV export: it should equal 1014
      (data/new_guests_daily.json, 2026-06-01..2026-06-30, all centers).
   3. IsDeleted / Void / $0 filters are left OFF to match the raw DAX. If the
      Power BI model applies them globally, uncomment the guards in step 1 & 2.
───────────────────────────────────────────────────────────────────────────*/

-- Tunable literal for the non-membership marker (see decision note above).
DECLARE @NON_MEMBERSHIP nvarchar(50) = N'Not Applicable';

/*── Step 0: helpful indexes (run once) ─────────────────────────────────────*/
-- CREATE INDEX IX_FactColl_UserId  ON dbo.Bi_FactCollections_s3 (UserId);
-- CREATE INDEX IX_FactColl_PayDate ON dbo.Bi_FactCollections_s3 (PaymentDateInCenter) INCLUDE (UserId, MembershipVersionId);

/*── Step 1: per-user first-visit date (MATERIALIZED — refresh nightly) ──────
  One row per user. This is the only full-history scan; everything downstream
  joins to this small table. Refresh = TRUNCATE + INSERT after each ETL load. */
IF OBJECT_ID('dbo.NewGuest_UserFirstVisit', 'U') IS NULL
BEGIN
    -- UserId matches Bi_FactCollections_s3.UserId, which is a string (GUID-like),
    -- NOT bigint. Adjust the length if your column is wider than nvarchar(100).
    CREATE TABLE dbo.NewGuest_UserFirstVisit (
        UserId            nvarchar(100) NOT NULL PRIMARY KEY,
        first_visit_date  date          NULL
    );
END;

TRUNCATE TABLE dbo.NewGuest_UserFirstVisit;

INSERT INTO dbo.NewGuest_UserFirstVisit (UserId, first_visit_date)
SELECT fc.UserId,
       CAST(MIN(fc.PaymentDateInCenter) AS date) AS first_visit_date
FROM dbo.Bi_FactCollections_s3 fc
WHERE fc.PaymentDateInCenter IS NOT NULL                    -- ignore rows with no payment date (removes the NULL-aggregate warning)
-- AND fc.IsDeleted = 0 AND ISNULL(fc.Void, 0) = 0          -- see VALIDATE #3
GROUP BY fc.UserId;

/*── Step 2: live view — adjusted payment date + First Visit flag per row ────
  With no cohort override, MIN(adjusted) = first_visit_date, so the flag reduces
  to "this row's adjusted date equals the user's first-visit date". */
GO
CREATE OR ALTER VIEW dbo.V_NewGuest_Collections AS
SELECT
    fc.factcollectionid,
    fc.UserId,
    fc.CenterId,
    fc.MembershipVersionId,
    fc.PaymentDateInCenter,
    uf.first_visit_date,
    CAST(
        CASE WHEN uf.first_visit_date IS NOT NULL
                  AND fc.PaymentDateInCenter < '2022-01-01'
             THEN uf.first_visit_date
             ELSE fc.PaymentDateInCenter
        END AS date)                                        AS adjusted_payment_date,
    CASE WHEN CAST(
              CASE WHEN uf.first_visit_date IS NOT NULL
                        AND fc.PaymentDateInCenter < '2022-01-01'
                   THEN uf.first_visit_date
                   ELSE fc.PaymentDateInCenter END AS date) = uf.first_visit_date
         THEN 1 ELSE 0 END                                  AS first_visit_flag
FROM dbo.Bi_FactCollections_s3 fc
JOIN dbo.NewGuest_UserFirstVisit uf ON uf.UserId = fc.UserId;
-- WHERE fc.IsDeleted = 0 AND ISNULL(fc.Void, 0) = 0        -- see VALIDATE #3
GO

/*── Step 3a: New Guest count for a date range (+ optional center filter) ────*/
--  New Guest Excl $0 — faithful to the ACTIVE measure (OR). See VALIDATE #1.
DECLARE @start date = '2026-06-01', @end date = '2026-06-30';
SELECT COUNT(DISTINCT UserId) AS new_guest_excl_0
FROM dbo.V_NewGuest_Collections
WHERE adjusted_payment_date BETWEEN @start AND @end
  AND (
        first_visit_flag = 1
        OR MembershipVersionId = @NON_MEMBERSHIP          -- ← switch OR→AND here if it overcounts
      );

/*── Step 3b: daily × center rollup (mirrors the CSV export shape) ───────────
  Attributes each new guest to the center/day of their first-visit row. Note:
  CenterId is numeric here; join a center dimension to get names like the CSV
  ("Waldorf, MD") if you want a drop-in replacement for new_guests_daily.json. */
-- SELECT adjusted_payment_date AS visit_date, CenterId,
--        COUNT(DISTINCT UserId) AS new_guests
-- FROM dbo.V_NewGuest_Collections
-- WHERE first_visit_flag = 1
-- GROUP BY adjusted_payment_date, CenterId
-- ORDER BY visit_date, CenterId;
