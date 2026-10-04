import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PurchaseOrderService, PurchaseOrder } from '../../../services/purchase-order.service';
import { VendorService, VendorModel } from '../../../services/vendor.service';
import { AuthService, User } from '../../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../../services/api.config';

import { AppChartComponent } from '../../../components/charts/app-chart.component';
import { ReliabilityTrendChartComponent } from '../../../components/charts/reliability-trend-chart.component';
import { DashboardService } from '../../../services/dashboard.service';
import { CHART_COLORS, STATUS_COLORS } from '../../../components/charts/chart-theme';

export interface VendorSummaryStats {
  total: number;
  pending: number;
  accepted: number;
  inTransit: number;
  delivered: number;
  rejected: number;
}

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgIf,
    NgFor,
    NgClass,
    DecimalPipe,
    DatePipe,
    AppChartComponent,
    ReliabilityTrendChartComponent
  ],
  templateUrl: './vendor-dashboard.html',
  styleUrl: './vendor-dashboard.css'
})
export class VendorDashboard implements OnInit {
  currentUser: User | null = null;
  myPurchaseOrders: PurchaseOrder[] = [];
  allVendors: VendorModel[] = [];
  filteredVendors: VendorModel[] = [];
  ordersByVendor: Map<number, PurchaseOrder[]> = new Map();
  expandedVendorIds: Set<number> = new Set();

  vendorProfile: any = null;
  vendorSummary: any = null;
  isLoadingSummary = true;

  // Search & Filter state
  searchQuery = '';
  selectedCategory = 'All';
  selectedPOStatus = 'All';

  categories = [
    'Raw Material Suppliers',
    'Equipment Vendors',
    'IT Vendors',
    'Service Providers',
    'Logistics Partners',
    'Maintenance Vendors'
  ];

  poStatusOptions = [
    'All',
    'Pending Acceptance',
    'Accepted',
    'Dispatched',
    'In Transit',
    'Delivered',
    'Delivery Confirmed',
    'Rejected'
  ];

  // Chart Data & Options
  vendorPerformanceChartData: any = null;
  vendorPerformanceChartOptions: any = null;
  contractStatusChartData: any = null;
  contractStatusChartOptions: any = null;
  orderHistoryChartData: any = null;
  orderHistoryChartOptions: any = null;
  deliveryPerformanceChartData: any = null;
  deliveryPerformanceChartOptions: any = null;
  commActivityChartData: any = null;
  commActivityChartOptions: any = null;

  // Modals state
  selectedPOForDecision: PurchaseOrder | null = null;
  selectedPOForAccept: PurchaseOrder | null = null;
  showRejectModal = false;
  rejectionReason = 'Insufficient inventory capacity to fulfill required delivery timeframe.';

  selectedPOForDispatch: PurchaseOrder | null = null;
  showDispatchModal = false;
  dispatchForm = {
    carrier: 'DHL Express Freight',
    shipment_number: '',
    tracking_number: '',
    dispatch_date: '',
    expected_delivery_date: '',
    notes: 'Order dispatched from warehouse loading bay 2.'
  };

  selectedPOForTracking: PurchaseOrder | null = null;
  selectedPOForDeliveryUpdate: PurchaseOrder | null = null;
  deliveryUpdateForm = {
    carrier: '',
    tracking_number: '',
    expected_delivery_date: '',
    notes: ''
  };

  selectedPOForView: PurchaseOrder | null = null;
  selectedVendorForDetails: any = null;
  selectedPOForInvoice: PurchaseOrder | null = null;

  actionMessage = '';
  isLoading = true;
  isSubmitting = false;

