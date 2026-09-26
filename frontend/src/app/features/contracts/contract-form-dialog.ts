import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ContractService, VendorService } from '../../core/api.service';
import { Contract, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { toIsoDate } from '../../shared/date-utils';

const CONTRACT_TYPES = [
  'Supply Agreement',
  'Service Agreement',
  'Master Agreement',
  'Service Level Agreement',
  'Non-Disclosure Agreement',
  'Maintenance Agreement',
];

@Component({
  selector: 'app-contract-form-dialog',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './contract-form-dialog.html',
})
export class ContractFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContractService);
  private readonly vendorService = inject(VendorService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<ContractFormDialog>);

  readonly contract = inject<Contract | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly types = CONTRACT_TYPES;
  readonly statuses = ['Draft', 'Active', 'Terminated'];
  readonly vendors = signal<Vendor[]>([]);
  readonly saving = signal(false);
  readonly isEdit = !!this.contract;

  readonly form = this.fb.nonNullable.group({
    vendor_id: [
      this.contract?.vendor_id ?? (null as number | null),
      Validators.required,
    ],
    title: [this.contract?.title ?? ''],
    contract_type: [
      this.contract?.contract_type ?? 'Supply Agreement',
      Validators.required,
    ],
    start_date: [
      this.contract ? new Date(this.contract.start_date) : new Date(),
      Validators.required,
    ],
    expiry_date: [
      this.contract ? new Date(this.contract.expiry_date) : null,
      Validators.required,
    ],
    contract_value: [Number(this.contract?.contract_value ?? 0), Validators.min(0)],
    currency: [this.contract?.currency ?? 'USD', Validators.required],
    auto_renew: [this.contract?.auto_renew ?? false],
    renewal_notice_days: [
      this.contract?.renewal_notice_days ?? 30,
      [Validators.min(0), Validators.max(365)],
    ],
    status: [this.contract?.status ?? 'Draft'],
    terms: [this.contract?.terms ?? ''],
    notes: [this.contract?.notes ?? ''],
  });

  constructor() {
    this.vendorService.list({ status: 'Approved' }).subscribe({
      next: (vendors) => this.vendors.set(vendors),
      error: () => this.vendors.set([]),
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (raw.expiry_date && raw.start_date && raw.expiry_date <= raw.start_date) {
      this.toast.error('The expiry date must be after the start date.');
      return;
    }

    this.saving.set(true);

    const payload: Record<string, unknown> = {
      title: raw.title || null,
      contract_type: raw.contract_type,
      start_date: toIsoDate(raw.start_date),
      expiry_date: toIsoDate(raw.expiry_date),
      contract_value: Number(raw.contract_value || 0),
      currency: raw.currency,
      auto_renew: raw.auto_renew,
      renewal_notice_days: Number(raw.renewal_notice_days),
      terms: raw.terms || null,
      notes: raw.notes || null,
    };

    if (this.contract) {
      // The vendor is fixed once a contract exists.
      payload['status'] = raw.status;

      this.service.update(this.contract.id, payload).subscribe({
        next: (updated) => {
          this.toast.success(`${updated.contract_number} updated.`);
          this.dialogRef.close(updated);
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not update the contract.');
        },
      });
      return;
    }

    this.service
      .create({ ...payload, vendor_id: raw.vendor_id, status: raw.status })
      .subscribe({
        next: (created) => {
          this.toast.success(`${created.contract_number} created.`);
          this.dialogRef.close(created);
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not create the contract.');
        },
      });
  }
}
