import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Vendor, VendorPerformance, VendorPerformanceSummary, VendorReliability, VendorReliabilitySnapshot, CommunicationMessage, ActivityLogItem, ProcurementRequest, Certification, CertificationCreate } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Vendor Reliability Directory</h1>
          <p class="page-desc">Track qualified suppliers, status pipelines, documentation notes, and contacts</p>
        </div>
        @if (canCreateVendor()) {
          <button
            id="onboard-vendor-btn"
            class="btn btn-primary"
            (click)="showModal.set(true)"
          >
            + Onboard New Vendor
          </button>
        }
      </div>

      @if (actionMessage()) {
        <div class="alert alert-success" id="vendor-action-banner">
          <span>✅</span>
          <span>{{ actionMessage() }}</span>
        </div>
      }
      @if (errorMessage()) {
        <div class="alert alert-danger" id="vendor-error-banner">
          <span>⚠️</span>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Search & Filters Bar -->
      <div class="filters-bar card">
        <div class="search-box">
          <span style="color: var(--text-muted);">🔍</span>
          <input
            id="vendor-search-input"
            type="text"
            class="form-control"
            placeholder="Search company name or registration no..."
            [(ngModel)]="searchQuery"
          />
        </div>
        <div class="filter-group">
          <label class="form-label" style="margin: 0;">Category:</label>
          <select
            id="vendor-category-filter"
            class="form-control"
            style="width: auto; min-width: 170px;"
            [(ngModel)]="selectedCategory"
          >
            <option value="ALL">All Categories</option>
            @for (cat of allowedCategories; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </div>
        <div class="filter-group">
          <label class="form-label" style="margin: 0;">Status:</label>
          <select
            id="vendor-status-filter"
            class="form-control"
            style="width: auto; min-width: 150px;"
            [(ngModel)]="selectedStatus"
          >
            <option value="ALL">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <!-- Vendors Table -->
      <div class="card" style="padding: 0; overflow: hidden;">
        @if (isLoading()) {
          <div class="empty-state">Loading vendor registry...</div>
        } @else if (filteredVendors().length === 0) {
          <div class="empty-state" id="no-vendors-found">
            <span style="font-size: 2rem;">🏢</span>
            <p><strong>No vendors match your search/filter criteria.</strong></p>
            <span style="color: var(--text-muted); font-size: 0.85rem;">
              Try clearing filters or onboarding a new vendor partner.
            </span>
          </div>
        } @else {
          <div class="table-container">
            <table class="data-table" id="vendors-data-table">
              <thead>
                <tr>
                  <th>Company & Reg No</th>
                  <th>Category</th>
                  <th>Lifecycle Status</th>
                  <th>Primary Contact</th>
                  <th>Review Notes</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (vendor of filteredVendors(); track vendor.id) {
                  <tr>
                    <td>
                      <strong style="font-size: 0.95rem;">{{ vendor.company_name }}</strong>
                      <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">
                        REG: {{ vendor.registration_no }}
                      </div>
                    </td>
                    <td>
                      <span class="badge badge-neutral">{{ vendor.category }}</span>
                    </td>
                    <td>
                      <span class="status-pill status-{{ vendor.status.toLowerCase() }}">
                        {{ vendor.status | uppercase }}
                      </span>
                    </td>
                    <td>
                      @if (vendor.contacts && vendor.contacts.length > 0) {
                        <div>
                          <strong>{{ vendor.contacts[0].name }}</strong>
                          <div style="font-size: 0.78rem; color: var(--text-muted);">
                            {{ vendor.contacts[0].email }}
                          </div>
                        </div>
                      } @else {
                        <span style="color: var(--text-faint); font-size: 0.8rem;">None listed</span>
                      }
                    </td>
                    <td class="text-muted text-sm" style="max-width: 220px;">
                      {{ vendor.review_notes || '—' }}
                    </td>
                    <td class="text-right">
                      <div class="action-buttons">
                        <button
                          class="btn btn-secondary btn-xs"
                          (click)="openDetailModal(vendor)"
                          title="View full profile & status actions"
                        >
                          Details & Pipeline
                        </button>
                        @if (canDeleteVendor()) {
                          <button
                            class="btn btn-danger btn-xs"
                            [id]="'delete-vendor-' + vendor.id"
                            [disabled]="isDeleting()"
                            (click)="deleteVendor(vendor, $event)"
                            title="Delete vendor"
                          >
                            Delete
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

      <!-- Onboard Vendor Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal-dialog" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Onboard Enterprise Vendor</h3>
              <button class="btn btn-secondary btn-sm" (click)="showModal.set(false)">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Legal Company Name *</label>
                <input
                  id="modal-vendor-name"
                  type="text"
                  class="form-control"
                  placeholder="e.g. Apex Industrial Solutions"
                  [(ngModel)]="newCompanyName"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Commercial Registration Number *</label>
                <input
                  id="modal-vendor-reg"
                  type="text"
                  class="form-control"
                  placeholder="e.g. CR-2026-90412"
                  [(ngModel)]="newRegNo"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Procurement Category *</label>
                <select id="modal-vendor-category" class="form-control" [(ngModel)]="newCategory">
                  @for (cat of allowedCategories; track cat) {
                    <option [value]="cat">{{ cat }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Initial Status</label>
                <select class="form-control" [(ngModel)]="newStatus">
                  <option value="pending">pending (awaiting review)</option>
                  <option value="under_review">under_review</option>
                  <option value="approved">approved</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Documentation / Background Notes</label>
                <textarea
                  class="form-control"
                  rows="2"
                  placeholder="ISO certificates verified, tax compliance on file..."
                  [(ngModel)]="newNotes"
                ></textarea>
              </div>

              <div style="margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
                <h4 style="font-size: 0.9rem; margin-bottom: 0.75rem; color: var(--text-muted);">
                  Key Account Representative
                </h4>
                <div class="form-group">
                  <label class="form-label">Contact Name</label>
                  <input
                    id="modal-contact-name"
                    type="text"
                    class="form-control"
                    placeholder="e.g. Elena Rostova"
                    [(ngModel)]="contactName"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Email</label>
                  <input
                    id="modal-contact-email"
                    type="email"
                    class="form-control"
                    placeholder="elena@apex.com"
                    [(ngModel)]="contactEmail"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Phone</label>
                  <input
                    id="modal-contact-phone"
                    type="text"
                    class="form-control"
                    placeholder="+1 (555) 234-5678"
                    [(ngModel)]="contactPhone"
                  />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="showModal.set(false)">Cancel</button>
              <button
                id="submit-vendor-btn"
                class="btn btn-primary"
                [disabled]="isSaving() || !newCompanyName || !newRegNo"
                (click)="onSaveVendor()"
              >
                {{ isSaving() ? 'Saving...' : 'Register Vendor' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Vendor Detail & Status Pipeline Modal -->
      @if (selectedVendor()) {
        <div class="modal-backdrop" (click)="selectedVendor.set(null)">
          <div class="modal-dialog modal-dialog-lg" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 style="margin: 0;">{{ selectedVendor()?.company_name }}</h3>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                  CR: {{ selectedVendor()?.registration_no }} • {{ selectedVendor()?.category }}
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" (click)="selectedVendor.set(null)">✕</button>
            </div>

            <!-- Modal Tab Navigation -->
            <div class="modal-tabs">
              <button
                class="tab-btn"
                [class.active]="activeModalTab() === 'overview'"
                (click)="activeModalTab.set('overview')"
                id="modal-tab-overview"
              >
                ℹ️ Overview & Pipeline
              </button>
              <button
                class="tab-btn"
                [class.active]="activeModalTab() === 'performance'"
                (click)="activeModalTab.set('performance')"
                id="modal-tab-performance"
              >
                📊 Performance
              </button>
              <button
                class="tab-btn"
                [class.active]="activeModalTab() === 'reliability'"
                (click)="activeModalTab.set('reliability')"
                id="modal-tab-reliability"
              >
                🛡️ Reliability & Risk
              </button>
              <button
                class="tab-btn"
                [class.active]="activeModalTab() === 'certifications'"
                (click)="onSelectCertificationsTab()"
                id="modal-tab-certifications"
              >
                📜 Certifications
              </button>
              <button
                class="tab-btn"
                [class.active]="activeModalTab() === 'communication'"
                (click)="onSelectCommunicationTab()"
                id="modal-tab-communication"
              >
                💬 Communication & Activity
              </button>
              @if (canManageStatus()) {
                <button
                  class="tab-btn"
                  [class.active]="activeModalTab() === 'log_performance'"
                  (click)="activeModalTab.set('log_performance')"
                  id="modal-tab-record-perf"
                >
                  ➕ Log Evaluation
                </button>
              }
            </div>

            <div class="modal-body">
              <!-- TAB 1: Overview & Pipeline -->
              @if (activeModalTab() === 'overview') {
                <div class="detail-grid">
                  <div><strong>Registration:</strong> {{ selectedVendor()?.registration_no }}</div>
                  <div><strong>Category:</strong> {{ selectedVendor()?.category }}</div>
                  <div>
                    <strong>Current Status:</strong>
                    <span class="status-pill status-{{ selectedVendor()?.status?.toLowerCase() }}">
                      {{ selectedVendor()?.status | uppercase }}
                    </span>
                  </div>
                  <div><strong>Onboarded:</strong> {{ selectedVendor()?.created_at | date:'mediumDate' }}</div>
                </div>

                <div class="form-group mt-3">
                  <label class="form-label">Review Documentation & Notes</label>
                  <textarea
                    class="form-control"
                    rows="3"
                    placeholder="Add compliance notes, certifications verified, audit results..."
                    [(ngModel)]="reviewNotesInput"
                  ></textarea>
                </div>

                @if (canManageStatus()) {
                  <div class="status-pipeline-box">
                    <label class="form-label mb-2">Transition Lifecycle Status:</label>
                    <div class="pipeline-buttons">
                      <button
                        class="btn btn-warning btn-sm"
                        [disabled]="isSaving()"
                        (click)="changeVendorStatus('under_review')"
                      >
                        → Mark Under Review
                      </button>
                      <button
                        class="btn btn-success btn-sm"
                        [disabled]="isSaving()"
                        (click)="changeVendorStatus('approved')"
                      >
                        ✓ Approve Vendor
                      </button>
                      <button
                        class="btn btn-danger btn-sm"
                        [disabled]="isSaving()"
                        (click)="changeVendorStatus('rejected')"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                }
              }

              <!-- TAB 2: Performance Metrics -->
              @if (activeModalTab() === 'performance') {
                @if (isLoadingMetrics()) {
                  <div class="empty-state" style="padding: 2rem;">Loading performance analytics...</div>
                } @else {
                  <div class="metric-cards-grid">
                    <div class="metric-card" id="perf-card-delivery">
                      <div class="metric-label">On-Time Delivery Rate</div>
                      <div class="metric-value">{{ (perfSummary()?.total_entries ?? 0) > 0 ? (perfSummary()?.on_time_delivery_rate + '%') : '—' }}</div>
                      <div class="metric-sub">{{ perfSummary()?.on_time_deliveries ?? 0 }} on-time / {{ perfSummary()?.delayed_deliveries ?? 0 }} delayed</div>
                    </div>
                    <div class="metric-card" id="perf-card-quality">
                      <div class="metric-label">Quality Rating</div>
                      <div class="metric-value text-accent">{{ (perfSummary()?.total_entries ?? 0) > 0 ? (perfSummary()?.average_quality_rating + ' / 5.0') : '—' }}</div>
                      <div class="metric-sub">⭐ Average product quality</div>
                    </div>
                    <div class="metric-card" id="perf-card-service">
                      <div class="metric-label">Service Rating</div>
                      @if ((perfSummary()?.total_entries ?? 0) > 0 && perfSummary()?.average_service_rating != null) {
                        <div class="metric-value" style="color: #a78bfa;">{{ perfSummary()?.average_service_rating | number:'1.1-1' }} <span style="font-size: 1rem;">/ 5.0</span></div>
                        <div class="metric-sub">🤝 Avg support satisfaction</div>
                      } @else {
                        <div class="metric-value" style="color: var(--text-muted); font-size: 1.1rem;">N/A</div>
                        <div class="metric-sub">No entries yet</div>
                      }
                    </div>
                    <div class="metric-card" id="perf-card-completion">
                      <div class="metric-label">Order Completion</div>
                      <div class="metric-value">{{ (perfSummary()?.total_entries ?? 0) > 0 ? (perfSummary()?.order_completion_rate + '%') : '—' }}</div>
                      <div class="metric-sub">Fulfillment accuracy</div>
                    </div>
                    <div class="metric-card" id="perf-card-response">
                      <div class="metric-label">Avg Response Time</div>
                      <div class="metric-value">{{ (perfSummary()?.total_entries ?? 0) > 0 ? (perfSummary()?.average_response_time_hours + 'h') : '—' }}</div>
                      <div class="metric-sub">Communication latency</div>
                    </div>
                    <div class="metric-card" id="perf-card-resolution">
                      <div class="metric-label">Issue Resolution</div>
                      <div class="metric-value">{{ (perfSummary()?.total_entries ?? 0) > 0 ? (perfSummary()?.average_issue_resolution_time_hours + 'h') : '—' }}</div>
                      <div class="metric-sub">Mean turnaround</div>
                    </div>
                    <div class="metric-card" id="perf-card-evals">
                      <div class="metric-label">Total Evaluations</div>
                      <div class="metric-value">{{ perfSummary()?.total_entries ?? 0 }}</div>
                      <div class="metric-sub">{{ perfSummary()?.total_deliveries ?? 0 }} shipments logged</div>
                    </div>
                  </div>

                  <div style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <h4 style="font-size: 0.95rem; margin: 0;">Evaluation Log History</h4>
                      @if (canManageStatus()) {
                        <button class="btn btn-primary btn-xs" (click)="activeModalTab.set('log_performance')">
                          + Log New Evaluation
                        </button>
                      }
                    </div>

                    @if (perfHistory().length === 0) {
                      <div class="empty-state" style="padding: 1.5rem; background: rgba(15, 23, 42, 0.4); border-radius: var(--radius-md);">
                        <p style="margin: 0; font-size: 0.85rem;">No evaluation entries logged yet for this vendor.</p>
                      </div>
                    } @else {
                      <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                        <table class="data-table" style="font-size: 0.82rem;">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>On-Time / Delayed</th>
                              <th>Quality</th>
                              <th>Completion</th>
                              <th>Response</th>
                              <th>Resolution</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (entry of perfHistory(); track entry.id) {
                              <tr>
                                <td>{{ entry.recorded_at | date:'shortDate' }}</td>
                                <td><span style="color: #34d399;">{{ entry.on_time_deliveries }}</span> / <span style="color: #f87171;">{{ entry.delayed_deliveries }}</span></td>
                                <td><strong>{{ entry.quality_rating }}</strong> / 5.0</td>
                                <td>{{ entry.order_completion_rate }}%</td>
                                <td>{{ entry.response_time_hours }}h</td>
                                <td>{{ entry.issue_resolution_time_hours }}h</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  </div>
                }
              }

              <!-- TAB 3: Reliability & Risk -->
              @if (activeModalTab() === 'reliability') {
                @if (isLoadingMetrics()) {
                  <div class="empty-state" style="padding: 2rem;">Analyzing reliability model...</div>
                } @else {
                  <div class="reliability-summary-banner" [class.risk-low]="reliability()?.risk_level === 'Low'" [class.risk-med]="reliability()?.risk_level === 'Medium'" [class.risk-high]="reliability()?.risk_level === 'High'" [class.risk-unrated]="reliability()?.risk_level === 'Unrated'">
                    <div class="reliability-gauge">
                      <div class="gauge-value" id="vendor-overall-score">{{ reliability()?.risk_level === 'Unrated' ? 'N/A' : (reliability()?.overall_reliability_score ?? 'N/A') }}</div>
                      <div class="gauge-caption">{{ reliability()?.risk_level === 'Unrated' ? 'Not Yet Rated' : 'Score (0-100)' }}</div>
                    </div>
                    <div class="reliability-meta">
                      <div class="risk-badge-wrap">
                        <span class="badge" [class.badge-success]="reliability()?.risk_level === 'Low'" [class.badge-warning]="reliability()?.risk_level === 'Medium'" [class.badge-danger]="reliability()?.risk_level === 'High'" [class.badge-neutral]="reliability()?.risk_level === 'Unrated'" id="vendor-risk-badge" style="font-size: 0.85rem; padding: 0.35rem 0.85rem;">
                          {{ reliability()?.risk_level === 'Unrated' ? 'NOT YET RATED' : (reliability()?.risk_level | uppercase) + ' RISK' }}
                        </span>
                        <span style="font-size: 0.78rem; color: var(--text-muted);">
                          {{ reliability()?.risk_level === 'Unrated' ? 'No evaluations logged yet' : ('Evaluated ' + (reliability()?.computed_at | date:'mediumDate')) }}
                        </span>
                      </div>
                      <p class="recommendation-text" id="vendor-recommendation">
                        {{ reliability()?.recommendation }}
                      </p>
                    </div>
                  </div>

                  <h4 style="font-size: 0.95rem; margin: 1.5rem 0 0.75rem 0;">Multi-Factor Reliability Breakdown</h4>
                  <div class="breakdown-grid">
                    <div class="breakdown-item">
                      <div class="breakdown-header">
                        <span>📦 Delivery History (25%)</span>
                        <strong>{{ reliability()?.risk_level === 'Unrated' ? '—' : ((reliability()?.breakdown?.delivery_score ?? 0) + '%') }}</strong>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" [style.width.%]="reliability()?.breakdown?.delivery_score ?? 0"></div>
                      </div>
                    </div>

                    <div class="breakdown-item">
                      <div class="breakdown-header">
                        <span>⭐ Product Quality (25%)</span>
                        <strong>{{ reliability()?.risk_level === 'Unrated' ? '—' : ((reliability()?.breakdown?.quality_score ?? 0) + '%') }}</strong>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" [style.width.%]="reliability()?.breakdown?.quality_score ?? 0"></div>
                      </div>
                    </div>

                    <div class="breakdown-item">
                      <div class="breakdown-header">
                        <span>💬 Communication Efficiency (15%)</span>
                        <strong>{{ reliability()?.risk_level === 'Unrated' ? '—' : ((reliability()?.breakdown?.communication_score ?? 0) + '%') }}</strong>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" [style.width.%]="reliability()?.breakdown?.communication_score ?? 0"></div>
                      </div>
                    </div>

                    <div class="breakdown-item">
                      <div class="breakdown-header">
                        <span>📜 Contract Compliance (15%)</span>
                        <strong>{{ reliability()?.risk_level === 'Unrated' ? '—' : ((reliability()?.breakdown?.compliance_score ?? 0) + '%') }}</strong>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" [style.width.%]="reliability()?.breakdown?.compliance_score ?? 0"></div>
                      </div>
                    </div>

                    <div class="breakdown-item">
                      <div class="breakdown-header">
                        <span>📑 PO Fulfillment History (10%)</span>
                        <strong>{{ reliability()?.risk_level === 'Unrated' ? '—' : ((reliability()?.breakdown?.purchase_history_score ?? 0) + '%') }}</strong>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" [style.width.%]="reliability()?.breakdown?.purchase_history_score ?? 0"></div>
                      </div>
                    </div>

                    <div class="breakdown-item">
                      <div class="breakdown-header">
                        <span>⏱️ Issue Resolution Speed (10%)</span>
                        <strong>{{ reliability()?.risk_level === 'Unrated' ? '—' : ((reliability()?.breakdown?.issue_resolution_score ?? 0) + '%') }}</strong>
                      </div>
                      <div class="progress-track">
                        <div class="progress-fill" [style.width.%]="reliability()?.breakdown?.issue_resolution_score ?? 0"></div>
                      </div>
                    </div>
                  </div>
                }
              }

              <!-- TAB 4: Certifications -->
              @if (activeModalTab() === 'certifications') {
                <div class="certifications-tab-content">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div>
                      <h4 style="margin: 0; font-size: 1rem;">Compliance & Industry Certifications</h4>
                      <p style="margin: 0.25rem 0 0 0; font-size: 0.82rem; color: var(--text-muted);">
                        ISO standards, quality audits, compliance records, and uploaded documents.
                      </p>
                    </div>
                    @if (canManageStatus()) {
                      <button
                        class="btn btn-primary btn-sm"
                        id="add-cert-toggle-btn"
                        (click)="showAddCertForm.set(!showAddCertForm())"
                      >
                        {{ showAddCertForm() ? '✕ Close Form' : '+ Add Certification' }}
                      </button>
                    }
                  </div>

                  @if (certSuccess()) {
                    <div class="alert alert-success" style="margin-bottom: 1rem; font-size: 0.85rem;">
                      {{ certSuccess() }}
                    </div>
                  }
                  @if (certError()) {
                    <div class="alert alert-danger" style="margin-bottom: 1rem; font-size: 0.85rem;">
                      {{ certError() }}
                    </div>
                  }

                  <!-- Add Certification Form -->
                  @if (showAddCertForm()) {
                    <div class="card" style="margin-bottom: 1.5rem; background: rgba(30, 41, 59, 0.4); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md);">
                      <h5 style="margin: 0 0 1rem 0; font-size: 0.9rem;">Record New Vendor Certification</h5>
                      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group" style="margin: 0;">
                          <label class="form-label" style="font-size: 0.8rem;">Certification Name *</label>
                          <input
                            type="text"
                            class="form-control"
                            id="cert-name-input"
                            placeholder="e.g. ISO 9001:2015 Quality Management System"
                            [(ngModel)]="newCertName"
                            required
                          />
                        </div>
                        <div class="form-group" style="margin: 0;">
                          <label class="form-label" style="font-size: 0.8rem;">Status</label>
                          <select class="form-control" id="cert-status-select" [(ngModel)]="newCertStatus">
                            <option value="Valid">Valid</option>
                            <option value="Pending Renewal">Pending Renewal</option>
                            <option value="Expired">Expired</option>
                          </select>
                        </div>
                      </div>

                      <div style="display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group" style="margin: 0;">
                          <label class="form-label" style="font-size: 0.8rem;">Issued Date</label>
                          <input
                            type="date"
                            class="form-control"
                            id="cert-issued-date"
                            [(ngModel)]="newCertIssuedDate"
                          />
                        </div>
                        <div class="form-group" style="margin: 0;">
                          <label class="form-label" style="font-size: 0.8rem;">Expiry Date</label>
                          <input
                            type="date"
                            class="form-control"
                            id="cert-expiry-date"
                            [(ngModel)]="newCertExpiryDate"
                          />
                        </div>
                        <div class="form-group" style="margin: 0;">
                          <label class="form-label" style="font-size: 0.8rem;">Certificate Document (PDF/Image)</label>
                          <input
                            type="file"
                            class="form-control"
                            id="cert-file-input"
                            accept=".pdf,.png,.jpg,.jpeg"
                            (change)="onCertFileSelected($event)"
                          />
                        </div>
                      </div>

                      <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-sm" (click)="showAddCertForm.set(false)">Cancel</button>
                        <button
                          class="btn btn-primary btn-sm"
                          id="submit-cert-btn"
                          [disabled]="isSavingCert() || !newCertName.trim()"
                          (click)="submitNewCertification()"
                        >
                          {{ isSavingCert() ? 'Saving...' : 'Save Certification' }}
                        </button>
                      </div>
                    </div>
                  }

                  <!-- Certifications Table -->
                  @if (isLoadingCerts()) {
                    <div class="empty-state" style="padding: 2rem;">Loading certifications...</div>
                  } @else if (certifications().length === 0) {
                    <div class="empty-state" style="padding: 2rem; background: rgba(15, 23, 42, 0.4); border-radius: var(--radius-md);">
                      <span style="font-size: 2rem;">📜</span>
                      <p style="margin: 0.5rem 0 0 0; font-size: 0.88rem; color: var(--text-muted);">
                        No certifications on file for this vendor yet.
                      </p>
                    </div>
                  } @else {
                    <div style="overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                      <table class="data-table" id="certifications-table" style="font-size: 0.84rem;">
                        <thead>
                          <tr>
                            <th>Certification Name</th>
                            <th>Issued Date</th>
                            <th>Expiry Date</th>
                            <th>Status</th>
                            <th>Document</th>
                            @if (canDeleteVendor()) {
                              <th class="text-right">Action</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (cert of certifications(); track cert.id) {
                            <tr>
                              <td>
                                <strong style="color: var(--text-main);">{{ cert.certification_name }}</strong>
                                @if (cert.is_expiring_soon) {
                                  <span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.72rem;">⚠️ Expiring Soon</span>
                                }
                              </td>
                              <td>{{ cert.issued_date ? (cert.issued_date | date:'mediumDate') : '—' }}</td>
                              <td>
                                <span [style.color]="cert.is_expiring_soon ? '#f59e0b' : 'inherit'">
                                  {{ cert.expiry_date ? (cert.expiry_date | date:'mediumDate') : 'No Expiry' }}
                                </span>
                              </td>
                              <td>
                                <span
                                  class="status-pill status-{{ cert.status === 'Valid' ? 'approved' : cert.status === 'Pending Renewal' ? 'pending' : 'rejected' }}"
                                  style="font-size: 0.75rem;"
                                >
                                  {{ cert.status }}
                                </span>
                              </td>
                              <td>
                                @if (cert.document_path) {
                                  <span class="badge badge-neutral" style="font-size: 0.75rem;">📎 Attached</span>
                                } @else {
                                  <span style="color: var(--text-faint); font-size: 0.78rem;">None</span>
                                }
                              </td>
                              @if (canDeleteVendor()) {
                                <td class="text-right">
                                  <button
                                    class="btn btn-danger btn-xs"
                                    (click)="deleteCertification(cert)"
                                    title="Delete Certification"
                                  >
                                    ✕
                                  </button>
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              }

              <!-- TAB 4: Record Performance Entry Form -->
              @if (activeModalTab() === 'log_performance') {
                <div class="perf-form-box">
                  <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Record Vendor Performance Entry</h4>
                  <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
                    Log delivery execution data, quality metrics, and responsiveness to update the composite reliability score.
                  </p>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                      <label class="form-label">On-Time Deliveries *</label>
                      <input
                        id="perf-input-ontime"
                        type="number"
                        min="0"
                        class="form-control"
                        [(ngModel)]="perfOnTime"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Delayed Deliveries *</label>
                      <input
                        id="perf-input-delayed"
                        type="number"
                        min="0"
                        class="form-control"
                        [(ngModel)]="perfDelayed"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Product Quality Rating (0.0 - 5.0) *</label>
                      <input
                        id="perf-input-quality"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        class="form-control"
                        [(ngModel)]="perfQuality"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Service Rating (0.0 - 5.0) <span style="color: var(--text-muted); font-weight: 400; font-size: 0.8rem;">(optional)</span></label>
                      <input
                        id="perf-input-service-rating"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        class="form-control"
                        placeholder="Satisfaction with vendor support/service..."
                        [(ngModel)]="perfServiceRating"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Order Completion Rate (%) *</label>
                      <input
                        id="perf-input-completion"
                        type="number"
                        min="0"
                        max="100"
                        class="form-control"
                        [(ngModel)]="perfCompletionRate"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Response Time (Hours) *</label>
                      <input
                        id="perf-input-response"
                        type="number"
                        min="0"
                        step="0.5"
                        class="form-control"
                        [(ngModel)]="perfResponseTime"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Issue Resolution Time (Hours) *</label>
                      <input
                        id="perf-input-resolution"
                        type="number"
                        min="0"
                        step="0.5"
                        class="form-control"
                        [(ngModel)]="perfIssueResolution"
                      />
                    </div>
                  </div>

                  <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button class="btn btn-secondary" (click)="activeModalTab.set('performance')">Cancel</button>
                    <button
                      id="perf-submit-btn"
                      class="btn btn-primary"
                      [disabled]="isSavingPerf()"
                      (click)="onRecordPerformance()"
                    >
                      {{ isSavingPerf() ? 'Saving Evaluation...' : '💾 Save & Recalculate' }}
                    </button>
                  </div>
                </div>
              }

              <!-- TAB 5: Communication & Activity -->
              @if (activeModalTab() === 'communication') {
                <div class="comm-tab-container">
                  <div class="comm-grid">
                    <!-- Left: Dialogue Thread -->
                    <div class="comm-thread-card">
                      <div class="comm-thread-header">
                        <div>
                          <h4 style="margin: 0; font-size: 0.95rem;">Vendor Dialogue Thread</h4>
                          <p style="margin: 0.2rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                            Direct cross-party collaboration with {{ selectedVendor()?.company_name }}
                          </p>
                        </div>
                        <button class="btn btn-secondary btn-xs" (click)="loadVendorCommunications(selectedVendor()!.id)" [disabled]="isLoadingComm()">
                          🔄 Refresh
                        </button>
                      </div>

                      <!-- Message Scroll Container -->
                      <div class="comm-messages-list" id="comm-messages-container">
                        @if (isLoadingComm()) {
                          <div class="empty-state" style="padding: 2rem;">Loading messages...</div>
                        } @else if (messages().length === 0) {
                          <div class="empty-state" style="padding: 2rem;">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">💬</div>
                            <p style="margin: 0; font-size: 0.88rem; color: var(--text-muted);">
                              No messages in this vendor thread yet. Start the conversation below.
                            </p>
                          </div>
                        } @else {
                          @for (msg of messages(); track msg.id) {
                            <div class="comm-message-bubble" [class.own-message]="isOwnMessage(msg)">
                              <div class="comm-msg-header">
                                <span class="comm-msg-sender">
                                  <strong>{{ msg.sender_name || 'Staff' }}</strong>
                                  <span class="badge badge-role comm-role-badge" [class.badge-vendor]="msg.sender_role === 'Vendor'">
                                    {{ msg.sender_role }}
                                  </span>
                                </span>
                                <span class="comm-msg-time">{{ msg.created_at | date:'short' }}</span>
                              </div>
                              <div class="comm-msg-body">{{ msg.message }}</div>
                              @if (msg.attachment_path) {
                                <div class="comm-msg-attachment">
                                  <a
                                    [href]="getAttachmentUrl(msg)"
                                    target="_blank"
                                    class="attachment-link"
                                    download
                                  >
                                    📎 {{ getAttachmentFilename(msg.attachment_path) }}
                                  </a>
                                </div>
                              }
                            </div>
                          }
                        }
                      </div>

                      <!-- Message Composer -->
                      <div class="comm-composer">
                        @if (commError()) {
                          <div class="alert alert-danger" style="padding: 0.4rem 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
                            {{ commError() }}
                          </div>
                        }

                        @if (availablePRs().length > 0) {
                          <div style="margin-bottom: 0.5rem;">
                            <select class="form-control" style="font-size: 0.8rem; padding: 0.35rem 0.5rem;" [(ngModel)]="selectedPrId">
                              <option [ngValue]="null">-- General Communication (No PR Link) --</option>
                              @for (pr of availablePRs(); track pr.id) {
                                <option [value]="pr.id">Link Discussion: {{ pr.title }} ({{ pr.status }})</option>
                              }
                            </select>
                          </div>
                        }

                        <div class="composer-input-row">
                          <textarea
                            class="form-control comm-textarea"
                            rows="2"
                            placeholder="Type a message to {{ selectedVendor()?.company_name }}..."
                            [(ngModel)]="newMessageText"
                            (keydown.control.enter)="onSendMessage()"
                            id="comm-message-input"
                          ></textarea>
                        </div>

                        <div class="composer-actions">
                          <div class="attachment-input-wrap">
                            <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0; font-size: 0.8rem;">
                              📎 {{ selectedFile ? selectedFile.name : 'Attach File' }}
                              <input
                                type="file"
                                (change)="onFileSelected($event)"
                                style="display: none;"
                                id="comm-file-input"
                              />
                            </label>
                            @if (selectedFile) {
                              <button
                                type="button"
                                class="btn btn-secondary btn-xs"
                                (click)="selectedFile = null"
                                title="Remove file"
                              >
                                ✕
                              </button>
                            }
                          </div>

                          <button
                            class="btn btn-primary btn-sm"
                            [disabled]="isSendingComm() || !newMessageText.trim()"
                            (click)="onSendMessage()"
                            id="comm-send-btn"
                          >
                            {{ isSendingComm() ? 'Sending...' : 'Send Message ✉️' }}
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Right: Recent Activity Log -->
                    <div class="comm-activity-card">
                      <div class="comm-thread-header">
                        <h4 style="margin: 0; font-size: 0.95rem;">Recent Activity</h4>
                        <span class="badge" style="font-size: 0.75rem; background: rgba(59, 130, 246, 0.15); color: #60a5fa;">
                          {{ activities().length }} logged
                        </span>
                      </div>

                      <div class="comm-activity-list">
                        @if (isLoadingComm()) {
                          <div class="empty-state" style="padding: 1.5rem;">Loading activity...</div>
                        } @else if (activities().length === 0) {
                          <div class="empty-state" style="padding: 1.5rem;">
                            <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">
                              No activity logged for this vendor yet.
                            </p>
                          </div>
                        } @else {
                          @for (act of activities(); track act.id) {
                            <div class="activity-timeline-item">
                              <div class="activity-dot"></div>
                              <div class="activity-content">
                                <div class="activity-header">
                                  <span class="activity-action">{{ act.action }}</span>
                                  <span class="activity-time">{{ act.created_at | date:'short' }}</span>
                                </div>
                                <div class="activity-desc">
                                  {{ act.details || (act.user_name + ' performed ' + act.action) }}
                                </div>
                              </div>
                            </div>
                          }
                        }
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                @if (canDeleteVendor() && selectedVendor()) {
                  <button
                    class="btn btn-danger btn-sm"
                    id="modal-delete-vendor-btn"
                    [disabled]="isDeleting()"
                    (click)="deleteVendor(selectedVendor()!)"
                  >
                    🗑️ Delete Vendor
                  </button>
                }
              </div>
              <button class="btn btn-secondary" (click)="selectedVendor.set(null)">Close</button>
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
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      align-items: center;
      margin-bottom: 1.5rem;
      padding: 1rem 1.5rem;
    }
    .search-box {
      flex: 1;
      min-width: 260px;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0 0.75rem;
    }
    .search-box input {
      border: none;
      background: transparent;
      padding: 0.6rem 0;
      color: var(--text-main);
      width: 100%;
    }
    .search-box input:focus {
      outline: none;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
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
    .status-pill {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      border-radius: var(--radius-full);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .status-pending {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .status-under_review {
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
      border: 1px solid rgba(168, 85, 247, 0.3);
    }
    .status-approved, .status-active {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-rejected, .status-inactive, .status-suspended {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .status-pipeline-box {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-subtle);
    }
    .pipeline-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .modal-dialog-lg {
      max-width: 760px;
    }
    .modal-tabs {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: rgba(15, 23, 42, 0.4);
      border-bottom: 1px solid var(--border-subtle);
      overflow-x: auto;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.05);
    }
    .tab-btn.active {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
    }
    .metric-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }
    .metric-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.85rem;
    }
    .metric-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }
    .metric-value {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-main);
      margin: 0.2rem 0;
    }
    .metric-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .reliability-summary-banner {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      padding: 1.25rem;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border-subtle);
      background: rgba(15, 23, 42, 0.7);
    }
    .reliability-summary-banner.risk-low {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.06);
    }
    .reliability-summary-banner.risk-med {
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.06);
    }
    .reliability-summary-banner.risk-high {
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.08);
    }
    .reliability-gauge {
      text-align: center;
      min-width: 90px;
    }
    .gauge-value {
      font-size: 2.2rem;
      font-weight: 900;
      color: var(--text-main);
      line-height: 1;
    }
    .gauge-caption {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 0.25rem;
    }
    .reliability-meta {
      flex: 1;
    }
    .risk-badge-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .recommendation-text {
      font-size: 0.85rem;
      line-height: 1.45;
      color: var(--text-main);
      margin: 0;
    }
    .breakdown-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    .breakdown-item {
      background: rgba(15, 23, 42, 0.5);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.75rem;
    }
    .breakdown-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      margin-bottom: 0.4rem;
    }
    .progress-track {
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      border-radius: 999px;
    }

    /* Communication & Activity Styles */
    .comm-tab-container {
      margin-top: 0.5rem;
    }
    .comm-grid {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 1.25rem;
    }
    @media (max-width: 900px) {
      .comm-grid {
        grid-template-columns: 1fr;
      }
    }
    .comm-thread-card, .comm-activity-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1rem;
      display: flex;
      flex-direction: column;
    }
    .comm-thread-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .comm-messages-list {
      flex: 1;
      min-height: 220px;
      max-height: 320px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-right: 0.5rem;
      margin-bottom: 1rem;
    }
    .comm-message-bubble {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.75rem 0.85rem;
      align-self: flex-start;
      max-width: 85%;
    }
    .comm-message-bubble.own-message {
      align-self: flex-end;
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.35);
    }
    .comm-msg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.35rem;
      font-size: 0.78rem;
    }
    .comm-msg-sender {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .comm-role-badge {
      font-size: 0.68rem;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-sm);
    }
    .comm-role-badge.badge-vendor {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .comm-msg-time {
      color: var(--text-muted);
      font-size: 0.72rem;
    }
    .comm-msg-body {
      font-size: 0.86rem;
      line-height: 1.45;
      word-break: break-word;
      color: var(--text-main);
    }
    .comm-msg-attachment {
      margin-top: 0.4rem;
      padding-top: 0.35rem;
      border-top: 1px dashed rgba(255, 255, 255, 0.1);
    }
    .attachment-link {
      font-size: 0.78rem;
      color: #60a5fa;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .attachment-link:hover {
      text-decoration: underline;
    }
    .comm-composer {
      border-top: 1px solid var(--border-subtle);
      padding-top: 0.75rem;
    }
    .comm-textarea {
      resize: vertical;
      min-height: 55px;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }
    .composer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .attachment-input-wrap {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .comm-activity-list {
      max-height: 380px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-right: 0.35rem;
    }
    .activity-timeline-item {
      display: flex;
      gap: 0.6rem;
      position: relative;
    }
    .activity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #3b82f6;
      margin-top: 0.35rem;
      flex-shrink: 0;
      box-shadow: 0 0 6px rgba(59, 130, 246, 0.6);
    }
    .activity-content {
      flex: 1;
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 0.45rem 0.65rem;
    }
    .activity-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.2rem;
    }
    .activity-action {
      font-size: 0.74rem;
      font-weight: 700;
      color: #93c5fd;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .activity-time {
      font-size: 0.7rem;
      color: var(--text-muted);
    }
    .activity-desc {
      font-size: 0.78rem;
      color: var(--text-main);
      line-height: 1.35;
    }
  `]
})
export class VendorsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly vendors = signal<Vendor[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isDeleting = signal<boolean>(false);
  readonly showModal = signal<boolean>(false);
  readonly selectedVendor = signal<Vendor | null>(null);
  readonly actionMessage = signal<string>('');
  readonly errorMessage = signal<string>('');

  searchQuery = '';
  selectedCategory = 'ALL';
  selectedStatus = 'ALL';

  readonly allowedCategories = [
    'Raw Material Suppliers',
    'Equipment',
    'IT',
    'Logistics',
    'Services',
    'Maintenance'
  ];

  newCompanyName = '';
  newRegNo = '';
  newCategory = 'Raw Material Suppliers';
  newStatus = 'pending';
  newNotes = '';
  contactName = '';
  contactEmail = '';
  contactPhone = '';
  reviewNotesInput = '';

  readonly filteredVendors = computed(() => {
    let list = this.vendors();
    const user = this.auth.currentUser();
    const isVendorOnly = user?.roles?.includes('Vendor') && !user?.roles?.some(r => ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Finance Officer', 'Auditor'].includes(r));
    if (isVendorOnly && user?.email) {
      list = list.filter(v => v.contacts?.some(c => c.email.toLowerCase() === user.email.toLowerCase()));
    }
    if (this.selectedCategory !== 'ALL') {
      list = list.filter(v => v.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }
    if (this.selectedStatus !== 'ALL') {
      list = list.filter(v => v.status.toLowerCase() === this.selectedStatus.toLowerCase());
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(v =>
        v.company_name.toLowerCase().includes(q) ||
        v.registration_no.toLowerCase().includes(q)
      );
    }
    return list;
  });

  ngOnInit(): void {
    this.loadVendors();
  }

  canManageStatus(): boolean {
    const roles = this.auth.currentUser()?.roles || [];
    return roles.includes('Administrator') || roles.includes('Procurement Manager');
  }

  /** Only Administrator and Procurement Manager may onboard (create) new vendors. */
  canCreateVendor(): boolean {
    const roles = this.auth.currentUser()?.roles || [];
    return roles.includes('Administrator') || roles.includes('Procurement Manager');
  }

  loadVendors(): void {
    this.isLoading.set(true);
    this.api.getVendors().subscribe({
      next: (data) => {
        this.vendors.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onSaveVendor(): void {
    if (!this.newCompanyName || !this.newRegNo) return;
    this.isSaving.set(true);
    this.errorMessage.set('');

    const contacts = this.contactName && this.contactEmail
      ? [{ name: this.contactName, email: this.contactEmail, phone: this.contactPhone }]
      : [];

    this.api.createVendor({
      company_name: this.newCompanyName,
      registration_no: this.newRegNo,
      category: this.newCategory,
      status: this.newStatus,
      review_notes: this.newNotes,
      contacts
    }).subscribe({
      next: (v) => {
        this.isSaving.set(false);
        this.showModal.set(false);
        this.actionMessage.set(`Vendor '${v.company_name}' registered successfully.`);
        this.resetForm();
        this.loadVendors();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to onboard vendor');
      }
    });
  }

  readonly activeModalTab = signal<'overview' | 'performance' | 'reliability' | 'certifications' | 'log_performance' | 'communication'>('overview');
  readonly perfSummary = signal<VendorPerformanceSummary | null>(null);
  readonly perfHistory = signal<VendorPerformance[]>([]);
  readonly reliability = signal<VendorReliability | null>(null);
  readonly reliabilityTrend = signal<VendorReliabilitySnapshot[]>([]);
  readonly isLoadingMetrics = signal<boolean>(false);
  readonly isSavingPerf = signal<boolean>(false);

  // Certifications state
  readonly certifications = signal<Certification[]>([]);
  readonly isLoadingCerts = signal<boolean>(false);
  readonly isSavingCert = signal<boolean>(false);
  readonly certError = signal<string>('');
  readonly certSuccess = signal<string>('');
  readonly showAddCertForm = signal<boolean>(false);

  newCertName = '';
  newCertStatus = 'Valid';
  newCertIssuedDate = '';
  newCertExpiryDate = '';
  selectedCertFile: File | null = null;

  // Communication state
  readonly messages = signal<CommunicationMessage[]>([]);
  readonly activities = signal<ActivityLogItem[]>([]);
  readonly availablePRs = signal<ProcurementRequest[]>([]);
  readonly isLoadingComm = signal<boolean>(false);
  readonly isSendingComm = signal<boolean>(false);
  readonly commError = signal<string>('');

  newMessageText = '';
  selectedPrId: string | null = null;
  selectedFile: File | null = null;

  perfOnTime = 10;
  perfDelayed = 1;
  perfQuality = 4.8;
  perfServiceRating: number | null = null;
  perfResponseTime = 6.0;
  perfIssueResolution = 18.0;
  perfCompletionRate = 98.0;

  openDetailModal(v: Vendor): void {
    this.selectedVendor.set(v);
    this.activeModalTab.set('overview');
    this.reviewNotesInput = v.review_notes || '';
    this.loadVendorMetrics(v.id);
    this.loadVendorCommunications(v.id);
    this.loadVendorCertifications(v.id);
  }

  loadVendorMetrics(vendorId: string): void {
    this.isLoadingMetrics.set(true);
    this.api.getVendorPerformanceSummary(vendorId).subscribe({
      next: (s) => this.perfSummary.set(s),
      error: () => this.perfSummary.set(null)
    });
    this.api.getVendorPerformance(vendorId).subscribe({
      next: (p) => this.perfHistory.set(p),
      error: () => this.perfHistory.set([])
    });
    this.api.getVendorReliability(vendorId).subscribe({
      next: (r) => this.reliability.set(r),
      error: () => this.reliability.set(null)
    });
    this.api.getVendorReliabilityTrend(vendorId).subscribe({
      next: (t) => {
        this.reliabilityTrend.set(t);
        this.isLoadingMetrics.set(false);
      },
      error: () => this.isLoadingMetrics.set(false)
    });
  }

  onRecordPerformance(): void {
    const v = this.selectedVendor();
    if (!v) return;
    this.isSavingPerf.set(true);
    this.api.createVendorPerformance(v.id, {
      on_time_deliveries: Number(this.perfOnTime),
      delayed_deliveries: Number(this.perfDelayed),
      quality_rating: Number(this.perfQuality),
      ...(this.perfServiceRating !== null && this.perfServiceRating !== undefined
        ? { service_rating: Number(this.perfServiceRating) }
        : {}),
      response_time_hours: Number(this.perfResponseTime),
      issue_resolution_time_hours: Number(this.perfIssueResolution),
      order_completion_rate: Number(this.perfCompletionRate)
    }).subscribe({
      next: () => {
        this.isSavingPerf.set(false);
        this.actionMessage.set(`Performance entry recorded successfully for ${v.company_name}.`);
        this.loadVendorMetrics(v.id);
        this.activeModalTab.set('performance');
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.isSavingPerf.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to record performance entry');
        setTimeout(() => this.errorMessage.set(''), 4000);
      }
    });
  }

  changeVendorStatus(newStatus: string): void {
    const v = this.selectedVendor();
    if (!v) return;

    this.isSaving.set(true);
    this.api.updateVendorStatus(v.id, {
      status: newStatus,
      review_notes: this.reviewNotesInput
    }).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.selectedVendor.set(null);
        this.actionMessage.set(`Vendor '${updated.company_name}' moved to ${newStatus.toUpperCase()}`);
        this.loadVendors();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to update vendor status');
      }
    });
  }

  canDeleteVendor(): boolean {
    const roles = this.auth.currentUser()?.roles || [];
    return roles.includes('Administrator') || roles.includes('Procurement Manager');
  }

  deleteVendor(vendor: Vendor, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!confirm('This will permanently delete this vendor AND all its associated purchase orders, contracts, performance history, and messages. This cannot be undone. Are you sure?')) {
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set('');
    this.api.deleteVendor(vendor.id).subscribe({
      next: (res) => {
        this.isDeleting.set(false);
        this.actionMessage.set(res?.message || `Vendor '${vendor.company_name}' deleted successfully.`);
        if (this.selectedVendor()?.id === vendor.id) {
          this.selectedVendor.set(null);
        }
        this.loadVendors();
        setTimeout(() => this.actionMessage.set(''), 4000);
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.errorMessage.set(err?.error?.detail || 'Failed to delete vendor');
        setTimeout(() => this.errorMessage.set(''), 5000);
      }
    });
  }

  private resetForm(): void {
    this.newCompanyName = '';
    this.newRegNo = '';
    this.newCategory = 'Raw Material Suppliers';
    this.newStatus = 'pending';
    this.newNotes = '';
    this.contactName = '';
    this.contactEmail = '';
    this.contactPhone = '';
  }

  onSelectCommunicationTab(): void {
    this.activeModalTab.set('communication');
    const v = this.selectedVendor();
    if (v) {
      this.loadVendorCommunications(v.id);
    }
  }

  loadVendorCommunications(vendorId: string): void {
    this.isLoadingComm.set(true);
    this.commError.set('');
    this.api.getVendorMessages(vendorId).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.isLoadingComm.set(false);
      },
      error: (err) => {
        this.isLoadingComm.set(false);
        this.commError.set(err?.error?.detail || 'Failed to load messages');
      }
    });

    this.api.getVendorActivity(vendorId).subscribe({
      next: (acts) => this.activities.set(acts),
      error: () => this.activities.set([])
    });

    if (this.availablePRs().length === 0) {
      this.api.getProcurementRequests().subscribe({
        next: (prs) => this.availablePRs.set(prs),
        error: () => {}
      });
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onSendMessage(): void {
    const v = this.selectedVendor();
    if (!v || !this.newMessageText.trim()) return;

    this.isSendingComm.set(true);
    this.commError.set('');

    const payload: { message: string; procurement_request_id?: string } = {
      message: this.newMessageText.trim()
    };
    if (this.selectedPrId) {
      payload.procurement_request_id = this.selectedPrId;
    }

    this.api.sendVendorMessage(v.id, payload).subscribe({
      next: (sentMsg) => {
        if (this.selectedFile) {
          const formData = new FormData();
          formData.append('file', this.selectedFile);
          this.api.uploadMessageAttachment(v.id, sentMsg.id, formData).subscribe({
            next: () => {
              this.selectedFile = null;
              this.isSendingComm.set(false);
              this.newMessageText = '';
              this.loadVendorCommunications(v.id);
            },
            error: (err) => {
              this.isSendingComm.set(false);
              this.commError.set(err?.error?.detail || 'Message sent, but attachment failed to upload.');
              this.loadVendorCommunications(v.id);
            }
          });
        } else {
          this.isSendingComm.set(false);
          this.newMessageText = '';
          this.loadVendorCommunications(v.id);
        }
      },
      error: (err) => {
        this.isSendingComm.set(false);
        this.commError.set(err?.error?.detail || 'Failed to send message.');
      }
    });
  }

  isOwnMessage(msg: CommunicationMessage): boolean {
    const user = this.auth.currentUser();
    return !!user && msg.sender_id === user.id;
  }

  getAttachmentUrl(msg: CommunicationMessage): string {
    const v = this.selectedVendor();
    if (!v) return '#';
    return this.api.getMessageAttachmentUrl(v.id, msg.id);
  }

  getAttachmentFilename(path: string | null | undefined): string {
    if (!path) return 'attachment';
    const parts = path.split('_');
    return parts.length > 1 ? parts.slice(1).join('_') : path;
  }

  // Certification management methods
  onSelectCertificationsTab(): void {
    this.activeModalTab.set('certifications');
    this.certError.set('');
    this.certSuccess.set('');
    const v = this.selectedVendor();
    if (v) {
      this.loadVendorCertifications(v.id);
    }
  }

  loadVendorCertifications(vendorId: string): void {
    this.isLoadingCerts.set(true);
    this.api.getVendorCertifications(vendorId).subscribe({
      next: (certs) => {
        this.certifications.set(certs);
        this.isLoadingCerts.set(false);
      },
      error: () => {
        this.certifications.set([]);
        this.isLoadingCerts.set(false);
      }
    });
  }

  onCertFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedCertFile = file;
    }
  }

  submitNewCertification(): void {
    if (!this.newCertName.trim()) {
      this.certError.set('Certification name is required.');
      return;
    }
    const v = this.selectedVendor();
    if (!v) return;

    this.isSavingCert.set(true);
    this.certError.set('');
    this.certSuccess.set('');

    const payload: CertificationCreate = {
      certification_name: this.newCertName.trim(),
      status: this.newCertStatus,
      issued_date: this.newCertIssuedDate ? new Date(this.newCertIssuedDate).toISOString() : null,
      expiry_date: this.newCertExpiryDate ? new Date(this.newCertExpiryDate).toISOString() : null
    };

    this.api.createVendorCertification(v.id, payload).subscribe({
      next: (created) => {
        if (this.selectedCertFile) {
          this.api.uploadCertificationDocument(created.id, this.selectedCertFile).subscribe({
            next: () => {
              this.finishCertCreation('Certification and document uploaded successfully.');
            },
            error: () => {
              this.finishCertCreation('Certification created, but document upload failed.');
            }
          });
        } else {
          this.finishCertCreation('Certification created successfully.');
        }
      },
      error: (err) => {
        this.isSavingCert.set(false);
        this.certError.set(err?.error?.detail || 'Failed to create certification.');
      }
    });
  }

  private finishCertCreation(msg: string): void {
    this.isSavingCert.set(false);
    this.certSuccess.set(msg);
    this.newCertName = '';
    this.newCertStatus = 'Valid';
    this.newCertIssuedDate = '';
    this.newCertExpiryDate = '';
    this.selectedCertFile = null;
    this.showAddCertForm.set(false);
    const v = this.selectedVendor();
    if (v) {
      this.loadVendorCertifications(v.id);
    }
  }

  deleteCertification(cert: Certification): void {
    if (!confirm(`Are you sure you want to delete certification "${cert.certification_name}"?`)) return;
    this.api.deleteCertification(cert.id).subscribe({
      next: () => {
        const v = this.selectedVendor();
        if (v) {
          this.loadVendorCertifications(v.id);
        }
      },
      error: (err) => {
        this.certError.set(err?.error?.detail || 'Failed to delete certification.');
      }
    });
  }
}
