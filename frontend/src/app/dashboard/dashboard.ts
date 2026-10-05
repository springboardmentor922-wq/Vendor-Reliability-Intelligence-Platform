import { Component, inject, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VendorService } from '../vendor.service';
import { PurchaseOrder, Vendor, UserRole, ProcurementRequest, Contract, PerformanceMetric, ReportItem } from '../vendor.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements AfterViewInit {
  public vendorService = inject(VendorService);
  private router = inject(Router);

  @ViewChild('riskDonutCanvas') riskDonutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChartCanvas') trendChartCanvas!: ElementRef<HTMLCanvasElement>;

  riskChart?: Chart;
  trendChart?: Chart;

  activeTab: string = 'dashboard';
  searchTerm: string = '';
  userInitials: string = 'AB';
  isSidebarCollapsed: boolean = false;

  showPOModal: boolean = false;
  showVendorModal: boolean = false;

  newPO: PurchaseOrder = {
    id: 0,
    po_number: '',
    vendor_name: '',
    category: 'Logistics & Supply',
    total_amount: 0,
    status: 'Active',
    deliveryStatus: 'On Schedule',
    invoiceStatus: 'Pending Audit',
    created_date: new Date().toISOString().substring(0, 10)
  };

  newVendor: Vendor = {
    id: 0,
    vendor_code: '',
    name: '',
    category: 'General Supplier',
    status: 'Pending',
    reliabilityScore: 85.0,
    riskLevel: 'Low',
    vendorRank: 0,
    contact_email: '',
    onTimeDeliveryRate: 90.0,
    qualityComplianceRate: 95.0
  };

  get currentUser() {
    return this.vendorService.currentUser();
  }

  get availableRoles(): UserRole[] {
    return this.vendorService.availableRoles;
  }

  get notifications() {
    return this.vendorService.notifications();
  }

  get microservices() {
    return this.vendorService.microservices();
  }

  get communications() {
    return this.vendorService.communications();
  }

  get totalSpend(): number {
    return this.vendorService.totalSpend() || 0;
  }

  get avgReliability(): string | number {
    return this.vendorService.avgReliability() || 0;
  }

  get highRiskCount(): number {
    return this.vendorService.highRiskCount() || 0;
  }

  get filteredVendors(): Vendor[] {
    const list = this.vendorService.vendors() || [];
    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(v => 
      v.name?.toLowerCase().includes(term) ||
      v.vendor_code?.toLowerCase().includes(term) ||
      v.category?.toLowerCase().includes(term)
    );
  }

  get filteredPOs(): PurchaseOrder[] {
    const list = this.vendorService.purchaseOrders() || [];
    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(po =>
      po.po_number?.toLowerCase().includes(term) ||
      po.vendor_name?.toLowerCase().includes(term) ||
      po.category?.toLowerCase().includes(term)
    );
  }

  get filteredProcurements(): ProcurementRequest[] {
    const list = this.vendorService.procurements() || [];
    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(p =>
      p.req_number?.toLowerCase().includes(term) ||
      p.item_description?.toLowerCase().includes(term) ||
      p.assigned_vendor?.toLowerCase().includes(term)
    );
  }

  get filteredContracts(): Contract[] {
    const list = this.vendorService.contracts() || [];
    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(c =>
      c.title?.toLowerCase().includes(term) ||
      c.vendor_name?.toLowerCase().includes(term)
    );
  }

  get filteredPerformance(): PerformanceMetric[] {
    const list = this.vendorService.performance() || [];
    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(pm => pm.vendor_name?.toLowerCase().includes(term));
  }

  get filteredReports(): ReportItem[] {
    const list = this.vendorService.reports() || [];
    if (!this.searchTerm.trim()) return list;
    const term = this.searchTerm.toLowerCase();
    return list.filter(r => r.title?.toLowerCase().includes(term) || r.category?.toLowerCase().includes(term));
  }

  ngAfterViewInit(): void {
    this.renderCharts();
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'dashboard' || tab === 'performance') {
      setTimeout(() => this.renderCharts(), 100);
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  onRoleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.vendorService.switchUserRole(target.value as UserRole);
    }
  }

  togglePOModal(): void {
    this.showPOModal = !this.showPOModal;
    if (this.showPOModal) {
      this.newPO.po_number = `PO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  toggleVendorModal(): void {
    this.showVendorModal = !this.showVendorModal;
    if (this.showVendorModal) {
      this.newVendor.vendor_code = `VND-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  submitPO(): void {
    if (this.newPO.po_number && this.newPO.vendor_name && this.newPO.total_amount) {
      this.vendorService.createPO({ ...this.newPO, id: Date.now() });
      this.togglePOModal();
      this.resetPOForm();
      this.renderCharts();
    }
  }

  submitVendor(): void {
    if (this.newVendor.name && this.newVendor.contact_email) {
      this.vendorService.createVendor({ ...this.newVendor, id: Date.now() });
      this.toggleVendorModal();
      this.resetVendorForm();
      this.renderCharts();
    }
  }

  approveVendor(id: number): void {
    this.vendorService.approveVendor(id);
  }

  approveProcurement(id: number): void {
    this.vendorService.approveProcurement(id);
  }

  dispatchSMSAlert(vendorEmail: string): void {
    this.vendorService.dispatchCommunication('SMS (Twilio)', vendorEmail, 'SLA Breach Warning Dispatched');
    alert(`Automated SMS SLA alert dispatched to ${vendorEmail}`);
  }

  downloadReport(reportTitle: string, format: string): void {
    const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '_')}.${format.toLowerCase()}`;
    alert(`Generating & downloading ${filename}...`);
  }

  logout(): void {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }

  private resetPOForm(): void {
    this.newPO = {
      id: 0,
      po_number: '',
      vendor_name: '',
      category: 'Logistics & Supply',
      total_amount: 0,
      status: 'Active',
      deliveryStatus: 'On Schedule',
      invoiceStatus: 'Pending Audit',
      created_date: new Date().toISOString().substring(0, 10)
    };
  }

  private resetVendorForm(): void {
    this.newVendor = {
      id: 0,
      vendor_code: '',
      name: '',
      category: 'General Supplier',
      status: 'Pending',
      reliabilityScore: 85.0,
      riskLevel: 'Low',
      vendorRank: 0,
      contact_email: '',
      onTimeDeliveryRate: 90.0,
      qualityComplianceRate: 95.0
    };
  }

  // --- Chart Rendering Engine ---
  private renderCharts(): void {
    this.renderRiskDonut();
    this.renderTrendBarChart();
  }

  private renderRiskDonut(): void {
    if (!this.riskDonutCanvas) return;
    if (this.riskChart) this.riskChart.destroy();

    const vendors = this.vendorService.vendors() || [];
    const lowRisk = vendors.filter(v => v.riskLevel === 'Low').length;
    const medRisk = vendors.filter(v => v.riskLevel === 'Medium').length;
    const highRisk = vendors.filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length;

    this.riskChart = new Chart(this.riskDonutCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Low Risk', 'Medium Risk', 'High/Critical Risk'],
        datasets: [{
          data: [lowRisk || 5, medRisk || 2, highRisk || 1],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  private renderTrendBarChart(): void {
    if (!this.trendChartCanvas) return;
    if (this.trendChart) this.trendChart.destroy();

    const pos = this.vendorService.purchaseOrders() || [];
    const performance = this.vendorService.performance() || [];

    const labels = performance.length > 0 ? performance.map(p => p.vendor_name) : ['Vendor A', 'Vendor B', 'Vendor C', 'Vendor D'];
    const scores = performance.length > 0 ? performance.map(p => p.overall_score) : [92, 85, 78, 95];
    const spendData = labels.map(name => {
      const vendorPOs = pos.filter(po => po.vendor_name === name);
      return vendorPOs.reduce((acc, current) => acc + (current.total_amount || 0), 0) || 45000;
    });

    this.trendChart = new Chart(this.trendChartCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total PO Spend ($)',
            data: spendData,
            backgroundColor: '#3b82f6',
            yAxisID: 'y'
          },
          {
            label: 'Reliability Score (%)',
            data: scores,
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            type: 'line',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Spend ($)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Reliability Score (%)' }
          }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }
}
