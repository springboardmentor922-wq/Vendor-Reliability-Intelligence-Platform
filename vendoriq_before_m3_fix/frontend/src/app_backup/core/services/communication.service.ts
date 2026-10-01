import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private base = `${environment.apiUrl}/communication`;

  constructor(private http: HttpClient) {}

  list(vendorId?: number): Observable<Message[]> {
    const query = vendorId ? `?vendor_id=${vendorId}` : '';
    return this.http.get<Message[]>(`${this.base}${query}`);
  }

  send(payload: Partial<Message>): Observable<Message> {
    return this.http.post<Message>(this.base, payload);
  }

  markRead(id: number): Observable<Message> {
    return this.http.put<Message>(`${this.base}/${id}/read`, {});
  }

  activityLogs(limit = 50): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/activity-logs?limit=${limit}`);
  }

  notifications(unreadOnly = false): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/notifications?unread_only=${unreadOnly}`);
  }
}
