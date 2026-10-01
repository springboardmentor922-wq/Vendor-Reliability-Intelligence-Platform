export type UserRole =
  | 'administrator'
  | 'procurement_manager'
  | 'supply_chain_manager'
  | 'vendor'
  | 'finance_officer'
  | 'auditor';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type VendorCategory =
  | 'raw_material_suppliers'
  | 'equipment_vendors'
  | 'it_vendors'
  | 'service_providers'
  | 'logistics_partners'
  | 'maintenance_vendors';

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'active' | 'inactive';

export interface VendorContact {
  id?: number;
  vendor_id?: number;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
}

export interface Vendor {
  id: number;
  company_name: string;
  category: VendorCategory;
  registration_number?: string;
  tax_id?: string;
  contact_person: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  status: VendorStatus;
  rating: number;
  is_active: boolean;
  approved_by_id?: number;
  approval_notes?: string;
  created_at: string;
  contacts: VendorContact[];
}

export type ProcurementStatus = 'pending' | 'approved' | 'rejected' | 'ordered' | 'delivered' | 'completed' | 'cancelled';
export type ProcurementPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProcurementRequest {
  id: number;
  request_number: string;
  title: string;
  description?: string;
  department?: string;
  category?: string;
  quantity: number;
  unit?: string;
  estimated_budget: number;
  priority: ProcurementPriority;
  required_date?: string;
  status: ProcurementStatus;
  requested_by_id: number;
  approved_by_id?: number;
  approval_notes?: string;
  assigned_vendor_id?: number;
  created_at: string;
}

export type POStatus = 'pending' | 'approved' | 'ordered' | 'delivered' | 'completed' | 'cancelled';

export interface POItem {
  id?: number;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  procurement_request_id?: number;
  vendor_id: number;
  status: POStatus;
  total_amount: number;
  order_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
  created_by_id: number;
  created_at: string;
  items: POItem[];
}

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'disputed';

export interface Invoice {
  id: number;
  purchase_order_id: number;
  invoice_number: string;
  amount: number;
  invoice_date?: string;
  due_date?: string;
  status: InvoiceStatus;
  file_path?: string;
  created_at: string;
}

export type ContractStatus = 'active' | 'expiring' | 'expired' | 'renewed' | 'terminated';

export interface Contract {
  id: number;
  contract_number: string;
  vendor_id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  value: number;
  status: ContractStatus;
  file_path?: string;
  created_by_id: number;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id?: number;
  vendor_id?: number;
  category: string;
  subject?: string;
  body: string;
  related_procurement_id?: number;
  related_po_id?: number;
  is_read: boolean;
  attachment_path?: string;
  created_at: string;
}

export interface DashboardSummary {
  vendors: { total: number; pending: number; approved: number };
  procurement: { total_requests: number; pending_requests: number; completed_requests: number; completion_rate: number };
  purchase_orders: { total: number; active: number; total_value: number };
  contracts: { total: number; expiring_soon: number };
}

// ---- Milestone 3: Vendor Performance & Analytics ----

export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export interface QualityEvaluation {
  id: number;
  vendor_id: number;
  purchase_order_id?: number;
  rating: number;
  defects_count: number;
  rejected_items_count: number;
  complaints?: string;
  notes?: string;
  evaluated_by_id: number;
  created_at: string;
}

export interface Issue {
  id: number;
  vendor_id: number;
  purchase_order_id?: number;
  title: string;
  description?: string;
  status: IssueStatus;
  raised_by_id: number;
  raised_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export interface VendorMetrics {
  vendor_id: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  total_delivered: number;
  on_time_rate: number;
  quality_rating: number;
  avg_response_time_hours?: number;
  avg_issue_resolution_hours?: number;
  order_completion_rate: number;
  total_orders: number;
  open_issues: number;
}

export type RiskLevel = 'low' | 'medium' | 'high';
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export interface ReliabilityScore {
  id: number;
  vendor_id: number;
  score: number;
  risk_level: RiskLevel;
  trend: TrendDirection;
  recommendation?: string;
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  purchase_history_score: number;
  issue_resolution_score: number;
  calculated_at: string;
}

export interface VendorRankingEntry {
  vendor_id: number;
  company_name: string;
  category: string;
  score: number;
  risk_level: RiskLevel;
  recommendation?: string;
}

export interface RiskSummary {
  low: number;
  medium: number;
  high: number;
  not_yet_scored: number;
}
