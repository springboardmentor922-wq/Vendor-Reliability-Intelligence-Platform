import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message, User, Vendor } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class CommunicationService {
  private base = `${environment.apiUrl}/communication`;

  constructor(private http: HttpClient) {}

  list(vendorId?: string): Observable<Message[]> {
    const query = vendorId
      ? `?vendor_id=${encodeURIComponent(vendorId)}`
      : '';

    return this.http.get<Message[]>(
      `${this.base}${query}`
    );
  }

  send(payload: Partial<Message>): Observable<Message> {
    return this.http.post<Message>(
      this.base,
      payload
    );
  }

  markRead(id: number): Observable<Message> {
    return this.http.put<Message>(
      `${this.base}/${id}/read`,
      {}
    );
  }

  activityLogs(limit = 50): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.base}/activity-logs?limit=${limit}`
    );
  }

  notifications(unreadOnly = false): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.base}/notifications?unread_only=${unreadOnly}`
    );
  }
    recipients(): Observable<{
    users: User[];
    vendors: Vendor[];
  }> {
    return this.http.get<{
      users: User[];
      vendors: Vendor[];
    }>(`${this.base}/recipients`);
  }

  uploadAttachment(
    id: number,
    file: File
  ): Observable<Message> {
    const formData = new FormData();

    formData.append('file', file);

    return this.http.post<Message>(
      `${this.base}/${id}/attachment`,
      formData
    );
  }

  downloadAttachment(id: number): Observable<Blob> {
    return this.http.get(
      `${this.base}/${id}/attachment`,
      {
        responseType: 'blob',
      }
    );
  }
}