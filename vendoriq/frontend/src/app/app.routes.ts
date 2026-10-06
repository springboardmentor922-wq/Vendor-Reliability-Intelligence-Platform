import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [

  /* =========================
     ROOT
     ========================= */

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
     VENDOR MANAGEMENT
     ========================= */

  {
    path: 'vendors',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
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

  {
    path: 'procurement-overview',

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
      import('./features/procurement-overview/procurement-overview.component')
        .then(m => m.ProcurementOverviewComponent)
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
     VENDOR PERFORMANCE
     ========================= */

  {
    path: 'vendor-performance',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/vendor-performance/vendor-performance.component')
        .then(m => m.VendorPerformanceComponent)
  },


  /* =========================
     PROCUREMENT COST ANALYSIS
     ========================= */

  {
    path: 'procurement-cost-analysis',

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
      import('./features/procurement-cost-analysis/procurement-cost-analysis.component')
        .then(m => m.ProcurementCostAnalysisComponent)
  },


  /* =========================
     DELIVERY STATUS
     ========================= */

  {
    path: 'delivery-status',

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
      import('./features/delivery-status/delivery-status.component')
        .then(m => m.DeliveryStatusComponent)
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
     VENDOR RELIABILITY
     ========================= */

  {
    path: 'vendor-reliability',

    canActivate: [
      authGuard,
      roleGuard([
        'administrator',
        'procurement_manager',
        'supply_chain_manager',
        'vendor',
        'auditor'
      ])
    ],

    loadComponent: () =>
      import('./features/vendor-reliability/vendor-reliability.component')
        .then(m => m.VendorReliabilityComponent)
  },


  /* =========================
     VENDOR CONTRACT STATUS
     ========================= */

  {
    path: 'vendor-contract-status',

    canActivate: [
      authGuard,
      roleGuard([
        'vendor'
      ])
    ],

    loadComponent: () =>
      import('./features/vendor-contract-status/vendor-contract-status.component')
        .then(m => m.VendorContractStatusComponent)
  },


  /* =========================
     VENDOR ORDER HISTORY
     ========================= */

  {
    path: 'vendor-order-history',

    canActivate: [
      authGuard,
      roleGuard([
        'vendor'
      ])
    ],

    loadComponent: () =>
      import('./features/vendor-order-history/vendor-order-history.component')
        .then(m => m.VendorOrderHistoryComponent)
  },


  /* =========================
     VENDOR COMMUNICATION
     ========================= */

  {
    path: 'vendor-communication',

    canActivate: [
      authGuard,
      roleGuard([
        'vendor'
      ])
    ],

    loadComponent: () =>
      import('./features/vendor-communication/vendor-communication.component')
        .then(m => m.VendorCommunicationComponent)
  },

    /* =========================
     AUDITOR COMPLIANCE REVIEW
     ========================= */

  {
  path: 'compliance',

  canActivate: [
    authGuard,
    roleGuard([
      'auditor'
    ])
  ],

  loadComponent: () =>
    import('./features/compliance-review/compliance-review.component')
      .then(m => m.ComplianceReviewComponent)
},

  /* =========================
     FALLBACK
     ========================= */

  {
    path: '**',
    redirectTo: 'dashboard'
  }

];