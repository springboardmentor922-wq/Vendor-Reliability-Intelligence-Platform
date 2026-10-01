import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ReportType = 'vendor-performance' | 'procurement' | 'purchase-orders' | 'compliance' | 'contracts';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private base = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  preview(type: ReportType): Observable<{ title: string; headers: string[]; rows: any[][] }> {
    return this.http.get<{ title: string; headers: string[]; rows: any[][] }>(`${this.base}/${type}?format=json`);
  }

  download(type: ReportType, format: 'xlsx' | 'pdf'): void {
    const token = localStorage.getItem('vendoriq_token');
    const url = `${this.base}/${type}?format=${format}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `${type}-report.${format}`;
        link.click();
      });
  }

  runNotificationChecks(days = 30): Observable<any> {
    return this.http.post(`${environment.apiUrl}/notifications/run-checks?days=${days}`, {});
  }

  emailLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/notifications/email-logs`);
  }
}
