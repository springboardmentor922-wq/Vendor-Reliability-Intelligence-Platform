import React, { useState } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileCheck2,
  ShoppingCart,
  Users,
  Building2,
  ArrowRight,
  UserCheck,
  Zap,
  Activity,
  Layers,
  Database,
  Cpu,
  Clock,
  DollarSign,
  Lock,
  Globe2,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { TiltCard } from '../effects/TiltCard';
import { Badge } from '../common/Badge';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register', defaultRole?: UserRole) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { switchAccountToRole, setActiveView, vendors, purchaseOrders } = useApp();
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>('Procurement Manager');

  // Hero interactive simulation states
  const [simOrderValue, setSimOrderValue] = useState(48500);
  const [simLeadDays, setSimLeadDays] = useState(7);
  const [simCarrier, setSimCarrier] = useState<'Expedited Air' | 'Standard Freight' | 'Ocean Cargo'>('Standard Freight');

  // Fast mathematical risk formula for hero visualizer
  const calculateHeroRisk = () => {
    let baseRisk = 12;
    if (simLeadDays < 5) baseRisk += 45;
    else if (simLeadDays < 10) baseRisk += 25;
    else baseRisk += 8;

    if (simOrderValue > 75000) baseRisk += 20;
    else if (simOrderValue > 30000) baseRisk += 10;

    if (simCarrier === 'Ocean Cargo') baseRisk += 18;
    if (simCarrier === 'Expedited Air') baseRisk -= 12;

    return Math.min(94, Math.max(8, baseRisk));
  };

  const heroRiskScore = calculateHeroRisk();

  const roleShowcases: {
    role: UserRole;
    title: string;
    description: string;
    color: string;
    badge: string;
    highlights: string[];
    metricsPreview: { label: string; value: string; change: string }[];
  }[] = [
    {
      role: 'Procurement Manager',
      title: 'Strategic Sourcing & Requisitions Desk',
      description: 'Streamline purchase requisitions, automate vendor bidding comparisons, evaluate reliability scores, and authorize purchase orders with 3-way matching.',
      color: 'from-blue-600 to-sky-500',
      badge: 'Procurement Ops',
      highlights: [
        'Requisition-to-PO conversion workflow',
        'Algorithmic preferred vendor selection matrix',
        'Purchase order line-item tracking & delivery status',
        'Tier 1/2/3 supplier classification oversight'
      ],
      metricsPreview: [
        { label: 'Active Requisitions', value: '14', change: '+3 new today' },
        { label: 'Authorized POs', value: `${purchaseOrders.length}`, change: '₹19.5 Cr spend' },
        { label: 'Sourcing Savings', value: '12.8%', change: 'vs benchmark' },
      ],
    },
    {
      role: 'Supply Chain Manager',
      title: 'Global Logistics Radar & Delay Predictor',
      description: 'Real-time transit telemetry, carrier performance analytics, port bottleneck alerts, and automated logistic regression delay risk mitigation.',
      color: 'from-cyan-600 to-teal-500',
      badge: 'Logistics Telemetry',
      highlights: [
        'Predictive delay risk forecasting per purchase order',
        'Carrier bottleneck radar (DHL, FedEx, Maersk, Expeditors)',
        'Warehouse receipt & material inspection logging',
        'Contingency buffer vendor recommendations'
      ],
      metricsPreview: [
        { label: 'Predicted On-Time', value: '93.4%', change: '+1.8% WoW' },
        { label: 'High Risk POs', value: '3', change: 'Mitigation suggested' },
        { label: 'Avg Transit Delay', value: '1.4 days', change: '-0.8 days' },
      ],
    },
    {
      role: 'Vendor',
      title: 'Self-Service Supplier Enterprise Portal',
      description: 'Transparent order fulfillment desk, real-time SLA metrics, purchase order acknowledgments, invoice disbursal tracking, and direct procurement messaging.',
      color: 'from-emerald-600 to-green-500',
      badge: 'Supplier Portal',
      highlights: [
        'Dedicated purchase order fulfillment workbench',
        'Reliability scorecard & delivery compliance rating',
        'Accounts payable invoice status & payment records',
        'Direct procurement officer messaging & specification exchange'
      ],
      metricsPreview: [
        { label: 'Vendor Reliability Score', value: '94 / 100', change: 'Tier 1 Preferred' },
        { label: 'Active POs Assigned', value: '6 Orders', change: '₹3.9 Cr value' },
        { label: 'Quality Rating', value: '4.8 / 5.0', change: '0.8% defect rate' },
      ],
    },
    {
      role: 'Administrator',
      title: 'Executive Cockpit & Platform Governance',
      description: 'Unified visibility into corporate supplier spend, predictive ML model precision, dataset ingestions, user permissions, and compliance health.',
      color: 'from-purple-600 to-indigo-500',
      badge: 'Executive Command',
      highlights: [
        'Total enterprise supplier spend & budget variances',
        'Predictive engine accuracy tracking (94.2% precision)',
        'Mendeley DataCo supply chain dataset ingestion',
        'System audit trail with full non-repudiation logging'
      ],
      metricsPreview: [
        { label: 'Total Managed Spend', value: '₹31.2 Cr', change: '6 categories' },
        { label: 'Monitored Suppliers', value: `${vendors.length}`, change: '100% audited' },
        { label: 'ML Prediction Accuracy', value: '94.2%', change: 'DataCo calibrated' },
      ],
    },
    {
      role: 'Finance Officer',
      title: 'Accounts Payable & Invoice Settlement',
      description: 'Three-way match verification between POs, receipts, and invoices. Schedule payments, prevent duplicate disbursements, and forecast cash outflows.',
      color: 'from-amber-600 to-orange-500',
      badge: 'Accounts Payable',
      highlights: [
        'Invoice aging register and automated settlement workflows',
        'Cash flow horizon modeling and payment terms optimization',
        'Disputed line item resolution tracking',
        'Bank-grade remittance audit logs'
      ],
      metricsPreview: [
        { label: 'Pending Disbursal', value: '₹2.0 Cr', change: '8 invoices' },
        { label: 'Avg Settlement Cycle', value: '18 Days', change: 'Net-30 standard' },
        { label: 'Payment Accuracy', value: '100%', change: '3-way matched' },
      ],
    },
    {
      role: 'Auditor',
      title: 'Regulatory Compliance & ISO Vault',
      description: 'Audit supplier certifications (ISO 9001, ISO 14001, SOC 2, RoHS), verify supplier contract renewal dates, and export compliance reports.',
      color: 'from-rose-600 to-pink-500',
      badge: 'Governance & Audit',
      highlights: [
        'ISO & regulatory certification validity monitors',
        'Contract expiration radar with 90-day alert thresholds',
        'Legally binding document verification & audit stamps',
        'Exportable ISO 9001 compliance audit reports'
      ],
      metricsPreview: [
        { label: 'Certified Suppliers', value: '92%', change: 'ISO 9001 verified' },
        { label: 'Expiring Certs (60d)', value: '2', change: 'Alerts dispatched' },
        { label: 'Audit Trail Events', value: '1,420+', change: 'Immutable logs' },
      ],
    },
  ];

  const currentShowcase = roleShowcases.find(r => r.role === selectedRoleTab) || roleShowcases[0];

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white overflow-x-hidden">
      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-500 shadow-lg shadow-sky-500/25">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white font-mono">VendorIQ</span>
                <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-500/20">PREDICTIVE AI</span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">Enterprise Supplier Risk & Performance Platform</p>
            </div>
          </div>

          {/* Nav Anchors */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#roles" className="hover:text-sky-400 transition-colors">Role Cockpits</a>
            <a href="#predictive" className="hover:text-sky-400 transition-colors">Risk Algorithm</a>
            <a href="#features" className="hover:text-sky-400 transition-colors">Capabilities</a>
            <a href="#dataset" className="hover:text-sky-400 transition-colors">DataCo Ingestion</a>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => onOpenAuth('login')}
              className="rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 transition-all shadow-sm flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5 text-sky-400" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Subtle Background Grid Mesh */}
        <div 
          aria-hidden="true" 
          className="absolute inset-0 -z-10 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none" 
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-950/40 px-3.5 py-1 text-xs font-semibold text-sky-300 backdrop-blur-md shadow-inner">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Next-Gen Supply Chain Intelligence</span>
              <span className="text-slate-600">•</span>
              <span className="text-sky-400">DataCo Benchmark Ingestion</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08]">
              Predictive Vendor Intelligence &{' '}
              <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Supplier Risk Radar
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
              Transform fragile supply chains into resilient, proactive ecosystems. Automate vendor reliability scoring (0–100), forecast transit delay risks with logistic regression models, and manage purchase orders through dedicated multi-role cockpits.
            </p>

            {/* Quick Action Matrix */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => onOpenAuth('login', 'Procurement Manager')}
                className="rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-sky-600/30 transition-all flex items-center gap-2.5 group cursor-pointer"
              >
                <span>Launch Enterprise Console</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => {
                  switchAccountToRole('Vendor');
                  setActiveView('vendors');
                }}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-950/60 px-5 py-3.5 text-sm font-bold text-emerald-300 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Building2 className="h-4 w-4" />
                <span>Vendors (All Categories)</span>
              </button>

              <button
                onClick={() => onOpenAuth('login')}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-300 transition-all flex items-center gap-2 cursor-pointer"
                title="Enter Enterprise Portal with authorized credentials"
              >
                <Lock className="h-4 w-4 text-sky-400" />
                <span>Enterprise Login</span>
              </button>
            </div>

            {/* Micro Trust Indicators */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Mendeley DataCo Tested</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-400" />
                <span>6 Operational Roles</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                <span>ISO 9001 Audited</span>
              </div>
            </div>
          </div>

          {/* Right Hero Column: Interactive 3D Cursor-Reactive Risk Simulator */}
          <div className="lg:col-span-5">
            <TiltCard maxTilt={10} className="rounded-3xl border border-sky-500/30 bg-slate-900/90 p-6 shadow-2xl shadow-sky-950/60 backdrop-blur-xl">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Live Risk Prediction Simulator</h3>
                    <p className="text-[10px] text-slate-400">Interactive Logistic Regression Model</p>
                  </div>
                </div>
                <Badge variant={heroRiskScore > 40 ? 'danger' : heroRiskScore > 20 ? 'warning' : 'success'} size="sm">
                  {heroRiskScore > 40 ? 'High Delay Risk' : heroRiskScore > 20 ? 'Moderate Risk' : 'Low Delay Risk'}
                </Badge>
              </div>

              {/* Dynamic Gauge / Score Display */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between mb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                    Calculated Delay Probability
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black font-mono tracking-tight ${
                      heroRiskScore > 40 ? 'text-rose-400' : heroRiskScore > 20 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {heroRiskScore}%
                    </span>
                    <span className="text-xs text-slate-400 font-medium">chance of shipment delay</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">AI Recommended Buffer</span>
                  <span className="text-sm font-bold text-sky-400 font-mono">
                    {heroRiskScore > 40 ? '+4 Days' : heroRiskScore > 20 ? '+2 Days' : '+0 Days'}
                  </span>
                </div>
              </div>

              {/* Interactive Controls that React Instantly */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Order Value (INR):</span>
                    <span className="font-mono text-sky-400">₹{simOrderValue.toLocaleString('en-IN')}</span>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={150000}
                    step={2500}
                    value={simOrderValue}
                    onChange={(e) => setSimOrderValue(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 font-semibold mb-1">
                    <span>Scheduled Lead Time:</span>
                    <span className="font-mono text-sky-400">{simLeadDays} Days</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={21}
                    step={1}
                    value={simLeadDays}
                    onChange={(e) => setSimLeadDays(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Shipping Carrier & Mode:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Expedited Air', 'Standard Freight', 'Ocean Cargo'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSimCarrier(mode)}
                        className={`p-2 rounded-xl text-[11px] font-bold transition-all ${
                          simCarrier === mode
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulated Recommendation */}
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span className="text-slate-500">Autonomous Mitigation:</span>
                <span className="font-semibold text-slate-200">
                  {heroRiskScore > 40 ? 'Require 3-day buffer carrier pre-booking' : 'Approve standard dispatch sequence'}
                </span>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* PLATFORM METRICS RIBBON */}
      <section className="border-y border-slate-800/80 bg-slate-900/40 backdrop-blur-md py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
              <p className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">94.2%</p>
              <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mt-1">Predictive ML Precision</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Calibrated via DataCo supply logs</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
              <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">₹35 Cr+</p>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mt-1">Prevented Delay Loss</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Through early route rerouting</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
              <p className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">6 Roles</p>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mt-1">Role-Tailored Portals</p>
              <p className="text-[11px] text-slate-500 mt-0.5">From Vendor to Executive Admin</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80">
              <p className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">100%</p>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mt-1">Compliance Auditability</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Immutable ISO 9001 trails</p>
            </div>
          </div>
        </div>
      </section>

      {/* ROLE COCKPITS EXPLORER */}
      <section id="roles" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Users className="h-3.5 w-3.5" />
            <span>Role-Tailored Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Six Specialized Operational Cockpits
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Every participant in the procurement and supply ecosystem receives a purpose-built view tailored to their precise responsibilities.
          </p>
        </div>

        {/* Role Tab Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {roleShowcases.map((item) => (
            <button
              key={item.role}
              onClick={() => setSelectedRoleTab(item.role)}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                selectedRoleTab === item.role
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-2 ring-sky-400/40'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {item.role}
            </button>
          ))}
        </div>

        {/* Active Role Showcase Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-400 border border-sky-500/20">
                  {currentShowcase.badge}
                </span>
                <span className="text-xs text-slate-500 font-mono">Perspective: {currentShowcase.role}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentShowcase.title}
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                {currentShowcase.description}
              </p>

              {/* Functional Highlights Checklist */}
              <div className="space-y-2 pt-2">
                {currentShowcase.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>

              {/* Action: Enter Dashboard as this role */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={() => switchAccountToRole(currentShowcase.role)}
                  className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Launch {currentShowcase.role} Cockpit</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onOpenAuth('register', currentShowcase.role)}
                  className="rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-all"
                >
                  Create {currentShowcase.role} Account
                </button>
              </div>
            </div>

            {/* Right: Metrics Snapshot Simulation */}
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Live Cockpit Telemetry Preview
              </p>
              {currentShowcase.metricsPreview.map((m, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">{m.label}</span>
                    <span className="text-xl font-bold text-white font-mono mt-0.5 block">{m.value}</span>
                  </div>
                  <span className="text-xs font-medium text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                    {m.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES GRID (3D Tilt Cards) */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-950/40 px-3 py-1 text-xs font-semibold text-sky-300">
            <Layers className="h-3.5 w-3.5" />
            <span>Comprehensive Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Built for End-to-End Enterprise Procurement
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Move your supply chain operations off static spreadsheets into a reactive predictive risk intelligence platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TiltCard className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3.5 hover:border-sky-500/40 transition-colors">
            <div className="h-10 w-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Automated Reliability Scoring</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calculates dynamic 0–100 vendor reliability ratings across delivery accuracy, quality ratings, defect rate, and contract adherence.
            </p>
          </TiltCard>

          <TiltCard className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3.5 hover:border-sky-500/40 transition-colors">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Predictive Delay Risk Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Logistic regression model evaluating order capital, lead times, and carrier performance to forecast delivery bottlenecks before dispatch.
            </p>
          </TiltCard>

          <TiltCard className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3.5 hover:border-sky-500/40 transition-colors">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Contract & ISO Compliance Vault</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated renewal horizon tracking, ISO 9001 / SOC 2 certification registries, and compliance audit trail exports.
            </p>
          </TiltCard>

          <TiltCard className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3.5 hover:border-sky-500/40 transition-colors">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">PO & Requisition Lifecycle</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Departmental requisitions, procurement approval queues, purchase order generation, and 3-way invoice matching.
            </p>
          </TiltCard>

          <TiltCard className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3.5 hover:border-sky-500/40 transition-colors">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">DataCo CSV Benchmark Ingestion</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload custom CSV datasets or instantiate the Mendeley DataCo benchmark to dynamically re-calibrate reliability metrics across suppliers.
            </p>
          </TiltCard>

          <TiltCard className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-3.5 hover:border-sky-500/40 transition-colors">
            <div className="h-10 w-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Instant Governance Reports</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export 5 mandatory executive compliance reports with formatted PDF printing and CSV export for board-level audits.
            </p>
          </TiltCard>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white font-mono">VendorIQ Enterprise</span>
            <span className="text-xs text-slate-500">© 2026 Enterprise Risk Management Platform</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <button onClick={() => switchAccountToRole('Administrator')} className="hover:text-sky-400 transition-colors cursor-pointer">
              Admin Access
            </button>
            <button onClick={() => switchAccountToRole('Procurement Manager')} className="hover:text-sky-400 transition-colors cursor-pointer">
              Procurement Manager
            </button>
            <button onClick={() => { switchAccountToRole('Vendor'); setActiveView('vendors'); }} className="hover:text-sky-400 transition-colors cursor-pointer">
              Vendor Portal
            </button>
            <button onClick={() => onOpenAuth('login')} className="text-sky-400 font-bold hover:underline cursor-pointer">
              Sign In →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const EnterprisePortal = LandingPage;
