import React, { useState } from 'react';
import { 
  ShieldAlert, 
  BrainCircuit, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  TrendingUp, 
  Info,
  ArrowRight,
  Calculator
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { predictLateDeliveryRisk, generateProcurementRecommendations } from '../../../utils/predictiveEngine';
import { Badge } from '../../common/Badge';
import { ScoreGauge, LineTrendChart } from '../../common/MiniChart';

export const ReliabilityRiskModule: React.FC = () => {
  const { vendors, purchaseOrders, currentRole, currentUser, currentVendorId } = useApp();

  const isVendor = currentRole === 'Vendor';
  const effectiveVendorId = (isVendor && currentUser.vendorId) ? currentUser.vendorId : currentVendorId;
  const scopedVendors = isVendor ? vendors.filter(v => v.id === effectiveVendorId) : vendors;

  // Interactive late delivery risk simulator
  const [simVendorId, setSimVendorId] = useState(effectiveVendorId || scopedVendors[0]?.id || '');
  const [simOrderValue, setSimOrderValue] = useState(35000);
  const [simScheduledDays, setSimScheduledDays] = useState(14);
  const [simCarrier, setSimCarrier] = useState('FedEx Freight');

  const selectedSimVendor = scopedVendors.find(v => v.id === simVendorId) || scopedVendors[0] || vendors[0];

  const simulatedRisk = predictLateDeliveryRisk(selectedSimVendor, {
    totalAmount: simOrderValue,
    expectedDaysLeadTime: simScheduledDays,
  });

  const recommendations = generateProcurementRecommendations(scopedVendors);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Predictive Reliability & Supplier Risk Radar</h1>
            <Badge variant="purple" size="sm">Machine Learning Engine</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated reliability scoring models, transit bottleneck forecasting, and algorithmic procurement recommendations.
          </p>
        </div>
      </div>

      {/* Predictive Late Delivery Simulator Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Late Delivery Risk Forecaster (Logistic Regression Model)</h3>
              <p className="text-xs text-slate-400">Simulate order attributes against historical supply chain data to predict transit delay likelihood</p>
            </div>
          </div>
          <Badge variant="info" size="sm">Trained on Supply Chain Data</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Supplier</label>
                <select
                  value={simVendorId}
                  onChange={(e) => setSimVendorId(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-semibold"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category} — {v.metrics.onTimeDeliveryRate}% on-time)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Freight Carrier Route</label>
                <select
                  value={simCarrier}
                  onChange={(e) => setSimCarrier(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="FedEx Freight">FedEx Freight (Priority Interstate)</option>
                  <option value="UPS Supply Chain Solutions">UPS Supply Chain Solutions</option>
                  <option value="DHL Global Forwarding">DHL Global Forwarding (Air Cargo)</option>
                  <option value="Maersk Line Logistics">Maersk Line Logistics (Ocean Maritime)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-slate-300">Purchase Order Value (₹)</span>
                  <span className="font-mono text-sky-400">₹{simOrderValue.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="200000"
                  step="5000"
                  value={simOrderValue}
                  onChange={(e) => setSimOrderValue(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>₹5k</span>
                  <span>₹100k</span>
                  <span>₹200k</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-slate-300">Scheduled Lead Time (Days)</span>
                  <span className="font-mono text-sky-400">{simScheduledDays} Days</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="45"
                  step="1"
                  value={simScheduledDays}
                  onChange={(e) => setSimScheduledDays(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>3d (Urgent)</span>
                  <span>14d (Standard)</span>
                  <span>45d (Long-lead)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Prediction Outcome */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between text-xs">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Forecasted Delay Likelihood
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-black font-mono tracking-tight ${
                  simulatedRisk.probability >= 50 ? 'text-rose-400' :
                  simulatedRisk.probability >= 25 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {simulatedRisk.probability}%
                </span>
                <Badge
                  variant={
                    simulatedRisk.probability >= 50 ? 'danger' :
                    simulatedRisk.probability >= 25 ? 'warning' : 'success'
                  }
                  size="sm"
                >
                  {simulatedRisk.riskCategory}
                </Badge>
              </div>
            </div>

            <div className="my-2 py-2 border-t border-b border-slate-800 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Model Influencing Factors:</span>
              <p className="text-[11px] text-slate-300">
                {simulatedRisk.contributingFactors.join(' • ')}
              </p>
            </div>

            <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
              <span className="text-[10px] font-bold text-sky-400 uppercase block mb-0.5">Recommendation:</span>
              <p className="text-[11px] text-slate-300">
                {simulatedRisk.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendations & High Risk Suppliers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Recommended Suppliers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Recommended Preferred Suppliers</h3>
            </div>
            <Badge variant="success" size="sm">Top Tier Leaders</Badge>
          </div>

          <div className="space-y-3 text-xs">
            {recommendations.topRecommended.map((vendor) => (
              <div key={vendor.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-sm">{vendor.name}</span>
                    <p className="text-[11px] text-slate-400">{vendor.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 text-base">{vendor.reliabilityScore}/100</span>
                    <span className="text-[10px] text-slate-500 block">Score</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">On-Time:</span>
                    <span className="text-slate-200 font-mono font-semibold">{vendor.metrics.onTimeDeliveryRate}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Quality:</span>
                    <span className="text-slate-200 font-mono font-semibold">{vendor.metrics.qualityRating} ★</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Lead Time:</span>
                    <span className="text-slate-200 font-mono font-semibold">Fast</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suppliers Flagged for Mitigation */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Suppliers Flagged for Risk Mitigation</h3>
            </div>
            <Badge variant="danger" size="sm">Action Required</Badge>
          </div>

          <div className="space-y-3 text-xs">
            {recommendations.riskAlerts.map((item) => (
              <div key={item.vendor.id} className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-sm">{item.vendor.name}</span>
                    <p className="text-[11px] text-rose-300">{item.vendor.category}</p>
                  </div>
                  <Badge variant="danger" size="sm">Score: {item.vendor.reliabilityScore}</Badge>
                </div>

                <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-rose-950">
                  <div className="text-rose-400 font-semibold text-[11px]">Identified Vulnerability:</div>
                  <p className="text-[11px] text-slate-300">
                    {item.reason}
                  </p>
                </div>

                {item.suggestedAlternative && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="font-semibold text-sky-400">Suggested Alternative:</span>
                    <span className="text-slate-200 font-medium">{item.suggestedAlternative}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
