import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { API_CONFIG } from './api.config';
import { DashboardService } from './dashboard.service';
import { PurchaseOrderService } from './purchase-order.service';
import { ContractService } from './contract.service';
import { VendorService } from './vendor.service';

export const VENDOR_CATEGORIES = [
  'IT & Electronics',
  'Raw Materials',
  'Office Supplies & Equipment',
  'Machinery & Spare Parts',
  'Logistics & Transportation',
  'Services & Maintenance'
];

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  phone?: string;
  company?: string;
  department?: string;
  vendor_category?: string;
  product_service?: string;
  business_reg_number?: string;
  gst_tax_id?: string;
  approval_status?: string;
  rejection_reason?: string;
  is_active: boolean;
  created_at?: string;
  vendor_id?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  message?: string;
  status?: string;
}

export const DEMO_ACCOUNTS = [
  { role: 'Administrator', name: 'Admin Controller', email: 'admin@vendor-iq.com', password: 'admin123', badge: 'Control & Admin' },
  { role: 'Procurement Manager', name: 'Sarah Jenkins', email: 'procurement@vendor-iq.com', password: 'procure123', badge: 'Procurement & Sourcing' },
  { role: 'Finance Officer', name: 'Elena Rostova', email: 'finance@vendor-iq.com', password: 'finance123', badge: 'Budget & Payment' },
  { role: 'Supply Chain Manager', name: 'Marcus Vance', email: 'supplychain@vendor-iq.com', password: 'supply123', badge: 'PO & Deliveries' },
  { role: 'Vendor', name: 'Acme Industrial Rep', email: 'vendor@vendor-iq.com', password: 'vendor123', badge: 'Order Fulfillment' },
  { role: 'Auditor', name: 'Arthur Pendelton', email: 'auditor@vendor-iq.com', password: 'audit123', badge: 'Audit & Trace' },
];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = API_CONFIG.baseUrl;

  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private dashService: DashboardService,
    private poService: PurchaseOrderService,
    private contractService: ContractService,
    private vendorService: VendorService
  ) {}

  private getStoredUser(): User | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('vendor_iq_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public getToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('vendor_iq_token');
    }
    return null;
  }

  public isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getStoredUser();
  }

  public hasRole(roles: string[]): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    if (user.role === 'Administrator') return true;
    return roles.includes(user.role);
  }

  public hasStrictRole(roles: string[]): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    const norm = (r: string) => {
      const s = (r || '').trim();
      const sLower = s.toLowerCase();
      if (sLower === 'admin' || sLower === 'administrator') return 'Administrator';
      if (sLower === 'department user' || sLower === 'requesting user' || sLower === 'requester' || sLower === 'procurement manager' || sLower === 'procurement') return 'Procurement Manager';
      if (sLower === 'supply chain manager' || sLower === 'supply chain' || sLower === 'supplychain') return 'Supply Chain Manager';
      if (sLower === 'finance officer' || sLower === 'finance') return 'Finance Officer';
      if (sLower === 'auditor' || sLower === 'audit') return 'Auditor';
      if (sLower === 'vendor') return 'Vendor';
      return s;
    };
    const userNorm = norm(user.role);
    return roles.map(norm).includes(userNorm);
  }

  public getDashboardRoute(role?: string): string {
    const userRole = (role || this.currentUserValue?.role || '').trim();
    const roleLower = userRole.toLowerCase();
    switch (roleLower) {
      case 'administrator':
      case 'admin':
        return '/dashboard/admin';
      case 'requesting user':
      case 'department user':
      case 'requester':
      case 'procurement manager':
      case 'procurement':
        return '/dashboard/procurement';
      case 'supply chain manager':
      case 'supply chain':
      case 'supplychain':
        return '/dashboard/supply-chain';
      case 'vendor':
        return '/dashboard/vendor';
      case 'finance officer':
      case 'finance':
        return '/dashboard/finance';
      case 'auditor':
      case 'audit':
        return '/dashboard/auditor';
      default:
        return '/dashboard/procurement';
    }
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, credentials).pipe(
      tap(res => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('vendor_iq_token', res.access_token);
          localStorage.setItem('vendor_iq_user', JSON.stringify(res.user));
        }
        this.dashService.clearCache();
        this.poService.clearCache();
        this.contractService.clearCache();
        this.vendorService.clearCache();

        this.currentUserSubject.next(res.user);

        if (res.user.role === 'Vendor' && !res.user.vendor_id) {
          this.dashService.getStats(true).subscribe({
            next: (stats) => {
              if (stats?.vendor_portal?.vendor_id && !res.user.vendor_id) {
                res.user.vendor_id = stats.vendor_portal.vendor_id;
                if (typeof window !== 'undefined' && window.localStorage) {
                  localStorage.setItem('vendor_iq_user', JSON.stringify(res.user));
                }
                this.currentUserSubject.next(res.user);
              }
            },
            error: () => {}
          });
        }
      })
    );
  }

  demoLogin(roleName: string): Observable<AuthResponse> {
    const target = DEMO_ACCOUNTS.find(a => a.role === roleName || (roleName === 'Admin' && a.role === 'Administrator'));
    if (!target) {
      throw new Error(`Demo account for role ${roleName} not found.`);
    }
    return this.login({ email: target.email, password: target.password });
  }

  register(userData: {
    full_name: string;
    email: string;
    password: string;
    role?: string;
    department?: string;
    phone?: string;
    company?: string;
    vendor_category?: string;
    product_service?: string;
    business_reg_number?: string;
    gst_tax_id?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/auth/register`, userData);
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me`).pipe(
      tap(user => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('vendor_iq_user', JSON.stringify(user));
        }
        this.currentUserSubject.next(user);
      })
    );
  }

  updateProfile(userId: number, profileData: any): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/${userId}/profile`, profileData).pipe(
      tap(user => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('vendor_iq_user', JSON.stringify(user));
        }
        this.currentUserSubject.next(user);
      })
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/forgot-password`, { email });
  }

  resetPassword(payload: { token: string; new_password: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/reset-password`, payload);
  }

  getApprovedVendorsLogin(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/auth/approved-vendors-login`);
  }

  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('vendor_iq_token');
      localStorage.removeItem('vendor_iq_user');
    }
    this.dashService.clearCache();
    this.poService.clearCache();
    this.contractService.clearCache();
    this.vendorService.clearCache();
    this.currentUserSubject.next(null);
  }
}
