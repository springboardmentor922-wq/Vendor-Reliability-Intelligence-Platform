import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface PendingUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  company?: string;
  department?: string;
  vendor_category?: string;
  product_service?: string;
  phone?: string;
  created_at: string;
  approval_status: string;
}

export interface SystemStatistics {
  users: {
    total: number;
    active: number;
    pending_approvals: number;
  };
  vendors: {
    total: number;
    high_risk: number;
  };
  lifecycle: {
    total_requisitions: number;
    total_purchase_orders: number;
    completed_deliveries: number;
    pending_payments: number;
    completed_payments: number;
    total_disbursed_spend: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = `${API_CONFIG.baseUrl}/admin`;

  constructor(private http: HttpClient) {}

  getPendingRegistrations(): Observable<PendingUser[]> {
    return this.http.get<PendingUser[]>(`${this.baseUrl}/pending-registrations`);
  }

  approveUser(userId: number, assignedRole?: string, notes?: string, assignedCategory?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/${userId}/approve`, {
      assigned_role: assignedRole,
      assigned_category: assignedCategory,
      notes: notes
    });
  }

  rejectUser(userId: number, rejectionReason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/${userId}/reject`, {
      rejection_reason: rejectionReason
    });
  }

  toggleUserStatus(userId: number, isActive: boolean): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${userId}/status`, {
      is_active: isActive
    });
  }

  getSystemStatistics(): Observable<SystemStatistics> {
    return this.http.get<SystemStatistics>(`${this.baseUrl}/system-statistics`);
  }
}
