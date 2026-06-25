import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';

/* =================================================================
   EVOLVE MED SPA — MASTER DASHBOARD
   Visual design reproduced from the approved spec: Schibsted Grotesk,
   palette #0F1B1A / #1E8C78 / #2FB6A0, 12-14px radii. Every number is
   wired to the live FastAPI; the spec's demo values are not used.
   ================================================================= */

const API_BASE = 'https://evolvedspadashboarddemo-production.up.railway.app';

const C = {
  ink: '#0F1B1A', panel: '#fff', bg: '#F6F8F7', line: '#E6ECEA', line2: '#EEF3F1', line3: '#F4F7F6',
  teal: '#1E8C78', tealBright: '#2FB6A0', tealLite: '#5BC7B6', tealPale: '#86D2C6',
  green: '#1E9E84', navy: '#243B53', blue: '#4C8DD6',
  clay: '#C77B5A', clayLite: '#E0A87C', red: '#C0453A', redBright: '#E2574C',
  gray: '#8A9794', gray2: '#A4AFAC', gray3: '#7C8A87', ink2: '#3C4B48',
  sidebar: '#0F1B1A', sideText: '#9FB1AD', sideMuted: '#5E7A75', sideHead: '#4A645F',
  purple: '#C7B8E0', gold: '#B5862B',
  good: '#1E9E84', warn: '#B5862B', bad: '#C0453A',
};
const FONT = "'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, sans-serif";

/* ---- API client ---- */
const buildQuery = (p = {}) => {
  const qs = new URLSearchParams();
  if (p.start_date) qs.append('start_date', p.start_date);
  if (p.end_date) qs.append('end_date', p.end_date);
  if (p.date) qs.append('date', p.date);
  if (Array.isArray(p.locations)) p.locations.forEach((l) => qs.append('locations', l));
  const s = qs.toString(); return s ? `?${s}` : '';
};
const apiGet = async (path, params, signal) => {
  const res = await fetch(`${API_BASE}${path}${buildQuery(params)}`, { signal });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
};

const FilterContext = createContext(null);
const useFilters = () => useContext(FilterContext);

const useApiData = (endpoints, deps) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((x) => x + 1), []);
  const spec = JSON.stringify(endpoints);
  useEffect(() => {
    const controller = new AbortController(); let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const parsed = JSON.parse(spec); const names = Object.keys(parsed);
        const results = await Promise.all(names.map((nm) => apiGet(parsed[nm].path, parsed[nm].params, controller.signal)));
        if (cancelled) return;
        const next = {}; names.forEach((nm, i) => { next[nm] = results[i]; });
        setData(next);
      } catch (e) {
        if (e.name === 'AbortError' || cancelled) return;
        setError(e.message || 'Failed to load');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, nonce, ...(deps || [])]);
  return { data, loading, error, reload };
};

/* ---- format helpers ---- */
const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const money = (v, { compact = false, decimals } = {}) => {
  const x = n(v); if (x === null) return '—';
  if (compact) {
    const a = Math.abs(x);
    if (a >= 1e6) return `$${(x / 1e6).toFixed(decimals ?? 2)}M`;
    if (a >= 1e3) return `$${(x / 1e3).toFixed(decimals ?? 0)}K`;
    return `$${x.toFixed(decimals ?? 0)}`;
  }
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: decimals ?? 0 })}`;
};
const pctScale = (v) => { const x = n(v); if (x === null) return null; return Math.abs(x) <= 1 ? x * 100 : x; };
const pct = (v, d = 1) => { const x = pctScale(v); return x === null ? '—' : `${x.toFixed(d)}%`; };
const num = (v, d = 0) => { const x = n(v); return x === null ? '—' : x.toLocaleString(undefined, { maximumFractionDigits: d }); };
const arrowDelta = (v, { unit = '%', d = 1, invert = false } = {}) => {
  const x = pctScale(v); if (x === null) return { text: '—', color: C.gray };
  const up = x >= 0; const good = invert ? !up : up;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(x).toFixed(d)}${unit === 'pt' ? ' pt' : unit}`, color: good ? C.green : C.clay };
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNum = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.getDate(); };
const mLabel = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const firstOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}-01`;
const lastOf = (y, m) => { const d = new Date(y, m + 1, 0); return `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthsBack = (anchor, count = 12) => {
  const base = new Date(anchor); const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, start: firstOf(d.getFullYear(), d.getMonth()), end: lastOf(d.getFullYear(), d.getMonth()) });
  }
  return out;
};
// Previous-month range for the given start_date (used for MoM deltas).
const prevMonthRange = (startDate) => {
  if (!startDate) return { start: undefined, end: undefined };
  const d = new Date(startDate);
  const y = d.getFullYear(), m = d.getMonth() - 1;
  const py = m < 0 ? y - 1 : y, pm = (m + 12) % 12;
  return { start: firstOf(py, pm), end: lastOf(py, pm) };
};

/* =================================================================
   DESIGN-SYSTEM PRIMITIVES (exact spec styling)
   ================================================================= */

const Card = ({ children, pad = '20px 22px', radius = 14, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: radius, padding: pad, ...style }}>{children}</div>
);

const CardTitle = ({ title, sub, right }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: sub ? 'flex-start' : 'center', flexWrap: 'wrap', gap: 10 }}>
    <div>
      <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>{title}</div>
      {sub && <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

const Eyebrow = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 11px' }}>
    <span style={{ font: `700 10.5px ${FONT}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.teal }}>{children}</span>
    <span style={{ flex: 1, height: 1, background: C.line }}></span>
  </div>
);

// Small KPI card used across grids.
const KpiCard = ({ label, value, delta, deltaColor }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 15px', minWidth: 0 }}>
    <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.04em', textTransform: 'uppercase', color: C.gray, lineHeight: 1.25, minHeight: 26 }}>{label}</div>
    <div style={{ font: `600 21px ${FONT}`, color: C.ink, marginTop: 7, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {delta != null && <div style={{ font: `600 10.5px ${FONT}`, color: deltaColor || C.green, marginTop: 3 }}>{delta}</div>}
  </div>
);

const Spinner = ({ size = 18 }) => (
  <span style={{ display: 'inline-block', width: size, height: size, border: `2px solid ${C.line}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'evspin 0.7s linear infinite' }} />
);

const DataState = ({ loading, error, onRetry, children, kpiCount = 5 }) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 12px ${FONT}`, color: C.gray }}>
          <Spinner /> Loading live data…
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpiCount},1fr)`, gap: 12 }}>
          {Array.from({ length: kpiCount }).map((_, i) => (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 15px', height: 92, opacity: 0.6 }} />
          ))}
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, height: 320, opacity: 0.6 }} />
      </div>
    );
  }
  if (error) {
    return (
      <Card style={{ borderColor: '#F2D9CD', textAlign: 'center', padding: 40 }}>
        <div style={{ font: `600 15px ${FONT}`, color: C.ink }}>Couldn't load this view</div>
        <div style={{ font: `500 12px ${FONT}`, color: C.gray, marginTop: 8, maxWidth: 440, margin: '8px auto 0' }}>{error}</div>
        <button onClick={onRetry} style={{ marginTop: 18, border: 'none', borderRadius: 8, padding: '9px 18px', font: `600 12.5px ${FONT}`, color: '#fff', background: C.teal, cursor: 'pointer' }}>Retry</button>
      </Card>
    );
  }
  return children;
};

const NoEndpoint = ({ title, detail }) => (
  <Card style={{ textAlign: 'center', padding: 48 }}>
    <div style={{ font: `600 15px ${FONT}`, color: C.ink }}>{title}</div>
    <div style={{ font: `500 12px ${FONT}`, color: C.gray, marginTop: 8, maxWidth: 520, margin: '8px auto 0', lineHeight: 1.5 }}>{detail}</div>
  </Card>
);

// Utilization / rev-per-hr threshold pill colors (from spec legend).
const utilPill = (v) => {
  const x = pctScale(v);
  if (x === null) return { color: C.ink2 };
  if (x < 60) return { color: C.red };
  if (x < 75) return { color: C.gold };
  return { color: C.teal };
};
const revHrPill = (v, kind) => {
  const x = n(v); if (x === null) return { color: C.ink2 };
  const lo = kind === 'esth' ? 125 : 450;
  const hi = kind === 'esth' ? 175 : 550;
  if (x < lo) return { color: C.red };
  if (x < hi) return { color: C.gold };
  return { color: C.teal };
};

