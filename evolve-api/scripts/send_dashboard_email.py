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

# Content-IDs for the two INLINE images (referenced via cid: in the HTML body).
# The email ships both; each client renders the one that fits its screen (see
# build_html): phones/narrow clients get the compact mobile image, Outlook
# desktop and wide clients get the full desktop dashboard.
CID_MOBILE = "overview_mobile"
CID_DESKTOP = "overview_desktop"
# Display width (px) of the embedded desktop image in the email body.
DESKTOP_EMAIL_WIDTH = 640

# Three renders from one page load:
#   • Desktop PNG (inline) → full desktop layout, embedded for Outlook desktop /
#     wide clients. Captured at desktop width before the compacting CSS.
#   • Mobile PNG (inline)  → compact phone layout: stacked cards, chart stacked,
#     filters hidden, tables shrunk to fit. Captured at phone width with
#     _COMPACT_PNG_CSS injected.
#   • PDF attachment       → same desktop layout as a high-res downloadable copy.
# The dashboard components themselves stay large, so the live dashboard, the
# desktop PNG, and the PDF all read large; only the mobile PNG is compacted.
PDF_VIEWPORT = {"width": 1600, "height": 1200}
PNG_VIEWPORT = {"width": 430, "height": 1200}
# The inline PNG is rendered at 3x so the dense tables stay legible in the email
# body AND remain crisp if the recipient taps to zoom in their mail client.
# NOTE: this affects screenshots only — page.pdf() renders at print resolution
# and ignores device_scale_factor, so the attached PDF is unchanged.
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


# Injected for the INLINE PNG only (phone width): compact phone layout. The
# dashboard components stay large; this CSS reflows/shrinks them just for the
# emailed image. The PDF is captured before this is applied, so it stays large.
_COMPACT_PNG_CSS = """
aside { display: none !important; }
main { width: 100% !important; }
/* Picture, not an interactive page: drop the location filter + Export button
   (the month selector stays, showing the current month). */
.ev-filter { display: none !important; }
/* Stack the desktop multi-column rows into a phone layout. */
main [style*="repeat("] { grid-template-columns: repeat(2, 1fr) !important; }
main [style*="1.55fr"] { grid-template-columns: 1fr !important; }
main [style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
/* Stack each hero card's columns vertically; hide the vertical dividers. */
.ev-hero-cols { flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
.ev-hero-cols > div[style*="width: 3px"] { display: none !important; }
/* Shrink the location tables so every column fully fits at phone width. */
main table, main th, main td { font-size: 6px !important; }
main th, main td { padding: 1px 2px !important; letter-spacing: 0 !important; }
/* Drop the non-functional "?" icons in table headers to reclaim column width. */
main th .ev-info { display: none !important; }
/* Reclaim side padding so the tables have the full phone width to work with. */
.ev-scroll { padding-left: 12px !important; padding-right: 12px !important; }
"""


