import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  constructor(public auth: AuthService, private router: Router) {}

  navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/vendors', label: 'Vendors', icon: 'fa-people-carry-box' },
    { path: '/procurement', label: 'Procurement', icon: 'fa-cart-shopping' },
    { path: '/purchase-orders', label: 'Purchase Orders', icon: 'fa-file-invoice' },
    { path: '/contracts', label: 'Contracts', icon: 'fa-file-contract' },
    { path: '/communication', label: 'Communication', icon: 'fa-comments' },
    { path: '/analytics', label: 'Analytics', icon: 'fa-chart-pie' },
    { path: '/reports', label: 'Reports', icon: 'fa-file-export' },
  ];

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
