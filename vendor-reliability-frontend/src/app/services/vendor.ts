import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';

export interface VendorModel {
  id?: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  product: string;
  deliveryRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class Vendor {

  // Using 127.0.0.1 directly bypasses Windows IPv6 'localhost' DNS timeout (saves 1-3 seconds)
  private apiUrl = 'http://127.0.0.1:8000/vendors';
  private cachedVendors: VendorModel[] = [];

  constructor(private http: HttpClient) {}

  getVendors(forceRefresh = false): Observable<VendorModel[]> {
    if (!forceRefresh && this.cachedVendors.length > 0) {
      return of(this.cachedVendors);
    }
    return this.http.get<VendorModel[]>(this.apiUrl).pipe(
      tap(data => {
        this.cachedVendors = data || [];
      })
    );
  }

  addVendor(vendor: VendorModel): Observable<VendorModel> {
    return this.http.post<VendorModel>(this.apiUrl, vendor).pipe(
      tap(newVendor => {
        if (newVendor) {
          this.cachedVendors = [newVendor, ...this.cachedVendors];
        }
      })
    );
  }

  getVendor(id: number): Observable<VendorModel> {
    const cached = this.cachedVendors.find(v => v.id === id);
    if (cached) {
      return of(cached);
    }
    return this.http.get<VendorModel>(`${this.apiUrl}/${id}`);
  }

  getReliability(deliveryRate: number): string {
    const rate = Number(deliveryRate) || 0;
    if (rate === 0) {
      return 'New / Unrated';
    }
    if (rate >= 90) {
      return 'Excellent';
    }
    if (rate >= 75) {
      return 'Good';
    }
    if (rate >= 50) {
      return 'Average';
    }
    return 'Poor';
  }
}