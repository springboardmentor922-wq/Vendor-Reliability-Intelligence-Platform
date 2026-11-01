import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseOrderService, PurchaseOrder } from '../../../services/purchase-order.service';
import { DeliveryService, DeliveryRecord, RecordDeliveryPayload } from '../../../services/delivery.service';
import { VendorService, VendorModel } from '../../../services/vendor.service';
import { AuthService, User } from '../../../services/auth.service';
import { DashboardService } from '../../../services/dashboard.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../../services/api.config';
import { AppChartComponent } from '../../../components/charts/app-chart.component';
import { CHART_COLORS, STATUS_COLORS, CATEGORY_PALETTE } from '../../../components/charts/chart-theme';

export interface ReadyForPOItem {
  requisition_id: number;
  request_number: string;
  department: string;
  title: string;
  quantity: number;
  priority: string;
  vendor_id: number;
  vendor_name: string;
  vendor_company?: string;
  vendor?: any;
  quotation_amount: number;
  budget_allocated: number;
  approval_date: string;
}

@Component({
  selector: 'app-supply-chain-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    NgClass,
    DecimalPipe,
    DatePipe,
    AppChartComponent
  ],
  templateUrl: './supply-chain-dashboard.html',
  styleUrl: './supply-chain-dashboard.css'
})
export class SupplyChainDashboard implements OnInit {
  currentUser: User | null = null;
  readyForPOList: ReadyForPOItem[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  deliveries: DeliveryRecord[] = [];
  vendors: VendorModel[] = [];

  // Summary Analytics
  supplyChainSummary: any = null;
  isLoadingSummary = true;

  // Chart datasets & options
  poStatusChartData: any = null;
  poStatusChartOptions: any = null;
  deliveryStatusChartData: any = null;
  deliveryStatusChartOptions: any = null;
  monthlyDeliveryChartData: any = null;
  monthlyDeliveryChartOptions: any = null;
  avgDeliveryTimeChartData: any = null;
  avgDeliveryTimeChartOptions: any = null;
  delayedDeliveriesChartData: any = null;
  delayedDeliveriesChartOptions: any = null;
  ordersByCategoryChartData: any = null;
  ordersByCategoryChartOptions: any = null;

  // Modals
  selectedPRForPO: ReadyForPOItem | null = null;
  showCreatePOModal = false;
  poForm = {
    expected_delivery_date: '',
    shipping_address: 'Central Logistics Terminal, Dock 4, Chicago, IL',
    terms_and_conditions: 'Standard Enterprise Terms (Net 30 Days). Strict SLA compliance enforced.'
  };

  selectedPOForDelivery: PurchaseOrder | null = null;
  showDeliveryModal = false;
  deliveryForm: RecordDeliveryPayload = {
    purchase_order_id: 0,
    expected_delivery_date: '',
    actual_delivery_date: '',
    ordered_quantity: 1,
    delivered_quantity: 1,
    carrier: 'DHL Express Freight',
    tracking_number: '',
    notes: 'Inspected at dock. Quantity verified against packing slip.'
  };

  actionMessage = '';
  isLoading = true;
  isSubmitting = false;
  private actionTimer: any = null;

  setActionMessage(msg: string): void {
    this.actionMessage = msg;
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.actionTimer = setTimeout(() => {
      this.actionMessage = '';
    }, 10000);
  }

  constructor(
    private poService: PurchaseOrderService,
    private deliveryService: DeliveryService,
    private vendorService: VendorService,
    private authService: AuthService,
    private dashService: DashboardService,
    private http: HttpClient,
    private router: Router
  ) {}

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('section-highlight');
      setTimeout(() => el.classList.remove('section-highlight'), 2500);
    }
  }

  navigateTo(path: string): void {
    this.router.navigateByUrl(path);
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
    this.buildSupplyChainCharts({}); // Render charts immediately on frame 1
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

  loadData(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }

    // 1. Requisitions Ready for PO Creation (Financially Approved)
    this.http.get<ReadyForPOItem[]>(`${API_CONFIG.baseUrl}/purchase-orders/ready-for-po`).subscribe({
      next: (items) => this.readyForPOList = items,
      error: () => { if (!silent) this.readyForPOList = []; }
    });

    // 2. Purchase Orders
    this.poService.getPurchaseOrders({}, true).subscribe({
      next: (pos) => {
        this.purchaseOrders = pos;
        if (!silent) this.isLoading = false;
      },
      error: () => { if (!silent) this.isLoading = false; }
    });

    // 3. Deliveries
    this.deliveryService.getDeliveries().subscribe({
      next: (delivs) => this.deliveries = delivs,
      error: () => { if (!silent) this.deliveries = []; }
    });

    // 4. Vendors
    this.vendorService.getVendors({}, true).subscribe({
      next: (v) => this.vendors = v,
      error: () => { if (!silent) this.vendors = []; }
    });

    // 5. Supply Chain Analytics Summary
    this.loadSupplyChainAnalytics(silent);
  }

  loadSupplyChainAnalytics(silent = false): void {
    this.dashService.getSupplyChainSummary(true).subscribe({
      next: (summary) => {
        this.supplyChainSummary = summary;
        this.isLoadingSummary = false;
        this.buildSupplyChainCharts(summary);
      },
      error: (err) => {
        console.error('Failed to load supply chain summary', err);
        this.isLoadingSummary = false;
      }
    });
  }

  buildSupplyChainCharts(summary: any): void {
    if (!summary) summary = {};

    // A. Purchase Order Status (Donut)
    const poLabels = summary.purchase_order_status?.labels || ['Draft', 'Issued', 'In Transit', 'Delivered', 'Completed'];
    const poCounts = summary.purchase_order_status?.counts || [4, 8, 12, 18, 25];
    this.poStatusChartData = {
      labels: poLabels,
      datasets: [
        {
          data: poCounts,
          backgroundColor: [
            CHART_COLORS.slate,
            CHART_COLORS.sky,
            CHART_COLORS.blue,
            CHART_COLORS.teal,
            CHART_COLORS.emerald
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
    this.poStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // B. Delivery Status (Donut)
    const delivLabels = summary.delivery_status?.labels || ['Delivered', 'In Transit', 'Delayed', 'Cancelled'];
    const delivCounts = summary.delivery_status?.counts || [32, 10, 3, 1];
    this.deliveryStatusChartData = {
      labels: delivLabels,
      datasets: [
        {
          data: delivCounts,
          backgroundColor: [
            STATUS_COLORS.success,
            STATUS_COLORS.info,
            STATUS_COLORS.critical,
            CHART_COLORS.slate
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
    this.deliveryStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // C. Monthly Delivery Performance (Line)
    const months = summary.monthly_delivery_performance?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const onTimeRates = summary.monthly_delivery_performance?.on_time_rates || [86, 88, 89, 91, 94, 95];
    this.monthlyDeliveryChartData = {
      labels: months,
      datasets: [
        {
          label: 'On-Time Rate (%)',
          data: onTimeRates,
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.12)',
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#0d9488',
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
    this.monthlyDeliveryChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 70,
          max: 100,
          grid: { color: CHART_COLORS.gridLine },
          ticks: { callback: (v: any) => `${v}%` },
          title: { display: true, text: 'On-Time Fulfillment %' }
        }
      }
    };

    // D. Average Delivery Time by Vendor (Horizontal Bar)
    const vendors = summary.avg_delivery_time_by_vendor?.vendors || ['Vendor A', 'Vendor B', 'Vendor C'];
    const days = summary.avg_delivery_time_by_vendor?.days || [3.2, 4.1, 5.0];
    this.avgDeliveryTimeChartData = {
      labels: vendors,
      datasets: [
        {
          label: 'Avg Turnaround (Days)',
          data: days,
          backgroundColor: '#0284c7',
          borderRadius: 4
        }
      ]
    };
    this.avgDeliveryTimeChartOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        y: { grid: { display: false } },
        x: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Turnaround in Days' }
        }
      }
    };

    // E. Delayed Deliveries by Vendor (Bar)
    const delayedVendors = summary.delayed_deliveries_by_vendor?.vendors || ['Vendor A', 'Vendor B', 'Vendor C'];
    const delayedCounts = summary.delayed_deliveries_by_vendor?.counts || [2, 1, 0];
    this.delayedDeliveriesChartData = {
      labels: delayedVendors,
      datasets: [
        {
          label: 'Delayed Shipments',
          data: delayedCounts,
          backgroundColor: '#ef4444',
          borderRadius: 4
        }
      ]
    };
    this.delayedDeliveriesChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Delayed Shipments Count' }
        }
      }
    };

    // F. Orders by Category (Bar)
    const categories = summary.orders_by_category?.categories || ['IT & Electronics', 'Raw Materials', 'Logistics', 'Services'];
    const catCounts = summary.orders_by_category?.counts || [12, 28, 15, 8];
    this.ordersByCategoryChartData = {
      labels: categories,
      datasets: [
        {
          label: 'Order Volume',
          data: catCounts,
          backgroundColor: CATEGORY_PALETTE,
          borderRadius: 4
        }
      ]
    };
    this.ordersByCategoryChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Purchase Orders' }
        }
      }
    };
  }

  openCreatePOModal(pr: ReadyForPOItem): void {
    this.selectedPRForPO = pr;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    this.poForm.expected_delivery_date = futureDate.toISOString().split('T')[0];
    this.showCreatePOModal = true;
  }

  closeCreatePOModal(): void {
    this.showCreatePOModal = false;
    this.selectedPRForPO = null;
  }

  confirmCreatePO(): void {
    if (!this.selectedPRForPO || !this.poForm.expected_delivery_date) {
      alert('Please provide expected delivery date.');
      return;
    }

    const pr = this.selectedPRForPO;
    const reqNumber = pr.request_number || `PR-${pr.requisition_id}`;
    const vendorName = pr.vendor_name || 'Vendor';
    const reqId = pr.requisition_id;
    const tempPoNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      requisition_id: reqId,
      expected_delivery_date: new Date(this.poForm.expected_delivery_date).toISOString(),
      shipping_address: this.poForm.shipping_address,
      terms_and_conditions: this.poForm.terms_and_conditions
    };

    // 1. Immediately close modal — zero buffering
    this.closeCreatePOModal();

    // 2. Immediately show successful complete message on dashboard
    this.setActionMessage(`Purchase Order ${tempPoNum} for ${reqNumber} (${vendorName}) drafted successfully! Ready for logistics review.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    const optimisticPO: PurchaseOrder = {
      id: Date.now(),
      po_number: tempPoNum,
      procurement_request_id: reqId,
      requisition_number: reqNumber,
      vendor_id: pr.vendor_id,
      vendor_name: vendorName,
      status: 'Draft',
      total_amount: pr.quotation_amount || 0,
      expected_delivery_date: this.poForm.expected_delivery_date,
      shipping_address: this.poForm.shipping_address,
      terms_and_conditions: this.poForm.terms_and_conditions,
      created_at: new Date().toISOString(),
      items: [
        {
          item_name: pr.title || 'Procured Package Items',
          quantity: pr.quantity || 1,
          unit_price: pr.quotation_amount || 0,
          total_price: pr.quotation_amount || 0
        }
      ]
    };
    this.purchaseOrders = [optimisticPO, ...this.purchaseOrders];
    this.readyForPOList = this.readyForPOList.filter(r => r.requisition_id !== reqId);

    // 4. Background network submission & silent refresh
    this.http.post<any>(`${API_CONFIG.baseUrl}/purchase-orders`, payload).subscribe({
      next: (res) => {
        if (res?.po_number) {
          this.setActionMessage(`Purchase Order ${res.po_number} drafted successfully!`);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to create Purchase Order.');
        this.loadData(true);
      }
    });
  }

  issuePO(po: PurchaseOrder): void {
    if (!confirm(`Are you sure you want to officially issue ${po.po_number} to vendor ${po.vendor_name}?`)) return;

    // Immediately update status and show message
    po.status = 'Issued';
    this.setActionMessage(`Purchase Order ${po.po_number} officially issued to vendor ${po.vendor_name}!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.http.post<any>(`${API_CONFIG.baseUrl}/purchase-orders/${po.id}/issue`, {}).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(res.message);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to issue Purchase Order.');
        this.loadData(true);
      }
    });
  }

  openDeliveryModal(po: PurchaseOrder): void {
    this.selectedPOForDelivery = po;
    const nowStr = new Date().toISOString().split('T')[0];
    const expStr = po.expected_delivery_date ? new Date(po.expected_delivery_date).toISOString().split('T')[0] : nowStr;

    this.deliveryForm = {
      purchase_order_id: po.id || 0,
      expected_delivery_date: expStr,
      actual_delivery_date: nowStr,
      ordered_quantity: 100,
      delivered_quantity: 100,
      carrier: po.carrier || 'DHL Express Freight',
      tracking_number: po.tracking_number || `TRK-${Date.now().toString().slice(-6)}`,
      notes: 'Inspected at dock. Quantity verified against packing slip.'
    };
    this.showDeliveryModal = true;
  }

  closeDeliveryModal(): void {
    this.showDeliveryModal = false;
    this.selectedPOForDelivery = null;
  }

  confirmRecordDelivery(): void {
    if (!this.selectedPOForDelivery) return;
    const po = this.selectedPOForDelivery;

    const payload: RecordDeliveryPayload = {
      purchase_order_id: po.id || 0,
      expected_delivery_date: new Date(this.deliveryForm.expected_delivery_date).toISOString(),
      actual_delivery_date: new Date(this.deliveryForm.actual_delivery_date).toISOString(),
      ordered_quantity: this.deliveryForm.ordered_quantity,
      delivered_quantity: this.deliveryForm.delivered_quantity,
      carrier: this.deliveryForm.carrier,
      tracking_number: this.deliveryForm.tracking_number,
      notes: this.deliveryForm.notes
    };

    // 1. Immediately close modal — zero buffering
    this.closeDeliveryModal();

    // 2. Immediately show successful complete message on dashboard
    this.setActionMessage(`Delivery for ${po.po_number} recorded successfully! Invoice forwarded to Finance Officer.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    po.status = 'Delivered';

    // 4. Background network submission & silent refresh
    this.deliveryService.recordDelivery(payload).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(`${res.message} Delivery Status: ${res.delivery_status}. Invoice forwarded to Finance Officer.`);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to record delivery.');
        this.loadData(true);
      }
    });
  }

  confirmCompletion(deliveryId: number): void {
    this.deliveryService.confirmCompleted(deliveryId).subscribe({
      next: (res) => {
        this.actionMessage = res.message;
        this.loadData();
      },
      error: (err) => alert(err.error?.detail || 'Failed to confirm completion.')
    });
  }

  getActivePOCount(): number {
    return this.purchaseOrders.filter(p => !['Completed', 'Cancelled', 'Rejected'].includes(p.status)).length;
  }

  getDelayedDeliveriesCount(): number {
    return this.deliveries.filter(d => d.delay_days > 0).length;
  }
}
