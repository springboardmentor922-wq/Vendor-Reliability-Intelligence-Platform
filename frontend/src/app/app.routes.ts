import { Routes } from '@angular/router';

import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard/dashboard.component';
import { VendorManagementComponent } from './vendors/vendor-management/vendor-management.component';
import { ProcurementDashboardComponent } from './procurement/procurement-dashboard/procurement-dashboard.component';
import { PurchaseOrderListComponent } from './purchase-orders/purchase-order-list/purchase-order-list.component';
import { VendorPerformanceComponent } from './performance/vendor-performance/vendor-performance.component';
import { ReliabilityDashboardComponent } from './reliability/reliability-dashboard/reliability-dashboard.component';
import { AnalyticsDashboardComponent } from './analytics/analytics-dashboard/analytics-dashboard.component';
import { ReportsDashboardComponent } from './reports/reports-dashboard/reports-dashboard.component';
import { NotificationScreenComponent } from './notifications/notification-screen/notification-screen.component';
import { VendorApprovalComponent } from './vendor-approval/vendor-approval.component';
import { ContractManagementComponent } from './contracts/contract-management/contract-management.component';
import { CommunicationManagementComponent } from './communications/communication-management/communication-management.component';
import { ActivityLogManagementComponent } from './activity-logs/activity-log-management/activity-log-management.component';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'vendors', component: VendorManagementComponent, canActivate: [authGuard] },
  { path: 'vendor-approval', component: VendorApprovalComponent, canActivate: [authGuard] },
  { path: 'contracts', component: ContractManagementComponent, canActivate: [authGuard] },
  { path: 'communications', component: CommunicationManagementComponent, canActivate: [authGuard] },
  { path: 'activity-logs', component: ActivityLogManagementComponent, canActivate: [authGuard] },
  { path: 'procurement', component: ProcurementDashboardComponent, canActivate: [authGuard] },
  { path: 'purchase-orders', component: PurchaseOrderListComponent, canActivate: [authGuard] },
  { path: 'performance', component: VendorPerformanceComponent, canActivate: [authGuard] },
  { path: 'reliability', component: ReliabilityDashboardComponent, canActivate: [authGuard] },
  { path: 'analytics', component: AnalyticsDashboardComponent, canActivate: [authGuard] },
  { path: 'reports', component: ReportsDashboardComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationScreenComponent, canActivate: [authGuard] },

  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' }
];