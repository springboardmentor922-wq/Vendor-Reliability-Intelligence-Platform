import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Award, 
  FileText, 
  ShoppingCart, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Send, 
  Truck, 
  UploadCloud, 
  DollarSign, 
  AlertTriangle, 
  ShieldCheck, 
  X,
  CreditCard,
  Lock,
  Boxes,
  Cpu,
  Wrench,
  HelpCircle,
  Briefcase,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Info,
  TrendingUp,
  BarChart3,
  Activity,
  Layers
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { StatCard } from '../../common/StatCard';
import { Badge } from '../../common/Badge';
import { formatRupees } from '../../../utils/currencyUtils';
import { Vendor, VendorDocument, VendorCategory, PurchaseOrder } from '../../../types';
import { VendorProfileModal } from './VendorProfileModal';
import { VendorPOAcceptModal } from './VendorPOAcceptModal';
import {
  VendorPerformanceComparisonBarChart,
  ReliabilityScoreTrendAreaChart,
  ContractStatusDonutChart,
  OrderHistoryComboChart,
  CommunicationActivityDonutChart,
  VendorComparisonItem,
  ReliabilityTrendItem,
  ContractStatusItem,
  OrderHistoryItem,
  CommunicationChannelItem,
} from '../../common/DashboardCharts';

export const VENDOR_CATEGORIES: {
  category: VendorCategory;
  label: string;
  icon: React.ElementType;
  description: string;
  defaultVendorId: string;
}[] = [
  {
    category: 'Raw Material Suppliers',
    label: 'Raw Material Suppliers',
    icon: Boxes,
    description: 'Polymers, specialty chemicals, industrial metals & raw resins',
    defaultVendorId: 'VND-001',
  },
  {
    category: 'Equipment Vendors',
    label: 'Equipment Vendors',
    icon: Wrench,
    description: 'Heavy machinery, pneumatic actuators, production robotics & tooling',
    defaultVendorId: 'VND-002',
  },
  {
    category: 'IT Vendors',
    label: 'IT Vendors',
    icon: Cpu,
    description: 'Data center servers, cloud infrastructure, networking & security systems',
    defaultVendorId: 'VND-003',
  },
  {
    category: 'Service Providers',
    label: 'Service Providers',
    icon: Briefcase,
    description: 'Technical advisory, environmental compliance, auditing & architectural engineering',
    defaultVendorId: 'VND-006',
  },
  {
    category: 'Logistics Partners',
    label: 'Logistics Partners',
    icon: Truck,
    description: 'Intermodal drayage, ocean freight forwarding, rail & cold-chain distribution',
    defaultVendorId: 'VND-004',
  },
  {
    category: 'Maintenance Vendors',
    label: 'Maintenance Vendors',
    icon: Building2,
    description: 'HVAC electrical substation overhaul, plant machinery & emergency facility repairs',
    defaultVendorId: 'VND-005',
  },
];

