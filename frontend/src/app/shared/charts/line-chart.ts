import { Component, computed, input, signal } from '@angular/core';

import {
  Series,
  compact,
  monthLabel,
  niceScale,
} from './chart-types';

interface PlottedPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

interface PlottedSeries {
  name: string;
  colour: string;
  dashed: boolean;
  area: boolean;
  path: string;
  areaPath: string;
  points: PlottedPoint[];
}

/**
 * Multi-series line chart with an optional filled area and a hover readout.
 *
 * Used for delivery trends, spend over time and reliability history. Hovering
 * a column highlights that period across every series at once, which is what
 * makes comparing two lines at the same date possible.
 */
@Component({
  selector: 'app-line-chart',
  template: `
    <div class="chart">
      @if (!hasData()) {
        <p class="muted chart-empty">{{ emptyText() }}</p>
      } @else {
        @if (showLegend() && series().length > 1) {
          <div class="chart-legend">
            @for (item of series(); track item.name) {
              <span class="legend-item">
                <span
                  class="legend-swatch"
                  [style.background]="item.colour"
                ></span>
                {{ item.name }}
              </span>
            }
          </div>
        }

        <svg
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          class="chart-svg"
          role="img"
          [attr.aria-label]="ariaLabel()"
          (mouseleave)="active.set(null)"
        >
          <!-- horizontal grid + y axis -->
          @for (tick of yTicks(); track tick.value) {
            <line
              [attr.x1]="padLeft"
              [attr.x2]="width - padRight"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
              class="chart-grid"
            />
            <text
              [attr.x]="padLeft - 8"
              [attr.y]="tick.y + 4"
              class="chart-axis"
              text-anchor="end"
            >
              {{ tick.text }}
            </text>
          }

          <!-- x axis labels, thinned so they never collide -->
          @for (label of xLabels(); track label.x) {
            <text
              [attr.x]="label.x"
              [attr.y]="height - padBottom + 18"
              class="chart-axis"
              text-anchor="middle"
            >
              {{ label.text }}
            </text>
          }

          <!-- series -->
          @for (item of plotted(); track item.name) {
            @if (item.area) {
              <path [attr.d]="item.areaPath" [attr.fill]="item.colour" opacity="0.10" />
            }
            <path
              [attr.d]="item.path"
              [attr.stroke]="item.colour"
              [attr.stroke-dasharray]="item.dashed ? '5 4' : null"
              fill="none"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          }

          <!-- active period marker -->
          @if (active() !== null) {
            <line
              [attr.x1]="markerX()"
              [attr.x2]="markerX()"
              [attr.y1]="padTop"
              [attr.y2]="height - padBottom"
              class="chart-marker"
            />
            @for (item of plotted(); track item.name) {
              @if (item.points[active()!]; as point) {
                <circle
                  [attr.cx]="point.x"
                  [attr.cy]="point.y"
                  r="4"
                  [attr.fill]="item.colour"
                  stroke="#fff"
                  stroke-width="1.5"
                />
              }
            }
          }

          <!-- invisible hover columns -->
          @for (slot of hoverSlots(); track slot.index) {
            <rect
              [attr.x]="slot.x"
              [attr.y]="padTop"
              [attr.width]="slot.width"
              [attr.height]="height - padTop - padBottom"
              fill="transparent"
              (mouseenter)="active.set(slot.index)"
            />
          }
        </svg>

        <div class="chart-readout" [class.chart-readout-empty]="active() === null">
          @if (active() !== null) {
            <strong>{{ activeLabel() }}</strong>
            @for (entry of activeValues(); track entry.name) {
              <span class="readout-item">
                <span class="legend-swatch" [style.background]="entry.colour"></span>
                {{ entry.name }}: <strong>{{ entry.text }}</strong>
              </span>
            }
          } @else {
            <span>Hover the chart for exact values</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart {
        width: 100%;
      }
      .chart-svg {
        width: 100%;
        height: auto;
        display: block;
        overflow: visible;
      }
      .chart-empty {
        padding: 28px 0;
        text-align: center;
      }
    `,
  ],
})
export class LineChart {
  readonly series = input.required<Series[]>();
  readonly valueSuffix = input('');
  readonly valuePrefix = input('');
  readonly showLegend = input(true);
  readonly formatMonths = input(false);
  readonly emptyText = input('No data for the selected filters.');
  readonly startAtZero = input(true);

