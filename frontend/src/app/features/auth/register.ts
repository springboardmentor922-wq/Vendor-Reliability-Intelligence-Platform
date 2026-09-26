import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { extractDetail } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { UserRole } from '../../core/models';

/** Administrator accounts are provisioned by an existing admin, not here. */
const SELF_SERVICE_ROLES: UserRole[] = [
  'Procurement Manager',
  'Supply Chain Manager',
  'Finance Officer',
  'Auditor',
  'Vendor',
];

@Component({
  selector: 'app-register',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register.html',
  styleUrl: './auth-shell.scss',
})
export class Register implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly roles = SELF_SERVICE_ROLES;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);
  readonly vendors = signal<{ id: number; vendor_name: string }[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Procurement Manager' as UserRole, Validators.required],
    vendor_id: [null as number | null],
    department: [''],
    job_title: [''],
    phone: [''],
  });

  ngOnInit(): void {
    this.form.controls.role.valueChanges.subscribe((role) => {
      const control = this.form.controls.vendor_id;

      if (role === 'Vendor') {
        control.addValidators(Validators.required);
        this.loadVendors();
      } else {
        control.clearValidators();
        control.setValue(null);
      }

      control.updateValueAndValidity();
    });
  }

  /** Public list used only to link a supplier login to its organisation. */
  private loadVendors(): void {
    if (this.vendors().length > 0) {
      return;
    }

    this.http
      .get<{ id: number; vendor_name: string }[]>(
        `${environment.apiUrl}/vendors/public-directory`,
      )
      .subscribe({
        next: (vendors) => this.vendors.set(vendors),
        error: () => this.vendors.set([]),
      });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();

    this.auth
      .register({
        name: value.name,
        email: value.email,
        password: value.password,
        role: value.role,
        phone: value.phone || undefined,
        department: value.department || undefined,
        job_title: value.job_title || undefined,
        vendor_id: value.role === 'Vendor' ? value.vendor_id : null,
      })
      .subscribe({
        next: () => void this.router.navigate(['/dashboard']),
        error: (error) => {
          this.loading.set(false);
          this.errorMessage.set(
            extractDetail(error) ?? 'Registration failed. Please try again.',
          );
        },
      });
  }
}
