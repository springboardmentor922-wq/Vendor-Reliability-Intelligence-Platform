import { Component, computed, inject, input, output } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';

import { SliceDatum } from '../../core/dashboards.service';
import { CountUp } from './count-up';
import { num } from './format';
import { Palette } from './palette';
import { ChartClick, ViqChart } from './viq-chart';

/**
 * Doughnut with a centred total and a value/percent legend.
 * Clicking a segment or legend row emits its label (drill-down / filter).
 */
@Component({
  selector: 'viq-donut',
  imports: [ViqChart, CountUp],
  template: `
    @if (total() === 0) {
      <div class="empty-note">{{ emptyText() }}</div>
    } @else {
      <div class="donut" [class.stacked]="stacked()">
        <div class="donut-canvas">
          <viq-chart type="doughnut" [data]="chartData()" [options]="options()" [height]="size()" [ariaLabel]="ariaLabel()"
                     (pointClick)="onClick($event)">
            <div class="donut-center">
              <div class="donut-total" [viqCountUp]="centerValue() ?? total()" [format]="valueFormat()"></div>
              <div class="donut-caption">{{ centerLabel() }}</div>
            </div>
          </viq-chart>
        </div>
        <div class="donut-legend">
          @for (s of legend(); track s.label) {
            <button type="button" class="lg-row" [class.active]="highlight() === s.label" (click)="sliceClick.emit(s.label)">
              <span class="lg-swatch" [style.background]="s.color"></span>
              <span class="lg-name">{{ s.label }}</span>
              <span class="lg-value">{{ fmtValue(s.value) }}</span>
              <span class="lg-pct">{{ s.pct }}%</span>
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .donut { display: grid; grid-template-columns: minmax(130px, 170px) 1fr; gap: 14px; align-items: center; }
      .donut.stacked { grid-template-columns: 1fr; }
      .donut-canvas { position: relative; }
      .donut-center {
        position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none;
      }
      .donut-total { font: 800 22px/1 'Plus Jakarta Sans', 'Inter', sans-serif; letter-spacing: -.5px; }
      .donut-caption { margin-top: 4px; font-size: 10.5px; color: var(--viq-ink-soft); text-transform: uppercase; letter-spacing: .06em; }
      .donut-legend { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .lg-row {
        display: grid; grid-template-columns: 10px 1fr auto 40px; gap: 8px; align-items: center;
        padding: 5px 7px; border: 0; border-radius: 8px; background: transparent; color: inherit;
        font: inherit; text-align: left; cursor: pointer; transition: background .2s ease, transform .2s ease;
      }
      .lg-row:hover { background: var(--viq-hover); transform: translateX(2px); }
      .lg-row.active { background: var(--viq-accent-soft); }
      .lg-swatch { width: 10px; height: 10px; border-radius: 3px; }
      .lg-name { font-size: 12px; color: var(--viq-ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .lg-value { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .lg-pct { font-size: 11px; color: var(--viq-ink-muted); text-align: right; font-variant-numeric: tabular-nums; }
    `,
  ],
})
export class Donut {
  private readonly palette = inject(Palette);

  readonly slices = input.required<SliceDatum[]>();
  readonly centerLabel = input('Total');
  readonly centerValue = input<number | null>(null);
  readonly highlight = input<string | null>(null);
  readonly emptyText = input('No data for this selection.');
  readonly colorMode = input<'category' | 'status'>('category');
  readonly size = input(170);
  readonly stacked = input(false);
  readonly valueFormat = input<(v: number) => string>((v) => num(v));

  readonly sliceClick = output<string>();

  readonly fmt = (v: number) => num(Math.round(v));

  readonly visible = computed(() => this.slices().filter((s) => s.value > 0));
  readonly total = computed(() => this.visible().reduce((sum, s) => sum + s.value, 0));

  readonly legend = computed(() => {
    const total = this.total() || 1;
    return this.visible().map((s, i) => ({
      ...s,
      color: this.colorFor(s.label, i),
      pct: Math.round((1000 * s.value) / total) / 10,
    }));
  });

  readonly chartData = computed<ChartData>(() => {
    const surface = this.palette.colors().surface;
    const items = this.legend();
    return {
      labels: items.map((s) => s.label),
      datasets: [
        {
          data: items.map((s) => s.value),
          backgroundColor: items.map((s) => s.color),
          hoverBackgroundColor: items.map((s) => s.color),
          borderColor: surface,
          borderWidth: 2,
          borderRadius: 4,
          hoverOffset: 8,
        },
      ],
    };
  });

  readonly options = computed<ChartOptions>(() => ({
    cutout: '68%',
    layout: { padding: 6 },
    animation: { animateRotate: true, animateScale: true, duration: 1000 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total = this.total() || 1;
            const v = Number(ctx.raw);
            return ` ${ctx.label}: ${this.valueFormat()(v)} (${((100 * v) / total).toFixed(1)}%)`;
          },
        },
      },
    },
  }));

  readonly ariaLabel = computed(() =>
    `Doughnut chart: ${this.legend().map((s) => `${s.label} ${s.pct}%`).join(', ')}`,
  );

  fmtValue(v: number): string {
    return this.valueFormat()(v);
  }

  onClick(event: ChartClick): void {
    this.sliceClick.emit(event.label);
  }

  private colorFor(label: string, index: number): string {
    return this.colorMode() === 'status' ? this.palette.status(label) : this.palette.forLabel(label, index);
  }
}
