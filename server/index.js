// index.js — Express API. JSON endpoints the dashboard fetches.
import express from 'express';
import cors from 'cors';
import {
  getFinance, getCashKpis, getMembership,
  getStaffProductivity, getOperations, getLocationMatrix,
} from './metrics.js';

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req.query));
  } catch (err) {
    console.error(`[api] ${req.path} failed:`, err.message);
    res.status(500).json({ error: 'query_failed', message: err.message });
  }
};

app.get('/api/finance', handle(getFinance));          // ?month=YYYY-MM&location=Name
app.get('/api/cash', handle(getCashKpis));            // cash sales, visits, customers, ASP
app.get('/api/membership', handle(getMembership));    // new members, adoption rate
app.get('/api/staff', handle(getStaffProductivity));  // rev/util-hr, utilization
app.get('/api/operations', handle(getOperations));    // no-show, cancel, rebook
app.get('/api/locations', handle(getLocationMatrix)); // 12-mo momentum matrix

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
