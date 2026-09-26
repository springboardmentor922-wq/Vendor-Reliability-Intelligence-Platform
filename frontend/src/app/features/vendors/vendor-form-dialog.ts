import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { VendorService } from '../../core/api.service';
import { RISK_LEVELS, VENDOR_CATEGORIES, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-vendor-form-dialog',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './vendor-form-dialog.html',
})
export class VendorFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(VendorService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<VendorFormDialog>);

  readonly vendor = inject<Vendor | null>(MAT_DIALOG_DATA, { optional: true });

  readonly categories = VENDOR_CATEGORIES;
  readonly riskLevels = RISK_LEVELS;
  readonly saving = signal(false);
  readonly isEdit = !!this.vendor;

  readonly form = this.fb.nonNullable.group({
    vendor_name: [
      this.vendor?.vendor_name ?? '',
      [Validators.required, Validators.minLength(2)],
    ],
    category: [this.vendor?.category ?? '', Validators.required],
    contact_person: [this.vendor?.contact_person ?? ''],
    email: [this.vendor?.email ?? '', Validators.email],
    phone: [this.vendor?.phone ?? ''],
    website: [this.vendor?.website ?? ''],
    address: [this.vendor?.address ?? ''],
    city: [this.vendor?.city ?? ''],
    country: [this.vendor?.country ?? ''],
    tax_id: [this.vendor?.tax_id ?? ''],
    registration_number: [this.vendor?.registration_number ?? ''],
    risk_level: [this.vendor?.risk_level ?? 'Medium'],
    notes: [this.vendor?.notes ?? ''],
    // Only offered when registering a brand-new vendor.
    contact_name: [''],
    contact_designation: [''],
    contact_email: [''],
    contact_phone: [''],
  });

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();

    const payload: Record<string, unknown> = {
      vendor_name: value.vendor_name,
      category: value.category,
      contact_person: value.contact_person || null,
      email: value.email || null,
      phone: value.phone || null,
      website: value.website || null,
      address: value.address || null,
      city: value.city || null,
      country: value.country || null,
      tax_id: value.tax_id || null,
      registration_number: value.registration_number || null,
      risk_level: value.risk_level,
      notes: value.notes || null,
    };

    if (this.vendor) {
      this.service.update(this.vendor.id, payload).subscribe({
        next: (updated) => {
          this.toast.success(`${updated.vendor_name} updated.`);
          this.dialogRef.close(updated);
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not update the vendor.');
        },
      });
      return;
    }

    if (value.contact_name.trim()) {
      payload['contacts'] = [
        {
          name: value.contact_name,
          designation: value.contact_designation || null,
          email: value.contact_email || null,
          phone: value.contact_phone || null,
          is_primary: true,
        },
      ];
    }

    this.service.create(payload).subscribe({
      next: (created) => {
        this.toast.success(
          `${created.vendor_name} registered as ${created.vendor_code}. ` +
            `It is now awaiting approval.`,
        );
        this.dialogRef.close(created);
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.fromError(error, 'Could not register the vendor.');
      },
    });
  }
}
