import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { VendorService, VendorModel } from '../../services/vendor.service';
import { PurchaseOrderService, PurchaseOrder, POItem } from '../../services/purchase-order.service';
import { AuthService } from '../../services/auth.service';

export interface VendorOrderSummary {
  total: number;
  pending: number;
  accepted: number;
  inTransit: number;
  delivered: number;
  rejected: number;
}

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './vendors.html',
  styleUrl: './vendors.css'
})
export class Vendors implements OnInit {
  allVendors: VendorModel[] = [];
  filteredVendors: VendorModel[] = [];
  pagedVendors: VendorModel[] = [];

  // Purchase Orders mapped strictly by vendor_id foreign key
  ordersByVendor: Map<number, PurchaseOrder[]> = new Map();
  allOrders: PurchaseOrder[] = [];

  // Expanded vendor sections for order inspection
  expandedVendorIds: Set<number> = new Set();

  // Official 6 categories
  categories: string[] = [
    'Raw Material Suppliers',
    'Equipment Vendors',
    'IT Vendors',
    'Service Providers',
    'Logistics Partners',
    'Maintenance Vendors'
  ];

  // PO status filter options
  poStatusOptions: string[] = [
    'All',
    'Pending Acceptance',
    'Accepted',
    'Dispatched',
    'In Transit',
    'Delivered',
    'Delivery Confirmed',
    'Rejected'
  ];

  Math = Math;
  isLoading = false;
  isLoadingOrders = false;
  errorMessage = '';

  // Filter States
  searchQuery = '';
  selectedCategory = 'All';
  selectedStatus = 'All';
  selectedRisk = 'All';
  selectedPOStatus = 'All';

