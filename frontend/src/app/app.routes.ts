import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing';
import { LoginComponent } from './login/login';
import { ProcurementDashboardComponent } from './procurement-dashboard/procurement-dashboard';
import { VendorDashboardComponent } from './vendor-dashboard/vendor-dashboard';
import 
{ AdminDashboardComponent } from './admin-dashboard/admin-dashboard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard/procurement', component: ProcurementDashboardComponent },
  { path: 'dashboard/vendor', component: VendorDashboardComponent },
  { path: 'dashboard/admin', component: AdminDashboardComponent },
  { path: '**', redirectTo: '' }
];
