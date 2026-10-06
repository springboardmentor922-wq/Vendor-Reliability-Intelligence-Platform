import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-notification-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-screen.component.html',
  styleUrls: ['./notification-screen.component.css']
})
export class NotificationScreenComponent implements OnInit {

  notifications: any[] = [];

  private apiUrl = 'http://localhost:8000/api/notifications/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.notifications = data;
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  get unreadCount(): number {
    return this.notifications.filter(
      item => item.status === 'UNREAD'
    ).length;
  }

  get readCount(): number {
    return this.notifications.filter(
      item => item.status === 'READ'
    ).length;
  }

  markAsRead(id: number): void {

    this.http.put(
      `${this.apiUrl}${id}/read`,
      null
    ).subscribe({
      next: () => {
        this.loadNotifications();
      },
      error: (error) => {
        console.error(
          'Error marking notification as read:',
          error
        );
      }
    });
  }

  getNotificationClass(type: string): string {

    switch (type) {

      case 'CONTRACT_EXPIRY':
        return 'contract';

      case 'COMPLIANCE_ISSUE':
        return 'compliance';

      case 'VENDOR_APPROVAL':
        return 'approval';

      case 'PROCUREMENT_APPROVAL':
        return 'procurement';

      case 'PURCHASE_ORDER':
        return 'purchase';

      case 'DELIVERY_UPDATE':
        return 'delivery';

      default:
        return 'general';
    }
  }

}