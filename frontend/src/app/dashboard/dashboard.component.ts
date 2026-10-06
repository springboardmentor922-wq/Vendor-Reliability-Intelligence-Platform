import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],

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

          <a routerLink="/dashboard" class="nav-item active">
            <span class="nav-icon">⌂</span>
            <span>Dashboard</span>
          </a>

          <a routerLink="/vendors" class="nav-item">
            <span class="nav-icon">◉</span>
            <span>Vendors</span>
          </a>

          <a routerLink="/vendor-approval" class="nav-item">
            <span class="nav-icon">✓</span>
            <span>Vendor Approval</span>
          </a>

          <a routerLink="/procurement" class="nav-item">
            <span class="nav-icon">▣</span>
            <span>Procurement</span>
          </a>

          <a routerLink="/purchase-orders" class="nav-item">
            <span class="nav-icon">▤</span>
            <span>Purchase Orders</span>
          </a>

          <a routerLink="/contracts" class="nav-item">
            <span class="nav-icon">□</span>
            <span>Contracts</span>
          </a>

          <a routerLink="/communications" class="nav-item">
            <span class="nav-icon">✉</span>
            <span>Communication</span>
          </a>

          <a routerLink="/activity-logs" class="nav-item">
            <span class="nav-icon">◷</span>
            <span>Activity Log</span>
          </a>
        </div>

        <div class="sidebar-section">

          <span class="section-label">INSIGHTS</span>

          <a routerLink="/performance" class="nav-item">
            <span class="nav-icon">◈</span>
            <span>Performance</span>
          </a>

          <a routerLink="/reliability" class="nav-item">
            <span class="nav-icon">★</span>
            <span>Reliability</span>
          </a>

          <a routerLink="/analytics" class="nav-item">
            <span class="nav-icon">▥</span>
            <span>Analytics</span>
          </a>

          <a routerLink="/reports" class="nav-item">
            <span class="nav-icon">▤</span>
            <span>Reports</span>
          </a>

          <a routerLink="/notifications" class="nav-item">
            <span class="nav-icon">♢</span>
            <span>Notifications</span>
          </a>

        </div>

        <div class="sidebar-bottom">

          <div class="profile-mini">
            <div class="profile-avatar">
              {{ userName.charAt(0).toUpperCase() }}
            </div>

            <div class="profile-info">
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
            >
          </div>

          <div class="topbar-right">

            <button
              class="notification-btn"
              (click)="openNotifications()"
            >
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

              <div class="eyebrow">
                PROCUREMENT OPERATIONS
              </div>

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
                <p>
                  Access frequently used procurement operations
                </p>
              </div>

            </div>

            <div class="quick-actions">

              <a
                routerLink="/vendors"
                class="action-card"
              >

                <div class="action-icon blue">
                  +
                </div>

                <div>
                  <strong>Add Vendor</strong>
                  <span>Register a new supplier</span>
                </div>

                <b>→</b>

              </a>


              <a
                routerLink="/procurement"
                class="action-card"
              >

                <div class="action-icon slate">
                  ▣
                </div>

                <div>
                  <strong>New Requisition</strong>
                  <span>Create procurement request</span>
                </div>

                <b>→</b>

              </a>


              <a
                routerLink="/purchase-orders"
                class="action-card"
              >

                <div class="action-icon teal">
                  +
                </div>

                <div>
                  <strong>Create Purchase Order</strong>
                  <span>Start a new purchase order</span>
                </div>

                <b>→</b>

              </a>


              <a
                routerLink="/vendor-approval"
                class="action-card"
              >

                <div class="action-icon amber">
                  ✓
                </div>

                <div>
                  <strong>Review Approvals</strong>
                  <span>Check pending vendor requests</span>
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
                <p>
                  Live overview of procurement operations
                </p>
              </div>

            </div>


            <div class="kpi-grid">

              <!-- TOTAL VENDORS -->
              <div class="kpi-card">

                <div class="kpi-top">

                  <span class="kpi-label">
                    TOTAL VENDORS
                  </span>

                  <span class="kpi-icon blue">
                    ◉
                  </span>

                </div>

                <strong class="kpi-value">
                  {{ totalVendors }}
                </strong>

                <span class="kpi-description">
                  Registered suppliers
                </span>

              </div>


              <!-- ACTIVE PURCHASE ORDERS -->
              <div class="kpi-card">

                <div class="kpi-top">

                  <span class="kpi-label">
                    ACTIVE PURCHASE ORDERS
                  </span>

                  <span class="kpi-icon teal">
                    ▤
                  </span>

                </div>

                <strong class="kpi-value">
                  {{ activePurchaseOrders }}
                </strong>

                <span class="kpi-description">
                  Orders currently in progress
                </span>

              </div>


              <!-- PENDING APPROVALS -->
              <div class="kpi-card">

                <div class="kpi-top">

                  <span class="kpi-label">
                    PENDING APPROVALS
                  </span>

                  <span class="kpi-icon amber">
                    ✓
                  </span>

                </div>

                <strong class="kpi-value">
                  {{ pendingApprovals }}
                </strong>

                <span class="kpi-description">
                  Vendor requests awaiting review
                </span>

              </div>


              <!-- RELIABILITY -->
              <div class="kpi-card">

                <div class="kpi-top">

                  <span class="kpi-label">
                    RELIABILITY SCORE
                  </span>

                  <span class="kpi-icon green">
                    ★
                  </span>

                </div>

                <strong class="kpi-value">
                  {{ reliabilityScore | number:'1.1-1' }}%
                </strong>

                <span class="kpi-description">
                  Overall vendor reliability
                </span>

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

                <span class="count-badge">
                  {{ pendingApprovals }}
                </span>

              </div>


              <div class="attention-list">

                <div class="attention-item">

                  <div class="attention-icon warning">
                    !
                  </div>

                  <div class="attention-content">

                    <strong>
                      Pending vendor approvals
                    </strong>

                    <span>
                      {{ pendingApprovals }}
                      vendor requests are awaiting review
                    </span>

                  </div>

                  <a routerLink="/vendor-approval">
                    Review →
                  </a>

                </div>


                <div class="attention-item">

                  <div class="attention-icon danger">
                    !
                  </div>

                  <div class="attention-content">

                    <strong>
                      Delivery performance
                    </strong>

                    <span>
                      Review active purchase orders
                    </span>

                  </div>

                  <a routerLink="/purchase-orders">
                    View →
                  </a>

                </div>


                <div class="attention-item">

                  <div class="attention-icon neutral">
                    □
                  </div>

                  <div class="attention-content">

                    <strong>
                      Contract review
                    </strong>

                   <span>
                                                  {{ expiringContracts }}
                                                  contracts are approaching expiry
                                             </span>

                  </div>

                  <a routerLink="/contracts">
                    Review →
                  </a>

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

                <a routerLink="/notifications">
                  View all →
                </a>

              </div>


              <div class="activity-list">

                <div class="activity-item">

                  <div class="activity-dot success"></div>

                  <div>
                    <strong>
                      Procurement operations available
                    </strong>

                    <span>
                      Live dashboard data loaded
                    </span>
                  </div>

                </div>


                <div class="activity-item">

                  <div class="activity-dot blue-dot"></div>

                  <div>
                    <strong>
                      Vendor data synchronized
                    </strong>

                    <span>
                      {{ totalVendors }} vendors available
                    </span>
                  </div>

                </div>


                <div class="activity-item">

                  <div class="activity-dot warning-dot"></div>

                  <div>
                    <strong>
                      Purchase order status
                    </strong>

                    <span>
                      {{ activePurchaseOrders }}
                      active purchase orders
                    </span>
                  </div>

                </div>


                <div class="activity-item">

                  <div class="activity-dot neutral-dot"></div>

                  <div>
                    <strong>
                      Approval status
                    </strong>

                    <span>
                      {{ pendingApprovals }}
                      approvals pending
                    </span>
                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- RELIABILITY -->
          <section class="reliability-panel section-block">

            <div class="reliability-info">

              <div class="eyebrow">
                VENDOR HEALTH
              </div>

              <h2>
                Platform Reliability
              </h2>

              <p>
                Overall supplier reliability based on
                current vendor performance records.
              </p>

              <a
                routerLink="/reliability"
                class="outline-btn"
              >
                View Reliability →
              </a>

            </div>


            <div class="reliability-score">

              <div class="score-circle">

                <strong>
                  {{ reliabilityScore | number:'1.1-1' }}%
                </strong>

                <span>
                  Reliability
                </span>

              </div>

            </div>

          </section>
          <!-- ANALYTICS -->
          <section class="analytics-section section-block">

            <div class="section-heading">

              <div>
                <h2>Procurement Analytics</h2>
                <p>
                  Operational overview and supplier performance
                </p>
              </div>

              <a routerLink="/analytics">
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

                </div>


                <div class="bar-chart">

                  <div class="bar-item">

                    <div class="bar-label">
                      <span>Active</span>
                      <strong>{{ activePurchaseOrders }}</strong>
                    </div>

                    <div class="bar-track">
                      <div
                        class="bar-fill blue-fill"
                        [style.width.%]="
                          purchaseOrders.length > 0
                            ? (activePurchaseOrders / purchaseOrders.length) * 100
                            : 0
                        "
                      ></div>
                    </div>

                  </div>


                  <div class="bar-item">

                    <div class="bar-label">
                      <span>Delivered</span>
                      <strong>
                        {{
                          purchaseOrders.length -
                          activePurchaseOrders
                        }}
                      </strong>
                    </div>

                    <div class="bar-track">
                      <div
                        class="bar-fill teal-fill"
                        [style.width.%]="
                          purchaseOrders.length > 0
                            ? (
                                (
                                  purchaseOrders.length -
                                  activePurchaseOrders
                                ) /
                                purchaseOrders.length
                              ) * 100
                            : 0
                        "
                      ></div>
                    </div>

                  </div>

                </div>

              </div>


              <!-- RELIABILITY -->
              <div class="analytics-card">

                <div class="analytics-header">

                  <div>
                    <strong>Vendor Reliability</strong>
                    <span>Current reliability overview</span>
                  </div>

                  <a routerLink="/reliability">
                    View →
                  </a>

                </div>


                <div class="donut-wrapper">

                  <div class="donut-chart">

                    <div class="donut-center">

                      <strong>
                        {{ reliabilityScore | number:'1.1-1' }}%
                      </strong>

                      <span>
                        Reliability
                      </span>

                    </div>

                  </div>

                </div>


                <div class="reliability-legend">

                  <div>
                    <span class="legend-dot green-dot"></span>
                    <span>Reliable</span>
                  </div>

                  <div>
                    <span class="legend-dot amber-dot"></span>
                    <span>Needs Review</span>
                  </div>

                </div>

              </div>


              <!-- PERFORMANCE -->
              <div class="analytics-card">

                <div class="analytics-header">

                  <div>
                    <strong>Supplier Performance</strong>
                    <span>Reliability indicators</span>
                  </div>

                  <a routerLink="/performance">
                    View →
                  </a>

                </div>


                <div class="performance-list">

                  <div class="performance-row">

                    <div class="performance-label">
                      <span>Reliability</span>
                      <strong>
                        {{ reliabilityScore | number:'1.0-0' }}%
                      </strong>
                    </div>

                    <div class="performance-track">

                      <div
                        class="performance-fill"
                        [style.width.%]="reliabilityScore"
                      ></div>

                    </div>

                  </div>


                  <div class="performance-row">

                    <div class="performance-label">
                      <span>Vendor Coverage</span>
                      <strong>
                        {{ totalVendors }}
                      </strong>
                    </div>

                    <div class="performance-track">

                      <div
                        class="performance-fill"
                        [style.width.%]="
                          totalVendors > 0 ? 100 : 0
                        "
                      ></div>

                    </div>

                  </div>


                  <div class="performance-row">

                    <div class="performance-label">
                      <span>Approval Monitoring</span>
                      <strong>
                        {{ pendingApprovals }}
                      </strong>
                    </div>

                    <div class="performance-track">

                      <div
                        class="performance-fill"
                        [style.width.%]="
                          pendingApprovals > 0 ? 70 : 100
                        "
                      ></div>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- PROCUREMENT SUMMARY -->
          <section class="summary-section section-block">

            <div class="summary-card">

              <div class="summary-header">

                <div>
                  <div class="eyebrow">
                    PROCUREMENT
                  </div>

                  <h2>
                    Procurement Operations
                  </h2>

                  <p>
                    Current procurement activity across the platform.
                  </p>
                </div>

                <a
                  routerLink="/procurement"
                  class="outline-btn"
                >
                  Open Procurement →
                </a>

              </div>


              <div class="summary-grid">

                <div class="summary-item">

                  <span class="summary-icon blue">
                    ▣
                  </span>

                  <div>
                    <strong>
                      {{ procurements.length }}
                    </strong>

                    <span>
                      Procurement Requests
                    </span>
                  </div>

                </div>


                <div class="summary-item">

                  <span class="summary-icon teal">
                    ▤
                  </span>

                  <div>
                    <strong>
                      {{ purchaseOrders.length }}
                    </strong>

                    <span>
                      Total Purchase Orders
                    </span>
                  </div>

                </div>


                <div class="summary-item">

                  <span class="summary-icon amber">
                    ✓
                  </span>

                  <div>
                    <strong>
                      {{ pendingApprovals }}
                    </strong>

                    <span>
                      Pending Approvals
                    </span>
                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- VENDOR SUMMARY -->
          <section class="summary-section section-block">

            <div class="summary-card">

              <div class="summary-header">

                <div>

                  <div class="eyebrow">
                    SUPPLIER NETWORK
                  </div>

                  <h2>
                    Vendor Overview
                  </h2>

                  <p>
                    Current supplier records available in the platform.
                  </p>

                </div>

                <a
                  routerLink="/vendors"
                  class="outline-btn"
                >
                  Manage Vendors →
                </a>

              </div>


              <div class="vendor-overview">

                <div class="vendor-main-number">

                  <strong>
                    {{ totalVendors }}
                  </strong>

                  <span>
                    Registered Vendors
                  </span>

                </div>


                <div class="vendor-status">

                  <div class="status-layout">

                    <div>

                      <span class="status-label">
                        Supplier data
                      </span>

                      <strong>
                        Connected
                      </strong>

                    </div>

                    <span class="status-pill success">
                      Active
                    </span>

                  </div>

                </div>

              </div>

            </div>

          </section>


          <!-- FOOTER -->
          <footer class="dashboard-footer">

            <div>
              <strong>Vendor Intel</strong>
              <span>
                Procurement Intelligence Platform
              </span>
            </div>

            <div class="footer-items">

              <span>
                Vendor Management
              </span>

              <span>
                Procurement
              </span>

              <span>
                Risk & Reliability
              </span>

            </div>

          </footer>

        </div>

      </main>

    </div>
  `,
  styles: [`

    /* =========================
       GLOBAL DASHBOARD
       ========================= */

    * {
      box-sizing: border-box;
    }

    .app-shell {
      min-height: 100vh;
      background: #f5f7fa;
      color: #1f2937;
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
      border-right: 1px solid #e6e9ee;
      display: flex;
      flex-direction: column;
      z-index: 100;
    }

    .brand {
      height: 82px;
      padding: 0 22px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #eef1f5;
    }

    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #1f5eff;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-text strong {
      font-size: 15px;
      color: #172033;
    }

    .brand-text span {
      margin-top: 3px;
      font-size: 9px;
      color: #8a94a6;
      text-transform: uppercase;
      letter-spacing: .7px;
    }

    .sidebar-section {
      padding: 22px 14px 0;
    }

    .section-label {
      display: block;
      padding: 0 10px 9px;
      font-size: 9px;
      font-weight: 700;
      color: #9aa3b2;
      letter-spacing: 1.2px;
    }

    .nav-item {
      height: 40px;
      margin-bottom: 3px;
      padding: 0 11px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 11px;
      text-decoration: none;
      color: #687386;
      font-size: 12px;
      transition: .2s;
    }

    .nav-item:hover {
      background: #f4f7fb;
      color: #1f5eff;
    }

    .nav-item.active {
      background: #edf3ff;
      color: #1f5eff;
      font-weight: 600;
    }

    .nav-icon {
      width: 18px;
      text-align: center;
      font-size: 15px;
    }

    .sidebar-bottom {
      margin-top: auto;
      padding: 15px;
      border-top: 1px solid #eef1f5;
    }

    .profile-mini {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 12px;
    }

    .profile-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #e9efff;
      color: #1f5eff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
    }

    .profile-info {
      display: flex;
      flex-direction: column;
    }

    .profile-info strong {
      font-size: 11px;
      color: #253047;
    }

    .profile-info span {
      margin-top: 2px;
      font-size: 9px;
      color: #929baa;
    }

    .logout-btn {
      width: 100%;
      height: 34px;
      border: 1px solid #e5e8ed;
      border-radius: 7px;
      background: #ffffff;
      color: #687386;
      cursor: pointer;
      font-size: 11px;
    }

    .logout-btn:hover {
      background: #f8f9fb;
    }


    /* =========================
       MAIN CONTENT
       ========================= */

    .main-content {
      margin-left: 245px;
      min-height: 100vh;
    }

    .topbar {
      height: 68px;
      padding: 0 30px;
      background: #ffffff;
      border-bottom: 1px solid #e7eaf0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .search-box {
      width: 370px;
      height: 36px;
      border: 1px solid #e4e8ee;
      border-radius: 7px;
      background: #fafbfc;
      display: flex;
      align-items: center;
      padding: 0 11px;
      gap: 8px;
    }

    .search-box span {
      color: #8e98a8;
      font-size: 18px;
    }

    .search-box input {
      width: 100%;
      border: 0;
      outline: 0;
      background: transparent;
      font-size: 11px;
      color: #465164;
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
      color: #657084;
      font-size: 18px;
      cursor: pointer;
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
      gap: 9px;
    }

    .top-profile > div:last-child {
      display: flex;
      flex-direction: column;
    }

    .top-profile strong {
      font-size: 11px;
      color: #263044;
    }

    .top-profile span {
      margin-top: 2px;
      font-size: 9px;
      color: #929baa;
    }

    .top-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #edf3ff;
      color: #1f5eff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
    }


    /* =========================
       PAGE
       ========================= */

    .page-content {
      padding: 28px 30px 35px;
      max-width: 1500px;
      margin: 0 auto;
    }

    .welcome-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 25px;
      margin-bottom: 30px;
    }

    .eyebrow {
      margin-bottom: 8px;
      color: #6683b8;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.1px;
      text-transform: uppercase;
    }

    .welcome-section h1 {
      margin: 0;
      font-size: 27px;
      line-height: 1.2;
      color: #182236;
      font-weight: 700;
    }

    .welcome-section p {
      margin: 9px 0 0;
      color: #7b8596;
      font-size: 11px;
      line-height: 1.6;
    }

    .date-card {
      min-width: 235px;
      height: 58px;
      padding: 0 14px;
      border: 1px solid #e5e9ef;
      border-radius: 9px;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .calendar-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #edf3ff;
      color: #1f5eff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
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
      letter-spacing: .8px;
    }

    .date-card strong {
      margin-top: 4px;
      color: #344054;
      font-size: 10px;
    }

    .date-card .arrow {
      color: #8993a3;
      font-size: 14px;
    }


    /* =========================
       SECTIONS
       ========================= */

    .section-block {
      margin-bottom: 28px;
    }

    .section-heading {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 14px;
    }

    .section-heading h2 {
      margin: 0;
      color: #202a3d;
      font-size: 16px;
    }

    .section-heading p {
      margin: 4px 0 0;
      color: #929baa;
      font-size: 10px;
    }

    .section-heading > a {
      color: #4676df;
      font-size: 10px;
      text-decoration: none;
      font-weight: 600;
    }


    /* =========================
       QUICK ACTIONS
       ========================= */

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .action-card {
      min-height: 76px;
      padding: 13px;
      border: 1px solid #e6eaf0;
      border-radius: 9px;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 11px;
      text-decoration: none;
      transition: .2s;
    }

    .action-card:hover {
      border-color: #cdd9f2;
      transform: translateY(-1px);
    }

    .action-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .action-icon.blue,
    .kpi-icon.blue,
    .summary-icon.blue {
      background: #edf3ff;
      color: #3970ee;
    }

    .action-icon.slate {
      background: #f0f2f5;
      color: #647084;
    }

    .action-icon.teal,
    .kpi-icon.teal,
    .summary-icon.teal {
      background: #eaf8f6;
      color: #16a08d;
    }

    .action-icon.amber,
    .kpi-icon.amber,
    .summary-icon.amber {
      background: #fff6e6;
      color: #d89420;
    }

    .action-card > div:nth-child(2) {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .action-card strong {
      color: #293347;
      font-size: 11px;
    }

    .action-card span {
      margin-top: 4px;
      color: #9099a8;
      font-size: 9px;
    }

    .action-card b {
      color: #8993a3;
      font-size: 13px;
    }


    /* =========================
       KPI CARDS
       ========================= */

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .kpi-card {
      min-height: 130px;
      padding: 17px;
      border: 1px solid #e5e9ef;
      border-radius: 9px;
      background: #ffffff;
    }

    .kpi-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-label {
      color: #929baa;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: .7px;
    }

    .kpi-icon {
      width: 27px;
      height: 27px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }

    .kpi-icon.green {
      background: #eaf8ef;
      color: #29a45c;
    }

    .kpi-value {
      display: block;
      margin-top: 14px;
      color: #1d2739;
      font-size: 25px;
      line-height: 1;
    }

    .kpi-description {
      display: block;
      margin-top: 8px;
      color: #939cab;
      font-size: 9px;
    }


    /* =========================
       TWO COLUMN
       ========================= */

    .two-column {
      display: grid;
      grid-template-columns: 1.15fr .85fr;
      gap: 15px;
    }

    .panel {
      padding: 18px;
      border: 1px solid #e5e9ef;
      border-radius: 10px;
      background: #ffffff;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 17px;
    }

    .panel-header h2 {
      margin: 0;
      color: #202a3d;
      font-size: 14px;
    }

    .panel-header p {
      margin: 4px 0 0;
      color: #969eac;
      font-size: 9px;
    }

    .panel-header > a {
      color: #4676df;
      font-size: 9px;
      font-weight: 600;
      text-decoration: none;
    }

    .count-badge {
      min-width: 24px;
      height: 22px;
      padding: 0 7px;
      border-radius: 12px;
      background: #fff0e8;
      color: #e16b32;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
    }


    /* =========================
       ATTENTION
       ========================= */

    .attention-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .attention-item {
      min-height: 57px;
      padding: 9px;
      border-radius: 8px;
      background: #fafbfc;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .attention-icon {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
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
      font-size: 10px;
    }

    .attention-content span {
      margin-top: 4px;
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
      gap: 17px;
    }

    .activity-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .activity-dot {
      width: 7px;
      height: 7px;
      margin-top: 4px;
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
      font-size: 10px;
      font-weight: 600;
    }

    .activity-item span {
      display: block;
      margin-top: 3px;
      color: #8793a1;
      font-size: 9px;
    }
    /* =========================
       RELIABILITY
       ========================= */

    .reliability-panel {
      padding: 22px;
      border: 1px solid #e5e9ef;
      border-radius: 10px;
      background: #ffffff;
      display: grid;
      grid-template-columns: 1fr 260px;
      align-items: center;
      gap: 25px;
    }

    .reliability-info h2 {
      margin: 0;
      color: #202a3d;
      font-size: 18px;
    }

    .reliability-info p {
      max-width: 510px;
      margin: 8px 0 15px;
      color: #8a94a4;
      font-size: 10px;
      line-height: 1.6;
    }

    .outline-btn {
      display: inline-flex;
      align-items: center;
      height: 32px;
      padding: 0 12px;
      border: 1px solid #dbe1ea;
      border-radius: 6px;
      color: #4774cf;
      background: #ffffff;
      font-size: 9px;
      font-weight: 600;
      text-decoration: none;
    }

    .outline-btn:hover {
      background: #f7f9fc;
    }

    .reliability-score {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .score-circle {
      width: 145px;
      height: 145px;
      border-radius: 50%;
      border: 12px solid #eaf2ff;
      outline: 5px solid #dce8ff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }

    .score-circle strong {
      color: #275dcc;
      font-size: 25px;
      line-height: 1;
    }

    .score-circle span {
      margin-top: 7px;
      color: #8994a5;
      font-size: 9px;
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
      min-height: 220px;
      padding: 17px;
      border: 1px solid #e5e9ef;
      border-radius: 10px;
      background: #ffffff;
    }

    .analytics-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .analytics-header > div {
      display: flex;
      flex-direction: column;
    }

    .analytics-header strong {
      color: #354055;
      font-size: 11px;
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
       BAR CHART
       ========================= */

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-top: 10px;
    }

    .bar-item {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .bar-label {
      display: flex;
      justify-content: space-between;
      color: #7d8797;
      font-size: 9px;
    }

    .bar-label strong {
      color: #374154;
      font-size: 9px;
    }

    .bar-track {
      width: 100%;
      height: 9px;
      border-radius: 8px;
      background: #eef1f5;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      min-width: 0;
      border-radius: 8px;
      transition: width .4s ease;
    }

    .blue-fill {
      background: #4b78e7;
    }

    .teal-fill {
      background: #24aa96;
    }


    /* =========================
       DONUT
       ========================= */

    .donut-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 7px 0 12px;
    }

    .donut-chart {
      width: 115px;
      height: 115px;
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
      width: 78px;
      height: 78px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .donut-center strong {
      color: #283348;
      font-size: 17px;
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
       PERFORMANCE
       ========================= */

    .performance-list {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .performance-row {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .performance-label {
      display: flex;
      justify-content: space-between;
      color: #788294;
      font-size: 9px;
    }

    .performance-label strong {
      color: #364154;
      font-size: 9px;
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
      transition: width .4s ease;
    }


    /* =========================
       SUMMARY
       ========================= */

    .summary-card {
      padding: 20px;
      border: 1px solid #e5e9ef;
      border-radius: 10px;
      background: #ffffff;
    }

    .summary-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }

    .summary-header h2 {
      margin: 0;
      color: #202a3d;
      font-size: 17px;
    }

    .summary-header p {
      margin: 6px 0 0;
      color: #929baa;
      font-size: 9px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 20px;
    }

    .summary-item {
      min-height: 72px;
      padding: 12px;
      border-radius: 8px;
      background: #fafbfc;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .summary-icon {
      width: 31px;
      height: 31px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      flex-shrink: 0;
    }

    .summary-item div {
      display: flex;
      flex-direction: column;
    }

    .summary-item strong {
      color: #2d374b;
      font-size: 16px;
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
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .vendor-main-number {
      min-height: 100px;
      padding: 18px;
      border-radius: 8px;
      background: #f7f9fc;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .vendor-main-number strong {
      color: #273247;
      font-size: 28px;
    }

    .vendor-main-number span {
      margin-top: 5px;
      color: #8c96a5;
      font-size: 9px;
    }

    .vendor-status {
      min-height: 100px;
      padding: 18px;
      border-radius: 8px;
      background: #f7f9fc;
      display: flex;
      align-items: center;
    }

    .status-layout {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      font-size: 12px;
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
      padding-top: 22px;
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
      font-size: 10px;
    }

    .dashboard-footer span {
      margin-top: 4px;
      color: #929baa;
      font-size: 8px;
    }

    .footer-items {
      display: flex;
      gap: 18px;
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
      .profile-info,
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
        padding: 0;
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
export class DashboardComponent implements OnInit {

  userName = 'prasanna';
  userRole = 'VENDOR';

  vendors: any[] = [];
  purchaseOrders: any[] = [];
  procurements: any[] = [];
  approvals: any[] = [];
  reliabilityRecords: any[] = [];

  totalVendors = 0;
  activePurchaseOrders = 0;
  pendingApprovals = 0;
  reliabilityScore = 0;
  expiringContracts = 0;

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

    this.loadDashboardData();
  }

  loadDashboardData(): void {

    /* =========================
       VENDORS
       ========================= */

    this.http
      .get<any[]>(
        'http://localhost:8000/api/vendors/'
      )
      .subscribe({

        next: (data) => {

          this.vendors = data || [];

          this.totalVendors =
            this.vendors.length;

        },

        error: (error) => {

          console.error(
            'Error loading vendors:',
            error
          );

        }

      });


    /* =========================
       PURCHASE ORDERS
       ========================= */

    this.http
      .get<any[]>(
        'http://localhost:8000/api/purchase-orders/'
      )
      .subscribe({

        next: (data) => {

          this.purchaseOrders =
            data || [];

          this.activePurchaseOrders =
            this.purchaseOrders.filter(
              po =>
                po.status !== 'DELIVERED'
            ).length;

        },

        error: (error) => {

          console.error(
            'Error loading purchase orders:',
            error
          );

        }

      });


    /* =========================
       PROCUREMENT
       ========================= */

    this.http
      .get<any[]>(
        'http://localhost:8000/api/procurements/'
      )
      .subscribe({

        next: (data) => {

          this.procurements =
            data || [];

        },

        error: (error) => {

          console.error(
            'Error loading procurements:',
            error
          );

        }

      });


    /* =========================
       VENDOR APPROVALS
       ========================= */

    this.http
      .get<any[]>(
        'http://localhost:8000/api/vendor-approvals/'
      )
      .subscribe({

        next: (data) => {

          this.approvals =
            data || [];

          this.pendingApprovals =
            this.approvals.filter(
              approval =>
                approval.status === 'PENDING'
            ).length;

        },

        error: (error) => {

          console.error(
            'Error loading approvals:',
            error
          );

        }

      });
     
      /* =========================
   CONTRACTS
   ========================= */

this.http
  .get<any[]>(
    'http://localhost:8000/api/contracts/'
  )
  .subscribe({

    next: (data) => {

      const contracts =
        data || [];

      this.expiringContracts =
        contracts.filter(
          contract =>
            contract.expiry_status === 'EXPIRING_SOON'
        ).length;

    },

    error: (error) => {

      console.error(
        'Error loading contracts:',
        error
      );

    }

  });


    /* =========================
       VENDOR RELIABILITY
       ========================= */

    this.http
      .get<any[]>(
        'http://localhost:8000/api/vendor-reliability/'
      )
      .subscribe({

        next: (data) => {

          this.reliabilityRecords =
            data || [];

          if (
            this.reliabilityRecords.length > 0
          ) {

            const total =
              this.reliabilityRecords.reduce(
                (sum, record) =>
                  sum +
                  Number(
                    record.reliability_score || 0
                  ),
                0
              );

            this.reliabilityScore =
              total /
              this.reliabilityRecords.length;

          } else {

            this.reliabilityScore = 0;

          }

        },

        error: (error) => {

          console.error(
            'Error loading reliability:',
            error
          );

        }

      });

  }


  /* =========================
     LOGOUT
     ========================= */

  logout(): void {

    this.authService.logout();

    this.router.navigate([
      '/login'
    ]);

  }


  /* =========================
     NOTIFICATIONS
     ========================= */

  openNotifications(): void {

    this.router.navigate([
      '/notifications'
    ]);

  }

}