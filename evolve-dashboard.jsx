import React, { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

const Dashboard = () => {
  const [selectedLocation, setSelectedLocation] = useState('All 14 locations');
  const [selectedMonth, setSelectedMonth] = useState('May 2026');

  // Key Performance Indicators
  const kpis = [
    { label: 'CASH SALES', mtd: '$1.12M', variance: '↑ 9.7%', projected: '$1.94M', projVariance: '↑ 10.4%' },
    { label: 'RECOGNIZED REVENUE', mtd: '$1.09M', variance: '↑ 12.3%', projected: '$1.88M', projVariance: '↑ 13.1%' },
  ];

  // Financial metrics
  const financialMetrics = [
    { label: '% TO BUDGET VARIANCE TO GOAL', value: '94%', note: '6% to goal', isNegative: true },
    { label: '$$$ GROWTH YOY %', value: '+7.8%', note: '+1.2 pt', trend: 'up' },
    { label: 'PRIOR DAY SALES', value: '$71.2K', note: '+4.3%', trend: 'up' },
    { label: 'ASP (NEW)', value: '$395', note: '+3.2%', trend: 'up' },
    { label: 'ASP (EXISTING)', value: '$523', note: '+4.6%', trend: 'up' },
    { label: 'COGS MARGIN %', value: '21.3%', note: '▼ 0.6 pt', trend: 'down' },
    { label: 'PAYROLL MARGIN %', value: '33.8%', note: '▼ 0.9 pt', trend: 'down' },
  ];

  // Operational metrics
  const operationalMetrics = [
    { label: 'NO-SHOW RATE', value: '4.2%', note: '▼ 0.5 pt', trend: 'down' },
    { label: 'CANCELLATION RATE', value: '6.8%', note: '▼ 0.3 pt', trend: 'down' },
    { label: 'MEMBERSHIP ADOPTION', value: '27.5%', note: '↑ 1.4 pt', trend: 'up' },
    { label: 'REV / HR • PROVIDER', value: '$640', note: '↑ 5.1%', trend: 'up' },
    { label: 'REV / HR • ESTHETICIAN', value: '$285', note: '↑ 2.8%', trend: 'up' },
    { label: 'UTILIZATION • PROVIDER', value: '82.4%', note: '↑ 1.9 pt', trend: 'up' },
    { label: 'UTILIZATION • ESTHETICIAN', value: '71.6%', note: '↑ 0.8 pt', trend: 'up' },
    { label: 'REBOOK RATE %', value: '68.4%', note: '↑ 2.1 pt', trend: 'up' },
  ];

  // Marketing metrics
  const marketingMetrics = [
    { label: 'NEW CUSTOMER VISITS', value: '3,980', note: '↑ 6.4%', trend: 'up' },
    { label: 'EXISTING CUSTOMER VISITS', value: '8,860', note: '↑ 10.1%', trend: 'up' },
    { label: 'MTD AD SPEND', value: '$148K', note: '↓ 5.2% MoM', trend: 'down', highlight: true },
    { label: 'CLIENT ACQUISITION COST', value: '$372', note: '▼ 2.8%', trend: 'down' },
    { label: 'NEW GUEST RETURN RATE - 90 DAY', value: '38%', note: '↑ 2.1 pt', trend: 'up' },
  ];

  // Location data
  const locationData = [
    { name: 'Ridgewood', sales: '$214K', budget: '$354K', budgetPct: '97%', revenue: '$333K', cogs: '20.3%', payroll: '33.5%', util: '62%', newCust: 149, existCust: 903, asp: '$443', aspExist: '$332', utilEsth: '80%', revHr: '$651', goalAchieve: '69%', prevDay: '$194', rebook: '67%' },
    { name: 'Waldorf', sales: '$81K', budget: '$147K', budgetPct: '82%', revenue: '$138K', cogs: '24.3%', payroll: '39.8%', util: '53%', newCust: 62, existCust: 375, asp: '$401', aspExist: '$304', utilEsth: '66%', revHr: '$497', goalAchieve: '55%', prevDay: '$138', rebook: '58%' },
    { name: 'Glenwood', sales: '$74K', budget: '$131K', budgetPct: '79%', revenue: '$123K', cogs: '24.8%', payroll: '40.5%', util: '52%', newCust: 55, existCust: 334, asp: '$395', aspExist: '$300', utilEsth: '64%', revHr: '$475', goalAchieve: '53%', prevDay: '$130', rebook: '57%' },
    { name: 'Bridgewater', sales: '$45K', budget: '$78K', budgetPct: '73%', revenue: '$73K', cogs: '26.1%', payroll: '42.6%', util: '49%', newCust: 33, existCust: 199, asp: '$383', aspExist: '$292', utilEsth: '60%', revHr: '$431', goalAchieve: '49%', prevDay: '$114', rebook: '54%' },
    { name: 'Lancaster', sales: '$42K', budget: '$71K', budgetPct: '71%', revenue: '$67K', cogs: '26.6%', payroll: '43.3%', util: '48%', newCust: 30, existCust: 181, asp: '$380', aspExist: '$290', utilEsth: '59%', revHr: '$420', goalAchieve: '48%', prevDay: '$110', rebook: '53%' },
  ];

  // Detailed location performance
  const detailedLocations = [
    { name: 'Hoboken', cash: '$342K', runRate: '108%', recRev: '$575K', revenue: '$515K', cogs: '18.5%', payroll: '30.7%', util: '66%', newCust: 257, existCust: 1561, asp: '$461', aspExist: '$344', utilProvider: '86%', revHr: '$717', utilEsth: '75%', revHrEsth: '$218', rebook: '71%' },
    { name: 'Jersey City', cash: '$312K', runRate: '104%', recRev: '$548K', revenue: '$515K', cogs: '18.9%', payroll: '31.4%', util: '65%', newCust: 230, existCust: 1397, asp: '$458', aspExist: '$342', utilProvider: '85%', revHr: '$706', utilEsth: '74%', revHrEsth: '$214', rebook: '70%' },
    { name: 'Montclair', cash: '$303K', runRate: '111%', recRev: '$521K', revenue: '$490K', cogs: '18%', payroll: '30%', util: '67%', newCust: 219, existCust: 1329, asp: '$455', aspExist: '$340', utilProvider: '84%', revHr: '$695', utilEsth: '73%', revHrEsth: '$210', rebook: '72%' },
    { name: 'Short Hills', cash: '$295K', runRate: '99%', recRev: '$498K', revenue: '$468K', cogs: '19.4%', payroll: '32.1%', util: '64%', newCust: 209, existCust: 1270, asp: '$452', aspExist: '$338', utilProvider: '83%', revHr: '$684', utilEsth: '72%', revHrEsth: '$206', rebook: '69%' },
    { name: 'Denville', cash: '$282K', runRate: '102%', recRev: '$467K', revenue: '$439K', cogs: '18.9%', payroll: '31.4%', util: '65%', newCust: 196, existCust: 1191, asp: '$449', aspExist: '$336', utilProvider: '82%', revHr: '$673', utilEsth: '71%', revHrEsth: '$202', rebook: '70%' },
    { name: 'Red Bank', cash: '$245K', runRate: '96%', recRev: '$441K', revenue: '$415K', cogs: '19.4%', payroll: '32.1%', util: '64%', newCust: 185, existCust: 1125, asp: '$446', aspExist: '$334', utilProvider: '81%', revHr: '$662', utilEsth: '70%', revHrEsth: '$198', rebook: '68%' },
    { name: 'Tribeca', cash: '$260K', runRate: '92%', recRev: '$458K', revenue: '$431K', cogs: '20.3%', payroll: '33.5%', util: '62%', newCust: 192, existCust: 1168, asp: '$443', aspExist: '$332', utilProvider: '80%', revHr: '$651', utilEsth: '69%', revHrEsth: '$194', rebook: '67%' },
    { name: 'Bel Air', cash: '$228K', runRate: '101%', recRev: '$392K', revenue: '$368K', cogs: '19.8%', payroll: '32.8%', util: '63%', newCust: 165, existCust: 1000, asp: '$440', aspExist: '$330', utilProvider: '79%', revHr: '$640', utilEsth: '68%', revHrEsth: '$190', rebook: '68%' },
    { name: 'Frederick', cash: '$219K', runRate: '88%', recRev: '$369K', revenue: '$347K', cogs: '20.7%', payroll: '34.2%', util: '61%', newCust: 155, existCust: 941, asp: '$437', aspExist: '$328', utilProvider: '78%', revHr: '$629', utilEsth: '67%', revHrEsth: '$186', rebook: '66%' },
  ];

  // Service & Product Mix
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

  const MetricCard = ({ label, value, note, trend, highlight = false }) => (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className={`text-xs mt-1 ${highlight ? 'text-red-600' : 'text-teal-600'}`}>{note}</p>
    </div>
  );

  const TrendArrow = ({ value }) => {
    if (!value) return null;
    if (value.includes('↑') || value.includes('+')) return <span className="text-teal-500">↑</span>;
    if (value.includes('▼') || value.includes('-')) return <span className="text-red-500">▼</span>;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold">E</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Evolve Med Spa</h1>
                <p className="text-sm text-gray-600">Business Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <option>All 14 locations</option>
                <option>Single Location</option>
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <option>May 2026</option>
                <option>April 2026</option>
              </select>
              <button className="px-6 py-2 rounded-lg bg-teal-600 text-white font-medium text-sm hover:bg-teal-700">
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Section */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white rounded-lg p-6 border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{kpi.label}</p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-gray-900">{kpi.mtd}</p>
                  <p className="text-sm text-teal-600 mt-1">{kpi.variance}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-600">Projected</p>
                  <p className="text-2xl font-bold text-gray-900">{kpi.projected}</p>
                  <p className="text-sm text-teal-600 mt-1">{kpi.projVariance}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Metrics */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Financial Metrics</h2>
          <div className="grid grid-cols-4 gap-4">
            {financialMetrics.map((metric, idx) => (
              <MetricCard
                key={idx}
                label={metric.label}
                value={metric.value}
                note={metric.note}
                trend={metric.trend}
                highlight={metric.isNegative}
              />
            ))}
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Operational Metrics</h2>
          <div className="grid grid-cols-4 gap-4">
            {operationalMetrics.map((metric, idx) => (
              <MetricCard key={idx} label={metric.label} value={metric.value} note={metric.note} />
            ))}
          </div>
        </div>

        {/* Marketing Metrics */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Marketing Metrics</h2>
          <div className="grid grid-cols-5 gap-4">
            {marketingMetrics.map((metric, idx) => (
              <MetricCard
                key={idx}
                label={metric.label}
                value={metric.value}
                note={metric.note}
                highlight={metric.highlight}
              />
            ))}
          </div>
        </div>

        {/* Service & Product Mix */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Service Mix</h3>
            <div className="space-y-3">
              {serviceMix.map((service, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-3 h-3 rounded-full" style={{
                      backgroundColor: idx === 0 ? '#14b8a6' : idx === 1 ? '#0d9488' : idx === 2 ? '#17a697' : idx === 3 ? '#7fd3c3' : idx === 4 ? '#f59e0b' : '#d1d5db'
                    }}></div>
                    <span className="text-sm text-gray-700">{service.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{service.percentage}%</span>
                </div>
              ))}
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-6">55%</p>
            <p className="text-xs text-gray-600 mt-1">Injectables</p>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Product Mix</h3>
            <div className="space-y-3">
              {productMix.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-16 h-2 bg-teal-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${(product.units / 2310) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-700">{product.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 ml-4 w-12 text-right">{product.units}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Location Performance Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Location Performance</h2>
            <p className="text-xs text-gray-600 mt-1">Detailed metrics by location</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">LOCATION</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">CASH PROJ</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">RUN RATE</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">REC. REV</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">COGS%</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">PAYROLL%</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">UTIL%</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">NEW CUST</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">EXIST CUST</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">ASP NEW</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">ASP EXIST</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">UTIL PROV%</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">REV/HR</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">UTIL ESTH%</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">REV/HR ESTH</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">REBOOK%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detailedLocations.map((loc, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">{loc.name}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.cash}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${parseInt(loc.runRate) >= 100 ? 'text-teal-600' : 'text-orange-600'}`}>
                        {loc.runRate}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{loc.recRev}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.cogs}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.payroll}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.util}%</td>
                    <td className="px-6 py-4 text-gray-700">{loc.newCust}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.existCust}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.asp}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.aspExist}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${parseInt(loc.utilProvider) >= 85 ? 'text-teal-600' : parseInt(loc.utilProvider) >= 75 ? 'text-gray-700' : 'text-orange-600'}`}>
                        {loc.utilProvider}%
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-teal-600">{loc.revHr}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${parseInt(loc.utilEsth) >= 70 ? 'text-teal-600' : 'text-orange-600'}`}>
                        {loc.utilEsth}%
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-orange-600">{loc.revHrEsth}</td>
                    <td className="px-6 py-4 text-gray-700">{loc.rebook}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Row */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-5 gap-8">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Locations</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">14</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Cash Sales</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">$2,942K</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">$4,782K</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Avg Budget Attainment</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">81%</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Avg Rebook Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">68%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
