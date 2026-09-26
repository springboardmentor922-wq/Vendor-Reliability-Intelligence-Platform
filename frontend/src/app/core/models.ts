/** Shared API contracts, mirroring the FastAPI Pydantic schemas. */

export type UserRole =
  | 'Administrator'
  | 'Procurement Manager'
  | 'Supply Chain Manager'
  | 'Vendor'
  | 'Finance Officer'
  | 'Auditor';

export const USER_ROLES: UserRole[] = [
  'Administrator',
  'Procurement Manager',
  'Supply Chain Manager',
  'Vendor',
  'Finance Officer',
  'Auditor',
];

export const VENDOR_CATEGORIES = [
  'Raw Material Suppliers',
  'Equipment Vendors',
  'IT Vendors',
  'Service Providers',
  'Logistics Partners',
  'Maintenance Vendors',
] as const;

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  department?: string | null;
  job_title?: string | null;
  vendor_id?: number | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface ApiMessage {
  message: string;
}

/* ---------------------------------------------------------- Vendors */

export interface VendorContact {
  id: number;
  vendor_id: number;
  name: string;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary: boolean;
}

export interface VendorApprovalEntry {
  id: number;
  vendor_id: number;
  action: string;
  previous_status?: string | null;
  new_status: string;
  performed_by?: number | null;
  performed_by_name?: string | null;
  comments?: string | null;
  created_at?: string | null;
}

export interface Vendor {
  id: number;
  vendor_code: string;
  vendor_name: string;
  category: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  tax_id?: string | null;
  registration_number?: string | null;
  status: string;
  risk_level: string;
  reliability_score?: number | null;
  approved_by?: number | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  onboarded_on?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface VendorDetail extends Vendor {
  contacts: VendorContact[];
  approvals: VendorApprovalEntry[];
  open_purchase_orders: number;
  total_purchase_orders: number;
  active_contracts: number;
  total_spend: number;
}

export interface VendorStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  suspended: number;
  inactive: number;
  by_category: Record<string, number>;
  by_risk_level: Record<string, number>;
}

/* --------------------------------------------------- Procurement */

export interface ProcurementApprovalEntry {
  id: number;
  request_id: number;
  action: string;
  previous_status?: string | null;
  new_status: string;
  performed_by?: number | null;
  performed_by_name?: string | null;
  comments?: string | null;
  created_at?: string | null;
}

export interface ProcurementRequest {
  id: number;
  request_number: string;
  requested_by: number;
  requester_name?: string | null;
  item: string;
  description?: string | null;
  category?: string | null;
  quantity: number;
  unit: string;
  estimated_cost: number;
  currency: string;
  required_date?: string | null;
  priority: string;
  department?: string | null;
  justification?: string | null;
  status: string;
  assigned_vendor_id?: number | null;
  assigned_vendor_name?: string | null;
  approved_by?: number | null;
  approver_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
}

export interface ProcurementRequestDetail extends ProcurementRequest {
  approvals: ProcurementApprovalEntry[];
  purchase_order_ids: number[];
}

export interface ProcurementStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  ordered: number;
  delivered: number;
  completed: number;
  cancelled: number;
  total_estimated_value: number;
  by_priority: Record<string, number>;
}

/* ----------------------------------------------- Purchase orders */

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface PurchaseOrderItemInput {
  item_name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  vendor_id: number;
  vendor_name?: string | null;
  procurement_request_id?: number | null;
  request_number?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  title?: string | null;
  description?: string | null;
  order_date?: string | null;
  expected_delivery?: string | null;
  actual_delivery?: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  payment_terms?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  status: string;
  approved_by?: number | null;
  approved_at?: string | null;
  created_at?: string | null;
  is_delayed: boolean;
  days_late: number;
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
  invoices: Invoice[];
}

