import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Issue, IssueStatus, PerformanceSnapshotOut, QualityEvaluation, VendorMetrics } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private base = `${environment.apiUrl}/performance`;

  constructor(private http: HttpClient) {}

  getVendorMetrics(vendorId: number): Observable<VendorMetrics> {
    return this.http.get<VendorMetrics>(`${this.base}/vendors/${vendorId}/metrics`);
  }

  getHistory(vendorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/vendors/${vendorId}/history`);
  }

  createSnapshot(vendorId: number): Observable<any> {
    return this.http.post(`${this.base}/vendors/${vendorId}/snapshot`, {});
  }

  ranking(metric = 'on_time_rate'): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/ranking?metric=${metric}`);
  }

  listQualityEvaluations(vendorId: number): Observable<QualityEvaluation[]> {
    return this.http.get<QualityEvaluation[]>(`${this.base}/quality-evaluations?vendor_id=${vendorId}`);
  }

  addQualityEvaluation(payload: Partial<QualityEvaluation>): Observable<QualityEvaluation> {
    return this.http.post<QualityEvaluation>(`${this.base}/quality-evaluations`, payload);
  }

  listIssues(vendorId: number): Observable<Issue[]> {
    return this.http.get<Issue[]>(`${this.base}/issues?vendor_id=${vendorId}`);
  }

  raiseIssue(payload: Partial<Issue>): Observable<Issue> {
    return this.http.post<Issue>(`${this.base}/issues`, payload);
  }

  resolveIssue(issueId: number, resolution_notes?: string): Observable<Issue> {
    return this.http.put<Issue>(`${this.base}/issues/${issueId}/resolve`, { resolution_notes });
  }
}
