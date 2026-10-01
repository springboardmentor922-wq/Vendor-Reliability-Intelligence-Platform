import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportsService, ReportType } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  reportTypes: { type: ReportType; label: string; icon: string }[] = [
    { type: 'vendor-performance', label: 'Vendor Performance Report', icon: 'fa-chart-line' },
    { type: 'procurement', label: 'Procurement Report', icon: 'fa-cart-shopping' },
    { type: 'purchase-orders', label: 'Purchase Order Report', icon: 'fa-file-invoice' },
    { type: 'compliance', label: 'Compliance Report', icon: 'fa-clipboard-check' },
    { type: 'contracts', label: 'Contract Report', icon: 'fa-file-contract' },
  ];

  preview: { title: string; headers: string[]; rows: any[][] } | null = null;
  loadingPreview = false;
  runningChecks = false;
  checksResult: any = null;
  emailLogs: any[] = [];
  showEmailLogs = false;

  constructor(private reportsService: ReportsService, public auth: AuthService) {}

  viewPreview(type: ReportType): void {
    this.loadingPreview = true;
    this.preview = null;
    this.reportsService.preview(type).subscribe({
      next: (p) => {
        this.preview = p;
        this.loadingPreview = false;
      },
      error: () => (this.loadingPreview = false),
    });
  }

  download(type: ReportType, format: 'xlsx' | 'pdf'): void {
    this.reportsService.download(type, format);
  }

  runChecks(): void {
    this.runningChecks = true;
    this.reportsService.runNotificationChecks().subscribe({
      next: (res) => {
        this.checksResult = res;
        this.runningChecks = false;
      },
      error: () => (this.runningChecks = false),
    });
  }

  toggleEmailLogs(): void {
    this.showEmailLogs = !this.showEmailLogs;
    if (this.showEmailLogs) {
      this.reportsService.emailLogs().subscribe((logs) => (this.emailLogs = logs));
    }
  }
}
