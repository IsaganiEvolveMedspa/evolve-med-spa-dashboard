import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';

/* =================================================================
   EVOLVE MED SPA — MASTER DASHBOARD
   Visual design reproduced from the approved spec: Schibsted Grotesk,
   palette #0F1B1A / #1E8C78 / #2FB6A0, 12-14px radii. Every number is
   wired to the live FastAPI; the spec's demo values are not used.
   ================================================================= */

const API_BASE = 'https://backend-production-0019.up.railway.app';

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
const LOGO_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALwAAAA8CAYAAADc+dBzAAAPL0lEQVR42u1dfYwV1RX/AbPBIe4GH/WhLHEpPuqauBZsXRtsS1JMilGS2lRbbUqb0kYTodY2JqWJttJGmtIWm2JbmuBnxAqN2AIRoyRiC8ZtBCMqWNfIKkt1K2vKGp5mHz39Y34Tjpd75+vNvAWck9zMe/Pm3rkfv3vuueeec944EUFJJX1UaHzZBSWVgC/pZCVhKqkEfEkllYAvqQR8SSWVgC+ppBLwJZ1QVCm7oAT8R4lGyy6Ip3HlwRNONbUkAIwru+Lk4fDiSADgtagONUcdvgxgKoBZLgYyhmBrT/GsfwLW6ZQE/JkJBuJpx2/DABpqsNp47ShgkF51/PYIgLcB9Bd88OMXCMwuAPWCxrfL+D6iPntjNOkKB3zUrP5PTF4PwDzHb2cAWMbBqiiZ9UiO9fYAHHb8/lWL6BBFbY72Jdlc1gF05wzMEIwDBa6WA1wdbdQAMEe9t97ESlA5FWT4KoAhzvx6BKiKEhl6AKwFcLHlt48D2J+x3CkADjm4eN0ykMNNTNjDMX3UBWCQ4CuCvIRlexQNB1v83lQcvmJ03MoIeVundRaufY76fB2vQ8bM/17MxkzL2+1NdFR47XGA/Z2EYL/MELEWsq7vOPrlCK9rFPetF7jc19iOUdVfecvYvWzTVjIwTZ2qrzsU2NuNOg4mxNVihatGYq4vImlSVew0n78vYvIcz002ygvzdVneNUNEtjjKeYPPXKjqhSaTiy4RkUkJy+gQkZstZfyKfbJSRJaJSI/jXZ6I1FR5PSJSSfjudlWO65nr+ftcEfGNvMixD3sSPDvPGDcb7RGRXta1U0SudjyXuI5pGmMDcVV12Bz1bKf6fJ2RZw0rPpO/z84IxO8owGdJXkS7Unckwe7KP9UAru6fNUaeq3n/SvXM3BwA7zOF1Gvpi2bSlY73u9odptuM9g84nquqdlRFZLORb22SdmTlgIjgrLqBehJ8X+Wvi8hEBXpXmswVIw9Aeg4Q7HGU/YsmVohJKeoQpmVG/yAFd0/K4edm7LskaSXL9RO2fZ7RZ8uMSWhbeSpGfojIiCpjOC3g2x0zMaRF/F7L0CE1CzAmMOnnlorIP0XkHyLSJyJ7RWRjDOgnZAS/a4l8RkSeFZHXReQFdX8c881SXB1NTMKoibMnZT4/pg7dlhW32bpebal31QF6E1N35lAPj5OgS5V1Z1Se8Ra9qac2FCvUJvEggM383J9hQ9PPjYU+tJkP4CiA2eredgAvATiL9djNzZCLNrOMJCrCitrkAMB6x/OfocYj7I/VrI/PDVeopz9sbKK/hebtYaby8wUAlue4oayzLf05HhBt5PV6Xl+h8qEeYfowD8BVAG5SWqys1KBWawDAn3jvJlUfHLd5Tiizz8+BG4xzyHttlHH1s1eQs/eJyAMiclBEnozg8ucleH9ngs13SI+JyFu8vi4in2O+NqMdUoCIMN/o+7U5cXib8mGZQ2GQdVWqJRDfqhaJIa80aPRBlSuAFyXDe+y81cw4kkEedSW9yfxRzACtEpH3RKRfRDbxue1NyvPtlo7RdFBEnhCRv4nIvSLylCq7TUSmq7LuUvk6chqwZQbwQ+rMGfCwKB6ypl7jvXETaKchelRz1BL5DkzU4gCPlJ3dLGe4xPLbNKolR8ndt4jIDm5M4kDvmowzRGRKRP57ReR2Av05pk9bVihY5Pq8UpcC4T6+4/4CAL9NPbsghzG8KmajHaoWzTp25dRvNcsE7OJ7Yzn8AmZYnUBb0J5RrJlIUSHcJLoGfytBvpXcPor+YGh40qg53xKRB8nhDxD8M41y2izlzCqIGfgisjgFiP0M4pXW/zcL+CRaJS3KeAX0WVjmakPFG6uWFHVAUclRXzsppsNcMu0uiiGjihO76CpHOeeIyFFHnvcprx9gelhEfqjynmnU/3nmW1rg6jcv5WFOUsB3p+j7uBQyoJV8f3uKyZH3wZeXZDKPjzEdHaEmYr6h3chqfHTE0Ap0AFgVk2cbgPtZj9/z++URmqJHHDv/tRGmFL+msdZG7vqv4b3zAExURm8V2ql8kt/fTmKvlFEDsZ3Xd3ldbDmuz0L7OHZdqm5ZDarO5TU06huJeHauRWtUtVhVNmthusBh0nCclmaOkueKOpxwcXDr8mOkXUo/vUFE1onI4YSb2K6I50ZE5HER2c3v+w0uiAyrUlF7HRRQL1MkmRMhtmpOvDbl+0K9+9aIw6ki+qzbxeF3GzPloRZZSX6T1xkxzy0C8BOuDl8BMF0ZnMVxIJfx17+po/d4FvAGzx72pWxDG05eJ4rXeN3D1W03+6NbnZWMEBcjCh/fTumPEHLe5QXa42s6mMRa0qelGwBcm9Bqrdn0Db5vyXHLz4dpEoANALYA6APwMA+d3o2wqnwtYrn+MX9brkxyf0frRZxA/qSdBQNjgTro0hN4H8Webbw3R2HkeoeTRxLL1B0twtU0vu+2KMDXxtAe/u0YE88+AHsBvMx6rqYJ7q0JfDxtdAe5Wi/Ngu9MCPa2FtjmmzK3Czx5mAzrvdAcJV938gQznHA7cczz7BZ+npriXWvGCFfb405aQ13p8oJlrIphsVhNuAvvEJEvUptyhLYur4rIIUlOQyJyn/q+S0TOTaGNGmsZ3s+pXlXLqbrez3k5qCLDNKROd1vVb36cLQ3U8n4rOW5eMqRv4VIdSvszlMBuIrRfeZwzd4COG320v0lCz1NOram9ylolyyKFR9A4JW4V5UHUa+HsecnAQ+wH3d5b1H6uEbFqPk0ty3BCh5UdamVtFdXNFXG8YbhUtYB/JOeXV1RnD6vNUVrV3h8J+neoOjwE4OcJJo0g8LiaC+C3BOtdGds0J2e/Wlt9n+XnBwpyzQvHZZZSDiRRf86zlBFFi9H6wFSeOXHHG5WuG5UvQqYfNgCzN4FMKhY/0d1syCCAmazrWwk45n7Kpc+oAU5Ln1Wd2tuiAVxUkPvfoGEBe0HEarvaskL4Gca9FdQN4KIoLU1dqZ2W8t6rOR12uDZbazIePBwC8B6CQ6v1BP6TAG6O4DYNannOp5j2MoDfUMMyIaUIEy7PT1CcquUg7nkJNTP1gtSXFQA3WDQbul438jpdvS+LeLUNLvPdfFS4uzlG++PUklU2YKtjZlYTgNiP0Ag0jHIubpJrvUaxZj2XzFGlL9b0Z8r7H+NvjyM4VX2T7T2KdJG9gMD2O+SQ/dxLaJqoPk9IIFY0FGcapP67lZHEhtWe6vaY/cxgRlE33Ot8wVgl8gL7CFWps11lj7csUaFe+RL1uctyyFB1dEg9wgEEHMgOcts8aAcB/wHTm9yYanXbPWzHJwD8F8DdnNTS5JIJpe/dA2Cy+v0D9floTHgS31BDVgwu2AqaiyAShTleVUM9elkT5XfimKPGWmNVajYY7IhxyPioqruXNC6N9nbqdkSSyrKRugXAL3PmXtciOCV9iXWdzAkcBj+qI9ChPwjgpxEBl9IM4GIcO3HU7TidIhcyBkwayMDdk8SliROrwiBXYRyd8xXQ81xtRJU/kIPWKYxppME83Rb3JiouzQrVuGnkinoj28gI9poC+xQOVB6hnh9CcHg1kdyxDcFhyYts5wdUpa3PAexg2YuNQZypwBNy+2sSDJZvRO8SNWhLWqjCW2CIsHXjuqWJQy/Pshfaiw+7MXZaREMkVK9WjfIHrfuaBIZd+qBhpzqM6EzhYWRz3F2XY4iIMF3KQ6Sf0WlkHx0dNrHuiwo+GNKHPrNpkhzXP76jrDUx4S2yRC1IeiAIZegVZaLsZTDh9SxtnU/b/yxY6GGUB+2w1JUmTEfFOKWqWGK36Dgpy2NskzsNC0xR76gWAL7baf24UURepF/sUyJyd47eNWY6nb6v2nPKjFkT561ji03jpeinZgHvRZymZomikPQUVByTPImP8kojfy0uWoLNwyhNUCQdHKc9gY+hqAhYfs4uXmE6jSE2dpLL7yaHv7nAI+yZFj9dUZMhKu+IkafdcNTolvzi0iTxT4XhXmiWWcl5Va5YMLIiQ6S43COP2ZyLbVR33F+hvHhake5Qjtmfb8H7uhP2j4v6DN9Sr0mbm2Y9ijQQB1vQfxsy9tvSokLtRUWbctFmgtwvyIcRMVG21rXYWKnC93ZaHIpttNJwcG7Widnm9FBpov/0ZCy678IATqfTNzmKMhs25hEu26cqbV/WEMYFUi9364Nj8O5O6v6HY/qhwj4czPlEe4bSpXdncGoJ8/UicLFsNZnhxG2hxFNjLA3gmwGw3yIvlxOBPKpE6wb4BxPESG9nXw01oYvuJDDqLK+eYtw8419WxmrMJhiHdfOOs2tH+admJzpFTfou9c8ceZlh11uw2trK9ZlGLQeVjRQuk9UiVuYS8Bjz/1atF8hJ06ysJ/IqXFOxPusl4E9u7n6ytSOcpMMOM5PQsac9B5+KSUjua3AagPfTmuuWVKznTSv2D42C/4erRhAPW/6q5iIEkYGv5F6iD4GR2KMITD98cuo+BNaqeyPe9XUEf4d0GIFh3koEpg/XsextAO7DMWOxJcpytR8O5/4S8KcWFa0VGwDwdwQ2SxcrC9ofUGa/EYHt0IX8XuGzC/Fhs+AzAHyXE2AXjnfuuR/AXwBcwXvPIfCdqBP8ywj6hQgiTZyGINzLIpbZKP96vqS8aD+58wwcU/32K9PxCsWQURWZbRMCXwQok/NVsEc9OITAfbMB4Gze+xTv76S2Zj8n3w6lxbkDx3xxR0qRpiTk6Pi9gaLLKgCXEvChiPM1w7l+L4L4QXWlcmwQ9F8C8C8+rx13HkNgdr1QgfsVBCbZNzD9D8E/RIYrWw/rdrkKKXLc/qkEfEnI+E/lPeTqvtL5A8BfydHXKRl9VIHuKFNFceOGRTTbhCAy3NkInE7CKHGrATxlPL8cwcHaXO4nejnZjts/lSJNScgYVnCIQNxFQIcizQZy+xd4f1RNhIpxmLRBcfURY3N8IT+fhcBR5DACH4NzuAeAEWxpCQJvqvB/gX1bCMSSw5eUlvYokFUoR3co+RkInOn3UNTZzw3mEgQh+jYzz/lGjBqtVvS5glykDrKg9PDvWpyVwvOM9RR56qUevqQ86FIF8tA04ohlFZgK4ACSHywdsOjRpykzi4ZD9Ro6b89QKsoeNTFLwJeUK02hBqVNBboCAvfEA449QBvFnhkRkZ01nRERNNd2BuGXHL6kkspNa0kfNfo/ufdyQRXKhXwAAAAASUVORK5CYII=";
const money = (v, { compact = false, decimals, floor = false } = {}) => {
  const x = n(v); if (x === null) return '—';
  // floor: truncate to `decimals` instead of rounding (so values never round up).
  const fx = (val, d) => (floor ? (Math.floor(val * 10 ** d) / 10 ** d) : val).toFixed(d);
  if (compact) {
    const a = Math.abs(x);
    if (a >= 1e6) return `$${fx(x / 1e6, decimals ?? 2)}M`;
    if (a >= 1e3) return `$${fx(x / 1e3, decimals ?? 0)}K`;
    return `$${fx(x, decimals ?? 0)}`;
  }
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: decimals ?? 0 })}`;
};
// Backend returns every rate already as a percentage (0-100), so DO NOT rescale.
// The old "abs(x) <= 1 ? x*100 : x" heuristic wrongly multiplied genuine sub-1%
// values (e.g. a 0.18% membership-adoption rate) up to 18.3%.
const pctScale = (v) => n(v);
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
// Previous-month range for the given start_date (used for MoM deltas). The prior
// window ends on the SAME elapsed day-of-month as the current period's end date
// (clamped to the prior month's length) so MTD compares like-for-like — e.g. if
// today is Jul 6 the prior window is Jun 1–6, not all of June. Falls back to the
// full prior month when endDate is omitted.
const prevMonthRange = (startDate, endDate) => {
  if (!startDate) return { start: undefined, end: undefined };
  const d = new Date(startDate);
  const y = d.getFullYear(), m = d.getMonth() - 1;
  const py = m < 0 ? y - 1 : y, pm = (m + 12) % 12;
  if (!endDate) return { start: firstOf(py, pm), end: lastOf(py, pm) };
  const endDay = Number(String(endDate).slice(8, 10));   // "YYYY-MM-DD" -> DD
  const lastDayPrev = new Date(py, pm + 1, 0).getDate();  // clamp short months (e.g. Feb)
  const day = Math.min(endDay || lastDayPrev, lastDayPrev);
  const end = `${py}-${String(pm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { start: firstOf(py, pm), end };
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

// Small KPI card used across grids. When a goal prop is present, the card splits
// into two columns — the metric value (with its MoM delta below) beside the goal
// target (with "% to goal" below) — all in the one card.
const KpiCard = ({ label, value, delta, deltaColor, accent, goal, goalDelta, goalDeltaColor, def }) => (
  <div style={{ background: C.panel, border: `1px solid ${accent ? C.teal : C.line}`, borderRadius: 12, padding: '12px 13px', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', textAlign: 'center', font: `600 10.5px ${FONT}`, letterSpacing: '.04em', textTransform: 'uppercase', color: accent ? C.teal : C.gray, lineHeight: 1.3, minHeight: 28 }}>
      <span>{label}</span><InfoDot def={def} />
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 16, marginTop: 8 }}>
      {/* value + delta, delta centered under the (usually wider) value */}
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
        <span style={{ font: `600 27px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {delta != null && <span style={{ font: `600 12px ${FONT}`, color: deltaColor || C.green, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{delta}</span>}
      </span>
      {goal != null && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <span style={{ font: `500 13px ${FONT}`, color: C.gray, fontVariantNumeric: 'tabular-nums' }}>vs. goal {goal}</span>
          {goalDelta != null && <span style={{ font: `600 12px ${FONT}`, color: goalDeltaColor || C.gray, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{goalDelta}</span>}
        </span>
      )}
    </div>
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

// Small "?" affordance with a styled hover popover. Renders nothing when no
// definition is supplied. Tooltip CSS lives in the global <style> block (.ev-info).
// "?" affordance with a JS-positioned tooltip. The tooltip renders as a
// position:fixed element (escapes the scroll container's overflow clipping) and
// is clamped to the viewport, so it's never cut off. It prefers opening above;
// when there isn't room above (e.g. the top hero row) it opens to the side so it
// never covers the value beneath the label. `down`/`right`/`left` props are
// accepted but ignored — placement is automatic.
const InfoDot = ({ def }) => {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  if (!def) return null;
  const W = 240;
  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const clampX = (x) => Math.max(8, Math.min(x, vw - W - 8));
    if (r.top >= 84) {
      setTip({ left: clampX(r.left + r.width / 2 - W / 2), top: r.top - 8, t: 'translateY(-100%)' });
    } else if (r.right + 8 + W <= vw - 8) {
      setTip({ left: r.right + 8, top: r.top + r.height / 2, t: 'translateY(-50%)' });
    } else {
      setTip({ left: Math.max(8, r.left - 8 - W), top: r.top + r.height / 2, t: 'translateY(-50%)' });
    }
  };
  return (
    <span ref={ref} className="ev-info" onMouseEnter={show} onMouseLeave={() => setTip(null)}>?
      {tip && (
        <span style={{ position: 'fixed', left: tip.left, top: tip.top, width: W, transform: tip.t,
          background: '#12332E', color: '#EAF3F0', font: `500 11px ${FONT}`, lineHeight: 1.45, textAlign: 'left',
          padding: '9px 11px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.22)', zIndex: 2000,
          whiteSpace: 'normal', pointerEvents: 'none' }}>{def}</span>
      )}
    </span>
  );
};

// KPI definitions (source: Evolve_Dashboard_Metric_Computations.docx). Shown in
// the "?" hover popovers on the Overview so the whole team sees each calculation.
const DEFS = {
  cashSales: 'Cash Sales (MTD): sum of cash collected excluding tax, month-to-date (cash payment types only).',
  cashRunRate: 'Cash Run Rate (Projected): per location, MTD cash ÷ working days elapsed × total working days in the month, summed across locations. Working days come from the Operating Schedule; elapsed counts through the latest data date.',
  projRunRate: 'Proj. Run Rate: the cash run rate — MTD cash ÷ working days elapsed × total working days in the month.',
  fullMonthBudget: 'Full-Month Budget: the monthly budget target for the selected month (chain, or the selected locations).',
  budgetPct: '% to Budget: MTD cash sales ÷ full-month budget × 100.',
  priorDay: 'Prior Day Sales: net (accrual) sales on the latest closed sale day.',
  sss: 'SSS Growth YoY %: (current-year MTD cash − prior-year same-period cash) ÷ prior-year × 100, over same-store locations only.',
  aspNew: 'ASP (New): non-membership MTD sales of new customers ÷ New Customer Visits (sales accrual, per customer).',
  aspExisting: 'ASP (Existing): non-membership MTD sales of existing customers ÷ Existing Customer Visits (sales accrual, per customer).',
  cogs: 'COGS Margin %: cost of goods ÷ net sales (sales excluding tax) × 100.',
  payroll: 'Payroll Margin %: modeled salary (hourly wage × scheduled hours + FFS + 15% commission on commissionable sales + 12.5% benefits) ÷ net sales × 100.',
  gm: 'Gross Margin %: 100 − COGS Margin % − Payroll Margin % (real salary model).',
  newCust: 'New Customer Visits: distinct guests whose first-ever sale falls in the month and whose first purchase is non-membership (sales accrual).',
  existingCust: 'Existing Customer Visits: distinct guests with a sale this month whose first-ever sale was before this month, non-membership first purchase.',
  adSpend: 'MTD Ad Spend: Google + Facebook ad spend for the month (chain-level, bundled export).',
  cac: 'CAC (Client Acquisition Cost): MTD ad spend ÷ new customers.',
  returnRate: 'New Guest Return Rate · 90 Day: matured new guests who returned within 90 days ÷ matured new guests × 100.',
  noShow: 'No-Show Rate: appointments where the client did not arrive and did not cancel ÷ total appointments.',
  cancel: 'Cancellation Rate: visits cancelled by the client ÷ total appointments.',
  membership: 'Membership Adoption: new memberships (Zenoti export, Sale Type = Sale) ÷ non-member unique guests × 100.',
  utilProvider: 'Utilization · Provider: booked hours ÷ (scheduled − paid block-out hours) × 100, for Treatment Providers.',
  utilEsth: 'Utilization · Esthetician: booked hours ÷ (scheduled − paid block-out hours) × 100, for Estheticians.',
  revProvider: 'Rev / Hr · Provider: sales (excl. tax) by Treatment-Provider employees ÷ their booked hours.',
  revEsth: 'Rev / Hr · Esthetician: sales (excl. tax) by Esthetician employees ÷ their booked hours.',
  rebook: 'Rebook Rate: distinct closed invoices that rebooked before leaving ÷ distinct closed invoices × 100.',
  recRev: 'Recognized Revenue (MTD): sum of net sales including tax (accrual basis).',
  recRunRate: 'Run Rate · Recognized Revenue: recognized revenue projected to the full month on the same working-day run-rate basis as cash.',
  recRunRateLoc: 'Run Rate Rec. Rev (per location): recognized revenue scaled by the location’s cash run-rate multiplier (Proj. Run Rate ÷ Cash MTD) — an approximation, since recognized run rate is computed chain-level.',
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
  { id: 'Inventory', label: 'Inventory', group: ['Analytics Overview', 'Inventory Turnover', 'Consumption & WOS', 'Cost per Unit', 'Costing Sheet', 'System vs Purchase Cost', 'PO Matching', 'Inventory Movement', 'Transfers', 'True-Ups'] },
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
    'Analytics Overview': 'Control-tower of cost integrity & inventory performance · Zenoti',
    'Inventory Turnover': 'Annualized turns, slow & dead stock by category and site · Zenoti',
    'Consumption & WOS': 'Demand, forecast & weeks-of-supply coverage · Zenoti',
    'Cost per Unit': 'Weighted unit cost, movers & cost changes · Zenoti',
    'Costing Sheet': 'Average unit cost by product · Zenoti',
    'System vs Purchase Cost': 'System cost vs latest purchase price · Zenoti',
    'PO Matching': 'Three-way match: ordered · received · invoiced · Zenoti',
    'Inventory Movement': 'Opening → purchases → consumption → closing roll-forward · Zenoti',
    'Transfers': 'Inter-site transfers & discrepancies · Zenoti',
    'True-Ups': 'Zenoti inventory-adjustment trends & flagged corrections · Zenoti',
  }[view] || range;
};

const TITLE = (view) => ({
  'Acquisition': 'Marketing · Acquisition',
  'Call Center': 'Call Center',
  'Overview': 'Business Overview',
  'Analytics Overview': 'Cost & Inventory Analytics · Overview',
  'Inventory Turnover': 'Cost & Inventory Analytics · Inventory Turnover',
  'Consumption & WOS': 'Cost & Inventory Analytics · Consumption & Weeks of Supply',
  'Cost per Unit': 'Cost & Inventory Analytics · Cost per Unit',
  'Costing Sheet': 'Inventory · Costing Sheet',
  'System vs Purchase Cost': 'Cost & Inventory Analytics · System vs Purchase Cost',
  'PO Matching': 'Cost & Inventory Analytics · PO Matching',
  'Inventory Movement': 'Cost & Inventory Analytics · Inventory Movement',
  'Transfers': 'Cost & Inventory Analytics · Transfers',
  'True-Ups': 'Cost & Inventory Analytics · True-Ups',
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
    'Memberships': <MembershipsView />,
    'Analytics Overview': <InvAnalyticsView onNavigate={(v) => { setActiveView(v); setOpenGroups((g) => ({ ...g, Inventory: true })); }} />,
    'Inventory Turnover': <InvTurnoverView />,
    'Consumption & WOS': <InvConsumptionView />,
    'Cost per Unit': <InvCostPerUnitView />,
    'Costing Sheet': <InvCostingSheetView />,
    'System vs Purchase Cost': <InvSystemCostView />,
    'PO Matching': <InvPOMatchingView />,
    'Inventory Movement': <InvMovementView />,
    'Transfers': <InvTransfersView />,
    'True-Ups': <InvTrueUpsView />,
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
        .ev-info{position:relative;display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-left:4px;border-radius:50%;border:1px solid #B7C6C1;color:#7C8F8A;font:700 9px ${FONT};line-height:1;cursor:help;vertical-align:middle;letter-spacing:0;text-transform:none;flex:none;}
        .ev-info:hover{border-color:${C.teal};color:${C.teal};}
      `}</style>
      <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', fontFamily: FONT, background: C.bg, color: C.ink }}
           onClick={() => { setLocOpen(false); setMonthOpen(false); }}>

        {/* SIDEBAR */}
        <aside style={{ width: 236, flex: 'none', background: C.sidebar, color: C.sideText, display: 'flex', flexDirection: 'column', padding: '22px 0', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 22px 26px' }}>
            <img src={LOGO_SRC} alt="Evolve Med Spa" style={{ height: 44, width: 'auto' }} />
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
  const rightLabels = [1, 0.75, 0.5, 0.25, 0].map((t) => money(maxCum * t, { compact: true }));

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
      <g style={{ font: `600 9px ${FONT}`, fill: C.gray2 }} textAnchor="middle">
        {arr.map((d, idx) => { const p = String(d?.day ?? '').slice(0, 10).split('-'); if (p.length !== 3) return null; const dt = new Date(+p[0], (+p[1] || 1) - 1, +p[2]); if (idx !== 0 && dt.getDay() !== 1) return null; return <text key={idx} x={xAt(idx)} y={padT + innerH + 16}>{`${MONTHS[(+p[1] || 1) - 1]} ${+p[2]}`}</text>; })}
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
const HeroCard = ({ label, mtd, mtdDelta, proj, projDelta, extraLabel, extra, labelDef, projDef, extraDef }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', font: `600 12px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>{label}<InfoDot def={labelDef} right /></div>
    <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 16 }}>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={{ font: `600 11px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>MTD</div>
        <div style={{ font: `600 34px ${FONT}`, color: C.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{mtd}</div>
        {mtdDelta && <div style={{ font: `600 12.5px ${FONT}`, color: mtdDelta.color, marginTop: 4 }}>{mtdDelta.text}</div>}
      </div>
      {extra != null && (
        <>
          <div style={{ width: 3, background: C.line2, margin: '4px 20px', borderRadius: 2, flex: 'none' }} />
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', font: `600 11px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>{extraLabel}<InfoDot def={extraDef} right /></div>
            <div style={{ font: `600 34px ${FONT}`, color: C.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{extra}</div>
          </div>
        </>
      )}
      <div style={{ width: 3, background: C.line2, margin: '4px 20px', borderRadius: 2, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', font: `600 11px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>Projected · Run Rate<InfoDot def={projDef} left /></div>
        <div style={{ font: `600 34px ${FONT}`, color: C.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{proj}</div>
        {projDelta && <div style={{ font: `600 12.5px ${FONT}`, color: projDelta.color, marginTop: 4 }}>{projDelta.text}</div>}
      </div>
    </div>
  </div>
);

const OverviewView = () => {
  const fl = useFilters();
  const params = { start_date: fl.start_date, end_date: fl.end_date, locations: fl.locations };
  const prev = prevMonthRange(fl.start_date, fl.end_date);
  const prevParams = { start_date: prev.start, end_date: prev.end, locations: fl.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    summary: { path: '/api/mtd-summary', params },
    ops: { path: '/api/operations-summary', params },
    categories: { path: '/api/category-breakdown', params },
    svcMix: { path: '/api/service-mix', params },
    products: { path: '/api/product-mix', params },
    daily: { path: '/api/mtd-daily-trend', params },
    headerPrev: { path: '/api/mtd-kpi-header', params: prevParams },
    appts: { path: '/api/appointments/summary', params },
    apptsPrev: { path: '/api/appointments/summary', params: prevParams },
    retention: { path: '/api/new-guest-return-rate', params },
    retentionPrev: { path: '/api/new-guest-return-rate', params: prevParams },
  }, [JSON.stringify(params)]);

  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload}>
      <OverviewBody h={data.header || {}} hPrev={data.headerPrev || {}} summary={data.summary || []} ops={data.ops || []} categories={data.categories || []} svcMix={data.svcMix || []} products={data.products || []} daily={data.daily} appts={data.appts || []} apptsPrev={data.apptsPrev || []} retention={data.retention || []} retentionPrev={data.retentionPrev || []} range={fl.monthLabel} />
    </DataState>
  );
};

const MEDAL = { 0: '#D4AF37', 1: '#9AA7A3', 2: '#C77B5A' };
const Medal = ({ color }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" style={{ display: 'block' }}>
    <path fill={color} d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
);

const OverviewBody = ({ h, hPrev, summary, ops, categories, svcMix, products, daily, appts, apptsPrev, retention, retentionPrev, range }) => {
  const [drillSeg1, setDrillSeg1] = useState(null);   // Service Mix drill: null = sub-segment 1, else show sub-segment 2 within this segment
  // ---- hero cards ----
  // R32: Cash Sales (MTD) = cumulative cash-basis sales (from FULL_CASH via mtd-kpi-header)
  const cashMtd = n(h.mtd_revenue);
  // R53: Recognized Revenue = accrual-basis (from FULL_SALES via operations-summary)
  // Sum per-location recognized_revenue; fall back to cash if ops unavailable.
  const recRev = ops.reduce((a, o) => a + (n(o.recognized_revenue) || 0), 0) || cashMtd;
  // projected run-rate from daily trending if available
  const trending = n(daily?.trending);
  // R49: PY Variance % = (MTD - PY) / PY * 100
  const yoy = h.same_store_yoy;

  // Revenue MoM (current vs prior month) — the hero-card delta is always
  // month-over-month (vs the prior calendar month), never YoY. Null when the
  // prior month has no revenue (momPctDelta guards prv === 0 / missing).
  const cashMom = momPctDelta(h.mtd_revenue, hPrev.mtd_revenue);
  const heroDelta = cashMom;

  // Goal props merged INTO a metric card: the target renders beside the metric's
  // value, with "% to goal" beneath it (and the MoM delta beneath the value).
  // Returns null when no goal is defined (chain view, or a month with no goals),
  // so the caller keeps the plain single-column card. A 0 goal (a filtered
  // location with no goal) still renders as "0" with no % to measure against.
  const goalProps = (actual, goalVal, fmt) => {
    const g = n(goalVal);
    if (g == null) return null;
    const a = n(actual);
    const pct = (a != null && g !== 0) ? (a / g) * 100 : null;
    return {
      goal: fmt(g),
      goalDelta: pct != null ? `${pct >= 100 ? '▲' : '▼'} ${pct.toFixed(0)}% to goal` : null,
      goalDeltaColor: pct != null ? (pct >= 100 ? C.green : C.clay) : null,
    };
  };

  // ---- FINANCIAL group ----
  // R37: % to Goal MTD = MTD Cash Sales ÷ Monthly Budget
  const budgetPaceVal = (() => {
    const b = n(h.monthly_budget), r = n(h.mtd_revenue);
    if (!b || r === null) return null;
    return (r / b) * 100;
  })();
  // R59: COGS Margin % = total COGS ÷ sales accrual (real, from BRONZE_ZENOTI_COST_OF_GOODS)
  const cogsMargin = h.cogs_margin_pct != null ? pctScale(h.cogs_margin_pct) : null;
  const cogsMarginPrev = hPrev.cogs_margin_pct != null ? pctScale(hPrev.cogs_margin_pct) : null;
  const financial = [
    { label: '% to Budget · Variance to Goal', def: DEFS.budgetPct, value: budgetPaceVal != null ? `${budgetPaceVal.toFixed(0)}%` : '—',
      delta: budgetPaceVal != null ? `${budgetPaceVal >= 100 ? '▲' : '▼'} ${Math.abs(100 - budgetPaceVal).toFixed(0)}% to goal` : null,
      deltaColor: budgetPaceVal >= 100 ? C.green : C.clay },
    // R49: SSS Growth YoY %
    { label: 'SSS Growth YoY %', def: DEFS.sss, value: pct(yoy), ...spread(arrowDelta(yoy)) },
    // R02: Prior Day Sales — MoM delta compares yesterday's cash sales against
    // the equivalent prior-day figure from the prior-month header window.
    { label: 'Prior Day Sales', def: DEFS.priorDay, value: money(h.yesterday_revenue, { compact: true }), ...spreadOrNull(momPctDelta(h.yesterday_revenue, hPrev.yesterday_revenue)) },
    // R18: ASP (New) = Cash Sales (New) less Recurring ÷ New Customers
    { label: 'ASP (New)', def: DEFS.aspNew, value: money(h.asp_new_clients),
      ...spreadOrNull(momPctDelta(h.asp_new_clients, hPrev.asp_new_clients)),
      ...goalProps(h.asp_new_clients, h.asp_new_goal, (v) => money(v)) },
    // R19: ASP (Existing) = Cash Sales (Existing) less Recurring ÷ Existing Customers
    { label: 'ASP (Existing)', def: DEFS.aspExisting, value: money(h.asp_existing_clients),
      ...spreadOrNull(momPctDelta(h.asp_existing_clients, hPrev.asp_existing_clients)),
      ...goalProps(h.asp_existing_clients, h.asp_existing_goal, (v) => money(v)) },
    // R59: COGS Margin = COGS ÷ Revenue (est. — lower is better, so invert delta color)
    { label: 'COGS Margin %', def: DEFS.cogs, value: pct(cogsMargin), ...spreadOrNull(momPtDelta(cogsMargin, cogsMarginPrev, { invert: true })) },
    // R60: Payroll Margin = Salary ÷ Sales Accrual (real salary model; lower is better)
    { label: 'Payroll Margin %', def: DEFS.payroll, value: h.payroll_margin_pct != null ? pct(h.payroll_margin_pct) : '—', ...spreadOrNull(momPtDelta(h.payroll_margin_pct, hPrev.payroll_margin_pct, { invert: true })) },
  ].filter(Boolean);

  // ---- OPERATIONAL group ----
  // No-show / cancellation rates from appointments/summary (chain aggregate).
  // R29: No-Shows = client didn't arrive and didn't cancel
  // R30: Cancellations = visits cancelled by client
  const sumA = (arr, f) => arr.reduce((a, r) => a + (n(r[f]) || 0), 0);
  const totA = sumA(appts, 'total_appointments');
  const noShowRate = totA ? (sumA(appts, 'no_shows') / totA) * 100 : null;
  const cancelRate = totA ? (sumA(appts, 'cancellations') / totA) * 100 : null;
  const totAPrev = sumA(apptsPrev, 'total_appointments');
  const noShowRatePrev = totAPrev ? (sumA(apptsPrev, 'no_shows') / totAPrev) * 100 : null;
  const cancelRatePrev = totAPrev ? (sumA(apptsPrev, 'cancellations') / totAPrev) * 100 : null;

  const operational = [
    { label: 'No-Show Rate', def: DEFS.noShow, value: noShowRate != null ? `${noShowRate.toFixed(1)}%` : '—', ...spreadOrNull(momPtDelta(noShowRate, noShowRatePrev, { invert: true })) },
    { label: 'Cancellation Rate', def: DEFS.cancel, value: cancelRate != null ? `${cancelRate.toFixed(1)}%` : '—', ...spreadOrNull(momPtDelta(cancelRate, cancelRatePrev, { invert: true })) },
    // R52: Membership Adoption = New Memberships ÷ Non-Member Visits.
    // Value uses the backend-computed rate (membership_adoption_rate); MoM delta
    // is a point change vs the prior-month rate (it's a percentage metric).
    { label: 'Membership Adoption', def: DEFS.membership, value: pct(h.membership_adoption_rate), ...spreadOrNull(momPtDelta(h.membership_adoption_rate, hPrev.membership_adoption_rate)) },
    // R66: Rev/Hr Provider = provider revenue ÷ provider utilized hours
    { label: 'Rev / Hr · Provider', def: DEFS.revProvider, value: money(h.rev_per_provider, { compact: true }), ...spreadOrNull(momPctDelta(h.rev_per_provider, hPrev.rev_per_provider)) },
    // R67: Rev/Hr Esthetician = esthetician revenue ÷ esthetician hours
    { label: 'Rev / Hr · Esthetician', def: DEFS.revEsth, value: money(h.rev_per_esthetician, { compact: true }), ...spreadOrNull(momPctDelta(h.rev_per_esthetician, hPrev.rev_per_esthetician)) },
    // R68: Provider Utilization = service hours ÷ scheduled hours
    { label: 'Utilization · Provider', def: DEFS.utilProvider, value: pct(h.provider_utilization), ...spreadOrNull(momPtDelta(h.provider_utilization, hPrev.provider_utilization)) },
    // R69: Esthetician Utilization = esthetician hours ÷ available hours
    { label: 'Utilization · Esthetician', def: DEFS.utilEsth, value: pct(h.esthetician_utilization), ...spreadOrNull(momPtDelta(h.esthetician_utilization, hPrev.esthetician_utilization)) },
    // R70: Rebooking Rate = % completed appts where client rebooked before leaving
    { label: 'Rebook Rate %', def: DEFS.rebook, value: pct(h.rebooking_rate), ...spreadOrNull(momPtDelta(h.rebooking_rate, hPrev.rebooking_rate)) },
  ];

  // ---- MARKETING group ----
  // R11/R64: New Customers = first closed invoice >$0 in center (Power BI authoritative)
  const newVisits = h.new_visits != null ? h.new_visits : h.new_client_count;
  const newVisitsPrev = hPrev.new_visits != null ? hPrev.new_visits : hPrev.new_client_count;

  // New Guest Return Rate · 90 Day — chain-wide matured-cohort rate from
  // /api/new-guest-return-rate. Rate = (returned within 90d) / (matured new guests) × 100.
  // Stays "—" until the retention endpoint is deployed.
  const retRate90 = (rows) => {
    const num90 = rows.reduce((a, r) => a + (n(r.matured_returned_90d) || 0), 0);
    const den90 = rows.reduce((a, r) => a + (n(r.matured_new_guests) || 0), 0);
    return den90 ? (num90 / den90) * 100 : null;
  };
  const returnRate = retRate90(retention || []);
  const returnRatePrev = retRate90(retentionPrev || []);

  const marketing = [
    { label: 'New Customer Visits', def: DEFS.newCust, value: num(newVisits),
      ...spreadOrNull(momPctDelta(newVisits, newVisitsPrev)),
      ...goalProps(newVisits, h.new_customers_goal, (v) => num(v)) },
    // R12/R65: Existing Customers = guests with prior purchase + payment >$0
    { label: 'Existing Customer Visits', def: DEFS.existingCust, value: num(h.existing_client_count),
      ...spreadOrNull(momPctDelta(h.existing_client_count, hPrev.existing_client_count)),
      ...goalProps(h.existing_client_count, h.existing_customers_goal, (v) => num(v)) },
    // R: MTD Ad Spend = SUM(Google + FB ad spend) for the month (chain-level, bundled export)
    { label: 'MTD Ad Spend', def: DEFS.adSpend, value: h.mtd_ad_spend != null ? money(h.mtd_ad_spend, { compact: true }) : '—', ...spreadOrNull(momPctDelta(h.mtd_ad_spend, hPrev.mtd_ad_spend)) },
    // R: Client Acquisition Cost = MTD Ad Spend / New Customers
    { label: 'CAC', def: DEFS.cac, value: h.client_acquisition_cost != null ? money(h.client_acquisition_cost) : '—', ...spreadOrNull(momPctDelta(h.client_acquisition_cost, hPrev.client_acquisition_cost, { invert: true })) },
    // 90-day return rate: matured cohort, wired to /api/new-guest-return-rate
    { label: 'New Guest Return Rate · 90 Day', def: DEFS.returnRate, value: returnRate != null ? pct(returnRate) : '—', ...spreadOrNull(momPtDelta(returnRate, returnRatePrev)) },
  ].filter(Boolean);

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

  // ---- service vs product classification ----
  // category-breakdown has no item_type, so classify by item_category: anything
  // under "Retail" is a product; Memberships is neither (recurring plan, excluded
  // from both mixes); everything else is a service.
  const isProductCat = (c) => /^retail/i.test((c.item_category || '').trim());
  const productCats = categories.filter((c) => isProductCat(c));

  // ---- service mix donut: sub-segment 1 (item_category) -> drill to sub-segment 2 (item_sub_category) ----
  // svcMix rows: { segment1, segment2, revenue }. Level 1 groups by segment1; drilling into
  // a segment shows its segment2 breakdown.
  const svcRows = (svcMix && svcMix.length)
    ? (drillSeg1 ? svcMix.filter((r) => r.segment1 === drillSeg1) : svcMix)
    : [];
  const svcKey = drillSeg1 ? 'segment2' : 'segment1';
  const svcAgg = {};
  svcRows.forEach((r) => { const k = r[svcKey] || 'Other'; svcAgg[k] = (svcAgg[k] || 0) + (n(r.revenue) || 0); });
  const svcSorted = Object.entries(svcAgg).map(([label, revenue]) => ({ label, revenue })).sort((a, b) => b.revenue - a.revenue);
  const totalCat = svcSorted.reduce((a, c) => a + c.revenue, 0) || 1;
  const topCats = svcSorted.slice(0, 5);
  const otherSum = svcSorted.slice(5).reduce((a, c) => a + c.revenue, 0);
  const donutColors = [C.teal, C.tealBright, C.tealLite, C.tealPale, C.clayLite, '#C9D6D2'];
  const serviceMix = [
    ...topCats.map((c, i) => ({ label: c.label, pct: Math.round((c.revenue / totalCat) * 100), color: donutColors[i] })),
    ...(otherSum > 0 ? [{ label: 'Other', pct: Math.round((otherSum / totalCat) * 100), color: donutColors[5] }] : []),
  ];
  let acc = 0; const stops = serviceMix.map((s) => { const start = acc; acc += s.pct * 3.6; return `${s.color} ${start}deg ${acc}deg`; }).join(',');
  // donut center = the top slice (largest share) at the current level
  const topSlice = serviceMix[0] || { label: '—', pct: 0 };

  // ---- product mix (unit consumption, by PRODUCT NAME, from /api/product-mix) ----
  // pv(): units for the product feed (Dysport already /3 server-side), count for the fallback.
  const pv = (p) => (p.units != null ? n(p.units) : n(p.count)) || 0;
  const byCount = (products && products.length
    ? [...products].sort((a, b) => pv(b) - pv(a))
    : [...productCats].sort((a, b) => (n(b.count) || 0) - (n(a.count) || 0))
  ).slice(0, 7);
  const maxCount = Math.max(...byCount.map((c) => pv(c)), 1);

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

  // Single projected run rate (working-days, cash-based) shared by both hero cards
  // and the Sales-to-Budget table so the "Projected · Run Rate" always matches.
  const projRunRate = h.cash_run_rate ?? trending ?? (mtdActual && daysInMonth ? (mtdActual / Math.max(dailyArr.length, 1)) * daysInMonth : null);

  return (
    <div>
      {/* hero trend cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <HeroCard label="Cash Sales" mtd={money(cashMtd, { compact: true, floor: true })} mtdDelta={heroDelta}
          proj={money(projRunRate, { compact: true, floor: true })} projDelta={heroDelta}
          extraLabel="Full-Month Budget" extra={budget ? money(budget, { compact: true }) : '—'}
          labelDef={DEFS.cashSales} projDef={DEFS.projRunRate} extraDef={DEFS.fullMonthBudget} />
        <HeroCard label="Recognized Revenue" mtd={money(recRev, { compact: true })} mtdDelta={heroDelta}
          proj={money(h.recognized_run_rate ?? projRunRate, { compact: true, floor: true })} projDelta={heroDelta}
          labelDef={DEFS.recRev} projDef={DEFS.recRunRate} />
      </div>

      {/* KPI groups */}
      <Eyebrow>Financial</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${financial.length},1fr)`, gap: 12, marginBottom: 18, alignItems: 'start' }}>
        {financial.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <Eyebrow>Operational</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 12, marginBottom: 18, alignItems: 'start' }}>
        {operational.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <Eyebrow>Marketing</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${marketing.length},1fr)`, gap: 12, marginBottom: 4, alignItems: 'start' }}>
        {marketing.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Sales to Budget + Budget Attainment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <CardTitle title="Sales to Budget — Month to Date" sub={`Daily cash sales · cumulative vs budget & run rate · ${range}`}
            right={
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', font: `500 11px ${FONT}`, color: C.ink2, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, border: `1.4px solid #C9D6D2`, background: '#fff', borderRadius: 2 }} />Cash Sales (daily)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 3, background: C.navy, borderRadius: 2 }} />Net Sales (MTD)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 3, background: C.blue, borderRadius: 2 }} />Budget</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 0, borderTop: `2px dashed #AAB7B3` }} />Run Rate</span>
              </div>
            } />
          <PacingChart daily={dailyArr} budget={budget} trending={projRunRate} daysInMonth={daysInMonth} />
          <div style={{ display: 'flex', gap: 26, marginTop: 6, paddingTop: 12, borderTop: `1px solid ${C.line2}`, flexWrap: 'wrap' }}>
            {[
              ['Cash Sales MTD', money(mtdActual, { decimals: 2 }), C.ink, DEFS.cashSales],
              ['Budget (MTD)', budgetMtd != null ? money(budgetMtd, { decimals: 2 }) : '—', C.ink, 'Budget (MTD): the full-month budget pro-rated to the elapsed portion of the month.'],
              ['Pace to Budget', paceToBudget != null ? `${paceToBudget.toFixed(0)}%` : '—', paceToBudget >= 100 ? C.ink : C.clay, DEFS.budgetPct],
              ['Projected (Run Rate)', money(projRunRate, { decimals: 2, floor: true }), C.ink, DEFS.projRunRate],
              ['Projected (Run Rate) %', budget ? `${((projRunRate / budget) * 100).toFixed(0)}%` : '—', budget && (projRunRate / budget) * 100 >= 100 ? C.ink : C.clay, 'Projected Run Rate ÷ full-month budget × 100.'],
              ['Full-Month Budget', money(budget, { decimals: 2 }), C.ink, DEFS.fullMonthBudget],
              ['New Customer', num(newVisits), C.ink, DEFS.newCust],
              ['Existing Customer', num(h.existing_client_count), C.ink, DEFS.existingCust],
              ['ASP New', h.asp_new_clients != null ? money(h.asp_new_clients) : '—', C.ink, DEFS.aspNew],
              ['ASP Existing', h.asp_existing_clients != null ? money(h.asp_existing_clients) : '—', C.ink, DEFS.aspExisting],
            ].map(([l, v, col, d]) => (
              <div key={l} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ display: 'flex', alignItems: 'center', font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>{l}<InfoDot def={d} /></span>
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
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Service Mix</div>
            {drillSeg1 && <span onClick={() => setDrillSeg1(null)} style={{ font: `600 11px ${FONT}`, color: C.teal, cursor: 'pointer' }}>← All services</span>}
          </div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2, textTransform: 'capitalize' }}>
            {drillSeg1 ? `${drillSeg1} · sub-categories · ${range}` : `Share of revenue · click a segment to drill in · ${range}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18 }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', flex: 'none', background: serviceMix.length ? `conic-gradient(${stops})` : '#EEF3F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ font: `700 17px ${FONT}`, color: C.ink }}>{serviceMix.length ? `${topSlice.pct}%` : '—'}</span>
                <span style={{ font: `500 8.5px ${FONT}`, color: C.gray, textAlign: 'center', textTransform: 'capitalize', padding: '0 6px', lineHeight: 1.1 }}>{serviceMix.length ? topSlice.label : ''}</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {serviceMix.map((s) => {
                const drillable = !drillSeg1 && s.label !== 'Other';
                return (
                <div key={s.label} onClick={() => { if (drillable) setDrillSeg1(s.label); }} title={drillable ? `Drill into ${s.label}` : s.label}
                     style={{ display: 'flex', alignItems: 'center', gap: 8, font: `500 11.5px ${FONT}`, color: C.ink2, cursor: drillable ? 'pointer' : 'default' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flex: 'none' }} />
                  <span style={{ width: 100, flex: 'none', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ flex: 1, height: 6, background: '#F0F4F3', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 3 }} />
                  </span>
                  <span style={{ width: 34, flex: 'none', textAlign: 'right', color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
                </div>
                );
              })}
              {serviceMix.length === 0 && <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>No service data.</span>}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>Product Mix</div>
          <div style={{ font: `500 11.5px ${FONT}`, color: C.gray, marginTop: 2 }}>Unit consumption · {range}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            {byCount.map((p, i) => (
              <div key={p.product_name ?? p.item_category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i < 3 && <Medal color={MEDAL[i]} />}</span>
                <span style={{ width: 118, flex: 'none', font: `500 11.5px ${FONT}`, color: C.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.product_name ?? p.item_category}>{p.product_name ?? p.item_category}</span>
                <span style={{ flex: 1, height: 14, background: '#F0F4F3', borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(pv(p) / maxCount) * 100}%`, background: `linear-gradient(90deg,${C.teal},${C.tealBright})`, borderRadius: 4 }} />
                </span>
                <span style={{ width: 64, flex: 'none', textAlign: 'right', font: `600 11.5px ${FONT}`, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{num(pv(p))}</span>
              </div>
            ))}
            {byCount.length === 0 && <span style={{ font: `500 12px ${FONT}`, color: C.gray }}>No product data.</span>}
          </div>
        </Card>
      </div>

      {/* Location performance — three by-location tables */}
      {(() => {
        const dash = '—';
        const totCash = h.mtd_revenue != null ? h.mtd_revenue : totals.cash;
        const totProj = h.cash_run_rate != null ? h.cash_run_rate : totals.trending;
        // Per-location recognized-revenue run rate: no backend field, so scale
        // recognized revenue by the location's cash run-rate multiplier
        // (Proj. Run Rate ÷ Cash MTD). Approximate — see DEFS.recRunRateLoc.
        const recRRLoc = (l, o) => {
          const rev = n(o.recognized_revenue), cash = n(l.cash_sales), proj = n(l.trending);
          if (rev == null || !cash || proj == null) return null;
          return rev * (proj / cash);
        };
        return (
          <>
            <LocationMetricTable title="Location Performance · Sales & Customers" sub={range} rows={rows}
              columns={[
                { label: 'Cash MTD', def: DEFS.cashSales, render: (l) => money(l.cash_sales, { compact: true, floor: true }) },
                { label: 'Proj. Run Rate', def: DEFS.projRunRate, render: (l) => money(l.trending, { compact: true }) },
                { label: 'New Cust', def: DEFS.newCust, render: (l, o) => num(o.new_client_count) },
                { label: 'Exist Cust', def: DEFS.existingCust, render: (l, o) => num(o.existing_client_count) },
                { label: 'ASP New', def: DEFS.aspNew, render: (l, o) => money(o.asp) },
                { label: 'ASP Exist', def: DEFS.aspExisting, render: (l, o) => money(o.asp_excl_memberships) },
              ]}
              total={[
                money(totCash, { compact: true, floor: true }),
                money(totProj, { compact: true }),
                num(h.new_visits != null ? h.new_visits : totals.newCust),
                num(h.existing_client_count != null ? h.existing_client_count : totals.existCust),
                h.asp_new_clients != null ? money(h.asp_new_clients) : dash,
                h.asp_existing_clients != null ? money(h.asp_existing_clients) : dash,
              ]} />

            <LocationMetricTable title="Location Performance · Operations" sub={range} rows={rows} legend
              columns={[
                { label: 'Prov Util', def: DEFS.utilProvider, render: (l, o) => o.provider_utilization != null ? <span style={{ color: utilPill(o.provider_utilization).color }}>{pct(o.provider_utilization, 0)}</span> : dash },
                { label: 'Prov Rev/Hr', def: DEFS.revProvider, render: (l, o) => o.rev_per_provider != null ? <span style={{ color: revHrPill(o.rev_per_provider, 'prov').color }}>{money(o.rev_per_provider)}</span> : dash },
                { label: 'Esth Util', def: DEFS.utilEsth, render: (l, o) => o.esthetician_utilization != null ? <span style={{ color: utilPill(o.esthetician_utilization).color }}>{pct(o.esthetician_utilization, 0)}</span> : dash },
                { label: 'Esth Rev/Hr', def: DEFS.revEsth, render: (l, o) => o.rev_per_esthetician != null ? <span style={{ color: revHrPill(o.rev_per_esthetician, 'esth').color }}>{money(o.rev_per_esthetician)}</span> : dash },
                { label: 'Rebook', def: DEFS.rebook, render: (l, o) => pct(o.rebooking_rate, 0) },
                { label: 'Mbr Adopt', def: DEFS.membership, render: (l) => pct(l.membership_adoption, 1) },
              ]}
              total={[
                h.provider_utilization != null ? pct(h.provider_utilization, 0) : dash,
                h.rev_per_provider != null ? money(h.rev_per_provider) : dash,
                h.esthetician_utilization != null ? pct(h.esthetician_utilization, 0) : dash,
                h.rev_per_esthetician != null ? money(h.rev_per_esthetician) : dash,
                h.rebooking_rate != null ? pct(h.rebooking_rate, 0) : dash,
                h.membership_adoption_rate != null ? pct(h.membership_adoption_rate, 1) : dash,
              ]} />

            <LocationMetricTable title="Location Performance · Financials" sub={range} rows={rows}
              columns={[
                { label: 'Rec. Rev', def: DEFS.recRev, render: (l, o) => money(o.recognized_revenue, { compact: true }) },
                { label: 'RR Rec. Rev', def: DEFS.recRunRateLoc, render: (l, o) => { const v = recRRLoc(l, o); return v != null ? money(v, { compact: true }) : dash; } },
                { label: 'COGS %', def: DEFS.cogs, render: (l, o) => pct(o.cogs_pct, 1) },
                { label: 'Payroll %', def: DEFS.payroll, render: (l, o) => pct(o.payroll_pct, 1) },
                { label: 'GM %', def: DEFS.gm, render: (l, o) => pct(o.gross_margin_pct, 0) },
              ]}
              total={[
                money(totals.recRev, { compact: true }),
                h.recognized_run_rate != null ? money(h.recognized_run_rate, { compact: true }) : dash,
                h.cogs_margin_pct != null ? pct(h.cogs_margin_pct, 1) : dash,
                h.payroll_margin_pct != null ? pct(h.payroll_margin_pct, 1) : dash,
                h.gross_margin_pct != null ? pct(h.gross_margin_pct, 0) : dash,
              ]} />
          </>
        );
      })()}
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

// Config-driven by-location table. `columns` is [{ label, def, render(l, o) }];
// `total` is an array of pre-formatted chain-total cells aligned to `columns`.
const LocationMetricTable = ({ title, sub, rows, columns, total, legend }) => {
  const gridCols = `1.35fr ${columns.map(() => '1fr').join(' ')}`;
  const cell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: legend ? 10 : 12 }}>
        <div style={{ font: `600 14px ${FONT}`, color: C.ink }}>{title}</div>
        {sub && <div style={{ font: `500 11.5px ${FONT}`, color: C.gray }}>{sub}</div>}
      </div>
      {legend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 20px', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ font: `700 9px ${FONT}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.gray }}>Util%</span>
          <LegendPill bg="#FBE3E1" color={C.red}>&lt;60%</LegendPill>
          <LegendPill bg="#FBF1D6" color={C.gold}>60–75%</LegendPill>
          <LegendPill bg="#DDF0E6" color={C.teal}>≥75%</LegendPill>
          <span style={{ width: 1, height: 14, background: C.line }} />
          <span style={{ font: `700 9px ${FONT}`, letterSpacing: '.09em', textTransform: 'uppercase', color: C.gray }}>Rev/Hr</span>
          <LegendPill bg="#FBE3E1" color={C.red}>Prov &lt;$450 / Esth &lt;$125</LegendPill>
          <LegendPill bg="#FBF1D6" color={C.gold}>Prov 450–550 / Esth 125–175</LegendPill>
          <LegendPill bg="#DDF0E6" color={C.teal}>Prov ≥$550 / Esth ≥$175</LegendPill>
        </div>
      )}
      {/* column header */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, padding: '0 6px 9px', borderBottom: `1px solid ${C.line2}`, font: `600 9.5px ${FONT}`, letterSpacing: '.04em', textTransform: 'uppercase', color: C.gray2 }}>
        <span>Location</span>
        {columns.map((c) => (
          <span key={c.label} style={{ ...cell, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{c.label}<InfoDot def={c.def} /></span>
        ))}
      </div>
      {rows.map((l) => {
        const o = l._ops || {};
        return (
          <div key={l.location} className="ev-lrow" style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, padding: '8px 6px', borderBottom: `1px solid ${C.line3}`, alignItems: 'center', font: `500 11.5px ${FONT}`, color: C.ink2 }}>
            <span style={{ fontWeight: 600, color: C.ink }}>{l.location}</span>
            {columns.map((c) => <span key={c.label} style={cell}>{c.render(l, o)}</span>)}
          </div>
        );
      })}
      {rows.length === 0 && <div style={{ padding: '24px 6px', textAlign: 'center', font: `500 12px ${FONT}`, color: C.gray }}>No location data for this range.</div>}
      {rows.length > 0 && total && (
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, padding: '11px 6px 2px', borderTop: `2px solid #D8E2DF`, alignItems: 'center', font: `700 11.5px ${FONT}`, color: C.ink }}>
          <span style={{ font: `700 10px ${FONT}`, letterSpacing: '.1em', textTransform: 'uppercase', color: C.teal }}>Total · {rows.length} Loc</span>
          {total.map((v, i) => <span key={i} style={cell}>{v}</span>)}
        </div>
      )}
    </Card>
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
  const prev = prevMonthRange(fl.start_date, fl.end_date);
  const prevParams = { start_date: prev.start, end_date: prev.end, locations: fl.locations };
  const { data, loading, error, reload } = useApiData({
    header: { path: '/api/mtd-kpi-header', params },
    headerPrev: { path: '/api/mtd-kpi-header', params: prevParams },
    monthly: { path: '/api/monthly-trend', params },
    daily: { path: '/api/mtd-daily-trend', params },
    categories: { path: '/api/category-breakdown', params },
  }, [JSON.stringify(params)]);
  return (
    <DataState loading={loading || !fl.ready} error={error} onRetry={reload}>
      <FinanceBody h={data.header || {}} hPrev={data.headerPrev || {}} monthly={data.monthly || []} daily={data.daily} categories={data.categories || []} range={fl.monthLabel} />
    </DataState>
  );
};

