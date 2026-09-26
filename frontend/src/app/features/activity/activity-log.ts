import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { CommunicationService } from '../../core/api.service';
import { ActivityLogEntry } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-activity-log',
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './activity-log.html',
})
export class ActivityLog {
  private readonly service = inject(CommunicationService);
  private readonly toast = inject(ToastService);

  readonly entityTypes = [
    'Vendor',
    'ProcurementRequest',
    'PurchaseOrder',
    'Contract',
    'Invoice',
    'User',
    'Thread',
  ];

  readonly columns = ['created_at', 'user_name', 'entity_type', 'action', 'description'];

  readonly loading = signal(true);
  readonly entries = signal<ActivityLogEntry[]>([]);

  entityFilter = '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service.activity({ entity_type: this.entityFilter, limit: 200 }).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the activity log.');
      },
    });
  }
}
