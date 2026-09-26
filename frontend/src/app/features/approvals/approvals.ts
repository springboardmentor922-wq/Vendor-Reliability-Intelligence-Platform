import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';

import { ProcurementService, VendorService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ProcurementRequest, Vendor } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';

/** Single place for everything sitting in a Pending state. */
@Component({
  selector: 'app-approvals',
  imports: [
    DatePipe,
    DecimalPipe,
    MatBadgeModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './approvals.html',
})
export class Approvals {
  private readonly vendorService = inject(VendorService);
  private readonly procurementService = inject(ProcurementService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canApprove = this.auth.canApprove;

  readonly loading = signal(true);
  readonly vendors = signal<Vendor[]>([]);
  readonly requests = signal<ProcurementRequest[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.vendorService.pendingApprovals().subscribe({
      next: (vendors) => {
        this.vendors.set(vendors);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load pending vendors.');
      },
    });

    this.procurementService.pendingApprovals().subscribe({
      next: (requests) => this.requests.set(requests),
      error: () => this.requests.set([]),
    });
  }

  approveVendor(vendor: Vendor): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Approve ${vendor.vendor_name}?`,
          message:
            'Approving lets this vendor be assigned to requests and receive ' +
            'purchase orders.',
          confirmLabel: 'Approve vendor',
          promptLabel: 'Comments (optional)',
        },
      })
      .afterClosed()
      .subscribe((comments) => {
        if (comments === undefined) return;

        this.vendorService.approve(vendor.id, comments as string).subscribe({
          next: () => {
            this.toast.success(`${vendor.vendor_name} approved.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not approve the vendor.'),
        });
      });
  }

  rejectVendor(vendor: Vendor): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Reject ${vendor.vendor_name}?`,
          message: 'A reason is required and is shown to the vendor.',
          confirmLabel: 'Reject vendor',
          danger: true,
          promptLabel: 'Rejection reason',
          promptRequired: true,
        },
      })
      .afterClosed()
      .subscribe((reason) => {
        if (!reason) return;

        this.vendorService.reject(vendor.id, reason as string).subscribe({
          next: () => {
            this.toast.success(`${vendor.vendor_name} rejected.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not reject the vendor.'),
        });
      });
  }

  approveRequest(request: ProcurementRequest): void {
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

        this.procurementService.approve(request.id, comments as string).subscribe({
          next: () => {
            this.toast.success(`${request.request_number} approved.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not approve the request.'),
        });
      });
  }

  rejectRequest(request: ProcurementRequest): void {
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

        this.procurementService.reject(request.id, reason as string).subscribe({
          next: () => {
            this.toast.success(`${request.request_number} rejected.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not reject the request.'),
        });
      });
  }
}
