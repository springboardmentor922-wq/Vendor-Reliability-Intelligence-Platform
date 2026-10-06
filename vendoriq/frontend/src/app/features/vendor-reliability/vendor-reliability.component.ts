import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-vendor-reliability',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vendor-reliability.component.html'
})
export class VendorReliabilityComponent implements OnInit {

  private readonly api = 'http://127.0.0.1:8000/api/v1';

  riskData: any = null;

  loading = true;
  error = '';

  constructor(
    private http: HttpClient,
    public auth: AuthService
  ) {}

  get isAuditor(): boolean {
    return this.auth.currentUser()?.role === 'auditor';
  }

  get lowRiskVendors(): any[] {
    return this.riskData?.risk_buckets?.low ?? [];
  }

  get mediumRiskVendors(): any[] {
    return this.riskData?.risk_buckets?.medium ?? [];
  }

  get highRiskVendors(): any[] {
    return this.riskData?.risk_buckets?.high ?? [];
  }

  get allRiskVendors(): any[] {
    return [
      ...this.lowRiskVendors,
      ...this.mediumRiskVendors,
      ...this.highRiskVendors
    ];
  }

  get totalRiskVendors(): number {
    return (
      this.lowRiskVendors.length +
      this.mediumRiskVendors.length +
      this.highRiskVendors.length
    );
  }

  get averageReliability(): number {
    const vendors = [
      ...this.lowRiskVendors,
      ...this.mediumRiskVendors,
      ...this.highRiskVendors
    ];

    if (!vendors.length) {
      return 0;
    }

    const total = vendors.reduce(
      (sum, vendor) => sum + Number(vendor.score ?? 0),
      0
    );

    return Math.round((total / vendors.length) * 100) / 100;
  }

  get decliningCount(): number {
    const vendors = [
      ...this.lowRiskVendors,
      ...this.mediumRiskVendors,
      ...this.highRiskVendors
    ];

    return vendors.filter(
      vendor => vendor.trend?.toLowerCase() === 'declining'
    ).length;
  }

  get improvingCount(): number {
    const vendors = [
      ...this.lowRiskVendors,
      ...this.mediumRiskVendors,
      ...this.highRiskVendors
    ];

    return vendors.filter(
      vendor => vendor.trend?.toLowerCase() === 'improving'
    ).length;
  }

  get stableCount(): number {
    const vendors = [
      ...this.lowRiskVendors,
      ...this.mediumRiskVendors,
      ...this.highRiskVendors
    ];

    return vendors.filter(
      vendor =>
        !vendor.trend ||
        vendor.trend?.toLowerCase() === 'stable'
    ).length;
  }

  ngOnInit(): void {
    this.loadRiskReview();
  }

  loadRiskReview(): void {
    this.loading = true;
    this.error = '';

    const role = this.auth.currentUser()?.role;

    // ============================================================
    // VENDOR — LOAD ONLY OWN RELIABILITY DATA
    // ============================================================

    if (role === 'vendor') {
      this.http
        .get<any>(`${this.api}/analytics/vendor-dashboard/me`)
        .subscribe({
          next: (data) => {
            console.log('Vendor reliability data:', data);

            const reliability = data?.reliability_score;
            const vendor = data?.vendor ?? {};

            if (reliability) {
              const riskLevel =
                String(reliability.risk_level ?? 'medium')
                  .toLowerCase();

              const bucket =
                riskLevel === 'low'
                  ? 'low'
                  : riskLevel === 'high' ||
                      riskLevel === 'critical'
                    ? 'high'
                    : 'medium';

              this.riskData = {
                risk_buckets: {
                  low:
                    bucket === 'low'
                      ? [
                          {
                            vendor_id: vendor.id,
                            company_name:
                              vendor.company_name ?? 'Your Vendor',
                            score: reliability.score ?? 0,
                            trend:
                              reliability.trend ?? 'stable'
                          }
                        ]
                      : [],

                  medium:
                    bucket === 'medium'
                      ? [
                          {
                            vendor_id: vendor.id,
                            company_name:
                              vendor.company_name ?? 'Your Vendor',
                            score: reliability.score ?? 0,
                            trend:
                              reliability.trend ?? 'stable'
                          }
                        ]
                      : [],

                  high:
                    bucket === 'high'
                      ? [
                          {
                            vendor_id: vendor.id,
                            company_name:
                              vendor.company_name ?? 'Your Vendor',
                            score: reliability.score ?? 0,
                            trend:
                              reliability.trend ?? 'stable'
                          }
                        ]
                      : []
                },

                alerts: []
              };
            } else {
              this.riskData = {
                risk_buckets: {
                  low: [],
                  medium: [],
                  high: []
                },
                alerts: []
              };
            }

            this.loading = false;
          },

          error: (error) => {
            console.error(
              'Vendor reliability error:',
              error
            );

            this.error =
              'Failed to load vendor reliability information.';

            this.loading = false;
          }
        });

      return;
    }

    // ============================================================
    // INTERNAL USERS / AUDITOR
    // ============================================================

    this.http
      .get<any>(
        `${this.api}/analytics/vendor-risk-dashboard`
      )
      .subscribe({
        next: (data) => {
          console.log(
            'Vendor risk dashboard:',
            data
          );

          this.riskData = data;
          this.loading = false;
        },

        error: (error) => {
          console.error(
            'Risk review error:',
            error
          );

          this.error =
            'Failed to load vendor risk information.';

          this.loading = false;
        }
      });
  }

  scoreClass(score: number): string {
    if (score >= 80) {
      return 'text-success';
    }

    if (score >= 60) {
      return 'text-warning';
    }

    return 'text-danger';
  }

  riskClass(risk: string): string {
    switch (risk?.toLowerCase()) {
      case 'low':
        return 'text-success';

      case 'medium':
        return 'text-warning';

      case 'high':
      case 'critical':
        return 'text-danger';

      default:
        return '';
    }
  }
    riskPercentage(count: number): number {
    const total = this.totalRiskVendors;

    if (!total) {
      return 0;
    }

    return Math.round((count / total) * 100);
  }

  trendClass(trend: string): string {
    switch (trend?.toLowerCase()) {
      case 'improving':
        return 'text-success';

      case 'declining':
        return 'text-danger';

      case 'stable':
        return 'text-warning';

      default:
        return '';
    }
  }
}