def capture_overview(dashboard_url: str, render_wait_ms: int) -> dict:
    """Open the dashboard, load the Overview, and return
    {mobile_png, desktop_png, pdf_bytes}."""
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(
            viewport=PDF_VIEWPORT,
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

        # 1) DESKTOP artifacts FIRST — full desktop layout (no compacting CSS yet).
        # Hide the sidebar and measure the content once; reuse for both the inline
        # desktop PNG and the PDF so they match exactly.
        dims = page.evaluate(_MEASURE_FOR_PDF_JS)
        page.wait_for_timeout(200)  # reflow after hiding the sidebar

        # 1a) Inline desktop PNG — the embedded image Outlook desktop / wide
        # clients render in the body (screenshot of <main> at desktop width).
        desktop_png = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' desktop PNG ({len(desktop_png)} bytes)")

        # 1b) PDF — same desktop layout as a high-res downloadable copy. Pin the
        # page to the desktop viewport width; height follows the measured content.
        pdf_bytes = page.pdf(
            width=f"{PDF_VIEWPORT['width']}px",
            height=f"{dims['h']}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' PDF ({len(pdf_bytes)} bytes)")

        # 2) Inline mobile PNG — compact phone layout: shrink the viewport to
        # phone width and inject the compacting CSS, then screenshot <main>.
        page.set_viewport_size(PNG_VIEWPORT)
        page.add_style_tag(content=_COMPACT_PNG_CSS)
        page.wait_for_timeout(500)  # let the layout reflow at phone width
        mobile_png = page.locator("main").screenshot(type="png")
        print(f"[send_dashboard_email] Captured '{VIEW_LABEL}' mobile PNG ({len(mobile_png)} bytes)")

        browser.close()
    return {"mobile_png": mobile_png, "desktop_png": desktop_png, "pdf_bytes": pdf_bytes}


def build_html(report_date: str) -> str:
    """Build an HTML body that embeds BOTH the mobile and desktop Overview images
    inline (cid:) and lets each client render the one that fits its screen.

    Detection is client-side, not server-side (email can't be adapted at open
    time). Two mechanisms combine to cover every client:
      • CSS media query (min-width) — Apple Mail, Gmail, iOS/Android: swap to the
        desktop image on wide screens, keep the mobile image on phones.
      • MSO conditional comments — Outlook desktop uses the Word engine and
        ignores media queries, so it's fed the desktop image directly.
    """
    return f"""<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /* Desktop image hidden by default; revealed on wide, media-query-capable
     clients. Hidden from Outlook via mso-hide (it uses the [if mso] block). */
  .ev-desktop {{ display:none; mso-hide:all; max-height:0; overflow:hidden; }}
  @media only screen and (min-width:600px) {{
    .ev-mobile  {{ display:none !important; }}
    .ev-desktop {{ display:block !important; max-height:none !important; overflow:visible !important; }}
    .ev-shell   {{ max-width:{DESKTOP_EMAIL_WIDTH + 40}px !important; width:{DESKTOP_EMAIL_WIDTH + 40}px !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#f6f8f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" class="ev-shell" width="{DESKTOP_EMAIL_WIDTH + 40}" cellpadding="0" cellspacing="0" style="max-width:{DESKTOP_EMAIL_WIDTH + 40}px;width:100%;">
        <tr><td style="font:700 22px Arial,Helvetica,sans-serif;color:#1a2b28;padding-bottom:2px;">
          Evolve Med Spa — Overview
        </td></tr>
        <tr><td style="font:400 13px Arial,Helvetica,sans-serif;color:#68807a;padding-bottom:14px;">
          {report_date}
        </td></tr>
        <tr><td style="padding:0 0 8px 0;">
          <!--[if !mso]><!-->
          <img class="ev-mobile" src="cid:{CID_MOBILE}" alt="{VIEW_LABEL}"
               style="display:block;width:100%;max-width:430px;height:auto;border:1px solid #e2e8e5;border-radius:8px;" />
          <img class="ev-desktop" src="cid:{CID_DESKTOP}" alt="{VIEW_LABEL}"
               style="width:100%;max-width:{DESKTOP_EMAIL_WIDTH}px;height:auto;border:1px solid #e2e8e5;border-radius:8px;" />
          <!--<![endif]-->
          <!--[if mso]>
          <img src="cid:{CID_DESKTOP}" alt="{VIEW_LABEL}" width="{DESKTOP_EMAIL_WIDTH}"
               style="width:{DESKTOP_EMAIL_WIDTH}px;height:auto;" />
          <![endif]-->
        </td></tr>
        <tr><td style="padding:10px 0 0 0;font:400 12px Arial,Helvetica,sans-serif;color:#68807a;">
          A high-resolution PDF of the Overview is attached.
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
            # Inline MOBILE image (cid). A matching content_id AND an explicit
            # image content_type are required for mail clients to render it
            # embedded in the body rather than as a downloadable file.
            "filename": f"{CID_MOBILE}.png",
            "content": base64.b64encode(capture["mobile_png"]).decode("ascii"),
            "content_id": CID_MOBILE,
            "content_type": "image/png",
        },
        {
            # Inline DESKTOP image (cid) — rendered by Outlook desktop / wide clients.
            "filename": f"{CID_DESKTOP}.png",
            "content": base64.b64encode(capture["desktop_png"]).decode("ascii"),
            "content_id": CID_DESKTOP,
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
