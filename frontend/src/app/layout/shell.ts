import { Component, computed, inject, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { NotificationService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { UserRole } from '../core/models';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: UserRole[];
}

@Component({
  selector: 'app-shell',
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly unread = signal(0);
  readonly sidenavOpen = signal(true);

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  private readonly allItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Vendors', icon: 'store', route: '/vendors' },
    {
      label: 'Approvals',
      icon: 'fact_check',
      route: '/approvals',
      roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager'],
    },
    { label: 'Procurement', icon: 'assignment', route: '/procurement' },
    { label: 'Purchase Orders', icon: 'receipt_long', route: '/purchase-orders' },
    {
      label: 'Invoices',
      icon: 'payments',
      route: '/invoices',
      roles: ['Administrator', 'Finance Officer', 'Procurement Manager'],
    },
    { label: 'Contracts', icon: 'gavel', route: '/contracts' },
    { label: 'Communication', icon: 'forum', route: '/communication' },
    { label: 'Notifications', icon: 'notifications', route: '/notifications' },
    {
      label: 'Activity Log',
      icon: 'history',
      route: '/activity',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Finance Officer',
        'Auditor',
      ],
    },
    { label: 'Performance', icon: 'insights', route: '/performance' },
    { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
    { label: 'Reports', icon: 'summarize', route: '/reports' },
    {
      label: 'User Management',
      icon: 'group',
      route: '/users',
      roles: ['Administrator'],
    },
  ];

  readonly navItems = computed(() =>
    this.allItems.filter(
      (item) => !item.roles || this.auth.hasRole(...item.roles),
    ),
  );

  constructor() {
    this.loadUnread();

    // Refresh the badge whenever the user lands on a new screen.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.loadUnread());
  }

  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  logout(): void {
    this.auth.logout();
  }

  private loadUnread(): void {
    this.notifications.summary().subscribe({
      next: (summary) => this.unread.set(summary.unread),
      error: () => this.unread.set(0),
    });
  }
}
