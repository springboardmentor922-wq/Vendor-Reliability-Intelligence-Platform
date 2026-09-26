import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';

import { ProcurementService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  PRIORITIES,
  ProcurementRequest,
  ProcurementStats,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { AssignVendorDialog } from './assign-vendor-dialog';
import { ProcurementFormDialog } from './procurement-form-dialog';

@Component({
  selector: 'app-procurement-list',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    StatusPill,
  ],
  templateUrl: './procurement-list.html',
})
export class ProcurementList {
  private readonly service = inject(ProcurementService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;

  readonly priorities = PRIORITIES;
  readonly statuses = [
    'Pending',
    'Approved',
    'Rejected',
    'Ordered',
    'Delivered',
    'Completed',
    'Cancelled',
  ];

  readonly loading = signal(true);
  readonly requests = signal<ProcurementRequest[]>([]);
  readonly stats = signal<ProcurementStats | null>(null);

  search = '';
  statusFilter = '';
  priorityFilter = '';

  readonly columns = computed(() =>
    this.canEdit()
      ? [
          'request_number',
          'item',
          'quantity',
          'estimated_cost',
          'required_date',
          'priority',
          'vendor',
          'status',
          'actions',
        ]
      : [
          'request_number',
          'item',
          'quantity',
          'estimated_cost',
          'required_date',
          'priority',
          'vendor',
          'status',
        ],
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service
      .list({
        search: this.search,
        status: this.statusFilter,
        priority: this.priorityFilter,
      })
      .subscribe({
        next: (requests) => {
          this.requests.set(requests);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load procurement requests.');
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
    this.priorityFilter = '';
    this.load();
  }

  open(request: ProcurementRequest): void {
    void this.router.navigate(['/procurement', request.id]);
  }

  create(): void {
    this.dialog
      .open(ProcurementFormDialog, { width: '720px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  edit(request: ProcurementRequest, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ProcurementFormDialog, { width: '720px', data: request })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  approve(request: ProcurementRequest, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Approve ${request.request_number}?`,
          message:
            'Approving lets a purchase order be raised against this request.',
          confirmLabel: 'Approve request',
          promptLabel: 'Comments (optional)',
        },
      })
      .afterClosed()
      .subscribe((comments) => {
        if (comments === undefined) return;

        this.service.approve(request.id, comments as string).subscribe({
          next: () => {
            this.toast.success(`${request.request_number} approved.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not approve the request.'),
        });
      });
  }

  reject(request: ProcurementRequest, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Reject ${request.request_number}?`,
          message: 'A reason is required and is shown to the requester.',
          confirmLabel: 'Reject request',
          danger: true,
          promptLabel: 'Rejection reason',
          promptRequired: true,
        },
      })
      .afterClosed()
      .subscribe((reason) => {
        if (!reason) return;

        this.service.reject(request.id, reason as string).subscribe({
          next: () => {
            this.toast.success(`${request.request_number} rejected.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not reject the request.'),
        });
      });
  }

  assignVendor(request: ProcurementRequest, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(AssignVendorDialog, {
        data: {
          title: `Assign a vendor to ${request.request_number}`,
          preferredCategory: request.category,
          currentVendorId: request.assigned_vendor_id,
        },
      })
      .afterClosed()
      .subscribe((vendorId) => {
        if (!vendorId) return;

        this.service.assignVendor(request.id, vendorId as number).subscribe({
          next: (updated) => {
            this.toast.success(
              `${updated.request_number} assigned to ${updated.assigned_vendor_name}.`,
            );
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not assign the vendor.'),
        });
      });
  }

  cancel(request: ProcurementRequest, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Cancel ${request.request_number}?`,
          message: 'The request stays on file with status Cancelled.',
          confirmLabel: 'Cancel request',
          cancelLabel: 'Keep it',
          danger: true,
          promptLabel: 'Reason (optional)',
        },
      })
      .afterClosed()
      .subscribe((reason) => {
        if (reason === undefined) return;

        this.service.cancel(request.id, reason as string).subscribe({
          next: () => {
            this.toast.success(`${request.request_number} cancelled.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not cancel the request.'),
        });
      });
  }

  remove(request: ProcurementRequest, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${request.request_number}?`,
          message:
            'Requests that already have a purchase order cannot be deleted — ' +
            'cancel them instead.',
          confirmLabel: 'Delete request',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.service.remove(request.id).subscribe({
          next: (response) => {
            this.toast.success(response.message);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not delete the request.'),
        });
      });
  }
}
