import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface PurchaseRequisitionItem {
  id?: number;
  item_name: string;
  description?: string;
  quantity: number;
  estimated_unit_price: number;
  estimated_total_price?: number;
  sku?: string;
}

export interface PurchaseRequisition {
  id: number;
  request_number: string;
  department: string;
  title: string;
  description: string;
  quantity: number;
  unit_budget?: number;
  required_date?: string;
  priority: string;
  category?: string;
  estimated_budget: number;
  status: string;
  rejection_reason?: string;
  requested_by?: {
    id: number;
    name: string;
    email: string;
  };
  selected_vendor?: {
    id: number;
    name: string;
    quotation: number;
    justification?: string;
    status: string;
  };
  financial_approval?: {
    id: number;
    status: string;
    budget_allocated: number;
    rejection_reason?: string;
  };
  purchase_order?: {
    id: number;
    po_number: string;
    status: string;
    total_amount?: number;
    carrier?: string;
    tracking_number?: string;
    dispatch_date?: string;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    delivery_status?: string;
    delay_days?: number;
    delivered_quantity?: number;
    ordered_quantity?: number;
    invoice_number?: string;
    invoice_status?: string;
    invoice_amount?: number;
    is_paid?: boolean;
  };
  items?: PurchaseRequisitionItem[];
  created_at: string;
  updated_at?: string;
}

export interface CreatePRPayload {
  department: string;
  product_name: string;
  quantity: number;
  unit_budget?: number;
  required_date?: string;
  priority: string;
  reason: string;
  category?: string;
  estimated_budget?: number;
  items?: PurchaseRequisitionItem[];
}

@Injectable({
  providedIn: 'root'
})
export class RequisitionService {
  private baseUrl = `${API_CONFIG.baseUrl}/requisitions`;

  constructor(private http: HttpClient) {}

  createRequisition(payload: CreatePRPayload): Observable<any> {
    return this.http.post<any>(this.baseUrl, payload);
  }

  getRequisitions(status?: string): Observable<PurchaseRequisition[]> {
    let params = new HttpParams();
    if (status && status !== 'All') {
      params = params.set('status_filter', status);
    }
    return this.http.get<PurchaseRequisition[]>(this.baseUrl, { params });
  }

  getRequisition(id: number): Observable<PurchaseRequisition> {
    return this.http.get<PurchaseRequisition>(`${this.baseUrl}/${id}`);
  }
}
