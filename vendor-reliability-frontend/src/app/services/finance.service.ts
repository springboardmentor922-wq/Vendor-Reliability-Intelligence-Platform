import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface PendingFinancialApproval {
  selection_id: number;
  requisition_id: number;
  request_number: string;
  department: string;
  title: string;
  quantity: number;
  estimated_budget: number;
  vendor_id: number;
  vendor_name: string;
  vendor_company: string;
  quotation_amount: number;
  justification: string;
  selected_by: string;
  created_at: string;
}

export interface InvoiceRecord {
  id: number;
  invoice_number: string;
  purchase_order_id: number;
  po_number: string;
  po_total: number;
  vendor_id: number;
  vendor_name: string;
  vendor_company?: string;
  vendor?: any;
  amount: number;
  status: string;
  three_way_match_status: string;
  issue_date: string;
  due_date?: string;
  delivery?: {
    delivered_quantity: number;
    ordered_quantity: number;
    delay_days: number;
    delivery_status: string;
  };
  has_payment: boolean;
}

export interface PaymentRecord {
  id: number;
  transaction_reference: string;
  invoice_number: string;
  po_number: string;
  vendor_id?: number;
  vendor_name: string;
  vendor_company?: string;
  vendor?: any;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  processed_by: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private baseUrl = `${API_CONFIG.baseUrl}/finance`;

  constructor(private http: HttpClient) {}

  getPendingApprovals(): Observable<PendingFinancialApproval[]> {
    return this.http.get<PendingFinancialApproval[]>(`${this.baseUrl}/pending-approvals`);
  }

  approveFinancialRequest(selectionId: number, budgetAllocated: number, comments?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/approvals/${selectionId}/approve`, {
      budget_allocated: budgetAllocated,
      comments: comments || 'Budget verified and allocated against department operating account.'
    });
  }

  rejectFinancialRequest(selectionId: number, rejectionReason: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/approvals/${selectionId}/reject`, {
      rejection_reason: rejectionReason
    });
  }

  getInvoices(): Observable<InvoiceRecord[]> {
    return this.http.get<InvoiceRecord[]>(`${this.baseUrl}/invoices`);
  }

  verify3WayMatch(invoiceId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/invoices/${invoiceId}/verify-3way-match`, {});
  }

  processPayment(payload: {
    invoice_id: number;
    amount: number;
    payment_method: string;
    transaction_reference: string;
    notes?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/payments`, payload);
  }

  getPaymentHistory(): Observable<PaymentRecord[]> {
    return this.http.get<PaymentRecord[]>(`${this.baseUrl}/payments/history`);
  }
}
