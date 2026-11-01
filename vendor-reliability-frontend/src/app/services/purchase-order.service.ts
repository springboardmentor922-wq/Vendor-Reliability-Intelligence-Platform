import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { VendorModel } from './vendor.service';
import { User } from './auth.service';
import { API_CONFIG } from './api.config';

export interface POItem {
  id?: number;
  purchase_order_id?: number;
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  sku?: string;
}

export interface PurchaseOrder {
  id?: number;
  po_number?: string;
  procurement_request_id?: number;
  requisition_number?: string;
  requirement_title?: string;
  vendor_id: number;
  vendor_name?: string;
  vendor_company?: string;
  created_by_id?: number;
  total_amount?: number;
  currency?: string;
  status: string;
  approved_by_id?: number;
  approved_at?: string;
  issued_by_id?: number;
  issued_at?: string;
  vendor_accepted_at?: string;
  vendor_rejection_reason?: string;
  carrier?: string;
  tracking_number?: string;
  dispatch_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  terms_and_conditions?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
  items: POItem[];
  vendor?: VendorModel;
  created_by?: User;
  delivery?: any;
  invoice?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {
  private apiUrl = `${API_CONFIG.baseUrl}/purchase-orders`;
  private cachedOrders: PurchaseOrder[] = [];

  constructor(private http: HttpClient) {}

  getPurchaseOrders(filters?: { status?: string; vendor_id?: number }, forceRefresh = true): Observable<PurchaseOrder[]> {
    const hasFilters = (filters?.status && filters.status !== 'All') || !!filters?.vendor_id;
    if (!forceRefresh && !hasFilters && this.cachedOrders.length > 0) {
      return of(this.cachedOrders);
    }

    let params = new HttpParams();
    if (filters?.status && filters.status !== 'All') {
      params = params.set('status', filters.status);
    }
    if (filters?.vendor_id) {
      params = params.set('vendor_id', filters.vendor_id.toString());
    }
    return this.http.get<PurchaseOrder[]>(this.apiUrl, { params }).pipe(
      tap(orders => {
        if (!hasFilters) this.cachedOrders = orders || [];
      })
    );
  }

  getPurchaseOrder(id: number): Observable<PurchaseOrder> {
    const found = this.cachedOrders.find(o => o.id === id);
    if (found && found.items && found.items.length > 0) return of(found);
    return this.http.get<PurchaseOrder>(`${this.apiUrl}/${id}`);
  }

  createPurchaseOrder(data: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(this.apiUrl, data).pipe(
      tap(newPO => {
        if (newPO) this.cachedOrders = [newPO, ...this.cachedOrders];
      })
    );
  }

  approvePurchaseOrder(id: number): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.apiUrl}/${id}/approve`, {}).pipe(
      tap(updated => {
        const idx = this.cachedOrders.findIndex(o => o.id === id);
        if (idx !== -1) this.cachedOrders[idx] = updated;
      })
    );
  }

  rejectPurchaseOrder(id: number): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.apiUrl}/${id}/reject`, {}).pipe(
      tap(updated => {
        const idx = this.cachedOrders.findIndex(o => o.id === id);
        if (idx !== -1) this.cachedOrders[idx] = updated;
      })
    );
  }

  acceptPO(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/accept`, {}).pipe(
      tap(() => this.clearCache())
    );
  }

  rejectPOWithReason(id: number, reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/reject`, { rejection_reason: reason }).pipe(
      tap(() => this.clearCache())
    );
  }

  dispatchPO(id: number, payload: {
    carrier: string;
    tracking_number: string;
    dispatch_date?: string;
    expected_delivery_date?: string;
    notes?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/dispatch`, payload).pipe(
      tap(() => this.clearCache())
    );
  }

  updateDelivery(id: number, payload: {
    carrier?: string;
    tracking_number?: string;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    notes?: string;
    delivery_status?: string;
  }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/delivery`, payload).pipe(
      tap(() => this.clearCache())
    );
  }

  updateStatus(id: number, status: string, actual_delivery_date?: string): Observable<PurchaseOrder> {
    return this.http.put<PurchaseOrder>(`${this.apiUrl}/${id}/status`, {
      status,
      actual_delivery_date
    }).pipe(
      tap(updated => {
        const idx = this.cachedOrders.findIndex(o => o.id === id);
        if (idx !== -1) this.cachedOrders[idx] = updated;
      })
    );
  }

  clearCache(): void {
    this.cachedOrders = [];
  }
}
