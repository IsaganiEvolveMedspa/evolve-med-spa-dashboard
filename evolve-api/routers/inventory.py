"""
Inventory analytics router — powers the dashboard's Inventory tab.

Source tables (BRONZE, live warehouse):
  • FULL_STOCK_LEDGER    — one row per stock transaction (movement).
  • FULL_STOCK_INVENTORY — current on-hand snapshot, one row per (center, product).

transaction_type buckets (the ledger's own enum) drive every movement figure:
  Purchases     : 'Stock-In from Purchase Order'          (+),
                  'Stock-Out from Purchase Order Return'  (−)
  COGS/Consumed : 'Service Consumption','CheckOut for Consumption','Sale' (+),
                  'Refund and Restock'                    (−)
  Net Transfers : 'Stock-In from Transfer Order','Stock-In from Transfer Order Return' (+),
                  'Stock-Out from Transfer Order','Stock-Out from Transfer Order Return' (−)
  Adjustments   : 'Added from Adjustment','Added from Audit' (+),
                  'Decreased from Adjustment','Decreased from Audit' (−)

ASSUMPTIONS (flagged — verify against live data, see Downloads/VERIFY_INVENTORY.sql):
  • transaction_cost is the DOLLAR MAGNITUDE of the line; sign is applied here from
    transaction_type (ABS()). If the source already stores it signed, drop the ABS().
  • balance_stock_cost is a per-(center,product) RUNNING cost balance; beginning =
    latest row before the window start, ending = latest row on/before the window end.
  • System cost = stock_cost_perpetual_avg. "Latest PO cost" = purchase_price on the
    latest 'Stock-In from Purchase Order' row (a realized receipt, not a PO document).
  • WOS uses the CURRENT snapshot on_hand_quantity (point-in-time).

Targets/thresholds below are business inputs (NOT in the data) — override via env if needed.

Dates are inlined (validated YYYY-MM-DD router params); location values stay
parameterised via loc_in(). All figures honour the location filter.
"""
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Query, Request

from config import FULL_STOCK_LEDGER as L, FULL_STOCK_INVENTORY as INV
from db import run_query, serialize_rows
from utils.filters import loc_in, merge_params
from utils.errors import log_and_raise_from_request

router = APIRouter()
log = logging.getLogger(__name__)

# ── Targets / thresholds (business inputs, env-overridable) ───────────────────
TURNOVER_TARGET = float(os.getenv("INV_TURNOVER_TARGET", "9.0"))
DEAD_DAYS       = int(os.getenv("INV_DEAD_DAYS", "90"))
WOS_CRITICAL    = float(os.getenv("INV_WOS_CRITICAL", "2.0"))
WOS_LOW         = float(os.getenv("INV_WOS_LOW", "4.5"))
WOS_OVERSTOCK   = float(os.getenv("INV_WOS_OVERSTOCK", "16.0"))
DRIFT_FLAG_PCT  = float(os.getenv("INV_DRIFT_FLAG_PCT", "10.0"))
COST_CHANGE_PCT = float(os.getenv("INV_COST_CHANGE_PCT", "10.0"))
TOP_N           = int(os.getenv("INV_TOP_N", "300"))   # cap per-product payloads

# ── SQL fragments — value ($) and quantity by transaction_type bucket ─────────
_TC   = "ABS(TRY_CAST(transaction_cost AS FLOAT))"
_QOUT = "TRY_CAST(stock_out AS FLOAT)"
_QIN  = "TRY_CAST(stock_in AS FLOAT)"
_PURCHASES  = (f"SUM(CASE WHEN transaction_type='Stock-In from Purchase Order' THEN {_TC} "
               f"WHEN transaction_type='Stock-Out from Purchase Order Return' THEN -{_TC} ELSE 0 END)")
_COGS       = (f"SUM(CASE WHEN transaction_type IN ('Service Consumption','CheckOut for Consumption','Sale') THEN {_TC} "
               f"WHEN transaction_type='Refund and Restock' THEN -{_TC} ELSE 0 END)")
_TRANSFERS  = (f"SUM(CASE WHEN transaction_type IN ('Stock-In from Transfer Order','Stock-In from Transfer Order Return') THEN {_TC} "
               f"WHEN transaction_type IN ('Stock-Out from Transfer Order','Stock-Out from Transfer Order Return') THEN -{_TC} ELSE 0 END)")
