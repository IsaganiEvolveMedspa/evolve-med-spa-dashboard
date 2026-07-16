"""
Scheduled Dashboard Snapshot Email  (HTML KPI + inline snapshots)
=================================================================
Emails the Overview as a table-based HTML email whose KPI values are REAL text
(selectable, no zoom needed), PLUS the full dashboard snapshots and a PDF:

  • KPI tiles — Financial / Operational / Marketing — rendered as HTML tables from
    the same JSON the dashboard uses (GET /api/mtd-kpi-header, plus appointments &
    return-rate endpoints). Values/deltas are formatted to match the dashboard
    exactly (money/pct/num, ▲/▼ MoM deltas, "% to goal").
  • Per-location table — Cash MTD, Proj. Run Rate, Goal, MTD/Trend % to goal — from
    GET /api/mtd-summary.
  • Full-dashboard snapshot — the whole Overview captured via headless Chromium and
    embedded INLINE in the body via cid (a referenced inline image renders in-body
    and is NOT shown as a broken attachment tile). No standalone PNG attachments.
  • PDF — the desktop Overview as the single downloadable attachment; open it to
    zoom in. (A mobile-width PNG is still captured but no longer emailed.)

Data host: the dashboard's API (API_BASE), NOT the dashboard URL. DASHBOARD_URL is
used only to render the inline snapshots + PDF.

  • Delivered via Resend (HTTP API — Railway blocks outbound SMTP ports).

Intended to run as a Railway Cron service:
    Start:  python scripts/send_dashboard_email.py   (via Dockerfile.cron CMD)
    Cron:   0 11 * * *   (11:00 UTC ~= 7:00 AM ET — cron runs in UTC)

Environment variables (set in Railway → Variables):
    RESEND_API_KEY   Resend API key
    DASHBOARD_URL    Live dashboard URL (used ONLY to capture the snapshots + PDF)
    API_BASE         (optional) Reporting API base; defaults to the known backend
    EMAIL_TO         Comma-separated primary recipient list (at least one)
    EMAIL_CC         (optional) Comma-separated CC recipient list
    EMAIL_FROM       Verified sender, e.g. "Evolve Dashboard <reports@yourdomain.com>"
    EMAIL_SUBJECT    (optional) Subject line override
    RENDER_WAIT_MS   (optional) Extra settle time for charts to paint (default 2800)
    SKIP_SNAPSHOT    (optional) "1" to send KPI tables only (no Chromium pass).
                     (SKIP_CHARTS is accepted as a legacy alias.)
"""

from __future__ import annotations

import base64
import calendar
import math
import os
import sys
from datetime import date

import httpx
import resend

# Default reporting API (same host the dashboard's apiGet points at).
DEFAULT_API_BASE = "https://backend-production-0019.up.railway.app"

# --- inline snapshot cids ---
VIEW_KEY = "overview"            # desktop inline image cid + filename
MOBILE_KEY = "overview_mobile"   # mobile inline image cid + filename
VIEW_LABEL = "Overview"
VIEW_NAV_TEXT = "Overview"

# --- capture settings ---
VIEWPORT = {"width": 1600, "height": 1200}   # desktop load + capture width
MOBILE_VIEWPORT = {"width": 430, "height": 932}  # phone width → single-column reflow
PDF_PAGE_WIDTH = 1600                        # desktop PDF page width (px) → 1200pt
DEVICE_SCALE_FACTOR = 3                       # 3x so dense tables stay crisp on zoom
NAV_TIMEOUT_MS = 60_000
DATA_LOAD_TIMEOUT_MS = 60_000
LOADING_TEXT = "Loading live data"
ERROR_TEXT = "Couldn't load this view"
LOAD_ATTEMPTS = 3
LOAD_RETRY_BACKOFF_MS = 5000

# --- palette (mirrors the dashboard C.* tokens used in the tiles) ---
INK = "#0F1B1A"
INK2 = "#3C4B48"
GRAY = "#8A9794"
GRAY2 = "#A4AFAC"
GREEN = "#1E9E84"
CLAY = "#C77B5A"
LINE = "#E6ECEA"
PANEL_BG = "#f6f8f7"


