import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-procurement-cost-analysis',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './procurement-cost-analysis.component.html'
})
export class ProcurementCostAnalysisComponent implements OnInit {

  private readonly api = 'http://127.0.0.1:8000/api/v1';

  records: any[] = [];
  loading = true;
  error = '';
  selectedRecord: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCostAnalysis();
  }

  loadCostAnalysis(): void {
    this.loading = true;
    this.error = '';

    this.http
      .get<any>(`${this.api}/analytics/procurement-dashboard`)
      .subscribe({
        next: (data) => {
          this.records = data.procurement_cost_records ?? [];
          this.loading = false;
        },
        error: (error) => {
          console.error('Procurement cost error:', error);
          this.error = 'Failed to load procurement cost records.';
          this.loading = false;
        }
      });
  }

  get totalCost(): number {
    return this.records.reduce(
      (sum, record) => sum + Number(record.amount || 0),
      0
    );
  }

  get totalBudget(): number {
    return this.records.reduce(
      (sum, record) => sum + Number(record.budget || 0),
      0
    );
  }

  get totalVariance(): number {
    return this.records.reduce(
      (sum, record) => sum + Number(record.variance || 0),
      0
    );
  }

  viewDetails(record: any): void {
    if (this.selectedRecord?.po_id === record.po_id) {
      this.selectedRecord = null;
      return;
    }

    this.selectedRecord = record;
  }

  statusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-success';

      case 'approved':
      case 'ordered':
        return 'bg-primary';

      case 'pending':
        return 'bg-warning text-dark';

      case 'cancelled':
        return 'bg-danger';

      default:
        return 'bg-secondary';
    }
  }

  varianceClass(variance: number): string {
    if (variance > 0) {
      return 'text-danger';
    }

    if (variance < 0) {
      return 'text-success';
    }

    return 'text-muted';
  }
}
