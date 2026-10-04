import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RequisitionService, PurchaseRequisition, CreatePRPayload } from '../../../services/requisition.service';
import { AuthService, User } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-requesting-user-dashboard',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor, NgClass, DatePipe, DecimalPipe],
  templateUrl: './requesting-user-dashboard.html',
  styleUrl: './requesting-user-dashboard.css'
})
export class RequestingUserDashboard implements OnInit {
  currentUser: User | null = null;
  requisitions: PurchaseRequisition[] = [];
  selectedRequisition: PurchaseRequisition | null = null;

  showCreateModal = false;
  showDetailModal = false;
  isLoading = true;
  actionMessage = '';
  isSubmitting = false;
  private actionTimer: any = null;

  setActionMessage(msg: string): void {
    this.actionMessage = msg;
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.actionTimer = setTimeout(() => {
      this.actionMessage = '';
    }, 10000);
  }

  newPR: CreatePRPayload = {
    department: 'Information Technology',
    product_name: '',
    quantity: 10,
    unit_budget: 1500,
    required_date: '',
    priority: 'High',
    reason: '',
    category: 'IT Vendors',
    estimated_budget: 15000
  };

  onRequestPRUnitBudgetChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    const unitB = Number(this.newPR.unit_budget) || 0;
    this.newPR.estimated_budget = Math.round(qty * unitB * 100) / 100;
  }

  onRequestPRTotalBudgetChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    const totalB = Number(this.newPR.estimated_budget) || 0;
    this.newPR.unit_budget = Math.round((totalB / qty) * 100) / 100;
  }

  onRequestPRQuantityChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    if (this.newPR.unit_budget && this.newPR.unit_budget > 0) {
      this.newPR.estimated_budget = Math.round(qty * Number(this.newPR.unit_budget) * 100) / 100;
    } else if (this.newPR.estimated_budget && this.newPR.estimated_budget > 0) {
      this.newPR.unit_budget = Math.round((Number(this.newPR.estimated_budget) / qty) * 100) / 100;
    }
  }

  departments = [
    'Information Technology',
    'Manufacturing & Production',
    'Supply Chain & Logistics',
    'Corporate Finance',
    'Operations & Facilities',
    'Human Resources',
    'Research & Development'
  ];

  categories = [
    'Raw Material Suppliers',
    'Equipment Vendors',
    'IT Vendors',
    'Service Providers',
    'Logistics Partners',
    'Maintenance Vendors'
  ];

  statusFilter = 'All';

  constructor(
    private prService: RequisitionService,
    private authService: AuthService,
    private notifService: NotificationService
  ) {}

  filterAndScroll(status: string): void {
    this.statusFilter = status;
    this.loadRequisitions();
    const el = document.getElementById('requisitions-table-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('section-highlight');
      setTimeout(() => el.classList.remove('section-highlight'), 2500);
    }
  }

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    if (this.currentUser?.department) {
      this.newPR.department = this.currentUser.department;
    }
    this.loadRequisitions();
  }

  loadRequisitions(): void {
    this.isLoading = true;
    this.prService.getRequisitions(this.statusFilter).subscribe({
      next: (data) => {
        this.requisitions = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  openCreateModal(): void {
    this.newPR = {
      department: this.currentUser?.department || 'Information Technology',
      product_name: '',
      quantity: 10,
      required_date: '',
      priority: 'High',
      reason: '',
      category: 'IT Vendors',
      estimated_budget: 15000
    };
    this.showCreateModal = true;
    this.actionMessage = '';
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  submitRequisition(): void {
    if (!this.newPR.product_name.trim() || !this.newPR.reason.trim() || this.newPR.quantity <= 0) {
      alert('Please fill in product name, positive quantity, and reason.');
      return;
    }

    const payload = { ...this.newPR };
    const tempNum = `PR-2026-${String(this.requisitions.length + 1).padStart(4, '0')}`;
    const prTitle = payload.product_name;

    // 1. Immediately close modal — zero buffering
    this.closeCreateModal();

    // 2. Immediately show successful complete message on dashboard
    this.setActionMessage(`Purchase Requisition ${tempNum} (${prTitle}) submitted successfully and routed to Procurement Manager!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    const optimisticPR: PurchaseRequisition = {
      id: Date.now(),
      request_number: tempNum,
      department: payload.department,
      title: payload.product_name,
      description: payload.reason,
      quantity: payload.quantity,
      required_date: payload.required_date,
      priority: payload.priority,
      category: payload.category,
      estimated_budget: payload.estimated_budget || 0,
      status: 'SUBMITTED',
      created_at: new Date().toISOString()
    };
    this.requisitions = [optimisticPR, ...this.requisitions];

    // 4. Background network submission
    this.prService.createRequisition(payload).subscribe({
      next: (res) => {
        this.setActionMessage(`Purchase Requisition ${res.request_number} submitted successfully and routed to Procurement Manager!`);
        this.loadRequisitions();
      },
      error: (err) => {
        this.requisitions = this.requisitions.filter(r => r.id !== optimisticPR.id);
        alert(err.error?.detail || 'Failed to submit requisition.');
        this.loadRequisitions();
      }
    });
  }

  viewDetails(pr: PurchaseRequisition): void {
    this.prService.getRequisition(pr.id).subscribe({
      next: (data) => {
        this.selectedRequisition = data;
        this.showDetailModal = true;
      },
      error: () => {
        this.selectedRequisition = pr;
        this.showDetailModal = true;
      }
    });
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedRequisition = null;
  }

  getPendingCount(): number {
    return this.requisitions.filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length;
  }

  getApprovedCount(): number {
    return this.requisitions.filter(r => ['READY_FOR_PO', 'PO_CREATED', 'COMPLETED', 'Ordered', 'Delivered'].includes(r.status)).length;
  }

  getRejectedCount(): number {
    return this.requisitions.filter(r => r.status.includes('REJECTED')).length;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'SUBMITTED': return 'badge-submitted';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'VENDOR_SELECTED': return 'badge-selected';
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED': return 'badge-approved';
      case 'PO_CREATED':
      case 'Ordered': return 'badge-ordered';
      case 'Pending':
      case 'SUBMITTED': return 'badge-submitted';
      case 'UNDER_REVIEW': return 'badge-review';
      case 'VENDOR_SELECTED': return 'badge-selected';
      case 'Approved':
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED': return 'badge-approved';
      case 'Ordered':
      case 'PO_CREATED':
      case 'Issued':
      case 'Accepted': return 'badge-ordered';
      case 'In Transit': return 'badge-transit';
      case 'Delivered':
      case 'Completed':
      case 'COMPLETED': return 'badge-completed';
      default: return (status && status.includes('REJECT')) ? 'badge-rejected' : 'badge-secondary';
    }
  }

  getStepProgress(status: string): number {
    switch (status) {
      case 'Pending':
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'UNDER_EVALUATION':
        return 1;
      case 'VENDOR_SELECTED':
        return 2;
      case 'Approved':
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED':
        return 3;
      case 'Ordered':
      case 'PO_CREATED':
      case 'Issued':
      case 'Accepted':
      case 'Draft':
        return 4;
      case 'In Transit':
      case 'Dispatched':
        return 5;
      case 'Delivered':
      case 'Delayed':
      case 'Partially Delivered':
        return 6;
      case 'Completed':
      case 'COMPLETED':
      case 'PAID':
        return 7;
      default:
        return 1;
    }
  }
}
