import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-delivery-status',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './delivery-status.component.html'
})
export class DeliveryStatusComponent implements OnInit {

  private readonly api = 'http://127.0.0.1:8000/api/v1';

  records: any[] = [];
  loading = true;
  error = '';
  selectedRecord: any = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDeliveryStatus();
  }

  loadDeliveryStatus(): void {
    this.loading = true;
    this.error = '';

    this.http
      .get<any>(`${this.api}/analytics/procurement-dashboard`)
      .subscribe({
        next: (data) => {
          this.records = data.delivery_records ?? [];
          this.loading = false;
        },
        error: (error) => {
          console.error('Delivery status error:', error);
          this.error = 'Failed to load delivery status records.';
          this.loading = false;
        }
      });
  }

  get totalDeliveries(): number {
    return this.records.length;
  }

  get onTimeDeliveries(): number {
    return this.records.filter(
      record => !record.is_delayed && record.actual_delivery_date
    ).length;
  }

  get delayedDeliveries(): number {
    return this.records.filter(
      record => record.is_delayed
    ).length;
  }

  get pendingDeliveries(): number {
    return this.records.filter(
      record => !record.actual_delivery_date
    ).length;
  }

  get deliveryRate(): number {
    if (!this.records.length) return 0;

    return Number(
      ((this.onTimeDeliveries / this.records.length) * 100).toFixed(1)
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

      case 'ordered':
      case 'approved':
        return 'bg-primary';

      case 'pending':
        return 'bg-warning text-dark';

      case 'cancelled':
        return 'bg-danger';

      default:
        return 'bg-secondary';
    }
  }

  deliveryClass(record: any): string {
    if (record.is_delayed) {
      return 'text-danger';
    }

    if (record.actual_delivery_date) {
      return 'text-success';
    }

    return 'text-warning';
  }

  deliveryLabel(record: any): string {
    if (record.is_delayed) {
      return 'Delayed';
    }

    if (record.actual_delivery_date) {
      return 'On Time';
    }

    return 'Pending';
  }
}
