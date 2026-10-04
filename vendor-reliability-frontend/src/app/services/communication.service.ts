import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from './auth.service';
import { API_CONFIG } from './api.config';

export interface CommunicationMessage {
  id?: number;
  sender_id?: number;
  recipient_id?: number;
  vendor_id?: number;
  procurement_request_id?: number;
  purchase_order_id?: number;
  subject: string;
  message: string;
  attachment_name?: string;
  attachment_url?: string;
  is_read?: boolean;
  created_at?: string;
  sender?: User;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  previous_status?: string;
  new_status?: string;
  details?: string;
  ip_address?: string;
  created_at: string;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private apiUrl = `${API_CONFIG.baseUrl}/communications`;

  constructor(private http: HttpClient) {}

  getMessages(filters?: { vendor_id?: number; procurement_id?: number; purchase_order_id?: number }): Observable<CommunicationMessage[]> {
    let params = new HttpParams();
    if (filters?.vendor_id) params = params.set('vendor_id', filters.vendor_id.toString());
    if (filters?.procurement_id) params = params.set('procurement_id', filters.procurement_id.toString());
    if (filters?.purchase_order_id) params = params.set('purchase_order_id', filters.purchase_order_id.toString());
    return this.http.get<CommunicationMessage[]>(`${this.apiUrl}/messages`, { params });
  }

  sendMessage(data: Partial<CommunicationMessage>): Observable<CommunicationMessage> {
    return this.http.post<CommunicationMessage>(`${this.apiUrl}/messages`, data);
  }

  getAuditLogs(limit = 100): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/audit-logs?limit=${limit}`);
  }
}