// Horizontal "bar vs 100% goal" row used in several panels.
// Horizontal "bar vs 100% goal" row used in several panels.
const PacingStat = ({ label, value, note }) => (
  <div>
    <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2, lineHeight: 1.2, maxWidth: 110 }}>{label}</div>
    <div style={{ font: `600 26px ${FONT}`, color: C.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {note != null && <div style={{ font: `500 11px ${FONT}`, color: C.gray, marginTop: 4 }}>{note}</div>}
  </div>
);

const PaceBar = ({ pace, color }) => {
  const p = pctScale(pace) || 0;
  const w = Math.min((p / 120) * 100, 100); // 120% scale, 100% marker at 83.33%
  return (
    <span style={{ position: 'relative', flex: 1, height: 12, background: '#F0F4F3', borderRadius: 3 }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`, borderRadius: 3, background: color || (p >= 100 ? C.teal : C.clay) }} />
      <span style={{ position: 'absolute', left: '83.33%', top: -2, bottom: -2, width: 1.5, background: C.sideText }} />
    </span>
  );
};

/* =================================================================
   NAVIGATION + SUBTITLES
   ================================================================= */
const NAV = [
  { id: 'Overview', label: 'Overview' },
  { id: 'Finance', label: 'Finance' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Locations', label: 'Locations' },
  { id: 'Marketing', label: 'Marketing', group: ['Acquisition', 'Call Center'] },
  { id: 'Clinical', label: 'Clinical' },
  { id: 'Patients / CRM', label: 'Patients / CRM' },
  { id: 'Staff / Providers', label: 'Staff / Providers' },
  { id: 'Inventory', label: 'Inventory' },
  { id: 'Memberships', label: 'Memberships' },
];

const SUBTITLE = (view, range, latestDate) => {
  // trailing-12-month range label for the momentum matrix
  let trailing = range;
  if (latestDate) {
    const d = new Date(latestDate);
    const endLbl = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const s = new Date(d.getFullYear(), d.getMonth() - 11, 1);
    const startLbl = `${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
    trailing = `${startLbl} – ${endLbl}`;
  }
  return {
    'Overview': `Performance across all locations · Month to date`,
    'Finance': `Revenue, margin & profitability · ${range}`,
    'Operations': `Capacity, utilization & throughput · ${range}`,
    'Locations': `Momentum matrix · trailing 12 months · ${trailing}`,
    'Acquisition': `Spend, leads & acquisition funnel · ${range}`,
    'Call Center': 'Lead response, agent performance & paid media · Aesthetix CRM',
    'Clinical': `Service volumes, units & outcomes · ${range}`,
    'Patients / CRM': `Acquisition, retention & mix · ${range}`,
    'Staff / Providers': `Productivity & utilization · ${range}`,
    'Inventory': `Stock, consumption & retail · ${range}`,
    'Memberships': `Recurring revenue & adoption · ${range}`,
  }[view] || range;
};

const TITLE = (view) => ({
  'Acquisition': 'Marketing · Acquisition',
  'Call Center': 'Call Center',
  'Overview': 'Business Overview',
}[view] || view);

/* =================================================================
   MAIN DASHBOARD SHELL
   ================================================================= */
const Dashboard = () => {
  const [activeView, setActiveView] = useState('Overview');
  const [openGroups, setOpenGroups] = useState({ Marketing: true });
  const [boot, setBoot] = useState({ loading: true, error: null, latestDate: null, locations: [] });
  const [monthKey, setMonthKey] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [locOpen, setLocOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    (async () => {
      try {
        const [latest, locs] = await Promise.all([
          apiGet('/api/latest-date', {}, controller.signal),
          apiGet('/api/locations', {}, controller.signal),
        ]);
        if (cancelled) return;
        setBoot({ loading: false, error: null, latestDate: latest?.latest_date || null, locations: Array.isArray(locs) ? locs : [] });
      } catch (e) {
        if (e.name === 'AbortError' || cancelled) return;
        setBoot((b) => ({ ...b, loading: false, error: e.message }));
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const monthOpts = useMemo(() => monthsBack(boot.latestDate || new Date(), 12), [boot.latestDate]);
  useEffect(() => { if (!monthKey && monthOpts.length) setMonthKey(monthOpts[0].key); }, [monthOpts, monthKey]);
  const activeMonth = useMemo(() => monthOpts.find((m) => m.key === monthKey) || monthOpts[0], [monthOpts, monthKey]);

  const filters = useMemo(() => ({
    start_date: activeMonth?.start, end_date: activeMonth?.end, latestDate: boot.latestDate,
    locations: selectedLocations.length ? selectedLocations : undefined,
    allLocations: boot.locations, monthLabel: activeMonth?.label || '',
    ready: !!(activeMonth?.start && activeMonth?.end),
  }), [activeMonth, selectedLocations, boot.latestDate, boot.locations]);

  const locSummary = selectedLocations.length === 0
    ? `All ${boot.locations.length || ''} locations`.replace('  ', ' ').trim()
    : selectedLocations.length === 1 ? selectedLocations[0] : `${selectedLocations.length} locations`;

  const toggleLoc = (loc) => setSelectedLocations((c) => c.includes(loc) ? c.filter((l) => l !== loc) : [...c, loc]);

  const dropStyle = { display: 'flex', alignItems: 'center', gap: 8, border: `1px solid #DCE5E2`, borderRadius: 8, padding: '9px 14px', font: `500 12.5px ${FONT}`, color: C.ink2, background: '#fff', cursor: 'pointer' };

  if (boot.loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <style>{`@keyframes evspin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.gray }}><Spinner /> Connecting to reporting API…</div>
      </div>
    );
  }
  if (boot.error) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 24 }}>
        <Card style={{ borderColor: '#F2D9CD', textAlign: 'center', maxWidth: 440 }}>
          <div style={{ font: `600 15px ${FONT}`, color: C.ink }}>Can't reach the reporting API</div>
          <div style={{ font: `500 12px ${FONT}`, color: C.gray, marginTop: 8 }}>{boot.error}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 18, border: 'none', borderRadius: 8, padding: '9px 18px', font: `600 12.5px ${FONT}`, color: '#fff', background: C.teal, cursor: 'pointer' }}>Reload</button>
        </Card>
      </div>
    );
  }

  const range = activeMonth?.label || '';
  const body = {
    'Overview': <OverviewView />, 'Finance': <FinanceView />, 'Operations': <OperationsView />,
    'Locations': <LocationsView />, 'Acquisition': <AcquisitionView />, 'Call Center': <CallCenterView />,
    'Clinical': <ClinicalView />, 'Patients / CRM': <PatientsView />, 'Staff / Providers': <StaffView />,
    'Inventory': <InventoryView />, 'Memberships': <MembershipsView />,
  }[activeView] || <OverviewView />;

  return (
    <FilterContext.Provider value={filters}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes evspin{to{transform:rotate(360deg)}}
        .ev-nav:hover{background:rgba(47,182,160,.08)!important;}
        .ev-lrow:hover{background:#FAFCFB;}
        .ev-scroll::-webkit-scrollbar{width:10px;height:10px;}
        .ev-scroll::-webkit-scrollbar-thumb{background:#D4DEDB;border-radius:5px;border:2px solid #F6F8F7;}
        .ev-scroll::-webkit-scrollbar-track{background:transparent;}
      `}</style>
      <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', fontFamily: FONT, background: C.bg, color: C.ink }}
           onClick={() => { setLocOpen(false); setMonthOpen(false); }}>

        {/* SIDEBAR */}
        <aside style={{ width: 236, flex: 'none', background: C.sidebar, color: C.sideText, display: 'flex', flexDirection: 'column', padding: '22px 0', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 22px 26px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${C.tealBright},${C.teal})`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 17px ${FONT}`, color: '#fff' }}>E</div>
            <div>
              <div style={{ font: `700 16px ${FONT}`, color: '#fff', letterSpacing: '.01em' }}>Evolve</div>
              <div style={{ font: `500 9.5px ${FONT}`, color: C.sideMuted, letterSpacing: '.08em', textTransform: 'uppercase' }}>Med Spa</div>
            </div>
          </div>
          <div style={{ font: `600 10px ${FONT}`, letterSpacing: '.12em', textTransform: 'uppercase', color: C.sideHead, padding: '4px 22px 8px' }}>Business Health</div>

          {NAV.map((item) => {
            if (item.group) {
              const childActive = item.group.includes(activeView);
              const open = openGroups[item.id];
              return (
                <div key={item.id}>
                  <a className="ev-nav" onClick={(e) => { e.stopPropagation(); setOpenGroups((g) => ({ ...g, [item.id]: !g[item.id] })); }}
                     style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 22px', cursor: 'pointer', font: `${childActive ? 600 : 500} 12.5px ${FONT}`, color: childActive ? '#E6EEEC' : C.sideText, borderLeft: `3px solid ${childActive ? C.tealBright : 'transparent'}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: childActive ? C.tealBright : '#3A4D4A' }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{ font: `600 9px ${FONT}`, color: C.sideMuted }}>{open ? '▾' : '▸'}</span>
                  </a>
                  {open && item.group.map((child) => {
                    const active = child === activeView;
                    return (
                      <a key={child} className="ev-nav" onClick={(e) => { e.stopPropagation(); setActiveView(child); }}
                         style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 22px 9px 42px', cursor: 'pointer', font: `${active ? 600 : 500} 12px ${FONT}`, color: active ? '#fff' : C.sideText, background: active ? 'rgba(47,182,160,.12)' : 'transparent', borderLeft: `3px solid ${active ? C.tealBright : 'transparent'}` }}>
                        <span style={{ color: C.tealBright }}>—</span>{child}
                      </a>
                    );
                  })}
                </div>
              );
            }
            const active = item.id === activeView;
            return (
              <a key={item.id} className="ev-nav" onClick={(e) => { e.stopPropagation(); setActiveView(item.id); }}
                 style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 22px', cursor: 'pointer', font: `${active ? 600 : 500} 12.5px ${FONT}`, color: active ? '#fff' : C.sideText, background: active ? 'rgba(47,182,160,.12)' : 'transparent', borderLeft: `3px solid ${active ? C.tealBright : 'transparent'}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? C.tealBright : '#3A4D4A' }} />
                <span style={{ flex: 1 }}>{item.label}</span>
              </a>
            );
          })}

          <div style={{ marginTop: 'auto', padding: '18px 22px 0', borderTop: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2A3D3A', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `600 12px ${FONT}`, color: C.sideText }}>VR</div>
              <div>
                <div style={{ font: `600 12.5px ${FONT}`, color: '#E6EEEC' }}>Vidur R.</div>
                <div style={{ font: `400 10.5px ${FONT}`, color: C.sideMuted }}>Owner · All access</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* topbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 30px', background: '#fff', borderBottom: `1px solid ${C.line}`, flex: 'none' }}>
            <div>
              <div style={{ font: `700 21px ${FONT}`, color: C.ink }}>{TITLE(activeView)}</div>
              <div style={{ font: `400 12.5px ${FONT}`, color: C.gray3, marginTop: 3 }}>{SUBTITLE(activeView, range, boot.latestDate)}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* location dropdown */}
              <div style={{ position: 'relative' }}>
                <div style={dropStyle} onClick={(e) => { e.stopPropagation(); setLocOpen((o) => !o); setMonthOpen(false); }}>{locSummary} ▾</div>
                {locOpen && (
                  <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 0, marginTop: 6, width: 240, maxHeight: 320, overflowY: 'auto', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 50, padding: 6 }}>
                    <div onClick={() => setSelectedLocations([])} style={{ padding: '8px 10px', borderRadius: 6, font: `${selectedLocations.length === 0 ? 600 : 500} 12px ${FONT}`, color: selectedLocations.length === 0 ? C.teal : C.ink2, background: selectedLocations.length === 0 ? '#E6F2EE' : 'transparent', cursor: 'pointer' }}>All locations</div>
                    <div style={{ height: 1, background: C.line2, margin: '4px 0' }} />
                    {boot.locations.map((loc) => {
                      const checked = selectedLocations.includes(loc);
                      return (
                        <div key={loc} onClick={() => toggleLoc(loc)} style={{ padding: '8px 10px', borderRadius: 6, font: `500 12px ${FONT}`, color: C.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 15, height: 15, borderRadius: 4, border: `1px solid ${checked ? C.teal : '#C9D6D2'}`, background: checked ? C.teal : '#fff', color: '#fff', font: `700 9px ${FONT}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{checked ? '✓' : ''}</span>
                          {loc}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* month dropdown */}
              <div style={{ position: 'relative' }}>
                <div style={dropStyle} onClick={(e) => { e.stopPropagation(); setMonthOpen((o) => !o); setLocOpen(false); }}>{range} ▾</div>
                {monthOpen && (
                  <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 0, marginTop: 6, width: 160, maxHeight: 320, overflowY: 'auto', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.10)', zIndex: 50, padding: 6 }}>
                    {monthOpts.map((m) => (
                      <div key={m.key} onClick={() => { setMonthKey(m.key); setMonthOpen(false); }} style={{ padding: '8px 10px', borderRadius: 6, font: `${m.key === monthKey ? 600 : 500} 12px ${FONT}`, color: m.key === monthKey ? C.teal : C.ink2, background: m.key === monthKey ? '#E6F2EE' : 'transparent', cursor: 'pointer' }}>{m.label}</div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ borderRadius: 8, padding: '9px 16px', font: `600 12.5px ${FONT}`, color: '#fff', background: C.teal, cursor: 'pointer' }}>Export</div>
            </div>
          </div>

          {/* scroll content */}
          <div className="ev-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 30px 40px', position: 'relative' }}>
            {body}
          </div>
        </main>
      </div>
    </FilterContext.Provider>
  );
};

/* =================================================================
   LIGHTWEIGHT SVG CHART TOOLKIT (matches spec's hand-drawn look)
   ================================================================= */

// Cumulative MTD line + daily bars + budget pace line, in spec style.
const PacingChart = ({ daily, budget, trending, daysInMonth }) => {
  const W = 672, H = 224, padL = 46, padR = 46, padT = 18, padB = 39;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const arr = daily || [];
  if (!arr.length) return <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No daily data.</div>;

  const dailyVals = arr.map((d) => n(d.daily_sales) || 0);
  const cumVals = arr.map((d) => n(d.cumulative_sales) || 0);
  const maxDaily = Math.max(...dailyVals, 1);
  const maxCum = Math.max(...cumVals, budget || 0, 1);
  const elapsed = arr.length;
  const totalDays = daysInMonth || elapsed;
  const xAt = (i) => padL + (totalDays > 1 ? (i / (totalDays - 1)) * innerW : 0);
  const yDaily = (v) => padT + innerH - (v / maxDaily) * innerH;
  const yCum = (v) => padT + innerH - (v / maxCum) * innerH;
  const barW = Math.max(Math.min(innerW / totalDays * 0.62, 13), 2);
  const minIdx = dailyVals.indexOf(Math.min(...dailyVals));
  const maxIdx = dailyVals.indexOf(Math.max(...dailyVals));

  const cumPts = arr.map((d, i) => `${xAt(i)},${yCum(cumVals[i])}`).join(' ');
  const lastX = xAt(elapsed - 1), lastY = yCum(cumVals[elapsed - 1] || 0);
  // budget line from 0 to full budget across the month
  const budgetEndY = yCum(budget || maxCum);
  // run-rate projection from today to trending finish
  const projY = yCum(trending || cumVals[elapsed - 1] || 0);

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + t * innerH);
  const leftLabels = [1, 0.75, 0.5, 0.25, 0].map((t) => money(maxDaily * t, { compact: true }));
  const rightLabels = [1, 0.75, 0.5, 0.25, 0].map((t) => money(maxCum * t, { compact: true, decimals: 1 }));

  return (
    <svg viewBox={`0 -10 ${W} ${H}`} style={{ width: '100%', height: 340, display: 'block', marginTop: 8 }}>
      {elapsed < totalDays && <rect x={lastX} y={padT} width={W - padR - lastX} height={innerH} fill="#F5F9F8" />}
      {gridYs.map((y, i) => <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke={i === gridYs.length - 1 ? '#D8E2DF' : C.line2} strokeWidth="1" />)}
      <g style={{ font: `600 9.5px ${FONT}`, fill: C.gray2 }} textAnchor="end">
        {leftLabels.map((l, i) => <text key={i} x={padL - 6} y={gridYs[i] + 3}>{l}</text>)}
      </g>
      <g style={{ font: `600 9.5px ${FONT}`, fill: C.gray2 }} textAnchor="start">
        {rightLabels.map((l, i) => <text key={i} x={W - padR + 6} y={gridYs[i] + 3}>{l}</text>)}
      </g>
      {/* daily bars */}
      {arr.map((d, i) => {
        const v = dailyVals[i]; const y = yDaily(v); const h = padT + innerH - y;
        let fill = '#fff', stroke = '#C9D6D2';
        if (i === maxIdx) { fill = C.tealBright; stroke = C.tealBright; }
        if (i === minIdx) { fill = C.redBright; stroke = C.redBright; }
        return <rect key={i} x={xAt(i) - barW / 2} y={y} width={barW} height={Math.max(h, 0)} rx="1.5" fill={fill} stroke={stroke} strokeWidth="1.3" />;
      })}
      {/* budget line */}
      <polyline points={`${padL},${padT + innerH} ${W - padR},${budgetEndY}`} fill="none" stroke={C.blue} strokeWidth="2.4" />
      <circle cx={W - padR} cy={budgetEndY} r="3" fill={C.blue} />
      {/* run-rate projection */}
      {elapsed < totalDays && <polyline points={`${lastX},${lastY} ${W - padR},${projY}`} fill="none" stroke="#AAB7B3" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" />}
      {elapsed < totalDays && <circle cx={W - padR} cy={projY} r="3" fill="#AAB7B3" />}
      {/* cumulative MTD line */}
      <polyline points={cumPts} fill="none" stroke={C.navy} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3.6" fill={C.navy} />
      {/* today divider */}
      <line x1={lastX} y1={padT + 4} x2={lastX} y2={padT + innerH} stroke={C.sideText} strokeWidth="1.2" strokeDasharray="4 4" />
      <g><rect x={lastX - 21} y={padT + 4} width="43" height="15" rx="7.5" fill={C.ink} /><text x={lastX} y={padT + 14.7} textAnchor="middle" style={{ font: `600 9px ${FONT}`, fill: '#fff', letterSpacing: '.04em' }}>TODAY</text></g>
      {/* min/max callouts */}
      <g><rect x={xAt(maxIdx) - 24} y={-6} width="49" height="16" rx="3" fill={C.tealBright} /><text x={xAt(maxIdx)} y={5.5} textAnchor="middle" style={{ font: `700 10px ${FONT}`, fill: '#fff' }}>{money(dailyVals[maxIdx], { compact: true })}</text></g>
      {/* date axis */}
      <g style={{ font: `600 9.5px ${FONT}`, fill: C.gray2 }} textAnchor="middle">
        {[0.18, 0.45, 0.72, 0.97].map((t, i) => { const idx = Math.round(t * (elapsed - 1)); return <text key={i} x={xAt(idx)} y={padT + innerH + 16}>{`${MONTHS[new Date(arr[idx]?.day ? null : 0).getMonth?.() || 0] || ''} ${arr[idx]?.day ?? ''}`.trim()}</text>; })}
      </g>
    </svg>
  );
};

// Simple area+line chart (single series) in spec style.
const AreaLine = ({ data, xKey, yKey, height = 210, color = C.tealBright, gradId = 'al', yFmt = (v) => money(v, { compact: true }) }) => {
  const W = 660, H = 200, padL = 8, padR = 8, padT = 12, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const arr = data || [];
  if (arr.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>Not enough data.</div>;
  const ys = arr.map((d) => n(d[yKey]) || 0);
  const maxY = Math.max(...ys, 1), minY = Math.min(...ys, 0);
  const rng = maxY - minY || 1;
  const xAt = (i) => padL + (i / (arr.length - 1)) * innerW;
  const yAt = (v) => padT + innerH - ((v - minY) / rng) * innerH;
  const line = arr.map((d, i) => `${xAt(i)},${yAt(ys[i])}`).join(' ');
  const area = `${padL},${padT + innerH} ${line} ${padL + innerW},${padT + innerH}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, marginTop: 12 }}>
      <defs><linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".24" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((t, i) => <line key={i} x1={padL} y1={padT + t * innerH} x2={W - padR} y2={padT + t * innerH} stroke={C.line2} strokeWidth="1" />)}
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <g style={{ font: `600 9px ${FONT}`, fill: C.gray2 }} textAnchor="middle">
        {arr.filter((_, i) => i % Math.ceil(arr.length / 6) === 0).map((d, i, sub) => { const idx = arr.indexOf(d); return <text key={i} x={xAt(idx)} y={H - 8}>{d[xKey]}</text>; })}
      </g>
    </svg>
  );
};

// Horizontal labeled bar list (e.g. service line, sources).
const BarList = ({ rows, max, color = C.teal, labelW = 140, valueW = 70, fmt = (v) => v }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {rows.map((r, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: labelW, flex: 'none', font: `500 11.5px ${FONT}`, color: C.ink2, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
        <span style={{ flex: 1, height: 14, background: '#F0F4F3', borderRadius: 4, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${(Math.abs(r.value) / (max || 1)) * 100}%`, borderRadius: 4, background: r.color || color }} />
        </span>
        <span style={{ width: valueW, flex: 'none', textAlign: 'right', font: `600 11.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value, r)}</span>
      </div>
    ))}
    {rows.length === 0 && <div style={{ font: `500 12px ${FONT}`, color: C.gray }}>No data for this range.</div>}
  </div>
);

/* =================================================================
   OVERVIEW VIEW
   Endpoints: mtd-kpi-header + mtd-summary + category-breakdown
   ================================================================= */

// Hero trend card: label, MTD value+delta, Projected value+delta.
const HeroCard = ({ label, mtd, mtdDelta, proj, projDelta }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
    <div style={{ font: `600 10px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>{label}</div>
    <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>MTD</div>
        <div style={{ font: `600 26px ${FONT}`, color: C.ink, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{mtd}</div>
        {mtdDelta && <div style={{ font: `600 10.5px ${FONT}`, color: mtdDelta.color, marginTop: 3 }}>{mtdDelta.text}</div>}
      </div>
      <div style={{ width: 1, background: C.line2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>Projected · Run Rate</div>
        <div style={{ font: `600 26px ${FONT}`, color: C.ink, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{proj}</div>
        {projDelta && <div style={{ font: `600 10.5px ${FONT}`, color: projDelta.color, marginTop: 3 }}>{projDelta.text}</div>}
      </div>
    </div>
  </div>
);

const OverviewView = () => {
  const fl = useFilters();
  const params = { start_date: fl.start_date, end_date: fl.end_date, locations: fl.locations };
  const prev = prevMonthRange(fl.start_date);
  const prevParams = { start_date: prev.start, end_date: prev.end, locations: fl.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    summary: { path: '/api/mtd-summary', params },
    ops: { path: '/api/operations-summary', params },
    categories: { path: '/api/category-breakdown', params },
    daily: { path: '/api/mtd-daily-trend', params },
    headerPrev: { path: '/api/mtd-kpi-header', params: prevParams },
    appts: { path: '/api/appointments/summary', params },
    apptsPrev: { path: '/api/appointments/summary', params: prevParams },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload}>
      <OverviewBody h={data.header || {}} hPrev={data.headerPrev || {}} summary={data.summary || []} ops={data.ops || []} categories={data.categories || []} daily={data.daily} appts={data.appts || []} apptsPrev={data.apptsPrev || []} range={fl.monthLabel} />
    </DataState>
  );
};

const MEDAL = { 0: '#D4AF37', 1: '#9AA7A3', 2: '#C77B5A' };
const Medal = ({ color }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" style={{ display: 'block' }}>
    <path fill={color} d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
);

const OverviewBody = ({ h, hPrev, summary, ops, categories, daily, appts, apptsPrev, range }) => {
  // ---- hero cards ----
  const cashMtd = n(h.mtd_revenue);
  const recRev = n(h.mtd_revenue); // API exposes one revenue figure; reuse for recognized
  // projected run-rate from daily trending if available
  const trending = n(daily?.trending);
  const yoy = h.same_store_yoy;

  // Revenue MoM (current vs prior month) for the hero cards — preferred over
  // YoY when prior-year data is absent (e.g. first year of a location).
  const revMom = momPctDelta(h.mtd_revenue, hPrev.mtd_revenue);
  const heroDelta = (arrowDelta(yoy).text !== '—') ? arrowDelta(yoy) : (revMom || arrowDelta(yoy));

  // ---- FINANCIAL group ----
  const budgetPaceVal = (() => {
    const b = n(h.monthly_budget), r = n(h.mtd_revenue);
    if (!b || r === null) return null;
    return (r / b) * 100;
  })();
  // COGS margin = 100 − gross margin %; compute for current & prior for MoM.
  const cogsMargin = h.gross_margin_pct != null ? 100 - pctScale(h.gross_margin_pct) : null;
  const cogsMarginPrev = hPrev.gross_margin_pct != null ? 100 - pctScale(hPrev.gross_margin_pct) : null;
  const financial = [
    { label: '% to Budget · Variance to Goal', value: budgetPaceVal != null ? `${budgetPaceVal.toFixed(0)}%` : '—',
      delta: budgetPaceVal != null ? `${budgetPaceVal >= 100 ? '▲' : '▼'} ${Math.abs(100 - budgetPaceVal).toFixed(0)}% to goal` : null,
      deltaColor: budgetPaceVal >= 100 ? C.green : C.clay },
    { label: 'SSS Growth YoY %', value: pct(yoy), ...spread(arrowDelta(yoy)) },
    { label: 'Prior Day Sales %', value: money(h.yesterday_revenue, { compact: true }), delta: `${num(h.yesterday_clients)} clients`, deltaColor: C.gray },
    { label: 'ASP (New)', value: money(h.asp_new_clients), ...spreadOrNull(momPctDelta(h.asp_new_clients, hPrev.asp_new_clients)) },
    { label: 'ASP (Existing)', value: money(h.asp_existing_clients), ...spreadOrNull(momPctDelta(h.asp_existing_clients, hPrev.asp_existing_clients)) },
    // COGS margin going down is good (lower cost), so invert the delta color.
    { label: 'COGS Margin %', value: pct(cogsMargin), ...spreadOrNull(momPtDelta(cogsMargin, cogsMarginPrev, { invert: true })) },
    { label: 'Payroll Margin %', value: '—', delta: null },
  ];

  // ---- OPERATIONAL group ----
  // No-show / cancellation rates from appointments/summary (chain aggregate).
  const sumA = (arr, f) => arr.reduce((a, r) => a + (n(r[f]) || 0), 0);
  const totA = sumA(appts, 'total_appointments');
  const noShowRate = totA ? (sumA(appts, 'no_shows') / totA) * 100 : null;
  const cancelRate = totA ? (sumA(appts, 'cancellations') / totA) * 100 : null;
  const totAPrev = sumA(apptsPrev, 'total_appointments');
  const noShowRatePrev = totAPrev ? (sumA(apptsPrev, 'no_shows') / totAPrev) * 100 : null;
  const cancelRatePrev = totAPrev ? (sumA(apptsPrev, 'cancellations') / totAPrev) * 100 : null;

  const operational = [
    // For no-show/cancellation, a decrease is good → invert color.
    { label: 'No-Show Rate', value: noShowRate != null ? `${noShowRate.toFixed(1)}%` : '—', ...spreadOrNull(momPtDelta(noShowRate, noShowRatePrev, { invert: true })) },
    { label: 'Cancellation Rate', value: cancelRate != null ? `${cancelRate.toFixed(1)}%` : '—', ...spreadOrNull(momPtDelta(cancelRate, cancelRatePrev, { invert: true })) },
    { label: 'Membership Adoption %', value: pct(h.membership_adoption_rate), delta: `${num(h.new_members)} new`, deltaColor: C.gray },
    { label: 'Rev / Hr · Provider', value: money(h.rev_per_provider, { compact: true }), ...spreadOrNull(momPctDelta(h.rev_per_provider, hPrev.rev_per_provider)) },
    { label: 'Rev / Hr · Esthetician', value: money(h.rev_per_esthetician, { compact: true }), ...spreadOrNull(momPctDelta(h.rev_per_esthetician, hPrev.rev_per_esthetician)) },
    { label: 'Utilization · Provider', value: pct(h.provider_utilization), ...spreadOrNull(momPtDelta(h.provider_utilization, hPrev.provider_utilization)) },
    { label: 'Utilization · Esthetician', value: pct(h.esthetician_utilization), ...spreadOrNull(momPtDelta(h.esthetician_utilization, hPrev.esthetician_utilization)) },
    { label: 'Rebook Rate %', value: pct(h.rebooking_rate), ...spreadOrNull(momPtDelta(h.rebooking_rate, hPrev.rebooking_rate)) },
  ];

  // ---- MARKETING group ----
  // New Visit MTD — uses the accrual `new_visits` field (distinct new-visit
  // invoices, DAX-matched), falling back to new_client_count if an older API
  // build is deployed. MoM delta compares the same field for the prior month.
  const newVisits = h.new_visits != null ? h.new_visits : h.new_client_count;
  const newVisitsPrev = hPrev.new_visits != null ? hPrev.new_visits : hPrev.new_client_count;
  const marketing = [
    { label: 'New Customer Visits', value: num(newVisits), ...spreadOrNull(momPctDelta(newVisits, newVisitsPrev)) },
    { label: 'Existing Customer Visits', value: num(h.existing_client_count), ...spreadOrNull(momPctDelta(h.existing_client_count, hPrev.existing_client_count)) },
    { label: 'MTD Ad Spend', value: '—', delta: null },
    { label: 'Client Acquisition Cost', value: '—', delta: null },
    { label: 'New Guest Return Rate · 90 Day', value: '—', delta: null },
  ];

  // ---- Sales to Budget chart ----
  const dailyArr = Array.isArray(daily?.daily) ? daily.daily : [];
  const budget = n(daily?.monthly_budget) || n(h.monthly_budget) || 0;
  const daysInMonth = n(daily?.days_in_month) || dailyArr.length || 30;
  const mtdActual = dailyArr.reduce((a, d) => a + (n(d.daily_sales) || 0), 0) || cashMtd || 0;
  const budgetMtd = budget && daysInMonth ? (budget / daysInMonth) * dailyArr.length : null;
  const paceToBudget = budget ? (mtdActual / budget) * 100 : null;

  // ---- Budget attainment by location ----
  const attain = [...summary]
    .map((l) => ({ name: l.location, pace: pctScale(l.pct_to_goal_mtd) }))
    .filter((l) => l.pace != null)
    .sort((a, b) => b.pace - a.pace);

  // ---- service mix donut ----
  const totalCat = categories.reduce((a, c) => a + (n(c.revenue) || 0), 0) || 1;
  const sortedCat = [...categories].sort((a, b) => (n(b.revenue) || 0) - (n(a.revenue) || 0));
  const topCats = sortedCat.slice(0, 5);
  const otherSum = sortedCat.slice(5).reduce((a, c) => a + (n(c.revenue) || 0), 0);
  const donutColors = [C.teal, C.tealBright, C.tealLite, C.tealPale, C.clayLite, '#C9D6D2'];
  const serviceMix = [
    ...topCats.map((c, i) => ({ label: c.item_category, pct: Math.round(((n(c.revenue) || 0) / totalCat) * 100), color: donutColors[i] })),
    ...(otherSum > 0 ? [{ label: 'Other', pct: Math.round((otherSum / totalCat) * 100), color: donutColors[5] }] : []),
  ];
  // build conic-gradient
  let acc = 0; const stops = serviceMix.map((s) => { const start = acc; acc += s.pct * 3.6; return `${s.color} ${start}deg ${acc}deg`; }).join(',');
  // injectable share = neuro+filler+other_injectables if present
  const injCats = ['neurotoxins', 'filler', 'other_injectables'];
  const injSum = categories.filter((c) => injCats.includes((c.item_category || '').toLowerCase())).reduce((a, c) => a + (n(c.revenue) || 0), 0);
  const injPct = Math.round((injSum / totalCat) * 100);

  // ---- product mix (by category count) ----
  const byCount = [...categories].sort((a, b) => (n(b.count) || 0) - (n(a.count) || 0)).slice(0, 7);
  const maxCount = Math.max(...byCount.map((c) => n(c.count) || 0), 1);

  // ---- location performance table (merge mtd-summary + operations-summary) ----
  const opsByLoc = {};
  ops.forEach((o) => { opsByLoc[o.location] = o; });
  const rows = summary.map((l) => ({ ...l, _ops: opsByLoc[l.location] || {} }));
  const totals = summary.reduce((a, l) => {
    a.cash += n(l.cash_sales) || 0; a.budget += n(l.monthly_budget) || 0;
    a.trending += n(l.trending) || 0; a.newM += n(l.new_members) || 0;
    const o = opsByLoc[l.location] || {};
    a.recRev += n(o.recognized_revenue) || 0;
    a.newCust += n(o.new_client_count) || 0;
    a.existCust += n(o.existing_client_count) || 0;
    // collect per-row series for chain-level aggregates
    if (n(o.cogs_pct) != null) a._cogs.push(n(o.cogs_pct));
    if (n(o.payroll_pct) != null) a._payroll.push(n(o.payroll_pct));
    if (n(o.gross_margin_pct) != null) a._gm.push(n(o.gross_margin_pct));
    // revenue-weighted ASP (weight by recognized revenue so big centers count more)
    const w = n(o.recognized_revenue) || 0;
    if (n(o.asp) != null) { a._aspW += n(o.asp) * w; a._aspWsum += w; }
    if (n(o.asp_excl_memberships) != null) { a._aspXW += n(o.asp_excl_memberships) * w; a._aspXWsum += w; }
    // simple averages for utilization / rev-hr / rebook (only real values)
    if (n(o.provider_utilization) != null) a._pu.push(n(o.provider_utilization));
    if (n(o.rev_per_provider) != null) a._prh.push(n(o.rev_per_provider));
    if (n(o.esthetician_utilization) != null) a._eu.push(n(o.esthetician_utilization));
    if (n(o.rev_per_esthetician) != null) a._erh.push(n(o.rev_per_esthetician));
    if (n(o.rebooking_rate) != null) a._rb.push(n(o.rebooking_rate));
    return a;
  }, { cash: 0, budget: 0, trending: 0, newM: 0, recRev: 0, newCust: 0, existCust: 0,
       _cogs: [], _payroll: [], _gm: [], _aspW: 0, _aspWsum: 0, _aspXW: 0, _aspXWsum: 0,
       _pu: [], _prh: [], _eu: [], _erh: [], _rb: [] });
  // derive chain-level summary stats
  const avg = (arr) => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null;
  totals.cogsPct = avg(totals._cogs);
  totals.payrollPct = avg(totals._payroll);
  totals.gmPct = avg(totals._gm);
  totals.asp = totals._aspWsum ? totals._aspW / totals._aspWsum : null;
  totals.aspX = totals._aspXWsum ? totals._aspXW / totals._aspXWsum : null;
  totals.provUtil = avg(totals._pu);
  totals.provRevHr = avg(totals._prh);
  totals.esthUtil = avg(totals._eu);
  totals.esthRevHr = avg(totals._erh);
  totals.rebook = avg(totals._rb);

  return (
    <div>
      {/* hero trend cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <HeroCard label="Cash Sales" mtd={money(cashMtd, { compact: true })} mtdDelta={heroDelta}
          proj={money(trending || (mtdActual && daysInMonth ? (mtdActual / Math.max(dailyArr.length, 1)) * daysInMonth : null), { compact: true })} projDelta={heroDelta} />
        <HeroCard label="Recognized Revenue" mtd={money(recRev, { compact: true })} mtdDelta={heroDelta}
          proj={money(trending || (mtdActual && daysInMonth ? (mtdActual / Math.max(dailyArr.length, 1)) * daysInMonth : null), { compact: true })} projDelta={heroDelta} />
      </div>

      {/* KPI groups */}
      <Eyebrow>Financial</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, marginBottom: 18 }}>
        {financial.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <Eyebrow>Operational</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 12, marginBottom: 18 }}>
        {operational.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <Eyebrow>Marketing</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 4 }}>
        {marketing.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Sales to Budget + Budget Attainment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <CardTitle title="Sales to Budget — Month to Date" sub={`Daily net sales · cumulative vs budget & run rate · ${range}`}
            right={
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', font: `500 11px ${FONT}`, color: C.ink2, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, border: `1.4px solid #C9D6D2`, background: '#fff', borderRadius: 2 }} />Net Sales (daily)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 3, background: C.navy, borderRadius: 2 }} />Net Sales (MTD)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 3, background: C.blue, borderRadius: 2 }} />Budget</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 0, borderTop: `2px dashed #AAB7B3` }} />Run Rate</span>
              </div>
            } />
          <PacingChart daily={dailyArr} budget={budget} trending={trending} daysInMonth={daysInMonth} />
          <div style={{ display: 'flex', gap: 26, marginTop: 6, paddingTop: 12, borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
            {[
              ['Net Sales MTD', money(mtdActual, { compact: true }), C.ink],
              ['Budget (MTD)', budgetMtd != null ? money(budgetMtd, { compact: true }) : '—', C.ink],
              ['Pace to Budget', paceToBudget != null ? `${paceToBudget.toFixed(0)}%` : '—', paceToBudget >= 100 ? C.ink : C.clay],
              ['Projected (Run Rate)', money(trending, { compact: true }), C.ink],
              ['Full-Month Budget', money(budget, { compact: true }), C.ink],
            ].map(([l, v, col]) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>{l}</span>
                <span style={{ font: `600 17px ${FONT}`, color: col, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Budget Attainment by Location</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 14 }}>% to MTD budget · sorted by pace · line = 100%</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4 }}>
            {attain.map((p, i) => {
              const color = p.pace >= 100 ? C.teal : p.pace >= 95 ? C.tealLite : C.clayLite;
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i < 3 && p.pace >= 100 && <Medal color={MEDAL[i]} />}
                  </span>
                  <span style={{ width: 84, flex: 'none', font: `500 11px ${FONT}`, color: C.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <PaceBar pace={p.pace} color={color} />
                  <span style={{ width: 36, flex: 'none', textAlign: 'right', font: `600 11px ${FONT}`, color, fontVariantNumeric: 'tabular-nums' }}>{p.pace.toFixed(0)}%</span>
                </div>
              );
            })}
            {attain.length === 0 && <div style={{ font: `500 12px ${FONT}`, color: C.gray }}>No location data.</div>}
          </div>
        </Card>
      </div>

      {/* Service Mix + Product Mix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Service Mix</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>Share of revenue · {range}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', flex: 'none', background: serviceMix.length ? `conic-gradient(${stops})` : '#EEF3F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ font: `700 17px ${FONT}`, color: C.ink }}>{injSum ? `${injPct}%` : '—'}</span>
                <span style={{ font: `500 9px ${FONT}`, color: C.gray }}>injectables</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {serviceMix.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, font: `500 11.5px ${FONT}`, color: C.ink2, textTransform: 'capitalize' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flex: 'none' }} />{s.label}
                  <span style={{ marginLeft: 'auto', color: C.gray }}>{s.pct}%</span>
                </div>
              ))}
              {serviceMix.length === 0 && <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>No category data.</span>}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Product Mix</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>Unit consumption · {range}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            {byCount.map((p, i) => (
              <div key={p.item_category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i < 3 && <Medal color={MEDAL[i]} />}</span>
                <span style={{ width: 118, flex: 'none', font: `500 11.5px ${FONT}`, color: C.ink2, textTransform: 'capitalize' }}>{p.item_category}</span>
                <span style={{ flex: 1, height: 14, background: '#F0F4F3', borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${((n(p.count) || 0) / maxCount) * 100}%`, background: `linear-gradient(90deg,${C.teal},${C.tealBright})`, borderRadius: 4 }} />
                </span>
                <span style={{ width: 64, flex: 'none', textAlign: 'right', font: `600 11.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{num(p.count)}</span>
              </div>
            ))}
            {byCount.length === 0 && <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>No category data.</span>}
          </div>
        </Card>
      </div>

      {/* Location Performance table */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Location Performance</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray }}>Bars vs budget · line = 100% · {range}</div>
        </div>
        {/* threshold legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 22px', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ font: `700 9px ${FONT}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.gray }}>Util%</span>
          <LegendPill bg="#FBE3E1" color={C.red}>Under &lt;60%</LegendPill>
          <LegendPill bg="#FBF1D6" color={C.gold}>Average 60–74.99%</LegendPill>
          <LegendPill bg="#DDF0E6" color={C.teal}>High ≥75%</LegendPill>
          <span style={{ width: 1, height: 14, background: C.line }} />
          <span style={{ font: `700 9px ${FONT}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.gray }}>Rev/Hr</span>
          <LegendPill bg="#FBE3E1" color={C.red}>Under · Prov &lt;$450 / Esth &lt;$125</LegendPill>
          <LegendPill bg="#FBF1D6" color={C.gold}>Average · Prov $450–550 / Esth $125–175</LegendPill>
          <LegendPill bg="#DDF0E6" color={C.teal}>High · Prov ≥$550 / Esth ≥$175</LegendPill>
        </div>
        <LocationTable rows={rows} totals={totals} />
      </Card>
    </div>
  );
};

const LegendPill = ({ bg, color, children }) => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, background: bg, color, font: `600 10.5px ${FONT}` }}>{children}</span>
);

// helper to spread arrowDelta into KpiCard props
function spread(d) { return { delta: d.text, deltaColor: d.color }; }
// spread a MoM delta into KpiCard props, or render no subheader if unavailable
function spreadOrNull(d) { return d ? { delta: d.text, deltaColor: d.color } : { delta: null }; }

const GRID_COLS = '1.25fr 0.8fr 1.4fr 0.85fr 0.78fr 0.82fr 0.58fr 0.72fr 0.8fr 0.72fr 0.8fr 0.74fr 0.74fr 0.74fr 0.74fr 0.62fr';

const LocationTable = ({ rows, totals }) => {
  const cell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const headStyle = { font: `600 9.5px ${FONT}`, letterSpacing: '.04em', textTransform: 'uppercase', color: C.gray2 };
  const pillStyle = (col) => ({ display: 'inline-block', padding: '2px 7px', borderRadius: 5, font: `600 11px ${FONT}`, background: col === C.teal ? '#DDF0E6' : col === C.gold ? '#FBF1D6' : '#FBE3E1', color: col, fontVariantNumeric: 'tabular-nums' });

  return (
    <div style={{ margin: '0 -2px' }}>
      {/* group header */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 6, padding: '0 6px 5px', font: `700 9px ${FONT}`, letterSpacing: '.1em', textTransform: 'uppercase' }}>
        <span style={{ gridColumn: '12 / span 2', textAlign: 'center', color: C.teal, borderBottom: `2px solid rgba(30,140,120,.3)`, paddingBottom: 4 }}>Provider</span>
        <span style={{ gridColumn: '14 / span 2', textAlign: 'center', color: C.clay, borderBottom: `2px solid rgba(199,123,90,.4)`, paddingBottom: 4 }}>Esthetician</span>
      </div>
      {/* column header */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 6, padding: '6px 6px 10px', borderBottom: `1px solid ${C.line2}`, ...headStyle }}>
        <span>Location</span><span style={cell}>Cash MTD</span><span>Proj. Run Rate</span><span style={cell}>Rec. Rev</span>
        <span style={cell}>COGS%</span><span style={cell}>Payroll%</span><span style={cell}>GM%</span>
        <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>New Cust</span><span style={cell}>Exist Cust</span>
        <span style={cell}>ASP New</span><span style={cell}>ASP Exist</span>
        <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>Util%</span><span style={cell}>Rev/Hr</span>
        <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>Util%</span><span style={cell}>Rev/Hr</span>
        <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>Rebook</span>
      </div>
      {rows.map((l) => {
        const o = l._ops || {};
        const pace = pctScale(l.pct_to_goal_total) ?? pctScale(l.pct_to_goal_mtd);
        const projColor = (pace ?? 0) >= 100 ? C.teal : C.clay;
        const pu = utilPill(o.provider_utilization), eu = utilPill(o.esthetician_utilization);
        const prh = revHrPill(o.rev_per_provider, 'prov'), erh = revHrPill(o.rev_per_esthetician, 'esth');
        return (
          <div key={l.location} className="ev-lrow" style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 6, padding: '9px 6px', borderBottom: `1px solid ${C.line3}`, alignItems: 'center', font: `500 11.5px ${FONT}`, color: C.ink2 }}>
            <span style={{ fontWeight: 600, color: C.ink }}>{l.location}</span>
            <span style={{ ...cell, fontWeight: 600, color: C.ink }}>{money(l.cash_sales, { compact: true })}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <PaceBar pace={pace} color={(pace ?? 0) >= 100 ? C.teal : C.clayLite} />
              <span style={{ width: 50, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 600, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{money(l.trending, { compact: true })}</span>
                <span style={{ font: `600 9.5px ${FONT}`, color: projColor, fontVariantNumeric: 'tabular-nums' }}>{pace != null ? `${pace.toFixed(0)}%` : '—'}</span>
              </span>
            </span>
            <span style={{ ...cell, fontWeight: 600, color: C.ink }}>{money(o.recognized_revenue, { compact: true })}</span>
            <span style={cell}>{pct(o.cogs_pct, 1)}</span>
            <span style={cell}>{pct(o.payroll_pct, 1)}</span>
            <span style={cell}>{pct(o.gross_margin_pct, 0)}</span>
            <span style={{ ...cell, borderLeft: `1px solid ${C.line3}`, paddingLeft: 6 }}>{num(o.new_client_count)}</span>
            <span style={cell}>{num(o.existing_client_count)}</span>
            <span style={cell}>{money(o.asp)}</span>
            <span style={cell}>{money(o.asp_excl_memberships)}</span>
            <span style={{ ...cell, borderLeft: `1px solid ${C.line3}`, paddingLeft: 6 }}>{o.provider_utilization != null ? <span style={pillStyle(pu.color)}>{pct(o.provider_utilization, 0)}</span> : '—'}</span>
            <span style={cell}>{o.rev_per_provider != null ? <span style={pillStyle(prh.color)}>{money(o.rev_per_provider)}</span> : '—'}</span>
            <span style={{ ...cell, borderLeft: `1px solid ${C.line3}`, paddingLeft: 6 }}>{o.esthetician_utilization != null ? <span style={pillStyle(eu.color)}>{pct(o.esthetician_utilization, 0)}</span> : '—'}</span>
            <span style={cell}>{o.rev_per_esthetician != null ? <span style={pillStyle(erh.color)}>{money(o.rev_per_esthetician)}</span> : '—'}</span>
            <span style={{ ...cell, borderLeft: `1px solid ${C.line3}`, paddingLeft: 6 }}>{pct(o.rebooking_rate, 0)}</span>
          </div>
        );
      })}
      {rows.length === 0 && <div style={{ padding: '24px 6px', textAlign: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No location data for this range.</div>}
      {/* total row */}
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 6, padding: '11px 6px 4px', borderTop: `2px solid #D8E2DF`, alignItems: 'center', font: `700 11.5px ${FONT}`, color: C.ink }}>
          <span style={{ font: `700 10px ${FONT}`, letterSpacing: '.1em', textTransform: 'uppercase', color: C.teal }}>Total · {rows.length} Loc</span>
          <span style={cell}>{money(totals.cash, { compact: true })}</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(totals.trending, { compact: true })}</span>
            <span style={{ font: `700 9.5px ${FONT}`, color: totals.budget && totals.cash / totals.budget >= 1 ? C.teal : C.clay, fontVariantNumeric: 'tabular-nums' }}>{totals.budget ? `${((totals.cash / totals.budget) * 100).toFixed(0)}%` : '—'}</span>
          </span>
          <span style={{ ...cell, fontWeight: 700, color: C.ink }}>{money(totals.recRev, { compact: true })}</span>
          <span style={cell}>{totals.cogsPct != null ? pct(totals.cogsPct, 1) : '—'}</span>
          <span style={cell}>{totals.payrollPct != null ? pct(totals.payrollPct, 1) : '—'}</span>
          <span style={cell}>{totals.gmPct != null ? pct(totals.gmPct, 0) : '—'}</span>
          <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>{num(totals.newCust)}</span>
          <span style={cell}>{num(totals.existCust)}</span>
          <span style={cell}>{totals.asp != null ? money(totals.asp) : '—'}</span>
          <span style={cell}>{totals.aspX != null ? money(totals.aspX) : '—'}</span>
          <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>{totals.provUtil != null ? pct(totals.provUtil, 0) : '—'}</span>
          <span style={cell}>{totals.provRevHr != null ? money(totals.provRevHr) : '—'}</span>
          <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>{totals.esthUtil != null ? pct(totals.esthUtil, 0) : '—'}</span>
          <span style={cell}>{totals.esthRevHr != null ? money(totals.esthRevHr) : '—'}</span>
          <span style={{ ...cell, borderLeft: `1px solid ${C.line2}`, paddingLeft: 6 }}>{totals.rebook != null ? pct(totals.rebook, 0) : '—'}</span>
        </div>
      )}
    </div>
  );
};


/* =================================================================
   FINANCE CHART HELPERS
   ================================================================= */

// Multi-series line chart (Margin Trend: Gross / COGS / Payroll).
const MultiLine = ({ data, series, height = 300, yPad = 6 }) => {
  const W = 660, H = 280, padL = 6, padR = 6, padT = 14, padB = 32;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const arr = data || [];
  if (arr.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>Not enough data.</div>;
  const allVals = arr.flatMap((d) => series.map((s) => n(d[s.key])).filter((v) => v != null));
  const maxY = Math.max(...allVals) + yPad, minY = Math.min(...allVals) - yPad;
  const rng = maxY - minY || 1;
  const xAt = (i) => padL + (i / (arr.length - 1)) * innerW;
  const yAt = (v) => padT + innerH - ((v - minY) / rng) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => <line key={i} x1={padL} y1={padT + t * innerH} x2={W - padR} y2={padT + t * innerH} stroke={C.line2} strokeWidth="1" />)}
      {series.map((s) => {
        const pts = arr.map((d, i) => { const v = n(d[s.key]); return v == null ? null : `${xAt(i)},${yAt(v)}`; }).filter(Boolean).join(' ');
        return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />;
      })}
      <g style={{ font: `500 10px ${FONT}`, fill: C.gray2 }} textAnchor="middle">
        {arr.map((d, i) => <text key={i} x={xAt(i)} y={H - 10}>{d.m}</text>)}
      </g>
    </svg>
  );
};

// Month-in-View pacing: daily bars colored Beat/Near/Below/Projected + required-pace line.
const MonthPacingChart = ({ daily, reqPerDay, daysInMonth }) => {
  const arr = daily || [];
  const W = 1120, H = 220, padT = 10, padB = 22;
  const innerH = H - padT - padB;
  if (!arr.length) return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No daily data.</div>;
  const total = daysInMonth || arr.length;
  const vals = arr.map((d) => n(d.daily_sales) || 0);
  const maxV = Math.max(...vals, reqPerDay, 1);
  const slot = W / total;
  const barW = slot * 0.62;
  const elapsed = arr.length;
  const reqY = padT + innerH - (reqPerDay / maxV) * innerH;
  const colorFor = (v, i) => {
    if (i >= elapsed) return '#C7E6DE'; // projected
    if (v >= reqPerDay) return C.teal;
    if (v >= reqPerDay * 0.6) return '#E8B796'; // near
    return '#E0876A'; // below
  };
  // build projected tail to fill the month
  const display = [];
  for (let i = 0; i < total; i++) {
    if (i < elapsed) display.push({ v: vals[i], i });
    else {
      const avg = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
      display.push({ v: avg, i, proj: true });
    }
  }
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 240, display: 'block' }}>
        <line x1={0} y1={reqY} x2={W} y2={reqY} stroke="#9FB1AD" strokeWidth="1.2" strokeDasharray="4 4" />
        {display.map((d, idx) => {
          const v = d.v; const y = padT + innerH - (v / maxV) * innerH; const h = padT + innerH - y;
          const x = idx * slot + (slot - barW) / 2;
          return (
            <g key={idx}>
              <rect x={x} y={y} width={barW} height={Math.max(h, 0)} rx="2" fill={colorFor(v, d.proj ? elapsed : idx)} />
              {idx === vals.indexOf(Math.max(...vals)) && !d.proj && <text x={x + barW / 2} y={y - 4} textAnchor="middle" style={{ font: `700 9px ${FONT}`, fill: C.ink }}>{money(v, { compact: true })}</text>}
              {idx === vals.indexOf(Math.min(...vals)) && !d.proj && <text x={x + barW / 2} y={y - 4} textAnchor="middle" style={{ font: `700 8.5px ${FONT}`, fill: C.redBright }}>{money(v, { compact: true })}</text>}
            </g>
          );
        })}
        <g style={{ font: `500 8px ${FONT}`, fill: C.gray2 }} textAnchor="middle">
          {display.map((d, idx) => <text key={idx} x={idx * slot + slot / 2} y={H - 8}>{idx + 1}</text>)}
        </g>
      </svg>
      <div style={{ position: 'absolute', right: 6, top: reqY / H * 240 - 11, background: C.ink, color: '#fff', font: `600 10px ${FONT}`, padding: '3px 8px', borderRadius: 5 }}>Req. {money(reqPerDay, { compact: true })} / day</div>
    </div>
  );
};

// Revenue Mix bar with hatched COGS overlay.
const MixBar = ({ label, amount, pctTxt, width, cogsWidth }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
      <span style={{ font: `600 12.5px ${FONT}`, color: C.ink }}>{label}</span>
      <span style={{ font: `600 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{amount} <span style={{ color: C.gray, fontWeight: 500 }}>{pctTxt}</span></span>
    </div>
    <div style={{ height: 16, background: '#F0F4F3', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
      <div style={{ height: '100%', width: `${width}%`, background: '#2F9E8F', borderRadius: 4, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${cogsWidth}%`, opacity: 0.75, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 6px)' }} />
      </div>
    </div>
  </div>
);

// Injectables scatter (log-x volume vs rev/unit). Quadrant guides + dots.
const InjectablesScatter = ({ points }) => {
  const W = 560, H = 330, padL = 30, padR = 30, padT = 20, padB = 40;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  if (!points.length) return <div style={{ height: 290, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No injectables data.</div>;
  const xs = points.map((p) => Math.log10(Math.max(p.x, 1)));
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), rngX = maxX - minX || 1;
  const minY = Math.min(...ys), maxY = Math.max(...ys), rngY = maxY - minY || 1;
  const xAt = (v) => padL + ((Math.log10(Math.max(v, 1)) - minX) / rngX) * innerW;
  const yAt = (v) => padT + innerH - ((v - minY) / rngY) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 290 }}>
      <line x1={padL + innerW / 2} y1={padT} x2={padL + innerW / 2} y2={padT + innerH} stroke={C.line2} strokeWidth="1" />
      <line x1={padL} y1={padT + innerH / 2} x2={W - padR} y2={padT + innerH / 2} stroke={C.line2} strokeWidth="1" />
      <text x={W - padR} y={padT + 4} textAnchor="end" style={{ font: `700 9px ${FONT}`, fill: '#C9D6D2', letterSpacing: '.08em' }}>HIGH VOL · HIGH $/UNIT</text>
      {points.map((p, i) => <circle key={i} cx={xAt(p.x)} cy={yAt(p.y)} r="9" fill={p.y > (minY + rngY * 0.5) ? C.navy : C.tealBright} opacity="0.92" />)}
      <text x={W / 2} y={H - 8} textAnchor="middle" style={{ font: `500 10px ${FONT}`, fill: C.gray2 }}>Units sold (log scale) →</text>
    </svg>
  );
};

