export type UserRole = 'Administrator' | 'Procurement Manager' | 'Auditor' | 'Vendor Manager';

export interface Vendor {
  id: number;
  vendor_code: string;
  name: string;
  category: string;
  status: 'Active' | 'Pending' | 'Suspended';
  reliabilityScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  vendorRank: number;
  contact_email: string;
  onTimeDeliveryRate: number;
  qualityComplianceRate: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_name: string;
  category: string;
  total_amount: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  deliveryStatus: 'On Schedule' | 'In Transit' | 'Delayed' | 'Delivered';
  invoiceStatus: 'Paid' | 'Pending Audit' | 'Unpaid' | 'Audit Cleared' | 'Pending Review';
  created_date: string;
}

export interface ProcurementRequest {
  id: number;
  req_number: string;
  item_description: string;
  requested_by: string;
  assigned_vendor: string;
  estimated_cost: number;
  status: 'Approved' | 'Under Review' | 'Rejected';
}

export interface Contract {
  id: number;
  title: string;
  vendor_name: string;
  expiry_date: string;
  value: number;
  slaPenaltyRate: string;
  documentStorageUrl: string;
  status: 'Active' | 'Expiring Soon' | 'Under Audit' | 'Active SLA' | 'Pending Renewal';
}

export interface PerformanceMetric {
  vendor_name: string;
  quality_score: number;
  delivery_score: number;
  compliance_score: number;
  communication_score: number;
  overall_score: number;
  trend: 'Improving' | 'Stable' | 'Declining';
}

export interface ReportItem {
  id: number;
  title: string;
  category: string;
  generated_date: string;
  format: 'PDF' | 'XLSX' | 'CSV';
  scheduled: boolean;
  size: string;
}