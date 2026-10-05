import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { extractDetail } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-login',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './auth-shell.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly theme = inject(ThemeService);
  readonly picked = signal<string | null>(null);

  readonly demoAccounts = [
    { role: 'Administrator', email: 'admin@vendoriq.com', icon: 'admin_panel_settings', color: '#8b5cf6' },
    { role: 'Procurement Manager', email: 'procurement@vendoriq.com', icon: 'shopping_cart', color: '#3b82f6' },
    { role: 'Supply Chain Manager', email: 'supplychain@vendoriq.com', icon: 'local_shipping', color: '#0891b2' },
    { role: 'Finance Officer', email: 'finance@vendoriq.com', icon: 'payments', color: '#f59e0b' },
    { role: 'Auditor', email: 'auditor@vendoriq.com', icon: 'policy', color: '#ec4899' },
    { role: 'Vendor', email: 'northwind@vendor.vendoriq.com', icon: 'storefront', color: '#10b981' },
  ];

  useDemoAccount(email: string): void {
    this.picked.set(email);
    this.form.patchValue({ email, password: 'VendorIQ@2026' });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        const redirect =
          this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
        void this.router.navigateByUrl(redirect);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(
          extractDetail(error) ??
            'Unable to sign in. Check that the API is running and try again.',
        );
      },
    });
  }
}
