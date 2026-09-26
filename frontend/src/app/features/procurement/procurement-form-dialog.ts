import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ProcurementService } from '../../core/api.service';
import {
  PRIORITIES,
  ProcurementRequest,
  VENDOR_CATEGORIES,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { toIsoDate } from '../../shared/date-utils';

@Component({
  selector: 'app-procurement-form-dialog',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './procurement-form-dialog.html',
})
export class ProcurementFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProcurementService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<ProcurementFormDialog>);

  readonly request = inject<ProcurementRequest | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly categories = VENDOR_CATEGORIES;
  readonly priorities = PRIORITIES;
  readonly units = [
    'Units',
    'Kits',
    'Tonnes',
    'Litres',
    'Metres',
    'Licences',
    'Shipments',
    'Visits',
    'Months',
    'Hours',
  ];

  readonly saving = signal(false);
  readonly isEdit = !!this.request;

  readonly form = this.fb.nonNullable.group({
    item: [this.request?.item ?? '', [Validators.required, Validators.minLength(2)]],
    description: [this.request?.description ?? ''],
    category: [this.request?.category ?? ''],
    quantity: [
      this.request?.quantity ?? 1,
      [Validators.required, Validators.min(0.01)],
    ],
    unit: [this.request?.unit ?? 'Units', Validators.required],
    estimated_cost: [
      this.request?.estimated_cost ?? 0,
      [Validators.required, Validators.min(0)],
    ],
    currency: [this.request?.currency ?? 'USD', Validators.required],
    required_date: [
      this.request?.required_date ? new Date(this.request.required_date) : null,
    ],
    priority: [this.request?.priority ?? 'Medium', Validators.required],
    department: [this.request?.department ?? ''],
    justification: [this.request?.justification ?? ''],
  });

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const value = this.form.getRawValue();

    const payload = {
      item: value.item,
      description: value.description || null,
      category: value.category || null,
      quantity: Number(value.quantity),
      unit: value.unit,
      estimated_cost: Number(value.estimated_cost),
      currency: value.currency,
      required_date: toIsoDate(value.required_date),
      priority: value.priority,
      department: value.department || null,
      justification: value.justification || null,
    };

    const request$ = this.request
      ? this.service.update(this.request.id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: (saved) => {
        this.toast.success(
          this.request
            ? `${saved.request_number} updated.`
            : `${saved.request_number} submitted for approval.`,
        );
        this.dialogRef.close(saved);
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.fromError(
          error,
          this.request
            ? 'Could not update the request.'
            : 'Could not create the request.',
        );
      },
    });
  }
}