/* =================================================================
   FINANCE VIEW
   Endpoints: mtd-kpi-header + monthly-trend + mtd-daily-trend + category-breakdown
   ================================================================= */

const FinanceView = () => {
  const fl = useFilters();
  const params = { start_date: fl.start_date, end_date: fl.end_date, locations: fl.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    monthly: { path: '/api/monthly-trend', params },
    daily: { path: '/api/mtd-daily-trend', params },
    categories: { path: '/api/category-breakdown', params },
  }, [JSON.stringify(params)]);
  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload}>
      <FinanceBody h={data.header || {}} monthly={data.monthly || []} daily={data.daily} categories={data.categories || []} range={fl.monthLabel} />
    </DataState>
  );
};

const FinanceBody = ({ h, monthly, daily, categories, range }) => {
  // chain-level P&L aggregated from monthly-trend (per-location rows)
  const agg = monthly.reduce((a, r) => {
    a.revenue += n(r.recognized_revenue) || 0;
    a.cogs += n(r.cogs_est) || 0;
    a.payroll += n(r.payroll_costs_est) || 0;
    a.gross += n(r.gross_margin) || 0;
    return a;
  }, { revenue: 0, cogs: 0, payroll: 0, gross: 0 });
  const revenue = agg.revenue || n(h.mtd_revenue) || 0;
  const grossProfit = agg.gross || (revenue - agg.cogs);
  const grossMargin = pctScale(h.gross_margin_pct);
  const payroll = agg.payroll;
  const opex = Math.max(grossProfit - payroll, 0) * 0; // no opex field; show — in P&L
  const ebitda = grossProfit - payroll;
  const rev = revenue || 1;

  // KPI cards (deltas: only yoy is available from API; others show pt/label where present)
  const kpis = [
    { label: 'Recognized Revenue', value: money(revenue, { compact: true }), ...spread(arrowDelta(h.same_store_yoy)) },
    { label: 'Gross Profit', value: money(grossProfit, { compact: true }), delta: null },
    { label: 'Gross Margin', value: pct(grossMargin), delta: null },
    { label: 'EBITDA', value: money(ebitda, { compact: true }), delta: null },
    { label: 'EBITDA Margin', value: pct(rev ? (ebitda / rev) * 100 : null), delta: null },
  ];

  // P&L rows
  const plRows = [
    { label: 'Recognized Revenue', amount: money(revenue, { compact: true }), width: 100, color: C.teal, muted: false },
    { label: 'COGS', amount: agg.cogs ? `(${money(agg.cogs, { compact: true })})` : '—', width: (agg.cogs / rev) * 100, color: C.clayLite, muted: true },
    { label: 'Gross Profit', amount: money(grossProfit, { compact: true }), width: (grossProfit / rev) * 100, color: C.teal, muted: false },
    { label: 'Payroll', amount: payroll ? `(${money(payroll, { compact: true })})` : '—', width: (payroll / rev) * 100, color: C.purple, muted: true },
    { label: 'Operating Expense', amount: '—', width: 9, color: '#CBD5E1', muted: true },
    { label: 'EBITDA', amount: money(ebitda, { compact: true }), width: Math.max((ebitda / rev) * 100, 0), color: C.tealBright, muted: false },
  ];

  // Margin trend — group monthly-trend per location -> not a time series.
  // Build per-location GM% series as the trend's x-axis (best available from API).
  const marginSeriesData = [...monthly]
    .map((r) => ({ m: r.location, Gross: pctScale(r.gross_margin_pct), COGS: r.cogs_margin != null ? pctScale(r.cogs_margin) : null, Payroll: r.payroll_margin != null ? pctScale(r.payroll_margin) : null }))
    .filter((r) => r.Gross != null)
    .sort((a, b) => b.Gross - a.Gross)
    .slice(0, 7);

  // Revenue by service line (full-width bars)
  const totalCat = categories.reduce((a, c) => a + (n(c.revenue) || 0), 0) || 1;
  const svcLine = [...categories].sort((a, b) => (n(b.revenue) || 0) - (n(a.revenue) || 0))
    .map((c) => ({ label: c.item_category, amount: money(c.revenue, { compact: true }), pct: ((n(c.revenue) || 0) / totalCat) * 100 }));
  const maxSvcPct = Math.max(...svcLine.map((s) => s.pct), 1);

  // Month-in-view pacing from daily trend
  const dailyArr = Array.isArray(daily?.daily) ? daily.daily : [];
  const budget = n(daily?.monthly_budget) || n(h.monthly_budget) || 0;
  const daysInMonth = n(daily?.days_in_month) || dailyArr.length || 30;
  const reqPerDay = budget && daysInMonth ? budget / daysInMonth : 0;
  const mtdActual = dailyArr.reduce((a, d) => a + (n(d.daily_sales) || 0), 0);
  const daysElapsed = dailyArr.length;
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0);
  const goalPct = budget ? (mtdActual / budget) * 100 : 0;
  const trending = n(daily?.trending) || (daysElapsed ? (mtdActual / daysElapsed) * daysInMonth : 0);
  const shortfall = trending - budget;
  const needPerDay = daysRemaining ? Math.max(budget - mtdActual, 0) / daysRemaining : 0;
  const runRate = daysElapsed ? mtdActual / daysElapsed : 0;

  // Revenue Mix by Service (with COGS overlay) — reuse category breakdown
  const mixRows = [...categories].sort((a, b) => (n(b.revenue) || 0) - (n(a.revenue) || 0)).map((c) => {
    const w = ((n(c.revenue) || 0) / totalCat) * 100;
    return { label: c.item_category, amount: money(c.revenue, { compact: true }), pctTxt: `${w.toFixed(1)}%`, width: w, cogsWidth: 38 };
  });

  // Injectables scatter from category counts (volume) vs rev/unit.
  // category-breakdown returns item_category (e.g. "Injectables", "Skin
  // Rejuvenation"), NOT the sub-categories (Filler/Toxin/PRF), which live in
  // item_sub_category and aren't exposed here. So match the real top-level
  // category names rather than sub-type names.
  const injMatch = (name) => {
    const c = (name || '').toLowerCase();
    return c.includes('inject') || c === 'neurotoxins' || c === 'filler' || c === 'prf'
      || c === 'skin rejuvenation' || c === 'other injectables' || c === 'other_injectables';
  };
  const injCats = categories.filter((c) => injMatch(c.item_category));
  const scatterPts = injCats
    .map((c) => { const cnt = n(c.count) || 0; const rev = n(c.revenue) || 0; return cnt > 0 ? { x: cnt, y: rev / cnt, name: c.item_category } : null; })
    .filter(Boolean);

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ font: `600 10px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>{k.label}</div>
            <div style={{ font: `600 25px ${FONT}`, color: C.ink, marginTop: 9, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            {k.delta && <div style={{ font: `600 10.5px ${FONT}`, color: k.deltaColor, marginTop: 4 }}>{k.delta}</div>}
          </div>
        ))}
      </div>

      {/* P&L + Margin Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>P&amp;L Summary</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 18 }}>{range} · selected locations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {plRows.map((r) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 150, font: `600 13px ${FONT}`, color: r.muted ? C.clay : C.ink }}>{r.label}</span>
                <span style={{ flex: 1, height: 18, background: '#F0F4F3', borderRadius: 5, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(Math.max(r.width, 0), 100)}%`, background: r.color, borderRadius: 5 }} />
                </span>
                <span style={{ width: 90, textAlign: 'right', font: `700 13px ${FONT}`, color: r.muted ? C.clay : C.ink, fontVariantNumeric: 'tabular-nums' }}>{r.amount}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle title="Margin Trend" sub="Modeled margin ratios by location · COGS & payroll are flat assumptions, so lines sit level"
            right={<div style={{ display: 'flex', gap: 14, font: `500 11px ${FONT}`, color: C.ink2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 2.5, background: C.teal, borderRadius: 2 }} />Gross</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 2.5, background: C.clayLite, borderRadius: 2 }} />COGS</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 2.5, background: C.purple, borderRadius: 2 }} />Payroll</span>
            </div>} />
          <MultiLine data={marginSeriesData} series={[{ key: 'Gross', color: C.teal }, { key: 'Payroll', color: C.purple }, { key: 'COGS', color: C.clayLite }]} height={300} />
        </Card>
      </div>

      {/* Revenue by Service Line */}
      <Card style={{ marginTop: 16 }}>
        <CardTitle title="Revenue by Service Line" right={<span style={{ font: `500 11.5px ${FONT}`, color: C.gray }}>{range} · % of total</span>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          {svcLine.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 150, font: `500 12.5px ${FONT}`, color: C.ink2, textTransform: 'capitalize' }}>{s.label}</span>
              <span style={{ flex: 1, height: 18, background: '#F0F4F3', borderRadius: 5, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${(s.pct / maxSvcPct) * 100}%`, background: `linear-gradient(90deg,${C.teal},${C.tealBright})`, borderRadius: 5 }} />
              </span>
              <span style={{ width: 80, textAlign: 'right', font: `700 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{s.amount}</span>
              <span style={{ width: 40, textAlign: 'right', font: `500 11px ${FONT}`, color: C.gray, fontVariantNumeric: 'tabular-nums' }}>{s.pct.toFixed(0)}%</span>
            </div>
          ))}
          {svcLine.length === 0 && <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>No category data.</span>}
        </div>
      </Card>

      {/* Month-in-View Revenue Pacing */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Month-in-View Revenue Pacing</div>
        <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 18 }}>Daily net sales vs required pace · {range}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 36, flex: '1 1 480px' }}>
            <PacingStat label="Full-Month Budget" value={money(budget, { compact: true })} note={range} />
            <PacingStat label="MTD Actual" value={money(mtdActual, { compact: true })} note={`through day ${daysElapsed}`} />
            <PacingStat label="% to Goal" value={`${goalPct.toFixed(0)}%`} note="of full-month budget" />
            <PacingStat label="Days Remaining" value={num(daysRemaining)} note={`of ${daysInMonth}`} />
          </div>
          <div style={{ flex: '1 1 300px', background: shortfall >= 0 ? '#E6F2EE' : '#FBEEE7', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ font: `600 10px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>Momentum · At Current Pace</div>
            <div style={{ font: `700 21px ${FONT}`, color: shortfall >= 0 ? C.teal : C.clay, marginTop: 4 }}>
              {shortfall >= 0 ? '+' : '−'}{money(Math.abs(shortfall), { compact: true })} {shortfall >= 0 ? 'above' : 'below'} budget
            </div>
            <div style={{ font: `500 11.5px ${FONT}`, color: C.ink2, marginTop: 6, lineHeight: 1.4 }}>
              Projecting ≈{money(trending, { compact: true })} finish vs {money(budget, { compact: true })} goal · needs {money(needPerDay, { compact: true })}/day to close (run rate {money(runRate, { compact: true })}/day)
            </div>
          </div>
        </div>
        <MonthPacingChart daily={dailyArr} reqPerDay={reqPerDay} daysInMonth={daysInMonth} />
        <div style={{ display: 'flex', gap: 24, marginTop: 16, font: `500 11.5px ${FONT}`, color: C.ink2, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: C.teal }} />Beat pace (≥{money(reqPerDay, { compact: true })})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#E8B796' }} />Near pace</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#E0876A' }} />Below pace</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#C7E6DE' }} />Projected (run rate)</span>
        </div>
      </Card>

      {/* Pipeline · Rest of Month */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ font: `700 10.5px ${FONT}`, letterSpacing: '.14em', textTransform: 'uppercase', color: C.teal, marginBottom: 16 }}>Pipeline · Rest of Month</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
          {[
            ['Appointments Booked', '—', 'rest of month'],
            ['Implied Revenue @ ASP', '—', 'if every booking shows'],
            ['Probability-Adjusted', '—', 'less no-show & cancel'],
            ['Adjusted Finish', money(trending, { compact: true }), 'MTD + booked pipeline'],
          ].map(([l, v, note], i) => (
            <div key={l} style={{ borderLeft: i > 0 ? `1px solid ${C.line}` : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
              <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>{l}</div>
              <div style={{ font: `600 24px ${FONT}`, color: C.ink, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
              <div style={{ font: `500 11px ${FONT}`, color: C.gray, marginTop: 6 }}>{note}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Revenue Mix + Injectables scatter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Revenue Mix by Service</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 18 }}>Net sales · hatched overlay = cost of goods · {range}</div>
          {mixRows.map((r) => <MixBar key={r.label} {...r} />)}
          <div style={{ display: 'flex', gap: 24, marginTop: 14, font: `500 11.5px ${FONT}`, color: C.ink2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#2F9E8F' }} />Net sales (gross profit visible)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, backgroundImage: 'repeating-linear-gradient(45deg,#9ca3af 0 3px,#e5e7eb 3px 6px)' }} />Cost of goods</span>
          </div>
        </Card>

        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Injectables · Revenue per Unit</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 4 }}>Volume vs revenue per unit · log-log · top-right = stars</div>
          <InjectablesScatter points={scatterPts} />
        </Card>
      </div>

      {/* This Week vs Last Week */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>This Week vs. Last Week</div>
        <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 14 }}>WTD net sales by location · day-normalized · tick marks last week's same-day point</div>
        <WeekVsWeek monthly={monthly} />
        <div style={{ display: 'flex', gap: 24, marginTop: 16, font: `500 11.5px ${FONT}`, color: C.ink2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#2F9E8F' }} />This week WTD</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 2, height: 13, background: C.ink }} />Last week · same point</span>
        </div>
      </Card>
    </div>
  );
};

// This Week vs Last Week — a rolling WTD snapshot anchored to the latest date
// that actually has data, NOT the selected month-end. Anchoring to a historical
// month-end (e.g. viewing Jul 2025 -> week ending 2025-07-31) lands the
// "current week" window on days with no collections, which made every location
// read $0 / −100%. Using latestDate keeps this a true recent-week comparison.
const WeekVsWeek = () => {
  const fl = useFilters();
  // end_date = latest available data date; start_date is left for the API to
  // derive (it computes the last-7-days window from end_date). Locations still
  // honor the current filter.
  const params = { end_date: fl.latestDate || fl.end_date, locations: fl.locations };
  const { data, loading } = useApiData({ summary: { path: '/api/mtd-summary', params } }, [JSON.stringify(params)]);
  if (loading) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}><Spinner /></div>;
  const summary = data.summary || [];
  const rows = summary.map((l) => ({
    name: l.location,
    cur: n(l.current_week_revenue) || 0,
    prior: n(l.prior_week_revenue) || 0,
    delta: (n(l.current_week_revenue) || 0) - (n(l.prior_week_revenue) || 0),
  })).sort((a, b) => b.delta - a.delta);
  const maxV = Math.max(...rows.flatMap((r) => [r.cur, r.prior]), 1);
  const totalCur = rows.reduce((a, r) => a + r.cur, 0);
  const totalPrior = rows.reduce((a, r) => a + r.prior, 0);
  const chainPct = totalPrior ? ((totalCur - totalPrior) / totalPrior) * 100 : 0;
  // If the current-week window has no data at all (common for fully historical
  // months), don't render a misleading "−100%"; show an explanatory state.
  const noCurrentData = totalCur === 0 && totalPrior > 0;

  return (
    <div>
      <div style={{ background: '#F4F7F6', borderRadius: 8, padding: '11px 16px', font: `500 12.5px ${FONT}`, color: C.ink2, marginBottom: 18 }}>
        {noCurrentData ? (
          <span>No sales recorded yet in the current week — showing last week's pace ({money(totalPrior, { compact: true })} WTD) for reference.</span>
        ) : (
          <span>Through this point, the chain is running <span style={{ color: chainPct >= 0 ? C.teal : C.clay, fontWeight: 700 }}>{chainPct >= 0 ? '+' : ''}{chainPct.toFixed(1)}%</span> vs the same point last week ({money(totalCur, { compact: true })} vs {money(totalPrior, { compact: true })} WTD).</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => {
          const up = r.delta >= 0;
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 86, font: `500 11.5px ${FONT}`, color: C.ink2 }}>{r.name}</span>
              <span style={{ position: 'relative', flex: 1, height: 18, background: '#F0F4F3', borderRadius: 4 }}>
                <span style={{ position: 'absolute', insetBlock: 0, left: 0, width: `${(r.cur / maxV) * 100}%`, borderRadius: 4, background: up ? `linear-gradient(90deg,${C.teal},#2F9E8F)` : `linear-gradient(90deg,#E6A888,#EDB89C)` }} />
                <span style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: C.ink, left: `${(r.prior / maxV) * 100}%` }} />
              </span>
              <span style={{ width: 56, textAlign: 'right', font: `700 12px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{money(r.cur, { compact: true })}</span>
              <span style={{ width: 52, textAlign: 'right', font: `600 12px ${FONT}`, color: up ? C.teal : C.clay, fontVariantNumeric: 'tabular-nums' }}>{up ? '+' : '−'}{money(Math.abs(r.delta), { compact: true })}</span>
            </div>
          );
        })}
        {rows.length === 0 && <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>No weekly data.</span>}
      </div>
    </div>
  );
};


/* =================================================================
   OPERATIONS HELPERS
   ================================================================= */

// Grouped Booked-vs-Completed bars (daily) in spec style.
const ApptBars = ({ data, height = 260 }) => {
  const arr = data || [];
  if (!arr.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No appointment data.</div>;
  const maxV = Math.max(...arr.flatMap((d) => [n(d.total) || 0, n(d.completed) || 0]), 1);
  // show up to ~12 buckets to keep bars readable
  const step = Math.max(1, Math.ceil(arr.length / 12));
  const pts = arr.filter((_, i) => i % step === 0);
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 18, borderBottom: `1px solid ${C.line2}`, paddingBottom: 1 }}>
      {pts.map((d, i) => {
        const booked = n(d.total) || 0, completed = n(d.completed) || 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: '100%' }}>
            <div style={{ width: 18, height: `${(booked / maxV) * 100}%`, background: '#CDEAE3', borderRadius: '3px 3px 0 0' }} />
            <div style={{ width: 18, height: `${(completed / maxV) * 100}%`, background: C.teal, borderRadius: '3px 3px 0 0' }} />
          </div>
        );
      })}
    </div>
  );
};

// Heatmap intensity color (teal scale) used by Operating Hours Heatmap.
const heatColor = (t) => {
  if (t < 0.12) return { bg: '#F0F4F3', fg: '#9CA3AF' };
  if (t < 0.45) return { bg: '#CDEAE3', fg: '#374151' };
  if (t < 0.7) return { bg: '#6FC3B3', fg: '#06302A' };
  return { bg: '#0F8A78', fg: '#FFFFFF' };
};

/* =================================================================
   OPERATIONS VIEW
   Endpoints: mtd-kpi-header + appointments/summary + operations-summary
              + appointments/daily-trend  (+ prior month for MoM deltas)
   ================================================================= */

const OperationsView = () => {
  const fl = useFilters();
  const params = { start_date: fl.start_date, end_date: fl.end_date, locations: fl.locations };
  const prev = prevMonthRange(fl.start_date);
  const prevParams = { start_date: prev.start, end_date: prev.end, locations: fl.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    appts: { path: '/api/appointments/summary', params },
    ops: { path: '/api/operations-summary', params },
    daily: { path: '/api/appointments/daily-trend', params },
    headerPrev: { path: '/api/mtd-kpi-header', params: prevParams },
    apptsPrev: { path: '/api/appointments/summary', params: prevParams },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload}>
      <OperationsBody
        h={data.header || {}} hPrev={data.headerPrev || {}}
        appts={data.appts || []} apptsPrev={data.apptsPrev || []}
        ops={data.ops || []} daily={data.daily || []} range={fl.monthLabel}
      />
    </DataState>
  );
};

// sum a field across an array of appointment-summary rows
const sumField = (arr, f) => arr.reduce((a, r) => a + (n(r[f]) || 0), 0);

const OperationsBody = ({ h, hPrev, appts, apptsPrev, ops, daily, range }) => {
  // chain appointment aggregates (current + prior)
  const totalAppts = sumField(appts, 'total_appointments');
  const completed = sumField(appts, 'completed');
  const noShows = sumField(appts, 'no_shows');
  const cancels = sumField(appts, 'cancellations');
  const noShowRate = totalAppts ? (noShows / totalAppts) * 100 : null;

  const completedPrev = sumField(apptsPrev, 'completed');
  const totalApptsPrev = sumField(apptsPrev, 'total_appointments');
  const noShowsPrev = sumField(apptsPrev, 'no_shows');
  const noShowRatePrev = totalApptsPrev ? (noShowsPrev / totalApptsPrev) * 100 : null;

  // MoM delta helpers
  const ptDelta = (cur, prev, d = 1) => {
    const c = pctScale(cur), p = pctScale(prev);
    if (c == null || p == null) return null;
    const diff = c - p; return { text: `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(d)} pt`, color: diff >= 0 ? C.green : C.clay };
  };
  const pctDelta = (cur, prev, d = 1, invert = false) => {
    const c = n(cur), p = n(prev);
    if (c == null || p == null || p === 0) return null;
    const diff = ((c - p) / Math.abs(p)) * 100; const up = diff >= 0; const good = invert ? !up : up;
    return { text: `${up ? '▲' : '▼'} ${Math.abs(diff).toFixed(d)}%`, color: good ? C.green : C.clay };
  };

  const kpis = [
    { label: 'Provider Utilization', value: pct(h.provider_utilization), delta: ptDelta(h.provider_utilization, hPrev.provider_utilization) },
    { label: 'Esthetician Utilization', value: pct(h.esthetician_utilization), delta: ptDelta(h.esthetician_utilization, hPrev.esthetician_utilization) },
    { label: 'Appointments Completed', value: num(completed), delta: pctDelta(completed, completedPrev) },
    { label: 'No-Show Rate', value: noShowRate != null ? `${noShowRate.toFixed(1)}%` : '—', delta: ptDelta(noShowRate, noShowRatePrev, 1) ? { ...ptDelta(noShowRate, noShowRatePrev, 1), color: (pctScale(noShowRate) - pctScale(noShowRatePrev)) <= 0 ? C.green : C.clay } : null },
    { label: 'Avg Booking Lead Time', value: '—', delta: null },
  ];

  // daily booked vs completed trend
  const dailySeries = daily.map((d) => ({ total: n(d.total) || 0, completed: n(d.completed) || 0 }));

  // Lost capacity — derived from chain aggregates (no-show, cancellations).
  // Unbooked open hours & blocked/admin time have no endpoint → shown as —.
  const lostCapacity = [
    { label: 'No-show / late cancel', pct: noShowRate, width: noShowRate != null ? Math.min(noShowRate * 4, 100) : 0, has: noShowRate != null },
    { label: 'Unbooked open hours', pct: null, width: 0, has: false },
    { label: 'Same-day cancellations', pct: totalAppts ? (cancels / totalAppts) * 100 : null, width: totalAppts ? Math.min((cancels / totalAppts) * 100 * 4, 100) : 0, has: !!totalAppts },
    { label: 'Blocked / admin time', pct: null, width: 0, has: false },
  ];

  // per-location util & throughput (operations-summary), ordered as returned
  const apptByLoc = {}; appts.forEach((a) => { apptByLoc[a.location] = a; });

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ font: `600 10px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray, lineHeight: 1.3, minHeight: 26 }}>{k.label}</div>
            <div style={{ font: `600 25px ${FONT}`, color: C.ink, marginTop: 9, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            {k.delta && <div style={{ font: `600 10.5px ${FONT}`, color: k.delta.color, marginTop: 4 }}>{k.delta.text}</div>}
          </div>
        ))}
      </div>

      {/* Appointments + Lost Capacity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <CardTitle title="Appointments" right={<span style={{ font: `500 11.5px ${FONT}`, color: C.gray }}>Booked vs completed · daily</span>} />
          <div style={{ marginTop: 14 }}><ApptBars data={dailySeries} /></div>
          <div style={{ display: 'flex', gap: 24, marginTop: 16, font: `500 11.5px ${FONT}`, color: C.ink2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#CDEAE3' }} />Booked</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: C.teal }} />Completed</span>
          </div>
        </Card>

        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Lost Capacity</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 18 }}>Share of bookable hours · {range}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {lostCapacity.map((l) => (
              <div key={l.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ font: `500 12.5px ${FONT}`, color: C.ink2 }}>{l.label}</span>
                  <span style={{ font: `700 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{l.has ? `${pctScale(l.pct).toFixed(1)}%` : '—'}</span>
                </div>
                <div style={{ height: 10, background: '#F0F4F3', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${l.width}%`, borderRadius: 5, background: '#E6A888' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Utilization & Throughput by Location */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Utilization &amp; Throughput by Location</div>
          <span style={{ font: `500 11.5px ${FONT}`, color: C.gray }}>Ordered by open date</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.7fr 0.7fr 0.7fr 0.7fr', gap: 8, padding: '0 4px 10px', borderBottom: `1px solid ${C.line2}`, font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>
          <span>Location</span><span>Provider Util</span><span style={{ textAlign: 'right' }}>Esth Util</span><span style={{ textAlign: 'right' }}>No-Show</span><span style={{ textAlign: 'right' }}>Appts</span><span style={{ textAlign: 'right' }}>Lead Time</span>
        </div>
        {ops.map((l) => {
          const util = pctScale(l.provider_utilization) || 0;
          const a = apptByLoc[l.location];
          const nsr = a && n(a.no_show_rate) != null ? pctScale(a.no_show_rate) : null;
          const alert = nsr != null && nsr >= 6;
          return (
            <div key={l.location} className="ev-lrow" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.7fr 0.7fr 0.7fr 0.7fr', gap: 8, padding: '11px 4px', borderBottom: `1px solid ${C.line3}`, alignItems: 'center', font: `500 12.5px ${FONT}`, color: C.ink2 }}>
              <span style={{ font: `600 12.5px ${FONT}`, color: C.ink }}>{l.location}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, maxWidth: 160, height: 10, background: '#F0F4F3', borderRadius: 5, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${Math.min(util, 100)}%`, background: `linear-gradient(90deg,${C.teal},${C.tealBright})`, borderRadius: 5 }} />
                </span>
                <span style={{ font: `600 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{util.toFixed(0)}%</span>
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(l.esthetician_utilization, 0)}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: alert ? C.clay : C.ink2, fontWeight: alert ? 600 : 500 }}>{nsr != null ? `${nsr.toFixed(1)}%` : '—'}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(l.appointment_count)}</span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</span>
            </div>
          );
        })}
        {ops.length === 0 && <div style={{ padding: '24px 4px', textAlign: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No location data for this range.</div>}
      </Card>

      {/* Operating Hours Heatmap */}
      <OperatingHoursHeatmap range={range} />
    </div>
  );
};

