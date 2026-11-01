import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProcurementService, ProcurementRequest } from '../../services/procurement.service';
import { VendorService, VendorModel, VendorCategory } from '../../services/vendor.service';
import { PurchaseOrderService, PurchaseOrder } from '../../services/purchase-order.service';
import { InvoiceService, Invoice } from '../../services/invoice.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './procurement.html',
  styleUrl: './procurement.css'
})
export class Procurement implements OnInit {
  activeTab: 'requests' | 'tracking' | 'invoices' = 'requests';

  requests: ProcurementRequest[] = [];
  vendors: VendorModel[] = [];
  categories: VendorCategory[] = [];
  orders: PurchaseOrder[] = [];
  invoices: Invoice[] = [];
  isLoading = false;
  actionMessage = '';
  errorMessage = '';
  private actionTimer: any = null;

  setActionMessage(msg: string): void {
    this.actionMessage = msg;
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.actionTimer = setTimeout(() => {
      this.actionMessage = '';
    }, 10000);
  }

  selectedStatus = 'All';
  selectedPriority = 'All';
  searchQuery = '';

  // All 6 Mandatory Procurement Statuses
  allStatuses = ['Pending', 'Approved', 'Ordered', 'Delivered', 'Completed', 'Cancelled'];
  lifecycleSteps = ['Pending', 'Approved', 'Ordered', 'In Transit', 'Delivered', 'Completed'];

  getOrderStepIndex(status: string): number {
    switch (status) {
      case 'Pending':
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'UNDER_EVALUATION':
      case 'VENDOR_SELECTED':
        return 0;
      case 'Approved':
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED':
        return 1;
      case 'Ordered':
      case 'PO_CREATED':
      case 'Issued':
      case 'Accepted':
      case 'Draft':
        return 2;
      case 'In Transit':
      case 'Dispatched':
        return 3;
      case 'Delivered':
      case 'Delayed':
      case 'Partially Delivered':
        return 4;
      case 'Completed':
      case 'COMPLETED':
      case 'PAID':
        return 5;
      case 'Cancelled':
      case 'REJECTED':
      case 'REJECTED_FINANCE':
        return -1;
      default:
        return 0;
    }
  }

  isStepActive(status: string, stepIdx: number): boolean {
    if (status === 'Cancelled' || status === 'REJECTED' || status === 'REJECTED_FINANCE') {
      return false;
    }
    return this.getOrderStepIndex(status) >= stepIdx;
  }

