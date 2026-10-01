import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ApiService, NotificationItem } from './core/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      @if (isAuthenticated()) {
        <header class="app-nav">
          <div class="nav-container">
            <!-- Brand -->
            <a routerLink="/dashboard" class="brand-link" id="nav-brand-logo">
              <div class="brand-icon-box">⚡</div>
              <div class="brand-text">
                <span class="brand-title">ProcureFlow</span>
                <span class="brand-subtitle">Reliability Suite</span>
              </div>
            </a>

            <!-- Navigation Links -->
            <nav class="nav-links">
              <a
                routerLink="/dashboard"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-dashboard"
              >
                <span>📊</span>
                <span>Dashboard</span>
              </a>
              <a
                routerLink="/vendors"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-vendors"
              >
                <span>🏢</span>
                <span>Vendors</span>
              </a>
              <a
                routerLink="/procurement-requests"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-prs"
              >
                <span>📋</span>
                <span>Requisitions</span>
              </a>
              <a
                routerLink="/purchase-orders"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-pos"
              >
                <span>📑</span>
                <span>Orders</span>
              </a>
              <a
                routerLink="/contracts"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-contracts"
              >
                <span>📜</span>
                <span>Contracts</span>
              </a>
              <a
                routerLink="/vendor-ranking"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-rankings"
              >
                <span>🏆</span>
                <span>Rankings</span>
              </a>
              <a
                routerLink="/reports"
                routerLinkActive="active-link"
                class="nav-item"
                id="nav-link-reports"
              >
                <span>📑</span>
                <span>Reports</span>
              </a>
            </nav>

            <!-- User & Notification Menu -->
            <div class="nav-user">
              <!-- Notification Bell Button -->
              <button
                class="btn-icon-bell"
                id="nav-notification-bell"
                (click)="toggleNotificationDrawer()"
                title="Cross-party alerts and notifications"
              >
                <span class="bell-icon">🔔</span>
                @if (unreadCount() > 0) {
                  <span class="bell-badge" id="nav-unread-count-badge">{{ unreadCount() }}</span>
                }
              </button>

              <div class="user-meta">
                <span class="user-name" id="nav-current-user-name">
                  {{ currentUser()?.full_name || currentUser()?.email }}
                </span>
                <div class="user-roles">
                  @for (r of currentUser()?.roles; track r) {
                    <span class="badge badge-role badge-sm">{{ r }}</span>
                  }
                </div>
              </div>

              <button
                id="nav-logout-btn"
                class="btn btn-secondary btn-sm"
                (click)="onLogout()"
                title="Sign out of system"
              >
                <span>Sign Out</span>
                <span>⎋</span>
              </button>
            </div>
          </div>
        </header>

        <!-- Slide-out Notification Drawer -->
        @if (showNotificationDrawer()) {
          <div class="drawer-overlay" (click)="closeNotificationDrawer()">
            <div class="drawer-panel" (click)="$event.stopPropagation()">
              <div class="drawer-header">
                <div class="drawer-title-box">
                  <h3>Platform Notifications</h3>
                  <span class="badge badge-info badge-sm">{{ unreadCount() }} unread</span>
                </div>
                <div class="drawer-header-actions">
                  <button class="btn btn-secondary btn-xs" (click)="markAllAsRead()">
                    Mark All Read
                  </button>
                  <button class="drawer-close" (click)="closeNotificationDrawer()">✕</button>
                </div>
              </div>

              <div class="drawer-content">
                @if (notifications().length === 0) {
                  <div class="text-center py-8 text-muted">
                    <span>🎉</span>
                    <p class="mt-2 text-sm">No new notifications. Everything is up to date.</p>
                  </div>
                } @else {
                  <div class="notification-list">
                    @for (n of notifications(); track n.id) {
                      <div
                        class="notification-card"
                        [class.unread]="!n.is_read"
                        (click)="markAsRead(n)"
                      >
                        <div class="notif-indicator"></div>
                        <div class="notif-body">
                          <div class="notif-header-row">
                            <span class="notif-type-tag" [ngClass]="getTypeBadge(n.type).class">
                              <span>{{ getTypeBadge(n.type).icon }}</span>
                              <span>{{ getTypeBadge(n.type).label }}</span>
                            </span>
                            <span class="notif-time">{{ n.created_at | date:'short' }}</span>
                          </div>
                          <p class="notif-msg">{{ n.message }}</p>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
      }

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .app-nav {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-container {
      max-width: 1360px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }
    .brand-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: transform 0.2s ease;
    }
    .brand-link:hover {
      transform: translateY(-1px);
    }
    .brand-icon-box {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: var(--primary-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .brand-title {
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .brand-subtitle {
      font-size: 0.7rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.85rem;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .nav-item:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
    }
    .active-link {
      color: #ffffff !important;
      background: rgba(59, 130, 246, 0.15) !important;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .nav-user {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .btn-icon-bell {
      position: relative;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-icon-bell:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(59, 130, 246, 0.5);
    }
    .bell-icon {
      font-size: 1.15rem;
    }
    .bell-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: white;
      font-size: 0.65rem;
      font-weight: 800;
      border-radius: 999px;
      padding: 0.1rem 0.35rem;
      border: 2px solid #0f172a;
    }
    .user-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.2rem;
    }
    .user-name {
      font-size: 0.875rem;
      font-weight: 600;
    }
    .user-roles {
      display: flex;
      gap: 0.25rem;
    }
    .badge-sm {
      font-size: 0.68rem;
      padding: 0.1rem 0.45rem;
    }
    .main-content {
      flex: 1;
    }
    /* Notification Drawer styles */
    .drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      justify-content: flex-end;
    }
    .drawer-panel {
      width: 100%;
      max-width: 420px;
      height: 100%;
      background: #0f172a;
      border-left: 1px solid var(--border-subtle);
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      animation: slideInRight 0.25s ease-out;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    .drawer-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drawer-title-box {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }
    .drawer-title-box h3 {
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }
    .drawer-header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .drawer-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.2rem;
      cursor: pointer;
    }
    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }
    .notification-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .notification-card {
      display: flex;
      gap: 0.75rem;
      padding: 0.9rem 1rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s;
    }
    .notification-card:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .notification-card.unread {
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.3);
    }
    .notif-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #3b82f6;
      margin-top: 5px;
      opacity: 0;
    }
    .notification-card.unread .notif-indicator {
      opacity: 1;
    }
    .notif-body {
      flex: 1;
    }
    .notif-msg {
      font-size: 0.85rem;
      color: var(--text-main);
      line-height: 1.4;
    }
    .notif-time {
      font-size: 0.72rem;
      color: var(--text-muted);
      display: block;
    }
    .notif-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.4rem;
      gap: 0.5rem;
    }
    .notif-type-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-full);
      text-transform: capitalize;
    }
    .notif-badge-delay {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
    }
    .notif-badge-compliance {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }
    .notif-badge-procurement {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
    }
    .notif-badge-approval {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }
    .notif-badge-contract {
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.3);
      color: #c084fc;
    }
    .notif-badge-general {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #94a3b8;
    }
  `]
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private api = inject(ApiService);

  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly currentUser = this.authService.currentUser;

  readonly notifications = signal<NotificationItem[]>([]);
  readonly showNotificationDrawer = signal<boolean>(false);

  readonly unreadCount = computed(() => {
    return this.notifications().filter(n => !n.is_read).length;
  });

  ngOnInit(): void {
    if (this.isAuthenticated()) {
      this.loadNotifications();
    }
  }

  loadNotifications(): void {
    this.api.getNotifications().subscribe({
      next: (notifs) => this.notifications.set(notifs),
      error: () => {}
    });
  }

  toggleNotificationDrawer(): void {
    this.showNotificationDrawer.update(v => !v);
    if (this.showNotificationDrawer()) {
      this.loadNotifications();
    }
  }

  closeNotificationDrawer(): void {
    this.showNotificationDrawer.set(false);
  }

  markAsRead(n: NotificationItem): void {
    if (n.is_read) return;
    this.api.markNotificationAsRead(n.id).subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(item => item.id === n.id ? { ...item, is_read: true } : item)
        );
      }
    });
  }

  markAllAsRead(): void {
    this.api.markAllNotificationsAsRead().subscribe({
      next: () => {
        this.notifications.update(list => list.map(i => ({ ...i, is_read: true })));
      }
    });
  }

  getTypeBadge(type?: string): { label: string; icon: string; class: string } {
    switch (type) {
      case 'delivery_delay':
        return { label: 'Delivery Delay', icon: '🚚', class: 'notif-badge-delay' };
      case 'compliance':
        return { label: 'Compliance Flag', icon: '🚨', class: 'notif-badge-compliance' };
      case 'procurement_alert':
        return { label: 'Procurement Alert', icon: '📦', class: 'notif-badge-procurement' };
      case 'vendor_approval':
        return { label: 'Vendor Approval', icon: '🏢', class: 'notif-badge-approval' };
      case 'contract_expiry':
        return { label: 'Contract Expiry', icon: '📜', class: 'notif-badge-contract' };
      default:
        return { label: 'Notification', icon: '🔔', class: 'notif-badge-general' };
    }
  }

  onLogout(): void {
    this.authService.logout();
  }
}

export { AppComponent as App };
