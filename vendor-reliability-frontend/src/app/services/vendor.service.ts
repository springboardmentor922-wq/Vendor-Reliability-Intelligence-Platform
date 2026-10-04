import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface VendorContact {
  id?: number;
  vendor_id?: number;
  contact_name: string;
  title?: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

export interface VendorCategory {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface VendorModel {
  id?: number;
  user_id?: number;
  name: string;
  company: string;
  email: string;
  password?: string;
  phone: string;
  address?: string;
  website?: string;
  product: string;
  category: string;
  status: string;
  deliveryRate: number;
  quality_rating?: number;
  response_time_hours?: number;
  risk_level?: string;
  business_reg_number?: string;
  gst_tax_id?: string;
  bank_details?: string;
  notes?: string;
  risk_reasons?: string[];
  documents?: any[];
  products?: any[];
  performance?: any;
  reviewed_by_id?: number;
  review_notes?: string;
  reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
  delivery_history?: any[];
  purchase_history?: any[];
  metrics?: any;
  contacts?: VendorContact[];
}

@Injectable({
  providedIn: 'root'
})
export class VendorService {
  private apiUrl = `${API_CONFIG.baseUrl}/vendors`;
  private cachedVendors: VendorModel[] = [];
  private cachedCategories: VendorCategory[] = [];

  constructor(private http: HttpClient) {}

  clearCache(): void {
    this.cachedVendors = [];
    this.cachedCategories = [];
  }

  getCategories(forceRefresh = false): Observable<VendorCategory[]> {
    if (!forceRefresh && this.cachedCategories.length > 0) {
      return of(this.cachedCategories);
    }
    return this.http.get<VendorCategory[]>(`${this.apiUrl}/categories/list`).pipe(
      tap(cats => this.cachedCategories = cats || [])
    );
  }

  getVendors(filters?: { status?: string; category?: string; search?: string }, forceRefresh = true): Observable<VendorModel[]> {
    const hasFilters = (filters?.status && filters.status !== 'All') ||
                       (filters?.category && filters.category !== 'All') ||
                       !!filters?.search;

    if (!forceRefresh && !hasFilters && this.cachedVendors.length > 0) {
      return of(this.cachedVendors);
    }

    let params = new HttpParams();
    if (filters?.status && filters.status !== 'All') {
      params = params.set('status', filters.status);
    }
    if (filters?.category && filters.category !== 'All') {
      params = params.set('category', filters.category);
    }
    if (filters?.search) {
      params = params.set('search', filters.search);
    }

    return this.http.get<VendorModel[]>(this.apiUrl, { params }).pipe(
      tap(vendors => {
        if (!hasFilters) {
          this.cachedVendors = vendors || [];
        }
      })
    );
  }

  getVendor(id: number): Observable<VendorModel> {
    const found = this.cachedVendors.find(v => v.id === id);
    if (found && found.contacts && found.contacts.length > 0) {
      return of(found);
    }
    return this.http.get<VendorModel>(`${this.apiUrl}/${id}`);
  }

  getVendorProfile(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/profile`);
  }

  addVendor(vendor: VendorModel): Observable<VendorModel> {
    return this.http.post<VendorModel>(this.apiUrl, vendor).pipe(
      tap(newV => {
        if (newV) {
          this.cachedVendors = [newV, ...this.cachedVendors.filter(v => v.id !== newV.id)];
        }
      })
    );
  }

  createVendor(vendor: any): Observable<VendorModel> {
    return this.addVendor(vendor);
  }

  updateVendor(id: number, data: Partial<VendorModel>): Observable<VendorModel> {
    return this.http.put<VendorModel>(`${this.apiUrl}/${id}`, data).pipe(
      tap(updated => {
        const idx = this.cachedVendors.findIndex(v => v.id === id);
        if (idx !== -1) this.cachedVendors[idx] = updated;
      })
    );
  }

  approveVendor(id: number, reviewNotes?: string): Observable<VendorModel> {
    return this.http.post<VendorModel>(`${this.apiUrl}/${id}/approve`, {
      status: 'Approved',
      review_notes: reviewNotes || 'Approved by procurement team.'
    }).pipe(
      tap(updated => {
        const idx = this.cachedVendors.findIndex(v => v.id === id);
        if (idx !== -1) this.cachedVendors[idx] = updated;
      })
    );
  }

  rejectVendor(id: number, reviewNotes?: string): Observable<VendorModel> {
    return this.http.post<VendorModel>(`${this.apiUrl}/${id}/reject`, {
      status: 'Rejected',
      review_notes: reviewNotes || 'Rejected by procurement team.'
    }).pipe(
      tap(updated => {
        const idx = this.cachedVendors.findIndex(v => v.id === id);
        if (idx !== -1) this.cachedVendors[idx] = updated;
      })
    );
  }

  addContact(vendorId: number, contact: VendorContact): Observable<VendorContact> {
    return this.http.post<VendorContact>(`${this.apiUrl}/${vendorId}/contacts`, contact);
  }

  deleteContact(vendorId: number, contactId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${vendorId}/contacts/${contactId}`);
  }

  getReliability(deliveryRate: number): string {
    const rate = Number(deliveryRate) || 0;
    if (rate === 0) return 'New / Unrated';
    if (rate >= 90) return 'Excellent';
    if (rate >= 75) return 'Good';
    if (rate >= 50) return 'Average';
    return 'Poor';
  }

  registerVendor(vendor: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, vendor);
  }

  setVendorCredentials(vendorId: number, credentials: { email?: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${vendorId}/credentials`, credentials);
  }

  getVendorCredentialsStatus(vendorId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${vendorId}/credentials-status`);
  }

  getVendorPurchaseOrders(vendorId: number, status?: string): Observable<any[]> {
    let params = new HttpParams();
    if (status && status !== 'All') {
      params = params.set('status', status);
    }
    return this.http.get<any[]>(`${this.apiUrl}/${vendorId}/purchase-orders`, { params });
  }
}