  readonly width = 720;
  readonly height = 260;
  readonly padLeft = 48;
  readonly padRight = 12;
  readonly padTop = 12;
  readonly padBottom = 30;

  readonly active = signal<number | null>(null);

  readonly hasData = computed(() =>
    this.series().some((s) => s.points.length > 0),
  );

  readonly labels = computed(() => {
    const longest = this.series().reduce(
      (best, s) => (s.points.length > best.length ? s.points : best),
      [] as Series['points'],
    );

    return longest.map((p) => p.label);
  });

  private readonly bounds = computed(() => {
    const values = this.series().flatMap((s) => s.points.map((p) => p.value));

    if (values.length === 0) {
      return niceScale(0, 1);
    }

    const min = this.startAtZero() ? 0 : Math.min(...values);

    return niceScale(min, Math.max(...values));
  });

  readonly yTicks = computed(() => {
    const { min, max, ticks } = this.bounds();
    const span = max - min || 1;

    return ticks.map((value) => ({
      value,
      text: compact(value),
      y:
        this.height -
        this.padBottom -
        ((value - min) / span) * (this.height - this.padTop - this.padBottom),
    }));
  });

  private readonly step = computed(() => {
    const count = this.labels().length;
    const usable = this.width - this.padLeft - this.padRight;

    return count > 1 ? usable / (count - 1) : usable;
  });

  readonly plotted = computed<PlottedSeries[]>(() => {
    const { min, max } = this.bounds();
    const span = max - min || 1;
    const step = this.step();
    const count = this.labels().length;

    const toY = (value: number) =>
      this.height -
      this.padBottom -
      ((value - min) / span) * (this.height - this.padTop - this.padBottom);

    return this.series().map((item) => {
      const points: PlottedPoint[] = item.points.map((point, index) => ({
        x: this.padLeft + (count > 1 ? index * step : step / 2),
        y: toY(point.value),
        value: point.value,
        label: point.label,
      }));

      const path = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ');

      const baseline = this.height - this.padBottom;
      const areaPath =
        points.length > 0
          ? `${path} L${points[points.length - 1].x.toFixed(1)},${baseline} ` +
            `L${points[0].x.toFixed(1)},${baseline} Z`
          : '';

      return {
        name: item.name,
        colour: item.colour,
        dashed: !!item.dashed,
        area: !!item.area,
        path,
        areaPath,
        points,
      };
    });
  });

  readonly xLabels = computed(() => {
    const labels = this.labels();
    const step = this.step();
    const count = labels.length;

    // Show at most eight labels so they never overlap.
    const stride = Math.max(1, Math.ceil(count / 8));

    return labels
      .map((label, index) => ({ label, index }))
      .filter(({ index }) => index % stride === 0 || index === count - 1)
      .map(({ label, index }) => ({
        x: this.padLeft + (count > 1 ? index * step : step / 2),
        text: this.formatMonths() ? monthLabel(label) : label,
      }));
  });

  readonly hoverSlots = computed(() => {
    const count = this.labels().length;
    const step = this.step();

    return Array.from({ length: count }, (_, index) => ({
      index,
      x: this.padLeft + index * step - step / 2,
      width: step,
    }));
  });

  readonly markerX = computed(() => {
    const index = this.active();

    if (index === null) {
      return 0;
    }

    return this.padLeft + index * this.step();
  });

  readonly activeLabel = computed(() => {
    const index = this.active();
    const labels = this.labels();

    if (index === null || !labels[index]) {
      return '';
    }

    return this.formatMonths() ? monthLabel(labels[index]) : labels[index];
  });

  readonly activeValues = computed(() => {
    const index = this.active();

    if (index === null) {
      return [];
    }

    return this.plotted()
      .filter((s) => s.points[index] !== undefined)
      .map((s) => ({
        name: s.name,
        colour: s.colour,
        text: `${this.valuePrefix()}${compact(s.points[index].value)}${this.valueSuffix()}`,
      }));
  });

  readonly ariaLabel = computed(() => {
    const names = this.series().map((s) => s.name).join(', ');

    return `Line chart showing ${names} across ${this.labels().length} periods`;
  });
}
