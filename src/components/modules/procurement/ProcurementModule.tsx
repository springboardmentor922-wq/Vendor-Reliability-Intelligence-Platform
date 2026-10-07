import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  FileText, 
  Clock, 
  CheckCircle, 
  CheckCircle2,
  XCircle,
  Truck, 
  Receipt, 
  DollarSign, 
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  CreditCard,
  Building2,
  Package,
  Layers,
  Printer,
  Download,
  X,
  Send,
  Calendar,
  AlertCircle,
  User,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { ProcurementStatus, VendorCategory, POLineItem, PurchaseOrder, ProcurementRequest } from '../../../types';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { exportToCSV, triggerPrintReport } from '../../../utils/exportUtils';
import { sendRealEmail, sendRealSMS } from '../../../utils/notificationDispatcher';

interface ItemFormState {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export const ProcurementModule: React.FC = () => {
  const { 
    purchaseOrders, 
    procurementRequests, 
    invoices, 
    vendors, 
    createProcurementRequest, 
    updateProcurementRequestStatus,
    createPurchaseOrder, 
    updatePurchaseOrderStatus,
    acceptPurchaseOrderByVendor,
    delayPurchaseOrder,
    cancelPurchaseOrder,
    payInvoice,
    currentUser,
    currentRole,
    currentVendorId 
  } = useApp();

  // Role permissions
  const isVendor = currentRole === 'Vendor';
  const effectiveVendorId = (isVendor && currentUser.vendorId) ? currentUser.vendorId : currentVendorId;

  // 1. Swap between Requests & Purchase Orders (and optional Invoices)
  const [activeTab, setActiveTab] = useState<'requests' | 'pos' | 'invoices'>('requests');

  // 2. Status Filter: all, draft, submitted, approval, rejected
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted' | 'approval' | 'rejected'>('all');

  // 3. Priority Filter: all, low, medium, high, urgent
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all');

  // 4. Search
  const [searchTerm, setSearchTerm] = useState('');

  // ----------------------------------------------------
  // SLIDING DRAWER / POPUP: CREATE PURCHASE ORDER
  // ----------------------------------------------------
  const [isPOCreateOpen, setIsPOCreateOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [poDepartment, setPoDepartment] = useState('IT');
  const [poPriority, setPoPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('2026-10-25');
  const [paymentTerms, setPaymentTerms] = useState('Net 15');
  const [poNotes, setPoNotes] = useState('');
  const [orderItems, setOrderItems] = useState<ItemFormState[]>([
    {
      id: 'itm-1',
      description: 'Industrial Titanium Flanges ASTM B381 (Grade 2)',
      quantity: 50,
      unitPrice: 1250,
    }
  ]);

  const itemsSubtotal = orderItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

  const handleAddItem = () => {
    setOrderItems(prev => [
      ...prev,
      {
        id: `itm-${Date.now()}`,
        description: '',
        quantity: 10,
        unitPrice: 500,
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (orderItems.length <= 1) return;
    setOrderItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ItemFormState, value: any) => {
    setOrderItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          [field]: field === 'quantity' || field === 'unitPrice' ? Number(value) : value
        };
      }
      return item;
    }));
  };

  const handleCreatePO = (statusMode: 'Draft' | 'Submitted') => {
    const targetVendor = vendors.find(v => v.id === selectedVendorId) || vendors[0];
    if (!targetVendor) return;

    const validatedItems: POLineItem[] = orderItems.map((item, idx) => ({
      id: `LINE-${idx + 1}`,
      description: item.description.trim() || 'Procurement Line Item',
      quantity: Math.max(1, Number(item.quantity)),
      unitPrice: Math.max(1, Number(item.unitPrice)),
      totalPrice: Math.max(1, Number(item.quantity)) * Math.max(1, Number(item.unitPrice)),
    }));

    const finalStatus: ProcurementStatus = statusMode === 'Draft' ? 'Draft' : 'Pending Vendor Acceptance';

    createPurchaseOrder({
      purchaseRequestId: `PR-PO-${Date.now()}`,
      vendorId: targetVendor.id,
      vendorName: targetVendor.name,
      vendorCategory: targetVendor.category,
      totalAmount: itemsSubtotal,
      currency: 'INR',
      expectedDeliveryDate,
      paymentTerms,
      priority: poPriority,
      department: poDepartment,
      status: finalStatus,
      notes: `${poNotes ? `[Notes]: ${poNotes} | ` : ''}Terms: ${paymentTerms} | Dept: ${poDepartment} | Priority: ${poPriority}`,
      items: validatedItems,
      createdBy: currentUser.name,
    });

    // Reset Form
    setIsPOCreateOpen(false);
    setOrderItems([
      {
        id: 'itm-1',
        description: '',
        quantity: 10,
        unitPrice: 500,
      }
    ]);
    setPoNotes('');
  };

