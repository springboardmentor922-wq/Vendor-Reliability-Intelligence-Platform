import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import {
  AnalyticsService,
  ReliabilityService,
  VendorPerformanceService,
} from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  AnalyticsFilterOptions,
  PerformanceMetrics,
  PerformanceSummaryRow,
  PerformanceTrendPoint,
  VendorReliability,
} from '../../core/models-m3';
import { ToastService } from '../../core/toast.service';
import {
  BarChart,
  LineChart,
  RadarChart,
  RISK_COLOURS,
  ScoreGauge,
  Series,
  TONE,
} from '../../shared/charts';
import { StatusPill } from '../../shared/status-pill';

/**
 * Vendor Performance dashboard.
 *
 * Selecting a vendor or a date range re-queries the backend rather than
 * filtering an already-loaded array, so the numbers always reflect the
 * database under exactly the filters shown.
 */
@Component({
  selector: 'app-performance-dashboard',
  imports: [
    BarChart,
    DecimalPipe,
    FormsModule,
    LineChart,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    RadarChart,
    RouterLink,
    ScoreGauge,
    StatusPill,
  ],
  templateUrl: './performance-dashboard.html',
})
export class PerformanceDashboard {
  private readonly performance = inject(VendorPerformanceService);
  private readonly reliability = inject(ReliabilityService);
  private readonly analytics = inject(AnalyticsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly options = signal<AnalyticsFilterOptions | null>(null);
  readonly metrics = signal<PerformanceMetrics | null>(null);
  readonly trend = signal<PerformanceTrendPoint[]>([]);
  readonly summary = signal<PerformanceSummaryRow[]>([]);
  readonly score = signal<VendorReliability | null>(null);

  // ---- filter state ------------------------------------------
  readonly vendorId = signal<number | null>(null);
  readonly category = signal<string | null>(null);
  readonly start = signal<string | null>(null);
  readonly end = signal<string | null>(null);
  readonly months = signal(12);

  readonly isVendorUser = computed(() => this.auth.hasRole('Vendor'));

  readonly selectedVendorName = computed(() => {
    const id = this.vendorId();

    if (!id) {
      return 'All vendors';
    }

    return (
      this.options()?.vendors.find((v) => v.id === id)?.name ?? 'Selected vendor'
    );
  });

  // ---- derived chart data ------------------------------------

  readonly deliveryTrend = computed<Series[]>(() => {
    // Months where nothing has been delivered yet — typically the current
    // month, whose orders are still inside their lead time — have no on-time
    // rate to report. Plotting them as 0% would read as a collapse in
    // performance rather than an absence of data.
    const rows = this.trend().filter((r) => r.delivered > 0);

    return [
      {
        name: 'On-time %',
        colour: TONE.success,
        area: true,
        points: rows.map((r) => ({ label: r.period, value: r.on_time_rate })),
      },
      {
        name: 'Avg delay (days)',
        colour: TONE.danger,
        points: rows.map((r) => ({
          // Delay is a handful of days against a 0-100 axis, so it is scaled
          // up to stay visible. The readout shows the real figure.
          label: r.period,
          value: Number((r.avg_delay_days * 10).toFixed(2)),
        })),
      },
    ];
  });

  readonly volumeTrend = computed<Series[]>(() => {
    const rows = this.trend().filter((r) => r.delivered > 0);

    return [
      {
        name: 'On time',
        colour: TONE.success,
        points: rows.map((r) => ({ label: r.period, value: r.on_time })),
      },
      {
        name: 'Delayed',
        colour: TONE.danger,
        points: rows.map((r) => ({ label: r.period, value: r.delayed })),
      },
    ];
  });

  readonly qualityTrend = computed<Series[]>(() => {
    const rows = this.trend().filter((r) => r.quality_rating > 0);

    return [
      {
        name: 'Quality rating',
        colour: TONE.accent,
        area: true,
        points: rows.map((r) => ({ label: r.period, value: r.quality_rating })),
      },
    ];
  });

  readonly factorRadar = computed(() => {
    const factors = this.score()?.factors;

    if (!factors) {
      return [];
    }

    return [
      { label: 'Delivery History', value: factors.delivery ?? 0 },
      { label: 'Product Quality', value: factors.quality ?? 0 },
      { label: 'Communication Efficiency', value: factors.communication ?? 0 },
      { label: 'Contract Compliance', value: factors.compliance ?? 0 },
      { label: 'Purchase History', value: factors.purchase_history ?? 0 },
      { label: 'Issue Resolution', value: factors.issue_resolution ?? 0 },
    ];
  });

  readonly factorRows = computed(() => {
    const score = this.score();

    if (!score) {
      return [];
    }

    const labels: Record<string, string> = {
      delivery: 'Delivery History',
      quality: 'Product Quality',
      communication: 'Communication Efficiency',
      compliance: 'Contract Compliance',
      purchase_history: 'Purchase History',
      issue_resolution: 'Issue Resolution',
    };

    return Object.entries(score.factors).map(([key, value]) => ({
      key,
      label: labels[key] ?? key,
      value: value ?? 0,
      scored: value !== null,
      weight: Math.round((score.weights[key] ?? 0) * 100),
      colour: this.scoreColour(value ?? 0),
    }));
  });

  readonly rankingBars = computed(() =>
    this.summary()
      .slice(0, 12)
      .map((row) => ({ label: row.vendor_name, value: row.on_time_rate })),
  );

  readonly rankingColours = computed(() => {
    const map: Record<string, string> = {};

    for (const row of this.summary()) {
      map[row.vendor_name] =
        row.on_time_rate >= 85
          ? TONE.success
          : row.on_time_rate >= 70
            ? TONE.warn
            : TONE.danger;
    }

    return map;
  });

  readonly riskColour = computed(
    () => RISK_COLOURS[this.score()?.risk_level ?? 'Medium'] ?? TONE.neutral,
  );

  constructor() {
    // A supplier login is pinned to its own vendor, so the picker is hidden
    // and the id comes from the session instead.
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

    // Any filter change re-queries. `effect` keeps that wiring in one place
    // rather than repeating a reload call on every control.
    effect(() => {
      // Touch each signal so the effect re-runs when any of them changes.
      this.vendorId();
      this.category();
      this.start();
      this.end();
      this.months();

      this.load();
    });
  }

  load(): void {
    this.loading.set(true);

    const filters = {
      vendor_id: this.vendorId(),
      category: this.category(),
      start: this.start(),
      end: this.end(),
    };

    this.performance.metrics(filters).subscribe({
      next: (metrics) => {
        this.metrics.set(metrics);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.toast.fromError(error, 'Could not load the performance metrics.');
      },
    });

    this.performance
      .trend({ ...filters, months: this.months() })
      .subscribe({
        next: (rows) => this.trend.set(rows),
        error: () => this.trend.set([]),
      });

    this.performance
      .summary({ category: this.category(), start: this.start(), end: this.end() })
      .subscribe({
        next: (rows) => this.summary.set(rows),
        error: () => this.summary.set([]),
      });

    const vendorId = this.vendorId();

    if (vendorId) {
      this.reliability.forVendor(vendorId).subscribe({
        next: (score) => this.score.set(score),
        error: () => this.score.set(null),
      });
    } else {
      this.score.set(null);
    }
  }

  selectVendor(vendorId: number | null): void {
    this.vendorId.set(vendorId);
  }

  onVendorBarClick(vendorName: string): void {
    const match = this.summary().find((row) => row.vendor_name === vendorName);

    if (match) {
      this.vendorId.set(match.vendor_id);
    }
  }

  resetFilters(): void {
    if (!this.isVendorUser()) {
      this.vendorId.set(null);
    }

    this.category.set(null);

    const options = this.options();

    if (options) {
      this.start.set(options.default_start);
      this.end.set(options.default_end);
    }
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

  private scoreColour(value: number): string {
    if (value >= 80) return TONE.success;
    if (value >= 65) return TONE.warn;
    if (value >= 50) return '#d97706';
    return TONE.danger;
  }
}
