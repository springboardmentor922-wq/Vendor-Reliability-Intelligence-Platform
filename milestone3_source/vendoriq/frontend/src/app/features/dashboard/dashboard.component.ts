import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardSummary } from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  summary: DashboardSummary | null = null;
  loading = true;
  error = '';

  constructor(private dashboardService: DashboardService, public auth: AuthService) {}

  ngOnInit(): void {
    this.dashboardService.summary().subscribe({
      next: (s) => {
        this.summary = s;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load dashboard summary.';
        this.loading = false;
      },
    });
  }
}
