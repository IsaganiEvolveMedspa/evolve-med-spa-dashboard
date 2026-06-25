import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, AreaChart, Area, Tooltip,
} from 'recharts';

/* =================================================================
   API CLIENT
   All data comes from the FastAPI backend. No hardcoded business
   values live in this file — only labels, colors, and layout.
   ================================================================= */

const API_BASE = 'https://evolvedspadashboarddemo-production.up.railway.app';

// Build a querystring from {start_date, end_date, locations[], date}
const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.start_date) qs.append('start_date', params.start_date);
  if (params.end_date) qs.append('end_date', params.end_date);
  if (params.date) qs.append('date', params.date);
  if (Array.isArray(params.locations)) {
    params.locations.forEach((l) => qs.append('locations', l));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
};

const apiGet = async (path, params, signal) => {
  const res = await fetch(`${API_BASE}${path}${buildQuery(params)}`, { signal });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return res.json();
};

/* =================================================================
   GLOBAL FILTER CONTEXT — date range + selected locations
   Shared by every view so one set of controls drives all fetches.
   ================================================================= */

const FilterContext = createContext(null);
const useFilters = () => useContext(FilterContext);

/* =================================================================
   DATA-FETCH HOOK
   Fetches one or more endpoints, re-running whenever the filter
   key changes. Returns { data, loading, error, reload }.
   `endpoints` is an object: { name: { path, params } }.
   ================================================================= */

const useApiData = (endpoints, deps) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Stable serialization of the endpoint spec so the effect only
  // re-runs when something meaningful changes.
  const spec = JSON.stringify(endpoints);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const parsed = JSON.parse(spec);
        const names = Object.keys(parsed);
        const results = await Promise.all(
          names.map((n) => apiGet(parsed[n].path, parsed[n].params, controller.signal))
        );
        if (cancelled) return;
        const next = {};
        names.forEach((n, i) => { next[n] = results[i]; });
        setData(next);
      } catch (e) {
        if (e.name === 'AbortError' || cancelled) return;
        setError(e.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();

    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, nonce, ...(deps || [])]);

  return { data, loading, error, reload };
};

/* =================================================================
   FORMATTING HELPERS
   Pure presentation — turn raw numbers from the API into the
   strings the original design displayed.
   ================================================================= */

const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

const money = (v, opts = {}) => {
  const x = n(v);
  if (x === null) return '—';
  const { compact = false, decimals } = opts;
  if (compact) {
    const abs = Math.abs(x);
    if (abs >= 1e6) return `$${(x / 1e6).toFixed(decimals ?? 2)}M`;
    if (abs >= 1e3) return `$${(x / 1e3).toFixed(decimals ?? 0)}K`;
    return `$${x.toFixed(decimals ?? 0)}`;
  }
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: decimals ?? 0 })}`;
};

const moneyK = (v, decimals = 0) => {
  const x = n(v);
  if (x === null) return '—';
  return `$${(x / 1e3).toFixed(decimals)}K`;
};

const pct = (v, decimals = 1) => {
  const x = n(v);
  if (x === null) return '—';
  // Accept either 0–1 fractions or already-scaled 0–100 values.
  const scaled = Math.abs(x) <= 1 ? x * 100 : x;
  return `${scaled.toFixed(decimals)}%`;
};

const num = (v, decimals = 0) => {
  const x = n(v);
  if (x === null) return '—';
  return x.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

// Signed-change note with arrow + sign, given a number that's already a delta.
const deltaNote = (v, { unit = '%', decimals = 1, invertGood = false } = {}) => {
  const x = n(v);
  if (x === null) return { text: '—', positive: true };
  const up = x >= 0;
  const arrow = up ? '▲' : '▼';
  const good = invertGood ? !up : up;
  const val = Math.abs(x).toFixed(decimals);
  return { text: `${arrow} ${val}${unit === 'pt' ? ' pt' : unit}`, positive: good };
};

// Short month label from a YYYY-MM-DD string.
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return MONTHS_SHORT[d.getMonth()];
};
const dayLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.getDate();
};

// Pretty range subtitle for headers.
const rangeSubtitle = (start, end) => {
  if (!start || !end) return '';
  const s = new Date(start), e = new Date(end);
  const fmt = (d) => `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return fmt(s) === fmt(e) ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
};

/* =================================================================
   SHARED UI PRIMITIVES
   ================================================================= */

const Spinner = () => (
  <span className="inline-block w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
);

// Wraps a view body: shows a skeleton while loading and a clear,
// actionable message on failure (frontend-design: errors give direction).
const DataState = ({ loading, error, onRetry, children, minRows = 3 }) => {
  if (loading) {
    return (
      <div className="px-9 py-8 space-y-4">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Spinner /> Loading live data…
        </div>
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px] animate-pulse">
              <div className="h-3 w-2/3 bg-gray-100 rounded" />
              <div className="h-8 w-1/2 bg-gray-100 rounded mt-6" />
              <div className="h-3 w-1/3 bg-gray-100 rounded mt-4" />
            </div>
          ))}
        </div>
        {Array.from({ length: minRows }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 h-48 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-9 py-8">
        <div className="bg-white rounded-xl border border-orange-200 p-10 text-center">
          <p className="text-base font-bold text-gray-900">Couldn't load this view</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{error}</p>
          <p className="text-xs text-gray-400 mt-2">Check the connection to the reporting API and try again.</p>
          <button
            onClick={onRetry}
            className="mt-5 px-5 py-2.5 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  return children;
};

// Shown for views the API reference has no endpoint for.
const NoEndpoint = ({ title, detail }) => (
  <div className="px-9 py-8">
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <p className="text-base font-bold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">{detail}</p>
    </div>
  </div>
);

const KpiCard = ({ label, value, note, positive = true, minH = 120 }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5" style={{ minHeight: minH }}>
    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
    <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{value}</p>
    {note != null && (
      <p className={`text-xs font-semibold mt-2 ${positive ? 'text-teal-600' : 'text-orange-600'}`}>{note}</p>
    )}
  </div>
);

const Legend = ({ color, label }) => (
  <span className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }}></span>
    {label}
  </span>
);

const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-4 mb-4">
    <h2 className="text-sm font-bold text-teal-700 uppercase tracking-[4px]">{title}</h2>
    <div className="h-px bg-gray-200 flex-1"></div>
  </div>
);

const PacingStat = ({ label, value, note }) => (
  <div>
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-tight max-w-[110px]">{label}</p>
    <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
    {note != null && <p className="text-xs text-gray-500 mt-1">{note}</p>}
  </div>
);

/* =================================================================
   MONTH HELPERS for the date-range picker
   The picker offers recent months; "locations" come from /api/locations.
   The default range is the latest available month from /api/latest-date.
   ================================================================= */

const firstOfMonth = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}-01`;
const lastOfMonth = (y, m) => {
  const d = new Date(y, m + 1, 0);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthOptionsBack = (anchorDate, count = 12) => {
  const opts = [];
  const base = new Date(anchorDate);
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    opts.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`,
      start: firstOfMonth(d.getFullYear(), d.getMonth()),
      end: lastOfMonth(d.getFullYear(), d.getMonth()),
    });
  }
  return opts;
};

/* =================================================================
   MAIN DASHBOARD
   ================================================================= */

