import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  VendorRankingItem,
  VendorReliabilityRankingItem
} from '../core/api.service';

@Component({
  selector: 'app-vendor-ranking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Vendor Rankings & Reliability Intelligence</h1>
          <p class="page-desc">
            Algorithmic supplier rankings evaluated across fulfillment adherence, product quality ratings, communication velocity, and contract compliance.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="refreshData()" [disabled]="isLoading()">
            🔄 Refresh Analytics
          </button>
          <a routerLink="/vendors" class="btn btn-primary">
            🏢 Vendor Directory
          </a>
        </div>
      </div>

      <!-- Mode Selector Tabs -->
      <div class="ranking-mode-tabs">
        <button
          class="mode-tab"
          [class.active]="activeTab() === 'reliability'"
          (click)="activeTab.set('reliability')"
          id="ranking-tab-reliability"
        >
          <span class="tab-icon">🛡️</span>
          <div>
            <div class="tab-title">Reliability & Risk Index</div>
            <div class="tab-subtitle">Weighted multi-factor reliability model</div>
          </div>
        </button>

        <button
          class="mode-tab"
          [class.active]="activeTab() === 'performance'"
          (click)="activeTab.set('performance')"
          id="ranking-tab-performance"
        >
          <span class="tab-icon">📊</span>
          <div>
            <div class="tab-title">Performance Score Leaderboard</div>
            <div class="tab-subtitle">Delivery on-time & quality metrics</div>
          </div>
        </button>
      </div>

      <!-- Filters Bar -->
      <div class="card filters-bar">
        <div class="search-box">
          <span style="color: var(--text-muted);">🔍</span>
          <input
            id="ranking-search-input"
            type="text"
            class="form-control"
            placeholder="Search supplier name or registration..."
            [(ngModel)]="searchQuery"
          />
        </div>

        <div class="filter-group">
          <label class="form-label" style="margin: 0;">Category:</label>
          <select
            id="ranking-category-filter"
            class="form-control"
            style="width: auto; min-width: 170px;"
            [(ngModel)]="selectedCategory"
          >
            <option value="ALL">All Categories</option>
            @for (cat of allowedCategories; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </div>

        @if (activeTab() === 'reliability') {
          <div class="filter-group">
            <label class="form-label" style="margin: 0;">Risk Tier:</label>
            <select
              id="ranking-risk-filter"
              class="form-control"
              style="width: auto; min-width: 140px;"
              [(ngModel)]="selectedRisk"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="Low">Low Risk</option>
              <option value="Medium">Medium Risk</option>
              <option value="High">High Risk</option>
            </select>
          </div>
        }
      </div>

      <!-- Content Area -->
      <div class="card" style="padding: 0; overflow: hidden;">
        @if (isLoading()) {
          <div class="empty-state">Computing ranking indexes and supplier metrics...</div>
        } @else if (activeTab() === 'reliability') {
          <!-- RELIABILITY RANKINGS TABLE -->
          @if (filteredReliability().length === 0) {
            <div class="empty-state" id="no-reliability-results">
              <span style="font-size: 2rem;">🛡️</span>
              <p><strong>No vendors match your search / filter criteria.</strong></p>
            </div>
          } @else {
            <div class="table-container">
              <table class="data-table" id="reliability-ranking-table">
                <thead>
                  <tr>
                    <th style="width: 70px;">Rank</th>
                    <th>Vendor Partner</th>
                    <th>Procurement Category</th>
                    <th>Reliability Score</th>
                    <th>Risk Level</th>
                    <th>Delivery Score</th>
                    <th>Quality Score</th>
                    <th>Compliance</th>
                    <th>Risk Assessment & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vendor of filteredReliability(); track vendor.vendor_id; let idx = $index) {
                    <!-- Separator row between ranked and unrated sections -->
                    @if (idx === ratedReliabilityCount() && ratedReliabilityCount() > 0 && ratedReliabilityCount() < filteredReliability().length) {
                      <tr class="unrated-separator-row">
                        <td colspan="9">
                          <span class="unrated-section-label">⚪ UNRATED VENDORS — No performance data recorded yet</span>
                        </td>
                      </tr>
                    }
                    <tr [class.unrated-row]="vendor.risk_level === 'Unrated'">
                      <td>
                        @if (vendor.risk_level === 'Unrated') {
                          <div class="rank-badge rank-unrated">UNRATED</div>
                        } @else if (idx === 0) {
                          <div class="rank-badge rank-1">🥇 #1</div>
                        } @else if (idx === 1) {
                          <div class="rank-badge rank-2">🥈 #2</div>
                        } @else if (idx === 2) {
                          <div class="rank-badge rank-3">🥉 #3</div>
                        } @else {
                          <div class="rank-badge">#{{ idx + 1 }}</div>
                        }
                      </td>
                      <td>
                        <strong style="font-size: 0.95rem; color: var(--text-main);">{{ vendor.company_name }}</strong>
                        <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">
                          CR: {{ vendor.registration_no }}
                        </div>
                      </td>
                      <td>
                        <span class="badge badge-neutral">{{ vendor.category }}</span>
                      </td>
                      <td>
                        <div class="score-pill-wrap">
                          <span class="score-pill" [class.score-high]="vendor.risk_level === 'Low'" [class.score-med]="vendor.risk_level === 'Medium'" [class.score-low]="vendor.risk_level === 'High'" [class.score-neutral]="vendor.risk_level === 'Unrated'">
                            {{ vendor.risk_level === 'Unrated' ? '—' : vendor.overall_reliability_score }}
                          </span>
                          @if (vendor.risk_level !== 'Unrated') {
                            <span style="font-size: 0.75rem; color: var(--text-muted);">/ 100</span>
                          }
                        </div>
                      </td>
                      <td>
                        <span
                          class="status-pill status-{{ vendor.risk_level === 'Low' ? 'approved' : vendor.risk_level === 'Medium' ? 'pending' : vendor.risk_level === 'High' ? 'rejected' : 'neutral' }}"
                        >
                          {{ vendor.risk_level === 'Unrated' ? 'UNRATED' : (vendor.risk_level | uppercase) + ' RISK' }}
                        </span>
                      </td>
                      <td>
                        <strong>{{ vendor.risk_level === 'Unrated' ? '—' : (vendor.delivery_score + '%') }}</strong>
                      </td>
                      <td>
                        <strong>{{ vendor.risk_level === 'Unrated' ? '—' : (vendor.quality_score + '%') }}</strong>
                      </td>
                      <td>
                        @if (vendor.risk_level === 'Unrated') {
                          <span>—</span>
                        } @else {
                          <span [style.color]="vendor.compliance_score >= 80 ? '#34d399' : '#f87171'">
                            {{ vendor.compliance_score }}%
                          </span>
                        }
                      </td>
                      <td style="max-width: 280px; font-size: 0.8rem; color: var(--text-muted);">
                        {{ vendor.recommendation || 'Meets standard reliability profile.' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        } @else {
          <!-- PERFORMANCE RANKINGS TABLE -->
          @if (filteredPerformance().length === 0) {
            <div class="empty-state" id="no-performance-results">
              <span style="font-size: 2rem;">📊</span>
              <p><strong>No vendors match your search / filter criteria.</strong></p>
            </div>
          } @else {
            <div class="table-container">
              <table class="data-table" id="performance-ranking-table">
                <thead>
                  <tr>
                    <th style="width: 70px;">Rank</th>
                    <th>Supplier</th>
                    <th>Category</th>
                    <th>Composite Score</th>
                    <th>On-Time Rate</th>
                    <th>Average Quality</th>
                    <th>Order Completion</th>
                    <th>Evaluations Logged</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vendor of filteredPerformance(); track vendor.vendor_id; let idx = $index) {
                    <!-- Separator row between ranked and unrated sections -->
                    @if (idx === ratedPerformanceCount() && ratedPerformanceCount() > 0 && ratedPerformanceCount() < filteredPerformance().length) {
                      <tr class="unrated-separator-row">
                        <td colspan="8">
                          <span class="unrated-section-label">⚪ UNRATED VENDORS — No evaluations recorded yet</span>
                        </td>
                      </tr>
                    }
                    <tr [class.unrated-row]="vendor.total_evaluations === 0">
                      <td>
                        @if (vendor.total_evaluations === 0) {
                          <div class="rank-badge rank-unrated">UNRATED</div>
                        } @else if (idx === 0) {
                          <div class="rank-badge rank-1">🥇 #1</div>
                        } @else if (idx === 1) {
                          <div class="rank-badge rank-2">🥈 #2</div>
                        } @else if (idx === 2) {
                          <div class="rank-badge rank-3">🥉 #3</div>
                        } @else {
                          <div class="rank-badge">#{{ idx + 1 }}</div>
                        }
                      </td>
                      <td>
                        <strong style="font-size: 0.95rem; color: var(--text-main);">{{ vendor.company_name }}</strong>
                        <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">
                          CR: {{ vendor.registration_no }}
                        </div>
                      </td>
                      <td>
                        <span class="badge badge-neutral">{{ vendor.category }}</span>
                      </td>
                      <td>
                        <div class="score-pill-wrap">
                          <span class="score-pill" [class.score-high]="vendor.performance_score >= 80" [class.score-med]="vendor.performance_score >= 50 && vendor.performance_score < 80" [class.score-neutral]="vendor.total_evaluations === 0">
                            {{ vendor.total_evaluations === 0 ? '—' : vendor.performance_score }}
                          </span>
                          @if (vendor.total_evaluations > 0) {
                            <span style="font-size: 0.75rem; color: var(--text-muted);">/ 100</span>
                          }
                        </div>
                      </td>
                      <td>
                        <span style="color: #34d399; font-weight: 700;">{{ vendor.total_evaluations === 0 ? '—' : (vendor.on_time_delivery_rate + '%') }}</span>
                      </td>
                      <td>
                        @if (vendor.total_evaluations === 0) {
                          <span>—</span>
                        } @else {
                          <span style="color: #38bdf8; font-weight: 700;">⭐ {{ vendor.average_quality_rating }}</span>
                          <span style="font-size: 0.75rem; color: var(--text-muted);"> / 5.0</span>
                        }
                      </td>
                      <td>
                        <strong>{{ vendor.total_evaluations === 0 ? '—' : (vendor.order_completion_rate + '%') }}</strong>
                      </td>
                      <td>
                        <span class="badge badge-neutral">{{ vendor.total_evaluations }} evaluations</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1320px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .page-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main);
    }
    .page-desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.25rem;
      max-width: 800px;
      line-height: 1.45;
    }
    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }
    .ranking-mode-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .mode-tab {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }
    .mode-tab:hover {
      background: rgba(30, 41, 59, 0.6);
      border-color: var(--border-hover);
    }
    .mode-tab.active {
      background: rgba(56, 189, 248, 0.08);
      border-color: #38bdf8;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.1);
    }
    .tab-icon {
      font-size: 1.75rem;
    }
    .tab-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .tab-subtitle {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 0.15rem;
    }
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      align-items: center;
      margin-bottom: 1.5rem;
      padding: 1rem 1.5rem;
    }
    .search-box {
      flex: 1;
      min-width: 260px;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0 0.75rem;
    }
    .search-box input {
      border: none;
      background: transparent;
      padding: 0.6rem 0;
      color: var(--text-main);
      width: 100%;
    }
    .search-box input:focus {
      outline: none;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .data-table th {
      background: rgba(15, 23, 42, 0.4);
      padding: 0.85rem 1.25rem;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-subtle);
    }
    .data-table td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }
    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: var(--text-muted);
    }
    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.85rem;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-md);
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
    }
    .rank-badge.rank-1 {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .rank-badge.rank-2 {
      background: rgba(148, 163, 184, 0.2);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.4);
    }
    .rank-badge.rank-3 {
      background: rgba(180, 83, 9, 0.2);
      color: #f59e0b;
      border: 1px solid rgba(180, 83, 9, 0.4);
    }
    .score-pill-wrap {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
    }
    .score-pill {
      font-size: 1.15rem;
      font-weight: 800;
      color: #38bdf8;
    }
    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .status-approved {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-pending {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .status-rejected {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .rank-badge.rank-unrated {
      background: rgba(100, 116, 139, 0.15);
      color: #64748b;
      border: 1px solid rgba(100, 116, 139, 0.3);
      font-size: 0.72rem;
      letter-spacing: 0.04em;
    }
    .unrated-row {
      opacity: 0.65;
    }
    .unrated-row:hover {
      opacity: 0.85;
    }
    .unrated-separator-row td {
      padding: 0.5rem 1.25rem;
      background: rgba(100, 116, 139, 0.06);
      border-top: 1px dashed rgba(100, 116, 139, 0.25);
      border-bottom: 1px dashed rgba(100, 116, 139, 0.25);
    }
    .unrated-section-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #64748b;
    }
  `]
})
export class VendorRankingComponent implements OnInit {
  private api = inject(ApiService);

  readonly activeTab = signal<'reliability' | 'performance'>('reliability');
  readonly performanceRankings = signal<VendorRankingItem[]>([]);
  readonly reliabilityRankings = signal<VendorReliabilityRankingItem[]>([]);
  readonly isLoading = signal<boolean>(false);

  searchQuery = '';
  selectedCategory = 'ALL';
  selectedRisk = 'ALL';

  readonly allowedCategories = [
    'Raw Material Suppliers',
    'Equipment',
    'IT',
    'Logistics',
    'Services',
    'Maintenance'
  ];

  readonly filteredPerformance = computed(() => {
    let list = this.performanceRankings();
    if (this.selectedCategory !== 'ALL') {
      list = list.filter(v => v.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(v =>
        v.company_name.toLowerCase().includes(q) ||
        v.registration_no.toLowerCase().includes(q)
      );
    }
    return list;
  });

  readonly filteredReliability = computed(() => {
    let list = this.reliabilityRankings();
    if (this.selectedCategory !== 'ALL') {
      list = list.filter(v => v.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }
    if (this.selectedRisk !== 'ALL') {
      list = list.filter(v => v.risk_level.toLowerCase() === this.selectedRisk.toLowerCase());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(v =>
        v.company_name.toLowerCase().includes(q) ||
        v.registration_no.toLowerCase().includes(q)
      );
    }
    return list;
  });

  /** Count of vendors in the filtered reliability list that have actual scores (not Unrated). */
  readonly ratedReliabilityCount = computed(() =>
    this.filteredReliability().filter(v => v.risk_level !== 'Unrated').length
  );

  /** Count of vendors in the filtered performance list that have at least one evaluation. */
  readonly ratedPerformanceCount = computed(() =>
    this.filteredPerformance().filter(v => v.total_evaluations > 0).length
  );

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.isLoading.set(true);
    this.api.getVendorRankings().subscribe({
      next: (data) => {
        this.performanceRankings.set(data);
      },
      error: () => this.performanceRankings.set([])
    });

    this.api.getVendorReliabilityRanking().subscribe({
      next: (data) => {
        this.reliabilityRankings.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.reliabilityRankings.set([]);
        this.isLoading.set(false);
      }
    });
  }
}
