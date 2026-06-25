# Evolve Med Spa — Analytics API

FastAPI backend powering the Evolve Med Spa dashboard.
Connects to SQL Server (Zenoti data) and BigQuery (logging/insights cache).

## Project structure

```
evolve-api/
├── main.py              ← FastAPI app + router registration
├── config.py            ← SQL Server pool + table refs + BQ client
├── db.py                ← run_query, serialize_rows
├── requirements.txt
├── Procfile             ← Railway start command
├── railway.json         ← Railway build config
├── .env.example         ← template for environment variables
├── routers/
│   ├── locations.py     ← GET /api/locations
│   ├── daily.py         ← GET /api/daily-kpis, /api/daily-sales-mix
│   ├── mtd.py           ← GET /api/mtd-kpi-header, /api/mtd-summary, etc.
│   ├── operations.py    ← GET /api/operations-summary, /api/monthly-trend
│   ├── employees.py     ← GET /api/employee-utilization, -rph, -scorecard
│   ├── charts.py        ← GET /api/category-breakdown, /api/revenue-trend
│   ├── appointments.py  ← GET /api/appointments/*
│   ├── insights.py      ← POST /api/insights
│   └── retention.py     ← GET /api/new-guest-return-rate  (NEW)
└── utils/
    ├── filters.py       ← SQL WHERE-clause builders
    ├── errors.py        ← log_and_raise_from_request
    └── request_logs.py  ← RequestLoggingMiddleware → BigQuery
```

## Deploy to Railway (step by step)

### 1. Create a GitHub repo

```bash
cd evolve-api
git init
git add .
git commit -m "initial commit"
```

Create a new repo on GitHub (e.g. `evolve-api`), then push:

```bash
git remote add origin https://github.com/YOUR_USER/evolve-api.git
git branch -M main
git push -u origin main
```

### 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select the `evolve-api` repo you just pushed.
4. Railway auto-detects `railway.json` and starts building.

### 3. Set environment variables

In the Railway service, go to **Variables** tab and add each variable from
`.env.example` with your real values:

| Variable | Value |
|----------|-------|
| `SQL_SERVER_HOST` | `your-server.database.windows.net` |
| `SQL_SERVER_PORT` | `1433` |
| `SQL_SERVER_USER` | your SQL username |
| `SQL_SERVER_PASSWORD` | your SQL password |
| `SQL_SERVER_DATABASE` | your database name |
| `SQL_SALES_TABLE` | `BRONZE_ZENOTI_SALES_ACCRUAL` |
| `SQL_APPT_TABLE` | `BRONZE_ZENOTI_APPOINTMENTS` |
| `SQL_SCHEDULE_TABLE` | `BRONZE_ZENOTI_EMPLOYEE_SCHEDULES` |
| `SQL_CASH_TABLE` | `BRONZE_ZENOTI_CASH_COLLECTIONS` |
| `BIGQUERY_CREDENTIALS_BASE64` | base64-encoded service account JSON |
| `BIGQUERY_PROJECT_ID` | your GCP project ID |
| `BIGQUERY_DATASET` | your BQ dataset |
| `OPENAI_API_KEY` | (optional) for AI insights |
| `GEMINI_API_KEY` | (optional) fallback for AI insights |

**To base64-encode your BigQuery credentials:**
```bash
base64 -w 0 bigquery_service_account.json
```
Paste the output as `BIGQUERY_CREDENTIALS_BASE64`.

**Do NOT commit `.env` or `bigquery_service_account.json` to the repo.**

### 4. Verify

Once deployed, Railway gives you a public URL. Check:

```
https://your-app.up.railway.app/health
→ {"status":"ok","version":"2.1.0"}

https://your-app.up.railway.app/api/locations
→ ["Bel Air, MD", "Bridgewater, NJ", ...]
```

### 5. Point the dashboard at it

In `evolve-dashboard.jsx`, update the `API_BASE` constant (line ~10):

```js
const API_BASE = 'https://your-app.up.railway.app';
```

## New endpoint: /api/new-guest-return-rate

Returns the 90-day new-guest return rate per location (matured cohort).

```
GET /api/new-guest-return-rate?start_date=2026-01-01&end_date=2026-06-30
```

Response:
```json
[
  {
    "location": "Hoboken, NJ",
    "new_guests": 245,
    "returned_90d": 98,
    "matured_new_guests": 180,
    "matured_returned_90d": 72,
    "new_guest_return_rate_90d": 40.0
  }
]
```

The dashboard's "New Guest Return Rate · 90 Day" card on Overview reads this
endpoint automatically. It shows — until deployed, then populates with the
matured-cohort rate and a MoM delta.
