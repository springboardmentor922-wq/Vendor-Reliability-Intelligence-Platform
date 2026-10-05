
import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  NotificationRecord,
  NotificationService,
  NotificationSummary,
  RiskAlert,
  RiskAlertResponse
} from '../../core/services/notification';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class Notifications implements OnInit {

  notifications: NotificationRecord[] = [];

  summary: NotificationSummary = {
    total: 0,
    unread: 0,
    procurement_alerts: 0,
    delivery_delays: 0,
    vendor_approvals: 0,
    contract_expiry_alerts: 0,
    compliance_alerts: 0
  };

  riskAlerts: RiskAlert[] = [];
  riskAlertSummary: RiskAlertResponse | null = null;

  riskAlertsLoading = false;
  riskAlertsError = '';
  riskAlertFilter = 'ALL';

  loading = true;
  syncing = false;
  errorMessage = '';

  filter = 'ALL';

  constructor(
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
    this.loadRiskAlerts();
  }

  loadNotifications(): void {
    this.loading = true;
    this.errorMessage = '';

    this.notificationService.syncNotifications().subscribe({
      next: () => {
        this.loadData();
      },
      error: (error) => {
        console.error('Notification sync failed:', error);
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;

        this.notificationService.getSummary().subscribe({
          next: (summary) => {
            this.summary = summary;
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error(
              'Failed to load notification summary:',
              error
            );

            this.loading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (error) => {
        console.error(
          'Failed to load notifications:',
          error
        );

        this.errorMessage = 'Unable to load notifications.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRiskAlerts(): void {
    this.riskAlertsLoading = true;
    this.riskAlertsError = '';

    this.notificationService.getRiskAlerts().subscribe({
      next: (response: RiskAlertResponse) => {
        this.riskAlertSummary = response;
        this.riskAlerts = response.alerts ?? [];
        this.riskAlertsLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to load risk alerts:', error);
        this.riskAlertsError =
          'Unable to load vendor risk alerts.';
        this.riskAlertsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  refresh(): void {
    this.syncing = true;

    this.notificationService.syncNotifications().subscribe({
      next: () => {
        this.syncing = false;
        this.loadData();
        this.loadRiskAlerts();
      },
      error: (error) => {
        console.error(
          'Notification refresh failed:',
          error
        );

        this.syncing = false;
        this.loadData();
        this.loadRiskAlerts();
      }
    });
  }

  setFilter(filter: string): void {
    this.filter = filter;
  }

  setRiskAlertFilter(filter: string): void {
    this.riskAlertFilter = filter;
  }

  get filteredRiskAlerts(): RiskAlert[] {
    if (this.riskAlertFilter === 'ALL') {
      return this.riskAlerts;
    }

    return this.riskAlerts.filter(
      alert =>
        alert.risk_level?.toUpperCase() ===
        this.riskAlertFilter
    );
  }

  getRiskAlertClass(level: string): string {
    switch ((level || '').toUpperCase()) {
      case 'HIGH':
        return 'high-risk';
      case 'MEDIUM':
        return 'medium-risk';
      case 'LOW':
        return 'low-risk';
      case 'UNASSESSED':
        return 'unassessed-risk';
      default:
        return '';
    }
  }

  isRiskAlert(notification: NotificationRecord): boolean {
    return (
      notification.notification_type === 'RISK_ALERT' ||
      (notification.source_type ?? '').startsWith('RISK_')
    );
  }

  get filteredNotifications(): NotificationRecord[] {
    if (this.filter === 'ALL') {
      return this.notifications;
    }

    if (this.filter === 'UNREAD') {
      return this.notifications.filter(
        notification => !notification.is_read
      );
    }

    if (this.filter === 'RISK_ALERT') {
      return this.notifications.filter(
        notification => this.isRiskAlert(notification)
      );
    }

    return this.notifications.filter(
      notification =>
        notification.notification_type === this.filter
    );
  }

  markAsRead(notification: NotificationRecord): void {
    if (notification.is_read) {
      return;
    }

    this.notificationService
      .markAsRead(notification.id)
      .subscribe({
        next: (updated) => {
          const index = this.notifications.findIndex(
            item => item.id === updated.id
          );

          if (index !== -1) {
            this.notifications[index] = updated;
          }

          this.loadSummaryOnly();
        },
        error: (error) => {
          console.error(
            'Failed to mark notification as read:',
            error
          );
        }
      });
  }

  markAllAsRead(): void {
    this.notificationService
      .markAllAsRead()
      .subscribe({
        next: () => {
          this.loadData();
        },
        error: (error) => {
          console.error(
            'Failed to mark all notifications as read:',
            error
          );
        }
      });
  }

  deleteNotification(
    notification: NotificationRecord
  ): void {
    this.notificationService
      .deleteNotification(notification.id)
      .subscribe({
        next: () => {
          this.notifications =
            this.notifications.filter(
              item => item.id !== notification.id
            );

          this.loadSummaryOnly();
        },
        error: (error) => {
          console.error(
            'Failed to delete notification:',
            error
          );
        }
      });
  }

  loadSummaryOnly(): void {
    this.notificationService
      .getSummary()
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error(
            'Failed to refresh notification summary:',
            error
          );
        }
      });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'PROCUREMENT_ALERT':
        return '📦';
      case 'DELIVERY_DELAY':
        return '🚚';
      case 'VENDOR_APPROVAL':
        return '👤';
      case 'CONTRACT_EXPIRY':
        return '📄';
      case 'COMPLIANCE':
        return '⚠️';
      case 'RISK_ALERT':
      case 'RISK_HIGH':
        return '🚨';
      case 'RISK_SCORE_DROP':
        return '📉';
      case 'RISK_LATE_DELIVERY':
        return '🚚';
      case 'RISK_RECORDED_ISSUE':
        return '🛠️';
      default:
        return '🔔';
    }
  }

  getNotificationLabel(type: string): string {
    switch (type) {
      case 'PROCUREMENT_ALERT':
        return 'Procurement';
      case 'DELIVERY_DELAY':
        return 'Delivery Delay';
      case 'VENDOR_APPROVAL':
        return 'Vendor Approval';
      case 'CONTRACT_EXPIRY':
        return 'Contract Expiry';
      case 'COMPLIANCE':
        return 'Compliance';
      case 'RISK_ALERT':
        return 'Risk Alert';
      case 'RISK_HIGH':
        return 'High-Risk Vendor';
      case 'RISK_SCORE_DROP':
        return 'Reliability Score Drop';
      case 'RISK_LATE_DELIVERY':
        return 'Repeated Late Deliveries';
      case 'RISK_RECORDED_ISSUE':
        return 'Vendor Issue Recorded';
      default:
        return 'Notification';
    }
  }

  formatDate(value: string): string {
    if (!value) {
      return '';
    }

    return new Date(value).toLocaleString();
  }
}