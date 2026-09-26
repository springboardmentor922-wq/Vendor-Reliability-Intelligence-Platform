import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
  ProcurementService,
  PurchaseOrderService,
  VendorService,
} from '../../core/api.service';
import {
  ProcurementRequest,
  PurchaseOrderDetail,
  Vendor,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { toIsoDate } from '../../shared/date-utils';

export interface PurchaseOrderDialogData {
  order?: PurchaseOrderDetail | null;
  /** Prefills the form from an approved procurement request. */
  fromRequestId?: number | null;
}

@Component({
  selector: 'app-purchase-order-form-dialog',
  providers: [provideNativeDateAdapter()],
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './purchase-order-form-dialog.html',
})
export class PurchaseOrderFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PurchaseOrderService);
  private readonly vendorService = inject(VendorService);
  private readonly procurementService = inject(ProcurementService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<PurchaseOrderFormDialog>);

  readonly data = inject<PurchaseOrderDialogData>(MAT_DIALOG_DATA, {
    optional: true,
  }) ?? {};

  readonly order = this.data.order ?? null;
  readonly isEdit = !!this.order;

  readonly vendors = signal<Vendor[]>([]);
  readonly approvedRequests = signal<ProcurementRequest[]>([]);
  readonly saving = signal(false);

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

  readonly form = this.fb.nonNullable.group({
    vendor_id: [this.order?.vendor_id ?? (null as number | null), Validators.required],
    procurement_request_id: [
      this.order?.procurement_request_id ?? (null as number | null),
    ],
    title: [this.order?.title ?? ''],
    description: [this.order?.description ?? ''],
    expected_delivery: [
      this.order?.expected_delivery ? new Date(this.order.expected_delivery) : null,
    ],
    currency: [this.order?.currency ?? 'USD', Validators.required],
    tax_amount: [Number(this.order?.tax_amount ?? 0), Validators.min(0)],
    shipping_amount: [Number(this.order?.shipping_amount ?? 0), Validators.min(0)],
    payment_terms: [this.order?.payment_terms ?? 'Net 30'],
    shipping_address: [this.order?.shipping_address ?? ''],
    notes: [this.order?.notes ?? ''],
    items: this.fb.array(
      (this.order?.items ?? []).map((item) => this.itemGroup(item)),
    ),
  });

  /** Recomputed on every value change so the totals stay live. */
  readonly totals = signal({ subtotal: 0, tax: 0, shipping: 0, total: 0 });

  get items(): FormArray {
    return this.form.controls.items as FormArray;
  }

  constructor() {
    if (this.items.length === 0) {
      this.addItem();
    }

    this.vendorService.list({ status: 'Approved' }).subscribe({
      next: (vendors) => this.vendors.set(vendors),
      error: () => this.vendors.set([]),
    });

    if (!this.isEdit) {
      this.procurementService.list({ status: 'Approved' }).subscribe({
        next: (requests) => {
          this.approvedRequests.set(requests);

          if (this.data.fromRequestId) {
            const match = requests.find((r) => r.id === this.data.fromRequestId);
            if (match) {
              this.applyRequest(match);
            }
          }
        },
        error: () => this.approvedRequests.set([]),
      });
    }

    this.form.valueChanges.subscribe(() => this.recalculate());
    this.recalculate();
  }

  private itemGroup(item?: {
    item_name: string;
    description?: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
  }) {
    return this.fb.nonNullable.group({
      item_name: [item?.item_name ?? '', Validators.required],
      description: [item?.description ?? ''],
      quantity: [Number(item?.quantity ?? 1), [Validators.required, Validators.min(0.01)]],
      unit: [item?.unit ?? 'Units', Validators.required],
      unit_price: [
        Number(item?.unit_price ?? 0),
        [Validators.required, Validators.min(0)],
      ],
    });
  }

  addItem(): void {
    this.items.push(this.itemGroup());
  }

  removeItem(index: number): void {
    if (this.items.length === 1) {
      this.toast.error('A purchase order needs at least one line item.');
      return;
    }
    this.items.removeAt(index);
  }

  lineTotal(index: number): number {
    const group = this.items.at(index).value;
    return Number(group.quantity || 0) * Number(group.unit_price || 0);
  }

  /** Called when the user picks a procurement request to convert. */
  onRequestSelected(requestId: number | null): void {
    if (!requestId) return;

    const request = this.approvedRequests().find((r) => r.id === requestId);
    if (request) {
      this.applyRequest(request);
    }
  }

  private applyRequest(request: ProcurementRequest): void {
    const unitPrice =
      Number(request.quantity) > 0
        ? Number(request.estimated_cost) / Number(request.quantity)
        : 0;

    this.form.patchValue(
      {
        procurement_request_id: request.id,
        vendor_id: request.assigned_vendor_id ?? this.form.controls.vendor_id.value,
        title: request.item,
        description: request.description ?? '',
        currency: request.currency,
        expected_delivery: request.required_date
          ? new Date(request.required_date)
          : null,
      },
      { emitEvent: false },
    );

    this.items.clear({ emitEvent: false });
    this.items.push(
      this.itemGroup({
        item_name: request.item,
        description: request.description,
        quantity: Number(request.quantity),
        unit: request.unit,
        unit_price: Number(unitPrice.toFixed(2)),
      }),
    );

    this.recalculate();
  }

  private recalculate(): void {
    const raw = this.form.getRawValue();

    const subtotal = (raw.items as { quantity: number; unit_price: number }[])
      .reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      );

    const tax = Number(raw.tax_amount || 0);
    const shipping = Number(raw.shipping_amount || 0);

    this.totals.set({ subtotal, tax, shipping, total: subtotal + tax + shipping });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();

    const items = (
      raw.items as {
        item_name: string;
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
      }[]
    ).map((item) => ({
      item_name: item.item_name,
      description: item.description || null,
      quantity: Number(item.quantity),
      unit: item.unit,
      unit_price: Number(item.unit_price),
    }));

    const shared = {
      title: raw.title || null,
      description: raw.description || null,
      expected_delivery: toIsoDate(raw.expected_delivery),
      currency: raw.currency,
      tax_amount: Number(raw.tax_amount || 0),
      shipping_amount: Number(raw.shipping_amount || 0),
      payment_terms: raw.payment_terms || null,
      shipping_address: raw.shipping_address || null,
      notes: raw.notes || null,
      items,
    };

    const request$ = this.order
      ? this.service.update(this.order.id, shared)
      : this.service.create({
          ...shared,
          vendor_id: raw.vendor_id as number,
          procurement_request_id: raw.procurement_request_id,
        });

    request$.subscribe({
      next: (saved) => {
        this.toast.success(
          this.order
            ? `${saved.po_number} updated.`
            : `${saved.po_number} raised and awaiting approval.`,
        );
        this.dialogRef.close(saved);
      },
      error: (error) => {
        this.saving.set(false);
        this.toast.fromError(
          error,
          this.order
            ? 'Could not update the purchase order.'
            : 'Could not raise the purchase order.',
        );
      },
    });
  }
}
