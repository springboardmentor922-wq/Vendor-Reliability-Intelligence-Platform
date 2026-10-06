export type UserRole =
  | 'administrator'
  | 'procurement_manager'
  | 'supply_chain_manager'
  | 'vendor'
  | 'finance_officer'
  | 'auditor';

export interface User {
  id: string;
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

export type VendorStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'active'
  | 'inactive';

export interface VendorContact {
  id?: string;
  vendor_id?: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
}

export interface Vendor {
  id: string;
  user_id?: string;
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
  approved_by_id?: string;
  approval_notes?: string;
  created_at: string;
  contacts: VendorContact[];
}

export type ProcurementStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type ProcurementPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

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
  requested_by_id: string;
  approved_by_id?: string;
  approval_notes?: string;
  assigned_vendor_id?: string;
  created_at: string;
}

export type POStatus =
  | 'pending'
  | 'approved'
  | 'ordered'
  | 'delivered'
  | 'completed'
  | 'cancelled';

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
  vendor_id: string;
  status: POStatus;
  total_amount: number;
  order_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
  created_by_id: string;
  created_at: string;
  items: POItem[];
}

export type InvoiceStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'disputed';

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

export type ContractStatus =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'renewed'
  | 'terminated';

export interface Contract {
  id: number;
  contract_number: string;
  vendor_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  value: number;
  status: ContractStatus;
  file_path?: string;
  created_by_id: string;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: string;
  receiver_id?: string;
  vendor_id?: string;
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
  vendors: {
    total: number;
    pending: number;
    approved: number;
  };

  procurement: {
    total_requests: number;
    pending_requests: number;
    completed_requests: number;
    completion_rate: number;
  };

  purchase_orders: {
    total: number;
    active: number;
    total_value: number;
  };

  contracts: {
    total: number;
    expiring_soon: number;
  };
}