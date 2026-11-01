import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, NgClass, DatePipe, CurrencyPipe } from '@angular/common';
import { PurchaseOrderService, PurchaseOrder, POItem } from '../../services/purchase-order.service';
import { VendorService, VendorModel } from '../../services/vendor.service';
import { ProcurementService, ProcurementRequest } from '../../services/procurement.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-purchase-orders',
  imports: [FormsModule, NgIf, NgFor, NgClass, DatePipe, CurrencyPipe],
  templateUrl: './purchase-orders.html',
  styleUrl: './purchase-orders.css'
})
export class PurchaseOrders implements OnInit {
  orders: PurchaseOrder[] = [];
  vendors: VendorModel[] = [];
  procurementRequests: ProcurementRequest[] = [];
  isLoading = false;
  isSubmitting = false;
  actionMessage = '';
  errorMessage = '';
  private actionTimer: any = null;

  selectedStatus = 'All';
  searchQuery = '';
  selectedPO: PurchaseOrder | null = null;

  showModal = false;
  newPO: Partial<PurchaseOrder> = {
    vendor_id: 0,
    currency: 'USD',
    shipping_address: '',
    terms_and_conditions: 'Net 30 Payment Terms',
    items: []
  };

  newItems: POItem[] = [
    { item_name: '', description: '', quantity: 1, unit_price: 0, sku: '' }
  ];

  constructor(
    private poService: PurchaseOrderService,
    private vendorService: VendorService,
    private procService: ProcurementService,
    public authService: AuthService
  ) {}

  selectedVendorFilter = 'All';

  ngOnInit(): void {
    this.loadOrders();
    this.vendorService.getVendors().subscribe({ next: (v) => this.vendors = v });
    if (this.authService.currentUserValue?.role !== 'Vendor') {
      this.procService.getRequests().subscribe({ next: (r) => this.procurementRequests = r });
    }
  }

  setActionMessage(msg: string): void {
    this.actionMessage = msg;
    if (this.actionTimer) clearTimeout(this.actionTimer);
    this.actionTimer = setTimeout(() => {
      this.actionMessage = '';
    }, 10000);
  }

