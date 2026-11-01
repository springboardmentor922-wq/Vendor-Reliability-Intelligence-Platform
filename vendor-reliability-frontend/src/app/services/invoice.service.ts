import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface Invoice {
  id: number;
  invoice_number: string;
  purchase_order_id?: number;
  vendor_id?: number;
  amount: number;
  status: 'Submitted' | 'Approved' | 'Paid' | 'Rejected';
  issue_date: string;
  due_date?: string;
  paid_date?: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
  vendor_name?: string;
  vendor_company?: string;
  vendor?: any;
  three_way_match_status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private apiUrl = `${API_CONFIG.baseUrl}/invoices`;

  constructor(private http: HttpClient) {}

  getInvoices(filters?: { status?: string; vendor_id?: number }): Observable<Invoice[]> {
    let params = new HttpParams();
    if (filters?.status && filters.status !== 'All') {
      params = params.set('status', filters.status);
    }
    if (filters?.vendor_id) {
      params = params.set('vendor_id', filters.vendor_id.toString());
    }
    return this.http.get<Invoice[]>(this.apiUrl, { params });
  }

  createInvoice(data: Partial<Invoice>): Observable<Invoice> {
    return this.http.post<Invoice>(this.apiUrl, data);
  }

  updateInvoiceStatus(id: number, update: { status: string; payment_method?: string }): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.apiUrl}/${id}/status`, update);
  }
}
