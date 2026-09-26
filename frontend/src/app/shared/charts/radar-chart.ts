import { Component, computed, input } from '@angular/core';

import { Point, TONE } from './chart-types';

/**
 * Radar chart over the six reliability factors.
 *
 * A radar is the right shape here specifically because the six factors are
 * fixed, comparable (all 0-100) and read as a profile: the eye picks out the
 * dented axis - the weak factor - immediately, which is the question a buyer
 * is actually asking.
 */
@Component({
  selector: 'app-radar-chart',
  template: `
    <div class="chart">
      @if (data().length < 3) {
        <p class="muted chart-empty">Not enough factors scored yet.</p>
      } @else {
        <svg
          viewBox="0 0 260 240"
          class="radar-svg"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          <!-- rings -->
          @for (ring of rings(); track ring.level) {
            <polygon
              [attr.points]="ring.points"
              class="radar-ring"
            />
          }

          <!-- spokes and axis labels -->
          @for (axis of axes(); track axis.label) {
            <line
              [attr.x1]="centreX"
              [attr.y1]="centreY"
              [attr.x2]="axis.x"
              [attr.y2]="axis.y"
              class="radar-spoke"
            />
            <text
              [attr.x]="axis.labelX"
              [attr.y]="axis.labelY"
              [attr.text-anchor]="axis.anchor"
              class="radar-label"
            >
              {{ axis.short }}
            </text>
          }

          <!-- the profile -->
          <polygon
            [attr.points]="shape()"
            [attr.fill]="colour()"
            fill-opacity="0.18"
            [attr.stroke]="colour()"
            stroke-width="2"
            stroke-linejoin="round"
          />

          @for (node of nodes(); track node.label) {
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y"
              r="3.5"
              [attr.fill]="colour()"
              stroke="#fff"
              stroke-width="1.5"
            >
              <title>{{ node.label }}: {{ node.value }}</title>
            </circle>
          }

          <!-- scale hint on the vertical axis -->
          <text [attr.x]="centreX + 4" [attr.y]="centreY - radius + 10" class="radar-scale">
            100
          </text>
        </svg>
      }
    </div>
  `,
  styles: [
    `
      .radar-svg {
        width: 100%;
        max-width: 300px;
        height: auto;
        display: block;
        margin: 0 auto;
      }
      .radar-ring {
        fill: none;
        stroke: var(--viq-line);
        stroke-width: 1;
      }
      .radar-spoke {
        stroke: var(--viq-line);
        stroke-width: 1;
      }
      .radar-label {
        font-size: 9px;
        fill: var(--viq-ink-soft);
        font-weight: 600;
      }
      .radar-scale {
        font-size: 8px;
        fill: var(--viq-ink-soft);
      }
      .chart-empty {
        padding: 24px 0;
        text-align: center;
      }
    `,
  ],
})
export class RadarChart {
  /** One point per factor, each valued 0-100. */
  readonly data = input.required<Point[]>();
  readonly colour = input(TONE.accent);

  readonly centreX = 130;
  readonly centreY = 118;
  readonly radius = 84;

  private readonly geometry = computed(() => {
    const rows = this.data();
    const count = rows.length;

    return rows.map((row, index) => {
      // Start at the top and go clockwise.
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      const ratio = Math.max(0, Math.min(100, row.value)) / 100;

      return {
        label: row.label,
        value: row.value,
        angle,
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        ratio,
      };
    });
  });

  readonly rings = computed(() =>
    [0.25, 0.5, 0.75, 1].map((level) => ({
      level,
      points: this.geometry()
        .map(
          (g) =>
            `${(this.centreX + this.radius * level * g.cos).toFixed(1)},` +
            `${(this.centreY + this.radius * level * g.sin).toFixed(1)}`,
        )
        .join(' '),
    })),
  );

  readonly axes = computed(() =>
    this.geometry().map((g) => {
      const labelRadius = this.radius + 16;
      const labelX = this.centreX + labelRadius * g.cos;
      const labelY = this.centreY + labelRadius * g.sin;

      // Nudge the anchor so labels sit outside the shape rather than over it.
      let anchor: 'start' | 'middle' | 'end' = 'middle';
      if (g.cos > 0.3) anchor = 'start';
      else if (g.cos < -0.3) anchor = 'end';

      return {
        label: g.label,
        short: this.shorten(g.label),
        x: this.centreX + this.radius * g.cos,
        y: this.centreY + this.radius * g.sin,
        labelX,
        labelY: labelY + (g.sin > 0.5 ? 8 : g.sin < -0.5 ? -2 : 3),
        anchor,
      };
    }),
  );

  readonly nodes = computed(() =>
    this.geometry().map((g) => ({
      label: g.label,
      value: g.value,
      x: this.centreX + this.radius * g.ratio * g.cos,
      y: this.centreY + this.radius * g.ratio * g.sin,
    })),
  );

  readonly shape = computed(() =>
    this.nodes()
      .map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`)
      .join(' '),
  );

  readonly ariaLabel = computed(
    () =>
      `Radar chart of reliability factors: ${this.data()
        .map((d) => `${d.label} ${d.value}`)
        .join(', ')}`,
  );

  /** Two-word axis labels keep the radar readable at this size. */
  private shorten(label: string): string {
    const map: Record<string, string> = {
      'Delivery History': 'Delivery',
      'Product Quality': 'Quality',
      'Communication Efficiency': 'Comms',
      'Contract Compliance': 'Compliance',
      'Purchase History': 'History',
      'Issue Resolution': 'Issues',
    };

    return map[label] ?? label;
  }
}
