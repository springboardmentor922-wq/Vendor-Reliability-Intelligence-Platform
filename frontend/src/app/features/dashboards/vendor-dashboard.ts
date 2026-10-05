import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';

import { AuthService } from '../../core/auth.service';
import { DashboardsService, VendorDashboard as Payload } from '../../core/dashboards.service';
import { StatusPill } from '../../shared/status-pill';
import { ActivityFeed } from '../../shared/viz/activity-feed';
import { Donut } from '../../shared/viz/donut';
import { money, monthShort, monthLong, num, pct } from '../../shared/viz/format';
import { KpiTile } from '../../shared/viz/kpi-tile';
import { Palette } from '../../shared/viz/palette';
import { ChartClick, ViqChart } from '../../shared/viz/viq-chart';
import { DashboardBase, rangeFilters } from './dashboard-base';

const KPI_STYLE: Record<string, { icon: string; tone: string }> = {
  performance_score: { icon: 'workspace_premium', tone: '#10b981' },
  reliability_score: { icon: 'verified_user', tone: '#3b82f6' },
  active_contracts: { icon: 'description', tone: '#f97316' },
  total_orders: { icon: 'shopping_bag', tone: '#8b5cf6' },
};

const CONTRACT_STATUS: Record<string, string> = {
  Active: 'Active',
  'Expiring Soon': 'Expiring',
  Renewed: 'Renewed',
  Expired: 'Expired',
  Draft: 'Draft',
  Terminated: 'Terminated',
};

@Component({
  selector: 'app-vendor-dashboard',
  imports: [ActivityFeed, DatePipe, Donut, KpiTile, MatIconModule, MatTooltipModule, RouterLink, StatusPill, ViqChart],
  templateUrl: './vendor-dashboard.html',
})
export class VendorDashboard extends DashboardBase<Payload> {
  private readonly api = inject(DashboardsService);
  private readonly palette = inject(Palette);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly isVendor = this.auth.isVendor;
  readonly vendorId = signal<number | null>(null);
  readonly vendors = signal<{ id: number; name: string; category: string }[]>([]);

  readonly money = money;
  readonly num = num;
  readonly pct = pct;

  constructor() {
    super();
    this.range.set('12m');
    const fromUrl = Number(this.route.snapshot.queryParamMap.get('vendor'));
    if (fromUrl) this.vendorId.set(fromUrl);

    if (!this.isVendor()) {
      this.api.filterOptions().subscribe({ next: (o) => this.vendors.set(o.vendors) });
    }
    this.load();
  }

  protected fetch() {
    const r = rangeFilters(this.range());
    return this.api.vendor({ start: r.start, vendor_id: this.vendorId() });
  }

  kpiStyle(key: string) {
    return KPI_STYLE[key] ?? { icon: 'insights', tone: '#10b981' };
  }

  selectVendor(value: string): void {
    const id = Number(value) || null;
    this.vendorId.set(id);
    void this.router.navigate([], { queryParams: { vendor: id }, replaceUrl: true });
    this.load(true);
  }

  // ---------------------------------------------------------------- charts

  readonly performanceData = computed<ChartData>(() => {
    const perf = this.data()?.vendor_performance;
    const c = this.palette.colors();
    if (!perf) return { labels: [], datasets: [] };
    return {
      labels: perf.groups.map((g) => g.label),
      datasets: perf.series.map((name, i) => ({
        label: name,
        data: perf.groups.map((g) => g.values[i]),
        backgroundColor: c.series[i],
        borderRadius: { topLeft: 4, topRight: 4 },
        borderSkipped: 'bottom',
        maxBarThickness: 16,
        categoryPercentage: 0.72,
        barPercentage: 0.9,
      })),
    } as ChartData;
  });

  readonly performanceOptions: ChartOptions = {
    scales: {
      y: { max: 100, },
      x: { ticks: { callback: function (value) { const l = String(this.getLabelForValue(Number(value))); return l.length > 14 ? l.slice(0, 13) + '…' : l; } } },
    },
    plugins: { tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}` } } },
  };

  readonly trendData = computed<ChartData>(() => {
    const trend = this.data()?.reliability.trend ?? [];
    const c = this.palette.colors();
    return {
      labels: trend.map((t) => new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })),
      datasets: [
        {
          label: 'Reliability score',
          data: trend.map((t) => t.score),
          borderColor: c.series[2],
          backgroundColor: (ctx: any) => {
            const { chart } = ctx;
            const area = chart.chartArea;
            if (!area) return this.palette.alpha(c.series[2], 0.2);
            const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
            g.addColorStop(0, this.palette.alpha(c.series[2], 0.4));
            g.addColorStop(1, this.palette.alpha(c.series[2], 0.02));
            return g;
          },
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: c.series[2],
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
        },
      ],
    } as ChartData;
  });

  readonly trendOptions = computed<ChartOptions>(() => {
    const scores = (this.data()?.reliability.trend ?? []).map((t) => t.score);
    const lo = scores.length ? Math.max(0, Math.floor(Math.min(...scores) / 10) * 10 - 10) : 0;
    return {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = this.data()?.reliability.trend[ctx.dataIndex];
              return ` Score ${Number(ctx.raw).toFixed(1)} · ${point?.risk_level ?? ''} risk`;
            },
          },
        },
      },
      scales: { y: { beginAtZero: false, min: lo, max: 100 } },
    };
  });

  readonly orderData = computed<ChartData>(() => {
    const series = this.data()?.order_history.series ?? [];
    const c = this.palette.colors();
    return {
      labels: series.map((s) => monthShort(s.period)),
      datasets: [
        {
          type: 'bar',
          label: 'Order value',
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
          label: 'Number of orders',
          data: series.map((s) => s.orders),
          borderColor: c.series[0],
          backgroundColor: c.series[0],
          pointBackgroundColor: c.series[0],
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

  readonly orderOptions: ChartOptions = {
    scales: {
      x: { ticks: { autoSkip: false } },
      y: { ticks: { callback: (v) => money(Number(v)) } },
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { display: false },
        border: { display: false },
        },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => monthLong(this.data()?.order_history.series[items[0]?.dataIndex ?? 0]?.period ?? ''),
          label: (ctx) => (ctx.dataset.yAxisID === 'y1' ? ` ${ctx.formattedValue} orders` : ` ${money(Number(ctx.raw), 'USD', false)}`),
        },
      },
    },
  };

  readonly factorRows = computed(() =>
    (this.data()?.reliability.current.factors ?? []).map((f) => ({
      ...f,
      tone: f.value >= 75 ? 'success' : f.value >= 60 ? 'warn' : 'danger',
    })),
  );

  // ---------------------------------------------------------------- drill-down

  openPeer(event: ChartClick): void {
    const group = this.data()?.vendor_performance.groups[event.index];
    if (group?.vendor_id && group.vendor_id !== this.data()?.vendor.id) {
      this.selectVendor(String(group.vendor_id));
    }
  }

  openContracts(label: string): void {
    void this.router.navigate(['/contracts'], { queryParams: { status: CONTRACT_STATUS[label] ?? label } });
  }

  openMonth(event: ChartClick): void {
    const period = this.data()?.order_history.series[event.index]?.period;
    if (period) void this.router.navigate(['/purchase-orders'], { queryParams: { month: period, vendor: this.data()?.vendor.id } });
  }

  openOrder(id: number): void {
    void this.router.navigate(['/purchase-orders', id]);
  }
}
