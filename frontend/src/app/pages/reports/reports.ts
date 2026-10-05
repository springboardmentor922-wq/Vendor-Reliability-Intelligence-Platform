import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  ReportsService,
  VendorPerformanceReport,
  ProcurementReport,
  PurchaseOrderReport,
  ComplianceReport,
  ContractReport
} from '../../core/services/reports';


type ReportType =
  | 'vendor-performance'
  | 'procurement'
  | 'purchase-orders'
  | 'compliance'
  | 'contracts';


@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports implements OnInit {

  activeReport: ReportType = 'vendor-performance';

  loading = true;
  errorMessage = '';

  vendorPerformance: VendorPerformanceReport[] = [];
  procurement: ProcurementReport | null = null;
  purchaseOrders: PurchaseOrderReport[] = [];
  compliance: ComplianceReport[] = [];
  contracts: ContractReport[] = [];

  constructor(
    private reportsService: ReportsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  setReport(report: ReportType): void {
    this.activeReport = report;
    this.loadReport();
  }

  loadReport(): void {

    this.loading = true;
    this.errorMessage = '';

    switch (this.activeReport) {

      case 'vendor-performance':
        this.reportsService.getVendorPerformance()
          .subscribe({
            next: data => {
              this.vendorPerformance = data.map(item => ({
                ...item,
                quality_rating:
                  item.quality_rating !== null
                    ? Number(item.quality_rating)
                    : null,
                service_rating:
                  item.service_rating !== null
                    ? Number(item.service_rating)
                    : null,
                response_time_hours:
                  item.response_time_hours !== null
                    ? Number(item.response_time_hours)
                    : null,
                issue_resolution_time_hours:
                  item.issue_resolution_time_hours !== null
                    ? Number(item.issue_resolution_time_hours)
                    : null,
                order_completion_rate:
                  Number(item.order_completion_rate),
                performance_score:
                  Number(item.performance_score)
              }));

              this.finishLoading();
            },
            error: error => this.handleError(error)
          });
        break;


      case 'procurement':
        this.reportsService.getProcurement()
          .subscribe({
            next: data => {
              this.procurement = {
                ...data,
                total_procurement_cost:
                  Number(data.total_procurement_cost),
                average_order_value:
                  Number(data.average_order_value)
              };

              this.finishLoading();
            },
            error: error => this.handleError(error)
          });
        break;


      case 'purchase-orders':
        this.reportsService.getPurchaseOrders()
          .subscribe({
            next: data => {
              this.purchaseOrders = data.map(item => ({
                ...item,
                subtotal: Number(item.subtotal),
                tax_amount: Number(item.tax_amount),
                total_amount: Number(item.total_amount)
              }));

              this.finishLoading();
            },
            error: error => this.handleError(error)
          });
        break;


      case 'compliance':
        this.reportsService.getCompliance()
          .subscribe({
            next: data => {
              this.compliance = data.map(item => ({
                ...item,
                contract_value:
                  Number(item.contract_value)
              }));

              this.finishLoading();
            },
            error: error => this.handleError(error)
          });
        break;


      case 'contracts':
        this.reportsService.getContracts()
          .subscribe({
            next: data => {
              this.contracts = data.map(item => ({
                ...item,
                contract_value:
                  Number(item.contract_value)
              }));

              this.finishLoading();
            },
            error: error => this.handleError(error)
          });
        break;
    }
  }

  private finishLoading(): void {
    this.loading = false;
    this.cdr.detectChanges();
  }

  private handleError(error: unknown): void {
    console.error(
      'Report loading failed:',
      error
    );

    this.errorMessage =
      'Unable to load the selected report.';

    this.loading = false;
    this.cdr.detectChanges();
  }

  downloadPdf(): void {

    this.reportsService
      .downloadPdf(this.activeReport)
      .subscribe({
        next: blob => {
          this.saveFile(
            blob,
            `${this.activeReport}-report.pdf`
          );
        },
        error: error => {
          console.error(
            'PDF download failed:',
            error
          );
        }
      });
  }

  downloadExcel(): void {

    this.reportsService
      .downloadExcel(this.activeReport)
      .subscribe({
        next: blob => {
          this.saveFile(
            blob,
            `${this.activeReport}-report.xlsx`
          );
        },
        error: error => {
          console.error(
            'Excel download failed:',
            error
          );
        }
      });
  }

  private saveFile(
    blob: Blob,
    filename: string
  ): void {

    const url =
      window.URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);

    anchor.click();

    document.body.removeChild(anchor);

    window.URL.revokeObjectURL(url);
  }
}