import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { DashboardService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DashboardOverview } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { StatusPill } from '../../shared/status-pill';

interface BarDatum {
  label: string;
  value: number;
  percent: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly service = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly data = signal<DashboardOverview | null>(null);
  readonly user = this.auth.user;
  readonly canEdit = this.auth.canEdit;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly vendorBars = computed(() =>
    this.toBars(this.data()?.vendors_by_status ?? {}),
  );

  readonly categoryBars = computed(() =>
    this.toBars(this.data()?.vendors_by_category ?? {}),
  );

  readonly orderBars = computed(() =>
    this.toBars(this.data()?.orders_by_status ?? {}),
  );

  readonly requestBars = computed(() =>
    this.toBars(this.data()?.requests_by_status ?? {}),
  );

  readonly spendBars = computed(() => {
    const spend = this.data()?.monthly_spend ?? {};
    const max = Math.max(...Object.values(spend), 1);

    return Object.entries(spend).map(([label, value]) => ({
      label: this.monthLabel(label),
      value,
      percent: Math.round((value / max) * 100),
    }));
  });

  readonly topVendorBars = computed(() => {
    const vendors = this.data()?.top_vendors_by_spend ?? [];
    const max = Math.max(...vendors.map((v) => v.spend), 1);

    return vendors.map((vendor) => ({
      label: vendor.vendor_name,
      value: vendor.spend,
      percent: Math.round((vendor.spend / max) * 100),
    }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.service.overview().subscribe({
      next: (overview) => {
        this.data.set(overview);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the dashboard.');
      },
    });
  }

  private toBars(source: Record<string, number>): BarDatum[] {
    const entries = Object.entries(source).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(([, value]) => value), 1);

    return entries.map(([label, value]) => ({
      label,
      value,
      percent: Math.round((value / max) * 100),
    }));
  }

  private monthLabel(key: string): string {
    const [year, month] = key.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
    });
  }
}