  isCurrentStep(status: string, stepIdx: number): boolean {
    if (status === 'Cancelled' || status === 'REJECTED' || status === 'REJECTED_FINANCE') {
      return false;
    }
    return this.getOrderStepIndex(status) === stepIdx;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Pending':
      case 'SUBMITTED':
        return 'bg-secondary';
      case 'VENDOR_SELECTED':
        return 'bg-info text-dark';
      case 'Approved':
      case 'READY_FOR_PO':
      case 'FINANCE_APPROVED':
        return 'bg-primary';
      case 'Ordered':
      case 'PO_CREATED':
      case 'Issued':
      case 'Accepted':
        return 'bg-warning text-dark';
      case 'In Transit':
      case 'Dispatched':
        return 'bg-info';
      case 'Delivered':
        return 'bg-success';
      case 'Completed':
      case 'COMPLETED':
        return 'bg-success';
      case 'Cancelled':
      case 'REJECTED':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  // Department options for procurement requests
  departments: string[] = [
    'Procurement',
    'Information Technology',
    'Manufacturing & Production',
    'Supply Chain & Logistics',
    'Corporate Finance',
    'Operations & Facilities',
    'Human Resources',
    'Research & Development'
  ];

  // New Request Modal
  showModal = false;
  newRequest: Partial<ProcurementRequest> = {
    title: '',
    description: '',
    department: 'Procurement',
    category: 'IT & Electronics',
    quantity: 10,
    unit_budget: 1500,
    estimated_budget: 15000,
    priority: 'Medium'
  };

  onProcurementUnitBudgetChange(): void {
    const qty = Number(this.newRequest.quantity) || 1;
    const unitB = Number(this.newRequest.unit_budget) || 0;
    this.newRequest.estimated_budget = Math.round(qty * unitB * 100) / 100;
  }

  onProcurementTotalBudgetChange(): void {
    const qty = Number(this.newRequest.quantity) || 1;
    const totalB = Number(this.newRequest.estimated_budget) || 0;
    this.newRequest.unit_budget = Math.round((totalB / qty) * 100) / 100;
  }

  onProcurementQuantityChange(): void {
    const qty = Number(this.newRequest.quantity) || 1;
    if (this.newRequest.unit_budget && this.newRequest.unit_budget > 0) {
      this.newRequest.estimated_budget = Math.round(qty * Number(this.newRequest.unit_budget) * 100) / 100;
    } else if (this.newRequest.estimated_budget && this.newRequest.estimated_budget > 0) {
      this.newRequest.unit_budget = Math.round((Number(this.newRequest.estimated_budget) / qty) * 100) / 100;
    }
  }

  // Vendor Assignment Modal
  showAssignModal = false;
  selectedPRForAssign: ProcurementRequest | null = null;
  selectedVendorId: number = 0;

  // Direct PO Creation from PR Modal
  showPOModal = false;
  targetPRForPO: ProcurementRequest | null = null;
  poCreationForm = {
    shipping_address: 'VendorIQ Receiving Hub, Bay 3, Logistics Center',
    terms_and_conditions: 'Net 30 Payment Terms upon delivery inspection',
    item_name: 'Industrial Grade Components Package',
    quantity: 10,
    unit_price: 1500
  };

  // Invoice Creation Modal
  showInvoiceModal = false;
  newInvoice: Partial<Invoice> = {
    invoice_number: '',
    amount: 15000,
    status: 'Submitted',
    issue_date: new Date().toISOString().substring(0, 10),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    notes: 'Standard Net 30 procurement invoice'
  };

  constructor(
    private procService: ProcurementService,
    private vendorService: VendorService,
    private poService: PurchaseOrderService,
    private invoiceService: InvoiceService,
    private notifService: NotificationService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRequests();
    this.loadInvoices();
    this.poService.getPurchaseOrders().subscribe({ next: (o) => this.orders = o });
    this.vendorService.getVendors().subscribe({ next: (v) => this.vendors = v });
    this.vendorService.getCategories().subscribe({ next: (c) => this.categories = c });
  }

  loadRequests(): void {
    this.isLoading = true;
    this.procService.getRequests({ status: this.selectedStatus, priority: this.selectedPriority }, true).subscribe({
      next: (data) => {
        this.requests = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  loadInvoices(): void {
    this.invoiceService.getInvoices().subscribe({
      next: (data) => this.invoices = data
    });
  }

  openNewModal(): void {
    this.newRequest = {
      title: '',
      description: '',
      department: 'Procurement',
      category: this.categories[0]?.name || 'IT & Electronics',
      quantity: 10,
      unit_budget: 1500,
      estimated_budget: 15000,
      priority: 'Medium'
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  submitRequest(): void {
    if (!this.newRequest.title || !this.newRequest.category) return;
    const requestData = { ...this.newRequest };

    // 1. Immediately close modal — zero buffering
    this.closeModal();

    // 2. Immediately show successful complete message
    this.setActionMessage(`Procurement Request "${requestData.title}" submitted successfully!`);
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    const optimisticReq: ProcurementRequest = {
      id: Date.now(),
      title: requestData.title || '',
      description: requestData.description,
      department: requestData.department || 'Procurement',
      category: requestData.category || '',
      quantity: Number(requestData.quantity) || 1,
      unit_budget: Number(requestData.unit_budget) || 0,
      estimated_budget: Number(requestData.estimated_budget) || 0,
      priority: requestData.priority || 'Medium',
      status: 'Pending',
      created_at: new Date().toISOString()
    };
    this.requests = [optimisticReq, ...this.requests];

    // 4. Background network submission
    this.procService.createRequest(requestData).subscribe({
      next: (created) => {
        this.setActionMessage(`Procurement Request "${created.title}" submitted successfully!`);
        this.notifService.createNotification({
          title: `Procurement Request Submitted: ${created.title}`,
          message: `Requisition for ${created.category} ($${Number(created.estimated_budget).toLocaleString()}) awaits approval.`,
          type: 'procurement'
        }).subscribe();
        this.loadRequests();
      },
      error: (err) => {
        this.requests = this.requests.filter(r => r.id !== optimisticReq.id);
        this.errorMessage = err?.error?.detail || 'Failed to create request.';
      }
    });
  }

  advanceStatus(id: number | undefined, nextStatus: string): void {
    if (!id) return;
    this.procService.updateStatus(id, nextStatus).subscribe({
      next: () => {
        this.notifService.createNotification({
          title: `Procurement Request Status Updated: ${nextStatus}`,
          message: `Requisition #${id} advanced to ${nextStatus}.`,
          type: 'procurement'
        }).subscribe();
        this.loadRequests();
      },
      error: (err) => alert(err?.error?.detail || 'Failed to update status.')
    });
  }

  openAssignModal(pr: ProcurementRequest): void {
    this.selectedPRForAssign = pr;
    if (pr.assigned_vendor_id) {
      this.selectedVendorId = pr.assigned_vendor_id;
    } else {
      const matching = this.vendors.find(v => v.category === pr.category);
      this.selectedVendorId = matching ? matching.id! : (this.vendors[0]?.id || 1);
    }
    this.showAssignModal = true;
  }

  confirmVendorAssignment(): void {
    if (!this.selectedPRForAssign || !this.selectedPRForAssign.id) return;
    const vendorId = Number(this.selectedVendorId);
    const vendor = this.vendors.find(v => v.id === vendorId);
    const prId = this.selectedPRForAssign.id;
    const prTitle = this.selectedPRForAssign.title;
    const vendorName = vendor?.name || 'Vendor';

    // 1. Immediately close modal — zero buffering
    this.showAssignModal = false;

    // 2. Immediately show successful complete message
    this.setActionMessage(`Supplier "${vendorName}" successfully assigned to ${prTitle}!`);
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    const req = this.requests.find(r => r.id === prId);
    if (req) {
      req.assigned_vendor_id = vendorId;
      req.vendor_name = vendorName;
      req.status = 'Approved';
    }

    // 4. Background network submission
    this.procService.updateRequest(prId, { assigned_vendor_id: vendorId }).subscribe({
      next: () => {
        this.notifService.createNotification({
          title: `Supplier Assigned to PR-${prId}`,
          message: `${vendorName} (${vendor?.category}) assigned to handle requisition.`,
          type: 'procurement'
        }).subscribe();
        this.loadRequests();
      },
      error: (err) => {
        this.errorMessage = err?.error?.detail || 'Failed to assign supplier.';
        this.loadRequests();
      }
    });
  }

  openPOModal(pr: ProcurementRequest): void {
    this.targetPRForPO = pr;
    if (pr.assigned_vendor_id) {
      this.selectedVendorId = pr.assigned_vendor_id;
    } else {
      const matching = this.vendors.find(v => v.category === pr.category) || this.vendors[0];
      this.selectedVendorId = matching ? matching.id! : 1;
    }
    this.poCreationForm = {
      shipping_address: 'VendorIQ Receiving Hub, Bay 3, Logistics Center',
      terms_and_conditions: 'Net 30 Payment Terms upon delivery inspection',
      item_name: pr.title || 'Procured Package Items',
      quantity: 1,
      unit_price: Number(pr.estimated_budget || 10000)
    };
    this.showPOModal = true;
  }

  getVendorName(vendorId?: number): string {
    if (!vendorId) return 'Unassigned';
    const v = this.vendors.find(item => item.id === vendorId);
    return v ? v.name : `Supplier #${vendorId}`;
  }

  getVendorCompany(vendorId?: number): string {
    if (!vendorId) return '';
    const v = this.vendors.find(item => item.id === vendorId);
    return v ? v.company : '';
  }

  submitPOCreation(): void {
    if (!this.targetPRForPO) return;
    const targetPR = this.targetPRForPO;
    const prId = targetPR.id!;
    const vendorId = Number(this.selectedVendorId);
    const vendorName = this.getVendorName(vendorId);
    const tempPoNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      vendor_id: vendorId,
      procurement_request_id: prId,
      currency: 'USD',
      shipping_address: this.poCreationForm.shipping_address,
      terms_and_conditions: this.poCreationForm.terms_and_conditions,
      items: [
        {
          item_name: this.poCreationForm.item_name,
          description: targetPR.description || 'Standard line item specification',
          quantity: this.poCreationForm.quantity,
          unit_price: this.poCreationForm.unit_price,
          sku: `SKU-PR${prId}-01`
        }
      ]
    };

    // 1. Immediately close modal — zero buffering
    this.showPOModal = false;

    // 2. Immediately show successful complete message
    this.setActionMessage(`Purchase Order ${tempPoNum} generated successfully for ${targetPR.title}!`);
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Optimistic local update
    this.advanceStatus(prId, 'Ordered');
    const optimisticPO: PurchaseOrder = {
      id: Date.now(),
      po_number: tempPoNum,
      vendor_id: vendorId,
      vendor_name: vendorName,
      status: 'Issued',
      total_amount: this.poCreationForm.quantity * this.poCreationForm.unit_price,
      created_at: new Date().toISOString(),
      items: [
        {
          item_name: this.poCreationForm.item_name,
          quantity: this.poCreationForm.quantity,
          unit_price: this.poCreationForm.unit_price,
          total_price: this.poCreationForm.quantity * this.poCreationForm.unit_price,
          sku: `SKU-PR${prId}-01`
        }
      ]
    };
    this.orders = [optimisticPO, ...this.orders];

    // 4. Background network submission
    this.poService.createPurchaseOrder(payload).subscribe({
      next: (createdPO) => {
        this.setActionMessage(`Purchase Order ${createdPO.po_number} generated successfully!`);
        this.notifService.createNotification({
          title: `Purchase Order ${createdPO.po_number} Created`,
          message: `Issued from approved PR for $${Number(createdPO.total_amount).toLocaleString()}.`,
          type: 'procurement'
        }).subscribe();
        this.loadRequests();
      },
      error: (err) => {
        this.errorMessage = err?.error?.detail || 'Failed to generate PO.';
        this.loadRequests();
      }
    });
  }

  // Invoice Management
  openNewInvoiceModal(): void {
    this.newInvoice = {
      invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      vendor_id: this.vendors[0]?.id || 1,
      purchase_order_id: this.orders[0]?.id || 1,
      amount: 15000,
      status: 'Submitted',
      issue_date: new Date().toISOString().substring(0, 10),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      notes: 'Net 30 invoice against verified delivery inspection'
    };
    this.showInvoiceModal = true;
  }

  submitNewInvoice(): void {
    if (!this.newInvoice.invoice_number || !this.newInvoice.amount) return;
    this.invoiceService.createInvoice(this.newInvoice).subscribe({
      next: () => {
        this.showInvoiceModal = false;
        this.loadInvoices();
        alert('Invoice registered successfully!');
      },
      error: (err) => alert(err?.error?.detail || 'Failed to create invoice.')
    });
  }

  approveInvoice(id: number): void {
    this.invoiceService.updateInvoiceStatus(id, { status: 'Approved' }).subscribe({
      next: () => this.loadInvoices()
    });
  }

  payInvoice(id: number): void {
    this.invoiceService.updateInvoiceStatus(id, { status: 'Paid', payment_method: 'Automated Corporate Wire' }).subscribe({
      next: () => this.loadInvoices()
    });
  }

  getStatusBadge(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved': return 'badge-approved';
      case 'ordered': return 'badge-ordered';
      case 'delivered': return 'badge-delivered';
      case 'completed': return 'badge-completed';
      case 'cancelled': return 'badge-rejected';
      default: return 'badge-pending';
    }
  }

  getVendorReliabilityScore(vendorId?: number): number {
    if (!vendorId) return 92;
    const v = this.vendors.find(item => item.id === vendorId);
    return v?.deliveryRate || 90;
  }
}
