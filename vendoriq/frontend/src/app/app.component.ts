import { Component, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {

  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  private allRoles: UserRole[] = [
    'administrator',
    'procurement_manager',
    'supply_chain_manager',
    'vendor',
    'finance_officer',
    'auditor'
  ];

  private navConfig: NavItem[] = [

    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'fa-gauge-high',
      roles: this.allRoles
    },

    {
      path: '/vendors',
      label: 'Vendors',
      icon: 'fa-people-carry-box',
      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'auditor'
      ]
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
        'auditor'
      ]
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
        'auditor'
      ]
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
        'auditor'
      ]
    },

    {
      path: '/communication',
      label: 'Communication',
      icon: 'fa-comments',
      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor'
      ]
    },

    {
      path: '/analytics',
      label: 'Analytics',
      icon: 'fa-chart-column',
      roles: [
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'finance_officer',
        'auditor'
      ]
    }
  ];

  navItems = computed(() => {
    const user = this.auth.currentUser();

    if (!user) {
      return [];
    }

    return this.navConfig.filter(item =>
      item.roles.includes(user.role)
    );
  });

  get roleLabel(): string {
    const role = this.auth.currentUser()?.role;

    if (!role) {
      return '';
    }

    const labels: Record<UserRole, string> = {
      administrator: 'Administrator',
      procurement_manager: 'Procurement Manager',
      supply_chain_manager: 'Supply Chain Manager',
      vendor: 'Vendor',
      finance_officer: 'Finance Officer',
      auditor: 'Auditor'
    };

    return labels[role];
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
