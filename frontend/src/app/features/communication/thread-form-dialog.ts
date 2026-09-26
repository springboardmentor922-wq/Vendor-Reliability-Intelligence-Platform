import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  CommunicationService,
  PurchaseOrderService,
  VendorService,
} from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PRIORITIES, PurchaseOrder, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-thread-form-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './thread-form-dialog.html',
})
export class ThreadFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CommunicationService);
  private readonly vendorService = inject(VendorService);
  private readonly poService = inject(PurchaseOrderService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly dialogRef = inject(MatDialogRef<ThreadFormDialog>);

  readonly priorities = PRIORITIES;
  readonly isVendor = this.auth.isVendor;
  readonly vendors = signal<Vendor[]>([]);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.minLength(2)]],
    vendor_id: [null as number | null],
    purchase_order_id: [null as number | null],
    priority: ['Medium', Validators.required],
    body: ['', Validators.required],
  });

  constructor() {
    // A supplier login is scoped to its own vendor server-side, so the
    // picker is only useful for internal staff.
    if (!this.isVendor()) {
      this.vendorService.list({ status: 'Approved' }).subscribe({
        next: (vendors) => this.vendors.set(vendors),
        error: () => this.vendors.set([]),
      });
    }

    this.poService.list().subscribe({
      next: (orders) => this.orders.set(orders),
      error: () => this.orders.set([]),
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();

    this.service
      .createThread({
        subject: raw.subject,
        vendor_id: raw.vendor_id,
        purchase_order_id: raw.purchase_order_id,
        priority: raw.priority,
        body: raw.body,
      })
      .subscribe({
        next: (thread) => {
          this.toast.success('Conversation started.');
          this.dialogRef.close(thread);
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.fromError(error, 'Could not start the conversation.');
        },
      });
  }
}
