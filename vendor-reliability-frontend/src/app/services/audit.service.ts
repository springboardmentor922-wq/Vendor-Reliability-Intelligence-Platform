import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface TransactionChain {
  requisition: {
    id: number;
    request_number: string;
    department: string;
    title: string;
    quantity: number;
    estimated_budget: number;
    status: string;
    requested_by: string;
    created_at: string;
  };
  vendor_selection?: {
    id: number;
    vendor_name: string;
    quotation_amount: number;
    justification: string;
    status: string;
    selected_by: string;
    created_at: string;
  };
  financial_approval?: {
    id: number;
    status: string;
    budget_allocated: number;
    approved_by: string;
    approved_at: string;
    rejection_reason?: string;
  };
  purchase_order?: {
    id: number;
    po_number: string;
    total_amount: number;
    status: string;
    issued_at?: string;
    vendor_accepted_at?: string;
    carrier?: string;
    tracking_number?: string;
  };
  delivery?: {
    id: number;
    expected_delivery_date?: string;
    actual_delivery_date?: string;
    ordered_quantity: number;
    delivered_quantity: number;
    delay_days: number;
    status: string;
  };
  invoice?: {
    id: number;
    invoice_number: string;
    amount: number;
    status: string;
    three_way_match_status: string;
  };
  payment?: {
    id: number;
    transaction_reference: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    status: string;
  };
  audit: {
    review_status: string;
    comments?: string;
    findings_count: number;
  };
}

export interface DiscrepancyReport {
  type: string;
  severity: string;
  reference: string;
  description: string;
  created_at: string;
}

export interface AuditFindingItem {
  id: number;
  transaction_type: string;
  transaction_id: number;
  reference_number?: string;
  finding_type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  resolution_notes?: string;
  auditor_name: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private baseUrl = `${API_CONFIG.baseUrl}/auditor`;

  constructor(private http: HttpClient) {}

  getTransactionChains(search?: string): Observable<TransactionChain[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<TransactionChain[]>(`${this.baseUrl}/transactions`, { params });
  }

  getDiscrepancies(): Observable<DiscrepancyReport[]> {
    return this.http.get<DiscrepancyReport[]>(`${this.baseUrl}/discrepancies`);
  }

  getFindings(): Observable<AuditFindingItem[]> {
    return this.http.get<AuditFindingItem[]>(`${this.baseUrl}/findings`);
  }

  createFinding(payload: {
    transaction_type: string;
    transaction_id: number;
    reference_number?: string;
    finding_type: string;
    severity: string;
    title: string;
    description: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/findings`, payload);
  }

  setReviewStatus(payload: {
    transaction_type: string;
    transaction_id: number;
    status: string;
    comments?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/review-status`, payload);
  }
}
