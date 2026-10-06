import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormArray,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { PurchaseOrderService } from '../../core/services/purchase-order.service';
import { VendorService } from '../../core/services/vendor.service';
import { AuthService } from '../../core/services/auth.service';

import {
  Invoice,
  POStatus,
  PurchaseOrder,
  Vendor,
} from '../../core/models/models';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './purchase-orders.component.html',
})
export class PurchaseOrdersComponent implements OnInit {
  private fb = inject(FormBuilder);

  orders: PurchaseOrder[] = [];
  vendors: Vendor[] = [];

  loading = true;
  error = '';

  showForm = false;
  submitting = false;

  statusFilter = '';

  expandedOrder: PurchaseOrder | null = null;

  invoicesByPo: Record<number, Invoice[]> = {};

  statuses: POStatus[] = [
    'pending',
    'approved',
    'ordered',
    'delivered',
    'completed',
    'cancelled',
  ];

  form: FormGroup = this.fb.group({
    vendor_id: ['', Validators.required],
    expected_delivery_date: [''],
    notes: [''],
    items: this.fb.array([
      this.newItem(),
    ]),
  });

  constructor(
    private poService: PurchaseOrderService,
    private vendorService: VendorService,
    public auth: AuthService
  ) {}

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  newItem(): FormGroup {
    return this.fb.group({
      item_name: ['', Validators.required],
      description: [''],
      quantity: [
        1,
        [
          Validators.required,
          Validators.min(1),
        ],
      ],
      unit_price: [
        0,
        [
          Validators.required,
          Validators.min(0),
        ],
      ],
    });
  }

  addItem(): void {
    this.items.push(this.newItem());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }

  ngOnInit(): void {
    this.load();

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

  load(): void {
    this.loading = true;
    this.error = '';

    this.poService
      .list({
        status_filter: this.statusFilter,
      })
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loading = false;
        },

        error: () => {
          this.error =
            'Failed to load purchase orders.';
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

    this.poService
      .create(this.form.value)
      .subscribe({
        next: () => {
          this.submitting = false;
          this.showForm = false;

          this.form.reset({
            vendor_id: '',
            expected_delivery_date: '',
            notes: '',
          });

          this.items.clear();
          this.items.push(this.newItem());

          this.load();
        },

        error: (err) => {
          this.submitting = false;

          this.error =
            err?.error?.detail ||
            'Failed to create purchase order.';
        },
      });
  }

  updateStatus(
    order: PurchaseOrder,
    status: POStatus
  ): void {
    this.poService
      .updateStatus(order.id, status)
      .subscribe({
        next: () => {
          this.load();
        },

        error: (err) => {
          this.error =
            err?.error?.detail ||
            'Failed to update purchase order status.';
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

  toggleExpand(order: PurchaseOrder): void {
    if (
      this.expandedOrder?.id === order.id
    ) {
      this.expandedOrder = null;
      return;
    }

    this.expandedOrder = order;

    if (!this.invoicesByPo[order.id]) {
      this.poService
        .listInvoices(order.id)
        .subscribe({
          next: (invoices) => {
            this.invoicesByPo[order.id] =
              invoices;
          },

          error: () => {
            this.invoicesByPo[order.id] = [];
          },
        });
    }
  }

  addInvoice(order: PurchaseOrder): void {
    const invoiceNumber = prompt(
      'Invoice number:'
    );

    if (!invoiceNumber) {
      return;
    }

    const amountInput = prompt(
      'Invoice amount (₹):',
      String(order.total_amount)
    );

    const amount = Number(
      amountInput || 0
    );

    if (amount <= 0) {
      return;
    }

    this.poService
      .createInvoice(order.id, {
        purchase_order_id: order.id,
        invoice_number: invoiceNumber,
        amount,
      })
      .subscribe({
        next: () => {
          this.poService
            .listInvoices(order.id)
            .subscribe({
              next: (invoices) => {
                this.invoicesByPo[order.id] =
                  invoices;
              },
            });
        },

        error: (err) => {
          this.error =
            err?.error?.detail ||
            'Failed to create invoice.';
        },
      });
  }

  nextStatuses(
    current: POStatus
  ): POStatus[] {
    const flow: Record<
      POStatus,
      POStatus[]
    > = {
      pending: [
        'approved',
        'cancelled',
      ],

      approved: [
        'ordered',
        'cancelled',
      ],

      ordered: [
        'delivered',
        'cancelled',
      ],

      delivered: [
        'completed',
      ],

      completed: [],

      cancelled: [],
    };

    return flow[current] || [];
  }

  statusBadgeClass(
    status: POStatus
  ): string {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-success';

      case 'pending':
        return 'bg-warning text-dark';

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