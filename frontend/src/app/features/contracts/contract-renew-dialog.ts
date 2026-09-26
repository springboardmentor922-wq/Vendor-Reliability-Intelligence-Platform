import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ContractService } from '../../core/api.service';
import { Contract } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { toIsoDate } from '../../shared/date-utils';

@Component({
  selector: 'app-contract-renew-dialog',
  providers: [provideNativeDateAdapter()],
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Renew {{ contract.contract_number }}</h2>

    <mat-dialog-content>
      <p class="field-hint" style="margin-top: 0">
        A successor contract is created and linked back to this one. The current
        contract is marked <strong>Renewed</strong>.
      </p>

      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>New start date</mat-label>
          <input matInput [matDatepicker]="start" formControlName="start_date" />
          <mat-datepicker-toggle matIconSuffix [for]="start" />
          <mat-datepicker #start />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>New expiry date</mat-label>
          <input matInput [matDatepicker]="expiry" formControlName="expiry_date" />
          <mat-datepicker-toggle matIconSuffix [for]="expiry" />
          <mat-datepicker #expiry />
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Contract value</mat-label>
          <input
            matInput
            type="number"
            min="0"
            step="0.01"
            formControlName="contract_value"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button matButton="filled" [disabled]="saving()" (click)="submit()">
        {{ saving() ? 'Renewing…' : 'Renew contract' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(520px, 82vw);
    }
  `,
})
export class ContractRenewDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContractService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<ContractRenewDialog>);

  readonly contract = inject<Contract>(MAT_DIALOG_DATA);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    start_date: [this.defaultStart(), Validators.required],
    expiry_date: [this.defaultExpiry(), Validators.required],
    contract_value: [Number(this.contract.contract_value ?? 0)],
    notes: [''],
  });

  /** The day after the current contract lapses. */
  private defaultStart(): Date {
    const start = new Date(this.contract.expiry_date);
    start.setDate(start.getDate() + 1);
    return start;
  }

  /** A further twelve months of cover by default. */
  private defaultExpiry(): Date {
    const expiry = this.defaultStart();
    expiry.setFullYear(expiry.getFullYear() + 1);
    return expiry;
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (raw.expiry_date <= raw.start_date) {
      this.toast.error('The expiry date must be after the start date.');
      return;
    }

    this.saving.set(true);

    this.service
      .renew(this.contract.id, {
        start_date: toIsoDate(raw.start_date)!,
        expiry_date: toIsoDate(raw.expiry_date)!,
        contract_value: Number(raw.contract_value || 0),
      })
      .subscribe({
        next: (successor) => this.dialogRef.close(successor),
        error: (error) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not renew the contract.');
        },
      });
  }
}