  // ----------------------------------------------------
  // SLIDING DRAWER / POPUP: NEW PROCUREMENT REQUEST
  // ----------------------------------------------------
  const [isReqCreateOpen, setIsReqCreateOpen] = useState(false);
  const [reqForm, setReqForm] = useState<{
    itemDescription: string;
    department: string;
    requestedBy: string;
    quantity: number;
    neededBy: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    justification: string;
  }>({
    itemDescription: '',
    department: 'IT',
    requestedBy: currentUser.name || 'Procurement Coordinator',
    quantity: 25,
    neededBy: '2026-10-20',
    priority: 'Medium',
    justification: '',
  });

  const handleReqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqForm.itemDescription.trim()) {
      alert('Please enter an item or service description.');
      return;
    }

    // Map department to vendor category
    let mappedCategory: VendorCategory = 'IT Vendors';
    if (reqForm.department.toLowerCase().includes('raw') || reqForm.department.toLowerCase().includes('material')) {
      mappedCategory = 'Raw Material Suppliers';
    } else if (reqForm.department.toLowerCase().includes('equip') || reqForm.department.toLowerCase().includes('machine')) {
      mappedCategory = 'Equipment Vendors';
    } else if (reqForm.department.toLowerCase().includes('maint')) {
      mappedCategory = 'Maintenance Vendors';
    } else if (reqForm.department.toLowerCase().includes('logist') || reqForm.department.toLowerCase().includes('freight')) {
      mappedCategory = 'Logistics Partners';
    } else if (reqForm.department.toLowerCase().includes('service')) {
      mappedCategory = 'Service Providers';
    }

    createProcurementRequest({
      title: reqForm.itemDescription.trim(),
      department: reqForm.department,
      requestedBy: reqForm.requestedBy,
      category: mappedCategory,
      estimatedBudget: reqForm.quantity * 2500,
      urgency: reqForm.priority === 'Urgent' ? 'Critical' : reqForm.priority,
      priority: reqForm.priority,
      quantity: Number(reqForm.quantity) || 1,
      neededBy: reqForm.neededBy,
      requiredDate: reqForm.neededBy,
      justification: reqForm.justification.trim() || `Department requisition for ${reqForm.department} operations.`,
    });

    // Notify vendors of that selected department
    const matchingVendors = vendors.filter(v => v.category === mappedCategory);
    matchingVendors.forEach(v => {
      sendRealEmail(
        v.contact.email,
        `New ${reqForm.department} Requisition Approval Request: ${reqForm.itemDescription}`,
        `Hello ${v.contact.primaryContactName},\n\nA new procurement request has been submitted for ${reqForm.department} by ${reqForm.requestedBy}.\n\nItem/Service: ${reqForm.itemDescription}\nQuantity: ${reqForm.quantity}\nNeeded by: ${reqForm.neededBy}\nPriority: ${reqForm.priority}\n\nPlease review in your VendorIQ supplier portal.`
      );
    });

