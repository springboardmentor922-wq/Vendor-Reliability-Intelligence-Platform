import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Approval {
  id: number;
  vendor_id: number;
  status: string;
  approved_by: string | null;
  remarks: string | null;
}

@Component({
  selector: 'app-vendor-approval',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="eyebrow">VENDOR OPERATIONS</div>
          <h1>Vendor Approval</h1>
          <p>Review and manage vendor approval requests.</p>
        </div>

        <div class="header-status">
          <span class="status-dot"></span>
          Procurement Workspace
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-grid">

        <div class="summary-card">
          <div class="summary-label">TOTAL REQUESTS</div>
          <div class="summary-value">{{ approvals.length }}</div>
          <div class="summary-note">Approval records</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">PENDING</div>
          <div class="summary-value">{{ pendingCount }}</div>
          <div class="summary-note">Require review</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">APPROVED</div>
          <div class="summary-value">{{ approvedCount }}</div>
          <div class="summary-note">Approved vendors</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">REJECTED</div>
          <div class="summary-value">{{ rejectedCount }}</div>
          <div class="summary-note">Rejected requests</div>
        </div>

      </div>

      <!-- Create Approval -->
      <div class="content-card create-card">

        <div class="section-heading">
          <div>
            <h2>Create Approval Request</h2>
            <p>Start a new vendor approval workflow.</p>
          </div>
        </div>

        <div class="create-form">

          <div class="field">
            <label for="vendorId">Vendor ID</label>

            <input
              id="vendorId"
              type="number"
              [(ngModel)]="vendorId"
              placeholder="Enter vendor ID"
            />

            <span class="field-hint">
              Enter the registered vendor ID to create an approval request.
            </span>
          </div>

          <button
            class="primary-button"
            (click)="createApproval()"
          >
            + Create Approval
          </button>

        </div>

      </div>

      <!-- Approval Table -->
      <div class="content-card">

        <div class="section-heading">
          <div>
            <h2>Approval Requests</h2>
            <p>Monitor vendor requests and take required actions.</p>
          </div>

          <button
            class="refresh-button"
            (click)="loadApprovals()"
          >
            Refresh
          </button>
        </div>

        <div
          *ngIf="approvals.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">✓</div>
          <h3>No approval requests</h3>
          <p>There are currently no vendor approval requests to review.</p>
        </div>

        <div
          *ngIf="approvals.length > 0"
          class="table-wrapper"
        >

          <table>

            <thead>
              <tr>
                <th>APPROVAL ID</th>
                <th>VENDOR ID</th>
                <th>STATUS</th>
                <th>APPROVED BY</th>
                <th>REMARKS</th>
                <th>ACTION</th>
              </tr>
            </thead>

            <tbody>

              <tr *ngFor="let approval of approvals">

                <td>
                  <span class="id-value">
                    #{{ approval.id }}
                  </span>
                </td>

                <td>
                  <span class="vendor-id">
                    V-{{ approval.vendor_id }}
                  </span>
                </td>

                <td>
                  <span
                    class="badge"
                    [class.pending]="approval.status === 'PENDING'"
                    [class.approved]="approval.status === 'APPROVED'"
                    [class.rejected]="approval.status === 'REJECTED'"
                  >
                    {{ approval.status }}
                  </span>
                </td>

                <td>
                  {{ approval.approved_by || '—' }}
                </td>

                <td>
                  {{ approval.remarks || '—' }}
                </td>

                <td>

                  <div
                    *ngIf="approval.status === 'PENDING'"
                    class="action-buttons"
                  >

                    <button
                      class="approve-button"
                      (click)="approve(approval.id)"
                    >
                      Approve
                    </button>

                    <button
                      class="reject-button"
                      (click)="reject(approval.id)"
                    >
                      Reject
                    </button>

                  </div>

                  <span
                    *ngIf="approval.status !== 'PENDING'"
                    class="completed-text"
                  >
                    Completed
                  </span>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

    </div>
  `,

  styles: [`

    * {
      box-sizing: border-box;
    }

    .page {
      min-height: 100vh;
      background: #f4f6f8;
      padding: 32px 36px 50px;
      color: #172033;
    }

    /* HEADER */

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
    }

    .eyebrow {
      color: #607086;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      margin-bottom: 8px;
    }

    h1 {
      margin: 0;
      color: #172033;
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .page-header p {
      margin: 8px 0 0;
      color: #6b7788;
      font-size: 14px;
    }

    .header-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      border: 1px solid #dce2e8;
      border-radius: 8px;
      background: white;
      color: #596779;
      font-size: 12px;
      font-weight: 600;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4f8f82;
    }

    /* SUMMARY */

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 22px;
    }

    .summary-card {
      background: white;
      border: 1px solid #e0e5ea;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(25, 38, 55, 0.04);
    }

    .summary-label {
      color: #778394;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .summary-value {
      margin-top: 8px;
      color: #182337;
      font-size: 27px;
      font-weight: 700;
    }

    .summary-note {
      margin-top: 5px;
      color: #8993a1;
      font-size: 12px;
    }

    /* CARDS */

    .content-card {
      background: white;
      border: 1px solid #e0e5ea;
      border-radius: 10px;
      margin-bottom: 22px;
      box-shadow: 0 2px 8px rgba(25, 38, 55, 0.04);
      overflow: hidden;
    }

    .create-card {
      padding: 24px;
    }

    .section-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 22px 24px;
      border-bottom: 1px solid #edf0f3;
    }

    .create-card .section-heading {
      padding: 0;
      border-bottom: none;
    }

    .section-heading h2 {
      margin: 0;
      color: #1b2739;
      font-size: 17px;
      font-weight: 700;
    }

    .section-heading p {
      margin: 5px 0 0;
      color: #7b8796;
      font-size: 12px;
    }

    /* FORM */

    .create-form {
      display: flex;
      align-items: flex-end;
      gap: 18px;
      margin-top: 22px;
    }

    .field {
      display: flex;
      flex-direction: column;
      width: 310px;
    }

    .field label {
      margin-bottom: 7px;
      color: #465365;
      font-size: 12px;
      font-weight: 700;
    }

    .field input {
      height: 42px;
      padding: 0 13px;
      border: 1px solid #d5dce4;
      border-radius: 7px;
      outline: none;
      color: #273447;
      background: #fbfcfd;
      font-size: 13px;
    }

    .field input:focus {
      border-color: #5f7f9f;
      background: white;
    }

    .field-hint {
      margin-top: 6px;
      color: #929ca8;
      font-size: 11px;
    }

    .primary-button {
      height: 42px;
      padding: 0 18px;
      border: none;
      border-radius: 7px;
      background: #24364d;
      color: white;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .primary-button:hover {
      background: #1b2b40;
    }

    /* REFRESH */

    .refresh-button {
      padding: 8px 13px;
      border: 1px solid #d9e0e7;
      border-radius: 6px;
      background: white;
      color: #596779;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .refresh-button:hover {
      background: #f5f7f9;
    }

    /* TABLE */

    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #f7f8fa;
    }

    th {
      padding: 13px 18px;
      border-bottom: 1px solid #e5e9ed;
      color: #7a8695;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.7px;
      white-space: nowrap;
    }

    td {
      padding: 16px 18px;
      border-bottom: 1px solid #edf0f3;
      color: #536073;
      font-size: 12px;
      white-space: nowrap;
    }

    tbody tr:hover {
      background: #fafbfc;
    }

    .id-value {
      color: #28384d;
      font-weight: 700;
    }

    .vendor-id {
      color: #4f6074;
      font-weight: 600;
    }

    /* STATUS */

    .badge {
      display: inline-block;
      padding: 5px 9px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 700;
    }

    .pending {
      background: #fff4df;
      color: #9a6a19;
    }

    .approved {
      background: #e8f3ef;
      color: #397265;
    }

    .rejected {
      background: #f8e9e9;
      color: #9b4d4d;
    }

    /* ACTIONS */

    .action-buttons {
      display: flex;
      gap: 7px;
    }

    .approve-button,
    .reject-button {
      padding: 6px 10px;
      border-radius: 5px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }

    .approve-button {
      border: 1px solid #b9d5cc;
      background: #edf7f3;
      color: #3d7569;
    }

    .approve-button:hover {
      background: #e1f1ec;
    }

    .reject-button {
      border: 1px solid #e2c1c1;
      background: #fbefef;
      color: #985454;
    }

    .reject-button:hover {
      background: #f6e4e4;
    }

    .completed-text {
      color: #9aa3ae;
      font-size: 11px;
    }

    /* EMPTY */

    .empty-state {
      padding: 55px 20px;
      text-align: center;
    }

    .empty-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      margin-bottom: 12px;
      border-radius: 50%;
      background: #edf3f5;
      color: #547d78;
      font-weight: 700;
    }

    .empty-state h3 {
      margin: 0;
      color: #39475a;
      font-size: 15px;
    }

    .empty-state p {
      margin: 6px 0 0;
      color: #8a95a2;
      font-size: 12px;
    }

    /* RESPONSIVE */

    @media (max-width: 900px) {

      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .page {
        padding: 24px 20px;
      }

      .create-form {
        flex-direction: column;
        align-items: stretch;
      }

      .field {
        width: 100%;
      }

    }

    @media (max-width: 600px) {

      .page-header {
        flex-direction: column;
        gap: 15px;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }

    }

  `]
})

export class VendorApprovalComponent implements OnInit {

  approvals: Approval[] = [];

  vendorId: number | null = null;

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadApprovals();
  }

  get pendingCount(): number {
    return this.approvals.filter(
      a => a.status === 'PENDING'
    ).length;
  }

  get approvedCount(): number {
    return this.approvals.filter(
      a => a.status === 'APPROVED'
    ).length;
  }

  get rejectedCount(): number {
    return this.approvals.filter(
      a => a.status === 'REJECTED'
    ).length;
  }

  loadApprovals(): void {

    this.http
      .get<Approval[]>(
        'http://localhost:8000/api/vendor-approvals/'
      )
      .subscribe({
        next: (data) => {
          this.approvals = data;
        },

        error: (error) => {
          console.error(
            'Error loading approvals:',
            error
          );
        }
      });

  }

  createApproval(): void {

    if (
      this.vendorId === null ||
      this.vendorId <= 0
    ) {
      alert('Please enter a valid Vendor ID.');
      return;
    }

    this.http
      .post(
        'http://localhost:8000/api/vendor-approvals/',
        null,
        {
          params: {
            vendor_id: this.vendorId.toString()
          }
        }
      )
      .subscribe({
        next: () => {

          alert(
            'Vendor approval request created successfully.'
          );

          this.vendorId = null;

          this.loadApprovals();

        },

        error: (error) => {

          console.error(
            'Error creating approval:',
            error
          );

          alert(
            'Failed to create vendor approval request.'
          );

        }
      });

  }

  approve(id: number): void {

    this.http
      .put(
        `http://localhost:8000/api/vendor-approvals/${id}/approve`,
        null,
        {
          params: {
            approved_by: 'Procurement Manager',
            remarks: 'Vendor approved'
          }
        }
      )
      .subscribe({
        next: () => {

          alert(
            'Vendor approved successfully.'
          );

          this.loadApprovals();

        },

        error: (error) => {

          console.error(
            'Error approving vendor:',
            error
          );

          alert(
            'Failed to approve vendor.'
          );

        }
      });

  }

  reject(id: number): void {

    this.http
      .put(
        `http://localhost:8000/api/vendor-approvals/${id}/reject`,
        null,
        {
          params: {
            approved_by: 'Procurement Manager',
            remarks: 'Vendor rejected'
          }
        }
      )
      .subscribe({
        next: () => {

          alert(
            'Vendor rejected successfully.'
          );

          this.loadApprovals();

        },

        error: (error) => {

          console.error(
            'Error rejecting vendor:',
            error
          );

          alert(
            'Failed to reject vendor.'
          );

        }
      });

  }

}