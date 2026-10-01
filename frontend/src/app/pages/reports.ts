import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, ProcurementAnalyticsResponse } from '../core/api.service';
import { AuthService } from '../core/auth.service';

interface ReportDefinition {
  id: string;
  endpoint: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  dataPoints: string[];
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reports-container">
      <!-- Header Banner -->
      <div class="reports-header">
        <div class="header-text">
          <h1 class="page-title">
            Reports & <span class="gradient-text">Procurement Analytics</span>
          </h1>
          <p class="page-desc">
            Executive report generation in PDF & Excel formats alongside deep spend intelligence.
          </p>
        </div>

        <!-- Mode Switcher Tabs -->
        <div class="view-switcher">
          <button
            class="switch-btn"
            [class.active]="activeTab() === 'reports'"
            (click)="activeTab.set('reports')"
            id="tab-btn-reports"
          >
            <span>📄</span>
            <span>Export Reports (5)</span>
          </button>
          <button
            class="switch-btn"
            [class.active]="activeTab() === 'analytics'"
            (click)="activeTab.set('analytics')"
            id="tab-btn-analytics"
          >
            <span>📈</span>
            <span>Spend Analytics</span>
          </button>
        </div>
      </div>

      <!-- Feedback Alert -->
      @if (downloadMessage()) {
        <div class="alert alert-success" id="download-alert-banner">
          <span>✅</span>
          <span>{{ downloadMessage() }}</span>
        </div>
      }
      @if (errorMessage()) {
        <div class="alert alert-danger" id="error-alert-banner">
          <span>⚠️</span>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- ========================================================================= -->
      <!-- TAB 1: REPORTS & EXPORT HUB                                              -->
      <!-- ========================================================================= -->
      @if (activeTab() === 'reports') {
        <div class="reports-grid">
          @for (report of reportList; track report.id) {
            <div class="card report-card" [id]="'report-card-' + report.id">
              <div class="report-header">
                <div class="report-icon-box">{{ report.icon }}</div>
                <div class="report-meta">
                  <span class="report-badge">{{ report.badge }}</span>
                  <h3 class="report-title">{{ report.title }}</h3>
                </div>
              </div>

              <p class="report-desc">{{ report.description }}</p>

              <div class="data-points-list">
                <span class="points-label">Included Columns:</span>
                <div class="points-tags">
                  @for (dp of report.dataPoints; track dp) {
                    <span class="point-pill">{{ dp }}</span>
                  }
                </div>
              </div>

              <div class="report-actions">
                <button
                  class="btn btn-primary btn-sm btn-download"
                  [id]="'download-pdf-' + report.id"
                  [disabled]="isDownloading(report.id, 'pdf')"
                  (click)="download(report, 'pdf')"
                >
                  <span>{{ isDownloading(report.id, 'pdf') ? '⏳ Generating...' : '📕 Download PDF' }}</span>
                </button>
                <button
                  class="btn btn-secondary btn-sm btn-download"
                  [id]="'download-excel-' + report.id"
                  [disabled]="isDownloading(report.id, 'excel')"
                  (click)="download(report, 'excel')"
                >
                  <span>{{ isDownloading(report.id, 'excel') ? '⏳ Generating...' : '📊 Download Excel' }}</span>
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- ========================================================================= -->
      <!-- TAB 2: DEEP PROCUREMENT ANALYTICS                                        -->
      <!-- ========================================================================= -->
      @if (activeTab() === 'analytics') {
        <div class="analytics-content">
          @if (isLoadingAnalytics()) {
            <div class="card empty-state">
              <span>⏳ Computing spend intelligence from real database commitments...</span>
            </div>
          } @else if (analyticsData()) {
            <!-- Top Analytics Summary Cards -->
            <div class="analytics-summary-grid">
              <div class="card stat-card">
                <span class="stat-label">Total Committed Spend</span>
                <div class="stat-val" id="analytics-total-spend">{{ formatCurrency(analyticsData()!.total_spend) }}</div>
                <span class="stat-sub">Across {{ analyticsData()!.total_orders }} Purchase Orders</span>
              </div>

              <div class="card stat-card">
                <span class="stat-label">Request-to-PO Conversion</span>
                <div class="stat-val" id="analytics-conversion-rate">{{ analyticsData()!.request_to_po_conversion_rate }}%</div>
                <span class="stat-sub">Requisition conversion efficiency</span>
              </div>

              <div class="card stat-card">
                <span class="stat-label">Total Requisitions</span>
                <div class="stat-val">{{ analyticsData()!.total_requests }}</div>
                <span class="stat-sub">Active pipeline requests</span>
              </div>

              <div class="card stat-card">
                <span class="stat-label">Approval Turnaround</span>
                <div class="stat-val" style="font-size: 1.3rem; color: var(--text-muted);">Standard</div>
                <span class="stat-sub">Fast-track workflow active</span>
              </div>
            </div>

            <!-- Spend Trend & Category Distribution Grid -->
            <div class="analytics-two-col">
              <!-- Monthly Spend Trend -->
              <div class="card section-card">
                <div class="section-card-header">
                  <h3>📅 Spend Trend (Last 6 Months)</h3>
                  <span class="badge badge-info badge-sm">Monthly Totals</span>
                </div>
                <div class="trend-bars-list">
                  @for (m of analyticsData()!.monthly_spend_trend; track m.month) {
                    <div class="trend-item">
                      <div class="trend-meta">
                        <span class="trend-month">{{ m.month }}</span>
                        <span class="trend-amount">{{ formatCurrency(m.spend) }} ({{ m.order_count }} POs)</span>
                      </div>
                      <div class="trend-bar-track">
                        <div
                          class="trend-bar-fill"
                          [style.width.%]="getBarWidth(m.spend, maxMonthlySpend())"
                        ></div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Category Spend Breakdown -->
              <div class="card section-card">
                <div class="section-card-header">
                  <h3>🏷️ Category-Wise Spend Breakdown</h3>
                  <span class="badge badge-info badge-sm">Vendor Sectors</span>
                </div>
                <div class="category-list">
                  @for (cat of analyticsData()!.category_spend; track cat.category) {
                    <div class="cat-item">
                      <div class="cat-info">
                        <span class="cat-name">{{ cat.category }}</span>
                        <span class="cat-count">{{ cat.vendor_count }} supplier(s)</span>
                      </div>
                      <div class="cat-spend-box">
                        <span class="cat-spend">{{ formatCurrency(cat.total_spend) }}</span>
                        <div class="trend-bar-track">
                          <div
                            class="cat-bar-fill"
                            [style.width.%]="getBarWidth(cat.total_spend, analyticsData()!.total_spend)"
                          ></div>
                        </div>
                      </div>
                    </div>
                  }
                  @if (analyticsData()!.category_spend.length === 0) {
                    <div class="empty-state py-4">No category spend recorded.</div>
                  }
                </div>
              </div>
            </div>

            <!-- Top Suppliers by Spend Leaderboard -->
            <div class="card section-card">
              <div class="section-card-header">
                <h3>🏆 Top Suppliers by Committed Spend</h3>
                <span class="badge badge-role">Ranked by Volume</span>
              </div>
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Total Orders</th>
                      <th>Committed Value ($)</th>
                      <th style="text-align: right;">Share of Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of analyticsData()!.top_vendors_by_spend; track v.vendor_id; let idx = $index) {
                      <tr>
                        <td>
                          <strong>#{{ idx + 1 }} {{ v.company_name }}</strong>
                        </td>
                        <td>{{ v.order_count }} PO(s)</td>
                        <td style="font-weight: 700; color: #60a5fa;">{{ formatCurrency(v.total_spend) }}</td>
                        <td style="text-align: right;">
                          <span class="badge badge-info">
                            {{ getSpendShare(v.total_spend, analyticsData()!.total_spend) }}%
                          </span>
                        </td>
                      </tr>
                    }
                    @if (analyticsData()!.top_vendors_by_spend.length === 0) {
                      <tr>
                        <td colspan="4" class="text-center py-4 text-muted">No vendor commitments yet.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .reports-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .reports-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1.5rem;
    }
    .page-title {
      font-size: 2rem;
      margin-bottom: 0.35rem;
    }
    .page-desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      max-width: 650px;
    }
    .view-switcher {
      display: inline-flex;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 0.3rem;
      gap: 0.3rem;
    }
    .switch-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1.25rem;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .switch-btn:hover {
      color: var(--text-main);
    }
    .switch-btn.active {
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
    }
    .reports-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 1.5rem;
    }
    .report-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.5rem;
      transition: transform 0.2s, border-color 0.2s;
    }
    .report-card:hover {
      transform: translateY(-2px);
      border-color: rgba(59, 130, 246, 0.4);
    }
    .report-header {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .report-icon-box {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    .report-meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .report-badge {
      font-size: 0.7rem;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .report-title {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .report-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.4;
      flex: 1;
    }
    .data-points-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .points-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    .points-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .point-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.72rem;
      color: #cbd5e1;
    }
    .report-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .btn-download {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.35rem;
    }

    /* Analytics Styles */
    .analytics-content {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .analytics-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }
    .stat-card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .stat-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .stat-val {
      font-size: 1.85rem;
      font-weight: 800;
      color: #ffffff;
    }
    .stat-sub {
      font-size: 0.78rem;
      color: #38bdf8;
    }
    .analytics-two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
      gap: 1.5rem;
    }
    .section-card {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .section-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-card-header h3 {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .trend-bars-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .trend-item {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .trend-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }
    .trend-month {
      font-family: var(--font-mono);
      color: #94a3b8;
    }
    .trend-amount {
      font-weight: 600;
    }
    .trend-bar-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    .trend-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      border-radius: var(--radius-full);
      transition: width 0.4s ease;
    }
    .category-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .cat-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 140px;
    }
    .cat-name {
      font-weight: 600;
      font-size: 0.9rem;
    }
    .cat-count {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .cat-spend-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
    }
    .cat-spend {
      font-weight: 700;
      font-size: 0.9rem;
      color: #34d399;
    }
    .cat-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      border-radius: var(--radius-full);
      transition: width 0.4s ease;
    }
    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--text-muted);
    }
  `]
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly activeTab = signal<'reports' | 'analytics'>('reports');
  readonly analyticsData = signal<ProcurementAnalyticsResponse | null>(null);
  readonly isLoadingAnalytics = signal<boolean>(false);
  readonly downloadingKey = signal<string | null>(null);
  readonly downloadMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly reportList: ReportDefinition[] = [
    {
      id: 'vendor-performance',
      endpoint: 'vendor-performance',
      title: 'Vendor Performance & Reliability',
      description: 'Comprehensive scoring audit including quality ratings, on-time delivery percentages, turnaround times, and multi-factor risk classifications.',
      icon: '🏢',
      badge: 'Vendor Intelligence',
      dataPoints: ['Company Name', 'Registration', 'Category', 'Status', 'Reliability Score', 'Risk Tier', 'Avg Quality', 'On-Time %']
    },
    {
      id: 'procurement',
      endpoint: 'procurement',
      title: 'Procurement Requisitions Pipeline',
      description: 'Full historical log of purchase requisitions with requester attribution, line items count, approvals status, and budget estimates.',
      icon: '📋',
      badge: 'Pipeline Registry',
      dataPoints: ['Requisition Title', 'Requester', 'Status', 'Items Count', 'Total Est Cost', 'Created Date']
    },
    {
      id: 'purchase-orders',
      endpoint: 'purchase-orders',
      title: 'Purchase Orders Spend Register',
      description: 'Committed procurement orders, assigned vendor partners, line items count, order delivery states, and contract commitments.',
      icon: '📑',
      badge: 'Financial Audit',
      dataPoints: ['PO Number', 'Vendor Name', 'Total Amount ($)', 'Status', 'Delivery Status', 'Issued Date']
    },
    {
      id: 'compliance',
      endpoint: 'compliance',
      title: 'Vendor Risk & Compliance Directory',
      description: 'Supplier governance report reviewing ISO/regulatory certifications, contract violations, active SLAs, and risk classification tiers.',
      icon: '🚨',
      badge: 'Compliance & Risk',
      dataPoints: ['Vendor Name', 'Reg No', 'Risk Tier', 'Reliability Score', 'Active Contracts', 'Compliance Flags']
    },
    {
      id: 'contracts',
      endpoint: 'contracts',
      title: 'Master Contracts & SLA Governance',
      description: 'Registry of executed supplier service agreements, validity terms, renewal notice periods, and contractual adherence status.',
      icon: '📜',
      badge: 'Contract Registry',
      dataPoints: ['Contract Title', 'Vendor Name', 'Start Date', 'End Date', 'Notice Period', 'Status', 'Compliance']
    }
  ];

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.isLoadingAnalytics.set(true);
    this.api.getProcurementAnalytics().subscribe({
      next: (data) => {
        this.analyticsData.set(data);
        this.isLoadingAnalytics.set(false);
      },
      error: (err) => {
        this.isLoadingAnalytics.set(false);
        console.warn('Could not load procurement analytics:', err);
      }
    });
  }

  isDownloading(reportId: string, format: string): boolean {
    return this.downloadingKey() === `${reportId}_${format}`;
  }

  download(report: ReportDefinition, format: 'pdf' | 'excel'): void {
    const key = `${report.id}_${format}`;
    this.downloadingKey.set(key);
    this.downloadMessage.set(null);
    this.errorMessage.set(null);

    this.api.downloadReport(report.endpoint, format).subscribe({
      next: (blob) => {
        this.downloadingKey.set(null);
        // Create an in-browser download link
        const extension = format === 'pdf' ? 'pdf' : 'xlsx';
        const filename = `${report.endpoint}_report_${new Date().toISOString().slice(0, 10)}.${extension}`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.downloadMessage.set(`Successfully generated and downloaded ${report.title} (${format.toUpperCase()}).`);
        setTimeout(() => this.downloadMessage.set(null), 6000);
      },
      error: (err) => {
        this.downloadingKey.set(null);
        this.errorMessage.set(`Failed to export report: ${err.message || 'Server error'}`);
        setTimeout(() => this.errorMessage.set(null), 6000);
      }
    });
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
  }

  maxMonthlySpend(): number {
    const trend = this.analyticsData()?.monthly_spend_trend || [];
    if (trend.length === 0) return 1;
    return Math.max(...trend.map(t => t.spend), 1);
  }

  getBarWidth(amount: number, max: number): number {
    if (!max || max <= 0) return 0;
    return Math.min(Math.round((amount / max) * 100), 100);
  }

  getSpendShare(spend: number, total: number): string {
    if (!total || total <= 0) return '0.0';
    return ((spend / total) * 100).toFixed(1);
  }
}
