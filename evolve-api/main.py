"""
Evolve Med Spa — Analytics API
================================
This file is the orchestrator only.
No SQL, no business logic, no filter helpers.

Responsibilities:
  1. Create the FastAPI app instance.
  2. Configure CORS.
  3. Register all routers.
  4. Expose /health.

Everything else lives in:
  config.py          <- SQL Server connection pool + table references
  db.py              <- run_query, serialize_rows
  utils/filters.py   <- WHERE-clause builders
  utils/errors.py    <- structured error logger
  routers/
    locations.py     <- GET /api/locations
    daily.py         <- GET /api/daily-kpis, /api/daily-sales-mix
    mtd.py           <- GET /api/mtd-kpi-header, /api/mtd-summary, /api/mtd-sales-mix
    operations.py    <- GET /api/operations-summary, /api/monthly-trend
    employees.py     <- GET /api/employee-utilization, /api/employee-rph, /api/employee-scorecard
    charts.py        <- GET /api/category-breakdown, /api/revenue-trend
    appointments.py  <- GET /api/appointments/*
    insights.py      <- POST /api/insights
    retention.py     <- GET /api/new-guest-return-rate
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import triggers config.py -> SQL Server connection pool init
import config  # noqa: F401  (side-effect import)

from routers import locations, daily, mtd, operations, employees, charts, appointments, insights, retention, inventory
from utils.request_logs import RequestLoggingMiddleware


# --- App ---
app = FastAPI(
    title="Evolve Med Spa Dashboard API",
    version="2.1.0",
    description="Analytics API for the Evolve Med Spa multi-location dashboard.",
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to your frontend domain in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
# --- Request / error logging ---
app.add_middleware(RequestLoggingMiddleware)

# --- Routers ---
app.include_router(locations.router,    tags=["Locations"])
app.include_router(daily.router,        tags=["Daily KPIs"])
app.include_router(mtd.router,          tags=["MTD Performance"])
app.include_router(operations.router,   tags=["Operations"])
app.include_router(employees.router,    tags=["Employees"])
app.include_router(charts.router,       tags=["Charts"])
app.include_router(appointments.router, tags=["Appointments"])
app.include_router(insights.router,     tags=["AI Insights"])
app.include_router(retention.router,    tags=["Retention"])
app.include_router(inventory.router,    tags=["Inventory"])

# --- Health ---
@app.get("/health", tags=["System"])
def health():
    """Liveness probe — returns 200 if the API process is running.

    Also echoes the overlay wiring the *running process* actually loaded, so we
    can confirm the OVERLAY_ENABLED env var reached this deployment without
    guessing at the Railway UI. `overlay_env_raw` shows the raw string (quotes /
    whitespace visible); `overlay_enabled` is the parsed boolean; `cogs_source`
    is the table/view the COGS queries will hit.
    """
    return {
        "status": "ok",
        "version": app.version,
        "overlay_enabled": config.OVERLAY_ENABLED,
        "overlay_env_raw": repr(os.getenv("OVERLAY_ENABLED")),
        "cogs_source": config.FULL_COGS,
        "sales_source": config.FULL_SALES,
    }
