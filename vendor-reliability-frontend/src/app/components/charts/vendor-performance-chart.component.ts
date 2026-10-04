import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CHART_COLORS } from './chart-theme';

@Component({
  selector: 'app-vendor-performance-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="vendor-performance-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-shield-check text-primary me-1"></i> Vendor Performance Summary
        </h6>
        <div class="btn-group btn-group-sm" role="group">
          <button type="button"
                  class="btn btn-outline-secondary btn-xs py-0 px-2"
                  [class.active]="viewMode === 'radar'"
                  (click)="setViewMode('radar')">
            Radar
          </button>
          <button type="button"
                  class="btn btn-outline-secondary btn-xs py-0 px-2"
                  [class.active]="viewMode === 'bar'"
                  (click)="setViewMode('bar')">
            Bar
          </button>
        </div>
      </div>
      <app-chart
        [type]="viewMode"
        [data]="chartData"
        [options]="chartOptions"
        [height]="height"
        [loading]="loading">
      </app-chart>
    </div>
  `,
  styles: [`
    .btn-xs {
      font-size: 0.72rem;
      border-radius: 4px;
    }
  `]
})
export class VendorPerformanceChartComponent implements OnChanges {
  @Input() metrics: string[] = ['Delivery', 'Quality', 'Communication', 'Compliance', 'Reliability'];
  @Input() topVendor: { name: string; scores: number[] } | null = null;
  @Input() averageVendor: { name: string; scores: number[] } | null = null;
  @Input() loading = false;
  @Input() height = 240;

  viewMode: 'radar' | 'bar' = 'radar';
  chartData: ChartData | null = null;
  chartOptions: ChartOptions = {};

  setViewMode(mode: 'radar' | 'bar'): void {
    this.viewMode = mode;
    this.updateChart();
  }

  constructor() {
    this.updateChart();
  }

  ngOnChanges(): void {
    this.updateChart();
  }

  private updateChart(): void {
    const labels = this.metrics.length ? this.metrics : ['Delivery', 'Quality', 'Communication', 'Compliance', 'Reliability'];
    const topScores = this.topVendor?.scores?.length ? this.topVendor.scores : [96, 92, 88, 95, 94];
    const avgScores = this.averageVendor?.scores?.length ? this.averageVendor.scores : [88, 85, 84, 90, 87];
    const topName = this.topVendor?.name || 'Top Vendor';
    const avgName = this.averageVendor?.name || 'Category Average';

    if (this.viewMode === 'radar') {
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: CHART_COLORS.gridLine },
            grid: { color: CHART_COLORS.gridLine },
            pointLabels: {
              font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
              color: CHART_COLORS.textPrimary
            },
            suggestedMin: 50,
            suggestedMax: 100,
            ticks: {
              stepSize: 15,
              backdropColor: 'transparent',
              font: { size: 9 }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } }
          }
        }
      };

      this.chartData = {
        labels: labels,
        datasets: [
          {
            label: topName,
            data: topScores,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            borderWidth: 2,
            pointBackgroundColor: '#6366f1',
            pointRadius: 3
          },
          {
            label: avgName,
            data: avgScores,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            borderWidth: 2,
            pointBackgroundColor: '#06b6d4',
            pointRadius: 3
          }
        ]
      };
    } else {
      this.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: {
            suggestedMin: 50,
            max: 100,
            grid: { color: CHART_COLORS.gridLine },
            title: { display: true, text: 'Score (%)' }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, usePointStyle: true } }
        }
      };

      this.chartData = {
        labels: labels,
        datasets: [
          {
            label: topName,
            data: topScores,
            backgroundColor: '#6366f1',
            borderRadius: 4
          },
          {
            label: avgName,
            data: avgScores,
            backgroundColor: '#06b6d4',
            borderRadius: 4
          }
        ]
      };
    }
  }
}
