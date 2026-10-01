import {
  Component, Input, ElementRef, ViewChild, AfterViewInit,
  OnChanges, OnDestroy, SimpleChanges, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables, ChartConfiguration, ChartType } from 'chart.js';

// Register all standard Chart.js controllers, elements, scales, plugins
Chart.register(...registerables);

@Component({
  selector: 'app-chart-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card chart-card-container">
      <div class="chart-header">
        <div class="chart-title-area">
          <div class="title-row">
            @if (icon) {
              <span class="chart-icon">{{ icon }}</span>
            }
            <h3 class="chart-title">{{ title }}</h3>
          </div>
          @if (subtitle) {
            <p class="chart-subtitle">{{ subtitle }}</p>
          }
        </div>
        @if (badgeText) {
          <span class="badge" [ngClass]="badgeClass || 'badge-blue'">
            {{ badgeText }}
          </span>
        }
      </div>

      <div class="chart-canvas-wrapper" [style.height.px]="height">
        <canvas #chartCanvas></canvas>
      </div>

      @if (footerText) {
        <div class="chart-footer">
          <span class="footer-indicator">●</span>
          <span>{{ footerText }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .chart-card-container {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
      backdrop-filter: blur(16px);
      border-radius: var(--radius-lg, 14px);
      padding: 1.25rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .chart-card-container:hover {
      border-color: rgba(99, 102, 241, 0.35);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 0 15px -3px rgba(99, 102, 241, 0.15);
    }
    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .chart-title-area {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .chart-icon {
      font-size: 1.15rem;
    }
    .chart-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main, #f8fafc);
      letter-spacing: -0.01em;
      margin: 0;
    }
    .chart-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted, #94a3b8);
      margin: 0;
    }
    .badge-blue {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
    }
    .badge-green {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #6ee7b7;
    }
    .badge-purple {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #c4b5fd;
    }
    .badge-amber {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fcd34d;
    }
    .chart-canvas-wrapper {
      position: relative;
      width: 100%;
    }
    .chart-footer {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      color: var(--text-muted, #94a3b8);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 0.6rem;
      margin-top: -0.25rem;
    }
    .footer-indicator {
      color: #10b981;
      font-size: 0.7rem;
    }
  `]
})
export class ChartCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() badgeText?: string;
  @Input() badgeClass?: string;
  @Input() footerText?: string;
  @Input() height: number = 260;

  @Input({ required: true }) type!: ChartType;
  @Input({ required: true }) data!: ChartConfiguration['data'];
  @Input() options?: any;

  private chartInstance: Chart | null = null;

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.chartInstance && (changes['data'] || changes['options'] || changes['type'])) {
      if (changes['type'] && !changes['type'].isFirstChange()) {
        this.chartInstance.destroy();
        this.createChart();
      } else {
        this.chartInstance.data = this.data;
        if (this.options) {
          this.chartInstance.options = this.buildOptions();
        }
        this.chartInstance.update('active');
      }
    }
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private buildOptions(): any {
    const baseGridColor = 'rgba(255, 255, 255, 0.06)';
    const baseTextColor = '#94a3b8';

    const defaultOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeOutQuart',
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: baseTextColor,
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              family: "'Inter', sans-serif",
              size: 11,
              weight: 'bold',
            },
            padding: 12,
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(99, 102, 241, 0.4)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: (context: any) => {
              let label = context.dataset?.label || '';
              if (label) {
                label += ': ';
              }
              const val = context.parsed?.y !== undefined ? context.parsed.y : (context.parsed !== undefined ? context.parsed : context.raw);
              if (typeof val === 'number') {
                if (label.toLowerCase().includes('cost') || label.toLowerCase().includes('spend') || label.toLowerCase().includes('value') || label.toLowerCase().includes('amount') || label.toLowerCase().includes('$')) {
                  label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
                } else if (label.toLowerCase().includes('%') || label.toLowerCase().includes('rate') || label.toLowerCase().includes('score')) {
                  label += `${val}%`;
                } else {
                  label += val.toLocaleString();
                }
              } else {
                label += `${val}`;
              }
              return label;
            }
          }
        },
      },
    };

    if (this.type === 'bar' || this.type === 'line') {
      defaultOptions.scales = {
        x: {
          grid: {
            color: baseGridColor,
            drawTicks: false,
          },
          ticks: {
            color: baseTextColor,
            font: { family: "'Inter', sans-serif", size: 11 },
          },
          border: { display: false },
        },
        y: {
          grid: {
            color: baseGridColor,
            drawTicks: false,
          },
          ticks: {
            color: baseTextColor,
            font: { family: "'Inter', sans-serif", size: 11 },
          },
          border: { display: false },
        }
      };
    } else if (this.type === 'radar') {
      defaultOptions.scales = {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          pointLabels: {
            color: '#cbd5e1',
            font: { family: "'Inter', sans-serif", size: 11, weight: 'bold' }
          },
          ticks: {
            display: false,
            backdropColor: 'transparent',
          },
          suggestedMin: 50,
          suggestedMax: 100,
        }
      };
    }

    return {
      ...defaultOptions,
      ...this.options,
      plugins: {
        ...defaultOptions.plugins,
        ...this.options?.plugins,
      },
      scales: {
        ...defaultOptions.scales,
        ...this.options?.scales,
      }
    };
  }

  private createChart(): void {
    if (!this.canvasRef?.nativeElement) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chartInstance = new Chart(ctx, {
      type: this.type,
      data: this.data,
      options: this.buildOptions(),
    });
  }
}
