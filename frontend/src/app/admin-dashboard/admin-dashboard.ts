import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface RegisteredVendor {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  email: string;
  status: 'Pending Approval' | 'Active' | 'Inactive' | 'Suspended' | 'Rejected';
  registrationDate: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  relatedRecord: string;
  timestamp: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboardComponent implements AfterViewInit {
  @ViewChild('userManagementChart') userManagementChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('riskDistributionChart') riskDistributionChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('procurementReportChart') procurementReportChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('complianceChart') complianceChart!: ElementRef<HTMLCanvasElement>;

  kpis = [
    { title: 'Total Registered Users', value: '124', trend: '↑ 10% vs last month', icon: '👥' },
    { title: 'Total Vendors', value: '42', trend: '↑ 8% vs last month', icon: '🏬' },
    { title: 'Contracts Managed', value: '78', trend: '↑ 10% vs last month', icon: '📄' },
    { title: 'System Uptime', value: '99.8%', trend: '↑ 0.2% vs last month', icon: '⚡' }
  ];

  // Vendor Registrations & Approval Workflow
  registeredVendors: RegisteredVendor[] = [
    { id: 'V-101', name: 'Precision Metal Works', category: 'Raw Material Suppliers', contactPerson: 'Rahul Sharma', email: 'rahul@precision.com', status: 'Pending Approval', registrationDate: '2026-10-01' },
    { id: 'V-102', name: 'SwiftExpress Logistics', category: 'Logistics Partners', contactPerson: 'Anita Roy', email: 'anita@swiftexpress.com', status: 'Pending Approval', registrationDate: '2026-10-02' },
    { id: 'V-103', name: 'Apex Raw Materials', category: 'Raw Material Suppliers', contactPerson: 'Amitav Das', email: 'contact@apexmaterials.com', status: 'Active', registrationDate: '2026-08-15' },
    { id: 'V-104', name: 'OldTech Components', category: 'Equipment Vendors', contactPerson: 'S. K. Gupta', email: 'gupta@oldtech.com', status: 'Suspended', registrationDate: '2026-05-10' }
  ];

  // System Activity & Audit Logs
  auditLogs: AuditLog[] = [
    { id: 'LOG-8911', user: 'Admin User', action: 'Approved Vendor V-103', relatedRecord: 'Vendor Management', timestamp: '2026-10-03 09:30:12' },
    { id: 'LOG-8910', user: 'Procurement Officer', action: 'Created Order PO-2026-005', relatedRecord: 'Procurement Engine', timestamp: '2026-10-03 08:45:00' },
    { id: 'LOG-8909', user: 'System Engine', action: 'Recalculated Reliability Scores', relatedRecord: 'Reliability Module', timestamp: '2026-10-03 00:00:00' }
  ];

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initUserManagementChart();
      this.initRiskDistributionChart();
      this.initProcurementReportChart();
      this.initComplianceChart();
    }, 0);
  }

  // Workflow Action Handlers
  approveVendor(v: RegisteredVendor): void {
    v.status = 'Active';
    this.addAuditLog(`Approved Vendor ${v.name} (${v.id})`);
  }

  suspendVendor(v: RegisteredVendor): void {
    v.status = 'Suspended';
    this.addAuditLog(`Suspended Vendor ${v.name} (${v.id})`);
  }

  rejectVendor(v: RegisteredVendor): void {
    v.status = 'Rejected';
    this.addAuditLog(`Rejected Vendor Registration ${v.name} (${v.id})`);
  }

  private addAuditLog(action: string): void {
    this.auditLogs.unshift({
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      user: 'Admin User',
      action: action,
      relatedRecord: 'Vendor Approval Workflow',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  }

  // --- Charts ---
  private initUserManagementChart(): void {
    new Chart(this.userManagementChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Admin', 'Procurement Manager', 'Vendor Manager', 'Finance User', 'Vendor', 'Analyst'],
        datasets: [{ data: [6, 12, 9, 8, 56, 15], backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initRiskDistributionChart(): void {
    new Chart(this.riskDistributionChart.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'],
        datasets: [{ label: 'Vendors Count', data: [38, 21, 9, 4], backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initProcurementReportChart(): void {
    new Chart(this.procurementReportChart.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          { type: 'bar', label: 'Procurement Cost (₹ Lakh)', data: [30, 45, 40, 55, 60, 75], backgroundColor: '#8b5cf6' },
          { type: 'line', label: 'Number of POs', data: [20, 28, 25, 32, 38, 42], borderColor: '#f59e0b', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initComplianceChart(): void {
    new Chart(this.complianceChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Compliant (60%)', 'Minor Issues (20%)', 'Major Issues (15%)', 'Non-Compliant (5%)'],
        datasets: [{ data: [60, 20, 15, 5], backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  exportAuditLogsCSV(): void {
    const headers = ['Log ID', 'User', 'Action Executed', 'Related Module', 'Timestamp'];
    const rows = this.auditLogs.map(l => [l.id, `"${l.user}"`, `"${l.action}"`, `"${l.relatedRecord}"`, l.timestamp]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `System_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}