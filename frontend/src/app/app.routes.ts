import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { AuthService } from './core/auth.service';

import { authGuard, guestGuard, roleGuard } from './core/guards';

const STAFF = [
  'Administrator',
  'Procurement Manager',
  'Supply Chain Manager',
  'Finance Officer',
  'Auditor',
];

const EDITORS = ['Administrator', 'Procurement Manager', 'Supply Chain Manager'];

export const routes: Routes = [
  // ---------------------------------------------------- public
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'apply',
    loadComponent: () => import('./features/vendors/public-apply').then((m) => m.PublicApply),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/reset-password').then((m) => m.ResetPassword),
  },

  // ---------------------------------------------- authenticated
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      // Each role lands on its own dashboard.
      {
        path: 'dashboard',
        pathMatch: 'full',
        redirectTo: () => {
          const auth = inject(AuthService);
          if (auth.hasRole('Administrator')) return '/dashboards/admin';
          if (auth.hasRole('Vendor')) return '/dashboards/vendor';
          return '/dashboards/procurement';
        },
      },
      {
        path: 'dashboards/procurement',
        canActivate: [roleGuard],
        data: { roles: STAFF },
        loadComponent: () =>
          import('./features/dashboards/procurement-dashboard').then((m) => m.ProcurementDashboard),
      },
      {
        path: 'dashboards/vendor',
        loadComponent: () =>
          import('./features/dashboards/vendor-dashboard').then((m) => m.VendorDashboard),
      },
      {
        path: 'dashboards/admin',
        canActivate: [roleGuard],
        data: { roles: ['Administrator'] },
        loadComponent: () =>
          import('./features/dashboards/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },

      // Vendors
      {
        path: 'vendors',
        loadComponent: () =>
          import('./features/vendors/vendor-list').then((m) => m.VendorList),
      },
      {
        path: 'vendors/register',
        canActivate: [roleGuard],
        data: { roles: EDITORS, mode: 'internal' },
        loadComponent: () =>
          import('./features/vendors/vendor-application').then((m) => m.VendorApplication),
      },
      {
        path: 'vendors/:id',
        loadComponent: () =>
          import('./features/vendors/vendor-detail').then((m) => m.VendorDetail),
      },

      // Approval queues
      {
        path: 'approvals',
        canActivate: [roleGuard],
        data: {
          roles: ['Administrator', 'Procurement Manager', 'Supply Chain Manager'],
        },
        loadComponent: () =>
          import('./features/approvals/approvals').then((m) => m.Approvals),
      },

      // Procurement
      {
        path: 'procurement',
        loadComponent: () =>
          import('./features/procurement/procurement-list').then(
            (m) => m.ProcurementList,
          ),
      },
      {
        path: 'procurement/:id',
        loadComponent: () =>
          import('./features/procurement/procurement-detail').then(
            (m) => m.ProcurementDetail,
          ),
      },

      // Purchase orders
      {
        path: 'purchase-orders',
        loadComponent: () =>
          import('./features/purchase-orders/purchase-order-list').then(
            (m) => m.PurchaseOrderList,
          ),
      },
      {
        path: 'purchase-orders/new',
        canActivate: [roleGuard],
        data: { roles: EDITORS },
        loadComponent: () =>
          import('./features/purchase-orders/create-purchase-order').then((m) => m.CreatePurchaseOrder),
      },
      {
        path: 'purchase-orders/:id',
        loadComponent: () =>
          import('./features/purchase-orders/purchase-order-detail').then(
            (m) => m.PurchaseOrderDetail,
          ),
      },

      // Invoices
      {
        path: 'invoices',
        canActivate: [roleGuard],
        data: {
          roles: ['Administrator', 'Finance Officer', 'Procurement Manager'],
        },
        loadComponent: () =>
          import('./features/invoices/invoice-list').then((m) => m.InvoiceList),
      },

      // Contracts
      {
        path: 'contracts',
        loadComponent: () =>
          import('./features/contracts/contract-list').then(
            (m) => m.ContractList,
          ),
      },
      {
        path: 'contracts/:id',
        loadComponent: () =>
          import('./features/contracts/contract-detail').then(
            (m) => m.ContractDetail,
          ),
      },

      // Communication
      {
        path: 'communication',
        loadComponent: () =>
          import('./features/communication/thread-list').then(
            (m) => m.ThreadList,
          ),
      },
      {
        path: 'communication/:id',
        loadComponent: () =>
          import('./features/communication/thread-detail').then(
            (m) => m.ThreadDetail,
          ),
      },

      // Notifications & audit
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notification-list').then(
            (m) => m.NotificationList,
          ),
      },
      {
        path: 'activity',
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Finance Officer',
            'Auditor',
          ],
        },
        loadComponent: () =>
          import('./features/activity/activity-log').then((m) => m.ActivityLog),
      },

      // Spreadsheet import
      {
        path: 'data-import',
        canActivate: [roleGuard],
        data: { roles: EDITORS },
        loadComponent: () =>
          import('./features/data-import/data-import').then((m) => m.DataImport),
      },

      // Account
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['Administrator'] },
        loadComponent: () =>
          import('./features/users/user-list').then((m) => m.UserList),
      },

      // Milestone 3: performance, analytics and reporting
      {
        path: 'performance',
        loadComponent: () =>
          import('./features/performance/performance-dashboard').then(
            (m) => m.PerformanceDashboard,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics-dashboard').then(
            (m) => m.AnalyticsDashboard,
          ),
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Finance Officer',
            'Auditor',
          ],
        },
        loadComponent: () =>
          import('./features/reports/reports-dashboard').then(
            (m) => m.ReportsDashboard,
          ),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
