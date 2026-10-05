import { Routes } from '@angular/router';

import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Dashboard } from './pages/dashboard/dashboard';
import { Vendors } from './pages/vendors/vendors';
import { Procurement } from './pages/procurement/procurement';
import { PurchaseOrders } from './pages/purchase-orders/purchase-orders';
import { Contracts } from './pages/contracts/contracts';
import { CommunicationPage } from './pages/communication/communication';
import { Performance } from './pages/performance/performance';
import { Reliability } from './pages/reliability/reliability';
import { Analytics } from './pages/analytics/analytics';
import { Notifications } from './pages/notifications/notifications';
import { Reports } from './pages/reports/reports';
import { Users } from './pages/users/users';
import { MainLayout } from './layout/main-layout/main-layout';

import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { ResetPassword } from './pages/reset-password/reset-password';


export const routes: Routes = [

  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: 'register',
    component: Register
  },

  {
    path: 'forgot-password',
    component: ForgotPassword
  },

  {
    path: 'reset-password',
    component: ResetPassword
  },

  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],

    children: [

      {
        path: 'dashboard',
        component: Dashboard
      },

      {
        path: 'vendors',
        component: Vendors,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Vendor'
          ]
        }
      },

      {
        path: 'procurement',
        component: Procurement,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager'
          ]
        }
      },

      {
        path: 'purchase-orders',
        component: PurchaseOrders,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager'
          ]
        }
      },

      {
        path: 'contracts',
        component: Contracts,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Vendor',
            'Auditor'
          ]
        }
      },

      {
        path: 'communication',
        component: CommunicationPage,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Vendor'
          ]
        }
      },

      {
        path: 'performance',
        component: Performance,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Vendor',
            'Auditor'
          ]
        }
      },

      {
        path: 'reliability',
        component: Reliability,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Vendor',
            'Auditor'
          ]
        }
      },

      {
        path: 'analytics',
        component: Analytics,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Auditor'
          ]
        }
      },

      {
        path: 'notifications',
        component: Notifications
      },

      {
        path: 'reports',
        component: Reports,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator',
            'Procurement Manager',
            'Supply Chain Manager',
            'Finance Officer',
            'Auditor'
          ]
        }
      },

      {
        path: 'users',
        component: Users,
        canActivate: [roleGuard],
        data: {
          roles: [
            'Administrator'
          ]
        }
      }

    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }

];