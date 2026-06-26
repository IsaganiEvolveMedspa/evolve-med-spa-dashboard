"""
COGS margin helper.

COGS Margin % = total cost of goods / sales accrual * 100, joined at location grain.

  - total cost of goods : SUM(cost_of_goods) from BRONZE_ZENOTI_COST_OF_GOODS
  - sales accrual       : SUM(sales_exc_tax) from the sales accrual table (line-item
                          grain, summed = net accrual sales). This matches how
                          recognized_revenue / ASP already sum the sales table.
                          NOTE: do NOT use total_sales_exc_tax deduped by invoice_id —
                          invoice_id is unique per LINE here, so it never dedupes and
                          the invoice total gets summed once per line, inflating the
                          denominator ~300x (verified: $459M vs the real ~$1.4M).

Computed as a separate lookup (rather than extra CTEs in the large operations /
mtd queries) to keep it isolated from those queries' positional-parameter ordering.
"""
from typing import Optional

from config import FULL_SALES, FULL_COGS
from db import run_query
from utils.filters import build_date_filter


def fetch_cogs_and_accrual(
    s: str,
    e: str,
    locations: Optional[list[str]],
) -> dict[str, dict[str, float]]:
    """Return {center_name: {'cogs': float, 'accrual': float}} for the period."""
    cogs_where,  cogs_p  = build_date_filter(s, e, locations, date_col="transaction_date")
    sales_where, sales_p = build_date_filter(s, e, locations, date_col="sale_date")

    cogs_sql = f"""
        SELECT center_name, SUM(cost_of_goods) AS total_cogs
        FROM {FULL_COGS}
        {cogs_where}
        GROUP BY center_name
    """
    accrual_sql = f"""
        SELECT center_name, SUM(sales_exc_tax) AS accrual_sales
        FROM {FULL_SALES}
        {sales_where}
        GROUP BY center_name
    """

    out: dict[str, dict[str, float]] = {}
    for r in run_query(cogs_sql, cogs_p or None):
        out.setdefault(r["center_name"], {})["cogs"] = float(r["total_cogs"] or 0)
    for r in run_query(accrual_sql, sales_p or None):
        out.setdefault(r["center_name"], {})["accrual"] = float(r["accrual_sales"] or 0)
    return out


def cogs_margin_pct(cogs: float, accrual: float) -> Optional[float]:
    """COGS margin %, or None when there is no accrual to divide by."""
    return (cogs / accrual * 100) if accrual else None


# Modeled payroll burden as % of sales accrual (no payroll feed yet): 22% × 1.12 tax.
PAYROLL_MARGIN_PCT = 22.0 * 1.12


def gross_margin_pct(
    cogs: float,
    accrual: float,
    payroll_pct: float = PAYROLL_MARGIN_PCT,
) -> Optional[float]:
    """Gross margin % = 100 − real COGS margin % − modeled payroll margin %."""
    cm = cogs_margin_pct(cogs, accrual)
    return None if cm is None else 100 - cm - payroll_pct
