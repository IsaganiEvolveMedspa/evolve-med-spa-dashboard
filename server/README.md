# Evolve Dashboard — Backend API (`/server`)

This is the Node service that connects to SQL Server, runs the computations,
and serves JSON to the dashboard. It must run as its OWN Railway service
(Node runtime) — separate from the static dashboard.

## Files
- `index.js`     — Express server, defines the /api routes
- `db.js`        — SQL Server connection pool (reads credentials from env vars)
- `metrics.js`   — SQL queries + the Node computations (sums, margins, momentum)
- `package.json` — dependencies (express, cors, mssql)
- `.env.example` — the environment variables you must set in Railway

## Deploy on Railway (same repo, second service)
1. Put this `/server` folder in your existing GitHub repo and commit it.
2. In Railway: New Service → Deploy from the same repo.
3. In that service: Settings → Source → set **Root Directory = server**.
   (This makes Railway build/run only this folder, with Node.)
4. Settings → Deploy → Start command: `npm start` (already in package.json).
5. Variables tab → add everything from `.env.example` with your real values.
6. Deploy. Visit `https://<this-service-url>/health` — should return {"ok":true}.

## Connect the dashboard to it
In the DASHBOARD service (project 1), add a variable:
  VITE_API_URL = https://<this-service-url>
Then the dashboard fetches from `${VITE_API_URL}/api/finance`, etc.
(Rebuild the dashboard after adding the variable — Vite bakes it in at build time.)

## IMPORTANT — before it returns real data
Every query in `metrics.js` has a `TODO` with placeholder table/column names
(dbo.financials, dbo.location_monthly). Replace those with your real schema.
Until then the routes will error because those tables don't exist.

## Local test (optional)
  cd server
  npm install
  # create a .env file from .env.example with real values
  npm start
  # open http://localhost:3001/health
