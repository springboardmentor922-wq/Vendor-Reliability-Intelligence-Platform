import { Injectable, signal, computed } from '@angular/core';
import { Vendor, PurchaseOrder, ProcurementRequest, Contract, PerformanceMetric, ReportItem, UserRole } from './vendor.model';

@Injectable({
  providedIn: 'root'
})
export class VendorService {
  availableRoles: UserRole[] = ['Administrator', 'Procurement Manager', 'Auditor', 'Vendor Manager'];

  currentUser = signal({
    name: 'Ashmit',
    email: 'ashmit@enterprise.com',
    role: 'Administrator' as UserRole,
    jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhc2htaXQiLCJyb2xlIjoiQWRtaW5pc3RyYXRvciIsImV4cCI6MTc3MjU4MjQwMH0.signature'
  });

  vendors = signal<Vendor[]>([
    {
      id: 1,
      vendor_code: 'VND-1001',
      name: 'Apex Logistics Corp',
      category: 'Logistics & Freight',
      status: 'Active',
      reliabilityScore: 94.5,
      riskLevel: 'Low',
      vendorRank: 1,
      contact_email: 'compliance@apexlogistics.com',
      onTimeDeliveryRate: 96.2,
      qualityComplianceRate: 98.1
    },
    {
      id: 2,
      vendor_code: 'VND-1002',
      name: 'Global Microchips Inc',
      category: 'Hardware & Tech',
      status: 'Active',
      reliabilityScore: 78.2,
      riskLevel: 'Medium',
      vendorRank: 3,
      contact_email: 'support@globalmicro.com',
      onTimeDeliveryRate: 81.0,
      qualityComplianceRate: 91.5
    },
    {
      id: 3,
      vendor_code: 'VND-1003',
      name: 'Nexus Energy Systems',
      category: 'Utilities & Power',
      status: 'Pending',
      reliabilityScore: 58.0,
      riskLevel: 'High',
      vendorRank: 4,
      contact_email: 'ops@nexusenergy.com',
      onTimeDeliveryRate: 62.4,
      qualityComplianceRate: 75.0
    },
    {
      id: 4,
      vendor_code: 'VND-1004',
      name: 'Starlight Raw Materials',
      category: 'Raw Components',
      status: 'Active',
      reliabilityScore: 89.0,
      riskLevel: 'Low',
      vendorRank: 2,
      contact_email: 'sales@starlightraw.com',
      onTimeDeliveryRate: 92.5,
      qualityComplianceRate: 94.8
    }
  ]);

  purchaseOrders = signal<PurchaseOrder[]>([
    {
      id: 101,
      po_number: 'PO-2026-8801',
      vendor_name: 'Apex Logistics Corp',
      category: 'Logistics & Freight',
      total_amount: 320000.00,
      status: 'Active',
      deliveryStatus: 'On Schedule',
      invoiceStatus: 'Audit Cleared',
      created_date: '2026-09-01'
    },
    {
      id: 102,
      po_number: 'PO-2026-8802',
      vendor_name: 'Global Microchips Inc',
      category: 'Hardware & Tech',
      total_amount: 145000.00,
      status: 'Active',
      deliveryStatus: 'Delayed',
      invoiceStatus: 'Pending Review',
      created_date: '2026-09-05'
    },
    {
      id: 103,
      po_number: 'PO-2026-8803',
      vendor_name: 'Starlight Raw Materials',
      category: 'Raw Components',
      total_amount: 72000.00,
      status: 'Completed',
      deliveryStatus: 'Delivered',
      invoiceStatus: 'Paid',
      created_date: '2026-08-20'
    }
  ]);

  procurements = signal<ProcurementRequest[]>([
    {
      id: 1,
      req_number: 'REQ-9901',
      item_description: 'Industrial Cloud Server Racks (12u)',
      requested_by: 'IT Operations',
      assigned_vendor: 'Global Microchips Inc',
      estimated_cost: 45000,
      status: 'Under Review'
    },
    {
      id: 2,
      req_number: 'REQ-9902',
      item_description: 'Fleet Fuel Delivery & Storage',
      requested_by: 'Supply Chain Dept',
      assigned_vendor: 'Nexus Energy Systems',
      estimated_cost: 120000,
      status: 'Approved'
    }
  ]);

