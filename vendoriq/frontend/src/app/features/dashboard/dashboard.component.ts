import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { Chart } from 'chart.js/auto';

import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';

import {
  DashboardSummary,
  UserRole
} from '../../core/models/models';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent
  implements OnInit, AfterViewInit, OnDestroy {

  // ============================================================
  // DATA
  // ============================================================

  summary: DashboardSummary | null = null;

  analytics: any = null;

  procurementAnalytics: any = null;

  riskSummary: any = null;

  vendorDashboard: any = null;


  // ============================================================
  // PROCUREMENT STATUS
  // ============================================================

  procurementStatus = {
    pending: 0,
    approved: 0,
    ordered: 0,
    delivered: 0,
    completed: 0,
    cancelled: 0
  };


  // ============================================================
  // STATE
  // ============================================================

  loading = true;

  analyticsLoading = false;

  error = '';

  analyticsError = '';


  // ============================================================
  // API
  // ============================================================

  private readonly api =
    'http://127.0.0.1:8000/api/v1';


  // ============================================================
  // CHART MANAGEMENT
  // ============================================================

  private charts: Chart[] = [];

  private viewReady = false;


  // ============================================================
  // PROCUREMENT MANAGER CHARTS
  // ============================================================

  @ViewChild('procurementOverviewChart')
  procurementOverviewChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('activePurchaseOrdersChart')
  activePurchaseOrdersChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('vendorPerformanceSummaryChart')
  vendorPerformanceSummaryChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('procurementCostChart')
  procurementCostChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('deliveryStatusChart')
  deliveryStatusChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('procurementProcessingChart')
  procurementProcessingChart?: ElementRef<HTMLCanvasElement>;


  // ============================================================
  // EXISTING / COMPATIBILITY CHARTS
  // ============================================================

  @ViewChild('riskChart')
  riskChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('categoryChart')
  categoryChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('complianceChart')
  complianceChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('performanceChart')
  performanceChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('cycleChart')
  cycleChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('deliveryChart')
  deliveryChart?: ElementRef<HTMLCanvasElement>;


  // ============================================================
  // VENDOR CHARTS
  // ============================================================

  @ViewChild('vendorPerformanceChart')
  vendorPerformanceChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('vendorReliabilityChart')
  vendorReliabilityChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('vendorContractChart')
  vendorContractChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('vendorOrderChart')
  vendorOrderChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('vendorCommunicationChart')
  vendorCommunicationChart?: ElementRef<HTMLCanvasElement>;


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private dashboardService: DashboardService,
    private http: HttpClient,
    public auth: AuthService
  ) {}


  // ============================================================
  // CURRENT ROLE
  // ============================================================

  get role(): UserRole | null {

    return this.auth.currentUser()?.role ?? null;

  }


  // ============================================================
  // ROLE TITLE
  // ============================================================

  get roleTitle(): string {

    const titles: Record<UserRole, string> = {

      administrator:
        'Administrator Dashboard',

      procurement_manager:
        'Procurement Dashboard',

      supply_chain_manager:
        'Supply Chain Dashboard',

      vendor:
        'Vendor Dashboard',

      finance_officer:
        'Finance Dashboard',

      auditor:
        'Audit Dashboard'

    };

    const currentRole = this.role;

    return currentRole
      ? titles[currentRole]
      : 'Dashboard';

  }


  // ============================================================
  // ROLE DESCRIPTION
  // ============================================================

  get roleDescription(): string {

    const descriptions: Record<UserRole, string> = {

      administrator:
        'Manage users, vendors, procurement, compliance and system performance.',

      procurement_manager:
        'Track procurement activities, purchase orders, vendors and delivery performance.',

      supply_chain_manager:
        'Monitor vendors, delivery performance, reliability, risk and supply chain operations.',

      vendor:
        'Monitor your performance, reliability, contracts, orders and communication.',

      finance_officer:
        'Monitor procurement value, purchase orders, financial activity and contracts.',

      auditor:
        'Review procurement, vendor, compliance, performance and risk information.'

    };

    const currentRole = this.role;

    return currentRole
      ? descriptions[currentRole]
      : 'VendorIQ operational dashboard.';

  }


  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {

    this.loadRoleDashboard();

  }


  ngAfterViewInit(): void {

    this.viewReady = true;

    this.tryRenderCharts();

  }


  ngOnDestroy(): void {

    this.destroyCharts();

  }


  // ============================================================
  // LOAD DASHBOARD
  // ============================================================

  private loadRoleDashboard(): void {

    this.loading = true;

    this.error = '';

    this.analyticsError = '';

    const currentRole = this.role;


    // ----------------------------------------------------------
    // VENDOR
    // ----------------------------------------------------------

    if (currentRole === 'vendor') {

      this.loadVendorDashboard();

      return;

    }


    // ----------------------------------------------------------
    // ALL OTHER ROLES
    // ----------------------------------------------------------

    this.dashboardService.summary().subscribe({

      next: (summary) => {

        this.summary = summary;

        this.loading = false;

        this.loadRoleAnalytics();

      },

      error: (error) => {

        console.error(
          'Dashboard summary error:',
          error
        );

        this.error =
          'Could not load dashboard summary.';

        this.loading = false;

        this.analyticsLoading = false;

      }

    });

  }


  // ============================================================
  // LOAD ROLE ANALYTICS
  // ============================================================

  private loadRoleAnalytics(): void {

    const currentRole = this.role;

    this.analyticsLoading = true;

    this.analyticsError = '';

    this.analytics = null;

    this.procurementAnalytics = null;

    this.riskSummary = null;


    // ----------------------------------------------------------
    // ADMINISTRATOR
    // ----------------------------------------------------------

    if (currentRole === 'administrator') {

      this.loadAdminAnalytics();

      return;

    }


    // ----------------------------------------------------------
    // PROCUREMENT MANAGER
    // ----------------------------------------------------------

    if (currentRole === 'procurement_manager') {

      this.loadProcurementAnalytics();

      return;

    }


    // ----------------------------------------------------------
    // SUPPLY CHAIN MANAGER
    // ----------------------------------------------------------

    if (currentRole === 'supply_chain_manager') {

      this.loadRiskAnalytics();

      return;

    }


    // ----------------------------------------------------------
    // FINANCE OFFICER
    // ----------------------------------------------------------

    if (currentRole === 'finance_officer') {

      this.loadProcurementAnalytics();

      return;

    }


    // ----------------------------------------------------------
    // AUDITOR
    // ----------------------------------------------------------

    if (currentRole === 'auditor') {

      this.loadAdminAnalytics();

      return;

    }


    this.analyticsLoading = false;

  }


  // ============================================================
  // ADMIN ANALYTICS
  // ============================================================

  private loadAdminAnalytics(): void {

    this.http
      .get<any>(
        `${this.api}/analytics/admin-dashboard`
      )
      .subscribe({

        next: (data) => {

          this.analytics = data;

          this.checkAnalyticsComplete();

        },

        error: (error) => {

          console.error(
            'Admin analytics error:',
            error
          );

          this.analyticsError =
            'Could not load system analytics.';

          this.checkAnalyticsComplete();

        }

      });


    this.loadProcurementAnalytics();

    this.loadRiskAnalytics();

  }


  // ============================================================
  // PROCUREMENT ANALYTICS
  // ============================================================

  private loadProcurementAnalytics(): void {

    this.http
      .get<any>(
        `${this.api}/analytics/procurement-analytics`
      )
      .subscribe({

        next: (data) => {

          console.log(
            'Procurement analytics:',
            data
          );

          this.procurementAnalytics = data;

          this.buildProcurementStatus();

          this.checkAnalyticsComplete();

        },

        error: (error) => {

          console.error(
            'Procurement analytics error:',
            error
          );

          this.analyticsError =
            'Could not load procurement analytics.';

          this.checkAnalyticsComplete();

        }

      });

  }


  // ============================================================
  // RISK ANALYTICS
  // ============================================================

  private loadRiskAnalytics(): void {

    this.http
      .get<any>(
        `${this.api}/reliability/risk-summary`
      )
      .subscribe({

        next: (data) => {

          this.riskSummary = data;

          this.checkAnalyticsComplete();

        },

        error: (error) => {

          console.error(
            'Risk analytics error:',
            error
          );

          this.analyticsError =
            'Could not load vendor risk analytics.';

          this.checkAnalyticsComplete();

        }

      });

  }


  // ============================================================
  // VENDOR DASHBOARD
  // ============================================================

  private loadVendorDashboard(): void {

    this.loading = true;

    this.analyticsLoading = true;

    this.vendorDashboard = null;

    this.http
      .get<any>(
        `${this.api}/analytics/vendor-dashboard/me`
      )
      .subscribe({

        next: (data) => {

          console.log(
            'Vendor dashboard data:',
            data
          );

          this.vendorDashboard = data;

          this.loading = false;

          this.analyticsLoading = false;

          this.tryRenderCharts();

        },

        error: (error) => {

          console.error(
            'Vendor dashboard error:',
            error
          );

          this.error =
            'Could not load vendor dashboard.';

          this.loading = false;

          this.analyticsLoading = false;

        }

      });

  }


  // ============================================================
  // PROCUREMENT STATUS
  // ============================================================

  private buildProcurementStatus(): void {

    /*
     * DashboardSummary can vary depending on the backend
     * response. Therefore the object is read dynamically.
     *
     * If the backend provides detailed status counts,
     * they will be displayed.
     *
     * Otherwise the values safely fall back to 0.
     */

    const summary: any = this.summary ?? {};

    const procurement: any =
      summary.procurement ?? {};

    const purchaseOrders: any =
      summary.purchase_orders ?? {};

    const analytics: any =
      this.procurementAnalytics ?? {};


    this.procurementStatus = {

      pending:
        Number(
          procurement.pending ??
          procurement.pending_requests ??
          analytics.pending_requests ??
          0
        ),

      approved:
        Number(
          procurement.approved ??
          procurement.approved_requests ??
          analytics.approved_requests ??
          0
        ),

      ordered:
        Number(
          procurement.ordered ??
          procurement.ordered_requests ??
          purchaseOrders.active ??
          0
        ),

      delivered:
        Number(
          procurement.delivered ??
          procurement.delivered_requests ??
          purchaseOrders.delivered ??
          0
        ),

      completed:
        Number(
          procurement.completed ??
          procurement.completed_requests ??
          purchaseOrders.completed ??
          0
        ),

      cancelled:
        Number(
          procurement.cancelled ??
          procurement.cancelled_requests ??
          analytics.cancelled_requests ??
          0
        )

    };

  }


  // ============================================================
  // CHECK ANALYTICS COMPLETE
  // ============================================================

  private checkAnalyticsComplete(): void {

    const currentRole = this.role;

    let complete = false;


    // ADMIN / AUDITOR

    if (
      currentRole === 'administrator' ||
      currentRole === 'auditor'
    ) {

      complete =
        !!this.analytics &&
        !!this.procurementAnalytics &&
        !!this.riskSummary;

    }


    // PROCUREMENT MANAGER

    else if (
      currentRole === 'procurement_manager'
    ) {

      complete =
        !!this.procurementAnalytics;

    }


    // SUPPLY CHAIN

    else if (
      currentRole === 'supply_chain_manager'
    ) {

      complete =
        !!this.riskSummary;

    }


    // FINANCE

    else if (
      currentRole === 'finance_officer'
    ) {

      complete =
        !!this.procurementAnalytics;

    }


    // OTHER

    else {

      complete = true;

    }


    if (complete) {

      this.analyticsLoading = false;

      this.tryRenderCharts();

    }

  }


  // ============================================================
  // TRY RENDER CHARTS
  // ============================================================

  private tryRenderCharts(): void {

    if (
      !this.viewReady ||
      this.analyticsLoading
    ) {

      return;

    }


    setTimeout(() => {

      this.renderAvailableCharts();

    }, 100);

  }


  // ============================================================
  // RENDER AVAILABLE CHARTS
  // ============================================================

  private renderAvailableCharts(): void {

    this.destroyCharts();


    // ----------------------------------------------------------
    // PROCUREMENT MANAGER
    // ----------------------------------------------------------

    if (
      this.role === 'procurement_manager' &&
      this.procurementAnalytics
    ) {

      this.renderProcurementOverviewChart();

      this.renderActivePurchaseOrdersChart();

      this.renderVendorPerformanceSummaryChart();

      this.renderProcurementCostChart();

      this.renderDeliveryStatusChart();

      this.renderProcurementProcessingChart();

      return;

    }


    // ----------------------------------------------------------
    // ADMINISTRATOR / AUDITOR
    // ----------------------------------------------------------

    if (
      (
        this.role === 'administrator' ||
        this.role === 'auditor'
      ) &&
      this.analytics &&
      this.procurementAnalytics &&
      this.riskSummary
    ) {

      this.renderRiskChart();

      this.renderCategoryChart();

      this.renderComplianceChart();

      return;

    }


    // ----------------------------------------------------------
    // SUPPLY CHAIN
    // ----------------------------------------------------------

    if (
      this.role === 'supply_chain_manager' &&
      this.riskSummary
    ) {

      this.renderRiskChart();

      return;

    }


    // ----------------------------------------------------------
    // FINANCE
    // ----------------------------------------------------------

    if (
      this.role === 'finance_officer' &&
      this.procurementAnalytics
    ) {

      this.renderProcurementCostChart();

      this.renderProcurementProcessingChart();

      return;

    }


    // ----------------------------------------------------------
    // VENDOR
    // ----------------------------------------------------------

    if (
      this.role === 'vendor' &&
      this.vendorDashboard
    ) {

      this.renderVendorPerformanceChart();

      this.renderVendorReliabilityChart();

      this.renderVendorContractChart();

      this.renderVendorOrderChart();

      this.renderVendorCommunicationChart();

    }

  }


  // ============================================================
  // PROCUREMENT OVERVIEW
  // ============================================================

  private renderProcurementOverviewChart(): void {

    if (
      !this.procurementOverviewChart ||
      !this.procurementAnalytics
    ) {
      return;
    }


    const ctx =
      this.procurementOverviewChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const data =
      this.procurementAnalytics;


    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [
          'Delivery',
          'Request Completion',
          'Request Cancellation'
        ],

        datasets: [

          {
            label: 'Performance %',

            data: [

              Number(
                data.delivery_performance_rate ?? 0
              ),

              Number(
                data.request_completion_rate ?? 0
              ),

              Number(
                data.request_cancellation_rate ?? 0
              )

            ],

            borderWidth: 1,

            borderRadius: 7
          },

          {
            type: 'line',

            label: 'Purchase Volume',

            data: [

              Number(
                data.purchase_volume ?? 0
              ),

              Number(
                data.purchase_volume ?? 0
              ),

              Number(
                data.purchase_volume ?? 0
              )

            ],

            borderWidth: 2,

            tension: 0.35,

            yAxisID: 'volume'

          }

        ]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false
        },

        scales: {

          y: {

            beginAtZero: true,

            max: 100,

            title: {
              display: true,
              text: 'Percentage'
            }

          },

          volume: {

            beginAtZero: true,

            position: 'right',

            grid: {
              drawOnChartArea: false
            },

            title: {
              display: true,
              text: 'Purchase Volume'
            }

          }

        },

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // ACTIVE PURCHASE ORDERS
  // ============================================================

  private renderActivePurchaseOrdersChart(): void {

    if (
      !this.activePurchaseOrdersChart ||
      !this.summary
    ) {
      return;
    }


    const ctx =
      this.activePurchaseOrdersChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const orders: any =
      (this.summary as any).purchase_orders ?? {};


    const active =
      Number(orders.active ?? 0);

    const delivered =
      Number(orders.delivered ?? 0);

    const completed =
      Number(orders.completed ?? 0);

    const cancelled =
      Number(orders.cancelled ?? 0);


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [
          'Active',
          'Delivered',
          'Completed',
          'Cancelled'
        ],

        datasets: [{

          data: [
            active,
            delivered,
            completed,
            cancelled
          ],

          borderWidth: 2,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '62%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // VENDOR PERFORMANCE SUMMARY
  // ============================================================

  private renderVendorPerformanceSummaryChart(): void {

    if (
      !this.vendorPerformanceSummaryChart ||
      !this.procurementAnalytics
    ) {
      return;
    }


    const ctx =
      this.vendorPerformanceSummaryChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const data =
      this.procurementAnalytics;


    const delivery =
      Number(
        data.delivery_performance_rate ?? 0
      );


    const completion =
      Number(
        data.request_completion_rate ?? 0
      );


    const concentration =
      Number(
        data.supplier_concentration_top_vendor_pct ?? 0
      );


    const chart = new Chart(ctx, {

      type: 'radar',

      data: {

        labels: [
          'Delivery Performance',
          'Request Completion',
          'Supplier Concentration',
          'Processing Efficiency',
          'Order Cycle Efficiency'
        ],

        datasets: [{

          label: 'Procurement Performance',

          data: [

            delivery,

            completion,

            concentration,

            this.normalizeProcessingHours(
              data.avg_po_processing_hours
            ),

            this.normalizeProcessingHours(
              data.avg_request_to_order_cycle_hours
            )

          ],

          borderWidth: 2,

          pointRadius: 4,

          fill: true

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          r: {

            beginAtZero: true,

            min: 0,

            max: 100,

            ticks: {
              stepSize: 20
            }

          }

        },

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // PROCUREMENT COST / PROCUREMENT DISTRIBUTION
  // ============================================================

  private renderProcurementCostChart(): void {

    if (
      !this.procurementCostChart ||
      !this.procurementAnalytics
    ) {
      return;
    }


    const ctx =
      this.procurementCostChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const data =
      this.procurementAnalytics;


    /*
     * Current backend procurement-analytics response provides:
     *
     * purchase_volume
     * supplier_concentration_top_vendor_pct
     * delivery_performance_rate
     *
     * It does not currently expose a category-wise cost
     * dataset. Therefore this chart uses the available
     * procurement metrics instead of inventing cost values.
     */


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [

          'Purchase Volume',

          'Top Vendor Concentration',

          'Delivery Performance'

        ],

        datasets: [{

          data: [

            Number(
              data.purchase_volume ?? 0
            ),

            Number(
              data.supplier_concentration_top_vendor_pct ?? 0
            ),

            Number(
              data.delivery_performance_rate ?? 0
            )

          ],

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '60%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // DELIVERY STATUS
  // ============================================================

  private renderDeliveryStatusChart(): void {

    if (
      !this.deliveryStatusChart ||
      !this.procurementAnalytics
    ) {
      return;
    }


    const ctx =
      this.deliveryStatusChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const performance =
      Number(
        this.procurementAnalytics
          ?.delivery_performance_rate ?? 0
      );


    const delayed =
      Math.max(
        0,
        100 - performance
      );


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [
          'On Time',
          'Delayed'
        ],

        datasets: [{

          data: [
            performance,
            delayed
          ],

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '65%',

        plugins: {

          legend: {
            position: 'bottom'
          },

          tooltip: {

            callbacks: {

              label: (context) => {

                const value =
                  Number(
                    context.raw ?? 0
                  );

                return `${context.label}: ${value.toFixed(2)}%`;

              }

            }

          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // PROCUREMENT PROCESSING
  // ============================================================

  private renderProcurementProcessingChart(): void {

    if (
      !this.procurementProcessingChart ||
      !this.procurementAnalytics
    ) {
      return;
    }


    const ctx =
      this.procurementProcessingChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const data =
      this.procurementAnalytics;


    const requestToOrder =
      Number(
        data.avg_request_to_order_cycle_hours ?? 0
      );


    const poProcessing =
      Number(
        data.avg_po_processing_hours ?? 0
      );


    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [
          'Request → Order',
          'PO Processing'
        ],

        datasets: [{

          label: 'Average Hours',

          data: [
            requestToOrder,
            poProcessing
          ],

          borderWidth: 1,

          borderRadius: 8

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            title: {
              display: true,
              text: 'Hours'
            }

          }

        },

        plugins: {

          legend: {
            display: false
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // PROCESSING NORMALIZATION
  // ============================================================

  private normalizeProcessingHours(
    value: number | null | undefined
  ): number {

    const hours =
      Number(value ?? 0);


    if (hours <= 0) {
      return 0;
    }


    /*
     * Lower processing time = better efficiency.
     *
     * This converts the raw hour value into a
     * 0-100 efficiency representation for the radar.
     */

    const score =
      100 - (hours * 5);


    return Math.min(
      100,
      Math.max(
        0,
        score
      )
    );

  }


  // ============================================================
  // ADMIN - RISK CHART
  // ============================================================

  private renderRiskChart(): void {

    if (
      !this.riskChart ||
      !this.riskSummary
    ) {
      return;
    }


    const ctx =
      this.riskChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [
          'Low Risk',
          'Medium Risk',
          'High Risk',
          'Not Scored'
        ],

        datasets: [{

          data: [

            this.riskSummary.low ?? 0,

            this.riskSummary.medium ?? 0,

            this.riskSummary.high ?? 0,

            this.riskSummary.not_yet_scored ?? 0

          ],

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '62%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // ADMIN - CATEGORY CHART
  // ============================================================

  private renderCategoryChart(): void {

    if (
      !this.categoryChart ||
      !this.analytics
    ) {
      return;
    }


    const ctx =
      this.categoryChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const usersByRole =
      this.analytics.user_management?.by_role ?? {};


    const labels =
      Object.keys(usersByRole).map(role =>

        role
          .replace(/_/g, ' ')
          .replace(/\b\w/g, letter =>
            letter.toUpperCase()
          )

      );


    const values =
      Object.values(usersByRole) as number[];


    if (!labels.length) {
      return;
    }


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          data: values,

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '60%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // ADMIN - COMPLIANCE CHART
  // ============================================================

  private renderComplianceChart(): void {

    if (
      !this.complianceChart ||
      !this.analytics
    ) {
      return;
    }


    const ctx =
      this.complianceChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const compliance =
      this.analytics.compliance_monitoring ?? {};


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [
          'Compliant',
          'Expired',
          'Expiring Soon'
        ],

        datasets: [{

          data: [

            compliance.compliant_certifications ?? 0,

            compliance.expired_certifications ?? 0,

            compliance.expiring_certifications ?? 0

          ],

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '60%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // VENDOR - PERFORMANCE
  // ============================================================

  private renderVendorPerformanceChart(): void {

    if (
      !this.vendorPerformanceChart ||
      !this.vendorDashboard
    ) {
      return;
    }


    const ctx =
      this.vendorPerformanceChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const performance =
      this.vendorDashboard
        .vendor_performance ?? {};


    const quality =
      Number(
        performance.quality_rating ?? 0
      ) * 20;


    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [
          'Delivery',
          'Quality',
          'Completion'
        ],

        datasets: [{

          label: 'Score',

          data: [

            performance.on_time_rate ?? 0,

            quality,

            performance.order_completion_rate ?? 0

          ],

          borderRadius: 8

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            max: 100

          }

        },

        plugins: {

          legend: {
            display: false
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // VENDOR - RELIABILITY
  // ============================================================

  private renderVendorReliabilityChart(): void {

    if (
      !this.vendorReliabilityChart ||
      !this.vendorDashboard
    ) {
      return;
    }


    const ctx =
      this.vendorReliabilityChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const reliability =
      this.vendorDashboard
        .reliability_score ?? {};


    const chart = new Chart(ctx, {

      type: 'radar',

      data: {

        labels: [

          'Delivery',
          'Quality',
          'Communication',
          'Compliance',
          'Purchase History',
          'Issue Resolution'

        ],

        datasets: [{

          label: 'Reliability',

          data: [

            reliability.delivery_score ?? 0,

            reliability.quality_score ?? 0,

            reliability.communication_score ?? 0,

            reliability.compliance_score ?? 0,

            reliability.purchase_history_score ?? 0,

            reliability.issue_resolution_score ?? 0

          ],

          borderWidth: 2,

          fill: true

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          r: {

            beginAtZero: true,

            min: 0,

            max: 100

          }

        },

        plugins: {

          legend: {
            display: false
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // VENDOR - CONTRACT
  // ============================================================

  private renderVendorContractChart(): void {

    if (
      !this.vendorContractChart ||
      !this.vendorDashboard
    ) {
      return;
    }


    const ctx =
      this.vendorContractChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const contracts =
      this.vendorDashboard
        .contract_status ?? {};


    const labels =
      Object.keys(contracts).map(status =>

        status
          .replace(/_/g, ' ')
          .replace(/\b\w/g, letter =>
            letter.toUpperCase()
          )

      );


    const values =
      Object.values(contracts) as number[];


    if (!labels.length) {
      return;
    }


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          data: values,

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '58%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // VENDOR - ORDER HISTORY
  // ============================================================

  private renderVendorOrderChart(): void {

    if (
      !this.vendorOrderChart ||
      !this.vendorDashboard
    ) {
      return;
    }


    const ctx =
      this.vendorOrderChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const orders =
      this.vendorDashboard
        .order_history ?? {};


    const status =
      orders.by_status ?? {};


    const labels =
      Object.keys(status).map(value =>

        value
          .replace(/_/g, ' ')
          .replace(/\b\w/g, letter =>
            letter.toUpperCase()
          )

      );


    const values =
      Object.values(status) as number[];


    if (!labels.length) {
      return;
    }


    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels,

        datasets: [{

          label: 'Orders',

          data: values,

          borderRadius: 8

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            ticks: {
              precision: 0
            }

          }

        },

        plugins: {

          legend: {
            display: false
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // VENDOR - COMMUNICATION
  // ============================================================

  private renderVendorCommunicationChart(): void {

    if (
      !this.vendorCommunicationChart ||
      !this.vendorDashboard
    ) {
      return;
    }


    const ctx =
      this.vendorCommunicationChart.nativeElement
        .getContext('2d');

    if (!ctx) {
      return;
    }


    const messages =
      this.vendorDashboard
        .communication_activity
        ?.total_messages ?? 0;


    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [
          'Messages'
        ],

        datasets: [{

          data: [
            messages
          ],

          borderWidth: 3,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '58%',

        plugins: {

          legend: {
            position: 'bottom'
          }

        }

      }

    });

    this.charts.push(chart);

  }


  // ============================================================
  // DESTROY CHARTS
  // ============================================================

  private destroyCharts(): void {

    this.charts.forEach(chart => {

      try {

        chart.destroy();

      } catch (error) {

        console.warn(
          'Chart destroy error:',
          error
        );

      }

    });

    this.charts = [];

  }


  // ============================================================
  // REFRESH DASHBOARD
  // ============================================================

  refreshDashboard(): void {

    this.destroyCharts();

    this.summary = null;

    this.analytics = null;

    this.procurementAnalytics = null;

    this.riskSummary = null;

    this.vendorDashboard = null;

    this.procurementStatus = {

      pending: 0,

      approved: 0,

      ordered: 0,

      delivered: 0,

      completed: 0,

      cancelled: 0

    };

    this.loading = true;

    this.analyticsLoading = false;

    this.error = '';

    this.analyticsError = '';

    this.loadRoleDashboard();

  }

}