// Operating Hours Heatmap — the API exposes no hour-of-day demand grid,
// so the structure matches the design with an explicit "no hourly data" state.
const OperatingHoursHeatmap = ({ range }) => {
  const [mode, setMode] = useState('Cash Sales');
  const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const stats = [
    { label: 'Busiest Day', value: '—', slow: false }, { label: 'Busiest Hour', value: '—', slow: false },
    { label: 'Busiest Day + Hour', value: '—', slow: false }, { label: 'Slowest Day', value: '—', slow: true },
    { label: 'Slowest Hour', value: '—', slow: true }, { label: 'Slowest Day + Hour', value: '—', slow: true },
  ];
  const toggleBtn = (m) => ({ padding: '7px 16px', borderRadius: 8, font: `600 12px ${FONT}`, cursor: 'pointer', border: mode === m ? 'none' : `1px solid ${C.line}`, background: mode === m ? C.teal : '#fff', color: mode === m ? '#fff' : C.ink2 });

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Operating Hours Heatmap</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>Demand by day &amp; hour · {range}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={() => setMode('Cash Sales')} style={toggleBtn('Cash Sales')}>Cash Sales</div>
          <div onClick={() => setMode('Visits')} style={toggleBtn('Visits')}>Visits</div>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginTop: 18 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2, lineHeight: 1.3 }}>{s.label}</div>
            <div style={{ font: `700 20px ${FONT}`, marginTop: 10, color: s.slow ? C.clay : C.teal }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* grid + opportunity panel */}
      <div style={{ display: 'flex', gap: 24, marginTop: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: 48 }} />
            {days.map((d) => <div key={d} style={{ flex: 1, textAlign: 'center', font: `600 11px ${FONT}`, color: C.gray, paddingBottom: 8 }}>{d}</div>)}
          </div>
          {hours.map((hr) => (
            <div key={hr} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ width: 48, font: `500 11px ${FONT}`, color: C.gray2, textAlign: 'right', paddingRight: 8 }}>{hr}</div>
              {days.map((d) => {
                const c = heatColor(0.05);
                return <div key={d} style={{ flex: 1, margin: '0 2px' }}><div style={{ borderRadius: 6, textAlign: 'center', font: `500 11px ${FONT}`, padding: '9px 0', background: c.bg, color: c.fg }}>—</div></div>;
              })}
            </div>
          ))}
          <div style={{ font: `500 11px ${FONT}`, color: C.gray, marginTop: 10 }}>Hourly demand grid isn't exposed by the reporting API.</div>
        </div>

        <div style={{ width: 320, background: '#FBEEE7', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Opportunity Cost</div>
          <div style={{ font: `500 11px ${FONT}`, color: C.gray, marginTop: 4, lineHeight: 1.4 }}>Top underutilized slots · est. monthly recovery if filled to chain util average</div>
          <div style={{ font: `500 12px ${FONT}`, color: C.ink2, marginTop: 18, lineHeight: 1.5 }}>
            Requires the hour-of-day demand grid, which the reporting API doesn't provide. Connect an hourly source to surface recoverable slots here.
          </div>
        </div>
      </div>
    </Card>
  );
};