  constructor(
    private poService: PurchaseOrderService,
    private vendorService: VendorService,
    private authService: AuthService,
    private dashService: DashboardService,
    private http: HttpClient
  ) {}

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('section-highlight');
      setTimeout(() => el.classList.remove('section-highlight'), 2500);
    }
  }

  private lastUserId: number | null = null;
  private lastUserRole: string | null = null;

  ngOnInit(): void {
    const initUser = this.authService.currentUserValue;
    if (initUser) {
      this.lastUserId = initUser.id;
      this.lastUserRole = initUser.role;
    }
    this.currentUser = initUser;
    this.isLoadingSummary = false;
    this.buildVendorCharts({}); // Render charts immediately on frame 1
    this.loadData();

    // Re-load immediately if auth state or user changes without requiring browser refresh
    this.authService.currentUser$.subscribe((u) => {
      if (u && (u.id !== this.lastUserId || u.role !== this.lastUserRole)) {
        this.lastUserId = u.id;
        this.lastUserRole = u.role;
        this.currentUser = u;
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.isLoading = true;

    // 1. Fetch All Registered Vendors - populate and render immediately
    this.vendorService.getVendors({}, true).subscribe({
      next: (vendors) => {
        this.allVendors = vendors || [];
        this.applyVendorFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    // 2. Load All Purchase Orders in parallel (mapped strictly by vendor_id)
    this.poService.getPurchaseOrders({}, true).subscribe({
      next: (pos) => {
        this.myPurchaseOrders = pos || [];
        this.buildVendorOrderMap(this.myPurchaseOrders);
        this.applyVendorFilters();
      },
      error: () => {
        this.applyVendorFilters();
      }
    });

    // 3. Load Vendor Profile
    this.http.get<any>(`${API_CONFIG.baseUrl}/vendors/my-profile`).subscribe({
      next: (p) => this.vendorProfile = p,
      error: () => {}
    });

    // 4. Load Vendor Analytics & Charts (force fresh retrieval)
    this.loadVendorAnalytics();
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

  getVendorOrderSummary(vendorId?: number): VendorSummaryStats {
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

  applyVendorFilters(): void {
    let result = [...this.allVendors];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(v => {
        const matchesV =
          v.name?.toLowerCase().includes(q) ||
          v.company?.toLowerCase().includes(q) ||
          v.product?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          String(v.id).includes(q);

        if (matchesV) return true;

        const orders = this.getOrdersForVendor(v.id);
        const hasPO = orders.some(o => o.po_number?.toLowerCase().includes(q) || o.tracking_number?.toLowerCase().includes(q));
        if (hasPO && v.id) {
          this.expandedVendorIds.add(v.id);
          return true;
        }
        return false;
      });
    }

    if (this.selectedCategory !== 'All') {
      const cat = this.selectedCategory.toLowerCase();
      result = result.filter(v => (v.category || '').toLowerCase().includes(cat.slice(0, 4)));
    }

    if (this.selectedPOStatus !== 'All') {
      const target = this.selectedPOStatus.toLowerCase();
      result = result.filter(v => {
        const orders = this.getOrdersForVendor(v.id);
        return orders.some(o => this.getPOStatusDisplay(o.status).toLowerCase() === target);
      });
    }

    this.filteredVendors = result;
  }

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

  formatVendorId(id?: number): string {
    return id ? `VEN-${String(id).padStart(3, '0')}` : 'VEN-000';
  }

  loadVendorAnalytics(): void {
    this.isLoadingSummary = true;
    this.dashService.getVendorSummary(undefined, true).subscribe({
      next: (summary) => {
        this.vendorSummary = summary;
        this.isLoadingSummary = false;
        this.buildVendorCharts(summary);
      },
      error: (err) => {
        console.error('Failed to load vendor summary', err);
        this.isLoadingSummary = false;
      }
    });
  }

  buildVendorCharts(summary: any): void {
    if (!summary) summary = {};

    // A. Vendor Performance (Bar chart)
    const perfCats = summary.vendor_performance?.categories || ['Delivery', 'Quality', 'Communication', 'Compliance'];
    const perfScores = summary.vendor_performance?.scores || [92, 85, 80, 95];
    const benchScores = summary.vendor_performance?.benchmark_average || [88, 85, 86, 90];

    this.vendorPerformanceChartData = {
      labels: perfCats,
      datasets: [
        {
          label: summary.vendor_info?.name || 'My Performance',
          data: perfScores,
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'Industry Benchmark',
          data: benchScores,
          backgroundColor: '#94a3b8',
          borderRadius: 4
        }
      ]
    };
    this.vendorPerformanceChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true } },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          suggestedMin: 50,
          max: 100,
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Score (%)' }
        }
      }
    };

    // C. Contract Status (Donut)
    const contractLabels = summary.contract_status?.labels || ['Active', 'Expiring Soon', 'Under Renewal', 'Expired'];
    const contractCounts = summary.contract_status?.counts || [28, 9, 12, 5];
    this.contractStatusChartData = {
      labels: contractLabels,
      datasets: [
        {
          data: contractCounts,
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.delayed, CHART_COLORS.warning, CHART_COLORS.danger],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.contractStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // D. Order History (Combo Bar + Line)
    const orderMonths = summary.order_history?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const orderVals = summary.order_history?.order_value || [20, 28, 32, 40, 48, 55];
    const orderCnts = summary.order_history?.order_counts || [12, 16, 18, 22, 24, 28];

    this.orderHistoryChartData = {
      labels: orderMonths,
      datasets: [
        {
          type: 'bar',
          label: 'Order Value (₹ Lakh)',
          data: orderVals,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Number of Orders',
          data: orderCnts,
          borderColor: '#0284c7',
          backgroundColor: '#0284c7',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0284c7',
          yAxisID: 'y1'
        }
      ]
    };
    this.orderHistoryChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true } },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Order Value (₹ Lakh)' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Number of Orders' }
        }
      }
    };

    // E. Delivery Performance (Donut)
    const delivOnTime = summary.delivery_performance?.on_time || 45;
    const delivDelayed = summary.delivery_performance?.delayed || 4;
    const delivCancelled = summary.delivery_performance?.cancelled || 1;
    this.deliveryPerformanceChartData = {
      labels: ['On-Time Deliveries', 'Delayed Deliveries', 'Cancelled Orders'],
      datasets: [
        {
          data: [delivOnTime, delivDelayed, delivCancelled],
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.delayed, CHART_COLORS.danger],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.deliveryPerformanceChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // F. Communication Activity (Donut)
    const commLabels = summary.communication_activity?.labels || ['Emails', 'Calls', 'Meetings', 'Portal Messages', 'Support Tickets'];
    const commCounts = summary.communication_activity?.counts || [85, 42, 28, 65, 19];
    this.commActivityChartData = {
      labels: commLabels,
      datasets: [
        {
          data: commCounts,
          backgroundColor: ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.commActivityChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };
  }

  // ==========================================
  // ORDER ACTIONS
  // ==========================================

  openAcceptModal(po: PurchaseOrder): void {
    this.selectedPOForAccept = po;
  }

  parseSafeIso(dateStr?: string | null): string {
    if (!dateStr || !String(dateStr).trim()) {
      return new Date().toISOString();
    }
    const s = String(dateStr).trim();
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const p = new Date(s);
    if (!isNaN(p.getTime())) return p.toISOString();
    return new Date().toISOString();
  }

  closeAcceptModal(): void {
    this.selectedPOForAccept = null;
  }

  confirmAcceptOrder(): void {
    if (!this.selectedPOForAccept?.id) return;
    const po = this.selectedPOForAccept;
    const poId = po.id!;

    // 1. Close immediately
    this.closeAcceptModal();

    // 2. Optimistic update
    po.status = 'Accepted';
    const match = this.myPurchaseOrders.find(o => o.id === poId);
    if (match) match.status = 'Accepted';

    this.actionMessage = `Purchase Order ${po.po_number} accepted successfully.`;

    // 3. Save to backend immediately
    this.isSubmitting = true;
    this.poService.acceptPO(poId).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.loadData();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(err.error?.detail || 'Failed to accept order.');
        this.loadData();
      }
    });
  }

  openRejectModal(po: PurchaseOrder): void {
    this.selectedPOForDecision = po;
    this.rejectionReason = 'Insufficient inventory capacity to fulfill required delivery timeframe.';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.selectedPOForDecision = null;
  }

  confirmRejectOrder(): void {
    if (!this.selectedPOForDecision?.id || !this.rejectionReason.trim()) return;
    const po = this.selectedPOForDecision;
    const poId = po.id!;
    const reason = this.rejectionReason.trim();

    // 1. Close immediately
    this.closeRejectModal();

    // 2. Optimistic update
    po.status = 'Rejected';
    po.vendor_rejection_reason = reason;
    const match = this.myPurchaseOrders.find(o => o.id === poId);
    if (match) {
      match.status = 'Rejected';
      match.vendor_rejection_reason = reason;
    }

    this.actionMessage = `Purchase Order ${po.po_number} rejected successfully.`;

    // 3. Save to backend immediately
    this.isSubmitting = true;
    this.poService.rejectPOWithReason(poId, reason).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.loadData();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(err.error?.detail || 'Failed to reject order.');
        this.loadData();
      }
    });
  }

  openDispatchModal(po: PurchaseOrder): void {
    this.selectedPOForDispatch = po;
    const nowStr = new Date().toISOString().split('T')[0];
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 5);

    this.dispatchForm = {
      carrier: po.carrier || 'DHL Express Freight',
      shipment_number: `SHIP-${Date.now().toString().slice(-6)}`,
      tracking_number: po.tracking_number || `DHL-${Date.now().toString().slice(-7)}`,
      dispatch_date: nowStr,
      expected_delivery_date: po.expected_delivery_date
        ? new Date(po.expected_delivery_date).toISOString().split('T')[0]
        : expDate.toISOString().split('T')[0],
      notes: 'Order packaged in accordance with industrial standards. Waybill attached.'
    };
    this.showDispatchModal = true;
  }

  closeDispatchModal(): void {
    this.showDispatchModal = false;
    this.selectedPOForDispatch = null;
  }

  confirmDispatch(): void {
    if (!this.selectedPOForDispatch?.id || !this.dispatchForm.tracking_number.trim()) {
      alert('Carrier and tracking number are required.');
      return;
    }

    const po = this.selectedPOForDispatch;
    const poId = po.id!;
    const carrier = this.dispatchForm.carrier || 'DHL Express Freight';
    const tracking = this.dispatchForm.tracking_number.trim();
    const dispatchDateIso = this.parseSafeIso(this.dispatchForm.dispatch_date);
    const expectedDeliveryDateIso = this.parseSafeIso(this.dispatchForm.expected_delivery_date);
    const notes = this.dispatchForm.notes;

    const payload = {
      carrier,
      tracking_number: tracking,
      dispatch_date: dispatchDateIso,
      expected_delivery_date: expectedDeliveryDateIso,
      notes
    };

    // 1. Close form immediately
    this.closeDispatchModal();

    // 2. Optimistic update
    po.status = 'In Transit';
    po.carrier = carrier;
    po.tracking_number = tracking;
    po.dispatch_date = dispatchDateIso;
    po.expected_delivery_date = expectedDeliveryDateIso;
    po.notes = notes;

    const match = this.myPurchaseOrders.find(o => o.id === poId);
    if (match) {
      match.status = 'In Transit';
      match.carrier = carrier;
      match.tracking_number = tracking;
      match.dispatch_date = dispatchDateIso;
      match.expected_delivery_date = expectedDeliveryDateIso;
      match.notes = notes;
    }

    this.actionMessage = `Purchase Order ${po.po_number} marked as Dispatched & In Transit. Carrier: ${carrier} (Tracking: ${tracking})`;

    // 3. Save to backend immediately
    this.isSubmitting = true;
    this.poService.dispatchPO(poId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.loadData();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(err.error?.detail || 'Failed to dispatch shipment.');
        this.loadData();
      }
    });
  }

  openTrackingModal(po: PurchaseOrder): void {
    this.selectedPOForTracking = po;
  }

  closeTrackingModal(): void {
    this.selectedPOForTracking = null;
  }

  openDeliveryUpdateModal(po: PurchaseOrder): void {
    this.selectedPOForDeliveryUpdate = po;
    this.deliveryUpdateForm = {
      carrier: po.carrier || 'DHL Express Freight',
      tracking_number: po.tracking_number || '',
      expected_delivery_date: po.expected_delivery_date
        ? new Date(po.expected_delivery_date).toISOString().split('T')[0]
        : '',
      notes: po.notes || ''
    };
  }

  closeDeliveryUpdateModal(): void {
    this.selectedPOForDeliveryUpdate = null;
  }

  confirmDeliveryUpdate(): void {
    if (!this.selectedPOForDeliveryUpdate?.id) return;
    const po = this.selectedPOForDeliveryUpdate;
    const poId = po.id!;
    const carrier = this.deliveryUpdateForm.carrier || po.carrier || 'DHL Express Freight';
    const tracking = this.deliveryUpdateForm.tracking_number || po.tracking_number || '';
    const expectedDeliveryDateIso = this.deliveryUpdateForm.expected_delivery_date
      ? this.parseSafeIso(this.deliveryUpdateForm.expected_delivery_date)
      : undefined;
    const notes = this.deliveryUpdateForm.notes;

    const payload = {
      carrier,
      tracking_number: tracking,
      expected_delivery_date: expectedDeliveryDateIso,
      notes
    };

    // 1. Close form immediately
    this.closeDeliveryUpdateModal();

    // 2. Optimistic update
    po.carrier = carrier;
    po.tracking_number = tracking;
    if (expectedDeliveryDateIso) po.expected_delivery_date = expectedDeliveryDateIso;
    po.notes = notes;

    const match = this.myPurchaseOrders.find(o => o.id === poId);
    if (match) {
      match.carrier = carrier;
      match.tracking_number = tracking;
      if (expectedDeliveryDateIso) match.expected_delivery_date = expectedDeliveryDateIso;
      match.notes = notes;
    }

    this.actionMessage = `Delivery information updated for PO ${po.po_number}.`;

    // 3. Save to backend immediately
    this.isSubmitting = true;
    this.poService.updateDelivery(poId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.loadData();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(err.error?.detail || 'Failed to update delivery details.');
        this.loadData();
      }
    });
  }

  openPODetailsModal(po: PurchaseOrder): void {
    this.selectedPOForView = po;
  }

  closePODetailsModal(): void {
    this.selectedPOForView = null;
  }

  openVendorDetailsModal(vendor: VendorModel): void {
    this.selectedVendorForDetails = vendor;
  }

  closeVendorDetailsModal(): void {
    this.selectedVendorForDetails = null;
  }

  openInvoiceModal(po: PurchaseOrder): void {
    this.selectedPOForInvoice = po;
  }

  closeInvoiceModal(): void {
    this.selectedPOForInvoice = null;
  }

  getPendingAcceptanceCount(): number {
    return this.myPurchaseOrders.filter(p => p.status === 'Issued' || p.status === 'Draft' || p.status === 'Pending Acceptance').length;
  }

  getInTransitCount(): number {
    return this.myPurchaseOrders.filter(p => p.status === 'In Transit' || p.status === 'Accepted' || p.status === 'Dispatched').length;
  }

  getCompletedOrdersCount(): number {
    return this.myPurchaseOrders.filter(p => p.status === 'Delivered' || p.status === 'Completed' || p.status === 'Delivery Confirmed').length;
  }
}
