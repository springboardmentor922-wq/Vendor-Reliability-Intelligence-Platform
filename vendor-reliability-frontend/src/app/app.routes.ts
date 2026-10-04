import { Routes, Router, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { AuthService } from './services/auth.service';

import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Profile } from './pages/profile/profile';
import { Dashboard } from './pages/dashboard/dashboard';
import { Vendors } from './pages/vendors/vendors';
import { AddVendors } from './pages/add-vendors/add-vendors';
import { VendorDetails } from './pages/vendor-details/vendor-details';
import { Procurement } from './pages/procurement/procurement';
import { PurchaseOrders } from './pages/purchase-orders/purchase-orders';
import { Contracts } from './pages/contracts/contracts';
import { Communications } from './pages/communications/communications';
import { Notifications } from './pages/notifications/notifications';
import { VendorPerformance } from './pages/vendor-performance/vendor-performance';
import { VendorReliability } from './pages/vendor-reliability/vendor-reliability';
import { Analytics } from './pages/analytics/analytics';
import { Reports } from './pages/reports/reports';
import { VendorCategories } from './pages/vendor-categories/vendor-categories';
import { VendorSelection } from './pages/vendor-selection/vendor-selection';

// Dedicated Role Dashboards (Strict Role Separation)
import { AdminDashboard } from './pages/dashboards/admin-dashboard/admin-dashboard';
import { RequestingUserDashboard } from './pages/dashboards/requesting-user-dashboard/requesting-user-dashboard';
import { ProcurementDashboard } from './pages/dashboards/procurement-dashboard/procurement-dashboard';
import { SupplyChainDashboard } from './pages/dashboards/supply-chain-dashboard/supply-chain-dashboard';
import { VendorDashboard } from './pages/dashboards/vendor-dashboard/vendor-dashboard';
import { FinanceDashboard } from './pages/dashboards/finance-dashboard/finance-dashboard';
import { AuditorDashboard } from './pages/dashboards/auditor-dashboard/auditor-dashboard';

const rootRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree([auth.getDashboardRoute()]) : router.createUrlTree(['/login']);
};

const dashboardRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const target = auth.getDashboardRoute();
  return router.createUrlTree([target]);
};

export const routes: Routes = [
  // Smart root redirect - auto routes to /dashboard if logged in, /login if not
  { path: '', pathMatch: 'full', canActivate: [rootRedirectGuard], component: Login },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },

  // Role-Aware Protected Routes: Dedicated Dashboards (Strict Isolation)
  {
    path: 'dashboard/admin',
    component: AdminDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator'], strictRole: true, roleView: 'Administrator' }
  },
  {
    path: 'dashboard/requesting-user',
    redirectTo: 'dashboard/procurement',
    pathMatch: 'full'
  },
  {
    path: 'dashboard/procurement',
    component: ProcurementDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Procurement Manager'], strictRole: true, roleView: 'Procurement Manager' }
  },
  {
    path: 'dashboard/supply-chain',
    component: SupplyChainDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Supply Chain Manager'], strictRole: true, roleView: 'Supply Chain Manager' }
  },
  {
    path: 'dashboard/vendor',
    component: VendorDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Vendor'], strictRole: true, roleView: 'Vendor' }
  },
  {
    path: 'dashboard/finance',
    component: FinanceDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Finance Officer'], strictRole: true, roleView: 'Finance Officer' }
  },
  {
    path: 'dashboard/auditor',
    component: AuditorDashboard,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Auditor'], strictRole: true, roleView: 'Auditor' }
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, dashboardRedirectGuard],
    component: ProcurementDashboard
  },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  { path: 'notifications', component: Notifications, canActivate: [authGuard] },
  {
    path: 'communications',
    component: Communications,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor'] }
  },

  // Vendor Management - Centralized All Vendors
  {
    path: 'vendors',
    component: Vendors,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor', 'Vendor'] }
  },
  {
    path: 'add-vendors',
    component: AddVendors,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator'] }
  },
  {
    path: 'vendor-details/:id',
    component: VendorDetails,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor'] }
  },
  {
    path: 'vendor-categories',
    component: VendorCategories,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor'] }
  },
  {
    path: 'vendor-selection',
    component: VendorSelection,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager'] }
  },

  // Procurement Management
  {
    path: 'procurement',
    component: Procurement,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Finance Officer', 'Auditor'] }
  },
  {
    path: 'purchase-orders',
    component: PurchaseOrders,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Vendor', 'Finance Officer', 'Auditor'] }
  },

  // Contracts
  {
    path: 'contracts',
    component: Contracts,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Vendor', 'Finance Officer', 'Auditor'] }
  },

  // Analytics, Performance & Reports
  {
    path: 'vendor-performance',
    component: VendorPerformance,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Auditor'] }
  },
  {
    path: 'vendor-reliability',
    component: VendorReliability,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Auditor'] }
  },
  {
    path: 'analytics',
    component: Analytics,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Finance Officer', 'Auditor'] }
  },
  {
    path: 'reports',
    component: Reports,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor'] }
  },

  { path: '**', redirectTo: 'login' }
];
