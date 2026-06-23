import React, { useState } from 'react';

const Dashboard = () => {
  const [selectedLocation, setSelectedLocation] = useState('All 14 locations');
  const [selectedMonth, setSelectedMonth] = useState('May 2026');

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

      <nav className="flex-1">
        <div className="bg-[#103c35] border-l-4 border-teal-400 px-6 py-4 flex items-center gap-3 font-semibold">
          <span className="w-2 h-2 rounded-full bg-teal-400"></span>
          Overview
        </div>

        {['Finance', 'Operations', 'Locations', 'Marketing', 'Clinical', 'Patients / CRM', 'Staff / Providers', 'Inventory', 'Memberships'].map((item) => (
          <div key={item} className="px-6 py-4 flex items-center gap-3 text-teal-100 hover:bg-[#0d322d]">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            {item}
          </div>
        ))}
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

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      <Sidebar />

      <main className="ml-72 min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-9 py-7 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-950">Business Overview</h1>
              <p className="text-gray-500 mt-1">Performance across all locations · Month to date</p>
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
            {financialMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <SectionTitle title="Operational" />
          <div className="grid grid-cols-8 gap-4 mb-8">
            {operationalMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <SectionTitle title="Marketing" />
          <div className="grid grid-cols-5 gap-4 mb-8">
            {marketingMetrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
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
      </main>
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