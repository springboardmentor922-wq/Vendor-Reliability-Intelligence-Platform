import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface VendorPerformanceReport {
  vendor_id: number;
  vendor_name: string;
  category: string;
  status: string;
  total_orders: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  quality_rating: number | null;
  service_rating: number | null;
  response_time_hours: number | null;
  issue_resolution_time_hours: number | null;
  order_completion_rate: number;
  performance_score: number;
}

export interface ProcurementReport {
  total_purchase_orders: number;
  pending_orders: number;
  approved_orders: number;
  ordered_orders: number;
  delivered_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_procurement_cost: number;
  average_order_value: number;
}

export interface PurchaseOrderReport {
  id: number;
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  vendor_name: string;
  department: string;
  payment_terms: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export interface ComplianceReport {
  contract_id: number;
  contract_number: string;
  contract_title: string;
  vendor_name: string;
  start_date: string;
  end_date: string;
  contract_status: string;
  compliance_status: string;
  contract_value: number;
}

export interface ContractReport {
  id: number;
  contract_number: string;
  title: string;
  contract_type: string;
  vendor_name: string;
  start_date: string;
  end_date: string;
  renewal_date: string | null;
  status: string;
  compliance_status: string;
  contract_value: number;
  payment_terms: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/reports';

  constructor(private http: HttpClient) {}

  getVendorPerformance(): Observable<VendorPerformanceReport[]> {
    return this.http.get<VendorPerformanceReport[]>(
      `${this.apiUrl}/vendor-performance`
    );
  }

  getProcurement(): Observable<ProcurementReport> {
    return this.http.get<ProcurementReport>(
      `${this.apiUrl}/procurement`
    );
  }

  getPurchaseOrders(): Observable<PurchaseOrderReport[]> {
    return this.http.get<PurchaseOrderReport[]>(
      `${this.apiUrl}/purchase-orders`
    );
  }

  getCompliance(): Observable<ComplianceReport[]> {
    return this.http.get<ComplianceReport[]>(
      `${this.apiUrl}/compliance`
    );
  }

  getContracts(): Observable<ContractReport[]> {
    return this.http.get<ContractReport[]>(
      `${this.apiUrl}/contracts`
    );
  }

  downloadPdf(report: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/${report}/pdf`,
      {
        responseType: 'blob'
      }
    );
  }

  downloadExcel(report: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/${report}/excel`,
      {
        responseType: 'blob'
      }
    );
  }
}