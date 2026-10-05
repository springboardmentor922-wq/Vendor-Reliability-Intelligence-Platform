import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../core/auth.service';
import { LiveService } from '../core/live.service';
import { UserRole } from '../core/models';
import { ThemeService } from '../core/theme.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: UserRole[];
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const STAFF: UserRole[] = ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor'];
const EDITORS: UserRole[] = ['Administrator', 'Procurement Manager', 'Supply Chain Manager'];

@Component({
  selector: 'app-shell',
  imports: [FormsModule, MatBadgeModule, MatIconModule, MatMenuModule, MatTooltipModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly live = inject(LiveService);
  readonly theme = inject(ThemeService);

  readonly user = this.auth.user;
  readonly collapsed = signal(this.restoreCollapsed());
  readonly mobileOpen = signal(false);
  readonly search = signal('');
  readonly section = signal('Dashboard');

  readonly canRegisterVendor = computed(() => this.auth.hasRole(...EDITORS));

  readonly initials = computed(() =>
    (this.user()?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join(''),
  );

  private readonly groups: NavGroup[] = [
    {
      title: 'Dashboards',
      items: [
        { label: 'Procurement', icon: 'shopping_cart', route: '/dashboards/procurement', roles: STAFF },
        { label: 'Vendor', icon: 'storefront', route: '/dashboards/vendor' },
        { label: 'Admin', icon: 'admin_panel_settings', route: '/dashboards/admin', roles: ['Administrator'] },
      ],
    },
    {
      title: 'Vendor Management',
      items: [
        { label: 'Vendors', icon: 'store', route: '/vendors', exact: true },
        { label: 'Register Vendor', icon: 'app_registration', route: '/vendors/register', roles: EDITORS },
        { label: 'Approvals', icon: 'fact_check', route: '/approvals', roles: EDITORS },
      ],
    },
    {
      title: 'Procurement',
      items: [
        { label: 'Procurement Requests', icon: 'assignment', route: '/procurement' },
        { label: 'Create Purchase Order', icon: 'add_shopping_cart', route: '/purchase-orders/new', roles: EDITORS },
        { label: 'Purchase Orders', icon: 'receipt_long', route: '/purchase-orders', exact: true },
        { label: 'Invoices', icon: 'payments', route: '/invoices', roles: ['Administrator', 'Finance Officer', 'Procurement Manager'] },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { label: 'Performance', icon: 'speed', route: '/performance' },
        { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
        { label: 'Reports', icon: 'summarize', route: '/reports', roles: STAFF },
      ],
    },
    {
      title: 'Compliance & Communication',
      items: [
        { label: 'Contracts', icon: 'gavel', route: '/contracts' },
        { label: 'Messages', icon: 'forum', route: '/communication' },
        { label: 'Notifications', icon: 'notifications', route: '/notifications' },
        { label: 'Activity Log', icon: 'history', route: '/activity', roles: STAFF },
      ],
    },
    {
      title: 'Administration',
      items: [
        { label: 'Data Import', icon: 'upload_file', route: '/data-import', roles: EDITORS },
        { label: 'User Management', icon: 'group', route: '/users', roles: ['Administrator'] },
        { label: 'My Profile', icon: 'person', route: '/profile' },
      ],
    },
  ];

  readonly nav = computed(() =>
    this.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || this.auth.hasRole(...i.roles)) }))
      .filter((g) => g.items.length > 0),
  );

  readonly syncedText = computed(() => {
    if (!this.live.enabled()) return 'Live paused';
    if (!this.live.connected()) return 'Connecting…';
    const s = this.live.secondsSinceBeat() ?? 0;
    return s < 2 ? 'Live · synced now' : `Live · ${s}s ago`;
  });

  constructor() {
    this.live.start();

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.mobileOpen.set(false);
      this.section.set(this.sectionFor(this.router.url));
    });
    this.section.set(this.sectionFor(this.router.url));

    effect(() => {
      try {
        localStorage.setItem('vendoriq.sidebar', this.collapsed() ? '1' : '0');
      } catch {
        /* ignore */
      }
    });
  }

  ngOnDestroy(): void {
    this.live.stop();
  }

  toggleSidebar(): void {
    if (window.innerWidth < 960) {
      this.mobileOpen.update((v) => !v);
    } else {
      this.collapsed.update((v) => !v);
    }
  }

  runSearch(): void {
    const q = this.search().trim();
    if (!q) return;
    if (/^PO-/i.test(q)) {
      void this.router.navigate(['/purchase-orders'], { queryParams: { search: q } });
    } else {
      void this.router.navigate(['/vendors'], { queryParams: { search: q } });
    }
  }

  logout(): void {
    this.live.stop();
    this.auth.logout();
  }

  private sectionFor(url: string): string {
    const path = url.split('?')[0];
    for (const group of this.groups) {
      const hit = [...group.items]
        .sort((a, b) => b.route.length - a.route.length)
        .find((i) => path === i.route || path.startsWith(i.route + '/'));
      if (hit) return group.title === 'Dashboards' ? `${hit.label} Dashboard` : hit.label;
    }
    return 'VendorIQ';
  }

  private restoreCollapsed(): boolean {
    try {
      return localStorage.getItem('vendoriq.sidebar') === '1';
    } catch {
      return false;
    }
  }
}
