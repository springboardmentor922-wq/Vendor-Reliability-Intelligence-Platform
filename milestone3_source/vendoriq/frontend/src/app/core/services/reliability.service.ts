import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReliabilityScore, RiskSummary, VendorRankingEntry } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ReliabilityService {
  private base = `${environment.apiUrl}/reliability`;

  constructor(private http: HttpClient) {}

  calculate(vendorId: number): Observable<ReliabilityScore> {
    return this.http.post<ReliabilityScore>(`${this.base}/vendors/${vendorId}/calculate`, {});
  }

  getLatest(vendorId: number): Observable<ReliabilityScore> {
    return this.http.get<ReliabilityScore>(`${this.base}/vendors/${vendorId}`);
  }

  getHistory(vendorId: number): Observable<ReliabilityScore[]> {
    return this.http.get<ReliabilityScore[]>(`${this.base}/vendors/${vendorId}/history`);
  }

  ranking(category?: string): Observable<VendorRankingEntry[]> {
    const q = category ? `?category=${category}` : '';
    return this.http.get<VendorRankingEntry[]>(`${this.base}/ranking${q}`);
  }

  riskSummary(): Observable<RiskSummary> {
    return this.http.get<RiskSummary>(`${this.base}/risk-summary`);
  }
}