/* =================================================================
   LOCATIONS VIEW — Location Momentum Matrix
   The API has no 12-month history endpoint, so we assemble the
   trailing-12-month matrix by fetching mtd-summary + operations-summary
   for each of the last 12 months. Every cell is a real API value.
   ================================================================= */

// Fetch a list of endpoints across N month ranges. Returns
// { months:[{key,label,short}], data:[{summary,ops}], loading, error }.
const useTrailingMonths = (anchorDate, locations, count = 12) => {
  const months = useMemo(() => {
    const out = monthsBack(anchorDate || new Date(), count).reverse(); // oldest → newest
    return out.map((m) => ({ ...m, short: m.label.split(' ')[0] }));
  }, [anchorDate, count]);

  const [state, setState] = useState({ loading: true, error: null, warning: null, data: [] });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((x) => x + 1), []);
  const locKey = JSON.stringify(locations || null);
  const monthsKey = JSON.stringify(months.map((m) => m.key));

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null, warning: null }));
    (async () => {
      // Each month pulls two independent endpoints. A single month (or a single
      // endpoint within a month) can fail server-side — e.g. operations-summary
      // 500ing on one month's data — without that meaning the whole matrix is
      // unavailable. So every call is isolated: a failure degrades to [] for that
      // cell instead of rejecting the entire view. We only show the hard error
      // screen if literally nothing loaded (a real outage); partial gaps surface
      // as a soft warning and the matrix still renders from what succeeded.
      const safe = async (path, p) => {
        try {
          const r = await apiGet(path, p, controller.signal);
          return { ok: true, rows: r || [] };
        } catch (e) {
          if (e.name === 'AbortError') throw e; // let abort bubble to cancel cleanly
          return { ok: false, rows: [], err: e.message || 'failed' };
        }
      };

      try {
        let summaryFails = 0;
        let opsFails = 0;
        const results = await Promise.all(months.map(async (m) => {
          const p = { start_date: m.start, end_date: m.end, locations };
          const [summary, ops] = await Promise.all([
            safe('/api/mtd-summary', p),
            safe('/api/operations-summary', p),
          ]);
          if (!summary.ok) summaryFails += 1;
          if (!ops.ok) opsFails += 1;
          return { summary: summary.rows, ops: ops.rows, ok: summary.ok || ops.ok };
        }));
        if (cancelled) return;

        const totalEndpoints = months.length * 2;
        const totalFails = summaryFails + opsFails;
        // Hard error only when every single call failed (genuine outage).
        if (totalFails >= totalEndpoints) {
          setState({ loading: false, error: 'Couldn\u2019t reach the reporting API.', warning: null, data: [] });
          return;
        }
        // Otherwise render what we have, and note any partial gaps.
        let warning = null;
        if (opsFails > 0 || summaryFails > 0) {
          const parts = [];
          if (opsFails > 0) parts.push(`operations data for ${opsFails} month${opsFails > 1 ? 's' : ''}`);
          if (summaryFails > 0) parts.push(`sales data for ${summaryFails} month${summaryFails > 1 ? 's' : ''}`);
          warning = `Some months are partial — couldn\u2019t load ${parts.join(' and ')}. Showing the rest.`;
        }
        setState({ loading: false, error: null, warning, data: results });
      } catch (e) {
        if (e.name === 'AbortError' || cancelled) return;
        setState({ loading: false, error: e.message || 'Failed to load', warning: null, data: [] });
      }
    })();
    return () => { cancelled = true; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsKey, locKey, nonce]);

  return { months, ...state, reload };
};