  // Sorting
  sortBy: 'id' | 'name' | 'reliability' | 'quality' | 'orders' = 'reliability';
  sortAsc = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 20, 50];
  totalPages = 1;

  // Modals state
  selectedVendorForDetails: VendorModel | null = null;
  vendorDetailsLoading = false;
  vendorDetailsData: any = null;

  selectedPOForView: PurchaseOrder | null = null;

  selectedPOForAccept: PurchaseOrder | null = null;

  selectedPOForReject: PurchaseOrder | null = null;
  rejectionReason = '';

  selectedPOForDispatch: PurchaseOrder | null = null;
  dispatchForm = {
    carrier: 'DHL Express Freight',
    shipment_number: '',
    tracking_number: '',
    dispatch_date: '',
    expected_delivery_date: '',
    notes: 'Order dispatched in accordance with enterprise fulfillment SLA.'
  };

  selectedPOForTracking: PurchaseOrder | null = null;

  selectedPOForDeliveryUpdate: PurchaseOrder | null = null;
  deliveryUpdateForm = {
    carrier: '',
    tracking_number: '',
    expected_delivery_date: '',
    notes: ''
  };

  selectedPOForInvoice: PurchaseOrder | null = null;

  // Alerts
  actionNotification: { type: 'success' | 'danger' | 'info'; title?: string; message: string } | null = null;
  private notifTimer: any = null;
  isSubmitting = false;

  constructor(
    private vendorService: VendorService,
    private poService: PurchaseOrderService,
    public authService: AuthService
  ) {}

  get isVendor(): boolean {
    return this.authService.currentUserValue?.role === 'Vendor';
  }

  private lastUserId: number | null = null;
  private lastUserRole: string | null = null;

  ngOnInit(): void {
    const initUser = this.authService.currentUserValue;
    if (initUser) {
      this.lastUserId = initUser.id;
      this.lastUserRole = initUser.role;
    }
    this.loadData();
    // Re-load immediately if auth state or user role updates without requiring browser refresh
    this.authService.currentUser$.subscribe((u) => {
      if (u && (u.id !== this.lastUserId || u.role !== this.lastUserRole)) {
        this.lastUserId = u.id;
        this.lastUserRole = u.role;
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.isLoading = true;
    this.isLoadingOrders = true;
    this.errorMessage = '';

    // 1. Fetch all registered vendors and populate UI immediately
    this.vendorService.getVendors({}, true).subscribe({
      next: (vendors) => {
        this.allVendors = vendors || [];
        this.applyFiltersAndSorting();
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.detail || 'Failed to load vendors from API.';
      }
    });

    // 2. Fetch all purchase orders in parallel and map to vendors
    this.loadPurchaseOrders();
  }

  loadPurchaseOrders(): void {
    this.poService.getPurchaseOrders({}, true).subscribe({
      next: (orders) => {
        this.allOrders = orders || [];
        this.buildVendorOrderMap(this.allOrders);
        this.isLoadingOrders = false;
        this.applyFiltersAndSorting();
      },
      error: () => {
        this.isLoadingOrders = false;
        this.applyFiltersAndSorting();
      }
    });
  }

  buildVendorOrderMap(orders: PurchaseOrder[]): void {
    const map = new Map<number, PurchaseOrder[]>();
    for (const po of orders) {
      if (po.vendor_id) {
        const list = map.get(po.vendor_id) || [];
        list.push(po);
        map.set(po.vendor_id, list);
      }
    }
    this.ordersByVendor = map;
  }

  getOrdersForVendor(vendorId?: number): PurchaseOrder[] {
    if (!vendorId) return [];
    return this.ordersByVendor.get(vendorId) || [];
  }

  getVendorOrderSummary(vendorId?: number): VendorOrderSummary {
    const orders = this.getOrdersForVendor(vendorId);
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'Issued' || o.status === 'Draft' || o.status === 'Pending Acceptance').length,
      accepted: orders.filter(o => o.status === 'Accepted').length,
      inTransit: orders.filter(o => o.status === 'In Transit' || o.status === 'Dispatched').length,
      delivered: orders.filter(o => o.status === 'Delivered' || o.status === 'Completed' || o.status === 'Delivery Confirmed').length,
      rejected: orders.filter(o => o.status === 'Rejected').length
    };
  }

  // Expansion controls
  toggleVendorOrders(vendorId?: number): void {
    if (!vendorId) return;
    if (this.expandedVendorIds.has(vendorId)) {
      this.expandedVendorIds.delete(vendorId);
    } else {
      this.expandedVendorIds.add(vendorId);
    }
  }

  isVendorExpanded(vendorId?: number): boolean {
    if (!vendorId) return false;
    return this.expandedVendorIds.has(vendorId);
  }

  expandAll(): void {
    for (const v of this.filteredVendors) {
      if (v.id) this.expandedVendorIds.add(v.id);
    }
  }

  collapseAll(): void {
    this.expandedVendorIds.clear();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFiltersAndSorting();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedCategory = 'All';
    this.selectedStatus = 'All';
    this.selectedRisk = 'All';
    this.selectedPOStatus = 'All';
    this.currentPage = 1;
    this.applyFiltersAndSorting();
  }

  applyFiltersAndSorting(): void {
    let result = [...this.allVendors];

    // 1. Search Query (Vendor Name, Vendor ID, Category, Contact, PO Number)
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(v => {
        const matchesVendor =
          v.name?.toLowerCase().includes(q) ||
          v.company?.toLowerCase().includes(q) ||
          v.product?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          v.phone?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          String(v.id).includes(q) ||
          this.formatVendorId(v.id).toLowerCase().includes(q);

        if (matchesVendor) return true;

        // Check if any PO assigned to this vendor matches search query
        const vendorOrders = this.getOrdersForVendor(v.id);
        const hasMatchingPO = vendorOrders.some(po =>
          po.po_number?.toLowerCase().includes(q) ||
          po.items?.some(item => item.item_name?.toLowerCase().includes(q)) ||
          po.tracking_number?.toLowerCase().includes(q)
        );

        if (hasMatchingPO && v.id) {
          // Auto-expand this vendor so user immediately sees matching order
          this.expandedVendorIds.add(v.id);
          return true;
        }

        return false;
      });
    }

    // 2. Category filter
    if (this.selectedCategory !== 'All') {
      result = result.filter(v => this.matchCategory(v.category, this.selectedCategory));
    }

    // 3. Status filter
    if (this.selectedStatus !== 'All') {
      result = result.filter(v => {
        const stat = (v.status || '').toLowerCase();
        const sel = this.selectedStatus.toLowerCase();
        if (sel === 'approved' || sel === 'active') {
          return stat === 'approved' || stat === 'active';
        }
        return stat === sel;
      });
    }

    // 4. Risk filter
    if (this.selectedRisk !== 'All') {
      result = result.filter(v => (v.risk_level || 'Low').toLowerCase() === this.selectedRisk.toLowerCase());
    }

    // 5. PO Status filter
    if (this.selectedPOStatus !== 'All') {
      const targetPOStatus = this.selectedPOStatus.toLowerCase();
      result = result.filter(v => {
        const orders = this.getOrdersForVendor(v.id);
        return orders.some(o => {
          const normStatus = this.getPOStatusDisplay(o.status).toLowerCase();
          return normStatus === targetPOStatus;
        });
      });
    }

    // Sorting
    result.sort((a, b) => {
      let comp = 0;
      switch (this.sortBy) {
        case 'id':
          comp = (a.id || 0) - (b.id || 0);
          break;
        case 'name':
          comp = (a.company || a.name || '').localeCompare(b.company || b.name || '');
          break;
        case 'reliability':
          comp = (a.deliveryRate || 0) - (b.deliveryRate || 0);
          break;
        case 'quality':
          comp = (a.quality_rating || 0) - (b.quality_rating || 0);
          break;
        case 'orders': {
          const ordA = this.getOrdersForVendor(a.id).length;
          const ordB = this.getOrdersForVendor(b.id).length;
          comp = ordA - ordB;
          break;
        }
      }
      return this.sortAsc ? comp : -comp;
    });

    this.filteredVendors = result;
    this.totalPages = Math.max(1, Math.ceil(result.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    this.updatePagedVendors();
  }

  updatePagedVendors(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.pagedVendors = this.filteredVendors.slice(startIndex, startIndex + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagedVendors();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.totalPages = Math.max(1, Math.ceil(this.filteredVendors.length / this.pageSize));
    this.updatePagedVendors();
  }

  private matchCategory(vendorCat?: string, targetCat?: string): boolean {
    if (!targetCat || targetCat === 'All') return true;
    if (!vendorCat) return false;
    const vc = vendorCat.toLowerCase().trim();
    const tc = targetCat.toLowerCase().trim();
    if (vc === tc) return true;
    if (tc.includes('raw') && vc.includes('raw')) return true;
    if ((tc.includes('equipment') || tc.includes('machinery')) && (vc.includes('equipment') || vc.includes('machinery'))) return true;
    if (tc.includes('it') && (vc.includes('it') || vc.includes('electronic'))) return true;
    if (tc.includes('service') && (vc.includes('service') || vc.includes('maintenance'))) return true;
    if (tc.includes('logistics') && (vc.includes('logistics') || vc.includes('transport'))) return true;
    if (tc.includes('maintenance') && (vc.includes('maintenance') || vc.includes('service'))) return true;
    return false;
  }

  // PO Status normalization
  getPOStatusDisplay(status?: string): string {
    if (!status) return 'Pending Acceptance';
    const s = status.trim().toLowerCase();
    if (s === 'issued' || s === 'draft' || s === 'pending acceptance') return 'Pending Acceptance';
    if (s === 'completed') return 'Delivery Confirmed';
    if (s === 'in transit') return 'In Transit';
    return status;
  }

  getPOStatusBadgeClass(status?: string): string {
    const norm = this.getPOStatusDisplay(status);
    switch (norm) {
      case 'Pending Acceptance':
        return 'badge bg-warning text-dark border border-warning-subtle';
      case 'Accepted':
        return 'badge bg-info text-dark border border-info-subtle';
      case 'Dispatched':
        return 'badge bg-primary-subtle text-primary border border-primary';
      case 'In Transit':
        return 'badge bg-primary text-white';
      case 'Delivered':
        return 'badge bg-success-subtle text-success border border-success';
      case 'Delivery Confirmed':
        return 'badge bg-success text-white';
      case 'Rejected':
        return 'badge bg-danger text-white';
      case 'Cancelled':
        return 'badge bg-secondary text-white';
      default:
        return 'badge bg-light text-dark border';
    }
  }

  getStatusClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'active':
        return 'badge bg-success-subtle text-success border border-success';
      case 'pending':
        return 'badge bg-warning-subtle text-warning border border-warning';
      case 'rejected':
        return 'badge bg-danger-subtle text-danger border border-danger';
      default:
        return 'badge bg-secondary-subtle text-secondary';
    }
  }

  getRiskBadgeClass(risk?: string): string {
    switch (risk?.toLowerCase()) {
      case 'low': return 'bg-success-subtle text-success border border-success';
      case 'medium': return 'bg-warning-subtle text-warning border border-warning';
      case 'high': return 'bg-danger-subtle text-danger border border-danger';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  formatVendorId(id?: number): string {
    return id ? `VEN-${String(id).padStart(3, '0')}` : 'VEN-000';
  }

  // ==========================================
  // ORDER ACTIONS (STATUS DEPENDENT)
  // ==========================================

  // Date Parser Helper: safely parses any input format (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, ISO)
  parseSafeIso(dateStr?: string | null): string {
    if (!dateStr || !String(dateStr).trim()) {
      return new Date().toISOString();
    }
    const s = String(dateStr).trim();
    // 1. DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      const isoCandidate = `${year}-${month}-${day}T00:00:00.000Z`;
      const d = new Date(isoCandidate);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // 2. YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      const isoCandidate = `${year}-${month}-${day}T00:00:00.000Z`;
      const d = new Date(isoCandidate);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // 3. Native parse
    const p = new Date(s);
    if (!isNaN(p.getTime())) {
      return p.toISOString();
    }
    return new Date().toISOString();
  }

  // Step 7: Accept Order
  openAcceptModal(po: PurchaseOrder): void {
    this.selectedPOForAccept = po;
  }

  closeAcceptModal(): void {
    this.selectedPOForAccept = null;
  }

  confirmAcceptOrder(): void {
    if (!this.selectedPOForAccept?.id) return;
    const po = this.selectedPOForAccept;
    const poNumber = po.po_number;
    const poId = po.id!;

    // 1. Close form modal immediately
    this.closeAcceptModal();

    // 2. Optimistic local update (instant UI feedback)
    po.status = 'Accepted';
    const matched = this.allOrders.find(o => o.id === poId);
    if (matched) matched.status = 'Accepted';
    this.buildVendorOrderMap(this.allOrders);

    // 3. Immediately display complete message on top
    this.showNotification(
      'success',
      `Purchase Order ${poNumber} accepted successfully! SCM and procurement team have been notified.`,
      'Order Accepted'
    );

    // 4. Save to backend immediately
    this.isSubmitting = true;
    this.poService.acceptPO(poId).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.poService.getPurchaseOrders({}, true).subscribe({
          next: (orders) => {
            if (orders && orders.length > 0) {
              this.allOrders = orders;
              this.buildVendorOrderMap(this.allOrders);
            }
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Accept PO error:', err);
        this.showNotification('danger', err?.error?.detail || 'Failed to accept purchase order on server.', 'Accept Failed');
        this.loadPurchaseOrders();
      }
    });
  }

  // Step 8: Reject Order
  openRejectModal(po: PurchaseOrder): void {
    this.selectedPOForReject = po;
    this.rejectionReason = 'Insufficient inventory capacity to fulfill delivery timeframe.';
  }

  closeRejectModal(): void {
    this.selectedPOForReject = null;
    this.rejectionReason = '';
  }

  confirmRejectOrder(): void {
    if (!this.selectedPOForReject?.id) return;
    const po = this.selectedPOForReject;
    const poNumber = po.po_number;
    const poId = po.id!;
    const reason = (this.rejectionReason || 'Declined by vendor.').trim();

    if (!reason) {
      alert('Please provide a reason for rejection.');
      return;
    }

    // 1. Close form modal immediately
    this.closeRejectModal();

    // 2. Optimistic local update (instant UI feedback)
    po.status = 'Rejected';
    po.vendor_rejection_reason = reason;
    const matched = this.allOrders.find(o => o.id === poId);
    if (matched) {
      matched.status = 'Rejected';
      matched.vendor_rejection_reason = reason;
    }
    this.buildVendorOrderMap(this.allOrders);

    // 3. Immediately display complete message on top
    this.showNotification(
      'info',
      `Purchase Order ${poNumber} marked as Rejected. Reason: ${reason}`,
      'Order Rejected'
    );

    // 4. Save to backend immediately
    this.isSubmitting = true;
    this.poService.rejectPOWithReason(poId, reason).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.poService.getPurchaseOrders({}, true).subscribe({
          next: (orders) => {
            if (orders && orders.length > 0) {
              this.allOrders = orders;
              this.buildVendorOrderMap(this.allOrders);
            }
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Reject PO error:', err);
        this.showNotification('danger', err?.error?.detail || 'Failed to reject purchase order on server.', 'Reject Failed');
        this.loadPurchaseOrders();
      }
    });
  }

  // Step 9: Dispatch Order
  openDispatchModal(po: PurchaseOrder): void {
    this.selectedPOForDispatch = po;
    const now = new Date();
    const nowStr = now.toISOString().split('T')[0];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 5);
    const defaultExpStr = expDate.toISOString().split('T')[0];

    let poExpStr = defaultExpStr;
    if (po.expected_delivery_date) {
      try {
        const d = new Date(po.expected_delivery_date);
        if (!isNaN(d.getTime())) {
          poExpStr = d.toISOString().split('T')[0];
        }
      } catch (e) {}
    }

    this.dispatchForm = {
      carrier: po.carrier || 'DHL Express Freight',
      shipment_number: `SHIP-${Date.now().toString().slice(-6)}`,
      tracking_number: po.tracking_number || `TRK-${Date.now().toString().slice(-7)}`,
      dispatch_date: nowStr,
      expected_delivery_date: poExpStr,
      notes: po.notes || 'Order packaged in accordance with industrial safety and delivery standards.'
    };
  }

  closeDispatchModal(): void {
    this.selectedPOForDispatch = null;
  }

  confirmDispatch(): void {
    if (!this.selectedPOForDispatch?.id) return;
    const po = this.selectedPOForDispatch;
    const poNumber = po.po_number;
    const poId = po.id!;
    const trackingNum = (this.dispatchForm.tracking_number || '').trim();

    if (!trackingNum) {
      alert('Tracking number is required.');
      return;
    }

    const carrierName = this.dispatchForm.carrier || po.carrier || 'DHL Express Freight';
    const dispatchDateIso = this.parseSafeIso(this.dispatchForm.dispatch_date);
    const expectedDeliveryDateIso = this.parseSafeIso(this.dispatchForm.expected_delivery_date);
    const notes = this.dispatchForm.notes || 'Order packaged and dispatched.';

    const payload = {
      carrier: carrierName,
      tracking_number: trackingNum,
      dispatch_date: dispatchDateIso,
      expected_delivery_date: expectedDeliveryDateIso,
      notes: notes
    };

    // 1. Immediately close the modal form
    this.closeDispatchModal();

    // 2. Immediately update in-memory state (optimistic update)
    po.status = 'In Transit';
    po.carrier = carrierName;
    po.tracking_number = trackingNum;
    po.dispatch_date = dispatchDateIso;
    po.expected_delivery_date = expectedDeliveryDateIso;
    po.notes = notes;

    const matched = this.allOrders.find(o => o.id === poId);
    if (matched) {
      matched.status = 'In Transit';
      matched.carrier = carrierName;
      matched.tracking_number = trackingNum;
      matched.dispatch_date = dispatchDateIso;
      matched.expected_delivery_date = expectedDeliveryDateIso;
      matched.notes = notes;
    }
    this.buildVendorOrderMap(this.allOrders);

    // 3. Immediately display complete message on top
    this.showNotification(
      'success',
      `Order ${poNumber} marked as Dispatched & In Transit. Carrier: ${carrierName} | Tracking: ${trackingNum}`,
      'Shipment Dispatched Successfully'
    );

    // 4. Save to backend immediately
    this.isSubmitting = true;
    this.poService.dispatchPO(poId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        // Background cache refresh
        this.poService.getPurchaseOrders({}, true).subscribe({
          next: (orders) => {
            if (orders && orders.length > 0) {
              this.allOrders = orders;
              this.buildVendorOrderMap(this.allOrders);
            }
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Dispatch error:', err);
        this.showNotification('danger', err?.error?.detail || 'Failed to dispatch shipment on server.', 'Dispatch Failed');
        this.loadPurchaseOrders();
      }
    });
  }

  // Step 10: In Transit Tracking Modal
  openTrackingModal(po: PurchaseOrder): void {
    this.selectedPOForTracking = po;
  }

  closeTrackingModal(): void {
    this.selectedPOForTracking = null;
  }

  // Step 11: Delivery Action (Update Shipment/Delivery)
  openDeliveryUpdateModal(po: PurchaseOrder): void {
    this.selectedPOForDeliveryUpdate = po;
    let expStr = '';
    if (po.expected_delivery_date) {
      try {
        const d = new Date(po.expected_delivery_date);
        if (!isNaN(d.getTime())) {
          expStr = d.toISOString().split('T')[0];
        }
      } catch (e) {}
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      expStr = d.toISOString().split('T')[0];
    }

    this.deliveryUpdateForm = {
      carrier: po.carrier || 'DHL Express Freight',
      tracking_number: po.tracking_number || '',
      expected_delivery_date: expStr,
      notes: po.notes || 'In transit to central receiving warehouse'
    };
  }

  closeDeliveryUpdateModal(): void {
    this.selectedPOForDeliveryUpdate = null;
  }

  confirmDeliveryUpdate(): void {
    if (!this.selectedPOForDeliveryUpdate?.id) return;
    const po = this.selectedPOForDeliveryUpdate;
    const poNumber = po.po_number;
    const poId = po.id!;

    const carrierName = this.deliveryUpdateForm.carrier || po.carrier || 'DHL Express Freight';
    const trackingNum = (this.deliveryUpdateForm.tracking_number || po.tracking_number || '').trim();
    const expectedDeliveryDateIso = this.deliveryUpdateForm.expected_delivery_date
      ? this.parseSafeIso(this.deliveryUpdateForm.expected_delivery_date)
      : undefined;
    const notes = this.deliveryUpdateForm.notes || '';

    const payload = {
      carrier: carrierName,
      tracking_number: trackingNum,
      expected_delivery_date: expectedDeliveryDateIso,
      notes: notes
    };

    // 1. Immediately close the modal form
    this.closeDeliveryUpdateModal();

    // 2. Immediately update in-memory state (optimistic update)
    po.carrier = carrierName;
    po.tracking_number = trackingNum;
    if (expectedDeliveryDateIso) po.expected_delivery_date = expectedDeliveryDateIso;
    po.notes = notes;

    const matched = this.allOrders.find(o => o.id === poId);
    if (matched) {
      matched.carrier = carrierName;
      matched.tracking_number = trackingNum;
      if (expectedDeliveryDateIso) matched.expected_delivery_date = expectedDeliveryDateIso;
      matched.notes = notes;
    }
    this.buildVendorOrderMap(this.allOrders);

    // 3. Immediately display complete message on top
    this.showNotification(
      'success',
      `Delivery updates saved immediately for Purchase Order ${poNumber}. Carrier: ${carrierName} | Tracking: ${trackingNum || 'N/A'}`,
      'Delivery Updates Saved'
    );

    // 4. Save to backend immediately
    this.isSubmitting = true;
    this.poService.updateDelivery(poId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.poService.getPurchaseOrders({}, true).subscribe({
          next: (orders) => {
            if (orders && orders.length > 0) {
              this.allOrders = orders;
              this.buildVendorOrderMap(this.allOrders);
            }
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Update delivery error:', err);
        this.showNotification('danger', err?.error?.detail || 'Failed to update delivery details on server.', 'Update Failed');
        this.loadPurchaseOrders();
      }
    });
  }

  // View PO Details Modal
  openPODetailsModal(po: PurchaseOrder): void {
    this.selectedPOForView = po;
  }

  closePODetailsModal(): void {
    this.selectedPOForView = null;
  }

  // Step 14: Vendor Details Modal
  openVendorDetailsModal(vendor: VendorModel): void {
    this.selectedVendorForDetails = vendor;
    this.vendorDetailsLoading = true;
    this.vendorDetailsData = null;

    if (vendor.id) {
      this.vendorService.getVendor(vendor.id).subscribe({
        next: (data) => {
          this.vendorDetailsData = data;
          this.vendorDetailsLoading = false;
        },
        error: () => {
          this.vendorDetailsData = vendor;
          this.vendorDetailsLoading = false;
        }
      });
    } else {
      this.vendorDetailsData = vendor;
      this.vendorDetailsLoading = false;
    }
  }

  closeVendorDetailsModal(): void {
    this.selectedVendorForDetails = null;
    this.vendorDetailsData = null;
  }

  // Step 13 Invoice View Modal
  openInvoiceModal(po: PurchaseOrder): void {
    this.selectedPOForInvoice = po;
  }

  closeInvoiceModal(): void {
    this.selectedPOForInvoice = null;
  }

  showNotification(type: 'success' | 'danger' | 'info', message: string, title?: string): void {
    if (this.notifTimer) {
      clearTimeout(this.notifTimer);
    }
    this.actionNotification = {
      type,
      title: title || (type === 'success' ? 'Action Completed Successfully' : type === 'danger' ? 'Notice' : 'Information'),
      message
    };
    try {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {}

    this.notifTimer = setTimeout(() => {
      this.actionNotification = null;
    }, 6000);
  }

  get pagesArray(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - 2);
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Global counts for page header
  get totalActiveOrdersCount(): number {
    return this.allOrders.filter(o => o.status === 'In Transit' || o.status === 'Accepted' || o.status === 'Dispatched').length;
  }

  get totalPendingAcceptanceCount(): number {
    return this.allOrders.filter(o => o.status === 'Issued' || o.status === 'Draft' || o.status === 'Pending Acceptance').length;
  }

  get totalDeliveredCount(): number {
    return this.allOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed' || o.status === 'Delivery Confirmed').length;
  }
}