const Dashboard = () => {
  const [activeView, setActiveView] = useState('Overview');

  // Bootstrap: latest available date + the location list.
  const [boot, setBoot] = useState({ loading: true, error: null, latestDate: null, locations: [] });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const [latest, locs] = await Promise.all([
          apiGet('/api/latest-date', {}, controller.signal),
          apiGet('/api/locations', {}, controller.signal),
        ]);
        if (cancelled) return;
        setBoot({
          loading: false,
          error: null,
          latestDate: latest?.latest_date || null,
          locations: Array.isArray(locs) ? locs : [],
        });
      } catch (e) {
        if (e.name === 'AbortError' || cancelled) return;
        setBoot((b) => ({ ...b, loading: false, error: e.message }));
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Filter state: month range + chosen locations ([] = all).
  const monthOpts = useMemo(
    () => monthOptionsBack(boot.latestDate || new Date(), 12),
    [boot.latestDate]
  );
  const [monthKey, setMonthKey] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]); // empty = all
  const [locOpen, setLocOpen] = useState(false);

  // Once months are known, default to the latest month.
  useEffect(() => {
    if (!monthKey && monthOpts.length) setMonthKey(monthOpts[0].key);
  }, [monthOpts, monthKey]);

  const activeMonth = useMemo(
    () => monthOpts.find((m) => m.key === monthKey) || monthOpts[0],
    [monthOpts, monthKey]
  );

  const filters = useMemo(() => ({
    start_date: activeMonth?.start,
    end_date: activeMonth?.end,
    latestDate: boot.latestDate,
    // Send undefined (not []) so "all locations" omits the param entirely.
    locations: selectedLocations.length ? selectedLocations : undefined,
    allLocations: boot.locations,
    monthLabel: activeMonth?.label || '',
    ready: !!(activeMonth?.start && activeMonth?.end),
  }), [activeMonth, selectedLocations, boot.latestDate, boot.locations]);

  const locationSummary = selectedLocations.length === 0
    ? `All ${boot.locations.length || ''} locations`.trim()
    : selectedLocations.length === 1
      ? selectedLocations[0]
      : `${selectedLocations.length} locations`;

  const toggleLocation = (loc) => {
    setSelectedLocations((cur) =>
      cur.includes(loc) ? cur.filter((l) => l !== loc) : [...cur, loc]
    );
  };

  const navItems = [
    { label: 'Overview' },
    { label: 'Finance' },
    { label: 'Operations' },
    { label: 'Locations' },
    { label: 'Marketing', children: ['Acquisition', 'Call Center'] },
    { label: 'Clinical' },
    { label: 'Patients / CRM' },
    { label: 'Staff / Providers' },
    { label: 'Inventory' },
    { label: 'Memberships' },
  ];

  const Sidebar = () => (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-[#071f1b] text-white flex flex-col">
      <div className="p-6 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-teal-500 flex items-center justify-center font-bold text-lg">E</div>
        <div>
          <div className="text-2xl font-bold leading-none">Evolve</div>
          <div className="text-xs tracking-[3px] text-teal-200 mt-1">MED SPA</div>
        </div>
      </div>

      <div className="px-6 pt-7 pb-3 text-xs tracking-[4px] text-teal-300">BUSINESS HEALTH</div>

      <nav className="flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const { label, children } = item;
          const childActive = children && children.includes(activeView);
          const isActive = label === activeView;
          if (children) {
            return (
              <div key={label}>
                <div
                  className={`w-full text-left px-6 py-4 flex items-center justify-between gap-3 ${
                    childActive ? 'bg-[#0d322d] border-l-4 border-teal-400 font-semibold' : 'text-teal-100 border-l-4 border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${childActive ? 'bg-teal-400' : 'bg-slate-500'}`}></span>
                    {label}
                  </span>
                  <span className="text-teal-300 text-xs">▾</span>
                </div>
                {children.map((child) => {
                  const active = child === activeView;
                  return (
                    <button
                      key={child}
                      onClick={() => setActiveView(child)}
                      className={`w-full text-left pl-14 pr-6 py-3 flex items-center gap-3 text-sm ${
                        active ? 'bg-[#103c35] border-l-4 border-teal-400 font-semibold text-white' : 'text-teal-100 hover:bg-[#0d322d] border-l-4 border-transparent'
                      }`}
                    >
                      <span className="text-teal-400">—</span>
                      {child}
                    </button>
                  );
                })}
              </div>
            );
          }
          return (
            <button
              key={label}
              onClick={() => setActiveView(label)}
              className={`w-full text-left px-6 py-4 flex items-center gap-3 ${
                isActive
                  ? 'bg-[#103c35] border-l-4 border-teal-400 font-semibold'
                  : 'text-teal-100 hover:bg-[#0d322d] border-l-4 border-transparent'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-teal-400' : 'bg-slate-500'}`}></span>
              {label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center font-semibold">VR</div>
        <div>
          <div className="font-semibold">Vidur R.</div>
          <div className="text-xs text-teal-200">Owner · All access</div>
        </div>
      </div>
    </aside>
  );

  const Header = ({ title, subtitle }) => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="px-9 py-7 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Location multi-select (driven by /api/locations) */}
          <div className="relative">
            <button
              onClick={() => setLocOpen((o) => !o)}
              className="px-5 py-3 rounded-lg border border-gray-300 bg-white text-sm flex items-center gap-2 min-w-[180px] justify-between"
            >
              <span className="truncate">{locationSummary}</span>
              <span className="text-gray-400 text-xs">▾</span>
            </button>
            {locOpen && (
              <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-30 p-2">
                <button
                  onClick={() => { setSelectedLocations([]); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedLocations.length === 0 ? 'bg-teal-50 text-teal-700 font-semibold' : 'hover:bg-gray-50'}`}
                >
                  All locations
                </button>
                <div className="h-px bg-gray-100 my-1" />
                {boot.locations.map((loc) => {
                  const checked = selectedLocations.includes(loc);
                  return (
                    <button
                      key={loc}
                      onClick={() => toggleLocation(loc)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${checked ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300'}`}>
                        {checked ? '✓' : ''}
                      </span>
                      <span className="truncate">{loc}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Month range (built from /api/latest-date) */}
          <select
            value={monthKey || ''}
            onChange={(e) => setMonthKey(e.target.value)}
            className="px-5 py-3 rounded-lg border border-gray-300 bg-white text-sm"
          >
            {monthOpts.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>

          <button className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700">Export</button>
        </div>
      </div>
    </header>
  );

  // Bootstrap gate.
  if (boot.loading) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500"><Spinner /> Connecting to reporting API…</div>
      </div>
    );
  }
  if (boot.error) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center px-6">
        <div className="bg-white rounded-xl border border-orange-200 p-10 text-center max-w-md">
          <p className="text-base font-bold text-gray-900">Can't reach the reporting API</p>
          <p className="text-sm text-gray-500 mt-2">{boot.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-5 py-2.5 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  const sub = rangeSubtitle(filters.start_date, filters.end_date);

  const views = {
    'Finance': { title: 'Finance', subtitle: `Revenue, margin & profitability · ${sub}`, body: <FinanceView /> },
    'Operations': { title: 'Operations', subtitle: `Capacity, utilization & throughput · ${sub}`, body: <OperationsView /> },
    'Locations': { title: 'Locations', subtitle: 'Per-location performance vs prior periods', body: <LocationsView /> },
    'Acquisition': { title: 'Marketing · Acquisition', subtitle: `Booking sources & acquisition · ${sub}`, body: <AcquisitionView /> },
    'Call Center': { title: 'Call Center', subtitle: 'Lead response & agent performance · Aesthetix CRM', body: <CallCenterView /> },
    'Clinical': { title: 'Clinical', subtitle: `Service volumes & outcomes · ${sub}`, body: <ClinicalView /> },
    'Patients / CRM': { title: 'Patients / CRM', subtitle: `Acquisition, retention & mix · ${sub}`, body: <PatientsCRMView /> },
    'Staff / Providers': { title: 'Staff / Providers', subtitle: `Productivity & utilization · ${sub}`, body: <StaffProvidersView /> },
    'Inventory': { title: 'Inventory', subtitle: `Stock, consumption & retail · ${sub}`, body: <InventoryView /> },
    'Memberships': { title: 'Memberships', subtitle: `Membership adoption & mix · ${sub}`, body: <MembershipsView /> },
    'Overview': { title: 'Business Overview', subtitle: `Performance across all locations · ${sub}`, body: <OverviewView /> },
  };
  const current = views[activeView] || views['Overview'];

  return (
    <FilterContext.Provider value={filters}>
      <div className="min-h-screen bg-[#f4f7f6]" onClick={() => locOpen && setLocOpen(false)}>
        <Sidebar />
        <main className="ml-72 min-h-screen">
          <Header title={current.title} subtitle={current.subtitle} />
          {current.body}
        </main>
      </div>
    </FilterContext.Provider>
  );
};

/* =================================================================
   OVERVIEW VIEW
   Endpoints: mtd-kpi-header + mtd-summary + category-breakdown
   ================================================================= */

const OverviewView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    summary: { path: '/api/mtd-summary', params },
    categories: { path: '/api/category-breakdown', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <OverviewBody header={data.header} summary={data.summary || []} categories={data.categories || []} />
    </DataState>
  );
};

const OverviewBody = ({ header, summary, categories }) => {
  const h = header || {};

  // Two headline KPIs derived from the header banner.
  const kpis = [
    {
      label: 'CASH SALES (MTD)',
      mtd: money(h.mtd_revenue, { compact: true }),
      variance: deltaNote(h.same_store_yoy),
      projLabel: 'Avg Daily Revenue',
      projected: money(h.avg_daily_revenue, { compact: true }),
    },
    {
      label: 'CUSTOMER VISITS (MTD)',
      mtd: num(h.total_customer_visits),
      variance: { text: `${num(h.new_client_count)} new · ${num(h.existing_client_count)} existing`, positive: true },
      projLabel: 'Members',
      projected: num(h.member_count),
    },
  ];

  const financialMetrics = [
    { label: 'GROSS MARGIN %', value: pct(h.gross_margin_pct), note: 'recognized', positive: true },
    { label: 'BLENDED ASP', value: money(h.blended_asp), note: 'all clients', positive: true },
    { label: 'ASP · NEW', value: money(h.asp_new_clients), note: 'new clients', positive: true },
    { label: 'ASP · EXISTING', value: money(h.asp_existing_clients), note: 'existing clients', positive: true },
    { label: 'YESTERDAY REVENUE', value: money(h.yesterday_revenue, { compact: true }), note: `${num(h.yesterday_clients)} clients`, positive: true },
    { label: 'MONTHLY BUDGET', value: money(h.monthly_budget, { compact: true }), note: 'target', positive: true },
    { label: 'SAME-STORE YOY', value: pct(h.same_store_yoy), note: 'vs prior year', positive: n(h.same_store_yoy) >= 0 },
  ];

  const operationalMetrics = [
    { label: 'PROVIDER UTILIZATION', value: pct(h.provider_utilization), note: 'booked / scheduled', positive: true },
    { label: 'ESTHETICIAN UTILIZATION', value: pct(h.esthetician_utilization), note: 'booked / scheduled', positive: true },
    { label: 'REBOOKING RATE', value: pct(h.rebooking_rate), note: 'completed appts', positive: true },
    { label: 'MEMBERSHIP ADOPTION', value: pct(h.membership_adoption_rate), note: 'of active clients', positive: true },
    { label: 'REV / PROVIDER', value: money(h.rev_per_provider, { compact: true }), note: 'per provider', positive: true },
    { label: 'REV / ESTHETICIAN', value: money(h.rev_per_esthetician, { compact: true }), note: 'per esthetician', positive: true },
    { label: 'NEW MEMBERS', value: num(h.new_members), note: 'this period', positive: true },
    { label: 'PY REVENUE', value: money(h.py_revenue, { compact: true }), note: 'prior year', positive: true },
  ];

  // Service mix from category breakdown (top categories + Other).
  const totalCat = categories.reduce((a, c) => a + (n(c.revenue) || 0), 0) || 1;
  const sortedCat = [...categories].sort((a, b) => (n(b.revenue) || 0) - (n(a.revenue) || 0));
  const topCats = sortedCat.slice(0, 5);
  const otherSum = sortedCat.slice(5).reduce((a, c) => a + (n(c.revenue) || 0), 0);
  const serviceMix = [
    ...topCats.map((c) => ({ name: c.item_category, percentage: Math.round(((n(c.revenue) || 0) / totalCat) * 100) })),
    ...(otherSum > 0 ? [{ name: 'Other', percentage: Math.round((otherSum / totalCat) * 100) }] : []),
  ];
  const swatch = ['#14b8a6', '#0d9488', '#17a697', '#7fd3c3', '#f59e0b', '#d1d5db'];

  // Product mix = category counts (volume) as a proxy for units.
  const byCount = [...categories].sort((a, b) => (n(b.count) || 0) - (n(a.count) || 0)).slice(0, 7);
  const maxCount = Math.max(...byCount.map((c) => n(c.count) || 0), 1);

  // Location table from mtd-summary.
  const totals = summary.reduce((acc, l) => {
    acc.cash += n(l.cash_sales) || 0;
    acc.budget += n(l.monthly_budget) || 0;
    acc.members += n(l.new_members) || 0;
    return acc;
  }, { cash: 0, budget: 0, members: 0 });
  const avgGoal = summary.length
    ? summary.reduce((a, l) => a + (Math.abs(n(l.pct_to_goal_mtd)) <= 1 ? (n(l.pct_to_goal_mtd) || 0) * 100 : (n(l.pct_to_goal_mtd) || 0)), 0) / summary.length
    : 0;

  return (
    <div className="px-9 py-8">
      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            <div className="grid grid-cols-2 gap-6 mt-5">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">MTD</p>
                <p className="text-4xl font-bold mt-3 tabular-nums">{kpi.mtd}</p>
                <p className={`text-xs font-semibold mt-2 ${kpi.variance.positive ? 'text-teal-600' : 'text-orange-600'}`}>{kpi.variance.text}</p>
              </div>
              <div className="border-l border-gray-200 pl-6">
                <p className="text-xs font-bold text-gray-400 uppercase">{kpi.projLabel}</p>
                <p className="text-4xl font-bold mt-3 tabular-nums">{kpi.projected}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionTitle title="Financial" />
      <div className="grid grid-cols-7 gap-4 mb-8">
        {financialMetrics.map((m) => <KpiCard key={m.label} {...m} minH={135} />)}
      </div>

      <SectionTitle title="Operational" />
      <div className="grid grid-cols-8 gap-4 mb-8">
        {operationalMetrics.map((m) => <KpiCard key={m.label} {...m} minH={135} />)}
      </div>

      {/* Service & product mix from category-breakdown */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Service Mix</h3>
          <div className="space-y-4">
            {serviceMix.map((service, idx) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: swatch[idx % swatch.length] }}></div>
                  <span className="text-sm text-gray-700 capitalize">{service.name}</span>
                </div>
                <span className="text-sm font-bold">{service.percentage}%</span>
              </div>
            ))}
            {serviceMix.length === 0 && <p className="text-sm text-gray-400">No category data for this range.</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Top Categories by Volume</h3>
          <div className="space-y-4">
            {byCount.map((product) => (
              <div key={product.item_category} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-20 h-2 bg-teal-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500" style={{ width: `${((n(product.count) || 0) / maxCount) * 100}%` }}></div>
                  </div>
                  <span className="text-sm text-gray-700 capitalize">{product.item_category}</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{num(product.count)}</span>
              </div>
            ))}
            {byCount.length === 0 && <p className="text-sm text-gray-400">No category data for this range.</p>}
          </div>
        </div>
      </div>

      {/* Location performance from mtd-summary */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-bold">Location Performance</h2>
          <p className="text-xs text-gray-500 mt-1">Cash sales, pacing & membership by location</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['LOCATION', 'CASH SALES', 'AVG DAILY', 'TRENDING', 'BUDGET', 'SURPLUS/SHORT', '% GOAL MTD', 'CUR WEEK', 'NEW MBRS', 'ADOPTION'].map((hd) => (
                  <th key={hd} className="px-5 py-3 text-left font-bold text-gray-600 whitespace-nowrap">{hd}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summary.map((loc) => {
                const goal = Math.abs(n(loc.pct_to_goal_mtd)) <= 1 ? (n(loc.pct_to_goal_mtd) || 0) * 100 : (n(loc.pct_to_goal_mtd) || 0);
                const surplus = n(loc.surplus_shortfall) || 0;
                return (
                  <tr key={loc.location} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-bold">{loc.location}</td>
                    <td className="px-5 py-4 tabular-nums">{money(loc.cash_sales, { compact: true })}</td>
                    <td className="px-5 py-4 tabular-nums">{money(loc.avg_daily_sales, { compact: true })}</td>
                    <td className="px-5 py-4 tabular-nums">{money(loc.trending, { compact: true })}</td>
                    <td className="px-5 py-4 tabular-nums">{money(loc.monthly_budget, { compact: true })}</td>
                    <td className={`px-5 py-4 font-bold tabular-nums ${surplus >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>{money(surplus, { compact: true })}</td>
                    <td className={`px-5 py-4 font-bold tabular-nums ${goal >= 100 ? 'text-teal-600' : 'text-orange-600'}`}>{goal.toFixed(0)}%</td>
                    <td className="px-5 py-4 tabular-nums">{money(loc.current_week_revenue, { compact: true })}</td>
                    <td className="px-5 py-4 tabular-nums">{num(loc.new_members)}</td>
                    <td className="px-5 py-4 tabular-nums">{pct(loc.membership_adoption)}</td>
                  </tr>
                );
              })}
              {summary.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">No location data for this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chain totals */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-5 gap-8">
          {[
            ['Total Locations', num(summary.length)],
            ['Total Cash Sales', money(totals.cash, { compact: true })],
            ['Total Budget', money(totals.budget, { compact: true })],
            ['Avg Budget Attainment', `${avgGoal.toFixed(0)}%`],
            ['New Members', num(totals.members)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
              <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   FINANCE VIEW
   Endpoints: mtd-kpi-header + monthly-trend + mtd-daily-trend + category-breakdown
   ================================================================= */

const FinanceView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    monthly: { path: '/api/monthly-trend', params },
    daily: { path: '/api/mtd-daily-trend', params },
    categories: { path: '/api/category-breakdown', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <FinanceBody
        header={data.header}
        monthly={data.monthly || []}
        daily={data.daily}
        categories={data.categories || []}
        monthName={f.monthLabel}
      />
    </DataState>
  );
};

const FinanceBody = ({ header, monthly, daily, categories, monthName }) => {
  const h = header || {};

  // Aggregate the per-location monthly-trend rows to chain-level P&L.
  const agg = monthly.reduce((a, r) => {
    a.revenue += n(r.recognized_revenue) || 0;
    a.cogs += n(r.cogs_est) || 0;
    a.payroll += n(r.payroll_costs_est) || 0;
    a.gross += n(r.gross_margin) || 0;
    return a;
  }, { revenue: 0, cogs: 0, payroll: 0, gross: 0 });

  const grossProfit = agg.gross || (agg.revenue - agg.cogs);
  const ebitda = grossProfit - agg.payroll;
  const rev = agg.revenue || 1;

  const financeKpis = [
    { label: 'RECOGNIZED REVENUE', value: money(agg.revenue, { compact: true }), note: pct(h.same_store_yoy), positive: n(h.same_store_yoy) >= 0 },
    { label: 'GROSS PROFIT', value: money(grossProfit, { compact: true }), note: pct((grossProfit / rev) * 100, 1) + ' margin', positive: true },
    { label: 'GROSS MARGIN', value: pct(h.gross_margin_pct), note: 'recognized', positive: true },
    { label: 'COGS', value: money(agg.cogs, { compact: true }), note: pct((agg.cogs / rev) * 100) + ' of rev', positive: false },
    { label: 'PAYROLL', value: money(agg.payroll, { compact: true }), note: pct((agg.payroll / rev) * 100) + ' of rev', positive: false },
  ];

  // P&L waterfall bars (share of revenue).
  const plRows = [
    { label: 'Recognized Revenue', amount: money(agg.revenue, { compact: true }), width: 100, color: '#0f766e', muted: false },
    { label: 'COGS', amount: `(${money(agg.cogs, { compact: true })})`, width: (agg.cogs / rev) * 100, color: '#f3b58a', muted: true },
    { label: 'Gross Profit', amount: money(grossProfit, { compact: true }), width: (grossProfit / rev) * 100, color: '#0f766e', muted: false },
    { label: 'Payroll', amount: `(${money(agg.payroll, { compact: true })})`, width: (agg.payroll / rev) * 100, color: '#c4b5fd', muted: true },
    { label: 'EBITDA (est.)', amount: money(ebitda, { compact: true }), width: Math.max((ebitda / rev) * 100, 0), color: '#14b8a6', muted: false },
  ];

  // monthly-trend returns per-location metrics for the window, so we show
  // a per-location gross-margin comparison rather than a time series.
  const marginByLoc = [...monthly]
    .map((r) => ({ m: r.location, Gross: n(r.gross_margin_pct) ? (Math.abs(n(r.gross_margin_pct)) <= 1 ? n(r.gross_margin_pct) * 100 : n(r.gross_margin_pct)) : null }))
    .filter((r) => r.Gross != null)
    .sort((a, b) => b.Gross - a.Gross)
    .slice(0, 10);

  // Revenue by service line from category-breakdown.
  const totalCat = categories.reduce((a, c) => a + (n(c.revenue) || 0), 0) || 1;
  const serviceLine = [...categories]
    .sort((a, b) => (n(b.revenue) || 0) - (n(a.revenue) || 0))
    .map((c) => ({ name: c.item_category, amount: money(c.revenue, { compact: true }), pct: ((n(c.revenue) || 0) / totalCat) * 100 }));
  const maxPct = Math.max(...serviceLine.map((s) => s.pct), 1);

  // Daily pacing from mtd-daily-trend.
  const dailyArr = (daily && Array.isArray(daily.daily)) ? daily.daily : [];
  const budget = n(daily?.monthly_budget) || n(h.monthly_budget) || 0;
  const trending = n(daily?.trending) || 0;
  const daysInMonth = n(daily?.days_in_month) || dailyArr.length || 30;
  const reqPerDay = budget && daysInMonth ? budget / daysInMonth : 0;
  const maxDaily = Math.max(...dailyArr.map((d) => n(d.daily_sales) || 0), reqPerDay, 1);
  const mtdActual = dailyArr.reduce((a, d) => a + (n(d.daily_sales) || 0), 0);
  const daysElapsed = dailyArr.filter((d) => (n(d.daily_sales) || 0) > 0).length || dailyArr.length;
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);
  const goalPct = budget ? (mtdActual / budget) * 100 : 0;
  const projShort = (trending || mtdActual) - budget;

  return (
    <div className="px-9 py-8 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        {financeKpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* P&L + per-location margin */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">P&amp;L Summary</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">{monthName} · selected locations · COGS & payroll estimated by API</p>
          <div className="space-y-5">
            {plRows.map((r) => (
              <div key={r.label} className="flex items-center gap-4">
                <span className={`w-40 text-sm font-semibold ${r.muted ? 'text-orange-600' : 'text-gray-900'}`}>{r.label}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md" style={{ width: `${Math.min(Math.max(r.width, 0), 100)}%`, backgroundColor: r.color }}></div>
                </div>
                <span className={`w-24 text-right text-sm font-bold ${r.muted ? 'text-orange-600' : 'text-gray-900'}`}>{r.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Gross Margin by Location</h3>
            <span className="text-xs text-gray-500">top 10 · %</span>
          </div>
          <div className="h-64">
            {marginByLoc.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marginByLoc} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
                  <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                  <Line type="monotone" dataKey="Gross" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">No margin data.</div>}
          </div>
        </div>
      </div>

      {/* Revenue by Service Line */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Revenue by Service Line</h3>
          <span className="text-xs text-gray-500">{monthName} · % of total</span>
        </div>
        <div className="space-y-4">
          {serviceLine.map((s) => (
            <div key={s.name} className="flex items-center gap-4">
              <span className="w-40 text-sm text-gray-700 capitalize">{s.name}</span>
              <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${(s.pct / maxPct) * 100}%` }}></div>
              </div>
              <span className="w-20 text-right text-sm font-bold tabular-nums">{s.amount}</span>
              <span className="w-10 text-right text-xs text-gray-400 tabular-nums">{s.pct.toFixed(0)}%</span>
            </div>
          ))}
          {serviceLine.length === 0 && <p className="text-sm text-gray-400">No category data for this range.</p>}
        </div>
      </div>

      {/* Month-in-View Revenue Pacing from mtd-daily-trend */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold">Month-in-View Revenue Pacing</h3>
        <p className="text-xs text-gray-500 mt-1 mb-6">Daily net sales vs required pace · {monthName}</p>

        <div className="flex gap-8 items-start mb-8 flex-wrap">
          <div className="flex gap-8 flex-wrap">
            <PacingStat label="FULL-MONTH BUDGET" value={money(budget, { compact: true })} note={monthName} />
            <PacingStat label="MTD ACTUAL" value={money(mtdActual, { compact: true })} note={`through day ${daysElapsed}`} />
            <PacingStat label="% TO GOAL" value={`${goalPct.toFixed(0)}%`} note="of full-month budget" />
            <PacingStat label="DAYS REMAINING" value={num(daysRemaining)} note={`of ${daysInMonth}`} />
          </div>
          <div className="flex-1 min-w-[260px] rounded-xl p-5" style={{ backgroundColor: projShort >= 0 ? '#ecfdf5' : '#fff7ed' }}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">MOMENTUM · TRENDING FINISH</p>
            <p className={`text-2xl font-bold mt-1 ${projShort >= 0 ? 'text-teal-700' : 'text-orange-600'}`}>
              {projShort >= 0 ? '+' : '−'}{money(Math.abs(projShort), { compact: true })} {projShort >= 0 ? 'above' : 'below'} budget
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Projecting ≈{money(trending || mtdActual, { compact: true })} finish vs {money(budget, { compact: true })} goal · required {money(reqPerDay, { compact: true })}/day
            </p>
          </div>
        </div>

        {/* daily bar chart */}
        <div className="relative">
          <div className="flex items-end justify-between gap-1 h-56 border-b border-gray-200 relative">
            {reqPerDay > 0 && (
              <>
                <div className="absolute left-0 right-0 border-t border-dashed border-gray-400" style={{ bottom: `${(reqPerDay / maxDaily) * 100}%` }}></div>
                <div className="absolute right-0 -translate-y-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded" style={{ bottom: `${(reqPerDay / maxDaily) * 100}%` }}>
                  Req. {money(reqPerDay, { compact: true })}/day
                </div>
              </>
            )}
            {dailyArr.map((d) => {
              const v = n(d.daily_sales) || 0;
              const beat = v >= reqPerDay;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full rounded-t" style={{ height: `${(v / maxDaily) * 100}%`, backgroundColor: beat ? '#0f766e' : '#e9967a' }}></div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between gap-1 mt-1">
            {dailyArr.map((d) => (
              <span key={d.day} className="flex-1 text-center text-[9px] text-gray-400">{d.day}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6 mt-5 text-xs text-gray-600">
          <Legend color="#0f766e" label="Beat required pace" />
          <Legend color="#e9967a" label="Below pace" />
        </div>
      </div>

      {/* Cumulative trend */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold mb-1">Cumulative Sales vs Budget Pace</h3>
        <p className="text-xs text-gray-500 mb-4">{monthName} · running total</p>
        <div className="h-64">
          {dailyArr.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyArr} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f9b8e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0f9b8e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={4} />
                <YAxis hide />
                <Tooltip formatter={(v) => money(v, { compact: true })} labelFormatter={(l) => `Day ${l}`} />
                <Area type="monotone" dataKey="cumulative_sales" stroke="#0f9b8e" strokeWidth={2.5} fill="url(#cumGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">No daily data.</div>}
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   OPERATIONS VIEW
   Endpoints: appointments/summary + operations-summary + appointments/daily-trend
   ================================================================= */

const OperationsView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    appts: { path: '/api/appointments/summary', params },
    ops: { path: '/api/operations-summary', params },
    daily: { path: '/api/appointments/daily-trend', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <OperationsBody
        header={data.header}
        appts={data.appts || []}
        ops={data.ops || []}
        daily={data.daily || []}
        monthName={f.monthLabel}
      />
    </DataState>
  );
};

const OperationsBody = ({ header, appts, ops, daily, monthName }) => {
  const h = header || {};

  // Chain-level appointment aggregates.
  const ag = appts.reduce((a, r) => {
    a.total += n(r.total_appointments) || 0;
    a.completed += n(r.completed) || 0;
    a.noshow += n(r.no_shows) || 0;
    a.cancel += n(r.cancellations) || 0;
    a.newg += n(r.new_guests) || 0;
    return a;
  }, { total: 0, completed: 0, noshow: 0, cancel: 0, newg: 0 });
  const noShowRate = ag.total ? (ag.noshow / ag.total) * 100 : 0;
  const cancelRate = ag.total ? (ag.cancel / ag.total) * 100 : 0;

  const opsKpis = [
    { label: 'PROVIDER UTILIZATION', value: pct(h.provider_utilization), note: 'booked / scheduled', positive: true },
    { label: 'ESTHETICIAN UTILIZATION', value: pct(h.esthetician_utilization), note: 'booked / scheduled', positive: true },
    { label: 'APPOINTMENTS COMPLETED', value: num(ag.completed), note: `${num(ag.total)} booked`, positive: true },
    { label: 'NO-SHOW RATE', value: `${noShowRate.toFixed(1)}%`, note: `${num(ag.noshow)} no-shows`, positive: noShowRate < 6 },
    { label: 'REBOOKING RATE', value: pct(h.rebooking_rate), note: 'completed appts', positive: true },
  ];

  // Daily booked-vs-completed trend.
  const dailySeries = daily.map((d) => ({
    day: dayLabel(d.appointment_date),
    total: n(d.total) || 0,
    completed: n(d.completed) || 0,
  }));

  // Lost capacity from chain aggregates.
  const lostCapacity = [
    { label: 'No-shows', pct: `${noShowRate.toFixed(1)}%`, width: Math.min(noShowRate * 4, 100) },
    { label: 'Cancellations', pct: `${cancelRate.toFixed(1)}%`, width: Math.min(cancelRate * 4, 100) },
  ];

  // Per-location utilization & throughput from operations-summary.
  const opsRows = [...ops].sort((a, b) => (n(b.provider_utilization) || 0) - (n(a.provider_utilization) || 0));
  const utilVal = (v) => (Math.abs(n(v)) <= 1 ? (n(v) || 0) * 100 : (n(v) || 0));

  // Build appts-by-location lookup for no-show in the table.
  const apptByLoc = {};
  appts.forEach((a) => { apptByLoc[a.location] = a; });

  return (
    <div className="px-9 py-8 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        {opsKpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Daily appointments + lost capacity */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Appointments</h3>
            <span className="text-xs text-gray-500">Booked vs completed · daily</span>
          </div>
          <div className="h-64">
            {dailySeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bookedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5eead4" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#5eead4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={4} />
                  <YAxis hide />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" name="Booked" stroke="#2dd4bf" strokeWidth={2} fill="url(#bookedGrad)" />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#0f766e" strokeWidth={2.5} fill="url(#compGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">No daily appointment data.</div>}
          </div>
          <div className="flex items-center gap-6 mt-5 text-xs text-gray-600">
            <Legend color="#2dd4bf" label="Booked" />
            <Legend color="#0f766e" label="Completed" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Lost Capacity</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">No-shows & cancellations · {monthName}</p>
          <div className="space-y-5">
            {lostCapacity.map((l) => (
              <div key={l.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-800">{l.label}</span>
                  <span className="text-sm font-bold tabular-nums">{l.pct}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${l.width}%`, backgroundColor: '#e6a888' }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase">New guests</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{num(ag.newg)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Completion rate</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-teal-600">{ag.total ? ((ag.completed / ag.total) * 100).toFixed(0) : '—'}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Per-location utilization & throughput */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <h3 className="text-lg font-bold">Utilization &amp; Throughput by Location</h3>
          <span className="text-xs text-gray-500">Sorted by provider utilization</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 text-left font-bold">LOCATION</th>
                <th className="px-6 py-3 text-left font-bold">PROVIDER UTIL</th>
                <th className="px-6 py-3 text-right font-bold">ESTH UTIL</th>
                <th className="px-6 py-3 text-right font-bold">NO-SHOW</th>
                <th className="px-6 py-3 text-right font-bold">APPTS</th>
                <th className="px-6 py-3 text-right font-bold">REV/PROVIDER</th>
                <th className="px-6 py-3 text-right font-bold">REBOOK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {opsRows.map((loc) => {
                const util = utilVal(loc.provider_utilization);
                const a = apptByLoc[loc.location];
                const nsr = a && n(a.no_show_rate) != null ? utilVal(a.no_show_rate) : null;
                const alert = nsr != null && nsr >= 6;
                return (
                  <tr key={loc.location} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 font-bold text-gray-900">{loc.location}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-40 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${Math.min(util, 100)}%` }}></div>
                        </div>
                        <span className="font-semibold tabular-nums">{util.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{pct(loc.esthetician_utilization, 0)}</td>
                    <td className={`px-6 py-3.5 text-right tabular-nums ${alert ? 'text-orange-600 font-semibold' : ''}`}>{nsr != null ? `${nsr.toFixed(1)}%` : '—'}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{num(loc.appointment_count)}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{money(loc.rev_per_provider, { compact: true })}</td>
                    <td className="px-6 py-3.5 text-right tabular-nums">{pct(loc.rebooking_rate, 0)}</td>
                  </tr>
                );
              })}
              {opsRows.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No operations data for this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   LOCATIONS VIEW
   Endpoint: mtd-summary (per-location with YoY/WoW/MoM variances)
   The original "12-month matrix" had no backing endpoint; we render
   the real comparison fields the API provides instead.
   ================================================================= */

const LocationsView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    summary: { path: '/api/mtd-summary', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <LocationsBody summary={data.summary || []} monthName={f.monthLabel} />
    </DataState>
  );
};

const LocationsBody = ({ summary, monthName }) => {
  const metricTabs = [
    { key: 'cash_sales', label: 'Cash Sales', fmt: (v) => money(v, { compact: true }) },
    { key: 'trending', label: 'Trending', fmt: (v) => money(v, { compact: true }) },
    { key: 'pct_to_goal_mtd', label: '% to Goal', fmt: (v) => `${(Math.abs(n(v)) <= 1 ? (n(v) || 0) * 100 : (n(v) || 0)).toFixed(0)}%` },
    { key: 'current_week_revenue', label: 'Current Week', fmt: (v) => money(v, { compact: true }) },
    { key: 'new_members', label: 'New Members', fmt: (v) => num(v) },
    { key: 'membership_adoption', label: 'Adoption', fmt: (v) => pct(v, 0) },
  ];
  const [activeMetric, setActiveMetric] = useState('cash_sales');
  const active = metricTabs.find((m) => m.key === activeMetric) || metricTabs[0];

  // Variance triplet drives a "momentum" classification per location.
  const classify = (loc) => {
    const yoy = n(loc.py_variance_pct);
    const mom = n(loc.pm_variance_pct);
    const wow = n(loc.prior_week_variance_pct);
    const signals = [yoy, mom, wow].filter((x) => x != null);
    if (!signals.length) return 'Stable';
    const score = signals.reduce((a, x) => a + (Math.abs(x) <= 1 ? x * 100 : x), 0) / signals.length;
    if (score >= 3) return 'Accelerating';
    if (score <= -3) return 'Decelerating';
    return 'Stable';
  };

  const momentumStyle = {
    Accelerating: 'bg-teal-50 text-teal-700',
    Stable: 'bg-gray-100 text-gray-500',
    Decelerating: 'bg-orange-50 text-orange-600',
  };

  const rows = [...summary]
    .map((loc) => ({ ...loc, _m: classify(loc) }))
    .sort((a, b) => (n(b[active.key]) || 0) - (n(a[active.key]) || 0));

  const maxVal = Math.max(...rows.map((r) => Math.abs(n(r[active.key])) || 0), 1);

  const varCell = (v) => {
    const x = n(v);
    if (x == null) return <span className="text-gray-300">—</span>;
    const scaled = Math.abs(x) <= 1 ? x * 100 : x;
    const up = scaled >= 0;
    return <span className={up ? 'text-teal-600' : 'text-orange-600'}>{up ? '▲' : '▼'} {Math.abs(scaled).toFixed(1)}%</span>;
  };

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold">Location Comparison · {active.label}</h3>
        <p className="text-xs text-gray-500 mt-1">{monthName} · ranked, with week / month / year variances · momentum from variance trend</p>

        <div className="flex flex-wrap gap-2 mt-5 mb-6">
          {metricTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveMetric(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                activeMetric === tab.key ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-200">
                <th className="text-left font-bold py-3 pr-4">LOCATION</th>
                <th className="text-left font-bold py-3 px-4 min-w-[220px]">{active.label.toUpperCase()}</th>
                <th className="text-right font-bold py-3 px-3">VS PRIOR WK</th>
                <th className="text-right font-bold py-3 px-3">VS PRIOR MO</th>
                <th className="text-right font-bold py-3 px-3">VS PRIOR YR</th>
                <th className="text-center font-bold py-3 pl-3">MOMENTUM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((loc) => (
                <tr key={loc.location} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 font-bold text-gray-900 whitespace-nowrap">{loc.location}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden min-w-[120px]">
                        <div className="h-full rounded-md bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${(Math.abs(n(loc[active.key])) / maxVal) * 100}%` }}></div>
                      </div>
                      <span className="font-bold tabular-nums w-16 text-right">{active.fmt(loc[active.key])}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-xs font-semibold tabular-nums">{varCell(loc.prior_week_variance_pct)}</td>
                  <td className="py-3 px-3 text-right text-xs font-semibold tabular-nums">{varCell(loc.pm_variance_pct)}</td>
                  <td className="py-3 px-3 text-right text-xs font-semibold tabular-nums">{varCell(loc.py_variance_pct)}</td>
                  <td className="py-3 pl-3 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${momentumStyle[loc._m]}`}>{loc._m}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No location data for this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   MARKETING · ACQUISITION VIEW
   Endpoints: appointments/by-booking-source + mtd-kpi-header
   (Marketing ad-spend/CAC have no endpoint, so we focus on the
    booking-source funnel the API actually exposes.)
   ================================================================= */

const AcquisitionView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    sources: { path: '/api/appointments/by-booking-source', params },
    requestType: { path: '/api/appointments/request-type', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <AcquisitionBody
        header={data.header}
        sources={data.sources || []}
        requestType={data.requestType || []}
        monthName={f.monthLabel}
      />
    </DataState>
  );
};

const AcquisitionBody = ({ header, sources, requestType, monthName }) => {
  const h = header || {};

  const kpis = [
    { label: 'NEW CLIENTS', value: num(h.new_client_count), note: 'this period', positive: true },
    { label: 'EXISTING CLIENTS', value: num(h.existing_client_count), note: 'this period', positive: true },
    { label: 'CUSTOMER VISITS', value: num(h.total_customer_visits), note: 'total', positive: true },
    { label: 'NEW MEMBERS', value: num(h.new_members), note: 'this period', positive: true },
    { label: 'MEMBERSHIP ADOPTION', value: pct(h.membership_adoption_rate), note: 'of active clients', positive: true },
  ];

  // Booking source funnel.
  const totalSrc = sources.reduce((a, s) => a + (n(s.total) || 0), 0) || 1;
  const palette = ['#0f766e', '#2dd4bf', '#5eead4', '#99f6e4', '#f0c9a0', '#e6a888', '#cf7a55'];
  const sortedSrc = [...sources].sort((a, b) => (n(b.total) || 0) - (n(a.total) || 0));
  const maxSrc = Math.max(...sortedSrc.map((s) => n(s.total) || 0), 1);

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Booking sources */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Bookings by Source</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">{monthName} · appointments by booking source</p>
          <div className="space-y-5">
            {sortedSrc.map((s, i) => (
              <div key={s.booking_source}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">{s.booking_source || 'Unknown'}</span>
                  <span className="text-sm tabular-nums">
                    <span className="font-bold">{num(s.total)}</span>{' '}
                    <span className="text-gray-400">{(((n(s.total) || 0) / totalSrc) * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md" style={{ width: `${((n(s.total) || 0) / maxSrc) * 100}%`, backgroundColor: palette[i % palette.length] }}></div>
                </div>
              </div>
            ))}
            {sortedSrc.length === 0 && <p className="text-sm text-gray-400">No booking-source data for this range.</p>}
          </div>
        </div>

        {/* Source completion table */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-5">Source Completion Rates</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-bold pb-3">SOURCE</th>
                <th className="text-right font-bold pb-3">TOTAL</th>
                <th className="text-right font-bold pb-3">COMPLETED</th>
                <th className="text-right font-bold pb-3">COMPLETION</th>
              </tr>
            </thead>
            <tbody>
              {sortedSrc.map((s, i) => (
                <tr key={s.booking_source} className="border-b border-gray-50">
                  <td className="py-3.5 font-semibold text-gray-900">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: palette[i % palette.length] }}></span>
                      {s.booking_source || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-3.5 text-right tabular-nums">{num(s.total)}</td>
                  <td className="py-3.5 text-right tabular-nums">{num(s.completed)}</td>
                  <td className="py-3.5 text-right font-bold tabular-nums">{pct(s.completion_rate, 0)}</td>
                </tr>
              ))}
              {sortedSrc.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-gray-400">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request type breakdown */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold mb-5">Appointments by Request Type</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-bold pb-3">REQUEST TYPE</th>
              <th className="text-right font-bold pb-3">TOTAL</th>
              <th className="text-right font-bold pb-3">COMPLETED</th>
              <th className="text-right font-bold pb-3">COMPLETION</th>
            </tr>
          </thead>
          <tbody>
            {[...requestType].sort((a, b) => (n(b.total) || 0) - (n(a.total) || 0)).map((r) => (
              <tr key={r.request_type} className="border-b border-gray-50">
                <td className="py-3.5 font-semibold text-gray-900">{r.request_type || 'Unknown'}</td>
                <td className="py-3.5 text-right tabular-nums">{num(r.total)}</td>
                <td className="py-3.5 text-right tabular-nums">{num(r.completed)}</td>
                <td className="py-3.5 text-right font-bold tabular-nums">{pct(r.completion_rate, 0)}</td>
              </tr>
            ))}
            {requestType.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400">No request-type data for this range.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* =================================================================
   MARKETING · CALL CENTER VIEW
   No endpoint in the API reference (Aesthetix CRM is a separate
   system). Show an explicit "no data source" state rather than
   fabricating numbers.
   ================================================================= */

const CallCenterView = () => (
  <NoEndpoint
    title="Call Center data isn't connected"
    detail="Speed-to-lead, agent scorecards, and paid-media attribution come from the Aesthetix CRM, which isn't exposed by the reporting API. Connect that source to populate this view."
  />
);

/* =================================================================
   CLINICAL VIEW
   Endpoint: appointments/by-category (+ category-breakdown for revenue)
   ================================================================= */

const ClinicalView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    byCategory: { path: '/api/appointments/by-category', params },
    revenue: { path: '/api/category-breakdown', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <ClinicalBody
        header={data.header}
        byCategory={data.byCategory || []}
        revenue={data.revenue || []}
      />
    </DataState>
  );
};

const ClinicalBody = ({ header, byCategory, revenue }) => {
  const h = header || {};
  const totalAppts = byCategory.reduce((a, c) => a + (n(c.total) || 0), 0);
  const totalCompleted = byCategory.reduce((a, c) => a + (n(c.completed) || 0), 0);

  const kpis = [
    { label: 'TOTAL APPOINTMENTS', value: num(totalAppts), note: `${num(byCategory.length)} categories`, positive: true },
    { label: 'COMPLETED', value: num(totalCompleted), note: totalAppts ? `${((totalCompleted / totalAppts) * 100).toFixed(0)}% completion` : '—', positive: true },
    { label: 'BLENDED ASP', value: money(h.blended_asp), note: 'all clients', positive: true },
    { label: 'CUSTOMER VISITS', value: num(h.total_customer_visits), note: 'this period', positive: true },
    { label: 'REBOOKING RATE', value: pct(h.rebooking_rate), note: 'completed appts', positive: true },
  ];

  const volume = [...byCategory].sort((a, b) => (n(b.total) || 0) - (n(a.total) || 0));
  const maxVol = Math.max(...volume.map((v) => n(v.total) || 0), 1);

  // Completion rate per category (proxy for "rebook/outcomes").
  const completion = [...byCategory]
    .map((c) => ({ name: c.category, pct: Math.abs(n(c.completion_rate)) <= 1 ? (n(c.completion_rate) || 0) * 100 : (n(c.completion_rate) || 0) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Appointment Volume by Category</h3>
          <div className="space-y-5">
            {volume.map((v) => (
              <div key={v.category} className="flex items-center gap-4">
                <span className="w-36 text-sm text-gray-700 capitalize">{v.category}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md bg-gradient-to-r from-teal-400 to-teal-600" style={{ width: `${((n(v.total) || 0) / maxVol) * 100}%` }}></div>
                </div>
                <span className="w-20 text-right text-sm tabular-nums leading-tight">
                  <span className="font-bold">{num(v.total)}</span><br /><span className="text-gray-400 text-xs">appts</span>
                </span>
              </div>
            ))}
            {volume.length === 0 && <p className="text-sm text-gray-400">No category data for this range.</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Completion Rate by Category</h3>
          <div className="space-y-4">
            {completion.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800 capitalize">{r.name}</span>
                  <span className="text-sm font-bold tabular-nums">{r.pct.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(r.pct, 100)}%` }}></div>
                </div>
              </div>
            ))}
            {completion.length === 0 && <p className="text-sm text-gray-400">No category data for this range.</p>}
          </div>
        </div>
      </div>

      {/* Revenue contribution by category */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold mb-1">Revenue by Service Category</h3>
        <p className="text-xs text-gray-500 mb-5">Net revenue & treatment count</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left font-bold pb-3">CATEGORY</th>
              <th className="text-right font-bold pb-3">REVENUE</th>
              <th className="text-right font-bold pb-3">COUNT</th>
              <th className="text-right font-bold pb-3">AVG / UNIT</th>
            </tr>
          </thead>
          <tbody>
            {[...revenue].sort((a, b) => (n(b.revenue) || 0) - (n(a.revenue) || 0)).map((c) => {
              const cnt = n(c.count) || 0;
              const rev = n(c.revenue) || 0;
              return (
                <tr key={c.item_category} className="border-b border-gray-50">
                  <td className="py-3.5 text-gray-800 capitalize">{c.item_category}</td>
                  <td className="py-3.5 text-right tabular-nums font-bold">{money(rev, { compact: true })}</td>
                  <td className="py-3.5 text-right tabular-nums">{num(cnt)}</td>
                  <td className="py-3.5 text-right tabular-nums text-gray-500">{cnt ? money(rev / cnt) : '—'}</td>
                </tr>
              );
            })}
            {revenue.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400">No revenue data for this range.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* =================================================================
   PATIENTS / CRM VIEW
   Endpoint: mtd-kpi-header (new / existing / members)
   ================================================================= */

const PatientsCRMView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    summary: { path: '/api/mtd-summary', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <PatientsCRMBody header={data.header} summary={data.summary || []} />
    </DataState>
  );
};

const PatientsCRMBody = ({ header, summary }) => {
  const h = header || {};
  const newC = n(h.new_client_count) || 0;
  const existC = n(h.existing_client_count) || 0;
  const total = newC + existC || 1;
  const aspNew = n(h.asp_new_clients) || 0;
  const aspExist = n(h.asp_existing_clients) || 0;
  const maxAsp = Math.max(aspNew, aspExist, 1);

  // Revenue contribution split (clients × ASP).
  const newRev = newC * aspNew;
  const existRev = existC * aspExist;
  const totRev = newRev + existRev || 1;
  const newRevPct = (newRev / totRev) * 100;

  const kpis = [
    { label: 'TOTAL CLIENTS', value: num(total), note: 'new + existing', positive: true },
    { label: 'NEW CLIENTS', value: num(newC), note: `${((newC / total) * 100).toFixed(0)}% of visits`, positive: true },
    { label: 'EXISTING CLIENTS', value: num(existC), note: `${((existC / total) * 100).toFixed(0)}% of visits`, positive: true },
    { label: 'ACTIVE MEMBERS', value: num(h.member_count), note: `${num(h.new_members)} new`, positive: true },
    { label: 'MEMBERSHIP ADOPTION', value: pct(h.membership_adoption_rate), note: 'of active clients', positive: true },
  ];

  // Per-location new-member contribution.
  const memberRows = [...summary]
    .map((l) => ({ name: l.location, newM: n(l.new_members) || 0, adoption: l.membership_adoption }))
    .sort((a, b) => b.newM - a.newM);
  const maxNewM = Math.max(...memberRows.map((r) => r.newM), 1);

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* New vs Existing mix + ASP */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">New vs Existing · Average Spend</h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">New client ASP</span>
                <span className="text-sm font-bold">{money(aspNew)}</span>
              </div>
              <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-teal-400" style={{ width: `${(aspNew / maxAsp) * 100}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Existing client ASP</span>
                <span className="text-sm font-bold">{money(aspExist)}</span>
              </div>
              <div className="h-5 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-teal-600" style={{ width: `${(aspExist / maxAsp) * 100}%` }}></div>
              </div>
            </div>
          </div>

          <p className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mt-8 mb-3">Revenue Contribution (clients × ASP)</p>
          <div className="flex h-9 rounded-md overflow-hidden text-xs font-bold text-white">
            <div className="bg-teal-400 flex items-center justify-center" style={{ width: `${newRevPct}%` }}>New {newRevPct.toFixed(0)}%</div>
            <div className="bg-teal-700 flex items-center justify-center" style={{ width: `${100 - newRevPct}%` }}>Existing {(100 - newRevPct).toFixed(0)}%</div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            New clients are {((newC / total) * 100).toFixed(0)}% of visits but {newRevPct.toFixed(0)}% of revenue — existing clients spend more per visit ({money(aspExist)} vs {money(aspNew)}).
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Client Mix</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">New</span>
                <span className="text-sm font-bold tabular-nums">{num(newC)} · {((newC / total) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-teal-400" style={{ width: `${(newC / total) * 100}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Existing</span>
                <span className="text-sm font-bold tabular-nums">{num(existC)} · {((existC / total) * 100).toFixed(0)}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-teal-600" style={{ width: `${(existC / total) * 100}%` }}></div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Active members</span>
              <span className="font-bold">{num(h.member_count)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Adoption rate</span>
              <span className="font-bold text-teal-600">{pct(h.membership_adoption_rate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* New members by location */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold mb-1">New Members by Location</h3>
        <p className="text-xs text-gray-500 mb-5">This period · with adoption rate</p>
        <div className="space-y-3">
          {memberRows.map((r) => (
            <div key={r.name} className="flex items-center gap-4">
              <span className="w-28 text-sm text-gray-700">{r.name}</span>
              <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${(r.newM / maxNewM) * 100}%` }}></div>
              </div>
              <span className="w-12 text-right text-sm font-bold tabular-nums">{num(r.newM)}</span>
              <span className="w-16 text-right text-xs text-gray-400 tabular-nums">{pct(r.adoption, 0)}</span>
            </div>
          ))}
          {memberRows.length === 0 && <p className="text-sm text-gray-400">No location data for this range.</p>}
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   STAFF / PROVIDERS VIEW
   Endpoints: employee-scorecard + appointments/by-provider
   ================================================================= */

const StaffProvidersView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    scorecard: { path: '/api/employee-scorecard', params },
    byProvider: { path: '/api/appointments/by-provider', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <StaffBody
        header={data.header}
        scorecard={data.scorecard || []}
        byProvider={data.byProvider || []}
        monthName={f.monthLabel}
      />
    </DataState>
  );
};

const roleColors = {
  default: { bg: '#e6f3f0', fg: '#0f766e' },
  esthetician: { bg: '#fdf0e8', fg: '#c2680f' },
  laser: { bg: '#eaf6f3', fg: '#2a9d8f' },
};
const roleStyle = (role) => {
  const r = (role || '').toLowerCase();
  if (r.includes('esth')) return roleColors.esthetician;
  if (r.includes('laser')) return roleColors.laser;
  return roleColors.default;
};
const initialsOf = (name) => (name || '?')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const StaffBody = ({ header, scorecard, byProvider, monthName }) => {
  const h = header || {};

  const providerCount = scorecard.length;
  const estheticianCount = scorecard.filter((e) => (e.role || '').toLowerCase().includes('esth')).length;

  const kpis = [
    { label: 'TEAM MEMBERS', value: num(providerCount), note: 'on scorecard', positive: true },
    { label: 'ESTHETICIANS', value: num(estheticianCount), note: 'of team', positive: true },
    { label: 'REV / PROVIDER', value: money(h.rev_per_provider, { compact: true }), note: 'per provider', positive: true },
    { label: 'REV / ESTHETICIAN', value: money(h.rev_per_esthetician, { compact: true }), note: 'per esthetician', positive: true },
    { label: 'REBOOKING RATE', value: pct(h.rebooking_rate), note: 'chain', positive: true },
  ];

  // Leaderboard sorted by total revenue.
  const rows = [...scorecard].sort((a, b) => (n(b.total_revenue) || 0) - (n(a.total_revenue) || 0));
  const maxRev = Math.max(...rows.map((r) => n(r.total_revenue) || 0), 1);

  // Rebooking by provider lookup.
  const rebookByName = {};
  byProvider.forEach((p) => { rebookByName[p.provider] = p; });

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-lg font-bold">Employee Leaderboard</h3>
          <span className="text-xs text-gray-400">By revenue · {monthName}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-bold">#</th>
                <th className="px-2 py-3 text-left font-bold">EMPLOYEE</th>
                <th className="px-4 py-3 text-left font-bold">ROLE</th>
                <th className="px-4 py-3 text-left font-bold">CENTER</th>
                <th className="px-4 py-3 text-left font-bold">REVENUE</th>
                <th className="px-4 py-3 text-right font-bold">REV/HR</th>
                <th className="px-4 py-3 text-right font-bold">UTIL</th>
                <th className="px-4 py-3 text-right font-bold">BOOKED HRS</th>
                <th className="px-6 py-3 text-right font-bold">REBOOK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((p, i) => {
                const rc = roleStyle(p.role);
                const rebook = rebookByName[p.name];
                return (
                  <tr key={`${p.name}-${i}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-4">
                      <span className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold flex items-center justify-center">{initialsOf(p.name)}</span>
                        <span className="font-bold text-gray-900">{p.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: rc.bg, color: rc.fg }}>{p.role || '—'}</span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{p.center || '—'}</td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-3">
                        <span className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <span className="block h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${((n(p.total_revenue) || 0) / maxRev) * 100}%` }}></span>
                        </span>
                        <span className="font-bold tabular-nums">{money(p.total_revenue, { compact: true })}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{money(p.rev_per_hr)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{pct(p.utilization, 0)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{num(p.booked_hours, 1)}</td>
                    <td className="px-6 py-4 text-right tabular-nums">{rebook ? pct(rebook.rebooking_rate, 0) : '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-400">No employee data for this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider appointment outcomes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold">Provider Appointment Outcomes</h3>
          <p className="text-xs text-gray-400 mt-1">Completed, no-shows & rebooking by provider</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-6 py-3 text-left font-bold">PROVIDER</th>
                <th className="px-4 py-3 text-left font-bold">LOCATION</th>
                <th className="px-4 py-3 text-right font-bold">TOTAL</th>
                <th className="px-4 py-3 text-right font-bold">COMPLETED</th>
                <th className="px-4 py-3 text-right font-bold">NO-SHOWS</th>
                <th className="px-4 py-3 text-right font-bold">REBOOK</th>
                <th className="px-6 py-3 text-right font-bold">AVG DURATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...byProvider].sort((a, b) => (n(b.total) || 0) - (n(a.total) || 0)).map((p, i) => (
                <tr key={`${p.provider}-${i}`} className="hover:bg-gray-50">
                  <td className="px-6 py-3.5 font-bold text-gray-900">{p.provider}</td>
                  <td className="px-4 py-3.5 text-gray-600">{p.location}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{num(p.total)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{num(p.completed)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{num(p.no_shows)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{pct(p.rebooking_rate, 0)}</td>
                  <td className="px-6 py-3.5 text-right tabular-nums">{p.avg_actual_duration != null ? `${num(p.avg_actual_duration)} min` : '—'}</td>
                </tr>
              ))}
              {byProvider.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No provider data for this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   MEMBERSHIPS VIEW
   Endpoints: mtd-kpi-header + mtd-summary (member data)
   ================================================================= */

const MembershipsView = () => {
  const f = useFilters();
  const params = { start_date: f.start_date, end_date: f.end_date, locations: f.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    summary: { path: '/api/mtd-summary', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !f.ready} error={error} onRetry={reload}>
      <MembershipsBody header={data.header} summary={data.summary || []} monthName={f.monthLabel} />
    </DataState>
  );
};

const MembershipsBody = ({ header, summary, monthName }) => {
  const h = header || {};

  const kpis = [
    { label: 'ACTIVE MEMBERS', value: num(h.member_count), note: `${num(h.new_members)} new`, positive: true },
    { label: 'ADOPTION RATE', value: pct(h.membership_adoption_rate), note: 'of active clients', positive: true },
    { label: 'NEW MEMBERS', value: num(h.new_members), note: 'this period', positive: true },
    { label: 'EXISTING CLIENTS', value: num(h.existing_client_count), note: 'returning', positive: true },
    { label: 'BLENDED ASP', value: money(h.blended_asp), note: 'all clients', positive: true },
  ];

  // Per-location member rows from mtd-summary.
  const rows = [...summary]
    .map((l) => ({
      name: l.location,
      newM: n(l.new_members) || 0,
      nonM: n(l.non_members) || 0,
      adoption: Math.abs(n(l.membership_adoption)) <= 1 ? (n(l.membership_adoption) || 0) * 100 : (n(l.membership_adoption) || 0),
    }))
    .sort((a, b) => b.adoption - a.adoption);
  const maxNewM = Math.max(...rows.map((r) => r.newM), 1);
  const totalNewM = rows.reduce((a, r) => a + r.newM, 0);

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* New members by location */}
        <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">New Members by Location</h3>
            <span className="text-xs text-gray-400">{monthName} · {num(totalNewM)} total</span>
          </div>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center gap-4">
                <span className="w-28 text-sm text-gray-700">{r.name}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${(r.newM / maxNewM) * 100}%` }}></div>
                </div>
                <span className="w-12 text-right text-sm font-bold tabular-nums">{num(r.newM)}</span>
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-gray-400">No member data for this range.</p>}
          </div>
        </div>

        {/* Adoption by location */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Adoption Rate by Location</h3>
          <div className="space-y-4">
            {rows.slice(0, 8).map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-700">{r.name}</span>
                  <span className="text-sm font-bold tabular-nums">{r.adoption.toFixed(0)}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(r.adoption, 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Chain adoption</span>
              <span className="font-bold text-teal-600">{pct(h.membership_adoption_rate)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Active members</span>
              <span className="font-bold">{num(h.member_count)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   INVENTORY VIEW
   No endpoint in the API reference. Explicit empty state.
   ================================================================= */

const InventoryView = () => (
  <NoEndpoint
    title="Inventory data isn't available"
    detail="Stock levels, consumption, reorder alerts, and retail sell-through aren't exposed by the reporting API. Connect an inventory source to populate this view."
  />
);

export default Dashboard;
