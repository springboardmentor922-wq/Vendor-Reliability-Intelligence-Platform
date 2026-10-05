import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface Kpi {
  key: string;
  label: string;
  value: number | null;
  delta_pct: number | null;
  delta_unit?: string;
  hint: string;
  format: 'number' | 'currency' | 'percent' | 'score';
  good_when_up: boolean;
}

export interface SliceDatum {
  label: string;
  value: number;
  status?: string;
}

export interface ActivityItem {
  id: number;
  user_name: string;
  entity_type: string;
  entity_id: number | null;
  action: string;
  description: string | null;
  created_at: string | null;
}

export interface DashboardFilters {
  start?: string | null;
  end?: string | null;
  vendor_id?: number | null;
  category?: string | null;
  risk_level?: string | null;
  months?: number | null;
}

// ---------------------------------------------------------------------------
// Procurement dashboard
// ---------------------------------------------------------------------------

export interface OpenOrder {
  id: number;
  po_number: string;
  vendor_id: number;
  vendor_name: string | null;
  title: string | null;
  total_amount: number;
  currency: string;
  status: string;
  order_date: string | null;
  expected_delivery: string | null;
  days_late: number;
}

export interface ProcurementDashboard {
  generated_at: string;
  kpis: Kpi[];
  procurement_overview: {
    series: { period: string; cost: number; orders: number }[];
    total_requests: number;
    pending_requests: number;
    approved_requests: number;
    completed_requests: number;
    procurement_value: number;
    completion_rate: number;
  };
  active_purchase_orders: {
    slices: SliceDatum[];
    active_total: number;
    pending: number;
    in_transit: number;
    overdue: number;
    active_value: number;
    list: OpenOrder[];
  };
  vendor_performance: {
    radar: {
      axes: string[];
      top_vendor: { vendor_id: number; vendor_name: string; overall_score: number; values: number[] } | null;
      average: number[];
    };
    performance_score: number;
    quality_rating: number;
    on_time_delivery_rate: number;
    avg_response_time_hours: number;
    issue_resolution_rate: number;
    order_completion_rate: number;
  };
  cost_analysis: {
    total_cost: number;
    budget: number;
    actual: number;
    variance: number;
    variance_pct: number;
    by_category: { category: string; spend: number; orders: number; share: number }[];
    by_vendor: { vendor_id: number; vendor_name: string; category: string; spend: number; orders: number; share: number }[];
  };
  delivery_status: {
    on_time_rate: number;
    total_deliveries: number;
    on_time: number;
    delayed: number;
    pending: number;
    breakdown: SliceDatum[];
  };
  recent_activity: ActivityItem[];
}

// ---------------------------------------------------------------------------
// Vendor dashboard
// ---------------------------------------------------------------------------

