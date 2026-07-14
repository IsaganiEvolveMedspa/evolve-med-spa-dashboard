"""
Scheduled Dashboard Snapshot Email
==================================
Opens the live Evolve dashboard in a headless browser, captures the OVERVIEW
view at TWO widths, and emails it as:
  • a responsive INLINE image in the email body — the wide desktop layout on
    desktop clients, the single-column mobile layout on phones (see build_html), and
  • a PDF of the Overview (desktop layout) attached to the same email.

The dashboard itself has no mobile layout, so the mobile PNG is produced by
injecting a reflow stylesheet/JS at capture time only (_MOBILE_REFLOW_JS) — the
live app is never modified.

  • No link to the dashboard is ever placed in the email (by design — the
    dashboard is public, so we ship pictures, not a live URL).
  • Delivered via Resend (HTTP API — Railway blocks outbound SMTP ports).

Intended to run as a Railway Cron service:
    Start:  python scripts/send_dashboard_email.py   (via Dockerfile.cron CMD)
    Cron:   0 11 * * *   (11:00 UTC ~= 7:00 AM ET — cron runs in UTC)

Environment variables (set in Railway → Variables):
    RESEND_API_KEY   Resend API key
    DASHBOARD_URL    Live dashboard URL (used only inside this script — never emailed)
    EMAIL_TO         Comma-separated primary recipient list (at least one)
    EMAIL_CC         (optional) Comma-separated CC recipient list
    EMAIL_FROM       Verified sender, e.g. "Evolve Dashboard <reports@yourdomain.com>"
    EMAIL_SUBJECT    (optional) Subject line override
    RENDER_WAIT_MS   (optional) Extra settle time for charts to paint (default 2800)
"""

from __future__ import annotations

import base64
import os
import sys
from datetime import date

import resend
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright

# --- The single view we capture (as two cid: inline images) ---
VIEW_KEY = "overview"            # desktop inline image cid + filename
MOBILE_KEY = "overview_mobile"   # mobile inline image cid + filename
VIEW_LABEL = "Overview"
VIEW_NAV_TEXT = "Overview"

# Three renders:
#   • Desktop PNG → desktop <main> at 1600 CSS px, 3x → 4800px wide (overview_desktop.png).
#   • Mobile PNG  → viewport narrowed to 430 CSS px + _MOBILE_REFLOW_JS collapses the
#                   fixed multi-column grids to the single-column layout, 3x → 1290px
#                   wide (overview_mobile.png).
#   • PDF         → the SAME desktop layout as a 1600px-wide page → 1200pt MediaBox.
# The dashboard loads at desktop width; we only hide the sidebar (via _DESKTOP_CSS)
# so the capture is the content at full width.
VIEWPORT        = {"width": 1600, "height": 1200}   # desktop load + capture width
MOBILE_VIEWPORT = {"width": 430,  "height": 932}    # phone width → single-column reflow
PDF_PAGE_WIDTH  = 1600                               # desktop PDF page width (px) → 1200pt
# The inline PNG is rendered at 3x so the dense tables stay crisp if the recipient
# taps to zoom in their mail client. NOTE: this affects screenshots only —
# page.pdf() renders at print resolution and ignores device_scale_factor, so the
# attached PDF is unaffected by it.
DEVICE_SCALE_FACTOR = 3
NAV_TIMEOUT_MS = 60_000
# The view fetches live data and shows "Loading live data…" until it's ready.
# We wait for that indicator to clear (up to this long) before capturing,
# rather than guessing with a fixed timer.
DATA_LOAD_TIMEOUT_MS = 60_000
# Text the dashboard shows while a view is still fetching (see DataState in the UI).
LOADING_TEXT = "Loading live data"
# Text the dashboard shows when a view failed to load (DataState error card). We
# retry on it (transient cold-start 500s clear on reload) and only ABORT if it
# persists — we must never email execs a "Couldn't load this view" picture.
ERROR_TEXT = "Couldn't load this view"
# How many times to (re)load the Overview before giving up, and how long to wait
# after clicking Retry for the API/DB to come up on a cold start.
LOAD_ATTEMPTS = 3
LOAD_RETRY_BACKOFF_MS = 5000


