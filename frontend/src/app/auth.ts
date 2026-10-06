import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="brand">🛡️ VendorIQ Enterprise</div>
        
        <div class="tab-toggle">
          <button [class.active]="isLoginMode" (click)="isLoginMode = true">Sign In</button>
          <button [class.active]="!isLoginMode" (click)="isLoginMode = false">Create Account</button>
        </div>

        <!-- LOGIN FORM -->
        <form *ngIf="isLoginMode" (ngSubmit)="onLogin()">
          <h2>Welcome Back</h2>
          <p class="subtitle">Access your Infosys vendor management portal</p>
          
          <div class="form-group">
            <label>Corporate Email</label>
            <input type="email" [(ngModel)]="loginEmail" name="loginEmail" required placeholder="admin.procurement@infosys.com" />
          </div>
          
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="loginPassword" name="loginPassword" required placeholder="••••••••" />
          </div>

          <button type="submit" class="submit-btn">Sign In to Workspace</button>
        </form>

        <!-- SIGNUP FORM -->
        <form *ngIf="!isLoginMode" (ngSubmit)="onSignup()">
          <h2>Register Account</h2>
          <p class="subtitle">Provision new user credentials for VendorIQ</p>

          <div class="form-group">
            <label>Full Name</label>
            <input type="text" [(ngModel)]="signupName" name="signupName" required placeholder="Alex Rivera" />
          </div>

          <div class="form-group">
            <label>Corporate Email</label>
            <input type="email" [(ngModel)]="signupEmail" name="signupEmail" required placeholder="a.rivera@infosys.com" />
          </div>

          <div class="form-group">
            <label>Assigned System Role</label>
            <select [(ngModel)]="signupRole" name="signupRole">
              <option value="Procurement Lead">Procurement Lead</option>
              <option value="Vendor Manager">Vendor Manager</option>
              <option value="Auditor">Auditor</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <button type="submit" class="submit-btn">Complete Registration</button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper { min-height: 100vh; background: #0f172a; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: system-ui, sans-serif; }
    .auth-card { background: #ffffff; width: 100%; max-width: 420px; border-radius: 12px; padding: 36px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); }
    .brand { font-size: 1.2rem; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 24px; }
    .tab-toggle { display: flex; background: #f1f5f9; border-radius: 8px; padding: 4px; margin-bottom: 28px; }
    .tab-toggle button { flex: 1; border: none; background: transparent; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; color: #64748b; font-size: 0.9rem; }
    .tab-toggle button.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h2 { font-size: 1.4rem; color: #0f172a; margin: 0 0 4px 0; }
    .subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 20px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.03em; }
    .form-group input, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; font-size: 0.9rem; box-sizing: border-box; }
    .submit-btn { width: 100%; background: #2563eb; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: 700; cursor: pointer; margin-top: 12px; font-size: 0.95rem; }
  `]
})
export class AuthComponent {
  authService = inject(AuthService);
  isLoginMode = true;

  loginEmail = 'admin.procurement@infosys.com';
  loginPassword = 'password';

  signupName = '';
  signupEmail = '';
  signupRole = 'Procurement Lead';

  onLogin(): void {
    if (this.loginEmail) {
      this.authService.login(this.loginEmail);
    }
  }

  onSignup(): void {
    if (this.signupName && this.signupEmail) {
      this.authService.signup(this.signupName, this.signupEmail, this.signupRole);
    }
  }
}