export interface VendorDashboard {
  generated_at: string;
  vendor: {
    id: number;
    vendor_code: string;
    vendor_name: string;
    category: string;
    status: string;
    risk_level: string;
    city: string | null;
    country: string | null;
  };
  kpis: Kpi[];
  vendor_performance: {
    mode: 'months' | 'peers';
    series: string[];
    groups: { label: string; vendor_id?: number; values: number[] }[];
    on_time_delivery_rate: number;
    quality_rating: number;
    avg_response_time_hours: number;
    avg_issue_resolution_hours: number;
    order_completion_rate: number;
  };
  reliability: {
    trend: { date: string; score: number; risk_level: string }[];
    current: {
      overall: number | null;
      factors: { label: string; value: number }[];
      risk_level: string;
      trend: string | null;
      rank_position: number | null;
      recommendation: string | null;
      predicted_delay_risk: number | null;
    };
  };
  contract_status: {
    slices: SliceDatum[];
    total: number;
    compliance_rate: number;
    compliant: number;
    non_compliant: number;
    expiring_soon: { id: number; contract_number: string; expiry_date: string; days_to_expiry: number }[];
  };
  order_history: {
    series: { period: string; value: number; orders: number }[];
    total_orders: number;
    completed: number;
    pending: number;
    cancelled: number;
    delayed: number;
    order_value: number;
    recent: {
      id: number;
      po_number: string;
      title: string | null;
      status: string;
      total_amount: number;
      currency: string;
      order_date: string | null;
      expected_delivery: string | null;
    }[];
  };
  communication: {
    slices: SliceDatum[];
    total_messages: number;
    open_queries: number;
    resolved_queries: number;
    avg_response_hours: number;
    resolution_rate: number;
  };
  delivery: {
    total_deliveries: number;
    on_time_deliveries: number;
    delayed_deliveries: number;
    pending_deliveries: number;
    delivery_rate: number;
  };
  recent_activity: ActivityItem[];
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

export interface AdminDashboard {
  generated_at: string;
  kpis: Kpi[];
  user_management: {
    slices: SliceDatum[];
    total: number;
    active: number;
    inactive: number;
    pending_approvals: number;
    pending_vendor_logins: number;
  };
  vendor_analytics: {
    risk: SliceDatum[];
    by_category: Record<string, number>;
    by_status: Record<string, number>;
    total: number;
    active: number;
    high_risk: number;
    average_reliability: number;
    at_risk: {
      vendor_id: number;
      vendor_name: string;
      vendor_code: string;
      category: string;
      risk_level: string;
      reliability_score: number;
      trend: string;
      predicted_delay_risk: number | null;
      recommendation: string;
    }[];
    reliability_trend: { period: string; average: number; vendors: number }[];
  };
  procurement_reports: {
    series: { period: string; value: number; orders: number }[];
    total_requests: number;
    total_orders: number;
    procurement_value: number;
    pending_approvals: number;
    completion_rate: number;
  };
  compliance: {
    slices: SliceDatum[];
    compliance_rate: number;
    compliant_vendors: number;
    non_compliant_vendors: number;
    expired_certifications: number;
    expiring_certifications: number;
    flagged: { vendor_id: number; vendor_name: string; status: string; reason: string }[];
  };
  system: SystemStats & {
    total_users: number;
    total_vendors: number;
    total_purchase_orders: number;
    total_requests: number;
    total_contracts: number;
    total_invoices: number;
    total_messages: number;
    total_transactions: number;
    total_performance_records: number;
    total_reliability_snapshots: number;
    database_quota_bytes: number;
  };
  recent_activity: ActivityItem[];
}

export interface SystemStats {
  uptime_seconds: number;
  availability_pct: number;
  api_avg_ms: number;
  api_p95_ms: number;
  requests_last_minute: number;
  active_sessions: number;
  session_window_minutes: number;
  storage_bytes: number;
  database_bytes: number;
  total_requests: number;
  latency_series: { minute: string; requests: number; avg_ms: number }[];
}

export interface FilterOptions {
  categories: string[];
  risk_levels: string[];
  vendors: { id: number; name: string; category: string }[];
}

// ---------------------------------------------------------------------------
// Data import
// ---------------------------------------------------------------------------

export interface ImportSheet {
  sheet: string;
  entity: string;
  entity_label: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  mapped_columns: Record<string, string>;
  ignored_columns: string[];
  sample: Record<string, unknown>[];
}

export interface ImportReport {
  token?: string;
  file_name: string;
  file_format: string;
  mode: 'workbook' | 'dataco';
  committed: boolean;
  totals: { rows: number; created: number; updated: number; skipped: number; errors: number };
  sheets: ImportSheet[];
  unrecognised_sheets: string[];
  errors: { sheet: string; row: number; message: string }[];
  notes: string[];
  post_processing: Record<string, unknown>;
  dataco?: { rows: number; orders: number | null; first_order: string | null; last_order: string | null };
}

export interface ImportHistoryRow {
  id: number;
  file_name: string;
  file_format: string;
  mode: string;
  status: string;
  rows_read: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  created_at: string;
  imported_by: string | null;
}

// ---------------------------------------------------------------------------
// Vendor application
// ---------------------------------------------------------------------------

export interface ApplicationOptions {
  categories: string[];
  company_types: string[];
  document_types: string[];
}

export interface ApplicationResult {
  vendor_id: number;
  vendor_code: string;
  vendor_name: string;
  status: string;
  documents_received: number;
  certifications_recorded: number;
  account_created: boolean;
  access_token?: string | null;
  refresh_token?: string | null;
  message: string;
}

function params(filters: DashboardFilters = {}): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') {
      p = p.set(key, String(value));
    }
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class DashboardsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  procurement(filters: DashboardFilters = {}): Observable<ProcurementDashboard> {
    return this.http.get<ProcurementDashboard>(`${this.base}/dashboards/procurement`, { params: params(filters) });
  }

  vendor(filters: DashboardFilters = {}): Observable<VendorDashboard> {
    return this.http.get<VendorDashboard>(`${this.base}/dashboards/vendor`, { params: params(filters) });
  }

  admin(filters: DashboardFilters = {}): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.base}/dashboards/admin`, { params: params(filters) });
  }

  system(): Observable<SystemStats> {
    return this.http.get<SystemStats>(`${this.base}/dashboards/system`);
  }

  filterOptions(): Observable<FilterOptions> {
    return this.http.get<FilterOptions>(`${this.base}/analytics/filters`);
  }
}

@Injectable({ providedIn: 'root' })
export class DataImportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/data-import`;

  preview(file: File): Observable<ImportReport> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportReport>(`${this.base}/preview`, form);
  }

  commit(token: string, options: { dataco_orders?: number; dataco_months?: number } = {}): Observable<ImportReport> {
    return this.http.post<ImportReport>(`${this.base}/commit`, { token, ...options });
  }

  history(): Observable<ImportHistoryRow[]> {
    return this.http.get<ImportHistoryRow[]>(`${this.base}/history`);
  }

  template(): Observable<Blob> {
    return this.http.get(`${this.base}/template`, { responseType: 'blob' });
  }
}

@Injectable({ providedIn: 'root' })
export class VendorApplicationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-applications`;

  options(): Observable<ApplicationOptions> {
    return this.http.get<ApplicationOptions>(`${this.base}/options`);
  }

  submit(payload: unknown, documents: { file: File; type: string }[]): Observable<ApplicationResult> {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    for (const doc of documents) {
      form.append('files', doc.file, doc.file.name);
      form.append('document_types', doc.type);
    }
    return this.http.post<ApplicationResult>(this.base, form);
  }
}
