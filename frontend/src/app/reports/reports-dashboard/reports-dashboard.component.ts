import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Vendor {
  id: number;
  vendor_name: string;
  is_active: boolean;
}

interface PurchaseOrder {
  id: number;
  total_amount: number;
}

interface Performance {
  id: number;
  reliability_score: number;
  delivery_score: number;
}

@Component({
  selector: 'app-reports-dashboard',
  standalone: true,
  imports: [CommonModule],

  template: `
    <div class="container-fluid p-4">

      <h1>Reports Dashboard</h1>
      <p>Vendor and procurement reports</p>

      <div class="row g-3 mt-3">

        <div class="col-md-4">
          <div class="card p-4">
            <h2>Vendor Report</h2>
            <p>Total vendors: {{ totalVendors }}</p>
            <p>Active vendors: {{ activeVendors }}</p>
            <button class="btn btn-primary" (click)="viewVendorReport()">
              View Report
            </button>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card p-4">
            <h2>Procurement Report</h2>
            <p>Total orders: {{ totalOrders }}</p>
            <p>Total value: ₹{{ totalValue }}</p>
            <button class="btn btn-primary" (click)="viewProcurementReport()">
              View Report
            </button>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card p-4">
            <h2>Performance Report</h2>
            <p>Average reliability: {{ averageReliability }}%</p>
            <p>On-time delivery: {{ averageDelivery }}%</p>
            <button class="btn btn-primary" (click)="viewPerformanceReport()">
              View Report
            </button>
          </div>
        </div>

      </div>

    </div>
  `,

  styles: [`
    h1 {
      color: #1f2937;
      font-weight: 700;
    }

    p {
      color: #666;
    }

    .card {
      background: white;
      border-radius: 12px;
    }

    .card h2 {
      color: #222;
      font-size: 20px;
    }

    .btn {
      width: 100%;
      margin-top: 10px;
    }
  `]
})

export class ReportsDashboardComponent implements OnInit {

  totalVendors = 0;
  activeVendors = 0;
  totalOrders = 0;
  totalValue = 0;
  averageReliability = 0;
  averageDelivery = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {

    this.http.get<Vendor[]>(
      'http://localhost:8000/api/vendors/'
    ).subscribe(vendors => {

      this.totalVendors = vendors.length;

      this.activeVendors = vendors.filter(
        vendor => vendor.is_active !== false
      ).length;

    });

    this.http.get<PurchaseOrder[]>(
      'http://localhost:8000/api/purchase-orders/'
    ).subscribe(orders => {

      this.totalOrders = orders.length;

      this.totalValue = orders.reduce(
        (total, order) => total + order.total_amount,
        0
      );

    });

    this.http.get<Performance[]>(
      'http://localhost:8000/api/vendor-performance/'
    ).subscribe(records => {

      if (records.length > 0) {

        this.averageReliability =
          records.reduce(
            (total, record) => total + record.reliability_score,
            0
          ) / records.length;

        this.averageDelivery =
          records.reduce(
            (total, record) => total + record.delivery_score,
            0
          ) / records.length;
      }

    });
  }

  viewVendorReport(): void {
    alert(
      'Vendor Report\\n\\n' +
      'Total Vendors: ' + this.totalVendors + '\\n' +
      'Active Vendors: ' + this.activeVendors
    );
  }

  viewProcurementReport(): void {
    alert(
      'Procurement Report\\n\\n' +
      'Total Orders: ' + this.totalOrders + '\\n' +
      'Total Value: ₹' + this.totalValue
    );
  }

  viewPerformanceReport(): void {
    alert(
      'Performance Report\\n\\n' +
      'Average Reliability: ' + this.averageReliability.toFixed(2) + '%\\n' +
      'On-time Delivery: ' + this.averageDelivery.toFixed(2) + '%'
    );
  }

}