_ADJUST     = (f"SUM(CASE WHEN transaction_type IN ('Added from Adjustment','Added from Audit') THEN {_TC} "
               f"WHEN transaction_type IN ('Decreased from Adjustment','Decreased from Audit') THEN -{_TC} ELSE 0 END)")
_CONS_UNITS = (f"SUM(CASE WHEN transaction_type IN ('Service Consumption','CheckOut for Consumption','Sale') THEN {_QOUT} "
               f"WHEN transaction_type='Refund and Restock' THEN -{_QIN} ELSE 0 END)")


def _iso(val: Optional[str], default_from_ledger: bool = False) -> Optional[str]:
    """Validate a YYYY-MM-DD string (safe to inline). None passes through."""
    if not val:
        return None
    datetime.strptime(val, "%Y-%m-%d")   # raises ValueError on bad input → caught by caller
    return val


def _window(start_date: Optional[str], end_date: Optional[str]):
    """Resolve (s, e, period_days) — default e = latest ledger date, s = month start."""
    e = _iso(end_date)
    if not e:
        r = run_query(f"SELECT MAX(CAST(transaction_date AS DATE)) AS d FROM {L}")
        e = str(r[0]["d"]) if r and r[0].get("d") else str(datetime.utcnow().date())
    s = _iso(start_date) or str(datetime.strptime(e, "%Y-%m-%d").date().replace(day=1))
    days = (datetime.strptime(e, "%Y-%m-%d").date() - datetime.strptime(s, "%Y-%m-%d").date()).days + 1
    return s, e, max(days, 1)


def _f(v):
    return float(v) if v is not None else 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Core computations (each returns plain dicts/lists; reused by analytics-overview)
# ─────────────────────────────────────────────────────────────────────────────
def _movement(s: str, e: str, locations):
    loc_and, lp = loc_in(locations, col="center_name")
    sql = f"""
        WITH beg AS (
            SELECT center_name, SUM(bal_cost) AS beginning FROM (
                SELECT center_name, product_code, TRY_CAST(balance_stock_cost AS FLOAT) AS bal_cost,
                       ROW_NUMBER() OVER (PARTITION BY center_name, product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn
                FROM {L} WHERE CAST(transaction_date AS DATE) < '{s}' {loc_and}
            ) z WHERE rn = 1 GROUP BY center_name
        ),
        endb AS (
            SELECT center_name, SUM(bal_cost) AS ending FROM (
                SELECT center_name, product_code, TRY_CAST(balance_stock_cost AS FLOAT) AS bal_cost,
                       ROW_NUMBER() OVER (PARTITION BY center_name, product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn
                FROM {L} WHERE CAST(transaction_date AS DATE) <= '{e}' {loc_and}
            ) z WHERE rn = 1 GROUP BY center_name
        ),
        mv AS (
            SELECT center_name,
                   {_PURCHASES} AS purchases, {_COGS} AS cogs,
                   {_TRANSFERS} AS net_transfers, {_ADJUST} AS adjustments
            FROM {L} WHERE CAST(transaction_date AS DATE) BETWEEN '{s}' AND '{e}' {loc_and}
            GROUP BY center_name
        )
        SELECT COALESCE(b.center_name, e2.center_name, m.center_name) AS location,
               COALESCE(b.beginning,0)     AS beginning,
               COALESCE(m.purchases,0)     AS purchases,
               COALESCE(m.net_transfers,0) AS net_transfers,
               COALESCE(m.cogs,0)          AS cogs_consumed,
               COALESCE(m.adjustments,0)   AS adjustments,
               COALESCE(e2.ending,0)       AS actual_ending
        FROM beg b
        FULL OUTER JOIN endb e2 ON e2.center_name = b.center_name
        FULL OUTER JOIN mv   m  ON m.center_name  = COALESCE(b.center_name, e2.center_name)
        ORDER BY location
    """
    rows = run_query(sql, merge_params(lp, lp, lp) or None)
    out = []
    tot = {"location": "NETWORK TOTAL", "beginning": 0.0, "purchases": 0.0, "net_transfers": 0.0,
           "cogs_consumed": 0.0, "adjustments": 0.0, "expected_ending": 0.0, "actual_ending": 0.0,
           "unexplained_variance": 0.0}
    for r in rows:
        beg, pur, tr = _f(r["beginning"]), _f(r["purchases"]), _f(r["net_transfers"])
        cg, adj, act = _f(r["cogs_consumed"]), _f(r["adjustments"]), _f(r["actual_ending"])
        exp = beg + pur + tr - cg + adj
        row = {"location": r["location"] or "—", "beginning": round(beg, 2), "purchases": round(pur, 2),
               "net_transfers": round(tr, 2), "cogs_consumed": round(cg, 2), "adjustments": round(adj, 2),
               "expected_ending": round(exp, 2), "actual_ending": round(act, 2),
               "unexplained_variance": round(act - exp, 2)}
        out.append(row)
        for k in ("beginning", "purchases", "net_transfers", "cogs_consumed", "adjustments",
                  "expected_ending", "actual_ending", "unexplained_variance"):
            tot[k] = round(tot[k] + row[k], 2)
    return {"rows": out, "total": tot}


