import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { NgIf, NgFor, NgClass, DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { CommunicationService, AuditLog } from '../../services/communication.service';
import { AuthService, User } from '../../services/auth.service';
import { PurchaseOrderService, PurchaseOrder } from '../../services/purchase-order.service';
import { ContractService, Contract } from '../../services/contract.service';
import { InvoiceService, Invoice } from '../../services/invoice.service';
import { VendorService, VendorModel } from '../../services/vendor.service';
import { ProcurementService, ProcurementRequest } from '../../services/procurement.service';
import { SupplyChainService, SupplyDisruptionAlert, ShipmentFlow, PreventiveActionRecord } from '../../services/supply-chain.service';
import { AuditService } from '../../services/audit.service';
import { AuditExportService, AuditExportPayload } from '../../services/audit-export.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FormsModule, NgIf, NgFor, NgClass, DatePipe, CurrencyPipe, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  stats: DashboardStats | null = null;
  recentActivities: AuditLog[] = [];
  filteredActivities: AuditLog[] = [];
  auditFilter = 'ALL';

  purchaseOrders: PurchaseOrder[] = [];
  contracts: Contract[] = [];
  invoices: Invoice[] = [];
  vendors: VendorModel[] = [];

  // Procurement Evaluation & Decision Support
  evalCategoryFilter = 'All';
  evalSearchQuery = '';
  quickViewVendor: VendorModel | null = null;
  selectedVendorForPR: VendorModel | null = null;
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

  showProcureModal = false;
  newPR: Partial<ProcurementRequest> = {
    title: '',
    category: '',
    department: 'Procurement',
    quantity: 10,
    unit_budget: 2500,
    estimated_budget: 25000,
    priority: 'High',
    description: ''
  };

  onQuickPRUnitBudgetChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    const unitB = Number(this.newPR.unit_budget) || 0;
    this.newPR.estimated_budget = Math.round(qty * unitB * 100) / 100;
  }

  onQuickPRTotalBudgetChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    const totalB = Number(this.newPR.estimated_budget) || 0;
    this.newPR.unit_budget = Math.round((totalB / qty) * 100) / 100;
  }

  onQuickPRQuantityChange(): void {
    const qty = Number(this.newPR.quantity) || 1;
    if (this.newPR.unit_budget && this.newPR.unit_budget > 0) {
      this.newPR.estimated_budget = Math.round(qty * Number(this.newPR.unit_budget) * 100) / 100;
    } else if (this.newPR.estimated_budget && this.newPR.estimated_budget > 0) {
      this.newPR.unit_budget = Math.round((Number(this.newPR.estimated_budget) / qty) * 100) / 100;
    }
  }

  // Supply Chain Management & Re-sourcing Coordination
  supplyAlerts: SupplyDisruptionAlert[] = [];
  shipmentFlows: ShipmentFlow[] = [];
  preventiveActions: PreventiveActionRecord[] = [];
  selectedShipmentForAction: ShipmentFlow | null = null;
  selectedVendorForCoordination: VendorModel | null = null;
  showPreventiveActionModal = false;
  showCoordinationModal = false;
  activeReSourcingAlert: SupplyDisruptionAlert | null = null;
  activeSourcingHighlightBanner = '';

  preventiveActionForm = {
    action_type: 'Expedite Express Freight' as 'Expedite Express Freight' | 'Allocate Buffer Stock' | 'Quality Inspection Quarantine' | 'Formal Supplier SLA Warning',
    notes: ''
  };

  coordinationForm = {
    vendor_id: 0,
    vendor_name: '',
    product: '',
    category: 'Raw Material Suppliers',
    severity: 'Critical' as 'Critical' | 'High' | 'Medium',
    issue_summary: '',
    recommended_action: 'Procurement to select qualified alternative vendor with >= 90% delivery rate.'
  };

  isLoading = true;
  currentUser$: Observable<User | null>;
  currentUser: User | null = null;
  private userSub?: Subscription;
  private subs: Subscription[] = [];

  // Active Role View - Strictly locked to authenticated user's assigned role
  activeRoleView = 'Procurement Manager';

  // Active Dashboard View - Strictly locked to authenticated user's assigned role
  activeDashboardTab: 'Procurement' | 'Vendor' | 'Admin' | 'SupplyChain' | 'Finance' | 'Auditor' = 'Procurement';

  // Access denied notification if routed from roleGuard
  accessDeniedMessage = '';

  // Action status toast
  actionMessage = '';

  constructor(
    private dashService: DashboardService,
    private commsService: CommunicationService,
    private poService: PurchaseOrderService,
    private contractService: ContractService,
    private invoiceService: InvoiceService,
    private vendorService: VendorService,
    private procService: ProcurementService,
    public scService: SupplyChainService,
    public authService: AuthService,
    private route: ActivatedRoute,
    private auditService: AuditService,
    private auditExportService: AuditExportService
  ) {
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    const routeRole = this.route.snapshot.data['roleView'];
    const initialRole = this.currentUser?.role || routeRole || 'Procurement Manager';
    this.setDashboardForRole(initialRole);

    this.userSub = this.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.setDashboardForRole(user.role);
      }
    });

    // Subscribe to real-time supply chain flows & re-sourcing alerts
    this.subs.push(this.scService.alerts$.subscribe(alerts => this.supplyAlerts = alerts));
    this.subs.push(this.scService.flows$.subscribe(flows => this.shipmentFlows = flows));
    this.subs.push(this.scService.actions$.subscribe(actions => this.preventiveActions = actions));

    this.subs.push(this.route.queryParams.subscribe(params => {
      if (params['accessDenied']) {
        const resource = params['resource'] ? `/${params['resource']}` : 'another dashboard';
        this.accessDeniedMessage = `Access Restricted: Your role (${this.currentUser?.role}) is not authorized to access ${resource}. You have been redirected to your dedicated dashboard.`;
        setTimeout(() => this.accessDeniedMessage = '', 8000);
      }
    }));

    this.loadData();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.subs.forEach(s => s.unsubscribe());
  }

  private setDashboardForRole(role?: string): void {
    if (!role) return;
    this.activeRoleView = role;
    switch (role) {
      case 'Administrator':
        this.activeDashboardTab = 'Admin';
        break;
      case 'Vendor':
        this.activeDashboardTab = 'Vendor';
        break;
      case 'Supply Chain Manager':
        this.activeDashboardTab = 'SupplyChain';
        break;
      case 'Finance Officer':
        this.activeDashboardTab = 'Finance';
        break;
      case 'Auditor':
        this.activeDashboardTab = 'Auditor';
        break;
      case 'Procurement Manager':
      default:
        this.activeDashboardTab = 'Procurement';
        break;
    }
  }

  setActiveDashboardTab(tab: 'Procurement' | 'Vendor' | 'Admin' | 'SupplyChain' | 'Finance' | 'Auditor'): void {
    // Strictly locked: user can only view their own designated dashboard
    const userRole = this.currentUser?.role || this.activeRoleView;
    this.setDashboardForRole(userRole);
  }

  loadData(): void {
    this.isLoading = true;
    const role = this.currentUser?.role || this.activeRoleView;

    // 1. Stats are fetched dynamically for all roles
    this.dashService.getStats(true).subscribe({
      next: (data) => {
        this.stats = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    // 2. Load all entities for rich cross-dashboard dynamic views
    this.poService.getPurchaseOrders({}, true).subscribe(pos => {
      this.purchaseOrders = pos;
    });

    this.vendorService.getVendors({}, true).subscribe(v => this.vendors = v);
    this.contractService.getContracts({}, true).subscribe(cnts => this.contracts = cnts);
    this.invoiceService.getInvoices().subscribe(invs => this.invoices = invs);
    this.commsService.getAuditLogs(30).subscribe(logs => {
      this.recentActivities = logs;
      this.applyAuditFilter();
    });
  }


  applyAuditFilter(): void {
    if (this.auditFilter === 'ALL') {
      this.filteredActivities = this.recentActivities;
    } else {
      this.filteredActivities = this.recentActivities.filter(a => a.action.includes(this.auditFilter));
    }
  }

  // Finance Actions
  approveInvoice(inv: Invoice): void {
    this.invoiceService.updateInvoiceStatus(inv.id, { status: 'Approved' }).subscribe({
      next: (updated) => {
        inv.status = 'Approved';
        this.flashAction(`Invoice #${inv.invoice_number} approved for payment processing.`);
      }
    });
  }

  markInvoicePaid(inv: Invoice): void {
    this.invoiceService.updateInvoiceStatus(inv.id, { status: 'Paid', payment_method: 'Electronic Funds Transfer' }).subscribe({
      next: (updated) => {
        inv.status = 'Paid';
        if (this.stats && this.stats.paid_invoices !== undefined) {
          this.stats.paid_invoices++;
          if (this.stats.pending_payout_amount) {
            this.stats.pending_payout_amount -= inv.amount;
          }
        }
        this.flashAction(`Payment processed successfully for Invoice #${inv.invoice_number} ($${inv.amount.toLocaleString()}).`);
      }
    });
  }

  // Vendor Actions
  acceptOrder(po: PurchaseOrder): void {
    if (!po.id) return;
    this.poService.updateStatus(po.id, 'Accepted').subscribe({
      next: (updated: PurchaseOrder) => {
        po.status = updated.status;
        this.flashAction(`Purchase Order #${po.po_number} accepted successfully.`);
      },
      error: (err: any) => alert(err?.error?.detail || 'Failed to accept purchase order.')
    });
  }

  rejectOrder(po: PurchaseOrder): void {
    if (!po.id) return;
    const reason = prompt('Please enter the reason for rejecting this purchase order:');
    if (reason === null) return;
    this.poService.rejectPurchaseOrder(po.id).subscribe({
      next: (updated: PurchaseOrder) => {
        po.status = updated.status;
        this.flashAction(`Purchase Order #${po.po_number} rejected.`);
      },
      error: (err: any) => alert(err?.error?.detail || 'Failed to reject purchase order.')
    });
  }

  confirmDelivery(po: PurchaseOrder): void {
    if (!po.id) return;
    this.poService.updateStatus(po.id, 'Delivered').subscribe({
      next: (updated: PurchaseOrder) => {
        po.status = updated.status;
        this.flashAction(`Delivery confirmation recorded for Order #${po.po_number}. Procurement notified.`);
      },
      error: (err: any) => alert(err?.error?.detail || 'Failed to confirm delivery.')
    });
  }

  // Auditor Action
  exportAuditReport(format: 'pdf' | 'excel'): void {
    this.auditService.getTransactionChains().subscribe({
      next: (chains) => {
        this.auditService.getFindings().subscribe({
          next: (findings) => {
            this.auditService.getDiscrepancies().subscribe({
              next: (discrepancies) => {
                const payload: AuditExportPayload = {
                  auditorName: this.currentUser?.full_name || 'Senior Compliance Auditor',
                  transactionChains: chains,
                  discrepancies: discrepancies,
                  findings: findings,
                  auditLogs: this.recentActivities,
                  stats: this.stats
                };
                if (format === 'excel') {
                  this.auditExportService.exportToExcel(payload);
                  this.flashAction('Official ISO-compliant VendorIQ Audit Ledger (.XLSX) generated & downloaded to your Downloads folder.');
                } else {
                  this.auditExportService.exportToPdf(payload);
                  this.flashAction('Official ISO-compliant VendorIQ Audit Dossier (.PDF) generated & downloaded to your Downloads folder.');
                }
              },
              error: () => this.fallbackAuditExport(format)
            });
          },
          error: () => this.fallbackAuditExport(format)
        });
      },
      error: () => this.fallbackAuditExport(format)
    });
  }

  printAuditDossier(): void {
    this.auditService.getTransactionChains().subscribe({
      next: (chains) => {
        const payload: AuditExportPayload = {
          auditorName: this.currentUser?.full_name || 'Senior Compliance Auditor',
          transactionChains: chains,
          auditLogs: this.recentActivities,
          stats: this.stats
        };
        this.auditExportService.printDossier(payload);
      },
      error: () => {
        const payload: AuditExportPayload = {
          auditorName: this.currentUser?.full_name || 'Senior Compliance Auditor',
          auditLogs: this.recentActivities,
          stats: this.stats
        };
        this.auditExportService.printDossier(payload);
      }
    });
  }

  private fallbackAuditExport(format: 'pdf' | 'excel'): void {
    const payload: AuditExportPayload = {
      auditorName: this.currentUser?.full_name || 'Senior Compliance Auditor',
      auditLogs: this.recentActivities,
      stats: this.stats
    };
    if (format === 'excel') {
      this.auditExportService.exportToExcel(payload);
      this.flashAction('Official ISO-compliant VendorIQ Audit Ledger (.XLSX) generated & downloaded to your Downloads folder.');
    } else {
      this.auditExportService.exportToPdf(payload);
      this.flashAction('Official ISO-compliant VendorIQ Audit Dossier (.PDF) generated & downloaded to your Downloads folder.');
    }
  }

  flashAction(msg: string): void {
    this.actionMessage = msg;
    setTimeout(() => this.actionMessage = '', 4500);
  }

  getActionBadge(action: string): string {
    if (action.includes('APPROVED') || action.includes('PAID')) return 'badge-approved';
    if (action.includes('REJECTED') || action.includes('FAILED')) return 'badge-rejected';
    if (action.includes('CREATED') || action.includes('REGISTER')) return 'badge-ordered';
    return 'badge-pending';
  }

  // Procurement Evaluation & Decision Matrix Helpers
  getEvaluatedVendors(): VendorModel[] {
    return this.vendors.filter(v => {
      const matchCat = this.evalCategoryFilter === 'All' || v.category === this.evalCategoryFilter;
      const q = this.evalSearchQuery.toLowerCase().trim();
      const matchSearch = !q || v.name.toLowerCase().includes(q) || v.company.toLowerCase().includes(q) || v.product.toLowerCase().includes(q);
      return matchCat && matchSearch;
    }).sort((a, b) => b.deliveryRate - a.deliveryRate);
  }

  getRiskyVendors(): VendorModel[] {
    return this.vendors.filter(v => v.risk_level === 'High' || v.deliveryRate < 80 || v.status === 'Pending');
  }

  getSuitabilityTag(v: VendorModel): { label: string; badgeClass: string; icon: string } {
    if (v.risk_level === 'High' || v.deliveryRate < 70) {
      return { label: 'High Risk - Avoid', badgeClass: 'bg-danger text-white', icon: 'bi-exclamation-octagon-fill' };
    }
    if (v.status === 'Pending' || v.risk_level === 'Medium' || v.deliveryRate < 85) {
      return { label: 'Caution: Review', badgeClass: 'bg-warning text-dark', icon: 'bi-exclamation-triangle-fill' };
    }
    if (v.deliveryRate >= 92 && v.status === 'Approved') {
      return { label: 'Highly Recommended', badgeClass: 'bg-success text-white', icon: 'bi-check-circle-fill' };
    }
    return { label: 'Qualified Supplier', badgeClass: 'bg-primary text-white', icon: 'bi-shield-check' };
  }

  openVendorQuickView(v: VendorModel): void {
    this.quickViewVendor = v;
  }

  closeVendorQuickView(): void {
    this.quickViewVendor = null;
  }

  openProcurementModal(v: VendorModel): void {
    this.selectedVendorForPR = v;
    this.newPR = {
      title: `Procurement Order for ${v.name}`,
      category: v.category,
      department: 'Procurement',
      quantity: 10,
      unit_budget: 3500,
      estimated_budget: 35000,
      priority: 'High',
      description: `Requisition order for ${v.product}. Selected based on high delivery reliability score (${v.deliveryRate}%).`
    };
    this.showProcureModal = true;
  }

  closeProcureModal(): void {
    this.showProcureModal = false;
    this.selectedVendorForPR = null;
  }

  submitQuickProcurement(): void {
    if (!this.newPR.title || !this.selectedVendorForPR) return;
    const payload = {
      ...this.newPR,
      assigned_vendor_id: this.selectedVendorForPR.id
    };
    this.procService.createRequest(payload).subscribe({
      next: () => {
        const vendorName = this.selectedVendorForPR?.name || 'Selected Supplier';
        this.flashAction(`Purchase Requisition created successfully for ${vendorName}. Procurement pipeline updated.`);

        // If this procurement was initiated in response to a Supply Chain Re-sourcing alert, resolve it!
        if (this.activeReSourcingAlert) {
          const alertRef = this.activeReSourcingAlert;
          this.scService.resolveDisruptionAlert(alertRef.id, vendorName, this.selectedVendorForPR?.id).subscribe();
          this.flashAction(`Re-sourcing resolved: ${vendorName} designated as replacement for ${alertRef.vendor_name}. Supply Chain notified.`);
          this.clearActiveReSourcing();
        }

        this.closeProcureModal();
        if (this.stats && this.stats.total_procurement_requests !== undefined) {
          this.stats.total_procurement_requests++;
        }
      },
      error: (err) => {
        alert(err?.error?.detail || 'Failed to submit procurement request.');
      }
    });
  }

  // =========================================================================
  // Supply Chain Management & Re-sourcing Coordination Methods
  // =========================================================================

  openPreventiveActionModal(flow: ShipmentFlow): void {
    this.selectedShipmentForAction = flow;
    this.preventiveActionForm = {
      action_type: flow.status === 'Critical Delay' ? 'Expedite Express Freight' : 'Allocate Buffer Stock',
      notes: `Triggered preventive mitigation for ${flow.product_name} (${flow.po_number}) currently in ${flow.status} state.`
    };
    this.showPreventiveActionModal = true;
  }

  closePreventiveActionModal(): void {
    this.showPreventiveActionModal = false;
    this.selectedShipmentForAction = null;
  }

  submitPreventiveAction(): void {
    if (!this.selectedShipmentForAction) return;
    const flow = this.selectedShipmentForAction;
    this.scService.recordPreventiveAction({
      shipment_id: flow.id,
      po_number: flow.po_number,
      vendor_id: flow.vendor_id,
      vendor_name: flow.vendor_name,
      action_type: this.preventiveActionForm.action_type,
      notes: this.preventiveActionForm.notes,
      performed_by: `${this.currentUser?.full_name || 'Supply Chain Manager'}`
    }).subscribe(() => {
      this.flashAction(`Preventive action recorded: [${this.preventiveActionForm.action_type}] for ${flow.vendor_name}.`);
      this.closePreventiveActionModal();
    });
  }

  openCoordinationModal(vendor?: VendorModel, flow?: ShipmentFlow): void {
    if (vendor) {
      this.selectedVendorForCoordination = vendor;
      this.coordinationForm = {
        vendor_id: vendor.id || 0,
        vendor_name: vendor.name,
        product: vendor.product,
        category: vendor.category,
        severity: (vendor.deliveryRate < 70 || vendor.risk_level === 'High') ? 'Critical' : 'High',
        issue_summary: `Supplier delivery rate dropped to ${vendor.deliveryRate}%. Risk of supply chain disruption and stockout.`,
        recommended_action: `Procurement Manager to evaluate and select an approved replacement supplier in ${vendor.category} with >= 90% delivery rate.`
      };
    } else if (flow) {
      this.coordinationForm = {
        vendor_id: flow.vendor_id,
        vendor_name: flow.vendor_name,
        product: flow.product_name,
        category: flow.category,
        severity: flow.status === 'Critical Delay' ? 'Critical' : 'High',
        issue_summary: `Shipment ${flow.po_number} is ${flow.delay_days} day(s) overdue. Inventory availability status: ${flow.availability_status}.`,
        recommended_action: `Procurement Manager to initiate alternative supplier requisition for ${flow.product_name} (${flow.category}).`
      };
    } else {
      this.coordinationForm = {
        vendor_id: 0,
        vendor_name: '',
        product: '',
        category: 'Raw Material Suppliers',
        severity: 'High',
        issue_summary: '',
        recommended_action: 'Procurement to select alternative supplier to maintain continuous product flow.'
      };
    }
    this.showCoordinationModal = true;
  }

  closeCoordinationModal(): void {
    this.showCoordinationModal = false;
    this.selectedVendorForCoordination = null;
  }

  submitCoordinationRequest(): void {
    if (!this.coordinationForm.vendor_name || !this.coordinationForm.product) {
      alert('Please specify the vendor and affected product.');
      return;
    }
    const matchingVendor = this.vendors.find(v => v.name === this.coordinationForm.vendor_name || v.id === this.coordinationForm.vendor_id) || {
      id: this.coordinationForm.vendor_id || 99,
      name: this.coordinationForm.vendor_name,
      product: this.coordinationForm.product,
      category: this.coordinationForm.category,
      deliveryRate: 65,
      status: 'Approved',
      risk_level: 'High'
    } as VendorModel;

    this.scService.createDisruptionAlert({
      vendor: matchingVendor,
      product: this.coordinationForm.product,
      category: this.coordinationForm.category,
      severity: this.coordinationForm.severity,
      issue_summary: this.coordinationForm.issue_summary,
      recommended_action: this.coordinationForm.recommended_action,
      reported_by: `${this.currentUser?.full_name || 'Supply Chain Manager'}`
    }).subscribe(alert => {
      this.flashAction(`Re-sourcing Alert #${alert.id} transmitted to Procurement Manager. Status: Open.`);
      this.closeCoordinationModal();
    });
  }

  findAlternativeForAlert(alert: SupplyDisruptionAlert): void {
    this.evalCategoryFilter = alert.category;
    this.activeReSourcingAlert = alert;
    this.activeSourcingHighlightBanner = `Active Re-sourcing Request: Showing qualified alternative suppliers in "${alert.category}" to replace ${alert.vendor_name} for "${alert.product}".`;

    setTimeout(() => {
      const matrixEl = document.getElementById('vendor-eval-matrix');
      if (matrixEl) {
        matrixEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }

  clearActiveReSourcing(): void {
    this.activeReSourcingAlert = null;
    this.activeSourcingHighlightBanner = '';
  }

  resolveAlertDirectly(alert: SupplyDisruptionAlert): void {
    this.scService.resolveDisruptionAlert(alert.id, 'Procurement Alternative Sourced').subscribe(() => {
      this.flashAction(`Re-sourcing ticket #${alert.id} closed and marked Resolved.`);
    });
  }

  getOpenAlerts(): SupplyDisruptionAlert[] {
    return this.supplyAlerts.filter(a => a.status !== 'Resolved');
  }

  getDelayedFlowsCount(): number {
    return this.shipmentFlows.filter(f => f.status === 'Delayed' || f.status === 'Critical Delay').length;
  }

  getStockoutRiskCount(): number {
    return this.shipmentFlows.filter(f => f.availability_status === 'Stockout Risk').length;
  }

  getUnreliableVendors(): VendorModel[] {
    return this.vendors.filter(v => v.deliveryRate < 80 || v.risk_level === 'High');
  }

  getCostByCategoryList(): { category: string; amount: number; percentage: number }[] {
    const catSpend = this.stats?.procurement_dashboard?.procurement_cost_analysis?.cost_by_category || {};
    const total = this.stats?.procurement_dashboard?.procurement_cost_analysis?.total_cost || 1;
    const entries = Object.entries(catSpend);
    if (entries.length === 0) {
      return [
        { category: 'Raw Material Suppliers', amount: 195000, percentage: 59 },
        { category: 'Logistics Partners', amount: 85000, percentage: 26 },
        { category: 'IT Vendors', amount: 48000, percentage: 15 }
      ];
    }
    return entries.map(([category, amount]) => ({
      category,
      amount,
      percentage: Math.min(100, Math.round((amount / (total || 1)) * 100))
    }));
  }

  getVendorsByCategoryList(): { category: string; count: number; percentage: number }[] {
    const cats = this.stats?.admin_dashboard?.vendor_analytics?.vendors_by_category || {};
    const total = this.stats?.admin_dashboard?.vendor_analytics?.total_vendors || (this.vendors.length || 1);
    const entries = Object.entries(cats);
    if (entries.length === 0) {
      const map: Record<string, number> = {};
      for (const v of this.vendors) {
        const cat = v.category || 'Raw Material Suppliers';
        map[cat] = (map[cat] || 0) + 1;
      }
      return Object.entries(map).map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100)
      }));
    }
    return entries.map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / (total || 1)) * 100)
    }));
  }

  getUsersByRoleList(): { role: string; count: number }[] {
    const roles = this.stats?.admin_dashboard?.user_management?.users_by_role || this.stats?.role_distribution || {};
    const defaultRoles = ['Administrator', 'Procurement Manager', 'Supply Chain Manager', 'Vendor', 'Finance Officer', 'Auditor'];
    return defaultRoles.map(role => ({
      role,
      count: roles[role] || (role === 'Supply Chain Manager' ? 3 : 1)
    }));
  }
}

