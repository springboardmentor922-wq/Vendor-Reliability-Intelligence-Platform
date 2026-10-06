import {Routes} from '@angular/router';
import {authGuard} from './auth.guard';
import {LoginComponent} from './login.component';
import {DashboardComponent} from './dashboard.component';
export const routes:Routes=[
 {path:'login',component:LoginComponent},
 {path:'',canActivate:[authGuard],component:DashboardComponent},
 {path:'**',redirectTo:''}
];
