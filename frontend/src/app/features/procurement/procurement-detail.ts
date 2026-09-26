import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';

import { ProcurementService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ProcurementRequestDetail } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { AssignVendorDialog } from './assign-vendor-dialog';
import { ProcurementFormDialog } from './procurement-form-dialog';

@Component({
  selector: 'app-procurement-detail',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './procurement-detail.html',
})
export class ProcurementDetail {
  private readonly service = inject(ProcurementService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;

  readonly loading = signal(true);
  readonly request = signal<ProcurementRequestDetail | null>(null);

  constructor() {
    queueMicrotask(() => this.load());
  }

  load(): void {
    this.loading.set(true);

    this.service.get(Number(this.id())).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the request.');
      },
    });
  }

  edit(): void {
    const request = this.request();
    if (!request) return;

    this.dialog
      .open(ProcurementFormDialog, { width: '720px', data: request })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  approve(): void {
    const request = this.request();
    if (!request) return;

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
            this.toast.success('Request approved.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not approve the request.'),
        });
      });
  }

  reject(): void {
    const request = this.request();
    if (!request) return;

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
            this.toast.success('Request rejected.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not reject the request.'),
        });
      });
  }

  assignVendor(): void {
    const request = this.request();
    if (!request) return;

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
          next: () => {
            this.toast.success('Vendor assigned.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not assign the vendor.'),
        });
      });
  }

  cancel(): void {
    const request = this.request();
    if (!request) return;

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
            this.toast.success('Request cancelled.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not cancel the request.'),
        });
      });
  }

  /** Opens the purchase order screen prefilled from this request. */
  raisePurchaseOrder(): void {
    const request = this.request();
    if (!request) return;

    void this.router.navigate(['/purchase-orders'], {
      queryParams: { fromRequest: request.id },
    });
  }
}
