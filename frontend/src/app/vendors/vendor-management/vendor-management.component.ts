import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Vendor {
  id: number;
  vendor_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: string;
  is_active: boolean;
}

@Component({
  selector: 'app-vendor-management',
  standalone: true,
  imports: [CommonModule, FormsModule],

  template: `
    <div class="container-fluid p-4">

      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="text-white">Vendor Management</h1>
          <p class="text-muted">
            Manage and monitor registered vendors
          </p>
        </div>

        <button
  *ngIf="userRole === 'ADMINISTRATOR' || userRole === 'PROCUREMENT_MANAGER'"
  class="btn btn-primary"
  (click)="openAddForm()">
  Add Vendor
</button>
      </div>

      <!-- Add / Edit Form -->
      <div class="card p-4 mb-4" *ngIf="showForm">

        <h2 class="h5 mb-3">
          {{ editingVendorId ? 'Edit Vendor' : 'Add New Vendor' }}
        </h2>

        <div class="row g-3">

          <div class="col-md-6">
            <label>Vendor Name</label>
            <input
              class="form-control"
              [(ngModel)]="formVendor.vendor_name">
          </div>

          <div class="col-md-6">
            <label>Email</label>
            <input
              class="form-control"
              [(ngModel)]="formVendor.email">
          </div>

          <div class="col-md-6">
            <label>Contact Person</label>
            <input
              class="form-control"
              [(ngModel)]="formVendor.contact_person">
          </div>

          <div class="col-md-6">
            <label>Phone</label>
            <input
              class="form-control"
              [(ngModel)]="formVendor.phone">
          </div>

          <div class="col-md-6">
            <label>Address</label>
            <input
              class="form-control"
              [(ngModel)]="formVendor.address">
          </div>

          <div class="col-md-6">
            <label>Category</label>
            <input
              class="form-control"
              [(ngModel)]="formVendor.category">
          </div>

        </div>

        <div class="mt-3">

          <button
            class="btn btn-success me-2"
            (click)="saveVendor()">
            {{ editingVendorId ? 'Update Vendor' : 'Save Vendor' }}
          </button>

          <button
            class="btn btn-secondary"
            (click)="closeForm()">
            Cancel
          </button>

        </div>

      </div>

      <!-- Vendor List -->
      <div class="card p-4">

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 class="h5 m-0">Vendor Directory</h2>

          <button
            class="btn btn-outline-primary"
            (click)="loadVendors()">
            Refresh
          </button>
        </div>

        <div *ngIf="vendors.length === 0" class="text-muted">
          No vendors found.
        </div>

        <div class="table-responsive" *ngIf="vendors.length > 0">

          <table class="table table-dark table-hover">

            <thead>
              <tr>
                <th>ID</th>
                <th>Vendor Name</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              <tr *ngFor="let vendor of vendors">

                <td>{{ vendor.id }}</td>
                <td>{{ vendor.vendor_name }}</td>
                <td>{{ vendor.contact_person }}</td>
                <td>{{ vendor.email }}</td>
                <td>{{ vendor.phone }}</td>
                <td>{{ vendor.category }}</td>

                <td>
                  <span class="badge bg-success">
                    {{ vendor.status }}
                  </span>
                </td>

                <td>

                  <button
  *ngIf="userRole === 'ADMINISTRATOR' || userRole === 'PROCUREMENT_MANAGER'"
  class="btn btn-sm btn-warning me-2"
  (click)="editVendor(vendor)">
  Edit
</button>

                  <button
  *ngIf="userRole === 'ADMINISTRATOR'"
  class="btn btn-sm btn-danger"
  (click)="deleteVendor(vendor.id)">
  Delete
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
    label {
      color: #333;
      margin-bottom: 5px;
      display: block;
    }

    .card {
      background: white;
      border-radius: 12px;
    }

    h1 {
      font-weight: 700;
    }

    table {
      margin-bottom: 0;
    }
  `]
})

export class VendorManagementComponent implements OnInit {
userRole: string = '';

  vendors: Vendor[] = [];

  showForm = false;

  editingVendorId: number | null = null;

  formVendor = {
    vendor_name: '',
    email: '',
    contact_person: '',
    phone: '',
    address: '',
    category: ''
  };

  private apiUrl = 'http://localhost:8000/api/vendors/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
const user = JSON.parse(localStorage.getItem('user') || '{}');
this.userRole = user.role || '';
    this.loadVendors();
  }

  loadVendors(): void {

    this.http.get<Vendor[]>(this.apiUrl).subscribe({

      next: (data) => {
        this.vendors = data;
      },

      error: (error) => {
        console.error('Failed to load vendors:', error);
      }

    });
  }

  openAddForm(): void {

    this.editingVendorId = null;

    this.formVendor = {
      vendor_name: '',
      email: '',
      contact_person: '',
      phone: '',
      address: '',
      category: ''
    };

    this.showForm = true;
  }

  editVendor(vendor: Vendor): void {

    this.editingVendorId = vendor.id;

    this.formVendor = {
      vendor_name: vendor.vendor_name,
      email: vendor.email,
      contact_person: vendor.contact_person,
      phone: vendor.phone,
      address: vendor.address,
      category: vendor.category
    };

    this.showForm = true;
  }

  saveVendor(): void {

    if (this.editingVendorId) {

      this.http.put(
        `${this.apiUrl}${this.editingVendorId}`,
        null,
        {
          params: {
            vendor_name: this.formVendor.vendor_name,
            email: this.formVendor.email,
            contact_person: this.formVendor.contact_person,
            phone: this.formVendor.phone,
            address: this.formVendor.address,
            category: this.formVendor.category
          }
        }
      ).subscribe({

        next: () => {

          alert('Vendor updated successfully');

          this.closeForm();

          this.loadVendors();
        },

        error: (error) => {

          console.error('Failed to update vendor:', error);

          alert('Failed to update vendor');
        }

      });

    } else {

      this.http.post(
        this.apiUrl,
        null,
        {
          params: {
            vendor_name: this.formVendor.vendor_name,
            email: this.formVendor.email,
            contact_person: this.formVendor.contact_person,
            phone: this.formVendor.phone,
            address: this.formVendor.address,
            category: this.formVendor.category
          }
        }
      ).subscribe({

        next: () => {

          alert('Vendor added successfully');

          this.closeForm();

          this.loadVendors();
        },

        error: (error) => {

          console.error('Failed to add vendor:', error);

          alert('Failed to add vendor');
        }

      });
    }
  }

  closeForm(): void {

    this.showForm = false;

    this.editingVendorId = null;
  }

  deleteVendor(id: number): void {

    if (!confirm('Are you sure you want to delete this vendor?')) {
      return;
    }

    this.http.delete(`${this.apiUrl}${id}`).subscribe({

      next: () => {

        alert('Vendor deleted successfully');

        this.loadVendors();
      },

      error: (error) => {

        console.error('Failed to delete vendor:', error);

        alert('Failed to delete vendor');
      }

    });
  }
}