import { Component, computed, input } from '@angular/core';

import { RISK_COLOURS, TONE } from './chart-types';

/**
 * Semicircular gauge for a single 0-100 score.
 *
 * Used for the headline reliability score and for the model's delay
 * probability. The arc is coloured by risk band so the number and the colour
 * always agree.
 */
@Component({
  selector: 'app-score-gauge',
  template: `
    <div class="gauge">
      <svg viewBox="0 0 200 118" class="gauge-svg" role="img" [attr.aria-label]="ariaLabel()">
        <path
          [attr.d]="trackPath"
          fill="none"
          stroke="var(--viq-ground)"
          stroke-width="16"
          stroke-linecap="round"
        />
        <path
          [attr.d]="valuePath()"
          fill="none"
          [attr.stroke]="colour()"
          stroke-width="16"
          stroke-linecap="round"
        />

        <text x="100" y="86" text-anchor="middle" class="gauge-value">
          {{ display() }}
        </text>
        <text x="100" y="104" text-anchor="middle" class="gauge-caption">
          {{ caption() }}
        </text>
      </svg>
    </div>
  `,
  styles: [
    `
      .gauge-svg {
        width: 100%;
        max-width: 210px;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .gauge-value {
        font-size: 30px;
        font-weight: 700;
        fill: var(--viq-ink);
      }
      .gauge-caption {
        font-size: 10px;
        fill: var(--viq-ink-soft);
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }
    `,
  ],
})
export class ScoreGauge {
  readonly value = input.required<number>();
  readonly caption = input('Reliability');
  /** Risk band name, used to colour the arc. Falls back to the accent tone. */
  readonly band = input<string | null>(null);
  readonly suffix = input('');
  readonly decimals = input(1);

  private readonly centreX = 100;
  private readonly centreY = 100;
  private readonly radius = 80;

  /** The full half-circle the value arc is drawn over. */
  readonly trackPath = `M 20 100 A ${80} ${80} 0 0 1 180 100`;

  readonly clamped = computed(() =>
    Math.max(0, Math.min(100, this.value() ?? 0)),
  );

  readonly display = computed(
    () => `${this.clamped().toFixed(this.decimals())}${this.suffix()}`,
  );

  readonly colour = computed(() => {
    const band = this.band();

    if (band && RISK_COLOURS[band]) {
      return RISK_COLOURS[band];
    }

    const value = this.clamped();

    if (value >= 73) return TONE.success;
    if (value >= 65) return TONE.warn;
    if (value >= 55) return '#d97706';

    return TONE.danger;
  });

  readonly valuePath = computed(() => {
    const ratio = this.clamped() / 100;

    if (ratio <= 0) {
      return '';
    }

    // Sweep from pi (left) to 0 (right).
    const angle = Math.PI - ratio * Math.PI;
    const x = this.centreX + this.radius * Math.cos(angle);
    const y = this.centreY - this.radius * Math.sin(angle);
    const largeArc = ratio > 0.5 ? 1 : 0;

    return `M 20 100 A ${this.radius} ${this.radius} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  readonly ariaLabel = computed(
    () => `${this.caption()}: ${this.display()} out of 100`,
  );
}
