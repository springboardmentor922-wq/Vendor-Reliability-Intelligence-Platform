import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Invoice, PurchaseOrder } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private base = `${environment.apiUrl}/purchase-orders`;

  constructor(private http: HttpClient) {}

  list(params: { status_filter?: string; vendor_id?: number } = {}): Observable<PurchaseOrder[]> {
    let query = '';
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length) {
      query = '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    }
    return this.http.get<PurchaseOrder[]>(`${this.base}${query}`);
  }

  get(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.base}/${id}`);
  }

  create(payload: any): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(this.base, payload);
  }

  updateStatus(id: number, status: string): Observable<PurchaseOrder> {
    return this.http.put<PurchaseOrder>(`${this.base}/${id}/status`, { status });
  }

  listInvoices(poId: number): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.base}/${poId}/invoices`);
  }

  createInvoice(poId: number, payload: any): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${poId}/invoices`, payload);
  }

  updateInvoiceStatus(invoiceId: number, status: string): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.base}/invoices/${invoiceId}/status`, { status });
  }
}
