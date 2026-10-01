import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Contract, Vendor } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Contract Repository</h1>
          <p class="page-subtitle">Track multi-vendor master service agreements, SLAs, compliance, and expiry alerts</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" (click)="openCreateModal()" id="btn-open-create-contract">
            <span>+</span>
            <span>New Contract</span>
          </button>
        </div>
      </div>

      <!-- Expiry Warning Banner if Any Contract is Red -->
      @if (urgentContractsCount() > 0) {
        <div class="alert alert-danger" id="contract-urgent-alert">
          <span>⚠️</span>
          <span>
            <strong>{{ urgentContractsCount() }} contract(s)</strong> require immediate attention (expiring within 30 days or expired)!
          </span>
        </div>
      }

      <!-- Action Feedback Alert -->
      @if (feedbackMessage()) {
        <div class="alert alert-success" id="contract-action-alert">
          <span>✅</span>
          <span>{{ feedbackMessage() }}</span>
        </div>
      }
      @if (errorMessage()) {
        <div class="alert alert-danger">
          <span>⚠️</span>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Contracts Table -->
      <div class="card table-card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Contract Title</th>
                <th>Partner Vendor</th>
                <th>Effective Window</th>
                <th>Renewal Notice</th>
                <th>Expiry Countdown</th>
                <th>Risk State</th>
                <th>Compliance / Terms</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr>
                  <td colspan="8" class="text-center py-6 text-muted">Loading vendor contracts...</td>
                </tr>
              } @else if (contracts().length === 0) {
                <tr>
                  <td colspan="8" class="text-center py-8 text-muted">
                    No contracts recorded yet. Click <strong>+ New Contract</strong> to onboard an agreement.
                  </td>
                </tr>
              } @else {
                @for (c of contracts(); track c.id) {
                  <tr>
                    <td>
                      <strong>{{ c.title }}</strong>
                      @if (c.status === 'RENEWED') {
                        <span class="badge" style="margin-left: 0.4rem; font-size: 0.68rem; background: rgba(147, 51, 234, 0.2); color: #c084fc; border: 1px solid rgba(147, 51, 234, 0.4); border-radius: 4px; padding: 0.1rem 0.4rem;">Renewed</span>
                      }
                      @if (c.renewed_from_contract_id) {
                        <span class="badge" style="margin-left: 0.4rem; font-size: 0.68rem; background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 4px; padding: 0.1rem 0.4rem;" title="Renewed agreement">New Renewal</span>
                      }
                      @if (c.document_path) {
                        <span class="doc-badge" title="Document on file">📎 Signed</span>
                      }
                    </td>
                    <td>{{ c.vendor_name || 'Vendor' }}</td>
                    <td class="text-sm">
                      {{ c.start_date | date:'mediumDate' }} → <strong>{{ c.end_date | date:'mediumDate' }}</strong>
                    </td>
                    <td>{{ c.renewal_notice_period_days }} days</td>
                    <td>
                      @if ((c.days_remaining || 0) <= 0) {
                        <span class="text-danger font-bold">EXPIRED</span>
                      } @else {
                        <strong [class.text-danger]="c.risk_level === 'red'" [class.text-warning]="c.risk_level === 'amber'">
                          {{ c.days_remaining }} days left
                        </strong>
                      }
                    </td>
                    <td>
                      <span class="risk-pill risk-{{ c.risk_level }}">
                        <span class="risk-dot"></span>
                        <span>{{ (c.risk_level || 'green') | uppercase }}</span>
                      </span>
                    </td>
                    <td class="text-sm text-muted">
                      {{ c.compliance_flags || c.terms || 'Standard SLA terms' }}
                    </td>
                    <td class="text-right">
                      <div class="action-buttons">
                        @if (c.status !== 'RENEWED') {
                          <button class="btn btn-warning btn-xs" (click)="openRenewModal(c)" [id]="'btn-renew-' + c.id" title="Renew Contract">
                            🔄 Renew
                          </button>
                        }
                        <button class="btn btn-secondary btn-xs" (click)="openUploadModal(c)" title="Upload signed PDF">
                          Upload Doc
                        </button>
                        @if (isAdmin()) {
                          <button class="btn btn-danger btn-xs" (click)="deleteContract(c)" title="Delete Contract">
                            Delete
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

      <!-- Create Contract Modal -->
      @if (showCreateModal()) {
        <div class="modal-overlay" (click)="closeCreateModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Record Vendor Contract</h2>
              <button class="modal-close-btn" (click)="closeCreateModal()">✕</button>
            </div>

            <form (ngSubmit)="submitCreateContract()" class="modal-form">
              <div class="form-group">
                <label class="form-label" for="contract-vendor">Partner Vendor *</label>
                <select id="contract-vendor" class="form-control" [(ngModel)]="newContract.vendor_id" name="vendor_id" required>
                  <option value="" disabled>Select Vendor</option>
                  @for (v of vendors(); track v.id) {
                    <option [value]="v.id">{{ v.company_name }} ({{ v.category }})</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="contract-title">Contract Title *</label>
                <input
                  id="contract-title"
                  type="text"
                  class="form-control"
                  placeholder="e.g. Master Logistics & Freight Agreement 2026-2027"
                  [(ngModel)]="newContract.title"
                  name="title"
                  required
                />
              </div>

              <div class="form-row">
                <div class="form-group col">
                  <label class="form-label" for="contract-start">Start Date *</label>
                  <input
                    id="contract-start"
                    type="date"
                    class="form-control"
                    [(ngModel)]="newContract.start_date"
                    name="start_date"
                    required
                  />
                </div>
                <div class="form-group col">
                  <label class="form-label" for="contract-end">End / Expiry Date *</label>
                  <input
                    id="contract-end"
                    type="date"
                    class="form-control"
                    [(ngModel)]="newContract.end_date"
                    name="end_date"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="contract-notice">Renewal Notice Period (Days)</label>
                <input
                  id="contract-notice"
                  type="number"
                  class="form-control"
                  min="5"
                  max="180"
                  [(ngModel)]="newContract.renewal_notice_period_days"
                  name="renewal_notice_period_days"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="contract-terms">Terms & SLA Notes</label>
                <textarea
                  id="contract-terms"
                  class="form-control"
                  rows="2"
                  placeholder="Payment terms, delivery guarantees, SLA penalties..."
                  [(ngModel)]="newContract.terms"
                  name="terms"
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="contract-flags">Compliance / Regulatory Flags</label>
                <input
                  id="contract-flags"
                  type="text"
                  class="form-control"
                  placeholder="e.g. ISO 9001 Certified, GDPR Compliant"
                  [(ngModel)]="newContract.compliance_flags"
                  name="compliance_flags"
                />
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeCreateModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="submitting() || !newContract.title || !newContract.vendor_id">
                  {{ submitting() ? 'Saving...' : 'Save Contract' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Upload Document Modal -->
      @if (targetContractForDoc()) {
        <div class="modal-overlay" (click)="targetContractForDoc.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Attach Signed Contract Document</h2>
              <button class="modal-close-btn" (click)="targetContractForDoc.set(null)">✕</button>
            </div>
            <div class="modal-body">
              <p>Upload signed agreement document for <strong>{{ targetContractForDoc()?.title }}</strong>.</p>
              <div class="form-group mt-3">
                <label class="form-label" for="contract-file-input">Select Document (PDF/DOCX/PNG) *</label>
                <input id="contract-file-input" type="file" class="form-control" (change)="onFileSelected($event)" />
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="targetContractForDoc.set(null)">Cancel</button>
              <button class="btn btn-primary" (click)="submitUpload()" [disabled]="submitting() || !selectedFile">
                {{ submitting() ? 'Uploading...' : 'Upload & Attach' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Renew Contract Modal -->
      @if (targetContractForRenew()) {
        <div class="modal-overlay" (click)="closeRenewModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2 class="modal-title">Renew Contract</h2>
              <button class="modal-close-btn" (click)="closeRenewModal()">✕</button>
            </div>

            <form (ngSubmit)="submitRenewContract()" class="modal-form">
              <p class="text-sm text-muted mb-4">
                Renewing: <strong>{{ targetContractForRenew()?.title }}</strong>. This creates a new active contract linked to this agreement and marks the current contract as RENEWED.
              </p>

              <div class="form-row">
                <div class="form-group col">
                  <label class="form-label" for="renew-start">New Start Date *</label>
                  <input
                    id="renew-start"
                    type="date"
                    class="form-control"
                    [(ngModel)]="renewForm.new_start_date"
                    name="new_start_date"
                    required
                  />
                </div>
                <div class="form-group col">
                  <label class="form-label" for="renew-end">New End / Expiry Date *</label>
                  <input
                    id="renew-end"
                    type="date"
                    class="form-control"
                    [(ngModel)]="renewForm.new_end_date"
                    name="new_end_date"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="renew-notice">Renewal Notice Period (Days)</label>
                <input
                  id="renew-notice"
                  type="number"
                  class="form-control"
                  min="5"
                  max="180"
                  [(ngModel)]="renewForm.renewal_notice_period_days"
                  name="renewal_notice_period_days"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="renew-terms">Updated Terms / Renewal Notes</label>
                <textarea
                  id="renew-terms"
                  class="form-control"
                  rows="2"
                  placeholder="Optional terms override..."
                  [(ngModel)]="renewForm.terms"
                  name="terms"
                ></textarea>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeRenewModal()">Cancel</button>
                <button type="submit" class="btn btn-warning" [disabled]="submitting() || !renewForm.new_start_date || !renewForm.new_end_date">
                  {{ submitting() ? 'Renewing...' : 'Confirm Renewal' }}
                </button>
              </div>
            </form>
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
    .doc-badge {
      display: inline-block;
      margin-left: 0.4rem;
      font-size: 0.68rem;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 4px;
      padding: 0.1rem 0.4rem;
    }
    .risk-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .risk-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .risk-green {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .risk-green .risk-dot { background: #34d399; }
    .risk-amber {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .risk-amber .risk-dot { background: #fbbf24; }
    .risk-red {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .risk-red .risk-dot { background: #f87171; }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
    }
    .form-row {
      display: flex;
      gap: 1rem;
    }
    .form-row .col {
      flex: 1;
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
      max-width: 540px;
      padding: 1.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
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
  `]
})
export class ContractsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly contracts = signal<Contract[]>([]);
  readonly vendors = signal<Vendor[]>([]);
  readonly loading = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly feedbackMessage = signal<string>('');
  readonly errorMessage = signal<string>('');

  readonly showCreateModal = signal<boolean>(false);
  readonly targetContractForDoc = signal<Contract | null>(null);
  readonly targetContractForRenew = signal<Contract | null>(null);
  selectedFile: File | null = null;

  renewForm = {
    new_start_date: '',
    new_end_date: '',
    renewal_notice_period_days: 30,
    terms: ''
  };

  newContract = {
    vendor_id: '',
    title: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    renewal_notice_period_days: 30,
    terms: '',
    compliance_flags: ''
  };

  readonly urgentContractsCount = computed(() => {
    return this.contracts().filter(c => c.risk_level === 'red').length;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.api.getContracts().subscribe({
      next: (data) => {
        this.contracts.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.api.getVendors().subscribe({
      next: (data) => this.vendors.set(data)
    });
  }

  isAdmin(): boolean {
    return (this.auth.currentUser()?.roles || []).includes('Administrator');
  }

  openCreateModal(): void {
    this.newContract = {
      vendor_id: this.vendors().length > 0 ? this.vendors()[0].id : '',
      title: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      renewal_notice_period_days: 30,
      terms: '',
      compliance_flags: ''
    };
    this.errorMessage.set('');
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  submitCreateContract(): void {
    if (!this.newContract.title || !this.newContract.vendor_id) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.api.createContract({
      vendor_id: this.newContract.vendor_id,
      title: this.newContract.title,
      start_date: new Date(this.newContract.start_date).toISOString(),
      end_date: new Date(this.newContract.end_date).toISOString(),
      renewal_notice_period_days: this.newContract.renewal_notice_period_days,
      terms: this.newContract.terms,
      compliance_flags: this.newContract.compliance_flags
    }).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.closeCreateModal();
        this.feedbackMessage.set(`Contract '${created.title}' recorded successfully!`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to save contract');
      }
    });
  }

  openUploadModal(c: Contract): void {
    this.targetContractForDoc.set(c);
    this.selectedFile = null;
  }

  onFileSelected(event: any): void {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
    }
  }

  submitUpload(): void {
    const c = this.targetContractForDoc();
    if (!c || !this.selectedFile) return;

    this.submitting.set(true);
    const fd = new FormData();
    fd.append('file', this.selectedFile);

    this.api.uploadContractDocument(c.id, fd).subscribe({
      next: () => {
        this.submitting.set(false);
        this.targetContractForDoc.set(null);
        this.feedbackMessage.set(`Document attached to contract '${c.title}'!`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to upload contract document');
      }
    });
  }

  deleteContract(c: Contract): void {
    if (!confirm(`Are you sure you want to delete contract '${c.title}'?`)) return;
    this.api.deleteContract(c.id).subscribe({
      next: () => {
        this.feedbackMessage.set(`Contract '${c.title}' deleted`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail || 'Failed to delete contract');
      }
    });
  }

  openRenewModal(c: Contract): void {
    this.targetContractForRenew.set(c);
    const oldEnd = c.end_date ? new Date(c.end_date) : new Date();
    const newStart = new Date(oldEnd.getTime() + 86400000);
    const newEnd = new Date(newStart.getTime() + 365 * 86400000);

    this.renewForm = {
      new_start_date: newStart.toISOString().split('T')[0],
      new_end_date: newEnd.toISOString().split('T')[0],
      renewal_notice_period_days: c.renewal_notice_period_days || 30,
      terms: c.terms || ''
    };
    this.errorMessage.set('');
  }

  closeRenewModal(): void {
    this.targetContractForRenew.set(null);
  }

  submitRenewContract(): void {
    const c = this.targetContractForRenew();
    if (!c || !this.renewForm.new_start_date || !this.renewForm.new_end_date) return;

    this.submitting.set(true);
    this.errorMessage.set('');

    this.api.renewContract(c.id, {
      new_start_date: new Date(this.renewForm.new_start_date).toISOString(),
      new_end_date: new Date(this.renewForm.new_end_date).toISOString(),
      renewal_notice_period_days: this.renewForm.renewal_notice_period_days,
      terms: this.renewForm.terms || undefined
    }).subscribe({
      next: (renewed) => {
        this.submitting.set(false);
        this.closeRenewModal();
        this.feedbackMessage.set(`Contract renewed successfully! New agreement active: '${renewed.title}'`);
        this.loadData();
        setTimeout(() => this.feedbackMessage.set(''), 5000);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to renew contract');
      }
    });
  }
}
