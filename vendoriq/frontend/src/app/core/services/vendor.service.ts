import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Vendor, VendorContact } from '../models/models';

@Injectable({ providedIn: 'root' })
export class VendorService {
  private base = `${environment.apiUrl}/vendors`;

  constructor(private http: HttpClient) {}

  list(params: { category?: string; status_filter?: string; search?: string } = {}): Observable<Vendor[]> {
    let query = '';
    const entries = Object.entries(params).filter(([, v]) => !!v);
    if (entries.length) {
      query = '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    }
    return this.http.get<Vendor[]>(`${this.base}${query}`);
  }

  get(id: string): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.base}/${id}`);
  }

  create(payload: Partial<Vendor>): Observable<Vendor> {
    return this.http.post<Vendor>(this.base, payload);
  }

  update(id: string, payload: Partial<Vendor>): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.base}/${id}`, payload);
  }

  setApproval(id: string, status: string, approval_notes?: string): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.base}/${id}/approval`, { status, approval_notes });
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  addContact(vendorId: string, contact: VendorContact): Observable<VendorContact> {
    return this.http.post<VendorContact>(`${this.base}/${vendorId}/contacts`, contact);
  }

  deleteContact(vendorId: string, contactId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${vendorId}/contacts/${contactId}`);
  }
}
