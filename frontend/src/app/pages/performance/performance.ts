import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  VendorPerformanceSummary,
  VendorPerformanceHistory,
  VendorPerformanceService
} from '../../core/services/vendor-performance';

import {
  DatasetAnalytics,
  DatasetAnalyticsService
} from '../../core/services/dataset-analytics';

@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './performance.html',
  styleUrl: './performance.scss'
})
export class Performance implements OnInit {

  // ============================================================
  // Vendor Performance
  // ============================================================

  summaries: VendorPerformanceSummary[] = [];

  selectedVendor: VendorPerformanceSummary | null = null;

  history: VendorPerformanceHistory[] = [];

  loading = true;

  historyLoading = false;

  errorMessage = '';

  // ============================================================
  // Supply Chain Dataset Benchmark
  // ============================================================

  datasetAnalytics: DatasetAnalytics | null = null;

  datasetLoading = true;

  datasetErrorMessage = '';

  // ============================================================
  // Constructor
  // ============================================================

  constructor(
    private performanceService: VendorPerformanceService,
    private datasetAnalyticsService: DatasetAnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  // ============================================================
  // Initial Load
  // ============================================================

  ngOnInit(): void {
    this.loadPerformance();
    this.loadDatasetAnalytics();
  }

  // ============================================================
  // Vendor Performance
  // ============================================================

  loadPerformance(): void {
    this.loading = true;
    this.errorMessage = '';

    this.performanceService.getPerformanceSummaries().subscribe({
      next: (data: VendorPerformanceSummary[]) => {
        this.summaries = data || [];

        if (this.summaries.length > 0) {
          this.selectedVendor = this.summaries[0];
          this.loadHistory(this.selectedVendor.vendor_id);
        } else {
          this.selectedVendor = null;
          this.history = [];
        }

        this.loading = false;
        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to load vendor performance:', error);

        this.errorMessage =
          error?.error?.detail ||
          'Unable to load vendor performance data. Please try again.';

        this.summaries = [];
        this.selectedVendor = null;
        this.history = [];
        this.loading = false;

        this.cdr.detectChanges();
      }
    });
  }

  selectVendor(vendor: VendorPerformanceSummary): void {
    this.selectedVendor = vendor;

    this.loadHistory(vendor.vendor_id);
  }

  loadHistory(vendorId: number): void {
    this.historyLoading = true;
    this.history = [];

    this.performanceService.getVendorHistory(vendorId).subscribe({
      next: (data: VendorPerformanceHistory[]) => {
        this.history = data || [];
        this.historyLoading = false;

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to load vendor performance history:', error);

        this.history = [];
        this.historyLoading = false;

        this.cdr.detectChanges();
      }
    });
  }

  // ============================================================
  // Refresh
  // ============================================================

  refresh(): void {
    this.loadPerformance();
    this.loadDatasetAnalytics();
  }

  // ============================================================
  // Dataset Analytics
  // ============================================================

  loadDatasetAnalytics(): void {
    this.datasetLoading = true;
    this.datasetErrorMessage = '';

    this.datasetAnalyticsService.getDatasetAnalytics().subscribe({
      next: (data: DatasetAnalytics) => {
        this.datasetAnalytics = data;
        this.datasetLoading = false;

        this.cdr.detectChanges();
      },

      error: (error) => {
        console.error('Unable to load supply-chain dataset analytics:', error);

        this.datasetAnalytics = null;

        this.datasetErrorMessage =
          error?.error?.detail ||
          'Unable to load supply-chain dataset analytics.';

        this.datasetLoading = false;

        this.cdr.detectChanges();
      }
    });
  }

  // ============================================================
  // Performance Score Styling
  // ============================================================

  getScoreClass(score: number | null | undefined): string {
    const value = Number(score || 0);

    if (value >= 80) {
      return 'excellent';
    }

    if (value >= 65) {
      return 'good';
    }

    if (value >= 50) {
      return 'attention';
    }

    return 'poor';
  }

  // ============================================================
  // Delivery Status Styling
  // ============================================================

  getDeliveryClass(status: string | null | undefined): string {
    const value = String(status || '').toLowerCase();

    if (
      value.includes('on-time') ||
      value.includes('on time') ||
      value.includes('advance') ||
      value.includes('delivered')
    ) {
      return 'on-time';
    }

    if (
      value.includes('delay') ||
      value.includes('late')
    ) {
      return 'delayed';
    }

    return 'pending';
  }

  // ============================================================
  // Number Formatting
  // ============================================================

  formatNumber(
    value: number | null | undefined,
    decimals = 1
  ): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }

    return Number(value).toFixed(decimals);
  }

  // ============================================================
  // Date Formatting
  // ============================================================

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // ============================================================
  // Dataset Helpers
  // ============================================================

  integer(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }

    return Math.round(Number(value)).toLocaleString('en-IN');
  }

  percentage(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }

    return `${Number(value).toFixed(2)}%`;
  }

  days(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }

    return `${Number(value).toFixed(2)} days`;
  }

  datasetProgress(value: number | null | undefined): number {
    if (
      !this.datasetAnalytics ||
      value === null ||
      value === undefined
    ) {
      return 0;
    }

    const total =
      this.datasetAnalytics.delivery_status.late_delivery +
      this.datasetAnalytics.delivery_status.advance_shipping +
      this.datasetAnalytics.delivery_status.shipping_on_time +
      this.datasetAnalytics.delivery_status.shipping_canceled;

    if (total <= 0) {
      return 0;
    }

    return (Number(value) / total) * 100;
  }
}