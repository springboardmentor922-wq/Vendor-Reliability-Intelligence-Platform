import { Component, computed, input, output } from '@angular/core';

import { Slice, compact } from './chart-types';

/**
 * Donut chart with a centred total and a clickable legend.
 *
 * Used for the distributions that are genuinely parts of a whole - vendors by
 * risk band, orders by status, spend by category. Clicking a segment emits its
 * label so the chart can act as a filter control.
 */
@Component({
  selector: 'app-donut-chart',
  template: `
    <div class="donut-wrap">
      @if (total() === 0) {
        <p class="muted chart-empty">{{ emptyText() }}</p>
      } @else {
        <svg
          viewBox="0 0 180 180"
          class="donut-svg"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          @for (arc of arcs(); track arc.label) {
            <path
              [attr.d]="arc.path"
              [attr.fill]="arc.colour"
              [class.donut-dim]="highlight() && highlight() !== arc.label"
              [class.donut-clickable]="clickable()"
              (click)="sliceClick.emit(arc.label)"
            >
              <title>{{ arc.label }}: {{ arc.value }} ({{ arc.percent }}%)</title>
            </path>
          }

          <circle cx="90" cy="90" r="52" fill="var(--viq-surface)" />

          <text x="90" y="86" text-anchor="middle" class="donut-total">
            {{ centreValue() }}
          </text>
          <text x="90" y="104" text-anchor="middle" class="donut-caption">
            {{ centreLabel() }}
          </text>
        </svg>

        <div class="donut-legend">
          @for (arc of arcs(); track arc.label) {
            <button
              type="button"
              class="legend-row"
              [class.legend-clickable]="clickable()"
              [class.legend-active]="highlight() === arc.label"
              [disabled]="!clickable()"
              (click)="sliceClick.emit(arc.label)"
            >
              <span class="legend-swatch" [style.background]="arc.colour"></span>
              <span class="legend-name">{{ arc.label }}</span>
              <span class="legend-value">{{ arc.value }}</span>
              <span class="legend-pct">{{ arc.percent }}%</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .donut-wrap {
        display: flex;
        align-items: center;
        gap: 18px;
        flex-wrap: wrap;
      }
      .donut-svg {
        width: 160px;
        height: 160px;
        flex: 0 0 auto;
      }
      .donut-clickable {
        cursor: pointer;
      }
      .donut-dim {
        opacity: 0.28;
      }
      .donut-total {
        font-size: 22px;
        font-weight: 700;
        fill: var(--viq-ink);
      }
      .donut-caption {
        font-size: 9px;
        fill: var(--viq-ink-soft);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .donut-legend {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1 1 160px;
        min-width: 160px;
      }
      .legend-row {
        display: grid;
        grid-template-columns: 10px 1fr auto auto;
        align-items: center;
        gap: 8px;
        padding: 3px 5px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        font: inherit;
        color: inherit;
        text-align: left;
      }
      .legend-clickable {
        cursor: pointer;
      }
      .legend-clickable:hover {
        background: var(--viq-ground);
      }
      .legend-active {
        background: var(--viq-info-bg);
      }
      .legend-name {
        font-size: 12px;
        color: var(--viq-ink-soft);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .legend-value {
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .legend-pct {
        font-size: 11px;
        color: var(--viq-ink-soft);
        font-variant-numeric: tabular-nums;
        min-width: 34px;
        text-align: right;
      }
      .chart-empty {
        padding: 24px 0;
        text-align: center;
        width: 100%;
      }
    `,
  ],
})
export class DonutChart {
  readonly data = input.required<Slice[]>();
  readonly centreLabel = input('Total');
  readonly clickable = input(false);
  readonly highlight = input<string | null>(null);
  readonly emptyText = input('Nothing to show.');

  readonly sliceClick = output<string>();

  readonly total = computed(() =>
    this.data().reduce((sum, slice) => sum + slice.value, 0),
  );

  readonly centreValue = computed(() => compact(this.total()));

  readonly arcs = computed(() => {
    const total = this.total();

    if (total === 0) {
      return [];
    }

    const outer = 82;
    const centre = 90;
    let angle = -Math.PI / 2;

    return this.data()
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const sweep = (slice.value / total) * Math.PI * 2;
        const end = angle + sweep;

        const x1 = centre + outer * Math.cos(angle);
        const y1 = centre + outer * Math.sin(angle);
        const x2 = centre + outer * Math.cos(end);
        const y2 = centre + outer * Math.sin(end);

        // A slice larger than a semicircle needs the large-arc flag set.
        const largeArc = sweep > Math.PI ? 1 : 0;

        // A single slice covering the whole circle cannot be drawn as one
        // arc, because the start and end points coincide.
        const path =
          slice.value === total
            ? `M ${centre} ${centre - outer} ` +
              `A ${outer} ${outer} 0 1 1 ${centre - 0.01} ${centre - outer} Z`
            : `M ${centre} ${centre} L ${x1.toFixed(2)} ${y1.toFixed(2)} ` +
              `A ${outer} ${outer} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

        angle = end;

        return {
          label: slice.label,
          value: slice.value,
          colour: slice.colour,
          percent: Math.round((slice.value / total) * 100),
          path,
        };
      });
  });

  readonly ariaLabel = computed(
    () =>
      `Donut chart: ${this.arcs()
        .map((a) => `${a.label} ${a.percent}%`)
        .join(', ')}`,
  );
}