const FinanceBody = ({ h, hPrev = {}, monthly, daily, categories, range }) => {
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

  // KPI cards. Revenue delta is month-over-month (current vs prior calendar
  // month) via the prior-month header; others show pt/label where present.
  const kpis = [
    { label: 'Recognized Revenue', value: money(revenue, { compact: true }), ...spreadOrNull(momPctDelta(h.mtd_revenue, hPrev.mtd_revenue)) },
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
  const prev = prevMonthRange(fl.start_date, fl.end_date);
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
  const prev = prevMonthRange(fl.start_date, fl.end_date);
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
  const prev = prevMonthRange(fl.start_date, fl.end_date);
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
const MembershipsView = () => <ComingSoon name="Memberships" />;

/* =================================================================
   COST & INVENTORY ANALYTICS  (hardcoded replica — Zenoti)
   ================================================================= */
const INV_ALERT = '9 cost-variance flags · 5 PO mismatches · 3 stuck transfers · 4 large true-ups';

const InvAlert = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#FBF1ED', border: `1px solid #F0D9CE`, borderRadius: 10, padding: '9px 14px', font: `500 11.5px ${FONT}`, color: C.clay, marginBottom: 16 }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.clay, flex: 'none' }} />
    {INV_ALERT}
  </div>
);

const InvKpis = ({ items }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
    {items.map((k, i) => (
      <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 15px', minWidth: 0 }}>
        <div style={{ font: `600 9px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray, minHeight: 22 }}>{k.label}</div>
        <div style={{ font: `600 22px ${FONT}`, color: k.color || C.ink, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
        <div style={{ font: `500 10px ${FONT}`, color: C.gray3, marginTop: 3 }}>{k.sub}</div>
      </div>
    ))}
  </div>
);

const InvSpark = ({ data, color = C.teal, h = 48 }) => {
  const w = 200, mx = Math.max(...data), mn = Math.min(...data), rng = (mx - mn) || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * (h - 8) - 4}`).join(' ');
  return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>;
};

const InvBar = ({ label, pct, color = C.teal, right, target }) => (
  <div style={{ marginBottom: 11 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 11px ${FONT}`, color: C.ink2, marginBottom: 4 }}>
      <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums', color: C.gray3 }}>{right}</span>
    </div>
    <div style={{ position: 'relative', height: 9, background: C.line2, borderRadius: 5 }}>
      <div style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: '100%', background: color, borderRadius: 5 }} />
      {target != null && <div style={{ position: 'absolute', left: `${Math.min(100, target)}%`, top: -2, width: 2, height: 13, background: C.ink }} />}
    </div>
  </div>
);

const InvPill = ({ text, tone }) => {
  const map = { red: ['#FBE3E1', C.red], clay: ['#FBEDE5', C.clay], teal: ['#DDF0E6', C.teal], gray: ['#EEF2F1', C.gray3], amber: ['#FBF1D6', '#B5852A'] };
  const [bg, fg] = map[tone] || map.gray;
  return <span style={{ background: bg, color: fg, font: `600 10px ${FONT}`, padding: '2px 7px', borderRadius: 5 }}>{text}</span>;
};

const InvTable = ({ cols, rows }) => {
  const grid = cols.map((c) => c.w || '1fr').join(' ');
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '4px 4px 9px', borderBottom: `1px solid ${C.line2}`, font: `600 9px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray2 }}>
        {cols.map((c, i) => <span key={i} style={{ textAlign: c.align || 'left' }}>{c.h}</span>)}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: grid, gap: 8, padding: '9px 4px', borderBottom: `1px solid ${C.line3}`, font: `500 11.5px ${FONT}`, color: C.ink2, alignItems: 'center' }}>
          {cols.map((c, ci) => (
            <span key={ci} style={{ textAlign: c.align || 'left', color: c.strong ? C.ink : undefined, fontWeight: c.strong ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>
              {c.render ? c.render(r) : r[c.k]}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

// ---- Analytics Overview ----
const InvAnalyticsView = ({ onNavigate }) => {
  const kpis = [
    { label: 'Avg Cost-Variance', value: '+6.3%', sub: 'system vs latest PO', color: C.clay },
    { label: 'PO Match Rate', value: '88.5%', sub: 'clean 3-way' },
    { label: 'Open Cost Flags', value: '9', sub: '3 on watch', color: C.clay },
    { label: 'Inventory Turnover', value: '7.3×', sub: 'annualized' },
    { label: 'Avg Weeks of Supply', value: '9.6', sub: 'network' },
    { label: 'True-Up Value', value: '−$18.4K', sub: 'net adjustment', color: C.red },
  ];
  const scorecard = [
    { a: 'Cost per Unit', hl: '$182 wtd', f: 6, to: 'Cost per Unit' },
    { a: 'Costing Drift', hl: '+6.3% avg', f: 9, to: 'System vs Purchase Cost' },
    { a: 'PO Matching', hl: '88.5% clean', f: 5, to: 'PO Matching' },
    { a: 'Transfers', hl: '12 open', f: 5, to: 'Transfers' },
    { a: 'True-Ups', hl: '−$18.4K net', f: 7, to: 'True-Ups' },
    { a: 'Inventory Turnover', hl: '7.3× / 9.0× tgt', f: 4, to: 'Inventory Turnover' },
    { a: 'Weeks of Supply', hl: '9.6 wks avg', f: 6, to: 'Consumption & WOS' },
  ];
  const impact = [
    { label: 'Cost variance', right: '$58.2K', pct: 100, color: C.red },
    { label: 'PO mismatch', right: '$31.4K', pct: 54, color: C.clay },
    { label: 'Transfer discrepancy', right: '$12.7K', pct: 22, color: C.navy },
    { label: 'True-up write-downs', right: '$24.1K', pct: 41, color: C.redBright },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }}>
        <Card>
          <CardTitle title="Data-Integrity Scorecard" sub="One row per analysis · health, headline & open flags" />
          <div style={{ marginTop: 12 }}>
            <InvTable
              cols={[
                { h: 'Analysis', k: 'a', strong: true, render: (r) => <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: r.f >= 7 ? C.red : r.f >= 5 ? C.clay : C.teal, marginRight: 8 }} />{r.a}</span> },
                { h: 'Headline', k: 'hl', align: 'right' },
                { h: 'Flags', k: 'f', align: 'right', w: '0.5fr' },
                { h: '', align: 'right', w: '0.5fr', render: (r) => <span onClick={() => onNavigate && onNavigate(r.to)} style={{ color: C.teal, font: `600 11px ${FONT}`, cursor: 'pointer' }}>View →</span> },
              ]}
              rows={scorecard}
            />
          </div>
        </Card>
        <Card>
          <CardTitle title="Flagged $ Impact by Type" sub="Estimated exposure across analyses" />
          <div style={{ marginTop: 16 }}>
            {impact.map((b, i) => <InvBar key={i} {...b} />)}
          </div>
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <Card><div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>Inventory Turnover</div><div style={{ font: `600 22px ${FONT}`, color: C.ink, margin: '6px 0' }}>7.3× <span style={{ font: `600 10px ${FONT}`, color: C.green }}>▲ 0.4 vs 12-mo</span></div><InvSpark data={[6.2, 6.4, 6.3, 6.6, 6.8, 6.7, 7.0, 6.9, 7.1, 7.0, 7.2, 7.3]} /><div style={{ font: `500 9.5px ${FONT}`, color: C.gray3, marginTop: 4 }}>Trailing 12 months</div></Card>
        <Card><div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>True-Up Value</div><div style={{ font: `600 22px ${FONT}`, color: C.red, margin: '6px 0' }}>−$18.4K <span style={{ font: `600 10px ${FONT}`, color: C.clay }}>rising adjustments</span></div><InvSpark data={[-6, -8, -7, -10, -9, -12, -11, -14, -13, -16, -17, -18.4]} color={C.red} /><div style={{ font: `500 9.5px ${FONT}`, color: C.gray3, marginTop: 4 }}>Trailing 12 months</div></Card>
        <Card><div style={{ font: `600 9.5px ${FONT}`, letterSpacing: '.05em', textTransform: 'uppercase', color: C.gray }}>Avg Cost Variance</div><div style={{ font: `600 22px ${FONT}`, color: C.clay, margin: '6px 0' }}>+6.3% <span style={{ font: `600 10px ${FONT}`, color: C.clay }}>▲ 1.8 pt drift</span></div><InvSpark data={[3.1, 3.4, 3.8, 4.2, 4.5, 4.9, 5.2, 5.6, 5.9, 6.0, 6.1, 6.3]} color={C.clay} /><div style={{ font: `500 9.5px ${FONT}`, color: C.gray3, marginTop: 4 }}>Trailing 12 months</div></Card>
      </div>
    </div>
  );
};

// ---- Inventory Turnover ----
const InvTurnoverView = () => {
  const kpis = [
    { label: 'Annualized Turnover', value: '7.3×', sub: 'COGS ÷ avg inv' },
    { label: 'Days-on-Hand', value: '50', sub: 'network avg' },
    { label: 'Turnover vs Target', value: '−1.7×', sub: '9.0× blended tgt', color: C.clay },
    { label: 'Slow-Mover Value', value: '$214K', sub: 'turns < target', color: C.clay },
    { label: 'Dead-Stock Value', value: '$38K', sub: 'no demand 90d+', color: C.red },
  ];
  const cats = [
    { l: 'Neurotoxins', v: 13.4, t: 12 }, { l: 'Fillers', v: 7.2, t: 9 },
    { l: 'Biostimulators', v: 4.8, t: 6 }, { l: 'Consumables', v: 9.5, t: 5 },
    { l: 'Skincare / Retail', v: 3.1, t: 4 }, { l: 'Equipment', v: 5.2, t: 6 },
  ];
  const locs = [
    { l: 'Tribeca', v: 12.1 }, { l: 'Hoboken', v: 10.7 }, { l: 'Jersey City', v: 10.5 }, { l: 'Montclair', v: 10.3 },
    { l: 'Short Hills', v: 9.5 }, { l: 'Denville', v: 8.4 }, { l: 'Frederick', v: 5.9 }, { l: 'Bel Air', v: 5.6 },
    { l: 'Ridgewood', v: 5.3 }, { l: 'Bridgewater', v: 5.0 }, { l: 'Waldorf', v: 4.9 }, { l: 'Old Bridge', v: 4.8 },
    { l: 'Lancaster', v: 4.4 }, { l: 'Scarsdale', v: 4.3 },
  ];
  const dead = [
    { p: 'EltaMD UV Clear', loc: 'Tribeca', oh: 182, ohd: '$4.6K', t: '2.1×', lu: '138d', st: ['Overstocked', 'clay'] },
    { p: 'SkinVive', loc: 'Bel Air', oh: 46, ohd: '$10.6K', t: '2.4×', lu: '168d', st: ['Slow', 'amber'] },
    { p: 'Radiesse 1.5cc', loc: 'Frederick', oh: 22, ohd: '$5.7K', t: '3.0×', lu: '96d', st: ['Slow', 'amber'] },
    { p: 'Bacteriostatic Water', loc: 'Waldorf', oh: 88, ohd: '$0.5K', t: '0.8×', lu: '212d', st: ['Dead', 'red'] },
    { p: 'Microcannula 25G', loc: 'Denville', oh: 64, ohd: '$0.2K', t: '1.1×', lu: '184d', st: ['Dead', 'red'] },
    { p: 'SkinMedica TNS', loc: 'Ridgewood', oh: 120, ohd: '$16.7K', t: '3.4×', lu: '77d', st: ['Slow', 'amber'] },
    { p: 'Versa Filler', loc: 'Lancaster', oh: 14, ohd: '$2.5K', t: '1.8×', lu: '121d', st: ['Dead', 'red'] },
    { p: 'Restylane Refyne', loc: 'Old Bridge', oh: 18, ohd: '$4.3K', t: '2.6×', lu: '103d', st: ['Slow', 'amber'] },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <CardTitle title="Turnover by Category" sub="Annualized turns · black tick = category target" />
          <div style={{ marginTop: 16 }}>
            {cats.map((c, i) => <InvBar key={i} label={c.l} right={`${c.v}× · tgt ${c.t}×`} pct={(c.v / 14) * 100} target={(c.t / 14) * 100} color={c.v >= c.t ? C.teal : C.clay} />)}
          </div>
        </Card>
        <Card>
          <CardTitle title="Turnover by Location" sub="Below 8.0× network target in terracotta" />
          <div style={{ marginTop: 16 }}>
            {locs.map((c, i) => <InvBar key={i} label={c.l} right={`${c.v}×`} pct={(c.v / 12.1) * 100} color={c.v >= 8 ? C.teal : C.clay} />)}
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle title="Network Turnover Trend" sub="Annualized turns · trailing 12 months" />
        <div style={{ marginTop: 10 }}><InvSpark data={[6.1, 6.0, 6.4, 6.3, 6.8, 6.6, 7.0, 6.9, 7.1, 7.0, 7.2, 7.3]} h={90} /></div>
      </Card>
      <Card>
        <CardTitle title="Slow & Dead Stock" sub="Turns below target or no demand 90d+ · candidates for write-down or transfer" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'Product', k: 'p', strong: true, w: '1.4fr' }, { h: 'Location', k: 'loc' },
              { h: 'On-Hand', k: 'oh', align: 'right' }, { h: 'On-Hand $', k: 'ohd', align: 'right' },
              { h: 'Turns', k: 't', align: 'right' }, { h: 'Last Use', k: 'lu', align: 'right' },
              { h: 'Status', align: 'right', render: (r) => <InvPill text={r.st[0]} tone={r.st[1]} /> },
            ]}
            rows={dead}
          />
        </div>
      </Card>
    </div>
  );
};

// ---- True-Ups (Zenoti) ----
const InvTrueUpsView = () => {
  const kpis = [
    { label: 'True-Up Count (May)', value: '14', sub: 'adjustment entries' },
    { label: 'Net True-Up Value', value: '−$3.5K', sub: 'signed', color: C.red },
    { label: 'Gross Write-Downs', value: '$6.1K', sub: 'shrink / damage', color: C.clay },
    { label: 'Gross Write-Ups', value: '+$2.6K', sub: 'corrections up', color: C.green },
    { label: 'Repeated SKU-Sites', value: '0', sub: 'chronic discrepancy' },
  ];
  const entries = [
    { d: 'May 07', loc: 'Hoboken', p: 'Dysport 300u', sku: 'DYS-300', q: '+4', cb: '$399', v: '+$1.6K', vc: C.green, rs: 'Receiving error', fl: ['Large', 'clay'] },
    { d: 'May 03', loc: 'Waldorf', p: 'Sculptra', sku: 'SCU-VIAL', q: '−3', cb: '$385', v: '−$1.2K', vc: C.red, rs: 'Damage / expiry write-off', fl: ['Large', 'clay'] },
    { d: 'May 10', loc: 'Lancaster', p: 'Botox 100u', sku: 'BTX-100', q: '−2', cb: '$560', v: '−$1.1K', vc: C.red, rs: 'Count correction', fl: ['Large', 'clay'] },
    { d: 'May 15', loc: 'Waldorf', p: 'Xeomin 100u', sku: 'XEO-100', q: '−2', cb: '$480', v: '−$960', vc: C.red, rs: 'Count correction', fl: ['Large', 'clay'] },
    { d: 'May 18', loc: 'Lancaster', p: 'Sculptra', sku: 'SCU-VIAL', q: '−2', cb: '$385', v: '−$770', vc: C.red, rs: 'Count correction', fl: ['Large', 'clay'] },
    { d: 'May 22', loc: 'Frederick', p: 'SkinVive', sku: 'SKV-1', q: '+3', cb: '$230', v: '+$690', vc: C.green, rs: 'Receiving error', fl: ['Large', 'clay'] },
  ];
  const byLoc = [
    { label: 'Lancaster', right: '−$1.9K', pct: 100, color: C.red }, { label: 'Waldorf', right: '−$1.5K', pct: 79, color: C.red },
    { label: 'Hoboken', right: '+$1.6K', pct: 84, color: C.teal }, { label: 'Frederick', right: '+$0.7K', pct: 37, color: C.teal },
    { label: 'Bel Air', right: '−$0.4K', pct: 21, color: C.clay },
  ];
  const byReason = [
    { label: 'Count correction', right: '−$3.6K', pct: 100, color: C.red }, { label: 'Receiving error', right: '+$2.3K', pct: 64, color: C.teal },
    { label: 'Damage / expiry', right: '−$1.2K', pct: 33, color: C.clay }, { label: 'Theft / shrink', right: '−$0.6K', pct: 17, color: C.redBright },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <Card>
        <CardTitle title="True-Up Value & Count Trend" sub="18 months · write-ups (green) vs write-downs (red) · count line" />
        <div style={{ marginTop: 10 }}><InvSpark data={[2, -3, 4, -2, 3, -5, 2, -4, 3, -6, 2, -3, 4, -2, 3, -5, 2, -3.5]} h={90} color={C.navy} /></div>
      </Card>
      <Card>
        <CardTitle title="Adjustment Entries" sub="Flagged (value) > $250 or chronic SKU-site · sorted by value" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'Date', k: 'd' }, { h: 'Location', k: 'loc' }, { h: 'Product', k: 'p', strong: true, w: '1.2fr' },
              { h: 'SKU', k: 'sku' }, { h: 'Qty', k: 'q', align: 'right', w: '0.5fr' }, { h: 'Cost Basis', k: 'cb', align: 'right' },
              { h: 'Value $', align: 'right', render: (r) => <span style={{ color: r.vc, fontWeight: 600 }}>{r.v}</span> },
              { h: 'Reason', k: 'rs', w: '1.1fr' }, { h: 'Flag', align: 'right', render: (r) => <InvPill text={r.fl[0]} tone={r.fl[1]} /> },
            ]}
            rows={entries}
          />
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Adjustment Value by Location" /><div style={{ marginTop: 16 }}>{byLoc.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
        <Card><CardTitle title="By Reason" /><div style={{ marginTop: 16 }}>{byReason.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
      </div>
    </div>
  );
};