export const VendorDashboardView: React.FC = () => {
  const { 
    vendors, 
    currentRole,
    currentUser,
    currentVendorId, 
    setCurrentVendorId, 
    purchaseOrders, 
    invoices,
    contracts, 
    certifications, 
    vendorDocuments,
    uploadVendorDocument,
    updatePODispatch,
    messages,
    sendMessage,
    setActiveView,
  } = useApp();

  // Determine authorized category for logged in vendor
  const isVendorRole = currentRole === 'Vendor';
  const authenticatedVendor = isVendorRole 
    ? (vendors.find(v => v.id === currentUser.vendorId) || vendors[0])
    : null;

  // Selected Partition State
  const [selectedCategory, setSelectedCategory] = useState<VendorCategory>(() => {
    if (isVendorRole && authenticatedVendor) {
      return authenticatedVendor.category;
    }
    const currentV = vendors.find(v => v.id === currentVendorId);
    return currentV ? currentV.category : 'Raw Material Suppliers';
  });

  // Keep category in sync if authenticated vendor changes
  useEffect(() => {
    if (isVendorRole && authenticatedVendor) {
      setSelectedCategory(authenticatedVendor.category);
    }
  }, [isVendorRole, authenticatedVendor]);

  // Security isolation alert
  const [isolationWarning, setIsolationWarning] = useState<string | null>(null);

  // Filter vendors belonging to selected category
  const categoryVendors = vendors.filter(v => v.category === selectedCategory);
  
  // Selected vendor within current partition
  const activeVendor = isVendorRole 
    ? (authenticatedVendor || vendors[0])
    : (categoryVendors.find(v => v.id === currentVendorId) || categoryVendors[0] || vendors[0]);

  // Handle category partition tab click
  const handleSelectPartition = (targetCat: VendorCategory) => {
    if (isVendorRole) {
      if (authenticatedVendor && authenticatedVendor.category !== targetCat) {
        setIsolationWarning(`Access Denied: You are authenticated under "${authenticatedVendor.category}". Enterprise multi-tenant isolation restricts access to competitive supplier workspaces.`);
        setTimeout(() => setIsolationWarning(null), 6000);
        return;
      }
    }
    setSelectedCategory(targetCat);
    const matchingVendor = vendors.find(v => v.category === targetCat);
    if (matchingVendor) {
      setCurrentVendorId(matchingVendor.id);
    }
  };

  // Strictly Scoped Data for active vendor
  const myPOs = purchaseOrders.filter(po => po.vendorId === activeVendor.id);
  const myPendingAcceptancePOs = myPOs.filter(po => po.status === 'Pending Vendor Acceptance');
  const myCompletedPOs = myPOs.filter(po => po.status === 'Completed' || po.status === 'Delivered');
  const myActivePOs = myPOs.filter(po => po.status === 'Ordered' || po.status === 'Approved' || po.status === 'Pending' || po.status === 'Pending Vendor Acceptance');
  const myDelayedPOs = myPOs.filter(po => po.deliveryStatus === 'Delayed' || po.status === 'Delayed');
  const myTotalOrderValue = myPOs.reduce((sum, po) => sum + po.totalAmount, 0);

  const myInvoices = invoices.filter(inv => inv.vendorId === activeVendor.id);
  const myPaidInvoices = myInvoices.filter(inv => inv.status === 'Paid');
  const myPendingInvoices = myInvoices.filter(inv => inv.status === 'Pending');
  const totalPaidAmount = myPaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPendingAmount = myPendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const myContracts = contracts.filter(c => c.vendorId === activeVendor.id || c.category === selectedCategory);
  const myCerts = certifications.filter(c => c.vendorId === activeVendor.id);
  const myDocs = vendorDocuments.filter(d => d.vendorId === activeVendor.id);
  const myMessages = messages.filter(m => m.threadId === activeVendor.id || m.senderId === currentUser.id);

  // 1. Dynamic KPI Computations
  const performanceScore = activeVendor.metrics?.qualityRating && activeVendor.metrics.qualityRating > 0
    ? Math.round((activeVendor.metrics.qualityRating / 5) * 100)
    : 0;
  const reliabilityScore = activeVendor.reliabilityScore ?? 0;
  const activeContractsCount = myContracts.filter(c => c.status === 'Active' || c.status === 'Expiring Soon').length;
  const totalOrdersCount = myPOs.length;

  // 2. Vendor Performance Comparison Data (Grouped multi-bar)
  // Ensures diverse representation across different reliability and risk ranges (90s, 70s, 60s, 40s)
  const comparisonData: VendorComparisonItem[] = useMemo(() => {
    // Select active vendor plus peers from different risk tiers to demonstrate true metric diversity
    const otherVendors = vendors.filter(v => v.id !== activeVendor.id);
    
    // Pick peers with diverse scores
    const diversePeers: Vendor[] = [];
    const highPerformer = otherVendors.find(v => v.reliabilityScore >= 85);
    const midPerformer = otherVendors.find(v => v.reliabilityScore >= 70 && v.reliabilityScore < 85);
    const lowOrRiskPerformer = otherVendors.find(v => v.reliabilityScore > 0 && v.reliabilityScore < 70);

    if (highPerformer) diversePeers.push(highPerformer);
    if (midPerformer) diversePeers.push(midPerformer);
    if (lowOrRiskPerformer) diversePeers.push(lowOrRiskPerformer);

    // If still less than 3 peers, fill from remaining
    otherVendors.forEach(v => {
      if (diversePeers.length < 3 && !diversePeers.some(p => p.id === v.id)) {
        diversePeers.push(v);
      }
    });

    const peers = [activeVendor, ...diversePeers.slice(0, 3)];

    return peers.map(v => ({
      vendorName: v.name.length > 15 ? v.name.substring(0, 13) + '...' : v.name,
      Delivery: v.metrics?.onTimeDeliveryRate ?? (v.reliabilityFactors?.deliveryHistoryScore ?? 0),
      Quality: v.metrics?.qualityRating && v.metrics.qualityRating > 0 ? Math.round((v.metrics.qualityRating / 5) * 100) : 0,
      Communication: v.reliabilityFactors?.communicationEfficiencyScore ?? 0,
      Compliance: v.reliabilityFactors?.contractComplianceScore ?? 0,
    }));
  }, [activeVendor, vendors]);

  // 3. Reliability Score Trend Data (Area chart with gradient)
  const reliabilityTrendData: ReliabilityTrendItem[] = useMemo(() => {
    if (activeVendor.reliabilityScore === 0) {
      return [
        { period: 'May 2026', score: 0 },
        { period: 'Jun 2026', score: 0 },
        { period: 'Jul 2026', score: 0 },
        { period: 'Aug 2026', score: 0 },
        { period: 'Sep 2026', score: 0 },
      ];
    }
    if (activeVendor.performanceHistory && activeVendor.performanceHistory.length > 0) {
      return activeVendor.performanceHistory.map(ph => ({
        period: ph.month,
        score: ph.reliabilityScore,
      }));
    }
    return [
      { period: 'May 2026', score: Math.max(0, activeVendor.reliabilityScore - 6) },
      { period: 'Jun 2026', score: Math.max(0, activeVendor.reliabilityScore - 4) },
      { period: 'Jul 2026', score: Math.max(0, activeVendor.reliabilityScore - 2) },
      { period: 'Aug 2026', score: Math.max(0, activeVendor.reliabilityScore - 1) },
      { period: 'Sep 2026', score: activeVendor.reliabilityScore },
    ];
  }, [activeVendor]);

  // 4. Contract Status Donut Data
  const contractStatusData: ContractStatusItem[] = useMemo(() => {
    const activeCount = myContracts.filter(c => c.status === 'Active').length;
    const expiringSoonCount = myContracts.filter(c => c.status === 'Expiring Soon').length;
    const underRenewalCount = myContracts.filter(c => c.status === 'Renewed' || c.status === 'Suspended').length;
    const expiredCount = myContracts.filter(c => c.status === 'Expired' || c.status === 'Inactive').length;

    return [
      { status: 'Active', count: Math.max(1, activeCount), color: '#10b981' },
      { status: 'Expiring Soon', count: expiringSoonCount > 0 ? expiringSoonCount : 1, color: '#f59e0b' },
      { status: 'Under Renewal', count: underRenewalCount > 0 ? underRenewalCount : 1, color: '#0ea5e9' },
      { status: 'Expired', count: expiredCount > 0 ? expiredCount : 0, color: '#f43f5e' },
    ];
  }, [myContracts]);

  const totalEvaluatedContracts = contractStatusData.reduce((s, c) => s + c.count, 0);

  // 5. Order History Combo Chart Data (Order Value vs Count)
  const orderHistoryData: OrderHistoryItem[] = useMemo(() => {
    const totalVal = myTotalOrderValue > 0 ? myTotalOrderValue : 95000;
    const totalCt = myPOs.length > 0 ? myPOs.length : 3;

    return [
      { period: 'May 2026', orderValue: Math.round(totalVal * 0.35), orderCount: Math.max(1, Math.round(totalCt * 0.3)) },
      { period: 'Jun 2026', orderValue: Math.round(totalVal * 0.55), orderCount: Math.max(1, Math.round(totalCt * 0.5)) },
      { period: 'Jul 2026', orderValue: Math.round(totalVal * 0.75), orderCount: Math.max(2, Math.round(totalCt * 0.75)) },
      { period: 'Aug 2026', orderValue: Math.round(totalVal * 0.9), orderCount: Math.max(2, Math.round(totalCt * 0.9)) },
      { period: 'Sep 2026', orderValue: totalVal, orderCount: totalCt },
    ];
  }, [myTotalOrderValue, myPOs]);

  // 6. Communication Activity Donut Data
  const communicationActivityData: CommunicationChannelItem[] = useMemo(() => {
    const portalMessages = myMessages.length > 0 ? myMessages.length + 3 : 5;
    const emails = 8;
    const calls = 4;
    const meetings = 3;
    const supportTickets = myDelayedPOs.length > 0 ? 3 : 2;

    return [
      { channel: 'Emails', count: emails, color: '#38bdf8' },
      { channel: 'Calls', count: calls, color: '#f59e0b' },
      { channel: 'Meetings', count: meetings, color: '#a855f7' },
      { channel: 'Portal Messages', count: portalMessages, color: '#10b981' },
      { channel: 'Support Tickets', count: supportTickets, color: '#f43f5e' },
    ];
  }, [myMessages, myDelayedPOs]);

  const totalCommActivities = communicationActivityData.reduce((s, c) => s + c.count, 0);

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [poAcceptModalTarget, setPoAcceptModalTarget] = useState<PurchaseOrder | null>(null);

  const [dispatchModalPO, setDispatchModalPO] = useState<PurchaseOrder | null>(null);
  const [dispatchCarrier, setDispatchCarrier] = useState('FedEx Freight Priority');
  const [dispatchTracking, setDispatchTracking] = useState('');

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<VendorDocument['type']>('Insurance Certificate');
  const [newDocFileName, setNewDocFileName] = useState('');

  const [chatMessage, setChatMessage] = useState('');
  const [poFilterStatus, setPoFilterStatus] = useState<'All' | 'Awaiting Acceptance' | 'Active' | 'Delivered' | 'Delayed'>('All');

  const handleUpdateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalPO || !dispatchTracking.trim()) return;
    updatePODispatch(dispatchModalPO.id, dispatchCarrier, dispatchTracking.trim());
    setDispatchModalPO(null);
    setDispatchTracking('');
  };

  const handleUploadDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    uploadVendorDocument({
      vendorId: activeVendor.id,
      vendorName: activeVendor.name,
      title: newDocTitle.trim(),
      type: newDocType,
      fileName: newDocFileName.trim() || `${newDocTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
    });
    setNewDocTitle('');
    setNewDocFileName('');
    setIsDocModalOpen(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendMessage({
      threadId: activeVendor.id,
      senderId: currentUser.id,
      senderName: `Vendor (${activeVendor.name})`,
      senderRole: 'Vendor',
      recipientId: 'USR-002',
      recipientName: 'Procurement Manager',
      recipientRole: 'Procurement Manager',
      content: chatMessage.trim(),
      channel: 'Portal Message',
      priority: 'Normal',
    });
    setChatMessage('');
  };

  const filteredPOs = myPOs.filter(po => {
    if (poFilterStatus === 'Awaiting Acceptance') return po.status === 'Pending Vendor Acceptance';
    if (poFilterStatus === 'Active') return po.status === 'Ordered' || po.status === 'Approved' || po.status === 'Pending' || po.status === 'Pending Vendor Acceptance';
    if (poFilterStatus === 'Delivered') return po.status === 'Delivered' || po.status === 'Completed';
    if (poFilterStatus === 'Delayed') return po.deliveryStatus === 'Delayed' || po.status === 'Delayed';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 6 Partitions Navigation Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Supplier Workspace Partitions</h2>
              {isVendorRole ? (
                <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Category Scoped
                </span>
              ) : (
                <span className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[11px] font-bold text-sky-400 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Executive Audit Clearance
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isVendorRole 
                ? `You are logged in as an authorized supplier under ${selectedCategory}. Access to other categorical partitions is restricted.`
                : 'Select any of the 6 enterprise partitions to inspect supplier workspace, telemetry, orders & contracts.'}
            </p>
          </div>

          {!isVendorRole && categoryVendors.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Supplier in partition:</span>
              <select
                value={activeVendor.id}
                onChange={(e) => setCurrentVendorId(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
              >
                {categoryVendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 6 Category Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {VENDOR_CATEGORIES.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedCategory === item.category;
            const isLocked = isVendorRole && authenticatedVendor && authenticatedVendor.category !== item.category;

            return (
              <button
                key={item.category}
                onClick={() => handleSelectPartition(item.category)}
                className={`relative flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-emerald-500 shadow-md shadow-emerald-950/40'
                    : isLocked
                    ? 'bg-slate-950/50 border-slate-800/80 opacity-60 hover:opacity-80 hover:border-slate-700'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {isLocked && <Lock className="h-3 w-3 text-slate-500" />}
                  {isSelected && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                <span className={`text-xs font-bold leading-snug line-clamp-1 ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>

        {isolationWarning && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{isolationWarning}</span>
            </div>
            <button 
              onClick={() => setIsolationWarning(null)} 
              className="text-rose-400 hover:text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Action Required: Pending POs Awaiting Vendor Acceptance */}
      {myPendingAcceptancePOs.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Action Required: {myPendingAcceptancePOs.length} Purchase Order Requisition(s) Awaiting Review
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Procurement has issued product order(s) for <strong className="text-white font-semibold">{activeVendor.name}</strong> under <strong className="text-white font-semibold">{selectedCategory}</strong>. Please review line items and confirm dispatch SLA.
              </p>
            </div>
          </div>
          <button
            onClick={() => setPoAcceptModalTarget(myPendingAcceptancePOs[0])}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 text-xs transition-colors shrink-0 shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 text-slate-950" />
            Review & Accept Requisition ({myPendingAcceptancePOs[0].id})
          </button>
        </div>
      )}

      {/* Supplier Identity Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">{activeVendor.name}</h1>
            <Badge variant="success" size="sm">Authorized Supplier Portal</Badge>
            <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold">
              {activeVendor.id}
            </span>
            <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold">
              Partition: {selectedCategory}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Category: <strong className="text-slate-300">{activeVendor.category}</strong> • Tax ID: <span className="font-mono text-slate-300">{activeVendor.taxId || 'GSTIN-PENDING'}</span> • Tier: <strong className="text-emerald-400">{activeVendor.tier}</strong>
          </p>
          <p className="text-[11px] text-slate-500">
            Primary Contact: {activeVendor.contact?.primaryContactName || 'Authorized Rep'} ({activeVendor.contact?.email || 'N/A'}) • Bank: <span className="font-mono">{activeVendor.bankAccount}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-300" />
            Edit Supplier Profile
          </button>

          <button
            onClick={() => setIsDocModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Compliance Doc
          </button>
        </div>
      </div>

      {/* 1. Top KPI Cards: Performance Score, Reliability Score, Active Contracts, Total Orders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Performance Score"
          value={`${performanceScore}%`}
          subtitle={performanceScore === 0 ? "Awaiting QA deliveries & initial audits" : "Calculated quality & defect SLA index"}
          icon={Award}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/20"
          change={performanceScore === 0 ? "Initial Baseline" : "4.8% vs last quarter"}
          isPositive={performanceScore > 0}
          badge={performanceScore === 0 ? "Pending Data" : "Audit Verified"}
          badgeVariant={performanceScore === 0 ? "neutral" : "info"}
        />
        <StatCard
          title="Reliability Score"
          value={`${reliabilityScore}/100`}
          subtitle={reliabilityScore === 0 ? "Awaiting performance calibrations" : `Risk Level: ${activeVendor.riskLevel} Risk Tier`}
          icon={ShieldCheck}
          iconColor={reliabilityScore === 0 ? "text-slate-400" : activeVendor.riskLevel === 'Low' ? "text-emerald-400" : activeVendor.riskLevel === 'Medium' ? "text-amber-400" : "text-rose-400"}
          iconBg={reliabilityScore === 0 ? "bg-slate-500/10 border-slate-500/20" : "bg-emerald-500/10 border-emerald-500/20"}
          change={reliabilityScore === 0 ? "0 / 100 Baseline" : "5.2% vs last quarter"}
          isPositive={reliabilityScore > 60}
          badge={reliabilityScore === 0 ? "Unrated (0)" : activeVendor.tier.split(' ')[0]}
          badgeVariant={reliabilityScore === 0 ? "neutral" : activeVendor.riskLevel === 'Low' ? "success" : activeVendor.riskLevel === 'Medium' ? "warning" : "danger"}
        />
        <StatCard
          title="Active Contracts"
          value={activeContractsCount}
          subtitle="Signed master service agreements"
          icon={FileText}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
          badge="100% SLA"
          badgeVariant="purple"
        />
        <StatCard
          title="Total Orders"
          value={totalOrdersCount}
          subtitle={`₹${myTotalOrderValue.toLocaleString('en-IN')} lifetime value`}
          icon={ShoppingCart}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
          change="14.2% MoM"
          isPositive={true}
          badge={`${myActivePOs.length} Active`}
          badgeVariant="warning"
        />
      </div>

      {/* Row 2: Vendor Performance Comparison (Grouped Multi-Bar) & Reliability Trend (Area with Gradient) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Performance Comparison Grouped Bar Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Vendor Performance Comparison</h3>
                <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  Grouped Bar
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Comparing {activeVendor.name} against peer supplier benchmarks across key metrics
              </p>
            </div>
          </div>
          <VendorPerformanceComparisonBarChart data={comparisonData} height={270} />
        </div>

        {/* Reliability Score Trend Chart (Area with dynamic gradient fill) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Reliability Score Progression</h3>
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  Gradient Fill
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Quarterly trajectory based on delivery SLA, quality audits & contract adherence
              </p>
            </div>
            <span className="font-mono text-emerald-400 font-bold text-xs">
              Current: {reliabilityScore}/100
            </span>
          </div>
          <ReliabilityScoreTrendAreaChart data={reliabilityTrendData} height={270} color="#10b981" />
        </div>
      </div>

      {/* Row 3: Contract Status Donut, Order History Combo Chart, Communication Activity Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Status Donut Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Contract Status Overview</h3>
              <p className="text-xs text-slate-400">Enterprise agreement lifecycle distribution</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">{totalEvaluatedContracts} Agreements</span>
          </div>
          <ContractStatusDonutChart
            data={contractStatusData}
            totalContracts={totalEvaluatedContracts}
            height={230}
          />
        </div>

        {/* Order History Dual-Axis Combo Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Order History Timeline</h3>
                <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  Value vs Volume
                </span>
              </div>
              <p className="text-xs text-slate-400">Monthly total order revenue (Bar, ₹) and order count (Line)</p>
            </div>
          </div>
          <OrderHistoryComboChart data={orderHistoryData} height={260} />
        </div>

        {/* Communication Activity Donut Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Communication Activity</h3>
              <p className="text-xs text-slate-400">Touchpoints across emails, calls, and portal</p>
            </div>
            <span className="text-[11px] font-mono text-indigo-400">{totalCommActivities} Logged</span>
          </div>
          <CommunicationActivityDonutChart
            data={communicationActivityData}
            totalActivities={totalCommActivities}
            height={230}
          />
        </div>
      </div>

      {/* Orders & Invoices Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scoped Purchase Orders Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Purchase Orders & Dispatch Queue</h3>
              <p className="text-xs text-slate-400">Order acceptance workflow and carrier tracking management</p>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px]">
              {(['All', 'Awaiting Acceptance', 'Active', 'Delivered'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setPoFilterStatus(filterKey)}
                  className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    poFilterStatus === filterKey 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-800 max-h-84 overflow-y-auto pr-1">
            {filteredPOs.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No purchase orders matching filter for this supplier partition.
              </p>
            ) : (
              filteredPOs.map((po) => {
                const isPendingAcceptance = po.status === 'Pending Vendor Acceptance';

                return (
                  <div key={po.id} className={`py-3.5 space-y-2 text-xs rounded-xl px-2.5 transition-colors ${isPendingAcceptance ? 'bg-amber-500/10 border border-amber-500/30' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sky-400">{po.id}</span>
                          <Badge 
                            variant={
                              po.status === 'Pending Vendor Acceptance' ? 'warning' :
                              po.status === 'Completed' || po.status === 'Delivered' ? 'success' :
                              po.status === 'Ordered' ? 'info' : 
                              po.status === 'Delayed' ? 'danger' : 'purple'
                            } 
                            size="sm"
                          >
                            {po.status}
                          </Badge>
                          <Badge variant={po.deliveryStatus === 'Delayed' ? 'danger' : 'info'} size="sm">
                            {po.deliveryStatus}
                          </Badge>
                        </div>
                        <p className="text-white font-semibold mt-1">
                          {po.items.map(i => `${i.description} (x${i.quantity})`).join(', ') || 'Custom Line Items'}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        {formatRupees(po.totalAmount)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                      <span>Due: <strong className="text-slate-200">{po.expectedDeliveryDate}</strong></span>
                      <span>Carrier: <strong className="text-slate-200">{po.shippingCarrier || 'Unassigned'}</strong></span>
                      {po.trackingNumber && (
                        <span>Tracking: <strong className="text-sky-400 font-mono">{po.trackingNumber}</strong></span>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        {isPendingAcceptance && (
                          <button
                            onClick={() => setPoAcceptModalTarget(po)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Review & Accept Order
                          </button>
                        )}

                        {po.status !== 'Pending Vendor Acceptance' && po.status !== 'Draft' && po.status !== 'Cancelled' && (
                          <button
                            onClick={() => {
                              setDispatchModalPO(po);
                              setDispatchCarrier(po.shippingCarrier || 'FedEx Freight Priority');
                              setDispatchTracking(po.trackingNumber || '');
                            }}
                            className="rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Truck className="h-3 w-3" />
                            Update Dispatch
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Invoices & Accounts Payable Status */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Invoices & Payment Ledger</h3>
              <p className="text-xs text-slate-400">Track invoice settlements and accounts payable</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400">Disbursed: </span>
              <span className="text-xs font-mono font-bold text-emerald-400">{formatRupees(totalPaidAmount)}</span>
            </div>
          </div>

          <div className="divide-y divide-slate-800 max-h-84 overflow-y-auto pr-1">
            {myInvoices.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No invoices issued for this vendor partition.</p>
            ) : (
              myInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{inv.id}</span>
                      <Badge 
                        variant={inv.status === 'Paid' ? 'success' : inv.status === 'Pending' ? 'warning' : 'danger'} 
                        size="sm"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Linked PO: <span className="font-mono text-sky-400 font-semibold">{inv.purchaseOrderId}</span> • Due: {inv.dueDate}
                    </p>
                    {inv.paymentMethod && inv.paymentDate && (
                      <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        ✓ Settled via {inv.paymentMethod} on {inv.paymentDate}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-100 block text-sm">
                      {formatRupees(inv.amount)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {inv.status === 'Paid' ? 'Bank Wire Settled' : 'Scheduled Net-30'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {dispatchModalPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm">Assign Freight Carrier Dispatch</h3>
              </div>
              <button 
                onClick={() => setDispatchModalPO(null)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateDispatch} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Purchase Order</label>
                <input
                  type="text"
                  disabled
                  value={`${dispatchModalPO.id} (${formatRupees(dispatchModalPO.totalAmount)})`}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-slate-400 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Logistics / Freight Carrier</label>
                <select
                  value={dispatchCarrier}
                  onChange={(e) => setDispatchCarrier(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="FedEx Freight Priority">FedEx Freight Priority</option>
                  <option value="DHL Global Forwarding">DHL Global Forwarding</option>
                  <option value="Maersk Intermodal Logistics">Maersk Intermodal Logistics</option>
                  <option value="Blue Dart Express">Blue Dart Express</option>
                  <option value="Delhivery Surface Express">Delhivery Surface Express</option>
                  <option value="Internal Dedicated Fleet">Internal Dedicated Fleet</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Tracking Number / Bill of Lading (BOL)</label>
                <input
                  type="text"
                  placeholder="e.g. FDX-992019482-IN"
                  value={dispatchTracking}
                  onChange={(e) => setDispatchTracking(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDispatchModalPO(null)}
                  className="rounded-lg px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-1.5 text-white font-bold cursor-pointer"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compliance Upload Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Upload Regulatory Document</h3>
              </div>
              <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. ISO 27001 Audit Certificate 2026"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Document Classification</label>
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value as any)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Insurance Certificate">Insurance Certificate</option>
                  <option value="W-9 / Tax ID">W-9 / GST Registration / Tax ID</option>
                  <option value="Non-Disclosure Agreement">Non-Disclosure Agreement</option>
                  <option value="ESG Report">ESG / Sustainability Audit Report</option>
                  <option value="Other">Other Statutory Document</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">File Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apex_ISO27001_Signed.pdf"
                  value={newDocFileName}
                  onChange={(e) => setNewDocFileName(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-white font-bold cursor-pointer"
                >
                  Upload & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor Profile Modal */}
      <VendorProfileModal
        vendor={activeVendor}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Vendor PO Acceptance Modal */}
      <VendorPOAcceptModal
        po={poAcceptModalTarget}
        isOpen={!!poAcceptModalTarget}
        onClose={() => setPoAcceptModalTarget(null)}
      />
    </div>
  );
};
