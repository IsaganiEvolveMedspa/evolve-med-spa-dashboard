# Zenoti -> KPI Mapping (MTD report rules encoded)

## Filters applied everywhere
- **Cash sales** rows: `payment_type IN ('Cash','Card','Check','Custom - Financial','Custom Non Financial')`
- **Accrual revenue** rows: `item_type IN ('Service','Product')`
- **Member flag**: `member` column in the cash report

## Metrics now wired
| Endpoint | Metric | Rule encoded |
|----------|--------|--------------|
| /api/finance | Recognized Revenue, COGS, Gross Margin | accrual, item_type service+product |
| /api/cash | Total Cash Sales | cash-filtered `collected` |
| /api/cash | Total Visits | SUM over month of (DISTINCT guest_name per day), invoice>0 |
| /api/cash | Total Customers | DISTINCT guest_name, invoice>0, non-membership |
| /api/cash | ASP | cash sales / per-day-unique guests (summed) |
| /api/membership | New Members | Bi_DimMembershipUser_s3, creation_date in month |
| /api/membership | Adoption Rate | (created & started same month) / non-member unique guests (cash) |
| /api/staff | Rev / Util Hr | accrual service revenue / booked hours |
| /api/staff | Utilization | booked / (scheduled - blockout paid) |
| /api/operations | No-show / Cancel / Rebook | appointment status |
| /api/locations | 12-mo momentum | cash-filtered monthly totals |

## STILL NEED FROM YOU (confirm with SELECT DISTINCT, or tell me)
1. **payment_type** exact strings — my guesses: 'Cash','Card','Check','Custom - Financial',
   'Custom Non Financial'. Run: `SELECT DISTINCT payment_type FROM BRONZE_ZENOTI_CASH_COLLECTIONS`
2. **item_type** values — assumed 'Service','Product'. Confirm capitalization.
3. **member** flag values — assumed 'Yes'/'1'. Confirm.
4. **Bi_DimMembershipUser_s3** columns — I assumed `creation_date`, `start_date`, `center_name`.
   Please send this table's schema (like the other 4 .txt files).
5. **Blockout hours paid** — no column for this in EMPLOYEE_SCHEDULES. Where does it live?
   Until provided, utilization uses blockout = 0 (so util = booked / scheduled).
6. **Provider vs Esthetician split** — needs job_name mapping. Which job_name values are
   providers vs estheticians? (Staff endpoint returns role=job_name for now, unsplit.)
7. **Payroll rate** — still the BLENDED_HOURLY_RATE env var (×1.12). Real source?

## Notes on tricky rules
- "unique guest_name PER DAY summed" is implemented as a grouped subquery (distinct per
  payment_date, then summed) — NOT distinct-over-the-month. A guest on 3 days = 3 visits.
- New Customers (Power BI "first closed invoice >$0") is not yet the exact logic; current
  customer counts use distinct guest_name with invoice>0. Say if you want the strict version.
