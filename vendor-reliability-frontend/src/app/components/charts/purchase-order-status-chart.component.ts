import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CHART_COLORS, STATUS_COLORS } from './chart-theme';

@Component({
  selector: 'app-purchase-order-status-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="po-status-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-pie-chart-fill text-primary me-1"></i> {{ title }}
        </h6>
      </div>
      <app-chart
        type="doughnut"
        [data]="chartData"
        [options]="chartOptions"
        [height]="height"
        [centerText]="centerTotalText"
        centerSubtext="Total POs"
        [loading]="loading">
      </app-chart>
    </div>
  `
})
export class PurchaseOrderStatusChartComponent implements OnChanges {
  @Input() labels: string[] = ['Pending Approval', 'Approved', 'In Progress', 'Delivered', 'Cancelled'];
  @Input() counts: number[] = [];
  @Input() title = 'Active Purchase Orders';
  @Input() loading = false;
  @Input() height = 240;

  chartData: ChartData | null = null;
  centerTotalText = '0';

  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: { family: "'Inter', sans-serif", size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw as number;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return ` ${ctx.label}: ${val} (${pct}%)`;
          }
        }
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
    const defaultLabels = ['Pending Approval', 'Approved', 'In Progress', 'Delivered', 'Cancelled'];
    const lbls = this.labels.length ? this.labels : defaultLabels;
    const data = this.counts.length ? this.counts : [15, 38, 32, 42, 7];
    const total = data.reduce((a, b) => a + b, 0);
    this.centerTotalText = total.toLocaleString();

    const bgColors = lbls.map(lbl => STATUS_COLORS[lbl] || CHART_COLORS.info);

    this.chartData = {
      labels: lbls,
      datasets: [
        {
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
  }
}
