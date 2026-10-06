import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CommunicationService } from '../../core/services/communication.service';
import { AuthService } from '../../core/services/auth.service';
import { Message } from '../../core/models/models';

@Component({
  selector: 'app-vendor-communication',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './vendor-communication.component.html',
})
export class VendorCommunicationComponent implements OnInit {

  private fb = inject(FormBuilder);
  private communicationService = inject(CommunicationService);
  public auth = inject(AuthService);

  messages: Message[] = [];
  notifications: any[] = [];
  activityLogs: any[] = [];

  loading = true;
  sending = false;
  uploadingFile = false;
  selectedFile: File | null = null;

  error = '';

  activeTab: 'messages' | 'notifications' | 'activity' = 'messages';

  showCompose = false;

  unreadMessages = 0;
  unreadNotifications = 0;

  form = this.fb.group({
    receiver_id: [''],
    category: ['general', Validators.required],
    subject: [''],
    body: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';

    this.loadMessages();
    this.loadNotifications();
    this.loadActivityLogs();
  }

  loadMessages(): void {
    this.communicationService.list().subscribe({
      next: (messages) => {
        this.messages = messages || [];

        const currentUserId = this.auth.currentUser()?.id;

        this.unreadMessages = this.messages.filter(
          (message) =>
            !message.is_read &&
            message.receiver_id === currentUserId
        ).length;

        this.loading = false;
      },

      error: (err) => {
        console.error('Communication messages error:', err);

        this.error =
          err?.error?.detail ||
          'Failed to load communication history.';

        this.loading = false;
      },
    });
  }

  loadNotifications(): void {
    this.communicationService.notifications(false).subscribe({
      next: (notifications) => {
        this.notifications = notifications || [];

        this.unreadNotifications =
          this.notifications.filter(
            (notification) => !notification.is_read
          ).length;
      },

      error: (err) => {
        console.error(
          'Communication notifications error:',
          err
        );
      },
    });
  }

  loadActivityLogs(): void {
    this.communicationService.activityLogs(50).subscribe({
      next: (logs) => {
        this.activityLogs = logs || [];
      },

      error: (err) => {
        console.error(
          'Communication activity logs error:',
          err
        );
      },
    });
  }

  setTab(
    tab: 'messages' | 'notifications' | 'activity'
  ): void {
    this.activeTab = tab;
  }

  toggleCompose(): void {
    this.showCompose = !this.showCompose;

    if (!this.showCompose) {
      this.resetForm();
    }
  }

  sendMessage(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending = true;
    this.error = '';

    const value = this.form.getRawValue();

    const payload: any = {
      category: value.category || 'general',
      subject: value.subject || undefined,
      body: value.body || '',
    };

    if (value.receiver_id?.trim()) {
      payload.receiver_id = value.receiver_id.trim();
    }

    this.communicationService.send(payload).subscribe({
      next: (message) => {

        // No attachment selected
        if (!this.selectedFile) {
          this.sending = false;
          this.showCompose = false;

          this.resetForm();
          this.loadMessages();
          this.loadActivityLogs();

          return;
        }

        // Attachment selected
        this.uploadingFile = true;

        this.communicationService
          .uploadAttachment(
            message.id,
            this.selectedFile
          )
          .subscribe({
            next: () => {
              this.uploadingFile = false;
              this.sending = false;

              this.showCompose = false;

              this.resetForm();
              this.loadMessages();
              this.loadActivityLogs();
            },

            error: (err) => {
              console.error(
                'Upload attachment error:',
                err
              );

              this.uploadingFile = false;
              this.sending = false;

              this.error =
                err?.error?.detail ||
                'Message sent, but file upload failed.';
            },
          });
      },

      error: (err) => {
        console.error(
          'Send message error:',
          err
        );

        this.sending = false;

        this.error =
          err?.error?.detail ||
          'Failed to send message.';
      },
    });
  }

  onFileSelected(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    if (
      input.files &&
      input.files.length > 0
    ) {
      this.selectedFile = input.files[0];
      this.error = '';
    } else {
      this.selectedFile = null;
    }
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
  }

  downloadAttachment(message: Message): void {
    this.communicationService
      .downloadAttachment(message.id)
      .subscribe({
        next: (blob) => {
          const url =
            window.URL.createObjectURL(blob);

          const anchor =
            document.createElement('a');

          anchor.href = url;

          anchor.download =
            message.attachment_path
              ? message.attachment_path
                  .split('/')
                  .pop() || 'attachment'
              : 'attachment';

          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);

          window.URL.revokeObjectURL(url);
        },

        error: (err) => {
          console.error(
            'Download attachment error:',
            err
          );

          this.error =
            err?.error?.detail ||
            'Failed to download attachment.';
        },
      });
  }

  markRead(message: Message): void {
    const currentUserId =
      this.auth.currentUser()?.id;

    if (
      message.is_read ||
      message.receiver_id !== currentUserId
    ) {
      return;
    }

    this.communicationService
      .markRead(message.id)
      .subscribe({
        next: (updated) => {
          message.is_read = updated.is_read;

          this.unreadMessages =
            this.messages.filter(
              (item) =>
                !item.is_read &&
                item.receiver_id ===
                  this.auth.currentUser()?.id
            ).length;

          this.loadNotifications();
        },

        error: (err) => {
          console.error(
            'Mark message read error:',
            err
          );
        },
      });
  }

  refresh(): void {
    this.loadAll();
  }

  resetForm(): void {
    this.form.reset({
      receiver_id: '',
      category: 'general',
      subject: '',
      body: '',
    });

    this.selectedFile = null;
    this.uploadingFile = false;
    this.sending = false;
  }

  messageDirection(message: Message): string {
    const currentUserId =
      this.auth.currentUser()?.id;

    return message.sender_id === currentUserId
      ? 'Sent'
      : 'Received';
  }

  directionClass(message: Message): string {
    return this.messageDirection(message) === 'Sent'
      ? 'bg-primary'
      : 'bg-success';
  }

  categoryLabel(
    category: string | undefined
  ): string {
    if (!category) {
      return 'General';
    }

    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  }

  notificationClass(
    notification: any
  ): string {
    return notification?.is_read
      ? 'border-start'
      : 'border-start border-primary border-4';
  }
}