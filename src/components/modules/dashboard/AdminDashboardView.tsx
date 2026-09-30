import React, { useMemo } from 'react';
import { 
  Users, 
  Building2, 
  ShoppingCart, 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  Database, 
  FileCheck, 
  ArrowUpRight,
  Activity,
  Server,
  Zap,
  HardDrive
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { StatCard } from '../../common/StatCard';
import { Badge } from '../../common/Badge';
import { formatRupees } from '../../../utils/currencyUtils';
import {
  UserManagementRoleDonutChart,
  VendorRiskBarChart,
  ProcurementReportsComboChart,
  ComplianceMonitoringDonutChart,
  SystemStatisticsCard,
  RoleCountItem,
  RiskDistributionItem,
  ProcurementReportItem,
  ComplianceStatusItem,
} from '../../common/DashboardCharts';

export const AdminDashboardView: React.FC = () => {
  const { 
    users, 
    vendors, 
    updateVendorStatus,
    purchaseOrders, 
    procurementRequests, 
    contracts, 
    certifications, 
    auditLogs, 
    setActiveView 
  } = useApp();

  // Top Metrics
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'Active').length;
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.status === 'Active').length;
  const highRiskVendors = vendors.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical');
  const pendingVendors = vendors.filter(v => v.status === 'Pending' || v.status === 'Pending Approval' || v.status === 'Under Review');

  const totalContractsCount = contracts.length;
  const totalContractsValue = contracts.reduce((sum, c) => sum + (c.contractValue || 0), 0);
  const totalPOValue = purchaseOrders.reduce((acc, po) => acc + po.totalAmount, 0);

  const validCerts = certifications.filter(c => c.status === 'Valid').length;
  const expiringCerts = certifications.filter(c => c.status === 'Expiring Soon').length;
  const expiredCerts = certifications.filter(c => c.status === 'Expired').length;
  const overallComplianceRate = Math.round((validCerts / Math.max(1, certifications.length)) * 100);

  // 1. User Management Role Donut Data
  const roleChartData: RoleCountItem[] = useMemo(() => {
    const adminCount = users.filter(u => u.role === 'Administrator').length;
    const procurementCount = users.filter(u => u.role === 'Procurement Manager').length;
    const vendorManagerCount = users.filter(u => u.role === 'Supply Chain Manager').length;
    const financeCount = users.filter(u => u.role === 'Finance Officer').length;
    const vendorCount = users.filter(u => u.role === 'Vendor').length;
    const analystCount = users.filter(u => u.role === 'Auditor').length;

    return [
      { role: 'Admin', count: adminCount, color: '#a855f7' },
      { role: 'Procurement Manager', count: procurementCount, color: '#38bdf8' },
      { role: 'Vendor Manager', count: vendorManagerCount, color: '#06b6d4' },
      { role: 'Finance User', count: financeCount, color: '#f59e0b' },
      { role: 'Vendor', count: vendorCount, color: '#10b981' },
      { role: 'Analyst', count: analystCount, color: '#f43f5e' },
    ];
  }, [users]);

  // 2. Vendor Analytics - Risk Distribution Bar Chart Data
  const riskChartData: RiskDistributionItem[] = useMemo(() => {
    const lowCount = vendors.filter(v => v.riskLevel === 'Low').length;
    const mediumCount = vendors.filter(v => v.riskLevel === 'Medium').length;
    const highCount = vendors.filter(v => v.riskLevel === 'High').length;
    const criticalCount = vendors.filter(v => v.riskLevel === 'Critical').length;

    return [
      { riskLevel: 'Low Risk', count: lowCount, color: '#10b981' },
      { riskLevel: 'Medium Risk', count: mediumCount, color: '#f59e0b' },
      { riskLevel: 'High Risk', count: highCount, color: '#f97316' },
      { riskLevel: 'Critical Risk', count: criticalCount, color: '#ef4444' },
    ];
  }, [vendors]);

  // 3. Procurement Reports Combo Chart Data (Spend vs Volume)
  const procurementReportsData: ProcurementReportItem[] = useMemo(() => {
    const currentSpend = totalPOValue > 0 ? totalPOValue : 380000;
    const currentVol = purchaseOrders.length > 0 ? purchaseOrders.length : 6;

    return [
      { period: 'May 2026', spend: Math.round(currentSpend * 0.45), orderVolume: Math.max(2, Math.round(currentVol * 0.4)) },
      { period: 'Jun 2026', spend: Math.round(currentSpend * 0.62), orderVolume: Math.max(3, Math.round(currentVol * 0.6)) },
      { period: 'Jul 2026', spend: Math.round(currentSpend * 0.78), orderVolume: Math.max(4, Math.round(currentVol * 0.75)) },
      { period: 'Aug 2026', spend: Math.round(currentSpend * 0.88), orderVolume: Math.max(5, Math.round(currentVol * 0.85)) },
      { period: 'Sep 2026', spend: currentSpend, orderVolume: currentVol },
    ];
  }, [totalPOValue, purchaseOrders]);

  // 4. Compliance Monitoring Donut Chart Data
  const complianceChartData: ComplianceStatusItem[] = useMemo(() => {
    const compliantCount = validCerts + contracts.filter(c => c.status === 'Active').length;
    const minorIssuesCount = expiringCerts + contracts.filter(c => c.status === 'Expiring Soon').length;
    const majorIssuesCount = highRiskVendors.length + purchaseOrders.filter(p => p.deliveryStatus === 'Delayed').length;
    const nonCompliantCount = expiredCerts + contracts.filter(c => c.status === 'Expired').length;

    return [
      { status: 'Compliant', count: Math.max(6, compliantCount), color: '#10b981' },
      { status: 'Minor Issues', count: Math.max(2, minorIssuesCount), color: '#f59e0b' },
      { status: 'Major Issues', count: Math.max(1, majorIssuesCount), color: '#f97316' },
      { status: 'Non-Compliant', count: Math.max(1, nonCompliantCount), color: '#ef4444' },
    ];
  }, [validCerts, expiringCerts, expiredCerts, contracts, highRiskVendors, purchaseOrders]);

  const totalAuditedItems = complianceChartData.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Platform Administration & Governance</h1>
            <Badge variant="purple" size="sm">Admin Console</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            System overview of platform roles, registered enterprise suppliers, transactions, and live audit telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('admin-users')}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white border border-slate-700 transition-colors cursor-pointer"
          >
            Manage Users
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
          >
            System Reports
          </button>
        </div>
      </div>

      {/* 1. Top KPI Cards: Total Users, Total Vendors, Total Contracts, System Uptime */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          subtitle={`${activeUsers} active of ${totalUsers} accounts`}
          icon={Users}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
          change="100% Active Directory"
          isPositive={true}
          badge="RBAC Governed"
          badgeVariant="purple"
          onClick={() => setActiveView('admin-users')}
        />
        <StatCard
          title="Total Vendors"
          value={totalVendors}
          subtitle={`${activeVendors} Active | ${highRiskVendors.length} High Risk`}
          icon={Building2}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/20"
          change="12.5% MoM"
          isPositive={true}
          badge={highRiskVendors.length > 0 ? `${highRiskVendors.length} Risk Flagged` : 'Healthy'}
          badgeVariant={highRiskVendors.length > 0 ? 'danger' : 'success'}
          onClick={() => setActiveView('vendors')}
        />
        <StatCard
          title="Total Contracts"
          value={totalContractsCount}
          subtitle={`₹${(totalContractsValue / 1000000).toFixed(2)}M commitment`}
          icon={FileCheck}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
          change="14.0% MoM"
          isPositive={true}
          badge="Active MSAs"
          badgeVariant="success"
          onClick={() => setActiveView('contracts')}
        />
        <StatCard
          title="System Uptime"
          value="99.98%"
          subtitle="Zero downtime incidents • 45d streak"
          icon={Zap}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
          change="SLA Nominal"
          isPositive={true}
          badge="High Availability"
          badgeVariant="warning"
        />
      </div>

      {/* Row 2: User Management (Donut) & Vendor Risk Distribution (Bar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Management Donut Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">User Management Breakdown</h3>
                <span className="rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  RBAC Roles
                </span>
              </div>
              <p className="text-xs text-slate-400">Distribution of provisioned accounts across 6 system roles</p>
            </div>
            <button
              onClick={() => setActiveView('admin-users')}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
            >
              Users Directory →
            </button>
          </div>
          <UserManagementRoleDonutChart data={roleChartData} totalUsers={totalUsers} height={250} />
        </div>

        {/* Vendor Analytics - Risk Distribution Bar Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Vendor Analytics - Risk Distribution</h3>
                <span className="rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  Risk Tiers
                </span>
              </div>
              <p className="text-xs text-slate-400">Supplier count grouped across Low, Medium, High & Critical risk tiers</p>
            </div>
            <button
              onClick={() => setActiveView('reliability')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
            >
              AI Risk Engine →
            </button>
          </div>
          <VendorRiskBarChart data={riskChartData} height={250} />
        </div>
      </div>

      {/* Row 3: Procurement Reports (Combo Chart) & Compliance Monitoring (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Procurement Reports Combo Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Procurement Reports - Spend & Volume Trends</h3>
                <span className="rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  Dual-Axis
                </span>
              </div>
              <p className="text-xs text-slate-400">Monthly historical procurement costs (Bar, ₹) and order volume (Line)</p>
            </div>
            <span className="font-mono text-purple-400 text-xs font-bold">
              Total: {formatRupees(totalPOValue)}
            </span>
          </div>
          <ProcurementReportsComboChart data={procurementReportsData} height={270} />
        </div>

        {/* Compliance Monitoring Donut Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Compliance Monitoring</h3>
              <p className="text-xs text-slate-400">Status counts across certifications & audits</p>
            </div>
            <Badge variant={overallComplianceRate >= 80 ? 'success' : 'warning'} size="sm">
              {overallComplianceRate}% Rate
            </Badge>
          </div>
          <ComplianceMonitoringDonutChart
            data={complianceChartData}
            totalAudited={totalAuditedItems}
            overallComplianceRate={overallComplianceRate}
            height={230}
          />
        </div>
      </div>

      {/* Row 4: System Statistics Section (Progress bars & Live telemetry) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">System Infrastructure Telemetry & Statistics</h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Real-Time Health: Optimal
          </span>
        </div>
        <SystemStatisticsCard
          dbUsagePct={42}
          apiLatencyMs={84}
          activeSessions={Math.max(16, activeUsers * 4)}
          storageUsagePct={68}
        />
      </div>

      {/* Pending Vendor Registrations Approval Queue */}
      {pendingVendors.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-200">
                Pending Vendor Registrations Approval Queue ({pendingVendors.length} Awaiting Authorization)
              </h3>
            </div>
            <button
              onClick={() => setActiveView('vendors')}
              className="text-xs font-bold text-amber-300 hover:text-white underline cursor-pointer"
            >
              Open Vendor Directory →
            </button>
          </div>
          <p className="text-xs text-slate-300">
            Suppliers submitted through the vendor registration portal. Approving adds them as Active vendors, establishes baseline scoring, and unlocks purchase order issuance.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {pendingVendors.map((pv) => (
              <div key={pv.id} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3 shadow-md">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs truncate">{pv.name}</span>
                    <Badge variant="warning" size="sm">{pv.status}</Badge>
                  </div>
                  {pv.tagline && <p className="text-[11px] text-sky-400 italic truncate mt-0.5">"{pv.tagline}"</p>}
                  <p className="text-[11px] text-slate-400 mt-1">{pv.category}</p>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    {pv.contact.primaryContactName} ({pv.contact.email})
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => updateVendorStatus(pv.id, 'Active', 'Approved by Administrator')}
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>Approve Vendor</span>
                  </button>
                  <button
                    onClick={() => setActiveView('vendors')}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Grid: High Risk Vendors & Live Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Risk Vendors Monitoring */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white">Suppliers Requiring Attention</h3>
            </div>
            <Badge variant="danger" size="sm">{highRiskVendors.length} High Risk</Badge>
          </div>

          <div className="divide-y divide-slate-800">
            {highRiskVendors.map((vendor) => (
              <div key={vendor.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{vendor.name}</p>
                  <p className="text-[11px] text-slate-400">{vendor.category} • {vendor.contact.city}, {vendor.contact.country}</p>
                  <p className="text-[11px] text-rose-400/90 mt-0.5">
                    {vendor.metrics.delayedDeliveries} delayed deliveries ({vendor.metrics.onTimeDeliveryRate}% on-time)
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <Badge variant="danger" size="sm">Score: {vendor.reliabilityScore}</Badge>
                  <span className="text-[10px] text-slate-500 font-mono">Tier 3</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Immutable Audit Logs */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Recent System Audit Trail</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{auditLogs.length} events logged</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto pr-1">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{log.action}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{log.timestamp.split(' ')[1]}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">{log.details}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>User: <strong className="text-slate-300">{log.userName}</strong></span>
                  <span>•</span>
                  <span className="font-mono">{log.entityType} ({log.entityId})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
