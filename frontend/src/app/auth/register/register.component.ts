import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;
  errorMessage = '';

  roles = [
    { value: UserRole.PROCUREMENT_MANAGER, label: 'Procurement Manager' },
    { value: UserRole.SUPPLY_CHAIN_MANAGER, label: 'Supply Chain Manager' },
    { value: UserRole.VENDOR, label: 'Vendor Partner' },
    { value: UserRole.FINANCE_OFFICER, label: 'Finance Officer' },
    { value: UserRole.AUDITOR, label: 'Auditor' },
    { value: UserRole.ADMINISTRATOR, label: 'Administrator' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]],
      role: [UserRole.PROCUREMENT_MANAGER, [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirm_password')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { full_name, email, password, role } = this.registerForm.value;

    this.authService.register({ full_name, email, password, role }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
      },
      error: (err) => {
        this.isLoading = false;
        if (err.error && err.error.detail) {
          if (typeof err.error.detail === 'string') {
            this.errorMessage = err.error.detail;
          } else if (Array.isArray(err.error.detail)) {
            this.errorMessage = err.error.detail.map((d: any) => d.msg || 'Invalid field').join(', ');
          } else {
            this.errorMessage = JSON.stringify(err.error.detail);
          }
        } else {
          this.errorMessage = 'Registration failed. Please check your details and try again.';
        }
      }
    });
  }
}
