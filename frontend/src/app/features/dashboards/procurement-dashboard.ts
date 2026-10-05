import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';

import { DashboardsService, ProcurementDashboard as Payload } from '../../core/dashboards.service';
import { ActivityFeed } from '../../shared/viz/activity-feed';
import { Donut } from '../../shared/viz/donut';
import { money, monthShort, monthLong, num, pct } from '../../shared/viz/format';
import { Gauge } from '../../shared/viz/gauge';
import { KpiTile } from '../../shared/viz/kpi-tile';
import { Palette } from '../../shared/viz/palette';
import { ChartClick, ViqChart } from '../../shared/viz/viq-chart';
import { StatusPill } from '../../shared/status-pill';
import { DashboardBase, rangeFilters } from './dashboard-base';

const KPI_STYLE: Record<string, { icon: string; tone: string }> = {
  total_purchase_orders: { icon: 'receipt_long', tone: '#3b82f6' },
  total_procurement_cost: { icon: 'account_balance_wallet', tone: '#f97316' },
  active_vendors: { icon: 'groups', tone: '#10b981' },
  items_procured: { icon: 'inventory_2', tone: '#8b5cf6' },
};

@Component({
  selector: 'app-procurement-dashboard',
  imports: [ActivityFeed, DatePipe, Donut, Gauge, KpiTile, MatIconModule, MatTooltipModule, RouterLink, StatusPill, ViqChart],
  templateUrl: './procurement-dashboard.html',
})
export class ProcurementDashboard extends DashboardBase<Payload> {
  private readonly api = inject(DashboardsService);
  private readonly palette = inject(Palette);
  private readonly router = inject(Router);

  readonly category = signal<string | null>(null);
  readonly categories = signal<string[]>([]);

  readonly Math = Math;
  readonly money = money;
  readonly num = num;
  readonly pct = pct;
  readonly moneyFmt = (v: number) => money(v);

  constructor() {
    super();
    this.api.filterOptions().subscribe({ next: (o) => this.categories.set(o.categories) });
    this.load();
  }

  protected fetch() {
    const r = rangeFilters(this.range());
    return this.api.procurement({ start: r.start, months: r.months, category: this.category() });
  }

  kpiStyle(key: string) {
    return KPI_STYLE[key] ?? { icon: 'insights', tone: '#6366f1' };
  }

  setCategory(value: string | null): void {
    this.category.set(this.category() === value ? null : value || null);
    this.load(true);
  }

  // ---------------------------------------------------------------- charts

