import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Printer, 
  Download, 
  Send, 
  UserCheck,
  FileText,
  X,
  ChevronRight,
  ArrowRight,
  FileCheck2,
  TrendingUp,
  Calendar,
  DollarSign,
  AlertCircle,
  Briefcase,
  Globe
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Vendor, VendorCategory, VendorStatus, Contract } from '../../../types';
import { Badge } from '../../common/Badge';
import { ScoreGauge } from '../../common/MiniChart';
import { exportToCSV, triggerPrintReport } from '../../../utils/exportUtils';
import { sendRealEmail, sendRealSMS } from '../../../utils/notificationDispatcher';

const VENDOR_CATEGORIES: VendorCategory[] = [
  'Raw Material Suppliers',
  'Equipment Vendors',
  'IT Vendors',
  'Service Providers',
  'Logistics Partners',
  'Maintenance Vendors',
];

export const VendorManagementModule: React.FC = () => {
  const { 
    vendors, 
    registerVendor, 
    updateVendorStatus, 
    updateVendor, 
    contracts,
    addContract,
    updateContractStatus,
    currentRole, 
    currentUser,
    setActiveView 
  } = useApp();

  // 1. Category Swapper & Status Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'Pending' | 'Active' | 'Inactive' | 'Suspended' | 'Rejected'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // 2. Right-Hand Side Slide-out Drawer for Vendor Registration
  const [isRegisterDrawerOpen, setIsRegisterDrawerOpen] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    category: 'Raw Material Suppliers' as VendorCategory,
    primaryContactName: '',
    role: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    notes: '',
  });
  const [regSuccessMessage, setRegSuccessMessage] = useState<string | null>(null);

  // 3. Detail Pop-Up / Slide Screen with 4 Sections
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [activeDetailSection, setActiveDetailSection] = useState<'profile' | 'approval' | 'contracts' | 'performance'>('profile');

  // Sub-modal / Inline State for Adding Contract
  const [isAddingContract, setIsAddingContract] = useState(false);
  const [contractFilter, setContractFilter] = useState<'All' | 'Active' | 'Inactive' | 'Suspended'>('All');
  const [newContractForm, setNewContractForm] = useState<{
    title: string;
    contractValue: number;
    startDate: string;
    endDate: string;
    status: 'Active' | 'Inactive' | 'Suspended';
    termsSummary: string;
  }>({
    title: '',
    contractValue: 250000,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Active',
    termsSummary: 'Standard Enterprise Master Service Agreement with 95% delivery SLA commitment.',
  });

  // Administrative Status Action Note
  const [statusActionNote, setStatusActionNote] = useState('');

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      // Category match
      const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;

      // Status match (All, Pending, Active, Inactive, Suspended, Rejected)
      let matchesStatus = true;
      if (selectedStatusFilter === 'Pending') {
        matchesStatus = v.status === 'Pending' || v.status === 'Pending Approval' || v.status === 'Under Review';
      } else if (selectedStatusFilter === 'Active') {
        matchesStatus = v.status === 'Active';
      } else if (selectedStatusFilter === 'Inactive') {
        matchesStatus = v.status === 'Inactive';
      } else if (selectedStatusFilter === 'Suspended') {
        matchesStatus = v.status === 'Suspended';
      } else if (selectedStatusFilter === 'Rejected') {
        matchesStatus = v.status === 'Rejected' || v.status === 'Blacklisted';
      }

      // Search match
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        v.name.toLowerCase().includes(term) ||
        (v.tagline && v.tagline.toLowerCase().includes(term)) ||
        (v.contact?.primaryContactName && v.contact.primaryContactName.toLowerCase().includes(term)) ||
        (v.contact?.email && v.contact.email.toLowerCase().includes(term)) ||
        (v.contact?.city && v.contact.city.toLowerCase().includes(term)) ||
        (v.taxId && v.taxId.toLowerCase().includes(term));

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [vendors, selectedCategory, selectedStatusFilter, searchTerm]);

  // Counts for Category Tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: vendors.length };
    VENDOR_CATEGORIES.forEach(cat => {
      counts[cat] = vendors.filter(v => v.category === cat).length;
    });
    return counts;
  }, [vendors]);

  // Counts for Status Filter Pills
  const statusCounts = useMemo(() => {
    return {
      All: vendors.length,
      Pending: vendors.filter(v => v.status === 'Pending' || v.status === 'Pending Approval' || v.status === 'Under Review').length,
      Active: vendors.filter(v => v.status === 'Active').length,
      Inactive: vendors.filter(v => v.status === 'Inactive').length,
      Suspended: vendors.filter(v => v.status === 'Suspended').length,
      Rejected: vendors.filter(v => v.status === 'Rejected' || v.status === 'Blacklisted').length,
    };
  }, [vendors]);

  // Contracts for viewing vendor
  const viewingVendorContracts = useMemo(() => {
    if (!viewingVendor) return [];
    return contracts.filter(c => c.vendorId === viewingVendor.id || c.vendorName === viewingVendor.name);
  }, [contracts, viewingVendor]);

  const filteredVendorContracts = useMemo(() => {
    if (contractFilter === 'All') return viewingVendorContracts;
    return viewingVendorContracts.filter(c => c.status === contractFilter);
  }, [viewingVendorContracts, contractFilter]);

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.email.trim() || !regForm.primaryContactName.trim()) {
      alert('Please provide Vendor Name, Primary Contact Name, and Contact Email.');
      return;
    }

    registerVendor({
      name: regForm.name.trim(),
      category: regForm.category,
      status: 'Pending',
      contact: {
        primaryContactName: regForm.primaryContactName.trim(),
        role: regForm.role.trim() || 'Account Executive',
        title: regForm.role.trim() || 'Key Account Manager',
        email: regForm.email.trim(),
        phone: regForm.phone.trim() || '+1 (555) 000-0000',
        address: regForm.address.trim() || 'Corporate Headquarters',
        city: 'Metropolitan District',
        country: 'India',
        website: 'https://vendor-portal.internal',
      },
      registrationDate: new Date().toISOString().split('T')[0],
      taxId: regForm.taxId.trim() || `GSTIN-27AABC${Math.floor(1000 + Math.random() * 9000)}B1Z4`,
      bankAccount: 'HDFC Bank ****' + Math.floor(1000 + Math.random() * 9000),
      paymentTerms: 'Net 30',
      notes: regForm.notes.trim() || 'Submitted through Vendor Registration Portal. Awaiting Administrative review.',
    });

    setRegSuccessMessage(`Registration for "${regForm.name}" submitted successfully! Sent to Admin approval queue with status Pending.`);
    
    // Reset form
    setRegForm({
      name: '',
      category: 'Raw Material Suppliers',
      primaryContactName: '',
      role: '',
      email: '',
      phone: '',
      address: '',
      taxId: '',
      notes: '',
    });

    setTimeout(() => {
      setIsRegisterDrawerOpen(false);
      setRegSuccessMessage(null);
    }, 1800);
  };

  const handleAddContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingVendor || !newContractForm.title.trim()) return;

    addContract({
      title: newContractForm.title.trim(),
      vendorId: viewingVendor.id,
      vendorName: viewingVendor.name,
      category: viewingVendor.category,
      contractValue: Number(newContractForm.contractValue) || 100000,
      startDate: newContractForm.startDate,
      endDate: newContractForm.endDate,
      status: newContractForm.status,
      renewalNoticeDays: 30,
      autoRenew: true,
      complianceRate: 98.0,
      termsSummary: newContractForm.termsSummary.trim(),
    });

    // Increment vendor active contract count
    updateVendor(viewingVendor.id, {
      activeContractsCount: (viewingVendor.activeContractsCount || 0) + 1,
    });

    setIsAddingContract(false);
    setNewContractForm({
      title: '',
      contractValue: 250000,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Active',
      termsSummary: 'Standard Enterprise Master Service Agreement with 95% delivery SLA commitment.',
    });
  };

  const handleAdminApproveVendor = (vendorId: string) => {
    updateVendorStatus(vendorId, 'Active', statusActionNote || 'Approved via Vendor Governance Verification');
    if (viewingVendor && viewingVendor.id === vendorId) {
      setViewingVendor(prev => prev ? { ...prev, status: 'Active' } : null);
    }
    setStatusActionNote('');
  };

  const handleAdminRejectVendor = (vendorId: string) => {
    updateVendorStatus(vendorId, 'Rejected', statusActionNote || 'Registration did not meet compliance criteria');
    if (viewingVendor && viewingVendor.id === vendorId) {
      setViewingVendor(prev => prev ? { ...prev, status: 'Rejected' } : null);
    }
    setStatusActionNote('');
  };

  const handleAdminSuspendVendor = (vendorId: string) => {
    updateVendorStatus(vendorId, 'Suspended', statusActionNote || 'Temporary compliance suspension');
    if (viewingVendor && viewingVendor.id === vendorId) {
      setViewingVendor(prev => prev ? { ...prev, status: 'Suspended' } : null);
    }
    setStatusActionNote('');
  };

  // Only Administrator can approve, reject, or authorize vendor registrations
  const canApprove = currentRole === 'Administrator';
  const pendingVendors = vendors.filter(v => v.status === 'Pending' || v.status === 'Pending Approval' || v.status === 'Under Review');

  const handleExportCSV = () => {
    const rows = filteredVendors.map(v => ({
      VendorID: v.id,
      Name: v.name,
      Tagline: v.tagline || 'N/A',
      Category: v.category,
      PrimaryContact: v.contact?.primaryContactName || 'N/A',
      ContactRole: v.contact?.role || v.contact?.title || 'N/A',
      Email: v.contact?.email || 'N/A',
      Phone: v.contact?.phone || 'N/A',
      Status: v.status,
      ReliabilityScore: `${v.reliabilityScore}/100`,
      RiskLevel: v.riskLevel,
      OnboardedDate: v.registrationDate,
      TotalSpend: `₹${v.totalSpend.toLocaleString('en-IN')}`,
    }));

    exportToCSV('VendorIQ_Categorical_Directory', rows, {
      VendorID: 'Vendor ID',
      Name: 'Vendor Name',
      Tagline: 'Tagline',
      Category: 'Category',
      PrimaryContact: 'Primary Contact',
      ContactRole: 'Role',
      Email: 'Email',
      Phone: 'Phone',
      Status: 'Status',
      ReliabilityScore: 'Reliability Index',
      RiskLevel: 'Risk Level',
      OnboardedDate: 'Onboarded Date',
      TotalSpend: 'Total Spend (₹)',
    });
  };

  const handlePrintPDF = () => {
    const rows = filteredVendors.map(v => ({
      Vendor: v.name,
      Category: v.category,
      Contact: `${v.contact.primaryContactName} (${v.contact.phone})`,
      Status: v.status,
      Reliability: `${v.reliabilityScore}/100`,
      Onboarded: v.registrationDate,
      Spend: `₹${v.totalSpend.toLocaleString('en-IN')}`
    }));
    triggerPrintReport('Vendor_Categorical_Directory_Report', rows);
  };

  // Helper to determine approval step status for 4-step diagram
  const getApprovalStepState = (vendorStatus: VendorStatus) => {
    if (vendorStatus === 'Active') {
      return { step1: 'completed', step2: 'completed', step3: 'completed', step4: 'completed', activeStep: 4 };
    }
    if (vendorStatus === 'Under Review') {
      return { step1: 'completed', step2: 'completed', step3: 'active', step4: 'pending', activeStep: 3 };
    }
    if (vendorStatus === 'Pending' || vendorStatus === 'Pending Approval') {
      return { step1: 'completed', step2: 'active', step3: 'pending', step4: 'pending', activeStep: 2 };
    }
    if (vendorStatus === 'Rejected' || vendorStatus === 'Blacklisted') {
      return { step1: 'completed', step2: 'rejected', step3: 'rejected', step4: 'rejected', activeStep: 2 };
    }
    return { step1: 'completed', step2: 'pending', step3: 'pending', step4: 'pending', activeStep: 1 };
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER & SEARCH / REGISTER ACTIONS               */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md shadow-sky-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">Vendor Management & Categorical Directory</h1>
                <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-500/20">
                  {vendors.length} Vendors Registered
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Switch partitions, track approval stages, oversee contracts, and monitor real-time reliability metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Right Corner: Search & Register Vendor Button */}
        <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendors, contacts, tax ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden md:inline">Export</span>
          </button>

          <button
            onClick={handlePrintPDF}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Print PDF Report"
          >
            <Printer className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden md:inline">Print</span>
          </button>

          {/* Register Vendor Button */}
          <button
            onClick={() => {
              setIsRegisterDrawerOpen(true);
              setRegSuccessMessage(null);
            }}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-4 py-2 text-xs font-bold text-white transition-all flex items-center gap-2 shadow-lg shadow-sky-600/30 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register Vendor</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* ADMIN APPROVAL QUEUE BANNER                          */}
      {/* ---------------------------------------------------- */}
      {pendingVendors.length > 0 && canApprove && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-200">
                Administrative Approval Queue ({pendingVendors.length} New Vendor{pendingVendors.length > 1 ? 's' : ''} Awaiting Approval)
              </h3>
            </div>
            <Badge variant="warning" size="sm">Pending Admin Action</Badge>
          </div>
          <p className="text-xs text-slate-300">
            Review recently registered suppliers. Upon administrative approval, the vendor’s status transitions from <strong className="text-amber-400">Pending</strong> to <strong className="text-emerald-400">Active</strong>, permitting purchase order issuance and contract binding.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {pendingVendors.map((pv) => (
              <div key={pv.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-3 shadow-md">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs truncate">{pv.name}</span>
                    <Badge variant="warning" size="sm">{pv.status}</Badge>
                  </div>
                  {pv.tagline && <p className="text-[11px] text-sky-400/90 italic truncate mt-0.5">"{pv.tagline}"</p>}
                  <p className="text-[11px] text-slate-400 mt-1">{pv.category}</p>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    {pv.contact.primaryContactName} ({pv.contact.email})
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => handleAdminApproveVendor(pv.id)}
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setViewingVendor(pv);
                      setActiveDetailSection('approval');
                    }}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Review Flow
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. CATEGORY SWAPPER TABS                             */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Vendor Categories (Swap Partitions)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Viewing: {selectedCategory} ({filteredVendors.length} of {vendors.length})
          </span>
        </div>

        {/* Tab row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-1 ring-sky-400/50'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>All Categories</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              selectedCategory === 'All' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {categoryCounts.All}
            </span>
          </button>

          {VENDOR_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-1 ring-sky-400/50'
                    : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{cat}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isSelected ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {categoryCounts[cat] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. STATUS FILTER BAR                                 */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Filter by Status:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['All', 'Pending', 'Active', 'Inactive', 'Suspended', 'Rejected'] as const).map((st) => {
              const isSelected = selectedStatusFilter === st;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? st === 'Active' ? 'bg-emerald-600 text-white shadow-sm' :
                        st === 'Pending' ? 'bg-amber-600 text-white shadow-sm' :
                        st === 'Suspended' ? 'bg-rose-600 text-white shadow-sm' :
                        st === 'Rejected' ? 'bg-slate-700 text-white shadow-sm' :
                        'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{st}</span>
                  <span className="text-[10px] opacity-80 font-mono">({statusCounts[st] || 0})</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-1 self-end sm:self-center">
          <span>Showing</span>
          <strong className="text-white font-mono">{filteredVendors.length}</strong>
          <span>matches</span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. VENDORS TABLE                                     */}
      {/* ---------------------------------------------------- */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Vendor</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-4">Primary Contact</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4">Reliability</th>
                <th className="py-3.5 px-4">Onboarded Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8 text-slate-600" />
                      <p className="font-semibold text-sm text-slate-300">No vendors found matching your filters</p>
                      <p className="text-xs text-slate-500">
                        Try adjusting your category selection, status filter, or search keywords.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => (
                  <tr 
                    key={v.id} 
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      setViewingVendor(v);
                      setActiveDetailSection('profile');
                    }}
                  >
                    {/* Vendor Name & Tagline */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold text-xs">
                          {v.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingVendor(v);
                              setActiveDetailSection('profile');
                            }}
                            className="text-left font-bold text-white group-hover:text-sky-400 transition-colors truncate block text-xs"
                          >
                            {v.name}
                          </button>
                          {v.tagline && (
                            <p className="text-[11px] text-sky-400/80 truncate italic mt-0.5">
                              {v.tagline}
                            </p>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            {v.id} • {v.taxId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-3">
                      <span className="inline-block rounded-lg bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-200 border border-slate-800 whitespace-nowrap">
                        {v.category}
                      </span>
                    </td>

                    {/* Primary Contact */}
                    <td className="py-3.5 px-4">
                      <div className="min-w-0">
                        <p className="text-slate-200 font-bold text-xs truncate">
                          {v.contact.primaryContactName}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {v.contact.role || v.contact.title || 'Representative'}
                        </p>
                        <p className="text-[10px] text-sky-400/90 font-mono truncate mt-0.5">
                          {v.contact.email}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-3">
                      <Badge
                        variant={
                          v.status === 'Active' ? 'success' :
                          v.status === 'Pending' || v.status === 'Pending Approval' || v.status === 'Under Review' ? 'warning' :
                          v.status === 'Suspended' ? 'danger' :
                          v.status === 'Rejected' || v.status === 'Blacklisted' ? 'neutral' : 'info'
                        }
                        size="sm"
                        dot={v.status === 'Active'}
                      >
                        {v.status}
                      </Badge>
                    </td>

                    {/* Reliability */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs">{v.reliabilityScore}/100</span>
                          <span className={`text-[10px] font-semibold ${
                            v.riskLevel === 'Low' ? 'text-emerald-400' :
                            v.riskLevel === 'Medium' ? 'text-sky-400' :
                            v.riskLevel === 'High' ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            ({v.riskLevel} Risk)
                          </span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              v.reliabilityScore >= 85 ? 'bg-emerald-500' :
                              v.reliabilityScore >= 70 ? 'bg-blue-500' :
                              v.reliabilityScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${v.reliabilityScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Onboarded Date */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-300 text-xs">
                        {v.registrationDate}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canApprove && (v.status === 'Pending' || v.status === 'Pending Approval' || v.status === 'Under Review') && (
                          <button
                            onClick={() => handleAdminApproveVendor(v.id)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                            title="Approve & Activate Vendor"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Approve
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setViewingVendor(v);
                            setActiveDetailSection('profile');
                          }}
                          className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Open 4-Section Profile & Approval Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. RIGHT-HAND SLIDE-OUT DRAWER FOR VENDOR REGISTER   */}
      {/* ---------------------------------------------------- */}
      {isRegisterDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="fixed inset-y-0 right-0 max-w-full flex pl-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Register New Vendor</h3>
                      <p className="text-xs text-slate-400">Submits to Admin for governance approval</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsRegisterDrawerOpen(false)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Body: All Requested Form Fields */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {regSuccessMessage && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{regSuccessMessage}</span>
                  </div>
                )}

                {/* Professional Status Notice */}
                <div className="rounded-xl border border-sky-500/25 bg-sky-950/40 p-3.5 flex items-start gap-2.5 text-xs mb-1">
                  <ShieldCheck className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sky-200">
                      New vendors enter as <span className="text-amber-400 font-bold">Pending Verification</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      All new supplier onboarding submissions are registered in Pending status and routed for administrative review and compliance verification.
                    </p>
                  </div>
                </div>

                <form id="vendor-reg-form" onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
                  {/* Vendor Name */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Vendor Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Industrial Materials Corp."
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={regForm.category}
                      onChange={(e) => setRegForm({ ...regForm, category: e.target.value as VendorCategory })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {VENDOR_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Contact Name & Role */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Primary Contact Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Primary Contact Name"
                        value={regForm.primaryContactName}
                        onChange={(e) => setRegForm({ ...regForm, primaryContactName: e.target.value })}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Account Executive"
                        value={regForm.role}
                        onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="dchen@company.com"
                        value={regForm.email}
                        onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        placeholder="+91 98200 12345"
                        value={regForm.phone}
                        onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Registered Address */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Registered Address
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Plot 42, Industrial Area Phase II, Electronic City, Bengaluru"
                      value={regForm.address}
                      onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Tax / GST ID */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Tax / GST ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 29AAAAA0000A1Z5 or US-EIN-94-2819034"
                      value={regForm.taxId}
                      onChange={(e) => setRegForm({ ...regForm, taxId: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  {/* Notes (Optional) */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Key capabilities, certifications, ISO standards, payment preferences..."
                      value={regForm.notes}
                      onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </form>
              </div>

              {/* Drawer Footer with Final Buttons */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterDrawerOpen(false)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="vendor-reg-form"
                  className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Submit for Approval</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. VENDOR DETAILS POP-UP MODAL (4 SECTIONS)          */}
      {/* ---------------------------------------------------- */}
      {viewingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Accent Glow */}
            <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />

            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800/80 flex items-start justify-between bg-slate-950/40">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-sky-500/20 shrink-0">
                  {viewingVendor.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">{viewingVendor.name}</h2>
                    <Badge
                      variant={
                        viewingVendor.status === 'Active' ? 'success' :
                        viewingVendor.status === 'Pending' || viewingVendor.status === 'Pending Approval' || viewingVendor.status === 'Under Review' ? 'warning' :
                        viewingVendor.status === 'Suspended' ? 'danger' : 'neutral'
                      }
                      size="sm"
                    >
                      {viewingVendor.status}
                    </Badge>
                  </div>
                  {viewingVendor.tagline && (
                    <p className="text-xs text-sky-400 italic mt-0.5">"{viewingVendor.tagline}"</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    {viewingVendor.id} • Categorized under <strong className="text-slate-200">{viewingVendor.category}</strong> • Onboarded: {viewingVendor.registrationDate}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingVendor(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 4 Section Navigation Tabs */}
            <div className="px-6 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2 overflow-x-auto py-2">
                <button
                  onClick={() => setActiveDetailSection('profile')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeDetailSection === 'profile'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>1. Profile & Details</span>
                </button>

                <button
                  onClick={() => setActiveDetailSection('approval')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeDetailSection === 'approval'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>2. Approval Workflow</span>
                </button>

                <button
                  onClick={() => setActiveDetailSection('contracts')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeDetailSection === 'contracts'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>3. Contracts ({viewingVendorContracts.length})</span>
                </button>

                <button
                  onClick={() => setActiveDetailSection('performance')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeDetailSection === 'performance'
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>4. Reliability Benchmark</span>
                </button>
              </div>
            </div>

            {/* Modal Body Content (Switching between the 4 sections) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ==================================================== */}
              {/* SECTION 1: PROFILE & CATEGORY DETAILS                */}
              {/* ==================================================== */}
              {activeDetailSection === 'profile' && (
                <div className="space-y-6 text-xs animate-in fade-in duration-150">
                  {/* Primary Overview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Left: Score Card */}
                    <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center text-center">
                      <ScoreGauge score={viewingVendor.reliabilityScore} size={110} label="Reliability" />
                      <Badge 
                        variant={viewingVendor.riskLevel === 'Low' ? 'success' : viewingVendor.riskLevel === 'Medium' ? 'info' : 'danger'} 
                        size="sm" 
                        className="mt-2.5"
                      >
                        {viewingVendor.tier}
                      </Badge>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {viewingVendor.metrics.onTimeDeliveries} on-time of {viewingVendor.metrics.totalDeliveries} total dispatches
                      </p>
                    </div>

                    {/* Middle & Right: Operations & Contact */}
                    <div className="md:col-span-2 p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3.5">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
                        Primary Contact & Corporate Operations
                      </h4>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Primary Contact:</span>
                          <span className="text-slate-200 font-bold">{viewingVendor.contact.primaryContactName}</span>
                          <span className="text-[11px] text-slate-400 block">{viewingVendor.contact.role || viewingVendor.contact.title}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Email Address:</span>
                          <span className="text-sky-400 font-mono">{viewingVendor.contact.email}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Phone:</span>
                          <span className="text-slate-200 font-mono">{viewingVendor.contact.phone}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Location / City:</span>
                          <span className="text-slate-200">{viewingVendor.contact.city}, {viewingVendor.contact.country}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Tax / GST ID:</span>
                          <span className="text-slate-200 font-mono">{viewingVendor.taxId}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Standard Payment Terms:</span>
                          <span className="text-slate-200 font-medium">{viewingVendor.paymentTerms || 'Net 30'}</span>
                        </div>
                      </div>

                      {viewingVendor.contact.address && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <span className="text-slate-400 block text-[11px]">Registered Address:</span>
                          <span className="text-slate-300">{viewingVendor.contact.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Metric Strips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Total Invoiced Spend</span>
                      <span className="text-base font-bold font-mono text-white mt-0.5 block">
                        ₹{viewingVendor.totalSpend.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Active Contracts</span>
                      <span className="text-base font-bold font-mono text-sky-400 mt-0.5 block">
                        {viewingVendorContracts.length} Master Agreements
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Quality Rating</span>
                      <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                        {viewingVendor.metrics.qualityRating} / 5.0 ★
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Defect Rate</span>
                      <span className="text-base font-bold font-mono text-amber-400 mt-0.5 block">
                        {viewingVendor.metrics.defectRate}%
                      </span>
                    </div>
                  </div>

                  {viewingVendor.notes && (
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1">
                      <span className="text-slate-400 text-[11px] font-bold block uppercase tracking-wider">
                        Operational & Compliance Notes
                      </span>
                      <p className="text-slate-300 leading-relaxed">{viewingVendor.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 2: 4-STEP APPROVAL FLOW DIAGRAM              */}
              {/* ==================================================== */}
              {activeDetailSection === 'approval' && (
                <div className="space-y-6 text-xs animate-in fade-in duration-150">
                  <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-5">
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">Vendor Governance Approval Flow</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        4-stage qualification sequence required for enterprise purchasing authorization.
                      </p>
                    </div>

                    {/* Simple 4-Step Flow Diagram */}
                    {(() => {
                      const stepState = getApprovalStepState(viewingVendor.status);
                      const steps = [
                        { id: 1, key: 'step1', title: 'Submitted', desc: 'Vendor credentials registered' },
                        { id: 2, key: 'step2', title: 'Document Review', desc: 'Tax ID & address verified' },
                        { id: 3, key: 'step3', title: 'Risk Assessment', desc: 'Reliability & SLA scored' },
                        { id: 4, key: 'step4', title: 'Approved', desc: 'Authorized for PO issuance' },
                      ];

                      return (
                        <div className="py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
                            {steps.map((st, idx) => {
                              const isCompleted = stepState[st.key as keyof typeof stepState] === 'completed';
                              const isActive = stepState[st.key as keyof typeof stepState] === 'active';
                              const isRejected = stepState[st.key as keyof typeof stepState] === 'rejected';

                              return (
                                <div key={st.id} className="relative flex flex-col items-center text-center">
                                  {/* Step Connector Line */}
                                  {idx < steps.length - 1 && (
                                    <div className={`hidden sm:block absolute top-5 left-1/2 w-full h-0.5 z-0 ${
                                      isCompleted ? 'bg-emerald-500' : 'bg-slate-800'
                                    }`} />
                                  )}

                                  {/* Step Icon / Circle */}
                                  <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl font-bold text-xs transition-all ${
                                    isCompleted 
                                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/40' 
                                      : isActive
                                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400 animate-pulse'
                                      : isRejected
                                      ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                                  }`}>
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : isRejected ? (
                                      <XCircle className="h-5 w-5" />
                                    ) : (
                                      <span>0{st.id}</span>
                                    )}
                                  </div>

                                  <div className="mt-2.5 space-y-0.5">
                                    <span className={`text-xs font-bold block ${
                                      isCompleted ? 'text-emerald-300' : isActive ? 'text-amber-300 font-extrabold' : isRejected ? 'text-rose-300' : 'text-slate-400'
                                    }`}>
                                      {st.title}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block max-w-[130px]">
                                      {st.desc}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Status Alert Banner */}
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-400">Current Governance Status:</span>
                        <Badge
                          variant={
                            viewingVendor.status === 'Active' ? 'success' :
                            viewingVendor.status === 'Pending' || viewingVendor.status === 'Pending Approval' || viewingVendor.status === 'Under Review' ? 'warning' :
                            viewingVendor.status === 'Suspended' ? 'danger' : 'neutral'
                          }
                          size="md"
                        >
                          {viewingVendor.status}
                        </Badge>
                      </div>

                      <span className="text-[11px] text-slate-400">
                        {viewingVendor.status === 'Active' 
                          ? 'Approved for procurement orders & contract binding.' 
                          : viewingVendor.status === 'Pending' || viewingVendor.status === 'Pending Approval'
                          ? 'Submitted & awaiting Administrative review.'
                          : viewingVendor.status === 'Under Review'
                          ? 'Under technical audit & risk assessment.'
                          : 'Vendor not currently authorized for order fulfillment.'}
                      </span>
                    </div>

                    {/* Administrative Approval Controls */}
                    {canApprove && (
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                        <span className="text-xs font-bold text-white block">
                          Administrative Action & Stage Controls
                        </span>
                        
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Audit Trail / Approval Note:
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. GSTIN & ISO credentials verified, MSA agreement finalized..."
                            value={statusActionNote}
                            onChange={(e) => setStatusActionNote(e.target.value)}
                            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => handleAdminApproveVendor(viewingVendor.id)}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-700/30"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Approve & Authorize Vendor</span>
                          </button>

                          <button
                            onClick={() => {
                              updateVendorStatus(viewingVendor.id, 'Under Review', statusActionNote || 'Moved to document review & risk scoring');
                              setViewingVendor(prev => prev ? { ...prev, status: 'Under Review' } : null);
                              setStatusActionNote('');
                            }}
                            className="rounded-xl bg-amber-600 hover:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-700/30"
                          >
                            <Clock className="h-4 w-4" />
                            <span>Set to Under Review</span>
                          </button>

                          <button
                            onClick={() => handleAdminSuspendVendor(viewingVendor.id)}
                            className="rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <AlertTriangle className="h-4 w-4 text-rose-400" />
                            <span>Suspend</span>
                          </button>

                          <button
                            onClick={() => handleAdminRejectVendor(viewingVendor.id)}
                            className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {!canApprove && (
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-200">Administrator Approval Authorization Required</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                            New vendor registration approvals, credentials verification, and compliance status changes are reserved strictly for the <strong>Administrator</strong>. Once approved, the vendor will automatically appear in your active procurement catalog.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 3: CONTRACTS (ADD CONTRACT & STATUS FILTER)  */}
              {/* ==================================================== */}
              {activeDetailSection === 'contracts' && (
                <div className="space-y-4 text-xs animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Vendor Contracts & Master Service Agreements</h4>
                      <p className="text-[11px] text-slate-400">
                        Oversee active agreements, SLA commitments, and binding status.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Filter Contract Status */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {(['All', 'Active', 'Inactive', 'Suspended'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => setContractFilter(st)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                              contractFilter === st
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {/* Add Contract Button */}
                      <button
                        onClick={() => setIsAddingContract(true)}
                        className="rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-600/30 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Contract</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Contract Form */}
                  {isAddingContract && (
                    <div className="p-4.5 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-3.5 shadow-xl animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                          <FileCheck2 className="h-4 w-4" />
                          <span>Add New Contract for {viewingVendor.name}</span>
                        </span>
                        <button 
                          onClick={() => setIsAddingContract(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <form onSubmit={handleAddContractSubmit} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Contract Title *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Master Supply Agreement 2026-2027"
                              value={newContractForm.title}
                              onChange={(e) => setNewContractForm({ ...newContractForm, title: e.target.value })}
                              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Contract Value (₹) *
                            </label>
                            <input
                              type="number"
                              required
                              placeholder="500000"
                              value={newContractForm.contractValue}
                              onChange={(e) => setNewContractForm({ ...newContractForm, contractValue: Number(e.target.value) })}
                              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={newContractForm.startDate}
                              onChange={(e) => setNewContractForm({ ...newContractForm, startDate: e.target.value })}
                              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={newContractForm.endDate}
                              onChange={(e) => setNewContractForm({ ...newContractForm, endDate: e.target.value })}
                              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Contract Status *
                            </label>
                            <select
                              value={newContractForm.status}
                              onChange={(e) => setNewContractForm({ ...newContractForm, status: e.target.value as any })}
                              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Suspended">Suspended</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Terms Summary & SLA Obligations
                          </label>
                          <textarea
                            rows={2}
                            placeholder="SLA requirements, payment milestones, defect clauses..."
                            value={newContractForm.termsSummary}
                            onChange={(e) => setNewContractForm({ ...newContractForm, termsSummary: e.target.value })}
                            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsAddingContract(false)}
                            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                          >
                            Save Contract
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* List of Contracts */}
                  {filteredVendorContracts.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800 text-slate-400">
                      <p className="font-semibold text-slate-300">No contracts found for this status</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Click "+ Add Contract" above to bind a new master service agreement.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredVendorContracts.map((c) => (
                        <div key={c.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{c.title}</span>
                              <Badge
                                variant={
                                  c.status === 'Active' ? 'success' :
                                  c.status === 'Suspended' ? 'danger' :
                                  c.status === 'Inactive' ? 'neutral' : 'warning'
                                }
                                size="sm"
                              >
                                {c.status}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Value: <strong className="text-white font-mono">₹{c.contractValue.toLocaleString('en-IN')}</strong> • Term: {c.startDate} to {c.endDate}
                            </p>
                            <p className="text-[11px] text-slate-300 italic">
                              "{c.termsSummary}"
                            </p>
                          </div>

                          {/* Status Switcher Buttons for Contract */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {c.status !== 'Active' && (
                              <button
                                onClick={() => updateContractStatus(c.id, 'Active')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Set Active
                              </button>
                            )}
                            {c.status !== 'Inactive' && (
                              <button
                                onClick={() => updateContractStatus(c.id, 'Inactive')}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Inactive
                              </button>
                            )}
                            {c.status !== 'Suspended' && (
                              <button
                                onClick={() => updateContractStatus(c.id, 'Suspended')}
                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/40 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Suspend
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* SECTION 4: PERFORMANCE & RELIABILITY BENCHMARK       */}
              {/* ==================================================== */}
              {activeDetailSection === 'performance' && (
                <div className="space-y-6 text-xs animate-in fade-in duration-150">
                  {/* KPI Radar Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">On-Time Delivery SLA</span>
                      <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                        {viewingVendor.metrics.onTimeDeliveryRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {viewingVendor.metrics.onTimeDeliveries} of {viewingVendor.metrics.totalDeliveries} on schedule
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Defect & RMA Rate</span>
                      <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                        {viewingVendor.metrics.defectRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Quality score: {viewingVendor.metrics.qualityRating} / 5.0
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Response Latency</span>
                      <span className="text-xl font-bold font-mono text-sky-400 mt-1 block">
                        {viewingVendor.metrics.communicationResponseTimeHours} hrs
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Resolution: {viewingVendor.metrics.issueResolutionTimeDays} days avg
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Order Completion Rate</span>
                      <span className="text-xl font-bold font-mono text-indigo-400 mt-1 block">
                        {viewingVendor.metrics.orderCompletionRate}%
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Service rating: {viewingVendor.metrics.serviceRating} / 5.0
                      </span>
                    </div>
                  </div>

                  {/* 6 Reliability Factors Breakdown */}
                  <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Dynamic Reliability Factor Decomposition (0–100 Weighted)
                      </h4>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        Overall Score: {viewingVendor.reliabilityScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: 'Delivery History SLA', score: viewingVendor.reliabilityFactors.deliveryHistoryScore, color: 'bg-emerald-500' },
                        { label: 'Product Quality & QA Passing', score: viewingVendor.reliabilityFactors.productQualityScore, color: 'bg-blue-500' },
                        { label: 'Communication Latency', score: viewingVendor.reliabilityFactors.communicationEfficiencyScore, color: 'bg-sky-500' },
                        { label: 'Contract Compliance & Terms', score: viewingVendor.reliabilityFactors.contractComplianceScore, color: 'bg-indigo-500' },
                        { label: 'Purchase Order History Volume', score: viewingVendor.reliabilityFactors.purchaseHistoryScore, color: 'bg-purple-500' },
                        { label: 'Issue Resolution Efficiency', score: viewingVendor.reliabilityFactors.issueResolutionScore, color: 'bg-teal-500' },
                      ].map((factor, idx) => (
                        <div key={idx} className="space-y-1.5 p-3 rounded-xl bg-slate-900 border border-slate-800/80">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-semibold">{factor.label}</span>
                            <span className="font-mono text-white font-bold">{factor.score}/100</span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${factor.color}`}
                              style={{ width: `${factor.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monthly Performance Trend */}
                  {viewingVendor.performanceHistory && viewingVendor.performanceHistory.length > 0 && (
                    <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        5-Month Historical Reliability & On-Time Trend
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {viewingVendor.performanceHistory.map((hist, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                            <span className="text-[11px] font-bold text-slate-400 block">{hist.month}</span>
                            <span className="text-base font-bold font-mono text-white mt-1 block">
                              {hist.reliabilityScore}/100
                            </span>
                            <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px]">
                              <span className="text-emerald-400 font-mono">{hist.onTimeRate}% SLA</span>
                              <span>•</span>
                              <span className="text-amber-400 font-mono">{hist.qualityScore}★</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Direct Actions:</span>
                <button
                  onClick={() => sendRealEmail(
                    viewingVendor.contact.email,
                    `Official Communication from VendorIQ Procurement: ${viewingVendor.name}`,
                    `Dear ${viewingVendor.contact.primaryContactName},\n\nWe are writing to you regarding operational performance and contract coordination for ${viewingVendor.name}.`
                  )}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs text-sky-400 font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Send Email</span>
                </button>
                <button
                  onClick={() => sendRealSMS(
                    viewingVendor.contact.phone,
                    `[VendorIQ Notice] Priority alert regarding your vendor profile and procurement orders for ${viewingVendor.name}.`
                  )}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-xs text-emerald-400 font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>SMS Alert</span>
                </button>
              </div>

              <button
                onClick={() => setViewingVendor(null)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
