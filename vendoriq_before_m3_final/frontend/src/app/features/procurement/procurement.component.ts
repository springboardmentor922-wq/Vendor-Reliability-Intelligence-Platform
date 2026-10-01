import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProcurementService } from '../../core/services/procurement.service';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';
import { ProcurementRequest, ProcurementStatus, Vendor } from '../../core/models/models';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './procurement.component.html',
})
export class ProcurementComponent implements OnInit {
  private fb = inject(FormBuilder);
  requests: ProcurementRequest[] = [];
  vendors: Vendor[] = [];
  loading = true;
  error = '';
  showForm = false;
  submitting = false;
  statusFilter = '';

  statuses: ProcurementStatus[] = ['pending', 'approved', 'rejected', 'ordered', 'delivered', 'completed', 'cancelled'];

  form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    department: [''],
    category: [''],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit: [''],
    estimated_budget: [0, [Validators.required, Validators.min(0)]],
    priority: ['medium'],
    required_date: [''],
  });

  constructor(
    private procurementService: ProcurementService,
    private vendorService: VendorService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
    this.vendorService.list({ status_filter: 'approved' }).subscribe((v) => (this.vendors = v));
  }

  load(): void {
    this.loading = true;
    this.procurementService.list({ status_filter: this.statusFilter }).subscribe({
      next: (r) => {
        this.requests = r;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load procurement requests.';
        this.loading = false;
      },
    });
  }

  canApprove(): boolean {
    return this.auth.hasAnyRole(['administrator', 'procurement_manager']);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    const payload = { ...this.form.value };
    if (!payload.required_date) delete (payload as any).required_date;
    this.procurementService.create(payload as any).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        this.form.reset({ quantity: 1, estimated_budget: 0, priority: 'medium' });
        this.load();
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.detail || 'Failed to create request.';
      },
    });
  }

  approve(req: ProcurementRequest, status: ProcurementStatus): void {
    const notes = prompt(`Notes for setting "${req.title}" to "${status}" (optional):`) || undefined;
    this.procurementService.setApproval(req.id, status, notes).subscribe(() => this.load());
  }

  assignVendor(req: ProcurementRequest, vendorId: string): void {
    if (!vendorId) return;
    this.procurementService.assignVendor(req.id, Number(vendorId)).subscribe(() => this.load());
  }

  statusBadgeClass(status: ProcurementStatus): string {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-success';
      case 'pending':
        return 'bg-warning text-dark';
      case 'rejected':
      case 'cancelled':
        return 'bg-danger';
      case 'ordered':
        return 'bg-info text-dark';
      case 'delivered':
        return 'bg-primary';
      default:
        return 'bg-secondary';
    }
  }
}
