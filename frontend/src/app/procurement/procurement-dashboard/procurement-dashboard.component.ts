import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Procurement {
  id: number;
  item_name: string;
  department: string;
  quantity: number;
  estimated_cost: number;
  vendor_id?: number;
  status: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  invoice_number?: string;
  invoice_amount?: number;
  invoice_status?: string;
  created_at: string;
}

@Component({
  selector: 'app-procurement-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],

  template: `
    <div class="container-fluid p-4">

      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Procurement Dashboard</h1>
          <p>Manage procurement requests and workflow</p>
        </div>

        <button class="btn btn-primary" (click)="showForm = true">
          Add Procurement
        </button>
      </div>

      <!-- ADD PROCUREMENT -->
      <div class="card p-4 mb-4" *ngIf="showForm">

        <h2>Add Procurement Request</h2>

        <div class="row g-3">

          <div class="col-md-6">
            <label>Item Name</label>
            <input
              class="form-control"
              [(ngModel)]="form.item_name">
          </div>

          <div class="col-md-6">
            <label>Department</label>
            <input
              class="form-control"
              [(ngModel)]="form.department">
          </div>

          <div class="col-md-6">
            <label>Quantity</label>
            <input
              type="number"
              class="form-control"
              [(ngModel)]="form.quantity">
          </div>

          <div class="col-md-6">
            <label>Estimated Cost</label>
            <input
              type="number"
              class="form-control"
              [(ngModel)]="form.estimated_cost">
          </div>

        </div>

        <div class="mt-3">

          <button
            class="btn btn-success me-2"
            (click)="saveProcurement()">
            Save
          </button>

          <button
            class="btn btn-secondary"
            (click)="showForm = false">
            Cancel
          </button>

        </div>

      </div>

      <!-- PROCUREMENT TABLE -->
      <div class="card p-4">

        <div class="d-flex justify-content-between mb-3">
          <h2>Procurement Requests</h2>

          <button
            class="btn btn-outline-primary"
            (click)="loadProcurements()">
            Refresh
          </button>
        </div>

        <div *ngIf="procurements.length === 0">
          No procurement requests found.
        </div>

        <div
          class="table-responsive"
          *ngIf="procurements.length > 0">

          <table class="table table-dark table-hover">

           <thead>
  <tr>
    <th>ID</th>
    <th>Item</th>
    <th>Department</th>
    <th>Quantity</th>
    <th>Estimated Cost</th>
    <th>Vendor</th>
    <th>Status</th>
    <th>Workflow</th>
  </tr>
</thead>
            <tbody>

              <tr *ngFor="let item of procurements">

                <td>{{ item.id }}</td>

                <td>{{ item.item_name }}</td>

                <td>{{ item.department }}</td>

                <td>{{ item.quantity }}</td>

                <td>
                  ₹{{ item.estimated_cost }}
                </td>
                 
                 <td>
                   {{ item.vendor_id || 'Not Assigned' }}
                 </td>

                <td>
                  <span
                    class="badge"
                    [ngClass]="getStatusClass(item.status)">
                    {{ item.status }}
                  </span>
                </td>

                <td>

                  <!-- APPROVE -->
                  <button
                    *ngIf="item.status === 'PENDING'"
                    class="btn btn-sm btn-success me-1"
                    (click)="approveProcurement(item.id)">
                    Approve
                  </button>

                  <!-- ORDER -->
                  <button
                    *ngIf="item.status === 'APPROVED'"
                    class="btn btn-sm btn-primary me-1"
                    (click)="orderProcurement(item.id)">
                    Order
                  </button>

                  <!-- DELIVER -->
                  <button
                    *ngIf="item.status === 'ORDERED'"
                    class="btn btn-sm btn-info me-1"
                    (click)="deliverProcurement(item.id)">
                    Deliver
                  </button>

                 <!-- INVOICE -->
                   <button
                      *ngIf="item.status === 'DELIVERED'"
                       class="btn btn-sm btn-warning me-1"
                          (click)="addInvoice(item.id)">
                            Invoice
                       </button>

                <!-- COMPLETE -->
                       <button
                       *ngIf="item.status === 'DELIVERED' && item.invoice_status === 'PAID'"
                           class="btn btn-sm btn-success me-1"
                         (click)="completeProcurement(item.id)">
                       Complete
                       </button>

                  <!-- CANCEL -->
                  <button
                    *ngIf="
                      item.status !== 'COMPLETED' &&
                      item.status !== 'CANCELLED'
                    "
                    class="btn btn-sm btn-danger"
                    (click)="cancelProcurement(item.id)">
                    Cancel
                  </button>

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

    .btn-info {
      color: white;
    }
  `]
})

export class ProcurementDashboardComponent implements OnInit {

  procurements: Procurement[] = [];

  showForm = false;

  form = {
    item_name: '',
    department: '',
    quantity: 1,
    estimated_cost: 0
  };

