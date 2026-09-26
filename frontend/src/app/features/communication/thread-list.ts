import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';

import { CommunicationService } from '../../core/api.service';
import { MessageThread } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { StatusPill } from '../../shared/status-pill';
import { ThreadFormDialog } from './thread-form-dialog';

@Component({
  selector: 'app-thread-list',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    StatusPill,
  ],
  templateUrl: './thread-list.html',
})
export class ThreadList {
  private readonly service = inject(CommunicationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly statuses = [
    'Open',
    'Awaiting Vendor',
    'Awaiting Internal',
    'Resolved',
    'Closed',
  ];

  readonly loading = signal(true);
  readonly threads = signal<MessageThread[]>([]);

  search = '';
  statusFilter = '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service
      .threads({ search: this.search, status: this.statusFilter })
      .subscribe({
        next: (threads) => {
          this.threads.set(threads);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.toast.fromError(error, 'Could not load conversations.');
        },
      });
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = '';
    this.load();
  }

  open(thread: MessageThread): void {
    void this.router.navigate(['/communication', thread.id]);
  }

  create(): void {
    this.dialog
      .open(ThreadFormDialog, { width: '680px' })
      .afterClosed()
      .subscribe((thread) => {
        if (thread) {
          void this.router.navigate([
            '/communication',
            (thread as MessageThread).id,
          ]);
        }
      });
  }
}
