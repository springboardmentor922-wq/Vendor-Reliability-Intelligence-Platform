import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export const VENDOR_CATEGORIES = [
  'Raw Material Suppliers',
  'Equipment Vendors',
  'IT Vendors',
  'Service Providers',
  'Logistics Partners',
  'Maintenance Vendors'
];

export const VENDOR_STATUSES = [
  'Pending',
  'Approved',
  'Rejected'
];

export interface Vendor {
  id: number;
  name: string;
  category: string;
  contact_person: string;
  email: string;
  phone: string;
  status: string;
  location: string | null;
  contract_details: string | null;
  performance_score: number | null;
  reliability_score: number | null;
}

export interface VendorCreate {
  name: string;
  category: string;
  contact_person: string;
  email: string;
  phone: string;
  location: string | null;
  contract_details: string | null;
}

export interface VendorUpdate {
  name?: string;
  category?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  location?: string | null;
  contract_details?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class VendorService {
  private readonly apiUrl = 'http://127.0.0.1:8000/api/vendors';

  constructor(private http: HttpClient) {}

  getVendors(
    category?: string,
    status?: string
  ): Observable<Vendor[]> {
    let params = new HttpParams();

    if (category) {
      params = params.set('category', category);
    }

    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<Vendor[]>(this.apiUrl, { params });
  }

  getVendor(vendorId: number): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.apiUrl}/${vendorId}`);
  }

  getCategories(): Observable<{ categories: string[] }> {
    return this.http.get<{ categories: string[] }>(
      `${this.apiUrl}/categories`
    );
  }

  getStatuses(): Observable<{ statuses: string[] }> {
    return this.http.get<{ statuses: string[] }>(
      `${this.apiUrl}/statuses`
    );
  }

  createVendor(vendor: VendorCreate): Observable<Vendor> {
    return this.http.post<Vendor>(this.apiUrl, vendor);
  }

  updateVendor(
    vendorId: number,
    vendor: VendorUpdate
  ): Observable<Vendor> {
    return this.http.put<Vendor>(
      `${this.apiUrl}/${vendorId}`,
      vendor
    );
  }

  updateVendorStatus(
    vendorId: number,
    newStatus: string,
    remarks?: string
  ): Observable<Vendor> {
    let params = new HttpParams().set('new_status', newStatus);

    if (remarks) {
      params = params.set('remarks', remarks);
    }

    return this.http.patch<Vendor>(
      `${this.apiUrl}/${vendorId}/status`,
      null,
      { params }
    );
  }

  deleteVendor(vendorId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${vendorId}`
    );
  }

  getVendorHistory(vendorId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/${vendorId}/history`
    );
  }
}