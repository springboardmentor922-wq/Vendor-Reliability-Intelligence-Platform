/**
 * Milestone 3 API clients: vendor performance, reliability scoring,
 * analytics and reporting.
 *
 * Every method takes the same optional filter object so a screen can pass
 * its filter state straight through — the query string is built from it and
 * empty values are dropped.
 */

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  AdminAnalytics,
  AlertSweepResult,
  AnalyticsFilterOptions,
  AnalyticsFilters,
  CategoryPerformance,
  CostAnalysis,
  DelayPrediction,
  DeliveryStatusSummary,
  GeneratedReport,
  ModelInfo,
  PerformanceMetrics,
  PerformanceSummaryRow,
  PerformanceTrendPoint,
  ProcurementAnalytics,
  RankingRow,
  ReliabilityHistoryPoint,
  ReportDefinition,
  RiskSummary,
  SpendPoint,
  VendorDashboardAnalytics,
  VendorRecommendation,
  VendorReliability,
} from './models-m3';

/**
 * Drops null/undefined/empty values so unset filters stay out of the URL.
 *
 * Takes a plain object rather than `Record<string, unknown>` so the typed
 * filter interfaces can be passed straight in without a cast.
 */
function toParams(filters: object = {}): HttpParams {
  let params = new HttpParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    params = params.set(key, String(value));
  }

  return params;
}