export interface PurchaseOrderStats {
  total: number;
  pending: number;
  approved: number;
  ordered: number;
  delivered: number;
  completed: number;
  cancelled: number;
  total_value: number;
  open_value: number;
  delayed: number;
  on_time_rate: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  purchase_order_id?: number | null;
  po_number?: string | null;
  vendor_id: number;
  vendor_name?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  payment_date?: string | null;
  document_path?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

/* --------------------------------------------------- Contracts */

export interface Contract {
  id: number;
  contract_number: string;
  vendor_id: number;
  vendor_name?: string | null;
  title?: string | null;
  contract_type: string;
  start_date: string;
  expiry_date: string;
  contract_value?: number | null;
  currency: string;
  auto_renew: boolean;
  renewal_notice_days: number;
  renewed_from_id?: number | null;
  status: string;
  compliance_status: string;
  document_path?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  terms?: string | null;
  notes?: string | null;
  created_at?: string | null;
  days_to_expiry: number;
  is_expiring_soon: boolean;
}

export interface ComplianceCheck {
  id: number;
  vendor_id: number;
  contract_id?: number | null;
  check_type: string;
  check_date: string;
  result: string;
  remarks?: string | null;
  checked_by?: number | null;
  checked_by_name?: string | null;
  created_at?: string | null;
}

export interface ContractDetail extends Contract {
  compliance_checks: ComplianceCheck[];
}

export interface Certification {
  id: number;
  vendor_id: number;
  certification_name: string;
  issuing_authority?: string | null;
  certificate_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status: string;
  days_to_expiry?: number | null;
  document_path?: string | null;
}

export interface ContractStats {
  total: number;
  draft: number;
  active: number;
  expiring: number;
  expired: number;
  terminated: number;
  renewed: number;
  total_value: number;
  compliant: number;
  non_compliant: number;
  expiring_within_30_days: number;
}

/* ----------------------------------------------- Communication */

export interface MessageAttachment {
  id: number;
  message_id: number;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  content_type?: string | null;
  uploaded_at?: string | null;
}

export interface ThreadMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_name?: string | null;
  sender_role?: string | null;
  body: string;
  is_read: boolean;
  created_at?: string | null;
  attachments: MessageAttachment[];
}

export interface MessageThread {
  id: number;
  subject: string;
  vendor_id?: number | null;
  vendor_name?: string | null;
  purchase_order_id?: number | null;
  po_number?: string | null;
  procurement_request_id?: number | null;
  request_number?: string | null;
  contract_id?: number | null;
  contract_number?: string | null;
  created_by: number;
  created_by_name?: string | null;
  status: string;
  priority: string;
  last_message_at?: string | null;
  created_at?: string | null;
  message_count: number;
  unread_count: number;
  last_message_preview?: string | null;
}

export interface MessageThreadDetail extends MessageThread {
  messages: ThreadMessage[];
}

export interface ActivityLogEntry {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  entity_type: string;
  entity_id?: number | null;
  action: string;
  description?: string | null;
  created_at?: string | null;
}

/* -------------------------------------------- Notifications */

export interface AppNotification {
  id: number;
  user_id: number;
  notification_type: string;
  title: string;
  message: string;
  link?: string | null;
  priority: string;
  is_read: boolean;
  created_at?: string | null;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  by_type: Record<string, number>;
}

/* ------------------------------------------------ Dashboard */

export interface DashboardCard {
  label: string;
  value: string;
  hint: string;
}

export interface DashboardActivity {
  id: number;
  user_name?: string | null;
  entity_type: string;
  action: string;
  description?: string | null;
  created_at?: string | null;
}

export interface DashboardOverview {
  role: string;
  cards: DashboardCard[];
  vendors_by_status: Record<string, number>;
  vendors_by_category: Record<string, number>;
  orders_by_status: Record<string, number>;
  requests_by_status: Record<string, number>;
  monthly_spend: Record<string, number>;
  top_vendors_by_spend: { vendor_id: number; vendor_name: string; spend: number }[];
  contracts_expiring: {
    id: number;
    contract_number: string;
    vendor_name: string;
    expiry_date: string;
    days_to_expiry: number;
  }[];
  open_conversations: number;
  unread_notifications: number;
  recent_activity: DashboardActivity[];
}

/* ------------------------------------- Vendor performance (M3) */

export interface VendorPerformanceRecord {
  id: number;
  vendor_id: number;
  vendor_name?: string | null;
  purchase_order_id?: number | null;
  po_number?: string | null;
  evaluation_date: string;
  on_time_delivery?: number | null;
  delayed_delivery?: number | null;
  quality_rating?: number | null;
  response_time?: number | null;
  issue_resolution_time?: number | null;
  order_completion_rate?: number | null;
  service_rating?: number | null;
  remarks?: string | null;
}

/* Milestone 3 types live in their own file; re-exported so either import path works. */
export * from './models-m3';
