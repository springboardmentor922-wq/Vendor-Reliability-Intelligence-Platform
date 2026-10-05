import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  VendorPerformanceCreate,
  VendorPerformanceHistory,
  VendorPerformanceService,
  VendorPerformanceSummary
} from '../../core/services/vendor-performance';

import {
  Vendor,
  VendorService
} from '../../core/services/vendor';


@Component({
  selector: 'app-vendor-performance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './vendor-performance.html',
  styleUrl: './vendor-performance.scss'
})
export class VendorPerformance implements OnInit {

  performance: VendorPerformanceSummary[] = [];

  vendors: Vendor[] = [];

  history: VendorPerformanceHistory[] = [];

  selectedVendorId: number | null = null;

  loading = false;
  historyLoading = false;
  saving = false;

  errorMessage = '';
  successMessage = '';

  form: VendorPerformanceCreate = {
    vendor_id: 0,
    purchase_order_id: null,
    actual_delivery_date: null,
    quality_rating: null,
    service_rating: null,
    response_time_hours: null,
    issue_resolution_time_hours: null,
    issue_count: 0,
    notes: null,
    evaluation_date: this.today()
  };


  constructor(
    private performanceService: VendorPerformanceService,
    private vendorService: VendorService
  ) {}


  ngOnInit(): void {
    this.loadPerformance();
    this.loadVendors();
  }


  today(): string {
    return new Date()
      .toISOString()
      .split('T')[0];
  }


  loadPerformance(): void {

    this.loading = true;
    this.errorMessage = '';

    this.performanceService
      .getPerformance()
      .subscribe({

        next: (data) => {
          this.performance = data;
          this.loading = false;
        },

        error: (error) => {
          console.error(error);

          this.errorMessage =
            'Unable to load vendor performance data.';

          this.loading = false;
        }
      });
  }


  loadVendors(): void {

    this.vendorService
      .getVendors()
      .subscribe({

        next: (data) => {
          this.vendors = data;
        },

        error: (error) => {
          console.error(error);
        }
      });
  }


  selectVendor(vendorId: number): void {

    this.selectedVendorId = vendorId;

    this.form.vendor_id = vendorId;

    this.loadHistory(vendorId);
  }


  loadHistory(vendorId: number): void {

    this.historyLoading = true;

    this.performanceService
      .getHistory(vendorId)
      .subscribe({

        next: (data) => {
          this.history = data;
          this.historyLoading = false;
        },

        error: (error) => {
          console.error(error);

          this.history = [];

          this.historyLoading = false;
        }
      });
  }


  saveEvaluation(): void {

    this.errorMessage = '';
    this.successMessage = '';

    if (!this.form.vendor_id) {
      this.errorMessage = 'Please select a vendor.';
      return;
    }

    this.saving = true;

    this.performanceService
      .createEvaluation(this.form)
      .subscribe({

        next: () => {

          this.successMessage =
            'Vendor performance evaluation saved successfully.';

          this.saving = false;

          const vendorId = this.form.vendor_id;

          this.resetForm();

          this.loadPerformance();

          if (vendorId) {
            this.selectedVendorId = vendorId;
            this.loadHistory(vendorId);
          }
        },

        error: (error) => {

          console.error(error);

          this.errorMessage =
            error?.error?.detail ||
            'Unable to save performance evaluation.';

          this.saving = false;
        }
      });
  }


  resetForm(): void {

    this.form = {
      vendor_id: this.selectedVendorId || 0,
      purchase_order_id: null,
      actual_delivery_date: null,
      quality_rating: null,
      service_rating: null,
      response_time_hours: null,
      issue_resolution_time_hours: null,
      issue_count: 0,
      notes: null,
      evaluation_date: this.today()
    };
  }


  get totalVendors(): number {
    return this.performance.length;
  }


  get totalOnTime(): number {
    return this.performance.reduce(
      (sum, item) =>
        sum + item.on_time_deliveries,
      0
    );
  }


  get totalDelayed(): number {
    return this.performance.reduce(
      (sum, item) =>
        sum + item.delayed_deliveries,
      0
    );
  }


  get averageCompletionRate(): number {

    if (!this.performance.length) {
      return 0;
    }

    return (
      this.performance.reduce(
        (sum, item) =>
          sum + Number(item.order_completion_rate),
        0
      ) / this.performance.length
    );
  }


  get selectedVendor(): VendorPerformanceSummary | undefined {

    if (!this.selectedVendorId) {
      return undefined;
    }

    return this.performance.find(
      item =>
        item.vendor_id === this.selectedVendorId
    );
  }


  formatNumber(value: number | null): string {

    if (value === null || value === undefined) {
      return '—';
    }

    return Number(value).toFixed(2);
  }


  performanceClass(status: string): string {

    switch (status) {
      case 'Excellent':
        return 'excellent';

      case 'Good':
        return 'good';

      case 'Needs Attention':
        return 'attention';

      case 'Poor':
        return 'poor';

      default:
        return '';
    }
  }
}