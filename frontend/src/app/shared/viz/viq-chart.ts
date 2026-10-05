import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartOptions,
  ChartType,
  registerables,
} from 'chart.js';

import { ThemeService } from '../../core/theme.service';

Chart.register(...registerables);

export interface ChartClick {
  datasetIndex: number;
  index: number;
  label: string;
  value: unknown;
}

/**
 * Thin Chart.js wrapper.
 *
 * - Reads colours from CSS tokens, so the chart follows the dark/light theme.
 * - On new data it mutates the existing chart and calls `update()`, so a live
 *   refresh animates from the old values to the new ones instead of redrawing.
 * - Emits clicks with the label of the element hit, for drill-down.
 */
@Component({
  selector: 'viq-chart',
  template: `
    <div class="viq-chart-box" [style.height.px]="height()">
      <canvas #canvas [attr.aria-label]="ariaLabel()" role="img"></canvas>
      <ng-content />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }
      .viq-chart-box {
        position: relative;
        width: 100%;
      }
    `,
  ],
})
export class ViqChart implements AfterViewInit, OnDestroy {
  private readonly theme = inject(ThemeService);

  readonly type = input.required<ChartType>();
  readonly data = input.required<ChartData>();
  readonly options = input<ChartOptions>({});
  readonly height = input(260);
  readonly ariaLabel = input('Chart');

  readonly pointClick = output<ChartClick>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;
  private ready = false;

  constructor() {
    // New data -> animated in-place update.
    effect(() => {
      const data = this.data();
      const options = this.options();
      untracked(() => {
        if (!this.ready) return;
        if (!this.chart) {
          this.create();
          return;
        }
        this.chart.data.labels = data.labels;
        const current = this.chart.data.datasets;
        data.datasets.forEach((incoming, i) => {
          const copy = { ...incoming, data: [...(incoming.data as unknown[])] } as typeof incoming;
          if (current[i]) {
            Object.assign(current[i], copy);
          } else {
            current.push(copy);
          }
        });
        current.splice(data.datasets.length);
        this.chart.options = this.merge(options);
        this.chart.update();
      });
    });

    // Theme switch -> rebuild with the new palette.
    effect(() => {
      this.theme.mode();
      untracked(() => {
        if (!this.ready) return;
        // Tokens are applied synchronously on the root; wait a frame so the
        // computed style reflects them.
        requestAnimationFrame(() => this.create());
      });
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.create();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private create(): void {
    this.chart?.destroy();

    const config: ChartConfiguration = {
      type: this.type(),
      data: structuredCloneSafe(this.data()),
      options: this.merge(this.options()),
    };

    this.chart = new Chart(this.canvas().nativeElement, config);
  }

  private merge(options: ChartOptions): ChartOptions {
    const ink = this.theme.token('--viq-ink-soft', '#97a3bb');
    const grid = this.theme.token('--viq-chart-grid', 'rgba(148,163,184,.12)');
    const surface = this.theme.token('--viq-surface-3', '#1c2847');
    const text = this.theme.token('--viq-ink', '#e9edf7');
    const line = this.theme.token('--viq-line-strong', 'rgba(148,163,184,.26)');
    const type = this.type();
    const polar = type === 'doughnut' || type === 'pie' || type === 'polarArea' || type === 'radar';

    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = ink;

    const base: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: polar ? { mode: 'nearest', intersect: true } : { mode: 'index', intersect: false },
      onHover: (event, elements) => {
        const target = event.native?.target as HTMLElement | undefined;
        if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
      },
      onClick: (_event, elements, chart) => {
        const hit = elements[0];
        if (!hit) return;
        const label = String(chart.data.labels?.[hit.index] ?? '');
        const value = chart.data.datasets[hit.datasetIndex]?.data[hit.index];
        this.pointClick.emit({ datasetIndex: hit.datasetIndex, index: hit.index, label, value });
      },
      plugins: {
        legend: {
          display: !polar || type === 'radar',
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 10,
            boxHeight: 10,
            padding: 14,
            color: ink,
            font: { size: 11.5, weight: 500 },
          },
        },
        tooltip: {
          backgroundColor: surface,
          titleColor: text,
          bodyColor: text,
          borderColor: line,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          boxPadding: 5,
          usePointStyle: true,
          titleFont: { weight: 700 },
        },
      },
    };

    if (!polar) {
      base.scales = {
        x: {
          grid: { display: false },
          border: { color: grid },
          ticks: { color: ink, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: grid },
          border: { display: false },
          ticks: { color: ink, font: { size: 11 }, maxTicksLimit: 6 },
        },
      };
    }

    if (type === 'radar') {
      base.scales = {
        r: {
          beginAtZero: true,
          suggestedMax: 100,
          angleLines: { color: grid },
          grid: { color: grid },
          pointLabels: { color: ink, font: { size: 11, weight: 600 } },
          ticks: { display: false, stepSize: 25 },
        },
      };
    }

    return deepMerge(base, options) as ChartOptions;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Function);
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...target };
  for (const [key, value] of Object.entries(source ?? {})) {
    out[key] = isObject(value) && isObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out;
}

function structuredCloneSafe(data: ChartData): ChartData {
  // Chart.js mutates dataset objects; give it its own copies so the input
  // signal's value stays untouched for the in-place update path.
  return {
    labels: data.labels ? [...data.labels] : [],
    datasets: data.datasets.map((d) => ({ ...d, data: [...(d.data as unknown[])] })) as ChartData['datasets'],
  };
}
