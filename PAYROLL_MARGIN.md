# Payroll / Salary Margin — Computation & Data Sources

Reference doc for how the dashboard's **Payroll % / Salary Margin** metric is
computed and which tables feed it. Read-only summary of `evolve-api/utils/payroll.py`
and the config aliases in `evolve-api/config.py`.

---

## 1. Formula

Per location (`center_name`), `compute_salary_by_center` returns:

```
salary margin %  =  salary / sales_accrual × 100
salary           =  base + ffs + comm + benefits
```

| Component | Definition |
|---|---|
| **base** | role hourly wage × Σ scheduled hours (per center + role) |
| **ffs** (fee-for-service) | per-syringe service → `Latest FFS × COGS qty`; otherwise → `Latest FFS × COUNT(DISTINCT invoice_no)` (qty ignored) |
| **comm** (commission) | `commission_rate (0.15)` × retail product sales (`item_category LIKE '%Retail%'`) |
| **benefits** | `(base + ffs + comm) × benefits_factor (0.125)` |
| **sales_accrual** *(denominator)* | Σ `sales_exc_tax`, **all categories** |

`salary_margin` is `None` when `sales_accrual` is 0 (nothing to divide by).

---

## 2. DB tables used

Three SQL Server queries run (one per source). Table names come from config
aliases, which are environment-overridable and swap to overlay VIEWS when
`OVERLAY_ENABLED=true`.

| Query | Config alias (env var) | Normal table | Overlay table | Date column | Fields used |
|---|---|---|---|---|---|
| Base salary | `FULL_SCHEDULE` (`SQL_SCHEDULE_TABLE`) | `dbo.employee_schedule` *(default)* — prod: `BRONZE_ZENOTI_EMPLOYEE_SCHEDULES` | `dbo.V_ZENOTI_EMPLOYEE_SCHEDULES` | `date` | `center_name`, `job_name`, `scheduled_hours` |
| FFS | `FULL_COGS` (`SQL_COGS_TABLE`) | `dbo.BRONZE_ZENOTI_COST_OF_GOODS` | `dbo.V_ZENOTI_COST_OF_GOODS` | `transaction_date` | `center_name`, `service_name`, `qty`, `invoice_no` |
| Sales accrual + commissionable | `FULL_SALES` (`SQL_SALES_TABLE`) | `dbo.sales_accrual` *(default)* — prod: `BRONZE_ZENOTI_SALES_ACCRUAL` | `dbo.V_ZENOTI_SALES_ACCRUAL` | `sale_date` | `center_name`, `sales_exc_tax`, `item_category` |

> **Note on defaults vs prod:** `FULL_SALES` and `FULL_SCHEDULE` default to
> `dbo.sales_accrual` / `dbo.employee_schedule`, but are overridden in prod via
> `SQL_SALES_TABLE` / `SQL_SCHEDULE_TABLE` to the `BRONZE_ZENOTI_*` tables (the
> names used throughout `VERIFY_METRICS.sql`). Confirm the deployed env to be
> certain which physical table is live.

---

## 3. Static (non-DB) inputs

Rates come from `evolve-api/data/payroll_schedules.json` (built from the
supporting-schedules Excel via `scripts/build_payroll_json.py`), **not** any table:

- `wages` — role → hourly wage
- `ffs` — service → `{ latest_ffs, per_syringe }`
- `benefits_factor` — default `0.125`
- `commission_rate` — default `0.15`

If the JSON is missing/unreadable, `compute_salary_by_center` returns `{}` (no
salary rows).

---

## 4. Verification

A dedicated read-only verifier exists: **`VERIFY_PAYROLL.sql`** (generated,
because it inlines the ~250 wage / FFS rates). Referenced in
`VERIFY_METRICS.sql:196-199`. Regenerate via `scripts/build_payroll_json.py`
plus the generator, then run on `sql-prod-cus-evolve`.

---

## 5. Source references

- `evolve-api/utils/payroll.py` — `compute_salary_by_center`, `salary_margin_pct`
- `evolve-api/config.py:129-153` — table aliases / env vars
- `evolve-api/config.py:180-185` — overlay VIEW swap
- `evolve-api/data/payroll_schedules.json` — static rates
