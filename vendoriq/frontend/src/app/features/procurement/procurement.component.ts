import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { ProcurementService } from '../../core/services/procurement.service';
import { VendorService } from '../../core/services/vendor.service';
import { PurchaseOrderService } from '../../core/services/purchase-order.service';
import { AuthService } from '../../core/services/auth.service';

import {
  ProcurementRequest,
  ProcurementStatus,
  Vendor,
  PurchaseOrder
} from '../../core/models/models';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './procurement.component.html',
})
export class ProcurementComponent implements OnInit {
  private fb = inject(FormBuilder);

  requests: ProcurementRequest[] = [];
  vendors: Vendor[] = [];
  purchaseOrders: PurchaseOrder[] = [];

  loading = true;
  error = '';
  showForm = false;
  submitting = false;
  statusFilter = '';

  statuses: ProcurementStatus[] = [
    'pending',
    'approved',
    'rejected',
    'ordered',
    'delivered',
    'completed',
    'cancelled'
  ];

  form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    department: [''],
    category: [''],
    quantity: [
      1,
      [
        Validators.required,
        Validators.min(1)
      ]
    ],
    unit: [''],
    estimated_budget: [
      0,
      [
        Validators.required,
        Validators.min(0)
      ]
    ],
    priority: ['medium'],
    required_date: [''],
  });

  constructor(
    private procurementService: ProcurementService,
    private vendorService: VendorService,
    private purchaseOrderService: PurchaseOrderService,
    public auth: AuthService
  ) {}

  get isAuditor(): boolean {
    return this.auth.currentUser()?.role === 'auditor';
  }

  /*
   * =========================================================
   * AUDITOR PROCUREMENT REVIEW KPIs
   * =========================================================
   */

  get totalRequests(): number {
    return this.requests.length;
  }

  get totalPOs(): number {
    return this.purchaseOrders.length;
  }

  get procurementValue(): number {
    return this.requests.reduce(
      (total, request) =>
        total + Number(request.estimated_budget || 0),
      0
    );
  }

  get pendingRequests(): number {
    return this.requests.filter(
      request => request.status === 'pending'
    ).length;
  }

  get completionRate(): number {
    if (!this.requests.length) {
      return 0;
    }

    const completed = this.requests.filter(
      request => request.status === 'completed'
    ).length;

    return Math.round(
      (completed / this.requests.length) * 100
    );
  }

  ngOnInit(): void {
    this.load();

    /*
     * Keep vendor loading for the existing
     * Procurement Manager functionality.
     */
    this.vendorService
      .list({
        status_filter: 'approved'
      })
      .subscribe({
        next: (vendors) => {
          this.vendors = vendors;
        },
        error: () => {
          this.vendors = [];
        }
      });

    /*
     * Load actual Purchase Orders from the database.
     * Used by Auditor Procurement Review.
     */
    this.purchaseOrderService
      .list()
      .subscribe({
        next: (purchaseOrders) => {
          this.purchaseOrders = purchaseOrders;
        },
        error: () => {
          this.purchaseOrders = [];
        }
      });
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.procurementService
      .list({
        status_filter: this.statusFilter
      })
      .subscribe({
        next: (requests) => {
          this.requests = requests;
          this.loading = false;
        },
        error: () => {
          this.error =
            'Failed to load procurement requests.';
          this.loading = false;
        },
      });
  }

  canApprove(): boolean {
    return this.auth.hasAnyRole([
      'administrator',
      'procurement_manager'
    ]);
  }

  toggleForm(): void {
    /*
     * Auditor is read-only.
     */
    if (this.isAuditor) {
      return;
    }

    this.showForm = !this.showForm;
  }

  submit(): void {
    /*
     * Auditor cannot create requests.
     */
    if (this.isAuditor) {
      return;
    }

    if (this.form.invalid) {
      return;
    }

    this.submitting = true;

    const payload = {
      ...this.form.value
    };

    if (!payload.required_date) {
      delete (payload as any).required_date;
    }

    this.procurementService
      .create(payload as any)
      .subscribe({
        next: () => {
          this.submitting = false;
          this.showForm = false;

          this.form.reset({
            quantity: 1,
            estimated_budget: 0,
            priority: 'medium'
          });

          this.load();
        },
        error: (err) => {
          this.submitting = false;
          this.error =
            err?.error?.detail ||
            'Failed to create request.';
        },
      });
  }

  approve(
    req: ProcurementRequest,
    status: ProcurementStatus
  ): void {
    /*
     * Auditor cannot approve/reject.
     */
    if (this.isAuditor) {
      return;
    }

    const notes =
      prompt(
        `Notes for setting "${req.title}" to "${status}" (optional):`
      ) || undefined;

    this.procurementService
      .setApproval(
        req.id,
        status,
        notes
      )
      .subscribe({
        next: () => {
          this.load();
        },
        error: (err) => {
          this.error =
            err?.error?.detail ||
            'Failed to update procurement status.';
        }
      });
  }

  assignVendor(
    req: ProcurementRequest,
    vendorId: string
  ): void {
    /*
     * Auditor cannot assign vendors.
     */
    if (this.isAuditor) {
      return;
    }

    if (!vendorId) {
      return;
    }

    this.procurementService
      .assignVendor(
        req.id,
        vendorId
      )
      .subscribe({
        next: () => {
          this.load();
        },
        error: (err) => {
          this.error =
            err?.error?.detail ||
            'Failed to assign vendor.';
        }
      });
  }

  statusBadgeClass(
    status: ProcurementStatus
  ): string {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-success';

      case 'pending':
        return 'bg-warning text-dark';

      case 'rejected':
      case 'cancelled':
        return 'bg-danger';

      case 'ordered':
        return 'bg-info text-dark';

      case 'delivered':
        return 'bg-primary';

      default:
        return 'bg-secondary';
    }
  }
}