def _turnover_products(s: str, e: str, locations):
    """Per-product turnover inputs (cogs, avg inventory, on-hand, last-use)."""
    loc_and, lp = loc_in(locations, col="center_name")
    sloc, slp = loc_in(locations, col="center_name")
    sql = f"""
        WITH beg AS (SELECT center_name, product_code, bal_cost FROM (
                SELECT center_name, product_code, TRY_CAST(balance_stock_cost AS FLOAT) bal_cost,
                       ROW_NUMBER() OVER (PARTITION BY center_name, product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn
                FROM {L} WHERE CAST(transaction_date AS DATE) < '{s}' {loc_and}) z WHERE rn=1),
             endb AS (SELECT center_name, product_code, bal_cost FROM (
                SELECT center_name, product_code, TRY_CAST(balance_stock_cost AS FLOAT) bal_cost,
                       ROW_NUMBER() OVER (PARTITION BY center_name, product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn
                FROM {L} WHERE CAST(transaction_date AS DATE) <= '{e}' {loc_and}) z WHERE rn=1),
             cogs AS (SELECT center_name, product_code, {_COGS} AS cogs
                FROM {L} WHERE CAST(transaction_date AS DATE) BETWEEN '{s}' AND '{e}' {loc_and}
                GROUP BY center_name, product_code),
             lastuse AS (SELECT center_name, product_code, MAX(CAST(transaction_date AS DATE)) last_use
                FROM {L} WHERE transaction_type IN ('Service Consumption','CheckOut for Consumption','Sale') {loc_and}
                GROUP BY center_name, product_code),
             dim AS (SELECT product_code, MAX(product_name) product_name, MAX(product_category) category
                FROM {L} GROUP BY product_code)
        SELECT s.center_name, s.product_code, d.product_name, d.category,
               TRY_CAST(s.on_hand_quantity AS FLOAT) AS on_hand,
               TRY_CAST(s.on_hand_quantity AS FLOAT) * TRY_CAST(s.stock_cost_perpetual_avg AS FLOAT) AS on_hand_value,
               COALESCE(c.cogs,0) AS cogs,
               (COALESCE(b.bal_cost,0) + COALESCE(e2.bal_cost,0)) / 2.0 AS avg_inv,
               DATEDIFF(DAY, lu.last_use, '{e}') AS last_use_days
        FROM {INV} s
        LEFT JOIN dim     d  ON d.product_code = s.product_code
        LEFT JOIN cogs    c  ON c.center_name=s.center_name AND c.product_code=s.product_code
        LEFT JOIN beg     b  ON b.center_name=s.center_name AND b.product_code=s.product_code
        LEFT JOIN endb    e2 ON e2.center_name=s.center_name AND e2.product_code=s.product_code
        LEFT JOIN lastuse lu ON lu.center_name=s.center_name AND lu.product_code=s.product_code
        WHERE 1=1 {sloc}
    """
    return run_query(sql, merge_params(lp, lp, lp, lp, slp) or None)


