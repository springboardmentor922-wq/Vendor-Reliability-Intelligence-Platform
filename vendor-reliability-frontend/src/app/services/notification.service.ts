import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, of } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  reference_id?: number;
  reference_type?: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = `${API_CONFIG.baseUrl}/notifications`;
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();
  private cachedNotifs: NotificationItem[] = [];

  constructor(private http: HttpClient) {}

  getNotifications(forceRefresh = false): Observable<NotificationItem[]> {
    if (!forceRefresh && this.cachedNotifs.length > 0) {
      return of(this.cachedNotifs);
    }
    return this.http.get<NotificationItem[]>(this.apiUrl).pipe(
      tap(items => {
        this.cachedNotifs = items || [];
        const unread = items.filter(n => !n.is_read).length;
        this.unreadCountSubject.next(unread);
      })
    );
  }

  markAsRead(id: number): Observable<NotificationItem> {
    return this.http.put<NotificationItem>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => {
        const item = this.cachedNotifs.find(n => n.id === id);
        if (item) item.is_read = true;
        const curr = this.unreadCountSubject.value;
        if (curr > 0) this.unreadCountSubject.next(curr - 1);
      })
    );
  }

  markAllAsRead(): Observable<any> {
    return this.http.put(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => {
        this.cachedNotifs.forEach(n => n.is_read = true);
        this.unreadCountSubject.next(0);
      })
    );
  }

  createNotification(payload: {
    title: string;
    message: string;
    type: string;
    reference_id?: number;
    reference_type?: string;
    user_id?: number;
  }): Observable<NotificationItem> {
    return this.http.post<NotificationItem>(this.apiUrl, payload).pipe(
      tap(newNotif => {
        if (newNotif) {
          this.cachedNotifs = [newNotif, ...this.cachedNotifs];
          if (!newNotif.is_read) {
            this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
          }
        }
      })
    );
  }
}
