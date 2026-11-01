import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CATEGORY_PALETTE } from './chart-theme';

@Component({
  selector: 'app-cost-analysis-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="cost-analysis-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-wallet2 text-primary me-1"></i> {{ title }}
        </h6>
      </div>
      <app-chart
        type="doughnut"
        [data]="chartData"
        [options]="chartOptions"
        [height]="height"
        [centerText]="centerTotalText"
        centerSubtext="Total Spend"
        [loading]="loading">
      </app-chart>
    </div>
  `
})
export class CostAnalysisChartComponent implements OnChanges {
  @Input() categories: string[] = [];
  @Input() amounts: number[] = [];
  @Input() title = 'Procurement Cost Analysis';
  @Input() centerTotalText = '₹ 8.6M';
  @Input() loading = false;
  @Input() height = 240;

  chartData: ChartData | null = null;
  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: { family: "'Inter', sans-serif", size: 10 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw as number;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return ` ${ctx.label}: ₹ ${val}L (${pct}%)`;
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
    const cats = this.categories.length ? this.categories : ['Raw Materials', 'Packaging', 'Electronics', 'Logistics', 'Other'];
    const data = this.amounts.length ? this.amounts : [38, 25, 18, 12, 7];

    this.chartData = {
      labels: cats,
      datasets: [
        {
          data: data,
          backgroundColor: CATEGORY_PALETTE.slice(0, cats.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
  }
}
