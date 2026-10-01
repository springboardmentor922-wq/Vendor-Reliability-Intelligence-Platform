import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private base = `${environment.apiUrl}/analytics`;

  constructor(private http: HttpClient) {}

  procurementDashboard(): Observable<any> {
    return this.http.get(`${this.base}/procurement-dashboard`);
  }

  vendorDashboard(vendorId: number): Observable<any> {
    return this.http.get(`${this.base}/vendor-dashboard/${vendorId}`);
  }

  adminDashboard(): Observable<any> {
    return this.http.get(`${this.base}/admin-dashboard`);
  }

  vendorRiskDashboard(): Observable<any> {
    return this.http.get(`${this.base}/vendor-risk-dashboard`);
  }

  procurementSpend(): Observable<any> {
    return this.http.get(`${this.base}/procurement-spend`);
  }

  procurementAnalytics(): Observable<any> {
    return this.http.get(`${this.base}/procurement-analytics`);
  }
}