def _turnover(s: str, e: str, locations, days: int):
    annualize = 365.0 / days
    prods = _turnover_products(s, e, locations)
    net_cogs = sum(_f(p["cogs"]) for p in prods)
    net_inv  = sum(_f(p["avg_inv"]) for p in prods)
    net_turn = (net_cogs / net_inv * annualize) if net_inv else None

    def turn(cogs, inv):
        return (cogs / inv * annualize) if inv else None

    by_cat, by_loc = {}, {}
    slow_value = dead_value = 0.0
    dead = []
    for p in prods:
        cat, loc = p.get("category") or "(uncategorized)", p["center_name"]
        by_cat.setdefault(cat, [0.0, 0.0]); by_loc.setdefault(loc, [0.0, 0.0])
        by_cat[cat][0] += _f(p["cogs"]); by_cat[cat][1] += _f(p["avg_inv"])
        by_loc[loc][0] += _f(p["cogs"]); by_loc[loc][1] += _f(p["avg_inv"])
        ohv, t = _f(p["on_hand_value"]), turn(_f(p["cogs"]), _f(p["avg_inv"]))
        lud = p["last_use_days"]
        is_dead = (lud is None) or (int(lud) >= DEAD_DAYS)
        if _f(p["on_hand"]) > 0 and (is_dead or (t is not None and t < TURNOVER_TARGET)):
            if is_dead:
                dead_value += ohv
            if t is not None and t < TURNOVER_TARGET:
                slow_value += ohv
            dead.append({"product": p.get("product_name") or p["product_code"], "location": loc,
                         "on_hand": round(_f(p["on_hand"]), 1), "on_hand_value": round(ohv, 2),
                         "turns": round(t, 1) if t is not None else None,
                         "last_use_days": int(lud) if lud is not None else None,
                         "status": "Dead" if is_dead else "Slow"})
    dead.sort(key=lambda x: x["on_hand_value"], reverse=True)
    kpis = {
        "annualized_turnover": round(net_turn, 2) if net_turn is not None else None,
        "days_on_hand": round(365.0 / net_turn, 0) if net_turn else None,
        "turnover_vs_target": round(net_turn - TURNOVER_TARGET, 2) if net_turn is not None else None,
        "target": TURNOVER_TARGET,
        "slow_mover_value": round(slow_value, 2),
        "dead_stock_value": round(dead_value, 2),
    }
    cats = [{"category": k, "turnover": round(turn(v[0], v[1]), 2) if v[1] else None, "target": TURNOVER_TARGET}
            for k, v in by_cat.items()]
    cats.sort(key=lambda x: (x["turnover"] is not None, x["turnover"] or 0), reverse=True)
    locs = [{"location": k, "turnover": round(turn(v[0], v[1]), 2) if v[1] else None}
            for k, v in by_loc.items()]
    locs.sort(key=lambda x: (x["turnover"] is not None, x["turnover"] or 0), reverse=True)
    return {"kpis": kpis, "by_category": cats, "by_location": locs, "dead_stock": dead[:TOP_N]}


