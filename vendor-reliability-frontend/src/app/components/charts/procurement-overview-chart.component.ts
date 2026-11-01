import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CHART_COLORS } from './chart-theme';

@Component({
  selector: 'app-procurement-overview-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="procurement-overview-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-bar-chart-line-fill text-primary me-1"></i> Procurement Overview
        </h6>
        <div class="chart-badges d-flex gap-2">
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
            <span class="legend-dot bg-primary me-1"></span> Cost (₹ Lakh)
          </span>
          <span class="badge bg-warning-subtle text-dark border border-warning-subtle">
            <span class="legend-dot bg-warning me-1"></span> Number of POs
          </span>
        </div>
      </div>
      <app-chart
        type="bar"
        [data]="chartData"
        [options]="chartOptions"
        [height]="height"
        [loading]="loading">
      </app-chart>
    </div>
  `,
  styles: [`
    .legend-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
  `]
})
export class ProcurementOverviewChartComponent implements OnChanges {
  @Input() months: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  @Input() costData: number[] = [];
  @Input() orderData: number[] = [];
  @Input() loading = false;
  @Input() height = 240;

  chartData: ChartData | null = null;
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 10,
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex === 0) {
              return ` Cost: ₹ ${ctx.raw} Lakh`;
            }
            return ` Orders: ${ctx.raw} POs`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Cost (₹ Lakh)', color: CHART_COLORS.textMuted },
        grid: { color: CHART_COLORS.gridLine }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Number of POs', color: CHART_COLORS.textMuted },
        grid: { drawOnChartArea: false }
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
    const costs = this.costData.length ? this.costData : [35, 42, 50, 62, 70, 78];
    const orders = this.orderData.length ? this.orderData : [18, 24, 28, 35, 40, 48];

    this.chartData = {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Procurement Cost (₹ Lakh)',
          data: costs,
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Number of POs',
          data: orders,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#f59e0b',
          pointBorderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    };
  }
}