const InvHeat = ({ colLabels, rows }) => {
  const all = rows.flatMap((r) => r.cells).filter((v) => v != null);
  const mx = Math.max(...all), mn = Math.min(...all), rng = (mx - mn) || 1;
  const colorFor = (v) => { if (v == null) return C.line2; const t = (v - mn) / rng; return t < 0.34 ? '#EAC6B4' : t < 0.67 ? '#CFE7DD' : '#9CD4C5'; };
  const grid = `118px repeat(${colLabels.length}, 1fr)`;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 3, font: `600 8.5px ${FONT}`, color: C.gray2, marginBottom: 5 }}>
        <span />{colLabels.map((c, i) => <span key={i} style={{ textAlign: 'center' }}>{c}</span>)}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: grid, gap: 3, marginBottom: 3, alignItems: 'center' }}>
          <span style={{ font: `500 10px ${FONT}`, color: C.ink2 }}>{r.label}</span>
          {r.cells.map((v, ci) => <span key={ci} style={{ textAlign: 'center', background: colorFor(v), borderRadius: 3, padding: '4px 0', font: `600 9.5px ${FONT}`, color: C.ink }}>{v != null ? v : '—'}</span>)}
        </div>
      ))}
    </div>
  );
};

// ---- Consumption & Weeks of Supply ----
const InvConsumptionView = () => {
  const kpis = [
    { label: 'Network Consumption', value: '3,290 u', sub: 'last month' },
    { label: 'Avg Weeks of Supply', value: '4.5', sub: 'network' },
    { label: 'SKUs < 2 Weeks', value: '1', sub: 'critical', color: C.red },
    { label: 'SKUs > 16 Weeks', value: '0', sub: 'overstock' },
    { label: 'Forecast Next-Month', value: '3,540 u', sub: 'trend + seasonal', color: C.teal },
  ];
  const wos = [
    { p: 'Restylane Kysse', loc: 'Lancaster', oh: 8, wu: 11, w: '0.7', vol: ['Variable', 'red'], st: ['Critical', 'red'] },
    { p: 'Morpheus8 Tips', loc: 'Frederick', oh: 24, wu: 9, w: '2.6', vol: ['Volatile', 'amber'], st: ['Low', 'clay'] },
    { p: 'Sculptra', loc: 'Montclair', oh: 16, wu: 6, w: '2.8', vol: ['Volatile', 'amber'], st: ['Low', 'clay'] },
    { p: 'Juvederm Voluma', loc: 'Bridgewater', oh: 22, wu: 7, w: '3.2', vol: ['Volatile', 'amber'], st: ['Low', 'clay'] },
    { p: 'Topical Numbing (BLT)', loc: 'Old Bridge', oh: 210, wu: 56, w: '3.8', vol: ['Variable', 'red'], st: ['Low', 'clay'] },
    { p: 'Jeuveau 100u', loc: 'Denville', oh: 64, wu: 17, w: '3.9', vol: ['Variable', 'red'], st: ['Low', 'clay'] },
    { p: 'Xeomin 100u', loc: 'Tribeca', oh: 84, wu: 19, w: '4.4', vol: ['Volatile', 'amber'], st: ['Healthy', 'teal'] },
    { p: 'Hydrafacial Boosters', loc: 'Hoboken', oh: 188, wu: 41, w: '4.6', vol: ['Stable', 'teal'], st: ['Healthy', 'teal'] },
    { p: 'Botox 100u', loc: 'Montclair', oh: 312, wu: 62, w: '5.0', vol: ['Stable', 'teal'], st: ['Healthy', 'teal'] },
    { p: 'PRF Tubes', loc: 'Short Hills', oh: 1240, wu: 228, w: '5.4', vol: ['Stable', 'teal'], st: ['Healthy', 'teal'] },
    { p: 'Dysport 300u', loc: 'Bel Air', oh: 420, wu: 58, w: '7.2', vol: ['Stable', 'teal'], st: ['Healthy', 'teal'] },
    { p: 'EltaMD UV Clear', loc: 'Ridgewood', oh: 540, wu: 70, w: '7.7', vol: ['Stable', 'teal'], st: ['Healthy', 'teal'] },
  ];
  const movers = [
    { label: 'Neuromodulators', right: '+12.5%', pct: 100, color: C.teal },
    { label: 'Fillers', right: '+9.2%', pct: 74, color: C.teal },
    { label: 'Biostimulators', right: '+4.8%', pct: 38, color: C.teal },
    { label: 'Sculptra', right: '+3.1%', pct: 25, color: C.teal },
    { label: 'EltaMD UV Clear', right: '−8.4%', pct: 67, color: C.clay },
    { label: 'Versa Filler', right: '−11.0%', pct: 88, color: C.red },
  ];
  const heat = [
    { label: 'Neuromodulators', cells: [5.2, 4.8, 4.5, 5.0, 4.6, 4.9, 5.1, 4.7] },
    { label: 'Fillers', cells: [3.8, 4.0, 3.5, 3.9, 3.6, 3.4, 3.7, 3.9] },
    { label: 'Biostimulators', cells: [2.8, 3.1, 2.9, 3.0, 2.7, 2.6, 2.9, 2.8] },
    { label: 'Consumables', cells: [6.5, 6.8, 6.2, 6.6, 7.0, 6.4, 6.7, 6.9] },
    { label: 'Retail', cells: [8.1, 7.8, 8.4, 7.9, 8.2, 8.0, 7.7, 8.3] },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <Card>
        <CardTitle title="Consumption & Forecast" sub="24 months · units · shaded band = next 3-mo forecast" />
        <div style={{ marginTop: 10 }}><InvSpark data={[1800, 1900, 1750, 2100, 2000, 2300, 2200, 2600, 2450, 2900, 3100, 2800, 3050, 3290, 3380, 3540]} h={92} /></div>
      </Card>
      <Card>
        <CardTitle title="Weeks of Supply" sub="<2 wks critical · 2–4.5 low · 4–16 healthy · >16 overstock · sorted by WOS asc" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'Product', k: 'p', strong: true, w: '1.4fr' }, { h: 'Location', k: 'loc' },
              { h: 'On-Hand', k: 'oh', align: 'right' }, { h: 'Weekly Use', k: 'wu', align: 'right' }, { h: 'WOS', k: 'w', align: 'right' },
              { h: 'Volatility', align: 'right', render: (r) => <InvPill text={r.vol[0]} tone={r.vol[1]} /> },
              { h: 'Status', align: 'right', render: (r) => <InvPill text={r.st[0]} tone={r.st[1]} /> },
            ]}
            rows={wos}
          />
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Weeks-of-Supply Heatmap" sub="Weeks of supply · category × month" /><div style={{ marginTop: 14 }}><InvHeat colLabels={['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']} rows={heat} /></div></Card>
        <Card><CardTitle title="Demand Movers · MoM" /><div style={{ marginTop: 16 }}>{movers.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
      </div>
    </div>
  );
};

