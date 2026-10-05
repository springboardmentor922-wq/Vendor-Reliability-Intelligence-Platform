import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  Router,
  RouterLink
} from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {

  loading = false;
  errorMessage = '';
  successMessage = '';

  registerForm;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm =
      this.fb.nonNullable.group({
        full_name: [
          '',
          [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(150)
          ]
        ],

        email: [
          '',
          [
            Validators.required,
            Validators.email
          ]
        ],

        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(128)
          ]
        ]
      });
  }

  submit(): void {

    if (this.loading) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    this.authService.register(
      this.registerForm.getRawValue()
    ).subscribe({

      next: () => {

        this.loading = false;

        this.successMessage =
          'Account created successfully. Redirecting to login...';

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 800);
      },

      error: (error) => {

        this.loading = false;

        if (error?.status === 409) {
          this.errorMessage =
            'An account with this email already exists.';
        } else {
          this.errorMessage =
            error?.error?.detail ||
            'Unable to create your account. Please try again.';
        }
      }
    });
  }
}