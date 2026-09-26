import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { CommunicationService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MessageThreadDetail, ThreadMessage } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { StatusPill } from '../../shared/status-pill';

@Component({
  selector: 'app-thread-detail',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './thread-detail.html',
})
export class ThreadDetail {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CommunicationService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  readonly user = this.auth.user;
  readonly canEdit = this.auth.canEdit;

  readonly statuses = [
    'Open',
    'Awaiting Vendor',
    'Awaiting Internal',
    'Resolved',
    'Closed',
  ];

  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly thread = signal<MessageThreadDetail | null>(null);

  /** Attachment queued alongside the next reply. */
  readonly pendingFile = signal<File | null>(null);

  private readonly fileInput =
    viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly replyForm = this.fb.nonNullable.group({
    body: ['', Validators.required],
  });

  constructor() {
    queueMicrotask(() => this.load());
  }

  load(): void {
    this.loading.set(true);

    this.service.thread(Number(this.id())).subscribe({
      next: (thread) => {
        this.thread.set(thread);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the conversation.');
      },
    });
  }

  isMine(message: ThreadMessage): boolean {
    return message.sender_id === this.user()?.id;
  }

  attachmentUrl(path: string): string {
    return `${environment.apiUrl}/uploads/${path}`;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file && file.size > 10 * 1024 * 1024) {
      this.toast.error('Attachments are limited to 10 MB.');
      input.value = '';
      return;
    }

    this.pendingFile.set(file);
  }

  clearFile(): void {
    this.pendingFile.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  send(): void {
    const thread = this.thread();
    if (!thread || this.replyForm.invalid || this.sending()) {
      this.replyForm.markAllAsTouched();
      return;
    }

    this.sending.set(true);

    this.service
      .postMessage(thread.id, this.replyForm.getRawValue().body)
      .subscribe({
        next: (message) => {
          const file = this.pendingFile();

          if (!file) {
            this.finishSend();
            return;
          }

          this.service.uploadAttachment(message.id, file).subscribe({
            next: () => this.finishSend(),
            error: (error) => {
              this.sending.set(false);
              this.toast.fromError(
                error,
                'The message was sent but the attachment failed to upload.',
              );
              this.replyForm.reset({ body: '' });
              this.clearFile();
              this.load();
            },
          });
        },
        error: (error) => {
          this.sending.set(false);
          this.toast.fromError(error, 'Could not send the message.');
        },
      });
  }

  private finishSend(): void {
    this.sending.set(false);
    this.replyForm.reset({ body: '' });
    this.clearFile();
    this.load();
  }

  setStatus(status: string): void {
    const thread = this.thread();
    if (!thread) return;

    this.service.updateThread(thread.id, { status }).subscribe({
      next: () => {
        this.toast.success(`Conversation marked ${status}.`);
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not update the conversation.'),
    });
  }
}
