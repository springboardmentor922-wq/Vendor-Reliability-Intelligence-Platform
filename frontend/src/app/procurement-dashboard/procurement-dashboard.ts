import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface PurchaseOrder {
  id: string;
  vendorName: string;
  category: string;
  items: string;
  amount: number;
  orderDate: string;
  expectedDelivery: string;
  actualDelivery?: string;
  status: 'Pending' | 'Approved' | 'Ordered' | 'Delivered' | 'Completed' | 'Cancelled';
  paymentStatus: 'Paid' | 'Pending' | 'Overdue';
  reliabilityScore: number;
}

export interface Invoice {
  invoiceNumber: string;
  poNumber: string;
  vendorName: string;
  invoiceDate: string;
  dueDate: string;
  items: { description: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

@Component({
  selector: 'app-procurement-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './procurement-dashboard.html',
  styleUrl: './procurement-dashboard.scss'
})
export class ProcurementDashboardComponent implements AfterViewInit {
  @ViewChild('overviewChart') overviewChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('activePoChart') activePoChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarChart') radarChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('costAnalysisChart') costAnalysisChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('deliveryGaugeChart') deliveryGaugeChart!: ElementRef<HTMLCanvasElement>;

  // KPIs
  kpis = [
    { title: 'Total Purchase Orders', value: '124', trend: '↑ 12% vs last month', icon: '📋' },
    { title: 'Total Procurement Cost', value: '₹ 8.6M', trend: '↑ 5% vs last month', icon: '💰' },
    { title: 'Active Vendors', value: '42', trend: '↑ 8% vs last month', icon: '👥' },
    { title: 'Items Procured', value: '1,240', trend: '↑ 15% vs last month', icon: '📦' }
  ];

  // Purchase Orders Data Table
  orders: PurchaseOrder[] = [
    { id: 'PO-2026-001', vendorName: 'Apex Raw Materials', category: 'Raw Material Suppliers', items: 'Industrial Steel Sheet (500 Units)', amount: 450000, orderDate: '2026-09-10', expectedDelivery: '2026-09-20', actualDelivery: '2026-09-19', status: 'Delivered', paymentStatus: 'Paid', reliabilityScore: 92 },
    { id: 'PO-2026-002', vendorName: 'LogiSpeed Corp', category: 'Logistics Partners', items: 'Freight Transport Services', amount: 120000, orderDate: '2026-09-15', expectedDelivery: '2026-09-22', actualDelivery: '2026-09-25', status: 'Delivered', paymentStatus: 'Pending', reliabilityScore: 68 },
    { id: 'PO-2026-003', vendorName: 'TechSphere IT', category: 'Information Technology', items: 'Server Infrastructure Upgrades', amount: 890000, orderDate: '2026-09-18', expectedDelivery: '2026-10-05', status: 'Ordered', paymentStatus: 'Pending', reliabilityScore: 88 },
    { id: 'PO-2026-004', vendorName: 'BuildPro Equipment', category: 'Equipment Vendors', items: 'Heavy Hydraulic Rig Parts', amount: 640000, orderDate: '2026-09-20', expectedDelivery: '2026-10-10', status: 'Approved', paymentStatus: 'Pending', reliabilityScore: 74 },
    { id: 'PO-2026-005', vendorName: 'CleanCare Facilities', category: 'Maintenance Vendors', items: 'Quarterly Maintenance Package', amount: 75000, orderDate: '2026-09-25', expectedDelivery: '2026-09-28', actualDelivery: '2026-09-28', status: 'Completed', paymentStatus: 'Paid', reliabilityScore: 95 }
  ];

  // Modals & Forms Controls
  showRequestModal = false;
  showInvoiceModal = false;
  selectedInvoice: Invoice | null = null;

  // New Request Form Model
  newRequest = {
    department: 'Operations',
    category: 'Raw Material Suppliers',
    productService: '',
    quantity: 1,
    estimatedCost: 0,
    requiredDate: '',
    priority: 'Medium'
  };

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initOverviewChart();
      this.initActivePoChart();
      this.initRadarChart();
      this.initCostAnalysisChart();
      this.initDeliveryGaugeChart();
    }, 0);
  }

  // --- Chart Initializations ---
  private initOverviewChart(): void {
    new Chart(this.overviewChart.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          { type: 'bar', label: 'Procurement Cost (₹ Lakh)', data: [40, 45, 42, 50, 65, 70], backgroundColor: '#3b82f6', borderRadius: 4 },
          { type: 'line', label: 'Number of POs', data: [25, 30, 28, 35, 42, 48], borderColor: '#f97316', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initActivePoChart(): void {
    new Chart(this.activePoChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Pending Approval', 'Approved', 'In Progress', 'Delivered', 'Cancelled'],
        datasets: [{ data: [28, 25, 23, 15, 10], backgroundColor: ['#0052cc', '#36b37e', '#ffab00', '#00b8d9', '#ff5630'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
    });
  }

  private initRadarChart(): void {
    new Chart(this.radarChart.nativeElement, {
      type: 'radar',
      data: {
        labels: ['Delivery', 'Quality', 'Communication', 'Compliance', 'Cost Efficiency'],
        datasets: [
          { label: 'Top Vendor', data: [95, 90, 85, 92, 88], borderColor: '#0052cc', backgroundColor: 'rgba(0, 82, 204, 0.2)' },
          { label: 'Average', data: [75, 70, 68, 72, 65], borderColor: '#a5b4fc', backgroundColor: 'rgba(165, 180, 252, 0.2)' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initCostAnalysisChart(): void {
    new Chart(this.costAnalysisChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Raw Materials', 'Packaging', 'Electronics', 'Logistics', 'Others'],
        datasets: [{ data: [38, 25, 18, 12, 7], backgroundColor: ['#0052cc', '#ff5630', '#ffab00', '#36b37e', '#6554c0'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initDeliveryGaugeChart(): void {
    new Chart(this.deliveryGaugeChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Delivered On-Time', 'In Transit', 'Delayed', 'Cancelled'],
        datasets: [{ data: [52, 28, 15, 5], backgroundColor: ['#36b37e', '#ffab00', '#ff5630', '#6554c0'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, circumference: 180, rotation: -90, cutout: '75%' }
    });
  }

  // --- Invoice Modal Trigger ---
  openInvoice(po: PurchaseOrder): void {
    const subtotal = po.amount;
    const tax = Math.round(subtotal * 0.18);
    this.selectedInvoice = {
      invoiceNumber: `INV-${po.id.replace('PO-', '')}`,
      poNumber: po.id,
      vendorName: po.vendorName,
      invoiceDate: po.orderDate,
      dueDate: po.expectedDelivery,
      items: [
        { description: po.items, qty: 1, unitPrice: po.amount, total: po.amount }
      ],
      subtotal: subtotal,
      tax: tax,
      grandTotal: subtotal + tax,
      status: po.paymentStatus
    };
    this.showInvoiceModal = true;
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.selectedInvoice = null;
  }

  printInvoice(): void {
    window.print();
  }

  // --- Procurement Request Submission ---
  submitRequest(): void {
    if (!this.newRequest.productService || !this.newRequest.estimatedCost) {
      alert('Please fill in all required fields.');
      return;
    }
    const newPo: PurchaseOrder = {
      id: `PO-2026-00${this.orders.length + 1}`,
      vendorName: 'Apex Raw Materials (Recommended)',
      category: this.newRequest.category,
      items: `${this.newRequest.productService} (${this.newRequest.quantity} units)`,
      amount: Number(this.newRequest.estimatedCost),
      orderDate: new Date().toISOString().split('T')[0],
      expectedDelivery: this.newRequest.requiredDate || '2026-10-25',
      status: 'Pending',
      paymentStatus: 'Pending',
      reliabilityScore: 89
    };
    this.orders.unshift(newPo);
    this.showRequestModal = false;
    alert(`Procurement Request ${newPo.id} Created and Auto-Assigned to Best Reliable Vendor!`);
  }

  // --- PDF & CSV Export Utility ---
  exportToCSV(): void {
    const headers = ['PO Number', 'Vendor Name', 'Category', 'Items', 'Amount (INR)', 'Order Date', 'Expected Delivery', 'Status', 'Payment Status', 'Reliability Score'];
    const rows = this.orders.map(o => [
      o.id,
      `"${o.vendorName}"`,
      `"${o.category}"`,
      `"${o.items}"`,
      o.amount,
      o.orderDate,
      o.expectedDelivery,
      o.status,
      o.paymentStatus,
      o.reliabilityScore
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Procurement_Orders_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToPDF(): void {
    window.print();
  }
}