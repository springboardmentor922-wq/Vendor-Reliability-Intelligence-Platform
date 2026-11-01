import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { VendorModel } from './vendor.service';
import { User } from './auth.service';
import { API_CONFIG } from './api.config';

export interface ProcurementRequest {
  id?: number;
  request_number?: string;
  title: string;
  description?: string;
  category: string;
  department?: string;
  quantity?: number;
  unit_budget?: number;
  requested_by_id?: number;
  assigned_vendor_id?: number;
  vendor_name?: string;
  vendor_company?: string;
  estimated_budget: number;
  priority: string;
  status: string;
  approved_by_id?: number;
  approval_date?: string;
  rejection_reason?: string;
  delivery_deadline?: string;
  created_at?: string;
  updated_at?: string;
  requested_by?: any;
  vendor?: VendorModel;
  selected_vendor?: {
    id: number;
    name: string;
    company?: string;
    category?: string;
    quotation?: number;
    justification?: string;
    status?: string;
  };
  financial_approval?: {
    id: number;
    status: string;
    budget_allocated?: number;
    rejection_reason?: string;
  };
  purchase_order?: {
    id: number;
    po_number: string;
    status: string;
    vendor_id?: number;
    vendor_name?: string;
    vendor_company?: string;
    vendor?: any;
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
  items?: any[];
}

export interface EligibleVendorCard {
  vendor_id: number;
  id: number;
  name: string;
  company: string;
  category: string;
  products: string[];
  products_string?: string;
  reliability_score: number;
  on_time_delivery_rate: number;
  total_orders: number;
  completed_orders: number;
  delayed_orders: number;
  partial_deliveries: number;
  cancelled_orders: number;
  average_delivery_time: string;
  risk_level: string;
  risk_reasons: string[];
  status: string;
  quotation_estimate?: number;
}

export interface EligibleVendorsResponse {
  requisition_id: number;
  request_number: string;
  item: string;
  quantity: number;
  required_date?: string;
  priority: string;
  estimated_budget: number;
  category: string;
  total_eligible_vendors: number;
  vendors: EligibleVendorCard[];
}

export interface VendorFullDetails {
  profile: {
    vendor_id: number;
    name: string;
    company: string;
    category: string;
    products: string[];
    email: string;
    phone: string;
    address: string;
    business_reg_number: string;
    gst_tax_id: string;
    bank_details: string;
    verification_status: string;
    status: string;
  };
  performance: {
    reliability_score: number;
    on_time_delivery_rate: number;
    fulfillment_rate: number;
    quality_rating: number;
    total_orders: number;
    completed_orders: number;
    delayed_orders: number;
    partial_deliveries: number;
    cancelled_orders: number;
    average_delay_days: number;
  };
  risk: {
    current_risk_level: string;
    risk_score: number;
    risk_reasons: string[];
    recent_performance_trend: string;
  };
  purchase_history: {
    po_number: string;
    total_amount: number;
    currency: string;
    status: string;
    issued_at: string;
    delivery_date: string;
    delay_days: number;
    delivered_quantity?: number;
  }[];
}

export interface VendorSelectionPayload {
  requisition_id: number;
  vendor_id: number;
  quotation_amount: number;
  justification: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProcurementService {
  private apiUrl = `${API_CONFIG.baseUrl}/procurement`;
  private cachedRequests: ProcurementRequest[] = [];

  constructor(private http: HttpClient) {}

  getEligibleVendors(prId: number): Observable<EligibleVendorsResponse> {
    return this.http.get<EligibleVendorsResponse>(`${this.apiUrl}/requirements/${prId}/eligible-vendors`);
  }

  getVendorFullDetails(vendorId: number): Observable<VendorFullDetails> {
    return this.http.get<VendorFullDetails>(`${this.apiUrl}/vendors/${vendorId}/details`);
  }

  selectVendor(payload: VendorSelectionPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/select-vendor`, payload);
  }

  getRequests(filters?: { status?: string; priority?: string }, forceRefresh = false): Observable<ProcurementRequest[]> {
    const hasFilters = (filters?.status && filters.status !== 'All') || (filters?.priority && filters.priority !== 'All');
    if (!forceRefresh && !hasFilters && this.cachedRequests.length > 0) {
      return of(this.cachedRequests);
    }

    let params = new HttpParams();
    if (filters?.status && filters.status !== 'All') {
      params = params.set('status', filters.status);
    }
    if (filters?.priority && filters.priority !== 'All') {
      params = params.set('priority', filters.priority);
    }
    return this.http.get<ProcurementRequest[]>(this.apiUrl, { params }).pipe(
      tap(res => {
        if (!hasFilters) this.cachedRequests = res || [];
      })
    );
  }

  getRequest(id: number): Observable<ProcurementRequest> {
    const found = this.cachedRequests.find(r => r.id === id);
    if (found) return of(found);
    return this.http.get<ProcurementRequest>(`${this.apiUrl}/${id}`);
  }

  createRequest(data: Partial<ProcurementRequest>): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(this.apiUrl, data).pipe(
      tap(newReq => {
        if (newReq) this.cachedRequests = [newReq, ...this.cachedRequests];
      })
    );
  }

  updateRequest(id: number, data: Partial<ProcurementRequest>): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(`${this.apiUrl}/${id}`, data).pipe(
      tap(updated => {
        const idx = this.cachedRequests.findIndex(r => r.id === id);
        if (idx !== -1) this.cachedRequests[idx] = updated;
      })
    );
  }

  updateStatus(id: number, status: string, rejection_reason?: string): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(`${this.apiUrl}/${id}/status`, {
      status,
      rejection_reason
    }).pipe(
      tap(updated => {
        const idx = this.cachedRequests.findIndex(r => r.id === id);
        if (idx !== -1) this.cachedRequests[idx] = updated;
      })
    );
  }
}
