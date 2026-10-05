import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  // --- Auth Service ---
  login(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/auth/login`, payload); }
  register(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/auth/register`, payload); }
  resetPassword(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/auth/password-reset`, payload); }
  getProfile(): Observable<any> { return this.http.get(`${this.baseUrl}/auth/profile`); }

  // --- Vendor Service ---
  getVendors(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/vendors`); }
  createVendor(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/vendors`, payload); }
  approveVendor(vendorId: string | number): Observable<any> { return this.http.put(`${this.baseUrl}/vendors/${vendorId}/approve`, {}); }

  // --- Procurement Service ---
  getProcurements(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/procurement`); }
  createProcurement(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/procurement`, payload); }

  // --- PO Service ---
  getPurchaseOrders(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/purchase-orders`); }
  createPurchaseOrder(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/purchase-orders`, payload); }
  updateInvoiceStatus(poId: string | number, status: string): Observable<any> { 
    return this.http.put(`${this.baseUrl}/purchase-orders/${poId}/invoice`, { invoice_status: status }); 
  }

  // --- Contract Service ---
  getContracts(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/contracts`); }
  createContract(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/contracts`, payload); }

  // --- Performance & Reliability Services ---
  getPerformance(): Observable<any> { return this.http.get(`${this.baseUrl}/performance`); }
  getReliabilitySummary(): Observable<any> { return this.http.get(`${this.baseUrl}/reliability/summary`); }

  // --- Notification Service ---
  getNotifications(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/notifications`); }
  markNotificationRead(notificationId: string | number): Observable<any> { 
    return this.http.put(`${this.baseUrl}/notifications/${notificationId}/read`, {}); 
  }

  // --- Communication Service ---
  sendCommunication(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/communication/send`, payload); }

  // --- Reports & Export Module ---
  exportReport(format: string = 'pdf'): Observable<Blob> { 
    return this.http.get(`${this.baseUrl}/reports/export`, { responseType: 'blob', params: new HttpParams().set('format', format) }); 
  }

  // --- Audit Service ---
  getAuditLogs(): Observable<any[]> { return this.http.get<any[]>(`${this.baseUrl}/audit-logs`); }

  // --- Predictive ML Risk Service ---
  predictRisk(payload: any): Observable<any> { return this.http.post(`${this.baseUrl}/predictive/predict-risk`, payload); }
}