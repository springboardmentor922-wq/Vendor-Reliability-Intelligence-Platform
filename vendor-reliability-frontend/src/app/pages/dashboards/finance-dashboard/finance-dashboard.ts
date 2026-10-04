import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DashboardService, DashboardStats } from '../../../services/dashboard.service';
import { FinanceService, PendingFinancialApproval, InvoiceRecord, PaymentRecord } from '../../../services/finance.service';
import { PurchaseOrderService, PurchaseOrder } from '../../../services/purchase-order.service';
import { AuthService, User } from '../../../services/auth.service';

import { AppChartComponent } from '../../../components/charts/app-chart.component';
import { CHART_COLORS, STATUS_COLORS } from '../../../components/charts/chart-theme';

@Component({
  selector: 'app-finance-dashboard',
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
  templateUrl: './finance-dashboard.html',
  styleUrl: './finance-dashboard.css'
})
export class FinanceDashboard implements OnInit {
  stats: DashboardStats | null = null;
  currentUser: User | null = null;
  pendingApprovals: PendingFinancialApproval[] = [];
  invoices: InvoiceRecord[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  paymentHistory: PaymentRecord[] = [];

  financeSummary: any = null;
  isLoadingSummary = true;

  // Chart datasets & options
  monthlySpendingChartData: any = null;
  monthlySpendingChartOptions: any = null;
  budgetVsActualChartData: any = null;
  budgetVsActualChartOptions: any = null;
  invoiceStatusChartData: any = null;
  invoiceStatusChartOptions: any = null;
  vendorPaymentDistChartData: any = null;
  vendorPaymentDistChartOptions: any = null;
  monthlyPaymentTrendChartData: any = null;
  monthlyPaymentTrendChartOptions: any = null;

  // Modals
  selectedApproval: PendingFinancialApproval | null = null;
  showApprovalModal = false;
  budgetToAllocate = 0;
  approvalComments = 'Budget verified against departmental operating expenditure account.';

  showRejectionModal = false;
  rejectionReason = 'Quotation exceeds allocated departmental budget ceiling.';

  showPaymentModal = false;
  selectedInvoiceForPayment: InvoiceRecord | null = null;
  paymentForm = {
    amount: 0,
    payment_method: 'Electronic Funds Transfer',
    transaction_ref: '',
    payment_notes: 'Standard vendor disbursement processed.'
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
    private dashService: DashboardService,
    private financeService: FinanceService,
    private poService: PurchaseOrderService,
    private authService: AuthService,
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
    this.buildFinanceCharts({}); // Render charts immediately on frame 1
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

    // 1. Stats
    this.dashService.getStats(true).subscribe({
      next: (data) => this.stats = data,
      error: () => {}
    });

    // 2. Pending Financial Approvals (Step 12 & 13)
    this.financeService.getPendingApprovals().subscribe({
      next: (data) => this.pendingApprovals = data,
      error: () => this.pendingApprovals = []
    });

    // 3. Invoices for 3-Way Match Verification
    this.financeService.getInvoices().subscribe({
      next: (invs) => {
        this.invoices = invs;
        if (!silent) this.isLoading = false;
      },
      error: () => {
        if (!silent) this.isLoading = false;
      }
    });

    // 4. Purchase Orders (View Only)
    this.poService.getPurchaseOrders({}, true).subscribe({
      next: (pos) => this.purchaseOrders = pos,
      error: () => this.purchaseOrders = []
    });

    // 5. Payment History
    this.financeService.getPaymentHistory().subscribe({
      next: (pays) => this.paymentHistory = pays,
      error: () => this.paymentHistory = []
    });

    // 6. Finance Analytics Summary
    this.loadFinanceAnalytics(silent);
  }

  loadFinanceAnalytics(silent = false): void {
    if (!silent) {
      this.isLoadingSummary = true;
    }
    this.dashService.getFinanceSummary(true).subscribe({
      next: (summary) => {
        this.financeSummary = summary;
        this.isLoadingSummary = false;
        this.buildFinanceCharts(summary);
      },
      error: (err) => {
        console.error('Failed to load finance summary', err);
        this.isLoadingSummary = false;
      }
    });
  }

  buildFinanceCharts(summary: any): void {
    if (!summary) summary = {};

    // A. Monthly Procurement Spending (Bar)
    const months = summary.monthly_spending?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const spending = summary.monthly_spending?.amounts || [28, 35, 42, 48, 56, 64];
    this.monthlySpendingChartData = {
      labels: months,
      datasets: [
        {
          label: 'Spending (₹ Lakh)',
          data: spending,
          backgroundColor: '#d97706',
          borderRadius: 4
        }
      ]
    };
    this.monthlySpendingChartOptions = {
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
          title: { display: true, text: 'Spend (₹ Lakh)' }
        }
      }
    };

