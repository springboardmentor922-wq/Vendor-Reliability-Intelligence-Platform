export interface Vendor {
  id: number;
  vendor_code: string;
  name: string;
  category: string;
  status: string;
  reliabilityScore: number;
  riskLevel: string;
  contact_email: string;
  onTimeDeliveryRate?: number;
  qualityComplianceRate?: number;
  [key: string]: any;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_name: string;
  category: string;
  total_amount: number;
  status: string;
  deliveryStatus: string;
  created_date: string;
  [key: string]: any;
}

export interface ProcurementRequest {
  id: number;
  req_number: string;
  item_description: string;
  requested_by: string;
  estimated_cost: number;
  status: string;
  request_date: string;
  [key: string]: any;
}

export interface Contract {
  id: number;
  title: string;
  vendor_name: string;
  expiry_date: string;
  value: number;
  slaPenaltyRate: string | number;
  status: string;
  [key: string]: any;
}

export interface PerformanceMetric {
  id: number;
  vendor_name: string;
  overall_score: number;
  quality_score: number;
  delivery_score: number;
  compliance_score: number;
  onTimeDeliveryRate?: number;
  qualityRate?: number;
  [key: string]: any;
}

export interface ReportSummary {
  id: number;
  title: string;
  category: string;
  format: string;
  size: string;
  generated_date: string;
  type?: string;
  download_url?: string;
  [key: string]: any;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  time: string;
  [key: string]: any;
}