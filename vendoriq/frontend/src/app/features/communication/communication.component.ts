import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CommunicationService } from '../../core/services/communication.service';
import { AuthService } from '../../core/services/auth.service';
import { Message, User, Vendor } from '../../core/models/models';

@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './communication.component.html',
  styleUrl: './communication.component.css',
})
export class CommunicationComponent implements OnInit {
  private fb = inject(FormBuilder);

  messages: Message[] = [];
  activityLogs: any[] = [];
  notifications: any[] = [];

  recipientUsers: User[] = [];
  recipientVendors: Vendor[] = [];
  recipientsLoading = false;

  activeTab:
    | 'messages'
    | 'activity'
    | 'notifications' = 'messages';

  loading = true;
  error = '';

  showForm = false;
  submitting = false;
  uploadingFile = false;

  selectedFile: File | null = null;

  form = this.fb.group({
    receiver_id: [''],
    vendor_id: [''],
    subject: ['', Validators.required],
    body: ['', Validators.required],
    category: ['general'],
  });

  constructor(
    private commsService: CommunicationService,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadRecipients();
  }

  loadRecipients(): void {
    this.recipientsLoading = true;

    this.commsService.recipients().subscribe({
      next: (data) => {
        this.recipientUsers = data?.users || [];
        this.recipientVendors = data?.vendors || [];
        this.recipientsLoading = false;
      },
      error: (err) => {
        console.error('Failed to load communication recipients:', err);
        this.recipientUsers = [];
        this.recipientVendors = [];
        this.recipientsLoading = false;
      },
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.commsService.list().subscribe({
      next: (messages) => {
        this.messages = messages || [];
        this.loading = false;
      },

      error: (err) => {
        console.error('Failed to load messages:', err);

        this.error =
          err?.error?.detail ||
          'Failed to load messages.';

        this.loading = false;
      },
    });

    this.commsService
      .activityLogs()
      .subscribe({
        next: (logs) => {
          this.activityLogs = logs || [];
        },

        error: (err) => {
          console.error(
            'Failed to load activity logs:',
            err
          );

          this.activityLogs = [];
        },
      });

    this.commsService
      .notifications()
      .subscribe({
        next: (notifications) => {
          this.notifications =
            notifications || [];
        },

        error: (err) => {
          console.error(
            'Failed to load notifications:',
            err
          );

          this.notifications = [];
        },
      });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;

    if (!this.showForm) {
      this.resetForm();
    }
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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.error = '';

    const value = this.form.getRawValue();

    const payload: any = {
      subject: value.subject || '',
      body: value.body || '',
      category: value.category || 'general',
    };

    /*
     * UUID values must remain strings.
     * Do NOT convert receiver_id or vendor_id
     * to numbers.
     */

    if (value.receiver_id?.trim()) {
      payload.receiver_id =
        value.receiver_id.trim();
    }

    if (value.vendor_id?.trim()) {
      payload.vendor_id =
        value.vendor_id.trim();
    }

    this.commsService.send(payload).subscribe({
      next: (message) => {

        /*
         * If no file was selected,
         * finish normally.
         */
        if (!this.selectedFile) {
          this.submitting = false;
          this.showForm = false;

          this.resetForm();
          this.load();

          return;
        }

        /*
         * A file was selected.
         * First create the message,
         * then upload the attachment
         * using the returned message ID.
         */
        this.uploadingFile = true;

        this.commsService
          .uploadAttachment(
            message.id,
            this.selectedFile
          )
          .subscribe({
            next: (updatedMessage) => {
              console.log(
                'Attachment uploaded successfully:',
                updatedMessage
              );

              this.uploadingFile = false;
              this.submitting = false;
              this.showForm = false;

              this.resetForm();
              this.load();
            },

            error: (err) => {
              console.error(
                'Attachment upload error:',
                err
              );

              this.uploadingFile = false;
              this.submitting = false;

              this.error =
                err?.error?.detail ||
                'Message was sent, but the file upload failed.';
            },
          });
      },

      error: (err) => {
        console.error(
          'Send message error:',
          err
        );

        this.submitting = false;

        this.error =
          err?.error?.detail ||
          'Failed to send message.';
      },
    });
  }

  downloadAttachment(
    message: Message
  ): void {
    this.commsService
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

  resetForm(): void {
    this.form.reset({
      receiver_id: '',
      vendor_id: '',
      subject: '',
      body: '',
      category: 'general',
    });

    this.selectedFile = null;
    this.uploadingFile = false;
    this.submitting = false;
  }

  markRead(message: Message): void {
    this.commsService
      .markRead(message.id)
      .subscribe({
        next: () => {
          this.load();
        },

        error: (err) => {
          console.error(
            'Failed to mark message as read:',
            err
          );

          this.error =
            'Failed to mark message as read.';
        },
      });
  }
}