"""
Scheduled Dashboard Snapshot Email
==================================
Opens the live Evolve dashboard in a headless browser, screenshots the key
executive views, and emails them as INLINE images stacked in the email body.

  • No link to the dashboard is ever placed in the email (by design — the
    dashboard is public, so we ship pictures, not a live URL).
  • Views captured: Overview, Finance, Operations, Marketing (Acquisition).
  • Delivered via Resend (HTTP API — Railway blocks outbound SMTP ports).

Intended to run as a Railway Cron service:
    Build:  pip install -r requirements.txt && playwright install --with-deps chromium
    Start:  python scripts/send_dashboard_email.py
    Cron:   0 11 * * *   (11:00 UTC ~= 7:00 AM ET — cron runs in UTC)

Environment variables (set in Railway → Variables):
    RESEND_API_KEY   Resend API key
    DASHBOARD_URL    Live dashboard URL (used only inside this script — never emailed)
    EMAIL_TO         Comma-separated recipient list
    EMAIL_FROM       Verified sender, e.g. "Evolve Dashboard <reports@yourdomain.com>"
    EMAIL_SUBJECT    (optional) Subject line override
    RENDER_WAIT_MS   (optional) Extra settle time per view for charts to paint (default 2800)
"""

from __future__ import annotations

import base64
import os
import sys
from datetime import date

import resend
from playwright.sync_api import sync_playwright

# --- Views to capture, in email order ---
# label   -> shown as the heading above the image in the email
# nav_text -> substring of the sidebar link text used to click it
VIEWS = [
    {"key": "overview",   "label": "Overview",   "nav_text": "Overview"},
    {"key": "finance",    "label": "Finance",    "nav_text": "Finance"},
    {"key": "operations", "label": "Operations", "nav_text": "Operations"},
    {"key": "marketing",  "label": "Marketing",  "nav_text": "Acquisition"},
]

VIEWPORT = {"width": 1600, "height": 1200}
NAV_TIMEOUT_MS = 60_000


def _env(name: str, required: bool = True, default: str | None = None) -> str:
    val = os.getenv(name, default)
    if required and not val:
        print(f"[send_dashboard_email] Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return val or ""


# JS that removes the height:100vh / overflow:hidden constraints so a full-page
# screenshot captures the ENTIRE view instead of just the visible viewport.
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


def capture_views(dashboard_url: str, render_wait_ms: int) -> list[dict]:
    """Return a list of {key, label, png_bytes} for every view we could capture."""
    shots: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=2)
        page.goto(dashboard_url, wait_until="networkidle", timeout=NAV_TIMEOUT_MS)

        # Sidebar only renders once the boot API calls resolve — this is our
        # "the app is alive" signal.
        page.wait_for_selector("aside", timeout=NAV_TIMEOUT_MS)

        for view in VIEWS:
            try:
                link = page.locator("aside a.ev-nav", has_text=view["nav_text"]).first
                link.click()
                page.wait_for_load_state("networkidle", timeout=NAV_TIMEOUT_MS)
                # Recharts animates via JS (not CSS), so we can't disable it —
                # give each view a fixed settle window to finish painting.
                page.wait_for_timeout(render_wait_ms)

                page.evaluate(_UNCLIP_JS)
                page.wait_for_timeout(300)  # let layout reflow after unclipping

                # Screenshot <main> only → topbar (with the view title) + full
                # content, without repeating the sidebar in every image.
                png = page.locator("main").screenshot(type="png")
                shots.append({"key": view["key"], "label": view["label"], "png_bytes": png})
                print(f"[send_dashboard_email] Captured '{view['label']}' ({len(png)} bytes)")
            except Exception as exc:  # keep going so one bad view doesn't kill the email
                print(f"[send_dashboard_email] FAILED to capture '{view['label']}': {exc}", file=sys.stderr)

        browser.close()
    return shots


def build_html(shots: list[dict], report_date: str) -> str:
    """Build an HTML body with each screenshot inline via cid: references."""
    sections = []
    for shot in shots:
        sections.append(
            f"""
      <tr><td style="padding:28px 0 8px 0;font:600 16px Arial,Helvetica,sans-serif;color:#1a2b28;">
        {shot['label']}
      </td></tr>
      <tr><td style="padding:0 0 8px 0;">
        <img src="cid:{shot['key']}" alt="{shot['label']}"
             style="display:block;width:100%;max-width:900px;height:auto;border:1px solid #e2e8e5;border-radius:8px;" />
      </td></tr>"""
        )
    body = "".join(sections)
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f6f8f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8f7;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="900" cellpadding="0" cellspacing="0" style="max-width:900px;width:100%;">
        <tr><td style="font:700 22px Arial,Helvetica,sans-serif;color:#1a2b28;padding-bottom:2px;">
          Evolve Med Spa — Dashboard Snapshot
        </td></tr>
        <tr><td style="font:400 13px Arial,Helvetica,sans-serif;color:#68807a;padding-bottom:8px;">
          {report_date}
        </td></tr>
        {body}
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
    email_from = _env("EMAIL_FROM")
    render_wait_ms = int(_env("RENDER_WAIT_MS", required=False, default="2800"))

    report_date = date.today().strftime("%A, %B %-d, %Y") if os.name != "nt" else date.today().strftime("%A, %B %d, %Y")
    subject = _env("EMAIL_SUBJECT", required=False, default=f"Evolve Dashboard Snapshot — {report_date}")

    shots = capture_views(dashboard_url, render_wait_ms)
    if not shots:
        print("[send_dashboard_email] No views captured — aborting, no email sent.", file=sys.stderr)
        sys.exit(1)

    html = build_html(shots, report_date)
    attachments = [
        {
            "filename": f"{shot['key']}.png",
            "content": base64.b64encode(shot["png_bytes"]).decode("ascii"),
            "content_id": shot["key"],  # matches cid: in the HTML → renders inline
        }
        for shot in shots
    ]

    resend.Emails.send(
        {
            "from": email_from,
            "to": email_to,
            "subject": subject,
            "html": html,
            "attachments": attachments,
        }
    )
    print(f"[send_dashboard_email] Sent {len(shots)} inline images to {', '.join(email_to)}")


if __name__ == "__main__":
    main()
