import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';

import { PurchaseOrderService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PurchaseOrder, PurchaseOrderStats } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { PurchaseOrderFormDialog } from './purchase-order-form-dialog';

/** Mirrors the transition table enforced by the API. */
const NEXT_STATUSES: Record<string, string[]> = {
  Pending: ['Approved', 'Cancelled'],
  Approved: ['Ordered', 'Cancelled'],
  Ordered: ['Delivered', 'Cancelled'],
  Delivered: ['Completed'],
  Completed: [],
  Cancelled: [],
};

@Component({
  selector: 'app-purchase-order-list',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    StatusPill,
  ],
  templateUrl: './purchase-order-list.html',
})
export class PurchaseOrderList {
  private readonly service = inject(PurchaseOrderService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;

  readonly statuses = [
    'Pending',
    'Approved',
    'Ordered',
    'Delivered',
    'Completed',
    'Cancelled',
  ];

  readonly loading = signal(true);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly stats = signal<PurchaseOrderStats | null>(null);

  search = '';
  statusFilter = '';
  delayedOnly = false;

  readonly columns = computed(() =>
    this.canEdit()
      ? [
          'po_number',
          'vendor',
          'title',
          'order_date',
          'expected_delivery',
          'total',
          'status',
          'actions',
        ]
      : [
          'po_number',
          'vendor',
          'title',
          'order_date',
          'expected_delivery',
          'total',
          'status',
        ],
  );

  constructor() {
    this.load();

    // Deep link from a procurement request: /purchase-orders?fromRequest=12
    const fromRequest = this.route.snapshot.queryParamMap.get('fromRequest');

    if (fromRequest && this.canEdit()) {
      queueMicrotask(() => this.create(Number(fromRequest)));
    }
  }

  load(): void {
    this.loading.set(true);

    this.service
      .list({
        search: this.search,
        status: this.statusFilter,
        delayed_only: this.delayedOnly ? true : '',
      })
      .subscribe({
        next: (orders) => {
          this.orders.set(orders);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load purchase orders.');
        },
      });

    this.service.stats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.stats.set(null),
    });
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = '';
    this.delayedOnly = false;
    this.load();
  }

  nextStatuses(order: PurchaseOrder): string[] {
    return NEXT_STATUSES[order.status] ?? [];
  }

  open(order: PurchaseOrder): void {
    void this.router.navigate(['/purchase-orders', order.id]);
  }

  create(fromRequestId?: number): void {
    this.dialog
      .open(PurchaseOrderFormDialog, {
        width: '960px',
        data: { fromRequestId: fromRequestId ?? null },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();

        // Drop the deep-link parameter so a refresh doesn't reopen the dialog.
        if (fromRequestId) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
          });
        }
      });
  }

  changeStatus(order: PurchaseOrder, status: string, event: Event): void {
    event.stopPropagation();

    const isDelivery = status === 'Delivered';

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Move ${order.po_number} to ${status}?`,
          message: isDelivery
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
              this.toast.success(`${updated.po_number} is now ${updated.status}.`);
              this.load();
            },
            error: (error) =>
              this.toast.fromError(error, 'Could not change the status.'),
          });
      });
  }

  edit(order: PurchaseOrder, event: Event): void {
    event.stopPropagation();

    this.service.get(order.id).subscribe({
      next: (full) => {
        this.dialog
          .open(PurchaseOrderFormDialog, { width: '960px', data: { order: full } })
          .afterClosed()
          .subscribe((result) => {
            if (result) this.load();
          });
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not load the purchase order.'),
    });
  }

  remove(order: PurchaseOrder, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${order.po_number}?`,
          message:
            'Only Pending orders are deleted outright. Anything further along ' +
            'is cancelled so the audit trail survives.',
          confirmLabel: 'Delete order',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.service.remove(order.id).subscribe({
          next: (response) => {
            this.toast.success(response.message);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not delete the purchase order.'),
        });
      });
  }
}
