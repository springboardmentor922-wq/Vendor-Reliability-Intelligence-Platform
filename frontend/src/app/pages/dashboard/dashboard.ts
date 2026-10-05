
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

import { AuthService } from '../../core/services/auth';
import {
  AnalyticsService,
  DashboardAnalytics
} from '../../core/services/analytics';

type ReliabilityFactor =
  | 'Delivery'
  | 'Quality'
  | 'Communication'
  | 'Compliance';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  analytics: DashboardAnalytics | null = null;

  loading = true;
  errorMessage = '';

  orderChartType: 'doughnut' = 'doughnut';
  contractChartType: 'doughnut' = 'doughnut';
  deliveryChartType: 'bar' = 'bar';

  orderChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Pending', 'Completed', 'Delayed'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#eab308', '#22c55e', '#ef4444'],
      borderColor: '#0c1320',
      borderWidth: 3
    }]
  };

  contractChartData: ChartConfiguration<'doughnut'>['data'] = {
    labels: ['Active', 'Expiring', 'Expired', 'Renewed'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: ['#3b82f6', '#eab308', '#ef4444', '#22c55e'],
      borderColor: '#0c1320',
      borderWidth: 3
    }]
  };

  deliveryChartData: ChartConfiguration<'bar'>['data'] = {
    labels: ['Pending', 'Approved', 'Ordered', 'Delivered', 'Completed', 'Cancelled', 'Delayed'],
    datasets: [{
      label: 'Purchase orders',
      data: [0, 0, 0, 0, 0, 0, 0],
      backgroundColor: '#3b82f6',
      borderRadius: 6
    }]
  };

  readonly doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#aab8cc',
          padding: 16,
          usePointStyle: true
        }
      }
    }
  };

  readonly barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#aab8cc' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#8797ae' },
        grid: { color: 'rgba(135, 151, 174, 0.08)' }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#8797ae',
          precision: 0
        },
        grid: { color: 'rgba(135, 151, 174, 0.12)' }
      }
    }
  };

  readonly reliabilityFactors: {
    name: string;
    key: ReliabilityFactor;
  }[] = [
    { name: 'Delivery', key: 'Delivery' },
    { name: 'Quality', key: 'Quality' },
    { name: 'Communication', key: 'Communication' },
    { name: 'Compliance', key: 'Compliance' }
  ];

  constructor(
    public authService: AuthService,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    this.analyticsService.getDashboardAnalytics().subscribe({
      next: (data: DashboardAnalytics) => {
        this.analytics = data;
        this.updateCharts(data);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('DASHBOARD API ERROR:', error);
        this.loading = false;

        const apiError = error as {
          error?: { detail?: string };
        };

        this.errorMessage =
          apiError?.error?.detail ||
          'Unable to load dashboard analytics.';

        this.cdr.detectChanges();
      }
    });
  }

  private updateCharts(data: DashboardAnalytics): void {
    this.orderChartData = {
      labels: ['Pending', 'Completed', 'Delayed'],
      datasets: [{
        data: [
          data.orders.pending,
          data.orders.completed,
          data.orders.delayed
        ],
        backgroundColor: ['#eab308', '#22c55e', '#ef4444'],
        borderColor: '#0c1320',
        borderWidth: 3
      }]
    };

    this.contractChartData = {
      labels: ['Active', 'Expiring', 'Expired', 'Renewed'],
      datasets: [{
        data: [
          data.contracts.active,
          data.contracts.expiring,
          data.contracts.expired,
          data.contracts.renewed
        ],
        backgroundColor: ['#3b82f6', '#eab308', '#ef4444', '#22c55e'],
        borderColor: '#0c1320',
        borderWidth: 3
      }]
    };

    const delivery = data.procurement.delivery_status;

    this.deliveryChartData = {
      labels: [
        'Pending',
        'Approved',
        'Ordered',
        'Delivered',
        'Completed',
        'Cancelled',
        'Delayed'
      ],
      datasets: [{
        label: 'Purchase orders',
        data: [
          delivery.pending,
          delivery.approved,
          delivery.ordered,
          delivery.delivered,
          delivery.completed,
          delivery.cancelled,
          delivery.delayed
        ],
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }]
    };
  }

  refresh(): void {
    this.loadDashboard();
  }

  getFactorValue(key: ReliabilityFactor): number | null {
    if (!this.analytics) {
      return null;
    }

    return this.analytics.vendor_performance.reliability_factors[key];
  }

  percentage(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return `${Number(value).toFixed(0)}%`;
  }

  value(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return Number(value).toFixed(1);
  }

  factorValue(value: number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Math.max(0, Math.min(100, Number(value)));
  }

  hasVendorPerformanceData(): boolean {
    if (!this.analytics) {
      return false;
    }

    return (
      this.analytics.vendor_performance.performance_score !== null ||
      this.analytics.vendor_performance.delivery_rate !== null ||
      this.analytics.vendor_performance.quality_rating !== null ||
      this.analytics.vendor_performance.response_time_hours !== null
    );
  }

  hasReliabilityData(): boolean {
    if (!this.analytics) {
      return false;
    }

    return this.analytics.vendor_performance.reliability_score !== null;
  }

  getRoleLabel(): string {
    return this.authService.currentUser()?.role || 'User';
  }

  getUserName(): string {
    return this.authService.currentUser()?.full_name || 'User';
  }
}