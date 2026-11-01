import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { LayoutService } from '../../services/layout.service';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
  badge?: string;
  badgeClass?: string;
  queryParams?: Record<string, string>;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar implements OnInit {
  currentUser$: Observable<User | null>;
  unreadCount$: Observable<number>;
  isCollapsed$: Observable<boolean>;

  internalSections: NavSection[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          label: 'Dashboard',
          route: '/dashboard',
          icon: 'bi-grid-1x2-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        },
        {
          label: 'Requirements',
          route: '/procurement',
          icon: 'bi-clipboard-list',
          roles: ['Administrator', 'Procurement Manager', 'Finance Officer', 'Auditor']
        }
      ]
    },
    {
      title: 'VENDOR MANAGEMENT',
      items: [
        {
          label: 'Vendor Directory',
          route: '/vendors',
          icon: 'bi-building',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        },
        {
          label: 'Vendor Categories',
          route: '/vendor-categories',
          icon: 'bi-tags-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        },
        {
          label: 'Vendor Selection',
          route: '/vendor-selection',
          icon: 'bi-ui-checks-grid',
          roles: ['Administrator', 'Procurement Manager']
        },
        {
          label: 'Vendor Reliability',
          route: '/vendor-reliability',
          icon: 'bi-shield-check',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Auditor']
        },
        {
          label: 'Risk Management',
          route: '/vendor-performance',
          icon: 'bi-exclamation-triangle-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Auditor']
        }
      ]
    },
    {
      title: 'OPERATIONS & ORDERS',
      items: [
        {
          label: 'Purchase Orders',
          route: '/purchase-orders',
          icon: 'bi-receipt-cutoff',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        },
        {
          label: 'Contracts',
          route: '/contracts',
          icon: 'bi-file-earmark-text-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        }
      ]
    },
    {
      title: 'FINANCE & GOVERNANCE',
      items: [
        {
          label: 'Reports & Export',
          route: '/reports',
          icon: 'bi-file-earmark-bar-graph-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        },
        {
          label: 'Audit & Comms',
          route: '/communications',
          icon: 'bi-journal-text',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        }
      ]
    },
    {
      title: 'SYSTEM & SETTINGS',
      items: [
        {
          label: 'Notifications',
          route: '/notifications',
          icon: 'bi-bell-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        },
        {
          label: 'Profile & Settings',
          route: '/profile',
          icon: 'bi-gear-fill',
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor']
        }
      ]
    }
  ];

  vendorSections: NavSection[] = [
    {
      title: 'VENDOR PORTAL',
      items: [
        {
          label: 'Dashboard',
          route: '/dashboard/vendor',
          icon: 'bi-grid-1x2-fill',
          roles: ['Vendor']
        },
        {
          label: 'Orders',
          route: '/purchase-orders',
          icon: 'bi-receipt-cutoff',
          roles: ['Vendor']
        },
        {
          label: 'Purchase Orders',
          route: '/purchase-orders',
          icon: 'bi-file-earmark-check-fill',
          roles: ['Vendor']
        },
        {
          label: 'All Vendors',
          route: '/vendors',
          icon: 'bi-building',
          roles: ['Vendor']
        },
        {
          label: 'Deliveries',
          route: '/dashboard/vendor',
          queryParams: { tab: 'deliveries' },
          icon: 'bi-truck',
          roles: ['Vendor']
        },
        {
          label: 'Invoices',
          route: '/dashboard/vendor',
          queryParams: { tab: 'invoices' },
          icon: 'bi-file-earmark-spreadsheet-fill',
          roles: ['Vendor']
        },
        {
          label: 'Payments',
          route: '/dashboard/vendor',
          queryParams: { tab: 'payments' },
          icon: 'bi-credit-card-fill',
          roles: ['Vendor']
        },
        {
          label: 'Performance',
          route: '/dashboard/vendor',
          queryParams: { tab: 'performance' },
          icon: 'bi-speedometer2',
          roles: ['Vendor']
        },
        {
          label: 'Supplier Directory',
          route: '/vendors',
          icon: 'bi-diagram-3-fill',
          roles: ['Vendor']
        }
      ]
    },
    {
      title: 'COMMUNICATION & SETTINGS',
      items: [
        {
          label: 'Notifications',
          route: '/notifications',
          icon: 'bi-bell-fill',
          roles: ['Vendor']
        },
        {
          label: 'Profile',
          route: '/profile',
          icon: 'bi-building-gear',
          roles: ['Vendor']
        }
      ]
    }
  ];

  get sections(): NavSection[] {
    const user = this.authService.currentUserValue;
    if (user?.role === 'Vendor') {
      return this.vendorSections;
    }
    return this.internalSections;
  }

  constructor(
    public authService: AuthService,
    private notifService: NotificationService,
    public layoutService: LayoutService,
    private router: Router
  ) {
    this.currentUser$ = this.authService.currentUser$;
    this.unreadCount$ = this.notifService.unreadCount$;
    this.isCollapsed$ = this.layoutService.isCollapsed$;
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.notifService.getNotifications().subscribe();
    }
  }

  toggleCollapse(): void {
    this.layoutService.toggleSidebar();
  }

  canAccess(roles: string[]): boolean {
    const user = this.authService.currentUserValue;
    if (!user) return false;
    return roles.includes(user.role);
  }

  hasVisibleItems(section: NavSection): boolean {
    return section.items.some(item => this.canAccess(item.roles));
  }

  getDashboardLink(role?: string): string {
    return this.authService.getDashboardRoute(role);
  }

  getRoleBadgeClass(role?: string): string {
    switch (role) {
      case 'Administrator': return 'role-badge-admin';
      case 'Procurement Manager': return 'role-badge-procure';
      case 'Supply Chain Manager': return 'role-badge-scm';
      case 'Vendor': return 'role-badge-vendor';
      case 'Finance Officer': return 'role-badge-finance';
      case 'Auditor': return 'role-badge-auditor';
      default: return 'role-badge-default';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
