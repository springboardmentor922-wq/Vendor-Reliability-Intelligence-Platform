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
import { Router, RouterLink } from '@angular/router';

import { ContractService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Contract, ContractStats } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { ContractFormDialog } from './contract-form-dialog';

@Component({
  selector: 'app-contract-list',
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
  templateUrl: './contract-list.html',
})
export class ContractList {
  private readonly service = inject(ContractService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;

  readonly statuses = [
    'Draft',
    'Active',
    'Expiring',
    'Expired',
    'Terminated',
    'Renewed',
  ];

  readonly complianceStatuses = [
    'Compliant',
    'Pending',
    'Non-Compliant',
    'Under Review',
  ];

  readonly loading = signal(true);
  readonly contracts = signal<Contract[]>([]);
  readonly stats = signal<ContractStats | null>(null);

  search = '';
  statusFilter = '';
  complianceFilter = '';

  readonly columns = computed(() =>
    this.canEdit()
      ? [
          'contract_number',
          'vendor',
          'type',
          'period',
          'value',
          'compliance',
          'status',
          'actions',
        ]
      : [
          'contract_number',
          'vendor',
          'type',
          'period',
          'value',
          'compliance',
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
        compliance_status: this.complianceFilter,
      })
      .subscribe({
        next: (contracts) => {
          this.contracts.set(contracts);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load contracts.');
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
    this.complianceFilter = '';
    this.load();
  }

  open(contract: Contract): void {
    void this.router.navigate(['/contracts', contract.id]);
  }

  create(): void {
    this.dialog
      .open(ContractFormDialog, { width: '760px' })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  edit(contract: Contract, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ContractFormDialog, { width: '760px', data: contract })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  runExpiryScan(): void {
    this.service.runExpiryScan().subscribe({
      next: (response) => {
        this.toast.success(response.message);
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not run the expiry scan.'),
    });
  }

  terminate(contract: Contract, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Terminate ${contract.contract_number}?`,
          message:
            'The contract stays on file with status Terminated so the record ' +
            'is preserved.',
          confirmLabel: 'Terminate',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.service.terminate(contract.id).subscribe({
          next: () => {
            this.toast.success(`${contract.contract_number} terminated.`);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not terminate the contract.'),
        });
      });
  }

  remove(contract: Contract, event: Event): void {
    event.stopPropagation();

    this.dialog
      .open(ConfirmDialog, {
        data: {
          title: `Delete ${contract.contract_number}?`,
          message:
            'Active contracts cannot be deleted — terminate them instead.',
          confirmLabel: 'Delete contract',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.service.remove(contract.id).subscribe({
          next: (response) => {
            this.toast.success(response.message);
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not delete the contract.'),
        });
      });
  }
}
