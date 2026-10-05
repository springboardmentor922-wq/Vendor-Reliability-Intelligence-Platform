import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';

import { ProcurementService, PurchaseOrderService, VendorService } from '../../core/api.service';
import { ReliabilityService } from '../../core/api-m3.service';
import { AuthService } from '../../core/auth.service';
import { LiveService } from '../../core/live.service';
import { ProcurementRequest, Vendor } from '../../core/models';
import { RankingRow, VendorRecommendation } from '../../core/models-m3';
import { ToastService } from '../../core/toast.service';
import { CountUp } from '../../shared/viz/count-up';
import { money } from '../../shared/viz/format';

const DRAFT_KEY = 'vendoriq.po-draft';

export const DEPARTMENTS = [
  'Production',
  'Operations',
  'Information Technology',
  'Logistics',
  'Maintenance',
  'Quality Assurance',
  'Finance',
  'Human Resources',
  'Administration',
  'Research & Development',
  'Sales & Marketing',
];

const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance Payment', '50% Advance, 50% on Delivery', 'Cash on Delivery'];
const UNITS = ['Units', 'Pieces', 'Kits', 'Boxes', 'Tonnes', 'Kg', 'Litres', 'Metres', 'Hours', 'Days', 'Licences', 'Trips', 'Lots'];
const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'];