def _consumption(s: str, e: str, locations, days: int):
    weeks = days / 7.0
    loc_and, lp = loc_in(locations, col="center_name")
    sloc, slp = loc_in(locations, col="center_name")
    sql = f"""
        WITH cons AS (SELECT center_name, product_code, {_CONS_UNITS} AS cons_units
                FROM {L} WHERE CAST(transaction_date AS DATE) BETWEEN '{s}' AND '{e}' {loc_and}
                GROUP BY center_name, product_code),
             dim AS (SELECT product_code, MAX(product_name) product_name, MAX(product_category) category
                FROM {L} GROUP BY product_code)
        SELECT s.center_name, s.product_code, d.product_name, d.category,
               TRY_CAST(s.on_hand_quantity AS FLOAT) AS on_hand,
               COALESCE(c.cons_units,0) AS cons_units
        FROM {INV} s
        LEFT JOIN cons c ON c.center_name=s.center_name AND c.product_code=s.product_code
        LEFT JOIN dim  d ON d.product_code=s.product_code
        WHERE 1=1 {sloc}
    """
    rows = run_query(sql, merge_params(lp, slp) or None)
    out, total_cons, wos_vals, lt2, gt16 = [], 0.0, [], 0, 0
    for r in rows:
        oh, cu = _f(r["on_hand"]), _f(r["cons_units"])
        total_cons += cu
        weekly = cu / weeks if weeks else 0.0
        wos = (oh / weekly) if weekly else None
        if wos is not None:
            wos_vals.append(wos)
            if wos < WOS_CRITICAL:
                lt2 += 1
            elif wos > WOS_OVERSTOCK:
                gt16 += 1
        status = ("Critical" if wos is not None and wos < WOS_CRITICAL else
                  "Low" if wos is not None and wos < WOS_LOW else
                  "Overstock" if wos is not None and wos > WOS_OVERSTOCK else
                  "Healthy" if wos is not None else "No demand")
        if oh > 0 or cu > 0:
            out.append({"product": r.get("product_name") or r["product_code"], "location": r["center_name"],
                        "category": r.get("category") or "(uncategorized)",
                        "on_hand": round(oh, 1), "weekly_use": round(weekly, 1),
                        "wos": round(wos, 1) if wos is not None else None, "status": status})
    out.sort(key=lambda x: (x["wos"] is None, x["wos"] if x["wos"] is not None else 0))
    kpis = {
        "network_consumption": round(total_cons, 0),
        "avg_wos": round(sum(wos_vals) / len(wos_vals), 1) if wos_vals else None,
        "skus_lt2": lt2, "skus_gt16": gt16,
    }
    return {"kpis": kpis, "wos": out[:TOP_N]}


def _true_ups(s: str, e: str, locations):
    loc_and, lp = loc_in(locations, col="center_name")
    sql = f"""
        SELECT center_name,
            SUM(CASE WHEN transaction_type='Added from Adjustment'     THEN {_TC} ELSE 0 END) AS added_adjustment,
            SUM(CASE WHEN transaction_type='Decreased from Adjustment' THEN {_TC} ELSE 0 END) AS decreased_adjustment,
            SUM(CASE WHEN transaction_type='Added from Audit'          THEN {_TC} ELSE 0 END) AS added_audit,
            SUM(CASE WHEN transaction_type='Decreased from Audit'      THEN {_TC} ELSE 0 END) AS decreased_audit,
            {_ADJUST} AS net_trueup_value
        FROM {L}
        WHERE CAST(transaction_date AS DATE) BETWEEN '{s}' AND '{e}'
          AND transaction_type IN ('Added from Adjustment','Decreased from Adjustment','Added from Audit','Decreased from Audit')
          {loc_and}
        GROUP BY center_name
        ORDER BY net_trueup_value
    """
    rows = run_query(sql, lp or None)
    out, net = [], 0.0
    for r in rows:
        v = _f(r["net_trueup_value"]); net += v
        out.append({"location": r["center_name"] or "—",
                    "added_adjustment": round(_f(r["added_adjustment"]), 2),
                    "decreased_adjustment": round(_f(r["decreased_adjustment"]), 2),
                    "added_audit": round(_f(r["added_audit"]), 2),
                    "decreased_audit": round(_f(r["decreased_audit"]), 2),
                    "net_trueup_value": round(v, 2)})
    return {"kpis": {"net_trueup_value": round(net, 2), "centers_with_adjustments": len(out)}, "by_center": out}


