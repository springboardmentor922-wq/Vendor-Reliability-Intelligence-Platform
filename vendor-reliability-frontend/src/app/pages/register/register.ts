import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { AuthService, VENDOR_CATEGORIES } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [RouterLink, FormsModule, NgIf, NgFor],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  // Mode: 'vendor' (default) or 'staff'
  regType: 'vendor' | 'staff' = 'vendor';

  // Vendor Registration Fields ONLY: Name, Email, Category Selection, Phone Number, Password
  full_name = '';
  email = '';
  phone = '';
  vendor_category = 'Raw Material Suppliers';
  password = '';
  confirmPassword = '';

  // Exactly 6 Authorized Vendor Categories
  vendorCategories = VENDOR_CATEGORIES;

  // Staff-specific fields (when regType === 'staff')
  role = 'Procurement Manager';
  company = '';
  staffRoles = [
    'Procurement Manager',
    'Supply Chain Manager',
    'Finance Officer',
    'Auditor',
    'Administrator'
  ];

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const queryRole = this.route.snapshot.queryParamMap.get('role');
    if (queryRole) {
      if (queryRole.toLowerCase() === 'vendor') {
        this.regType = 'vendor';
      } else {
        this.regType = 'staff';
        this.role = queryRole;
      }
    }
  }

  setRegType(type: 'vendor' | 'staff'): void {
    this.regType = type;
    this.errorMessage = '';
    this.successMessage = '';
  }

  register(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.full_name || !this.full_name.trim()) {
      this.errorMessage = 'Please enter name.';
      return;
    }

    if (!this.email || !this.email.trim()) {
      this.errorMessage = 'Please enter email address.';
      return;
    }

    if (!this.password) {
      this.errorMessage = 'Please enter password.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    if (this.regType === 'vendor') {
      if (!this.vendor_category) {
        this.errorMessage = 'Please select a vendor category from the 6 authorized categories.';
        return;
      }
      if (!this.phone || !this.phone.trim()) {
        this.errorMessage = 'Please enter phone number.';
        return;
      }

      this.isLoading = true;
      this.authService.register({
        full_name: this.full_name.trim(),
        email: this.email.trim(),
        password: this.password,
        role: 'Vendor',
        phone: this.phone.trim(),
        vendor_category: this.vendor_category
      }).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Vendor registration submitted successfully! Awaiting Administrator verification. Redirecting to login...';
          setTimeout(() => {
            this.router.navigate(['/login'], { queryParams: { registered: 'true', email: this.email } });
          }, 1800);
        },
        error: (err) => this.handleError(err)
      });
    } else {
      // Staff registration
      this.isLoading = true;
      this.authService.register({
        full_name: this.full_name.trim(),
        email: this.email.trim(),
        password: this.password,
        role: this.role,
        phone: this.phone ? this.phone.trim() : undefined,
        company: this.company ? this.company.trim() : undefined
      }).subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Staff registration submitted successfully! Awaiting Administrator verification. Redirecting to login...';
          setTimeout(() => {
            this.router.navigate(['/login'], { queryParams: { registered: 'true', email: this.email } });
          }, 1800);
        },
        error: (err) => this.handleError(err)
      });
    }
  }

  private handleError(err: any): void {
    this.isLoading = false;
    if (Array.isArray(err?.error?.detail)) {
      this.errorMessage = err.error.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    } else if (typeof err?.error?.detail === 'string') {
      this.errorMessage = err.error.detail;
    } else {
      this.errorMessage = err?.message || 'Registration failed. An account with this email may already exist.';
    }
  }
}
