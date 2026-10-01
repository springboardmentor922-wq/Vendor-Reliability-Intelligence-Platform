import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  loading = false;
  error = '';
  success = false;

  roles: { value: UserRole; label: string }[] = [
    { value: 'procurement_manager', label: 'Procurement Manager' },
    { value: 'supply_chain_manager', label: 'Supply Chain Manager' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'finance_officer', label: 'Finance Officer' },
    { value: 'auditor', label: 'Auditor' },
    { value: 'administrator', label: 'Administrator' },
  ];

  form = this.fb.group({
    full_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    department: [''],
    role: ['procurement_manager' as UserRole, Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {}

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    this.auth.register(this.form.value as any).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.detail || 'Registration failed.';
      },
    });
  }
}