def _env(name: str, required: bool = True, default: str | None = None) -> str:
    val = os.getenv(name, default)
    if required and not val:
        print(f"[send_dashboard_email] Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return val or ""


# ─────────────────────────────────────────────────────────────────────────────
# Formatters — faithful ports of evolve-dashboard.jsx (n/money/pct/num/mom*).
# ─────────────────────────────────────────────────────────────────────────────
def _n(v):
    """None for null/NaN/non-numeric, else float (mirrors JS `n`)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _max_frac(x: float, d: int) -> str:
    """Thousands-separated, up to `d` fraction digits, trailing zeros dropped
    (mirrors JS toLocaleString({ maximumFractionDigits: d }))."""
    s = f"{x:,.{d}f}"
    if d > 0 and "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def _money(v, compact: bool = False, decimals: int | None = None, floor: bool = False) -> str:
    x = _n(v)
    if x is None:
        return "—"

    def fx(val: float, d: int) -> str:
        f = (math.floor(val * (10 ** d)) / (10 ** d)) if floor else val
        return f"{f:.{d}f}"

    if compact:
        a = abs(x)
        if a >= 1e6:
            return f"${fx(x / 1e6, 2 if decimals is None else decimals)}M"
        if a >= 1e3:
            return f"${fx(x / 1e3, 0 if decimals is None else decimals)}K"
        return f"${fx(x, 0 if decimals is None else decimals)}"
    return "$" + _max_frac(x, 0 if decimals is None else decimals)


def _pct(v, d: int = 1) -> str:
    x = _n(v)
    return "—" if x is None else f"{x:.{d}f}%"


def _num(v, d: int = 0) -> str:
    x = _n(v)
    return "—" if x is None else _max_frac(x, d)


def _mom_pct(cur, prv, d: int = 1, invert: bool = False, unit: str = "%"):
    """MoM %-change delta → {'text','color'} or None (mirrors momPctDelta)."""
    c, p = _n(cur), _n(prv)
    if c is None or p is None or p == 0:
        return None
    diff = ((c - p) / abs(p)) * 100
    up = diff >= 0
    good = (not up) if invert else up
    return {"text": f"{'▲' if up else '▼'} {abs(diff):.{d}f}{unit}", "color": GREEN if good else CLAY}


def _mom_pt(cur, prv, d: int = 1, invert: bool = False):
    """MoM point-change delta → {'text','color'} or None (mirrors momPtDelta)."""
    c, p = _n(cur), _n(prv)
    if c is None or p is None:
        return None
    diff = c - p
    up = diff >= 0
    good = (not up) if invert else up
    return {"text": f"{'▲' if up else '▼'} {abs(diff):.{d}f} pt", "color": GREEN if good else CLAY}


def _goal_props(actual, goal_val, fmt):
    """Goal target + '% to goal' (mirrors goalProps). None when no goal defined."""
    g = _n(goal_val)
    if g is None:
        return None
    a = _n(actual)
    p = (a / g) * 100 if (a is not None and g != 0) else None
    delta = None
    color = None
    if p is not None:
        delta = f"{'▲' if p >= 100 else '▼'} {p:.0f}% to goal"
        color = GREEN if p >= 100 else CLAY
    return {"goal": fmt(g), "goal_delta": delta, "goal_delta_color": color}


# ─────────────────────────────────────────────────────────────────────────────
# Date windows — current month (of latest cash date) + prior MoM window.
# ─────────────────────────────────────────────────────────────────────────────
def _month_bounds(anchor_iso: str) -> tuple[str, str]:
    y, m, _ = (int(x) for x in anchor_iso.split("-"))
    last = calendar.monthrange(y, m)[1]
    return f"{y}-{m:02d}-01", f"{y}-{m:02d}-{last:02d}"


def _prev_month_range(start: str, end: str, latest: str | None) -> tuple[str, str]:
    """Prior-month window ending on the same elapsed day (mirrors prevMonthRange)."""
    eff_end = latest if (latest and end and latest < end) else end
    y, m, _ = (int(x) for x in start.split("-"))
    pm = m - 1
    py = y
    if pm < 1:
        pm = 12
        py = y - 1
    last_prev = calendar.monthrange(py, pm)[1]
    if not eff_end:
        return f"{py}-{pm:02d}-01", f"{py}-{pm:02d}-{last_prev:02d}"
    end_day = int(str(eff_end)[8:10])
    day = min(end_day or last_prev, last_prev)
    return f"{py}-{pm:02d}-01", f"{py}-{pm:02d}-{day:02d}"


# ─────────────────────────────────────────────────────────────────────────────
# Data fetch.
# ─────────────────────────────────────────────────────────────────────────────
def _get(client: httpx.Client, base: str, path: str, params: dict):
    r = client.get(f"{base}{path}", params=params, timeout=60.0)
    r.raise_for_status()
    return r.json()


def fetch_data(api_base: str) -> dict:
    with httpx.Client() as client:
        latest = _get(client, api_base, "/api/latest-cash-date", {})
        latest_date = latest.get("latest_date") if isinstance(latest, dict) else None
        anchor = latest_date or date.today().isoformat()
        start, end = _month_bounds(anchor)
        p_start, p_end = _prev_month_range(start, end, latest_date)
        cur = {"start_date": start, "end_date": end}
        prev = {"start_date": p_start, "end_date": p_end}
        data = {
            "start": start,
            "end": end,
            "latest_date": latest_date,
            "header": _get(client, api_base, "/api/mtd-kpi-header", cur),
            "headerPrev": _get(client, api_base, "/api/mtd-kpi-header", prev),
            "summary": _get(client, api_base, "/api/mtd-summary", cur),
            "appts": _get(client, api_base, "/api/appointments/summary", cur),
            "apptsPrev": _get(client, api_base, "/api/appointments/summary", prev),
            "retention": _get(client, api_base, "/api/new-guest-return-rate", cur),
            "retentionPrev": _get(client, api_base, "/api/new-guest-return-rate", prev),
        }
    return data


# ─────────────────────────────────────────────────────────────────────────────
# KPI section builders — mirror the financial/operational/marketing arrays.
# ─────────────────────────────────────────────────────────────────────────────
def _sum(rows, field) -> float:
    return sum((_n(r.get(field)) or 0) for r in (rows or []))


def _rate(rows, num_field, den_field):
    den = _sum(rows, den_field)
    return (_sum(rows, num_field) / den) * 100 if den else None


def build_sections(data: dict) -> list[dict]:
    h = data.get("header") or {}
    hp = data.get("headerPrev") or {}
    appts = data.get("appts") or []
    apptsPrev = data.get("apptsPrev") or []
    retention = data.get("retention") or []
    retentionPrev = data.get("retentionPrev") or []

    # Financial
    b, r = _n(h.get("monthly_budget")), _n(h.get("mtd_revenue"))
    budget_pace = (r / b) * 100 if (b and r is not None) else None
    cogs = _n(h.get("cogs_margin_pct"))
    cogs_prev = _n(hp.get("cogs_margin_pct"))
    financial = [
        {
            "label": "% to Budget · Variance to Goal",
            "value": f"{budget_pace:.0f}%" if budget_pace is not None else "—",
            "delta": (
                {
                    "text": f"{'▲' if budget_pace >= 100 else '▼'} {abs(100 - budget_pace):.0f}% to goal",
                    "color": GREEN if budget_pace >= 100 else CLAY,
                }
                if budget_pace is not None
                else None
            ),
        },
        {"label": "SSS Growth YoY %", "value": _pct(h.get("same_store_yoy"))},
        {"label": "Prior Day Sales", "value": _money(h.get("yesterday_revenue"), compact=True)},
        {
            "label": "ASP (New)",
            "value": _money(h.get("asp_new_clients")),
            "delta": _mom_pct(h.get("asp_new_clients"), hp.get("asp_new_clients")),
            **(_goal_props(h.get("asp_new_clients"), h.get("asp_new_goal"), lambda v: _money(v)) or {}),
        },
        {
            "label": "ASP (Existing)",
            "value": _money(h.get("asp_existing_clients")),
            "delta": _mom_pct(h.get("asp_existing_clients"), hp.get("asp_existing_clients")),
            **(_goal_props(h.get("asp_existing_clients"), h.get("asp_existing_goal"), lambda v: _money(v)) or {}),
        },
        {
            "label": "COGS Margin %",
            "value": _pct(cogs),
            "delta": _mom_pt(cogs, cogs_prev, invert=True),
        },
        {
            "label": "Payroll Margin %",
            "value": _pct(h.get("payroll_margin_pct")) if h.get("payroll_margin_pct") is not None else "—",
            "delta": _mom_pt(h.get("payroll_margin_pct"), hp.get("payroll_margin_pct"), invert=True),
        },
    ]

    # Operational
    no_show = _rate(appts, "no_shows", "total_appointments")
    cancel = _rate(appts, "cancellations", "total_appointments")
    no_show_prev = _rate(apptsPrev, "no_shows", "total_appointments")
    cancel_prev = _rate(apptsPrev, "cancellations", "total_appointments")
    operational = [
        {"label": "No-Show Rate", "value": f"{no_show:.1f}%" if no_show is not None else "—",
         "delta": _mom_pt(no_show, no_show_prev, invert=True)},
        {"label": "Cancellation Rate", "value": f"{cancel:.1f}%" if cancel is not None else "—",
         "delta": _mom_pt(cancel, cancel_prev, invert=True)},
        {"label": "Membership Adoption", "value": _pct(h.get("membership_adoption_rate")),
         "delta": _mom_pt(h.get("membership_adoption_rate"), hp.get("membership_adoption_rate"))},
        {"label": "Rev / Hr · Provider", "value": _money(h.get("rev_per_provider"), compact=True),
         "delta": _mom_pct(h.get("rev_per_provider"), hp.get("rev_per_provider"))},
        {"label": "Rev / Hr · Esthetician", "value": _money(h.get("rev_per_esthetician"), compact=True),
         "delta": _mom_pct(h.get("rev_per_esthetician"), hp.get("rev_per_esthetician"))},
        {"label": "Utilization · Provider", "value": _pct(h.get("provider_utilization")),
         "delta": _mom_pt(h.get("provider_utilization"), hp.get("provider_utilization"))},
        {"label": "Utilization · Esthetician", "value": _pct(h.get("esthetician_utilization")),
         "delta": _mom_pt(h.get("esthetician_utilization"), hp.get("esthetician_utilization"))},
        {"label": "Rebook Rate %", "value": _pct(h.get("rebooking_rate")),
         "delta": _mom_pt(h.get("rebooking_rate"), hp.get("rebooking_rate"))},
    ]

    # Marketing
    new_visits = h.get("new_visits") if h.get("new_visits") is not None else h.get("new_client_count")
    new_visits_prev = hp.get("new_visits") if hp.get("new_visits") is not None else hp.get("new_client_count")
    ret90 = _rate(retention, "matured_returned_90d", "matured_new_guests")
    ret90_prev = _rate(retentionPrev, "matured_returned_90d", "matured_new_guests")
    marketing = [
        {"label": "New Customer Visits", "value": _num(new_visits),
         "delta": _mom_pct(new_visits, new_visits_prev),
         **(_goal_props(new_visits, h.get("new_customers_goal"), lambda v: _num(v)) or {})},
        {"label": "Existing Customer Visits", "value": _num(h.get("existing_client_count")),
         "delta": _mom_pct(h.get("existing_client_count"), hp.get("existing_client_count")),
         **(_goal_props(h.get("existing_client_count"), h.get("existing_customers_goal"), lambda v: _num(v)) or {})},
        {"label": "MTD Ad Spend",
         "value": _money(h.get("mtd_ad_spend"), compact=True) if h.get("mtd_ad_spend") is not None else "—",
         "delta": _mom_pct(h.get("mtd_ad_spend"), hp.get("mtd_ad_spend"))},
        {"label": "CAC",
         "value": _money(h.get("client_acquisition_cost")) if h.get("client_acquisition_cost") is not None else "—",
         "delta": _mom_pct(h.get("client_acquisition_cost"), hp.get("client_acquisition_cost"), invert=True)},
        {"label": "New Guest Return Rate · 90 Day",
         "value": _pct(ret90) if ret90 is not None else "—",
         "delta": _mom_pt(ret90, ret90_prev)},
    ]

    return [
        {"title": "Financial", "tiles": financial},
        {"title": "Operational", "tiles": operational},
        {"title": "Marketing", "tiles": marketing},
    ]


def build_location_rows(summary: list) -> tuple[list, dict]:
    """Per-location rows + totals for the Location Performance table."""
    def loc_run_rate(l):
        v = _n(l.get("cash_run_rate"))
        return v if v is not None else _n(l.get("trending"))

    def pace_of(b, t):
        bb, tt = _n(b), _n(t)
        return (tt / bb) * 100 if (bb and tt is not None) else None

    rows = []
    tot_cash = tot_proj = tot_budget = 0.0
    for l in (summary or []):
        proj = loc_run_rate(l)
        cash = _n(l.get("cash_sales")) or 0
        bud = _n(l.get("monthly_budget")) or 0
        tot_cash += cash
        tot_proj += (proj or 0)
        tot_budget += bud
        rows.append({
            "location": l.get("location", "—"),
            "cash": _money(l.get("cash_sales"), compact=True, floor=True),
            "proj": _money(proj, compact=True, floor=True),
            "proj_pct": (f"{_n(l.get('pct_to_goal_mtd')):.0f}%" if _n(l.get("pct_to_goal_mtd")) is not None else ""),
            "goal": _money(l.get("monthly_budget"), compact=True) if l.get("monthly_budget") is not None else "—",
            "mtd_pct": (lambda p: f"{p:.0f}%" if p is not None else "—")(pace_of(l.get("monthly_budget"), l.get("cash_sales"))),
            "trend_pct": (lambda p: f"{p:.0f}%" if p is not None else "—")(pace_of(l.get("monthly_budget"), proj)),
        })
    totals = {
        "cash": _money(tot_cash, compact=True, floor=True),
        "proj": _money(tot_proj, compact=True, floor=True),
        "goal": _money(tot_budget, compact=True) if tot_budget else "—",
        "mtd_pct": (f"{(tot_cash / tot_budget) * 100:.0f}%" if tot_budget else "—"),
        "trend_pct": (f"{(tot_proj / tot_budget) * 100:.0f}%" if tot_budget else "—"),
    }
    return rows, totals


# ─────────────────────────────────────────────────────────────────────────────
# Full-dashboard snapshot capture (desktop PNG + mobile PNG + PDF).
# ─────────────────────────────────────────────────────────────────────────────
# Removes the height:100vh / overflow:hidden constraints so a full-page screenshot
# / PDF captures the ENTIRE view instead of just the visible viewport.
_UNCLIP_JS = """
() => {
  const shell = document.querySelector('#root > div');
  if (shell) { shell.style.height = 'auto'; shell.style.overflow = 'visible'; }
  const main = document.querySelector('main');
  if (main) { main.style.overflow = 'visible'; }
  const scroll = document.querySelector('.ev-scroll');
  if (scroll) { scroll.style.overflow = 'visible'; scroll.style.flex = 'none'; }
  document.body.style.height = 'auto';
  document.documentElement.style.height = 'auto';
}
"""

# Hides the sidebar and reports <main> dimensions so the PDF fits one page.
_MEASURE_FOR_PDF_JS = """
() => {
  const aside = document.querySelector('aside');
  if (aside) aside.style.display = 'none';
  const main = document.querySelector('main');
  const r = main.getBoundingClientRect();
  return {
    w: Math.ceil(Math.max(main.scrollWidth, r.width)),
    h: Math.ceil(Math.max(main.scrollHeight, r.height)),
  };
}
"""

# Injected before capture (both outputs): hide the sidebar so the emailed image /
# PDF is just the dashboard content at full desktop width.
_DESKTOP_CSS = """
aside { display: none !important; }
main { width: 100% !important; }
"""

# Injected only for the MOBILE capture (after narrowing the viewport). The dashboard
# has no responsive layout, so this collapses the fixed multi-column grids to a
# single-column shape AND — the fix for the clipped hero cards — stacks the hero
# cards' internal flex columns (`.ev-hero-cols`: MTD | Full-Month Budget |
# Projected), hiding the thin vertical divider bars, so no card/table/graph runs
# off the narrow viewport. Charts use Recharts ResponsiveContainer and resize on
# their own.
_MOBILE_REFLOW_JS = r"""
() => {
  const main = document.querySelector('main');
  if (!main) return;
  main.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display !== 'grid') return;
    const raw = (el.style.gridTemplateColumns || '').trim();
    if (!raw) return;
    const count = cs.gridTemplateColumns.split(' ').filter(Boolean).length;
    const isRepeat = raw.includes('repeat(');
    const allEqual = /^(?:\s*1fr\s*,?)+$/.test(raw);
    if (isRepeat || allEqual) {
      el.style.gridTemplateColumns = count >= 3 ? '1fr 1fr' : '1fr';
      el.style.gap = '10px';
    } else if (count === 2) {
      el.style.gridTemplateColumns = '1fr';
      el.style.gap = '12px';
    }
  });
  // Stack each hero card's internal flex row so the 3 wide stats don't overflow.
  main.querySelectorAll('.ev-hero-cols').forEach((el) => {
    el.style.flexDirection = 'column';
    el.style.alignItems = 'stretch';
    Array.from(el.children).forEach((ch) => {
      const w = ch.getBoundingClientRect().width;
      if (w <= 6) { ch.style.display = 'none'; }        // thin divider bar
      else { ch.style.width = '100%'; ch.style.marginBottom = '12px'; }
    });
  });
}
"""


def capture_overview(dashboard_url: str, render_wait_ms: int) -> dict:
    """Open the dashboard, load the Overview, and return
    {png_desktop, png_mobile, pdf_bytes}. Returns {} if the view never loads."""
    from playwright.sync_api import (
        TimeoutError as PlaywrightTimeoutError,
        sync_playwright,
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=DEVICE_SCALE_FACTOR)
        page.goto(dashboard_url, wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
        page.wait_for_selector("aside", timeout=NAV_TIMEOUT_MS)
        page.locator("aside a.ev-nav", has_text=VIEW_NAV_TEXT).first.click()
        page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT_MS)

        for attempt in range(1, LOAD_ATTEMPTS + 1):
            page.wait_for_timeout(1000)
            try:
                page.wait_for_function(
                    "(t) => !document.body.innerText.includes(t)",
                    arg=LOADING_TEXT,
                    timeout=DATA_LOAD_TIMEOUT_MS,
                )
            except PlaywrightTimeoutError:
                print(f"[send_dashboard_email] WARN: still loading (attempt {attempt}/{LOAD_ATTEMPTS})", file=sys.stderr)
            page.wait_for_timeout(render_wait_ms)
            if page.get_by_text(ERROR_TEXT, exact=False).count() == 0:
                break
            if attempt < LOAD_ATTEMPTS:
                try:
                    page.get_by_text("Retry", exact=False).first.click()
                except Exception:
                    page.reload(wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
                page.wait_for_timeout(LOAD_RETRY_BACKOFF_MS)
            else:
                print(f"[send_dashboard_email] WARN: '{ERROR_TEXT}' persisted — no snapshot", file=sys.stderr)
                browser.close()
                return {}

        page.evaluate(_UNCLIP_JS)
        page.add_style_tag(content=_DESKTOP_CSS)
        page.wait_for_timeout(500)

        # 1) Desktop PNG — full <main> at 1600px width, 3x.
        png_desktop = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured desktop PNG ({len(png_desktop)} bytes)")

        # 2) Desktop PDF — same layout as one 1600px-wide page (captured BEFORE the
        # mobile reflow so it keeps the multi-column desktop layout).
        dims = page.evaluate(_MEASURE_FOR_PDF_JS)
        page.wait_for_timeout(200)
        pdf_bytes = page.pdf(
            width=f"{PDF_PAGE_WIDTH}px",
            height=f"{dims['h']}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        print(f"[send_dashboard_email] Captured PDF ({len(pdf_bytes)} bytes)")

        # 3) Mobile PNG — narrow to phone width, collapse grids + stack hero cards.
        page.set_viewport_size(MOBILE_VIEWPORT)
        page.wait_for_timeout(800)          # let Recharts ResponsiveContainers resize
        page.evaluate(_MOBILE_REFLOW_JS)
        page.evaluate(_UNCLIP_JS)           # heights changed after the reflow
        page.wait_for_timeout(600)
        png_mobile = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured mobile PNG ({len(png_mobile)} bytes)")

        browser.close()
    return {"png_desktop": png_desktop, "png_mobile": png_mobile, "pdf_bytes": pdf_bytes}


# ─────────────────────────────────────────────────────────────────────────────
# HTML rendering.
# ─────────────────────────────────────────────────────────────────────────────
_EMAIL_STYLE = """
    body { margin:0; padding:0; background:#f6f8f7; }
    table { border-collapse:collapse; }
    @media only screen and (max-width:600px) {
      .ev-tile { display:block !important; width:100% !important; }
      .ev-pad { padding:18px 10px !important; }
    }
"""


def _tile_html(t: dict) -> str:
    delta = t.get("delta")
    delta_html = (
        f'<div style="font:600 12px Arial,Helvetica,sans-serif;color:{delta["color"]};margin-top:3px;">{delta["text"]}</div>'
        if delta
        else ""
    )
    goal_html = ""
    if t.get("goal") is not None:
        gd = t.get("goal_delta")
        gd_html = (
            f'<div style="font:600 11px Arial,Helvetica,sans-serif;color:{t.get("goal_delta_color") or GRAY};margin-top:2px;">{gd}</div>'
            if gd
            else ""
        )
        goal_html = (
            f'<div style="font:500 12px Arial,Helvetica,sans-serif;color:{GRAY};margin-top:6px;">vs. goal {t["goal"]}</div>{gd_html}'
        )
    return (
        f'<td class="ev-tile" width="33%" valign="top" '
        f'style="border:1px solid {LINE};border-radius:10px;padding:12px 13px;text-align:center;">'
        f'<div style="font:600 10.5px Arial,Helvetica,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:{GRAY};line-height:1.3;">{t["label"]}</div>'
        f'<div style="font:600 26px Arial,Helvetica,sans-serif;color:{INK};margin-top:8px;">{t["value"]}</div>'
        f"{delta_html}{goal_html}</td>"
    )


def _section_html(section: dict) -> str:
    tiles = section["tiles"]
    rows_html = ""
    for i in range(0, len(tiles), 3):
        chunk = tiles[i : i + 3]
        cells = "".join(_tile_html(t) for t in chunk)
        # pad short rows so widths stay even
        cells += '<td width="33%"></td>' * (3 - len(chunk))
        rows_html += f'<tr>{cells}</tr><tr><td colspan="3" style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>'
    return (
        f'<tr><td style="padding:20px 0 10px 0;"><span style="font:700 10.5px Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:{GREEN};">{section["title"]}</span></td></tr>'
        f'<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="6">{rows_html}</table></td></tr>'
    )


def _loc_table_html(rows: list, totals: dict) -> str:
    th = f'font:600 9.5px Arial,Helvetica,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:{GRAY2};background:#F5F8F7;border:1px solid {LINE};padding:7px 9px;'
    td = f'font:500 11.5px Arial,Helvetica,sans-serif;color:{INK2};border:1px solid #F4F7F6;padding:7px 9px;text-align:center;'
    tdl = f'font:600 11.5px Arial,Helvetica,sans-serif;color:{INK};border:1px solid #F4F7F6;padding:7px 9px;text-align:center;'
    head = "".join(
        f'<th style="{th}text-align:{a};">{h}</th>'
        for h, a in [("Location", "center"), ("Cash MTD", "center"), ("Proj. Run Rate", "center"),
                     ("Goal", "center"), ("MTD % Goal", "center"), ("Trend % Goal", "center")]
    )
    body = ""
    for r in rows:
        proj = r["proj"] + (f' <span style="color:{GRAY};font-weight:600;">{r["proj_pct"]}</span>' if r["proj_pct"] else "")
        body += (
            f'<tr><td style="{tdl}">{r["location"]}</td>'
            f'<td style="{td}">{r["cash"]}</td>'
            f'<td style="{td}">{proj}</td>'
            f'<td style="{td}">{r["goal"]}</td>'
            f'<td style="{td}">{r["mtd_pct"]}</td>'
            f'<td style="{td}">{r["trend_pct"]}</td></tr>'
        )
    tot = f'font:700 11.5px Arial,Helvetica,sans-serif;color:{INK};background:#F5F8F7;border:1px solid {LINE};padding:7px 9px;text-align:center;'
    body += (
        f'<tr><td style="{tot}">Total</td>'
        f'<td style="{tot}">{totals["cash"]}</td>'
        f'<td style="{tot}">{totals["proj"]}</td>'
        f'<td style="{tot}">{totals["goal"]}</td>'
        f'<td style="{tot}">{totals["mtd_pct"]}</td>'
        f'<td style="{tot}">{totals["trend_pct"]}</td></tr>'
    )
    # Wrap in a horizontal-scroll container with a min-width so the 6-column table
    # scrolls (not clips) on narrow phones. Desktop (720px shell) is unaffected —
    # min-width:520px is below the container width so the table just fills it.
    return (
        f'<tr><td style="padding:24px 0 10px 0;"><span style="font:700 14px Arial,Helvetica,sans-serif;color:{INK};">Location Performance · Sales &amp; Customers</span></td></tr>'
        f'<tr><td><div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-width:520px;"><tr>{head}</tr>{body}</table>'
        f'</div></td></tr>'
    )


def build_html(report_date: str, sections: list, loc_rows: list, loc_totals: dict, has_snapshot: bool) -> str:
    # Snapshot is embedded INLINE in the body via cid (a referenced inline image
    # renders in the body and is NOT listed as an attachment tile — so no broken
    # PNG tiles). The PDF is the single downloadable attachment; open it to zoom.
    snapshot_html = ""
    if has_snapshot:
        snapshot_html = (
            f'<tr><td style="padding:24px 0 8px 0;"><span style="font:700 14px Arial,Helvetica,sans-serif;color:{INK};">Full Dashboard Snapshot</span></td></tr>'
            f'<tr><td align="center" style="padding-bottom:4px;">'
            f'<img src="cid:{VIEW_KEY}" alt="{VIEW_LABEL}" width="680" '
            f'style="display:block;width:100%;max-width:680px;height:auto;margin:0 auto;border:1px solid {LINE};border-radius:8px;" />'
            f'</td></tr>'
            f'<tr><td style="padding:8px 0 0 0;font:400 12px Arial,Helvetica,sans-serif;color:#68807a;">A PDF of the full Overview is attached — open it to zoom in.</td></tr>'
        )
    sections_html = "".join(_section_html(s) for s in sections)
    loc_html = _loc_table_html(loc_rows, loc_totals) if loc_rows else ""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>{_EMAIL_STYLE}</style>
</head>
<body style="margin:0;padding:0;background:{PANEL_BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PANEL_BG};">
    <tr><td align="center" class="ev-pad" style="padding:28px 16px;">
      <table role="presentation" width="720" cellpadding="0" cellspacing="0" style="max-width:720px;width:100%;">
        <tr><td style="font:700 22px Arial,Helvetica,sans-serif;color:{INK};padding-bottom:2px;">Evolve Med Spa — Overview</td></tr>
        <tr><td style="font:400 13px Arial,Helvetica,sans-serif;color:#68807a;padding-bottom:6px;">{report_date}</td></tr>
        {sections_html}
        {loc_html}
        {snapshot_html}
        <tr><td style="padding:26px 0 0 0;font:400 11px Arial,Helvetica,sans-serif;color:#9aaaa5;border-top:1px solid {LINE};">
          Automated snapshot. Confidential — internal use only.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def main() -> None:
    resend.api_key = _env("RESEND_API_KEY")
    dashboard_url = _env("DASHBOARD_URL")
    api_base = _env("API_BASE", required=False, default=DEFAULT_API_BASE).rstrip("/")
    email_to = [e.strip() for e in _env("EMAIL_TO").split(",") if e.strip()]
    email_cc = [e.strip() for e in _env("EMAIL_CC", required=False).split(",") if e.strip()]
    email_from = _env("EMAIL_FROM")
    render_wait_ms = int(_env("RENDER_WAIT_MS", required=False, default="2800"))
    # SKIP_SNAPSHOT (or legacy SKIP_CHARTS) = "1" → tables only, no Chromium pass.
    skip_snapshot = (
        _env("SKIP_SNAPSHOT", required=False, default="") == "1"
        or _env("SKIP_CHARTS", required=False, default="") == "1"
    )

    report_date = (
        date.today().strftime("%A, %B %-d, %Y")
        if os.name != "nt"
        else date.today().strftime("%A, %B %d, %Y")
    )
    subject = _env("EMAIL_SUBJECT", required=False, default=f"Evolve Dashboard Overview — {report_date}")

    data = fetch_data(api_base)
    sections = build_sections(data)
    loc_rows, loc_totals = build_location_rows(data.get("summary") or [])

    capture: dict = {}
    if not skip_snapshot:
        try:
            capture = capture_overview(dashboard_url, render_wait_ms)
        except Exception as exc:  # never let a capture failure block the KPI email
            print(f"[send_dashboard_email] WARN: snapshot capture failed, sending tables only: {exc}", file=sys.stderr)

    has_snapshot = bool(capture.get("png_desktop"))
    html = build_html(report_date, sections, loc_rows, loc_totals, has_snapshot)

    attachments = []
    if has_snapshot:
        # Desktop PNG is embedded INLINE via content_id (referenced in the body →
        # renders in-body, not shown as an attachment tile). The PDF is the only
        # downloadable attachment (open it to zoom). No standalone PNG attachments.
        attachments = [
            {
                "filename": f"{VIEW_KEY}.png",
                "content": base64.b64encode(capture["png_desktop"]).decode("ascii"),
                "content_id": VIEW_KEY,
                "content_type": "image/png",
            },
            {
                "filename": f"evolve-overview-{date.today().isoformat()}.pdf",
                "content": base64.b64encode(capture["pdf_bytes"]).decode("ascii"),
                "content_type": "application/pdf",
            },
        ]

    params = {"from": email_from, "to": email_to, "subject": subject, "html": html}
    if attachments:
        params["attachments"] = attachments
    if email_cc:
        params["cc"] = email_cc

    resend.Emails.send(params)
    recipients = ", ".join(email_to + email_cc)
    kind = "tables + inline snapshot + PDF" if has_snapshot else "tables only"
    print(f"[send_dashboard_email] Sent HTML Overview ({kind}) to {recipients}")


if __name__ == "__main__":
    main()
