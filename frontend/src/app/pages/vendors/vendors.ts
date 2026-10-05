import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import {
  Vendor,
  VendorCreate,
  VendorUpdate,
  VendorService,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES
} from '../../core/services/vendor';

interface VendorForm {
  name: FormControl<string>;
  category: FormControl<string>;
  contact_person: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  location: FormControl<string>;
  contract_details: FormControl<string>;
}

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './vendors.html',
  styleUrl: './vendors.scss'
})
export class Vendors implements OnInit {
  vendors: Vendor[] = [];
  categories: string[] = [...VENDOR_CATEGORIES];
  statuses: string[] = [...VENDOR_STATUSES];

  selectedCategory = '';
  selectedStatus = '';
  searchTerm = '';

  showForm = false;
  loading = false;
  saving = false;

  editingVendorId: number | null = null;
  successMessage = '';
  errorMessage = '';

  vendorForm: FormGroup<VendorForm>;

  constructor(
    private fb: FormBuilder,
    private vendorService: VendorService
  ) {
    this.vendorForm = this.fb.nonNullable.group({
      name: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(150)
      ]],
      category: ['', Validators.required],
      contact_person: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100)
      ]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(30)
      ]],
      location: ['', Validators.maxLength(150)],
      contract_details: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadStatuses();
    this.loadVendors();
  }

  get editingVendor(): Vendor | undefined {
    return this.vendors.find(
      vendor => vendor.id === this.editingVendorId
    );
  }

  get filteredVendors(): Vendor[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.vendors;
    }

    return this.vendors.filter(vendor => {
      const searchableValues = [
        vendor.id,
        vendor.name,
        vendor.email,
        vendor.contact_person,
        vendor.location
      ];

      return searchableValues.some(value =>
        String(value ?? '').toLowerCase().includes(term)
      );
    });
  }

  get totalCount(): number {
    return this.filteredVendors.length;
  }

  get pendingCount(): number {
    return this.filteredVendors.filter(
      vendor => vendor.status.toLowerCase() === 'pending'
    ).length;
  }

  get approvedCount(): number {
    return this.filteredVendors.filter(
      vendor => vendor.status.toLowerCase() === 'approved'
    ).length;
  }

  get rejectedCount(): number {
    return this.filteredVendors.filter(
      vendor => vendor.status.toLowerCase() === 'rejected'
    ).length;
  }

  loadCategories(): void {
    this.categories = [...VENDOR_CATEGORIES];

    this.vendorService.getCategories().subscribe({
      next: response => {
        if (Array.isArray(response.categories) &&
            response.categories.length > 0) {
          this.categories = [...response.categories];
        }
      },
      error: () => {
        this.categories = [...VENDOR_CATEGORIES];
      }
    });
  }

  loadStatuses(): void {
    this.statuses = [...VENDOR_STATUSES];

    this.vendorService.getStatuses().subscribe({
      next: response => {
        if (Array.isArray(response.statuses) &&
            response.statuses.length > 0) {
          this.statuses = [...response.statuses];
        }
      },
      error: () => {
        this.statuses = [...VENDOR_STATUSES];
      }
    });
  }

  loadVendors(): void {
    this.loading = true;
    this.clearMessages();

    this.vendorService
      .getVendors(
        this.selectedCategory || undefined,
        this.selectedStatus || undefined
      )
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe({
        next: vendors => {
          this.vendors = vendors;
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to load vendors:', error);
          this.vendors = [];

          if (error.status === 401) {
            this.errorMessage =
              'Your session has expired. Please login again.';
          } else if (error.status === 0) {
            this.errorMessage =
              'Backend server is not running.';
          } else {
            this.errorMessage =
              error.error?.detail || 'Failed to load vendors.';
          }
        }
      });
  }

  applyFilters(): void {
    this.loadVendors();
  }

  clearFilters(): void {
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.searchTerm = '';
    this.loadVendors();
  }

  openCreateForm(): void {
    this.editingVendorId = null;

    this.vendorForm.reset({
      name: '',
      category: '',
      contact_person: '',
      email: '',
      phone: '',
      location: '',
      contract_details: ''
    });

    this.clearMessages();
    this.showForm = true;
  }

  openEditForm(vendor: Vendor): void {
    this.editingVendorId = vendor.id;

    this.vendorForm.reset({
      name: vendor.name ?? '',
      category: vendor.category ?? '',
      contact_person: vendor.contact_person ?? '',
      email: vendor.email ?? '',
      phone: vendor.phone ?? '',
      location: vendor.location ?? '',
      contract_details: vendor.contract_details ?? ''
    });

    this.clearMessages();
    this.showForm = true;
  }

  closeForm(): void {
    if (this.saving) {
      return;
    }

    this.showForm = false;
    this.editingVendorId = null;
    this.vendorForm.reset();
  }

  saveVendor(): void {
    this.clearMessages();

    if (this.vendorForm.invalid) {
      this.vendorForm.markAllAsTouched();
      this.errorMessage = 'Please complete all required fields correctly.';
      return;
    }

    const formValue = this.vendorForm.getRawValue();

    const vendorData: VendorCreate = {
      name: formValue.name.trim(),
      category: formValue.category,
      contact_person: formValue.contact_person.trim(),
      email: formValue.email.trim(),
      phone: formValue.phone.trim(),
      location: formValue.location.trim() || null,
      contract_details: formValue.contract_details.trim() || null
    };

    this.saving = true;

    const request = this.editingVendorId === null
      ? this.vendorService.createVendor(vendorData)
      : this.vendorService.updateVendor(
          this.editingVendorId,
          vendorData as VendorUpdate
        );

    request
      .pipe(finalize(() => {
        this.saving = false;
      }))
      .subscribe({
        next: () => {
          this.successMessage = this.editingVendorId === null
            ? 'Vendor created successfully.'
            : 'Vendor updated successfully.';

          this.showForm = false;
          this.editingVendorId = null;
          this.vendorForm.reset();
          this.loadVendors();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to save vendor:', error);
          this.errorMessage =
            error.error?.detail || 'Failed to save vendor.';
        }
      });
  }

  approveVendor(vendor: Vendor): void {
    this.changeVendorStatus(vendor, 'Approved');
  }

  rejectVendor(vendor: Vendor): void {
    this.changeVendorStatus(vendor, 'Rejected');
  }

  setPending(vendor: Vendor): void {
    this.changeVendorStatus(vendor, 'Pending');
  }

  private changeVendorStatus(
    vendor: Vendor,
    newStatus: string
  ): void {
    this.clearMessages();
    this.saving = true;

    this.vendorService
      .updateVendorStatus(vendor.id, newStatus)
      .pipe(finalize(() => {
        this.saving = false;
      }))
      .subscribe({
        next: () => {
          this.successMessage =
            `Vendor status changed to ${newStatus}.`;
          this.loadVendors();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to update vendor status:', error);
          this.errorMessage =
            error.error?.detail || 'Failed to update vendor status.';
        }
      });
  }

  deleteVendor(vendor: Vendor): void {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${vendor.name}?`
    );

    if (!confirmed) {
      return;
    }

    this.clearMessages();
    this.saving = true;

    this.vendorService
      .deleteVendor(vendor.id)
      .pipe(finalize(() => {
        this.saving = false;
      }))
      .subscribe({
        next: () => {
          this.successMessage = 'Vendor deleted successfully.';
          this.loadVendors();
        },
        error: (error: HttpErrorResponse) => {
          console.error('Failed to delete vendor:', error);
          this.errorMessage =
            error.error?.detail || 'Failed to delete vendor.';
        }
      });
  }

  formatScore(score: number | null | undefined): string {
    return score === null || score === undefined
      ? '—'
      : score.toFixed(1);
  }

  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }
}