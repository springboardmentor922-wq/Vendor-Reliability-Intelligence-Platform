import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProcurementRequest } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ProcurementService {
  private base = `${environment.apiUrl}/procurement`;

  constructor(private http: HttpClient) {}

  list(params: { status_filter?: string; priority?: string } = {}): Observable<ProcurementRequest[]> {
    let query = '';
    const entries = Object.entries(params).filter(([, v]) => !!v);
    if (entries.length) {
      query = '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    }
    return this.http.get<ProcurementRequest[]>(`${this.base}${query}`);
  }

  get(id: number): Observable<ProcurementRequest> {
    return this.http.get<ProcurementRequest>(`${this.base}/${id}`);
  }

  create(payload: Partial<ProcurementRequest>): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(this.base, payload);
  }

  update(id: number, payload: Partial<ProcurementRequest>): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(`${this.base}/${id}`, payload);
  }

  setApproval(id: number, status: string, approval_notes?: string): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(`${this.base}/${id}/approval`, { status, approval_notes });
  }

  assignVendor(id: number, vendorId: number): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(`${this.base}/${id}/assign-vendor/${vendorId}`, {});
  }
}
