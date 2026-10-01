import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-header">
          <div class="brand-badge">
            <span class="brand-icon">🛡️</span>
            <span class="brand-name">ProcureFlow RBAC</span>
          </div>
          <h1 class="auth-title">Register Account</h1>
          <p class="auth-subtitle">Request access to the enterprise procurement suite</p>
        </div>

        @if (successMessage()) {
          <div class="alert alert-success" id="register-success-alert">
            <span>✅</span>
            <div>
              <p><strong>Registration Submitted!</strong></p>
              <p style="font-size: 0.8rem; margin-top: 0.2rem;">{{ successMessage() }}</p>
            </div>
          </div>
          <div style="margin-top: 1.5rem; text-align: center;">
            <a routerLink="/login" class="btn btn-primary" id="register-return-login-btn">Proceed to Sign In</a>
          </div>
        } @else {
          @if (errorMessage()) {
            <div class="alert alert-danger" id="register-error-alert">
              <span>⚠️</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label" for="reg-fullname">Full Name</label>
              <input
                id="reg-fullname-input"
                type="text"
                class="form-control"
                placeholder="e.g. Sarah Connor"
                [(ngModel)]="fullName"
                name="fullName"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-email">Work Email</label>
              <input
                id="reg-email-input"
                type="email"
                class="form-control"
                placeholder="s.connor@example.com"
                [(ngModel)]="email"
                name="email"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-role">Requested Role</label>
              <select
                id="reg-role-select"
                class="form-control"
                [(ngModel)]="selectedRole"
                name="selectedRole"
                required
              >
                <option value="Procurement Manager">Procurement Manager (PRs & POs)</option>
                <option value="Supply Chain Manager">Supply Chain Manager (Logistics & Vendors)</option>
                <option value="Finance Officer">Finance Officer (Budget & Invoices)</option>
                <option value="Vendor">Vendor (External Partner)</option>
                <option value="Auditor">Auditor (Compliance & Logs)</option>
                <option value="Administrator">Administrator (System & User Management)</option>
              </select>
              <span style="font-size: 0.75rem; color: var(--text-faint); margin-top: 0.2rem;">
                New accounts require Administrator approval before first login.
              </span>
            </div>

            <div class="form-group">
              <label class="form-label" for="reg-password">Password</label>
              <input
                id="reg-password-input"
                type="password"
                class="form-control"
                placeholder="At least 6 characters"
                [(ngModel)]="password"
                name="password"
                minlength="6"
                required
              />
            </div>

            <button
              id="reg-submit-btn"
              type="submit"
              class="btn btn-primary"
              style="width: 100%; margin-top: 0.75rem;"
              [disabled]="isLoading() || !fullName || !email || !password"
            >
              @if (isLoading()) {
                <span>Submitting Registration...</span>
              } @else {
                <span>Submit Registration</span>
                <span>→</span>
              }
            </button>
          </form>

          <div class="auth-footer">
            <span>Already have an active account?</span>
            <a routerLink="/login" class="login-link" id="reg-go-to-login">Sign In</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 80px);
      padding: 1.5rem;
    }
    .auth-card {
      width: 100%;
      max-width: 480px;
      padding: 2.25rem 2rem;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 9999px;
      padding: 0.35rem 0.85rem;
      margin-bottom: 1rem;
    }
    .brand-icon {
      font-size: 1.1rem;
    }
    .brand-name {
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      color: #818cf8;
      text-transform: uppercase;
    }
    .auth-title {
      font-size: 1.6rem;
      margin-bottom: 0.35rem;
    }
    .auth-subtitle {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .auth-footer {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      display: flex;
      justify-content: center;
      gap: 0.4rem;
    }
    .login-link {
      color: #60a5fa;
      font-weight: 600;
    }
    .login-link:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);

  fullName = '';
  email = '';
  password = '';
  selectedRole = 'Procurement Manager';

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.fullName || !this.email || !this.password) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.register({
      full_name: this.fullName,
      email: this.email,
      password: this.password,
      role: this.selectedRole,
      role_names: [this.selectedRole]
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set(
          `Your account has been created with status PENDING. An Administrator will review and approve your role (${this.selectedRole}).`
        );
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err.error?.detail || 'Registration request could not be processed.';
        this.errorMessage.set(detail);
      }
    });
  }
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-header">
          <div class="brand-badge">
            <span class="brand-icon">🔑</span>
            <span class="brand-name">Security Center</span>
          </div>
          <h1 class="auth-title">Reset Password</h1>
          <p class="auth-subtitle">Provide your work email and set a new secure password</p>
        </div>

        @if (successMessage()) {
          <div class="alert alert-success" id="reset-success-alert">
            <span>✅</span>
            <span>{{ successMessage() }}</span>
          </div>
          <div style="margin-top: 1.5rem; text-align: center;">
            <a routerLink="/login" class="btn btn-primary" id="reset-back-to-login">Sign In with New Password</a>
          </div>
        } @else {
          @if (errorMessage()) {
            <div class="alert alert-danger" id="reset-error-alert">
              <span>⚠️</span>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label" for="reset-email">Work Email</label>
              <input
                id="reset-email-input"
                type="email"
                class="form-control"
                placeholder="admin@example.com"
                [(ngModel)]="email"
                name="email"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="reset-new-password">New Password</label>
              <input
                id="reset-new-password-input"
                type="password"
                class="form-control"
                placeholder="Enter new password (min 6 characters)"
                [(ngModel)]="newPassword"
                name="newPassword"
                minlength="6"
                required
              />
            </div>

            <button
              id="reset-submit-btn"
              type="submit"
              class="btn btn-primary"
              style="width: 100%; margin-top: 0.5rem;"
              [disabled]="isLoading() || !email || !newPassword"
            >
              @if (isLoading()) {
                <span>Updating Password...</span>
              } @else {
                <span>Update Password</span>
                <span>→</span>
              }
            </button>
          </form>

          <div class="auth-footer">
            <a routerLink="/login" class="login-link" id="reset-cancel-link">← Return to Sign In</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 80px);
      padding: 1.5rem;
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      padding: 2.25rem 2rem;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 9999px;
      padding: 0.35rem 0.85rem;
      margin-bottom: 1rem;
    }
    .brand-icon {
      font-size: 1.1rem;
    }
    .brand-name {
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.05em;
      color: #fbbf24;
      text-transform: uppercase;
    }
    .auth-title {
      font-size: 1.6rem;
      margin-bottom: 0.35rem;
    }
    .auth-subtitle {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .auth-footer {
      margin-top: 1.5rem;
      text-align: center;
    }
    .login-link {
      color: #60a5fa;
      font-size: 0.875rem;
    }
    .login-link:hover {
      text-decoration: underline;
    }
  `]
})
export class ResetPasswordComponent {
  private authService = inject(AuthService);

  email = '';
  newPassword = '';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.email || !this.newPassword) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.resetPassword({ email: this.email, new_password: this.newPassword }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(res.message || 'Password has been updated successfully.');
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err.error?.detail || 'Unable to reset password.';
        this.errorMessage.set(detail);
      }
    });
  }
}
