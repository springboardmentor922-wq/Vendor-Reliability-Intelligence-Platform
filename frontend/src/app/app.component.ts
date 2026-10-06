import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],

  template: `
    <nav class="navbar" *ngIf="isLoggedIn()">

      <div class="logo">
        Vendor Reliability Platform
      </div>

      <div class="nav-links">

        <a routerLink="/dashboard">Dashboard</a>
        <a routerLink="/vendors">Vendors</a>
        <a routerLink="/vendor-approval">Vendor Approval</a>
        <a routerLink="/contracts">Contracts</a>
        <a routerLink="/communications">Communication</a>
        <a routerLink="/procurement">Procurement</a>
        <a routerLink="/purchase-orders">Purchase Orders</a>
        <a routerLink="/performance">Performance</a>
        <a routerLink="/analytics">Analytics</a>
        <a routerLink="/reports">Reports</a>
        <a routerLink="/notifications">Notifications</a>

      </div>

    </nav>

    <router-outlet></router-outlet>
  `,

  styles: [`
    .navbar {
      background: white;
      padding: 12px 20px;
      border-bottom: 1px solid #ddd;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .logo {
      font-size: 20px;
      font-weight: 700;
      color: #222;
      white-space: nowrap;
    }

    .nav-links {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .nav-links a {
      text-decoration: none;
      color: #333;
      font-weight: 600;
      font-size: 13px;
      padding: 8px 9px;
      border-radius: 6px;
    }

    .nav-links a:hover {
      background: #eef2ff;
      color: #4f46e5;
    }
  `]
})

export class AppComponent {

  constructor(private authService: AuthService) {}

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }
}