@Injectable({ providedIn: 'root' })
export class VendorPerformanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-performance`;

  metrics(filters: AnalyticsFilters = {}): Observable<PerformanceMetrics> {
    return this.http.get<PerformanceMetrics>(`${this.base}/metrics`, {
      params: toParams(filters),
    });
  }

  trend(
    filters: AnalyticsFilters & { months?: number } = {},
  ): Observable<PerformanceTrendPoint[]> {
    return this.http.get<PerformanceTrendPoint[]>(`${this.base}/trend`, {
      params: toParams(filters),
    });
  }

  summary(filters: AnalyticsFilters = {}): Observable<PerformanceSummaryRow[]> {
    return this.http.get<PerformanceSummaryRow[]>(`${this.base}/summary`, {
      params: toParams(filters),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class ReliabilityService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reliability`;

  model(): Observable<ModelInfo> {
    return this.http.get<ModelInfo>(`${this.base}/model`);
  }

  ranking(
    filters: { category?: string | null; risk_level?: string | null; limit?: number } = {},
  ): Observable<RankingRow[]> {
    return this.http.get<RankingRow[]>(`${this.base}/ranking`, {
      params: toParams(filters),
    });
  }

  risk(filters: { category?: string | null } = {}): Observable<RiskSummary> {
    return this.http.get<RiskSummary>(`${this.base}/risk`, {
      params: toParams(filters),
    });
  }

  forVendor(vendorId: number): Observable<VendorReliability> {
    return this.http.get<VendorReliability>(`${this.base}/vendor/${vendorId}`);
  }

  history(
    vendorId: number,
    limit = 60,
  ): Observable<ReliabilityHistoryPoint[]> {
    return this.http.get<ReliabilityHistoryPoint[]>(
      `${this.base}/vendor/${vendorId}/history`,
      { params: toParams({ limit }) },
    );
  }

  recommendation(vendorId: number): Observable<VendorRecommendation> {
    return this.http.get<VendorRecommendation>(
      `${this.base}/vendor/${vendorId}/recommendation`,
    );
  }

  predictions(
    filters: { vendor_id?: number | null; risk_band?: string | null; limit?: number } = {},
  ): Observable<DelayPrediction[]> {
    return this.http.get<DelayPrediction[]>(`${this.base}/predictions`, {
      params: toParams(filters),
    });
  }

  predictOrder(orderId: number): Observable<DelayPrediction> {
    return this.http.get<DelayPrediction>(
      `${this.base}/predictions/purchase-order/${orderId}`,
    );
  }

  recalculate(): Observable<{
    vendors_scored: number;
    vendors_ranked: number;
    risk_distribution: Record<string, number>;
    calculated_at: string;
  }> {
    return this.http.post<{
      vendors_scored: number;
      vendors_ranked: number;
      risk_distribution: Record<string, number>;
      calculated_at: string;
    }>(`${this.base}/recalculate`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/analytics`;

  filterOptions(): Observable<AnalyticsFilterOptions> {
    return this.http.get<AnalyticsFilterOptions>(`${this.base}/filters`);
  }

  procurement(filters: AnalyticsFilters = {}): Observable<ProcurementAnalytics> {
    return this.http.get<ProcurementAnalytics>(`${this.base}/procurement`, {
      params: toParams(filters),
    });
  }

  vendor(filters: AnalyticsFilters = {}): Observable<VendorDashboardAnalytics> {
    return this.http.get<VendorDashboardAnalytics>(`${this.base}/vendor`, {
      params: toParams(filters),
    });
  }

  admin(filters: AnalyticsFilters = {}): Observable<AdminAnalytics> {
    return this.http.get<AdminAnalytics>(`${this.base}/admin`, {
      params: toParams(filters),
    });
  }

  spend(
    filters: AnalyticsFilters & { months?: number } = {},
  ): Observable<SpendPoint[]> {
    return this.http.get<SpendPoint[]>(`${this.base}/spend`, {
      params: toParams(filters),
    });
  }

  delivery(filters: AnalyticsFilters = {}): Observable<DeliveryStatusSummary> {
    return this.http.get<DeliveryStatusSummary>(`${this.base}/delivery`, {
      params: toParams(filters),
    });
  }

  cost(filters: AnalyticsFilters = {}): Observable<CostAnalysis> {
    return this.http.get<CostAnalysis>(`${this.base}/cost`, {
      params: toParams(filters),
    });
  }

  categories(filters: AnalyticsFilters = {}): Observable<CategoryPerformance[]> {
    return this.http.get<CategoryPerformance[]>(`${this.base}/categories`, {
      params: toParams(filters),
    });
  }

  trend(
    filters: AnalyticsFilters & { months?: number } = {},
  ): Observable<PerformanceTrendPoint[]> {
    return this.http.get<PerformanceTrendPoint[]>(`${this.base}/trend`, {
      params: toParams(filters),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reports`;

  catalogue(): Observable<ReportDefinition[]> {
    return this.http.get<ReportDefinition[]>(this.base);
  }

  generate(
    key: string,
    filters: AnalyticsFilters & { limit?: number } = {},
  ): Observable<GeneratedReport> {
    return this.http.get<GeneratedReport>(`${this.base}/${key}`, {
      params: toParams(filters),
    });
  }

  /**
   * Downloads a report as a PDF or Excel workbook.
   *
   * The response is a binary blob rather than JSON, and the filename comes
   * back on the Content-Disposition header, so the download is driven from
   * the response rather than from a guessed name.
   */
  download(
    key: string,
    format: 'pdf' | 'excel',
    filters: AnalyticsFilters = {},
  ): Observable<{ blob: Blob; filename: string }> {
    return new Observable((subscriber) => {
      const subscription = this.http
        .get(`${this.base}/${key}/export`, {
          params: toParams({ ...filters, format }),
          responseType: 'blob',
          observe: 'response',
        })
        .subscribe({
          next: (response) => {
            const disposition =
              response.headers.get('content-disposition') ?? '';

            const match = /filename="?([^"]+)"?/.exec(disposition);

            subscriber.next({
              blob: response.body as Blob,
              filename:
                match?.[1] ??
                `${key}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
            });
            subscriber.complete();
          },
          error: (error) => subscriber.error(error),
        });

      return () => subscription.unsubscribe();
    });
  }
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly http = inject(HttpClient);

  /** Re-derives every alert from the current state of the database. */
  runSweep(): Observable<AlertSweepResult> {
    return this.http.post<AlertSweepResult>(
      `${environment.apiUrl}/notifications/sweep`,
      {},
    );
  }
}

/** Triggers a browser download for a blob returned by the API. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
