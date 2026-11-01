import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { VendorModel } from './vendor.service';
import { API_CONFIG } from './api.config';

export interface Contract {
  id?: number;
  contract_number?: string;
  title: string;
  vendor_id: number;
  start_date: string;
  expiry_date: string;
  renewal_terms?: string;
  status: string;
  compliance_status: string;
  document_url?: string;
  document_name?: string;
  contract_value: number;
  created_at?: string;
  vendor?: VendorModel;
}

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private apiUrl = `${API_CONFIG.baseUrl}/contracts`;
  private cachedContracts: Contract[] = [];

  constructor(private http: HttpClient) {}

  getContracts(filters?: { status?: string; compliance_status?: string; vendor_id?: number }, forceRefresh = false): Observable<Contract[]> {
    const hasFilters = (filters?.status && filters.status !== 'All') ||
                       (filters?.compliance_status && filters.compliance_status !== 'All') ||
                       !!filters?.vendor_id;
    if (!forceRefresh && !hasFilters && this.cachedContracts.length > 0) {
      return of(this.cachedContracts);
    }

    let params = new HttpParams();
    if (filters?.status && filters.status !== 'All') {
      params = params.set('status', filters.status);
    }
    if (filters?.compliance_status && filters.compliance_status !== 'All') {
      params = params.set('compliance_status', filters.compliance_status);
    }
    if (filters?.vendor_id) {
      params = params.set('vendor_id', filters.vendor_id.toString());
    }
    return this.http.get<Contract[]>(this.apiUrl, { params }).pipe(
      tap(contracts => {
        if (!hasFilters) this.cachedContracts = contracts || [];
      })
    );
  }

  getContract(id: number): Observable<Contract> {
    const found = this.cachedContracts.find(c => c.id === id);
    if (found) return of(found);
    return this.http.get<Contract>(`${this.apiUrl}/${id}`);
  }

  createContract(data: Partial<Contract>): Observable<Contract> {
    return this.http.post<Contract>(this.apiUrl, data).pipe(
      tap(newC => {
        if (newC) this.cachedContracts = [newC, ...this.cachedContracts];
      })
    );
  }

  updateContract(id: number, data: Partial<Contract>): Observable<Contract> {
    return this.http.put<Contract>(`${this.apiUrl}/${id}`, data).pipe(
      tap(updated => {
        const idx = this.cachedContracts.findIndex(c => c.id === id);
        if (idx !== -1) this.cachedContracts[idx] = updated;
      })
    );
  }

  clearCache(): void {
    this.cachedContracts = [];
  }
}
