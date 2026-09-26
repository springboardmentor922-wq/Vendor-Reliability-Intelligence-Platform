import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { NotificationService } from '../../core/api.service';
import { AppNotification, NotificationSummary } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { StatusPill } from '../../shared/status-pill';

const ICONS: Record<string, string> = {
  Procurement: 'assignment',
  Delivery: 'local_shipping',
  'Vendor Approval': 'verified',
  'Contract Expiry': 'event_busy',
  Compliance: 'gavel',
  Message: 'forum',
  System: 'settings',
};

@Component({
  selector: 'app-notification-list',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    StatusPill,
  ],
  templateUrl: './notification-list.html',
})
export class NotificationList {
  private readonly service = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly types = [
    'Procurement',
    'Delivery',
    'Vendor Approval',
    'Contract Expiry',
    'Compliance',
    'Message',
    'System',
  ];

  readonly loading = signal(true);
  readonly notifications = signal<AppNotification[]>([]);
  readonly summary = signal<NotificationSummary | null>(null);

  unreadOnly = false;
  typeFilter = '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service
      .list({
        unread_only: this.unreadOnly ? true : '',
        notification_type: this.typeFilter,
      })
      .subscribe({
        next: (notifications) => {
          this.notifications.set(notifications);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load notifications.');
        },
      });

    this.service.summary().subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => this.summary.set(null),
    });
  }

  iconFor(type: string): string {
    return ICONS[type] ?? 'notifications';
  }

  open(notification: AppNotification): void {
    if (!notification.is_read) {
      this.service.markRead(notification.id).subscribe({
        next: () => this.load(),
        error: () => undefined,
      });
    }

    if (notification.link) {
      void this.router.navigateByUrl(notification.link);
    }
  }

  markRead(notification: AppNotification, event: Event): void {
    event.stopPropagation();

    this.service.markRead(notification.id).subscribe({
      next: () => this.load(),
      error: (error) =>
        this.toast.fromError(error, 'Could not mark the notification as read.'),
    });
  }

  markAllRead(): void {
    this.service.markAllRead().subscribe({
      next: (response) => {
        this.toast.success(response.message);
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not mark notifications as read.'),
    });
  }

  remove(notification: AppNotification, event: Event): void {
    event.stopPropagation();

    this.service.remove(notification.id).subscribe({
      next: () => this.load(),
      error: (error) =>
        this.toast.fromError(error, 'Could not delete the notification.'),
    });
  }
}