def _system_cost(s: str, e: str, locations):
    loc_and, lp = loc_in(locations, col="center_name")
    sloc, slp = loc_in(locations, col="center_name")
    sql = f"""
        WITH po AS (SELECT center_name, product_code, pprice FROM (
                SELECT center_name, product_code, TRY_CAST(purchase_price AS FLOAT) pprice,
                       ROW_NUMBER() OVER (PARTITION BY center_name, product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn
                FROM {L} WHERE transaction_type='Stock-In from Purchase Order'
                  AND CAST(transaction_date AS DATE) <= '{e}' AND purchase_price IS NOT NULL {loc_and}) z WHERE rn=1),
             dim AS (SELECT product_code, MAX(product_name) product_name FROM {L} GROUP BY product_code)
        SELECT s.center_name, s.product_code, d.product_name, s.vendor,
               TRY_CAST(s.stock_cost_perpetual_avg AS FLOAT) AS system_cost,
               po.pprice AS latest_po_cost,
               TRY_CAST(s.on_hand_quantity AS FLOAT) AS on_hand
        FROM {INV} s
        JOIN po ON po.center_name=s.center_name AND po.product_code=s.product_code
        LEFT JOIN dim d ON d.product_code=s.product_code
        WHERE po.pprice > 0 {sloc}
    """
    rows = run_query(sql, merge_params(lp, slp) or None)
    out, flagged, abs_var, misval = [], 0, [], 0.0
    for r in rows:
        sysc, po = _f(r["system_cost"]), _f(r["latest_po_cost"])
        if po == 0:
            continue
        vpct = (sysc - po) / po * 100
        mv = (sysc - po) * _f(r["on_hand"])
        misval += mv
        abs_var.append(abs(vpct))
        flag = abs(vpct) >= DRIFT_FLAG_PCT
        if flag:
            flagged += 1
        out.append({"product": r.get("product_name") or r["product_code"], "vendor": r.get("vendor"),
                    "system_cost": round(sysc, 2), "latest_po_cost": round(po, 2),
                    "variance_dollar": round(sysc - po, 2), "variance_pct": round(vpct, 1),
                    "misvaluation_on_hand": round(mv, 2), "flag": flag})
    out.sort(key=lambda x: abs(x["variance_pct"]), reverse=True)
    total = len(out)
    kpis = {
        "skus_with_drift_pct": round(flagged / total * 100, 0) if total else None,
        "flagged_skus": flagged,
        "total_misvaluation": round(misval, 2),
        "avg_abs_variance_pct": round(sum(abs_var) / len(abs_var), 1) if abs_var else None,
    }
    return {"kpis": kpis, "drift": out[:TOP_N]}


def _cost_per_unit(s: str, e: str, locations):
    loc_and, lp = loc_in(locations, col="center_name")
    sloc, slp = loc_in(locations, col="center_name")
    sql = f"""
        WITH cons AS (SELECT center_name, product_code, {_CONS_UNITS} AS cons_units
                FROM {L} WHERE CAST(transaction_date AS DATE) BETWEEN '{s}' AND '{e}' {loc_and}
                GROUP BY center_name, product_code),
             prior AS (SELECT product_code, avgprice FROM (
                SELECT product_code, TRY_CAST(avg_price_perpetual AS FLOAT) avgprice,
                       ROW_NUMBER() OVER (PARTITION BY product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn
                FROM {L} WHERE CAST(transaction_date AS DATE) < '{s}' AND avg_price_perpetual IS NOT NULL {loc_and}) z WHERE rn=1),
             dim AS (SELECT product_code, MAX(product_name) product_name, MAX(product_category) category
                FROM {L} GROUP BY product_code)
        SELECT s.center_name, s.product_code, d.product_name, d.category, s.vendor,
               TRY_CAST(s.stock_cost_perpetual_avg AS FLOAT) AS avg_cost,
               TRY_CAST(s.on_hand_quantity AS FLOAT) AS on_hand,
               TRY_CAST(s.on_hand_quantity AS FLOAT) * TRY_CAST(s.stock_cost_perpetual_avg AS FLOAT) AS on_hand_value,
               COALESCE(c.cons_units,0) AS consumed_units,
               TRY_CAST(s.avg_price_perpetual AS FLOAT) AS cur_avgprice,
               p.avgprice AS prior_avgprice
        FROM {INV} s
        LEFT JOIN cons  c ON c.center_name=s.center_name AND c.product_code=s.product_code
        LEFT JOIN prior p ON p.product_code=s.product_code
        LEFT JOIN dim   d ON d.product_code=s.product_code
        WHERE 1=1 {sloc}
    """
    rows = run_query(sql, merge_params(lp, lp, slp) or None)
    out, tot_val, tot_qty, changed, cat_agg = [], 0.0, 0.0, 0, {}
    biggest = None
    for r in rows:
        oh, uc = _f(r["on_hand"]), _f(r["avg_cost"])
        tot_val += oh * uc; tot_qty += oh
        cur, pri = _f(r["cur_avgprice"]), _f(r["prior_avgprice"])
        change = ((cur - pri) / pri * 100) if pri else None
        if change is not None and abs(change) > 0.01:
            changed += 1
            if biggest is None or abs(change) > abs(biggest["change_pct"]):
                biggest = {"product": r.get("product_name") or r["product_code"], "change_pct": round(change, 1)}
        cat = r.get("category") or "(uncategorized)"
        cat_agg.setdefault(cat, [0.0, 0.0]); cat_agg[cat][0] += oh * uc; cat_agg[cat][1] += oh
        out.append({"product": r.get("product_name") or r["product_code"], "vendor": r.get("vendor"),
                    "avg_cost": round(uc, 2), "on_hand_value": round(oh * uc, 2),
                    "consumed_units": round(_f(r["consumed_units"]), 0),
                    "cost_change_pct": round(change, 1) if change is not None else None})
    out.sort(key=lambda x: x["on_hand_value"], reverse=True)
    kpis = {
        "wtd_avg_cost_per_unit": round(tot_val / tot_qty, 2) if tot_qty else None,
        "inventory_on_hand_value": round(tot_val, 2),
        "skus_with_cost_change": changed,
        "biggest_mover": biggest,
    }
    by_cat = [{"category": k, "wtd_avg_cost_per_unit": round(v[0] / v[1], 2) if v[1] else None,
               "on_hand_value": round(v[0], 2)} for k, v in cat_agg.items()]
    by_cat.sort(key=lambda x: x["on_hand_value"], reverse=True)
    return {"kpis": kpis, "rows": out[:TOP_N], "by_category": by_cat}


