import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getVendors(status?: string): Observable<any[]> {
    const url = status ? `${this.baseUrl}/vendors?status=${status}` : `${this.baseUrl}/vendors`;
    return this.http.get<any[]>(url);
  }

  getPOs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/pos`);
  }

  getRequests(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/requests`);
  }

  createRequest(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/requests`, data);
  }

  spendAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/analytics/spend`);
  }

  invoices(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/invoices`);
  }

  ranking(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/ranking`);
  }

  history(vendorId: string | number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/vendors/${vendorId}/history`);
  }

  contracts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/contracts`);
  }

  getContracts(): Observable<any[]> {
    return this.contracts();
  }

  certifications(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/certifications`);
  }

  messages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/messages`);
  }

  trends(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/trends`);
  }

  download(type: string, fmt: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/${type}?format=${fmt}`, {
      responseType: 'blob'
    });
  }
}