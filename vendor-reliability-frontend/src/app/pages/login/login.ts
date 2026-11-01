import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, NgIf, NgFor],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  email = '';
  password = '';
  isLoading = false;
  loggingInRole: string | null = null;
  loadingStatus = '';
  errorMessage = '';
  registeredNotice = false;

  showPassword = false;
  approvedVendors: any[] = [];
  savedPasswordAppliedNotice = '';

  demoAccounts = [
    { role: 'Administrator', email: 'admin@vendor-iq.com', pwd: 'admin123', icon: 'bi-shield-shaded', color: 'admin' },
    { role: 'Procurement Manager', email: 'procurement@vendor-iq.com', pwd: 'procure123', icon: 'bi-cart4', color: 'procurement' },
    { role: 'Finance Officer', email: 'finance@vendor-iq.com', pwd: 'finance123', icon: 'bi-cash-coin', color: 'finance' },
    { role: 'Supply Chain Manager', email: 'supplychain@vendor-iq.com', pwd: 'supply123', icon: 'bi-truck', color: 'supply' },
    { role: 'Vendor', email: 'vendor@vendor-iq.com', pwd: 'vendor123', icon: 'bi-building-gear', color: 'vendor' },
    { role: 'Auditor', email: 'auditor@vendor-iq.com', pwd: 'audit123', icon: 'bi-clipboard-check', color: 'auditor' },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    if (params['registered'] === 'true') {
      this.registeredNotice = true;
    }
    if (params['email']) {
      this.email = params['email'];
    }

    this.loadApprovedVendors();

    // Only redirect if already authenticated and not explicitly arriving at login with intent to register or switch
    if (this.authService.isAuthenticated() && !params['registered'] && !params['switchUser']) {
      this.router.navigateByUrl(this.authService.getDashboardRoute());
    }
  }

  loadApprovedVendors(): void {
    this.authService.getApprovedVendorsLogin().subscribe({
      next: (vendors) => {
        this.approvedVendors = vendors || [];
      },
      error: () => {
        this.approvedVendors = [
          { vendor_id: 16, name: 'ABC Technologies', company: 'ABC Technologies Inc', email: 'vendor@vendor-iq.com', password: 'vendor123', icon: 'bi-laptop' },
          { vendor_id: 1, name: 'Acme Industrial Supplies', company: 'Acme Corp', email: 'sales@acme-industrial.com', password: 'vendor123', icon: 'bi-boxes' },
          { vendor_id: 17, name: 'Digital Systems Inc', company: 'Digital Systems Solutions Ltd', email: 'procure@digitalsystems.io', password: 'vendor123', icon: 'bi-cpu' },
          { vendor_id: 2, name: 'Apex Semiconductor Tech', company: 'Apex Semi Inc', email: 'orders@apexsemi.io', password: 'vendor123', icon: 'bi-memory' },
          { vendor_id: 15, name: 'Manikanta', company: 'Manikanta', email: 'manikanta@gmail.com', password: 'vendor123', icon: 'bi-building' }
        ];
      }
    });
  }

  checkExactVendorMatch(): void {
    const clean = (this.email || '').trim().toLowerCase();
    if (!clean) {
      this.savedPasswordAppliedNotice = '';
      return;
    }
    const match = this.approvedVendors.find(v =>
      (v.email && v.email.toLowerCase() === clean) ||
      (v.name && v.name.toLowerCase() === clean) ||
      (v.company && v.company.toLowerCase() === clean)
    );
    if (match) {
      if (!this.password || this.password === 'vendor123') {
        this.password = match.password || 'vendor123';
      }
      this.savedPasswordAppliedNotice = `Saved password applied for ${match.name}`;
    } else {
      this.savedPasswordAppliedNotice = '';
    }
  }

  toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  quickFill(acc: { role?: string; name?: string; email: string; pwd: string }): void {
    if (this.isLoading) return;
    const label = acc.role || acc.name || 'User';
    this.loggingInRole = label;
    this.email = acc.email;
    this.password = acc.pwd;
    this.executeLogin({ email: acc.email, password: acc.pwd }, label);
  }

  onEmailInput(): void {
    this.checkExactVendorMatch();
  }

  onEmailChange(): void {
    this.checkExactVendorMatch();
  }

  login(e?: Event): void {
    if (e) e.preventDefault();

    // Support browser autofill where Chrome populates DOM inputs directly
    let emailToUse = (this.email || '').trim();
    let pwdToUse = (this.password || '').trim();

    if (typeof document !== 'undefined') {
      const emailEl = document.querySelector('input[name="username"]') as HTMLInputElement;
      const pwdEl = document.querySelector('input[name="password"]') as HTMLInputElement;
      if (!emailToUse && emailEl?.value) {
        emailToUse = emailEl.value.trim();
      }
      if (!pwdToUse && pwdEl?.value) {
        pwdToUse = pwdEl.value.trim();
      }
    }

    // If password was empty, auto-resolve from approved vendor records
    if (emailToUse && !pwdToUse) {
      const clean = emailToUse.toLowerCase();
      const match = this.approvedVendors.find(v =>
        (v.email && v.email.toLowerCase() === clean) ||
        (v.name && v.name.toLowerCase() === clean) ||
        (v.company && v.company.toLowerCase() === clean)
      );
      if (match) {
        pwdToUse = match.password || 'vendor123';
      }
    }

    this.email = emailToUse;
    this.password = pwdToUse;
    this.executeLogin({ email: emailToUse, password: pwdToUse });
  }

  private executeLogin(creds: { email: string; password: string }, roleHint?: string): void {
    this.errorMessage = '';
    this.registeredNotice = false;
    if (!creds.email || !creds.password) {
      this.errorMessage = 'Please enter both email/username and password.';
      this.loggingInRole = null;
      return;
    }

    this.isLoading = true;
    this.loadingStatus = roleHint ? `Authenticating ${roleHint}...` : 'Authenticating...';

    this.authService.login(creds).subscribe({
      next: (res) => {
        const userRole = res.user?.role || roleHint;
        this.loadingStatus = `Opening ${userRole} Dashboard...`;

        // Direct single-hop routing: bypass any intermediate redirects to /dashboard
        let targetUrl = this.route.snapshot.queryParams['returnUrl'];
        if (!targetUrl || targetUrl === '/' || targetUrl === '/dashboard' || targetUrl.startsWith('/dashboard/')) {
          targetUrl = this.authService.getDashboardRoute(userRole);
        }

        // Navigate directly to target and keep smooth spinner until transition completes
        this.router.navigateByUrl(targetUrl).then(
          () => {
            this.isLoading = false;
            this.loggingInRole = null;
            this.loadingStatus = '';
          },
          () => {
            this.isLoading = false;
            this.loggingInRole = null;
            this.loadingStatus = '';
          }
        );
      },
      error: (err) => {
        this.isLoading = false;
        this.loggingInRole = null;
        this.loadingStatus = '';

        if (Array.isArray(err?.error?.detail)) {
          this.errorMessage = err.error.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
        } else if (typeof err?.error?.detail === 'string') {
          this.errorMessage = err.error.detail;
        } else if (err?.error?.message) {
          this.errorMessage = err.error.message;
        } else {
          this.errorMessage = err?.statusText || 'Unable to sign in. Please verify your credentials or server connection.';
        }
      }
    });
  }
}