def _costing_sheet(s: str, e: str, locations):
    loc_and, lp = loc_in(locations, col="center_name")
    meta = run_query(f"""
        SELECT COUNT(DISTINCT product_code) AS products,
               MIN(CAST(transaction_date AS DATE)) AS mn,
               MAX(CAST(transaction_date AS DATE)) AS mx
        FROM {L} WHERE 1=1 {loc_and}
    """, lp or None)
    m = meta[0] if meta else {}
    loc_and2, lp2 = loc_in(locations, col="center_name")
    sql = f"""
        WITH ranked AS (
            SELECT product_code, TRY_CAST(purchase_price AS FLOAT) pprice,
                   ROW_NUMBER() OVER (PARTITION BY product_code ORDER BY CAST(transaction_date AS DATE) ASC,  id ASC)  rn_first,
                   ROW_NUMBER() OVER (PARTITION BY product_code ORDER BY CAST(transaction_date AS DATE) DESC, id DESC) rn_last
            FROM {L} WHERE transaction_type='Stock-In from Purchase Order' AND purchase_price IS NOT NULL {loc_and2}
        ),
        dim AS (SELECT product_code, MAX(product_name) product_name, MAX(product_category) category, MAX(vendor) vendor
                FROM {L} GROUP BY product_code)
        SELECT d.product_name, d.category, d.vendor, f.pprice AS first_cost, l.pprice AS last_cost
        FROM (SELECT product_code, pprice FROM ranked WHERE rn_first=1) f
        JOIN (SELECT product_code, pprice FROM ranked WHERE rn_last=1)  l ON l.product_code=f.product_code
        JOIN dim d ON d.product_code=f.product_code
        WHERE f.pprice > 0
    """
    rows = run_query(sql, lp2 or None)
    changes, up, down = [], 0, 0
    detail = []
    for r in rows:
        fc, lc = _f(r["first_cost"]), _f(r["last_cost"])
        if fc == 0:
            continue
        ch = (lc - fc) / fc * 100
        changes.append(ch)
        if ch > COST_CHANGE_PCT:
            up += 1
        elif ch < -COST_CHANGE_PCT:
            down += 1
        detail.append({"product": r.get("product_name"), "category": r.get("category"), "vendor": r.get("vendor"),
                       "first_cost": round(fc, 2), "last_cost": round(lc, 2), "change_pct": round(ch, 1)})
    changes_sorted = sorted(changes)
    median = (changes_sorted[len(changes_sorted) // 2] if changes_sorted else None)
    movers = sorted(detail, key=lambda x: x["change_pct"], reverse=True)
    kpis = {
        "products_tracked": int(m.get("products") or 0),
        "window_start": str(m.get("mn")) if m.get("mn") else None,
        "window_end": str(m.get("mx")) if m.get("mx") else None,
        "median_cost_change_pct": round(median, 1) if median is not None else None,
        "cost_increases": up, "cost_decreases": down,
    }
    return {"kpis": kpis,
            "movers_up": movers[:12],
            "movers_down": movers[-12:][::-1] if movers else [],
            "detail": movers[:TOP_N]}


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/inventory/movement")
def inventory_movement(request: Request, start_date: Optional[str] = Query(None),
                       end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, _ = _window(start_date, end_date)
        return serialize_rows_deep(_movement(s, e, locations))
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/turnover")
def inventory_turnover(request: Request, start_date: Optional[str] = Query(None),
                       end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, days = _window(start_date, end_date)
        return _turnover(s, e, locations, days)
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/consumption")
def inventory_consumption(request: Request, start_date: Optional[str] = Query(None),
                          end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, days = _window(start_date, end_date)
        return _consumption(s, e, locations, days)
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/true-ups")
def inventory_true_ups(request: Request, start_date: Optional[str] = Query(None),
                       end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, _ = _window(start_date, end_date)
        return _true_ups(s, e, locations)
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/system-cost")
def inventory_system_cost(request: Request, start_date: Optional[str] = Query(None),
                          end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, _ = _window(start_date, end_date)
        return _system_cost(s, e, locations)
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/cost-per-unit")
def inventory_cost_per_unit(request: Request, start_date: Optional[str] = Query(None),
                            end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, _ = _window(start_date, end_date)
        return _cost_per_unit(s, e, locations)
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/costing-sheet")
def inventory_costing_sheet(request: Request, start_date: Optional[str] = Query(None),
                            end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    try:
        s, e, _ = _window(start_date, end_date)
        return _costing_sheet(s, e, locations)
    except Exception as exc:
        log_and_raise_from_request(exc, request)


@router.get("/api/inventory/analytics-overview")
def inventory_analytics_overview(request: Request, start_date: Optional[str] = Query(None),
                                 end_date: Optional[str] = Query(None), locations: Optional[List[str]] = Query(None)):
    """Control-tower roll-up of the computable analyses (PO-match omitted — no PO data)."""
    try:
        s, e, days = _window(start_date, end_date)
        turn = _turnover(s, e, locations, days)
        cons = _consumption(s, e, locations, days)
        sysc = _system_cost(s, e, locations)
        trueup = _true_ups(s, e, locations)
        cpu = _cost_per_unit(s, e, locations)
        kpis = {
            "avg_cost_variance_pct": sysc["kpis"]["avg_abs_variance_pct"],
            "po_match_rate": None,   # not computable — no PO/GRN/invoice data
            "open_cost_flags": sysc["kpis"]["flagged_skus"],
            "inventory_turnover": turn["kpis"]["annualized_turnover"],
            "avg_weeks_of_supply": cons["kpis"]["avg_wos"],
            "true_up_value": trueup["kpis"]["net_trueup_value"],
        }
        scorecard = [
            {"analysis": "Cost per Unit", "headline": cpu["kpis"]["wtd_avg_cost_per_unit"], "to": "Cost per Unit"},
            {"analysis": "System vs Purchase Cost", "headline": sysc["kpis"]["avg_abs_variance_pct"], "flags": sysc["kpis"]["flagged_skus"], "to": "System vs Purchase Cost"},
            {"analysis": "True-Ups", "headline": trueup["kpis"]["net_trueup_value"], "to": "True-Ups"},
            {"analysis": "Inventory Turnover", "headline": turn["kpis"]["annualized_turnover"], "target": TURNOVER_TARGET, "to": "Inventory Turnover"},
            {"analysis": "Weeks of Supply", "headline": cons["kpis"]["avg_wos"], "to": "Consumption & WOS"},
        ]
        return {"kpis": kpis, "scorecard": scorecard, "dead_stock_value": turn["kpis"]["dead_stock_value"]}
    except Exception as exc:
        log_and_raise_from_request(exc, request)


def serialize_rows_deep(payload: dict) -> dict:
    """serialize_rows for any list[dict] values inside the payload (dates → str)."""
    for k, v in payload.items():
        if isinstance(v, list):
            serialize_rows(v)
        elif isinstance(v, dict):
            serialize_rows([v])
    return payload
