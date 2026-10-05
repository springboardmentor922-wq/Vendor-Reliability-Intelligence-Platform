import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { Kpi } from '../../core/dashboards.service';
import { CountUp } from './count-up';
import { money, num } from './format';

/** Headline number with icon, animated count-up and period-over-period change. */
@Component({
  selector: 'viq-kpi',
  imports: [CountUp, MatIconModule],
  template: `
    <div class="kpi" [style.--tone]="tone()">
      <div class="kpi-top">
        <span class="kpi-icon"><mat-icon>{{ icon() }}</mat-icon></span>
        <span class="kpi-label">{{ kpi().label }}</span>
      </div>
      <div class="kpi-value" [viqCountUp]="kpi().value ?? 0" [format]="formatter()"></div>
      <div class="kpi-foot">
        @if (kpi().delta_pct !== null && kpi().delta_pct !== undefined) {
          <span class="delta" [class.good]="deltaGood()" [class.bad]="deltaBad()" [class.flat]="kpi().delta_pct === 0">
            <mat-icon>{{ kpi().delta_pct! > 0 ? 'arrow_upward' : kpi().delta_pct! < 0 ? 'arrow_downward' : 'remove' }}</mat-icon>
            {{ abs(kpi().delta_pct!) }}{{ kpi().delta_unit === 'pts' ? ' pts' : '%' }}
          </span>
          <span class="kpi-vs">vs previous period</span>
        } @else {
          <span class="kpi-vs">{{ kpi().hint }}</span>
        }
      </div>
      @if (kpi().delta_pct !== null && kpi().delta_pct !== undefined) {
        <div class="kpi-hint">{{ kpi().hint }}</div>
      }
      <svg class="kpi-wave" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30 C 30 10, 60 38, 100 22 S 170 6, 200 18 L200 40 L0 40 Z" />
      </svg>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .kpi {
        position: relative;
        overflow: hidden;
        height: 100%;
        padding: 16px 18px 14px;
        border-radius: var(--viq-radius);
        background: var(--viq-surface);
        border: 1px solid var(--viq-line);
        box-shadow: var(--viq-shadow);
        transition: transform .35s var(--viq-ease), box-shadow .35s var(--viq-ease), border-color .35s;
      }
      .kpi::before {
        content: '';
        position: absolute; inset: 0 0 auto 0; height: 3px;
        background: linear-gradient(90deg, var(--tone), transparent);
      }
      .kpi:hover { transform: translateY(-3px); box-shadow: var(--viq-shadow-lift); border-color: color-mix(in srgb, var(--tone) 40%, transparent); }
      .kpi-top { display: flex; align-items: center; gap: 10px; }
      .kpi-icon {
        width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 16%, transparent);
        border: 1px solid color-mix(in srgb, var(--tone) 28%, transparent);
      }
      .kpi-icon mat-icon { font-size: 21px; width: 21px; height: 21px; }
      .kpi-label { font-size: 12.5px; font-weight: 600; color: var(--viq-ink-soft); }
      .kpi-value {
        margin-top: 12px; font: 800 28px/1.1 'Plus Jakarta Sans', 'Inter', sans-serif;
        letter-spacing: -0.8px;
      }
      .kpi-foot { margin-top: 8px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
      .kpi-vs, .kpi-hint { font-size: 11.5px; color: var(--viq-ink-muted); }
      .kpi-hint { margin-top: 4px; }
      .kpi-wave { position: absolute; right: 0; bottom: 0; width: 55%; height: 34px; opacity: .12; }
      .kpi-wave path { fill: var(--tone); }
    `,
  ],
})
export class KpiTile {
  readonly kpi = input.required<Kpi>();
  readonly icon = input('insights');
  readonly tone = input('#6366f1');
  readonly currency = input('USD');

  readonly formatter = computed(() => {
    const kpi = this.kpi();
    const cur = this.currency();
    switch (kpi.format) {
      case 'currency':
        return (v: number) => money(v, cur);
      case 'percent':
        return (v: number) => `${v.toFixed(1)}%`;
      case 'score':
        return (v: number) => v.toFixed(1);
      default:
        return (v: number) => num(Math.round(v));
    }
  });

  readonly deltaGood = computed(() => {
    const d = this.kpi().delta_pct ?? 0;
    return d !== 0 && (d > 0) === this.kpi().good_when_up;
  });

  readonly deltaBad = computed(() => {
    const d = this.kpi().delta_pct ?? 0;
    return d !== 0 && (d > 0) !== this.kpi().good_when_up;
  });

  abs(v: number): string {
    return Math.abs(v).toFixed(1).replace(/\.0$/, '');
  }
}