// ---- Cost per Unit ----
const InvCostPerUnitView = () => {
  const kpis = [
    { label: 'Weighted Avg Cost / Unit', value: '$121.83', sub: '▲ vs prior', color: C.clay },
    { label: 'SKUs w/ Cost Change', value: '14', sub: 'this month' },
    { label: 'Biggest Mover (Month)', value: 'Jeuveau 100u', sub: '+5.1% unit cost' },
    { label: 'Inventory on Hand', value: '$28K', sub: 'at cost' },
  ];
  const net = [
    { p: 'Jeuveau 100u', sup: 'Evolus', ac: '$400', oh: '$420', cons: '105', ch: '+5.1%', up: true },
    { p: 'Nitrile Gloves M', sup: 'Amazon Business', ac: '$0.30', oh: '$8.40', cons: '2,100', ch: '+2.8%', up: true },
    { p: 'Juvederm Voluma', sup: 'Allergan', ac: '$309', oh: '$3.1K', cons: '48', ch: '−2.1%', up: false },
    { p: 'Morpheus8 Tips', sup: 'InMode', ac: '$300', oh: '$2.4K', cons: '31', ch: '+7.4%', up: true },
    { p: 'Restylane Kysse', sup: 'Galderma', ac: '$305', oh: '$2.7K', cons: '40', ch: '+1.6%', up: true },
    { p: 'Sculptra', sup: 'Galderma', ac: '$385', oh: '$4.2K', cons: '52', ch: '+0.9%', up: true },
    { p: '31G Needles', sup: 'Amazon Business', ac: '$0.18', oh: '$0.9K', cons: '1,800', ch: '−1.2%', up: false },
    { p: 'Dysport 300u', sup: 'Galderma', ac: '$452', oh: '$6.3K', cons: '88', ch: '+3.8%', up: true },
    { p: 'PRF Tubes', sup: 'McKesson', ac: '$1.20', oh: '$1.3K', cons: '228', ch: '+3.2%', up: true },
    { p: 'Botox 100u', sup: 'Allergan', ac: '$560', oh: '$13.5K', cons: '135', ch: '+4.6%', up: true },
    { p: 'EltaMD UV Clear', sup: 'EltaMD', ac: '$26', oh: '$2.1K', cons: '70', ch: '+4.1%', up: true },
    { p: 'Xeomin 100u', sup: 'Merz', ac: '$480', oh: '$9.1K', cons: '1,704', ch: '+5.3%', up: true },
  ];
  const tableCols = [
    { h: 'Product', k: 'p', strong: true, w: '1.3fr' }, { h: 'Supplier', k: 'sup', w: '1.1fr' },
    { h: 'Avg Cost', k: 'ac', align: 'right' }, { h: 'On-Hand $', k: 'oh', align: 'right' }, { h: 'Consumed', k: 'cons', align: 'right' },
    { h: 'Change', align: 'right', render: (r) => <span style={{ color: r.up ? C.clay : C.teal, fontWeight: 600 }}>{r.ch}</span> },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <Card><CardTitle title="Cost per Unit — Network" sub="Weighted unit cost, on-hand value & 24-mo cost trend · Zenoti" /><div style={{ marginTop: 12 }}><InvTable cols={tableCols} rows={net} /></div></Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <CardTitle title="Weighted Avg Cost/Unit — Toxins" right={<span style={{ font: `700 18px ${FONT}`, color: C.ink }}>$3.12</span>} />
          <div style={{ font: `600 10px ${FONT}`, color: C.green, marginBottom: 6 }}>▲ 20.2% vs 24-mo avg</div>
          <InvSpark data={[2.4, 2.5, 2.6, 2.55, 2.7, 2.8, 2.85, 2.9, 3.0, 3.05, 3.1, 3.12]} h={70} />
        </Card>
        <Card>
          <CardTitle title="Weighted Avg Cost/Syringe — Fillers" right={<span style={{ font: `700 18px ${FONT}`, color: C.ink }}>$260</span>} />
          <div style={{ font: `600 10px ${FONT}`, color: C.green, marginBottom: 6 }}>▲ 26.3% vs 24-mo avg</div>
          <InvSpark data={[205, 210, 215, 222, 228, 235, 240, 246, 250, 255, 258, 260]} h={70} />
        </Card>
      </div>
    </div>
  );
};

