import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface VendorPerformance {
  id: number;
  vendor_name: string;
  delivery_score: number;
  quality_score: number;
  reliability_score: number;
  status: string;
  created_at: string;
}

@Component({
  selector: 'app-vendor-performance',
  standalone: true,
  imports: [CommonModule],

  template: `
    <div class="container-fluid p-4">

      <h1>Vendor Performance</h1>
      <p>Monitor vendor performance and reliability</p>

      <div class="card p-4 mt-4">

        <h2>Vendor Performance Overview</h2>

        <table class="table table-dark table-hover mt-3">

          <thead>
            <tr>
              <th>Vendor</th>
              <th>Delivery Score</th>
              <th>Quality Score</th>
              <th>Reliability</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr *ngFor="let performance of performances">

              <td>{{ performance.vendor_name }}</td>

              <td>{{ performance.delivery_score }}%</td>

              <td>{{ performance.quality_score }}%</td>

              <td>{{ performance.reliability_score }}%</td>

              <td>
                <span class="badge bg-success">
                  {{ performance.status }}
                </span>
              </td>

            </tr>
          </tbody>

        </table>

        <p *ngIf="performances.length === 0">
          No performance records found.
        </p>

      </div>

    </div>
  `,

  styles: [`
    h1 {
      color: white;
      font-weight: 700;
    }

    p {
      color: #888;
    }

    .card {
      background: white;
      border-radius: 12px;
    }
  `]
})

export class VendorPerformanceComponent implements OnInit {

  performances: VendorPerformance[] = [];

  private apiUrl =
    'http://localhost:8000/api/vendor-performance/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadPerformances();
  }

  loadPerformances(): void {

    this.http
      .get<VendorPerformance[]>(this.apiUrl)
      .subscribe({
        next: (data) => {
          this.performances = data;
        },

        error: (error) => {
          console.error('Failed to load performance data', error);
        }
      });

  }

}