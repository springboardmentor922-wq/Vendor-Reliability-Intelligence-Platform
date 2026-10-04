import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface DeliveryRecord {
  id: number;
  purchase_order_id: number;
  po_number: string;
  vendor_id?: number;
  vendor_name: string;
  vendor_company?: string;
  vendor?: any;
  expected_delivery_date: string;
  actual_delivery_date: string;
  ordered_quantity: number;
  delivered_quantity: number;
  delay_days: number;
  delivery_status: string;
  carrier?: string;
  tracking_number?: string;
  recorded_by?: string;
  created_at: string;
}

export interface RecordDeliveryPayload {
  purchase_order_id: number;
  expected_delivery_date: string;
  actual_delivery_date: string;
  ordered_quantity: number;
  delivered_quantity: number;
  carrier?: string;
  tracking_number?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {
  private baseUrl = `${API_CONFIG.baseUrl}/deliveries`;

  constructor(private http: HttpClient) {}

  recordDelivery(payload: RecordDeliveryPayload): Observable<any> {
    return this.http.post<any>(this.baseUrl, payload);
  }

  confirmCompleted(deliveryId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${deliveryId}/confirm-completed`, {});
  }

  getDeliveries(): Observable<DeliveryRecord[]> {
    return this.http.get<DeliveryRecord[]>(this.baseUrl);
  }
}