  private apiUrl =
    'http://localhost:8000/api/procurements/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProcurements();
  }

  // ---------------------------------------------------------
  // LOAD PROCUREMENT REQUESTS
  // ---------------------------------------------------------
  loadProcurements(): void {

    this.http
      .get<Procurement[]>(this.apiUrl)
      .subscribe({

        next: (data) => {
          this.procurements = data;
        },

        error: (error) => {
          console.error(
            'Failed to load procurements:',
            error
          );
        }

      });
  }

  // ---------------------------------------------------------
  // SAVE PROCUREMENT
  // ---------------------------------------------------------
  saveProcurement(): void {

    this.http.post(
      this.apiUrl,
      null,
      {
        params: {
          item_name: this.form.item_name,
          department: this.form.department,
          quantity: this.form.quantity.toString(),
          estimated_cost:
            this.form.estimated_cost.toString()
        }
      }
    )
    .subscribe({

      next: () => {

        alert(
          'Procurement request added successfully'
        );

        this.showForm = false;

        this.form = {
          item_name: '',
          department: '',
          quantity: 1,
          estimated_cost: 0
        };

        this.loadProcurements();
      },

      error: (error) => {

        console.error(
          'Failed to add procurement:',
          error
        );

        alert(
          error?.error?.detail ||
          'Failed to add procurement request'
        );
      }

    });
  }

  // ---------------------------------------------------------
  // APPROVE
  // ---------------------------------------------------------
  approveProcurement(id: number): void {

    this.http
      .put(
        `${this.apiUrl}${id}/approve`,
        null
      )
      .subscribe({

        next: () => {
          alert(
            'Procurement approved successfully'
          );
          this.loadProcurements();
        },

        error: (error) => {
          console.error(error);

          alert(
            error?.error?.detail ||
            'Failed to approve procurement'
          );
        }

      });
  }

  // ---------------------------------------------------------
  // ORDER
  // ---------------------------------------------------------
  orderProcurement(id: number): void {

  const vendorId = prompt('Enter Active Vendor ID:');

  if (!vendorId) {
    return;
  }

  this.http
    .put(
      `${this.apiUrl}${id}/order?vendor_id=${vendorId}`,
      null
    )
    .subscribe({

      next: () => {
        alert(
          'Procurement ordered and vendor assigned successfully'
        );
        this.loadProcurements();
      },

      error: (error) => {
        console.error(error);

        alert(
          error?.error?.detail ||
          'Failed to order procurement'
        );
      }

    });
}
  // ---------------------------------------------------------
  // DELIVER
  // ---------------------------------------------------------
  deliverProcurement(id: number): void {

    this.http
      .put(
        `${this.apiUrl}${id}/deliver`,
        null
      )
      .subscribe({

        next: () => {
          alert(
            'Procurement marked as delivered'
          );
          this.loadProcurements();
        },

        error: (error) => {
          console.error(error);

          alert(
            error?.error?.detail ||
            'Failed to mark procurement as delivered'
          );
        }

      });
  }

  // ---------------------------------------------------------
  // COMPLETE
  // ---------------------------------------------------------
  completeProcurement(id: number): void {

    this.http
      .put(
        `${this.apiUrl}${id}/complete`,
        null
      )
      .subscribe({

        next: () => {
          alert(
            'Procurement completed successfully'
          );
          this.loadProcurements();
        },

        error: (error) => {
          console.error(error);

          alert(
            error?.error?.detail ||
            'Failed to complete procurement'
          );
        }

      });
  }
// ---------------------------------------------------------
// INVOICE
// ---------------------------------------------------------
addInvoice(id: number): void {

  const invoiceNumber = prompt('Enter Invoice Number:');

  if (!invoiceNumber) {
    return;
  }

  const invoiceAmount = prompt('Enter Invoice Amount:');

  if (!invoiceAmount) {
    return;
  }

  this.http
    .put(
      `${this.apiUrl}${id}/invoice?invoice_number=${encodeURIComponent(invoiceNumber)}&invoice_amount=${invoiceAmount}&invoice_status=PAID`,
      null
    )
    .subscribe({

      next: () => {
        alert(
          'Invoice added successfully'
        );
        this.loadProcurements();
      },

      error: (error) => {
        console.error(error);

        alert(
          error?.error?.detail ||
          'Failed to add invoice'
        );
      }

    });
}

  // ---------------------------------------------------------
  // CANCEL
  // ---------------------------------------------------------
  cancelProcurement(id: number): void {

    if (
      !confirm(
        'Are you sure you want to cancel this procurement?'
      )
    ) {
      return;
    }

    this.http
      .put(
        `${this.apiUrl}${id}/cancel`,
        null
      )
      .subscribe({

        next: () => {
          alert(
            'Procurement cancelled successfully'
          );
          this.loadProcurements();
        },

        error: (error) => {
          console.error(error);

          alert(
            error?.error?.detail ||
            'Failed to cancel procurement'
          );
        }

      });
  }

  // ---------------------------------------------------------
  // STATUS COLOR
  // ---------------------------------------------------------
  getStatusClass(status: string): string {

    switch (status) {

      case 'PENDING':
        return 'bg-warning text-dark';

      case 'APPROVED':
        return 'bg-primary';

      case 'ORDERED':
        return 'bg-info text-dark';

      case 'DELIVERED':
        return 'bg-success';

      case 'COMPLETED':
        return 'bg-success';

      case 'CANCELLED':
        return 'bg-danger';

      default:
        return 'bg-secondary';
    }
  }
}