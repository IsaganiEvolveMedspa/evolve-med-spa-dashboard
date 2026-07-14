"""
Scheduled Dashboard Snapshot Email
==================================
Opens the live Evolve dashboard in a headless browser, captures the OVERVIEW
view, and emails it as:
  • an INLINE image in the email body, and
  • a PDF of the Overview attached to the same email.

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

# --- The single view we capture ---
VIEW_KEY = "overview"
VIEW_LABEL = "Overview"
VIEW_NAV_TEXT = "Overview"

# Two renders, BOTH from the full DESKTOP layout (matching the reference
# overview_desktop.png / evolve-overview PDF — sidebar hidden, filter bar kept):
#   • Inline PNG → desktop <main> at 1600 CSS px, 3x → 4800px wide.
#   • PDF        → the SAME desktop layout as a 1600px-wide page → 1200pt MediaBox.
# The dashboard loads at desktop width and stays there; we only hide the sidebar
# (via _DESKTOP_CSS) so the capture is the content at full desktop width.
VIEWPORT       = {"width": 1600, "height": 1200}   # desktop load + capture width
PDF_PAGE_WIDTH = 1600                                # desktop PDF page width (px) → 1200pt
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


def capture_overview(dashboard_url: str, render_wait_ms: int) -> dict:
    """Open the dashboard, load the Overview, and return {png_bytes, pdf_bytes}."""
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

        # Wait for the "Loading live data…" indicator to clear so we never
        # capture the loading skeleton.
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
                f"{DATA_LOAD_TIMEOUT_MS}ms; capturing anyway",
                file=sys.stderr,
            )

        # Recharts animates via JS (not CSS), so give it a final settle window.
        page.wait_for_timeout(render_wait_ms)

        page.evaluate(_UNCLIP_JS)

        # Hide the sidebar; keep the full desktop layout for BOTH outputs below.
        page.add_style_tag(content=_DESKTOP_CSS)
        page.wait_for_timeout(500)  # let <main> settle at full desktop width

        # 1) Inline PNG — screenshot the full desktop <main> at 1600px width, 3x
        # (→ 4800px wide, matching overview_desktop.png).
        png_bytes = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' PNG ({len(png_bytes)} bytes)")

        # 2) Desktop PDF — the SAME desktop layout as a single 1600px-wide page
        # (→ 1200pt MediaBox, matching the reference PDF). Measure <main> (also
        # hides the sidebar) so the page height fits all content on one page.
        dims = page.evaluate(_MEASURE_FOR_PDF_JS)
        page.wait_for_timeout(200)
        pdf_bytes = page.pdf(
            width=f"{PDF_PAGE_WIDTH}px",
            height=f"{dims['h']}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' PDF ({len(pdf_bytes)} bytes)")

        browser.close()
    return {"png_bytes": png_bytes, "pdf_bytes": pdf_bytes}


def build_html(report_date: str) -> str:
    """Build an HTML body with the Overview image inline via a cid: reference.

    The inline image is a responsive PREVIEW (full detail is in the attached PDF):
      • Desktop → medium, capped at 600px wide (.ev-snap default + inline fallback).
      • Mobile  → smaller, capped at 320px and centered, via the max-width:600px
        media query in the <style> block below.
    Media queries are honored by Apple Mail, iOS Mail, Outlook for Mac and Gmail
    (Google accounts); clients that ignore <style> fall back to the inline
    width:100%;max-width:600px, i.e. the medium desktop size.
    """
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    /* Desktop / default: medium preview */
    .ev-snap {{ width: 100% !important; max-width: 600px !important; height: auto !important; }}
    /* Mobile: smaller, centered preview (detail lives in the attached PDF) */
    @media only screen and (max-width: 600px) {{
      .ev-snap {{ max-width: 320px !important; }}
      .ev-pad  {{ padding: 20px 12px !important; }}
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
          <!-- width="600" is the OUTLOOK fallback: Outlook (Windows/Word engine)
               ignores <style> media queries AND max-width on images, so without an
               explicit width attribute it renders the PNG at its native size. The
               attribute pins it to the medium 600px desktop size; CSS-capable
               clients still use the inline/media-query rules (100%→600 desktop,
               320 mobile), which override the attribute. -->
          <img class="ev-snap" src="cid:{VIEW_KEY}" alt="{VIEW_LABEL}" width="600"
               style="display:block;width:100%;max-width:600px;height:auto;margin:0 auto;border:1px solid #e2e8e5;border-radius:8px;" />
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
            # Inline image referenced by cid: in the HTML body. Both a matching
            # content_id AND an explicit image content_type are required for mail
            # clients (Gmail/Outlook) to render it embedded in the body rather
            # than as a downloadable file.
            "filename": f"{VIEW_KEY}.png",
            "content": base64.b64encode(capture["png_bytes"]).decode("ascii"),
            "content_id": VIEW_KEY,
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
    print(f"[send_dashboard_email] Sent Overview (inline image + PDF) to {recipients}")


if __name__ == "__main__":
    main()
