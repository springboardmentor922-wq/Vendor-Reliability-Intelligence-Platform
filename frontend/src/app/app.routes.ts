import { Routes } from '@angular/router';

import { authGuard, guestGuard, roleGuard } from './core/guards';

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

      {
        path: 'dashboard',
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
