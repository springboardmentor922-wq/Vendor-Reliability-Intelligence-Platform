import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],

  template: `
    <div class="app-shell">

      <!-- SIDEBAR -->
      <aside class="sidebar">

        <div class="brand">
          <div class="brand-mark">VI</div>

          <div class="brand-text">
            <strong>Vendor Intel</strong>
            <span>Procurement Intelligence</span>
          </div>
        </div>

        <div class="sidebar-section">
          <span class="section-label">WORKSPACE</span>

          <a *ngIf="canView('dashboard')" routerLink="/dashboard" class="nav-item active">
            <span class="nav-icon">⌂</span>
            <span>Dashboard</span>
          </a>

          <a *ngIf="canView('vendors')" routerLink="/vendors" class="nav-item">
            <span class="nav-icon">◉</span>
            <span>Vendors</span>
          </a>

          <a *ngIf="canView('vendor-approval')" routerLink="/vendor-approval" class="nav-item">
            <span class="nav-icon">✓</span>
            <span>Vendor Approval</span>
          </a>

          <a *ngIf="canView('procurement')" routerLink="/procurement" class="nav-item">
            <span class="nav-icon">▣</span>
            <span>Procurement</span>
          </a>

          <a *ngIf="canView('purchase-orders')" routerLink="/purchase-orders" class="nav-item">
            <span class="nav-icon">▤</span>
            <span>Purchase Orders</span>
          </a>

          <a *ngIf="canView('contracts')" routerLink="/contracts" class="nav-item">
            <span class="nav-icon">□</span>
            <span>Contracts</span>
          </a>

          <a *ngIf="canView('communication')" routerLink="/communications" class="nav-item">
            <span class="nav-icon">✉</span>
            <span>Communication</span>
          </a>
        </div>

        <div class="sidebar-section">

          <span class="section-label">INSIGHTS</span>

          <a *ngIf="canView('performance')" routerLink="/performance" class="nav-item">
            <span class="nav-icon">◈</span>
            <span>Performance</span>
          </a>

          <a *ngIf="canView('reliability')" routerLink="/reliability" class="nav-item">
            <span class="nav-icon">★</span>
            <span>Reliability</span>
          </a>

          <a *ngIf="canView('analytics')" routerLink="/analytics" class="nav-item">
            <span class="nav-icon">▥</span>
            <span>Analytics</span>
          </a>

          <a *ngIf="canView('reports')" routerLink="/reports" class="nav-item">
            <span class="nav-icon">▤</span>
            <span>Reports</span>
          </a>

          <a *ngIf="canView('notifications')" routerLink="/notifications" class="nav-item">
            <span class="nav-icon">♢</span>
            <span>Notifications</span>
          </a>

        </div>

        <div class="sidebar-bottom">

          <div class="profile-mini">
            <div class="profile-avatar">
              {{ userName.charAt(0).toUpperCase() }}
            </div>

            <div>
              <strong>{{ userName }}</strong>
              <span>{{ userRole }}</span>
            </div>
          </div>

          <button class="logout-btn" (click)="logout()">
            <span>⇥</span>
            Logout
          </button>

        </div>

      </aside>


      <!-- MAIN CONTENT -->
      <main class="main-content">

        <!-- TOP BAR -->
        <header class="topbar">

          <div class="search-box">
            <span>⌕</span>
            <input
                                  type="text"
                                  placeholder="Search vendors, contracts, purchase orders..."
                                 [(ngModel)]="searchText"
                                  (input)="globalSearch()"
                               >
          </div>
        
             <div
                                     class="search-results"
                                    *ngIf="searchText.trim() && searchResults.length > 0"
                                       >
                                <div
                                  class="search-result"
                                 *ngFor="let result of searchResults"
                                    (click)="openSearchResult(result)"
                                  >
                                 <strong>{{ result.name }}</strong>
                                 <span>{{ result.type }}</span>
                                 </div>
                                 </div>

          <div class="topbar-right">

            <button class="notification-btn">
              ♧
              <span class="notification-dot"></span>
            </button>

            <div class="top-profile">
              <div class="top-avatar">
                {{ userName.charAt(0).toUpperCase() }}
              </div>

              <div>
                <strong>{{ userName }}</strong>
                <span>{{ userRole }}</span>
              </div>
            </div>

          </div>

        </header>


        <!-- PAGE -->
        <div class="page-content">

          <!-- WELCOME -->
          <section class="welcome-section">

            <div>
              <div class="eyebrow">PROCUREMENT OPERATIONS</div>

              <h1>
                Welcome back, {{ userName }}
              </h1>

              <p>
                Monitor vendors, procurement activity and operational risk
                from one central workspace.
              </p>
            </div>

            <div class="date-card">
              <span class="calendar-icon">□</span>

              <div>
                <small>REPORTING PERIOD</small>
                <strong>January — June 2026</strong>
              </div>

              <span class="arrow">⌄</span>
            </div>

          </section>


          <!-- QUICK ACTIONS -->
          <section class="section-block">

            <div class="section-heading">
              <div>
                <h2>Quick Actions</h2>
                <p>Access frequently used procurement operations</p>
              </div>
            </div>

            <div class="quick-actions">

              <a *ngIf="userRole === 'ADMINISTRATOR' || userRole === 'PROCUREMENT_MANAGER'" routerLink="/vendors" class="action-card">
                <div class="action-icon blue">+</div>
                <div>
                  <strong>Add Vendor</strong>
                  <span>Register a new supplier</span>
                </div>
                <b>→</b>
              </a>

              <a *ngIf="userRole === 'ADMINISTRATOR' || userRole === 'PROCUREMENT_MANAGER' || userRole === 'SUPPLY_CHAIN_MANAGER'" routerLink="/procurement" class="action-card">
                <div class="action-icon slate">▣</div>
                <div>
                  <strong>New Requisition</strong>
                  <span>Create procurement request</span>
                </div>
                <b>→</b>
              </a>

              <a *ngIf="userRole === 'ADMINISTRATOR' || userRole === 'PROCUREMENT_MANAGER'" routerLink="/purchase-orders" class="action-card">
                <div class="action-icon teal">+</div>
                <div>
                  <strong>Create Purchase Order</strong>
                  <span>Start a new purchase order</span>
                </div>
                <b>→</b>
              </a>

             <a *ngIf="userRole === 'ADMINISTRATOR' || userRole === 'PROCUREMENT_MANAGER' || userRole === 'SUPPLY_CHAIN_MANAGER' || userRole === 'AUDITOR'" routerLink="/vendor-approval" class="action-card">
                <div class="action-icon amber">✓</div>
                <div>
                  <strong>Review Approvals</strong>
                  <span>Check pending vendor requests</span>
                </div>
                <b>→</b>
              </a>
            
            <a *ngIf="userRole === 'FINANCE_OFFICER'" routerLink="/purchase-orders" class="action-card">
  <div class="action-icon teal">₹</div>
  <div>
    <strong>View Purchase Orders</strong>
    <span>Review purchase order records</span>
  </div>
  <b>→</b>
</a>
                      <a *ngIf="userRole === 'VENDOR'" routerLink="/contracts" class="action-card">
  <div class="action-icon blue">□</div>
  <div>
    <strong>View Contracts</strong>
    <span>Review your vendor contracts</span>
  </div>
  <b>→</b>
</a>

            </div>

          </section>


          <!-- KPI SNAPSHOT -->
          <section class="section-block">

            <div class="section-heading">
              <div>
                <h2>Today's Procurement Snapshot</h2>
                <p>Current operational overview</p>
              </div>
            </div>

            <div class="kpi-grid">

              <div class="kpi-card">

                <div class="kpi-top">
                  <span>Total Vendors</span>
                  <div class="kpi-icon blue-soft">◉</div>
                </div>

                <strong>{{ vendorCount }}</strong>

                <div class="kpi-bottom">
                  <span class="positive">↑ 8%</span>
                  <span>vs last month</span>
                </div>

              </div>


              <div class="kpi-card">

                <div class="kpi-top">
                  <span>Active Purchase Orders</span>
                  <div class="kpi-icon slate-soft">▤</div>
                </div>

                <strong>{{ purchaseOrderCount }}</strong>

                <div class="kpi-bottom">
                  <span class="positive">↑ 12%</span>
                  <span>vs last month</span>
                </div>

              </div>


              <div class="kpi-card">

                <div class="kpi-top">
                  <span>Pending Approvals</span>
                  <div class="kpi-icon amber-soft">✓</div>
                </div>

                <strong>{{ pendingApprovalCount }}</strong>

                <div class="kpi-bottom">
                  <span class="warning-text">Needs review</span>
                  <span>today</span>
                </div>

              </div>


              <div class="kpi-card">

                <div class="kpi-top">
                  <span>Reliability Score</span>
                  <div class="kpi-icon teal-soft">★</div>
                </div>

                <strong>{{ reliabilityScore }}%</strong>

                <div class="kpi-bottom">
                  <span class="positive">↑ 4%</span>
                  <span>platform average</span>
                </div>

              </div>

            </div>

          </section>


          <!-- ATTENTION + ACTIVITY -->
          <section class="two-column section-block">

            <!-- ATTENTION -->
            <div class="panel">

              <div class="panel-header">
                <div>
                  <h2>Attention Required</h2>
                  <p>Items that may need your action</p>
                </div>

                <span class="count-badge">{{ pendingApprovalCount }}</span>
              </div>


              <div class="attention-list">

                <div class="attention-item">

                  <div class="attention-icon warning">
                    !
                  </div>

                  <div class="attention-content">
                    <strong>Pending vendor approvals</strong>
                    <span> {{ pendingApprovalCount }} vendor requests are awaiting review</span>
                  </div>

                  <a routerLink="/vendor-approval">Review →</a>

                </div>


                <div class="attention-item">

                  <div class="attention-icon danger">
                    !
                  </div>

                  <div class="attention-content">
                    <strong>Delivery performance</strong>
                    <span>2 purchase orders require attention</span>
                  </div>

                  <a routerLink="/purchase-orders">View →</a>

                </div>


                <div class="attention-item">

                  <div class="attention-icon neutral">
                    □
                  </div>

                  <div class="attention-content">
                    <strong>Contract review</strong>
                    <span>{{ expiringContracts }} contracts are approaching expiry</span>
                  </div>

                  <a routerLink="/contracts">Review →</a>

                </div>

              </div>

            </div>
            <!-- ACTIVITY -->
            <div class="panel">

              <div class="panel-header">

                <div>
                  <h2>Recent Activity</h2>
                  <p>Latest platform events</p>
                </div>

                <a routerLink="/notifications">View all →</a>

              </div>


              


                <div class="activity-list">

  <div class="activity-item" *ngFor="let activity of recentActivities">

    <div class="activity-dot success"></div>

    <div>
      <strong>{{ activity.action }}</strong>
      <span>{{ activity.related_record }} · {{ activity.created_at | date:'short' }}</span>
    </div>

  </div>

</div>
 
 </div>


          </section>


          <!-- RELIABILITY -->
          <section class="reliability-panel section-block">

            <div class="reliability-info">

              <div class="eyebrow">VENDOR HEALTH</div>

              <h2>Platform Reliability</h2>

              <p>
                Overall supplier reliability based on delivery,
                quality and operational performance.
              </p>

              <a routerLink="/reliability" class="outline-btn">
                View Reliability →
              </a>

            </div>


            <div class="reliability-score">

              <div class="score-circle">
                <strong>{{ reliabilityScore }}%</strong>
                <span>Reliable</span>
              </div>

            </div>


            <div class="reliability-stats">

              <div>
              
                <span>Delivery</span>
                <strong>92%</strong>
              </div>

              <div>
                <span>Quality</span>
                <strong>95%</strong>
              </div>

              <div>
                <span>Compliance</span>
                <strong>97%</strong>
              </div>

            </div>

          </section>


          <!-- ANALYTICS -->
          <section class="section-block">

            <div class="section-heading">
              <div>
                <div class="eyebrow">ANALYTICS</div>
                <h2>Procurement Analytics</h2>
                <p>Operational trends and supplier insights</p>
              </div>

              <a routerLink="/analytics" class="view-link">
                View Analytics →
              </a>
            </div>


            <div class="analytics-grid">

              <!-- PURCHASE ORDER STATUS -->
              <div class="analytics-card">

                <div class="analytics-header">
                  <div>
                    <strong>Purchase Order Status</strong>
                    <span>Current order distribution</span>
                  </div>

                  <a routerLink="/purchase-orders">
                    Details →
                  </a>
                </div>


                <div class="donut-wrapper">

                  <div class="donut-chart">

                    <div class="donut-center">
                      <strong>28</strong>
                      <span>Orders</span>
                    </div>

                  </div>

                </div>


                <div class="reliability-legend">

                  <div>
                    <span class="legend-dot green-dot"></span>
                    Active
                  </div>

                  <div>
                    <span class="legend-dot amber-dot"></span>
                    Completed
                  </div>

                </div>

              </div>


              <!-- PROCUREMENT VOLUME -->
              <div class="analytics-card">

                <div class="analytics-header">
                  <div>
                    <strong>Procurement Volume</strong>
                    <span>Monthly purchase activity</span>
                  </div>

                  <a routerLink="/procurement">
                    Details →
                  </a>
                </div>


                <div class="bar-chart">

                  <div class="bar-item">

                    <div class="bar-label">
                      <span>January</span>
                      <strong>28</strong>
                    </div>

                    <div class="bar-track">
                      <div
                        class="bar-fill blue-fill"
                        style="width: 78%">
                      </div>
                    </div>

                  </div>


                  <div class="bar-item">

                    <div class="bar-label">
                      <span>February</span>
                      <strong>34</strong>
                    </div>

                    <div class="bar-track">
                      <div
                        class="bar-fill blue-fill"
                        style="width: 88%">
                      </div>
                    </div>

                  </div>


                  <div class="bar-item">

                    <div class="bar-label">
                      <span>March</span>
                      <strong>41</strong>
                    </div>

                    <div class="bar-track">
                      <div
                        class="bar-fill blue-fill"
                        style="width: 96%">
                      </div>
                    </div>

                  </div>

                </div>

              </div>


              <!-- RELIABILITY PERFORMANCE -->
              <div class="analytics-card">

                <div class="analytics-header">
                  <div>
                    <strong>Reliability Performance</strong>
                    <span>Supplier health indicators</span>
                  </div>

                  <a routerLink="/reliability">
                    Details →
                  </a>
                </div>


                <div class="performance-list">

                  <div class="performance-row">

                    <div class="performance-label">
                      <span>Delivery</span>
                      <strong>92%</strong>
                    </div>

                    <div class="performance-track">
                      <div
                        class="performance-fill"
                        style="width: 92%">
                      </div>
                    </div>

                  </div>


                  <div class="performance-row">

                    <div class="performance-label">
                      <span>Quality</span>
                      <strong>95%</strong>
                    </div>

                    <div class="performance-track">
                      <div
                        class="performance-fill"
                        style="width: 95%">
                      </div>
                    </div>

                  </div>


                  <div class="performance-row">

                    <div class="performance-label">
                      <span>Compliance</span>
                      <strong>97%</strong>
                    </div>

                    <div class="performance-track">
                      <div
                        class="performance-fill"
                        style="width: 97%">
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- PROCUREMENT SUMMARY -->
          <section class="section-block">

            <div class="section-heading">

              <div>
                <div class="eyebrow">PROCUREMENT</div>
                <h2>Procurement Summary</h2>
                <p>Current procurement workflow overview</p>
              </div>

              <a routerLink="/procurement" class="view-link">
                Open Procurement →
              </a>

            </div>


            <div class="summary-card">

              <div class="summary-grid">

                <div class="summary-item">

                  <div class="summary-icon blue-soft">
                    ▣
                  </div>

                  <div>
                    <strong>18</strong>
                    <span>Total Requisitions</span>
                  </div>

                </div>


                <div class="summary-item">

                  <div class="summary-icon amber-soft">
                    ✓
                  </div>

                  <div>
                    <strong>7</strong>
                    <span>Pending Approval</span>
                  </div>

                </div>


                <div class="summary-item">

                  <div class="summary-icon teal-soft">
                    $
                  </div>

                  <div>
                    <strong>₹8.4L</strong>
                    <span>Total Procurement Value</span>
                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- APPROVAL SUMMARY -->
          <section class="section-block">

            <div class="section-heading">

              <div>
                <div class="eyebrow">APPROVAL WORKFLOW</div>
                <h2>Approval Summary</h2>
                <p>Vendor and procurement approval status</p>
              </div>

              <a routerLink="/vendor-approval" class="view-link">
                Review Approvals →
              </a>

            </div>


            <div class="summary-card">

              <div class="summary-grid">

                <div class="summary-item">

                  <div class="summary-icon amber-soft">
                    !
                  </div>

                  <div>
                    <strong>5</strong>
                    <span>Pending Vendor Approvals</span>
                  </div>

                </div>


                <div class="summary-item">

                  <div class="summary-icon teal-soft">
                    ✓
                  </div>

                  <div>
                    <strong>24</strong>
                    <span>Approved Vendors</span>
                  </div>

                </div>


                <div class="summary-item">

                  <div class="summary-icon blue-soft">
                    ↻
                  </div>

                  <div>
                    <strong>3</strong>
                    <span>Under Review</span>
                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- VENDOR OVERVIEW -->
          <section class="section-block">

            <div class="section-heading">

              <div>
                <div class="eyebrow">VENDOR MANAGEMENT</div>
                <h2>Vendor Overview</h2>
                <p>Supplier network status</p>
              </div>

              <a routerLink="/vendors" class="view-link">
                View Vendors →
              </a>

            </div>


            <div class="vendor-overview">

              <div class="vendor-main-number">

                <strong>42</strong>

                <span>
                  Registered vendors across the procurement network
                </span>

              </div>


              <div class="vendor-status">

                <div class="status-layout">

                  <div>
                    <span class="status-label">
                      Vendor Network Status
                    </span>

                    <strong>
                      Operational
                    </strong>
                  </div>

                  <span class="status-pill success">
                    ACTIVE
                  </span>

                </div>

              </div>

            </div>

          </section>


          <!-- FOOTER -->
          <footer class="dashboard-footer">

            <div>
              <strong>Vendor Intel Platform</strong>
              <span>
                Procurement intelligence and supplier risk management
              </span>
            </div>

            <div class="footer-items">
              <span>System Status: Operational</span>
              <span>Data Updated: Today</span>
              <span>v1.0</span>
            </div>

          </footer>

        </div>

      </main>

    </div>
  `,

  styles: [`    /* =========================
       GLOBAL
       ========================= */

    * {
      box-sizing: border-box;
    }

    .app-shell {
      min-height: 100vh;
      background: #f6f8fb;
      color: #263247;
      font-family: Arial, Helvetica, sans-serif;
    }


    /* =========================
       SIDEBAR
       ========================= */

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 245px;
      height: 100vh;
      background: #ffffff;
      border-right: 1px solid #e6eaf0;
      display: flex;
      flex-direction: column;
      z-index: 100;
    }

    .brand {
      height: 78px;
      padding: 0 22px;
      display: flex;
      align-items: center;
      gap: 11px;
      border-bottom: 1px solid #edf0f4;
    }

    .brand-mark {
      width: 37px;
      height: 37px;
      border-radius: 9px;
      background: #275edc;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-text strong {
      color: #202b40;
      font-size: 14px;
    }

    .brand-text span {
      margin-top: 3px;
      color: #919aaa;
      font-size: 8px;
      letter-spacing: .7px;
      text-transform: uppercase;
    }

    .sidebar-section {
      padding: 21px 14px 0;
    }

    .section-label {
      display: block;
      padding: 0 10px 9px;
      color: #9aa3b2;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .nav-item {
      height: 39px;
      margin-bottom: 3px;
      padding: 0 11px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      gap: 11px;
      color: #6d7788;
      font-size: 11px;
      text-decoration: none;
      transition: .2s;
    }

    .nav-item:hover {
      background: #f5f7fb;
      color: #275edc;
    }

    .nav-item.active {
      background: #edf3ff;
      color: #275edc;
      font-weight: 600;
    }

    .nav-icon {
      width: 18px;
      text-align: center;
      font-size: 14px;
    }

    .sidebar-bottom {
      margin-top: auto;
      padding: 14px;
      border-top: 1px solid #edf0f4;
    }

    .profile-mini {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 11px;
    }

    .profile-avatar {
      width: 33px;
      height: 33px;
      border-radius: 50%;
      background: #edf3ff;
      color: #275edc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
    }

    .profile-mini > div:last-child {
      display: flex;
      flex-direction: column;
    }

    .profile-mini strong {
      color: #354055;
      font-size: 10px;
    }

    .profile-mini span {
      margin-top: 3px;
      color: #929baa;
      font-size: 8px;
    }

    .logout-btn {
      width: 100%;
      height: 33px;
      border: 1px solid #e3e7ed;
      border-radius: 6px;
      background: #ffffff;
      color: #697487;
      cursor: pointer;
      font-size: 10px;
    }

    .logout-btn:hover {
      background: #f7f8fa;
    }


    /* =========================
       MAIN
       ========================= */

    .main-content {
      margin-left: 245px;
      min-height: 100vh;
    }

    .topbar {
      height: 66px;
      padding: 0 29px;
      background: #ffffff;
      border-bottom: 1px solid #e6eaf0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .search-box {
      width: 365px;
      height: 35px;
      padding: 0 11px;
      border: 1px solid #e3e7ed;
      border-radius: 7px;
      background: #fafbfc;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .search-box span {
      color: #8d97a7;
      font-size: 17px;
    }

    .search-box input {
      width: 100%;
      border: 0;
      outline: 0;
      background: transparent;
      color: #4b5669;
      font-size: 10px;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .notification-btn {
      position: relative;
      border: 0;
      background: transparent;
      color: #697487;
      cursor: pointer;
      font-size: 17px;
    }

    .notification-dot {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ef5b5b;
    }

    .top-profile {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .top-profile > div:last-child {
      display: flex;
      flex-direction: column;
    }

    .top-profile strong {
      color: #354055;
      font-size: 10px;
    }

    .top-profile span {
      margin-top: 2px;
      color: #929baa;
      font-size: 8px;
    }

    .top-avatar {
      width: 31px;
      height: 31px;
      border-radius: 50%;
      background: #edf3ff;
      color: #275edc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }


    /* =========================
       PAGE
       ========================= */

    .page-content {
      max-width: 1500px;
      margin: 0 auto;
      padding: 27px 29px 34px;
    }

    .welcome-section {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 28px;
    }

    .eyebrow {
      margin-bottom: 7px;
      color: #6480b4;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .welcome-section h1 {
      margin: 0;
      color: #182237;
      font-size: 26px;
      line-height: 1.2;
    }

    .welcome-section p {
      margin: 8px 0 0;
      max-width: 600px;
      color: #7f8999;
      font-size: 10px;
      line-height: 1.6;
    }

    .date-card {
      min-width: 228px;
      height: 56px;
      padding: 0 13px;
      border: 1px solid #e4e8ee;
      border-radius: 8px;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .calendar-icon {
      width: 27px;
      height: 27px;
      border-radius: 6px;
      background: #edf3ff;
      color: #275edc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }

    .date-card div {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .date-card small {
      color: #9aa3b2;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: .7px;
    }

    .date-card strong {
      margin-top: 4px;
      color: #394459;
      font-size: 9px;
    }

    .date-card .arrow {
      color: #8993a3;
      font-size: 13px;
    }


    /* =========================
       COMMON SECTIONS
       ========================= */

    .section-block {
      margin-bottom: 27px;
    }

    .section-heading {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 13px;
    }

    .section-heading h2 {
      margin: 0;
      color: #202a3d;
      font-size: 15px;
    }

    .section-heading p {
      margin: 4px 0 0;
      color: #929baa;
      font-size: 9px;
    }

    .view-link {
      color: #4774cf;
      font-size: 9px;
      font-weight: 600;
      text-decoration: none;
    }


    /* =========================
       QUICK ACTIONS
       ========================= */

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 11px;
    }

    .action-card {
      min-height: 74px;
      padding: 12px;
      border: 1px solid #e5e9ef;
      border-radius: 8px;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      transition: .2s;
    }

    .action-card:hover {
      border-color: #cad6ed;
      transform: translateY(-1px);
    }

    .action-icon {
      width: 33px;
      height: 33px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 15px;
      font-weight: 700;
    }

    .action-icon.blue {
      background: #edf3ff;
      color: #3970ee;
    }

    .action-icon.slate {
      background: #f0f2f5;
      color: #687487;
    }

    .action-icon.teal {
      background: #eaf8f6;
      color: #179d89;
    }

    .action-icon.amber {
      background: #fff5e4;
      color: #d89522;
    }

    .action-card > div:nth-child(2) {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .action-card strong {
      color: #354055;
      font-size: 10px;
    }

    .action-card span {
      margin-top: 4px;
      color: #929baa;
      font-size: 8px;
    }

    .action-card b {
      color: #8993a3;
      font-size: 12px;
    }


    /* =========================
       KPI
       ========================= */

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 11px;
    }

    .kpi-card {
      min-height: 124px;
      padding: 16px;
      border: 1px solid #e5e9ef;
      border-radius: 8px;
      background: #ffffff;
    }

    .kpi-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-top > span {
      color: #8e98a8;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: .5px;
    }

    .kpi-icon {
      width: 27px;
      height: 27px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }

    .blue-soft {
      background: #edf3ff;
      color: #3970ee;
    }

    .slate-soft {
      background: #f0f2f5;
      color: #687487;
    }

    .teal-soft {
      background: #eaf8f6;
      color: #179d89;
    }

    .amber-soft {
      background: #fff5e4;
      color: #d89522;
    }

    .kpi-card > strong {
      display: block;
      margin-top: 13px;
      color: #202a3d;
      font-size: 24px;
      line-height: 1;
    }

    .kpi-bottom {
      margin-top: 9px;
      display: flex;
      gap: 5px;
      align-items: center;
    }

    .kpi-bottom span {
      color: #9aa3b2;
      font-size: 8px;
    }

    .kpi-bottom .positive {
      color: #2aa35c;
      font-weight: 700;
    }

    .kpi-bottom .warning-text {
      color: #d99422;
      font-weight: 600;
    }


    /* =========================
       TWO COLUMN
       ========================= */

    .two-column {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 13px;
    }

    .panel {
      padding: 17px;
      border: 1px solid #e5e9ef;
      border-radius: 9px;
      background: #ffffff;
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .panel-header h2 {
      margin: 0;
      color: #202a3d;
      font-size: 13px;
    }

    .panel-header p {
      margin: 4px 0 0;
      color: #969eac;
      font-size: 8px;
    }

    .panel-header > a {
      color: #4774cf;
      font-size: 8px;
      font-weight: 600;
      text-decoration: none;
    }

    .count-badge {
      min-width: 23px;
      height: 21px;
      padding: 0 7px;
      border-radius: 11px;
      background: #fff0e8;
      color: #e16b32;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 700;
    }


    /* =========================
       ATTENTION
       ========================= */

    .attention-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .attention-item {
      min-height: 55px;
      padding: 9px;
      border-radius: 7px;
      background: #fafbfc;
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .attention-icon {
      width: 27px;
      height: 27px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 11px;
      font-weight: 700;
    }

    .attention-icon.warning {
      background: #fff4dc;
      color: #d89320;
    }

    .attention-icon.danger {
      background: #fff0ef;
      color: #df5c57;
    }

    .attention-icon.neutral {
      background: #edf1f5;
      color: #778397;
    }

    .attention-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .attention-content strong {
      color: #354055;
      font-size: 9px;
    }

    .attention-content span {
      margin-top: 3px;
      color: #969eac;
      font-size: 8px;
    }

    .attention-item > a {
      color: #5278c7;
      font-size: 8px;
      font-weight: 600;
      text-decoration: none;
    }


    /* =========================
       ACTIVITY
       ========================= */

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .activity-item {
      display: flex;
      align-items: flex-start;
      gap: 9px;
    }

    .activity-dot {
      width: 7px;
      height: 7px;
      margin-top: 3px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .activity-dot.success {
      background: #32b66c;
    }

    .activity-dot.blue-dot {
      background: #4a78e7;
    }

    .activity-dot.warning-dot {
      background: #e5a33d;
    }

    .activity-dot.neutral-dot {
      background: #9aa4b4;
    }

    .activity-item strong {
      display: block;
      color: #354055;
      font-size: 9px;
      font-weight: 600;
    }

    .activity-item span {
      display: block;
      margin-top: 3px;
      color: #8793a1;
      font-size: 8px;
    }
    /* =========================
       RELIABILITY
       ========================= */

    .reliability-panel {
      padding: 20px;
      border: 1px solid #e5e9ef;
      border-radius: 9px;
      background: #ffffff;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
      align-items: center;
    }

    .reliability-info h2 {
      margin: 0;
      color: #202a3d;
      font-size: 15px;
    }

    .reliability-info p {
      max-width: 560px;
      margin: 6px 0 12px;
      color: #929baa;
      font-size: 9px;
      line-height: 1.6;
    }

    .outline-btn {
      display: inline-flex;
      align-items: center;
      height: 30px;
      padding: 0 11px;
      border: 1px solid #dce2ea;
      border-radius: 6px;
      background: #ffffff;
      color: #4774cf;
      font-size: 8px;
      font-weight: 600;
      text-decoration: none;
    }

    .reliability-score {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .score-circle {
      width: 116px;
      height: 116px;
      border-radius: 50%;
      border: 9px solid #e8f0ff;
      outline: 4px solid #dce8ff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }

    .score-circle strong {
      color: #275edc;
      font-size: 20px;
    }

    .score-circle span {
      margin-top: 4px;
      color: #8c96a5;
      font-size: 8px;
    }

    .reliability-stats {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding-top: 13px;
      border-top: 1px solid #edf0f4;
    }

    .reliability-stats > div {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .reliability-stats span {
      color: #929baa;
      font-size: 8px;
    }

    .reliability-stats strong {
      color: #354055;
      font-size: 13px;
    }


    /* =========================
       ANALYTICS
       ========================= */

    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 13px;
    }

    .analytics-card {
      min-height: 210px;
      padding: 16px;
      border: 1px solid #e5e9ef;
      border-radius: 9px;
      background: #ffffff;
    }

    .analytics-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 17px;
    }

    .analytics-header > div {
      display: flex;
      flex-direction: column;
    }

    .analytics-header strong {
      color: #354055;
      font-size: 10px;
    }

    .analytics-header span {
      margin-top: 4px;
      color: #969eac;
      font-size: 8px;
    }

    .analytics-header > a {
      color: #4774cf;
      font-size: 8px;
      text-decoration: none;
    }


    /* =========================
       DONUT
       ========================= */

    .donut-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 7px 0 14px;
    }

    .donut-chart {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      background: conic-gradient(
        #4c79e7 0deg,
        #4c79e7 250deg,
        #edf1f5 250deg,
        #edf1f5 360deg
      );
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .donut-center {
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .donut-center strong {
      color: #283348;
      font-size: 16px;
    }

    .donut-center span {
      margin-top: 3px;
      color: #929baa;
      font-size: 7px;
    }

    .reliability-legend {
      display: flex;
      justify-content: center;
      gap: 15px;
    }

    .reliability-legend div {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #7f8999;
      font-size: 8px;
    }

    .legend-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .green-dot {
      background: #4c79e7;
    }

    .amber-dot {
      background: #dfe4eb;
    }


    /* =========================
       BAR CHART
       ========================= */

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-top: 7px;
    }

    .bar-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bar-label {
      display: flex;
      justify-content: space-between;
      color: #7d8797;
      font-size: 8px;
    }

    .bar-label strong {
      color: #374154;
      font-size: 8px;
    }

    .bar-track {
      width: 100%;
      height: 8px;
      border-radius: 8px;
      background: #eef1f5;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 8px;
    }

    .blue-fill {
      background: #4b78e7;
    }


    /* =========================
       PERFORMANCE
       ========================= */

    .performance-list {
      display: flex;
      flex-direction: column;
      gap: 17px;
      padding-top: 5px;
    }

    .performance-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .performance-label {
      display: flex;
      justify-content: space-between;
      color: #788294;
      font-size: 8px;
    }

    .performance-label strong {
      color: #364154;
      font-size: 8px;
    }

    .performance-track {
      width: 100%;
      height: 7px;
      border-radius: 6px;
      background: #eef1f5;
      overflow: hidden;
    }

    .performance-fill {
      height: 100%;
      border-radius: 6px;
      background: #4d7be5;
    }


    /* =========================
       SUMMARY
       ========================= */

    .summary-card {
      padding: 17px;
      border: 1px solid #e5e9ef;
      border-radius: 9px;
      background: #ffffff;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 11px;
    }

    .summary-item {
      min-height: 70px;
      padding: 11px;
      border-radius: 7px;
      background: #fafbfc;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .summary-icon {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
    }

    .summary-item > div:last-child {
      display: flex;
      flex-direction: column;
    }

    .summary-item strong {
      color: #2d374b;
      font-size: 15px;
    }

    .summary-item span {
      margin-top: 4px;
      color: #8c96a5;
      font-size: 8px;
    }


    /* =========================
       VENDOR OVERVIEW
       ========================= */

    .vendor-overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .vendor-main-number {
      min-height: 90px;
      padding: 17px;
      border-radius: 8px;
      background: #f7f9fc;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .vendor-main-number strong {
      color: #273247;
      font-size: 26px;
    }

    .vendor-main-number span {
      margin-top: 5px;
      color: #8c96a5;
      font-size: 8px;
    }

    .vendor-status {
      min-height: 90px;
      padding: 17px;
      border-radius: 8px;
      background: #f7f9fc;
      display: flex;
      align-items: center;
    }

    .status-layout {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .status-layout div {
      display: flex;
      flex-direction: column;
    }

    .status-label {
      color: #929baa;
      font-size: 8px;
    }

    .status-layout strong {
      margin-top: 5px;
      color: #2f394c;
      font-size: 11px;
    }

    .status-pill {
      padding: 5px 9px;
      border-radius: 12px;
      font-size: 8px;
      font-weight: 700;
    }

    .status-pill.success {
      background: #eaf8ef;
      color: #2d9f5b;
    }


    /* =========================
       FOOTER
       ========================= */

    .dashboard-footer {
      padding-top: 20px;
      border-top: 1px solid #e5e9ef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dashboard-footer > div:first-child {
      display: flex;
      flex-direction: column;
    }

    .dashboard-footer strong {
      color: #384255;
      font-size: 9px;
    }

    .dashboard-footer span {
      margin-top: 4px;
      color: #929baa;
      font-size: 8px;
    }

    .footer-items {
      display: flex;
      gap: 17px;
    }

    .footer-items span {
      color: #8a94a4;
      font-size: 8px;
    }


    /* =========================
       RESPONSIVE
       ========================= */

    @media (max-width: 1100px) {

      .sidebar {
        width: 210px;
      }

      .main-content {
        margin-left: 210px;
      }

      .quick-actions,
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .analytics-grid {
        grid-template-columns: 1fr;
      }

    }


    @media (max-width: 850px) {

      .sidebar {
        width: 72px;
      }

      .brand {
        justify-content: center;
        padding: 15px 10px;
      }

      .brand-text,
      .section-label,
      .nav-item > span:last-child,
      .profile-mini > div:last-child,
      .logout-btn {
        display: none;
      }

      .sidebar-section {
        padding-left: 8px;
        padding-right: 8px;
      }

      .nav-item {
        justify-content: center;
        padding: 0;
      }

      .main-content {
        margin-left: 72px;
        width: calc(100% - 72px);
      }

      .two-column,
      .reliability-panel {
        grid-template-columns: 1fr;
      }

      .reliability-panel {
        text-align: center;
      }

      .reliability-info p {
        margin-left: auto;
        margin-right: auto;
      }

    }


    @media (max-width: 650px) {

      .topbar {
        padding: 0 15px;
      }

      .search-box {
        width: 180px;
      }

      .top-profile > div:last-child {
        display: none;
      }

      .page-content {
        padding: 20px 15px;
      }

      .welcome-section {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }

      .date-card {
        width: 100%;
      }

      .quick-actions,
      .kpi-grid,
      .analytics-grid {
        grid-template-columns: 1fr;
      }

      .summary-grid,
      .vendor-overview {
        grid-template-columns: 1fr;
      }

      .dashboard-footer {
        flex-direction: column;
        gap: 15px;
      }

      .footer-items {
        flex-wrap: wrap;
      }

    }


    @media (max-width: 600px) {

      .sidebar {
        display: none;
      }

      .main-content {
        margin-left: 0;
        width: 100%;
      }

      .kpi-grid {
        grid-template-columns: 1fr;
      }

      .topbar h1 {
        font-size: 18px;
      }

      .status-layout {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }

    }

  `]
})

