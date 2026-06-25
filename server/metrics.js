// metrics.js — Zenoti bronze tables -> KPIs. Computation in Node.
// Encodes the MTD report rules provided by the business:
//
//   CASH filter:    payment_type IN (cash, card, check, custom - financial, custom non financial)
//   ACCRUAL filter: item_type IN (service, product)
//   ASP:            cash sales / unique guest_name PER DAY
//   Visits:         SUM over month of ( unique guest_name per day ), invoice value > 0
//   Customers:      unique guest_name, invoice value > 0, non-membership
//   Members:        Bi_DimMembershipUser_s3 (creation_date / start_date)
//   Adoption:       members created+started this month / non-member unique guests (cash report)
//   Utilization:    booked hours / (scheduled hours - blockout hours paid)
//
// CONFIRM markers note values that still need verification against real data.

import { query } from './db.js';

const num = (v) => Number(v || 0);
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const round = (n, d = 1) => Number((n || 0).toFixed(d));
const money = (n) => {
  n = num(n);
  if (Math.abs(n) >= 1000000) return `$${round(n / 1000000, 2)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
};

// ---- business filters (reused across queries) ----
// Cash payment types that count toward cash sales.
const CASH_PAYMENT_FILTER = `
  payment_type IN ('Cash','Card','Check','Custom - Financial','Custom Non Financial')
`; // CONFIRM exact strings via: SELECT DISTINCT payment_type FROM BRONZE_ZENOTI_CASH_COLLECTIONS
// Accrual rows that count as revenue: services + products only.
const ACCRUAL_ITEM_FILTER = `item_type IN ('Service','Product')`; // CONFIRM distinct item_type
// Membership flag in the cash report.
const MEMBER_YES = `member IN ('Yes','YES','1','True','true')`;     // CONFIRM distinct member

/* ----------------------------------------------------------------------------
 * FINANCE — accrual basis (item_type = service/product).
 * ------------------------------------------------------------------------- */
export async function getFinance({ month, location } = {}) {
  const acc = await query(
    `
    SELECT
      SUM(sales_exc_tax)     AS recognized_revenue,
      SUM(service_shop_cost) AS cogs
    FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL
    WHERE ${ACCRUAL_ITEM_FILTER}
      AND (@month IS NULL OR FORMAT(sale_date,'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    `,
    { month: month || null, location: location || null }
  );

  // Payroll: scheduled hours * blended rate * 1.12 (12% add-on per KPI def).
  const RATE = num(process.env.BLENDED_HOURLY_RATE) || 45; // CONFIRM real rate source
  const sched = await query(
    `
    SELECT SUM(TRY_CONVERT(decimal(18,2), scheduled_hours)) AS scheduled_hours
    FROM dbo.BRONZE_ZENOTI_EMPLOYEE_SCHEDULES
    WHERE (@month IS NULL OR FORMAT([date],'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    `,
    { month: month || null, location: location || null }
  );

  const revenue = num(acc[0]?.recognized_revenue);
  const cogs = num(acc[0]?.cogs);
  const payroll = num(sched[0]?.scheduled_hours) * RATE * 1.12;
  const grossProfit = revenue - cogs - payroll;

  return {
    kpis: [
      { label: 'RECOGNIZED REVENUE', value: money(revenue) },
      { label: 'GROSS PROFIT', value: money(grossProfit) },
      { label: 'GROSS MARGIN', value: `${round(pct(grossProfit, revenue))}%` },
      { label: 'COGS MARGIN', value: `${round(pct(cogs, revenue))}%` },
      { label: 'PAYROLL MARGIN', value: `${round(pct(payroll, revenue))}%` },
    ],
    raw: { revenue, cogs, payroll, grossProfit },
  };
}

/* ----------------------------------------------------------------------------
 * CASH / ASP / VISITS / CUSTOMERS — cash basis, with the cash payment filter.
 *   ASP            = cash sales / (unique guest_name per day)        [per-day distinct]
 *   Total Visits   = SUM over month of (unique guest_name per day), invoice value > 0
 *   Customers      = unique guest_name, invoice > 0, non-membership
 * ------------------------------------------------------------------------- */
export async function getCashKpis({ month, location } = {}) {
  const params = { month: month || null, location: location || null };
  const scope = `
    ${CASH_PAYMENT_FILTER}
    AND (@month IS NULL OR FORMAT(payment_date,'yyyy-MM') = @month)
    AND (@location IS NULL OR center_name = @location)
  `;

  // Total cash collected (cash-filtered).
  const cash = await query(
    `SELECT SUM(collected) AS total_cash,
            SUM(CASE WHEN ${MEMBER_YES} THEN collected ELSE 0 END) AS member_cash
     FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS WHERE ${scope}`,
    params
  );

  // Visits = sum of per-day distinct guests (invoice value > 0).
  const visits = await query(
    `
    SELECT SUM(daily_guests) AS total_visits FROM (
      SELECT payment_date, COUNT(DISTINCT guest_name) AS daily_guests
      FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS
      WHERE ${scope} AND collected > 0
      GROUP BY payment_date
    ) d
    `,
    params
  );

  // Customers = unique guests, invoice > 0, non-membership.
  const customers = await query(
    `
    SELECT COUNT(DISTINCT guest_name) AS total_customers
    FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS
    WHERE ${scope} AND collected > 0 AND NOT (${MEMBER_YES})
    `,
    params
  );

  // ASP = cash sales / per-day-unique guests (summed). Uses total_visits as the denominator
  // because that is the per-day unique-guest count summed across the month.
  const totalCash = num(cash[0]?.total_cash);
  const totalVisits = num(visits[0]?.total_visits);
  const totalCustomers = num(customers[0]?.total_customers);
  const asp = totalVisits ? totalCash / totalVisits : 0;

  return {
    kpis: [
      { label: 'TOTAL CASH SALES', value: money(totalCash) },
      { label: 'TOTAL VISITS', value: String(totalVisits) },
      { label: 'TOTAL CUSTOMERS', value: String(totalCustomers) },
      { label: 'ASP', value: money(asp) },
    ],
    raw: { totalCash, memberCash: num(cash[0]?.member_cash), totalVisits, totalCustomers, asp },
  };
}

/* ----------------------------------------------------------------------------
 * MEMBERSHIP — new members + adoption rate.
 *   New members  = rows in Bi_DimMembershipUser_s3 with creation_date in month.
 *   Adoption     = (created this month AND start in same month) / non-member unique guests (cash).
 * ------------------------------------------------------------------------- */
export async function getMembership({ month, location } = {}) {
  const params = { month: month || null, location: location || null };

  // New members + same-month-start members from the membership dimension.
  // CONFIRM column names: creation_date, start_date, center_name in Bi_DimMembershipUser_s3.
  const mem = await query(
    `
    SELECT
      COUNT(*) AS new_members,
      SUM(CASE WHEN FORMAT(start_date,'yyyy-MM') = FORMAT(creation_date,'yyyy-MM')
               THEN 1 ELSE 0 END) AS started_same_month
    FROM dbo.Bi_DimMembershipUser_s3
    WHERE (@month IS NULL OR FORMAT(creation_date,'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    `,
    params
  );

  // Non-member unique guests from cash report (denominator).
  const nonMembers = await query(
    `
    SELECT COUNT(DISTINCT guest_name) AS non_member_guests
    FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS
    WHERE ${CASH_PAYMENT_FILTER}
      AND collected > 0 AND NOT (${MEMBER_YES})
      AND (@month IS NULL OR FORMAT(payment_date,'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    `,
    params
  );

  const newMembers = num(mem[0]?.new_members);
  const sameMonth = num(mem[0]?.started_same_month);
  const denom = num(nonMembers[0]?.non_member_guests);

  return {
    kpis: [
      { label: 'NEW MEMBERS', value: String(newMembers) },
      { label: 'ADOPTION RATE', value: `${round(pct(sameMonth, denom))}%` },
    ],
    raw: { newMembers, sameMonth, nonMemberGuests: denom },
  };
}

/* ----------------------------------------------------------------------------
 * PROVIDER / ESTHETICIAN — Revenue per Utilized Hour, from accrual service revenue.
 *   Rev/Util Hr = service revenue (accrual) / utilized (service) hours.
 *   Utilization = booked hours / (scheduled hours - blockout hours paid).
 * ------------------------------------------------------------------------- */
export async function getStaffProductivity({ month, location } = {}) {
  const params = { month: month || null, location: location || null };

  // Service revenue by the person who serviced it (accrual, services only).
  // CONFIRM: serviced_by is the provider/esthetician name; role split needs job_name mapping.
  const rev = await query(
    `
    SELECT serviced_by, SUM(sales_exc_tax) AS service_rev
    FROM dbo.BRONZE_ZENOTI_SALES_ACCRUAL
    WHERE item_type = 'Service'
      AND (@month IS NULL OR FORMAT(sale_date,'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    GROUP BY serviced_by
    `,
    params
  );

  // Hours from schedules: booked vs scheduled. Blockout-paid not in schema -> see CONFIRM.
  const hrs = await query(
    `
    SELECT
      employee_name, job_name,
      SUM(TRY_CONVERT(decimal(18,2), booked_hours))    AS booked_hours,
      SUM(TRY_CONVERT(decimal(18,2), scheduled_hours)) AS scheduled_hours
    FROM dbo.BRONZE_ZENOTI_EMPLOYEE_SCHEDULES
    WHERE (@month IS NULL OR FORMAT([date],'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    GROUP BY employee_name, job_name
    `,
    params
  );

  // Compute in Node: utilization = booked / (scheduled - blockout). No blockout column yet,
  // so blockout = 0 until a source is provided (CONFIRM). Rev/util-hr = service_rev / booked.
  const revByName = new Map(rev.map((r) => [r.serviced_by, num(r.service_rev)]));
  const staff = hrs.map((h) => {
    const booked = num(h.booked_hours);
    const scheduled = num(h.scheduled_hours);
    const blockout = 0; // CONFIRM: source for "blockout hours paid"
    const util = pct(booked, scheduled - blockout);
    const serviceRev = revByName.get(h.employee_name) || 0;
    const revPerHr = booked ? serviceRev / booked : 0;
    return {
      name: h.employee_name, role: h.job_name,
      utilization: round(util), revPerUtilHr: round(revPerHr, 0),
    };
  });

  return { staff };
}

/* ----------------------------------------------------------------------------
 * OPERATIONS — no-shows, cancellations, rebooking (appointment status).
 * ------------------------------------------------------------------------- */
export async function getOperations({ month, location } = {}) {
  const appt = await query(
    `
    SELECT
      COUNT(*) AS total_appts,
      SUM(CASE WHEN status = 'No Show'   THEN 1 ELSE 0 END) AS no_shows,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancellations,
      SUM(CASE WHEN rebooked IN ('Yes','1','True') THEN 1 ELSE 0 END) AS rebooked,
      SUM(CASE WHEN status IN ('Closed','Completed') THEN 1 ELSE 0 END) AS completed
    FROM dbo.BRONZE_ZENOTI_APPOINTMENTS
    WHERE (@month IS NULL OR FORMAT(appointment_date,'yyyy-MM') = @month)
      AND (@location IS NULL OR center_name = @location)
    `,
    { month: month || null, location: location || null }
  );
  const a = appt[0] || {};
  const total = num(a.total_appts);
  const completed = num(a.completed) || 1;
  return {
    kpis: [
      { label: 'APPOINTMENTS', value: String(total) },
      { label: 'NO-SHOW RATE', value: `${round(pct(num(a.no_shows), total))}%` },
      { label: 'CANCELLATION RATE', value: `${round(pct(num(a.cancellations), total))}%` },
      { label: 'REBOOK RATE', value: `${round(pct(num(a.rebooked), completed))}%` },
    ],
    raw: a,
  };
}

/* ----------------------------------------------------------------------------
 * LOCATIONS — 12-month momentum (cash, cash-filtered).
 * ------------------------------------------------------------------------- */
export async function getLocationMatrix({ metric = 'total_sales' } = {}) {
  const rows = await query(
    `
    SELECT center_name AS location, FORMAT(payment_date,'yyyy-MM') AS period,
           SUM(collected) AS value
    FROM dbo.BRONZE_ZENOTI_CASH_COLLECTIONS
    WHERE ${CASH_PAYMENT_FILTER}
      AND payment_date >= DATEADD(month, -12, CAST(GETDATE() AS date))
    GROUP BY center_name, FORMAT(payment_date,'yyyy-MM')
    ORDER BY center_name, period
    `,
    {}
  );
  const byLoc = new Map();
  for (const r of rows) {
    if (!byLoc.has(r.location)) byLoc.set(r.location, []);
    byLoc.get(r.location).push(num(r.value));
  }
  const momentum = (s) => {
    if (s.length < 6) return 'Stable';
    const recent = s.slice(-3).reduce((x, y) => x + y, 0) / 3;
    const prior = s.slice(-6, -3).reduce((x, y) => x + y, 0) / 3;
    const ch = pct(recent - prior, prior || 1);
    return ch > 5 ? 'Accelerating' : ch < -5 ? 'Decelerating' : 'Stable';
  };
  const result = [...byLoc.entries()].map(([name, v]) => ({ name, v, m: momentum(v) }));
  const rank = { Accelerating: 0, Stable: 1, Decelerating: 2 };
  result.sort((x, y) => rank[x.m] - rank[y.m]);
  return { metric, rows: result };
}
