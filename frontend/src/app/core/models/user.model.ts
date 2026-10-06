export enum UserRole {
  ADMINISTRATOR = 'ADMINISTRATOR',
  PROCUREMENT_MANAGER = 'PROCUREMENT_MANAGER',
  SUPPLY_CHAIN_MANAGER = 'SUPPLY_CHAIN_MANAGER',
  VENDOR = 'VENDOR',
  FINANCE_OFFICER = 'FINANCE_OFFICER',
  AUDITOR = 'AUDITOR'
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: User;
}