export class DashboardComponent {

  userName = 'prasanna';
  userRole = 'VENDOR';

  vendorCount = 0;
  purchaseOrderCount = 0;
  reliabilityScore = 0;
  pendingApprovalCount = 0;

  deliveryScore = 0;
  qualityScore = 0;
  complianceScore = 0;

  expiringContracts = 0;

  // Dashboard analytics
  totalPurchaseOrders = 0;
  completedPurchaseOrders = 0;
  pendingPurchaseOrders = 0;
  approvedPurchaseOrders = 0;
  orderedPurchaseOrders = 0;

  totalRequisitions = 0;
  totalProcurementValue = 0;

  approvedVendorCount = 0;
  underReviewVendorCount = 0;

  recentActivities: any[] = [];

  searchText = '';
  searchResults: any[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {

    const user = localStorage.getItem('user');

    if (user) {
      try {

        const data = JSON.parse(user);

        this.userName =
          data.full_name ||
          data.fullName ||
          data.email ||
          'prasanna';

        this.userRole =
          data.role ||
          'VENDOR';

      } catch (error) {

        console.error(
          'Error reading user:',
          error
        );

      }
    }

    this.loadVendorCount();
    this.loadPurchaseOrderData();
    this.loadPendingApprovalCount();
    this.loadExpiringContractCount();
    this.loadReliabilityScore();
    this.loadProcurementData();
    this.loadRecentActivities();
  }


  // =========================
  // VENDOR DATA
  // =========================

  loadVendorCount(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/vendors/'
    ).subscribe({

      next: (vendors) => {

        this.vendorCount = vendors.length;

      },

      error: (error) => {

        console.error(
          'Error loading vendor count:',
          error
        );

      }

    });
  }


