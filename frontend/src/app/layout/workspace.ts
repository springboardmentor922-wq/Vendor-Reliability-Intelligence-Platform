import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

export type DashboardView = 
  | 'procurement_overview'  // 1. Procurement Overview
  | 'purchase_requests'     // 2. Purchase Request
  | 'purchase_orders'       // 3. Purchase Order
  | 'procurement_spend'     // 4. Procurement Spend
  | 'procurement_analytics' // 5. Procurement Analytics
  | 'vendor_management'    // 6. Vendor Management
  | 'vendor_details'       // 7. Vendor Details
  | 'vendor_approval'      // 8. Vendor Approval
  | 'vendor_performance'   // 9. Vendor Performance
  | 'vendor_risk'          // 10. Vendor Risk & 6-Factor Reliability
  | 'admin_dashboard';     // 11. Administrator Dashboard

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss'
})
export class Workspace {
  currentView: DashboardView = 'procurement_overview';
  isSidebarCollapsed = false;
  selectedRole: 'Admin' | 'Procurement Manager' | 'Vendor' | 'Auditor' = 'Procurement Manager';
  selectedVendorDetail: any = null;
  isDetailModalOpen = false;

  vendors = [
    { id: 'V-101', name: 'Apex Raw Materials', category: 'Raw Material', status: 'Active', score: 88.5, delivery: '92%', quality: '89%', compliance: '100%', risk: 'Low Risk', contracts: 12, expiry: '2027-04-15' },
    { id: 'V-102', name: 'LogiSpeed Corp', category: 'Logistics', status: 'Active', score: 69.3, delivery: '68%', quality: '72%', compliance: '80%', risk: 'Medium Risk', contracts: 5, expiry: '2026-11-30' },
    { id: 'V-103', name: 'TechSphere IT', category: 'Information Technology', status: 'Active', score: 91.2, delivery: '95%', quality: '94%', compliance: '95%', risk: 'Low Risk', contracts: 8, expiry: '2028-01-10' },
    { id: 'V-104', name: 'Global Equipment Ltd', category: 'Equipment', status: 'Pending Approval', score: 46.3, delivery: '45%', quality: '50%', compliance: '60%', risk: 'High Risk', contracts: 0, expiry: 'N/A' },
    { id: 'V-105', name: 'CleanCare Facilities', category: 'Services', status: 'Suspended', score: 52.0, delivery: '50%', quality: '55%', compliance: '50%', risk: 'Critical Risk', contracts: 2, expiry: '2026-12-01' }
  ];

  purchaseRequests = [
    { id: 'PR-8901', department: 'Manufacturing', item: 'Industrial Steel Sheet (500 Units)', budget: '$45,000', priority: 'Urgent', status: 'Approved' },
    { id: 'PR-8902', department: 'Logistics & Supply', item: 'Freight Transport Operations', budget: '$12,000', priority: 'Medium', status: 'Pending Review' },
    { id: 'PR-8903', department: 'IT Infrastructure', item: 'Rack Servers & Firewall Hardware', budget: '$89,000', priority: 'High', status: 'Approved' }
  ];

  purchaseOrders = [
    { id: 'PO-2026-001', vendor: 'Apex Raw Materials', category: 'Raw Material', item: 'Steel Sheet (500 Units)', amount: '$45,000', expected: '2026-10-15', status: 'Delivered', payment: 'Paid', reliability: '92%' },
    { id: 'PO-2026-002', vendor: 'LogiSpeed Corp', category: 'Logistics', item: 'Freight Services', amount: '$12,000', expected: '2026-10-18', status: 'In Transit', payment: 'Pending', reliability: '68%' },
    { id: 'PO-2026-003', vendor: 'TechSphere IT', category: 'IT', item: 'Server Infrastructure', amount: '$89,000', expected: '2026-11-01', status: 'Ordered', payment: 'Pending', reliability: '91%' }
  ];

  auditLogs = [
    { id: 'LOG-9001', user: 'Admin User', action: 'Approved Vendor Registration V-101', module: 'Vendor Approval', timestamp: '2026-10-03 09:12:00' },
    { id: 'LOG-9002', user: 'Procurement Officer', action: 'Created Purchase Order PO-2026-003', module: 'Procurement Hub', timestamp: '2026-10-03 08:45:22' },
    { id: 'LOG-9003', user: 'System Scoring Engine', action: 'Recalculated 6-Factor Reliability Scores', module: 'Reliability Module', timestamp: '2026-10-03 00:00:00' }
  ];

  constructor(private router: Router) {}

  switchView(view: DashboardView): void {
    this.currentView = view;
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  openVendorDetails(vendor: any): void {
    this.selectedVendorDetail = vendor;
    this.isDetailModalOpen = true;
  }

  closeModal(): void {
    this.isDetailModalOpen = false;
  }

  approveVendor(vendorId: string): void {
    const v = this.vendors.find(item => item.id === vendorId);
    if (v) {
      v.status = 'Active';
      this.auditLogs.unshift({
        id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
        user: `${this.selectedRole}`,
        action: `Approved Vendor Registration ${vendorId}`,
        module: 'Vendor Approval Queue',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
      });
      alert(`Vendor ${vendorId} approved successfully.`);
    }
  }

  rejectVendor(vendorId: string): void {
    const v = this.vendors.find(item => item.id === vendorId);
    if (v) {
      v.status = 'Rejected';
      alert(`Vendor ${vendorId} has been rejected.`);
    }
  }

  exportCSV(filename: string): void {
    alert(`Downloading ${filename}.csv report generated from live database tables.`);
  }

  logout(): void {
    this.router.navigate(['/login']);
  }
}