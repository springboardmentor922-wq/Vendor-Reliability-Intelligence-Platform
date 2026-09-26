import { DecimalPipe } from '@angular/common';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { VendorService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { VENDOR_CATEGORIES, Vendor, VendorStats } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { VendorFormDialog } from './vendor-form-dialog';

@Component({
  selector: 'app-vendor-list',
  imports: [
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
    MatTooltipModule,
    StatusPill,
  ],
  templateUrl: './vendor-list.html',
})
export class VendorList {
  private readonly service = inject(VendorService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;
  readonly isAdmin = this.auth.isAdmin;

  readonly categories = VENDOR_CATEGORIES;
  readonly statuses = ['Pending', 'Approved', 'Rejected', 'Suspended', 'Inactive'];

  readonly loading = signal(true);
  readonly vendors = signal<Vendor[]>([]);
  readonly stats = signal<VendorStats | null>(null);

  search = '';
  statusFilter = '';
  categoryFilter = '';

  readonly columns = computed(() =>
    this.canEdit()
      ? [
          'vendor_code',
          'vendor_name',
          'category',
          'location',
          'status',
          'risk_level',
          'score',
          'actions',
        ]
      : [
          'vendor_code',
          'vendor_name',
          'category',
          'location',
          'status',
          'risk_level',
          'score',
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
        category: this.categoryFilter,
      })
      .subscribe({
        next: (vendors) => {
          this.vendors.set(vendors);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load vendors.');
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
    this.categoryFilter = '';
    this.load();
  }

  open(vendor: Vendor): void {
    void this.router.navigate(['/vendors', vendor.id]);
  }

  register(): void {
    this.dialog
      .open(VendorFormDialog, { width: '760px', autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }

  edit(vendor: Vendor, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(VendorFormDialog, { width: '760px', data: vendor })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.load();
        }
      });
  }

  approve(vendor: Vendor, event: Event): void {
    event.stopPropagation();

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
        if (comments === undefined) {
          return;
        }

        this.service.approve(vendor.id, comments as string).subscribe({
          next: () => {
            this.toast.success(`${vendor.vendor_name} approved.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not approve the vendor.'),
        });
      });
  }

  reject(vendor: Vendor, event: Event): void {
    event.stopPropagation();

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
        if (!reason) {
          return;
        }

        this.service.reject(vendor.id, reason as string).subscribe({
          next: () => {
            this.toast.success(`${vendor.vendor_name} rejected.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not reject the vendor.'),
        });
      });
  }

  suspend(vendor: Vendor, event: Event): void {
    event.stopPropagation();

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
        if (!reason) {
          return;
        }

        this.service.suspend(vendor.id, reason as string).subscribe({
          next: () => {
            this.toast.success(`${vendor.vendor_name} suspended.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not suspend the vendor.'),
        });
      });
  }

  reactivate(vendor: Vendor, event: Event): void {
    event.stopPropagation();

    this.service.reactivate(vendor.id).subscribe({
      next: () => {
        this.toast.success(`${vendor.vendor_name} reactivated.`);
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not reactivate the vendor.'),
    });
  }

  remove(vendor: Vendor, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${vendor.vendor_name}?`,
          message:
            'Vendors with purchase orders or contracts are marked Inactive ' +
            'instead of being deleted, so history is preserved.',
          confirmLabel: 'Delete vendor',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.service.remove(vendor.id).subscribe({
          next: (response) => {
            this.toast.success(response.message);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not delete the vendor.'),
        });
      });
  }
}
