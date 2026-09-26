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
import { RouterLink } from '@angular/router';

import { InvoiceService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Invoice } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { InvoiceFormDialog } from './invoice-form-dialog';

@Component({
  selector: 'app-invoice-list',
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
    RouterLink,
    StatusPill,
  ],
  templateUrl: './invoice-list.html',
})
export class InvoiceList {
  private readonly service = inject(InvoiceService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canManageFinance = this.auth.canManageFinance;
  readonly statuses = ['Pending', 'Approved', 'Paid', 'Overdue', 'Disputed'];

  readonly loading = signal(true);
  readonly invoices = signal<Invoice[]>([]);

  search = '';
  statusFilter = '';

  readonly columns = computed(() =>
    this.canManageFinance()
      ? [
          'invoice_number',
          'vendor',
          'po_number',
          'invoice_date',
          'due_date',
          'total',
          'status',
          'actions',
        ]
      : [
          'invoice_number',
          'vendor',
          'po_number',
          'invoice_date',
          'due_date',
          'total',
          'status',
        ],
  );

  readonly totals = computed(() => {
    const invoices = this.invoices();

    const outstanding = invoices
      .filter((i) => i.status !== 'Paid')
      .reduce((sum, i) => sum + Number(i.total_amount), 0);

    const paid = invoices
      .filter((i) => i.status === 'Paid')
      .reduce((sum, i) => sum + Number(i.total_amount), 0);

    return { outstanding, paid, count: invoices.length };
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service
      .list({ search: this.search, status: this.statusFilter })
      .subscribe({
        next: (invoices) => {
          this.invoices.set(invoices);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load invoices.');
        },
      });
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = '';
    this.load();
  }

  create(): void {
    this.dialog
      .open(InvoiceFormDialog, { width: '620px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  setStatus(invoice: Invoice, status: string): void {
    this.service.update(invoice.id, { status }).subscribe({
      next: (updated) => {
        this.toast.success(
          `${updated.invoice_number} marked ${updated.status}.`,
        );
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not update the invoice.'),
    });
  }

  remove(invoice: Invoice): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${invoice.invoice_number}?`,
          message: 'Paid invoices cannot be deleted.',
          confirmLabel: 'Delete invoice',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.service.remove(invoice.id).subscribe({
          next: (response) => {
            this.toast.success(response.message);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not delete the invoice.'),
        });
      });
  }
}
