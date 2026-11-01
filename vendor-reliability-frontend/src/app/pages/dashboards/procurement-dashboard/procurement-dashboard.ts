import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, DashboardStats } from '../../../services/dashboard.service';
import { PurchaseOrderService, PurchaseOrder } from '../../../services/purchase-order.service';
import { VendorService, VendorModel } from '../../../services/vendor.service';
import { RequisitionService, PurchaseRequisition, CreatePRPayload } from '../../../services/requisition.service';
import { ReliabilityService, VendorReliabilityProfile } from '../../../services/reliability.service';
import { AuthService, User, VENDOR_CATEGORIES } from '../../../services/auth.service';
import {
  ProcurementService,
  EligibleVendorCard,
  EligibleVendorsResponse,
  VendorFullDetails,
  VendorSelectionPayload
} from '../../../services/procurement.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../../services/api.config';

export interface EligiblePR {
  id: number;
  request_number: string;
  department: string;
  title: string;
  description: string;
  quantity: number;
  unit_budget?: number;
  priority: string;
  category: string;
  estimated_budget: number;
  required_date?: string;
  status: string;
  requested_by: string;
  created_at: string;
}

export interface ApprovedSelection {
  id: number;
  requisition_id: number;
  request_number: string;
  department: string;
  title: string;
  category?: string;
  vendor_id: number;
  vendor_name: string;
  vendor_reliability: number;
  vendor_risk: string;
  quotation_amount: number;
  justification: string;
  status: string;
  selected_by: string;
  created_at: string;
}

import { ProcurementOverviewChartComponent } from '../../../components/charts/procurement-overview-chart.component';
import { PurchaseOrderStatusChartComponent } from '../../../components/charts/purchase-order-status-chart.component';
import { VendorPerformanceChartComponent } from '../../../components/charts/vendor-performance-chart.component';
import { CostAnalysisChartComponent } from '../../../components/charts/cost-analysis-chart.component';
import { DeliveryStatusChartComponent } from '../../../components/charts/delivery-status-chart.component';
import { AppChartComponent } from '../../../components/charts/app-chart.component';
import { CATEGORY_PALETTE, CHART_COLORS } from '../../../components/charts/chart-theme';

@Component({
  selector: 'app-procurement-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    NgClass,
    DecimalPipe,
    DatePipe,
    ProcurementOverviewChartComponent,
    PurchaseOrderStatusChartComponent,
    DeliveryStatusChartComponent,
    AppChartComponent
  ],
  templateUrl: './procurement-dashboard.html',
  styleUrl: './procurement-dashboard.css'
})
export class ProcurementDashboard implements OnInit {
  stats: DashboardStats | null = null;
  procurementSummary: any = null;
  isLoadingSummary = true;

  get pendingPayoutDisplay(): string {
    if (this.stats && this.stats.pending_payout_amount) {
      return '₹ ' + (this.stats.pending_payout_amount / 100000).toFixed(1) + 'L';
    }
    return '₹ 14.8L';
  }

  selectedCategoryFilter = 'All Categories';
  selectedDateRange = 'Jan 2026 - Jun 2026';
  categoryDistributionChartData: any = null;
  categoryDistributionChartOptions: any = null;
  riskDistributionChartData: any = null;
  riskDistributionChartOptions: any = null;
  onTimeVsDelayedChartData: any = null;
  onTimeVsDelayedChartOptions: any = null;
  vendorReliabilityChartData: any = null;
  vendorReliabilityChartOptions: any = null;
  currentUser: User | null = null;
  eligiblePRs: EligiblePR[] = [];
  approvedSelections: ApprovedSelection[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  vendors: VendorModel[] = [];
  reliabilityProfiles: VendorReliabilityProfile[] = [];

  // Requisitions & Order Tracking
  allRequisitions: PurchaseRequisition[] = [];
  selectedRequisitionForTracking: PurchaseRequisition | null = null;
  showCreatePRModal = false;
  showTrackingModal = false;
  prStatusFilter = 'All';
  prSearchQuery = '';
  isSubmittingPR = false;

  // Official Categories (Strict 6 Categories)
  categories: string[] = VENDOR_CATEGORIES;

  newPR: CreatePRPayload = {
    department: 'Procurement',
    product_name: 'Laptop',
    quantity: 50,
    unit_budget: 50000,
    required_date: '2026-10-15',
    priority: 'High',
    reason: 'Enterprise hardware refresh for operations and engineering teams',
    category: 'IT & Electronics',
    estimated_budget: 2500000
  };

  onPRUnitBudgetChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    const unitB = Number(this.newPR.unit_budget) || 0;
    this.newPR.estimated_budget = Math.round(qty * unitB * 100) / 100;
  }

  onPRTotalBudgetChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    const totalB = Number(this.newPR.estimated_budget) || 0;
    this.newPR.unit_budget = Math.round((totalB / qty) * 100) / 100;
  }

  onPRQuantityChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    if (this.newPR.unit_budget && this.newPR.unit_budget > 0) {
      this.newPR.estimated_budget = Math.round(qty * Number(this.newPR.unit_budget) * 100) / 100;
    } else if (this.newPR.estimated_budget && this.newPR.estimated_budget > 0) {
      this.newPR.unit_budget = Math.round((Number(this.newPR.estimated_budget) / qty) * 100) / 100;
    }
  }

  departments = [
    'Procurement',
    'Information Technology',
    'Manufacturing & Production',
    'Supply Chain & Logistics',
    'Corporate Finance',
    'Operations & Facilities',
    'Human Resources',
    'Research & Development'
  ];

  // Dynamic Vendor Selection Modal State
  showVendorSelectionModal = false;
  selectedPRForSelection: any = null;
  eligibleVendorsResponse: EligibleVendorsResponse | null = null;
  eligibleVendorsList: EligibleVendorCard[] = [];
  selectedVendorCard: EligibleVendorCard | null = null;
  isLoadingEligibleVendors = false;
  eligibleVendorSearch = '';
  vendorSelectionStep: 'select' | 'confirm' = 'select';
  matrixViewMode: 'matrix' | 'cards' = 'matrix';

  // Vendor Full Details Modal State
  showVendorDetailsModal = false;
  selectedVendorFullDetails: VendorFullDetails | null = null;
  isLoadingVendorDetails = false;
  vendorDetailsActiveTab: 'profile' | 'performance' | 'risk' | 'history' = 'profile';

  // Vendor Comparison Modal State
  showCompareModal = false;
  comparedVendors: any[] = [];

  selectionForm = {
    quotation_amount: 2500000,
    justification: ''
  };

  actionMessage = '';
  errorMessage = '';
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
    private dashService: DashboardService,
    private poService: PurchaseOrderService,
    private vendorService: VendorService,
    private prService: RequisitionService,
    private procService: ProcurementService,
    private reliabilityService: ReliabilityService,
    private authService: AuthService,
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
    if (this.currentUser?.department) {
      this.newPR.department = this.currentUser.department;
    }
    this.isLoadingSummary = false;
    this.buildCategoryDistributionChart(); // Render charts instantly on frame 1
    this.buildAdditionalCharts();
    this.loadData();

    // Re-load immediately if auth state or user changes without requiring browser refresh
    this.authService.currentUser$.subscribe((u) => {
      if (u && (u.id !== this.lastUserId || u.role !== this.lastUserRole)) {
        this.lastUserId = u.id;
        this.lastUserRole = u.role;
        this.currentUser = u;
        if (this.currentUser?.department) {
          this.newPR.department = this.currentUser.department;
        }
        this.loadData();
      }
    });
  }

  loadData(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }

    // 1. Stats
    this.dashService.getStats(true).subscribe({
      next: (data) => {
        this.stats = data;
        this.buildAdditionalCharts(this.procurementSummary);
      },
      error: () => {}
    });

    // 1b. Enhanced Analytics Summary (Charts & Metrics)
    this.loadProcurementAnalytics(silent);

    // 2. Eligible PRs awaiting vendor evaluation
    this.http.get<EligiblePR[]>(`${API_CONFIG.baseUrl}/procurement/eligible-requisitions`).subscribe({
      next: (prs) => this.eligiblePRs = prs,
      error: () => { if (!silent) this.eligiblePRs = []; }
    });

    // 3. Approved Selections
    this.http.get<ApprovedSelection[]>(`${API_CONFIG.baseUrl}/procurement/selections`).subscribe({
      next: (sels) => this.approvedSelections = sels,
      error: () => { if (!silent) this.approvedSelections = []; }
    });

    // 4. Vendors directory for evaluation
    this.vendorService.getVendors({}, true).subscribe({
      next: (v) => {
        this.vendors = v;
        if (!silent) this.isLoading = false;
      },
      error: () => { if (!silent) this.isLoading = false; }
    });

    // 5. Purchase Orders (VIEW ONLY)
    this.poService.getPurchaseOrders({}, true).subscribe({
      next: (pos) => this.purchaseOrders = pos,
      error: () => { if (!silent) this.purchaseOrders = []; }
    });

    // 6. All Procurement Requisitions for Tracking
    this.loadRequisitions();

    // 7. Vendor Reliability Profiles (Decision Matrix)
    this.reliabilityService.getReliabilityProfiles().subscribe({
      next: (profiles) => this.reliabilityProfiles = profiles,
      error: () => { if (!silent) this.reliabilityProfiles = []; }
    });
  }

  loadProcurementAnalytics(silent = false): void {
    if (!silent) {
      this.isLoadingSummary = true;
    }
    this.dashService.getProcurementSummary(this.selectedCategoryFilter, undefined, undefined, this.prStatusFilter, true).subscribe({
      next: (summary) => {
        this.procurementSummary = summary;
        this.isLoadingSummary = false;
        this.buildCategoryDistributionChart(summary);
        this.buildAdditionalCharts(summary);
      },
      error: (err) => {
        console.error('Failed to load procurement summary', err);
        this.isLoadingSummary = false;
      }
    });
  }

  buildAdditionalCharts(summary?: any): void {
    // 1. Vendor Risk Distribution
    const lowRisk = this.stats?.low_risk_vendors || 14;
    const medRisk = this.stats?.medium_risk_vendors || 5;
    const highRisk = this.stats?.high_risk_vendors || 2;
    const critRisk = 1;

    this.riskDistributionChartData = {
      labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'],
      datasets: [
        {
          data: [lowRisk, medRisk, highRisk, critRisk],
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.delayed, CHART_COLORS.danger],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.riskDistributionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, font: { size: 11, family: "'Inter', sans-serif" } }
        }
      },
      cutout: '65%'
    };

    // 2. On-Time vs Delayed Deliveries
    const onTimeRate = summary?.delivery_status?.on_time_rate || this.stats?.on_time_delivery_rate || 88.5;
    const delayedRate = Math.round((100 - onTimeRate) * 10) / 10;
    this.onTimeVsDelayedChartData = {
      labels: ['On-Time Deliveries', 'Delayed Deliveries'],
      datasets: [
        {
          data: [onTimeRate, delayedRate],
          backgroundColor: [CHART_COLORS.success, CHART_COLORS.danger],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.onTimeVsDelayedChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, font: { size: 11, family: "'Inter', sans-serif" } }
        }
      },
      cutout: '70%'
    };

    // 3. Vendor Reliability Trend
    const months = summary?.procurement_overview?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    this.vendorReliabilityChartData = {
      labels: months,
      datasets: [
        {
          label: 'Average Supplier Reliability (%)',
          data: [89.2, 90.5, 91.0, 91.8, 93.2, 94.5],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb'
        },
        {
          label: 'Target SLA Benchmark (90%)',
          data: [90, 90, 90, 90, 90, 90],
          borderColor: '#10b981',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    };
    this.vendorReliabilityChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 10, font: { size: 11, family: "'Inter', sans-serif" } }
        }
      },
      scales: {
        y: {
          min: 80,
          max: 100,
          grid: { color: CHART_COLORS.gridLine },
          ticks: { callback: (v: any) => v + '%' }
        },
        x: {
          grid: { display: false }
        }
      }
    };
  }

  onCategoryFilterChange(newCat: string): void {
    this.selectedCategoryFilter = newCat;
    this.loadProcurementAnalytics();
  }

  buildCategoryDistributionChart(summary?: any): void {
    const defaultCats = this.categories || [
      'IT & Electronics',
      'Raw Materials',
      'Office Supplies & Equipment',
      'Machinery & Spare Parts',
      'Logistics & Transportation',
      'Services & Maintenance'
    ];
    const defaultCounts = [8, 6, 5, 4, 3, 2];
    const cats = summary?.vendor_category_distribution?.categories || defaultCats;
    const counts = summary?.vendor_category_distribution?.counts || defaultCounts;

    this.categoryDistributionChartData = {
      labels: cats,
      datasets: [
        {
          label: 'Number of Vendors',
          data: counts,
          backgroundColor: CATEGORY_PALETTE.slice(0, cats.length),
          borderRadius: 4
        }
      ]
    };

    this.categoryDistributionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          callbacks: {
            label: (ctx: any) => ` ${ctx.label}: ${ctx.raw} Vendors`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine },
          ticks: { stepSize: 1, precision: 0 }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10, family: "'Inter', sans-serif" } }
        }
      }
    };
  }

  loadRequisitions(): void {
    this.prService.getRequisitions(this.prStatusFilter).subscribe({
      next: (data) => this.allRequisitions = data,
      error: () => this.allRequisitions = []
    });
  }

  filterAndScrollPRs(status: string): void {
    this.prStatusFilter = status;
    this.loadRequisitions();
    this.scrollToSection('all-requisitions-section');
  }

  getFilteredRequisitions(): PurchaseRequisition[] {
    const q = this.prSearchQuery.toLowerCase().trim();
    if (!q) return this.allRequisitions;
    return this.allRequisitions.filter(pr =>
      pr.request_number?.toLowerCase().includes(q) ||
      pr.title?.toLowerCase().includes(q) ||
      pr.department?.toLowerCase().includes(q) ||
      pr.description?.toLowerCase().includes(q) ||
      pr.status?.toLowerCase().includes(q)
    );
  }

  getVendorProfile(vendorId?: number): VendorReliabilityProfile | undefined {
    if (!vendorId) return undefined;
    return this.reliabilityProfiles.find(p => p.vendorId === vendorId);
  }

  getVendorReliabilityScore(vendorId?: number): number {
    const profile = this.getVendorProfile(vendorId);
    if (profile) return Math.round(profile.reliabilityScore * 10) / 10;
    const vendor = this.vendors.find(v => v.id === vendorId);
    return vendor?.deliveryRate || 92;
  }

  getVendorTier(vendorId?: number): string {
    const profile = this.getVendorProfile(vendorId);
    return profile?.tier || 'Tier-2 Preferred';
  }

  getVendorRank(vendorId?: number): number {
    const profile = this.getVendorProfile(vendorId);
    if (profile) return profile.rank;
    const idx = this.vendors.findIndex(v => v.id === vendorId);
    return idx >= 0 ? idx + 1 : 1;
  }

  get previewRequirementId(): string {
    const nextSeq = this.allRequisitions.length + 1;
    return `PR-2026-${String(nextSeq).padStart(4, '0')}`;
  }

  getFilteredEligibleVendors(): EligibleVendorCard[] {
    const q = this.eligibleVendorSearch.toLowerCase().trim();
    if (!q) return this.eligibleVendorsList;
    return this.eligibleVendorsList.filter(v =>
      v.name?.toLowerCase().includes(q) ||
      v.company?.toLowerCase().includes(q) ||
      v.products?.some(p => p.toLowerCase().includes(q)) ||
      v.category?.toLowerCase().includes(q)
    );
  }

  openSelectVendorModal(pr: any): void {
    this.selectedPRForSelection = pr;
    this.vendorSelectionStep = 'select';
    this.selectedVendorCard = null;
    this.eligibleVendorSearch = '';
    this.matrixViewMode = 'matrix';
    this.selectionForm.quotation_amount = pr.estimated_budget || 2500000;
    if (pr.category) {
      this.selectedCategoryFilter = pr.category;
      this.loadProcurementAnalytics();
    }
    this.showVendorSelectionModal = true;
    this.actionMessage = '';
    this.errorMessage = '';
    this.loadEligibleVendors(pr.id);
  }

  loadEligibleVendors(prId: number): void {
    this.isLoadingEligibleVendors = true;
    this.procService.getEligibleVendors(prId).subscribe({
      next: (res) => {
        this.isLoadingEligibleVendors = false;
        this.eligibleVendorsResponse = res;
        this.eligibleVendorsList = res.vendors || [];
        if (this.eligibleVendorsList.length > 0) {
          this.stageVendorForSelection(this.eligibleVendorsList[0]);
        }
      },
      error: (err) => {
        this.isLoadingEligibleVendors = false;
        this.eligibleVendorsList = [];
        this.errorMessage = err.error?.detail || 'Failed to load eligible vendors for category.';
      }
    });
  }

  stageVendorForSelection(vendor: EligibleVendorCard): void {
    this.selectedVendorCard = vendor;
    if (vendor.quotation_estimate) {
      this.selectionForm.quotation_amount = vendor.quotation_estimate;
    } else if (this.selectedPRForSelection?.estimated_budget) {
      this.selectionForm.quotation_amount = this.selectedPRForSelection.estimated_budget;
    }
    this.selectionForm.justification = `Selected ${vendor.name} (${vendor.company}) based on verified category match '${vendor.category}', Reliability Score ${vendor.reliability_score}/100, On-Time Delivery Rate ${vendor.on_time_delivery_rate}%, and ${vendor.risk_level} operational risk rating for requirement ${this.selectedPRForSelection?.request_number || ''}.`;
  }

  proceedToConfirmSelection(vendor?: EligibleVendorCard): void {
    if (vendor) {
      this.stageVendorForSelection(vendor);
    }
    if (!this.selectedVendorCard) {
      alert('Please select an eligible vendor first.');
      return;
    }
    this.vendorSelectionStep = 'confirm';
  }

  backToVendorList(): void {
    this.vendorSelectionStep = 'select';
  }

  openSelectVendorFromTracking(): void {
    if (this.selectedRequisitionForTracking) {
      const pr = this.selectedRequisitionForTracking;
      this.closeTrackingModal();
      this.openSelectVendorModal(pr);
    }
  }

  closeSelectVendorModal(): void {
    this.showVendorSelectionModal = false;
    this.selectedPRForSelection = null;
    this.selectedVendorCard = null;
    this.vendorSelectionStep = 'select';
  }

  confirmVendorSelection(): void {
    if (!this.selectedPRForSelection || !this.selectedVendorCard) {
      alert('Please select a vendor.');
      return;
    }

    if (!this.selectionForm.quotation_amount || this.selectionForm.quotation_amount <= 0 || !this.selectionForm.justification.trim()) {
      alert('Please enter a valid quotation amount and justification.');
      return;
    }

    const pr = this.selectedPRForSelection;
    const vendor = this.selectedVendorCard;
    const quotationAmount = Number(this.selectionForm.quotation_amount);
    const justification = this.selectionForm.justification.trim();

    const payload: VendorSelectionPayload = {
      requisition_id: pr.id,
      vendor_id: vendor.vendor_id,
      quotation_amount: quotationAmount,
      justification: justification
    };

    // 1. Immediately close modal — zero buffering
    this.closeSelectVendorModal();

    // 2. Immediately show successful complete message on dashboard
    this.setActionMessage(`Vendor ${vendor.name} selected for ${pr.request_number}. Request forwarded to Finance Officer for financial approval.`);
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local state update
    const foundPR = this.allRequisitions.find(p => p.id === pr.id);
    if (foundPR) {
      foundPR.status = 'VENDOR_SELECTED';
      foundPR.selected_vendor = {
        id: vendor.vendor_id,
        name: vendor.name,
        quotation: quotationAmount,
        justification: justification,
        status: 'Awaiting Financial Approval'
      };
    }
    this.eligiblePRs = this.eligiblePRs.filter(p => p.id !== pr.id);

    const optimisticSelection: ApprovedSelection = {
      id: Date.now(),
      requisition_id: pr.id,
      request_number: pr.request_number,
      department: pr.department,
      title: pr.title || pr.item,
      category: pr.category || vendor.category,
      vendor_id: vendor.vendor_id,
      vendor_name: vendor.name,
      vendor_reliability: vendor.reliability_score,
      vendor_risk: vendor.risk_level,
      quotation_amount: quotationAmount,
      justification: justification,
      status: 'Awaiting Financial Approval',
      selected_by: this.currentUser?.full_name || 'Procurement Manager',
      created_at: new Date().toISOString()
    };
    this.approvedSelections = [optimisticSelection, ...this.approvedSelections];

    // 4. Background network submission & silent refresh
    this.procService.selectVendor(payload).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(res.message);
        }
        this.loadData(true);
      },
      error: (err) => {
        const msg = err.error?.detail || 'Failed to select vendor.';
        this.errorMessage = msg;
        this.loadData(true);
      }
    });
  }

  openVendorDetailsModal(vendorId: number): void {
    this.isLoadingVendorDetails = true;
    this.showVendorDetailsModal = true;
    this.vendorDetailsActiveTab = 'profile';
    this.procService.getVendorFullDetails(vendorId).subscribe({
      next: (details) => {
        this.selectedVendorFullDetails = details;
        this.isLoadingVendorDetails = false;
      },
      error: (err) => {
        this.isLoadingVendorDetails = false;
        alert(err.error?.detail || 'Failed to load vendor details.');
      }
    });
  }

  closeVendorDetailsModal(): void {
    this.showVendorDetailsModal = false;
    this.selectedVendorFullDetails = null;
  }

  openCompareModal(): void {
    if (this.eligibleVendorsList && this.eligibleVendorsList.length > 0) {
      this.comparedVendors = this.eligibleVendorsList.slice(0, 4);
    } else {
      const sorted = [...this.vendors].sort((a, b) => this.getVendorReliabilityScore(b.id) - this.getVendorReliabilityScore(a.id));
      this.comparedVendors = sorted.slice(0, 4);
    }
    this.showCompareModal = true;
  }

  closeCompareModal(): void {
    this.showCompareModal = false;
  }

  getRiskBadgeClass(risk?: string): string {
    switch (risk?.toLowerCase()) {
      case 'low': return 'bg-success';
      case 'medium': return 'bg-warning text-dark';
      case 'high': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  openCreatePRModal(): void {
    this.newPR = {
      department: this.currentUser?.department || 'Procurement',
      product_name: 'Laptop',
      quantity: 50,
      unit_budget: 50000,
      required_date: '2026-10-15',
      priority: 'High',
      reason: 'Enterprise hardware refresh for operations and engineering teams',
      category: 'IT & Electronics',
      estimated_budget: 2500000
    };
    this.showCreatePRModal = true;
    this.actionMessage = '';
    this.errorMessage = '';
  }

  closeCreatePRModal(): void {
    this.showCreatePRModal = false;
  }

  submitPR(): void {
    if (!this.newPR.product_name.trim() || !this.newPR.category || this.newPR.quantity <= 0) {
      alert('Please fill in Item name, select a Vendor Category, and enter a valid quantity.');
      return;
    }
    if (!this.newPR.reason.trim()) {
      alert('Please provide a description / business justification for this requirement.');
      return;
    }

    const payload = { ...this.newPR };
    const generatedReqId = this.previewRequirementId;
    const prTitle = payload.product_name;
    const prCategory = payload.category;

    // 1. Immediately close modal — zero buffering
    this.closeCreatePRModal();

    // 2. Immediately show successful complete message on dashboard
    this.setActionMessage(`Procurement Request ${generatedReqId} (${prTitle}) for category '${prCategory}' created successfully and added to your sourcing pipeline!`);
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    const tempId = Date.now();
    const optimisticPR: PurchaseRequisition = {
      id: tempId,
      request_number: generatedReqId,
      department: payload.department,
      title: payload.product_name,
      description: payload.reason,
      quantity: payload.quantity,
      required_date: payload.required_date,
      priority: payload.priority,
      category: payload.category,
      estimated_budget: payload.estimated_budget || 0,
      status: 'SUBMITTED',
      created_at: new Date().toISOString()
    };
    this.allRequisitions = [optimisticPR, ...this.allRequisitions];

    const optimisticEligible: EligiblePR = {
      id: tempId,
      request_number: generatedReqId,
      department: payload.department,
      title: payload.product_name,
      description: payload.reason,
      quantity: payload.quantity,
      priority: payload.priority,
      category: payload.category || '',
      estimated_budget: payload.estimated_budget || 0,
      required_date: payload.required_date,
      status: 'SUBMITTED',
      requested_by: this.currentUser?.full_name || 'Procurement Manager',
      created_at: new Date().toISOString()
    };
    this.eligiblePRs = [optimisticEligible, ...this.eligiblePRs];

    if (this.stats) {
      this.stats.pending_procurement_requests = (this.stats.pending_procurement_requests || 0) + 1;
      this.stats.total_procurement_requests = (this.stats.total_procurement_requests || 0) + 1;
    }

    // 4. Background network submission & silent refresh
    this.prService.createRequisition(payload).subscribe({
      next: (res) => {
        const idx = this.allRequisitions.findIndex(p => p.id === tempId);
        if (idx !== -1 && res) {
          this.allRequisitions[idx] = { ...this.allRequisitions[idx], ...res, id: res.id || res.pr_id };
        }
        const elIdx = this.eligiblePRs.findIndex(p => p.id === tempId);
        if (elIdx !== -1 && res) {
          this.eligiblePRs[elIdx] = { ...this.eligiblePRs[elIdx], ...res, id: res.id || res.pr_id };
        }
        this.loadData(true);
      },
      error: (err) => {
        this.allRequisitions = this.allRequisitions.filter(p => p.id !== tempId);
        this.eligiblePRs = this.eligiblePRs.filter(p => p.id !== tempId);
        this.errorMessage = err.error?.detail || 'Failed to submit requisition.';
        this.loadData(true);
      }
    });
  }

  trackRequisition(pr: PurchaseRequisition): void {
    this.prService.getRequisition(pr.id).subscribe({
      next: (data) => {
        this.selectedRequisitionForTracking = data;
        this.showTrackingModal = true;
      },
      error: () => {
        this.selectedRequisitionForTracking = pr;
        this.showTrackingModal = true;
      }
    });
  }

  closeTrackingModal(): void {
    this.showTrackingModal = false;
    this.selectedRequisitionForTracking = null;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Pending':
      case 'SUBMITTED': return 'badge-submitted';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'VENDOR_SELECTED': return 'badge-selected';
      case 'Approved':
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED': return 'badge-approved';
      case 'Ordered':
      case 'PO_CREATED':
      case 'Issued':
      case 'Accepted': return 'badge-ordered';
      case 'In Transit': return 'badge-transit';
      case 'Delivered':
      case 'Completed':
      case 'COMPLETED': return 'badge-completed';
      default: return status?.includes('REJECT') ? 'badge-rejected' : 'badge-secondary';
    }
  }

  getStepProgress(status: string): number {
    switch (status) {
      case 'Pending':
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'UNDER_EVALUATION':
        return 1;
      case 'VENDOR_SELECTED':
        return 2;
      case 'Approved':
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED':
        return 3;
      case 'Ordered':
      case 'PO_CREATED':
      case 'Issued':
      case 'Accepted':
      case 'Draft':
        return 4;
      case 'In Transit':
      case 'Dispatched':
        return 5;
      case 'Delivered':
      case 'Delayed':
      case 'Partially Delivered':
        return 6;
      case 'Completed':
      case 'COMPLETED':
      case 'PAID':
        return 7;
      default:
        return 1;
    }
  }
}
