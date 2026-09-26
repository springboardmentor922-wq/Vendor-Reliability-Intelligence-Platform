import { Component, computed, input, output } from '@angular/core';

import { Point, TONE, compact, monthLabel, niceScale } from './chart-types';

/**
 * Horizontal bar chart with value labels.
 *
 * Horizontal rather than vertical because the categories here are vendor and
 * commodity names, which do not fit under a vertical axis. Bars are
 * clickable so a chart can drive a drill-down.
 */
@Component({
  selector: 'app-bar-chart',
  template: `
    <div class="chart">
      @if (data().length === 0) {
        <p class="muted chart-empty">{{ emptyText() }}</p>
      } @else {
        <div class="hbars">
          @for (bar of bars(); track bar.label) {
            <button
              type="button"
              class="hbar-row"
              [class.hbar-clickable]="clickable()"
              [class.hbar-active]="bar.label === highlight()"
              [disabled]="!clickable()"
              (click)="barClick.emit(bar.label)"
            >
              <span class="hbar-label" [title]="bar.label">{{ bar.label }}</span>
              <span class="hbar-track">
                <span
                  class="hbar-fill"
                  [style.width.%]="bar.percent"
                  [style.background]="bar.colour"
                ></span>
              </span>
              <span class="hbar-value">{{ bar.text }}</span>
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart-empty {
        padding: 24px 0;
        text-align: center;
      }
      .hbars {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .hbar-row {
        display: grid;
        grid-template-columns: minmax(96px, 34%) 1fr auto;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 3px 4px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        font: inherit;
        text-align: left;
        color: inherit;
      }
      .hbar-clickable {
        cursor: pointer;
      }
      .hbar-clickable:hover {
        background: var(--viq-ground);
      }
      .hbar-active {
        background: var(--viq-info-bg);
      }
      .hbar-label {
        font-size: 12px;
        color: var(--viq-ink-soft);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hbar-track {
        height: 9px;
        border-radius: 999px;
        background: var(--viq-ground);
        overflow: hidden;
      }
      .hbar-fill {
        display: block;
        height: 100%;
        border-radius: 999px;
        transition: width 0.25s ease;
      }
      .hbar-value {
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        min-width: 62px;
        text-align: right;
      }
    `,
  ],
})
export class BarChart {
  readonly data = input.required<Point[]>();
  readonly colour = input(TONE.accent);
  /** Per-bar colour override, keyed by label — used for risk bands. */
  readonly colourMap = input<Record<string, string> | null>(null);
  readonly valuePrefix = input('');
  readonly valueSuffix = input('');
  readonly formatMonths = input(false);
  readonly clickable = input(false);
  readonly highlight = input<string | null>(null);
  readonly emptyText = input('No data for the selected filters.');

  readonly barClick = output<string>();

  readonly bars = computed(() => {
    const rows = this.data();
    const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
    const map = this.colourMap();

    return rows.map((row) => ({
      label: this.formatMonths() ? monthLabel(row.label) : row.label,
      percent: Math.max((Math.abs(row.value) / max) * 100, row.value ? 2 : 0),
      colour: map?.[row.label] ?? this.colour(),
      text: `${this.valuePrefix()}${compact(row.value)}${this.valueSuffix()}`,
    }));
  });
}