  loadOrders(): void {
    this.isLoading = true;
    const filters: any = { status: this.selectedStatus };
    this.poService.getPurchaseOrders(filters, true).subscribe({
      next: (data) => {
        this.orders = data || [];
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  isMyPO(po?: PurchaseOrder | null): boolean {
    if (!po) return false;
    const user = this.authService.currentUserValue;
    if (!user || user.role !== 'Vendor') return false;
    if (user.vendor_id && (po.vendor_id === user.vendor_id || po.vendor?.id === user.vendor_id)) {
      return true;
    }
    const userComp = (user.company || '').trim().toLowerCase();
    const poComp = (po.vendor_company || po.vendor?.company || '').trim().toLowerCase();
    if (userComp && poComp && (userComp === poComp || userComp.includes(poComp) || poComp.includes(userComp))) {
      return true;
    }
    const userName = (user.full_name || '').trim().toLowerCase();
    const poName = (po.vendor_name || po.vendor?.name || '').trim().toLowerCase();
    if (userName && poName && (userName === poName || userName.includes(poName) || poName.includes(userName))) {
      return true;
    }
    return false;
  }

  get filteredOrders(): PurchaseOrder[] {
    let list = this.orders;
    if (this.selectedVendorFilter !== 'All') {
      const vid = Number(this.selectedVendorFilter);
      list = list.filter(po => po.vendor_id === vid || po.vendor?.id === vid);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(po =>
      (po.po_number || '').toLowerCase().includes(q) ||
      (po.vendor_name || '').toLowerCase().includes(q) ||
      (po.vendor_company || '').toLowerCase().includes(q) ||
      (po.status || '').toLowerCase().includes(q)
    );
  }

  get totalValue(): number {
    return this.filteredOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);
  }

  get pendingCount(): number {
    return this.orders.filter(po => po.status?.toLowerCase() === 'pending approval').length;
  }

  get activeCount(): number {
    return this.orders.filter(po => ['issued', 'accepted', 'approved'].includes(po.status?.toLowerCase())).length;
  }

  get completedCount(): number {
    return this.orders.filter(po => ['delivered', 'completed'].includes(po.status?.toLowerCase())).length;
  }

  addItemRow(): void {
    this.newItems.push({ item_name: '', description: '', quantity: 1, unit_price: 0, sku: '' });
  }

  removeItemRow(index: number): void {
    if (this.newItems.length > 1) {
      this.newItems.splice(index, 1);
    }
  }

  calculateTotal(): number {
    return this.newItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  }

  openNewModal(): void {
    this.newPO = {
      vendor_id: this.vendors[0]?.id || 0,
      currency: 'USD',
      shipping_address: 'Central Logistics Receiving Hub, Dock 4',
      terms_and_conditions: 'Net 30 upon delivery inspection',
      items: []
    };
    this.newItems = [{ item_name: '', description: '', quantity: 1, unit_price: 0, sku: '' }];
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  submitPO(): void {
    if (!this.newPO.vendor_id || this.newItems.length === 0) {
      alert('Please select a vendor and add at least one item.');
      return;
    }
    const payload = {
      ...this.newPO,
      vendor_id: Number(this.newPO.vendor_id),
      items: this.newItems.filter(i => i.item_name.trim() !== '')
    };
    const vendor = this.vendors.find(v => v.id === payload.vendor_id);
    const vendorName = vendor ? vendor.name : `Vendor #${payload.vendor_id}`;
    const tempNum = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    this.closeModal();
    this.setActionMessage(`Purchase Order ${tempNum} for ${vendorName} issued successfully!`);
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const optimisticPO: PurchaseOrder = {
      id: Date.now(),
      po_number: tempNum,
      vendor_id: payload.vendor_id,
      vendor_name: vendorName,
      status: 'Issued',
      total_amount: this.calculateTotal(),
      expected_delivery_date: payload.expected_delivery_date || new Date().toISOString().substring(0, 10),
      items: payload.items,
      created_at: new Date().toISOString()
    };
    this.orders = [optimisticPO, ...this.orders];

    this.poService.createPurchaseOrder(payload).subscribe({
      next: (res) => {
        if (res?.po_number) {
          this.setActionMessage(`Purchase Order ${res.po_number} for ${vendorName} issued successfully!`);
        }
        this.loadOrders();
      },
      error: (err) => {
        this.orders = this.orders.filter(o => o.id !== optimisticPO.id);
        this.errorMessage = err?.error?.detail || 'Failed to create PO.';
        this.loadOrders();
      }
    });
  }

  viewDetail(po: PurchaseOrder): void {
    this.selectedPO = po;
  }

  closeDetail(): void {
    this.selectedPO = null;
  }

  approvePO(po: PurchaseOrder): void {
    this.poService.approvePurchaseOrder(po.id!).subscribe({
      next: () => {
        this.setActionMessage(`Purchase Order #${po.po_number} approved!`);
        this.loadOrders();
        if (this.selectedPO && this.selectedPO.id === po.id) this.selectedPO.status = 'Approved';
      },
      error: (err) => alert(err?.error?.detail || 'Failed to approve PO.')
    });
  }

  rejectPO(po: PurchaseOrder): void {
    if (!confirm(`Are you sure you want to reject Purchase Order #${po.po_number}?`)) return;
    this.poService.rejectPurchaseOrder(po.id!).subscribe({
      next: () => {
        this.setActionMessage(`Purchase Order #${po.po_number} has been rejected.`);
        this.loadOrders();
        if (this.selectedPO && this.selectedPO.id === po.id) this.selectedPO.status = 'Rejected';
      },
      error: (err) => alert(err?.error?.detail || 'Failed to reject PO.')
    });
  }

  acceptOrder(po: PurchaseOrder): void {
    this.poService.updateStatus(po.id!, 'Accepted').subscribe({
      next: () => {
        this.setActionMessage(`Purchase Order #${po.po_number} accepted.`);
        this.loadOrders();
        if (this.selectedPO && this.selectedPO.id === po.id) this.selectedPO.status = 'Accepted';
      },
      error: (err) => alert(err?.error?.detail || 'Failed to accept PO.')
    });
  }

  advancePOStatus(po: PurchaseOrder, status: string): void {
    this.poService.updateStatus(po.id!, status).subscribe({
      next: () => {
        this.loadOrders();
        if (this.selectedPO && this.selectedPO.id === po.id) this.selectedPO.status = status;
      },
      error: (err) => alert(err?.error?.detail || 'Failed to update status.')
    });
  }

  getStatusBadge(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved': return 'badge-approved';
      case 'pending approval': return 'badge-pending';
      case 'issued': return 'badge-ordered';
      case 'accepted': return 'badge-approved';
      case 'delivered': return 'badge-delivered';
      case 'completed': return 'badge-completed';
      case 'rejected':
      case 'cancelled': return 'badge-rejected';
      default: return 'badge-pending';
    }
  }
}