function today(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/**
 * Create Purchase Order - full-page form following the "Order Creation
 * Format" reference: order details, line items with per-line tax, a live
 * order summary, and the vendor's reliability intelligence beside the
 * vendor picker so the buyer sees risk before committing.
 */
@Component({
  selector: 'app-create-purchase-order',
  imports: [
    CountUp,
    DecimalPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './create-purchase-order.html',
  styleUrl: './create-purchase-order.scss',
})
export class CreatePurchaseOrder {
  private readonly fb = inject(FormBuilder);
  private readonly orders = inject(PurchaseOrderService);
  private readonly vendorsApi = inject(VendorService);
  private readonly requestsApi = inject(ProcurementService);
  private readonly reliability = inject(ReliabilityService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly live = inject(LiveService);
  readonly user = inject(AuthService).user;

  readonly departments = DEPARTMENTS;
  readonly paymentTerms = PAYMENT_TERMS;
  readonly units = UNITS;
  readonly currencies = CURRENCIES;

  readonly vendors = signal<Vendor[]>([]);
  readonly requests = signal<ProcurementRequest[]>([]);
  readonly ranking = signal<Map<number, RankingRow>>(new Map());
  readonly advice = signal<VendorRecommendation | null>(null);
  readonly saving = signal(false);
  readonly draftSavedAt = signal<string | null>(null);

  readonly form = this.fb.group({
    order_date: [today(), Validators.required],
    expected_delivery: [today(14), Validators.required],
    procurement_request_id: [null as number | null],
    department: ['', Validators.required],
    vendor_id: [null as number | null, Validators.required],
    payment_terms: ['Net 30'],
    currency: ['USD'],
    title: ['', Validators.maxLength(200)],
    shipping_address: ['', Validators.required],
    same_as_shipping: [true],
    billing_address: [''],
    shipping_amount: [0, [Validators.min(0)]],
    notes: ['', Validators.maxLength(500)],
    items: this.fb.array([this.newItem()]),
  });

  get items(): FormArray {
    return this.form.controls.items as FormArray;
  }

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {
    initialValue: this.form.value,
  });

  readonly lines = computed(() =>
    (this.formValue().items ?? []).map((i: any) => {
      const qty = Number(i?.quantity) || 0;
      const price = Number(i?.unit_price) || 0;
      const rate = Number(i?.tax_rate) || 0;
      const net = qty * price;
      return { net, tax: (net * rate) / 100, total: net + (net * rate) / 100 };
    }),
  );

  readonly subtotal = computed(() => this.lines().reduce((s, l) => s + l.net, 0));
  readonly tax = computed(() => this.lines().reduce((s, l) => s + l.tax, 0));
  readonly shipping = computed(() => Number(this.formValue().shipping_amount) || 0);
  readonly total = computed(() => this.subtotal() + this.tax() + this.shipping());
  readonly currency = computed(() => this.formValue().currency || 'USD');
  readonly remarksLength = computed(() => (this.formValue().notes ?? '').length);
  readonly effectiveTaxRate = computed(() => (this.subtotal() ? (100 * this.tax()) / this.subtotal() : 0));

  readonly selectedVendor = computed(() => this.vendors().find((v) => v.id === this.formValue().vendor_id) ?? null);
  readonly selectedScore = computed(() => {
    const id = this.formValue().vendor_id;
    return id ? this.ranking().get(id) ?? null : null;
  });
  readonly selectedRequest = computed(
    () => this.requests().find((r) => r.id === this.formValue().procurement_request_id) ?? null,
  );

  readonly fmtMoney = (v: number) => money(v, this.currency(), false);

  constructor() {
    this.vendorsApi.list({ status: 'Approved' }).subscribe({
      next: (vendors) => this.vendors.set([...vendors].sort((a, b) => a.vendor_name.localeCompare(b.vendor_name))),
    });
    this.requestsApi.list({ status: 'Approved' }).subscribe({ next: (r) => this.requests.set(r) });
    this.reliability.ranking({ limit: 200 }).subscribe({
      next: (rows) => this.ranking.set(new Map(rows.map((r) => [r.vendor_id, r]))),
    });

    this.form.controls.vendor_id.valueChanges.subscribe((id) => {
      this.advice.set(null);
      if (id) this.reliability.recommendation(id).subscribe({ next: (a) => this.advice.set(a), error: () => undefined });
    });

    this.form.controls.procurement_request_id.valueChanges.subscribe((id) => this.applyRequest(id));

    const fromRequest = Number(this.route.snapshot.queryParamMap.get('fromRequest'));
    if (fromRequest) {
      this.form.controls.procurement_request_id.setValue(fromRequest);
    } else {
      this.restoreDraft();
    }
  }

  newItem(values: Partial<{ item_name: string; quantity: number; unit: string; unit_price: number; tax_rate: number }> = {}) {
    return this.fb.group({
      item_name: [values.item_name ?? '', [Validators.required, Validators.maxLength(200)]],
      quantity: [values.quantity ?? 1, [Validators.required, Validators.min(0.01)]],
      unit: [values.unit ?? 'Units'],
      unit_price: [values.unit_price ?? 0, [Validators.required, Validators.min(0)]],
      tax_rate: [values.tax_rate ?? 18, [Validators.min(0), Validators.max(100)]],
    });
  }

  addItem(): void {
    this.items.push(this.newItem());
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  riskClass(level: string | undefined | null): string {
    return `risk-tag ${level ?? 'Medium'}`;
  }

  private applyRequest(id: number | null): void {
    // The requests list may still be loading when arriving from a request.
    const find = () => this.requests().find((r) => r.id === id);
    const apply = (request: ProcurementRequest) => {
      this.form.patchValue({
        department: request.department && DEPARTMENTS.includes(request.department) ? request.department : this.form.value.department,
        vendor_id: request.assigned_vendor_id ?? this.form.value.vendor_id,
        title: request.item,
        currency: request.currency || 'USD',
        expected_delivery: request.required_date ?? this.form.value.expected_delivery,
      });
      this.items.clear();
      this.items.push(
        this.newItem({
          item_name: request.item,
          quantity: Number(request.quantity),
          unit: UNITS.includes(request.unit) ? request.unit : 'Units',
          unit_price: request.quantity ? Math.round((100 * Number(request.estimated_cost)) / Number(request.quantity)) / 100 : 0,
        }),
      );
    };

    if (!id) return;
    const hit = find();
    if (hit) {
      apply(hit);
    } else {
      this.requestsApi.get(id).subscribe({ next: (r) => {
        this.requests.update((list) => (list.some((x) => x.id === r.id) ? list : [r, ...list]));
        apply(r);
      } });
    }
  }

  // ---------------------------------------------------------------- draft

  saveDraft(): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), value: this.form.getRawValue() }));
      this.draftSavedAt.set(new Date().toLocaleTimeString());
      this.toast.success('Draft saved on this device. It will be restored next time you open this screen.');
    } catch {
      this.toast.error('Could not save the draft in this browser.');
    }
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const { savedAt, value } = JSON.parse(raw);
      this.items.clear();
      for (const item of value.items ?? []) this.items.push(this.newItem(item));
      if (this.items.length === 0) this.items.push(this.newItem());
      this.form.patchValue({ ...value, items: undefined });
      this.draftSavedAt.set(new Date(savedAt).toLocaleString());
    } catch {
      /* ignore a corrupt draft */
    }
  }

  discardDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    this.draftSavedAt.set(null);
    this.form.reset({
      order_date: today(),
      expected_delivery: today(14),
      payment_terms: 'Net 30',
      currency: 'USD',
      same_as_shipping: true,
      shipping_amount: 0,
    });
    this.items.clear();
    this.items.push(this.newItem());
  }

  // ---------------------------------------------------------------- submit

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.toast.error('Please complete the highlighted fields.');
      return;
    }

    const v = this.form.getRawValue();

    if (v.expected_delivery && v.order_date && v.expected_delivery < v.order_date) {
      this.toast.error('Expected delivery cannot be before the order date.');
      return;
    }

    this.saving.set(true);

    this.orders
      .create({
        vendor_id: v.vendor_id!,
        procurement_request_id: v.procurement_request_id,
        title: v.title || (v.items[0] as any)?.item_name || null,
        order_date: v.order_date,
        expected_delivery: v.expected_delivery,
        currency: v.currency || 'USD',
        shipping_amount: Number(v.shipping_amount) || 0,
        payment_terms: v.payment_terms,
        shipping_address: v.shipping_address,
        billing_address: v.same_as_shipping ? v.shipping_address : v.billing_address,
        department: v.department,
        notes: v.notes || null,
        items: (v.items as any[]).map((i) => ({
          item_name: i.item_name,
          quantity: Number(i.quantity),
          unit: i.unit,
          unit_price: Number(i.unit_price),
          tax_rate: Number(i.tax_rate) || 0,
        })),
      })
      .subscribe({
        next: (po) => {
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {
            /* ignore */
          }
          this.toast.success(`${po.po_number} submitted for approval.`);
          this.live.poke();
          void this.router.navigate(['/purchase-orders', po.id]);
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.fromError(error, 'The purchase order could not be created.');
        },
      });
  }
}
