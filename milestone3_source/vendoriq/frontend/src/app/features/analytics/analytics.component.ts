import { Component, OnInit } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ReliabilityService } from '../../core/services/reliability.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, KeyValuePipe],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  activeTab: 'procurement' | 'risk' | 'admin' | 'spend' | 'ranking' = 'procurement';
  loading = true;
  error = '';

  procurement: any = null;
  risk: any = null;
  admin: any = null;
  spend: any = null;
  procurementAnalytics: any = null;
  ranking: any[] = [];

  constructor(
    private analyticsService: AnalyticsService,
    private reliabilityService: ReliabilityService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.analyticsService.procurementDashboard().subscribe((d) => (this.procurement = d));
    this.analyticsService.procurementAnalytics().subscribe((d) => (this.procurementAnalytics = d));
    this.analyticsService.vendorRiskDashboard().subscribe((d) => (this.risk = d));
    this.analyticsService.procurementSpend().subscribe((d) => (this.spend = d));
    this.reliabilityService.ranking().subscribe((d) => (this.ranking = d));

    if (this.auth.hasAnyRole(['administrator'])) {
      this.analyticsService.adminDashboard().subscribe({
        next: (d) => {
          this.admin = d;
          this.loading = false;
        },
        error: () => (this.loading = false),
      });
    } else {
      this.loading = false;
    }
  }

  maxValue(obj: Record<string, number> | undefined): number {
    if (!obj) return 1;
    const values = Object.values(obj);
    return values.length ? Math.max(...values, 1) : 1;
  }

  riskBadgeClass(risk: string): string {
    switch (risk) {
      case 'low':
        return 'bg-success';
      case 'medium':
        return 'bg-warning text-dark';
      case 'high':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }
}
