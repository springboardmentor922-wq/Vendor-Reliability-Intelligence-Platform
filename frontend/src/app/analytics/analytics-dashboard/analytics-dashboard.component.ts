import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Vendor {
  id: number;
  vendor_name: string;
  status: string;
  is_active: boolean;
}

interface PurchaseOrder {
  id: number;
  total_amount: number;
  status: string;
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
imports: [CommonModule, FormsModule],

  template: `
    <div class="container-fluid p-4">

      <h1>Analytics Dashboard</h1>
      <p class="subtitle">Vendor and procurement analytics</p>

      <!-- KPI CARDS -->
      <div class="row g-3 mt-3">

        <div class="col-md-3">
          <div class="card kpi-card p-4 text-center">
            <h2>{{ totalVendors }}</h2>
            <p>Total Vendors</p>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card kpi-card p-4 text-center">
            <h2>{{ activeVendors }}</h2>
            <p>Active Vendors</p>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card kpi-card p-4 text-center">
            <h2>{{ totalOrders }}</h2>
            <p>Purchase Orders</p>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card kpi-card p-4 text-center">
            <h2>₹{{ totalProcurement | number:'1.0-0' }}</h2>
            <p>Total Procurement</p>
          </div>
        </div>

      </div>

      <!-- SEARCH -->
      <div class="card search-card p-3 mt-4">
        <input
          type="text"
          class="form-control"
          placeholder="Search vendors..."
          [(ngModel)]="searchText"
          (input)="filterVendors()">
      </div>

      <!-- GRAPHS -->
      <div class="row g-4 mt-1">

        <!-- Vendor Status Graph -->
        <div class="col-md-6">
          <div class="card chart-card p-4">
            <h3>Vendor Status</h3>

            <div class="bar-row">
              <span>Active</span>
              <div class="bar-container">
                <div
                  class="bar active-bar"
                  [style.width.%]="getBarWidth(activeVendors, totalVendors)">
                ></div>
              </div>
              <strong>{{ activeVendors }}</strong>
            </div>

            <div class="bar-row">
              <span>Inactive</span>
              <div class="bar-container">
                <div
                  class="bar inactive-bar"
                  [style.width.%]="getBarWidth(inactiveVendors, totalVendors)">
                ></div>
              </div>
              <strong>{{ inactiveVendors }}</strong>
            </div>

          </div>
        </div>

        <!-- Purchase Order Status Graph -->
        <div class="col-md-6">
          <div class="card chart-card p-4">
            <h3>Purchase Order Status</h3>

            <div class="bar-row">
              <span>Pending</span>
              <div class="bar-container">
                <div
                  class="bar pending-bar"
                  [style.width.%]="getBarWidth(pendingOrders, totalOrders)">
                ></div>
              </div>
              <strong>{{ pendingOrders }}</strong>
            </div>

            <div class="bar-row">
              <span>Approved</span>
              <div class="bar-container">
                <div
                  class="bar approved-bar"
                  [style.width.%]="getBarWidth(approvedOrders, totalOrders)">
                ></div>
              </div>
              <strong>{{ approvedOrders }}</strong>
            </div>

            <div class="bar-row">
              <span>Ordered</span>
              <div class="bar-container">
                <div
                  class="bar ordered-bar"
                  [style.width.%]="getBarWidth(orderedOrders, totalOrders)">
                ></div>
              </div>
              <strong>{{ orderedOrders }}</strong>
            </div>

            <div class="bar-row">
              <span>Delivered</span>
              <div class="bar-container">
                <div
                  class="bar delivered-bar"
                  [style.width.%]="getBarWidth(deliveredOrders, totalOrders)">
                ></div>
              </div>
              <strong>{{ deliveredOrders }}</strong>
            </div>

            <div class="bar-row">
              <span>Completed</span>
              <div class="bar-container">
                <div
                  class="bar completed-bar"
                  [style.width.%]="getBarWidth(completedOrders, totalOrders)">
                ></div>
              </div>
              <strong>{{ completedOrders }}</strong>
            </div>

          </div>
        </div>

      </div>

      <!-- VENDOR SEARCH RESULTS -->
      <div class="card table-card p-4 mt-4">

        <h3>Vendor Analytics</h3>

        <table class="table table-hover mt-3">

          <thead>
            <tr>
              <th>ID</th>
              <th>Vendor Name</th>
              <th>Status</th>
              <th>Active</th>
            </tr>
          </thead>

          <tbody>

            <tr *ngFor="let vendor of filteredVendors">

              <td>{{ vendor.id }}</td>

              <td>{{ vendor.vendor_name }}</td>

              <td>{{ vendor.status }}</td>

              <td>
                {{ vendor.is_active ? 'Yes' : 'No' }}
              </td>

            </tr>

            <tr *ngIf="filteredVendors.length === 0">
              <td colspan="4" class="text-center">
                No vendors found
              </td>
            </tr>

          </tbody>

        </table>

      </div>

    </div>
  `,

