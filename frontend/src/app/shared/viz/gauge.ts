import { Component, computed, input } from '@angular/core';

import { CountUp } from './count-up';

/** Semicircular gauge (0-100), drawn in SVG with an animated sweep. */
@Component({
  selector: 'viq-gauge',
  imports: [CountUp],
  template: `
    <div class="gauge">
      <svg viewBox="0 0 220 128" role="img" [attr.aria-label]="label() + ' ' + value() + '%'">
        <defs>
          <linearGradient [attr.id]="gid" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#d03b3b" />
            <stop offset="45%" stop-color="#fab219" />
            <stop offset="100%" stop-color="#0ca30c" />
          </linearGradient>
        </defs>
        <path d="M 20 112 A 90 90 0 0 1 200 112" class="track" />
        <path d="M 20 112 A 90 90 0 0 1 200 112" class="fill" [attr.stroke]="'url(#' + gid + ')'"
              [style.stroke-dasharray]="arc" [style.stroke-dashoffset]="offset()" />
        <g [style.transform]="'rotate(' + needle() + 'deg)'" class="needle">
          <line x1="110" y1="112" x2="110" y2="40" />
          <circle cx="110" cy="112" r="7" />
        </g>
      </svg>
      <div class="gauge-readout">
        <div class="gauge-value"><span [viqCountUp]="value()" [format]="fmt"></span></div>
        <div class="gauge-label">{{ label() }}</div>
      </div>
    </div>
  `,
  styles: [
    `
      .gauge { position: relative; max-width: 240px; margin: 0 auto; }
      svg { width: 100%; display: block; overflow: visible; }
      .track { fill: none; stroke: var(--viq-neutral-bg); stroke-width: 16; stroke-linecap: round; }
      .fill { fill: none; stroke-width: 16; stroke-linecap: round; transition: stroke-dashoffset 1.4s var(--viq-ease); }
      .needle { transform-origin: 110px 112px; transform-box: view-box; transition: transform 1.4s var(--viq-ease); }
      .needle line { stroke: var(--viq-ink); stroke-width: 3; stroke-linecap: round; }
      .needle circle { fill: var(--viq-ink); stroke: var(--viq-surface); stroke-width: 3; }
      .gauge-readout { text-align: center; margin-top: -2px; }
      .gauge-value { font: 800 28px/1 'Plus Jakarta Sans', 'Inter', sans-serif; letter-spacing: -.6px; }
      .gauge-label { margin-top: 4px; font-size: 11.5px; color: var(--viq-ink-soft); }
    `,
  ],
})
export class Gauge {
  readonly value = input(0);
  readonly label = input('');

  readonly gid = `g${Math.random().toString(36).slice(2, 8)}`;
  readonly arc = Math.PI * 90;
  readonly fmt = (v: number) => `${v.toFixed(1)}%`;

  readonly clamped = computed(() => Math.max(0, Math.min(100, this.value() || 0)));
  readonly offset = computed(() => this.arc * (1 - this.clamped() / 100));
  readonly needle = computed(() => -90 + (180 * this.clamped()) / 100);
}
