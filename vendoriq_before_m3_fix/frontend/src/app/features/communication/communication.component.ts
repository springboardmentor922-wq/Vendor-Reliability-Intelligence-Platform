import { inject, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommunicationService } from '../../core/services/communication.service';
import { AuthService } from '../../core/services/auth.service';
import { Message } from '../../core/models/models';

@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './communication.component.html',
})
export class CommunicationComponent implements OnInit {
  private fb = inject(FormBuilder);
  messages: Message[] = [];
  activityLogs: any[] = [];
  notifications: any[] = [];
  activeTab: 'messages' | 'activity' | 'notifications' = 'messages';
  loading = true;
  error = '';
  showForm = false;
  submitting = false;

  form = this.fb.group({
    receiver_id: [''],
    vendor_id: [''],
    subject: ['', Validators.required],
    body: ['', Validators.required],
    category: ['general'],
  });

  constructor(private commsService: CommunicationService, public auth: AuthService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.commsService.list().subscribe({
      next: (m) => {
        this.messages = m;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load messages.';
        this.loading = false;
      },
    });
    this.commsService.activityLogs().subscribe((logs) => (this.activityLogs = logs));
    this.commsService.notifications().subscribe((n) => (this.notifications = n));
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;
    const payload: any = { ...this.form.value };
    if (!payload.receiver_id) delete payload.receiver_id;
    else payload.receiver_id = Number(payload.receiver_id);
    if (!payload.vendor_id) delete payload.vendor_id;
    else payload.vendor_id = Number(payload.vendor_id);

    this.commsService.send(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.showForm = false;
        this.form.reset({ category: 'general' });
        this.load();
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.detail || 'Failed to send message.';
      },
    });
  }

  markRead(m: Message): void {
    this.commsService.markRead(m.id).subscribe(() => this.load());
  }
}
