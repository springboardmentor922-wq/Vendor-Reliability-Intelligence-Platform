import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { AuthService } from '../../core/services/auth';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout {

  private readonly allRoles = [
    'Administrator',
    'Procurement Manager',
    'Supply Chain Manager',
    'Vendor',
    'Finance Officer',
    'Auditor'
  ];

  private readonly adminRoles = [
    'Administrator'
  ];

  private readonly procurementRoles = [
    'Administrator',
    'Procurement Manager',
    'Supply Chain Manager'
  ];

  private readonly vendorRoles = [
    'Administrator',
    'Procurement Manager',
    'Supply Chain Manager',
    'Vendor'
  ];

  private readonly financeRoles = [
    'Administrator',
    'Finance Officer'
  ];

  private readonly auditorRoles = [
    'Administrator',
    'Auditor'
  ];

  navigationItems: NavigationItem[] = [

    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard',
      roles: this.allRoles
    },

    {
      label: 'Vendors',
      icon: 'business',
      route: '/vendors',
      roles: this.vendorRoles
    },

    {
      label: 'Procurement',
      icon: 'shopping_cart',
      route: '/procurement',
      roles: this.procurementRoles
    },

    {
      label: 'Purchase Orders',
      icon: 'receipt_long',
      route: '/purchase-orders',
      roles: this.procurementRoles
    },

    {
      label: 'Contracts',
      icon: 'description',
      route: '/contracts',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Vendor',
        'Auditor'
      ]
    },

    {
      label: 'Communication',
      icon: 'chat',
      route: '/communication',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Vendor'
      ]
    },

    {
      label: 'Performance',
      icon: 'trending_up',
      route: '/performance',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Vendor',
        'Auditor'
      ]
    },

    {
      label: 'Reliability',
      icon: 'verified',
      route: '/reliability',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Vendor',
        'Auditor'
      ]
    },

    {
      label: 'Analytics',
      icon: 'analytics',
      route: '/analytics',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Auditor'
      ]
    },

    {
      label: 'Notifications',
      icon: 'notifications',
      route: '/notifications',
      roles: this.allRoles
    },

    {
      label: 'Reports',
      icon: 'assessment',
      route: '/reports',
      roles: [
        'Administrator',
        'Procurement Manager',
        'Supply Chain Manager',
        'Finance Officer',
        'Auditor'
      ]
    },

    {
      label: 'Users',
      icon: 'manage_accounts',
      route: '/users',
      roles: this.adminRoles
    }
  ];

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  get currentRole(): string {
    return this.authService.currentUser()?.role ?? '';
  }

  get currentUserName(): string {
    return this.authService.currentUser()?.full_name ?? 'User';
  }

  get visibleNavigationItems(): NavigationItem[] {
    return this.navigationItems.filter(item =>
      item.roles.includes(this.currentRole)
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}