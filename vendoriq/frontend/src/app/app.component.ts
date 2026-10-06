import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  RouterOutlet,
} from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { UserRole } from './core/models/models';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-root',
  standalone: true,

  imports: [
    CommonModule,
    RouterOutlet,
  ],

  templateUrl: './app.component.html',
})
export class AppComponent {

  public router = inject(Router);

  constructor(
    public auth: AuthService
  ) {}


  // ============================================================
  // DEFAULT NAVIGATION CONFIGURATION
  // ============================================================

  private readonly navConfig: NavItem[] = [

    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'fa-gauge-high',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'finance_officer',
        'auditor',
      ] as UserRole[],
    },

    {
      path: '/vendors',
      label: 'Vendors',
      icon: 'fa-users',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'auditor',
      ] as UserRole[],
    },

    {
      path: '/procurement',
      label: 'Procurement',
      icon: 'fa-cart-shopping',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'finance_officer',
        'auditor',
      ] as UserRole[],
    },

    {
      path: '/purchase-orders',
      label: 'Purchase Orders',
      icon: 'fa-file-invoice',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'finance_officer',
        'auditor',
      ] as UserRole[],
    },

    {
      path: '/contracts',
      label: 'Contracts',
      icon: 'fa-file-contract',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'finance_officer',
        'auditor',
      ] as UserRole[],
    },

    {
      path: '/communication',
      label: 'Communication',
      icon: 'fa-comments',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
      ] as UserRole[],
    },

    {
      path: '/analytics',
      label: 'Analytics',
      icon: 'fa-chart-line',

      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'finance_officer',
        'auditor',
      ] as UserRole[],
    },

  ];


  // ============================================================
  // ROLE-BASED NAVIGATION
  // ============================================================

  navItems = computed<NavItem[]>(() => {

    const user = this.auth.currentUser();

    if (!user) {
      return [];
    }


    // ==========================================================
    // PROCUREMENT MANAGER
    // ==========================================================

    if (user.role === 'procurement_manager') {

      return [

        {
          path: '/dashboard',
          label: 'Dashboard',
          icon: 'fa-gauge-high',
          roles: ['procurement_manager'] as UserRole[],
        },

        {
          path: '/procurement-overview',
          label: 'Procurement Overview',
          icon: 'fa-clipboard-list',
          roles: ['procurement_manager'] as UserRole[],
        },

        {
          path: '/purchase-orders',
          label: 'Active Purchase Orders',
          icon: 'fa-file-invoice',
          roles: ['procurement_manager'] as UserRole[],
        },

        {
          path: '/vendor-performance',
          label: 'Vendor Performance Summary',
          icon: 'fa-users',
          roles: ['procurement_manager'] as UserRole[],
        },

        {
          path: '/procurement-cost-analysis',
          label: 'Procurement Cost Analysis',
          icon: 'fa-chart-line',
          roles: ['procurement_manager'] as UserRole[],
        },

        {
          path: '/delivery-status',
          label: 'Delivery Status',
          icon: 'fa-truck',
          roles: ['procurement_manager'] as UserRole[],
        },

      ];
    }


    // ==========================================================
    // SUPPLY CHAIN MANAGER
    // ==========================================================

    if (user.role === 'supply_chain_manager') {

      return [

        {
          path: '/dashboard',
          label: 'Dashboard',
          icon: 'fa-gauge-high',
          roles: ['supply_chain_manager'] as UserRole[],
        },

        {
          path: '/vendors',
          label: 'Vendor Management',
          icon: 'fa-users',
          roles: ['supply_chain_manager'] as UserRole[],
        },

        {
          path: '/purchase-orders',
          label: 'Purchase Orders',
          icon: 'fa-file-invoice',
          roles: ['supply_chain_manager'] as UserRole[],
        },

        {
          path: '/delivery-status',
          label: 'Delivery Tracking',
          icon: 'fa-truck',
          roles: ['supply_chain_manager'] as UserRole[],
        },

        {
          path: '/vendor-reliability',
          label: 'Vendor Reliability',
          icon: 'fa-shield-halved',
          roles: ['supply_chain_manager'] as UserRole[],
        },

        {
          path: '/contracts',
          label: 'Contracts',
          icon: 'fa-file-contract',
          roles: ['supply_chain_manager'] as UserRole[],
        },

        {
          path: '/communication',
          label: 'Communication',
          icon: 'fa-comments',
          roles: ['supply_chain_manager'] as UserRole[],
        },

      ];
    }


    // ==========================================================
    // VENDOR
    // ==========================================================

    if (user.role === 'vendor') {

      return [

        {
          path: '/dashboard',
          label: 'Dashboard',
          icon: 'fa-gauge-high',
          roles: ['vendor'] as UserRole[],
        },

        {
          path: '/vendor-performance',
          label: 'Vendor Performance',
          icon: 'fa-chart-line',
          roles: ['vendor'] as UserRole[],
        },

        {
          path: '/vendor-reliability',
          label: 'Reliability Score',
          icon: 'fa-shield-halved',
          roles: ['vendor'] as UserRole[],
        },

        {
          path: '/vendor-contract-status',
          label: 'Contract Status',
          icon: 'fa-file-contract',
          roles: ['vendor'] as UserRole[],
        },

        {
          path: '/vendor-order-history',
          label: 'Order History',
          icon: 'fa-box-open',
          roles: ['vendor'] as UserRole[],
        },

        {
          path: '/vendor-communication',
          label: 'Communication Activity',
          icon: 'fa-comments',
          roles: ['vendor'] as UserRole[],
        },

      ];
    }


    // ==========================================================
    // AUDITOR
    // ==========================================================

    if (user.role === 'auditor') {
  return [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'fa-gauge-high',
      roles: ['auditor'] as UserRole[]
    },
    {
      path: '/vendors',
      label: 'Vendor Review',
      icon: 'fa-users',
      roles: ['auditor'] as UserRole[]
    },
    {
      path: '/procurement',
      label: 'Procurement Review',
      icon: 'fa-cart-shopping',
      roles: ['auditor'] as UserRole[]
    },
    {
      path: '/compliance',
      label: 'Compliance Review',
      icon: 'fa-file-shield',
      roles: ['auditor'] as UserRole[]
    },
    {
      path: '/vendor-performance',
      label: 'Performance Review',
      icon: 'fa-chart-line',
      roles: ['auditor'] as UserRole[]
    },
    {
      path: '/vendor-reliability',
      label: 'Risk Review',
      icon: 'fa-shield-halved',
      roles: ['auditor'] as UserRole[]
    }
  ];
}
    // ==========================================================
    // ALL OTHER ROLES
    // ==========================================================

    return this.navConfig.filter(
      (item) =>
        item.roles.includes(
          user.role as UserRole
        )
    );

  });


  // ============================================================
  // SIDEBAR NAVIGATION
  // ============================================================

  navigate(path: string): void {

    console.log(
      'Sidebar navigation:',
      path
    );

    this.router
      .navigateByUrl(path)
      .then((success) => {

        console.log(
          'Navigation result:',
          success,
          'Current URL:',
          this.router.url
        );

      })
      .catch((error) => {

        console.error(
          'Navigation error:',
          error
        );

      });

  }


  // ============================================================
  // ROLE LABEL
  // ============================================================

  roleLabel(
    role: string | undefined
  ): string {

    if (!role) {
      return '';
    }

    const labels: Record<string, string> = {

      administrator: 'Administrator',

      procurement_manager:
        'Procurement Manager',

      supply_chain_manager:
        'Supply Chain Manager',

      vendor:
        'Vendor',

      finance_officer:
        'Finance Officer',

      auditor:
        'Auditor',

    };

    return (
      labels[role] ||
      role
        .replace(/_/g, ' ')
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase()
        )
    );

  }


  // ============================================================
  // LOGOUT
  // ============================================================

  logout(): void {

    this.auth.logout();

  }

}