  contracts = signal<Contract[]>([
    {
      id: 1,
      title: 'Master Logistics Freight Agreement',
      vendor_name: 'Apex Logistics Corp',
      expiry_date: '2027-12-31',
      value: 1200000,
      slaPenaltyRate: '2.5% per late day',
      documentStorageUrl: 's3://enterprise-contracts/apex-master-2026.pdf',
      status: 'Active SLA'
    },
    {
      id: 2,
      title: 'Semiconductor Hardware Supply SLA',
      vendor_name: 'Global Microchips Inc',
      expiry_date: '2026-11-15',
      value: 850000,
      slaPenaltyRate: '5.0% compliance breach',
      documentStorageUrl: 's3://enterprise-contracts/gmi-hardware-2026.pdf',
      status: 'Pending Renewal'
    }
  ]);

  performance = signal<PerformanceMetric[]>([
    {
      vendor_name: 'Apex Logistics Corp',
      quality_score: 98.1,
      delivery_score: 96.2,
      compliance_score: 99.0,
      communication_score: 95.0,
      overall_score: 97.0,
      trend: 'Improving'
    },
    {
      vendor_name: 'Global Microchips Inc',
      quality_score: 91.5,
      delivery_score: 81.0,
      compliance_score: 88.0,
      communication_score: 85.0,
      overall_score: 86.3,
      trend: 'Stable'
    },
    {
      vendor_name: 'Nexus Energy Systems',
      quality_score: 75.0,
      delivery_score: 62.4,
      compliance_score: 70.0,
      communication_score: 60.0,
      overall_score: 66.8,
      trend: 'Declining'
    }
  ]);

  reports = signal<ReportItem[]>([
    { id: 1, title: 'Q3 Vendor Reliability Audit Report', category: 'Compliance', generated_date: '2026-09-10', format: 'PDF', scheduled: true, size: '4.2 MB' },
    { id: 2, title: 'Procurement Cost Volatility Matrix', category: 'Finance', generated_date: '2026-09-12', format: 'XLSX', scheduled: false, size: '1.8 MB' }
  ]);

  notifications = signal([
    { id: 1, title: 'SLA Breach Warning', message: 'Nexus Energy Systems delivery delay exceeded tolerance threshold.', time: '10 mins ago' },
    { id: 2, title: 'PO Approved', message: 'PO-2026-8801 cleared compliance audit.', time: '1 hour ago' }
  ]);

  communications = signal([
    { id: 1, channel: 'SMS (Twilio)', recipient: 'ops@nexusenergy.com', subject: 'Automated Warning Alert Dispatched', status: 'Delivered' },
    { id: 2, channel: 'Email (SMTP)', recipient: 'compliance@apexlogistics.com', subject: 'Quarterly Review Confirmation', status: 'Sent' }
  ]);

  microservices = signal([
    { name: 'Auth Service', latencyMs: 12, cpuUsage: 14 },
    { name: 'User Service', latencyMs: 15, cpuUsage: 18 },
    { name: 'Vendor Service', latencyMs: 24, cpuUsage: 32 },
    { name: 'Procurement Service', latencyMs: 19, cpuUsage: 22 },
    { name: 'PO Service', latencyMs: 28, cpuUsage: 41 }
  ]);

  totalSpend = computed(() => this.purchaseOrders().reduce((acc, po) => acc + po.total_amount, 0));
  avgReliability = computed(() => {
    const v = this.vendors();
    if (!v.length) return 0;
    const sum = v.reduce((acc, curr) => acc + curr.reliabilityScore, 0);
    return (sum / v.length).toFixed(1);
  });
  highRiskCount = computed(() => this.vendors().filter(v => v.riskLevel === 'High' || v.riskLevel === 'Critical').length);

  switchUserRole(role: UserRole): void {
    this.currentUser.update(user => ({ ...user, role }));
  }

  createPO(po: PurchaseOrder): void {
    this.purchaseOrders.update(list => [po, ...list]);
  }

  createVendor(vendor: Vendor): void {
    this.vendors.update(list => [...list, { ...vendor, id: Date.now(), vendorRank: list.length + 1 }]);
  }

  approveVendor(id: number): void {
    this.vendors.update(list => list.map(v => v.id === id ? { ...v, status: 'Active' } : v));
  }

  approveProcurement(id: number): void {
    this.procurements.update(list => list.map(p => p.id === id ? { ...p, status: 'Approved' } : p));
  }

  dispatchCommunication(channel: string, recipient: string, subject: string): void {
    this.communications.update(list => [{ id: Date.now(), channel, recipient, subject, status: 'Sent' }, ...list]);
  }
}