    // B. Budget vs Actual Spending (Grouped Bar)
    const depts = summary.budget_vs_actual?.departments || ['IT', 'Manufacturing', 'Supply Chain', 'Finance', 'Facilities'];
    const budgets = summary.budget_vs_actual?.budget || [25, 50, 20, 10, 12];
    const actuals = summary.budget_vs_actual?.actual || [18, 36, 14, 6.5, 8];
    this.budgetVsActualChartData = {
      labels: depts,
      datasets: [
        {
          label: 'Allocated Budget',
          data: budgets,
          backgroundColor: '#94a3b8',
          borderRadius: 4
        },
        {
          label: 'Actual Spend',
          data: actuals,
          backgroundColor: '#2563eb',
          borderRadius: 4
        }
      ]
    };
    this.budgetVsActualChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true } },
        tooltip: { backgroundColor: '#0f172a' }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: CHART_COLORS.gridLine },
          title: { display: true, text: 'Amount (₹ Lakh)' }
        }
      }
    };

    // C. Invoice Status (Donut)
    const invLabels = summary.invoice_status?.labels || ['Pending', 'Approved', 'Paid', 'Rejected'];
    const invCounts = summary.invoice_status?.counts || [12, 18, 35, 2];
    this.invoiceStatusChartData = {
      labels: invLabels,
      datasets: [
        {
          data: invCounts,
          backgroundColor: [CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.success, CHART_COLORS.danger],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
    this.invoiceStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
        tooltip: { backgroundColor: '#0f172a' }
      }
    };

    // D. Vendor Payment Distribution (Bar)
    const vendors = summary.vendor_payment_distribution?.vendors || ['Vendor A', 'Vendor B', 'Vendor C'];
    const vAmounts = summary.vendor_payment_distribution?.amounts || [45, 32, 24];
    this.vendorPaymentDistChartData = {
      labels: vendors,
      datasets: [
        {
          label: 'Payment Volume (₹ Lakh)',
          data: vAmounts,
          backgroundColor: '#10b981',
          borderRadius: 4
        }
      ]
    };
    this.vendorPaymentDistChartOptions = {
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
          title: { display: true, text: 'Disbursements (₹ Lakh)' }
        }
      }
    };

    // E. Monthly Payment Trend (Line)
    const payMonths = summary.monthly_payment_trend?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const disbursed = summary.monthly_payment_trend?.disbursed || [22, 28, 34, 40, 48, 54];
    this.monthlyPaymentTrendChartData = {
      labels: payMonths,
      datasets: [
        {
          label: 'Disbursed (₹ Lakh)',
          data: disbursed,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0284c7'
        }
      ]
    };
    this.monthlyPaymentTrendChartOptions = {
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
          title: { display: true, text: 'Disbursements (₹ Lakh)' }
        }
      }
    };
  }

  openApproveModal(appr: PendingFinancialApproval): void {
    this.selectedApproval = appr;
    this.budgetToAllocate = appr.quotation_amount;
    this.approvalComments = 'Budget verified against departmental operating expenditure account.';
    this.showApprovalModal = true;
  }

  closeApproveModal(): void {
    this.showApprovalModal = false;
    this.selectedApproval = null;
  }

  confirmApprove(): void {
    if (!this.selectedApproval) return;
    const appr = this.selectedApproval;
    const selectionId = appr.selection_id;
    const reqNumber = appr.request_number;
    const vendorName = appr.vendor_name;
    const budgetAmount = this.budgetToAllocate;
    const comments = this.approvalComments;

    // 1. Immediately close modal — zero buffering
    this.closeApproveModal();

    // 2. Immediately show successful submit message on dashboard
    this.setActionMessage(`Financial budget of $${budgetAmount.toLocaleString()} approved for ${reqNumber} (${vendorName}) and routed to SCM for PO creation!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    this.pendingApprovals = this.pendingApprovals.filter(a => a.selection_id !== selectionId);
    if (this.financeSummary?.kpis) {
      this.financeSummary.kpis.pending_budget_approvals = Math.max(0, (this.financeSummary.kpis.pending_budget_approvals || 1) - 1);
    }

    // 4. Background network submission & silent refresh
    this.financeService.approveFinancialRequest(selectionId, budgetAmount, comments).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(res.message);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to approve budget.');
        this.loadData(true);
      }
    });
  }

  openRejectModal(appr: PendingFinancialApproval): void {
    this.selectedApproval = appr;
    this.rejectionReason = 'Quotation exceeds allocated departmental budget ceiling.';
    this.showRejectionModal = true;
  }

  closeRejectModal(): void {
    this.showRejectionModal = false;
    this.selectedApproval = null;
  }

  confirmReject(): void {
    if (!this.selectedApproval || !this.rejectionReason.trim()) {
      alert('Please provide a mandatory rejection reason.');
      return;
    }
    const appr = this.selectedApproval;
    const selectionId = appr.selection_id;
    const reqNumber = appr.request_number;
    const reason = this.rejectionReason;

    // 1. Immediately close modal — zero buffering
    this.closeRejectModal();

    // 2. Immediately show successful submit message on dashboard
    this.setActionMessage(`Financial request for ${reqNumber} declined and returned to Procurement.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    this.pendingApprovals = this.pendingApprovals.filter(a => a.selection_id !== selectionId);
    if (this.financeSummary?.kpis) {
      this.financeSummary.kpis.pending_budget_approvals = Math.max(0, (this.financeSummary.kpis.pending_budget_approvals || 1) - 1);
    }

    // 4. Background network submission & silent refresh
    this.financeService.rejectFinancialRequest(selectionId, reason).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(res.message);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to reject request.');
        this.loadData(true);
      }
    });
  }

  verify3WayMatch(inv: InvoiceRecord): void {
    inv.three_way_match_status = 'MATCHED';
    inv.status = 'VERIFIED';
    this.setActionMessage(`3-Way match verification completed for Invoice ${inv.invoice_number}! Ready for payment disbursement.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.financeService.verify3WayMatch(inv.id).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(res.message);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to perform 3-way match.');
        this.loadData(true);
      }
    });
  }

  openPaymentModal(inv: InvoiceRecord): void {
    this.selectedInvoiceForPayment = inv;
    this.paymentForm.amount = inv.amount;
    this.paymentForm.payment_method = 'Electronic Funds Transfer';
    this.paymentForm.transaction_ref = `EFT-TX-${Date.now().toString().slice(-6)}`;
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedInvoiceForPayment = null;
  }

  confirmPayment(): void {
    if (!this.selectedInvoiceForPayment) return;
    const inv = this.selectedInvoiceForPayment;
    const invoiceId = inv.id;
    const invoiceNumber = inv.invoice_number;
    const poNumber = inv.po_number;
    const vendorName = inv.vendor_name;
    const amount = this.paymentForm.amount;
    const method = this.paymentForm.payment_method;
    const txRef = this.paymentForm.transaction_ref;
    const notes = this.paymentForm.payment_notes;

    const payload = {
      invoice_id: invoiceId,
      amount: amount,
      payment_method: method,
      transaction_reference: txRef,
      notes: notes
    };

    // 1. Immediately close modal — zero buffering
    this.closePaymentModal();

    // 2. Immediately show successful submit message on dashboard
    this.setActionMessage(`Payment of $${amount.toLocaleString()} disbursed via ${method} (Ref: ${txRef}) for Invoice ${invoiceNumber}. Transaction completed!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    inv.status = 'PAID';
    inv.has_payment = true;

    const optimisticPayment: PaymentRecord = {
      id: Date.now(),
      transaction_reference: txRef,
      invoice_number: invoiceNumber,
      po_number: poNumber,
      vendor_name: vendorName,
      amount: amount,
      payment_method: method,
      payment_date: new Date().toISOString(),
      status: 'PAID',
      processed_by: this.currentUser?.full_name || 'Finance Officer',
      notes: notes
    };
    this.paymentHistory = [optimisticPayment, ...this.paymentHistory];

    if (this.financeSummary?.kpis) {
      this.financeSummary.kpis.paid_invoices = (this.financeSummary.kpis.paid_invoices || 0) + 1;
      this.financeSummary.kpis.pending_invoices = Math.max(0, (this.financeSummary.kpis.pending_invoices || 1) - 1);
    }

    // 4. Background network submission & silent refresh
    this.financeService.processPayment(payload).subscribe({
      next: (res) => {
        if (res?.message) {
          this.setActionMessage(res.message);
        }
        this.loadData(true);
      },
      error: (err) => {
        alert(err.error?.detail || 'Failed to process payment.');
        this.loadData(true);
      }
    });
  }

  getTotalDisbursed(): number {
    return this.paymentHistory.reduce((acc, p) => acc + p.amount, 0);
  }
}
