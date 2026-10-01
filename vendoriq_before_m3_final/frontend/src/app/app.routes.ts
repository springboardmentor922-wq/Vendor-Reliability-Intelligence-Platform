import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  {
    path: 'vendors',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/vendors/vendors.component').then((m) => m.VendorsComponent),
  },

  {
    path: 'procurement',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/procurement/procurement.component').then((m) => m.ProcurementComponent),
  },

  {
    path: 'purchase-orders',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/purchase-orders/purchase-orders.component').then(
        (m) => m.PurchaseOrdersComponent
      ),
  },

  {
    path: 'contracts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/contracts/contracts.component').then((m) => m.ContractsComponent),
  },

  {
    path: 'communication',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/communication/communication.component').then(
        (m) => m.CommunicationComponent
      ),
  },

  // ADD THIS ROUTE HERE
  {
    path: 'analytics',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/milestone3/milestone3.component').then(
        (m) => m.Milestone3Component
      ),
  },

  // KEEP THIS AS THE LAST ROUTE
  { path: '**', redirectTo: 'dashboard' },
];