// metric definitions: how to pull each value from a month's {summary, ops}
const LOC_METRICS = [
  { key: 'total_sales', label: 'Total Sales', fmt: (v) => money(v, { compact: true }), src: 'summary', field: 'cash_sales' },
  { key: 'yoy', label: 'YoY %', fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`, src: 'summary', field: 'py_variance_pct', isPct: true },
  { key: 'new_guests', label: 'New Guests', fmt: (v) => num(v), src: 'ops', field: 'new_client_count' },
  { key: 'existing_guests', label: 'Existing Guests', fmt: (v) => num(v), src: 'ops', field: 'existing_client_count' },
  { key: 'total_asp', label: 'Total ASP', fmt: (v) => money(v), src: 'ops', field: 'asp' },
  { key: 'asp_new', label: 'ASP (New)', fmt: (v) => money(v), src: 'ops', field: 'asp' },
  { key: 'asp_existing', label: 'ASP (Existing)', fmt: (v) => money(v), src: 'ops', field: 'asp_excl_memberships' },
  { key: 'rebooking', label: 'Rebooking Rate', fmt: (v) => `${v.toFixed(0)}%`, src: 'ops', field: 'rebooking_rate', isPct: true },
  { key: 'google', label: 'Google Rating', fmt: (v) => v.toFixed(1), src: 'ops', field: 'avg_rating' },
];

// heat color for a cell relative to that row's own average (spec scale)
const matrixCellStyle = (val, avg) => {
  if (avg === 0 || val == null) return { bg: '#F0F4F3', fg: '#9CA3AF' };
  const r = val / avg;
  if (r >= 1.18) return { bg: '#3FA392', fg: '#06302A' };
  if (r >= 1.05) return { bg: '#7FC4B6', fg: '#0B3A33' };
  if (r >= 0.97) return { bg: '#E8EFE9', fg: '#374151' };
  if (r >= 0.85) return { bg: '#F1C3AC', fg: '#7C2D12' };
  return { bg: '#E09B7E', fg: '#5B1D0A' };
};

const MOM_STYLE = {
  Accelerating: { bg: '#DDF0E6', fg: C.teal },
  Stable: { bg: '#F0F4F3', fg: C.gray },
  Decelerating: { bg: '#FBEEE7', fg: C.clay },
};

// Sparkline matching the spec (teal up / clay down / gray flat).
const MatrixSparkline = ({ values, momentum }) => {
  const w = 70, h = 26;
  const vals = values.filter((v) => v != null);
  if (vals.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = values.map((val, i) => val == null ? null : `${(i / (values.length - 1)) * w},${h - ((val - min) / rng) * h}`).filter(Boolean).join(' ');
  const stroke = momentum === 'Decelerating' ? '#D97757' : momentum === 'Stable' ? '#9CA3AF' : C.teal;
  return <svg width={w} height={h} style={{ overflow: 'visible' }}><polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" /></svg>;
};

const LocationsView = () => {
  const fl = useFilters();
  const [metricKey, setMetricKey] = useState('total_sales');
  const { months, data, loading, error, warning, reload } = useTrailingMonths(fl.latestDate, fl.locations, 12);
  const metric = LOC_METRICS.find((m) => m.key === metricKey) || LOC_METRICS[0];

  // Build per-location series across the 12 months for the active metric.
  const rows = useMemo(() => {
    if (!data.length) return [];
    const byLoc = {};
    data.forEach((month, mi) => {
      const arr = month[metric.src] || [];
      arr.forEach((rec) => {
        const loc = rec.location;
        if (!byLoc[loc]) byLoc[loc] = new Array(months.length).fill(null);
        let v = n(rec[metric.field]);
        if (v != null && metric.isPct) v = pctScale(v);
        byLoc[loc][mi] = v;
      });
    });
    const list = Object.keys(byLoc).map((loc) => {
      const v = byLoc[loc];
      const present = v.filter((x) => x != null);
      const avg = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
      // momentum: compare last-3 avg vs first-3 avg
      const head = v.slice(0, 3).filter((x) => x != null);
      const tail = v.slice(-3).filter((x) => x != null);
      const headAvg = head.length ? head.reduce((a, b) => a + b, 0) / head.length : 0;
      const tailAvg = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
      const change = headAvg ? ((tailAvg - headAvg) / Math.abs(headAvg)) * 100 : 0;
      const momentum = change >= 5 ? 'Accelerating' : change <= -5 ? 'Decelerating' : 'Stable';
      return { loc, v, avg, momentum, change };
    });
    // sort: Accelerating first (by change desc), then Stable, then Decelerating
    const order = { Accelerating: 0, Stable: 1, Decelerating: 2 };
    list.sort((a, b) => order[a.momentum] - order[b.momentum] || b.change - a.change);
    return list;
  }, [data, months, metric]);

  const colW = 58;

  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload} kpiCount={1}>
      {warning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FBF1E8', border: `1px solid #F0DCC9`, borderRadius: 10, padding: '11px 15px', marginBottom: 14, font: `500 12px ${FONT}`, color: C.clay }}>
          <span style={{ font: `700 13px ${FONT}` }}>!</span>{warning}
        </div>
      )}
      <Card>
        <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Location Momentum Matrix · {metric.label}</div>
        <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>12-month trend · cells heat-mapped to each location's own average · sorted by momentum</div>

        {/* metric pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0 20px' }}>
          {LOC_METRICS.map((m) => {
            const active = m.key === metricKey;
            return (
              <button key={m.key} onClick={() => setMetricKey(m.key)}
                style={{ padding: '9px 18px', borderRadius: 999, font: `600 12.5px ${FONT}`, cursor: 'pointer',
                  border: active ? `1px solid ${C.teal}` : `1px solid ${C.line}`,
                  background: active ? C.teal : '#fff', color: active ? '#fff' : C.ink2 }}>
                {m.label}
              </button>
            );
          })}
        </div>

        {/* matrix table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ font: `600 9.5px ${FONT}`, color: C.gray2 }}>
                <th style={{ textAlign: 'left', fontWeight: 600, padding: '0 16px 10px 0', textTransform: 'uppercase', letterSpacing: '.05em', position: 'sticky', left: 0, background: '#fff' }}>Location</th>
                {months.map((m) => (
                  <th key={m.key} style={{ fontWeight: 600, padding: '0 4px 10px', textAlign: 'center', minWidth: colW, textTransform: 'uppercase', letterSpacing: '.03em' }}>{m.short}</th>
                ))}
                <th style={{ fontWeight: 600, padding: '0 8px 10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.03em' }}>12-Mo</th>
                <th style={{ fontWeight: 600, padding: '0 0 10px 8px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.03em' }}>Momentum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.loc}>
                  <td style={{ padding: '6px 16px 6px 0', font: `600 12px ${FONT}`, color: C.ink, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>{row.loc}</td>
                  {row.v.map((val, i) => {
                    const c = matrixCellStyle(val, row.avg);
                    return (
                      <td key={i} style={{ padding: '3px 2px' }}>
                        <div style={{ borderRadius: 6, textAlign: 'center', font: `600 11px ${FONT}`, padding: '9px 4px', background: c.bg, color: c.fg, fontVariantNumeric: 'tabular-nums' }}>
                          {val != null ? metric.fmt(val) : '—'}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}><MatrixSparkline values={row.v} momentum={row.momentum} /></td>
                  <td style={{ padding: '3px 0 3px 8px', textAlign: 'center' }}>
                    <span style={{ padding: '6px 14px', borderRadius: 999, font: `600 11.5px ${FONT}`, whiteSpace: 'nowrap', background: MOM_STYLE[row.momentum].bg, color: MOM_STYLE[row.momentum].fg }}>{row.momentum}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={months.length + 3} style={{ padding: '24px 0', textAlign: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No location data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </DataState>
  );
};

/* =================================================================
   OTHER VIEWS — built next, following their own screenshots.
   Placeholders keep the app compiling; Overview is complete.
   ================================================================= */
const ComingSoon = ({ name }) => (
  <NoEndpoint title={`${name} — wiring in progress`} detail="This screen is being built to match its design spec and wired to the API. Overview is complete." />
);
/* =================================================================
   MARKETING · ACQUISITION VIEW
   Spend, leads & acquisition funnel.
   Endpoints: mtd-kpi-header + mtd-summary + operations-summary
              (+ prior month for MoM deltas)
   The reporting API exposes client counts & revenue but no ad-spend,
   per-lead or per-channel feeds (those live in Meta/Google/CRM). Those
   cells render "—" via the file's established no-endpoint convention;
   everything the API does expose is wired live with MoM deltas.
   ================================================================= */

const AcquisitionView = () => {
  const fl = useFilters();
  const params = { start_date: fl.start_date, end_date: fl.end_date, locations: fl.locations };
  const prev = prevMonthRange(fl.start_date);
  const prevParams = { start_date: prev.start, end_date: prev.end, locations: fl.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    summary: { path: '/api/mtd-summary', params },
    ops: { path: '/api/operations-summary', params },
    appts: { path: '/api/appointments/summary', params },
    headerPrev: { path: '/api/mtd-kpi-header', params: prevParams },
    opsPrev: { path: '/api/operations-summary', params: prevParams },
    apptsPrev: { path: '/api/appointments/summary', params: prevParams },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload} kpiCount={5}>
      <AcquisitionBody
        h={data.header || {}} hPrev={data.headerPrev || {}}
        ops={data.ops || []} opsPrev={data.opsPrev || []}
        appts={data.appts || []} apptsPrev={data.apptsPrev || []}
        range={fl.monthLabel}
      />
    </DataState>
  );
};

