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

  readonly demoAccounts = [
    { role: 'Administrator', email: 'admin@vendoriq.com' },
    { role: 'Procurement Manager', email: 'procurement@vendoriq.com' },
    { role: 'Supply Chain Manager', email: 'supplychain@vendoriq.com' },
    { role: 'Finance Officer', email: 'finance@vendoriq.com' },
    { role: 'Auditor', email: 'auditor@vendoriq.com' },
    { role: 'Vendor', email: 'northwind@vendor.vendoriq.com' },
  ];

  useDemoAccount(email: string): void {
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
