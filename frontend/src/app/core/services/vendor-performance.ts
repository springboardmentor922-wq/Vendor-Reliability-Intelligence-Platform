import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface VendorPerformanceSummary {
  vendor_id: number;
  vendor_name: string;
  category: string;
  vendor_status: string;

  total_orders: number;
  on_time_deliveries: number;
  delayed_deliveries: number;

  quality_rating: number | null;
  service_rating: number | null;

  response_time_hours: number | null;
  issue_resolution_time_hours: number | null;

  order_completion_rate: number;
  performance_score: number;
  ranking: number;

  performance_status: string;
}

export interface VendorPerformanceHistory {
  id: number;
  vendor_id: number;
  vendor_name: string;

  purchase_order_id: number | null;
  purchase_order_number: string | null;

  expected_delivery_date: string | null;
  actual_delivery_date: string | null;

  delivery_status: string;

  quality_rating: number | null;
  service_rating: number | null;

  response_time_hours: number | null;
  issue_resolution_time_hours: number | null;

  issue_count: number;
  notes: string | null;

  evaluation_date: string;
}

export interface VendorPerformanceCreate {
  vendor_id: number;
  purchase_order_id: number | null;

  actual_delivery_date: string | null;

  quality_rating: number | null;
  service_rating: number | null;

  response_time_hours: number | null;
  issue_resolution_time_hours: number | null;

  issue_count: number;
  notes: string | null;

  evaluation_date: string;
}

@Injectable({
  providedIn: 'root'
})
export class VendorPerformanceService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/vendor-performance';

  constructor(private http: HttpClient) {}

  /**
   * Get calculated performance summaries for all vendors.
   *
   * PostgreSQL Numeric/Decimal values can be serialized by FastAPI
   * as strings. Convert those values to JavaScript numbers here so
   * the Angular UI can safely perform calculations and formatting.
   */
  getPerformance(): Observable<VendorPerformanceSummary[]> {
    return this.http
      .get<VendorPerformanceSummary[]>(this.apiUrl)
      .pipe(
        map((vendors) =>
          vendors.map((vendor) => ({
            ...vendor,

            total_orders: Number(vendor.total_orders),
            on_time_deliveries: Number(vendor.on_time_deliveries),
            delayed_deliveries: Number(vendor.delayed_deliveries),

            quality_rating:
              vendor.quality_rating === null
                ? null
                : Number(vendor.quality_rating),

            service_rating:
              vendor.service_rating === null
                ? null
                : Number(vendor.service_rating),

            response_time_hours:
              vendor.response_time_hours === null
                ? null
                : Number(vendor.response_time_hours),

            issue_resolution_time_hours:
              vendor.issue_resolution_time_hours === null
                ? null
                : Number(vendor.issue_resolution_time_hours),

            order_completion_rate:
              Number(vendor.order_completion_rate),

            performance_score:
              Number(vendor.performance_score),

            ranking:
              Number(vendor.ranking)
          }))
        )
      );
  }

  /**
   * Alias used by the Performance page.
   */
  getPerformanceSummaries(): Observable<VendorPerformanceSummary[]> {
    return this.getPerformance();
  }

  /**
   * Get performance history for one vendor.
   */
  getHistory(
    vendorId: number
  ): Observable<VendorPerformanceHistory[]> {
    return this.http
      .get<VendorPerformanceHistory[]>(
        `${this.apiUrl}/${vendorId}/history`
      )
      .pipe(
        map((history) =>
          history.map((item) => ({
            ...item,

            purchase_order_id:
              item.purchase_order_id === null
                ? null
                : Number(item.purchase_order_id),

            quality_rating:
              item.quality_rating === null
                ? null
                : Number(item.quality_rating),

            service_rating:
              item.service_rating === null
                ? null
                : Number(item.service_rating),

            response_time_hours:
              item.response_time_hours === null
                ? null
                : Number(item.response_time_hours),

            issue_resolution_time_hours:
              item.issue_resolution_time_hours === null
                ? null
                : Number(item.issue_resolution_time_hours),

            issue_count:
              Number(item.issue_count)
          }))
        )
      );
  }

  /**
   * Alias used by the Performance page.
   */
  getVendorHistory(
    vendorId: number
  ): Observable<VendorPerformanceHistory[]> {
    return this.getHistory(vendorId);
  }

  /**
   * Create a vendor performance evaluation.
   */
  createEvaluation(
    data: VendorPerformanceCreate
  ): Observable<VendorPerformanceHistory> {
    return this.http.post<VendorPerformanceHistory>(
      this.apiUrl,
      data
    );
  }

  /**
   * Delete a vendor performance evaluation.
   */
  deleteEvaluation(
    evaluationId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/evaluations/${evaluationId}`
    );
  }
}