import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { VendorService } from '../../core/api.service';
import { Vendor } from '../../core/models';

export interface AssignVendorData {
  title: string;
  /** Pre-selects the vendor whose category matches the request. */
  preferredCategory?: string | null;
  currentVendorId?: number | null;
}

@Component({
  selector: 'app-assign-vendor-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="field-hint" style="margin-top: 0">
        Only approved vendors can be assigned work.
      </p>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Vendor</mat-label>
        <mat-select [(ngModel)]="vendorId">
          @for (vendor of vendors(); track vendor.id) {
            <mat-option [value]="vendor.id">
              {{ vendor.vendor_name }} — {{ vendor.category }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (vendors().length === 0 && !loading()) {
        <p class="muted">
          No approved vendors are available. Approve a vendor first.
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button
        matButton="filled"
        [disabled]="!vendorId"
        (click)="dialogRef.close(vendorId)"
      >
        Assign vendor
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: min(460px, 80vw);
    }
  `,
})
export class AssignVendorDialog {
  readonly data = inject<AssignVendorData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AssignVendorDialog>);
  private readonly service = inject(VendorService);

  readonly vendors = signal<Vendor[]>([]);
  readonly loading = signal(true);

  vendorId: number | null = this.data.currentVendorId ?? null;

  constructor() {
    this.service.list({ status: 'Approved' }).subscribe({
      next: (vendors) => {
        this.vendors.set(vendors);
        this.loading.set(false);

        if (this.vendorId === null && this.data.preferredCategory) {
          const match = vendors.find(
            (vendor) => vendor.category === this.data.preferredCategory,
          );
          this.vendorId = match?.id ?? null;
        }
      },
      error: () => {
        this.vendors.set([]);
        this.loading.set(false);
      },
    });
  }
}