def _env(name: str, required: bool = True, default: str | None = None) -> str:
    val = os.getenv(name, default)
    if required and not val:
        print(f"[send_dashboard_email] Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return val or ""


# JS that removes the height:100vh / overflow:hidden constraints so a full-page
# screenshot / PDF captures the ENTIRE view instead of just the visible viewport.
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

# JS run just before the PDF: hide the sidebar so the PDF is just the content,
# and report the <main> dimensions so we can size the PDF to one page.
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
# PDF is just the dashboard content at full desktop width — matching the reference
# overview_desktop.png. Everything else (filter bar, multi-column layout, table
# sizes) stays exactly as the desktop dashboard renders; no reflow, no value edits.
_DESKTOP_CSS = """
aside { display: none !important; }
main { width: 100% !important; }
"""


# Injected only for the MOBILE capture (after narrowing the viewport). The dashboard
# has no responsive layout — every section is a fixed inline `grid-template-columns`
# — so this walks the content grids and collapses them to the single-column mobile
# shape (matching overview_mobile.png), WITHOUT touching the data tables:
#   • Equal-track card groups (repeat(N,1fr) / "1fr 1fr …"): ≥3 cols → 2 cols;
#     2 cols (the two hero cards) → stacked.
#   • Two-up section rows (mixed fractions, exactly 2 cols — e.g. "1.55fr 1fr",
#     the chart+table and service/product-mix rows): → stacked.
#   • Location tables (mixed fractions, >2 cols — e.g. "1.4fr 1.6fr 0.7fr …") are
#     LEFT ALONE; their `fr` tracks simply shrink to fit the narrow width.
# Charts use Recharts ResponsiveContainer, so they resize to the new width on their
# own. React never re-renders these static inline styles, so the mutations stick.
_MOBILE_REFLOW_JS = """
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
    const allEqual = /^(?:\\s*1fr\\s*,?)+$/.test(raw);
    if (isRepeat || allEqual) {
      el.style.gridTemplateColumns = count >= 3 ? '1fr 1fr' : '1fr';
      el.style.gap = '10px';
    } else if (count === 2) {
      el.style.gridTemplateColumns = '1fr';
      el.style.gap = '12px';
    }
  });
}
"""


def capture_overview(dashboard_url: str, render_wait_ms: int) -> dict:
    """Open the dashboard, load the Overview, and return
    {png_desktop, png_mobile, pdf_bytes}."""
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(
            viewport=VIEWPORT,
            device_scale_factor=DEVICE_SCALE_FACTOR,
        )
        page.goto(dashboard_url, wait_until="networkidle", timeout=NAV_TIMEOUT_MS)

        # Sidebar only renders once the boot API calls resolve — "app is alive".
        page.wait_for_selector("aside", timeout=NAV_TIMEOUT_MS)

        # Make sure we're on the Overview view.
        page.locator("aside a.ev-nav", has_text=VIEW_NAV_TEXT).first.click()
        page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT_MS)

        # Load the Overview data, retrying transient failures. The dashboard is on
        # Railway; a cold start (or the DB waking) can make the first hit to
        # /api/mtd-kpi-header 500, which DataState shows as the error card with a
        # "Retry" button — a reload/Retry then succeeds. So we clear the loading
        # indicator, and if the error card is up we click Retry and wait, up to
        # LOAD_ATTEMPTS times. Only if it STILL fails do we abort (never email an
        # error-state snapshot to recipients).
        for attempt in range(1, LOAD_ATTEMPTS + 1):
            page.wait_for_timeout(1000)
            try:
                page.wait_for_function(
                    "(t) => !document.body.innerText.includes(t)",
                    arg=LOADING_TEXT,
                    timeout=DATA_LOAD_TIMEOUT_MS,
                )
            except PlaywrightTimeoutError:
                print(
                    f"[send_dashboard_email] WARN: '{VIEW_LABEL}' still loading after "
                    f"{DATA_LOAD_TIMEOUT_MS}ms (attempt {attempt}/{LOAD_ATTEMPTS})",
                    file=sys.stderr,
                )

            # Recharts animates via JS (not CSS), so give it a final settle window.
            page.wait_for_timeout(render_wait_ms)

            if page.get_by_text(ERROR_TEXT, exact=False).count() == 0:
                break  # loaded cleanly — proceed to capture

            if attempt < LOAD_ATTEMPTS:
                print(
                    f"[send_dashboard_email] WARN: '{ERROR_TEXT}' on attempt "
                    f"{attempt}/{LOAD_ATTEMPTS}; clicking Retry (likely a cold-start 500)",
                    file=sys.stderr,
                )
                try:
                    page.get_by_text("Retry", exact=False).first.click()
                except Exception:
                    page.reload(wait_until="networkidle", timeout=NAV_TIMEOUT_MS)
                page.wait_for_timeout(LOAD_RETRY_BACKOFF_MS)
            else:
                # Exhausted retries — abort loudly so no error snapshot is emailed.
                snippet = ""
                try:
                    snippet = " ".join(page.locator("main").inner_text().split())[:300]
                except Exception:
                    pass
                raise RuntimeError(
                    f"Overview still failing after {LOAD_ATTEMPTS} attempts — found "
                    f"'{ERROR_TEXT}'; aborting without sending. Page said: {snippet!r}"
                )

        page.evaluate(_UNCLIP_JS)

        # Hide the sidebar; keep the full desktop layout for BOTH outputs below.
        page.add_style_tag(content=_DESKTOP_CSS)
        page.wait_for_timeout(500)  # let <main> settle at full desktop width

        # 1) Desktop PNG — full <main> at 1600px width, 3x (→ 4800px wide,
        # matching overview_desktop.png).
        png_desktop = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' desktop PNG ({len(png_desktop)} bytes)")

        # 2) Desktop PDF — the SAME desktop layout as a single 1600px-wide page
        # (→ 1200pt MediaBox, matching the reference PDF). Captured BEFORE the mobile
        # reflow below so the PDF keeps the multi-column desktop layout. Measure
        # <main> (also hides the sidebar) so the page height fits all content.
        dims = page.evaluate(_MEASURE_FOR_PDF_JS)
        page.wait_for_timeout(200)
        pdf_bytes = page.pdf(
            width=f"{PDF_PAGE_WIDTH}px",
            height=f"{dims['h']}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' PDF ({len(pdf_bytes)} bytes)")

        # 3) Mobile PNG — narrow the viewport to a phone width, then collapse the
        # fixed multi-column grids to the single-column mobile layout (the app has no
        # responsive CSS; _MOBILE_REFLOW_JS does it at capture time only). 430 CSS px
        # × 3 DSF → 1290px wide, matching overview_mobile.png. device_scale_factor is
        # fixed at context creation, so it carries over to this screenshot.
        page.set_viewport_size(MOBILE_VIEWPORT)
        page.wait_for_timeout(800)          # let Recharts ResponsiveContainers resize
        page.evaluate(_MOBILE_REFLOW_JS)
        page.evaluate(_UNCLIP_JS)           # heights changed after the reflow
        page.wait_for_timeout(600)          # settle reflow + chart re-layout
        png_mobile = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' mobile PNG ({len(png_mobile)} bytes)")

        browser.close()
    return {"png_desktop": png_desktop, "png_mobile": png_mobile, "pdf_bytes": pdf_bytes}


