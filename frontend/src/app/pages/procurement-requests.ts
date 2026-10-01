import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { ApiService, ProcurementRequest, PRLineItem, Vendor } from '../core/api.service';

@Component({
  selector: 'app-procurement-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],

  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Procurement Requests</h1>
          <p class="page-subtitle">Draft, review, and approve purchase requisitions with dynamic line items</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="openCreateModal()" id="btn-open-create-pr">
            <span>+</span>
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      <!-- Action Feedback Alert -->
      @if (feedbackMessage()) {
        <div class="alert alert-success" id="pr-action-alert">
          <span>✅</span>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }
      @if (errorMessage()) {
        <div class="alert alert-danger" id="pr-error-alert">
          <span>⚠️</span>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Filter Bar -->
      <div class="card filter-card">
        <div class="filter-group">
          <label class="filter-label">Status Filter:</label>
          <div class="filter-pills">
            @for (opt of statusOptions; track opt.value) {
              <button
                class="pill-btn"
                [class.active]="selectedStatus() === opt.value"
                (click)="setStatusFilter(opt.value)"
              >
                {{ opt.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- PR Table -->
      <div class="card table-card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Requisition Title</th>
                <th>Requester</th>
                <th>Line Items</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Date Submitted</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td colspan="7" class="text-center py-6 text-muted">Loading procurement requests...</td>
                </tr>
              } @else if (requests().length === 0) {
                <tr>
                  <td colspan="7" class="text-center py-8 text-muted">
                    No procurement requests found for this filter.
                  </td>
                </tr>
              } @else {
                @for (pr of requests(); track pr.id) {
                  <tr>
                    <td>
                      <div class="pr-title-cell">
                        <strong class="text-main">{{ pr.title }}</strong>
                        @if (pr.description) {
                          <span class="pr-desc">{{ pr.description }}</span>
                        }
                      </div>
                    </td>
                    <td>{{ pr.requester_name || 'System User' }}</td>
                    <td>
                      <span class="badge badge-info">
                        {{ pr.line_items?.length || 0 }} item(s)
                      </span>
                    </td>
                    <td>
                      <strong class="amount-text">{{ formatCurrency(pr.total_estimated_cost || 0) }}</strong>
                      @if ((pr.total_estimated_cost || 0) > 10000) {
                        <span class="threshold-tag" title="Threshold > $10,000 requires Finance Officer sign-off">
                          Requires Finance
                        </span>
                      }
                    </td>
                    <td>
                      <span class="status-pill status-{{ pr.status.toLowerCase() }}">
                        {{ pr.status | uppercase }}
                      </span>
                    </td>
                    <td class="text-muted">{{ pr.created_at | date:'mediumDate' }}</td>
                    <td class="text-right">
                      <div class="action-buttons">
                        <button
                          class="btn btn-secondary btn-xs"
                          (click)="viewDetails(pr)"
                          title="View line items"
                        >
                          Details
                        </button>
                        @if (canApprove() && (pr.status.toLowerCase() === 'pending' || pr.status === 'PENDING_APPROVAL')) {
                          <button
                            class="btn btn-success btn-xs"
                            (click)="updateStatus(pr, 'approved')"
                            title="Approve Requisition"
                          >
                            Approve
                          </button>
                          <button
                            class="btn btn-danger btn-xs"
                            (click)="updateStatus(pr, 'rejected')"
                            title="Reject Requisition"
                          >
                            Reject
                          </button>
                        }
                        @if (pr.status.toLowerCase() === 'approved') {
                          <button
                            class="btn btn-primary btn-xs"
                            (click)="openGeneratePOModal(pr)"
                            title="Issue Purchase Order from this PR"
                          >
                            Generate PO
                          </button>
                        }
                        @if (canApprove() && pr.status.toLowerCase() !== 'completed' && pr.status.toLowerCase() !== 'cancelled') {
                          @if (pr.status.toLowerCase() === 'ordered' || pr.status.toLowerCase() === 'delivered' || pr.status.toLowerCase() === 'approved') {
                            <button
                              class="btn btn-primary btn-xs"
                              (click)="updateStatus(pr, 'completed')"
                              title="Mark Requisition as Completed"
                            >
                              Complete
                            </button>
                          }
                          <button
                            class="btn btn-danger btn-xs"
                            (click)="updateStatus(pr, 'cancelled')"
                            title="Cancel Requisition"
                          >
                            Cancel
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create PR Modal with Dynamic Line Items -->
      @if (showCreateModal()) {
        <div class="modal-overlay" (click)="closeCreateModal()">
          <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Create Procurement Request</h2>
              <button class="modal-close-btn" (click)="closeCreateModal()">✕</button>
            </div>

            <form (ngSubmit)="submitCreatePR()" class="modal-form">
              <div class="form-group">
                <label class="form-label" for="pr-title">Requisition Title *</label>
                <input
                  id="pr-title"
                  type="text"
                  class="form-control"
                  placeholder="e.g. Q3 Server Rack Infrastructure Upgrade"
                  [(ngModel)]="newPR.title"
                  name="title"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="pr-desc">Description / Justification</label>
                <textarea
                  id="pr-desc"
                  class="form-control"
                  rows="2"
                  placeholder="Business purpose, department need, or project code..."
                  [(ngModel)]="newPR.description"
                  name="description"
                ></textarea>
              </div>

              <!-- Dynamic Line Items Section -->
              <div class="line-items-section">
                <div class="line-items-header">
                  <h3>Line Items</h3>
                  <button type="button" class="btn btn-secondary btn-xs" (click)="addLineItem()">
                    + Add Item Row
                  </button>
                </div>

                <div class="line-items-table-wrap">
                  <table class="line-items-table">
                    <thead>
                      <tr>
                        <th style="width: 50%;">Item Name / Description</th>
                        <th style="width: 20%;">Qty</th>
                        <th style="width: 20%;">Unit Cost ($)</th>
                        <th style="width: 10%;"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of newPR.line_items; track $index) {
                        <tr>
                          <td>
                            <input
                              type="text"
                              class="form-control form-control-sm"
                              placeholder="Item description"
                              [(ngModel)]="item.item_name"
                              [name]="'item_name_' + $index"
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              class="form-control form-control-sm"
                              min="1"
                              step="1"
                              [(ngModel)]="item.quantity"
                              [name]="'item_qty_' + $index"
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              class="form-control form-control-sm"
                              min="0"
                              step="0.01"
                              [(ngModel)]="item.estimated_cost"
                              [name]="'item_cost_' + $index"
                              required
                            />
                          </td>
                          <td class="text-center">
                            @if (newPR.line_items.length > 1) {
                              <button
                                type="button"
                                class="btn-icon-danger"
                                (click)="removeLineItem($index)"
                                title="Remove row"
                              >
                                ✕
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <div class="line-items-summary">
                  <span>Computed Total Estimated Spend:</span>
                  <strong class="total-spend-val">{{ formatCurrency(computedTotal()) }}</strong>
                </div>
                @if (computedTotal() > 10000) {
                  <div class="alert alert-warning py-2 text-xs">
                    ℹ️ This requisition exceeds $10,000. Under platform governance, it will require Finance Officer sign-off.
                  </div>
                }
              </div>

              <!-- Budget Amount -->
              <div class="form-group">
                <label class="form-label" for="pr-budget">Approved Budget Amount ($) <span style="color: var(--text-muted); font-weight: 400; font-size: 0.8rem;">(optional)</span></label>
                <input
                  id="pr-budget"
                  type="number"
                  class="form-control"
                  min="0"
                  step="0.01"
                  placeholder="Enter approved budget, e.g. 15000.00"
                  [(ngModel)]="newPR.budget_amount"
                  name="budget_amount"
                />
                @if (newPR.budget_amount && computedTotal() > 0) {
                  <div style="margin-top: 0.4rem; font-size: 0.8rem;" [style.color]="computedTotal() > (newPR.budget_amount || 0) ? '#f87171' : '#34d399'">
                    @if (computedTotal() > (newPR.budget_amount || 0)) {
                      ⚠️ Estimated spend exceeds budget by {{ formatCurrency(computedTotal() - (newPR.budget_amount || 0)) }}
                    } @else {
                      ✅ Within budget — {{ formatCurrency((newPR.budget_amount || 0) - computedTotal()) }} remaining
                    }
                  </div>
                }
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeCreateModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="submitting() || !newPR.title">
                  {{ submitting() ? 'Submitting...' : 'Submit Requisition' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- PR Detail Modal -->
      @if (selectedPR()) {
        <div class="modal-overlay" (click)="selectedPR.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">{{ selectedPR()?.title }}</h2>
              <button class="modal-close-btn" (click)="selectedPR.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <p class="text-muted">{{ selectedPR()?.description || 'No description provided' }}</p>
              <div class="detail-meta-grid">
                <div><strong>Status:</strong> <span class="status-pill status-{{ selectedPR()?.status?.toLowerCase() }}">{{ selectedPR()?.status }}</span></div>
                <div><strong>Requester:</strong> {{ selectedPR()?.requester_name }}</div>
                <div><strong>Submitted:</strong> {{ selectedPR()?.created_at | date:'medium' }}</div>
                <div><strong>Total Cost:</strong> {{ formatCurrency(selectedPR()?.total_estimated_cost || 0) }}</div>
              </div>

              <h4 class="mt-4 mb-2">Item Breakdown</h4>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Est. Cost</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of selectedPR()?.line_items; track item.id) {
                    <tr>
                      <td>{{ item.item_name }}</td>
                      <td>{{ item.quantity }}</td>
                      <td>{{ formatCurrency(item.estimated_cost) }}</td>
                      <td>{{ formatCurrency(item.quantity * item.estimated_cost) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="selectedPR.set(null)">Close</button>
            </div>
          </div>
        </div>
      }

      <!-- Generate PO Modal -->
      @if (prForPO()) {
        <div class="modal-overlay" (click)="prForPO.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Generate PO from PR</h2>
              <button class="modal-close-btn" (click)="prForPO.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <p>Issuing formal Purchase Order for <strong>{{ prForPO()?.title }}</strong> ({{ formatCurrency(prForPO()?.total_estimated_cost || 0) }}).</p>
              <div class="form-group mt-3">
                <label class="form-label" for="po-vendor-select">Assign Partner Vendor *</label>
                <select id="po-vendor-select" class="form-control" [(ngModel)]="selectedVendorForPO">
                  @for (v of vendors(); track v.id) {
                    <option [value]="v.id">{{ v.company_name }} ({{ v.category }})</option>
                  }
                </select>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="prForPO.set(null)">Cancel</button>
              <button class="btn btn-primary" (click)="confirmGeneratePO()" [disabled]="submitting()">
                {{ submitting() ? 'Generating...' : 'Issue Purchase Order' }}
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
    .page-subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }
    .filter-card {
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .filter-label {
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 600;
    }
    .filter-pills {
      display: flex;
      gap: 0.5rem;
    }
    .pill-btn {
      padding: 0.35rem 0.85rem;
      border-radius: var(--radius-full);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .pill-btn.active, .pill-btn:hover {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.5);
      color: #ffffff;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    .data-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
    }
    .data-table td {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.875rem;
    }
    .pr-title-cell {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .pr-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .amount-text {
      color: #38bdf8;
      font-size: 0.95rem;
    }
    .threshold-tag {
      display: inline-block;
      margin-left: 0.5rem;
      font-size: 0.65rem;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 4px;
      padding: 0.1rem 0.35rem;
    }
    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .status-pending, .status-pending_approval {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .status-approved {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-ordered {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .status-rejected, .status-cancelled {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
    }
    .line-items-section {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1rem;
      margin: 1rem 0;
    }
    .line-items-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .line-items-header h3 {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-main);
    }
    .line-items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .line-items-table th {
      font-size: 0.75rem;
      color: var(--text-muted);
      padding: 0.4rem;
    }
    .line-items-table td {
      padding: 0.35rem;
    }
    .btn-icon-danger {
      background: transparent;
      border: none;
      color: #f87171;
      font-size: 1rem;
      cursor: pointer;
    }
    .line-items-summary {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.75rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .total-spend-val {
      font-size: 1.15rem;
      color: #38bdf8;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 580px;
      padding: 1.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .modal-lg {
      max-width: 720px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .modal-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
    }
    .modal-close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 1.2rem;
      cursor: pointer;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }
    .detail-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-top: 1rem;
      font-size: 0.85rem;
    }
  `]
})
export class ProcurementRequestsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly requests = signal<ProcurementRequest[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly loading = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly selectedStatus = signal<string>('all');
  readonly feedbackMessage = signal<string>('');
  readonly errorMessage = signal<string>('');

  readonly showCreateModal = signal<boolean>(false);
  readonly selectedPR = signal<ProcurementRequest | null>(null);
  readonly prForPO = signal<ProcurementRequest | null>(null);
  selectedVendorForPO: string = '';

  newPR: {
    title: string;
    description: string;
    budget_amount?: number;
    line_items: { item_name: string; quantity: number; estimated_cost: number }[];
  } = {
    title: '',
    description: '',
    budget_amount: undefined,
    line_items: [
      { item_name: '', quantity: 1, estimated_cost: 0 }
    ]
  };

  readonly statusOptions = [
    { label: 'All Requests', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Ordered', value: 'ordered' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  computedTotal(): number {
    return this.newPR.line_items.reduce((sum, item) => {
      return sum + ((Number(item.quantity) || 0) * (Number(item.estimated_cost) || 0));
    }, 0);
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const filter = this.selectedStatus() === 'all' ? undefined : this.selectedStatus();
    this.api.getProcurementRequests(filter).subscribe({
      next: (prs) => {
        this.requests.set(prs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.api.getVendors().subscribe({
      next: (vs) => {
        this.vendors.set(vs);
        if (vs.length > 0) {
          this.selectedVendorForPO = vs[0].id;
        }
      }
    });
  }

  setStatusFilter(status: string): void {
    this.selectedStatus.set(status);
    this.loadData();
  }

  canApprove(): boolean {
    const roles = this.auth.currentUser()?.roles || [];
    return roles.includes('Administrator') || roles.includes('Procurement Manager') || roles.includes('Finance Officer');
  }

  openCreateModal(): void {
    this.newPR = {
      title: '',
      description: '',
      budget_amount: undefined,
      line_items: [{ item_name: '', quantity: 1, estimated_cost: 0 }]
    };
    this.errorMessage.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  addLineItem(): void {
    this.newPR.line_items.push({ item_name: '', quantity: 1, estimated_cost: 0 });
  }

  removeLineItem(idx: number): void {
    this.newPR.line_items.splice(idx, 1);
  }

  submitCreatePR(): void {
    if (!this.newPR.title) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    const payload: any = {
      title: this.newPR.title,
      description: this.newPR.description,
      line_items: this.newPR.line_items.filter(i => i.item_name.trim() !== '')
    };
    if (this.newPR.budget_amount !== undefined && this.newPR.budget_amount !== null) {
      payload.budget_amount = Number(this.newPR.budget_amount);
    }
    this.api.createProcurementRequest(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.closeCreateModal();
        this.feedbackMessage.set(`Requisition '${created.title}' created successfully!`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to submit procurement request');
      }
    });
  }

  updateStatus(pr: ProcurementRequest, newStatus: string): void {
    this.errorMessage.set('');
    this.api.updateProcurementRequestStatus(pr.id, { status: newStatus }).subscribe({
      next: (updated) => {
        this.feedbackMessage.set(`Requisition '${updated.title}' status updated to ${newStatus.toUpperCase()}`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || `Failed to update status to ${newStatus}`);
      }
    });
  }

  viewDetails(pr: ProcurementRequest): void {
    this.selectedPR.set(pr);
  }

  openGeneratePOModal(pr: ProcurementRequest): void {
    this.prForPO.set(pr);
  }

  confirmGeneratePO(): void {
    const pr = this.prForPO();
    if (!pr) return;
    this.submitting.set(true);
    this.api.createPOFromPR(pr.id, { vendor_id: this.selectedVendorForPO }).subscribe({
      next: (po) => {
        this.submitting.set(false);
        this.prForPO.set(null);
        this.feedbackMessage.set(`Purchase Order ${po.po_number} generated successfully!`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to generate PO');
      }
    });
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }
}
