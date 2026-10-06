import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ContractService } from '../../core/services/contract.service';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';

import {
  Contract,
  ContractStatus,
  Vendor,
} from '../../core/models/models';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './contracts.component.html',
})
export class ContractsComponent implements OnInit {

  private fb = inject(FormBuilder);

  contracts: Contract[] = [];
  vendors: Vendor[] = [];

  loading = true;
  error = '';

  showForm = false;
  submitting = false;

  statusFilter = '';

  statuses: ContractStatus[] = [
    'active',
    'expiring',
    'expired',
    'renewed',
    'terminated',
  ];

  form = this.fb.group({
    vendor_id: [
      '',
      Validators.required,
    ],

    title: [
      '',
      Validators.required,
    ],

    description: [''],

    start_date: [
      '',
      Validators.required,
    ],

    end_date: [
      '',
      Validators.required,
    ],

    value: [
      0,
      [
        Validators.required,
        Validators.min(0),
      ],
    ],
  });

  constructor(
    private contractService: ContractService,
    private vendorService: VendorService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();

    /*
     * Vendor dropdown is only needed
     * for users who can manage contracts.
     */
    if (this.canManage()) {
      this.vendorService
        .list({
          status_filter: 'approved',
        })
        .subscribe({
          next: (vendors) => {
            this.vendors = vendors;
          },

          error: () => {
            this.vendors = [];
          },
        });
    }
  }

  load(): void {
    this.loading = true;
    this.error = '';

    const currentUser = this.auth.currentUser();

    /*
     * VENDOR
     * Find the Vendor record using User.id -> Vendor.user_id.
     */
    if (currentUser?.role === 'vendor') {

      this.vendorService
        .list({})
        .subscribe({

          next: (vendors) => {

            const currentVendor = vendors.find(
              (vendor) =>
                vendor.user_id === currentUser.id
            );

            if (!currentVendor) {
              this.error =
                'Vendor profile is not linked to this account.';
              this.loading = false;
              return;
            }

            /*
             * Load only contracts belonging
             * to the logged-in vendor.
             */
            this.contractService
              .list({
                vendor_id: currentVendor.id,
                status_filter: this.statusFilter,
              })
              .subscribe({

                next: (contracts) => {
                  this.contracts = contracts;
                  this.loading = false;
                },

                error: (err) => {
                  console.error(
                    'Vendor contracts error:',
                    err
                  );

                  this.error =
                    'Failed to load your contracts.';

                  this.loading = false;
                },

              });
          },

          error: (err) => {
            console.error(
              'Vendor lookup error:',
              err
            );

            this.error =
              'Failed to identify your vendor profile.';

            this.loading = false;
          },

        });

      return;
    }

    /*
     * ADMIN / PROCUREMENT MANAGER /
     * SUPPLY CHAIN MANAGER / FINANCE / AUDITOR
     *
     * Load all contracts.
     */
    this.contractService
      .list({
        status_filter: this.statusFilter,
      })
      .subscribe({

        next: (contracts) => {
          this.contracts = contracts;
          this.loading = false;
        },

        error: (err) => {
          console.error(
            'Contracts error:',
            err
          );

          this.error =
            'Failed to load contracts.';

          this.loading = false;
        },

      });
  }

  canManage(): boolean {
    return this.auth.hasAnyRole([
      'administrator',
      'procurement_manager',
      'supply_chain_manager',
    ]);
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  submit(): void {

    if (this.form.invalid) {
      return;
    }

    this.submitting = true;
    this.error = '';

    this.contractService
      .create(this.form.value as any)
      .subscribe({

        next: () => {

          this.submitting = false;
          this.showForm = false;

          this.form.reset({
            vendor_id: '',
            title: '',
            description: '',
            start_date: '',
            end_date: '',
            value: 0,
          });

          this.load();
        },

        error: (err) => {

          this.submitting = false;

          this.error =
            err?.error?.detail ||
            'Failed to create contract.';
        },

      });
  }

  renew(contract: Contract): void {

    const newDate = prompt(
      'New end date (YYYY-MM-DD):',
      contract.end_date?.substring(0, 10)
    );

    if (!newDate) {
      return;
    }

    this.contractService
      .renew(
        contract.id,
        new Date(newDate).toISOString()
      )
      .subscribe({

        next: () => {
          this.load();
        },

        error: (err) => {

          this.error =
            err?.error?.detail ||
            'Failed to renew contract.';
        },

      });
  }

  vendorName(id: string): string {

    const vendor = this.vendors.find(
      (v) => v.id === id
    );

    return (
      vendor?.company_name ||
      `Vendor #${id}`
    );
  }

  statusBadgeClass(
    status: ContractStatus
  ): string {

    switch (status) {

      case 'active':
      case 'renewed':
        return 'bg-success';

      case 'expiring':
        return 'bg-warning text-dark';

      case 'expired':
      case 'terminated':
        return 'bg-danger';

      default:
        return 'bg-secondary';
    }
  }
}