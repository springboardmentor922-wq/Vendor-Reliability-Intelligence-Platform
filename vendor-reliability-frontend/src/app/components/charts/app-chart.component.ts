import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, ChartData, ChartOptions } from 'chart.js';
import './chart-theme';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-wrapper position-relative" [style.height.px]="height">
      <!-- Loading Skeleton (Only shown if loading AND no data exists yet) -->
      <div *ngIf="loading && (!data || !hasData())" class="chart-placeholder d-flex flex-column align-items-center justify-content-center h-100">
        <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
        <span class="text-muted small">Loading chart data...</span>
      </div>

      <!-- Empty / No Data State -->
      <div *ngIf="!loading && (noData || !hasData())" class="chart-placeholder d-flex flex-column align-items-center justify-content-center h-100 text-center p-3">
        <i class="bi bi-bar-chart text-muted mb-2 fs-3 opacity-50"></i>
        <span class="text-muted small fw-medium">No analytics data available</span>
        <span class="text-muted smaller">Metrics will populate as operations occur</span>
      </div>

      <!-- Canvas: Shown immediately whenever valid data exists -->
      <canvas #chartCanvas [class.d-none]="noData || !hasData()"></canvas>

      <!-- Donut Center Overlay -->
      <div *ngIf="hasData() && centerText && (type === 'doughnut' || type === 'pie')"
           class="center-donut-overlay d-flex flex-column align-items-center justify-content-center pointer-events-none">
        <span class="center-text-value fw-bold text-dark">{{ centerText }}</span>
        <span *ngIf="centerSubtext" class="center-text-sub text-muted text-uppercase">{{ centerSubtext }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .chart-wrapper {
      width: 100%;
      min-height: 180px;
    }
    .chart-placeholder {
      background: rgba(248, 250, 252, 0.6);
      border-radius: 8px;
      border: 1px dashed #e2e8f0;
    }
    .smaller {
      font-size: 0.75rem;
    }
    .center-donut-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      text-align: center;
      line-height: 1.2;
    }
    .center-text-value {
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }
    .center-text-sub {
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() type: ChartType = 'bar';
  @Input() data: ChartData | null = null;
  @Input() options: ChartOptions = {};
  @Input() height: number = 240;
  @Input() centerText?: string;
  @Input() centerSubtext?: string;
  @Input() loading = false;
  @Input() noData = false;

  private chart: Chart | null = null;
  private isViewInitialized = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    this.createOrUpdateChart();
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isViewInitialized) {
      this.createOrUpdateChart();
      this.cdr.markForCheck();
    }
  }

  hasData(): boolean {
    if (!this.data || !this.data.datasets || this.data.datasets.length === 0) return false;
    return this.data.datasets.some(ds => ds.data && ds.data.length > 0 && ds.data.some(v => v !== null && v !== undefined));
  }

  private createOrUpdateChart(): void {
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;

    if (this.noData || !this.hasData()) {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
      return;
    }

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx || !this.data) return;

    // Fast in-place dataset update if chart of the same type is already mounted
    if (this.chart && (this.chart.config as any)?.type === this.type) {
      this.chart.data = this.data;
      if (this.options) {
        this.chart.options = {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 250 },
          ...this.options
        };
      }
      this.chart.update('none');
      return;
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const config: ChartConfiguration = {
      type: this.type,
      data: this.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        ...this.options
      }
    };

    try {
      this.chart = new Chart(ctx, config);
    } catch (e) {
      console.error('Error rendering chart:', e);
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
