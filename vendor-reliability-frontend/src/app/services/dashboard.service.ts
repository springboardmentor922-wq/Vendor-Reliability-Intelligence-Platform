import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { API_CONFIG } from './api.config';

export interface VendorPortalData {
  vendor_id: number;
  vendor_name: string;
  company: string;
  category: string;
  status: string;
  delivery_rate: number;
  quality_rating: number;
  response_time_hours: number;
  risk_level: string;
  assigned_pos_count: number;
  active_contracts_count: number;
  invoices_count: number;
  reliability_score: number;
  sla_compliance_rate: number;
  tier: string;
}

export interface ProcurementDashboardOverview {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  completed_requests: number;
  procurement_value: number;
  completion_rate: number;
}

export interface ActivePurchaseOrdersSummary {
  active_pos: number;
  pending_orders: number;
  in_transit_orders: number;
  overdue_pos: number;
  po_value: number;
}

export interface VendorPerformanceSummary {
  performance_score: number;
  quality_rating: number;
  on_time_delivery_rate: number;
  response_time_hours: number;
  issue_resolution_rate: number;
}

export interface ProcurementCostAnalysis {
  total_cost: number;
  cost_by_vendor: Record<string, number>;
  cost_by_category: Record<string, number>;
  budget: number;
  actual_spend: number;
  cost_variance: number;
  cost_variance_pct: number;
}

export interface DeliveryStatusSummary {
  total_deliveries: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  pending_deliveries: number;
  delivery_rate: number;
}

export interface ProcurementDashboardData {
  overview: ProcurementDashboardOverview;
  active_purchase_orders: ActivePurchaseOrdersSummary;
  vendor_performance_summary: VendorPerformanceSummary;
  procurement_cost_analysis: ProcurementCostAnalysis;
  delivery_status: DeliveryStatusSummary;
}

export interface VendorDashboardData {
  vendor_id: number;
  vendor_name: string;
  company: string;
  category: string;
  performance: {
    performance_score: number;
    delivery_rate: number;
    quality_rating: number;
    response_time_hours: number;
    issue_resolution_time_hours: number;
  };
  reliability_score: {
    overall_reliability: number;
    delivery_score: number;
    quality_score: number;
    communication_score: number;
    compliance_score: number;
  };
  contract_status: {
    active_contracts: number;
    expiring_contracts: number;
    expired_contracts: number;
    renewed_contracts: number;
    compliance_status: string;
  };
  order_history: {
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    delayed_orders: number;
    order_value: number;
  };
  communication_activity: {
    total_messages: number;
    open_queries: number;
    resolved_queries: number;
    response_time_hours: number;
    activity_count: number;
  };
}

export interface AdminDashboardData {
  user_management: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    users_by_role: Record<string, number>;
    pending_approvals: number;
  };
  vendor_analytics: {
    total_vendors: number;
    active_vendors: number;
    vendors_by_category: Record<string, number>;
    high_risk_vendors: number;
    avg_reliability: number;
    performance_trends: { month: string; score: number }[];
  };
  procurement_reports: {
    total_requests: number;
    total_pos: number;
    procurement_value: number;
    pending_approvals: number;
    completion_rate: number;
  };
  compliance_monitoring: {
    compliance_rate: number;
    compliant_vendors: number;
    non_compliant_vendors: number;
    expiring_certifications: number;
    expired_certifications: number;
  };
  system_statistics: {
    total_users: number;
    total_vendors: number;
    total_pos: number;
    total_requests: number;
    total_contracts: number;
    total_transactions: number;
    system_activity: number;
    system_uptime: string;
    system_status: string;
  };
}

export interface DashboardStats {
  // Modular 3 Dashboards
  procurement_dashboard?: ProcurementDashboardData;
  vendor_dashboard?: VendorDashboardData;
  admin_dashboard?: AdminDashboardData;

  // Legacy / Core
  total_vendors: number;
  approved_vendors: number;
  pending_vendors: number;
  high_risk_vendors: number;
  total_procurement_requests: number;
  pending_procurement_requests: number;
  active_purchase_orders: number;
  active_contracts: number;
  compliant_contracts: number;
  avg_reliability_score: number;
  avg_quality_score: number;
  user_role: string;
  user_name: string;

  // Admin / System
  system_status?: string;
  system_uptime?: string;
  api_response_avg_ms?: number;
  total_users?: number;
  active_users?: number;
  role_distribution?: Record<string, number>;
  total_audit_logs?: number;
  total_db_records?: number;

  // Procurement Manager
  approved_procurement_requests?: number;
  ordered_procurement_requests?: number;
  total_pr_budget?: number;
  total_po_amount?: number;
  category_spend?: Record<string, number>;

  // Supply Chain Manager
  on_time_delivery_rate?: number;
  delayed_deliveries_count?: number;
  logistics_partners_count?: number;
  order_completion_rate?: number;
  in_transit_pos_count?: number;

