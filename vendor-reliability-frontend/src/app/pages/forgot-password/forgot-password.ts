import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, FormsModule, NgIf],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {
  step: 'request' | 'reset' = 'request';
  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';
  
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  generatedToken = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  requestResetToken(): void {
    this.errorMessage = '';
    if (!this.email) {
      this.errorMessage = 'Please enter your registered email address.';
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.generatedToken = res.reset_token || '';
        this.token = this.generatedToken;
        this.step = 'reset';
        this.successMessage = 'Reset token generated successfully! Please set your new password.';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.detail || 'Failed to process password reset request.';
      }
    });
  }

  submitNewPassword(): void {
    this.errorMessage = '';
    if (!this.token || !this.newPassword) {
      this.errorMessage = 'Please enter reset token and new password.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword({ token: this.token, new_password: this.newPassword }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = 'Password updated successfully! Redirecting to login...';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.detail || 'Failed to reset password. Token may be invalid or expired.';
      }
    });
  }
}
