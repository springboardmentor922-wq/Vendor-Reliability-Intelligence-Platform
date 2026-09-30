import React from 'react';
import { 
  Network, 
  Truck, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  ArrowRight,
  Clock,
  Compass
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { StatCard } from '../../common/StatCard';
import { LineTrendChart, ScoreGauge } from '../../common/MiniChart';
import { Badge } from '../../common/Badge';

export const SupplyChainDashboardView: React.FC = () => {
  const { vendors, purchaseOrders, setActiveView } = useApp();

  const highRiskVendors = vendors.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical');
  const delayedOrders = purchaseOrders.filter(po => po.deliveryStatus === 'Delayed');
  const inTransitOrders = purchaseOrders.filter(po => po.deliveryStatus === 'In Transit');

  // Network delivery rate
  const totalDeliveries = vendors.reduce((acc, v) => acc + v.metrics.totalDeliveries, 0);
  const onTimeDeliveries = vendors.reduce((acc, v) => acc + v.metrics.onTimeDeliveries, 0);
  const overallOnTimeRate = Math.round((onTimeDeliveries / Math.max(1, totalDeliveries)) * 100);

  // Highest late delivery probability orders
  const atRiskPOs = [...purchaseOrders].sort((a, b) => b.predictedLateRisk - a.predictedLateRisk);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Supply Chain Resilience & Risk Intelligence</h1>
            <Badge variant="info" size="sm">Supply Chain Manager</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time delivery continuity, predictive transit delays, bottleneck identification, and supplier operational health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('reliability')}
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Compass className="h-3.5 w-3.5" />
            Predictive Risk Radar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Network On-Time Delivery"
          value={`${overallOnTimeRate}%`}
          subtitle={`${onTimeDeliveries} of ${totalDeliveries} on schedule`}
          icon={Truck}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10 border-cyan-500/20"
          badge={overallOnTimeRate >= 90 ? 'Healthy' : 'Sub-Optimal'}
          badgeVariant={overallOnTimeRate >= 90 ? 'success' : 'warning'}
        />
        <StatCard
          title="Active Delayed Shipments"
          value={delayedOrders.length}
          subtitle="Direct factory / transit halts"
          icon={AlertTriangle}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10 border-rose-500/20"
          badge={delayedOrders.length > 0 ? 'Action Required' : 'Clean'}
          badgeVariant={delayedOrders.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          title="In-Transit Cargo"
          value={inTransitOrders.length}
          subtitle="Orders actively moving"
          icon={Compass}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/20"
          badge="Live Movement"
          badgeVariant="info"
        />
        <StatCard
          title="Suppliers at Risk"
          value={highRiskVendors.length}
          subtitle={`${vendors.length} total active tier suppliers`}
          icon={ShieldAlert}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
          badge={`${highRiskVendors.length} Monitored`}
          badgeVariant="warning"
        />
      </div>

      {/* Predictive Delivery Delay Risk Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Purchase Orders: Machine Learning Delay Probability</h3>
              <p className="text-xs text-slate-400">Trained on lead time, order value, carrier telemetry & past delay history</p>
            </div>
            <button
              onClick={() => setActiveView('reliability')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Risk Engine →
            </button>
          </div>

          <div className="divide-y divide-slate-800/80">
            {atRiskPOs.slice(0, 4).map((po) => {
              const vendor = vendors.find(v => v.id === po.vendorId);
              const isCrit = po.predictedLateRisk >= 60;
              const isMod = po.predictedLateRisk >= 20;

              return (
                <div key={po.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-400 text-xs">{po.id}</span>
                      <span className="text-xs font-semibold text-white">{po.vendorName}</span>
                      <Badge variant={po.deliveryStatus === 'Delayed' ? 'danger' : 'info'} size="sm">
                        {po.deliveryStatus}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Amount: <strong className="text-slate-300 font-mono">₹{po.totalAmount.toLocaleString('en-IN')}</strong> • Carrier: {po.shippingCarrier || 'Unassigned'} • ETA: {po.expectedDeliveryDate}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:text-right">
                    <div className="min-w-[120px]">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Delay Risk:</span>
                        <span className={`font-mono font-bold ${isCrit ? 'text-rose-400' : isMod ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {po.predictedLateRisk}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isCrit ? 'bg-rose-500' : isMod ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${po.predictedLateRisk}%` }}
                        />
                      </div>
                    </div>

                    <Badge
                      variant={isCrit ? 'danger' : isMod ? 'warning' : 'success'}
                      size="sm"
                    >
                      {isCrit ? 'High Risk' : isMod ? 'Moderate' : 'Low Risk'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Continuity & Problem Areas */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Critical Operational Vulnerability</h3>
            <p className="text-xs text-slate-400">Bottlenecks impacting manufacturing lines</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-3 space-y-1">
              <div className="flex items-center justify-between text-rose-300 font-bold">
                <span>TransOcean Global Freight</span>
                <span>68% Reliability</span>
              </div>
              <p className="text-[11px] text-slate-300">
                28 historical delayed shipments. West Coast rail hub congestion currently impacting PO-2026-1039.
              </p>
              <div className="pt-1 flex gap-2">
                <span className="text-[10px] text-rose-400 font-semibold uppercase">Action:</span>
                <span className="text-[10px] text-slate-400">Reroute cargo via alternative air carrier.</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-3 space-y-1">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span>Integra Facility Maintenance</span>
                <span>78% Reliability</span>
              </div>
              <p className="text-[11px] text-slate-300">
                OSHA 1910 certification expired. Requires safety audit renewal before scheduling next maintenance window.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveView('vendors')}
            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-cyan-400 transition-colors flex items-center justify-center gap-1.5"
          >
            Review All Suppliers & Mitigations <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
