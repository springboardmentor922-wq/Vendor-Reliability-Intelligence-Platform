import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportExportService, ReportSummary } from '../../services/report-export.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})
export class Reports implements OnInit {
  selectedReportType = 'Vendor Performance';
  reportTypes = [
    { key: 'Vendor Performance', name: 'Vendor Performance Report', icon: 'bi-speedometer2', desc: 'Supplier reliability scores, on-time delivery rates, and SLA benchmarks' },
    { key: 'Procurement', name: 'Procurement Management Report', icon: 'bi-cart-check', desc: 'Requisition cycle times, budget allocation, and approval statuses' },
    { key: 'Purchase Orders', name: 'Purchase Order & Spend Report', icon: 'bi-receipt', desc: 'Committed procurement spend, order fulfillment, and delivery logs' },
    { key: 'Compliance', name: 'Compliance & Audit Report', icon: 'bi-shield-check', desc: 'Regulatory certifications, audit adherence, and supplier risk exposure' },
    { key: 'Contracts', name: 'Contract Repository & Renewal Report', icon: 'bi-file-earmark-text', desc: 'Active master agreements, contract values, and expiration schedules' },
    { key: 'Risk', name: 'Vendor Risk & Mitigation Report', icon: 'bi-shield-exclamation', desc: 'Supplier risk classification, delivery delays, default probabilities, and mitigation actions' }
  ];

  categories = [
    'All',
    'Raw Material Suppliers',
    'Equipment Vendors',
    'IT Vendors',
    'Service Providers',
    'Logistics Partners',
    'Maintenance Vendors'
  ];

  riskLevels = ['All', 'Low', 'Medium', 'High', 'Critical'];
  statuses = ['All', 'Approved', 'Pending', 'Active', 'In Transit', 'Delivered', 'Completed', 'Rejected'];

  currentReport: ReportSummary | null = null;
  filteredRows: Record<string, any>[] = [];
  searchFilter = '';
  categoryFilter = 'All';
  riskFilter = 'All';
  statusFilter = 'All';
  dateFrom = '';
  dateTo = '';
  isLoading = false;

  constructor(private reportService: ReportExportService) {}

  ngOnInit(): void {
    this.loadSelectedReport();
  }

  selectReport(type: string): void {
    this.selectedReportType = type;
    this.resetFilters();
    this.loadSelectedReport();
  }

  resetFilters(): void {
    this.searchFilter = '';
    this.categoryFilter = 'All';
    this.riskFilter = 'All';
    this.statusFilter = 'All';
    this.dateFrom = '';
    this.dateTo = '';
  }

  loadSelectedReport(): void {
    this.isLoading = true;
    this.reportService.generateReport(this.selectedReportType).subscribe({
      next: (report) => {
        this.currentReport = report;
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error generating report:', err);
        this.isLoading = false;
      }
    });
  }

  applyFilter(): void {
    if (!this.currentReport) {
      this.filteredRows = [];
      return;
    }
    let rows = [...this.currentReport.rows];

    // 1. Text Search Filter (Vendor, title, company, items)
    if (this.searchFilter.trim()) {
      const q = this.searchFilter.toLowerCase().trim();
      rows = rows.filter(row => {
        return Object.values(row).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(q));
      });
    }

    // 2. Category Filter
    if (this.categoryFilter !== 'All') {
      const targetCat = this.categoryFilter.toLowerCase();
      rows = rows.filter(row => {
        const cat = String(row['Category'] || '').toLowerCase();
        return cat.includes(targetCat);
      });
    }

    // 3. Risk Filter
    if (this.riskFilter !== 'All') {
      const targetRisk = this.riskFilter.toLowerCase();
      rows = rows.filter(row => {
        const r = String(row['Risk Level'] || row['Risk Rating'] || '').toLowerCase();
        return r.includes(targetRisk);
      });
    }

    // 4. Status Filter
    if (this.statusFilter !== 'All') {
      const targetStatus = this.statusFilter.toLowerCase();
      rows = rows.filter(row => {
        const s = String(row['Status'] || row['Approval Status'] || row['Compliance Status'] || row['Compliance'] || '').toLowerCase();
        return s.includes(targetStatus);
      });
    }

    // 5. Date Range Filter
    if (this.dateFrom || this.dateTo) {
      const from = this.dateFrom ? new Date(this.dateFrom).getTime() : 0;
      const to = this.dateTo ? new Date(this.dateTo).getTime() + 86400000 : Infinity;

      rows = rows.filter(row => {
        const dateVal = row['Created Date'] || row['Start Date'] || row['Expected Delivery'] || row['Expiry Date'];
        if (!dateVal || dateVal === 'N/A') return true;
        const d = new Date(dateVal).getTime();
        if (isNaN(d)) return true;
        return d >= from && d <= to;
      });
    }

    this.filteredRows = rows;
  }

  exportPdf(): void {
    if (!this.currentReport) return;
    this.reportService.exportToPdf({
      ...this.currentReport,
      rows: this.filteredRows
    });
  }

  exportExcel(): void {
    if (!this.currentReport) return;
    this.reportService.exportToExcel({
      ...this.currentReport,
      rows: this.filteredRows
    });
  }

  exportCsv(): void {
    if (!this.currentReport) return;
    this.reportService.exportToCsv({
      ...this.currentReport,
      rows: this.filteredRows
    });
  }
}
