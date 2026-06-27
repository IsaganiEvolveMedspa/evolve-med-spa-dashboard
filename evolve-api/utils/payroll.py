"""
Salary / payroll-margin model (per location), combining the bundled static
schedules with live DB data.

  base salary      = Σ  role hourly wage × scheduled_hours          (wages JSON × schedule DB)
  ffs              = Σ  Latest FFS × qty   (per-syringe → COGS qty; else 1 per row)
  comm             = 15% × sales_exc_tax
  benefits & taxes = (base + ffs + comm) × benefits_factor (0.125)
  salary           = base + ffs + comm + benefits
  salary margin %  = salary / sales accrual (SUM sales_exc_tax) × 100

Static inputs (wages, FFS rates, per-syringe flags, factors) come from
data/payroll_schedules.json (built from the supporting-schedules Excel via
scripts/build_payroll_json.py). Hours/qty/sales come from the DB.
"""
import json
import os
from functools import lru_cache
from typing import Optional

from config import FULL_SCHEDULE, FULL_COGS, FULL_SALES
from db import run_query
from utils.filters import build_date_filter, hhmm_to_hours

_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "data", "payroll_schedules.json")


@lru_cache(maxsize=1)
def _schedules() -> dict:
    try:
        with open(_JSON, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def compute_salary_by_center(
    s: str,
    e: str,
    locations: Optional[list[str]],
) -> dict[str, dict[str, float]]:
    """Return {center_name: {base, ffs, comm, benefits, salary, sales_accrual, salary_margin}}."""
    cfg = _schedules()
    if not cfg:
        return {}
    wages          = cfg.get("wages", {})
    ffs_tbl        = cfg.get("ffs", {})
    benefits_f     = float(cfg.get("benefits_factor", 0.125))
    comm_rate      = float(cfg.get("commission_rate", 0.15))

    sched_where, sched_p = build_date_filter(s, e, locations, date_col="date")
    cogs_where,  cogs_p  = build_date_filter(s, e, locations, date_col="transaction_date")
    sales_where, sales_p = build_date_filter(s, e, locations, date_col="sale_date")

    # ── base salary: role hourly wage × scheduled hours, per center+role ──
    base_sql = f"""
        SELECT center_name, LOWER(job_name) AS role,
               SUM({hhmm_to_hours('scheduled_hours')}) AS hrs
        FROM {FULL_SCHEDULE}
        {sched_where}
        GROUP BY center_name, job_name
    """
    base: dict[str, float] = {}
    for r in run_query(base_sql, sched_p or None):
        wage = wages.get(r["role"])
        if wage:
            base[r["center_name"]] = base.get(r["center_name"], 0.0) + wage * float(r["hrs"] or 0)

    # ── ffs: per-syringe='Y' → Latest FFS × COGS qty; else → Latest FFS once per
    #    service occurrence (COUNT(DISTINCT invoice_no)), qty ignored ──
    ffs_sql = f"""
        SELECT center_name, LOWER(service_name) AS service,
               SUM(qty) AS qty, COUNT(DISTINCT invoice_no) AS occ
        FROM {FULL_COGS}
        {cogs_where}
        {'AND' if cogs_where else 'WHERE'} service_name IS NOT NULL
        GROUP BY center_name, service_name
    """
    ffs: dict[str, float] = {}
    for r in run_query(ffs_sql, cogs_p or None):
        item = ffs_tbl.get(r["service"])
        if not item:
            continue
        units = float(r["qty"] or 0) if item["per_syringe"] else float(r["occ"] or 0)
        ffs[r["center_name"]] = ffs.get(r["center_name"], 0.0) + item["latest_ffs"] * units

    # ── sales accrual (drives comm and the margin denominator), per center ──
    sales_sql = f"""
        SELECT center_name, SUM(sales_exc_tax) AS sales
        FROM {FULL_SALES}
        {sales_where}
        GROUP BY center_name
    """
    sales: dict[str, float] = {}
    for r in run_query(sales_sql, sales_p or None):
        sales[r["center_name"]] = float(r["sales"] or 0)

    out: dict[str, dict[str, float]] = {}
    for center in set(base) | set(ffs) | set(sales):
        b = base.get(center, 0.0)
        f = ffs.get(center, 0.0)
        accrual = sales.get(center, 0.0)
        c = comm_rate * accrual
        benefits = (b + f + c) * benefits_f
        salary = b + f + c + benefits
        out[center] = {
            "base": b, "ffs": f, "comm": c, "benefits": benefits,
            "salary": salary, "sales_accrual": accrual,
            "salary_margin": (salary / accrual * 100) if accrual else None,
        }
    return out


def salary_margin_pct(salary: float, sales_accrual: float) -> Optional[float]:
    """Salary margin %, or None when there is no accrual to divide by."""
    return (salary / sales_accrual * 100) if sales_accrual else None
