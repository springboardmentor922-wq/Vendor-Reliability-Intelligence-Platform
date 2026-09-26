import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import {
  AlertService,
  AnalyticsService,
  ReliabilityService,
} from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  AdminAnalytics,
  AnalyticsFilterOptions,
  DelayPrediction,
  ModelInfo,
  ProcurementAnalytics,
  RankingRow,
  RiskSummary,
  VendorDashboardAnalytics,
} from '../../core/models-m3';
import { ToastService } from '../../core/toast.service';
import {
  BarChart,
  DonutChart,
  LineChart,
  PALETTE,
  RISK_COLOURS,
  Series,
  Slice,
  TONE,
  colourFor,
} from '../../shared/charts';
import { StatusPill } from '../../shared/status-pill';

/**
 * The Analytics dashboard.
 *
 * Three views in one screen — Procurement, Vendor and Admin — because the
 * requirement is three dashboards over one shared filter set, and keeping
 * them together means changing a filter carries across all of them.
 *
 * Every filter is sent to the API. Nothing is filtered client-side, so a
 * date range narrows the SQL rather than hiding already-fetched rows.
 */
@Component({
  selector: 'app-analytics-dashboard',
  imports: [
    BarChart,
    DecimalPipe,
    DonutChart,
    FormsModule,
    LineChart,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    RouterLink,
    StatusPill,
  ],
  templateUrl: './analytics-dashboard.html',
})
export class AnalyticsDashboard {
  private readonly analytics = inject(AnalyticsService);
  private readonly reliability = inject(ReliabilityService);
  private readonly alerts = inject(AlertService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly options = signal<AnalyticsFilterOptions | null>(null);

  readonly procurement = signal<ProcurementAnalytics | null>(null);
  readonly vendorView = signal<VendorDashboardAnalytics | null>(null);
  readonly admin = signal<AdminAnalytics | null>(null);
  readonly ranking = signal<RankingRow[]>([]);
  readonly risk = signal<RiskSummary | null>(null);
  readonly predictions = signal<DelayPrediction[]>([]);
  readonly model = signal<ModelInfo | null>(null);

  // ---- filter state ------------------------------------------
  readonly vendorId = signal<number | null>(null);
  readonly category = signal<string | null>(null);
  readonly riskLevel = signal<string | null>(null);
  readonly start = signal<string | null>(null);
  readonly end = signal<string | null>(null);

  readonly isAdmin = computed(() => this.auth.hasRole('Administrator'));
  readonly isVendorUser = computed(() => this.auth.hasRole('Vendor'));
  readonly canRecalculate = computed(() =>
    this.auth.hasRole(
      'Administrator',
      'Procurement Manager',
      'Supply Chain Manager',
    ),
  );

  readonly activeFilterCount = computed(
    () =>
      [this.vendorId(), this.category(), this.riskLevel()].filter(Boolean)
        .length,
  );

  readonly selectedVendorName = computed(() => {
    const id = this.vendorId();

    if (!id) return null;

    return this.options()?.vendors.find((v) => v.id === id)?.name ?? null;
  });

  /**
   * True when the last point on a monthly chart is the current month.
   *
   * That month is only partly elapsed, so its total is genuinely lower than
   * the ones before it. The charts say so rather than letting it read as a
   * collapse in spend or volume.
   */
  readonly lastMonthIsPartial = computed(() => {
    const rows = this.procurement()?.spend_over_time ?? [];

    if (rows.length === 0) return false;

    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return rows[rows.length - 1].period === current;
  });

  // ---- procurement charts ------------------------------------

  readonly spendSeries = computed<Series[]>(() => {
    const rows = this.procurement()?.spend_over_time ?? [];

    return [
      {
        name: 'Committed spend',
        colour: TONE.accent,
        area: true,
        points: rows.map((r) => ({ label: r.period, value: r.spend })),
      },
    ];
  });

  readonly orderVolumeSeries = computed<Series[]>(() => {
    const rows = this.procurement()?.spend_over_time ?? [];

    return [
      {
        name: 'Purchase orders',
        colour: TONE.info,
        area: true,
        points: rows.map((r) => ({ label: r.period, value: r.orders })),
      },
    ];
  });

  readonly orderStatusSlices = computed<Slice[]>(() => {
    const by = this.procurement()?.purchase_orders?.by_status ?? {};

    return Object.entries(by).map(([label, value], index) => ({
      label,
      value,
      colour: colourFor(index),
    }));
  });

  readonly deliverySlices = computed<Slice[]>(() => {
    const d = this.procurement()?.delivery_status;

    if (!d) return [];

    return [
      { label: 'On time', value: d.on_time_deliveries, colour: TONE.success },
      { label: 'Delayed', value: d.delayed_deliveries, colour: TONE.danger },
      { label: 'Pending', value: d.pending_deliveries, colour: TONE.neutral },
    ].filter((s) => s.value > 0);
  });

  readonly spendByCategoryBars = computed(() =>
    (this.procurement()?.cost_analysis.by_category ?? []).map((row) => ({
      label: row.category,
      value: row.spend,
    })),
  );

  readonly spendByVendorBars = computed(() =>
    (this.procurement()?.cost_analysis.by_vendor ?? [])
      .slice(0, 10)
      .map((row) => ({ label: row.vendor_name, value: row.spend })),
  );

  readonly categoryOnTimeBars = computed(() =>
    (this.procurement()?.category_performance ?? []).map((row) => ({
      label: row.category,
      value: row.on_time_rate,
    })),
  );

  readonly budgetVariance = computed(() => {
    const cost = this.procurement()?.cost_analysis;

    if (!cost) return null;

    return {
      budget: cost.budget,
      actual: cost.actual,
      variance: cost.cost_variance,
      pct: cost.cost_variance_pct,
      over: cost.cost_variance > 0,
    };
  });

  // ---- risk / reliability charts -----------------------------

  readonly riskSlices = computed<Slice[]>(() => {
    const by = this.risk()?.by_risk ?? {};

    return ['Low', 'Medium', 'High', 'Critical']
      .filter((level) => by[level])
      .map((level) => ({
        label: level,
        value: by[level],
        colour: RISK_COLOURS[level],
      }));
  });

  readonly reliabilityBars = computed(() =>
    this.ranking()
      .slice(0, 12)
      .map((row) => ({ label: row.vendor_name, value: row.reliability_score })),
  );

  readonly reliabilityColours = computed(() => {
    const map: Record<string, string> = {};

    for (const row of this.ranking()) {
      map[row.vendor_name] = RISK_COLOURS[row.risk_level] ?? TONE.neutral;
    }

    return map;
  });

  readonly highRiskPredictions = computed(() =>
    this.predictions()
      .filter((p) => p.risk_band === 'High' || p.risk_band === 'Critical')
      .slice(0, 10),
  );

  // ---- vendor view charts ------------------------------------

  readonly vendorTrendSeries = computed<Series[]>(() => {
    // Same reasoning as the performance dashboard: a month with nothing
    // delivered yet has no rate, rather than a rate of zero.
    const rows = (this.vendorView()?.trend ?? []).filter((r) => r.delivered > 0);

    return [
      {
        name: 'On-time %',
        colour: TONE.success,
        area: true,
        points: rows.map((r) => ({ label: r.period, value: r.on_time_rate })),
      },
    ];
  });

  readonly vendorReliabilityBars = computed(() => {
    const r = this.vendorView()?.reliability;

    if (!r) return [];

    return [
      { label: 'Delivery', value: r.delivery_score },
      { label: 'Quality', value: r.quality_score },
      { label: 'Communication', value: r.communication_score },
      { label: 'Compliance', value: r.compliance_score },
      { label: 'Purchase history', value: r.purchase_history_score },
      { label: 'Issue resolution', value: r.issue_resolution_score },
    ];
  });

  readonly contractSlices = computed<Slice[]>(() => {
    const by = this.vendorView()?.contract_status?.by_status ?? {};

    return Object.entries(by).map(([label, value], index) => ({
      label,
      value,
      colour: colourFor(index),
    }));
  });

  // ---- admin view charts -------------------------------------

  readonly usersByRoleSlices = computed<Slice[]>(() => {
    const by = this.admin()?.user_management.by_role ?? {};

    return Object.entries(by).map(([label, value], index) => ({
      label,
      value,
      colour: colourFor(index),
    }));
  });

  readonly vendorsByCategorySlices = computed<Slice[]>(() => {
    const by = this.admin()?.vendor_analytics.by_category ?? {};

    return Object.entries(by).map(([label, value], index) => ({
      label,
      value,
      colour: colourFor(index),
    }));
  });

  readonly vendorsByStatusBars = computed(() =>
    Object.entries(this.admin()?.vendor_analytics.by_status ?? {}).map(
      ([label, value]) => ({ label, value }),
    ),
  );

  /** System counters as readable label/value rows. */
  readonly systemRows = computed(() =>
    Object.entries(this.admin()?.system ?? {}).map(([key, value]) => ({
      key,
      label: key.split('_').join(' ').replace(/^./, (c) => c.toUpperCase()),
      value,
    })),
  );

  constructor() {
    const scoped = this.auth.user()?.vendor_id ?? null;

    if (scoped) {
      this.vendorId.set(scoped);
    }

    this.analytics.filterOptions().subscribe({
      next: (options) => {
        this.options.set(options);

        if (!this.start()) {
          this.start.set(options.default_start);
          this.end.set(options.default_end);
        }
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not load the filter options.'),
    });

    this.reliability.model().subscribe({
      next: (info) => this.model.set(info),
      error: () => this.model.set(null),
    });

    effect(() => {
      this.vendorId();
      this.category();
      this.riskLevel();
      this.start();
      this.end();

      this.load();
    });
  }

  private currentFilters() {
    return {
      vendor_id: this.vendorId(),
      category: this.category(),
      risk_level: this.riskLevel(),
      start: this.start(),
      end: this.end(),
    };
  }

  load(): void {
    this.loading.set(true);

    const filters = this.currentFilters();

    this.analytics.procurement(filters).subscribe({
      next: (data) => {
        this.procurement.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the procurement analytics.');
      },
    });

    this.analytics.vendor(filters).subscribe({
      next: (data) => this.vendorView.set(data),
      error: () => this.vendorView.set(null),
    });

    this.reliability
      .ranking({ category: this.category(), risk_level: this.riskLevel() })
      .subscribe({
        next: (rows) => this.ranking.set(rows),
        error: () => this.ranking.set([]),
      });

    this.reliability.risk({ category: this.category() }).subscribe({
      next: (data) => this.risk.set(data),
      error: () => this.risk.set(null),
    });

    this.reliability
      .predictions({ vendor_id: this.vendorId(), limit: 100 })
      .subscribe({
        next: (rows) => this.predictions.set(rows),
        error: () => this.predictions.set([]),
      });

    if (this.isAdmin()) {
      this.analytics.admin(filters).subscribe({
        next: (data) => this.admin.set(data),
        error: () => this.admin.set(null),
      });
    }
  }

  // ---- filter interactions -----------------------------------

  selectRisk(level: string): void {
    // Clicking the active band clears it, so the donut toggles.
    this.riskLevel.set(this.riskLevel() === level ? null : level);
  }

  selectCategory(category: string): void {
    this.category.set(this.category() === category ? null : category);
  }

  selectVendorByName(name: string): void {
    const match = this.options()?.vendors.find((v) => v.name === name);

    this.vendorId.set(match ? match.id : null);
  }

  resetFilters(): void {
    if (!this.isVendorUser()) {
      this.vendorId.set(null);
    }

    this.category.set(null);
    this.riskLevel.set(null);

    const options = this.options();

    if (options) {
      this.start.set(options.default_start);
      this.end.set(options.default_end);
    }
  }

  recalculate(): void {
    this.toast.info('Recalculating reliability scores…');

    this.reliability.recalculate().subscribe({
      next: (result) => {
        this.toast.success(
          `Scored ${result.vendors_scored} vendor(s), ranked ${result.vendors_ranked}.`,
        );
        this.load();
      },
      error: (error) =>
        this.toast.fromError(error, 'Could not recalculate the scores.'),
    });
  }

  runSweep(): void {
    this.toast.info('Re-deriving alerts from the current data…');

    this.alerts.runSweep().subscribe({
      next: (result) =>
        this.toast.success(
          `${result.total} alert(s) raised or refreshed ` +
            `(${result.delivery_delays} delivery, ${result.contract_expiry} contract, ` +
            `${result.predicted_delays} predicted).`,
        ),
      error: (error) =>
        this.toast.fromError(error, 'Could not run the alert sweep.'),
    });
  }

  trendClass(trend: string | null | undefined): string {
    if (trend === 'Improving') return 'trend-up';
    if (trend === 'Declining') return 'trend-down';
    return '';
  }

  trendIcon(trend: string | null | undefined): string {
    if (trend === 'Improving') return 'trending_up';
    if (trend === 'Declining') return 'trending_down';
    return 'trending_flat';
  }

  riskColour(level: string): string {
    return RISK_COLOURS[level] ?? TONE.neutral;
  }
}
