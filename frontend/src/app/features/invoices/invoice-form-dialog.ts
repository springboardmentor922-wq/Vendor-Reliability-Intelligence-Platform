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
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  InvoiceService,
  PurchaseOrderService,
  VendorService,
} from '../../core/api.service';
import { PurchaseOrder, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { toIsoDate } from '../../shared/date-utils';

export interface InvoiceDialogData {
  /** Set when recording an invoice from a purchase order screen. */
  purchaseOrder?: PurchaseOrder | null;
}

@Component({
  selector: 'app-invoice-form-dialog',
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
  templateUrl: './invoice-form-dialog.html',
})
export class InvoiceFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(InvoiceService);
  private readonly poService = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<InvoiceFormDialog>);

  readonly data =
    inject<InvoiceDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly fixedOrder = this.data.purchaseOrder ?? null;

  readonly orders = signal<PurchaseOrder[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    purchase_order_id: [
      this.fixedOrder?.id ?? (null as number | null),
    ],
    vendor_id: [this.fixedOrder?.vendor_id ?? (null as number | null)],
    invoice_date: [new Date() as Date | null],
    due_date: [null as Date | null],
    amount: [
      Number(this.fixedOrder?.subtotal ?? 0),
      [Validators.required, Validators.min(0)],
    ],
    tax_amount: [Number(this.fixedOrder?.tax_amount ?? 0), Validators.min(0)],
    currency: [this.fixedOrder?.currency ?? 'USD', Validators.required],
    notes: [''],
  });

  constructor() {
    if (!this.fixedOrder) {
      this.poService.list().subscribe({
        next: (orders) => this.orders.set(orders),
        error: () => this.orders.set([]),
      });

      this.vendorService.list({ status: 'Approved' }).subscribe({
        next: (vendors) => this.vendors.set(vendors),
        error: () => this.vendors.set([]),
      });
    }
  }

  onOrderSelected(orderId: number | null): void {
    const order = this.orders().find((o) => o.id === orderId);

    if (order) {
      this.form.patchValue({
        vendor_id: order.vendor_id,
        amount: Number(order.subtotal),
        tax_amount: Number(order.tax_amount),
        currency: order.currency,
      });
    }
  }

  total(): number {
    const raw = this.form.getRawValue();
    return Number(raw.amount || 0) + Number(raw.tax_amount || 0);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (!raw.purchase_order_id && !raw.vendor_id) {
      this.toast.error('Select a purchase order or a vendor.');
      return;
    }

    this.saving.set(true);

    const payload = {
      purchase_order_id: raw.purchase_order_id,
      vendor_id: raw.vendor_id,
      invoice_date: toIsoDate(raw.invoice_date),
      due_date: toIsoDate(raw.due_date),
      amount: Number(raw.amount),
      tax_amount: Number(raw.tax_amount || 0),
      currency: raw.currency,
      notes: raw.notes || null,
    };

    const request$ = this.fixedOrder
      ? this.poService.addInvoice(this.fixedOrder.id, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: (invoice) => {
        this.toast.success(`Invoice ${invoice.invoice_number} recorded.`);
        this.dialogRef.close(invoice);
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.fromError(error, 'Could not record the invoice.');
      },
    });
  }
}
