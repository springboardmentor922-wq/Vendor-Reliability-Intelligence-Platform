import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPassword {
  loading = false;
  message = '';
  errorMessage = '';
  resetToken = '';

  forgotForm;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.forgotForm = this.fb.nonNullable.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ]
    });
  }

  submit(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = '';
    this.errorMessage = '';
    this.resetToken = '';

    this.authService.forgotPassword(
      this.forgotForm.getRawValue().email
    ).subscribe({
      next: (response) => {
        this.loading = false;

        this.message = response.message || 'Password reset request created.';
        this.resetToken = response.reset_token || '';
      },
      error: (error) => {
        this.loading = false;

        this.errorMessage =
          error?.error?.detail ||
          'Unable to process your password reset request.';
      }
    });
  }

  continueToReset(): void {
    if (!this.resetToken) {
      return;
    }

    this.router.navigate(
      ['/reset-password'],
      {
        queryParams: {
          token: this.resetToken
        }
      }
    );
  }
}