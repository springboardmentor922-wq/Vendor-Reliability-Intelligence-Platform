import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CHART_COLORS } from './chart-theme';

@Component({
  selector: 'app-reliability-trend-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="reliability-trend-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-graph-up text-success me-1"></i> {{ title }}
        </h6>
        <span *ngIf="currentScore" class="badge bg-success-subtle text-success border border-success-subtle">
          Current: {{ currentScore }}%
        </span>
      </div>
      <app-chart
        type="line"
        [data]="chartData"
        [options]="chartOptions"
        [height]="height"
        [loading]="loading">
      </app-chart>
    </div>
  `
})
export class ReliabilityTrendChartComponent implements OnChanges {
  @Input() months: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  @Input() scores: number[] = [];
  @Input() title = 'Reliability Score Trend';
  @Input() currentScore?: number;
  @Input() loading = false;
  @Input() height = 240;

  chartData: ChartData | null = null;
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx) => ` Reliability: ${ctx.raw}%`
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        suggestedMin: 60,
        max: 100,
        grid: { color: CHART_COLORS.gridLine },
        title: { display: true, text: 'Reliability Score %', color: CHART_COLORS.textMuted }
      }
    }
  };

  constructor() {
    this.updateChart();
  }

  ngOnChanges(): void {
    this.updateChart();
  }

  private updateChart(): void {
    const labels = this.months.length ? this.months : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const data = this.scores.length ? this.scores : [78, 81, 80, 85, 88, 91];

    this.chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Reliability Score %',
          data: data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.18)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#10b981',
          pointBorderWidth: 2
        }
      ]
    };
  }
}