  // Vendor Portal
  vendor_portal?: VendorPortalData | null;

  // Finance Officer
  total_invoices?: number;
  submitted_invoices?: number;
  approved_invoices?: number;
  paid_invoices?: number;
  total_invoiced_amount?: number;
  total_paid_amount?: number;
  pending_payout_amount?: number;
  total_contract_value?: number;

  // Auditor
  contract_compliance_rate?: number;
  medium_risk_vendors?: number;
  low_risk_vendors?: number;
  certification_compliance_rate?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${API_CONFIG.baseUrl}/dashboard`;
  private cachedStats: DashboardStats | null = null;
  private lastFetchTime = 0;
  private cachedSummaries = new Map<string, { data: any; time: number }>();
  private readonly summaryTtlMs = 60000; // 60 seconds instant cache

  constructor(private http: HttpClient) {}

  getStats(forceRefresh = false): Observable<DashboardStats> {
    const now = Date.now();
    if (!forceRefresh && this.cachedStats && (now - this.lastFetchTime < API_CONFIG.cacheTtlMs)) {
      return of(this.cachedStats);
    }
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`).pipe(
      tap(stats => {
        this.cachedStats = stats;
        this.lastFetchTime = Date.now();
      })
    );
  }

  clearCache(): void {
    this.cachedStats = null;
    this.lastFetchTime = 0;
    this.cachedSummaries.clear();
  }

  getProcurementSummary(category?: string, startDate?: string, endDate?: string, status?: string, forceRefresh = false): Observable<any> {
    const key = `procurement_${category || ''}_${startDate || ''}_${endDate || ''}_${status || ''}`;
    const now = Date.now();
    const cached = this.cachedSummaries.get(key);
    if (!forceRefresh && cached && (now - cached.time < this.summaryTtlMs)) {
      return of(cached.data);
    }
    let params: any = {};
    if (category && category !== 'All Categories') params.category = category;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (status && status !== 'All') params.status = status;
    return this.http.get<any>(`${this.apiUrl}/procurement-summary`, { params }).pipe(
      tap(data => this.cachedSummaries.set(key, { data, time: Date.now() }))
    );
  }

  getVendorSummary(vendorId?: number, forceRefresh = false): Observable<any> {
    const key = `vendor_${vendorId || 0}`;
    const now = Date.now();
    const cached = this.cachedSummaries.get(key);
    if (!forceRefresh && cached && (now - cached.time < this.summaryTtlMs)) {
      return of(cached.data);
    }
    const params: any = {};
    if (vendorId) params.vendor_id = vendorId;
    return this.http.get<any>(`${this.apiUrl}/vendor-summary`, { params }).pipe(
      tap(data => this.cachedSummaries.set(key, { data, time: Date.now() }))
    );
  }

  getAdminSummary(forceRefresh = false): Observable<any> {
    const key = 'admin_summary';
    const now = Date.now();
    const cached = this.cachedSummaries.get(key);
    if (!forceRefresh && cached && (now - cached.time < this.summaryTtlMs)) {
      return of(cached.data);
    }
    return this.http.get<any>(`${this.apiUrl}/admin-summary`).pipe(
      tap(data => this.cachedSummaries.set(key, { data, time: Date.now() }))
    );
  }

  getFinanceSummary(forceRefresh = false): Observable<any> {
    const key = 'finance_summary';
    const now = Date.now();
    const cached = this.cachedSummaries.get(key);
    if (!forceRefresh && cached && (now - cached.time < this.summaryTtlMs)) {
      return of(cached.data);
    }
    return this.http.get<any>(`${this.apiUrl}/finance-summary`).pipe(
      tap(data => this.cachedSummaries.set(key, { data, time: Date.now() }))
    );
  }

  getSupplyChainSummary(forceRefresh = false): Observable<any> {
    const key = 'supply_chain_summary';
    const now = Date.now();
    const cached = this.cachedSummaries.get(key);
    if (!forceRefresh && cached && (now - cached.time < this.summaryTtlMs)) {
      return of(cached.data);
    }
    return this.http.get<any>(`${this.apiUrl}/supply-chain-summary`).pipe(
      tap(data => this.cachedSummaries.set(key, { data, time: Date.now() }))
    );
  }

  getAuditSummary(forceRefresh = false): Observable<any> {
    const key = 'audit_summary';
    const now = Date.now();
    const cached = this.cachedSummaries.get(key);
    if (!forceRefresh && cached && (now - cached.time < this.summaryTtlMs)) {
      return of(cached.data);
    }
    return this.http.get<any>(`${this.apiUrl}/audit-summary`).pipe(
      tap(data => this.cachedSummaries.set(key, { data, time: Date.now() }))
    );
  }
}