// ---- Costing Sheet ----
const InvCostingSheetView = () => {
  const kpis = [
    { label: 'Products Tracked', value: '184', sub: 'with cost history' },
    { label: 'Tracking Window', value: '18 mo', sub: 'Dec ’24 – May ’26' },
    { label: 'Median Cost Change', value: '0.0%', sub: 'typical product vs BB' },
    { label: 'Cost Increases', value: '31', sub: 'products up >10%', color: C.clay },
    { label: 'Cost Decreases', value: '45', sub: 'products down >10%', color: C.teal },
  ];
  const avgCost = [
    { p: '4% Pure Retinol Peel (BB)', c: '$27.50' }, { p: 'Acne Peel (5x) (BB)', c: '$107.00' },
    { p: 'AHA BHA Hydroxy Mask (BB)', c: '$36.00' }, { p: 'Elastin Regenerating Skin Nectar', c: '$48.00' },
    { p: 'Average Vol (BB)', c: '$52.00' }, { p: 'B-12 (BB)', c: '$26.00' },
    { p: 'Beta Carotene (BB)', c: '$40.00' }, { p: 'Bakers Balance', c: '$130.00' },
    { p: 'TNS Ceramide Treatment Cream (BB)', c: '$66.00' },
  ];
  const inc = [
    { label: 'TNS Ceramide Treatment Cream', right: '+141.0%', pct: 100, color: C.red },
    { label: 'ZO Skin Rosatint Booster (BB)', right: '+98.7%', pct: 70, color: C.red },
    { label: 'ZO Skin Brightening Booster (BB)', right: '+76.4%', pct: 54, color: C.clay },
    { label: 'Restylane (Contour)', right: '+58.2%', pct: 41, color: C.clay },
    { label: 'SkinPen Tip', right: '+44.1%', pct: 31, color: C.clay },
    { label: '1% Clinical Active Serum', right: '+40.3%', pct: 29, color: C.clay },
  ];
  const dec = [
    { label: 'Eclipse PRP Kit (Kit)', right: '−80.7%', pct: 100, color: C.teal },
    { label: 'VE Peel - Purity', right: '−78.3%', pct: 97, color: C.teal },
    { label: 'Bakers Balance', right: '−75.6%', pct: 94, color: C.teal },
    { label: 'SkinMedica Instant Bright Eye Mask', right: '−75.1%', pct: 93, color: C.teal },
    { label: 'CoolSculpting Elite Treatment Card', right: '−70.4%', pct: 87, color: C.teal },
    { label: 'Microneedling - Tip', right: '−51.2%', pct: 63, color: C.teal },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvKpis items={kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Average Unit Cost by Product" sub="Latest unit cost vs 18-month baseline" /><div style={{ marginTop: 12 }}><InvTable cols={[{ h: 'Product', k: 'p', strong: true, w: '2fr' }, { h: 'Avg Unit Cost', k: 'c', align: 'right' }]} rows={avgCost} /></div></Card>
        <Card>
          <CardTitle title="TNS Ceramide Treatment Cream (BB)" sub="Largest cost increase in window" />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
            <span style={{ font: `500 13px ${FONT}`, color: C.gray3 }}>$27.36</span>
            <span style={{ font: `700 22px ${FONT}`, color: C.ink }}>→ $66.00</span>
            <span style={{ font: `600 12px ${FONT}`, color: C.red }}>+141.0%</span>
          </div>
          <InvSpark data={[27.36, 28, 30, 33, 38, 42, 47, 52, 58, 61, 64, 66]} h={80} color={C.red} />
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Biggest Cost Increases" sub="Largest unit-cost rise vs baseline" /><div style={{ marginTop: 16 }}>{inc.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
        <Card><CardTitle title="Biggest Cost Decreases" sub="Largest unit-cost drop vs baseline" /><div style={{ marginTop: 16 }}>{dec.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
      </div>
    </div>
  );
};

// ---- System vs Purchase Cost ----
const InvSystemCostView = () => {
  const kpis = [
    { label: 'SKUs With Drift', value: '33%', sub: 'vs latest PO', color: C.clay },
    { label: 'Flagged SKUs', value: '9', sub: '▲ vs prior', color: C.clay },
    { label: 'Total $ Mis-Valuation', value: '$20.3K', sub: 'system vs realized', color: C.red },
    { label: 'Avg Absolute Variance', value: '12.0%', sub: 'across flagged' },
  ];
  const drift = [
    { p: 'Dysport 300u', sup: 'Galderma', sc: '$400', po: '$452', dt: 'May 02', v: '+$52', vp: '+13.0%', up: true, fl: true },
    { p: 'Sculptra', sup: 'Galderma', sc: '$385', po: '$372', dt: 'Apr 28', v: '−$13', vp: '−3.4%', up: false, fl: false },
    { p: 'Juvederm Voluma', sup: 'Allergan', sc: '$309', po: '$324', dt: 'May 06', v: '+$15', vp: '+4.9%', up: true, fl: true },
    { p: 'Morpheus8 Tips', sup: 'InMode', sc: '$300', po: '$338', dt: 'Apr 22', v: '+$38', vp: '+12.7%', up: true, fl: true },
    { p: 'Nitrile Gloves M', sup: 'Amazon Business', sc: '$0.30', po: '$0.34', dt: 'May 04', v: '+$0.04', vp: '+13.3%', up: true, fl: true },
    { p: 'SkinVive', sup: 'Allergan', sc: '$260', po: '$245', dt: 'Apr 30', v: '−$15', vp: '−5.8%', up: false, fl: true },
    { p: 'Restylane Kysse', sup: 'Galderma', sc: '$305', po: '$318', dt: 'May 06', v: '+$13', vp: '+4.3%', up: true, fl: false },
    { p: 'PRF Tubes', sup: 'McKesson', sc: '$1.20', po: '$1.32', dt: 'May 01', v: '+$0.12', vp: '+10.0%', up: true, fl: true },
    { p: '31G Needles', sup: 'Amazon Business', sc: '$0.18', po: '$0.20', dt: 'Apr 26', v: '+$0.02', vp: '+11.1%', up: true, fl: true },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <Card>
        <CardTitle title="Costing Drift — System vs Latest Purchase" sub="System cost vs latest delivered PO unit cost · costing drift · Zenoti" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'Product', k: 'p', strong: true, w: '1.3fr' }, { h: 'Supplier', k: 'sup' },
              { h: 'System $', k: 'sc', align: 'right' }, { h: 'Latest PO $', k: 'po', align: 'right' }, { h: 'Latest', k: 'dt', align: 'right' },
              { h: 'Variance $', align: 'right', render: (r) => <span style={{ color: r.up ? C.clay : C.teal, fontWeight: 600 }}>{r.v}</span> },
              { h: 'Variance %', align: 'right', render: (r) => <span style={{ color: r.up ? C.clay : C.teal }}>{r.vp}</span> },
              { h: 'Flag', align: 'right', render: (r) => r.fl ? <InvPill text="Flag" tone="red" /> : <span style={{ color: C.gray2 }}>—</span> },
            ]}
            rows={drift}
          />
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <CardTitle title="Direction of Drift" sub="Is configured/system cost under- or over-stated vs realized purchase?" />
          <div style={{ marginTop: 16 }}>
            <InvBar label="System UNDERSTATED — system costs less than realized (14 SKUs)" right="$26.9K" pct={100} color={C.red} />
            <InvBar label="System OVERSTATED — system costs more than realized (6 SKUs)" right="$5.7K" pct={21} color={C.teal} />
          </div>
        </Card>
        <Card>
          <CardTitle title="System vs Latest Purchase" sub="Each dot = a SKU · above line = system understated" />
          <svg width="100%" height="150" viewBox="0 0 300 150" style={{ marginTop: 10 }}>
            <line x1="10" y1="140" x2="290" y2="10" stroke={C.line} strokeWidth="1" strokeDasharray="4 4" />
            {[[40, 120, 6, C.clay], [70, 95, 5, C.clay], [110, 105, 8, C.red], [140, 70, 5, C.clay], [170, 60, 6, C.red], [200, 80, 4, C.teal], [230, 40, 7, C.clay], [120, 50, 5, C.teal], [90, 75, 4, C.teal]].map((d, i) => <circle key={i} cx={d[0]} cy={d[1]} r={d[2]} fill={d[3]} fillOpacity="0.6" />)}
          </svg>
        </Card>
      </div>
    </div>
  );
};