  readonly overviewData = computed<ChartData>(() => {
    const d = this.data();
    const c = this.palette.colors();
    const series = d?.procurement_overview.series ?? [];
    return {
      labels: series.map((s) => monthShort(s.period)),
      datasets: [
        {
          type: 'bar',
          label: 'Procurement cost',
          data: series.map((s) => s.cost),
          backgroundColor: c.series[0],
          hoverBackgroundColor: this.palette.alpha(c.series[0], 0.85),
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: 'bottom',
          maxBarThickness: 26,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          label: 'Number of POs',
          data: series.map((s) => s.orders),
          borderColor: c.series[1],
          backgroundColor: c.series[1],
          borderWidth: 2,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: c.series[1],
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
          tension: 0.35,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    } as ChartData;
  });

  readonly overviewOptions = computed<ChartOptions>(() => ({
    scales: {
      x: { ticks: { autoSkip: false } },
      y: {
        ticks: { callback: (v) => money(Number(v)) },
      },
      y1: {
        position: 'right',
        beginAtZero: true,
        grid: { display: false },
        border: { display: false },
        ticks: { maxTicksLimit: 6 },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => monthLong(this.data()?.procurement_overview.series[items[0]?.dataIndex ?? 0]?.period ?? ''),
          label: (ctx) =>
            ctx.dataset.yAxisID === 'y1' ? ` ${ctx.formattedValue} purchase orders` : ` ${money(Number(ctx.raw), 'USD', false)} spent`,
        },
      },
    },
  }));

  readonly radarData = computed<ChartData>(() => {
    const radar = this.data()?.vendor_performance.radar;
    const c = this.palette.colors();
    if (!radar) return { labels: [], datasets: [] };
    const datasets = [];
    if (radar.top_vendor) {
      datasets.push({
        label: `Top vendor · ${radar.top_vendor.vendor_name}`,
        data: radar.top_vendor.values,
        borderColor: c.series[0],
        backgroundColor: this.palette.alpha(c.series[0], 0.22),
        pointBackgroundColor: c.series[0],
        pointBorderColor: c.surface,
        borderWidth: 2,
        pointRadius: 3,
      });
    }
    datasets.push({
      label: 'Average (all approved vendors)',
      data: radar.average,
      borderColor: c.series[1],
      backgroundColor: this.palette.alpha(c.series[1], 0.12),
      pointBackgroundColor: c.series[1],
      pointBorderColor: c.surface,
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 3,
    });
    return { labels: radar.axes.map((a) => (a.includes(' ') ? a.split(' ') : a)), datasets } as ChartData;
  });

  readonly radarOptions: ChartOptions = {
    layout: { padding: 0 },
    scales: { r: { pointLabels: { font: { size: 10, weight: 600 }, padding: 2 } } },
    plugins: {
      legend: { position: 'bottom', align: 'center', labels: { font: { size: 10.5 }, boxWidth: 8, boxHeight: 8, padding: 8 } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)} / 100` } },
    },
  };

  readonly categorySlices = computed(() =>
    (this.data()?.cost_analysis.by_category ?? []).map((c) => ({ label: c.category, value: Math.round(c.spend) })),
  );

  readonly vendorBarData = computed<ChartData>(() => {
    const vendors = this.data()?.cost_analysis.by_vendor ?? [];
    return {
      labels: vendors.map((v) => v.vendor_name),
      datasets: [
        {
          label: 'Spend',
          data: vendors.map((v) => v.spend),
          backgroundColor: vendors.map((v, i) => this.palette.forLabel(v.category, i)),
          borderRadius: 4,
          borderSkipped: 'left',
          maxBarThickness: 18,
        },
      ],
    } as ChartData;
  });

  readonly vendorBarOptions: ChartOptions = {
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ` ${money(Number(ctx.raw), 'USD', false)}` } },
    },
    scales: {
      x: { grid: { display: true }, ticks: { callback: (v) => money(Number(v)), maxTicksLimit: 4 } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  readonly deliveryRows = computed(() => {
    const d = this.data()?.delivery_status;
    if (!d) return [];
    const total = d.breakdown.reduce((s, r) => s + r.value, 0) || 1;
    return d.breakdown.map((r, i) => ({
      ...r,
      color: this.palette.forLabel(r.label, i),
      pct: Math.round((1000 * r.value) / total) / 10,
    }));
  });

  // ---------------------------------------------------------------- drill-down

  openStatus(label: string): void {
    const slice = this.data()?.active_purchase_orders.slices.find((s) => s.label === label);
    void this.router.navigate(['/purchase-orders'], { queryParams: { status: slice?.status ?? label } });
  }

  openRadar(): void {
    const top = this.data()?.vendor_performance.radar.top_vendor;
    if (top) void this.router.navigate(['/vendors', top.vendor_id]);
  }

  openVendorBar(event: ChartClick): void {
    const vendor = this.data()?.cost_analysis.by_vendor[event.index];
    if (vendor) void this.router.navigate(['/vendors', vendor.vendor_id]);
  }

  openMonth(event: ChartClick): void {
    const period = this.data()?.procurement_overview.series[event.index]?.period;
    if (period) void this.router.navigate(['/purchase-orders'], { queryParams: { month: period } });
  }

  openOrder(id: number): void {
    void this.router.navigate(['/purchase-orders', id]);
  }
}
