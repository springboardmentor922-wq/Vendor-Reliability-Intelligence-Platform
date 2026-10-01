import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContractService } from '../../core/services/contract.service';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';
import { Contract, ContractStatus, Vendor } from '../../core/models/models';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './contracts.component.html',
})
export class ContractsComponent implements OnInit {
  private fb = inject(FormBuilder);
  contracts: Contract[] = [];
  vendors: Vendor[] = [];
  loading = true;
  error = '';
  showForm = false;
  submitting = false;
  statusFilter = '';

  statuses: ContractStatus[] = ['active', 'expiring', 'expired', 'renewed', 'terminated'];

  form = this.fb.group({
    vendor_id: ['', Validators.required],
    title: ['', Validators.required],
    description: [''],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    value: [0, [Validators.required, Validators.min(0)]],
  });

  constructor(
    private contractService: ContractService,
    private vendorService: VendorService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
    this.vendorService.list({ status_filter: 'approved' }).subscribe((v) => (this.vendors = v));
  }

  load(): void {
    this.loading = true;
    this.contractService.list({ status_filter: this.statusFilter }).subscribe({
      next: (c) => {
        this.contracts = c;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load contracts.';
        this.loading = false;
      },
    });
  }

  canManage(): boolean {
    return this.auth.hasAnyRole(['administrator', 'procurement_manager', 'supply_chain_manager']);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    this.contractService.create(this.form.value as any).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        this.form.reset({ value: 0 });
        this.load();
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.detail || 'Failed to create contract.';
      },
    });
  }

  renew(contract: Contract): void {
    const newDate = prompt('New end date (YYYY-MM-DD):', contract.end_date?.substring(0, 10));
    if (!newDate) return;
    this.contractService.renew(contract.id, new Date(newDate).toISOString()).subscribe(() => this.load());
  }

  vendorName(id: number): string {
    return this.vendors.find((v) => v.id === String(id))?.company_name || `Vendor #${id}`;
  }

  statusBadgeClass(status: ContractStatus): string {
    switch (status) {
      case 'active':
      case 'renewed':
        return 'bg-success';
      case 'expiring':
        return 'bg-warning text-dark';
      case 'expired':
      case 'terminated':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }
}
