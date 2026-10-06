import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Contract } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ContractService {
  private base = `${environment.apiUrl}/contracts`;

  constructor(private http: HttpClient) {}

  list(params: { vendor_id?: string; status_filter?: string } = {}): Observable<Contract[]>{
    let query = '';
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length) {
      query = '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    }
    return this.http.get<Contract[]>(`${this.base}${query}`);
  }

  get(id: number): Observable<Contract> {
    return this.http.get<Contract>(`${this.base}/${id}`);
  }

  create(payload: Partial<Contract>): Observable<Contract> {
    return this.http.post<Contract>(this.base, payload);
  }

  update(id: number, payload: Partial<Contract>): Observable<Contract> {
    return this.http.put<Contract>(`${this.base}/${id}`, payload);
  }

  renew(id: number, newEndDateIso: string): Observable<Contract> {
    return this.http.put<Contract>(`${this.base}/${id}/renew?new_end_date=${encodeURIComponent(newEndDateIso)}`, {});
  }

  expiringSoon(days = 30): Observable<Contract[]> {
    return this.http.get<Contract[]>(`${this.base}/expiring/soon?days=${days}`);
  }
}
