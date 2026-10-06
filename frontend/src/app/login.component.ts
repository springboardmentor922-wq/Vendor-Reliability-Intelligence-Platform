import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthService} from './auth.service';
@Component({standalone:true,imports:[CommomModule, FormsModule],template:`
<div class="login"><div class="login-card">
<h1>Vendor <span style="color:#635bff">Intelligence</span></h1>
<p class="muted">Vendor & Procurement Management System</p>
<form class="form" (ngSubmit)="submit()">
<label>Email<input [(ngModel)]="email" name="email" required type="email"></label>
<label>Password<input [(ngModel)]="password" name="password" required type="password"></label>
<button class="btn primary" type="submit">Sign in</button>
</form>
<p style="color:#d92d20" *ngIf="error">{{error}}</p>
<hr><p class="muted">Demo: admin&#64;vendorintel.local / Admin&#64;123</p>
</div></div>`})
export class LoginComponent{
 email='admin@vendorintel.local';password='Admin@123';error='';
 private auth=inject(AuthService);private router=inject(Router);
 submit(){this.error='';this.auth.login(this.email,this.password).subscribe({next:()=>this.router.navigate(['/']),error:e=>this.error=e.error?.detail||'Login failed'})}
}
