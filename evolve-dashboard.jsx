import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, AreaChart, Area,
} from 'recharts';

const Dashboard = () => {
  const [selectedLocation, setSelectedLocation] = useState('All 14 locations');
  const [selectedMonth, setSelectedMonth] = useState('May 2026');
  const [activeView, setActiveView] = useState('Overview');

  const kpis = [
    { label: 'CASH SALES', mtd: '$1.12M', variance: '↑ 9.7%', projected: '$1.94M', projVariance: '↑ 10.4%' },
    { label: 'RECOGNIZED REVENUE', mtd: '$1.09M', variance: '↑ 12.3%', projected: '$1.88M', projVariance: '↑ 13.1%' },
  ];

  const financialMetrics = [
    { label: '% TO BUDGET VARIANCE TO GOAL', value: '94%', note: '▼ 6% to goal', isNegative: true },
    { label: '$$$ GROWTH YOY %', value: '+7.8%', note: '▲ 1.2 pt' },
    { label: 'PRIOR DAY SALES', value: '$71.2K', note: '▲ 4.3%' },
    { label: 'ASP (NEW)', value: '$395', note: '▲ 3.2%' },
    { label: 'ASP (EXISTING)', value: '$523', note: '▲ 4.6%' },
    { label: 'COGS MARGIN %', value: '21.3%', note: '▼ 0.6 pt' },
    { label: 'PAYROLL MARGIN %', value: '33.8%', note: '▼ 0.9 pt' },
  ];

  const operationalMetrics = [
    { label: 'NO-SHOW RATE', value: '4.2%', note: '▼ 0.5 pt' },
    { label: 'CANCELLATION RATE', value: '6.8%', note: '▼ 0.3 pt' },
    { label: 'MEMBERSHIP ADOPTION', value: '27.5%', note: '▲ 1.4 pt' },
    { label: 'REV / HR • PROVIDER', value: '$640', note: '▲ 5.1%' },
    { label: 'REV / HR • ESTHETICIAN', value: '$285', note: '▲ 2.8%' },
    { label: 'UTILIZATION • PROVIDER', value: '82.4%', note: '▲ 1.9 pt' },
    { label: 'UTILIZATION • ESTHETICIAN', value: '71.6%', note: '▲ 0.8 pt' },
    { label: 'REBOOK RATE %', value: '68.4%', note: '▲ 2.1 pt' },
  ];

  const marketingMetrics = [
    { label: 'NEW CUSTOMER VISITS', value: '3,980', note: '▲ 6.4%' },
    { label: 'EXISTING CUSTOMER VISITS', value: '8,860', note: '▲ 10.1%' },
    { label: 'MTD AD SPEND', value: '$148K', note: '▲ 5.2% MoM', highlight: true },
    { label: 'CLIENT ACQUISITION COST', value: '$372', note: '▼ 2.8%' },
    { label: 'NEW GUEST RETURN RATE • 90 DAY', value: '38%', note: '▲ 2.1 pt' },
  ];

  const detailedLocations = [
    { name: 'Hoboken', cash: '$342K', runRate: '108%', recRev: '$575K', cogs: '18.5%', payroll: '30.7%', util: '66%', newCust: 257, existCust: 1561, asp: '$461', aspExist: '$344', utilProvider: '86%', revHr: '$717', utilEsth: '75%', revHrEsth: '$218', rebook: '71%' },
    { name: 'Jersey City', cash: '$312K', runRate: '104%', recRev: '$548K', cogs: '18.9%', payroll: '31.4%', util: '65%', newCust: 230, existCust: 1397, asp: '$458', aspExist: '$342', utilProvider: '85%', revHr: '$706', utilEsth: '74%', revHrEsth: '$214', rebook: '70%' },
    { name: 'Montclair', cash: '$303K', runRate: '111%', recRev: '$521K', cogs: '18%', payroll: '30%', util: '67%', newCust: 219, existCust: 1329, asp: '$455', aspExist: '$340', utilProvider: '84%', revHr: '$695', utilEsth: '73%', revHrEsth: '$210', rebook: '72%' },
    { name: 'Short Hills', cash: '$295K', runRate: '99%', recRev: '$498K', cogs: '19.4%', payroll: '32.1%', util: '64%', newCust: 209, existCust: 1270, asp: '$452', aspExist: '$338', utilProvider: '83%', revHr: '$684', utilEsth: '72%', revHrEsth: '$206', rebook: '69%' },
    { name: 'Denville', cash: '$282K', runRate: '102%', recRev: '$467K', cogs: '18.9%', payroll: '31.4%', util: '65%', newCust: 196, existCust: 1191, asp: '$449', aspExist: '$336', utilProvider: '82%', revHr: '$673', utilEsth: '71%', revHrEsth: '$202', rebook: '70%' },
    { name: 'Red Bank', cash: '$245K', runRate: '96%', recRev: '$441K', cogs: '19.4%', payroll: '32.1%', util: '64%', newCust: 185, existCust: 1125, asp: '$446', aspExist: '$334', utilProvider: '81%', revHr: '$662', utilEsth: '70%', revHrEsth: '$198', rebook: '68%' },
    { name: 'Tribeca', cash: '$260K', runRate: '92%', recRev: '$458K', cogs: '20.3%', payroll: '33.5%', util: '62%', newCust: 192, existCust: 1168, asp: '$443', aspExist: '$332', utilProvider: '80%', revHr: '$651', utilEsth: '69%', revHrEsth: '$194', rebook: '67%' },
    { name: 'Bel Air', cash: '$228K', runRate: '101%', recRev: '$392K', cogs: '19.8%', payroll: '32.8%', util: '63%', newCust: 165, existCust: 1000, asp: '$440', aspExist: '$330', utilProvider: '79%', revHr: '$640', utilEsth: '68%', revHrEsth: '$190', rebook: '68%' },
    { name: 'Frederick', cash: '$219K', runRate: '88%', recRev: '$369K', cogs: '20.7%', payroll: '34.2%', util: '61%', newCust: 155, existCust: 941, asp: '$437', aspExist: '$328', utilProvider: '78%', revHr: '$629', utilEsth: '67%', revHrEsth: '$186', rebook: '66%' },
  ];

  const serviceMix = [
    { name: 'Neurotoxins', percentage: 28 },
    { name: 'Filler', percentage: 19 },
    { name: 'Laser Hair', percentage: 11 },
    { name: 'Body Contour', percentage: 9 },
    { name: 'Memberships', percentage: 7 },
    { name: 'Other', percentage: 26 },
  ];

  const productMix = [
    { name: 'Laser HR sessions', units: 2310 },
    { name: 'Retail / skincare', units: 1540 },
    { name: 'PRF tubes', units: 1240 },
    { name: 'Neurotoxin vials', units: 1230 },
    { name: 'Filler syringes', units: 1120 },
    { name: 'Microneedling tips', units: 640 },
    { name: 'Biostim vials', units: 188 },
  ];

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

  const MetricCard = ({ label, value, note, highlight = false }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-5 min-h-[135px]">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">{label}</p>
      <p className="text-3xl font-bold text-gray-950 mt-5">{value}</p>
      <p className={`text-xs font-semibold mt-2 ${highlight ? 'text-orange-600' : 'text-teal-600'}`}>{note}</p>
    </div>
  );

  const Header = ({ title, subtitle }) => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-9 py-7 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="px-5 py-3 rounded-lg border border-gray-300 bg-white text-sm">
            <option>All 14 locations</option>
            <option>Single Location</option>
          </select>

          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-5 py-3 rounded-lg border border-gray-300 bg-white text-sm">
            <option>May 2026</option>
            <option>April 2026</option>
          </select>

          <button className="px-6 py-3 rounded-lg bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700">Export</button>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      <Sidebar />

      <main className="ml-72 min-h-screen">
        {activeView === 'Finance' ? (
          <>
            <Header title="Finance" subtitle="Revenue, margin & profitability · May 2026" />
            <FinanceView />
          </>
        ) : activeView === 'Operations' ? (
          <>
            <Header title="Operations" subtitle="Capacity, utilization & throughput · May 2026" />
            <OperationsView />
          </>
        ) : activeView === 'Locations' ? (
          <>
            <Header title="Locations" subtitle="Momentum matrix · trailing 12 months · Jun 2025 – May 2026" />
            <LocationsView />
          </>
        ) : activeView === 'Acquisition' ? (
          <>
            <Header title="Marketing · Acquisition" subtitle="Spend, leads & acquisition funnel · May 2026" />
            <AcquisitionView />
          </>
        ) : activeView === 'Call Center' ? (
          <>
            <Header title="Call Center" subtitle="Lead response, agent performance & paid media · Aesthetix CRM" />
            <CallCenterView />
          </>
        ) : activeView === 'Clinical' ? (
          <>
            <Header title="Clinical" subtitle="Service volumes, units & outcomes · May 2026" />
            <ClinicalView />
          </>
        ) : activeView === 'Patients / CRM' ? (
          <>
            <Header title="Patients / CRM" subtitle="Acquisition, retention & lifetime value · May 2026" />
            <PatientsCRMView />
          </>
        ) : activeView === 'Staff / Providers' ? (
          <>
            <Header title="Staff / Providers" subtitle="Productivity & payroll · May 2026" />
            <StaffProvidersView />
          </>
        ) : activeView === 'Inventory' ? (
          <>
            <Header title="Inventory" subtitle="Stock, consumption & retail · May 2026" />
            <InventoryView />
          </>
        ) : activeView === 'Memberships' ? (
          <>
            <Header title="Memberships" subtitle="Recurring revenue & adoption · May 2026" />
            <MembershipsView />
          </>
        ) : activeView === 'Overview' ? (
          <>
            <Header title="Business Overview" subtitle="Performance across all locations · Month to date" />
            <OverviewView
              kpis={kpis}
              financialMetrics={financialMetrics}
              operationalMetrics={operationalMetrics}
              marketingMetrics={marketingMetrics}
              detailedLocations={detailedLocations}
              serviceMix={serviceMix}
              productMix={productMix}
              MetricCard={MetricCard}
            />
          </>
        ) : (
          <>
            <Header title={activeView} subtitle={`${activeView} · May 2026`} />
            <div className="px-9 py-8">
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                {activeView} view coming soon.
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

/* ---------------- OVERVIEW (unchanged content) ---------------- */

const OverviewView = ({ kpis, financialMetrics, operationalMetrics, marketingMetrics, detailedLocations, serviceMix, productMix, MetricCard }) => (
  <div className="px-9 py-8">
    <div className="grid grid-cols-2 gap-4 mb-8">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{kpi.label}</p>
          <div className="grid grid-cols-2 gap-6 mt-5">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">MTD</p>
              <p className="text-4xl font-bold mt-3">{kpi.mtd}</p>
              <p className="text-xs font-semibold text-teal-600 mt-2">{kpi.variance}</p>
            </div>
            <div className="border-l border-gray-200 pl-6">
              <p className="text-xs font-bold text-gray-400 uppercase">Projected · Run Rate</p>
              <p className="text-4xl font-bold mt-3">{kpi.projected}</p>
              <p className="text-xs font-semibold text-teal-600 mt-2">{kpi.projVariance}</p>
            </div>
          </div>
        </div>
      ))}
    </div>

    <SectionTitle title="Financial" />
    <div className="grid grid-cols-7 gap-4 mb-8">
      {financialMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
    </div>

    <SectionTitle title="Operational" />
    <div className="grid grid-cols-8 gap-4 mb-8">
      {operationalMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
    </div>

    <SectionTitle title="Marketing" />
    <div className="grid grid-cols-5 gap-4 mb-8">
      {marketingMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
    </div>

    <div className="grid grid-cols-2 gap-6 mb-8">
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold mb-6">Service Mix</h3>
        <div className="space-y-4">
          {serviceMix.map((service, idx) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#14b8a6', '#0d9488', '#17a697', '#7fd3c3', '#f59e0b', '#d1d5db'][idx] }}></div>
                <span className="text-sm text-gray-700">{service.name}</span>
              </div>
              <span className="text-sm font-bold">{service.percentage}%</span>
            </div>
          ))}
        </div>
        <p className="text-4xl font-bold mt-7">55%</p>
        <p className="text-xs text-gray-500">Injectables</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold mb-6">Product Mix</h3>
        <div className="space-y-4">
          {productMix.map((product) => (
            <div key={product.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-20 h-2 bg-teal-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500" style={{ width: `${(product.units / 2310) * 100}%` }}></div>
                </div>
                <span className="text-sm text-gray-700">{product.name}</span>
              </div>
              <span className="text-sm font-bold">{product.units}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-gray-200">
        <h2 className="text-lg font-bold">Location Performance</h2>
        <p className="text-xs text-gray-500 mt-1">Detailed metrics by location</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['LOCATION', 'CASH PROJ', 'RUN RATE', 'REC. REV', 'COGS%', 'PAYROLL%', 'UTIL%', 'NEW CUST', 'EXIST CUST', 'ASP NEW', 'ASP EXIST', 'UTIL PROV%', 'REV/HR', 'UTIL ESTH%', 'REV/HR ESTH', 'REBOOK%'].map((h) => (
                <th key={h} className="px-5 py-3 text-left font-bold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {detailedLocations.map((loc) => (
              <tr key={loc.name} className="hover:bg-gray-50">
                <td className="px-5 py-4 font-bold">{loc.name}</td>
                <td className="px-5 py-4">{loc.cash}</td>
                <td className={`px-5 py-4 font-bold ${parseInt(loc.runRate) >= 100 ? 'text-teal-600' : 'text-orange-600'}`}>{loc.runRate}</td>
                <td className="px-5 py-4">{loc.recRev}</td>
                <td className="px-5 py-4">{loc.cogs}</td>
                <td className="px-5 py-4">{loc.payroll}</td>
                <td className="px-5 py-4">{loc.util}</td>
                <td className="px-5 py-4">{loc.newCust}</td>
                <td className="px-5 py-4">{loc.existCust}</td>
                <td className="px-5 py-4">{loc.asp}</td>
                <td className="px-5 py-4">{loc.aspExist}</td>
                <td className="px-5 py-4">{loc.utilProvider}</td>
                <td className="px-5 py-4 font-bold text-teal-600">{loc.revHr}</td>
                <td className="px-5 py-4">{loc.utilEsth}</td>
                <td className="px-5 py-4 font-bold text-orange-600">{loc.revHrEsth}</td>
                <td className="px-5 py-4">{loc.rebook}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="grid grid-cols-5 gap-8">
        {[
          ['Total Locations', '14'],
          ['Total Cash Sales', '$2,942K'],
          ['Total Revenue', '$4,782K'],
          ['Avg Budget Attainment', '81%'],
          ['Avg Rebook Rate', '68%'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ---------------- FINANCE ---------------- */

const FinanceView = () => {
  const financeKpis = [
    { label: 'RECOGNIZED REVENUE', value: '$5.24M', note: '▲ 12.3%', positive: true },
    { label: 'GROSS PROFIT', value: '$3.36M', note: '▲ 13.1%', positive: true },
    { label: 'GROSS MARGIN', value: '64.2%', note: '▲ 1.8 pt', positive: true },
    { label: 'EBITDA', value: '$1.12M', note: '▲ 8.4%', positive: true },
    { label: 'EBITDA MARGIN', value: '21.4%', note: '▼ 0.7 pt', positive: false },
  ];

  // P&L rows: width is share of revenue bar; revenue = full
  const plRows = [
    { label: 'Recognized Revenue', amount: '$5.24M', width: 100, color: '#0f766e', muted: false },
    { label: 'COGS', amount: '($1.12M)', width: 21, color: '#f3b58a', muted: true },
    { label: 'Gross Profit', amount: '$3.36M', width: 64, color: '#0f766e', muted: false },
    { label: 'Payroll', amount: '($1.77M)', width: 34, color: '#c4b5fd', muted: true },
    { label: 'Operating Expense', amount: '($0.47M)', width: 9, color: '#cbd5e1', muted: true },
    { label: 'EBITDA', amount: '$1.12M', width: 21, color: '#14b8a6', muted: false },
  ];

  const marginTrend = [
    { m: 'Nov', Gross: 62.8, COGS: 22.0, Payroll: 35.6 },
    { m: 'Dec', Gross: 63.1, COGS: 21.8, Payroll: 35.2 },
    { m: 'Jan', Gross: 62.9, COGS: 22.1, Payroll: 35.0 },
    { m: 'Feb', Gross: 63.4, COGS: 21.6, Payroll: 34.6 },
    { m: 'Mar', Gross: 63.7, COGS: 21.5, Payroll: 34.4 },
    { m: 'Apr', Gross: 63.9, COGS: 21.4, Payroll: 34.0 },
    { m: 'May', Gross: 64.2, COGS: 21.3, Payroll: 33.8 },
  ];

  const serviceLine = [
    { name: 'Neurotoxins', amount: '$1.47M', pct: 28 },
    { name: 'Filler', amount: '$1.00M', pct: 19 },
    { name: 'Laser Hair Removal', amount: '$0.58M', pct: 11 },
    { name: 'Body Contouring', amount: '$0.47M', pct: 9 },
    { name: 'Skin Rejuvenation', amount: '$0.42M', pct: 8 },
    { name: 'Memberships', amount: '$0.37M', pct: 7 },
    { name: 'Facials', amount: '$0.31M', pct: 6 },
    { name: 'PRF', amount: '$0.26M', pct: 5 },
    { name: 'Retail', amount: '$0.21M', pct: 4 },
    { name: 'Other Injectables', amount: '$0.16M', pct: 3 },
  ];

  // Daily pacing — June 2026
  const pacingDays = [
    { d: 1, v: 8, type: 'below' },
    { d: 2, v: 78, type: 'beat' },
    { d: 3, v: 80, type: 'beat' },
    { d: 4, v: 74, type: 'beat' },
    { d: 5, v: 76, type: 'beat' },
    { d: 6, v: 40, type: 'near' },
    { d: 7, v: 5, type: 'below', label: '$5K' },
    { d: 8, v: 12, type: 'below' },
    { d: 9, v: 92, type: 'beat' },
    { d: 10, v: 95, type: 'beat', label: '$95K' },
    { d: 11, v: 66, type: 'beat' },
    { d: 12, v: 70, type: 'beat' },
    { d: 13, v: 44, type: 'near' },
    { d: 14, v: 10, type: 'below' },
    { d: 15, v: 14, type: 'below' },
    { d: 16, v: 72, type: 'beat' },
    { d: 17, v: 76, type: 'beat' },
    { d: 18, v: 78, type: 'beat' },
    { d: 19, v: 64, type: 'beat' },
    { d: 20, v: 42, type: 'near' },
    { d: 21, v: 10, type: 'below' },
    { d: 22, v: 16, type: 'below' },
    { d: 23, v: 80, type: 'proj' },
    { d: 24, v: 86, type: 'proj' },
    { d: 25, v: 78, type: 'proj' },
    { d: 26, v: 74, type: 'proj' },
    { d: 27, v: 36, type: 'proj' },
    { d: 28, v: 10, type: 'proj' },
    { d: 29, v: 14, type: 'proj' },
    { d: 30, v: 82, type: 'proj' },
  ];
  const paceColors = { beat: '#0f766e', near: '#f0c9a0', below: '#e9967a', proj: '#a7d8cf' };

  // Pipeline rest of month
  const pipeline = [
    { label: 'APPOINTMENTS BOOKED', value: '2,140', note: 'Jun 23 – 30' },
    { label: 'IMPLIED REVENUE @ $302 ASP', value: '$646K', note: 'if every booking shows' },
    { label: 'PROBABILITY-ADJUSTED', value: '$576K', note: '−4.1% no-show · −6.8% cancel' },
    { label: 'ADJUSTED FINISH', value: '$1.71M', note: 'MTD + booked pipeline' },
  ];

  // Revenue mix by service (with COGS overlay portion)
  const revMix = [
    { name: 'Injectables', amount: '$3.19M', pct: '60.8%', width: 100, cogs: 38 },
    { name: 'Memberships', amount: '$673K', pct: '12.8%', width: 21, cogs: 5 },
    { name: 'Skin Rejuvenation', amount: '$348K', pct: '6.6%', width: 11, cogs: 4 },
    { name: 'Laser Hair', amount: '$272K', pct: '5.2%', width: 8.5, cogs: 3 },
    { name: 'Facials', amount: '$199K', pct: '3.8%', width: 6.2, cogs: 2.5 },
    { name: 'Retail', amount: '$162K', pct: '3.1%', width: 5, cogs: 3 },
    { name: 'Body Contouring', amount: '$157K', pct: '3.0%', width: 4.9, cogs: 2 },
    { name: 'PRF', amount: '$110K', pct: '2.1%', width: 3.4, cogs: 1.2 },
    { name: 'Other', amount: '$129K', pct: '2.5%', width: 4, cogs: 1.5 },
  ];

  // Injectables scatter: units sold (log) vs revenue per unit
  const scatter = [
    { x: 60, y: 80, name: 'Biostim' },
    { x: 90, y: 84, name: 'PRF premium' },
    { x: 80, y: 70, name: 'Specialty filler' },
    { x: 720, y: 36, name: 'Filler syringes' },
    { x: 900, y: 34, name: 'Neurotoxin units' },
    { x: 1800, y: 22, name: 'Tox touch-ups' },
  ];

  // This week vs last week (diverging from each location's last-week tick)
  const weekRows = [
    { name: 'Montclair', wtd: 51, delta: '+$4K', up: true, fill: 81, tick: 76 },
    { name: 'Tribeca', wtd: 26, delta: '+$2K', up: true, fill: 49, tick: 45 },
    { name: 'Bel Air', wtd: 18, delta: '+$2K', up: true, fill: 36, tick: 33 },
    { name: 'Waldorf', wtd: 15, delta: '+$1K', up: true, fill: 30, tick: 28 },
    { name: 'Frederick', wtd: 14, delta: '−$1K', up: false, fill: 28, tick: 31 },
    { name: 'Lancaster', wtd: 12, delta: '−$1K', up: false, fill: 24, tick: 28 },
    { name: 'Glenwood', wtd: 11, delta: '−$2K', up: false, fill: 22, tick: 28 },
    { name: 'Jersey City', wtd: 54, delta: '−$4K', up: false, fill: 70, tick: 78 },
    { name: 'Denville', wtd: 41, delta: '−$7K', up: false, fill: 56, tick: 66 },
    { name: 'Short Hills', wtd: 44, delta: '−$8K', up: false, fill: 60, tick: 72 },
    { name: 'Hoboken', wtd: 62, delta: '−$9K', up: false, fill: 80, tick: 92 },
    { name: 'Red Bank', wtd: 33, delta: '−$12K', up: false, fill: 47, tick: 60 },
    { name: 'Bridgewater', wtd: 8, delta: '−$14K', up: false, fill: 14, tick: 28 },
    { name: 'Ridgewood', wtd: 19, delta: '−$19K', up: false, fill: 38, tick: 56 },
  ];

  return (
    <div className="px-9 py-8 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        {financeKpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className={`text-xs font-semibold mt-2 ${k.positive ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
          </div>
        ))}
      </div>

      {/* P&L + Margin Trend */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">P&amp;L Summary</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">May 2026 · all locations</p>
          <div className="space-y-5">
            {plRows.map((r) => (
              <div key={r.label} className="flex items-center gap-4">
                <span className={`w-40 text-sm font-semibold ${r.muted ? 'text-orange-600' : 'text-gray-900'}`}>{r.label}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md" style={{ width: `${r.width}%`, backgroundColor: r.color }}></div>
                </div>
                <span className={`w-24 text-right text-sm font-bold ${r.muted ? 'text-orange-600' : 'text-gray-900'}`}>{r.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Margin Trend</h3>
            <div className="flex items-center gap-4 text-xs">
              <Legend color="#0f766e" label="Gross" />
              <Legend color="#e9967a" label="COGS" />
              <Legend color="#c4b5fd" label="Payroll" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTrend} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis hide domain={[15, 70]} />
                <Line type="monotone" dataKey="Gross" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Payroll" stroke="#c4b5fd" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="COGS" stroke="#e9967a" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue by Service Line */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Revenue by Service Line</h3>
          <span className="text-xs text-gray-500">May 2026 · % of total</span>
        </div>
        <div className="space-y-4">
          {serviceLine.map((s) => (
            <div key={s.name} className="flex items-center gap-4">
              <span className="w-40 text-sm text-gray-700">{s.name}</span>
              <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${(s.pct / 28) * 100}%` }}></div>
              </div>
              <span className="w-20 text-right text-sm font-bold tabular-nums">{s.amount}</span>
              <span className="w-10 text-right text-xs text-gray-400 tabular-nums">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Month-in-View Revenue Pacing */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold">Month-in-View Revenue Pacing</h3>
        <p className="text-xs text-gray-500 mt-1 mb-6">Daily net sales vs required pace · June 2026</p>

        <div className="flex gap-8 items-start mb-8">
          <div className="flex gap-8">
            <PacingStat label="FULL-MONTH BUDGET" value="$1.95M" note="June 2026" />
            <PacingStat label="MTD ACTUAL" value="$1.13M" note="through Jun 22" />
            <PacingStat label="% TO GOAL" value="58%" note="of full-month budget" />
            <PacingStat label="DAYS REMAINING" value="8" note="of 30" />
          </div>
          <div className="flex-1 bg-orange-50 rounded-xl p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">MOMENTUM · AT CURRENT PACE</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">−$357K below budget</p>
            <p className="text-xs text-gray-600 mt-2">Projecting ≈$1.59M finish vs $1.95M goal · needs $103K/day to close (run rate $51K/day)</p>
          </div>
        </div>

        {/* daily bar chart */}
        <div className="relative">
          <div className="flex items-end justify-between gap-1 h-56 border-b border-gray-200 relative">
            {/* required pace dashed line ~ at 65 of 100 scale */}
            <div className="absolute left-0 right-0 border-t border-dashed border-gray-400" style={{ bottom: '65%' }}></div>
            <div className="absolute right-0 -translate-y-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded" style={{ bottom: '65%' }}>Req. $65K / day</div>
            {pacingDays.map((day) => (
              <div key={day.d} className="flex-1 flex flex-col items-center justify-end h-full">
                {day.label && <span className="text-[10px] font-semibold text-gray-700 mb-1">{day.label}</span>}
                <div className="w-full rounded-t" style={{ height: `${day.v}%`, backgroundColor: paceColors[day.type] }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-1 mt-1">
            {pacingDays.map((day) => (
              <span key={day.d} className="flex-1 text-center text-[9px] text-gray-400">{day.d}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6 mt-5 text-xs text-gray-600">
          <Legend color={paceColors.beat} label="Beat pace (≥$65K)" />
          <Legend color={paceColors.near} label="Near pace" />
          <Legend color={paceColors.below} label="Below pace" />
          <Legend color={paceColors.proj} label="Projected (run rate)" />
        </div>
      </div>

      {/* Pipeline · Rest of Month */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <p className="text-xs font-bold text-teal-700 uppercase tracking-[3px] mb-5">PIPELINE · REST OF MONTH</p>
        <div className="grid grid-cols-4 gap-6">
          {pipeline.map((p, i) => (
            <div key={p.label} className={i > 0 ? 'border-l border-gray-200 pl-6' : ''}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{p.label}</p>
              <p className="text-3xl font-bold mt-3 tabular-nums">{p.value}</p>
              <p className="text-xs text-gray-500 mt-2">{p.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Mix + Scatter */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Revenue Mix by Service</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">Net sales · hatched overlay = cost of goods · May 2026</p>
          <div className="space-y-3">
            {revMix.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800">{r.name}</span>
                  <span className="text-sm font-bold tabular-nums">
                    {r.amount} <span className="text-gray-400 font-normal text-xs">{r.pct}</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full relative" style={{ width: `${r.width}%`, backgroundColor: '#2f9e8f' }}>
                    <div className="absolute inset-y-0 left-0 opacity-70" style={{ width: `${r.cogs}%`, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 6px)' }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-6 text-xs text-gray-600">
            <Legend color="#2f9e8f" label="Net sales (gross profit visible)" />
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #9ca3af 0 3px, #e5e7eb 3px 6px)' }}></span>
              Cost of goods
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Injectables · Revenue per Unit</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">Volume vs revenue per unit · log-log · top-right = stars</p>
          <div className="h-64 relative">
            <span className="absolute top-2 right-2 text-[10px] tracking-widest text-gray-300 font-semibold z-10">HIGH VOL · HIGH $/UNIT</span>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <XAxis type="number" dataKey="x" scale="log" domain={[40, 2400]} hide />
                <YAxis type="number" dataKey="y" domain={[10, 95]} hide />
                <ZAxis range={[260, 260]} />
                <Scatter data={scatter}>
                  {scatter.map((p, i) => (
                    <Cell key={i} fill={p.y > 60 ? '#3b465c' : '#2f9e8f'} />
                  ))}
                </Scatter>
                {/* quadrant guides via reference-free CSS overlay below */}
              </ScatterChart>
            </ResponsiveContainer>
            <div className="absolute inset-x-10 top-0 bottom-9 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 border-l border-gray-100"></div>
              <div className="absolute top-1/2 left-0 right-0 border-t border-gray-100"></div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">Units sold (log scale) →</p>
        </div>
      </div>

      {/* This Week vs Last Week */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold">This Week vs. Last Week</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">WTD net sales by location · day-normalized · tick marks last week's same-day point</p>
        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 mb-6">
          Through Thursday, the chain is running <span className="text-orange-600 font-bold">−14.3%</span> vs the same point last week ($408K vs $476K WTD) — pacing to ≈$720K weekly total.
        </div>
        <div className="space-y-2.5">
          {weekRows.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className={`w-24 text-sm ${r.up ? 'text-gray-800' : 'text-gray-700'}`}>{r.name}</span>
              <div className="flex-1 relative h-5 bg-gray-100 rounded-md">
                <div
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{
                    width: `${r.fill}%`,
                    background: r.up
                      ? 'linear-gradient(90deg,#0f766e,#2f9e8f)'
                      : 'linear-gradient(90deg,#e6a888,#edb89c)',
                  }}
                ></div>
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-800" style={{ left: `${r.tick}%` }}></div>
              </div>
              <span className="w-14 text-right text-sm font-bold tabular-nums">${r.wtd}K</span>
              <span className={`w-14 text-right text-sm font-semibold tabular-nums ${r.up ? 'text-teal-600' : 'text-orange-600'}`}>{r.delta}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 mt-5 text-xs text-gray-600">
          <Legend color="#2f9e8f" label="This week WTD" />
          <span className="flex items-center gap-2">
            <span className="w-0.5 h-3 bg-gray-800"></span>
            Last week · same point
          </span>
        </div>
      </div>
    </div>
  );
};

const PacingStat = ({ label, value, note }) => (
  <div>
    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-tight max-w-[110px]">{label}</p>
    <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{note}</p>
  </div>
);

const Legend = ({ color, label }) => (
  <span className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }}></span>
    {label}
  </span>
);

/* ---------------- OPERATIONS ---------------- */

const OperationsView = () => {
  const opsKpis = [
    { label: 'PROVIDER UTILIZATION', value: '82.4%', note: '▲ 1.9 pt', positive: true },
    { label: 'ESTHETICIAN UTILIZATION', value: '71.6%', note: '▲ 0.8 pt', positive: true },
    { label: 'APPOINTMENTS COMPLETED', value: '12,840', note: '▲ 7.2%', positive: true },
    { label: 'NO-SHOW RATE', value: '4.1%', note: '▼ 0.5 pt', positive: true },
    { label: 'AVG BOOKING LEAD TIME', value: '9.2 days', note: '▲ 0.4 d', positive: false },
  ];

  // Booked vs completed, 6 weeks
  const apptWeeks = [
    { booked: 70, completed: 60 },
    { booked: 73, completed: 64 },
    { booked: 78, completed: 70 },
    { booked: 80, completed: 71 },
    { booked: 86, completed: 78 },
    { booked: 90, completed: 80 },
  ];

  const lostCapacity = [
    { label: 'No-show / late cancel', pct: '4.1%', width: 18 },
    { label: 'Unbooked open hours', pct: '11.3%', width: 50 },
    { label: 'Same-day cancellations', pct: '2.8%', width: 12 },
    { label: 'Blocked / admin time', pct: '6.0%', width: 27 },
  ];

  // Ordered by open date (oldest first)
  const opsLocations = [
    { name: 'Hoboken', util: 86, esth: '75%', noshow: '3.5%', appts: 643, lead: '6.5d', alert: false },
    { name: 'Jersey City', util: 85, esth: '74%', noshow: '3.6%', appts: 575, lead: '6.8d', alert: false },
    { name: 'Montclair', util: 84, esth: '73%', noshow: '3.8%', appts: 547, lead: '7.0d', alert: false },
    { name: 'Short Hills', util: 83, esth: '72%', noshow: '3.9%', appts: 523, lead: '7.3d', alert: false },
    { name: 'Denville', util: 82, esth: '71%', noshow: '4.0%', appts: 490, lead: '7.5d', alert: false },
    { name: 'Red Bank', util: 81, esth: '70%', noshow: '4.1%', appts: 463, lead: '7.8d', alert: false },
    { name: 'Tribeca', util: 80, esth: '69%', noshow: '4.3%', appts: 481, lead: '8.0d', alert: false },
    { name: 'Bel Air', util: 79, esth: '68%', noshow: '4.4%', appts: 412, lead: '8.3d', alert: false },
    { name: 'Frederick', util: 78, esth: '67%', noshow: '4.5%', appts: 387, lead: '8.5d', alert: false },
    { name: 'Ridgewood', util: 80, esth: '69%', noshow: '4.3%', appts: 372, lead: '8.0d', alert: false },
    { name: 'Waldorf', util: 66, esth: '55%', noshow: '6.0%', appts: 154, lead: '11.5d', alert: false },
    { name: 'Glenwood', util: 64, esth: '53%', noshow: '6.3%', appts: 138, lead: '12.0d', alert: true },
    { name: 'Bridgewater', util: 60, esth: '49%', noshow: '6.8%', appts: 82, lead: '13.0d', alert: true },
    { name: 'Lancaster', util: 59, esth: '48%', noshow: '6.9%', appts: 75, lead: '13.3d', alert: true },
  ];

  const heatStats = [
    { label: 'BUSIEST DAY', value: 'Tuesday', slow: false },
    { label: 'BUSIEST HOUR', value: '12 PM', slow: false },
    { label: 'BUSIEST DAY + HOUR', value: 'Tue 12 PM', slow: false },
    { label: 'SLOWEST DAY', value: 'Monday', slow: true },
    { label: 'SLOWEST HOUR', value: '9 AM', slow: true },
    { label: 'SLOWEST DAY + HOUR', value: 'Thu 9 AM', slow: true },
  ];

  const heatHours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
  const heatDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // values in $K; Mon is lowest, midweek noon peaks
  const heat = {
    '9 AM':  [0.203, 1.4, 1.6, 1.5, 1.5, 0.677],
    '10 AM': [0.521, 3.5, 4.0, 3.9, 3.9, 1.7],
    '11 AM': [0.771, 5.1, 5.9, 5.8, 5.7, 2.6],
    '12 PM': [0.823, 5.5, 6.3, 6.2, 6.1, 2.7],
    '1 PM':  [0.726, 4.8, 5.6, 5.5, 5.4, 2.4],
    '2 PM':  [0.692, 4.6, 5.3, 5.2, 5.2, 2.3],
    '3 PM':  [0.681, 4.5, 5.2, 5.2, 5.1, 2.3],
    '4 PM':  [0.784, 5.2, 6.0, 5.9, 5.8, 2.6],
    '5 PM':  [0.738, 4.9, 5.7, 5.6, 5.5, 2.5],
    '6 PM':  [0.411, 2.7, 3.2, 3.1, 3.1, 1.4],
    '7 PM':  [0.264, 1.8, 2.0, 2.0, 2.0, 0.878],
  };
  const fmtK = (v) => (v < 1 ? `$${Math.round(v * 1000)}` : `$${v.toFixed(1)}K`);
  const heatColor = (v) => {
    // 0..6.3 scale -> teal intensity
    const t = Math.min(v / 6.3, 1);
    if (t < 0.12) return { bg: '#f3f4f6', fg: '#9ca3af' };
    if (t < 0.45) return { bg: '#cfeae4', fg: '#374151' };
    if (t < 0.7) return { bg: '#6fc3b3', fg: '#06302a' };
    return { bg: '#0f8a78', fg: '#ffffff' };
  };

  const opportunity = [
    { slot: 'Monday 9–11 AM', value: '$28,400/mo', locs: '14 locations', width: 96 },
    { slot: 'Weekday 6–7 PM', value: '$21,900/mo', locs: '12 locations', width: 74 },
    { slot: 'Thursday 9–10 AM', value: '$16,200/mo', locs: '11 locations', width: 55 },
    { slot: 'Saturday 4–6 PM', value: '$13,800/mo', locs: '9 locations', width: 47 },
    { slot: 'Monday 12–2 PM', value: '$11,400/mo', locs: '10 locations', width: 38 },
  ];

  const [heatMode, setHeatMode] = useState('Cash Sales');

  return (
    <div className="px-9 py-8 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        {opsKpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide leading-tight">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className={`text-xs font-semibold mt-2 ${k.positive ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
          </div>
        ))}
      </div>

      {/* Appointments + Lost Capacity */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Appointments</h3>
            <span className="text-xs text-gray-500">Booked vs completed · weekly</span>
          </div>
          <div className="h-64 flex items-end justify-around gap-6 border-b border-gray-100 pb-px">
            {apptWeeks.map((w, i) => (
              <div key={i} className="flex items-end gap-1.5 h-full">
                <div className="w-7 rounded-t bg-teal-100" style={{ height: `${w.booked}%` }}></div>
                <div className="w-7 rounded-t bg-teal-700" style={{ height: `${w.completed}%` }}></div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-6 mt-5 text-xs text-gray-600">
            <Legend color="#ccfbf1" label="Booked" />
            <Legend color="#0f766e" label="Completed" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Lost Capacity</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">Share of bookable hours · May 2026</p>
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
        </div>
      </div>

      {/* Utilization & Throughput by Location */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <h3 className="text-lg font-bold">Utilization &amp; Throughput by Location</h3>
          <span className="text-xs text-gray-500">Ordered by open date</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="px-6 py-3 text-left font-bold">LOCATION</th>
              <th className="px-6 py-3 text-left font-bold">PROVIDER UTIL</th>
              <th className="px-6 py-3 text-right font-bold">ESTH UTIL</th>
              <th className="px-6 py-3 text-right font-bold">NO-SHOW</th>
              <th className="px-6 py-3 text-right font-bold">APPTS</th>
              <th className="px-6 py-3 text-right font-bold">LEAD TIME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {opsLocations.map((loc) => (
              <tr key={loc.name} className="hover:bg-gray-50">
                <td className="px-6 py-3.5 font-bold text-gray-900">{loc.name}</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-40 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${loc.util}%` }}></div>
                    </div>
                    <span className="font-semibold tabular-nums">{loc.util}%</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-right tabular-nums">{loc.esth}</td>
                <td className={`px-6 py-3.5 text-right tabular-nums ${loc.alert ? 'text-orange-600 font-semibold' : ''}`}>{loc.noshow}</td>
                <td className="px-6 py-3.5 text-right tabular-nums">{loc.appts}</td>
                <td className="px-6 py-3.5 text-right tabular-nums">{loc.lead}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Operating Hours Heatmap */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold">Operating Hours Heatmap</h3>
            <p className="text-xs text-gray-500 mt-1">Demand by day &amp; hour · 14 locations · May 2026</p>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {['Cash Sales', 'Visits'].map((m) => (
              <button
                key={m}
                onClick={() => setHeatMode(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold ${heatMode === m ? 'bg-teal-700 text-white' : 'text-gray-600'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3 mb-7">
          {heatStats.map((s) => (
            <div key={s.label} className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-tight">{s.label}</p>
              <p className={`text-xl font-bold mt-3 ${s.slow ? 'text-orange-600' : 'text-teal-700'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          {/* grid */}
          <div className="flex-1">
            <div className="flex">
              <div className="w-12"></div>
              {heatDays.map((d) => (
                <div key={d} className="flex-1 text-center text-xs font-semibold text-gray-500 pb-2">{d}</div>
              ))}
            </div>
            {heatHours.map((h) => (
              <div key={h} className="flex items-center mb-1">
                <div className="w-12 text-xs text-gray-400 text-right pr-2">{h}</div>
                {heat[h].map((v, i) => {
                  const c = heatColor(v);
                  return (
                    <div key={i} className="flex-1 mx-0.5">
                      <div className="rounded-md text-center text-[11px] font-medium py-2" style={{ backgroundColor: c.bg, color: c.fg }}>
                        {fmtK(v)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* opportunity cost panel */}
          <div className="w-80 bg-orange-50 rounded-xl p-5">
            <h4 className="font-bold text-gray-900">Opportunity Cost</h4>
            <p className="text-xs text-gray-500 mt-1 mb-5">Top underutilized slots · est. monthly recovery if filled to chain util average</p>
            <div className="space-y-4">
              {opportunity.map((o) => (
                <div key={o.slot}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{o.slot}</span>
                    <span className="text-sm font-bold text-orange-600 tabular-nums">{o.value}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${o.width}%`, backgroundColor: '#e6a888' }}></div>
                    </div>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">{o.locs}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-orange-200 mt-5 pt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total recoverable</span>
              <span className="text-sm font-bold text-orange-600 tabular-nums">$91,700/mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- LOCATIONS ---------------- */

const LocationsView = () => {
  const metricTabs = ['Total Sales', 'YoY %', 'New Guests', 'Existing Guests', 'Total ASP', 'ASP (New)', 'ASP (Existing)', 'Rebooking Rate', 'Google Rating'];
  const [activeMetric, setActiveMetric] = useState('Total Sales');
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];

  // Each metric: rows already ordered as shown (accelerating first), with its own formatter.
  // m = 'Accelerating' | 'Stable' | 'Decelerating'
  const datasets = {
    'Total Sales': {
      fmt: (v) => `$${v}K`,
      rows: [
        { name: 'Bel Air', v: [180, 202, 243, 269, 295, 322, 361, 344, 371, 415, 465, 520], m: 'Accelerating' },
        { name: 'Glenwood', v: [86, 90, 102, 108, 113, 117, 143, 117, 119, 146, 149, 162], m: 'Accelerating' },
        { name: 'Ridgewood', v: [247, 274, 259, 287, 317, 349, 353, 304, 344, 394, 401, 412], m: 'Accelerating' },
        { name: 'Denville', v: [284, 304, 311, 374, 397, 420, 459, 426, 450, 511, 523, 575], m: 'Accelerating' },
        { name: 'Short Hills', v: [416, 450, 415, 449, 485, 524, 519, 438, 474, 533, 576, 581], m: 'Accelerating' },
        { name: 'Hoboken', v: [411, 456, 486, 536, 528, 582, 666, 506, 549, 630, 685, 701], m: 'Accelerating' },
        { name: 'Montclair', v: [386, 399, 446, 461, 470, 483, 582, 468, 477, 512, 576, 620], m: 'Accelerating' },
        { name: 'Jersey City', v: [573, 574, 550, 549, 546, 614, 633, 491, 489, 572, 559, 581], m: 'Accelerating' },
        { name: 'Bridgewater', v: [72, 77, 79, 74, 78, 83, 91, 75, 72, 79, 77, 86], m: 'Accelerating' },
        { name: 'Waldorf', v: [171, 168, 158, 174, 172, 168, 168, 144, 138, 139, 144, 145], m: 'Decelerating' },
        { name: 'Red Bank', v: [570, 624, 577, 556, 530, 572, 562, 416, 391, 432, 415, 401], m: 'Decelerating' },
        { name: 'Lancaster', v: [97, 106, 98, 94, 88, 95, 93, 68, 64, 70, 60, 57], m: 'Decelerating' },
        { name: 'Frederick', v: [473, 518, 482, 465, 447, 483, 478, 355, 337, 330, 321, 313], m: 'Decelerating' },
        { name: 'Tribeca', v: [666, 679, 666, 598, 606, 607, 630, 431, 428, 435, 413, 367], m: 'Decelerating' },
      ],
    },
    'YoY %': {
      fmt: (v) => `+${v}%`,
      rows: [
        { name: 'Montclair', v: [7, 9, 5, 7, 9, 11, 6, 8, 11, 14, 15, 13], m: 'Accelerating' },
        { name: 'Glenwood', v: [12, 15, 12, 14, 18, 21, 16, 20, 23, 27, 31, 30], m: 'Accelerating' },
        { name: 'Denville', v: [5, 7, 3, 5, 8, 10, 5, 8, 11, 15, 11, 9], m: 'Accelerating' },
        { name: 'Bel Air', v: [4, 6, 3, 5, 8, 11, 6, 9, 13, 6, 16, 15], m: 'Accelerating' },
        { name: 'Ridgewood', v: [7, 7, 6, 5, 10, 9, 8, 6, 15, 13, 16, 8], m: 'Accelerating' },
        { name: 'Bridgewater', v: [20, 19, 18, 17, 24, 23, 21, 20, 18, 26, 21, 24], m: 'Accelerating' },
        { name: 'Hoboken', v: [6, 5, 4, 9, 8, 7, 5, 12, 12, 10, 15, 7], m: 'Accelerating' },
        { name: 'Tribeca', v: [9, 17, 14, 11, 8, 16, 13, 10, 7, 13, 9, 10], m: 'Accelerating' },
        { name: 'Short Hills', v: [4, 9, 8, 7, 5, 11, 10, 8, 15, 13, 9, 12], m: 'Accelerating' },
        { name: 'Jersey City', v: [4, 6, 9, 11, 6, 8, 10, 13, 7, 9, 11, 9], m: 'Stable' },
        { name: 'Red Bank', v: [10, 12, 15, 8, 11, 13, 16, 8, 8, 10, 11, 8], m: 'Decelerating' },
        { name: 'Frederick', v: [13, 15, 8, 10, 13, 6, 8, 10, 13, 6, 12, 10], m: 'Decelerating' },
        { name: 'Waldorf', v: [22, 25, 19, 22, 24, 26, 20, 22, 26, 18, 20, 18], m: 'Decelerating' },
        { name: 'Lancaster', v: [27, 30, 22, 25, 27, 29, 20, 22, 25, 17, 19, 15], m: 'Decelerating' },
      ],
    },
    'New Guests': {
      fmt: (v) => `${v}`,
      rows: [
        { name: 'Bel Air', v: [73, 87, 99, 116, 120, 139, 165, 147, 151, 180, 195, 206], m: 'Accelerating' },
        { name: 'Denville', v: [124, 124, 135, 152, 172, 171, 199, 173, 196, 202, 239, 248], m: 'Accelerating' },
        { name: 'Ridgewood', v: [96, 113, 113, 119, 124, 146, 157, 127, 133, 163, 164, 179], m: 'Accelerating' },
        { name: 'Glenwood', v: [35, 39, 41, 46, 46, 51, 58, 50, 53, 61, 63, 65], m: 'Accelerating' },
        { name: 'Montclair', v: [164, 180, 188, 183, 200, 218, 246, 185, 208, 236, 235, 269], m: 'Accelerating' },
        { name: 'Hoboken', v: [184, 192, 192, 200, 233, 242, 261, 238, 251, 272, 278, 302], m: 'Accelerating' },
        { name: 'Short Hills', v: [162, 187, 183, 187, 191, 220, 231, 184, 208, 222, 216, 230], m: 'Accelerating' },
        { name: 'Bridgewater', v: [33, 33, 32, 32, 36, 36, 37, 29, 32, 34, 34, 36], m: 'Accelerating' },
        { name: 'Jersey City', v: [240, 225, 229, 242, 257, 241, 263, 216, 204, 224, 247, 242], m: 'Accelerating' },
        { name: 'Waldorf', v: [73, 76, 68, 70, 70, 73, 71, 57, 57, 61, 60, 58], m: 'Decelerating' },
        { name: 'Red Bank', v: [250, 256, 253, 229, 235, 238, 221, 174, 171, 178, 166, 152], m: 'Decelerating' },
        { name: 'Frederick', v: [204, 203, 200, 204, 193, 196, 205, 142, 145, 151, 136, 141], m: 'Decelerating' },
        { name: 'Lancaster', v: [45, 41, 40, 40, 41, 36, 38, 29, 29, 26, 28, 25], m: 'Decelerating' },
        { name: 'Tribeca', v: [290, 280, 258, 278, 261, 247, 241, 198, 182, 175, 166, 156], m: 'Decelerating' },
      ],
    },
    'Existing Guests': {
      fmt: (v) => v.toLocaleString(),
      rows: [
        { name: 'Bel Air', v: [451, 506, 607, 672, 732, 797, 1005, 848, 910, 1147, 1219, 1361], m: 'Accelerating' },
        { name: 'Ridgewood', v: [624, 693, 657, 728, 800, 882, 897, 772, 848, 974, 1077, 1107], m: 'Accelerating' },
        { name: 'Denville', v: [753, 807, 822, 874, 1040, 1101, 1198, 985, 1167, 1282, 1370, 1506], m: 'Accelerating' },
        { name: 'Montclair', v: [952, 1111, 1096, 1132, 1173, 1362, 1446, 1162, 1177, 1428, 1475, 1588], m: 'Accelerating' },
        { name: 'Glenwood', v: [230, 242, 242, 286, 298, 311, 334, 307, 326, 355, 367, 400], m: 'Accelerating' },
        { name: 'Hoboken', v: [1111, 1229, 1157, 1279, 1426, 1568, 1587, 1362, 1518, 1542, 1777, 1821], m: 'Accelerating' },
        { name: 'Short Hills', v: [990, 1073, 1121, 1211, 1154, 1247, 1402, 1180, 1153, 1300, 1325, 1506], m: 'Accelerating' },
        { name: 'Bridgewater', v: [189, 201, 205, 193, 205, 216, 237, 174, 184, 203, 209, 206], m: 'Accelerating' },
        { name: 'Jersey City', v: [1438, 1439, 1371, 1366, 1528, 1521, 1558, 1207, 1351, 1401, 1379, 1434], m: 'Accelerating' },
        { name: 'Waldorf', v: [441, 435, 409, 453, 438, 428, 432, 369, 364, 368, 378, 381], m: 'Decelerating' },
        { name: 'Frederick', v: [1288, 1252, 1156, 1258, 1205, 1154, 1134, 948, 896, 881, 918, 792], m: 'Decelerating' },
        { name: 'Red Bank', v: [1436, 1574, 1462, 1409, 1352, 1459, 1441, 1066, 1112, 1090, 1082, 929], m: 'Decelerating' },
        { name: 'Lancaster', v: [248, 270, 248, 238, 229, 245, 238, 175, 165, 179, 167, 141], m: 'Decelerating' },
        { name: 'Tribeca', v: [1803, 1632, 1593, 1614, 1642, 1459, 1507, 1164, 1134, 1021, 984, 985], m: 'Decelerating' },
      ],
    },
    'Total ASP': {
      fmt: (v) => `$${v}`,
      rows: [
        { name: 'Bel Air', v: [178, 202, 226, 232, 258, 284, 310, 312, 336, 364, 387, 401], m: 'Accelerating' },
        { name: 'Glenwood', v: [241, 255, 248, 262, 279, 294, 285, 300, 318, 334, 343, 346], m: 'Accelerating' },
        { name: 'Denville', v: [235, 252, 270, 289, 288, 307, 327, 322, 339, 359, 375, 382], m: 'Accelerating' },
        { name: 'Hoboken', v: [291, 295, 297, 300, 326, 329, 331, 334, 362, 365, 387, 376], m: 'Accelerating' },
        { name: 'Ridgewood', v: [266, 270, 296, 300, 301, 304, 332, 336, 337, 367, 355, 371], m: 'Accelerating' },
        { name: 'Montclair', v: [303, 314, 326, 314, 326, 338, 350, 337, 354, 367, 361, 360], m: 'Accelerating' },
        { name: 'Short Hills', v: [332, 328, 325, 347, 342, 338, 335, 358, 357, 353, 357, 367], m: 'Accelerating' },
        { name: 'Jersey City', v: [394, 395, 397, 398, 373, 373, 374, 347, 345, 345, 353, 340], m: 'Decelerating' },
        { name: 'Bridgewater', v: [343, 332, 321, 311, 330, 320, 309, 299, 312, 302, 294, 297], m: 'Decelerating' },
        { name: 'Waldorf', v: [412, 408, 405, 368, 362, 357, 352, 318, 311, 304, 295, 276], m: 'Decelerating' },
        { name: 'Red Bank', v: [538, 524, 473, 459, 446, 429, 383, 366, 349, 330, 293, 264], m: 'Decelerating' },
        { name: 'Frederick', v: [537, 485, 472, 459, 447, 400, 384, 368, 348, 306, 293, 264], m: 'Decelerating' },
        { name: 'Lancaster', v: [488, 476, 461, 409, 394, 378, 361, 314, 297, 278, 260, 220], m: 'Decelerating' },
        { name: 'Tribeca', v: [585, 546, 505, 506, 466, 428, 420, 382, 355, 317, 286, 258], m: 'Decelerating' },
      ],
    },
    'ASP (New)': {
      fmt: (v) => `$${v}`,
      rows: [
        { name: 'Bel Air', v: [226, 246, 266, 303, 324, 344, 363, 404, 425, 445, 470, 502], m: 'Accelerating' },
        { name: 'Denville', v: [305, 317, 328, 340, 372, 384, 394, 405, 441, 452, 473, 470], m: 'Accelerating' },
        { name: 'Glenwood', v: [293, 318, 323, 329, 336, 363, 368, 374, 375, 405, 405, 422], m: 'Accelerating' },
        { name: 'Hoboken', v: [354, 369, 385, 379, 395, 411, 427, 420, 436, 453, 452, 483], m: 'Accelerating' },
        { name: 'Ridgewood', v: [343, 339, 356, 372, 389, 383, 400, 417, 435, 428, 446, 451], m: 'Accelerating' },
        { name: 'Short Hills', v: [411, 419, 405, 414, 423, 432, 418, 426, 432, 440, 443, 440], m: 'Accelerating' },
        { name: 'Montclair', v: [375, 376, 399, 400, 401, 402, 426, 428, 432, 434, 440, 453], m: 'Accelerating' },
        { name: 'Bridgewater', v: [426, 401, 403, 404, 408, 384, 385, 386, 389, 366, 378, 367], m: 'Decelerating' },
        { name: 'Jersey City', v: [512, 497, 481, 467, 481, 466, 451, 437, 448, 434, 418, 415], m: 'Decelerating' },
        { name: 'Waldorf', v: [515, 492, 500, 476, 453, 430, 434, 411, 389, 367, 355, 343], m: 'Decelerating' },
        { name: 'Red Bank', v: [659, 658, 619, 580, 540, 532, 494, 457, 418, 404, 364, 337], m: 'Decelerating' },
        { name: 'Frederick', v: [652, 615, 577, 574, 539, 503, 467, 458, 423, 388, 370, 325], m: 'Decelerating' },
        { name: 'Lancaster', v: [608, 608, 566, 527, 488, 480, 441, 403, 365, 351, 319, 272], m: 'Decelerating' },
        { name: 'Tribeca', v: [749, 680, 652, 623, 593, 530, 499, 467, 415, 382, 354, 310], m: 'Decelerating' },
      ],
    },
    'ASP (Existing)': {
      fmt: (v) => `$${v}`,
      rows: [
        { name: 'Bel Air', v: [295, 332, 370, 385, 423, 462, 503, 513, 560, 603, 617, 681], m: 'Accelerating' },
        { name: 'Denville', v: [399, 402, 429, 457, 486, 516, 514, 544, 581, 577, 611, 625], m: 'Accelerating' },
        { name: 'Ridgewood', v: [448, 456, 463, 501, 509, 516, 524, 531, 571, 579, 593, 618], m: 'Accelerating' },
        { name: 'Glenwood', v: [397, 418, 411, 432, 454, 476, 499, 489, 512, 536, 529, 572], m: 'Accelerating' },
        { name: 'Hoboken', v: [461, 468, 503, 510, 519, 526, 563, 570, 572, 578, 609, 632], m: 'Accelerating' },
        { name: 'Montclair', v: [489, 505, 522, 539, 528, 545, 563, 581, 562, 579, 579, 616], m: 'Accelerating' },
        { name: 'Short Hills', v: [525, 554, 551, 547, 543, 573, 569, 565, 555, 585, 569, 582], m: 'Accelerating' },
        { name: 'Bridgewater', v: [545, 530, 551, 536, 520, 506, 525, 510, 494, 480, 486, 488], m: 'Decelerating' },
        { name: 'Jersey City', v: [669, 630, 629, 628, 627, 625, 588, 586, 590, 554, 570, 552], m: 'Decelerating' },
        { name: 'Waldorf', v: [687, 678, 669, 616, 607, 595, 546, 534, 522, 508, 478, 449], m: 'Decelerating' },
        { name: 'Frederick', v: [852, 828, 803, 730, 704, 676, 647, 581, 558, 526, 478, 433], m: 'Decelerating' },
        { name: 'Red Bank', v: [864, 838, 814, 785, 709, 680, 652, 620, 551, 518, 475, 455], m: 'Decelerating' },
        { name: 'Lancaster', v: [835, 808, 728, 700, 676, 602, 572, 540, 510, 444, 423, 373], m: 'Decelerating' },
        { name: 'Tribeca', v: [933, 929, 864, 803, 745, 730, 668, 608, 551, 525, 455, 410], m: 'Decelerating' },
      ],
    },
    'Rebooking Rate': {
      fmt: (v) => `${v}%`,
      rows: [
        { name: 'Bel Air', v: [36, 40, 43, 49, 53, 56, 59, 67, 70, 73, 76, 82], m: 'Accelerating' },
        { name: 'Denville', v: [47, 52, 54, 56, 61, 63, 65, 67, 73, 75, 76, 80], m: 'Accelerating' },
        { name: 'Glenwood', v: [44, 45, 46, 51, 51, 52, 53, 58, 60, 61, 64, 67], m: 'Accelerating' },
        { name: 'Ridgewood', v: [53, 56, 55, 58, 60, 63, 63, 66, 69, 72, 71, 77], m: 'Accelerating' },
        { name: 'Hoboken', v: [57, 60, 62, 62, 65, 68, 67, 70, 72, 75, 76, 77], m: 'Accelerating' },
        { name: 'Montclair', v: [62, 63, 63, 67, 68, 69, 69, 73, 73, 74, 75, 78], m: 'Accelerating' },
        { name: 'Short Hills', v: [65, 66, 64, 66, 68, 69, 71, 69, 70, 72, 72, 72], m: 'Accelerating' },
        { name: 'Jersey City', v: [79, 77, 79, 77, 75, 73, 75, 73, 70, 72, 70, 70], m: 'Decelerating' },
        { name: 'Bridgewater', v: [60, 57, 57, 58, 59, 55, 56, 56, 57, 54, 56, 54], m: 'Decelerating' },
        { name: 'Waldorf', v: [77, 73, 70, 72, 68, 65, 62, 63, 60, 57, 56, 54], m: 'Decelerating' },
        { name: 'Frederick', v: [104, 99, 93, 87, 87, 82, 76, 71, 69, 64, 58, 54], m: 'Decelerating' },
        { name: 'Red Bank', v: [107, 102, 96, 90, 90, 84, 78, 73, 70, 64, 61, 54], m: 'Decelerating' },
        { name: 'Lancaster', v: [88, 83, 77, 72, 73, 68, 62, 57, 56, 51, 47, 43], m: 'Decelerating' },
        { name: 'Tribeca', v: [116, 112, 101, 97, 94, 84, 79, 75, 70, 61, 58, 51], m: 'Decelerating' },
      ],
    },
    'Google Rating': {
      fmt: (v) => v.toFixed(1),
      rows: [
        { name: 'Bel Air', v: [2.5, 2.7, 3.0, 3.3, 3.6, 3.8, 4.1, 4.4, 4.7, 4.8, 5.1, 5.4], m: 'Accelerating' },
        { name: 'Denville', v: [3.2, 3.4, 3.6, 3.8, 3.9, 4.0, 4.2, 4.5, 4.7, 4.7, 5.0, 5.1], m: 'Accelerating' },
        { name: 'Ridgewood', v: [3.6, 3.8, 3.9, 4.0, 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 5.0], m: 'Accelerating' },
        { name: 'Glenwood', v: [3.5, 3.6, 3.8, 3.9, 3.9, 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8], m: 'Accelerating' },
        { name: 'Hoboken', v: [3.8, 3.9, 4.0, 4.0, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 4.8, 5.0], m: 'Accelerating' },
        { name: 'Montclair', v: [4.0, 4.1, 4.2, 4.2, 4.3, 4.4, 4.5, 4.5, 4.6, 4.7, 4.8, 4.8], m: 'Accelerating' },
        { name: 'Short Hills', v: [4.4, 4.4, 4.5, 4.5, 4.5, 4.5, 4.6, 4.6, 4.6, 4.6, 4.7, 4.7], m: 'Stable' },
        { name: 'Bridgewater', v: [5.0, 4.9, 4.8, 4.7, 4.7, 4.6, 4.6, 4.5, 4.5, 4.4, 4.3, 4.3], m: 'Decelerating' },
        { name: 'Jersey City', v: [5.3, 5.3, 5.2, 5.0, 5.0, 4.9, 4.9, 4.7, 4.6, 4.6, 4.4, 4.4], m: 'Decelerating' },
        { name: 'Waldorf', v: [6.0, 5.8, 5.7, 5.4, 5.2, 5.1, 4.9, 4.6, 4.5, 4.3, 4.1, 3.9], m: 'Decelerating' },
        { name: 'Frederick', v: [7.0, 6.8, 6.5, 6.2, 5.9, 5.5, 5.2, 4.9, 4.6, 4.2, 4.0, 3.6], m: 'Decelerating' },
        { name: 'Red Bank', v: [7.2, 6.9, 6.6, 6.3, 5.9, 5.6, 5.3, 5.0, 4.6, 4.3, 3.9, 3.6], m: 'Decelerating' },
        { name: 'Lancaster', v: [7.3, 7.0, 6.7, 6.2, 5.9, 5.6, 5.2, 4.8, 4.4, 4.1, 3.7, 3.3], m: 'Decelerating' },
        { name: 'Tribeca', v: [7.9, 7.4, 7.2, 6.7, 6.2, 5.8, 5.5, 5.0, 4.6, 4.1, 3.8, 3.3], m: 'Decelerating' },
      ],
    },
  };

  const active = datasets[activeMetric];

  const momentumStyle = {
    Accelerating: 'bg-teal-50 text-teal-700',
    Stable: 'bg-gray-100 text-gray-500',
    Decelerating: 'bg-orange-50 text-orange-600',
  };

  // heat-map each cell relative to that row's own average
  const cellStyle = (val, avg) => {
    const r = val / avg;
    if (r >= 1.18) return { bg: '#3fa392', fg: '#06302a' };
    if (r >= 1.05) return { bg: '#7fc4b6', fg: '#0b3a33' };
    if (r >= 0.97) return { bg: '#e8efe9', fg: '#374151' };
    if (r >= 0.85) return { bg: '#f1c3ac', fg: '#7c2d12' };
    return { bg: '#e09b7e', fg: '#5b1d0a' };
  };

  const Sparkline = ({ v, m }) => {
    const w = 70, h = 26;
    const min = Math.min(...v), max = Math.max(...v);
    const range = max - min || 1;
    const pts = v.map((val, i) => `${(i / (v.length - 1)) * w},${h - ((val - min) / range) * h}`).join(' ');
    const stroke = m === 'Decelerating' ? '#d97757' : m === 'Stable' ? '#9ca3af' : '#0f766e';
    return (
      <svg width={w} height={h} className="overflow-visible">
        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.8" />
      </svg>
    );
  };

  return (
    <div className="px-9 py-8">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold">Location Momentum Matrix · {activeMetric}</h3>
        <p className="text-xs text-gray-500 mt-1">12-month trend · cells heat-mapped to each location's own average · sorted by momentum</p>

        {/* metric pills */}
        <div className="flex flex-wrap gap-2 mt-5 mb-6">
          {metricTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveMetric(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                activeMetric === tab ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-xs text-gray-400">
                <th className="text-left font-bold py-2 pr-4 sticky left-0 bg-white">LOCATION</th>
                {months.map((mo) => (
                  <th key={mo} className="font-semibold py-2 px-1 text-center min-w-[58px]">{mo}</th>
                ))}
                <th className="font-semibold py-2 px-2 text-center">12-MO</th>
                <th className="font-semibold py-2 pl-2 text-center">MOMENTUM</th>
              </tr>
            </thead>
            <tbody>
              {active.rows.map((row) => {
                const avg = row.v.reduce((a, b) => a + b, 0) / row.v.length;
                return (
                  <tr key={row.name}>
                    <td className="py-1.5 pr-4 font-bold text-gray-900 text-sm whitespace-nowrap sticky left-0 bg-white">{row.name}</td>
                    {row.v.map((val, i) => {
                      const c = cellStyle(val, avg);
                      return (
                        <td key={i} className="px-0.5 py-1">
                          <div className="rounded-md text-center text-[11px] font-semibold py-2" style={{ backgroundColor: c.bg, color: c.fg }}>
                            {active.fmt(val)}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center">
                      <Sparkline v={row.v} m={row.m} />
                    </td>
                    <td className="pl-2 py-1 text-center">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${momentumStyle[row.m]}`}>
                        {row.m}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
/* ---------------- MARKETING · ACQUISITION ---------------- */

const AcquisitionView = () => {
  const kpis = [
    { label: 'MARKETING SPEND', value: '$412K', note: '▲ 5.8%', positive: false },
    { label: 'LEADS', value: '6,240', note: '▲ 9.1%', positive: true },
    { label: 'LEAD → BOOKING', value: '46.8%', note: '▲ 2.3 pt', positive: true },
    { label: 'BLENDED CAC', value: '$104', note: '▼ $7', positive: true },
    { label: 'NEW CUSTOMERS', value: '3,980', note: '▲ 6.4%', positive: true },
  ];

  const funnel = [
    { label: 'Leads', value: '6,240', pct: '100%', width: 100, color: '#5eead4' },
    { label: 'Consults booked', value: '2,920', pct: '46.8%', width: 46.8, color: '#2dd4bf' },
    { label: 'Consults completed', value: '2,480', pct: '85% show', width: 39.7, color: '#14b8a6' },
    { label: 'Treated', value: '2,180', pct: '87.9%', width: 34.9, color: '#0f9b8e' },
    { label: 'Rebooked', value: '1,490', pct: '68.4%', width: 23.9, color: '#0f766e' },
  ];

  const channels = [
    { name: 'Meta Ads', spend: '$214K', leads: '3,180', cac: '$118', color: '#0f766e' },
    { name: 'Google Ads', spend: '$148K', leads: '2,040', cac: '$132', color: '#2dd4bf' },
    { name: 'Referral', spend: '$22K', leads: '610', cac: '$41', color: '#5eead4' },
    { name: 'Organic / SEO', spend: '$18K', leads: '340', cac: '$28', color: '#99f6e4' },
    { name: 'Email / CRM', spend: '$10K', leads: '70', cac: '$19', color: '#f0c9a0' },
  ];

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className={`text-xs font-semibold mt-2 ${k.positive ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Acquisition Funnel</h3>
          <p className="text-xs text-gray-500 mt-1 mb-6">May 2026 · paid + organic</p>
          <div className="space-y-5">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">{f.label}</span>
                  <span className="text-sm tabular-nums">
                    <span className="font-bold">{f.value}</span> <span className="text-gray-400">{f.pct}</span>
                  </span>
                </div>
                <div className="h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md" style={{ width: `${f.width}%`, backgroundColor: f.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-5">Channel Performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-bold pb-3">CHANNEL</th>
                <th className="text-right font-bold pb-3">SPEND</th>
                <th className="text-right font-bold pb-3">LEADS</th>
                <th className="text-right font-bold pb-3">CAC</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.name} className="border-b border-gray-50">
                  <td className="py-3.5 font-semibold text-gray-900">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.color }}></span>
                      {c.name}
                    </span>
                  </td>
                  <td className="py-3.5 text-right tabular-nums">{c.spend}</td>
                  <td className="py-3.5 text-right tabular-nums">{c.leads}</td>
                  <td className="py-3.5 text-right font-bold tabular-nums">{c.cac}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-5 pt-1">
            <span className="text-sm text-gray-500">Blended ROAS</span>
            <span className="text-sm font-bold text-teal-600">4.3×</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- MARKETING · CALL CENTER ---------------- */

const CCHeat = ({ title, sub, days, hours, grid, palette }) => (
  <div className="bg-white rounded-xl p-6 border border-gray-200">
    <h3 className="text-lg font-bold">{title}</h3>
    <p className="text-xs text-gray-400 mt-1 mb-4">{sub}</p>
    <div>
      <div className="flex">
        <div className="w-8"></div>
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center text-xs font-semibold text-gray-400 pb-2">{d}</div>
        ))}
      </div>
      {hours.map((h, ri) => (
        <div key={h} className="flex items-center mb-1">
          <div className="w-8 text-[11px] text-gray-400 text-right pr-1.5">{h}</div>
          {grid[ri].map((v, ci) => {
            const c = palette(v);
            return (
              <div key={ci} className="flex-1 mx-0.5">
                <div className="rounded-md text-center text-[11px] font-medium py-1.5" style={{ backgroundColor: c.bg, color: c.fg }}>
                  {v > 0 ? v : ''}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </div>
);

const Donut = ({ google }) => {
  const r = 52, c = 2 * Math.PI * r;
  const gLen = (google / 100) * c;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={r} fill="none" stroke="#3b82f6" strokeWidth="22" />
      <circle
        cx="75" cy="75" r={r} fill="none" stroke="#1f3a52" strokeWidth="22"
        strokeDasharray={`${gLen} ${c - gLen}`} transform="rotate(-90 75 75)"
      />
    </svg>
  );
};

const CallCenterView = () => {
  const subTabs = ['Overview', 'Speed to Lead', 'Agent Performance', 'Heatmaps', 'Ad Attribution'];
  const [subTab, setSubTab] = useState('Overview');

  const volKpis = [
    { label: 'TOTAL LEADS', value: '798', note: 'period total', delta: '▲ 12%', deltaColor: 'text-teal-600' },
    { label: 'BOOKED', value: '83', note: 'appointments', delta: '▲ 7%', deltaColor: 'text-teal-600' },
    { label: 'CONVERSION RATE', value: '10.4%', note: 'target ≥ 30%', flag: 'Below target', flagColor: 'text-orange-600' },
    { label: 'AVG DAYS TO BOOK', value: '3.04', note: 'from lead creation', flag: 'At risk', flagColor: 'text-orange-600' },
    { label: 'SAME-DAY BOOKINGS', value: '43.4%', note: 'of total bookings', flag: 'Strong', flagColor: 'text-teal-600' },
  ];

  const convTrend = [
    { d: 'Apr 1', v: 9.2 }, { d: 'Apr 3', v: 9.6 }, { d: 'Apr 5', v: 9.1 }, { d: 'Apr 7', v: 8.8 },
    { d: 'Apr 9', v: 8.4 }, { d: 'Apr 11', v: 9.5 }, { d: 'Apr 13', v: 11.8 }, { d: 'Apr 15', v: 12.6 },
    { d: 'Apr 17', v: 9.4 }, { d: 'Apr 19', v: 10.4 },
  ];
  const daysTrend = [
    { d: 'Apr 1', v: 4.6 }, { d: 'Apr 3', v: 4.2 }, { d: 'Apr 5', v: 3.9 }, { d: 'Apr 7', v: 3.6 },
    { d: 'Apr 9', v: 3.5 }, { d: 'Apr 11', v: 3.0 }, { d: 'Apr 13', v: 3.7 }, { d: 'Apr 15', v: 3.7 },
    { d: 'Apr 17', v: 1.2 }, { d: 'Apr 19', v: 0.9 },
  ];

  const daysBookDist = [
    { label: 'Same Day', n: 36, color: '#0f9b8e' },
    { label: '1 Day', n: 5, color: '#5eead4' },
    { label: '2-3 Days', n: 13, color: '#e6a888' },
    { label: '4-7 Days', n: 15, color: '#d98863' },
    { label: '8-14 Days', n: 13, color: '#cf7a55' },
  ];

  const decay = [
    { x: 0, y: 95 }, { x: 1, y: 78 }, { x: 2, y: 62 }, { x: 3, y: 48 },
    { x: 4, y: 38 }, { x: 5, y: 30 }, { x: 6, y: 25 },
  ];

  const daysByCenter = [
    { name: 'Short Hills', v: 6.0, w: 100 }, { name: 'Bridgewater', v: 5.2, w: 87 },
    { name: 'Waldorf', v: 5.2, w: 87 }, { name: 'Bel Air', v: 3.9, w: 65 },
    { name: 'Ridgewood', v: 3.8, w: 63 }, { name: 'Frederick', v: 3.5, w: 58 },
    { name: 'Hoboken', v: 3.5, w: 58 }, { name: 'Tribeca', v: 2.2, w: 37, light: true },
    { name: 'Red Bank', v: 1.6, w: 27, light: true }, { name: 'Jersey City', v: 0.4, w: 6, teal: true },
  ];

  const stlBoard = [
    { label: 'AVG SPEED TO LEAD', value: '21h 57m', note: 'Median: 12h 31m', color: 'text-orange-600' },
    { label: 'BEST AVG RESPONSE', value: '5h 46m', note: 'Durham', color: 'text-teal-600' },
    { label: 'WORST AVG RESPONSE', value: '5d 7h', note: 'Upper Arlington', color: 'text-orange-600' },
    { label: 'UNDER 30 MIN', value: '10%', note: 'responded within 30 min', color: 'text-orange-600' },
    { label: 'RESPONSE RATE', value: '71%', note: 'leads with human response', color: 'text-gray-950' },
    { label: 'AVG UNDER 5 MIN', value: '6%', note: 'contacts responded quickly', color: 'text-orange-600' },
  ];

  const respDist = [
    { label: '0-5 min', pct: '6%', width: 6, total: '730', booked: '122 booked (17%)', color: '#0f9b8e' },
    { label: '6-30 min', pct: '10%', width: 12, total: '1,273', booked: '200 booked (16%)', color: '#2dd4bf' },
    { label: '31-60 min', pct: '8%', width: 9, total: '1,010', booked: '141 booked (14%)', color: '#f0c9a0' },
    { label: '1-4 hrs', pct: '22%', width: 30, total: '2,790', booked: '334 booked (12%)', color: '#e6a888' },
    { label: '4-24 hrs', pct: '34%', width: 48, total: '4,310', booked: '387 booked (9%)', color: '#cf7a55' },
    { label: '>24 hrs', pct: '20%', width: 28, total: '2,535', booked: '152 booked (6%)', color: '#a64f33' },
  ];

  const stlImpact = [
    { label: 'First 30 min', value: '24.5%', color: 'text-teal-700' },
    { label: 'First Hour Total', value: '31.0%', color: 'text-teal-700' },
    { label: 'Total Bookings', value: '1,058', color: 'text-gray-950' },
    { label: 'Centers Included', value: '14', color: 'text-gray-950' },
  ];
  const impactCurve = [
    { x: 0, y: 95 }, { x: 0.5, y: 55 }, { x: 1, y: 30 }, { x: 2, y: 22 },
    { x: 3, y: 18 }, { x: 4, y: 16 }, { x: 5, y: 17 }, { x: 6, y: 16 }, { x: 7, y: 15 },
  ];

  const scorecard = [
    { label: 'FASTEST AGENT', name: 'Jamie L.', note: 'avg 1h 12m response', tag: '#1', tagColor: 'text-teal-600' },
    { label: 'TOP BOOKING RATE', name: 'Jamie L.', note: '38% booking rate', tag: '▲ 8%', tagColor: 'text-teal-600' },
    { label: 'MOST LEADS HANDLED', name: 'Marcus R.', note: '189 leads this period', tag: '29% booked', tagColor: 'text-orange-600' },
    { label: 'NEEDS ATTENTION', name: 'Sam T.', note: '0% under-60-min rate', tag: '▼ Slowest', tagColor: 'text-orange-600' },
  ];

  const team = [
    { rank: 1, initials: 'JL', name: 'Jamie L.', resp: '1h 12m', median: '45m', u60: 82, leads: 214, calls: 310, contact: '54%', booked: '41 booked', rate: '38%', good: true, avatar: '#0f9b8e' },
    { rank: 2, initials: 'MR', name: 'Marcus R.', resp: '3h 45m', median: '2h 10m', u60: 44, leads: 189, calls: 276, contact: '41%', booked: '27 booked', rate: '29%', good: false, avatar: '#1f2937' },
    { rank: 3, initials: 'PS', name: 'Priya S.', resp: '6h 20m', median: '4h 05m', u60: 28, leads: 143, calls: 198, contact: '38%', booked: '19 booked', rate: '22%', good: false, avatar: '#7c5cdb' },
    { rank: 4, initials: 'ST', name: 'Sam T.', resp: '14h 30m', median: '9h 15m', u60: 0, leads: 130, calls: 162, contact: '31%', booked: '12 booked', rate: '15%', good: false, avatar: '#d98863' },
  ];

  const avgRespByAgent = [
    { name: 'Jamie L.', v: '1.2h', w: 14, tick: 9 },
    { name: 'Marcus R.', v: '3.75h', w: 42, tick: 12 },
    { name: 'Priya S.', v: '6.33h', w: 64, tick: 12 },
    { name: 'Sam T.', v: '14.5h', w: 92, tick: 12 },
  ];

  const hmDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const hmHours = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
  const leadArrival = [
    [1, 3, 2, 3, 1, 2, 3],
    [2, 1, 1, 2, 2, 2, 0],
    [5, 5, 4, 3, 2, 4, 0],
    [6, 8, 8, 8, 9, 3, 4],
    [7, 7, 3, 9, 3, 3, 4],
    [9, 3, 9, 8, 3, 5, 4],
    [2, 2, 7, 6, 2, 1, 5],
    [7, 8, 7, 5, 4, 3, 4],
  ];
  const fastResp = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 2, 7, 3, 3, 2, 1],
    [0, 2, 1, 1, 2, 0, 0],
    [0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ];
  const convArrival = [
    [0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1, 0, 0],
    [1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 2, 0, 1, 0],
    [1, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0],
  ];
  const tealPalette = (v) => {
    if (v <= 0) return { bg: '#eef2f1', fg: 'transparent' };
    if (v <= 2) return { bg: '#cdeae3', fg: '#0b3a33' };
    if (v <= 4) return { bg: '#8fd4c6', fg: '#06302a' };
    if (v <= 6) return { bg: '#4fb6a4', fg: '#06302a' };
    if (v <= 8) return { bg: '#1f9684', fg: '#ffffff' };
    return { bg: '#0c6f60', fg: '#ffffff' };
  };
  const lightTealPalette = (v) => {
    if (v <= 0) return { bg: '#eef2f1', fg: 'transparent' };
    if (v <= 1) return { bg: '#d6f0e9', fg: '#0b3a33' };
    if (v <= 3) return { bg: '#9adacb', fg: '#06302a' };
    return { bg: '#3fae9b', fg: '#ffffff' };
  };
  const slatePalette = (v) => {
    if (v <= 0) return { bg: '#eef2f1', fg: 'transparent' };
    if (v <= 1) return { bg: '#94a3b8', fg: '#ffffff' };
    return { bg: '#1f2937', fg: '#ffffff' };
  };

  const paidKpis = [
    { label: 'Total Leads', value: '534', note: '▲ 10%', up: true },
    { label: 'Cost Per Lead', value: '$29.40', note: '▼ 1%', up: false },
    { label: 'Cost Per Appt', value: '$234', note: '▲ 17%', up: true, bad: true },
    { label: '# of Appts', value: '67', note: '▼ 7%', up: false },
    { label: 'Lead to Appt %', value: '12.5%', note: '▼ 15%', up: false },
    { label: 'Invoice Sales', value: '$19,939', note: '▼ 46%', up: false },
    { label: '# of Invoices', value: '63', note: '▼ 7%', up: false },
    { label: 'Avg Invoice', value: '$316', note: '▼ 42%', up: false },
    { label: 'Webstore Sales', value: '$1,993', note: '▼ 83%', up: false },
    { label: '# Webstore Txn', value: '43', note: '▼ 44%', up: false },
    { label: 'Gross Total', value: '$21,932', note: '▼ 55%', up: false },
    { label: 'LTV ROAS', value: '1.40x', note: '▼ 59%', up: false },
  ];
  const bookingBySource = [
    { name: 'Organic', pct: '24%', width: 80, color: '#1f3a52' },
    { name: 'Google Ads', pct: '15%', width: 50, color: '#0f766e' },
    { name: 'Meta Ads', pct: '12.5%', width: 42, color: '#2dd4bf' },
  ];

  return (
    <div className="px-9 pt-4 pb-8">
      <div className="flex items-center gap-7 border-b border-gray-200 mb-7">
        {subTabs.map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`pb-3 text-sm font-semibold -mb-px border-b-2 ${
              subTab === t ? 'text-teal-700 border-teal-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab !== 'Overview' ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          {subTab} detail view coming soon. The full breakdown lives under Overview.
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-[3px] mb-4">Volume &amp; Conversion — Period to Date</p>
            <div className="grid grid-cols-5 gap-4">
              {volKpis.map((k) => (
                <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
                  <p className="text-4xl font-bold text-gray-950 mt-3 tabular-nums">{k.value}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{k.note}</span>
                    {k.delta && <span className={`text-xs font-semibold ${k.deltaColor}`}>{k.delta}</span>}
                    {k.flag && <span className={`text-xs font-semibold ${k.flagColor}`}>{k.flag}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-teal-50 border-l-4 border-teal-500 rounded-r-lg px-5 py-4 text-sm text-gray-700 italic">
            83 bookings from 798 leads (10.4%), with 43.4% converting same-day. 34% of bookings occur after 3 days — strong upside in immediate engagement. Avg speed to first contact is <span className="font-bold not-italic">21h 57m</span> against a target of ≤5 min.
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Conversion Rate Trend</h3>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-teal-600"></span>Conversion rate</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-orange-400"></span>Target 30%</span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={convTrend} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={2} />
                    <YAxis hide domain={[0, 32]} />
                    <Area type="monotone" dataKey="v" stroke="#0f766e" strokeWidth={2.5} fill="url(#convGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Avg Days to Book Trend</h3>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-gray-800"></span>Avg days</span>
                  <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-teal-500"></span>Target ≤1d</span>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daysTrend} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="daysGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1f2937" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#1f2937" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={2} />
                    <YAxis hide domain={[0, 5]} />
                    <Area type="monotone" dataKey="v" stroke="#1f2937" strokeWidth={2.5} fill="url(#daysGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold mb-6">Days to Book Distribution</h3>
              <div className="flex items-end justify-between gap-2 h-44">
                {daysBookDist.map((d) => (
                  <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-sm font-bold mb-1">{d.n}</span>
                    <div className="w-full rounded-t" style={{ height: `${(d.n / 36) * 100}%`, backgroundColor: d.color }}></div>
                    <span className="text-[10px] text-gray-500 mt-2 text-center">{d.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-5">
                <span className="font-bold text-teal-700">43% same-day</span> · <span className="font-bold text-orange-600">34% after 3 days</span>
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold">Lead Decay Curve</h3>
              <p className="text-xs text-gray-400 mt-1 mb-4">Booking rate by response time</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={decay} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="decayGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }}
                      ticks={[0, 1, 3, 5, 6]} tickFormatter={(v) => ({ 0: '<5m', 1: '30m', 3: '2h', 5: '8h', 6: '24h' }[v] || '')} />
                    <YAxis hide domain={[0, 100]} />
                    <Area type="monotone" dataKey="y" stroke="#0f766e" strokeWidth={2.5} fill="url(#decayGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold mb-5">Avg Days to Book by Center</h3>
              <div className="space-y-2">
                {daysByCenter.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-gray-600 text-right">{c.name}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${c.w}%`, backgroundColor: c.teal ? '#0f9b8e' : c.light ? '#f0c4a8' : '#d98863' }}></div>
                    </div>
                    <span className={`w-8 text-right text-xs font-semibold tabular-nums ${c.teal ? 'text-teal-700' : 'text-orange-600'}`}>{c.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-[3px] mb-4">Speed to Lead Leaderboard</p>
            <div className="grid grid-cols-6 gap-4">
              {stlBoard.map((s) => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-tight">{s.label}</p>
                  <p className={`text-2xl font-bold mt-3 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-2">{s.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold">Response Time Distribution</h3>
              <p className="text-xs text-gray-400 mt-1 mb-5">% of contacts responded to within thresholds · with booked counts</p>
              <div className="space-y-4">
                {respDist.map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-gray-600 leading-tight">{r.label}</span>
                    <span className="w-8 text-xs font-bold tabular-nums" style={{ color: r.width > 25 ? '#c2410c' : '#0f766e' }}>{r.pct}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden">
                      <div className="h-full rounded-md" style={{ width: `${r.width}%`, backgroundColor: r.color }}></div>
                    </div>
                    <span className="w-12 text-right text-xs text-gray-400 tabular-nums">{r.total}</span>
                    <span className="w-28 text-right text-xs font-semibold text-teal-700">{r.booked}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold">Speed to Lead Impact</h3>
              <p className="text-xs text-gray-400 mt-1 mb-4">Bookings by response time — the cliff where faster responses win</p>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {stlImpact.map((s) => (
                  <div key={s.label} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-[11px] text-gray-400 leading-tight">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="h-40 relative">
                <div className="absolute top-0 bottom-6 border-l border-dashed border-orange-400 z-10" style={{ left: '13%' }}></div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={impactCurve} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="impactGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="x" hide />
                    <YAxis hide domain={[0, 100]} />
                    <Area type="monotone" dataKey="y" stroke="#0f766e" strokeWidth={2.5} fill="url(#impactGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-gray-400 italic text-center mt-2">Dashed line marks the 1-hour mark — most bookings come from leads contacted before it.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-[3px] mb-4">Agent Scorecard — Speed &amp; Conversion by Team Member</p>
            <div className="grid grid-cols-4 gap-4">
              {scorecard.map((s) => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold mt-3 text-gray-950">{s.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{s.note}</span>
                    <span className={`text-xs font-semibold ${s.tagColor}`}>{s.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold">Team Performance</h3>
                <p className="text-xs text-gray-400 mt-1">Speed to lead &amp; conversion by agent — sorted by fastest average response</p>
              </div>
              <span className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-full px-3 py-1">Last 30 Days</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-6 py-3 text-left font-bold">#</th>
                  <th className="px-2 py-3 text-left font-bold">AGENT</th>
                  <th className="px-4 py-3 text-left font-bold">AVG RESPONSE</th>
                  <th className="px-4 py-3 text-left font-bold">MEDIAN</th>
                  <th className="px-4 py-3 text-left font-bold">UNDER 60 MIN</th>
                  <th className="px-4 py-3 text-right font-bold">LEADS</th>
                  <th className="px-4 py-3 text-right font-bold">CALLS</th>
                  <th className="px-4 py-3 text-right font-bold">CONTACT</th>
                  <th className="px-4 py-3 text-right font-bold">BOOKINGS</th>
                  <th className="px-6 py-3 text-right font-bold">RATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {team.map((a) => (
                  <tr key={a.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">{a.rank}</span>
                    </td>
                    <td className="px-2 py-4">
                      <span className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: a.avatar }}>{a.initials}</span>
                        <span className="font-semibold text-gray-900">{a.name}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-4 font-semibold ${a.good ? 'text-teal-700' : 'text-orange-600'}`}>{a.resp}</td>
                    <td className="px-4 py-4 text-gray-600">{a.median}</td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-2">
                        <span className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <span className="block h-full rounded-full" style={{ width: `${a.u60}%`, backgroundColor: a.good ? '#0f9b8e' : '#e6a888' }}></span>
                        </span>
                        <span className="text-xs tabular-nums">{a.u60}%</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{a.leads}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{a.calls}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{a.contact}</td>
                    <td className="px-4 py-4 text-right font-semibold text-teal-700">{a.booked}</td>
                    <td className={`px-6 py-4 text-right font-bold ${a.good ? 'text-teal-700' : 'text-orange-600'}`}>{a.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Avg Response Time by Agent</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <Legend color="#0f9b8e" label="On target ≤1h" />
                <Legend color="#f0c4a8" label="1-8h" />
                <Legend color="#cf7a55" label=">8h" />
              </div>
            </div>
            <div className="space-y-3">
              {avgRespByAgent.map((a) => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-700">{a.name}</span>
                  <div className="flex-1 relative h-4 bg-gray-100 rounded-md">
                    <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${a.w}%`, backgroundColor: '#e6a888' }}></div>
                    <div className="absolute top-0 bottom-0 w-0.5 bg-teal-700" style={{ left: `${a.tick}%` }}></div>
                  </div>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums text-gray-700">{a.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-[3px] mb-4">Lead Arrival, Fast Response &amp; Conversion — by Day &amp; Time</p>
            <div className="grid grid-cols-3 gap-6">
              <CCHeat title="Lead Arrival" sub="When leads arrive by day & time" days={hmDays} hours={hmHours} grid={leadArrival} palette={tealPalette} />
              <CCHeat title="Fast Response Times" sub="Leads answered under 30 min" days={hmDays} hours={hmHours} grid={fastResp} palette={lightTealPalette} />
              <CCHeat title="Conversions by Arrival" sub="Leads that booked by arrival time" days={hmDays} hours={hmHours} grid={convArrival} palette={slatePalette} />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-teal-700 uppercase tracking-[3px] mb-4">Paid Media Attribution — Meta &amp; Google Ads</p>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold mb-3">Platform Split</h3>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total Spend</p>
                <p className="text-3xl font-bold mt-1">$15,700 <span className="text-sm text-teal-600 font-semibold align-middle">+9%</span></p>
                <div className="flex justify-center my-6">
                  <Donut google={29.9} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#1f3a52]"></span>Google Ads</span>
                    <span className="tabular-nums">$4,696 <span className="text-gray-400 text-xs">29.9%</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3b82f6]"></span>Facebook Ads</span>
                    <span className="tabular-nums">$11,004 <span className="text-gray-400 text-xs">70.1%</span></span>
                  </div>
                </div>
              </div>

              <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold">Paid Media KPIs</h3>
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 rounded-full px-3 py-1">vs. Prior Period</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {paidKpis.map((k) => (
                    <div key={k.label} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-[11px] text-gray-400 leading-tight">{k.label}</p>
                      <p className="text-lg font-bold mt-1 tabular-nums">{k.value}</p>
                      <p className={`text-[11px] font-semibold mt-1 ${k.bad ? 'text-orange-600' : k.up ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold mb-5">Booking Rate by Lead Source</h3>
              <div className="space-y-4">
                {bookingBySource.map((b) => (
                  <div key={b.name} className="flex items-center gap-4">
                    <span className="w-24 text-sm text-gray-700">{b.name}</span>
                    <div className="flex-1 relative h-5 bg-gray-100 rounded-md">
                      <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${b.width}%`, backgroundColor: b.color }}></div>
                      <div className="absolute top-0 bottom-0 w-0.5 bg-orange-400" style={{ left: '75%' }}></div>
                    </div>
                    <span className="w-12 text-right text-sm font-bold tabular-nums">{b.pct}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">Dashed line = 30% conversion target</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


/* ---------------- CLINICAL ---------------- */

const ClinicalView = () => {
  const kpis = [
    { label: 'TREATMENTS', value: '18,420', note: '▲ 6.9%' },
    { label: 'TOX UNITS', value: '1.84M', note: '▲ 8.1%' },
    { label: 'FILLER SYRINGES', value: '4,210', note: '▲ 5.4%' },
    { label: 'CONSULT → TREAT', value: '73.6%', note: '▲ 2.0 pt' },
    { label: 'AVG UNITS / TOX VISIT', value: '42', note: '▲ 1.2' },
  ];

  const volume = [
    { name: 'Neurotoxins', visits: '7,820', n: 7820 },
    { name: 'Filler', visits: '3,640', n: 3640 },
    { name: 'Laser Hair Removal', visits: '2,310', n: 2310 },
    { name: 'Skin Rejuvenation', visits: '1,540', n: 1540 },
    { name: 'Body Contouring', visits: '1,180', n: 1180 },
    { name: 'Facials', visits: '1,090', n: 1090 },
    { name: 'PRF', visits: '840', n: 840 },
  ];

  const rebook = [
    { name: 'Neurotoxins', pct: 79 },
    { name: 'Memberships', pct: 86 },
    { name: 'Filler', pct: 71 },
    { name: 'Body Contouring', pct: 64 },
    { name: 'Laser Hair Removal', pct: 68 },
    { name: 'Facials', pct: 58 },
  ];

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className="text-xs font-semibold mt-2 text-teal-600">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Treatment Volume by Category</h3>
          <div className="space-y-5">
            {volume.map((v) => (
              <div key={v.name} className="flex items-center gap-4">
                <span className="w-32 text-sm text-gray-700">{v.name}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                  <div className="h-full rounded-md bg-gradient-to-r from-teal-400 to-teal-600" style={{ width: `${(v.n / 7820) * 100}%` }}></div>
                </div>
                <span className="w-20 text-right text-sm tabular-nums leading-tight">
                  <span className="font-bold">{v.visits}</span><br /><span className="text-gray-400 text-xs">visits</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Rebook Rate by Service</h3>
          <div className="space-y-4">
            {rebook.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">{r.name}</span>
                  <span className="text-sm font-bold tabular-nums">{r.pct}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${r.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">Consult → treatment conversion</span>
            <span className="text-sm font-bold text-teal-600">73.6%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- PATIENTS / CRM ---------------- */

const PatientsCRMView = () => {
  const kpis = [
    { label: 'ACTIVE PATIENTS', value: '12,840', note: '▲ 8.6%' },
    { label: 'NEW PATIENTS', value: '3,980', note: '▲ 6.4%' },
    { label: '12-MO RETENTION', value: '61.2%', note: '▲ 1.7 pt' },
    { label: 'AVG VISIT FREQUENCY', value: '3.4 / yr', note: '▲ 0.2' },
    { label: 'AVG LIFETIME VALUE', value: '$2,840', note: '▲ 4.9%' },
  ];

  // New vs Returning stacked bars (returning bottom, new top)
  const months = [
    { m: 'Dec', returning: 56, neu: 18 },
    { m: 'Jan', returning: 60, neu: 18 },
    { m: 'Feb', returning: 66, neu: 18 },
    { m: 'Mar', returning: 74, neu: 14 },
    { m: 'Apr', returning: 78, neu: 14 },
    { m: 'May', returning: 88, neu: 12 },
  ];

  const segments = [
    { name: 'VIP (4+ visits/yr)', count: '2,180', pct: '17%', width: 45 },
    { name: 'Loyal (2–3 visits/yr)', count: '4,920', pct: '38%', width: 100 },
    { name: 'Occasional (1/yr)', count: '3,760', pct: '29%', width: 76 },
    { name: 'At-risk / lapsing', count: '1,980', pct: '16%', width: 40 },
  ];

  const lifecycle = [
    { label: 'New Guests', value: '3,980', sub: '100%', h: 100, step: null },
    { label: 'Returned < 90 Days', value: '1,512', sub: '38% return', h: 76, step: { keep: '38% return', lost: '62% lost' } },
    { label: 'Booked 3+ Times', value: '786', sub: '52% of returned', h: 60, step: { keep: '52% of returned', lost: '48% lost' } },
    { label: 'Active Member', value: '275', sub: '35% of repeat', h: 44, step: { keep: '35% of repeat', lost: '65% lost' } },
    { label: 'VIP · 5+ / yr', value: '77', sub: '28% of members', h: 32, step: { keep: '28% of members', lost: '72% lost' } },
  ];
  const lcColors = ['#5eead4', '#3fcbb7', '#27b6a0', '#15a08a', '#0f8a78'];

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className="text-xs font-semibold mt-2 text-teal-600">{k.note}</p>
          </div>
        ))}
      </div>

      {/* New vs Returning + Segments */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">New vs Returning Patients</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <Legend color="#7fe3d4" label="New" />
              <Legend color="#15a08a" label="Returning" />
            </div>
          </div>
          <div className="h-72 flex items-end justify-around gap-6 border-b border-gray-100">
            {months.map((mo) => (
              <div key={mo.m} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-16 flex flex-col justify-end" style={{ height: `${mo.returning + mo.neu}%` }}>
                  <div className="w-full rounded-t bg-[#7fe3d4]" style={{ height: `${(mo.neu / (mo.returning + mo.neu)) * 100}%` }}></div>
                  <div className="w-full bg-[#15a08a]" style={{ height: `${(mo.returning / (mo.returning + mo.neu)) * 100}%` }}></div>
                </div>
                <span className="text-xs text-gray-400 mt-3">{mo.m}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Patient Segments</h3>
          <div className="space-y-4">
            {segments.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <span className="text-sm font-bold tabular-nums">{s.count} · {s.pct}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${s.width}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Avg lifetime value</span>
              <span className="font-bold">$2,840</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">12-mo retention</span>
              <span className="font-bold text-teal-600">61.2%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Guest Lifecycle Funnel */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold">Guest Lifecycle Funnel</h3>
        <p className="text-xs text-gray-400 mt-1 mb-8">From first visit to VIP · conversion between stages · drop-off muted · trailing 12 months</p>
        <div className="flex items-end gap-2" style={{ height: '260px' }}>
          {lifecycle.map((stage, i) => (
            <React.Fragment key={stage.label}>
              <div className="flex flex-col justify-end items-center" style={{ width: '140px' }}>
                <div className="text-center mb-2">
                  <div className="text-2xl font-bold tabular-nums">{stage.value}</div>
                  <div className="text-xs font-semibold text-teal-700">{stage.sub}</div>
                </div>
                <div className="w-full rounded-t-md" style={{ height: `${stage.h}%`, backgroundColor: lcColors[i] }}></div>
                <div className="text-xs font-semibold text-gray-700 mt-3 text-center">{stage.label}</div>
              </div>
              {i < lifecycle.length - 1 && (
                <div className="flex flex-col items-center justify-end pb-16" style={{ width: '95px' }}>
                  <div className="text-xs font-bold text-teal-700 text-center">{lifecycle[i + 1].step.keep}</div>
                  <div className="text-[11px] text-gray-400 text-center">{lifecycle[i + 1].step.lost}</div>
                  <div className="text-gray-300 text-lg mt-1">→</div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* New vs Existing ASP + Revenue Contribution */}
      <div className="grid grid-cols-2 gap-10 bg-white rounded-xl p-6 border border-gray-200">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mb-5">New vs Existing · Avg Spend</p>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">New guest ASP</span>
                <span className="text-sm font-bold">$395</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-teal-400" style={{ width: '75.5%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">Existing guest ASP</span>
                <span className="text-sm font-bold">$523</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-teal-600" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[2px] mb-5">Revenue Contribution</p>
          <div className="flex h-9 rounded-md overflow-hidden text-xs font-bold text-white">
            <div className="bg-teal-400 flex items-center justify-center" style={{ width: '25%' }}>New 25%</div>
            <div className="bg-teal-700 flex items-center justify-center" style={{ width: '75%' }}>Existing 75%</div>
          </div>
          <p className="text-sm text-gray-500 mt-4">New guests are 31% of visits but 25% of revenue — under-indexed by 6 pts on lower first-visit ASP.</p>
        </div>
      </div>
    </div>
  );
};


/* ---------------- STAFF / PROVIDERS ---------------- */

const StaffProvidersView = () => {
  const kpis = [
    { label: 'ACTIVE PROVIDERS', value: '64', note: '▲ 3', positive: true },
    { label: 'ESTHETICIANS', value: '38', note: '▲ 2', positive: true },
    { label: 'PAYROLL MARGIN %', value: '33.8%', note: '▼ 0.9 pt', positive: false },
    { label: 'REV / PROVIDER HR', value: '$640', note: '▲ 5.1%', positive: true },
    { label: 'AVG REBOOK RATE', value: '68.4%', note: '▲ 2.1 pt', positive: true },
  ];

  const roleColors = {
    'NP · Injector': { bg: '#e6f3f0', fg: '#0f766e' },
    'RN · Injector': { bg: '#e6f3f0', fg: '#0f766e' },
    'PA · Injector': { bg: '#e6f3f0', fg: '#0f766e' },
    'Esthetician': { bg: '#fdf0e8', fg: '#c2680f' },
    'Laser Tech': { bg: '#eaf6f3', fg: '#2a9d8f' },
  };

  const providers = [
    { rank: 1, initials: 'DA', name: 'Dr. A. Patel', role: 'NP · Injector', rev: '$412K', n: 412, revhr: '$892', util: '88%', rebook: '79%' },
    { rank: 2, initials: 'MR', name: 'M. Romano', role: 'RN · Injector', rev: '$388K', n: 388, revhr: '$840', util: '86%', rebook: '76%' },
    { rank: 3, initials: 'SK', name: 'S. Klein', role: 'NP · Injector', rev: '$361K', n: 361, revhr: '$815', util: '85%', rebook: '74%' },
    { rank: 4, initials: 'JA', name: 'J. Alvarez', role: 'PA · Injector', rev: '$344K', n: 344, revhr: '$788', util: '84%', rebook: '72%' },
    { rank: 5, initials: 'DC', name: 'D. Cho', role: 'RN · Injector', rev: '$322K', n: 322, revhr: '$760', util: '83%', rebook: '71%' },
    { rank: 6, initials: 'LB', name: 'L. Bianchi', role: 'Esthetician', rev: '$214K', n: 214, revhr: '$312', util: '78%', rebook: '69%' },
    { rank: 7, initials: 'RO', name: 'R. Okafor', role: 'Esthetician', rev: '$198K', n: 198, revhr: '$298', util: '76%', rebook: '67%' },
    { rank: 8, initials: 'TN', name: 'T. Nguyen', role: 'Esthetician', rev: '$186K', n: 186, revhr: '$286', util: '75%', rebook: '66%' },
    { rank: 9, initials: 'KS', name: 'K. Sato', role: 'Laser Tech', rev: '$172K', n: 172, revhr: '$268', util: '74%', rebook: '64%' },
    { rank: 10, initials: 'PM', name: 'P. Mendes', role: 'Laser Tech', rev: '$158K', n: 158, revhr: '$254', util: '72%', rebook: '62%' },
  ];

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className={`text-xs font-semibold mt-2 ${k.positive ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-lg font-bold">Provider Leaderboard</h3>
          <span className="text-xs text-gray-400">Top performers · May 2026</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="px-6 py-3 text-left font-bold">#</th>
              <th className="px-2 py-3 text-left font-bold">PROVIDER</th>
              <th className="px-4 py-3 text-left font-bold">ROLE</th>
              <th className="px-4 py-3 text-left font-bold">REVENUE</th>
              <th className="px-4 py-3 text-right font-bold">REV/HR</th>
              <th className="px-4 py-3 text-right font-bold">UTIL</th>
              <th className="px-6 py-3 text-right font-bold">REBOOK</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {providers.map((p) => {
              const rc = roleColors[p.role];
              return (
                <tr key={p.rank} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-400 tabular-nums">{p.rank}</td>
                  <td className="px-2 py-4">
                    <span className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold flex items-center justify-center">{p.initials}</span>
                      <span className="font-bold text-gray-900">{p.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: rc.bg, color: rc.fg }}>{p.role}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-3">
                      <span className="w-36 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <span className="block h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${(p.n / 412) * 100}%` }}></span>
                      </span>
                      <span className="font-bold tabular-nums">{p.rev}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">{p.revhr}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{p.util}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{p.rebook}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- INVENTORY ---------------- */

const InvRow = ({ row, depth, expandable, expanded, onToggle }) => (
  <tr className={`border-b border-gray-50 ${depth === 0 ? 'bg-gray-50/40' : ''} ${expandable ? 'cursor-pointer hover:bg-gray-50' : ''}`} onClick={expandable ? onToggle : undefined}>
    <td className="px-5 py-3" style={{ paddingLeft: `${20 + depth * 28}px` }}>
      <span className={`flex items-center gap-2 ${depth < 2 ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
        {expandable ? (
          <span className="text-gray-400 text-xs w-3 inline-block">{expanded ? '▾' : '▸'}</span>
        ) : (
          <span className="w-3 inline-block"></span>
        )}
        {row.product}
      </span>
    </td>
    <td className="px-5 py-3 text-right tabular-nums">{row.purchases}</td>
    <td className="px-5 py-3 text-right tabular-nums">{row.usage}</td>
    <td className="px-5 py-3 text-right font-bold tabular-nums">{row.net}</td>
    <td className="px-5 py-3 text-right tabular-nums">{row.revunit}</td>
    <td className={`px-5 py-3 text-right tabular-nums ${row.lowSupply ? 'text-orange-600 font-semibold' : ''}`}>{row.days}</td>
    <td className="px-5 py-3 text-right text-gray-400 tabular-nums">{row.pct}</td>
  </tr>
);

const InventoryView = () => {
  const kpis = [
    { label: 'INVENTORY ON HAND', value: '$1.84M', note: '▲ 2.1%', positive: false },
    { label: 'COGS (MAY)', value: '$1.12M', note: '▲ 9.4%', positive: false },
    { label: 'INVENTORY TURNS', value: '7.3×', note: '▲ 0.4', positive: true },
    { label: 'DAYS OF SUPPLY', value: '41', note: '▼ 3', positive: true },
    { label: 'SHRINKAGE', value: '0.7%', note: '▼ 0.2 pt', positive: true },
  ];

  const topProducts = [
    { name: 'Botox (100u vial)', units: '842 vials', cogs: '$304K', days: '38d', low: false },
    { name: 'Juvéderm Voluma', units: '410 syr', cogs: '$168K', days: '22d', low: true },
    { name: 'Dysport (300u)', units: '388 vials', cogs: '$142K', days: '46d', low: false },
    { name: 'Restylane Lyft', units: '356 syr', cogs: '$131K', days: '31d', low: false },
    { name: 'Sculptra', units: '188 vials', cogs: '$96K', days: '19d', low: true },
    { name: 'SkinMedica (retail)', units: '620 units', cogs: '$74K', days: '52d', low: false },
    { name: 'PRF tubes', units: '1,240 units', cogs: '$38K', days: '12d', low: true },
  ];

  const reorder = [
    { name: 'Juvéderm Voluma', sub: '5 locations below par', level: 'Critical', critical: true },
    { name: 'Sculptra', sub: '3 locations below par', level: 'Critical', critical: true },
    { name: 'PRF tubes', sub: '7 locations below par', level: 'Low', critical: false },
    { name: 'Numbing cream', sub: '4 locations below par', level: 'Low', critical: false },
  ];

  const tree = [
    {
      product: 'Injectables', purchases: '2,880', usage: '94,512', net: '$1.09M', revunit: '$12', days: '24d', pct: '20.8%',
      children: [
        {
          product: 'Neurotoxins', purchases: '1,831', usage: '91,813', net: '$654K', revunit: '$7', days: '31d', pct: '12.5%',
          children: [
            { product: 'Xeomin', purchases: '1,065', usage: '60,621', net: '$330K', revunit: '$5', days: '31d', pct: '6.3%' },
            { product: 'Dysport', purchases: '437', usage: '18,266', net: '$181K', revunit: '$10', days: '24d', pct: '3.5%' },
            { product: 'Botox', purchases: '329', usage: '12,926', net: '$143K', revunit: '$11', days: '46d', pct: '2.7%' },
          ],
        },
        { product: 'Filler', purchases: '506', usage: '912', net: '$243K', revunit: '$266', days: '11d', pct: '4.6%', lowSupply: true,
          children: [
            { product: 'Juvéderm Voluma', purchases: '210', usage: '410', net: '$128K', revunit: '$312', days: '9d', pct: '2.4%', lowSupply: true },
            { product: 'Restylane Lyft', purchases: '186', usage: '356', net: '$74K', revunit: '$208', days: '14d', pct: '1.4%' },
            { product: 'Other syringes', purchases: '110', usage: '146', net: '$41K', revunit: '$281', days: '12d', pct: '0.8%', lowSupply: true },
          ],
        },
        { product: 'PRF', purchases: '152', usage: '461', net: '$44K', revunit: '$95', days: '21d', pct: '0.8%' },
        { product: 'Other / ancillary', purchases: '391', usage: '1,326', net: '$149K', revunit: '$112', days: '33d', pct: '2.8%' },
      ],
    },
  ];

  const [expanded, setExpanded] = useState({ 'Injectables': true, 'Injectables/Neurotoxins': true });
  const toggle = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const rows = [];
  tree.forEach((cat) => {
    const catKey = cat.product;
    rows.push({ row: cat, depth: 0, expandable: !!cat.children, expanded: expanded[catKey], key: catKey });
    if (cat.children && expanded[catKey]) {
      cat.children.forEach((sub) => {
        const subKey = `${catKey}/${sub.product}`;
        rows.push({ row: sub, depth: 1, expandable: !!sub.children, expanded: expanded[subKey], key: subKey });
        if (sub.children && expanded[subKey]) {
          sub.children.forEach((leaf) => {
            rows.push({ row: leaf, depth: 2, expandable: false, key: `${subKey}/${leaf.product}` });
          });
        }
      });
    }
  });

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className={`text-xs font-semibold mt-2 ${k.positive ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold">Top Products by Consumption</h3>
            <span className="text-xs text-gray-400">May 2026 · COGS</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-bold pb-3">PRODUCT</th>
                <th className="text-right font-bold pb-3">UNITS</th>
                <th className="text-right font-bold pb-3">COGS</th>
                <th className="text-right font-bold pb-3">DAYS LEFT</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.name} className="border-b border-gray-50">
                  <td className="py-3.5 text-gray-800">{p.name}</td>
                  <td className="py-3.5 text-right tabular-nums">{p.units}</td>
                  <td className="py-3.5 text-right tabular-nums">{p.cogs}</td>
                  <td className={`py-3.5 text-right tabular-nums ${p.low ? 'text-orange-600 font-semibold' : ''}`}>{p.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold">Reorder Alerts</h3>
          <p className="text-xs text-gray-400 mt-1 mb-5">Below par level</p>
          <div className="space-y-4">
            {reorder.map((r) => (
              <div key={r.name} className="flex items-start justify-between border-b border-gray-50 pb-4 last:border-0">
                <div className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 ${r.critical ? 'bg-orange-500' : 'bg-amber-300'}`}></span>
                  <div>
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.sub}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${r.critical ? 'text-orange-600' : 'text-amber-500'}`}>{r.level}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-5 pt-1">
            <span className="text-sm text-gray-500">Retail sell-through</span>
            <span className="text-sm font-bold text-teal-600">58.3%</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold">Product Consumption</h3>
          <p className="text-xs text-gray-400 mt-1">Category → sub-segment → product · click rows to drill in · May 2026</p>
        </div>
        <div className="px-6 pt-4">
          <div className="bg-orange-50 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-orange-800">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span><span className="font-bold">3 products below 14-day supply</span> — reorder now: Versa, Radiesse, Sculptra.</span>
          </div>
        </div>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="px-5 py-3 text-left font-bold" style={{ paddingLeft: '20px' }}>PRODUCT</th>
              <th className="px-5 py-3 text-right font-bold">PURCHASES</th>
              <th className="px-5 py-3 text-right font-bold">USAGE QTY</th>
              <th className="px-5 py-3 text-right font-bold">NET SALES</th>
              <th className="px-5 py-3 text-right font-bold">REV / UNIT</th>
              <th className="px-5 py-3 text-right font-bold">DAYS SUPPLY</th>
              <th className="px-5 py-3 text-right font-bold">% OF SALES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <InvRow key={r.key} row={r.row} depth={r.depth} expandable={r.expandable} expanded={r.expanded} onToggle={() => toggle(r.key)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- MEMBERSHIPS ---------------- */

const MembershipsView = () => {
  const kpis = [
    { label: 'ACTIVE MEMBERS', value: '3,530', note: '▲ 7.8%', positive: true },
    { label: 'ADOPTION RATE', value: '27.5%', note: '▲ 1.4 pt', positive: true },
    { label: 'MRR', value: '$634K', note: '▲ 8.2%', positive: true },
    { label: 'MONTHLY CHURN', value: '3.4%', note: '▼ 0.3 pt', positive: true },
    { label: 'AVG MEMBER VALUE', value: '$3,910', note: '▲ 5.1%', positive: true },
  ];

  const mrrTrend = [
    { m: 'Jun', v: 30 }, { m: 'Jul', v: 33 }, { m: 'Aug', v: 38 }, { m: 'Sep', v: 41 },
    { m: 'Oct', v: 47 }, { m: 'Nov', v: 52 }, { m: 'Dec', v: 58 }, { m: 'Jan', v: 64 },
    { m: 'Feb', v: 72 }, { m: 'Mar', v: 81 }, { m: 'Apr', v: 92 }, { m: 'May', v: 100 },
  ];

  const tiers = [
    { name: 'Evolve Elite ($299/mo)', count: '740', pct: '21%', width: 53 },
    { name: 'Evolve Plus ($149/mo)', count: '1,360', pct: '39%', width: 97 },
    { name: 'Evolve Core ($79/mo)', count: '1,430', pct: '40%', width: 100 },
  ];

  return (
    <div className="px-9 py-8 space-y-6">
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5 min-h-[120px]">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold text-gray-950 mt-4 tabular-nums">{k.value}</p>
            <p className={`text-xs font-semibold mt-2 ${k.positive ? 'text-teal-600' : 'text-orange-600'}`}>{k.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Active Members & MRR</h3>
            <span className="text-xs text-gray-400">Trailing 12 months</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrTrend} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f9b8e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0f9b8e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} interval={1} />
                <YAxis hide domain={[0, 110]} />
                <Area type="monotone" dataKey="v" stroke="#0f9b8e" strokeWidth={2.5} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold mb-6">Membership Tiers</h3>
          <div className="space-y-5">
            {tiers.map((t) => (
              <div key={t.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">{t.name}</span>
                  <span className="text-sm font-bold tabular-nums">{t.count} · {t.pct}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-600" style={{ width: `${t.width}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Monthly churn</span>
              <span className="font-bold text-orange-600">3.4%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Deferred revenue liability</span>
              <span className="font-bold">$2.18M</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-4 mb-4">
    <h2 className="text-sm font-bold text-teal-700 uppercase tracking-[4px]">{title}</h2>
    <div className="h-px bg-gray-200 flex-1"></div>
  </div>
);

export default Dashboard;
