import React from 'react';
import { 
  ShieldCheck, 
  ShoppingCart, 
  Truck, 
  Building2, 
  DollarSign, 
  FileCheck2, 
  LogOut, 
  Lock, 
  UserCheck,
  Printer
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminDashboardView } from './AdminDashboardView';
import { ProcurementDashboardView } from './ProcurementDashboardView';
import { SupplyChainDashboardView } from './SupplyChainDashboardView';
import { VendorDashboardView } from './VendorDashboardView';
import { FinanceDashboardView } from './FinanceDashboardView';
import { AuditorDashboardView } from './AuditorDashboardView';
import { UserAvatar } from '../../common/UserAvatar';
import { triggerPrintReport } from '../../../utils/exportUtils';

export const RoleDashboard: React.FC = () => {
  const { currentRole, currentUser, logout, vendors, purchaseOrders, invoices, currentVendorId, switchAccountToRole } = useApp();

  const handlePrintDashboard = () => {
    let exportRows: Record<string, any>[] = [];
    let headers: Record<string, string> = {};

    if (currentRole === 'Procurement Manager' || currentRole === 'Administrator') {
      headers = {
        id: 'PO Number',
        vendorName: 'Vendor Name',
        totalAmount: 'Total Amount (₹)',
        status: 'Status',
        deliveryStatus: 'Delivery Status',
        expectedDeliveryDate: 'Expected Date'
      };
      exportRows = purchaseOrders.map(po => ({
        id: po.id,
        vendorName: po.vendorName,
        totalAmount: `₹${po.totalAmount.toLocaleString('en-IN')}`,
        status: po.status,
        deliveryStatus: po.deliveryStatus,
        expectedDeliveryDate: po.expectedDeliveryDate,
      }));
    } else if (currentRole === 'Finance Officer') {
      headers = {
        id: 'Invoice #',
        purchaseOrderId: 'Linked PO',
        vendorName: 'Vendor',
        amount: 'Amount (₹)',
        dueDate: 'Due Date',
        status: 'Status'
      };
      exportRows = invoices.map(inv => ({
        id: inv.id,
        purchaseOrderId: inv.purchaseOrderId,
        vendorName: inv.vendorName,
        amount: `₹${inv.amount.toLocaleString('en-IN')}`,
        dueDate: inv.dueDate,
        status: inv.status
      }));
    } else if (currentRole === 'Vendor') {
      const myPOs = purchaseOrders.filter(p => p.vendorId === currentVendorId);
      headers = {
        id: 'PO Number',
        totalAmount: 'Value (₹)',
        status: 'Status',
        deliveryStatus: 'Delivery',
        expectedDeliveryDate: 'Due Date'
      };
      exportRows = myPOs.map(po => ({
        id: po.id,
        totalAmount: `₹${po.totalAmount.toLocaleString('en-IN')}`,
        status: po.status,
        deliveryStatus: po.deliveryStatus,
        expectedDeliveryDate: po.expectedDeliveryDate,
      }));
    } else {
      headers = {
        id: 'Vendor ID',
        name: 'Supplier Name',
        category: 'Category',
        reliabilityScore: 'Reliability (0-100)',
        totalSpend: 'Total Spend (₹)',
        status: 'Status'
      };
      exportRows = vendors.map(v => ({
        id: v.id,
        name: v.name,
        category: v.category,
        reliabilityScore: `${v.reliabilityScore}/100`,
        totalSpend: `₹${v.totalSpend.toLocaleString('en-IN')}`,
        status: v.status
      }));
    }

    triggerPrintReport(`${currentRole.replace(/\s+/g, '_')}_Dashboard_Summary`, exportRows, headers);
  };

  const roleMeta = {
    'Administrator': {
      title: 'Platform Administrator Dashboard',
      desc: 'Platform governance, system access policies, predictive risk models, and full organizational telemetry.',
      icon: ShieldCheck,
      color: 'text-purple-400',
      bgGradient: 'from-purple-950/40 via-slate-900 to-slate-950',
      borderColor: 'border-purple-500/30',
      badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    },
    'Procurement Manager': {
      title: 'Procurement Management Dashboard',
      desc: 'Purchase order lifecycles, vendor evaluations, requisition approvals, and tier-based supplier allocations.',
      icon: ShoppingCart,
      color: 'text-blue-400',
      bgGradient: 'from-blue-950/40 via-slate-900 to-slate-950',
      borderColor: 'border-blue-500/30',
      badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    },
    'Supply Chain Manager': {
      title: 'Supply Chain Operations & Risk Radar',
      desc: 'Logistics transit telemetry, predictive delay forecasting, port bottleneck mitigation, and shipment continuity.',
      icon: Truck,
      color: 'text-cyan-400',
      bgGradient: 'from-cyan-950/40 via-slate-900 to-slate-950',
      borderColor: 'border-cyan-500/30',
      badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    },
    'Vendor': {
      title: 'Authorized Supplier Operations Portal',
      desc: 'Restricted to your company only. Isolated purchase orders, dispatch tracking, reliability scores, and compliance repositories.',
      icon: Building2,
      color: 'text-emerald-400',
      bgGradient: 'from-emerald-950/40 via-slate-900 to-slate-950',
      borderColor: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    },
    'Finance Officer': {
      title: 'Accounts Payable & Financial Dashboard',
      desc: 'Invoice settlement register, payment disbursement, 3-way match reconciliation, and vendor spend variance.',
      icon: DollarSign,
      color: 'text-amber-400',
      bgGradient: 'from-amber-950/40 via-slate-900 to-slate-950',
      borderColor: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    },
    'Auditor': {
      title: 'Regulatory & Compliance Audit Dashboard',
      desc: 'ISO standards compliance, certificate validity verification, contract expiration monitoring, and non-repudiation audit trails.',
      icon: FileCheck2,
      color: 'text-rose-400',
      bgGradient: 'from-rose-950/40 via-slate-900 to-slate-950',
      borderColor: 'border-rose-500/30',
      badgeBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    },
  }[currentRole] || {
    title: 'Operational Dashboard',
    desc: 'Role-specific workspace.',
    icon: ShieldCheck,
    color: 'text-sky-400',
    bgGradient: 'from-sky-950/40 via-slate-900 to-slate-950',
    borderColor: 'border-sky-500/30',
    badgeBg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  };

  const IconComponent = roleMeta.icon;

  const renderDashboardView = () => {
    switch (currentRole) {
      case 'Administrator':
        return <AdminDashboardView />;
      case 'Procurement Manager':
        return <ProcurementDashboardView />;
      case 'Supply Chain Manager':
        return <SupplyChainDashboardView />;
      case 'Vendor':
        return <VendorDashboardView />;
      case 'Finance Officer':
        return <FinanceDashboardView />;
      case 'Auditor':
        return <AuditorDashboardView />;
      default:
        return <AdminDashboardView />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Identity & Session Verification Banner */}
      <div className={`rounded-2xl border ${roleMeta.borderColor} bg-gradient-to-r ${roleMeta.bgGradient} p-4 sm:p-5 shadow-lg relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <UserAvatar name={currentUser.name} role={currentUser.role} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base sm:text-lg font-black text-white tracking-tight">
                  Hey, {currentUser.role}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${roleMeta.badgeBg}`}>
                  <IconComponent className="h-3.5 w-3.5" />
                  {currentUser.role}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                  <Lock className="h-3 w-3" />
                  Role Locked
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {roleMeta.desc}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1.5 font-mono">
                <span>Account: @{currentUser.username || currentUser.email.split('@')[0]}</span>
                <span>•</span>
                <span>Org: {currentUser.companyName || currentUser.department || 'Enterprise HQ'}</span>
                {currentUser.role === 'Vendor' && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400">Scoped Supplier ID: {currentVendorId}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
            <button
              onClick={handlePrintDashboard}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-sm"
              title="Print or Save Executive PDF Summary of Current Dashboard"
            >
              <Printer className="h-3.5 w-3.5 text-sky-400" />
              <span>Print / PDF</span>
            </button>
            <div className="text-right hidden xl:block mr-1">
              <p className="text-[10px] uppercase font-bold text-slate-400">Active Session</p>
              <p className="text-xs font-bold text-slate-200">Role switching locked</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 px-3.5 py-2 text-xs font-bold text-rose-300 hover:text-rose-200 transition-all shadow-md cursor-pointer"
              title="Sign out of current account in order to log in as another person"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out to Switch Role</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Role Switcher Tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pl-2 shrink-0">
          Switch Dashboard Role:
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {[
            { role: 'Procurement Manager' as const, label: 'Procurement Dashboard', icon: ShoppingCart, color: 'text-sky-400' },
            { role: 'Vendor' as const, label: 'Vendor Dashboard', icon: Building2, color: 'text-emerald-400' },
            { role: 'Administrator' as const, label: 'Admin Dashboard', icon: ShieldCheck, color: 'text-purple-400' },
            { role: 'Supply Chain Manager' as const, label: 'Supply Chain', icon: Truck, color: 'text-cyan-400' },
            { role: 'Finance Officer' as const, label: 'Finance', icon: DollarSign, color: 'text-amber-400' },
            { role: 'Auditor' as const, label: 'Auditor', icon: FileCheck2, color: 'text-rose-400' },
          ].map((item) => {
            const isActive = currentRole === item.role;
            const Icon = item.icon;
            return (
              <button
                key={item.role}
                onClick={() => switchAccountToRole(item.role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? item.color : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-Specific Dashboard Content */}
      {renderDashboardView()}
    </div>
  );
};
