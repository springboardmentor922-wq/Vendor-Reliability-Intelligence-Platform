import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },


  /* =========================
     AUTH
     ========================= */

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then(m => m.LoginComponent)
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component')
        .then(m => m.RegisterComponent)
  },


  /* =========================
     DASHBOARD
     ========================= */

  {
    path: 'dashboard',

    canActivate: [
      authGuard
    ],

    loadComponent: () =>
      import('./features/dashboard/dashboard.component')
        .then(m => m.DashboardComponent)
  },


  /* =========================
     VENDORS
     ========================= */

  {
    path: 'vendors',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/vendors/vendors.component')
        .then(m => m.VendorsComponent)
  },


  /* =========================
     PROCUREMENT
     ========================= */

  {
    path: 'procurement',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'finance_officer',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/procurement/procurement.component')
        .then(m => m.ProcurementComponent)
  },


  /* =========================
     PURCHASE ORDERS
     ========================= */

  {
    path: 'purchase-orders',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'finance_officer',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/purchase-orders/purchase-orders.component')
        .then(m => m.PurchaseOrdersComponent)
  },


  /* =========================
     CONTRACTS
     ========================= */

  {
    path: 'contracts',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'finance_officer',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/contracts/contracts.component')
        .then(m => m.ContractsComponent)
  },


  /* =========================
     COMMUNICATION
     ========================= */

  {
    path: 'communication',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor'
      ])
    ],

    loadComponent: () =>
      import('./features/communication/communication.component')
        .then(m => m.CommunicationComponent)
  },


  /* =========================
     ANALYTICS
     ========================= */

  {
    path: 'analytics',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'finance_officer',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/milestone3/milestone3.component')
        .then(m => m.Milestone3Component)
  },


  /* =========================
     FALLBACK
     ========================= */

  {
    path: '**',
    redirectTo: 'dashboard'
  }

];
