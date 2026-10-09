export type Role =
  | 'administrator'
  | 'procurement_manager'
  | 'supply_chain_manager'
  | 'vendor'
  | 'finance_officer'
  | 'auditor';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: Role;
  vendor_id: number | null;
  vendor_name: string | null;
  created_at?: string;
}

export interface SearchResult {
  type: string;
  title: string;
  subtitle?: string;
  id?: number | string;
}
