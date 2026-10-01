import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

@Component({
  selector: 'app-milestone3',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './milestone3.component.html',
})
export class Milestone3Component implements OnInit {
    
  private readonly api = 'http://127.0.0.1:8000/api/v1';

  readonly secureNetId =
    'fcde1124-5053-41c6-a4c7-f4c8cd8eb5ac';

  performance: any = null;
  reliability: any = null;
  riskSummary: any = null;
  analytics: any = null;
  procurementAnalytics: any = null;
  notifications: any = null;

  loading = true;
  error = '';
  isNotificationResult(): boolean {
    return this.notifications && !Array.isArray(this.notifications);
  }

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadMilestone3();
  }

  loadMilestone3(): void {
    this.loading = true;
    this.error = '';

    this.http
      .get<any>(
        `${this.api}/performance/vendors/${this.secureNetId}/metrics`
      )
      .subscribe({
        next: (data) => (this.performance = data),
        error: () => (this.error = 'Failed to load performance metrics.'),
      });

    this.http
      .get<any>(
        `${this.api}/reliability/vendors/${this.secureNetId}`
      )
      .subscribe({
        next: (data) => (this.reliability = data),
        error: () => (this.reliability = null),
      });

    this.http
      .get<any>(`${this.api}/reliability/risk-summary`)
      .subscribe({
        next: (data) => (this.riskSummary = data),
        error: () => (this.riskSummary = null),
      });

    this.http
      .get<any>(`${this.api}/analytics/admin-dashboard`)
      .subscribe({
        next: (data) => (this.analytics = data),
        error: () => (this.analytics = null),
      });

    this.http
      .get<any>(`${this.api}/analytics/procurement-analytics`)
      .subscribe({
        next: (data) => {
          this.procurementAnalytics = data;
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load procurement analytics.';
          this.loading = false;
        },
      });

    this.http
      .get<any>(`${this.api}/notifications/email-logs`)
      .subscribe({
        next: (data) => (this.notifications = data),
        error: () => (this.notifications = []),
      });
  }

  runNotificationChecks(): void {
    this.http
      .post<any>(`${this.api}/notifications/run-checks`, {})
      .subscribe({
        next: (data) => {
          this.notifications = data;
        },
        error: () => {
          this.error = 'Notification check failed.';
        },
      });
  }

  downloadReport(type: string, format: 'xlsx' | 'pdf'): void {
    const url = `${this.api}/reports/${type}`;

    let params = new HttpParams().set('format', format);

    if (type === 'vendor-performance') {
      params = params.set('vendor_id', this.secureNetId);
    }

    this.http
      .get(url, {
        params,
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const extension = format;
          const filename = `${type}.${extension}`;

          const objectUrl = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');

          anchor.href = objectUrl;
          anchor.download = filename;
          anchor.click();

          window.URL.revokeObjectURL(objectUrl);
        },
        error: () => {
          this.error = `Could not download ${type} report.`;
        },
      });
  }
}