  // =========================
  // PURCHASE ORDER DATA
  // =========================

  loadPurchaseOrderData(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/purchase-orders/'
    ).subscribe({

      next: (orders) => {

        this.totalPurchaseOrders = orders.length;

        this.pendingPurchaseOrders =
          orders.filter(
            order => order.status === 'PENDING'
          ).length;

        this.approvedPurchaseOrders =
          orders.filter(
            order => order.status === 'APPROVED'
          ).length;

        this.orderedPurchaseOrders =
          orders.filter(
            order => order.status === 'ORDERED'
          ).length;

        this.completedPurchaseOrders =
          orders.filter(
            order => order.status === 'COMPLETED'
          ).length;

        this.purchaseOrderCount =
          this.pendingPurchaseOrders +
          this.approvedPurchaseOrders +
          this.orderedPurchaseOrders;

      },

      error: (error) => {

        console.error(
          'Error loading purchase orders:',
          error
        );

      }

    });
  }


  // =========================
  // VENDOR APPROVAL DATA
  // =========================

  loadPendingApprovalCount(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/vendor-approvals/'
    ).subscribe({

      next: (approvals) => {

        this.pendingApprovalCount =
          approvals.filter(
            approval =>
              approval.status === 'PENDING'
          ).length;

        this.approvedVendorCount =
          approvals.filter(
            approval =>
              approval.status === 'APPROVED'
          ).length;

        this.underReviewVendorCount =
          approvals.filter(
            approval =>
              approval.status === 'UNDER_REVIEW'
          ).length;

      },

      error: (error) => {

        console.error(
          'Error loading vendor approvals:',
          error
        );

      }

    });
  }


  // =========================
  // CONTRACT DATA
  // =========================

  loadExpiringContractCount(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/contracts/'
    ).subscribe({

      next: (contracts) => {

        this.expiringContracts =
          contracts.filter(
            contract =>
              contract.expiry_status === 'EXPIRING_SOON'
          ).length;

      },

      error: (error) => {

        console.error(
          'Error loading contract count:',
          error
        );

      }

    });
  }


  // =========================
  // RELIABILITY DATA
  // =========================

  loadReliabilityScore(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/reliability/ranking'
    ).subscribe({

      next: (records) => {

        if (
          records &&
          records.length > 0
        ) {

          const reliabilityTotal =
            records.reduce(
              (sum, record) =>
                sum +
                Number(
                  record.overall_score ||
                  record.reliability_score ||
                  0
                ),
              0
            );

          this.reliabilityScore =
            Math.round(
              (reliabilityTotal /
                records.length) * 10
            ) / 10;


          const deliveryTotal =
            records.reduce(
              (sum, record) =>
                sum +
                Number(
                  record.delivery_score || 0
                ),
              0
            );


          const qualityTotal =
            records.reduce(
              (sum, record) =>
                sum +
                Number(
                  record.quality_score || 0
                ),
              0
            );


          const complianceTotal =
            records.reduce(
              (sum, record) =>
                sum +
                Number(
                  record.contract_compliance_score || 0
                ),
              0
            );


          this.deliveryScore =
            Math.round(
              deliveryTotal /
              records.length
            );


          this.qualityScore =
            Math.round(
              qualityTotal /
              records.length
            );


          this.complianceScore =
            Math.round(
              complianceTotal /
              records.length
            );

        } else {

          this.reliabilityScore = 0;
          this.deliveryScore = 0;
          this.qualityScore = 0;
          this.complianceScore = 0;

        }

      },

      error: (error) => {

        console.error(
          'Error loading reliability score:',
          error
        );

      }

    });
  }


  // =========================
  // PROCUREMENT DATA
  // =========================

  loadProcurementData(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/procurements/'
    ).subscribe({

      next: (procurements) => {

        this.totalRequisitions =
          procurements.length;

      },

      error: (error) => {

        console.error(
          'Error loading procurement data:',
          error
        );

        this.totalRequisitions = 0;

      }

    });


    this.http.get<any[]>(
      'http://localhost:8000/api/purchase-orders/'
    ).subscribe({

      next: (orders) => {

        this.totalProcurementValue =
          orders.reduce(
            (total, order) => {

              const value =
                Number(
                  order.total_amount ??
                  order.total_value ??
                  order.amount ??
                  order.value ??
                  0
                );

              return total + value;

            },
            0
          );

      },

      error: (error) => {

        console.error(
          'Error loading procurement value:',
          error
        );

        this.totalProcurementValue = 0;

      }

    });
  }


  // =========================
  // RECENT ACTIVITY
  // =========================

  loadRecentActivities(): void {

    this.http.get<any[]>(
      'http://localhost:8000/api/activity-logs/'
    ).subscribe({

      next: (activities) => {

        this.recentActivities =
          activities.slice(0, 5);

      },

      error: (error) => {

        console.error(
          'Error loading recent activities:',
          error
        );

      }

    });
  }


  // =========================
  // ROLE BASED ACCESS
  // =========================

  canView(module: string): boolean {

    const role = this.userRole;


    if (
      role === 'ADMINISTRATOR' ||
      role === 'PROCUREMENT_MANAGER'
    ) {

      return true;

    }


    if (
      role === 'SUPPLY_CHAIN_MANAGER'
    ) {

      return [
        'dashboard',
        'vendors',
        'vendor-approval',
        'procurement',
        'purchase-orders',
        'contracts',
        'communication',
        'performance',
        'reliability',
        'analytics',
        'reports',
        'notifications'
      ].includes(module);

    }


    if (
      role === 'FINANCE_OFFICER'
    ) {

      return [
        'dashboard',
        'vendors',
        'procurement',
        'purchase-orders',
        'contracts',
        'communication',
        'performance',
        'reliability',
        'analytics',
        'reports',
        'notifications'
      ].includes(module);

    }


    if (
      role === 'AUDITOR'
    ) {

      return [
        'dashboard',
        'vendors',
        'vendor-approval',
        'procurement',
        'purchase-orders',
        'contracts',
        'communication',
        'performance',
        'reliability',
        'analytics',
        'reports',
        'notifications'
      ].includes(module);

    }


    if (
      role === 'VENDOR'
    ) {

      return [
        'dashboard',
        'vendors',
        'contracts',
        'communication',
        'performance',
        'reliability',
        'analytics',
        'reports',
        'notifications'
      ].includes(module);

    }


    return false;
  }


  // =========================
  // GLOBAL SEARCH
  // =========================

  globalSearch(): void {

    const search =
      this.searchText
        .trim()
        .toLowerCase();


    if (!search) {

      this.searchResults = [];

      return;

    }


    this.searchResults = [];


    this.http.get<any[]>(
      'http://localhost:8000/api/vendors/'
    ).subscribe({

      next: (vendors) => {

        const matches =
          vendors
            .filter(vendor =>
              (
                vendor.vendor_name || ''
              )
                .toLowerCase()
                .includes(search)
            )
            .slice(0, 5)
            .map(vendor => ({

              name:
                vendor.vendor_name,

              type:
                'Vendor',

              route:
                '/vendors'

            }));


        this.searchResults =
          matches;

      },

      error: (error) => {

        console.error(
          'Search error:',
          error
        );

      }

    });
  }


  // =========================
  // SEARCH RESULT
  // =========================

  openSearchResult(
    result: any
  ): void {

    this.searchText = '';

    this.searchResults = [];

    this.router.navigate([
      result.route
    ]);
  }


  // =========================
  // LOGOUT
  // =========================

  logout(): void {

    this.authService.logout();

    this.router.navigate([
      '/login'
    ]);

  }

}