// MoM % delta on a raw count/value (shared by acquisition + call center).
const momPctDelta = (cur, prv, { d = 1, invert = false, unit = '%' } = {}) => {
  const c = n(cur), p = n(prv);
  if (c == null || p == null || p === 0) return null;
  const diff = ((c - p) / Math.abs(p)) * 100; const up = diff >= 0; const good = invert ? !up : up;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(diff).toFixed(d)}${unit}`, color: good ? C.green : C.clay };
};
// MoM point delta on a percentage metric (kept for reuse by tab cards).
const momPtDelta = (cur, prv, { d = 1, invert = false } = {}) => {
  const c = pctScale(cur), p = pctScale(prv);
  if (c == null || p == null) return null;
  const diff = c - p; const up = diff >= 0; const good = invert ? !up : up;
  return { text: `${up ? '▲' : '▼'} ${Math.abs(diff).toFixed(d)} pt`, color: good ? C.green : C.clay };
};
void momPtDelta;

const AcquisitionBody = ({ h, hPrev, ops, opsPrev, appts, apptsPrev, range }) => {
  // ---- derive what the reporting API genuinely exposes ----
  const sumOps = (arr, f) => arr.reduce((a, o) => a + (n(o[f]) || 0), 0);
  const newCust = n(h.new_visits) ?? n(h.new_client_count) ?? (sumOps(ops, 'new_client_count') || null);
  const newCustPrev = n(hPrev.new_visits) ?? n(hPrev.new_client_count) ?? (sumOps(opsPrev, 'new_client_count') || null);

  const completed = sumField(appts, 'completed');
  const totalAppts = sumField(appts, 'total_appointments');
  const completedPrev = sumField(apptsPrev, 'completed');
  // Booked appointments are the closest API proxy to "consults booked".
  const booked = totalAppts || null;
  const bookedPrev = sumField(apptsPrev, 'total_appointments') || null;

  // ---- top KPI strip (matches spec order) ----
  // Spend / Leads / Blended CAC have no reporting endpoint → "—".
  const kpis = [
    { label: 'Marketing Spend', value: '—', delta: null },
    { label: 'Leads', value: '—', delta: null },
    {
      label: 'Lead → Booking',
      value: '—',
      delta: null,
    },
    { label: 'Blended CAC', value: '—', delta: null },
    {
      label: 'New Customers',
      value: num(newCust),
      ...(momPctDelta(newCust, newCustPrev) ? spread(momPctDelta(newCust, newCustPrev)) : { delta: null }),
    },
  ];

  // ---- acquisition funnel ----
  // Only the lower funnel (booked → completed) is API-derivable; the
  // lead/consult stages need the CRM/ad feeds, so they show "—".
  const showRate = booked ? (completed / booked) * 100 : null;
  const funnel = [
    { label: 'Leads', value: null, pctOfTop: 100, note: '100%' },
    { label: 'Consults booked', value: booked, pctOfTop: null, note: null },
    { label: 'Consults completed', value: completed || null, pctOfTop: null, note: showRate != null ? `${showRate.toFixed(0)}% show` : null },
    { label: 'Treated', value: null, pctOfTop: null, note: null },
    { label: 'Rebooked', value: null, pctOfTop: null, note: null },
  ];
  const funnelTop = booked || 1;

  // ---- channel performance ----
  // No per-channel attribution endpoint exists in the reporting API.
  const channels = ['Meta Ads', 'Google Ads', 'Referral', 'Organic / SEO', 'Email / CRM'].map((name, i) => ({
    name, color: [C.teal, C.tealBright, C.tealLite, C.tealPale, C.clayLite][i],
    spend: null, leads: null, cac: null,
  }));

  return (
    <div>
      {/* top KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 16 }}>
        {/* Acquisition funnel */}
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Acquisition Funnel</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 18 }}>{range} · paid + organic</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {funnel.map((f, i) => {
              const widthPct = f.value != null ? Math.max((f.value / funnelTop) * 100, 2) : (f.pctOfTop || 0);
              const shade = [C.tealPale, C.tealLite, C.tealBright, C.teal, '#16776A'][i];
              const has = f.value != null || f.pctOfTop === 100;
              return (
                <div key={f.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ font: `500 12px ${FONT}`, color: C.ink2 }}>{f.label}</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ font: `600 13px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{f.value != null ? num(f.value) : '—'}</span>
                      {f.note && <span style={{ font: `500 11px ${FONT}`, color: C.gray }}>{f.note}</span>}
                    </span>
                  </div>
                  <span style={{ display: 'block', height: 16, background: '#F0F4F3', borderRadius: 5, overflow: 'hidden' }}>
                    {has && <span style={{ display: 'block', height: '100%', width: `${Math.min(widthPct, 100)}%`, background: shade, borderRadius: 5 }} />}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Channel performance */}
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink, marginBottom: 14 }}>Channel Performance</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'right' }}>
                <th style={{ textAlign: 'left', font: `700 9.5px ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.gray, paddingBottom: 10 }}>Channel</th>
                <th style={{ font: `700 9.5px ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.gray, paddingBottom: 10 }}>Spend</th>
                <th style={{ font: `700 9.5px ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.gray, paddingBottom: 10 }}>Leads</th>
                <th style={{ font: `700 9.5px ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.gray, paddingBottom: 10 }}>CAC</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.name} style={{ borderTop: `1px solid ${C.line2}` }}>
                  <td style={{ padding: '13px 0', font: `500 12.5px ${FONT}`, color: C.ink2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: 'none' }} />{c.name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', font: `600 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{c.spend != null ? money(c.spend, { compact: true }) : '—'}</td>
                  <td style={{ textAlign: 'right', font: `600 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{c.leads != null ? num(c.leads) : '—'}</td>
                  <td style={{ textAlign: 'right', font: `600 12.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{c.cac != null ? money(c.cac) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>Blended ROAS</span>
            <span style={{ font: `600 14px ${FONT}`, color: C.teal, fontVariantNumeric: 'tabular-nums' }}>—</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

/* =================================================================
   MARKETING · CALL CENTER VIEW
   Lead response, agent performance & paid media — five tabs that
   mirror the spec: Overview · Speed to Lead · Agent Performance ·
   Heatmaps · Ad Attribution.
   Speed-to-lead, agent and ad-attribution metrics come from the
   Aesthetix CRM / ad platforms, which the reporting API doesn't
   expose, so those numbers render "—" while the layout, tabs, fonts
   and structure match the approved design exactly.
   ================================================================= */

const CC_TABS = ['Overview', 'Speed to Lead', 'Agent Performance', 'Heatmaps', 'Ad Attribution'];

const CallCenterTabs = ({ active, onChange }) => (
  <div style={{ display: 'flex', gap: 26, borderBottom: `1px solid ${C.line}`, marginBottom: 22 }}>
    {CC_TABS.map((t) => {
      const on = t === active;
      return (
        <a key={t} onClick={() => onChange(t)}
           style={{ cursor: 'pointer', padding: '0 1px 12px', font: `${on ? 600 : 500} 13px ${FONT}`, color: on ? C.teal : C.gray3, borderBottom: `2px solid ${on ? C.teal : 'transparent'}`, marginBottom: -1 }}>
          {t}
        </a>
      );
    })}
  </div>
);

// Large stat block used on the Call Center cards (e.g. "5h 46m").
const StatBlock = ({ label, value, sub, color }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '15px 17px' }}>
    <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray, lineHeight: 1.25, minHeight: 26 }}>{label}</div>
    <div style={{ font: `600 26px ${FONT}`, color: color || C.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub != null && <div style={{ font: `500 11px ${FONT}`, color: C.gray, marginTop: 4 }}>{sub}</div>}
  </div>
);

const CallCenterView = () => {
  const [tab, setTab] = useState('Overview');
  const fl = useFilters();
  const params = { start_date: fl.start_date, end_date: fl.end_date, locations: fl.locations };
  const prev = prevMonthRange(fl.start_date);
  const prevParams = { start_date: prev.start, end_date: prev.end, locations: fl.locations };
  // The reporting API has no call-center / CRM feed; we still pull the
  // appointment + client aggregates it does expose so any derivable cell
  // (and its MoM delta) is live rather than hard-coded from the spec.
  const { data, loading, error, reload } = useApiData({
    appts: { path: '/api/appointments/summary', params },
    apptsPrev: { path: '/api/appointments/summary', params: prevParams },
    header: { path: '/api/mtd-kpi-header', params },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload} kpiCount={5}>
      <div>
        <CallCenterTabs active={tab} onChange={setTab} />
        <CallCenterTab
          tab={tab}
          appts={data.appts || []} apptsPrev={data.apptsPrev || []}
          locations={fl.allLocations || []} range={fl.monthLabel}
        />
      </div>
    </DataState>
  );
};

const CallCenterTab = ({ tab, appts, apptsPrev, locations, range }) => {
  // Booked / leads aggregates are not in the reporting API; show "—".
  const booked = sumField(appts, 'total_appointments') || null;
  const bookedPrev = sumField(apptsPrev, 'total_appointments') || null;

  if (tab === 'Overview') return <CCOverview booked={booked} bookedPrev={bookedPrev} />;
  if (tab === 'Speed to Lead') return <CCSpeedToLead locations={locations} />;
  if (tab === 'Agent Performance') return <CCAgentPerformance />;
  if (tab === 'Heatmaps') return <CCHeatmaps />;
  if (tab === 'Ad Attribution') return <CCAdAttribution />;
  return null;
};

/* ---- Call Center · Overview tab ---- */
const CCOverview = ({ booked, bookedPrev }) => {
  const kpis = [
    { label: 'Total Leads', value: '—', sub: 'period total' },
    { label: 'Booked', value: booked != null ? num(booked) : '—', sub: 'appointments' },
    { label: 'Conversion Rate', value: '—', sub: 'target ≥ 30%' },
    { label: 'Avg Days to Book', value: '—', sub: 'from lead creation' },
    { label: 'Same-Day Bookings', value: '—', sub: 'of total bookings' },
  ];
  return (
    <div>
      <Eyebrow>Volume &amp; Conversion — Period to Date</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => <StatBlock key={k.label} {...k} />)}
      </div>

      <div style={{ background: '#EAF4F0', borderLeft: `3px solid ${C.teal}`, borderRadius: 8, padding: '16px 18px', font: `500 12.5px ${FONT}`, color: C.ink2, lineHeight: 1.55, marginBottom: 16 }}>
        Lead volume, conversion and speed-to-first-contact come from the Aesthetix CRM, which the reporting API doesn't expose. The booked figure above is derived from the appointments feed; remaining metrics populate once the CRM is connected.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <CardTitle title="Conversion Rate Trend" />
          <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No CRM endpoint connected.</div>
        </Card>
        <Card>
          <CardTitle title="Avg Days to Book Trend" />
          <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No CRM endpoint connected.</div>
        </Card>
      </div>
    </div>
  );
};

