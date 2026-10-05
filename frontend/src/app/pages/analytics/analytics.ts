
import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
  ChartData,
  ChartOptions
} from 'chart.js';

import {
  AnalyticsService,
  DashboardAnalytics
} from '../../core/services/analytics';

import {
  DatasetAnalyticsService,
  DatasetAnalytics
} from '../../core/services/dataset-analytics';

type ReliabilityFactor =
  | 'Delivery'
  | 'Quality'
  | 'Communication'
  | 'Compliance';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective
  ],
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss'
})
export class Analytics implements OnInit {

  analytics: DashboardAnalytics | null = null;
  datasetAnalytics: DatasetAnalytics | null = null;

  loading = true;
  datasetLoading = true;

  errorMessage = '';
  datasetErrorMessage = '';

  readonly reliabilityFactors: {
    name: string;
    key: ReliabilityFactor;
  }[] = [
    { name: 'Delivery History', key: 'Delivery' },
    { name: 'Product Quality', key: 'Quality' },
    { name: 'Communication Efficiency', key: 'Communication' },
    { name: 'Contract Compliance', key: 'Compliance' }
  ];

  // Chart options
  readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: {
          color: '#cbd5e1'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' }
      }
    }
  };

  readonly doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#cbd5e1',
          padding: 16
        }
      }
    }
  };

  readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#cbd5e1'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' }
      }
    }
  };

  // Chart data
  deliveryChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Purchase Orders',
      data: [],
      backgroundColor: '#3b82f6',
      borderRadius: 6
    }]
  };

  contractChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#3b82f6',
        '#06b6d4',
        '#f59e0b',
        '#8b5cf6'
      ],
      borderWidth: 0
    }]
  };

  reliabilityChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Reliability Score',
      data: [],
      backgroundColor: '#06b6d4',
      borderRadius: 6
    }]
  };

  datasetDeliveryChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#ef4444',
        '#22c55e',
        '#3b82f6',
        '#94a3b8'
      ],
      borderWidth: 0
    }]
  };

  shippingModeChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Records',
      data: [],
      backgroundColor: '#6366f1',
      borderRadius: 6
    }]
  };

  monthlyTrendChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Total Records',
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.35
      },
      {
        label: 'Late Deliveries',
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.10)',
        fill: false,
        tension: 0.35
      },
      {
        label: 'On-Time Deliveries',
        data: [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.10)',
        fill: false,
        tension: 0.35
      }
    ]
  };

  constructor(
    private analyticsService: AnalyticsService,
    private datasetAnalyticsService: DatasetAnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
    this.loadDatasetAnalytics();
  }

  loadAnalytics(): void {
    this.loading = true;
    this.errorMessage = '';

    this.analyticsService.getDashboardAnalytics().subscribe({
      next: (data) => {
        this.analytics = data;
        this.buildPlatformCharts(data);

        console.log('VendorIQ database analytics:', data);

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Analytics loading failed:', error);

        this.errorMessage = 'Unable to load analytics data.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadDatasetAnalytics(): void {
    this.datasetLoading = true;
    this.datasetErrorMessage = '';

    this.datasetAnalyticsService.getDatasetAnalytics().subscribe({
      next: (data) => {
        this.datasetAnalytics = data;
        this.buildDatasetCharts(data);

        console.log('DataCo dataset analytics:', data);

        this.datasetLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Dataset analytics loading failed:', error);

        this.datasetErrorMessage =
          'Unable to load the supply-chain dataset analytics.';

        this.datasetLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  refresh(): void {
    this.loadAnalytics();
    this.loadDatasetAnalytics();
  }

  private buildPlatformCharts(data: DashboardAnalytics): void {
    const delivery = data.procurement.delivery_status;

    this.deliveryChartData = {
      labels: [
        'Pending',
        'Approved',
        'Ordered',
        'Delivered',
        'Completed',
        'Delayed',
        'Cancelled'
      ],
      datasets: [{
        label: 'Purchase Orders',
        data: [
          Number(delivery.pending ?? 0),
          Number(delivery.approved ?? 0),
          Number(delivery.ordered ?? 0),
          Number(delivery.delivered ?? 0),
          Number(delivery.completed ?? 0),
          Number(delivery.delayed ?? 0),
          Number(delivery.cancelled ?? 0)
        ],
        backgroundColor: [
          '#f59e0b',
          '#6366f1',
          '#3b82f6',
          '#06b6d4',
          '#22c55e',
          '#ef4444',
          '#94a3b8'
        ],
        borderRadius: 6
      }]
    };

    this.contractChartData = {
      labels: [
        'Active',
        'Expiring',
        'Expired',
        'Renewed'
      ],
      datasets: [{
        data: [
          Number(data.contracts.active ?? 0),
          Number(data.contracts.expiring ?? 0),
          Number(data.contracts.expired ?? 0),
          Number(data.contracts.renewed ?? 0)
        ],
        backgroundColor: [
          '#22c55e',
          '#f59e0b',
          '#ef4444',
          '#3b82f6'
        ],
        borderWidth: 0
      }]
    };

    const factors = data.vendor_performance.reliability_factors;

    this.reliabilityChartData = {
      labels: [
        'Delivery',
        'Quality',
        'Communication',
        'Compliance'
      ],
      datasets: [{
        label: 'Reliability Score',
        data: [
          Number(factors.Delivery ?? 0),
          Number(factors.Quality ?? 0),
          Number(factors.Communication ?? 0),
          Number(factors.Compliance ?? 0)
        ],
        backgroundColor: [
          '#3b82f6',
          '#06b6d4',
          '#8b5cf6',
          '#22c55e'
        ],
        borderRadius: 6
      }]
    };
  }

  private buildDatasetCharts(data: DatasetAnalytics): void {
    const status = data.delivery_status;

    this.datasetDeliveryChartData = {
      labels: [
        'Late Delivery',
        'Advance Shipping',
        'Shipping On Time',
        'Shipping Canceled'
      ],
      datasets: [{
        data: [
          Number(status.late_delivery ?? 0),
          Number(status.advance_shipping ?? 0),
          Number(status.shipping_on_time ?? 0),
          Number(status.shipping_canceled ?? 0)
        ],
        backgroundColor: [
          '#ef4444',
          '#22c55e',
          '#3b82f6',
          '#94a3b8'
        ],
        borderWidth: 0
      }]
    };

    this.shippingModeChartData = {
      labels: data.shipping_modes.map(item => item.shipping_mode),
      datasets: [{
        label: 'Records',
        data: data.shipping_modes.map(item => Number(item.records ?? 0)),
        backgroundColor: '#6366f1',
        borderRadius: 6
      }]
    };

    const monthly = data.monthly_trend.slice(-12);

    this.monthlyTrendChartData = {
      labels: monthly.map(item => item.month),
      datasets: [
        {
          label: 'Total Records',
          data: monthly.map(item => Number(item.total_records ?? 0)),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.35
        },
        {
          label: 'Late Deliveries',
          data: monthly.map(item => Number(item.late_deliveries ?? 0)),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.10)',
          fill: false,
          tension: 0.35
        },
        {
          label: 'On-Time Deliveries',
          data: monthly.map(item => Number(item.on_time_deliveries ?? 0)),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.10)',
          fill: false,
          tension: 0.35
        }
      ]
    };
  }

  getFactorValue(key: ReliabilityFactor): number | null {
    if (!this.analytics) {
      return null;
    }

    return this.analytics.vendor_performance.reliability_factors[key];
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '—';
    }

    return Number(value).toFixed(2);
  }

  integer(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '—';
    }

    return Number(value).toLocaleString('en-IN');
  }

  percentage(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '—';
    }

    return `${Number(value).toFixed(1)}%`;
  }

  currency(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '₹0.00';
    }

    return `₹${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  factorWidth(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '0%';
    }

    return `${Math.max(0, Math.min(100, Number(value)))}%`;
  }

  datasetStatusWidth(value: number): string {
    if (!this.datasetAnalytics || this.datasetAnalytics.total_records === 0) {
      return '0%';
    }

    return `${(
      Number(value) /
      this.datasetAnalytics.total_records *
      100
    ).toFixed(2)}%`;
  }

  latestMonthlyTrend(): DatasetAnalytics['monthly_trend'] {
    if (!this.datasetAnalytics) {
      return [];
    }

    return this.datasetAnalytics.monthly_trend.slice(-12);
  }

  monthlyWidth(value: number): string {
    if (!this.datasetAnalytics) {
      return '0%';
    }

    const maximum = Math.max(
      ...this.latestMonthlyTrend().map(item => item.total_records),
      1
    );

    return `${(
      Number(value) /
      maximum *
      100
    ).toFixed(2)}%`;
  }
}