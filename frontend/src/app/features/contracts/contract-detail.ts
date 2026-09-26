import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';

import { ContractService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Certification, ContractDetail as ContractDetailModel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusPill } from '../../shared/status-pill';
import { ContractFormDialog } from './contract-form-dialog';
import { ContractRenewDialog } from './contract-renew-dialog';

const CHECK_TYPES = [
  'Documentation',
  'Certification',
  'Delivery Terms',
  'Payment Terms',
  'Quality',
  'Regulatory',
];

@Component({
  selector: 'app-contract-detail',
  providers: [provideNativeDateAdapter()],
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './contract-detail.html',
})
export class ContractDetail {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContractService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  readonly canEdit = this.auth.canEdit;
  readonly canApprove = this.auth.canApprove;

  readonly checkTypes = CHECK_TYPES;
  readonly results = ['Compliant', 'Partial', 'Non-Compliant'];

  readonly loading = signal(true);
  readonly contract = signal<ContractDetailModel | null>(null);
  readonly certifications = signal<Certification[]>([]);
  readonly savingCheck = signal(false);

  readonly checkForm = this.fb.nonNullable.group({
    check_type: ['Documentation', Validators.required],
    result: ['Compliant', Validators.required],
    remarks: [''],
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  load(): void {
    this.loading.set(true);

    this.service.get(Number(this.id())).subscribe({
      next: (contract) => {
        this.contract.set(contract);
        this.loading.set(false);

        this.service.certifications(contract.vendor_id).subscribe({
          next: (certifications) => this.certifications.set(certifications),
          error: () => this.certifications.set([]),
        });
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the contract.');
      },
    });
  }

  edit(): void {
    const contract = this.contract();
    if (!contract) return;

    this.dialog
      .open(ContractFormDialog, { width: '760px', data: contract })
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  renew(): void {
    const contract = this.contract();
    if (!contract) return;

    this.dialog
      .open(ContractRenewDialog, { width: '560px', data: contract })
      .afterClosed()
      .subscribe((successor) => {
        if (successor) {
          this.toast.success(
            `Renewed as ${(successor as ContractDetailModel).contract_number}.`,
          );
          void this.router.navigate([
            '/contracts',
            (successor as ContractDetailModel).id,
          ]);
        }
      });
  }

  terminate(): void {
    const contract = this.contract();
    if (!contract) return;

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
            this.toast.success('Contract terminated.');
            this.load();
          },
          error: (error) =>
            this.toast.fromError(error, 'Could not terminate the contract.'),
        });
      });
  }

  recordCheck(): void {
    const contract = this.contract();
    if (!contract || this.checkForm.invalid || this.savingCheck()) return;

    this.savingCheck.set(true);

    const raw = this.checkForm.getRawValue();

    this.service
      .recordComplianceCheck(contract.id, {
        check_type: raw.check_type,
        result: raw.result,
        remarks: raw.remarks || undefined,
      })
      .subscribe({
        next: () => {
          this.savingCheck.set(false);
          this.checkForm.patchValue({ remarks: '' });
          this.toast.success('Compliance check recorded.');
          this.load();
        },
        error: (error) => {
          this.savingCheck.set(false);
          this.toast.fromError(error, 'Could not record the compliance check.');
        },
      });
  }
}
