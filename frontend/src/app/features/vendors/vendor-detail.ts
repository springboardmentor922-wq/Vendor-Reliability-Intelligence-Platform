import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';

import {
  ContractService,
  PurchaseOrderService,
  VendorService,
} from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  Certification,
  Contract,
  PurchaseOrder,
  VendorDetail as VendorDetailModel,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { VendorFormDialog } from './vendor-form-dialog';
import { VendorReliabilityPanel } from './vendor-reliability-panel';

@Component({
  selector: 'app-vendor-detail',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatDialogModule,
    MatDividerModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    RouterLink,
    StatusPill,
    VendorReliabilityPanel,
  ],
  templateUrl: './vendor-detail.html',
})
export class VendorDetail {
  private readonly service = inject(VendorService);
  private readonly poService = inject(PurchaseOrderService);
  private readonly contractService = inject(ContractService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;

  readonly loading = signal(true);
  readonly vendor = signal<VendorDetailModel | null>(null);
  readonly orders = signal<PurchaseOrder[]>([]);
  readonly contracts = signal<Contract[]>([]);
  readonly certifications = signal<Certification[]>([]);

  constructor() {
    // `input()` resolves before the first render pass under component
    // input binding, so a plain load in the constructor is safe here.
    queueMicrotask(() => this.load());
  }

  load(): void {
    const vendorId = Number(this.id());
    this.loading.set(true);

    this.service.get(vendorId).subscribe({
      next: (vendor) => {
        this.vendor.set(vendor);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the vendor.');
      },
    });

    this.poService.list({ vendor_id: vendorId }).subscribe({
      next: (orders) => this.orders.set(orders),
      error: () => this.orders.set([]),
    });

    this.contractService.list({ vendor_id: vendorId }).subscribe({
      next: (contracts) => this.contracts.set(contracts),
      error: () => this.contracts.set([]),
    });

    this.contractService.certifications(vendorId).subscribe({
      next: (certifications) => this.certifications.set(certifications),
      error: () => this.certifications.set([]),
    });
  }

  edit(): void {
    const vendor = this.vendor();
    if (!vendor) return;

    this.dialog
      .open(VendorFormDialog, { width: '760px', data: vendor })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  approve(): void {
    const vendor = this.vendor();
    if (!vendor) return;

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

        this.service.approve(vendor.id, comments as string).subscribe({
          next: () => {
            this.toast.success('Vendor approved.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not approve the vendor.'),
        });
      });
  }

  reject(): void {
    const vendor = this.vendor();
    if (!vendor) return;

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

        this.service.reject(vendor.id, reason as string).subscribe({
          next: () => {
            this.toast.success('Vendor rejected.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not reject the vendor.'),
        });
      });
  }

  suspend(): void {
    const vendor = this.vendor();
    if (!vendor) return;

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Suspend ${vendor.vendor_name}?`,
          message: 'Suspended vendors cannot be assigned new work.',
          confirmLabel: 'Suspend',
          danger: true,
          promptLabel: 'Reason',
          promptRequired: true,
        },
      })
      .afterClosed()
      .subscribe((reason) => {
        if (!reason) return;

        this.service.suspend(vendor.id, reason as string).subscribe({
          next: () => {
            this.toast.success('Vendor suspended.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not suspend the vendor.'),
        });
      });
  }

  reactivate(): void {
    const vendor = this.vendor();
    if (!vendor) return;

    this.service.reactivate(vendor.id).subscribe({
      next: () => {
        this.toast.success('Vendor reactivated.');
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not reactivate the vendor.'),
    });
  }
}
