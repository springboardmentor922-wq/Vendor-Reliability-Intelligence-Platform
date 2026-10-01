import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login';
import { RegisterComponent, ResetPasswordComponent } from './pages/auth-pages';
import { DashboardComponent } from './pages/dashboard';
import { VendorsComponent } from './pages/vendors';
import { PurchaseOrdersComponent } from './pages/purchase-orders';
import { ProcurementRequestsComponent } from './pages/procurement-requests';
import { ContractsComponent } from './pages/contracts';
import { VendorRankingComponent } from './pages/vendor-ranking';
import { ReportsComponent } from './pages/reports';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Sign In | ProcureFlow' },
  { path: 'register', component: RegisterComponent, title: 'Register Account | ProcureFlow' },
  { path: 'reset-password', component: ResetPasswordComponent, title: 'Reset Password | ProcureFlow' },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    title: 'Dashboard | ProcureFlow'
  },
  {
    path: 'vendors',
    component: VendorsComponent,
    canActivate: [authGuard],
    title: 'Vendors Directory | ProcureFlow'
  },
  {
    path: 'procurement-requests',
    component: ProcurementRequestsComponent,
    canActivate: [authGuard],
    title: 'Procurement Requests | ProcureFlow'
  },
  {
    path: 'purchase-orders',
    component: PurchaseOrdersComponent,
    canActivate: [authGuard],
    title: 'Purchase Orders | ProcureFlow'
  },
  {
    path: 'contracts',
    component: ContractsComponent,
    canActivate: [authGuard],
    title: 'Contracts Repository | ProcureFlow'
  },
  {
    path: 'vendor-ranking',
    component: VendorRankingComponent,
    canActivate: [authGuard],
    title: 'Vendor Rankings & Reliability | ProcureFlow'
  },
  {
    path: 'reports',
    component: ReportsComponent,
    canActivate: [authGuard],
    title: 'Reports & Analytics | ProcureFlow'
  },
  { path: '**', redirectTo: 'dashboard' }
];

