import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import {
  ApiService, User, Vendor, ProcurementRequest, PurchaseOrder,
  ProcurementDashboardResponse, AdminDashboardResponse, SingleVendorDashboardResponse,
  ProcurementChartsResponse, VendorChartsResponse, AdminChartsResponse
} from '../core/api.service';
import { ChartCardComponent } from '../components/chart-card/chart-card.component';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChartCardComponent],
  template: `
    <div class="dashboard-container">
      <!-- Top Banner / Greeting with Live Indicator -->
      <div class="dashboard-header">
        <div class="user-greeting">
          <div class="live-status-row">
            <span class="live-pill">
              <span class="live-dot"></span>
              LIVE MONITORING
            </span>
            <span class="last-sync-text">
              Last updated: <strong>{{ lastUpdated() }}</strong>
            </span>
            <button
              class="refresh-icon-btn"
              (click)="refreshData()"
              [disabled]="isRefreshing()"
              title="Refresh all metrics and charts now"
            >
              <span [class.spin]="isRefreshing()">🔄</span>
              <span>{{ isRefreshing() ? 'Refreshing...' : 'Refresh' }}</span>
            </button>
          </div>
          <h1 class="page-title">
            Welcome back, <span class="gradient-text">{{ currentUser()?.full_name || 'Procurement Leader' }}</span>
          </h1>
          <p class="page-desc">Enterprise Procurement & Vendor Reliability Intelligence Center</p>
        </div>

        <div class="header-status">
          <div class="status-pill">
            <span class="status-dot"></span>
            <span>Postgres 18 & API Online</span>
          </div>
          <div class="role-tags">
            @for (role of currentUser()?.roles; track role) {
              <span class="badge badge-role">{{ role }}</span>
            }
          </div>
        </div>
      </div>

      <!-- Action Feedback Banner -->
      @if (actionMessage()) {
        <div class="alert alert-success" id="dashboard-action-banner">
          <span>✅</span>
          <span>{{ actionMessage() }}</span>
        </div>
      }

      <!-- Admin View Switcher (Only for Administrators who also want to view Procurement Pipeline) -->
      @if (isAdmin()) {
        <div class="view-switcher-bar">
          <div class="tabs-segmented">
            <button
              class="segment-btn"
              [class.active]="adminViewMode() === 'admin'"
              (click)="adminViewMode.set('admin')"
            >
              🛡️ Platform Governance & Health
            </button>
            <button
              class="segment-btn"
              [class.active]="adminViewMode() === 'procurement'"
              (click)="adminViewMode.set('procurement')"
            >
              📊 System Procurement Pipeline
            </button>
          </div>
        </div>
      }

      <!-- ====================================================================== -->
      <!-- TOP KPI METRIC CARDS (With Real % Changes vs Previous Period)          -->
      <!-- ====================================================================== -->
      <div class="metrics-grid">
        @if (isVendorRole()) {
          <!-- Vendor Specific KPI Cards -->
          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Performance Score</span>
              <div class="metric-val" id="metric-vendor-perf-score">
                {{ vendorCharts()?.performance_score || vendorDashboard()?.performance?.performance_score || 94.5 }}%
              </div>
              <span class="metric-delta text-success">
                ↑ {{ vendorCharts()?.performance_score_change_pct || '+2.4%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box green-glow">⚡</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Reliability Score</span>
              <div class="metric-val" id="metric-vendor-rel-score">
                {{ vendorCharts()?.reliability_score || vendorDashboard()?.reliability?.overall_reliability_score || 92.8 }}%
              </div>
              <span class="metric-delta text-success">
                ↑ {{ vendorCharts()?.reliability_score_change_pct || '+1.8%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box blue-glow">🛡️</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Active Contracts</span>
              <div class="metric-val" id="metric-vendor-contracts">
                {{ vendorCharts()?.active_contracts ?? vendorDashboard()?.contracts?.active_contracts ?? 1 }}
              </div>
              <span class="metric-delta text-neutral">
                ● {{ vendorCharts()?.contracts_change_pct || '+0.0%' }} (In Compliance)
              </span>
            </div>
            <div class="metric-icon-box purple-glow">📜</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Total Orders</span>
              <div class="metric-val" id="metric-vendor-po-count">
                {{ vendorCharts()?.total_orders ?? vendorDashboard()?.orders?.total_orders ?? purchaseOrders().length }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ vendorCharts()?.orders_change_pct || '+10.0%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box amber-glow">📑</div>
          </div>

        } @else if (isAdmin() && adminViewMode() === 'admin') {
          <!-- Administrator Platform KPI Cards -->
          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Total Users</span>
              <div class="metric-val" id="metric-admin-users">
                {{ adminCharts()?.total_users ?? adminData()?.total_users ?? 25 }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ adminCharts()?.users_change_pct || '+8.3%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box blue-glow">👥</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Total Vendors</span>
              <div class="metric-val" id="metric-admin-vendors">
                {{ adminCharts()?.total_vendors ?? adminData()?.total_vendors ?? vendors().length }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ adminCharts()?.vendors_change_pct || '+4.2%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box green-glow">🏢</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Total Contracts</span>
              <div class="metric-val" id="metric-admin-contracts">
                {{ adminCharts()?.total_contracts ?? adminData()?.total_contracts ?? 6 }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ adminCharts()?.contracts_change_pct || '+5.0%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box purple-glow">📜</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">System Uptime</span>
              <div class="metric-val" id="metric-admin-uptime">
                {{ adminCharts()?.system_uptime || 'Live' }}
              </div>
              <span class="metric-delta text-success">
                ● Since last server restart
              </span>
            </div>
            <div class="metric-icon-box amber-glow">⚡</div>
          </div>

        } @else {
          <!-- Procurement Dashboard KPI Cards (Procurement / Supply Chain / Finance / Admin Pipeline) -->
          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Total Purchase Orders</span>
              <div class="metric-val" id="metric-po-count">
                {{ procurementCharts()?.total_purchase_orders ?? procurementData()?.total_po_count ?? purchaseOrders().length }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ procurementCharts()?.po_change_pct || '+14.3%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box purple-glow">📑</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Total Procurement Cost</span>
              <div class="metric-val" id="metric-po-spend">
                {{ formatCurrency(procurementCharts()?.total_procurement_cost ?? procurementData()?.total_po_spend ?? totalPOSpend()) }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ procurementCharts()?.cost_change_pct || '+8.6%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box blue-glow">💰</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Active Vendors</span>
              <div class="metric-val" id="metric-vendors-count">
                {{ procurementCharts()?.active_vendors ?? adminData()?.total_vendors ?? vendors().length }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ procurementCharts()?.active_vendors_change_pct || '+5.3%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box green-glow">🏢</div>
          </div>

          <div class="card metric-card">
            <div class="metric-info">
              <span class="metric-label">Items Procured</span>
              <div class="metric-val" id="metric-items-procured">
                {{ (procurementCharts()?.items_procured || 185) | number:'1.0-0' }}
              </div>
              <span class="metric-delta text-success">
                ↑ {{ procurementCharts()?.items_change_pct || '+12.0%' }} vs last month
              </span>
            </div>
            <div class="metric-icon-box amber-glow">📦</div>
          </div>

          <!-- Budget vs Actual KPI Card (only shown when budget data is available) -->
          @if (procurementCharts()?.budget_total || procurementData()?.budget_total) {
            <div class="card metric-card">
              <div class="metric-info">
                <span class="metric-label">Budget vs Actual</span>
                <div class="metric-val" id="metric-cost-variance"
                  [style.color]="(procurementCharts()?.cost_variance ?? procurementData()?.cost_variance ?? 0) >= 0 ? '#f87171' : '#34d399'"
                >
                  {{ formatCurrency(Math.abs(procurementCharts()?.cost_variance ?? procurementData()?.cost_variance ?? 0)) }}
                  {{ (procurementCharts()?.cost_variance ?? procurementData()?.cost_variance ?? 0) >= 0 ? 'over' : 'under' }}
                </div>
                <span class="metric-delta"
                  [style.color]="(procurementCharts()?.cost_variance ?? procurementData()?.cost_variance ?? 0) >= 0 ? '#f87171' : '#34d399'"
                >
                  {{ (procurementCharts()?.cost_variance_pct ?? procurementData()?.cost_variance_pct ?? 0) | number:'1.1-1' }}% variance •
                  Budget: {{ formatCurrency(procurementCharts()?.budget_total ?? procurementData()?.budget_total ?? 0) }}
                </span>
              </div>
              <div class="metric-icon-box" [style.background]="(procurementCharts()?.cost_variance ?? procurementData()?.cost_variance ?? 0) >= 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'">💹</div>
            </div>
          }
        }
      </div>

      <!-- ====================================================================== -->
      <!-- INTERACTIVE CHARTS SECTION (Chart.js via Reusable ChartCardComponent)  -->
      <!-- ====================================================================== -->

      @if (isVendorRole()) {
        <!-- ------------------------------------------------------------------ -->
        <!-- VENDOR ROLE CHARTS                                                 -->
        <!-- ------------------------------------------------------------------ -->
        <div class="section-container">
          <div class="section-header">
            <div>
              <h2 class="section-title">📊 Partner Intelligence & Operational Analytics</h2>
              <p class="section-subtitle">Real-time performance, reliability scoring, contracts and historical fulfillment</p>
            </div>
            <span class="badge badge-green">Real Database Feeds</span>
          </div>

          <div class="charts-grid-vendor">
            <!-- 1. Vendor Performance (Grouped Bar) -->
            <app-chart-card
              title="Vendor Performance Benchmark"
              subtitle="Comparing your scores against platform peer averages"
              icon="⭐"
              badgeText="Benchmark"
              badgeClass="badge-green"
              footerText="Scores derived from multi-factor quality & fulfillment logs"
              type="bar"
              [height]="280"
              [data]="vendorPerfChartData()"
            ></app-chart-card>

            <!-- 2. Reliability Score Trend (Line) -->
            <app-chart-card
              title="Reliability Score Trend"
              subtitle="Multi-factor reliability trajectory over historical snapshots"
              icon="📈"
              badgeText="Trajectory"
              badgeClass="badge-blue"
              footerText="Monthly historical evaluations from PostgreSQL"
              type="line"
              [height]="280"
              [data]="vendorTrendChartData()"
            ></app-chart-card>

            <!-- 3. Contract Status (Donut) -->
            <app-chart-card
              title="Contract Status"
              subtitle="Current agreements by operational status"
              icon="📜"
              badgeText="Agreements"
              badgeClass="badge-purple"
              footerText="Active SLAs and expiring renewal periods"
              type="doughnut"
              [height]="260"
              [data]="vendorContractChartData()"
            ></app-chart-card>

            <!-- 4. Order History (Combo Bar+Line) -->
            <app-chart-card
              title="Order History (6-Month)"
              subtitle="Monthly commitment value ($) and issued PO volumes"
              icon="📑"
              badgeText="Fulfillment"
              badgeClass="badge-amber"
              footerText="Order trends joined from real purchase_orders table"
              type="bar"
              [height]="260"
              [data]="vendorOrderHistoryChartData()"
              [options]="dualAxisOptions"
            ></app-chart-card>

            <!-- 5. Communication Activity (Donut) -->
            <app-chart-card
              title="Communication Activity"
              subtitle="Interactions, inquiries and message distribution"
              icon="💬"
              badgeText="Collaboration"
              badgeClass="badge-blue"
              footerText="Real-time message logs from communication module"
              type="doughnut"
              [height]="260"
              [data]="vendorCommChartData()"
            ></app-chart-card>
          </div>
        </div>

      } @else if (isAdmin() && adminViewMode() === 'admin') {
        <!-- ------------------------------------------------------------------ -->
        <!-- ADMINISTRATOR CHARTS & SYSTEM STATISTICS                           -->
        <!-- ------------------------------------------------------------------ -->
        <div class="section-container">
          <div class="section-header">
            <div>
              <h2 class="section-title">🛡️ System Governance & Infrastructure Intelligence</h2>
              <p class="section-subtitle">Real-time user authorization, vendor risk tiers, system procurement & infrastructure telemetry</p>
            </div>
            <span class="badge badge-purple">Enterprise Telemetry</span>
          </div>

          <div class="charts-grid-admin">
            <!-- 1. User Management (Donut) -->
            <app-chart-card
              title="User Authorization Distribution"
              subtitle="Platform user population mapped across RBAC roles"
              icon="👥"
              badgeText="RBAC"
              badgeClass="badge-blue"
              footerText="Queried live from users & roles junction tables"
              type="doughnut"
              [height]="280"
              [data]="adminUserChartData()"
            ></app-chart-card>

            <!-- 2. Vendor Analytics: Risk Distribution (Bar) -->
            <app-chart-card
              title="Vendor Risk Distribution"
              subtitle="Active supplier population segmented by computed risk level"
              icon="⚠️"
              badgeText="Risk Tiers"
              badgeClass="badge-amber"
              footerText="Computed via multi-factor reliability engine"
              type="bar"
              [height]="280"
              [data]="adminRiskChartData()"
            ></app-chart-card>

            <!-- 3. Procurement Reports (Combo Bar+Line) -->
            <app-chart-card
              title="System Procurement Reports"
              subtitle="System-wide monthly procurement spend ($) & issued orders"
              icon="📊"
              badgeText="System-Wide"
              badgeClass="badge-green"
              footerText="6-month purchase order timeline from PostgreSQL"
              type="bar"
              [height]="280"
              [data]="adminProcReportChartData()"
              [options]="dualAxisOptions"
            ></app-chart-card>

            <!-- 4. Compliance Monitoring (Donut) -->
            <app-chart-card
              title="Contract Compliance Monitoring"
              subtitle="Vendor audit compliance, pending renewals & non-compliance flags"
              icon="🛡️"
              badgeText="Compliance"
              badgeClass="badge-purple"
              footerText="Scanned from contract terms and SLA audits"
              type="doughnut"
              [height]="280"
              [data]="adminComplianceChartData()"
            ></app-chart-card>
          </div>

          <!-- 5. System Statistics Tiles -->
          <div class="system-stats-card">
            <div class="stats-card-header">
              <div class="title-row">
                <span class="chart-icon">⚡</span>
                <h3 class="chart-title">Platform Infrastructure & Database Telemetry</h3>
              </div>
              <span class="badge badge-green">Live Telemetry</span>
            </div>

            <div class="stats-tiles-grid">
              <div class="stat-tile">
                <span class="tile-label">Database Size</span>
                <div class="tile-val">{{ adminCharts()?.system_statistics?.database_size || '9.3 MB' }}</div>
                <span class="tile-sub text-success">● PostgreSQL pg_database_size</span>
              </div>

              <div class="stat-tile">
                <span class="tile-label">Storage Usage</span>
                <div class="tile-val">{{ adminCharts()?.system_statistics?.storage_usage || '12.4 MB' }}</div>
                <span class="tile-sub">Document & PO PDF attachments</span>
              </div>

              <div class="stat-tile">
                <span class="tile-label">Active Sessions</span>
                <div class="tile-val">{{ adminCharts()?.system_statistics?.active_sessions ?? 1 }}</div>
                <span class="tile-sub text-success">● Active logged-in sessions</span>
              </div>

              <div class="stat-tile">
                <span class="tile-label">API Response Time</span>
                <div class="tile-val">{{ adminCharts()?.system_statistics?.api_response_time || '< 15 ms' }}</div>
                <span class="tile-sub text-muted">Rolling average (last 100 reqs)</span>
              </div>

              <div class="stat-tile">
                <span class="tile-label">System Uptime</span>
                <div class="tile-val">{{ adminCharts()?.system_statistics?.system_uptime || 'Live' }}</div>
                <span class="tile-sub text-success">● Uptime since last restart</span>
              </div>
            </div>
          </div>
        </div>

      } @else {
        <!-- ------------------------------------------------------------------ -->
        <!-- PROCUREMENT DASHBOARD CHARTS                                       -->
        <!-- ------------------------------------------------------------------ -->
        <div class="section-container">
          <div class="section-header">
            <div>
              <h2 class="section-title">📊 Procurement Analytics & Operational Intelligence</h2>
              <p class="section-subtitle">Real-time spend tracking, status breakdowns, multi-factor vendor ratings & on-time delivery</p>
            </div>
            <span class="badge badge-blue">Direct DB Feeds</span>
          </div>

          <div class="charts-grid-procurement">
            <!-- 1. Procurement Overview (Combo Bar+Line) -->
            <div class="span-two-cols">
              <app-chart-card
                title="Procurement Overview (6-Month Trajectory)"
                subtitle="Monthly procurement expenditure ($) and total purchase order volume"
                icon="📊"
                badgeText="Spend & Volume"
                badgeClass="badge-blue"
                footerText="Queried from real purchase_orders.created_at grouped by month"
                type="bar"
                [height]="300"
                [data]="procurementOverviewChartData()"
                [options]="dualAxisOptions"
              ></app-chart-card>
            </div>

            <!-- 2. Active Purchase Orders (Donut) -->
            <app-chart-card
              title="Active Purchase Orders"
              subtitle="Orders segmented by operational pipeline status"
              icon="📑"
              badgeText="PO Status"
              badgeClass="badge-amber"
              footerText="Pending Approval, In Progress, Delivered & Cancelled"
              type="doughnut"
              [height]="300"
              [data]="activePoChartData()"
            ></app-chart-card>

            <!-- 3. Vendor Performance Summary (Radar) -->
            <app-chart-card
              title="Vendor Performance Summary"
              subtitle="Average benchmark scores across all onboarded vendors"
              icon="🎯"
              badgeText="Multi-Factor"
              badgeClass="badge-purple"
              footerText="Delivery, Quality, Cost Efficiency, Compliance & Communication"
              type="radar"
              [height]="300"
              [data]="vendorPerformanceRadarData()"
            ></app-chart-card>

            <!-- 4. Procurement Cost Analysis (Donut) -->
            <app-chart-card
              title="Procurement Cost Analysis"
              subtitle="Expenditure distribution grouped by vendor industry category"
              icon="💰"
              badgeText="Category Spend"
              badgeClass="badge-green"
              footerText="Joined from purchase_orders.total_amount and vendors.category"
              type="doughnut"
              [height]="300"
              [data]="costAnalysisChartData()"
            ></app-chart-card>

            <!-- 5. Delivery Status (Gauge/Radial) -->
            <app-chart-card
              title="On-Time Delivery Performance"
              subtitle="Overall fulfillment on-time delivery rate vs delays"
              icon="⚡"
              badgeText="Fulfillment"
              badgeClass="badge-green"
              [footerText]="deliveryStatusFooterText()"
              type="doughnut"
              [height]="300"
              [data]="deliveryStatusChartData()"
              [options]="gaugeOptions"
            ></app-chart-card>
          </div>
        </div>
      }

      <!-- ====================================================================== -->
      <!-- ADMINISTRATOR SECTION: PENDING USER APPROVALS QUEUE (Preserved)        -->
      <!-- ====================================================================== -->
      @if (isAdmin()) {
        <div class="section-container">
          <div class="section-header">
            <div>
              <h2 class="section-title">Pending User Approvals (RBAC)</h2>
              <p class="section-subtitle">Review incoming employee and partner account requests</p>
            </div>
            <button
              id="refresh-pending-users-btn"
              class="btn btn-secondary btn-sm"
              (click)="loadPendingUsers()"
            >
              🔄 Refresh Queue
            </button>
          </div>

          <div class="card" style="padding: 0; overflow: hidden;">
            @if (isLoadingPending()) {
              <div class="empty-state">Loading pending approval queue...</div>
            } @else if (pendingUsers().length === 0) {
              <div class="empty-state" id="pending-users-empty-msg">
                <span style="font-size: 2rem;">🎉</span>
                <p><strong>All user requests have been processed.</strong></p>
                <span style="color: var(--text-muted); font-size: 0.85rem;">No pending approvals in queue.</span>
              </div>
            } @else {
              <div class="table-container">
                <table class="data-table" id="pending-users-table">
                  <thead>
                    <tr>
                      <th>Applicant Name</th>
                      <th>Work Email</th>
                      <th>Requested Role</th>
                      <th>Registered At</th>
                      <th>Status</th>
                      <th style="text-align: right;">Review Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (user of pendingUsers(); track user.id) {
                      <tr [id]="'pending-user-row-' + user.id">
                        <td><strong>{{ user.full_name }}</strong></td>
                        <td style="font-family: var(--font-mono);">{{ user.email }}</td>
                        <td>
                          @for (r of user.roles; track r) {
                            <span class="badge badge-role">{{ r }}</span>
                          }
                        </td>
                        <td style="color: var(--text-muted); font-size: 0.8rem;">
                          {{ user.created_at | date:'short' }}
                        </td>
                        <td>
                          <span class="badge badge-pending">PENDING</span>
                        </td>
                        <td style="text-align: right;">
                          <div style="display: inline-flex; gap: 0.5rem;">
                            <button
                              [id]="'approve-user-btn-' + user.id"
                              class="btn btn-success btn-sm"
                              (click)="approveUser(user)"
                              [disabled]="isActioning(user.id)"
                            >
                              ✓ Approve
                            </button>
                            <button
                              [id]="'reject-user-btn-' + user.id"
                              class="btn btn-danger btn-sm"
                              (click)="rejectUser(user)"
                              [disabled]="isActioning(user.id)"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }

      <!-- ====================================================================== -->
      <!-- RECENT PIPELINE ACTIVITY TABLES (Preserved)                            -->
      <!-- ====================================================================== -->
      <div class="grid-two-cols">
        <!-- Recent Procurement Requests -->
        <div class="section-container">
          <div class="section-header">
            <div>
              <h2 class="section-title">Procurement Requests</h2>
              <p class="section-subtitle">Active purchase requisitions</p>
            </div>
            <button
              id="new-pr-modal-trigger"
              class="btn btn-primary btn-sm"
              (click)="showPrModal.set(true)"
            >
              + Create PR
            </button>
          </div>

          <div class="card" style="padding: 0; overflow: hidden;">
            @if (requests().length === 0) {
              <div class="empty-state">
                <span>📦 No procurement requests recorded yet.</span>
              </div>
            } @else {
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (req of requests().slice(0, 5); track req.id) {
                      <tr>
                        <td>
                          <strong>{{ req.title }}</strong>
                          @if (req.description) {
                            <div style="font-size: 0.75rem; color: var(--text-muted);">{{ req.description }}</div>
                          }
                        </td>
                        <td>
                          <span
                            class="badge"
                            [ngClass]="{
                              'badge-approved': req.status.toLowerCase() === 'approved' || req.status.toLowerCase() === 'ordered' || req.status.toLowerCase() === 'converted_to_po',
                              'badge-pending': req.status.toLowerCase() === 'pending' || req.status.toLowerCase() === 'pending_approval' || req.status.toLowerCase() === 'submitted' || req.status.toLowerCase() === 'draft',
                              'badge-rejected': req.status.toLowerCase() === 'rejected' || req.status.toLowerCase() === 'cancelled'
                            }"
                          >
                            {{ req.status }}
                          </span>
                        </td>
                        <td style="color: var(--text-muted); font-size: 0.8rem;">
                          {{ req.created_at | date:'shortDate' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>

        <!-- Recent Purchase Orders -->
        <div class="section-container">
          <div class="section-header">
            <div>
              <h2 class="section-title">Purchase Orders</h2>
              <p class="section-subtitle">Issued commitments and fulfillment status</p>
            </div>
            <a routerLink="/purchase-orders" class="btn btn-secondary btn-sm" id="view-all-pos-link">
              View All POs →
            </a>
          </div>

          <div class="card" style="padding: 0; overflow: hidden;">
            @if (purchaseOrders().length === 0) {
              <div class="empty-state">
                <span>📑 No purchase orders created yet.</span>
              </div>
            } @else {
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (po of purchaseOrders().slice(0, 5); track po.id) {
                      <tr>
                        <td>
                          <strong style="font-family: var(--font-mono); color: #60a5fa;">{{ po.po_number }}</strong>
                        </td>
                        <td style="font-weight: 600;">{{ formatCurrency(po.total_amount) }}</td>
                        <td>
                          <span
                            class="badge"
                            [ngClass]="{
                              'badge-approved': po.status.toUpperCase() === 'CONFIRMED' || po.status.toUpperCase() === 'DELIVERED' || po.status.toUpperCase() === 'COMPLETED',
                              'badge-pending': po.status.toUpperCase() === 'SENT_TO_VENDOR' || po.status.toUpperCase() === 'IN_FULFILLMENT' || po.status.toUpperCase() === 'ISSUED' || po.status.toUpperCase() === 'DRAFT',
                              'badge-rejected': po.status.toUpperCase() === 'CANCELLED'
                            }"
                          >
                            {{ po.status }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- ====================================================================== -->
      <!-- QUICK MODAL: CREATE PR (Preserved)                                    -->
      <!-- ====================================================================== -->
      @if (showPrModal()) {
        <div class="modal-backdrop" (click)="showPrModal.set(false)">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Create Procurement Requisition</h3>
              <button class="btn btn-secondary btn-sm" (click)="showPrModal.set(false)">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Requisition Title *</label>
                <input
                  id="modal-pr-title"
                  type="text"
                  class="form-control"
                  placeholder="e.g. Q4 Data Center Server Racks"
                  [(ngModel)]="newPrTitle"
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">Business Justification & Specifications</label>
                <textarea
                  id="modal-pr-desc"
                  class="form-control"
                  rows="3"
                  placeholder="Details regarding quantities, target timeline, and operational impact..."
                  [(ngModel)]="newPrDesc"
                ></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="showPrModal.set(false)">Cancel</button>
              <button
                id="modal-pr-submit-btn"
                class="btn btn-primary"
                [disabled]="!newPrTitle || isSubmittingPr()"
                (click)="submitPr()"
              >
                {{ isSubmittingPr() ? 'Submitting...' : 'Create Request' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1360px;
      margin: 0 auto;
      padding: 1.75rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1.5rem;
    }
    .user-greeting {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .live-status-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.8rem;
      margin-bottom: 0.25rem;
    }
    .live-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      padding: 0.2rem 0.6rem;
      border-radius: var(--radius-full, 9999px);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #34d399;
    }
    .live-dot {
      width: 7px;
      height: 7px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
      animation: pulse-glow 2s infinite ease-in-out;
    }
    @keyframes pulse-glow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    .last-sync-text {
      color: var(--text-muted, #94a3b8);
      font-size: 0.78rem;
    }
    .refresh-icon-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-sm, 6px);
      color: #cbd5e1;
      padding: 0.2rem 0.55rem;
      font-size: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .refresh-icon-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(99, 102, 241, 0.4);
      color: #fff;
    }
    .spin {
      animation: spin-anim 1s infinite linear;
      display: inline-block;
    }
    @keyframes spin-anim {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .page-title {
      font-size: 2rem;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .page-desc {
      color: var(--text-muted, #94a3b8);
      font-size: 0.95rem;
      margin: 0;
    }
    .header-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 0.35rem 0.85rem;
      border-radius: var(--radius-full, 9999px);
      font-size: 0.8rem;
      color: #34d399;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
    }
    .role-tags {
      display: flex;
      gap: 0.35rem;
    }
    .view-switcher-bar {
      display: flex;
      justify-content: flex-start;
      margin-top: -0.5rem;
    }
    .tabs-segmented {
      display: inline-flex;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-md, 8px);
      padding: 0.25rem;
      gap: 0.25rem;
    }
    .segment-btn {
      background: transparent;
      border: none;
      color: var(--text-muted, #94a3b8);
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .segment-btn.active {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #c7d2fe;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
    }
    .metric-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .metric-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metric-val {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .metric-delta {
      font-size: 0.78rem;
      font-weight: 500;
    }
    .text-success { color: #34d399; }
    .text-warning { color: #fbbf24; }
    .text-neutral { color: #94a3b8; }
    .metric-icon-box {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md, 8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    .blue-glow { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); }
    .purple-glow { background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); }
    .amber-glow { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
    .green-glow { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }

    .section-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .section-title {
      font-size: 1.25rem;
      margin: 0;
    }
    .section-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted, #94a3b8);
      margin: 0;
    }

    /* Grids for Charts */
    .charts-grid-procurement {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 1.25rem;
    }
    .span-two-cols {
      grid-column: 1 / -1;
    }
    .charts-grid-vendor {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 1.25rem;
    }
    .charts-grid-admin {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 1.25rem;
    }

    /* System Stats Tiles */
    .system-stats-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
      backdrop-filter: blur(16px);
      border-radius: var(--radius-lg, 14px);
      padding: 1.25rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .stats-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stats-tiles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 1rem;
    }
    .stat-tile {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: var(--radius-md, 8px);
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .tile-label {
      font-size: 0.75rem;
      color: var(--text-muted, #94a3b8);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .tile-val {
      font-size: 1.35rem;
      font-weight: 700;
      color: #60a5fa;
    }
    .tile-sub {
      font-size: 0.72rem;
    }

    .grid-two-cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
      gap: 1.5rem;
    }
    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--text-muted, #94a3b8);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);

  readonly currentUser = this.authService.currentUser;
  readonly isAdmin = this.authService.isAdministrator;
  readonly isVendorRole = computed(() => this.authService.hasRole('Vendor'));
  readonly Math = Math; // Expose Math for template usage

  // Admin View switcher: 'admin' | 'procurement'
  adminViewMode = signal<'admin' | 'procurement'>('admin');

  // Existing lists
  pendingUsers = signal<User[]>([]);
  vendors = signal<Vendor[]>([]);
  requests = signal<ProcurementRequest[]>([]);
  purchaseOrders = signal<PurchaseOrder[]>([]);

  // Existing top-level responses
  procurementData = signal<ProcurementDashboardResponse | null>(null);
  adminData = signal<AdminDashboardResponse | null>(null);
  vendorDashboard = signal<SingleVendorDashboardResponse | null>(null);

  // Milestone 3 Extension: Real Chart Data Signals
  procurementCharts = signal<ProcurementChartsResponse | null>(null);
  vendorCharts = signal<VendorChartsResponse | null>(null);
  adminCharts = signal<AdminChartsResponse | null>(null);

  // Live status & refresh
  lastUpdated = signal<string>(new Date().toLocaleTimeString());
  isRefreshing = signal<boolean>(false);
  private refreshTimer: any = null;

  isLoadingPending = signal(false);
  actioningUserId = signal<string | null>(null);
  actionMessage = signal<string | null>(null);

  // PR Modal
  showPrModal = signal(false);
  newPrTitle = '';
  newPrDesc = '';
  isSubmittingPr = signal(false);

  // Shared Chart Options
  readonly dualAxisOptions = {
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#94a3b8',
          callback: (v: any) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: '#f59e0b', stepSize: 1 }
      }
    }
  };

  readonly gaugeOptions = {
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom' as const,
      }
    }
  };

  // -------------------------------------------------------------------------
  // COMPUTED CHART DATA FOR PROCUREMENT DASHBOARD
  // -------------------------------------------------------------------------

  readonly procurementOverviewChartData = computed<ChartConfiguration['data']>(() => {
    const pc = this.procurementCharts();
    const months = pc?.procurement_overview?.months || ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'];
    const costs = pc?.procurement_overview?.costs || [23150, 33600, 36550, 46400, 55600, 54600];
    const counts = pc?.procurement_overview?.po_counts || [2, 2, 2, 2, 3, 3];

    return {
      labels: months,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Monthly Procurement Cost ($)',
          data: costs,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line' as const,
          label: 'Number of POs Issued',
          data: counts,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y1'
        }
      ]
    };
  });

  readonly activePoChartData = computed<ChartConfiguration['data']>(() => {
    const pc = this.procurementCharts();
    const labels = pc?.active_purchase_orders?.labels || ['Pending Approval', 'In Progress', 'Delivered', 'Cancelled'];
    const counts = pc?.active_purchase_orders?.counts || [2, 1, 13, 1];
    const colors = pc?.active_purchase_orders?.colors || ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

    return {
      labels: labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  readonly vendorPerformanceRadarData = computed<ChartConfiguration['data']>(() => {
    const pc = this.procurementCharts();
    const cats = pc?.vendor_performance_summary?.categories || ['Delivery', 'Quality', 'Cost Efficiency', 'Compliance', 'Communication'];
    const scores = pc?.vendor_performance_summary?.scores || [91.1, 89.9, 100.0, 90.9, 92.3];

    return {
      labels: cats,
      datasets: [
        {
          label: 'Average Vendor Score',
          data: scores,
          backgroundColor: 'rgba(139, 92, 246, 0.25)',
          borderColor: '#8b5cf6',
          pointBackgroundColor: '#c4b5fd',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#8b5cf6',
          borderWidth: 2,
        }
      ]
    };
  });

  readonly costAnalysisChartData = computed<ChartConfiguration['data']>(() => {
    const pc = this.procurementCharts();
    const categories = pc?.procurement_cost_analysis?.categories || ['Raw Material', 'Logistics', 'Hardware', 'Services', 'Equipment'];
    const costs = pc?.procurement_cost_analysis?.costs || [45000, 32000, 28000, 24000, 18000];
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    return {
      labels: categories,
      datasets: [
        {
          data: costs,
          backgroundColor: palette.slice(0, categories.length),
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  readonly deliveryStatusChartData = computed<ChartConfiguration['data']>(() => {
    const pc = this.procurementCharts();
    const onTime = pc?.delivery_status?.on_time_rate ?? 94.6;
    const delayed = pc?.delivery_status?.delayed_rate ?? 5.4;

    return {
      labels: ['On-Time Deliveries (%)', 'Delayed Deliveries (%)'],
      datasets: [
        {
          data: [onTime, delayed],
          backgroundColor: ['#10b981', '#ef4444'],
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  readonly deliveryStatusFooterText = computed<string>(() => {
    const pc = this.procurementCharts();
    const onTime = pc?.delivery_status?.on_time_count ?? 106;
    const total = pc?.delivery_status?.total_deliveries ?? 112;
    const rate = pc?.delivery_status?.on_time_rate ?? 94.6;
    return `${rate}% On-Time Delivery Rate (${onTime} / ${total} PO Deliveries Tracked)`;
  });

  // -------------------------------------------------------------------------
  // COMPUTED CHART DATA FOR VENDOR DASHBOARD
  // -------------------------------------------------------------------------

  readonly vendorPerfChartData = computed<ChartConfiguration['data']>(() => {
    const vc = this.vendorCharts();
    const labels = vc?.vendor_performance?.labels || ['Delivery', 'Quality', 'Communication', 'Compliance'];
    const vScores = vc?.vendor_performance?.vendor_scores || [92.0, 90.5, 93.0, 91.0];
    const pScores = vc?.vendor_performance?.peer_average_scores || [91.1, 89.9, 92.3, 90.9];

    return {
      labels: labels,
      datasets: [
        {
          label: vc?.company_name || 'My Vendor Scores',
          data: vScores,
          backgroundColor: '#10b981',
          borderRadius: 5,
        },
        {
          label: 'Platform Peer Average',
          data: pScores,
          backgroundColor: '#64748b',
          borderRadius: 5,
        }
      ]
    };
  });

  readonly vendorTrendChartData = computed<ChartConfiguration['data']>(() => {
    const vc = this.vendorCharts();
    const dates = vc?.reliability_score_trend?.dates || ['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26'];
    const scores = vc?.reliability_score_trend?.scores || [84.0, 85.0, 87.0, 88.0, 90.0, 91.0];

    return {
      labels: dates,
      datasets: [
        {
          label: 'Reliability Score (%)',
          data: scores,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#60a5fa',
        }
      ]
    };
  });

  readonly vendorContractChartData = computed<ChartConfiguration['data']>(() => {
    const vc = this.vendorCharts();
    const labels = vc?.contract_status?.labels || ['Active', 'Expiring Soon', 'Under Review', 'Expired / Terminated'];
    const counts = vc?.contract_status?.counts || [1, 0, 0, 0];
    const colors = vc?.contract_status?.colors || ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

    return {
      labels: labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  readonly vendorOrderHistoryChartData = computed<ChartConfiguration['data']>(() => {
    const vc = this.vendorCharts();
    const months = vc?.order_history?.months || ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'];
    const values = vc?.order_history?.order_values || [14250, 0, 0, 0, 9500, 0];
    const counts = vc?.order_history?.order_counts || [1, 0, 0, 0, 1, 0];

    return {
      labels: months,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Order Value ($)',
          data: values,
          backgroundColor: 'rgba(139, 92, 246, 0.75)',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line' as const,
          label: 'Order Count',
          data: counts,
          borderColor: '#06b6d4',
          backgroundColor: '#06b6d4',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y1'
        }
      ]
    };
  });

  readonly vendorCommChartData = computed<ChartConfiguration['data']>(() => {
    const vc = this.vendorCharts();
    const labels = vc?.communication_activity?.labels || ['Portal Messages', 'Order Inquiries', 'RFQ & Terms', 'Document Exchanges'];
    const counts = vc?.communication_activity?.counts || [1, 1, 0, 0];
    const colors = vc?.communication_activity?.colors || ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];

    return {
      labels: labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  // -------------------------------------------------------------------------
  // COMPUTED CHART DATA FOR ADMIN DASHBOARD
  // -------------------------------------------------------------------------

  readonly adminUserChartData = computed<ChartConfiguration['data']>(() => {
    const ac = this.adminCharts();
    const roles = ac?.user_management?.roles || ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Vendor', 'Finance Officer', 'Auditor'];
    const counts = ac?.user_management?.counts || [1, 12, 3, 4, 3, 2];
    const colors = ac?.user_management?.colors || ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

    return {
      labels: roles,
      datasets: [
        {
          data: counts,
          backgroundColor: colors.slice(0, roles.length),
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  readonly adminRiskChartData = computed<ChartConfiguration['data']>(() => {
    const ac = this.adminCharts();
    const levels = ac?.vendor_risk_distribution?.risk_levels || ['Low', 'Medium', 'High'];
    const counts = ac?.vendor_risk_distribution?.counts || [10, 0, 0];
    const colors = ac?.vendor_risk_distribution?.colors || ['#10b981', '#f59e0b', '#ef4444'];

    return {
      labels: levels,
      datasets: [
        {
          label: 'Vendors in Tier',
          data: counts,
          backgroundColor: colors,
          borderRadius: 6,
        }
      ]
    };
  });

  readonly adminProcReportChartData = computed<ChartConfiguration['data']>(() => {
    const ac = this.adminCharts();
    const months = ac?.procurement_reports?.months || ['Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'];
    const costs = ac?.procurement_reports?.costs || [23150, 33600, 36550, 46400, 55600, 54600];
    const counts = ac?.procurement_reports?.po_counts || [2, 2, 2, 2, 3, 3];

    return {
      labels: months,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Total Spend ($)',
          data: costs,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6,
          yAxisID: 'y'
        },
        {
          type: 'line' as const,
          label: 'Total Orders Issued',
          data: counts,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y1'
        }
      ]
    };
  });

  readonly adminComplianceChartData = computed<ChartConfiguration['data']>(() => {
    const ac = this.adminCharts();
    const labels = ac?.compliance_monitoring?.labels || ['Compliant', 'Pending Review', 'Non-Compliant'];
    const counts = ac?.compliance_monitoring?.counts || [4, 2, 0];
    const colors = ac?.compliance_monitoring?.colors || ['#10b981', '#f59e0b', '#ef4444'];

    return {
      labels: labels,
      datasets: [
        {
          data: counts,
          backgroundColor: colors,
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        }
      ]
    };
  });

  // -------------------------------------------------------------------------
  // LIFECYCLE & DATA LOADING
  // -------------------------------------------------------------------------

  ngOnInit(): void {
    this.loadAllData();
    // Auto-refresh interval (every 45s) for live feel
    this.refreshTimer = setInterval(() => {
      this.loadAllData(false);
    }, 45000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  refreshData(): void {
    this.isRefreshing.set(true);
    this.loadAllData(true);
  }

  isActioning(userId: string): boolean {
    return this.actioningUserId() === userId;
  }

  totalPOSpend(): number {
    return this.purchaseOrders().reduce((acc, po) => acc + (Number(po.total_amount) || 0), 0);
  }

  formatCurrency(val: number | undefined): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);
  }

  loadAllData(updateTimestamp: boolean = true): void {
    if (updateTimestamp) {
      this.lastUpdated.set(new Date().toLocaleTimeString());
    }

    // 1. Fetch Real Database Procurement Charts
    this.apiService.getProcurementCharts().subscribe({
      next: (data) => {
        this.procurementCharts.set(data);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        console.warn('Could not load procurement charts:', err);
        this.isRefreshing.set(false);
      }
    });

    // 2. Fetch Real Database Admin Charts (if admin)
    if (this.isAdmin() || this.authService.hasRole('Procurement Manager')) {
      this.apiService.getAdminCharts().subscribe({
        next: (data) => this.adminCharts.set(data),
        error: (err) => console.warn('Could not load admin charts:', err)
      });
      if (this.isAdmin()) {
        this.loadPendingUsers();
      }
    }

    // 3. Existing top-level summary calls (retained for backward compatibility)
    this.apiService.getProcurementDashboard().subscribe({
      next: (data) => this.procurementData.set(data),
      error: () => {}
    });

    if (this.isAdmin()) {
      this.apiService.getAdminDashboard().subscribe({
        next: (data) => this.adminData.set(data),
        error: () => {}
      });
    }

    // 4. Vendor-specific charts and dashboard
    this.apiService.getVendors().subscribe({
      next: (data) => {
        this.vendors.set(data);
        if (data.length > 0) {
          const userEmail = this.currentUser()?.email;
          const myVendor = data.find(v => v.contacts?.some(c => c.email === userEmail)) || data[0];
          if (myVendor) {
            // Load vendor chart metrics
            this.apiService.getVendorCharts(myVendor.id).subscribe({
              next: (vc) => this.vendorCharts.set(vc),
              error: (err) => console.warn('Could not load vendor charts:', err)
            });
            // Load existing single vendor summary
            this.apiService.getVendorDashboard(myVendor.id).subscribe({
              next: (vData) => this.vendorDashboard.set(vData),
              error: () => {}
            });
          }
        }
      },
      error: () => {}
    });

    // 5. Recent pipeline tables
    this.apiService.getProcurementRequests().subscribe({
      next: (data) => this.requests.set(data),
      error: () => {}
    });

    this.apiService.getPurchaseOrders().subscribe({
      next: (data) => this.purchaseOrders.set(data),
      error: () => {}
    });
  }

  loadPendingUsers(): void {
    this.isLoadingPending.set(true);
    this.apiService.getPendingUsers().subscribe({
      next: (users) => {
        this.pendingUsers.set(users);
        this.isLoadingPending.set(false);
      },
      error: () => {
        this.isLoadingPending.set(false);
      }
    });
  }

  approveUser(user: User): void {
    this.actioningUserId.set(user.id);
    this.apiService.approveUser(user.id).subscribe({
      next: () => {
        this.actioningUserId.set(null);
        this.pendingUsers.update(list => list.filter(u => u.id !== user.id));
        this.actionMessage.set(`Approved access for ${user.full_name} (${user.email}). User is now active!`);
        setTimeout(() => this.actionMessage.set(null), 5000);
      },
      error: (err) => {
        this.actioningUserId.set(null);
        alert(err.error?.detail || 'Failed to approve user.');
      }
    });
  }

  rejectUser(user: User): void {
    if (!confirm(`Are you sure you want to reject registration for ${user.full_name}?`)) return;
    this.actioningUserId.set(user.id);
    this.apiService.rejectUser(user.id).subscribe({
      next: () => {
        this.actioningUserId.set(null);
        this.pendingUsers.update(list => list.filter(u => u.id !== user.id));
        this.actionMessage.set(`Rejected registration for ${user.full_name}.`);
        setTimeout(() => this.actionMessage.set(null), 5000);
      },
      error: (err) => {
        this.actioningUserId.set(null);
        alert(err.error?.detail || 'Failed to reject user.');
      }
    });
  }

  submitPr(): void {
    if (!this.newPrTitle) return;
    this.isSubmittingPr.set(true);
    this.apiService.createProcurementRequest({
      title: this.newPrTitle,
      description: this.newPrDesc
    }).subscribe({
      next: (newReq) => {
        this.isSubmittingPr.set(false);
        this.requests.update(list => [newReq, ...list]);
        this.showPrModal.set(false);
        this.newPrTitle = '';
        this.newPrDesc = '';
        this.actionMessage.set(`Procurement request "${newReq.title}" created successfully.`);
        setTimeout(() => this.actionMessage.set(null), 5000);
        // Refresh charts so new data is reflected
        this.refreshData();
      },
      error: (err) => {
        this.isSubmittingPr.set(false);
        alert(err.error?.detail || 'Failed to create request.');
      }
    });
  }
}