    setIsReqCreateOpen(false);
    setReqForm({
      itemDescription: '',
      department: 'IT',
      requestedBy: currentUser.name || 'Procurement Coordinator',
      quantity: 25,
      neededBy: '2026-10-20',
      priority: 'Medium',
      justification: '',
    });
  };

  // ----------------------------------------------------
  // VENDOR INTERVENTION ACTIONS: DELAY / CANCEL MODAL
  // ----------------------------------------------------
  const [delayModalPO, setDelayModalPO] = useState<PurchaseOrder | null>(null);
  const [delayReason, setDelayReason] = useState('Vendor reliability score dropped below acceptable SLA threshold. Requisition delayed pending corrective audit.');
  const [cancelModalPO, setCancelModalPO] = useState<PurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('Vendor performance metrics violation: High defect rate and repeated delivery SLA failures.');

  // Viewing detail modal for PO
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  // Viewing detail modal for Request
  const [viewingReq, setViewingReq] = useState<ProcurementRequest | null>(null);

  // ----------------------------------------------------
  // FILTERING LOGIC FOR REQUESTS & PURCHASE ORDERS
  // ----------------------------------------------------
  const filteredRequests = useMemo(() => {
    return procurementRequests.filter((req) => {
      // Status filter
      let matchesStatus = true;
      if (statusFilter === 'draft') {
        matchesStatus = req.status === 'Draft';
      } else if (statusFilter === 'submitted') {
        matchesStatus = req.status === 'Pending' || req.status === 'Submitted';
      } else if (statusFilter === 'approval') {
        matchesStatus = req.status === 'Approved' || req.status === 'Converted to PO';
      } else if (statusFilter === 'rejected') {
        matchesStatus = req.status === 'Rejected';
      }

      // Priority filter
      let matchesPriority = true;
      const reqPriority = (req.priority || (req.urgency === 'Critical' ? 'Urgent' : req.urgency)).toLowerCase();
      if (priorityFilter !== 'all') {
        matchesPriority = reqPriority === priorityFilter;
      }

      // Search
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        req.id.toLowerCase().includes(term) ||
        req.title.toLowerCase().includes(term) ||
        req.department.toLowerCase().includes(term) ||
        req.requestedBy.toLowerCase().includes(term);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [procurementRequests, statusFilter, priorityFilter, searchTerm]);

  const filteredPOs = useMemo(() => {
    const list = isVendor 
      ? purchaseOrders.filter(po => po.vendorId === effectiveVendorId) 
      : purchaseOrders;

    return list.filter((po) => {
      // Status filter: all, draft, submitted, approval, rejected
      let matchesStatus = true;
      if (statusFilter === 'draft') {
        matchesStatus = po.status === 'Draft';
      } else if (statusFilter === 'submitted') {
        matchesStatus = po.status === 'Pending Vendor Acceptance' || po.status === 'Pending' || po.status === 'Ordered';
      } else if (statusFilter === 'approval') {
        matchesStatus = po.status === 'Approved' || po.status === 'Delivered' || po.status === 'Completed';
      } else if (statusFilter === 'rejected') {
        matchesStatus = po.status === 'Cancelled' || po.status === 'Delayed';
      }

      // Priority filter
      let matchesPriority = true;
      const poPrio = (po.priority || (po.urgency === 'Critical' ? 'Urgent' : 'Medium')).toLowerCase();
      if (priorityFilter !== 'all') {
        matchesPriority = poPrio === priorityFilter;
      }

      // Search
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        po.id.toLowerCase().includes(term) ||
        po.vendorName.toLowerCase().includes(term) ||
        (po.department && po.department.toLowerCase().includes(term)) ||
        po.status.toLowerCase().includes(term);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [purchaseOrders, isVendor, effectiveVendorId, statusFilter, priorityFilter, searchTerm]);

  const canApprove = currentRole === 'Administrator' || currentRole === 'Procurement Manager';

  const handleExportCSV = () => {
    if (activeTab === 'requests') {
      const rows = filteredRequests.map(r => ({
        RequestID: r.id,
        Description: r.title,
        Department: r.department,
        RequestedBy: r.requestedBy,
        Priority: r.priority || r.urgency,
        NeededBy: r.neededBy || r.requiredDate,
        Status: r.status,
        EstimatedBudget: `₹${r.estimatedBudget.toLocaleString('en-IN')}`,
      }));
      exportToCSV('Procurement_Requisitions', rows, {
        RequestID: 'Requisition ID',
        Description: 'Request Description',
        Department: 'Department',
        RequestedBy: 'Requested By',
        Priority: 'Priority',
        NeededBy: 'Needed By',
        Status: 'Status',
        EstimatedBudget: 'Budget (₹)',
      });
    } else {
      const rows = filteredPOs.map(po => ({
        PONumber: po.id,
        VendorName: po.vendorName,
        Category: po.vendorCategory,
        Department: po.department || 'Operations',
        TotalAmount: `₹${po.totalAmount.toLocaleString('en-IN')}`,
        ExpectedDelivery: po.expectedDeliveryDate,
        Priority: po.priority || 'Medium',
        Status: po.status,
      }));
      exportToCSV('Purchase_Orders', rows, {
        PONumber: 'PO Number',
        VendorName: 'Vendor Name',
        Category: 'Category',
        Department: 'Department',
        TotalAmount: 'Total Amount (₹)',
        ExpectedDelivery: 'Expected Delivery Date',
        Priority: 'Priority',
        Status: 'Status',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER & SEARCH / NEW ACTIONS                    */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-md shadow-sky-500/20">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white tracking-tight">Procurement & Orders Dashboard</h1>
                <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 border border-sky-500/20">
                  {procurementRequests.length} Requests • {purchaseOrders.length} POs
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Swap between departmental requisitions and purchase orders with automated vendor notification and acceptance controls.
              </p>
            </div>
          </div>
        </div>

        {/* Top Right Corner: Search, + Purchase Order, + New Request */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search request, PO, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700/80 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden md:inline">Export</span>
          </button>

          {/* Option for Purchase Order */}
          <button
            onClick={() => setIsPOCreateOpen(true)}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-3.5 py-2 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-md shadow-sky-600/30 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Purchase Order</span>
          </button>

          {/* Option for New Request */}
          <button
            onClick={() => setIsReqCreateOpen(true)}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3.5 py-2 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. TABS TO SWAP BETWEEN REQUESTS & PURCHASE ORDERS   */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Procurement Views (Swap Requests vs. Orders)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Active: {activeTab === 'requests' ? 'Requisition Requests' : activeTab === 'pos' ? 'Purchase Orders' : 'Invoices'}
          </span>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-1 ring-sky-400/50'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Requisition Requests</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'requests' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {procurementRequests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'pos'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-1 ring-sky-400/50'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Purchase Orders</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'pos' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {purchaseOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-1 ring-sky-400/50'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Invoices & AP</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              activeTab === 'invoices' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {invoices.length}
            </span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2 & 3. STATUS & PRIORITY FILTERS TOOLBAR             */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Status:</span>
          {(['all', 'draft', 'submitted', 'approval', 'rejected'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Priority Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Priority:</span>
          {(['all', 'low', 'medium', 'high', 'urgent'] as const).map(prio => (
            <button
              key={prio}
              onClick={() => setPriorityFilter(prio)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                priorityFilter === prio
                  ? prio === 'urgent' ? 'bg-rose-600 text-white' :
                    prio === 'high' ? 'bg-amber-600 text-white' :
                    prio === 'medium' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {prio}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. PROFESSIONAL TABULAR FORMAT                       */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'requests' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Request</th>
                  <th className="py-3.5 px-3">Department</th>
                  <th className="py-3.5 px-4">Requested By</th>
                  <th className="py-3.5 px-3">Priority</th>
                  <th className="py-3.5 px-4">Needed By</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-slate-600" />
                        <p className="font-semibold text-sm text-slate-300">No procurement requests matching your filters</p>
                        <p className="text-xs text-slate-500">Click "+ New Request" to create a departmental requisition.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const reqPrio = req.priority || (req.urgency === 'Critical' ? 'Urgent' : req.urgency);
                    return (
                      <tr 
                        key={req.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setViewingReq(req)}
                      >
                        {/* Request Title & ID */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white text-xs group-hover:text-sky-400 transition-colors">
                            {req.title}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {req.id} • Qty: {req.quantity || 1} • Budget: ₹{req.estimatedBudget.toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-3">
                          <span className="inline-block rounded-lg bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-200 border border-slate-800">
                            {req.department}
                          </span>
                        </td>

                        {/* Requested By */}
                        <td className="py-3.5 px-4">
                          <p className="text-slate-200 font-medium text-xs">{req.requestedBy}</p>
                          <span className="text-[10px] text-slate-500">Submitted {req.createdAt}</span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-3">
                          <Badge
                            variant={
                              reqPrio === 'Urgent' ? 'danger' :
                              reqPrio === 'High' ? 'warning' :
                              reqPrio === 'Medium' ? 'info' : 'neutral'
                            }
                            size="sm"
                          >
                            {reqPrio}
                          </Badge>
                        </td>

                        {/* Needed By */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-slate-300 text-xs">
                            {req.neededBy || req.requiredDate}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <Badge
                            variant={
                              req.status === 'Approved' ? 'success' :
                              req.status === 'Converted to PO' ? 'info' :
                              req.status === 'Pending' ? 'warning' :
                              req.status === 'Rejected' ? 'danger' : 'neutral'
                            }
                            size="sm"
                            dot={req.status === 'Approved'}
                          >
                            {req.status}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {canApprove && req.status === 'Pending' && (
                              <>
                                <button
                                  onClick={() => updateProcurementRequestStatus(req.id, 'Approved')}
                                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer shadow-sm"
                                  title="Approve Requisition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => updateProcurementRequestStatus(req.id, 'Rejected')}
                                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer"
                                  title="Reject Requisition"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setViewingReq(req)}
                              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 border border-slate-700 transition-colors cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. PURCHASE ORDERS TABULAR FORMAT                    */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'pos' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Order / PO #</th>
                  <th className="py-3.5 px-4">Assigned Vendor</th>
                  <th className="py-3.5 px-3">Department</th>
                  <th className="py-3.5 px-3">Priority</th>
                  <th className="py-3.5 px-4">Needed By</th>
                  <th className="py-3.5 px-3">Total (₹)</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-slate-600" />
                        <p className="font-semibold text-sm text-slate-300">No purchase orders matching your filters</p>
                        <p className="text-xs text-slate-500">Click "+ Purchase Order" to generate a new PO requisition.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const vendor = vendors.find(v => v.id === po.vendorId);
                    const isSubpar = vendor && (
                      vendor.riskLevel === 'High' || 
                      vendor.riskLevel === 'Critical' || 
                      vendor.metrics.defectRate > 2.0 || 
                      vendor.metrics.onTimeDeliveryRate < 80.0
                    );

                    return (
                      <tr 
                        key={po.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setViewingPO(po)}
                      >
                        {/* PO ID & Item Count */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white text-xs group-hover:text-sky-400 transition-colors font-mono">
                            {po.id}
                          </p>
                          <span className="text-[10px] text-slate-500">
                            {po.items.length} line item{po.items.length > 1 ? 's' : ''} • By {po.createdBy}
                          </span>
                        </td>

                        {/* Assigned Vendor & Category */}
                        <td className="py-3.5 px-4">
                          <p className="text-slate-200 font-bold text-xs">{po.vendorName}</p>
                          <span className="inline-block mt-0.5 rounded bg-slate-950 px-2 py-0.2 text-[10px] font-medium text-slate-400 border border-slate-800">
                            {po.vendorCategory}
                          </span>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-3">
                          <span className="text-slate-300 font-medium text-xs">
                            {po.department || 'Operations'}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-3">
                          <Badge
                            variant={
                              po.priority === 'Urgent' ? 'danger' :
                              po.priority === 'High' ? 'warning' :
                              po.priority === 'Medium' ? 'info' : 'neutral'
                            }
                            size="sm"
                          >
                            {po.priority || 'Medium'}
                          </Badge>
                        </td>

                        {/* Needed By / Expected Delivery */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-slate-300 text-xs">
                            {po.expectedDeliveryDate}
                          </span>
                          {po.deliveryDelayDays && po.deliveryDelayDays > 0 && (
                            <span className="block text-[10px] text-rose-400 font-mono">
                              +{po.deliveryDelayDays}d delay
                            </span>
                          )}
                        </td>

                        {/* Total in Rupees */}
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-white text-xs">
                            ₹{po.totalAmount.toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <Badge
                            variant={
                              po.status === 'Approved' || po.status === 'Delivered' || po.status === 'Completed' ? 'success' :
                              po.status === 'Pending Vendor Acceptance' ? 'warning' :
                              po.status === 'Delayed' ? 'danger' :
                              po.status === 'Cancelled' ? 'danger' : 'neutral'
                            }
                            size="sm"
                            dot={po.status === 'Approved'}
                          >
                            {po.status === 'Pending Vendor Acceptance' ? 'Awaiting Acceptance' : po.status}
                          </Badge>
                        </td>

                        {/* Actions: Vendor Acceptance & Sub-par Intervention */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Vendor Acceptance Action */}
                            {(isVendor || canApprove) && po.status === 'Pending Vendor Acceptance' && (
                              <button
                                onClick={() => acceptPurchaseOrderByVendor(po.id, 'Vendor confirmed requisition terms')}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer shadow-sm"
                                title="Vendor Approves & Confirms Order"
                              >
                                Accept Order
                              </button>
                            )}

                            {/* If Approved (Vendor Confirmed), Procurement Manager clicks Accept Order to Proceed */}
                            {!isVendor && po.status === 'Approved' && (
                              <button
                                onClick={() => updatePurchaseOrderStatus(po.id, 'Ordered', 'In Transit')}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                                title="Vendor confirmed order. Procurement Manager accepts order to proceed."
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Accept Order</span>
                              </button>
                            )}

                            {/* Procurement Delay/Cancel Intervention if metrics subpar */}
                            {canApprove && (po.status === 'Pending Vendor Acceptance' || po.status === 'Approved') && isSubpar && (
                              <>
                                <button
                                  onClick={() => setDelayModalPO(po)}
                                  className="rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/40 px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Delay Order due to sub-par vendor reliability"
                                >
                                  Delay
                                </button>
                                <button
                                  onClick={() => setCancelModalPO(po)}
                                  className="rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/40 px-2 py-1 text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Cancel Order due to sub-par vendor metrics"
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setViewingPO(po)}
                              className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 border border-slate-700 transition-colors cursor-pointer"
                            >
                              View PO
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. INVOICES TABULAR FORMAT (SUPPLEMENTARY)           */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'invoices' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Linked PO</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-3">Amount (₹)</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-3">Payment Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">{inv.id}</td>
                    <td className="py-3.5 px-4 font-mono text-sky-400">{inv.purchaseOrderId}</td>
                    <td className="py-3.5 px-4 text-slate-200">{inv.vendorName}</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-white">₹{inv.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">{inv.dueDate}</td>
                    <td className="py-3.5 px-3">
                      <Badge variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'danger' : 'warning'} size="sm">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inv.status !== 'Paid' && (
                        <button
                          onClick={() => payInvoice(inv.id)}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-bold text-white cursor-pointer shadow-sm"
                        >
                          Disburse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. SLIDING DRAWER / POPUP: CREATE PURCHASE ORDER     */}
      {/* ---------------------------------------------------- */}
      {isPOCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="fixed inset-y-0 right-0 max-w-full flex pl-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Create Purchase Order</h3>
                    <p className="text-xs text-slate-400">Generate PO and submit to supplier for acceptance</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPOCreateOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* Assign Vendor (with other vendors as options) */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Assign Vendor *
                  </label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category} • Reliability: {v.reliabilityScore}/100 • {v.tier})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Department
                    </label>
                    <select
                      value={poDepartment}
                      onChange={(e) => setPoDepartment(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="IT">IT</option>
                      <option value="Raw Materials">Raw Materials</option>
                      <option value="Equipment & Machinery">Equipment & Machinery</option>
                      <option value="Facility Maintenance">Facility Maintenance</option>
                      <option value="Logistics & Dispatch">Logistics & Dispatch</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={poPriority}
                      onChange={(e) => setPoPriority(e.target.value as any)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Expected Delivery Date & Payment Terms (Net 15 etc.) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Expected Delivery Date *
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Payment Terms *
                    </label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                      <option value="Due on Receipt">Due on Receipt</option>
                    </select>
                  </div>
                </div>

                {/* Line Items Table with Add List Item */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">
                      Purchase Order Line Items ({orderItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="rounded-lg bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border border-sky-500/30 px-3 py-1 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add List Item</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {orderItems.map((item, idx) => (
                      <div key={item.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400">Line #{idx + 1}</span>
                          {orderItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Item description or specification..."
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Quantity (qtn)</label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Unit Price (₹)</label>
                            <input
                              type="number"
                              min={1}
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Line Total (₹)</label>
                            <div className="w-full rounded-lg bg-slate-900/50 border border-slate-800/80 px-2.5 py-1 text-xs text-emerald-400 font-mono font-bold">
                              ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Expected Summary in Rupees */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Total Expected Order Value</span>
                      <span className="text-[10px] text-slate-500">Includes all line items & payment terms</span>
                    </div>
                    <span className="text-lg font-bold font-mono text-emerald-400">
                      ₹{itemsSubtotal.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Order Instructions / Justification
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Delivery instructions, batch specifications..."
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPOCreateOpen(false)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCreatePO('Draft')}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleCreatePO('Submitted')}
                  className="rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Create Order</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 6. SLIDING DRAWER / POPUP: NEW PROCUREMENT REQUEST   */}
      {/* ---------------------------------------------------- */}
      {isReqCreateOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="fixed inset-y-0 right-0 max-w-full flex pl-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">New Procurement Request</h3>
                    <p className="text-xs text-slate-400">Notifies vendors in selected department for approval</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsReqCreateOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                <form id="new-req-form" onSubmit={handleReqSubmit} className="space-y-3.5">
                  {/* Item or service description */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Item or Service Description *
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="e.g. Enterprise Cloud Computing Nodes & 10Gbps Managed Switchgear"
                      value={reqForm.itemDescription}
                      onChange={(e) => setReqForm({ ...reqForm, itemDescription: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Department (IT, raw materials, etc.) */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Department *
                    </label>
                    <select
                      value={reqForm.department}
                      onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="IT">IT</option>
                      <option value="Raw Materials">Raw Materials</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Logistics">Logistics</option>
                      <option value="Services">Services</option>
                    </select>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Department vendors will automatically receive immediate notification upon submission.
                    </span>
                  </div>

                  {/* Requested by */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Requested By *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Your name / employee handle"
                      value={reqForm.requestedBy}
                      onChange={(e) => setReqForm({ ...reqForm, requestedBy: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {/* Quantity & Needed by */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={reqForm.quantity}
                        onChange={(e) => setReqForm({ ...reqForm, quantity: Number(e.target.value) })}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Needed By *
                      </label>
                      <input
                        type="date"
                        required
                        value={reqForm.neededBy}
                        onChange={(e) => setReqForm({ ...reqForm, neededBy: e.target.value })}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Priority (low, medium, high, urgent) */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Priority *
                    </label>
                    <select
                      value={reqForm.priority}
                      onChange={(e) => setReqForm({ ...reqForm, priority: e.target.value as any })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Last Justification */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Justification *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Why is this requisition needed? Mention production deadline or system requirement..."
                      value={reqForm.justification}
                      onChange={(e) => setReqForm({ ...reqForm, justification: e.target.value })}
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReqCreateOpen(false)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="new-req-form"
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit for Approval</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 7. DELAY PURCHASE ORDER MODAL                        */}
      {/* ---------------------------------------------------- */}
      {delayModalPO && (
        <Modal
          isOpen={!!delayModalPO}
          onClose={() => setDelayModalPO(null)}
          title={`Intervention: Delay PO ${delayModalPO.id}`}
          subtitle={`Sub-par reliability metrics reported for ${delayModalPO.vendorName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Performance SLA Breach Action
              </span>
              <p className="text-[11px] text-amber-200/90 leading-tight">
                Procurement managers are authorized to delay orders for vendors failing to maintain agreed quality & delivery reliability thresholds.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Delay Reason & Remediation Requirement:
              </label>
              <textarea
                rows={3}
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDelayModalPO(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  delayPurchaseOrder(delayModalPO.id, delayReason, 7);
                  setDelayModalPO(null);
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm"
              >
                Confirm Delay Order
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- */}
      {/* 8. CANCEL PURCHASE ORDER MODAL                       */}
      {/* ---------------------------------------------------- */}
      {cancelModalPO && (
        <Modal
          isOpen={!!cancelModalPO}
          onClose={() => setCancelModalPO(null)}
          title={`Intervention: Cancel PO ${cancelModalPO.id}`}
          subtitle={`Severe metrics violation for ${cancelModalPO.vendorName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                Critical Reliability Penalty Cancellation
              </span>
              <p className="text-[11px] text-rose-200/90 leading-tight">
                Cancels order with audit logging and marks vendor ledger accordingly.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Cancellation Reason:
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setCancelModalPO(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-300"
              >
                Back
              </button>
              <button
                onClick={() => {
                  cancelPurchaseOrder(cancelModalPO.id, cancelReason);
                  setCancelModalPO(null);
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- */}
      {/* 9. VIEW PO DETAILS POPUP                             */}
      {/* ---------------------------------------------------- */}
      {viewingPO && (
        <Modal
          isOpen={!!viewingPO}
          onClose={() => setViewingPO(null)}
          title={`Purchase Order: ${viewingPO.id}`}
          subtitle={`Assigned Vendor: ${viewingPO.vendorName} (${viewingPO.vendorCategory})`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Amount</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  ₹{viewingPO.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Order Status</span>
                <Badge variant={viewingPO.status === 'Approved' ? 'success' : 'warning'} size="sm">
                  {viewingPO.status}
                </Badge>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Delivery Due</span>
                <span className="text-xs font-mono text-white">{viewingPO.expectedDeliveryDate}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Created By</span>
                <span className="text-xs text-white">{viewingPO.createdBy}</span>
              </div>
            </div>

            {/* Line items table */}
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5">Qty</th>
                    <th className="p-2.5">Unit Price (₹)</th>
                    <th className="p-2.5 text-right">Line Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {viewingPO.items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2.5 text-white">{it.description}</td>
                      <td className="p-2.5 font-mono">{it.quantity}</td>
                      <td className="p-2.5 font-mono">₹{it.unitPrice.toLocaleString('en-IN')}</td>
                      <td className="p-2.5 font-mono text-right text-emerald-400">₹{it.totalPrice.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {viewingPO.notes && (
              <p className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300">
                <strong>Notes:</strong> {viewingPO.notes}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewingPO(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs text-slate-300 font-semibold cursor-pointer"
              >
                Close
              </button>
              {viewingPO.status === 'Approved' && !isVendor && (
                <button
                  onClick={() => {
                    updatePurchaseOrderStatus(viewingPO.id, 'Ordered', 'In Transit');
                    setViewingPO(prev => prev ? { ...prev, status: 'Ordered', deliveryStatus: 'In Transit' } : null);
                  }}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs text-white font-bold cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Accept Order & Proceed</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------------- */}
      {/* 10. VIEW REQUISITION DETAILS POPUP                   */}
      {/* ---------------------------------------------------- */}
      {viewingReq && (
        <Modal
          isOpen={!!viewingReq}
          onClose={() => setViewingReq(null)}
          title={`Requisition: ${viewingReq.id}`}
          subtitle={`Department: ${viewingReq.department}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Requested By:</span>
                <span className="font-bold text-white">{viewingReq.requestedBy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Needed Date:</span>
                <span className="font-mono text-white">{viewingReq.neededBy || viewingReq.requiredDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Priority:</span>
                <Badge variant={viewingReq.urgency === 'Critical' ? 'danger' : 'info'} size="sm">
                  {viewingReq.priority || viewingReq.urgency}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Status:</span>
                <Badge variant={viewingReq.status === 'Approved' ? 'success' : 'warning'} size="sm">
                  {viewingReq.status}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-300 block">Item/Service Description:</span>
              <p className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                {viewingReq.title}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-300 block">Justification:</span>
              <p className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                {viewingReq.justification}
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setViewingReq(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs text-slate-300 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
