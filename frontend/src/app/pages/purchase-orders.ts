import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PurchaseOrder, Vendor } from '../core/api.service';
import { AuthService } from '../core/auth.service';

interface FormPOItem {
  item_name: string;
  quantity: number;
  unit_price: number;
}

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Purchase Order Registry</h1>
          <p class="page-desc">Track commitments, delivery status fulfillment, invoice tracking, and document audit trails</p>
        </div>
        <button
          id="create-po-modal-btn"
          class="btn btn-primary"
          (click)="openCreateModal()"
        >
          + Issue Purchase Order
        </button>
      </div>

      @if (actionMessage()) {
        <div class="alert alert-success" id="po-action-banner">
          <span>✅</span>
          <span>{{ actionMessage() }}</span>
        </div>
      }
      @if (errorMessage()) {
        <div class="alert alert-danger" id="po-error-banner">
          <span>⚠️</span>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Status Summary Tabs -->
      <div class="summary-cards">
        <div class="card summary-box">
          <span class="summary-label">Total Commitments</span>
          <div class="summary-val">{{ formatCurrency(calculateTotalSpend()) }}</div>
        </div>
        <div class="card summary-box">
          <span class="summary-label">Total Orders</span>
          <div class="summary-val">{{ purchaseOrders().length }}</div>
        </div>
        <div class="card summary-box">
          <span class="summary-label">In Fulfillment / Shipped</span>
          <div class="summary-val text-warning">{{ inTransitCount() }}</div>
        </div>
      </div>

      <!-- PO Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        @if (isLoading()) {
          <div class="empty-state">Loading purchase orders...</div>
        } @else if (purchaseOrders().length === 0) {
          <div class="empty-state" id="no-pos-found">
            <span style="font-size: 2rem;">📑</span>
            <p><strong>No purchase orders issued yet.</strong></p>
            <span style="color: var(--text-muted); font-size: 0.85rem;">
              Create your first PO by linking an approved vendor and defining line items.
            </span>
          </div>
        } @else {
          <div class="table-container">
            <table class="data-table" id="purchase-orders-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor Partner</th>
                  <th>Line Items</th>
                  <th>Total Amount</th>
                  <th>Delivery Status</th>
                  <th>Documents / Invoice</th>
                  <th>Issued Date</th>
                  <th class="text-right">Fulfillment Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (po of purchaseOrders(); track po.id) {
                  <tr>
                    <td>
                      <strong style="font-family: var(--font-mono); color: #60a5fa; font-size: 0.95rem;">
                        {{ po.po_number }}
                      </strong>
                    </td>
                    <td>
                      <strong>{{ getVendorName(po.vendor_id, po.vendor_name) }}</strong>
                    </td>
                    <td>
                      @if (po.items && po.items.length > 0) {
                        <span>{{ po.items.length }} line item(s)</span>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">
                          {{ po.items[0].item_name }} (x{{ po.items[0].quantity }})
                          @if (po.items.length > 1) {
                            <span> +{{ po.items.length - 1 }} more</span>
                          }
                        </div>
                      } @else {
                        <span style="color: var(--text-faint);">1 item bundle</span>
                      }
                    </td>
                    <td>
                      <strong style="font-size: 0.95rem; color: #38bdf8;">
                        {{ formatCurrency(po.total_amount) }}
                      </strong>
                    </td>
                    <td>
                      <span class="delivery-pill del-{{ po.delivery_status || 'in_progress' }}">
                        <span class="dot"></span>
                        <span>{{ formatDeliveryStatus(po.delivery_status || 'in_progress') }}</span>
                      </span>
                    </td>
                    <td>
                      <div class="doc-summary-cell">
                        @if (po.documents && po.documents.length > 0) {
                          <span class="badge badge-neutral badge-sm">📎 {{ po.documents.length }} doc(s)</span>
                        } @else {
                          <span class="text-muted text-xs">No files</span>
                        }
                        @if (po.invoice_amount) {
                          <span class="badge badge-success badge-sm" title="Invoice recorded">
                            Inv: {{ formatCurrency(po.invoice_amount) }}
                          </span>
                        }
                      </div>
                    </td>
                    <td style="color: var(--text-muted); font-size: 0.8rem;">
                      {{ po.created_at | date:'mediumDate' }}
                    </td>
                    <td class="text-right">
                      <div class="action-buttons">
                        <!-- Update Delivery Status Dropdown / Action -->
                        <select
                          class="delivery-select"
                          [ngModel]="po.delivery_status || 'in_progress'"
                          (ngModelChange)="onDeliveryStatusChange(po, $event)"
                          title="Update fulfillment stage"
                        >
                          <option value="in_progress">in_progress</option>
                          <option value="shipped">shipped</option>
                          <option value="partial_delivery">partial_delivery</option>
                          <option value="delivered">delivered</option>
                        </select>

                        <button
                          class="btn btn-secondary btn-xs"
                          (click)="openDocUploadModal(po)"
                          title="Attach invoice or delivery receipt"
                        >
                          Upload
                        </button>

                        @if (po.status !== 'COMPLETED' && po.status !== 'CANCELLED') {
                          <button
                            class="btn btn-primary btn-xs"
                            (click)="onCompletePO(po)"
                            title="Transition PO to Completed"
                          >
                            Complete
                          </button>
                          <button
                            class="btn btn-danger btn-xs"
                            (click)="onCancelPO(po)"
                            title="Cancel Purchase Order"
                          >
                            Cancel
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Create PO Modal -->
      @if (showCreateModal()) {
        <div class="modal-backdrop" (click)="showCreateModal.set(false)">
          <div class="modal-dialog modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Issue New Purchase Order</h3>
              <button class="btn btn-secondary btn-sm" (click)="showCreateModal.set(false)">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Vendor Partner *</label>
                <select id="modal-po-vendor" class="form-control" [(ngModel)]="selectedVendorId">
                  <option value="" disabled>Select Qualified Vendor</option>
                  @for (v of vendors(); track v.id) {
                    <option [value]="v.id">{{ v.company_name }} ({{ v.category }})</option>
                  }
                </select>
              </div>

              <div style="margin-top: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                  <h4 style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">PO Line Items</h4>
                  <button type="button" class="btn btn-secondary btn-xs" (click)="addLineItem()">
                    + Add Item
                  </button>
                </div>

                @for (item of formItems; track $index) {
                  <div class="item-row">
                    <div style="flex: 2;">
                      <input
                        type="text"
                        class="form-control"
                        placeholder="Item Description"
                        [(ngModel)]="item.item_name"
                      />
                    </div>
                    <div style="flex: 1;">
                      <input
                        type="number"
                        class="form-control"
                        placeholder="Qty"
                        min="1"
                        [(ngModel)]="item.quantity"
                      />
                    </div>
                    <div style="flex: 1;">
                      <input
                        type="number"
                        class="form-control"
                        placeholder="Unit Price ($)"
                        min="0"
                        [(ngModel)]="item.unit_price"
                      />
                    </div>
                    <div style="min-width: 90px; text-align: right; font-weight: 600; color: #38bdf8;">
                      {{ formatCurrency(item.quantity * item.unit_price) }}
                    </div>
                    @if (formItems.length > 1) {
                      <button class="btn btn-danger btn-xs" (click)="removeLineItem($index)">✕</button>
                    }
                  </div>
                }

                <div class="po-total-bar">
                  <span>Calculated PO Total:</span>
                  <strong class="total-val">{{ formatCurrency(calculateFormTotal()) }}</strong>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="showCreateModal.set(false)">Cancel</button>
              <button
                id="submit-po-btn"
                class="btn btn-primary"
                [disabled]="isSubmitting() || !selectedVendorId || formItems.length === 0"
                (click)="onSubmitPO()"
              >
                {{ isSubmitting() ? 'Issuing PO...' : 'Confirm & Issue PO' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Upload Document Modal -->
      @if (targetPOForDoc()) {
        <div class="modal-backdrop" (click)="targetPOForDoc.set(null)">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Attach Document to {{ targetPOForDoc()?.po_number }}</h3>
              <button class="btn btn-secondary btn-sm" (click)="targetPOForDoc.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Document Type *</label>
                <select class="form-control" [(ngModel)]="uploadDocType">
                  <option value="invoice">Invoice / Bill</option>
                  <option value="receipt">Payment Receipt</option>
                  <option value="proof_of_delivery">Proof of Delivery</option>
                  <option value="inspection">Inspection Certificate</option>
                </select>
              </div>

              <div class="form-group mt-3">
                <label class="form-label">Select File (PDF, DOCX, PNG, JPG) *</label>
                <input type="file" class="form-control" (change)="onFileSelected($event)" />
              </div>

              @if (uploadDocType === 'invoice') {
                <div class="form-group mt-3">
                  <label class="form-label">Invoice Billed Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    class="form-control"
                    placeholder="e.g. 5500.00"
                    [(ngModel)]="invoiceAmountInput"
                  />
                </div>
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="targetPOForDoc.set(null)">Cancel</button>
              <button
                class="btn btn-primary"
                [disabled]="isSubmitting() || !selectedUploadFile"
                (click)="submitPODocument()"
              >
                {{ isSubmitting() ? 'Uploading...' : 'Upload Document' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .page-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main);
    }
    .page-desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .summary-box {
      padding: 1.25rem 1.5rem;
    }
    .summary-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-val {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main);
      margin-top: 0.25rem;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .data-table th {
      background: rgba(15, 23, 42, 0.4);
      padding: 0.85rem 1.25rem;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-subtle);
    }
    .data-table td {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }
    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: var(--text-muted);
    }
    .delivery-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .delivery-pill .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .del-in_progress {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .del-in_progress .dot { background: #60a5fa; }
    .del-shipped {
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.3);
    }
    .del-shipped .dot { background: #c084fc; }
    .del-partial_delivery {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .del-partial_delivery .dot { background: #fbbf24; }
    .del-delivered {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .del-delivered .dot { background: #34d399; }
    .delivery-select {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: var(--text-main);
      font-size: 0.78rem;
      padding: 0.25rem 0.45rem;
      cursor: pointer;
    }
    .doc-summary-cell {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.4rem;
    }
    .item-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .po-total-bar {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: rgba(15, 23, 42, 0.6);
      border-radius: var(--radius-md);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-val {
      font-size: 1.2rem;
      color: #38bdf8;
    }
    .modal-lg {
      max-width: 680px;
    }
  `]
})
export class PurchaseOrdersComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly purchaseOrders = signal<PurchaseOrder[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly showCreateModal = signal<boolean>(false);
  readonly targetPOForDoc = signal<PurchaseOrder | null>(null);
  readonly actionMessage = signal<string>('');
  readonly errorMessage = signal<string>('');

  selectedVendorId = '';
  formItems: FormPOItem[] = [
    { item_name: '', quantity: 1, unit_price: 0 }
  ];

  uploadDocType = 'invoice';
  selectedUploadFile: File | null = null;
  invoiceAmountInput: number | null = null;

  readonly inTransitCount = computed(() => {
    return this.purchaseOrders().filter(po => po.delivery_status === 'shipped' || po.delivery_status === 'partial_delivery').length;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.api.getPurchaseOrders().subscribe({
      next: (orders) => {
        this.purchaseOrders.set(orders);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    this.api.getVendors().subscribe({
      next: (vList) => {
        this.vendors.set(vList);
        if (vList.length > 0 && !this.selectedVendorId) {
          this.selectedVendorId = vList[0].id;
        }
      }
    });
  }

  getVendorName(vendorId: string, fallbackName?: string): string {
    const v = this.vendors().find(x => x.id === vendorId);
    return v ? v.company_name : (fallbackName || 'Partner Vendor');
  }

  formatDeliveryStatus(status: string): string {
    return status.replace(/_/g, ' ').toUpperCase();
  }

  calculateTotalSpend(): number {
    return this.purchaseOrders().reduce((acc, po) => acc + (po.total_amount || 0), 0);
  }

  calculateFormTotal(): number {
    return this.formItems.reduce((acc, i) => acc + ((i.quantity || 0) * (i.unit_price || 0)), 0);
  }

  addLineItem(): void {
    this.formItems.push({ item_name: '', quantity: 1, unit_price: 0 });
  }

  removeLineItem(idx: number): void {
    this.formItems.splice(idx, 1);
  }

  openCreateModal(): void {
    this.formItems = [{ item_name: '', quantity: 1, unit_price: 0 }];
    if (this.vendors().length > 0) {
      this.selectedVendorId = this.vendors()[0].id;
    }
    this.showCreateModal.set(true);
  }

  onSubmitPO(): void {
    if (!this.selectedVendorId) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const items = this.formItems.filter(i => i.item_name.trim() !== '');
    this.api.createPurchaseOrder({
      vendor_id: this.selectedVendorId,
      items: items.length > 0 ? items : [{ item_name: 'General Procurement Package', quantity: 1, unit_price: 1000 }]
    }).subscribe({
      next: (po) => {
        this.isSubmitting.set(false);
        this.showCreateModal.set(false);
        this.actionMessage.set(`Purchase Order ${po.po_number} created successfully.`);
        this.loadData();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to issue purchase order');
      }
    });
  }

  onDeliveryStatusChange(po: PurchaseOrder, newStatus: string): void {
    this.api.updatePODeliveryStatus(po.id, newStatus).subscribe({
      next: (updated) => {
        this.actionMessage.set(`PO ${po.po_number} delivery status set to ${this.formatDeliveryStatus(newStatus)}`);
        this.loadData();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to update delivery status');
      }
    });
  }

  onCompletePO(po: PurchaseOrder): void {
    this.api.completePurchaseOrder(po.id).subscribe({
      next: (updated) => {
        this.actionMessage.set(`PO ${po.po_number} marked as COMPLETED.`);
        this.loadData();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to complete purchase order');
      }
    });
  }

  onCancelPO(po: PurchaseOrder): void {
    this.api.cancelPurchaseOrder(po.id).subscribe({
      next: (updated) => {
        this.actionMessage.set(`PO ${po.po_number} marked as CANCELLED.`);
        this.loadData();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to cancel purchase order');
      }
    });
  }

  openDocUploadModal(po: PurchaseOrder): void {
    this.targetPOForDoc.set(po);
    this.selectedUploadFile = null;
    this.uploadDocType = 'invoice';
    this.invoiceAmountInput = null;
  }

  onFileSelected(event: any): void {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedUploadFile = event.target.files[0];
    }
  }

  submitPODocument(): void {
    const po = this.targetPOForDoc();
    if (!po || !this.selectedUploadFile) return;

    this.isSubmitting.set(true);
    const fd = new FormData();
    fd.append('file', this.selectedUploadFile);
    fd.append('doc_type', this.uploadDocType);

    this.api.uploadPODocument(po.id, fd).subscribe({
      next: () => {
        if (this.uploadDocType === 'invoice' && this.invoiceAmountInput !== null && this.invoiceAmountInput > 0) {
          this.api.recordPOInvoice(po.id, { invoice_amount: this.invoiceAmountInput }).subscribe({
            next: () => {
              this.finishDocUpload(po);
            },
            error: () => this.finishDocUpload(po)
          });
        } else {
          this.finishDocUpload(po);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to upload document');
      }
    });
  }

  private finishDocUpload(po: PurchaseOrder): void {
    this.isSubmitting.set(false);
    this.targetPOForDoc.set(null);
    this.actionMessage.set(`Document attached to PO ${po.po_number}!`);
    this.loadData();
    setTimeout(() => this.actionMessage.set(''), 4000);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }
}
