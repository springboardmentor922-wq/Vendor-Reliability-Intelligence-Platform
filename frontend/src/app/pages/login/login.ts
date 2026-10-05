import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

interface LoginRole {
  value: string;
  label: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  loading = false;
  errorMessage = '';

  readonly roles: LoginRole[] = [
    {
      value: 'ADMINISTRATOR',
      label: 'Administrator'
    },
    {
      value: 'PROCUREMENT_MANAGER',
      label: 'Procurement Manager'
    },
    {
      value: 'SUPPLY_CHAIN_MANAGER',
      label: 'Supply Chain Manager'
    },
    {
      value: 'VENDOR',
      label: 'Vendor'
    },
    {
      value: 'FINANCE_OFFICER',
      label: 'Finance Officer'
    },
    {
      value: 'AUDITOR',
      label: 'Auditor'
    }
  ];

  loginForm;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.nonNullable.group({
      role: ['ADMINISTRATOR'],
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [
        Validators.required
      ]]
    });
  }

  submit(): void {

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const formValue = this.loginForm.getRawValue();

    this.loading = true;
    this.errorMessage = '';

    this.authService.login({
      email: formValue.email,
      password: formValue.password
    }).subscribe({

      next: () => {

        this.authService.loadCurrentUser().subscribe({

          next: (user) => {

            const selectedRole =
              formValue.role
                .toUpperCase()
                .replace(/ /g, '_');

            const actualRole =
              String(user.role)
                .toUpperCase()
                .replace(/ /g, '_');

            if (selectedRole !== actualRole) {

              this.authService.logout();

              this.loading = false;

              this.errorMessage =
                `This account belongs to ${this.formatRole(user.role)}. ` +
                `Please select ${this.formatRole(user.role)} to continue.`;

              return;
            }

            this.loading = false;

            this.router.navigate(['/dashboard']);
          },

          error: () => {

            this.authService.logout();

            this.loading = false;

            this.errorMessage =
              'Unable to load your user profile.';
          }
        });
      },

      error: (error) => {

        this.loading = false;

        this.errorMessage =
          error?.error?.detail ||
          'Invalid email or password.';
      }
    });
  }

  formatRole(role: string): string {

    return String(role)
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }
}