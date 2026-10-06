import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-vendor-performance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vendor-performance.component.html'
})
export class VendorPerformanceComponent implements OnInit {

  private readonly api = 'http://127.0.0.1:8000/api/v1';

  procurementAnalytics: any = null;
  vendorDashboard: any = null;

  vendorPerformanceRecords: any[] = [];

  loading = true;
  error = '';

  constructor(
    private http: HttpClient,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadPerformance();
  }

  get role(): string | null {
    return this.auth.currentUser()?.role ?? null;
  }

  get isVendor(): boolean {
    return this.role === 'vendor';
  }

  loadPerformance(): void {

    this.loading = true;
    this.error = '';

    /*
     * VENDOR
     * Use vendor-specific endpoint.
     */
    if (this.isVendor) {

      this.http
        .get<any>(
          `${this.api}/analytics/vendor-dashboard/me`
        )
        .subscribe({

          next: (data) => {

            console.log(
              'Vendor Performance Data:',
              data
            );

            this.vendorDashboard = data;

            this.loading = false;
          },

          error: (error) => {

            console.error(
              'Vendor Performance Error:',
              error
            );

            this.error =
              error?.error?.detail ||
              'Failed to load vendor performance.';

            this.loading = false;
          }

        });

      return;
    }


    /*
     * PROCUREMENT / INTERNAL USERS
     *
     * Keep the existing procurement endpoint.
     * This does NOT affect the Procurement Dashboard.
     */
    this.http
      .get<any>(
        `${this.api}/analytics/procurement-dashboard`
      )
      .subscribe({

        next: (data) => {

          console.log(
            'Procurement Vendor Performance:',
            data
          );

          this.procurementAnalytics = data;

          this.vendorPerformanceRecords =
            data?.vendor_performance_records ?? [];

          this.loading = false;
        },

        error: (error) => {

          console.error(
            'Procurement Vendor Performance Error:',
            error
          );

          this.error =
            error?.error?.detail ||
            'Failed to load vendor performance records.';

          this.loading = false;
        }

      });
  }


  // ============================================================
  // VENDOR METRICS
  // ============================================================

  get vendorPerformance(): any {

    return this.vendorDashboard?.vendor_performance ?? {};
  }


  get reliabilityScore(): any {

    return this.vendorDashboard?.reliability_score ?? {};
  }


  get performanceScore(): number {

    return Number(
      this.reliabilityScore?.score ?? 0
    );
  }


  get deliveryRate(): number {

    return Number(
      this.vendorPerformance?.on_time_rate ?? 0
    );
  }


  get qualityRating(): number {

    return Number(
      this.vendorPerformance?.quality_rating ?? 0
    );
  }


  get responseTime(): number {

    return Number(
      this.vendorPerformance?.avg_response_time_hours ?? 0
    );
  }


  get issueResolutionTime(): number {

    return Number(
      this.vendorPerformance?.avg_issue_resolution_hours ?? 0
    );
  }


  // ============================================================
  // PROCUREMENT SUMMARY
  // ============================================================

  get totalVendors(): number {

    return this.vendorPerformanceRecords.length;

  }


  get activeVendors(): number {

    return this.vendorPerformanceRecords.filter(
      vendor =>
        String(vendor.status || '').toLowerCase() === 'approved' ||
        String(vendor.status || '').toLowerCase() === 'active'
    ).length;

  }


  get averagePerformance(): number {

    if (!this.vendorPerformanceRecords.length) {
      return 0;
    }

    const values =
      this.vendorPerformanceRecords.map(
        vendor =>
          Number(vendor.performance_score ?? 0)
      );

    return this.round(
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    );

  }


  get averageOnTimeDelivery(): number {

    if (!this.vendorPerformanceRecords.length) {
      return 0;
    }

    const values =
      this.vendorPerformanceRecords.map(
        vendor =>
          Number(
            vendor.on_time_delivery_rate ?? 0
          )
      );

    return this.round(
      values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
    );

  }


  formatCategory(
    category: string | null | undefined
  ): string {

    if (!category) {
      return '-';
    }

    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char =>
        char.toUpperCase()
      );
  }


  formatStatus(
    status: string | null | undefined
  ): string {

    if (!status) {
      return '-';
    }

    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char =>
        char.toUpperCase()
      );
  }


  statusClass(
    status: string | null | undefined
  ): string {

    switch (
      String(status || '').toLowerCase()
    ) {

      case 'approved':
      case 'active':
        return 'bg-success';

      case 'pending':
        return 'bg-warning text-dark';

      case 'rejected':
        return 'bg-danger';

      case 'suspended':
        return 'bg-secondary';

      default:
        return 'bg-secondary';
    }
  }


  performanceClass(
    score: number | null | undefined
  ): string {

    const value = Number(score ?? 0);

    if (value >= 80) {
      return 'text-success';
    }

    if (value >= 60) {
      return 'text-warning';
    }

    return 'text-danger';
  }


  round(value: number): number {

    return Math.round(
      value * 100
    ) / 100;
  }

}