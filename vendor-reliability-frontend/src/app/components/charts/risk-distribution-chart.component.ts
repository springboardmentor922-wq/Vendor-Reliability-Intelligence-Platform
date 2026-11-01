import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CHART_COLORS } from './chart-theme';

@Component({
  selector: 'app-risk-distribution-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="risk-distribution-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-shield-exclamation text-primary me-1"></i> {{ title }}
        </h6>
      </div>
      <app-chart
        type="bar"
        [data]="chartData"
        [options]="chartOptions"
        [height]="height"
        [loading]="loading">
      </app-chart>
    </div>
  `
})
export class RiskDistributionChartComponent implements OnChanges {
  @Input() labels: string[] = ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'];
  @Input() counts: number[] = [];
  @Input() title = 'Vendor Risk Distribution';
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
          label: (ctx) => ` Vendors: ${ctx.raw}`
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.gridLine },
        title: { display: true, text: 'Number of Vendors', color: CHART_COLORS.textMuted }
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
    const defaultLabels = ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'];
    const lbls = this.labels.length ? this.labels : defaultLabels;
    const data = this.counts.length ? this.counts : [38, 21, 9, 4];

    const colors = [
      CHART_COLORS.success,
      CHART_COLORS.warning,
      CHART_COLORS.delayed,
      CHART_COLORS.danger
    ];

    this.chartData = {
      labels: lbls,
      datasets: [
        {
          label: 'Number of Vendors',
          data: data,
          backgroundColor: colors.slice(0, lbls.length),
          borderRadius: 4
        }
      ]
    };
  }
}
