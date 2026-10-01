import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';
import { PerformanceService } from '../../core/services/performance.service';
import { ReliabilityService } from '../../core/services/reliability.service';
import { ReliabilityScore, Vendor, VendorCategory, VendorMetrics, VendorStatus } from '../../core/models/models';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './vendors.component.html',
})
export class VendorsComponent implements OnInit {
  vendors: Vendor[] = [];
  loading = true;
  error = '';
  showForm = false;
  submitting = false;
  selectedVendor: Vendor | null = null;

  metricsByVendor: Record<number, VendorMetrics> = {};
  reliabilityByVendor: Record<number, ReliabilityScore | null> = {};
  calculatingReliability = false;

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

  constructor(
    private vendorService: VendorService,
    private fb: FormBuilder,
    public auth: AuthService,
    private performanceService: PerformanceService,
    private reliabilityService: ReliabilityService
  ) {}

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
    if (this.selectedVendor?.id === vendor.id) {
      this.selectedVendor = null;
      return;
    }
    this.selectedVendor = vendor;
    this.performanceService.getVendorMetrics(vendor.id).subscribe((m) => (this.metricsByVendor[vendor.id] = m));
    this.reliabilityService.getLatest(vendor.id).subscribe({
      next: (r) => (this.reliabilityByVendor[vendor.id] = r),
      error: () => (this.reliabilityByVendor[vendor.id] = null),
    });
  }

  calculateReliability(vendor: Vendor): void {
    this.calculatingReliability = true;
    this.reliabilityService.calculate(vendor.id).subscribe({
      next: (r) => {
        this.reliabilityByVendor[vendor.id] = r;
        this.calculatingReliability = false;
      },
      error: (err) => {
        this.calculatingReliability = false;
        this.error = err?.error?.detail || 'Failed to calculate reliability score.';
      },
    });
  }

  raiseIssue(vendor: Vendor): void {
    const title = prompt('Issue title:');
    if (!title) return;
    const description = prompt('Description (optional):') || undefined;
    this.performanceService.raiseIssue({ vendor_id: vendor.id, title, description }).subscribe(() => {
      this.performanceService.getVendorMetrics(vendor.id).subscribe((m) => (this.metricsByVendor[vendor.id] = m));
    });
  }

  addQualityEvaluation(vendor: Vendor): void {
    const ratingStr = prompt('Quality rating (0-5):', '4.5');
    if (!ratingStr) return;
    const rating = Number(ratingStr);
    if (isNaN(rating) || rating < 0 || rating > 5) {
      this.error = 'Rating must be a number between 0 and 5.';
      return;
    }
    this.performanceService.addQualityEvaluation({ vendor_id: vendor.id, rating }).subscribe(() => {
      this.performanceService.getVendorMetrics(vendor.id).subscribe((m) => (this.metricsByVendor[vendor.id] = m));
    });
  }

  riskBadgeClass(risk: string): string {
    switch (risk) {
      case 'low':
        return 'bg-success';
      case 'medium':
        return 'bg-warning text-dark';
      case 'high':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
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
