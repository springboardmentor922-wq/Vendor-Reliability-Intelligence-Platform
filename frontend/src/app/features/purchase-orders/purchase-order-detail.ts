import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';

import { PurchaseOrderService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PurchaseOrderDetail as PurchaseOrderDetailModel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { InvoiceFormDialog } from '../invoices/invoice-form-dialog';
import { PurchaseOrderFormDialog } from './purchase-order-form-dialog';

const NEXT_STATUSES: Record<string, string[]> = {
  Pending: ['Approved', 'Cancelled'],
  Approved: ['Ordered', 'Cancelled'],
  Ordered: ['Delivered', 'Cancelled'],
  Delivered: ['Completed'],
  Completed: [],
  Cancelled: [],
};

@Component({
  selector: 'app-purchase-order-detail',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './purchase-order-detail.html',
})
export class PurchaseOrderDetail {
  private readonly service = inject(PurchaseOrderService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;
  readonly canManageFinance = this.auth.canManageFinance;

  readonly loading = signal(true);
  readonly order = signal<PurchaseOrderDetailModel | null>(null);

  readonly itemColumns = ['item_name', 'quantity', 'unit_price', 'line_total'];
  readonly invoiceColumns = ['invoice_number', 'invoice_date', 'due_date', 'total', 'status'];

  constructor() {
    queueMicrotask(() => this.load());
  }

  load(): void {
    this.loading.set(true);

    this.service.get(Number(this.id())).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the purchase order.');
      },
    });
  }

  nextStatuses(): string[] {
    const order = this.order();
    return order ? (NEXT_STATUSES[order.status] ?? []) : [];
  }

  edit(): void {
    const order = this.order();
    if (!order) return;

    this.dialog
      .open(PurchaseOrderFormDialog, { width: '960px', data: { order } })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  changeStatus(status: string): void {
    const order = this.order();
    if (!order) return;

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Move ${order.po_number} to ${status}?`,
          message:
            status === 'Delivered'
              ? 'The delivery date is recorded as today. Any delay against the ' +
                'expected date is flagged and notified.'
              : `The order status changes from ${order.status} to ${status}.`,
          confirmLabel: `Mark ${status}`,
          danger: status === 'Cancelled',
          promptLabel: 'Comments (optional)',
        },
      })
      .afterClosed()
      .subscribe((comments) => {
        if (comments === undefined) return;

        this.service
          .changeStatus(order.id, status, { comments: comments as string })
          .subscribe({
            next: (updated) => {
              this.toast.success(`Order is now ${updated.status}.`);
              this.load();
            },
            error: (error) =>
              this.toast.fromError(error, 'Could not change the status.'),
          });
      });
  }

  addInvoice(): void {
    const order = this.order();
    if (!order) return;

    this.dialog
      .open(InvoiceFormDialog, {
        width: '620px',
        data: { purchaseOrder: order },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }
}
