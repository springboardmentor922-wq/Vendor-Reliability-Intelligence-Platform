import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService, NotificationItem } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css'
})
export class Notifications implements OnInit {
  notifications: NotificationItem[] = [];
  filteredNotifications: NotificationItem[] = [];
  selectedFilter = 'all';
  isLoading = false;

  // The 7 Mandatory Notification Categories
  alertTypes = [
    { key: 'all', label: 'All Alerts', icon: 'bi-bell' },
    { key: 'procurement', label: 'Procurement Alerts', icon: 'bi-cart-check' },
    { key: 'delivery_delay', label: 'Delivery Delay Alerts', icon: 'bi-truck' },
    { key: 'vendor_approval', label: 'Vendor Approval', icon: 'bi-person-check' },
    { key: 'contract_expiry', label: 'Contract Expiry Alerts', icon: 'bi-file-earmark-medical' },
    { key: 'compliance', label: 'Compliance Notices', icon: 'bi-shield-check' },
    { key: 'email', label: 'Email Notifications', icon: 'bi-envelope' },
    { key: 'sms', label: 'SMS Notifications', icon: 'bi-phone' }
  ];

  showTriggerModal = false;
  newAlert = {
    title: '',
    message: '',
    type: 'procurement'
  };

  constructor(private notifService: NotificationService) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.notifService.getNotifications(true).subscribe({
      next: (data) => {
        this.notifications = data;
        this.applyFilter();
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  setFilter(filter: string): void {
    this.selectedFilter = filter;
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.selectedFilter === 'all') {
      this.filteredNotifications = [...this.notifications];
    } else {
      this.filteredNotifications = this.notifications.filter(n => n.type === this.selectedFilter);
    }
  }

  getUnreadCount(type: string): number {
    if (type === 'all') {
      return this.notifications.filter(n => !n.is_read).length;
    }
    return this.notifications.filter(n => n.type === type && !n.is_read).length;
  }

  markAsRead(id: number): void {
    this.notifService.markAsRead(id).subscribe({
      next: () => {
        const item = this.notifications.find(n => n.id === id);
        if (item) item.is_read = true;
        this.applyFilter();
      }
    });
  }

  markAllRead(): void {
    this.notifService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.is_read = true);
        this.applyFilter();
      }
    });
  }

  openTriggerModal(): void {
    this.newAlert = {
      title: 'Urgent Procurement Milestone Alert',
      message: 'Critical delivery timeline adjustment requested for purchase order.',
      type: 'procurement'
    };
    this.showTriggerModal = true;
  }

  triggerAlert(): void {
    if (!this.newAlert.title || !this.newAlert.message) return;

    this.notifService.createNotification({
      title: this.newAlert.title,
      message: this.newAlert.message,
      type: this.newAlert.type
    }).subscribe({
      next: () => {
        this.showTriggerModal = false;
        this.loadNotifications();
        alert(`Notification of type "${this.newAlert.type}" triggered and stored in database!`);
      },
      error: (err) => alert(err?.error?.detail || 'Failed to dispatch alert.')
    });
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'procurement': return 'bi-cart-check-fill';
      case 'delivery_delay': return 'bi-exclamation-octagon-fill';
      case 'vendor_approval': return 'bi-person-check-fill';
      case 'contract_expiry': return 'bi-hourglass-split';
      case 'compliance': return 'bi-shield-fill-check';
      case 'email': return 'bi-envelope-at-fill';
      case 'sms': return 'bi-chat-left-dots-fill';
      default: return 'bi-info-circle-fill';
    }
  }

  getAlertColorClass(type: string): string {
    switch (type) {
      case 'procurement': return 'stat-icon blue';
      case 'delivery_delay': return 'stat-icon rose';
      case 'vendor_approval': return 'stat-icon amber';
      case 'contract_expiry': return 'stat-icon purple';
      case 'compliance': return 'stat-icon green';
      case 'email': return 'stat-icon blue';
      case 'sms': return 'stat-icon amber';
      default: return 'stat-icon blue';
    }
  }

  getBadgeName(type: string): string {
    switch (type) {
      case 'procurement': return 'Procurement Alert';
      case 'delivery_delay': return 'Delivery Delay';
      case 'vendor_approval': return 'Vendor Approval';
      case 'contract_expiry': return 'Contract Expiry';
      case 'compliance': return 'Compliance';
      case 'email': return 'Email Notice';
      case 'sms': return 'SMS Gateway';
      default: return 'System Alert';
    }
  }
}