def build_html(report_date: str) -> str:
    """Build an HTML body that embeds BOTH Overview captures via cid: references and
    shows the right one per device:
      • Desktop / default → the wide desktop image (cid:overview), 600px medium.
      • Mobile            → the single-column mobile image (cid:overview_mobile), 100%.

    Technique: the desktop block is the default (so Outlook, which ignores media
    queries, shows it); the mobile block is display:none by default AND wrapped in a
    `<!--[if !mso]>` comment so Outlook never renders it. A max-width:600px media
    query then hides desktop / reveals mobile on phones (honored by Apple Mail, iOS
    Mail, Outlook for Mac/mobile, Gmail with Google accounts). Clients that strip
    <style> keep the default = desktop image at 600px — a safe medium fallback.
    """
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* Default (desktop / non-mobile): show wide desktop image, hide mobile */
    .ev-mobile {{ display: none; }}
    @media only screen and (max-width: 600px) {{
      .ev-desktop {{ display: none !important; max-height: 0 !important; overflow: hidden !important; }}
      .ev-mobile  {{ display: block !important; max-height: none !important; overflow: visible !important; }}
      .ev-mobile img {{ width: 100% !important; max-width: 100% !important; height: auto !important; }}
      .ev-pad {{ padding: 18px 10px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:#f6f8f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;">
    <tr><td align="center" class="ev-pad" style="padding:28px 16px;">
      <table role="presentation" width="720" cellpadding="0" cellspacing="0" style="max-width:720px;width:100%;">
        <tr><td style="font:700 22px Arial,Helvetica,sans-serif;color:#1a2b28;padding-bottom:2px;">
          Evolve Med Spa — Overview
        </td></tr>
        <tr><td style="font:400 13px Arial,Helvetica,sans-serif;color:#68807a;padding-bottom:14px;">
          {report_date}
        </td></tr>
        <tr><td align="center" style="padding:0 0 8px 0;">
          <!-- Desktop image (default; hidden on mobile via the media query). The
               width="600" attribute is the OUTLOOK fallback: Outlook (Windows/Word)
               ignores <style> and max-width on images, so the attribute pins it to
               the medium 600px size. -->
          <div class="ev-desktop">
            <img src="cid:{VIEW_KEY}" alt="{VIEW_LABEL}" width="600"
                 style="display:block;width:100%;max-width:600px;height:auto;margin:0 auto;border:1px solid #e2e8e5;border-radius:8px;" />
          </div>
          <!-- Mobile image: hidden by default + skipped entirely by Outlook (mso
               conditional), revealed only on phones by the media query. -->
          <!--[if !mso]><!-- -->
          <div class="ev-mobile" style="display:none;">
            <img src="cid:{MOBILE_KEY}" alt="{VIEW_LABEL}"
                 style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border:1px solid #e2e8e5;border-radius:8px;" />
          </div>
          <!--<![endif]-->
        </td></tr>
        <tr><td style="padding:10px 0 0 0;font:400 12px Arial,Helvetica,sans-serif;color:#68807a;">
          A PDF of the Overview is attached.
        </td></tr>
        <tr><td style="padding:26px 0 0 0;font:400 11px Arial,Helvetica,sans-serif;color:#9aaaa5;border-top:1px solid #e2e8e5;">
          Automated snapshot. Confidential — internal use only.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def main() -> None:
    resend.api_key = _env("RESEND_API_KEY")
    dashboard_url = _env("DASHBOARD_URL")
    email_to = [e.strip() for e in _env("EMAIL_TO").split(",") if e.strip()]
    email_cc = [e.strip() for e in _env("EMAIL_CC", required=False).split(",") if e.strip()]
    email_from = _env("EMAIL_FROM")
    render_wait_ms = int(_env("RENDER_WAIT_MS", required=False, default="2800"))

    report_date = (
        date.today().strftime("%A, %B %-d, %Y")
        if os.name != "nt"
        else date.today().strftime("%A, %B %d, %Y")
    )
    subject = _env("EMAIL_SUBJECT", required=False, default=f"Evolve Dashboard Overview — {report_date}")

    capture = capture_overview(dashboard_url, render_wait_ms)

    html = build_html(report_date)
    attachments = [
        {
            # Desktop inline image referenced by cid: in the HTML body. Both a
            # matching content_id AND an explicit image content_type are required for
            # mail clients (Gmail/Outlook) to render it embedded in the body rather
            # than as a downloadable file.
            "filename": f"{VIEW_KEY}.png",
            "content": base64.b64encode(capture["png_desktop"]).decode("ascii"),
            "content_id": VIEW_KEY,
            "content_type": "image/png",
        },
        {
            # Mobile inline image (shown on phones via the media query in build_html).
            "filename": f"{MOBILE_KEY}.png",
            "content": base64.b64encode(capture["png_mobile"]).decode("ascii"),
            "content_id": MOBILE_KEY,
            "content_type": "image/png",
        },
        {
            # PDF attachment (no content_id → shows as a downloadable file).
            "filename": f"evolve-overview-{date.today().isoformat()}.pdf",
            "content": base64.b64encode(capture["pdf_bytes"]).decode("ascii"),
            "content_type": "application/pdf",
        },
    ]

    params = {
        "from": email_from,
        "to": email_to,
        "subject": subject,
        "html": html,
        "attachments": attachments,
    }
    if email_cc:
        params["cc"] = email_cc

    resend.Emails.send(params)
    recipients = ", ".join(email_to + email_cc)
    print(f"[send_dashboard_email] Sent Overview (desktop + mobile inline images + PDF) to {recipients}")


if __name__ == "__main__":
    main()