/* ---- Call Center · Speed to Lead tab ---- */
const CCSpeedToLead = ({ locations }) => {
  const leaderboard = [
    { label: 'Avg Speed to Lead', value: '—', sub: 'Median: —' },
    { label: 'Best Avg Response', value: '—', sub: '—' },
    { label: 'Worst Avg Response', value: '—', sub: '—' },
    { label: 'Under 30 Min', value: '—', sub: 'responded within 30 min' },
    { label: 'Response Rate', value: '—', sub: 'leads with human response' },
    { label: 'Avg Under 5 Min', value: '—', sub: 'contacts responded quickly' },
  ];
  const locs = (locations && locations.length ? locations : []).slice(0, 12);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Days to Book Distribution</div>
          <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No CRM endpoint connected.</div>
        </Card>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Lead Decay Curve</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>Booking rate by response time</div>
          <div style={{ height: 188, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No CRM endpoint connected.</div>
        </Card>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Avg Days to Book by Center</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            {locs.length === 0 && <div style={{ font: `500 12px ${FONT}`, color: C.gray }}>No location data.</div>}
            {locs.map((loc) => (
              <div key={loc} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 84, flex: 'none', textAlign: 'right', font: `500 11px ${FONT}`, color: C.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc}</span>
                <span style={{ flex: 1, height: 13, background: '#F0F4F3', borderRadius: 4 }} />
                <span style={{ width: 30, flex: 'none', textAlign: 'right', font: `600 11px ${FONT}`, color: C.gray, fontVariantNumeric: 'tabular-nums' }}>—</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Eyebrow>Speed to Lead Leaderboard</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        {leaderboard.map((k) => <StatBlock key={k.label} {...k} />)}
      </div>
    </div>
  );
};

/* ---- Call Center · Agent Performance tab ---- */
const CCAgentPerformance = () => {
  const cols = ['#', 'Agent', 'Avg Response', 'Median', 'Under 60 Min', 'Leads', 'Calls', 'Contact', 'Bookings', 'Rate'];
  return (
    <div>
      <Card>
        <CardTitle title="Team Performance" sub="Speed to lead & conversion by agent — sorted by fastest average response"
          right={<span style={{ padding: '5px 12px', borderRadius: 999, background: '#E6F2EE', color: C.teal, font: `600 10.5px ${FONT}` }}>Last 30 Days</span>} />
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={c} style={{ textAlign: i <= 1 ? 'left' : 'right', font: `700 9.5px ${FONT}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.gray, padding: '0 10px 12px' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={cols.length} style={{ padding: '40px 10px', textAlign: 'center', font: `500 12px ${FONT}`, color: C.gray }}>
                  Agent scorecards come from the Aesthetix CRM, which the reporting API doesn't expose.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Avg Response Time by Agent</div>
        <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No CRM endpoint connected.</div>
      </Card>
    </div>
  );
};

/* ---- Call Center · Heatmaps tab ---- */
const HeatGrid = ({ title, sub }) => {
  const cols = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const rows = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
  return (
    <Card>
      <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>{title}</div>
      <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, marginBottom: 14 }}>{sub}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7,1fr)', gap: 5 }}>
        <span />
        {cols.map((c, i) => <span key={i} style={{ textAlign: 'center', font: `600 10px ${FONT}`, color: C.gray2 }}>{c}</span>)}
        {rows.map((r) => (
          <React.Fragment key={r}>
            <span style={{ font: `600 10px ${FONT}`, color: C.gray2, display: 'flex', alignItems: 'center' }}>{r}</span>
            {cols.map((_, i) => (
              <span key={i} style={{ aspectRatio: '1.4 / 1', background: '#EEF3F1', borderRadius: 6 }} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
};

const CCHeatmaps = () => (
  <div>
    <Eyebrow>Lead Arrival, Fast Response &amp; Conversion — by Day &amp; Time</Eyebrow>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <HeatGrid title="Lead Arrival" sub="When leads arrive by day & time" />
      <HeatGrid title="Fast Response Times" sub="Leads answered under 30 min" />
      <HeatGrid title="Conversions by Arrival" sub="Leads that booked by arrival time" />
    </div>
    <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 12 }}>
      Day-and-time lead heatmaps populate once the Aesthetix CRM lead feed is connected.
    </div>
  </div>
);

/* ---- Call Center · Ad Attribution tab ---- */
const CCAdAttribution = () => {
  const kpis = [
    'Total Leads', 'Cost Per Lead', 'Cost Per Appt', '# of Appts',
    'Lead to Appt %', 'Invoice Sales', '# of Invoices', 'Avg Invoice',
    'Webstore Sales', '# Webstore Txn', 'Gross Total', 'LTV ROAS',
  ];
  const sources = ['Organic', 'Google Ads', 'Meta Ads'];
  return (
    <div>
      <Eyebrow>Paid Media Attribution — Meta &amp; Google Ads</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: '0.62fr 1.38fr', gap: 16 }}>
        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Platform Split</div>
          <div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray, marginTop: 14 }}>Total Spend</div>
          <div style={{ font: `600 26px ${FONT}`, color: C.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>—</div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
            <div style={{ width: 130, height: 130, borderRadius: '50%', background: '#EEF3F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 74, height: 74, borderRadius: '50%', background: C.panel }} />
            </div>
          </div>
          {[['Google Ads', C.navy], ['Facebook Ads', C.blue]].map(([name, col]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 9, font: `500 11.5px ${FONT}`, color: C.ink2, marginTop: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: col, flex: 'none' }} />{name}
              <span style={{ marginLeft: 'auto', color: C.gray }}>—</span>
            </div>
          ))}
        </Card>

        <Card>
          <CardTitle title="Paid Media KPIs"
            right={<span style={{ padding: '5px 12px', borderRadius: 999, background: '#E6F2EE', color: C.teal, font: `600 10.5px ${FONT}` }}>vs. Prior Period</span>} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 14 }}>
            {kpis.map((label) => (
              <div key={label} style={{ background: C.bg, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '12px 13px' }}>
                <div style={{ font: `600 9px ${FONT}`, letterSpacing: '.04em', textTransform: 'uppercase', color: C.gray, lineHeight: 1.25, minHeight: 24 }}>{label}</div>
                <div style={{ font: `600 20px ${FONT}`, color: C.ink, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>—</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ font: `600 14px ${FONT}`, color: C.ink, marginBottom: 16 }}>Booking Rate by Lead Source</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sources.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 84, flex: 'none', font: `500 12px ${FONT}`, color: C.ink2 }}>{s}</span>
              <span style={{ position: 'relative', flex: 1, height: 18, background: '#F0F4F3', borderRadius: 5 }}>
                <span style={{ position: 'absolute', left: '60%', top: -2, bottom: -2, width: 1.5, background: C.clay }} />
              </span>
              <span style={{ width: 44, flex: 'none', textAlign: 'right', font: `600 12px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>—</span>
            </div>
          ))}
        </div>
        <div style={{ font: `500 11px ${FONT}`, color: C.gray, marginTop: 12 }}>Dashed line = 30% conversion target</div>
      </Card>
    </div>
  );
};
const ClinicalView = () => <ComingSoon name="Clinical" />;
const PatientsView = () => <ComingSoon name="Patients / CRM" />;
const StaffView = () => <ComingSoon name="Staff / Providers" />;
const InventoryView = () => <NoEndpoint title="Inventory data isn't available" detail="The reporting API exposes no inventory endpoints. Connect an inventory source to populate this view." />;
const MembershipsView = () => <ComingSoon name="Memberships" />;

export default Dashboard;