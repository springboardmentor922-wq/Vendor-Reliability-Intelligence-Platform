import React, { useState } from 'react';
import { 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ArrowUpDown, 
  Search, 
  Star,
  ShieldCheck,
  Building2,
  Calendar,
  Printer,
  Download
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Vendor } from '../../../types';
import { Badge } from '../../common/Badge';
import { LineTrendChart, ScoreGauge } from '../../common/MiniChart';
import { Modal } from '../../common/Modal';
import { exportToCSV, triggerPrintReport } from '../../../utils/exportUtils';

export const PerformanceModule: React.FC = () => {
  const { vendors, updateVendor, currentRole, currentUser, currentVendorId } = useApp();

  const isVendor = currentRole === 'Vendor';
  const effectiveVendorId = (isVendor && currentUser.vendorId) ? currentUser.vendorId : currentVendorId;
  const scopedVendors = isVendor ? vendors.filter(v => v.id === effectiveVendorId) : vendors;

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'reliabilityScore' | 'onTime' | 'quality' | 'defect'>('reliabilityScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [inspectVendor, setInspectVendor] = useState<Vendor | null>(null);

  // Sorting
  const sortedVendors = [...scopedVendors].filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    let aVal = 0;
    let bVal = 0;
    if (sortField === 'reliabilityScore') {
      aVal = a.reliabilityScore;
      bVal = b.reliabilityScore;
    } else if (sortField === 'onTime') {
      aVal = a.metrics.onTimeDeliveryRate;
      bVal = b.metrics.onTimeDeliveryRate;
    } else if (sortField === 'quality') {
      aVal = a.metrics.qualityRating;
      bVal = b.metrics.qualityRating;
    } else if (sortField === 'defect') {
      aVal = a.metrics.defectRate;
      bVal = b.metrics.defectRate;
    }

    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExportCSV = () => {
    const rows = sortedVendors.map((v, idx) => ({
      Rank: `#${idx + 1}`,
      SupplierName: v.name,
      Category: v.category,
      ReliabilityScore: `${v.reliabilityScore}/100`,
      Tier: v.tier,
      RiskLevel: v.riskLevel,
      OnTimeDeliveryRate: `${v.metrics.onTimeDeliveryRate}%`,
      QualityRating: `${v.metrics.qualityRating}/5.0`,
      DefectRate: `${v.metrics.defectRate}%`,
      ResponseTimeHours: `${v.metrics.responseTimeHours}h`,
      TotalOrders: v.metrics.totalOrders,
      TotalSpend: `₹${v.totalSpend.toLocaleString('en-IN')}`
    }));

    exportToCSV('VendorIQ_Performance_Rankings', rows, {
      Rank: 'Rank',
      SupplierName: 'Supplier Name',
      Category: 'Category',
      ReliabilityScore: 'Reliability Score',
      Tier: 'Supplier Tier',
      RiskLevel: 'Risk Level',
      OnTimeDeliveryRate: 'On-Time SLA %',
      QualityRating: 'Quality Score',
      DefectRate: 'Defect Rate %',
      ResponseTimeHours: 'Response Time (hrs)',
      TotalOrders: 'Total Orders',
      TotalSpend: 'Cumulative Spend (₹)'
    });
  };

  const handlePrintPDF = () => {
    const rows = sortedVendors.map((v, idx) => ({
      Rank: `#${idx + 1}`,
      SupplierName: v.name,
      Category: v.category,
      ReliabilityScore: `${v.reliabilityScore}/100`,
      Tier: v.tier,
      RiskLevel: v.riskLevel,
      OnTimeDeliveryRate: `${v.metrics.onTimeDeliveryRate}%`,
      QualityRating: `${v.metrics.qualityRating}/5.0`,
      DefectRate: `${v.metrics.defectRate}%`,
      TotalSpend: `₹${v.totalSpend.toLocaleString('en-IN')}`
    }));
    triggerPrintReport('Vendor_Performance_Quality_Report', rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Vendor Performance & Quality Evaluation</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Quantitative SLA monitoring: delivery precision, quality audit scores, response latency, and historical vendor rankings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Export performance matrix to CSV/Excel"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Export CSV
          </button>
          <button
            onClick={handlePrintPDF}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Print or Save PDF"
          >
            <Printer className="h-3.5 w-3.5 text-sky-400" />
            Print / PDF
          </button>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search vendor ranking..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Leaderboard & Ranking Matrix */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Dynamic Supplier Ranking Matrix</h3>
            <p className="text-xs text-slate-400">Click headers to sort across operational performance criteria</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Sorted by:</span>
            <span className="font-semibold text-sky-400 font-mono">
              {sortField} ({sortOrder.toUpperCase()})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Rank</th>
                <th className="py-3 px-3">Supplier Name & Category</th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-white"
                  onClick={() => toggleSort('reliabilityScore')}
                >
                  <div className="flex items-center gap-1">
                    <span>Reliability Score</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-white"
                  onClick={() => toggleSort('onTime')}
                >
                  <div className="flex items-center gap-1">
                    <span>On-Time Delivery</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-white"
                  onClick={() => toggleSort('quality')}
                >
                  <div className="flex items-center gap-1">
                    <span>Quality Rating</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th 
                  className="py-3 px-3 cursor-pointer hover:text-white"
                  onClick={() => toggleSort('defect')}
                >
                  <div className="flex items-center gap-1">
                    <span>Defect Rate</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Response SLA</th>
                <th className="py-3 px-3 text-right">Radar View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {sortedVendors.map((vendor, idx) => {
                const rank = idx + 1;
                return (
                  <tr key={vendor.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold font-mono ${
                          rank === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                          rank === 2 ? 'bg-slate-400/20 text-slate-200 border border-slate-400/40' :
                          rank === 3 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          #{rank}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-bold text-white text-sm">{vendor.name}</p>
                      <span className="text-[11px] text-slate-400">{vendor.category} • {vendor.tier}</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">{vendor.reliabilityScore}</span>
                        <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              vendor.reliabilityScore >= 85 ? 'bg-emerald-500' :
                              vendor.reliabilityScore >= 70 ? 'bg-blue-500' :
                              vendor.reliabilityScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${vendor.reliabilityScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-emerald-400">{vendor.metrics.onTimeDeliveryRate}%</span>
                      <span className="text-[11px] text-slate-500 block">
                        {vendor.metrics.onTimeDeliveries} of {vendor.metrics.totalDeliveries} orders
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{vendor.metrics.qualityRating}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Service: {vendor.metrics.serviceRating} ★</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`font-mono font-bold ${
                        vendor.metrics.defectRate > 2.5 ? 'text-rose-400' : 'text-slate-300'
                      }`}>
                        {vendor.metrics.defectRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-slate-200">{vendor.metrics.communicationResponseTimeHours} hrs</span>
                      <span className="text-[10px] text-slate-500 block">Res: {vendor.metrics.issueResolutionTimeDays} days</span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => setInspectVendor(vendor)}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Inspect Trends →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Vendor Modal with Full Historical Trends */}
      {inspectVendor && (
        <Modal
          isOpen={!!inspectVendor}
          onClose={() => setInspectVendor(null)}
          title={`${inspectVendor.name} — Performance Radar`}
          subtitle={`${inspectVendor.category} | Current Composite Score: ${inspectVendor.reliabilityScore}/100`}
          maxWidth="3xl"
        >
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center">
                <ScoreGauge score={inspectVendor.reliabilityScore} size={130} label="Current Rating" />
                <Badge
                  variant={inspectVendor.riskLevel === 'Low' ? 'success' : inspectVendor.riskLevel === 'Medium' ? 'info' : 'danger'}
                  size="sm"
                  className="mt-2"
                >
                  {inspectVendor.tier} ({inspectVendor.riskLevel} Risk)
                </Badge>
              </div>

              <div className="sm:col-span-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Multi-Factor Factor Weights</h4>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-slate-400">Delivery History (30% weight)</span>
                      <span className="font-mono text-emerald-400">{inspectVendor.reliabilityFactors.deliveryHistoryScore}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${inspectVendor.reliabilityFactors.deliveryHistoryScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-slate-400">Product Quality (25% weight)</span>
                      <span className="font-mono text-sky-400">{inspectVendor.reliabilityFactors.productQualityScore}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${inspectVendor.reliabilityFactors.productQualityScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-slate-400">Contract Compliance (15% weight)</span>
                      <span className="font-mono text-purple-400">{inspectVendor.reliabilityFactors.contractComplianceScore}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${inspectVendor.reliabilityFactors.contractComplianceScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="text-slate-400">Communication Responsiveness (10% weight)</span>
                      <span className="font-mono text-amber-400">{inspectVendor.reliabilityFactors.communicationEfficiencyScore}/100</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${inspectVendor.reliabilityFactors.communicationEfficiencyScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical chart */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white">Historical Performance Evolution</h4>
              <LineTrendChart
                data={inspectVendor.performanceHistory.map(ph => ({
                  label: ph.month,
                  value: ph.reliabilityScore,
                }))}
                color="#38bdf8"
                height={130}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
