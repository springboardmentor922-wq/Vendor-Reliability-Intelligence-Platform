import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';
import { Vendor, VendorCategory, VendorStatus } from '../../core/models/models';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './vendors.component.html',
})
export class VendorsComponent implements OnInit {
  private fb = inject(FormBuilder);
  vendors: Vendor[] = [];
  loading = true;
  error = '';
  showForm = false;
  submitting = false;
  selectedVendor: Vendor | null = null;

  categoryFilter = '';
  statusFilter = '';
  search = '';

  categories: { value: VendorCategory; label: string }[] = [
    { value: 'raw_material_suppliers', label: 'Raw Material Suppliers' },
    { value: 'equipment_vendors', label: 'Equipment Vendors' },
    { value: 'it_vendors', label: 'IT Vendors' },
    { value: 'service_providers', label: 'Service Providers' },
    { value: 'logistics_partners', label: 'Logistics Partners' },
    { value: 'maintenance_vendors', label: 'Maintenance Vendors' },
  ];

  statuses: VendorStatus[] = ['pending', 'approved', 'rejected', 'suspended', 'active', 'inactive'];

  form = this.fb.group({
    company_name: ['', Validators.required],
    category: ['raw_material_suppliers' as VendorCategory, Validators.required],
    registration_number: [''],
    tax_id: [''],
    contact_person: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: [''],
    city: [''],
    state: [''],
    country: [''],
  });

  constructor(private vendorService: VendorService, public auth: AuthService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.vendorService
      .list({ category: this.categoryFilter, status_filter: this.statusFilter, search: this.search })
      .subscribe({
        next: (v) => {
          this.vendors = v;
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load vendors.';
          this.loading = false;
        },
      });
  }

  canApprove(): boolean {
    return this.auth.hasAnyRole(['administrator', 'procurement_manager', 'supply_chain_manager']);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    this.vendorService.create(this.form.value as any).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        this.form.reset({ category: 'raw_material_suppliers' });
        this.load();
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.detail || 'Failed to register vendor.';
      },
    });
  }

  approve(vendor: Vendor, status: VendorStatus): void {
    const notes = prompt(`Notes for setting ${vendor.company_name} to "${status}" (optional):`) || undefined;
    this.vendorService.setApproval(vendor.id, status, notes).subscribe(() => this.load());
  }

  viewDetail(vendor: Vendor): void {
    this.selectedVendor = this.selectedVendor?.id === vendor.id ? null : vendor;
  }

  statusBadgeClass(status: VendorStatus): string {
    switch (status) {
      case 'approved':
      case 'active':
        return 'bg-success';
      case 'pending':
        return 'bg-warning text-dark';
      case 'rejected':
      case 'suspended':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }
}