// ---- PO Matching ----
const InvPOMatchingView = () => {
  const kpis = [
    { label: 'Exception Rate', value: '14%', sub: 'of POs not clean', color: C.clay },
    { label: 'Open Mismatches', value: '4', sub: 'qty / price' },
    { label: 'Price Mismatches', value: '5', sub: 'invoice ≠ PO', color: C.clay },
    { label: 'Unreconciled Invoices', value: '3', sub: 'aging concern', color: C.red },
    { label: '$ Exposure', value: '$32.9K', sub: 'open mismatches', color: C.red },
  ];
  const po = [
    { id: 'PO-4310', p: 'Dysport 300u', sup: 'Galderma', o: 20, r: 20, i: 20, m: '$9,040', st: ['Matched', 'teal'] },
    { id: 'PO-4502', p: 'Juvederm Voluma', sup: 'Allergan', o: 12, r: 12, i: 12, m: '$3,708', st: ['Matched', 'teal'] },
    { id: 'PO-4488', p: 'Sculptra', sup: 'Galderma', o: 24, r: 24, i: 24, m: '$9,240', st: ['Matched', 'teal'] },
    { id: 'PO-4471', p: 'Jeuveau 100u', sup: 'Evolus', o: 30, r: 30, i: 0, m: '$12,000', st: ['Missing invoice', 'red'] },
    { id: 'PO-4309', p: 'EltaMD UV Clear', sup: 'EltaMD', o: 80, r: 80, i: 80, m: '$2,080', st: ['Matched', 'teal'] },
    { id: 'PO-4456', p: 'Hydrafacial Boosters', sup: 'Hydrafacial', o: 40, r: 40, i: 40, m: '$1,880', st: ['Matched', 'teal'] },
    { id: 'PO-4505', p: 'Restylane Lyft', sup: 'Galderma', o: 24, r: 20, i: 24, m: '$5,640', st: ['Short-ship', 'clay'] },
    { id: 'PO-4495', p: 'EltaMD UV Clear', sup: 'EltaMD', o: 80, r: 80, i: 80, m: '$2,160', st: ['Price drift', 'amber'] },
    { id: 'PO-4478', p: 'Nitrile Gloves M', sup: 'Amazon Business', o: 40, r: 40, i: 40, m: '$12', st: ['Matched', 'teal'] },
    { id: 'PO-4443', p: 'Xeomin 100u', sup: 'Merz', o: 18, r: 18, i: 18, m: '$8,640', st: ['Price drift', 'amber'] },
    { id: 'PO-4467', p: 'Topical Numbing (BLT)', sup: 'Extremus', o: 50, r: 50, i: 50, m: '$480', st: ['Matched', 'teal'] },
    { id: 'PO-4451', p: 'Morpheus8 Tips', sup: 'InMode', o: 12, r: 14, i: 12, m: '$3,600', st: ['Qty over', 'clay'] },
    { id: 'PO-4396', p: 'Restylane Kysse', sup: 'Galderma', o: 16, r: 16, i: 0, m: '$4,880', st: ['Missing invoice', 'red'] },
  ];
  const exc = [
    { label: 'Qty short', right: '3', pct: 75, color: C.clay }, { label: 'Qty over', right: '1', pct: 25, color: C.clayLite },
    { label: 'Price up', right: '4', pct: 100, color: C.red }, { label: 'Price down', right: '1', pct: 25, color: C.teal },
    { label: 'Missing invoice', right: '2', pct: 50, color: C.redBright }, { label: 'Aging > 30d', right: '3', pct: 75, color: C.navy },
  ];
  const aging = [
    { label: '0–15 days', right: '5', pct: 100, color: C.teal }, { label: '16–30 days', right: '3', pct: 60, color: C.clay },
    { label: '31–60 days', right: '2', pct: 40, color: C.redBright }, { label: '60+ days', right: '1', pct: 20, color: C.red },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <Card>
        <CardTitle title="Three-Way Match — Ordered · Received · Invoiced" sub="Quantity and price match across PO, GRN and invoice · Zenoti" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'PO', k: 'id', strong: true }, { h: 'Product', k: 'p', w: '1.3fr' }, { h: 'Supplier', k: 'sup' },
              { h: 'Ord', k: 'o', align: 'right', w: '0.5fr' }, { h: 'Rec', k: 'r', align: 'right', w: '0.5fr' }, { h: 'Inv', k: 'i', align: 'right', w: '0.5fr' },
              { h: 'Match $', k: 'm', align: 'right' }, { h: 'Status', align: 'right', render: (r) => <InvPill text={r.st[0]} tone={r.st[1]} /> },
            ]}
            rows={po}
          />
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Exception Breakdown" /><div style={{ marginTop: 16 }}>{exc.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
        <Card><CardTitle title="Unreconciled PO Aging" sub="Open mismatches by age" /><div style={{ marginTop: 16 }}>{aging.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
      </div>
    </div>
  );
};

