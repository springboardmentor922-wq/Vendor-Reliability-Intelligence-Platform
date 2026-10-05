import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPassword {

  loading = false;
  errorMessage = '';
  successMessage = '';

  token = '';

  form;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {

    this.token =
      this.route.snapshot.queryParamMap
        .get('token') || '';

    this.form =
      this.fb.nonNullable.group({
        new_password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(128)
          ]
        ],

        confirm_password: [
          '',
          [
            Validators.required
          ]
        ]
      });
  }

  submit(): void {

    this.errorMessage = '';
    this.successMessage = '';

    if (!this.token) {
      this.errorMessage =
        'Invalid password reset link.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const {
      new_password,
      confirm_password
    } = this.form.getRawValue();

    if (new_password !== confirm_password) {
      this.errorMessage =
        'Passwords do not match.';
      return;
    }

    this.loading = true;

    this.authService
      .resetPassword({
        token: this.token,
        new_password
      })
      .subscribe({

        next: () => {

          this.loading = false;

          this.successMessage =
            'Password reset successful. Redirecting to login...';

          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 1200);
        },

        error: error => {

          this.loading = false;

          this.errorMessage =
            error?.error?.detail ||
            'Unable to reset your password.';
        }
      });
  }
}