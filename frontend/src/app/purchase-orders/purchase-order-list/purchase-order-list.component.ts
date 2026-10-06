import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_name: string;
  item_name: string;
  quantity: number;
  total_amount: number;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-purchase-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule],

  template: `
    <div class="container-fluid p-4">

      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Purchase Orders</h1>
          <p>Manage and monitor purchase orders</p>
        </div>

        <button class="btn btn-primary" (click)="showForm = true">
          Create Purchase Order
        </button>
      </div>

      <div class="card p-4 mb-4" *ngIf="showForm">

        <h2>Create Purchase Order</h2>

        <div class="row g-3">

          <div class="col-md-6">
            <label>PO Number</label>
            <input class="form-control"
              [(ngModel)]="form.po_number">
          </div>

          <div class="col-md-6">
            <label>Vendor Name</label>
            <input class="form-control"
              [(ngModel)]="form.vendor_name">
          </div>

          <div class="col-md-6">
            <label>Item Name</label>
            <input class="form-control"
              [(ngModel)]="form.item_name">
          </div>

          <div class="col-md-6">
            <label>Quantity</label>
            <input type="number" class="form-control"
              [(ngModel)]="form.quantity">
          </div>

          <div class="col-md-6">
            <label>Total Amount</label>
            <input type="number" class="form-control"
              [(ngModel)]="form.total_amount">
          </div>

        </div>

        <div class="mt-3">

          <button class="btn btn-success me-2"
            (click)="savePurchaseOrder()">
            Save
          </button>

          <button class="btn btn-secondary"
            (click)="showForm = false">
            Cancel
          </button>

        </div>

      </div>

      <div class="card p-4">

        <div class="d-flex justify-content-between mb-3">
          <h2>Purchase Order List</h2>

          <button class="btn btn-outline-primary"
            (click)="loadPurchaseOrders()">
            Refresh
          </button>
        </div>

        <div *ngIf="purchaseOrders.length === 0">
          No purchase orders found.
        </div>

        <div class="table-responsive"
          *ngIf="purchaseOrders.length > 0">

          <table class="table table-dark table-hover">

            <thead>
              <tr>
                <th>ID</th>
                <th>PO Number</th>
                <th>Vendor</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Total Amount</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              <tr *ngFor="let po of purchaseOrders">

                <td>{{ po.id }}</td>
                <td>{{ po.po_number }}</td>
                <td>{{ po.vendor_name }}</td>
                <td>{{ po.item_name }}</td>
                <td>{{ po.quantity }}</td>
                <td>₹{{ po.total_amount }}</td>

                <td>
                  <span class="badge bg-warning text-dark">
                    {{ po.status }}
                  </span>
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

    </div>
  `,

  styles: [`
    h1 {
      color: white;
      font-weight: 700;
    }

    p {
      color: #888;
    }

    .card {
      background: white;
      border-radius: 12px;
    }

    label {
      color: #333;
      display: block;
      margin-bottom: 5px;
    }
  `]
})

export class PurchaseOrderListComponent implements OnInit {

  purchaseOrders: PurchaseOrder[] = [];

  showForm = false;

  form = {
    po_number: '',
    vendor_name: '',
    item_name: '',
    quantity: 1,
    total_amount: 0
  };

  private apiUrl = 'http://localhost:8000/api/purchase-orders/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadPurchaseOrders();
  }

  loadPurchaseOrders(): void {

    this.http.get<PurchaseOrder[]>(this.apiUrl).subscribe({

      next: (data) => {
        this.purchaseOrders = data;
      },

      error: (error) => {
        console.error('Failed to load purchase orders:', error);
      }

    });
  }

  savePurchaseOrder(): void {

    this.http.post(
      this.apiUrl,
      null,
      {
        params: {
          po_number: this.form.po_number,
          vendor_name: this.form.vendor_name,
          item_name: this.form.item_name,
          quantity: this.form.quantity.toString(),
          total_amount: this.form.total_amount.toString()
        }
      }
    ).subscribe({

      next: () => {

        alert('Purchase Order created successfully');

        this.showForm = false;

        this.form = {
          po_number: '',
          vendor_name: '',
          item_name: '',
          quantity: 1,
          total_amount: 0
        };

        this.loadPurchaseOrders();
      },

      error: (error) => {

        console.error('Failed to create purchase order:', error);

        alert('Failed to create Purchase Order');
      }

    });
  }
}