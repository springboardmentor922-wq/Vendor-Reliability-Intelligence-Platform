import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { AppChartComponent } from './app-chart.component';
import { CHART_COLORS } from './chart-theme';

@Component({
  selector: 'app-delivery-status-chart',
  standalone: true,
  imports: [CommonModule, AppChartComponent],
  template: `
    <div class="delivery-status-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0 text-dark">
          <i class="bi bi-truck text-primary me-1"></i> Delivery Status
        </h6>
      </div>

      <div class="row g-2 align-items-center">
        <!-- Gauge Chart -->
        <div class="col-sm-6 text-center">
          <app-chart
            type="doughnut"
            [data]="chartData"
            [options]="chartOptions"
            [height]="160"
            [centerText]="onTimeRate + '%'"
            centerSubtext="On-Time Delivery"
            [loading]="loading">
          </app-chart>
        </div>

        <!-- Breakdown List -->
        <div class="col-sm-6">
          <div class="status-breakdown-list d-flex flex-column gap-2">
            <div class="d-flex justify-content-between align-items-center p-1 px-2 rounded-2 bg-light border">
              <span class="small d-flex align-items-center">
                <span class="badge-dot bg-success me-2"></span> Delivered
              </span>
              <span class="small fw-bold">{{ deliveredPct }}% <span class="text-muted fw-normal smaller">({{ deliveredCount }})</span></span>
            </div>
            <div class="d-flex justify-content-between align-items-center p-1 px-2 rounded-2 bg-light border">
              <span class="small d-flex align-items-center">
                <span class="badge-dot bg-info me-2"></span> In Transit
              </span>
              <span class="small fw-bold">{{ inTransitPct }}% <span class="text-muted fw-normal smaller">({{ inTransitCount }})</span></span>
            </div>
            <div class="d-flex justify-content-between align-items-center p-1 px-2 rounded-2 bg-light border">
              <span class="small d-flex align-items-center">
                <span class="badge-dot bg-warning me-2"></span> Delayed
              </span>
              <span class="small fw-bold">{{ delayedPct }}% <span class="text-muted fw-normal smaller">({{ delayedCount }})</span></span>
            </div>
            <div class="d-flex justify-content-between align-items-center p-1 px-2 rounded-2 bg-light border">
              <span class="small d-flex align-items-center">
                <span class="badge-dot bg-danger me-2"></span> Cancelled
              </span>
              <span class="small fw-bold">{{ cancelledPct }}% <span class="text-muted fw-normal smaller">({{ cancelledCount }})</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .badge-dot {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 2px;
    }
    .smaller {
      font-size: 0.72rem;
    }
  `]
})
export class DeliveryStatusChartComponent implements OnChanges {
  @Input() deliveredCount = 124;
  @Input() deliveredPct = 52;
  @Input() inTransitCount = 68;
  @Input() inTransitPct = 28;
  @Input() delayedCount = 36;
  @Input() delayedPct = 15;
  @Input() cancelledCount = 12;
  @Input() cancelledPct = 5;
  @Input() onTimeRate = 78;
  @Input() loading = false;

  chartData: ChartData | null = null;
  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.raw}%`
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
    this.chartData = {
      labels: ['Delivered', 'In Transit', 'Delayed', 'Cancelled'],
      datasets: [
        {
          data: [this.deliveredPct, this.inTransitPct, this.delayedPct, this.cancelledPct],
          backgroundColor: [
            CHART_COLORS.success,
            CHART_COLORS.info,
            CHART_COLORS.delayed,
            CHART_COLORS.danger
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
  }
}