// ---- Inventory Movement ----
const InvMovementView = () => {
  const kpis = [
    { label: 'Beginning Inventory', value: '$1.56M', sub: 'at cost' },
    { label: 'Purchases', value: '+$406K', sub: 'delivered PO lines', color: C.teal },
    { label: 'Net Transfers', value: '+$3.1K', sub: 'inter-site', color: C.teal },
    { label: 'COGS / Consumed', value: '−$464K', sub: 'service + retail', color: C.red },
    { label: 'True-Ups / Adj', value: '+$1.1K', sub: 'net adjustments', color: C.teal },
    { label: 'Ending Inventory', value: '$1.50M', sub: 'computed roll-forward' },
  ];
  const wf = [
    { label: 'Beginning', right: '$1.56M', pct: 100, color: C.navy },
    { label: 'Purchases', right: '+$406K', pct: 26, color: C.teal },
    { label: 'Net Transfers', right: '+$3.1K', pct: 2, color: C.tealLite },
    { label: 'COGS / Consumed', right: '−$464K', pct: 30, color: C.clay },
    { label: 'Adjustments', right: '+$1.1K', pct: 2, color: C.tealLite },
    { label: 'Ending', right: '$1.50M', pct: 96, color: C.navy },
  ];
  const recon = [
    ['Beginning Inventory', '$1.56M'], ['Purchases', '+$406K'], ['Net Transfers', '+$3.1K'],
    ['COGS / Consumed', '−$464K'], ['Manual Adjustments', '+$1.1K'], ['Expected Ending', '$1.50M'],
  ];
  const roll = [
    { l: 'Warehouse', b: '$200K', pu: '+$210K', co: '−$180K', e: '$222K', v: '+$2.0K' },
    { l: 'Jersey City', b: '$89.4K', pu: '+$24.1K', co: '−$28.0K', e: '$88.9K', v: '−$0.5K' },
    { l: 'Bel Air', b: '$129K', pu: '+$31.0K', co: '−$33.0K', e: '$130K', v: '+$0.9K' },
    { l: 'Frederick', b: '$77.4K', pu: '+$18.2K', co: '−$19.0K', e: '$78.0K', v: '+$0.4K' },
    { l: 'Lancaster', b: '$55.7K', pu: '+$14.0K', co: '−$13.5K', e: '$56.3K', v: '+$0.6K' },
    { l: 'Bridgewater', b: '$102K', pu: '+$22.0K', co: '−$24.0K', e: '$101K', v: '−$0.7K' },
    { l: 'Montclair', b: '$89.9K', pu: '+$21.0K', co: '−$22.0K', e: '$90.1K', v: '+$0.2K' },
    { l: 'Denville', b: '$82.7K', pu: '+$19.5K', co: '−$20.0K', e: '$82.9K', v: '+$0.2K' },
    { l: 'Ridgewood', b: '$75.0K', pu: '+$17.0K', co: '−$18.0K', e: '$74.5K', v: '−$0.5K' },
    { l: 'Hoboken', b: '$129K', pu: '+$30.0K', co: '−$31.0K', e: '$129K', v: '+$0.1K' },
    { l: 'Waldorf', b: '$82.5K', pu: '+$19.0K', co: '−$20.0K', e: '$82.1K', v: '−$0.4K' },
    { l: 'Tribeca', b: '$112K', pu: '+$28.0K', co: '−$27.0K', e: '$113K', v: '+$0.8K' },
    { l: 'Red Bank', b: '$90.0K', pu: '+$21.0K', co: '−$21.5K', e: '$90.3K', v: '+$0.3K' },
    { l: 'Old Bridge', b: '$83.4K', pu: '+$20.0K', co: '−$20.0K', e: '$83.8K', v: '+$0.4K' },
    { l: 'Short Hills', b: '$124K', pu: '+$29.0K', co: '−$28.0K', e: '$125K', v: '+$0.6K' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Movement Waterfall" sub="Network roll-up · cost basis" /><div style={{ marginTop: 16 }}>{wf.map((b, i) => <InvBar key={i} {...b} />)}</div></Card>
        <Card>
          <CardTitle title="Reconciliation" sub="Expected vs actual ending — variance within tolerance" />
          <div style={{ marginTop: 12 }}>
            {recon.map((r, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.line3}`, font: `500 12px ${FONT}`, color: i === 5 ? C.ink : C.ink2, fontWeight: i === 5 ? 700 : 500 }}><span>{r[0]}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{r[1]}</span></div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '8px 11px', background: '#EAF5F0', borderRadius: 8, font: `600 12px ${FONT}`, color: C.teal }}><span>Unexplained Variance — Actual $1.50M</span><span>+$376</span></div>
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle title="Roll-Forward Table" sub="Beginning → purchases → consumed → ending, per location · cost basis" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'Location', k: 'l', strong: true }, { h: 'Beginning', k: 'b', align: 'right' },
              { h: 'Purchases', align: 'right', render: (r) => <span style={{ color: C.teal }}>{r.pu}</span> },
              { h: 'Consumed', align: 'right', render: (r) => <span style={{ color: C.clay }}>{r.co}</span> },
              { h: 'Ending', k: 'e', align: 'right', strong: true },
              { h: 'Variance', align: 'right', render: (r) => <span style={{ color: r.v.startsWith('−') ? C.clay : C.teal }}>{r.v}</span> },
            ]}
            rows={roll}
          />
        </div>
      </Card>
    </div>
  );
};

// ---- Transfers ----
const InvTransfersView = () => {
  const kpis = [
    { label: 'Open Transfers', value: '6', sub: 'in flight' },
    { label: 'In-Transit Value', value: '$19.5K', sub: 'at cost' },
    { label: 'Stuck Transfers', value: '4', sub: '> 14 days', color: C.red },
    { label: 'Qty Mismatch', value: '1', sub: 'sent ≠ received', color: C.clay },
    { label: 'Cost Discrepancy', value: '3', sub: 'value gaps', color: C.clay },
  ];
  const tx = [
    { id: 'PO-T308', p: 'Restylane Lyft', rt: 'Hoboken → Lancaster', q: 6, s: 'May 02', r: 'May 06', st: ['Received', 'teal'], c: '$1,830' },
    { id: 'PO-T299', p: 'Morpheus8 Tips', rt: 'Frederick → Montclair', q: 8, s: 'May 04', r: '—', st: ['In transit', 'clay'], c: '$2,400' },
    { id: 'PO-T321', p: 'Dysport 300u', rt: 'Jersey City → Waldorf', q: 20, s: 'Apr 22', r: '—', st: ['Stuck', 'red'], c: '$9,040' },
    { id: 'PO-T298', p: 'Juvederm Voluma', rt: 'Hoboken → Bel Air', q: 12, s: 'May 01', r: 'May 05', st: ['Qty mismatch', 'amber'], c: '$3,708' },
    { id: 'PO-T306', p: 'PRF Tubes', rt: 'Hoboken → Short Hills', q: 500, s: 'May 03', r: 'May 06', st: ['Received', 'teal'], c: '$600' },
    { id: 'PO-T334', p: 'Restylane Kysse', rt: 'Jersey City → Short Hills', q: 8, s: 'May 05', r: '—', st: ['In transit', 'clay'], c: '$2,440' },
    { id: 'PO-T324', p: 'Topical Numbing (BLT)', rt: 'Hoboken → Old Bridge', q: 30, s: 'Apr 28', r: '—', st: ['Stuck', 'red'], c: '$360' },
  ];
  const heat = [
    { label: 'Jersey City', cells: [0, 3, 2, 1, 4, 2] },
    { label: 'Hoboken', cells: [5, 0, 3, 2, 1, 4] },
    { label: 'Warehouse', cells: [4, 6, 0, 3, 2, 5] },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InvAlert />
      <InvKpis items={kpis} />
      <Card>
        <CardTitle title="Transfer Insights" sub="Sent vs received, in-transit aging & cost integrity · Zenoti" />
        <div style={{ marginTop: 12 }}>
          <InvTable
            cols={[
              { h: 'ID', k: 'id', strong: true }, { h: 'Product', k: 'p', w: '1.2fr' }, { h: 'Route', k: 'rt', w: '1.4fr' },
              { h: 'Qty', k: 'q', align: 'right', w: '0.5fr' }, { h: 'Sent', k: 's', align: 'right' }, { h: 'Received', k: 'r', align: 'right' },
              { h: 'Status', align: 'right', render: (r) => <InvPill text={r.st[0]} tone={r.st[1]} /> }, { h: 'Cost', k: 'c', align: 'right' },
            ]}
            rows={tx}
          />
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <Card><CardTitle title="Source → Destination Volume" sub="Transfer line count · rows = source · darker = more" /><div style={{ marginTop: 14 }}><InvHeat colLabels={['JC', 'Hob', 'WH', 'Bel', 'SH', 'Lan']} rows={heat} /></div></Card>
        <Card>
          <CardTitle title="What to Investigate" />
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, font: `500 11.5px ${FONT}`, color: C.ink2, lineHeight: 1.7 }}>
            <li><b>Restylane Kysse</b> & <b>Sculptra</b> repeatedly transferred OUT of Jersey City while still held over — possible firefighting; consider a standing direct order to the sink sites.</li>
            <li><b>Jersey City → Waldorf</b> Dysport stuck 8+ days — chase the carrier / confirm receipt.</li>
            <li><b>Hoboken → Bel Air</b> Juvederm qty mismatch (sent 12, received 10) — reconcile and adjust on-hand.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

const InvSoon = ({ name }) => (
  <Card style={{ textAlign: 'center', padding: '54px 22px' }}>
    <div style={{ font: `600 15px ${FONT}`, color: C.ink }}>{name}</div>
    <div style={{ font: `500 12px ${FONT}`, color: C.gray, marginTop: 6 }}>Replica in progress — building this view next.</div>
  </Card>
);

export default Dashboard;