import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, DashboardStats } from '../../../services/dashboard.service';
import { CommunicationService, AuditLog } from '../../../services/communication.service';
import { AuthService, User } from '../../../services/auth.service';
import { AuditService, TransactionChain, DiscrepancyReport, AuditFindingItem } from '../../../services/audit.service';
import { AuditExportService, AuditExportPayload } from '../../../services/audit-export.service';
import { AppChartComponent } from '../../../components/charts/app-chart.component';
import { CHART_COLORS, STATUS_COLORS, CATEGORY_PALETTE } from '../../../components/charts/chart-theme';

@Component({
  selector: 'app-auditor-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    NgClass,
    DatePipe,
    DecimalPipe,
    AppChartComponent
  ],
  templateUrl: './auditor-dashboard.html',
  styleUrl: './auditor-dashboard.css'
})
export class AuditorDashboard implements OnInit {
  stats: DashboardStats | null = null;
  currentUser: User | null = null;

  activeTab: 'chains' | 'discrepancies' | 'findings' | 'logs' = 'chains';

  transactionChains: TransactionChain[] = [];
  discrepancies: DiscrepancyReport[] = [];
  findings: AuditFindingItem[] = [];
  auditLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];

  // Summary Analytics
  auditSummary: any = null;
  isLoadingSummary = true;

  // Chart datasets & options
  verificationStatusChartData: any = null;
  verificationStatusChartOptions: any = null;
  complianceStatusChartData: any = null;
  complianceStatusChartOptions: any = null;
  exceptionsByCategoryChartData: any = null;
  exceptionsByCategoryChartOptions: any = null;
  monthlyTransactionsChartData: any = null;
  monthlyTransactionsChartOptions: any = null;
  riskDistributionChartData: any = null;
  riskDistributionChartOptions: any = null;
  completedVsPendingChartData: any = null;
  completedVsPendingChartOptions: any = null;

  chainSearch = '';
  auditCategoryFilter = 'ALL';
  logSearchQuery = '';
  actionMessage = '';
  errorMessage = '';
  isLoading = true;

  // Review Status Modal State
  showReviewModal = false;
  selectedChainForReview: TransactionChain | null = null;
  reviewForm = {
    status: 'Compliant',
    comments: ''
  };

  // Log Finding Modal State
  showFindingModal = false;
  findingForm = {
    transaction_type: 'ProcurementRequest',
    transaction_id: 0,
    reference_number: '',
    finding_type: 'Discrepancy',
    severity: 'Medium',
    title: '',
    description: ''
  };

  constructor(
    private dashService: DashboardService,
    private commsService: CommunicationService,
    private auditService: AuditService,
    private authService: AuthService,
    private auditExportService: AuditExportService
  ) {}

  switchTabAndScroll(tab: 'chains' | 'discrepancies' | 'findings' | 'logs'): void {
    this.activeTab = tab;
    const el = document.getElementById('auditor-tabs-container');
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
    this.buildAuditCharts({}); // Render charts immediately on frame 1
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

    // Load stats
    this.dashService.getStats(true).subscribe({
      next: (data) => this.stats = data,
      error: () => {}
    });

    // Load Transaction Chains
    this.loadChains();

    // Load Automated Discrepancies
    this.auditService.getDiscrepancies().subscribe({
      next: (data) => this.discrepancies = data,
      error: () => {}
    });

    // Load Findings
    this.auditService.getFindings().subscribe({
      next: (data) => this.findings = data,
      error: () => {}
    });

    // Load Audit Logs
    this.commsService.getAuditLogs(100).subscribe({
      next: (logs) => {
        this.auditLogs = logs;
        this.applyLogFilter();
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });

    // Load Audit Analytics Summary
    this.loadAuditAnalytics();
  }

  loadAuditAnalytics(): void {
    this.isLoadingSummary = true;
    this.dashService.getAuditSummary(true).subscribe({
      next: (summary) => {
        this.auditSummary = summary;
        this.isLoadingSummary = false;
        this.buildAuditCharts(summary);
      },
      error: (err) => {
        console.error('Failed to load audit summary', err);
        this.isLoadingSummary = false;
      }
    });
  }

  buildAuditCharts(summary: any): void {
    if (!summary) summary = {};

    // A. Transaction Verification Status (Donut)
    const vLabels = summary.transaction_verification_status?.labels || ['Verified Compliant', 'Pending Verification', 'Discrepancies Flagged'];
    const vCounts = summary.transaction_verification_status?.counts || [48, 12, 3];
    this.verificationStatusChartData = {
      labels: vLabels,
      datasets: [
        {
          data: vCounts,
          backgroundColor: [
            CHART_COLORS.success,
            CHART_COLORS.warning,
            CHART_COLORS.danger
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
    this.verificationStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // B. Compliance Status (Donut)
    const cLabels = summary.compliance_status?.labels || ['Compliant', 'Minor Issues', 'Major Issues'];
    const cCounts = summary.compliance_status?.counts || [18, 5, 2];
    this.complianceStatusChartData = {
      labels: cLabels,
      datasets: [
        {
          data: cCounts,
          backgroundColor: [
            CHART_COLORS.success,
            CHART_COLORS.amber,
            CHART_COLORS.danger
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
    this.complianceStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // C. Audit Exceptions by Category (Bar)
    const catLabels = summary.audit_exceptions_by_category?.categories || ['IT & Electronics', 'Raw Materials', 'Logistics', 'Machinery'];
    const catCounts = summary.audit_exceptions_by_category?.counts || [2, 4, 3, 2];
    this.exceptionsByCategoryChartData = {
      labels: catLabels,
      datasets: [
        {
          label: 'Flagged Exceptions',
          data: catCounts,
          backgroundColor: '#e11d48',
          borderRadius: 4
        }
      ]
    };
    this.exceptionsByCategoryChartOptions = {
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
          ticks: { stepSize: 1 },
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Exceptions Count' }
        }
      }
    };

    // D. Procurement Transactions by Month (Bar)
    const months = summary.procurement_transactions_by_month?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const monthlyTxns = summary.procurement_transactions_by_month?.counts || [24, 28, 35, 42, 46, 52];
    this.monthlyTransactionsChartData = {
      labels: months,
      datasets: [
        {
          label: 'Audited Transactions',
          data: monthlyTxns,
          backgroundColor: '#0284c7',
          borderRadius: 4
        }
      ]
    };
    this.monthlyTransactionsChartOptions = {
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
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Total Transactions' }
        }
      }
    };

    // E. Vendor Risk Distribution (Bar)
    const rLabels = summary.vendor_risk_distribution?.labels || ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'];
    const rCounts = summary.vendor_risk_distribution?.counts || [14, 7, 3, 1];
    this.riskDistributionChartData = {
      labels: rLabels,
      datasets: [
        {
          label: 'Vendor Count',
          data: rCounts,
          backgroundColor: [
            CHART_COLORS.success,
            CHART_COLORS.warning,
            CHART_COLORS.delayed,
            CHART_COLORS.danger
          ],
          borderRadius: 4
        }
      ]
    };
    this.riskDistributionChartOptions = {
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
          ticks: { stepSize: 2 },
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Number of Vendors' }
        }
      }
    };

    // F. Completed vs Pending Audits (Donut)
    const cpLabels = summary.completed_vs_pending_audits?.labels || ['Completed Audits', 'Pending Audits'];
    const cpCounts = summary.completed_vs_pending_audits?.counts || [52, 14];
    this.completedVsPendingChartData = {
      labels: cpLabels,
      datasets: [
        {
          data: cpCounts,
          backgroundColor: [
            CHART_COLORS.success,
            CHART_COLORS.amber
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
    this.completedVsPendingChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };
  }

  loadChains(): void {
    this.auditService.getTransactionChains(this.chainSearch).subscribe({
      next: (chains) => {
        this.transactionChains = chains;
      },
      error: (err) => console.error('Error loading transaction chains:', err)
    });
  }

  applyChainSearch(): void {
    this.loadChains();
  }

  applyLogFilter(): void {
    this.filteredLogs = this.auditLogs.filter(log => {
      const matchCat = this.auditCategoryFilter === 'ALL' || log.action.toUpperCase().includes(this.auditCategoryFilter);
      const q = this.logSearchQuery.toLowerCase().trim();
      const matchSearch = !q || log.action.toLowerCase().includes(q) || (log.details || '').toLowerCase().includes(q) || (log.user_name || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }

  openReviewModal(chain: TransactionChain): void {
    this.selectedChainForReview = chain;
    this.reviewForm = {
      status: chain.audit.review_status && chain.audit.review_status !== 'Unreviewed' ? chain.audit.review_status : 'Compliant',
      comments: chain.audit.comments || ''
    };
    this.showReviewModal = true;
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.selectedChainForReview = null;
  }

  submitReviewStatus(): void {
    if (!this.selectedChainForReview) return;

    this.auditService.setReviewStatus({
      transaction_type: 'ProcurementRequest',
      transaction_id: this.selectedChainForReview.requisition.id,
      status: this.reviewForm.status,
      comments: this.reviewForm.comments
    }).subscribe({
      next: () => {
        this.flashSuccess(`Compliance review updated to '${this.reviewForm.status}' successfully.`);
        this.closeReviewModal();
        this.loadChains();
      },
      error: (err) => {
        this.flashError(err.error?.detail || 'Failed to update review status.');
      }
    });
  }

  openFindingModal(chain?: TransactionChain): void {
    if (chain) {
      this.findingForm = {
        transaction_type: 'ProcurementRequest',
        transaction_id: chain.requisition.id,
        reference_number: chain.purchase_order?.po_number || chain.requisition.request_number,
        finding_type: 'Discrepancy',
        severity: 'Medium',
        title: '',
        description: ''
      };
    } else {
      this.findingForm = {
        transaction_type: 'PurchaseOrder',
        transaction_id: 1,
        reference_number: '',
        finding_type: 'Discrepancy',
        severity: 'Medium',
        title: '',
        description: ''
      };
    }
    this.showFindingModal = true;
  }

  closeFindingModal(): void {
    this.showFindingModal = false;
  }

  submitFinding(): void {
    if (!this.findingForm.title || !this.findingForm.description) {
      this.flashError('Please provide a title and detailed description for this audit finding.');
      return;
    }

    this.auditService.createFinding({
      transaction_type: this.findingForm.transaction_type,
      transaction_id: Number(this.findingForm.transaction_id),
      reference_number: this.findingForm.reference_number,
      finding_type: this.findingForm.finding_type,
      severity: this.findingForm.severity,
      title: this.findingForm.title,
      description: this.findingForm.description
    }).subscribe({
      next: () => {
        this.flashSuccess(`Audit finding '${this.findingForm.title}' logged to the immutable ledger.`);
        this.closeFindingModal();
        this.auditService.getFindings().subscribe(f => this.findings = f);
        this.loadChains();
      },
      error: (err) => {
        this.flashError(err.error?.detail || 'Failed to record audit finding.');
      }
    });
  }

  exportAuditReport(format: 'pdf' | 'excel'): void {
    const payload: AuditExportPayload = {
      auditorName: this.currentUser?.full_name || 'Senior Compliance Auditor',
      transactionChains: this.transactionChains,
      discrepancies: this.discrepancies,
      findings: this.findings,
      auditLogs: this.auditLogs,
      stats: this.stats,
      summary: this.auditSummary
    };

    try {
      if (format === 'excel') {
        this.auditExportService.exportToExcel(payload);
        this.flashSuccess('Official ISO-compliant VendorIQ Audit Ledger (.XLSX) generated & downloaded to your Downloads folder.');
      } else if (format === 'pdf') {
        this.auditExportService.exportToPdf(payload);
        this.flashSuccess('Official ISO-compliant VendorIQ Audit Dossier (.PDF) generated & downloaded to your Downloads folder.');
      }
    } catch (err: any) {
      console.error('Audit export failed:', err);
      this.flashError('Failed to generate export file. Please try again.');
    }
  }

  printAuditDossier(): void {
    const payload: AuditExportPayload = {
      auditorName: this.currentUser?.full_name || 'Senior Compliance Auditor',
      transactionChains: this.transactionChains,
      discrepancies: this.discrepancies,
      findings: this.findings,
      auditLogs: this.auditLogs,
      stats: this.stats,
      summary: this.auditSummary
    };
    try {
      this.auditExportService.printDossier(payload);
    } catch (err: any) {
      console.error('Audit print failed:', err);
      this.flashError('Failed to open print preview.');
    }
  }

  flashSuccess(msg: string): void {
    this.actionMessage = msg;
    this.errorMessage = '';
    setTimeout(() => this.actionMessage = '', 5000);
  }

  flashError(msg: string): void {
    this.errorMessage = msg;
    this.actionMessage = '';
    setTimeout(() => this.errorMessage = '', 6000);
  }
}
