import {

  Component,

  OnInit,

  AfterViewInit,

  ViewChild,

  ElementRef,

  OnDestroy

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

export class DashboardComponent implements OnInit {

  currentUser: any = null;

  summary: DashboardSummary | null = null;
  analytics: any = null;
  procurementAnalytics: any = null;
  riskSummary: any = null;
  vendorDashboard: any = null;

  // your existing code...


  // ============================================================

  // STATE

  // ============================================================

  loading = true;

  analyticsLoading = false;

  error = '';

  analyticsError = '';

  private readonly api =

    'http://127.0.0.1:8000/api/v1';

  private charts: Chart[] = [];

  private viewReady = false;

  private renderTimer: any = null;

  // ============================================================

  // GENERAL CHART REFERENCES

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

  // ADMINISTRATOR CHART REFERENCES

  // ============================================================

  @ViewChild('adminUserChart')

  adminUserChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('adminRiskChart')

  adminRiskChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('adminProcurementChart')

  adminProcurementChart?: ElementRef<HTMLCanvasElement>;

  @ViewChild('adminComplianceChart')

  adminComplianceChart?: ElementRef<HTMLCanvasElement>;

  // ============================================================

  // PROCUREMENT MANAGER CHART REFERENCES

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
  // ============================================================

  // VENDOR CHART REFERENCES

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

        'Procurement Manager Dashboard',

      supply_chain_manager:

        'Supply Chain Manager Dashboard',

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

        'Monitor procurement requests, purchase orders, suppliers and procurement performance.',

      supply_chain_manager:

        'Monitor vendors, delivery performance, reliability, risk and supply chain operations.',

      vendor:

        'Monitor your purchase orders, contracts, communication and vendor performance.',

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

  // INITIALIZATION

  // ============================================================

  ngOnInit(): void {

    this.loadRoleDashboard();

  }

  ngAfterViewInit(): void {

    this.viewReady = true;

    this.scheduleChartRender();

  }

  ngOnDestroy(): void {

    if (this.renderTimer) {

      clearTimeout(this.renderTimer);

    }

    this.destroyCharts();

  }

  // ============================================================

  // LOAD DASHBOARD

  // ============================================================

  private loadRoleDashboard(): void {

    this.loading = true;

    this.analyticsLoading = false;

    this.error = '';

    this.analyticsError = '';

    this.summary = null;

    this.analytics = null;

    this.procurementAnalytics = null;

    this.riskSummary = null;

    this.vendorDashboard = null;

    this.dashboardService.summary().subscribe({

      next: (data) => {

        this.summary = data;

        this.loading = false;

        this.loadRoleAnalytics();

      },

      error: (error) => {

        console.error(

          'Dashboard summary error:',

          error

        );

        this.loading = false;

        this.error =

          'Could not load dashboard summary.';

      }

    });

  }

  // ============================================================

  // LOAD ROLE-SPECIFIC ANALYTICS

  // ============================================================

  private loadRoleAnalytics(): void {

    const currentRole = this.role;

    if (!currentRole) {

      this.analyticsLoading = false;

      return;

    }

    this.analyticsLoading = true;

    this.analyticsError = '';

    if (currentRole === 'administrator') {

      this.loadAdministratorAnalytics();

      return;

    }

    if (currentRole === 'procurement_manager') {

      this.loadProcurementDashboardAnalytics();

      return;

    }

    if (currentRole === 'supply_chain_manager') {

      this.loadRiskAnalytics();

      return;

    }

    if (currentRole === 'finance_officer') {

      this.loadProcurementAnalytics();

      return;

    }

    if (currentRole === 'auditor') {

      this.loadAuditorAnalytics();

      return;

    }

    if (currentRole === 'vendor') {

      this.loadVendorAnalytics();

      return;

    }

    this.analyticsLoading = false;

  }

  // ============================================================

  // ADMINISTRATOR ANALYTICS

  // ============================================================

  private loadAdministratorAnalytics(): void {

    this.http

      .get<any>(

        `${this.api}/analytics/admin-dashboard`

      )

      .subscribe({

        next: (data) => {

          console.log(

            'Administrator analytics:',

            data

          );

          this.analytics = data;

          this.analyticsLoading = false;

          this.scheduleChartRender();

          this.loadRiskSummary();

        },

        error: (error) => {

          console.error(

            'Administrator analytics error:',

            error

          );

          this.analyticsError =

            'Failed to load administrator analytics.';

          this.analyticsLoading = false;

          this.scheduleChartRender();

        }

      });

  }

  // ============================================================

  // AUDITOR ANALYTICS

  // ============================================================

  private loadAuditorAnalytics(): void {

    let completed = 0;

    const finish = (): void => {

      completed += 1;

      if (completed === 3) {

        this.analyticsLoading = false;

        this.scheduleChartRender();

      }

    };

    this.http

      .get<any>(

        `${this.api}/analytics/admin-dashboard`

      )

      .subscribe({

        next: (data) => {

          console.log('Auditor system analytics:', data);

          this.analytics = data;

          finish();

        },

        error: (error) => {

          console.error('Auditor system analytics error:', error);

          this.analytics = null;

          this.analyticsError =

            'Failed to load auditor system analytics.';

          finish();

        }

      });

    this.http

      .get<any>(

        `${this.api}/analytics/procurement-dashboard`

      )

      .subscribe({

        next: (data) => {

          console.log('Auditor procurement analytics:', data);

          this.procurementAnalytics = data;

          finish();

        },

        error: (error) => {

          console.error('Auditor procurement analytics error:', error);

          this.procurementAnalytics = null;

          this.analyticsError =

            'Failed to load auditor procurement analytics.';

          finish();

        }

      });

    this.http

      .get<any>(

        `${this.api}/reliability/risk-summary`

      )

      .subscribe({

        next: (data) => {

          console.log('Auditor risk analytics:', data);

          this.riskSummary = data;

          finish();

        },

        error: (error) => {

          console.error('Auditor risk analytics error:', error);

          this.riskSummary = null;

          this.analyticsError =

            'Failed to load auditor risk analytics.';

          finish();

        }

      });

  }

  // ============================================================

  // RISK SUMMARY

  // ============================================================

  private loadRiskSummary(): void {

    this.http

      .get<any>(

        `${this.api}/reliability/risk-summary`

      )

      .subscribe({

        next: (data) => {

          console.log(

            'Risk summary:',

            data

          );

          this.riskSummary = data;

          this.scheduleChartRender();

        },

        error: (error) => {

          console.error(

            'Risk summary error:',

            error

          );

          this.riskSummary = null;

          this.scheduleChartRender();

        }

      });

  }

  // ============================================================

  // PROCUREMENT ANALYTICS

  // ============================================================

    // ============================================================

  // PROCUREMENT MANAGER DASHBOARD

  // ============================================================

  private loadProcurementDashboardAnalytics(): void {

    this.http

      .get<any>(

        `${this.api}/analytics/procurement-dashboard`

      )

      .subscribe({

        next: (data) => {

          console.log(

            'Procurement Manager dashboard:',

            data

          );

          this.procurementAnalytics = data;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        },

        error: (error) => {

          console.error(

            'Procurement Manager dashboard error:',

            error

          );

          this.analyticsError =

            'Failed to load procurement manager dashboard.';

          this.procurementAnalytics = null;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        }

      });

  }

private loadProcurementAnalytics(): void {

    this.http

      .get<any>(

        `${this.api}/analytics/procurement-dashboard`

      )

      .subscribe({

        next: (data) => {

          console.log(

            'Procurement analytics:',

            data

          );

          this.procurementAnalytics = data;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        },

        error: (error) => {

          console.error(

            'Procurement analytics error:',

            error

          );

          this.analyticsError =

            'Failed to load procurement analytics.';

          this.procurementAnalytics = null;

          this.analyticsLoading = false;

          this.scheduleChartRender();

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

          console.log(

            'Risk analytics:',

            data

          );

          this.riskSummary = data;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        },

        error: (error) => {

          console.error(

            'Risk analytics error:',

            error

          );

          this.analyticsError =

            'Failed to load risk analytics.';

          this.riskSummary = null;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        }

      });

  }

  // ============================================================

  // VENDOR ANALYTICS

  // ============================================================

  private loadVendorAnalytics(): void {

    this.http

      .get<any>(

        `${this.api}/analytics/vendor-dashboard/me`

      )

      .subscribe({

        next: (data) => {

          console.log(

            'Vendor analytics:',

            data

          );

          this.vendorDashboard = data;

          this.loading = false;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        },

        error: (error) => {

          console.error(

            'Vendor analytics error:',

            error

          );

          this.analyticsError =

            'Failed to load vendor analytics.';

          this.vendorDashboard = null;

          this.loading = false;

          this.analyticsLoading = false;

          this.scheduleChartRender();

        }

      });

  }

  // ============================================================

  // SCHEDULE CHART RENDERING

  // ============================================================

  private scheduleChartRender(): void {

    if (!this.viewReady) {

      return;

    }

    if (this.renderTimer) {

      clearTimeout(this.renderTimer);

    }

    this.renderTimer = setTimeout(() => {

      this.renderAvailableCharts();

    }, 300);

  }

  // ============================================================

  // RENDER AVAILABLE CHARTS

  // ============================================================

  private renderAvailableCharts(): void {

    if (!this.viewReady) {

      return;

    }

    this.destroyCharts();

    // ==========================================================

    // ADMINISTRATOR

    // ==========================================================

    if (this.role === 'administrator') {

      if (this.analytics) {

        this.renderAdminUserChart();

        this.renderAdminProcurementChart();

        this.renderAdminComplianceChart();

      }

      if (this.riskSummary) {

        this.renderAdminRiskChart();

      }

      return;

    }

    // ==========================================================

    // PROCUREMENT MANAGER

    // ==========================================================

    if (this.role === 'procurement_manager') {
      if (this.procurementAnalytics) {
        this.renderProcurementOverviewChart();
        this.renderActivePurchaseOrdersChart();
        this.renderVendorPerformanceSummaryChart();
        this.renderProcurementCostChart();
        this.renderDeliveryStatusChart();
      }

      return;
    }

    // ==========================================================

    // ==========================================================
    // SUPPLY CHAIN MANAGER
    // NO CHARTS
    // ==========================================================

    if (this.role === 'supply_chain_manager') {
      return;
    }

    // ==========================================================
    // FINANCE OFFICER
    // NO CHARTS
    // ==========================================================

    if (this.role === 'finance_officer') {
      return;
    }

    // ==========================================================
    // AUDITOR
    // NO CHARTS
    // ==========================================================

    if (this.role === 'auditor') {
      return;
    }

    // VENDOR

    // ==========================================================

    if (

      this.role === 'vendor' &&

      this.vendorDashboard

    ) {

      this.renderVendorCharts();

    }

  }

  // ============================================================

  // ADMIN — USER MANAGEMENT

  // ============================================================

  private renderAdminUserChart(): void {

    if (!this.adminUserChart || !this.analytics) {

      return;

    }

    const ctx =

      this.adminUserChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const userManagement =

      this.analytics.user_management ?? {};

    const byRole =

      userManagement.by_role ?? {};

    const labels =

      Object.keys(byRole).map(role =>

        role

          .replace(/_/g, ' ')

          .replace(/\b\w/g, letter =>

            letter.toUpperCase()

          )

      );

    const values =

      Object.values(byRole).map(

        value => Number(value) || 0

      );

    if (!labels.length) {

      return;

    }

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          label: 'Users',

          data: values,

          backgroundColor: [

            '#2563eb',

            '#7c3aed',

            '#0891b2',

            '#16a34a',

            '#f59e0b',

            '#ef4444'

          ],

          borderWidth: 2,

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

          },

          tooltip: {

            callbacks: {

              label: (context) => {

                const value =

                  Number(context.raw ?? 0);

                return `${context.label}: ${value} users`;

              }

            }

          }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // ADMIN — VENDOR RISK

  // ============================================================

  private renderAdminRiskChart(): void {

    if (

      !this.adminRiskChart ||

      !this.riskSummary

    ) {

      return;

    }

    const ctx =

      this.adminRiskChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const labels = [

      'Low Risk',

      'Medium Risk',

      'High Risk',

      'Critical Risk'

    ];

    const values = [

      Number(

        this.riskSummary.low_risk ??

        this.riskSummary.low ??

        0

      ),

      Number(

        this.riskSummary.medium_risk ??

        this.riskSummary.medium ??

        0

      ),

      Number(

        this.riskSummary.high_risk ??

        this.riskSummary.high ??

        0

      ),

      Number(

        this.riskSummary.critical_risk ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels,

        datasets: [{

          label: 'Vendors',

          data: values,

          backgroundColor: [

            '#22c55e',

            '#f59e0b',

            '#ef4444',

            '#991b1b'

          ],

          borderWidth: 1

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

          legend: {

            display: false

          },

          tooltip: {

            callbacks: {

              label: (context) => {

                const value =

                  Number(context.raw ?? 0);

                return `${value} vendors`;

              }

            }

          }

        },

        scales: {

          y: {

            beginAtZero: true,

            ticks: {

              precision: 0

            },

            title: {

              display: true,

              text: 'Number of Vendors'

            }

          }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // ADMIN — PROCUREMENT REPORTS

  // ============================================================

  private renderAdminProcurementChart(): void {

    if (

      !this.adminProcurementChart ||

      !this.analytics

    ) {

      return;

    }

    const ctx =

      this.adminProcurementChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const procurement =

      this.analytics.procurement_reports ?? {};

    const labels = [

      'Requests',

      'Purchase Orders',

      'Pending Approvals'

    ];

    const values = [

      Number(

        procurement.requests ??

        this.summary?.procurement?.total_requests ??

        0

      ),

      Number(

        procurement.purchase_orders ??

        this.summary?.purchase_orders?.total ??

        0

      ),

      Number(

        procurement.pending_approvals ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels,

        datasets: [{

          label: 'Procurement Activity',

          data: values,

          backgroundColor: [

            '#2563eb',

            '#7c3aed',

            '#f59e0b'

          ],

          borderWidth: 1

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

          legend: {

            display: false

          }

        },

        scales: {

          y: {

            beginAtZero: true,

            ticks: {

              precision: 0

            },

            title: {

              display: true,

              text: 'Count'

            }

          }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // ADMIN — COMPLIANCE

  // ============================================================

  private renderAdminComplianceChart(): void {

    if (

      !this.adminComplianceChart ||

      !this.analytics

    ) {

      return;

    }

    const ctx =

      this.adminComplianceChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const compliance =

      this.analytics.compliance_monitoring ?? {};

    const labels = [

      'Compliant',

      'Expiring Soon',

      'Expired'

    ];

    const values = [

      Number(

        compliance.compliant_certifications ??

        0

      ),

      Number(

        compliance.expiring_certifications ??

        0

      ),

      Number(

        compliance.expired_certifications ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          data: values,

          backgroundColor: [

            '#16a34a',

            '#f59e0b',

            '#dc2626'

          ],

          borderWidth: 2,

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

          },

          tooltip: {

            callbacks: {

              label: (context) => {

                const value =

                  Number(context.raw ?? 0);

                return `${context.label}: ${value}`;

              }

            }

          }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // GENERAL RISK CHART

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

    const values = [

      Number(

        this.riskSummary.low_risk ??

        this.riskSummary.low ??

        0

      ),

      Number(

        this.riskSummary.medium_risk ??

        this.riskSummary.medium ??

        0

      ),

      Number(

        this.riskSummary.high_risk ??

        this.riskSummary.high ??

        0

      ),

      Number(

        this.riskSummary.critical_risk ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [

          'Low Risk',

          'Medium Risk',

          'High Risk',

          'Critical Risk'

        ],

        datasets: [{

          data: values,

          backgroundColor: [

            '#22c55e',

            '#f59e0b',

            '#ef4444',

            '#991b1b'

          ],

          borderWidth: 2,

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

          }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // CATEGORY CHART

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

    const categories =

      this.analytics.vendor_analytics

        ?.by_category ?? {};

    const labels =

      Object.keys(categories).map(category =>

        category

          .replace(/_/g, ' ')

          .replace(/\b\w/g, letter =>

            letter.toUpperCase()

          )

      );

    const values =

      Object.values(categories).map(

        value => Number(value) || 0

      );

    if (!labels.length) {

      return;

    }

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          data: values,

          backgroundColor: [

            '#2563eb',

            '#7c3aed',

            '#0891b2',

            '#16a34a',

            '#f59e0b',

            '#ef4444',

            '#ec4899',

            '#64748b'

          ],

          borderWidth: 2,

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

  // COMPLIANCE CHART

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

            Number(

              compliance.compliant_certifications ??

              0

            ),

            Number(

              compliance.expired_certifications ??

              0

            ),

            Number(

              compliance.expiring_certifications ??

              0

            )

          ],

          backgroundColor: [

            '#16a34a',

            '#dc2626',

            '#f59e0b'

          ],

          borderWidth: 2,

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

  // PROCUREMENT — OVERVIEW

  // ============================================================

    private renderProcurementOverviewChart(): void {

    if (!this.procurementOverviewChart || !this.procurementAnalytics) return;

    const ctx = this.procurementOverviewChart.nativeElement.getContext('2d');

    if (!ctx) return;

    const overview = this.procurementAnalytics.procurement_overview ?? {};

    const labels = [

      'Pending', 'Approved', 'Ordered',

      'Delivered', 'Completed', 'Cancelled'

    ];

    const values = [

      Number(overview.pending_requests ?? 0),

      Number(overview.approved_requests ?? 0),

      Number(overview.ordered_requests ?? 0),

      Number(overview.delivered_requests ?? 0),

      Number(overview.completed_requests ?? 0),

      Number(overview.cancelled_requests ?? 0)

    ];

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels,

        datasets: [{

          label: 'Procurement Requests',

          data: values,

          backgroundColor: [

            '#f59e0b', '#2563eb', '#7c3aed',

            '#0891b2', '#16a34a', '#dc2626'

          ],

          borderWidth: 1

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            ticks: { precision: 0 }

          }

        },

        plugins: {

          legend: { display: false }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // PROCUREMENT — ACTIVE PURCHASE ORDERS

  // ============================================================

  private renderActivePurchaseOrdersChart(): void {

    if (!this.activePurchaseOrdersChart || !this.procurementAnalytics) return;

    const ctx = this.activePurchaseOrdersChart.nativeElement.getContext('2d');

    if (!ctx) return;

    const orders = this.procurementAnalytics.active_purchase_orders ?? {};

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: ['Active', 'Pending', 'In Transit', 'Overdue'],

        datasets: [{

          data: [

            Number(orders.active ?? 0),

            Number(orders.pending ?? 0),

            Number(orders.in_transit ?? 0),

            Number(orders.overdue ?? 0)

          ],

          backgroundColor: [

            '#2563eb', '#f59e0b', '#0891b2', '#dc2626'

          ],

          borderWidth: 2,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '58%',

        plugins: {

          legend: { position: 'bottom' }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // PROCUREMENT — VENDOR PERFORMANCE

  // ============================================================

  private renderVendorPerformanceSummaryChart(): void {

    if (!this.vendorPerformanceSummaryChart || !this.procurementAnalytics) return;

    const ctx = this.vendorPerformanceSummaryChart.nativeElement.getContext('2d');

    if (!ctx) return;

    const data = this.procurementAnalytics.vendor_performance_summary ?? {};

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [

          'Performance Score',

          'Quality Rating',

          'On-Time Delivery',

          'Response Time (hrs)'

        ],

        datasets: [{

          label: 'Vendor Performance',

          data: [

            Number(data.avg_performance_score ?? 0),

            Number(data.avg_quality_rating ?? 0),

            Number(data.avg_on_time_delivery_rate ?? 0),

            Number(data.avg_response_time_hours ?? 0)

          ],

          backgroundColor: [

            '#2563eb', '#7c3aed', '#16a34a', '#f59e0b'

          ],

          borderWidth: 1

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: { beginAtZero: true }

        },

        plugins: {

          legend: { display: false }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // AUDITOR — VENDOR PERFORMANCE SUMMARY

  // ============================================================

  private renderAuditorPerformanceSummaryChart(): void {

    if (!this.vendorPerformanceSummaryChart || !this.procurementAnalytics) return;

    const ctx = this.vendorPerformanceSummaryChart.nativeElement.getContext('2d');

    if (!ctx) return;

    const data = this.procurementAnalytics.vendor_performance_summary ?? {};

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [
          'Performance Score',
          'Quality Rating',
          'On-Time Delivery',
          'Response Time (hrs)',
          'Issue Resolution Rate'
        ],

        datasets: [{
          label: 'Vendor Performance',
          data: [
            Number(data.avg_performance_score ?? 0),
            Number(data.avg_quality_rating ?? 0),
            Number(data.avg_on_time_delivery_rate ?? 0),
            Number(data.avg_response_time_hours ?? 0),
            Number(data.issue_resolution_rate ?? 0)
          ],
          backgroundColor: [
            '#2563eb', '#7c3aed', '#16a34a', '#f59e0b', '#0891b2'
          ],
          borderWidth: 1
        }]

      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { display: false }
        }
      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // PROCUREMENT — COST ANALYSIS

  // ============================================================

  private renderProcurementCostChart(): void {

    if (!this.procurementCostChart || !this.procurementAnalytics) return;

    const ctx = this.procurementCostChart.nativeElement.getContext('2d');

    if (!ctx) return;

    const cost = this.procurementAnalytics.procurement_cost_analysis ?? {};

    const byCategory = cost.cost_by_category ?? {};

    let labels = Object.keys(byCategory);

    let values = Object.values(byCategory).map(

      value => Number(value) || 0

    );

    if (!labels.length) {

      labels = ['Total Cost'];

      values = [Number(cost.total_cost ?? 0)];

    }

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels,

        datasets: [{

          label: 'Procurement Cost',

          data: values,

          backgroundColor: [

            '#2563eb', '#7c3aed', '#0891b2', '#16a34a',

            '#f59e0b', '#ef4444', '#ec4899', '#64748b'

          ],

          borderWidth: 1

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            ticks: {

              callback: (value) =>

                `₹${Number(value).toLocaleString('en-IN')}`

            }

          }

        },

        plugins: {

          legend: { display: false }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // PROCUREMENT — DELIVERY STATUS

  // ============================================================

  private renderDeliveryStatusChart(): void {

    if (!this.deliveryStatusChart || !this.procurementAnalytics) return;

    const ctx = this.deliveryStatusChart.nativeElement.getContext('2d');

    if (!ctx) return;

    const delivery = this.procurementAnalytics.delivery_status ?? {};

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [

          'On-Time Deliveries',

          'Delayed Deliveries',

          'Pending Deliveries'

        ],

        datasets: [{

          data: [

            Number(delivery.on_time_deliveries ?? 0),

            Number(delivery.delayed_deliveries ?? 0),

            Number(delivery.pending_deliveries ?? 0)

          ],

          backgroundColor: [

            '#16a34a', '#dc2626', '#f59e0b'

          ],

          borderWidth: 2,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '60%',

        plugins: {

          legend: { position: 'bottom' }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================
// FINANCE — PERFORMANCE

  // ============================================================

  private renderPerformanceChart(): void {

    if (

      !this.performanceChart ||

      !this.procurementAnalytics

    ) {

      return;

    }

    const ctx =

      this.performanceChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const data =

      this.procurementAnalytics;

    const values = [

      Number(

        data.delivery_performance_rate ??

        0

      ),

      Number(

        data.request_completion_rate ??

        0

      ),

      Number(

        data.request_cancellation_rate ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [

          'Delivery Performance',

          'Request Completion',

          'Request Cancellation'

        ],

        datasets: [{

          label: 'Percentage',

          data: values,

          backgroundColor: [

            '#16a34a',

            '#2563eb',

            '#dc2626'

          ],

          borderWidth: 1

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

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // FINANCE — PROCESSING CYCLE

  // ============================================================

  private renderCycleChart(): void {

    if (

      !this.cycleChart ||

      !this.procurementAnalytics

    ) {

      return;

    }

    const ctx =

      this.cycleChart.nativeElement

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

          'Request → Order',

          'PO Processing'

        ],

        datasets: [{

          label: 'Average Hours',

          data: [

            Number(

              data.avg_request_to_order_cycle_hours ??

              0

            ),

            Number(

              data.avg_po_processing_hours ??

              0

            )

          ],

          backgroundColor: [

            '#2563eb',

            '#7c3aed'

          ],

          borderWidth: 1

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true

          }

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // VENDOR CHARTS

  // ============================================================

  private renderVendorCharts(): void {

    if (!this.vendorDashboard) {

      return;

    }

    this.renderVendorPerformanceChart();

    this.renderVendorReliabilityChart();

    this.renderVendorContractChart();

    this.renderVendorOrderChart();

    this.renderVendorCommunicationChart();

  }

  // ============================================================

  // VENDOR — PERFORMANCE

  // ============================================================

  private renderVendorPerformanceChart(): void {

    if (!this.vendorPerformanceChart) {

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

    const values = [

      Number(

        performance.delivery_performance ??

        0

      ),

      Number(

        performance.quality_score ??

        0

      ),

      Number(

        performance.communication_score ??

        0

      ),

      Number(

        performance.compliance_score ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'bar',

      data: {

        labels: [

          'Delivery',

          'Quality',

          'Communication',

          'Compliance'

        ],

        datasets: [{

          label: 'Score',

          data: values,

          backgroundColor: [

            '#2563eb',

            '#7c3aed',

            '#0891b2',

            '#16a34a'

          ],

          borderWidth: 1

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

        }

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // VENDOR — RELIABILITY

  // ============================================================

  private renderVendorReliabilityChart(): void {

    if (!this.vendorReliabilityChart) {

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

    const score =

      Math.min(

        100,

        Math.max(

          0,

          Number(

            reliability.score ??

            0

          )

        )

      );

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels: [

          'Reliability Score',

          'Remaining'

        ],

        datasets: [{

          data: [

            score,

            Math.max(

              0,

              100 - score

            )

          ],

          backgroundColor: [

            '#16a34a',

            '#e5e7eb'

          ],

          borderWidth: 2,

          borderColor: '#ffffff'

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: '70%',

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

  // VENDOR — CONTRACT STATUS

  // ============================================================

  private renderVendorContractChart(): void {

    if (!this.vendorContractChart) {

      return;

    }

    const ctx =

      this.vendorContractChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const contract =

      this.vendorDashboard

        .contract_status ?? {};

    const labels = [

      'Active',

      'Expiring Soon',

      'Under Renewal',

      'Expired'

    ];

    const values = [

      Number(

        contract.active ??

        0

      ),

      Number(

        contract.expiring_soon ??

        0

      ),

      Number(

        contract.under_renewal ??

        0

      ),

      Number(

        contract.expired ??

        0

      )

    ];

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          data: values,

          backgroundColor: [

            '#16a34a',

            '#f59e0b',

            '#2563eb',

            '#dc2626'

          ],

          borderWidth: 2,

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

  // VENDOR — ORDER HISTORY

  // ============================================================

  private renderVendorOrderChart(): void {

    if (!this.vendorOrderChart) {

      return;

    }

    const ctx =

      this.vendorOrderChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const history =

      this.vendorDashboard

        .order_history;

    if (

      !Array.isArray(history) ||

      history.length === 0

    ) {

      return;

    }

    const labels =

      history.map((item: any) =>

        item.month ??

        item.period ??

        item.date ??

        ''

      );

    const values =

      history.map((item: any) =>

        Number(

          item.order_value ??

          item.value ??

          item.total_value ??

          0

        )

      );

    const chart = new Chart(ctx, {

      type: 'line',

      data: {

        labels,

        datasets: [{

          label: 'Order Value',

          data: values,

          tension: 0.3,

          fill: true,

          borderColor: '#2563eb',

          backgroundColor: 'rgba(37, 99, 235, 0.15)',

          borderWidth: 2

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false

      }

    });

    this.charts.push(chart);

  }

  // ============================================================

  // VENDOR — COMMUNICATION

  // ============================================================

  private renderVendorCommunicationChart(): void {

    if (!this.vendorCommunicationChart) {

      return;

    }

    const ctx =

      this.vendorCommunicationChart.nativeElement

        .getContext('2d');

    if (!ctx) {

      return;

    }

    const communication =

      this.vendorDashboard

        .communication_activity ?? {};

    const labels =

      Object.keys(communication).map(key =>

        key

          .replace(/_/g, ' ')

          .replace(/\b\w/g, letter =>

            letter.toUpperCase()

          )

      );

    const values =

      Object.values(communication).map(

        value => Number(value) || 0

      );

    if (!values.length) {

      return;

    }

    const chart = new Chart(ctx, {

      type: 'doughnut',

      data: {

        labels,

        datasets: [{

          data: values,

          backgroundColor: [

            '#2563eb',

            '#7c3aed',

            '#0891b2',

            '#16a34a',

            '#f59e0b',

            '#ef4444'

          ],

          borderWidth: 2,

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

  // DESTROY CHARTS

  // ============================================================

  private destroyCharts(): void {

    this.charts.forEach(chart => {

      try {

        chart.destroy();

      } catch {

        // Ignore already destroyed charts

      }

    });

    this.charts = [];

  }

  // ============================================================

  // REFRESH DASHBOARD

  // ============================================================

  refreshDashboard(): void {

    this.destroyCharts();

    this.loading = true;

    this.analyticsLoading = false;

    this.error = '';

    this.analyticsError = '';

    this.summary = null;

    this.analytics = null;

    this.procurementAnalytics = null;

    this.riskSummary = null;

    this.vendorDashboard = null;

    this.loadRoleDashboard();

  }

}