  styles: [`

    h1 {
      color: #222;
      font-weight: 700;
    }

    .subtitle {
      color: #666;
    }

    .card {
      background: white;
      border-radius: 12px;
      border: 1px solid #e5e5e5;
    }

    .kpi-card {
      min-height: 130px;
    }

    .card h2 {
      color: #222;
      font-weight: 700;
    }

    .card p {
      color: #666;
      margin-bottom: 0;
    }

    .search-card {
      background: white;
    }

    .chart-card h3,
    .table-card h3 {
      color: #222;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 90px 1fr 40px;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
    }

    .bar-row span {
      color: #444;
      font-size: 14px;
    }

    .bar-container {
      height: 18px;
      background: #eeeeee;
      border-radius: 10px;
      overflow: hidden;
    }

    .bar {
      height: 100%;
      min-width: 2px;
      border-radius: 10px;
    }

    .active-bar {
      background: #28a745;
    }

    .inactive-bar {
      background: #dc3545;
    }

    .pending-bar {
      background: #ffc107;
    }

    .approved-bar {
      background: #17a2b8;
    }

    .ordered-bar {
      background: #007bff;
    }

    .delivered-bar {
      background: #6f42c1;
    }

    .completed-bar {
      background: #28a745;
    }

    table {
      color: #222;
    }

    th {
      font-weight: 600;
    }

  `]
})

export class AnalyticsDashboardComponent implements OnInit {

  totalVendors = 0;
  activeVendors = 0;
  inactiveVendors = 0;

  totalOrders = 0;
  totalProcurement = 0;

  pendingOrders = 0;
  approvedOrders = 0;
  orderedOrders = 0;
  deliveredOrders = 0;
  completedOrders = 0;

  vendors: Vendor[] = [];
  filteredVendors: Vendor[] = [];

  searchText = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {

    this.http.get<Vendor[]>(
      'http://localhost:8000/api/vendors/'
    ).subscribe({
      next: (vendors) => {

        this.vendors = vendors;

        this.totalVendors = vendors.length;

        this.activeVendors = vendors.filter(
          vendor => vendor.is_active !== false
        ).length;

        this.inactiveVendors =
          this.totalVendors - this.activeVendors;

        this.filteredVendors = vendors;

      },

      error: (error) => {
        console.error('Error loading vendors:', error);
      }
    });


    this.http.get<PurchaseOrder[]>(
      'http://localhost:8000/api/purchase-orders/'
    ).subscribe({
      next: (orders) => {

        this.totalOrders = orders.length;

        this.totalProcurement = orders.reduce(
          (total, order) =>
            total + (order.total_amount || 0),
          0
        );

        this.pendingOrders = this.countStatus(orders, 'PENDING');
        this.approvedOrders = this.countStatus(orders, 'APPROVED');
        this.orderedOrders = this.countStatus(orders, 'ORDERED');
        this.deliveredOrders = this.countStatus(orders, 'DELIVERED');
        this.completedOrders = this.countStatus(orders, 'COMPLETED');

      },

      error: (error) => {
        console.error('Error loading purchase orders:', error);
      }
    });

  }

  countStatus(
    orders: PurchaseOrder[],
    status: string
  ): number {

    return orders.filter(
      order => order.status === status
    ).length;

  }

  getBarWidth(
    value: number,
    total: number
  ): number {

    if (total === 0) {
      return 0;
    }

    return (value / total) * 100;

  }

  filterVendors(): void {

    const search = this.searchText
      .toLowerCase()
      .trim();

    this.filteredVendors = this.vendors.filter(
      vendor =>
        vendor.vendor_name
          .toLowerCase()
          .includes(search) ||
        vendor.status
          .toLowerCase()
          .includes(search)
    );

  }

}