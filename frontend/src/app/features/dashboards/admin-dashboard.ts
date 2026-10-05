import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';

import { AdminDashboard as Payload, DashboardsService, SystemStats } from '../../core/dashboards.service';
import { ActivityFeed } from '../../shared/viz/activity-feed';
import { Donut } from '../../shared/viz/donut';
import { bytes, duration, money, monthShort, monthLong, num, pct } from '../../shared/viz/format';
import { KpiTile } from '../../shared/viz/kpi-tile';
import { Palette } from '../../shared/viz/palette';
import { ChartClick, ViqChart } from '../../shared/viz/viq-chart';
import { DashboardBase, rangeFilters } from './dashboard-base';

const KPI_STYLE: Record<string, { icon: string; tone: string }> = {
  total_users: { icon: 'group', tone: '#3b82f6' },
  total_vendors: { icon: 'domain', tone: '#10b981' },
  total_contracts: { icon: 'description', tone: '#a855f7' },
  system_uptime: { icon: 'dns', tone: '#f97316' },
};

@Component({
  selector: 'app-admin-dashboard',
  imports: [ActivityFeed, DatePipe, Donut, KpiTile, MatIconModule, MatTooltipModule, RouterLink, ViqChart],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard extends DashboardBase<Payload> {
  private readonly api = inject(DashboardsService);
  private readonly palette = inject(Palette);
  private readonly router = inject(Router);

  readonly system = signal<SystemStats | null>(null);

  readonly money = money;
  readonly num = num;
  readonly pct = pct;
  readonly bytes = bytes;
  readonly Math = Math;
  readonly duration = duration;

  constructor() {
    super();
    this.load();
    this.pollSystem();
    const timer = setInterval(() => {
      if (this.live.enabled() && document.visibilityState === 'visible') this.pollSystem();
    }, 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected fetch() {
    const r = rangeFilters(this.range());
    return this.api.admin({ start: r.start, months: r.months });
  }

  private pollSystem(): void {
    this.api.system().subscribe({ next: (s) => this.system.set(s), error: () => undefined });
  }

  kpiStyle(key: string) {
    return KPI_STYLE[key] ?? { icon: 'insights', tone: '#a855f7' };
  }

  /** System stats: the 5-second poll wins over the (slower) dashboard payload. */
  readonly sys = computed(() => {
    const base = this.data()?.system;
    const live = this.system();
    return base ? { ...base, ...(live ?? {}) } : null;
  });

  readonly dbPct = computed(() => {
    const s = this.sys();
    return s ? Math.min(100, (100 * s.database_bytes) / (s.database_quota_bytes || 1)) : 0;
  });

  // ---------------------------------------------------------------- charts

  readonly riskData = computed<ChartData>(() => {
    const risk = this.data()?.vendor_analytics.risk ?? [];
    return {
      labels: risk.map((r) => `${r.label} risk`),
      datasets: [
        {
          label: 'Vendors',
          data: risk.map((r) => r.value),
          backgroundColor: risk.map((r) => this.palette.status(r.label)),
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: 'bottom',
          maxBarThickness: 46,
        },
      ],
    } as ChartData;
  });

  readonly riskOptions: ChartOptions = {
    scales: {
      x: { ticks: { autoSkip: false } },
      y: { ticks: { precision: 0 }, },
    },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} vendor(s)` } } },
  };

  readonly reportData = computed<ChartData>(() => {
    const series = this.data()?.procurement_reports.series ?? [];
    const c = this.palette.colors();
    return {
      labels: series.map((s) => monthShort(s.period)),
      datasets: [
        {
          type: 'bar',
          label: 'Procurement value',
          data: series.map((s) => s.value),
          backgroundColor: c.series[6],
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: 'bottom',
          maxBarThickness: 24,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Number of POs',
          data: series.map((s) => s.orders),
          borderColor: c.series[1],
          backgroundColor: c.series[1],
          pointBackgroundColor: c.series[1],
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
          pointRadius: 3.5,
          borderWidth: 2,
          tension: 0.35,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    } as ChartData;
  });

  readonly reportOptions: ChartOptions = {
    scales: {
      x: { ticks: { autoSkip: false } },
      y: { ticks: { callback: (v) => money(Number(v)) } },
      y1: { position: 'right', beginAtZero: true, grid: { display: false }, border: { display: false }, },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => monthLong(this.data()?.procurement_reports.series[items[0]?.dataIndex ?? 0]?.period ?? ''),
          label: (ctx) => (ctx.dataset.yAxisID === 'y1' ? ` ${ctx.formattedValue} purchase orders` : ` ${money(Number(ctx.raw), 'USD', false)}`),
        },
      },
    },
  };

  readonly reliabilityData = computed<ChartData>(() => {
    const rows = this.data()?.vendor_analytics.reliability_trend ?? [];
    const c = this.palette.colors();
    return {
      labels: rows.map((r) => monthShort(r.period)),
      datasets: [
        {
          label: 'Average reliability',
          data: rows.map((r) => r.average),
          borderColor: c.series[6],
          backgroundColor: this.palette.alpha(c.series[6], 0.18),
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: c.series[6],
          pointBorderColor: c.surface,
        },
      ],
    } as ChartData;
  });

  readonly reliabilityOptions: ChartOptions = {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: false, suggestedMin: 50, suggestedMax: 90 } },
  };

  readonly latencyData = computed<ChartData>(() => {
    const series = this.sys()?.latency_series ?? [];
    const c = this.palette.colors();
    return {
      labels: series.map((s) => s.minute),
      datasets: [
        {
          label: 'Avg response (ms)',
          data: series.map((s) => s.avg_ms),
          borderColor: c.series[2],
          backgroundColor: this.palette.alpha(c.series[2], 0.15),
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    } as ChartData;
  });

  readonly latencyOptions: ChartOptions = {
    animation: { duration: 500 },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} ms avg` } } },
    scales: {
      x: { display: false },
      y: { display: false, beginAtZero: true },
    },
  };

  // ---------------------------------------------------------------- drill-down

  openRole(label: string): void {
    void this.router.navigate(['/users'], { queryParams: { role: label } });
  }

  openRisk(event: ChartClick): void {
    const level = this.data()?.vendor_analytics.risk[event.index]?.label;
    if (level) void this.router.navigate(['/vendors'], { queryParams: { risk_level: level } });
  }

  openMonth(event: ChartClick): void {
    const period = this.data()?.procurement_reports.series[event.index]?.period;
    if (period) void this.router.navigate(['/purchase-orders'], { queryParams: { month: period } });
  }

  openCompliance(label: string): void {
    const status = label === 'Compliant' || label === 'Non-Compliant' ? label : null;
    void this.router.navigate(['/contracts'], { queryParams: status ? { compliance: status } : {} });
  }
}
