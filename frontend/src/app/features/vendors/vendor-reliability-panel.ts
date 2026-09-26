import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ReliabilityService } from '../../core/api.service';
import {
  ReliabilityHistoryPoint,
  VendorReliability,
} from '../../core/models-m3';
import {
  LineChart,
  RISK_COLOURS,
  RadarChart,
  ScoreGauge,
  Series,
  TONE,
} from '../../shared/charts';
import { StatusPill } from '../../shared/status-pill';

/**
 * The reliability panel embedded in the vendor detail screen.
 *
 * Answers the question a buyer opens a vendor record to ask: how reliable is
 * this supplier, why, is it getting better or worse, and what should I do
 * about it. Self-contained so the vendor screen only has to pass an id.
 */
@Component({
  selector: 'app-vendor-reliability-panel',
  imports: [
    DecimalPipe,
    LineChart,
    MatIconModule,
    MatProgressSpinnerModule,
    RadarChart,
    ScoreGauge,
    StatusPill,
  ],
  template: `
    @if (loading()) {
      <div class="loading-state"><mat-spinner diameter="32" /></div>
    } @else if (score(); as s) {
      <div class="reliability-panel">
        <!-- headline -->
        <div class="reliability-headline">
          <app-score-gauge
            [value]="s.overall_score"
            [band]="s.risk_level"
            caption="Reliability"
          />

          <div class="reliability-meta">
            <div class="inline-pills">
              <app-status-pill [status]="s.risk_level" />
              @if (s.provisional) {
                <span class="pill pill-neutral">Provisional</span>
              }
              <span class="chart-sub" [class]="trendClass(s.trend)">
                <mat-icon class="trend-icon">{{ trendIcon(s.trend) }}</mat-icon>
                {{ s.trend }}
              </span>
            </div>

            <div class="metric-row">
              <span>Rank</span>
              <span class="metric-value">
                @if (s.rank_position) {
                  {{ s.rank_position }} of {{ s.ranked_out_of }}
                } @else {
                  Not ranked
                }
              </span>
            </div>
            <div class="metric-row">
              <span>Orders considered</span>
              <span class="metric-value">{{ s.orders_considered | number }}</span>
            </div>
            <div class="metric-row">
              <span>On time / delayed</span>
              <span class="metric-value">
                {{ s.on_time_deliveries | number }} /
                {{ s.delayed_deliveries | number }}
              </span>
            </div>
            <div class="metric-row">
              <span>Average delay</span>
              <span class="metric-value">{{ s.avg_delay_days }} day(s)</span>
            </div>
            @if (s.predicted_delay_risk !== null) {
              <div class="metric-row">
                <span>Predicted delay risk</span>
                <span class="metric-value">
                  {{ s.predicted_delay_risk * 100 | number: '1.0-1' }}%
                </span>
              </div>
            }
          </div>
        </div>

        <!-- factor profile -->
        <div class="reliability-factors">
          <div>
            <h3 class="card-title">Factor profile</h3>
            <app-radar-chart [data]="radar()" [colour]="riskColour()" />
          </div>

          <div class="factor-list">
            @for (factor of factorRows(); track factor.key) {
              <div class="factor-row">
                <span class="factor-name">
                  {{ factor.label }}
                  <span class="factor-weight">· weight {{ factor.weight }}%</span>
                </span>
                <span class="factor-score">
                  @if (factor.scored) {
                    {{ factor.value | number: '1.0-1' }}
                  } @else {
                    <span class="muted">n/a</span>
                  }
                </span>
                <span class="factor-track">
                  <span
                    class="factor-fill"
                    [style.width.%]="factor.value"
                    [style.background]="factor.colour"
                  ></span>
                </span>
              </div>
            }
          </div>
        </div>

        <!-- history -->
        @if (history().length > 1) {
          <div>
            <h3 class="card-title">Reliability over time</h3>
            <app-line-chart
              [series]="historySeries()"
              [formatMonths]="true"
              [startAtZero]="false"
              emptyText="No score history recorded yet."
            />
          </div>
        }

        <!-- recommendation -->
        <div
          class="recommendation"
          [class.recommendation-good]="s.risk_level === 'Low'"
          [class.recommendation-warn]="s.risk_level === 'High'"
          [class.recommendation-critical]="s.risk_level === 'Critical'"
        >
          <strong>Procurement recommendation</strong><br />
          {{ s.recommendation }}
        </div>
      </div>
    } @else {
      <p class="muted">
        No reliability score is available for this vendor yet. Scores are
        calculated once the vendor has trading history.
      </p>
    }
  `,
  styles: [
    `
      .reliability-panel {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .reliability-headline {
        display: grid;
        grid-template-columns: minmax(180px, 240px) 1fr;
        gap: 20px;
        align-items: center;
      }
      .reliability-factors {
        display: grid;
        grid-template-columns: minmax(220px, 300px) 1fr;
        gap: 20px;
        align-items: center;
      }
      .trend-icon {
        font-size: 15px;
        height: 15px;
        width: 15px;
        vertical-align: -2px;
      }
      @media (max-width: 780px) {
        .reliability-headline,
        .reliability-factors {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class VendorReliabilityPanel {
  private readonly reliability = inject(ReliabilityService);

  readonly vendorId = input.required<number>();

  readonly loading = signal(true);
  readonly score = signal<VendorReliability | null>(null);
  readonly history = signal<ReliabilityHistoryPoint[]>([]);

  readonly riskColour = computed(
    () => RISK_COLOURS[this.score()?.risk_level ?? 'Medium'] ?? TONE.neutral,
  );

  readonly radar = computed(() => {
    const factors = this.score()?.factors;

    if (!factors) return [];

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

    if (!score) return [];

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

  readonly historySeries = computed<Series[]>(() => {
    const rows = this.history();

    return [
      {
        name: 'Overall',
        colour: TONE.accent,
        area: true,
        points: rows.map((r) => ({
          label: r.score_date,
          value: r.overall_score,
        })),
      },
      {
        name: 'Delivery',
        colour: TONE.success,
        points: rows.map((r) => ({
          label: r.score_date,
          value: r.delivery_score,
        })),
      },
    ];
  });

  constructor() {
    // The vendor id arrives as a route-bound input, so the load is driven by
    // an effect rather than the constructor.
    effect(() => {
      const id = this.vendorId();

      if (!id) return;

      this.loading.set(true);

      this.reliability.forVendor(id).subscribe({
        next: (score) => {
          this.score.set(score);
          this.loading.set(false);
        },
        error: () => {
          this.score.set(null);
          this.loading.set(false);
        },
      });

      this.reliability.history(id).subscribe({
        next: (rows) => this.history.set(rows),
        error: () => this.history.set([]),
      });
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

  private scoreColour(value: number): string {
    if (value >= 80) return TONE.success;
    if (value >= 65) return TONE.warn;
    if (value >= 50) return '#d97706';
    return TONE.danger;
  }
}
