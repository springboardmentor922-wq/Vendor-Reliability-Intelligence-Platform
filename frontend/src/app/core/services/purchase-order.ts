
import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import { Observable } from 'rxjs';

export const PURCHASE_ORDER_STATUSES = [
  'Pending',
  'Approved',
  'Ordered',
  'Delivered',
  'Completed',
  'Cancelled'
];

export const INVOICE_STATUSES = [
  'Pending',
  'Paid',
  'Rejected'
];

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  item_description: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  total: number;
}

export interface PurchaseOrderItemCreate {
  item_description: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
}

export interface PurchaseOrderCreate {
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  procurement_request_id: number | null;
  department: string;
  vendor_id: number;
  payment_terms: string;
  shipping_address: string;
  billing_address: string;
  remarks: string | null;
  items: PurchaseOrderItemCreate[];
}

export interface DeliveryUpdate {
  actual_delivery_date: string;
  delivery_notes: string | null;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  actual_delivery_date: string | null;
  delivery_notes: string | null;
  procurement_request_id: number | null;
  department: string;
  vendor_id: number;
  payment_terms: string;
  shipping_address: string;
  billing_address: string;
  remarks: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  approved_by: number | null;
  approved_at: string | null;
  created_by: number | null;
  created_at: string;
  items: PurchaseOrderItem[];
}

export interface InvoiceCreate {
  purchase_order_id: number;
  invoice_number: string;
  invoice_date: string;
  amount: number;
}

export interface Invoice {
  id: number;
  purchase_order_id: number;
  invoice_number: string;
  invoice_date: string;
  amount: number;
  status: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class PurchaseOrderService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/purchase-orders';

  constructor(
    private http: HttpClient
  ) {}

  getStatuses(): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}/statuses`
    );
  }

  getOrders(
    status?: string
  ): Observable<PurchaseOrder[]> {

    let params = new HttpParams();

    if (status) {
      params = params.set(
        'order_status',
        status
      );
    }

    return this.http.get<PurchaseOrder[]>(
      this.apiUrl,
      { params }
    );
  }

  getOrder(
    id: number
  ): Observable<PurchaseOrder> {

    return this.http.get<PurchaseOrder>(
      `${this.apiUrl}/${id}`
    );
  }

  createOrder(
    order: PurchaseOrderCreate
  ): Observable<PurchaseOrder> {

    return this.http.post<PurchaseOrder>(
      this.apiUrl,
      order
    );
  }

  updateStatus(
    id: number,
    status: string
  ): Observable<PurchaseOrder> {

    return this.http.patch<PurchaseOrder>(
      `${this.apiUrl}/${id}/status`,
      { status }
    );
  }

  updateDelivery(
    id: number,
    delivery: DeliveryUpdate
  ): Observable<PurchaseOrder> {

    return this.http.patch<PurchaseOrder>(
      `${this.apiUrl}/${id}/delivery`,
      delivery
    );
  }

  deleteOrder(
    id: number
  ): Observable<void> {

    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }

  createInvoice(
    invoice: InvoiceCreate
  ): Observable<Invoice> {

    return this.http.post<Invoice>(
      `${this.apiUrl}/invoices`,
      invoice
    );
  }

  getInvoices(
    purchaseOrderId?: number
  ): Observable<Invoice[]> {

    let params = new HttpParams();

    if (purchaseOrderId !== undefined) {
      params = params.set(
        'purchase_order_id',
        purchaseOrderId.toString()
      );
    }

    return this.http.get<Invoice[]>(
      `${this.apiUrl}/invoices/list`,
      { params }
    );
  }

  updateInvoiceStatus(
    invoiceId: number,
    status: string
  ): Observable<Invoice> {

    return this.http.patch<Invoice>(
      `${this.apiUrl}/invoices/${invoiceId}/status`,
      { status }
    );
  }
}