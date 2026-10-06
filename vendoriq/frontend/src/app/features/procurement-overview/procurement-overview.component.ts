import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-procurement-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './procurement-overview.component.html'
})
export class ProcurementOverviewComponent implements OnInit {

  private readonly api = 'http://127.0.0.1:8000/api/v1';

  records: any[] = [];
  loading = true;
  error = '';
  selectedRequest: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProcurementOverview();
  }

  loadProcurementOverview(): void {
    this.loading = true;
    this.error = '';

    this.http
      .get<any>(`${this.api}/analytics/procurement-dashboard`)
      .subscribe({
        next: (data) => {
          this.records = data.procurement_requests ?? [];
          this.loading = false;
        },
        error: (error) => {
          console.error('Procurement overview error:', error);
          this.error = 'Failed to load procurement request records.';
          this.loading = false;
        }
      });
  }

  get totalRequests(): number {
    return this.records.length;
  }

  get pendingRequests(): number {
    return this.records.filter(
      request => request.status?.toLowerCase() === 'pending'
    ).length;
  }

  get approvedRequests(): number {
    return this.records.filter(
      request => request.status?.toLowerCase() === 'approved'
    ).length;
  }

  get completedRequests(): number {
    return this.records.filter(
      request => request.status?.toLowerCase() === 'completed'
    ).length;
  }

  get totalValue(): number {
    return this.records.reduce(
      (sum, request) => sum + Number(
        request.total_amount ??
        request.amount ??
        request.estimated_amount ??
        0
      ),
      0
    );
  }

  viewDetails(request: any): void {
    if (this.selectedRequest?.id === request.id) {
      this.selectedRequest = null;
      return;
    }

    this.selectedRequest = request;
  }

  statusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-success';

      case 'approved':
        return 'bg-primary';

      case 'ordered':
        return 'bg-info text-dark';

      case 'pending':
        return 'bg-warning text-dark';

      case 'cancelled':
        return 'bg-danger';

      case 'delivered':
        return 'bg-success';

      default:
        return 'bg-secondary';
    }
  }
}
