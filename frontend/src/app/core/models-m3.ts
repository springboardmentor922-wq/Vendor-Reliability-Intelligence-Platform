/**
 * Milestone 3 types: performance monitoring, reliability scoring, delivery
 * prediction, analytics and reporting.
 *
 * Kept separate from `models.ts` (which covers Milestones 1 and 2) purely so
 * the two milestones stay easy to read side by side. `models.ts` re-exports
 * everything here, so importing from either path works.
 */

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type PerformanceTrendDirection = 'Improving' | 'Stable' | 'Declining';

export interface CommunicationMetrics {
  total_threads: number;
  open_threads: number;
  resolved_threads: number;
  resolution_rate: number;
  avg_response_hours: number | null;
  threads_measured: number;
}

export interface ComplianceMetrics {
  total_checks: number;
  compliant_checks: number;
  partial_checks: number;
  failed_checks: number;
  compliance_rate: number;
  total_contracts: number;
  compliant_contracts: number;
  non_compliant_contracts: number;
  total_certifications: number;
  expired_certifications: number;
  expiring_certifications: number;
}

/** The six metrics the Vendor Performance module is required to report. */
export interface PerformanceMetrics {
  vendor_id: number | null;
  vendor_name: string | null;

  total_orders: number;
  delivered_orders: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  cancelled_orders: number;
  completed_orders: number;
  active_orders: number;
  pending_deliveries: number;
  overdue_orders: number;

  on_time_rate: number;
  delay_rate: number;
  delivery_rate: number;
  order_completion_rate: number;
  avg_delay_days: number;
  max_delay_days: number;

  total_spend: number;
  avg_order_value: number;

  evaluations: number;
  quality_rating: number;
  service_rating: number;
  avg_response_time_hours: number;
  avg_issue_resolution_hours: number;
  avg_order_completion_rate: number;

  communication: CommunicationMetrics;
  compliance: ComplianceMetrics;
}

export interface PerformanceTrendPoint {
  period: string;
  orders: number;
  delivered: number;
  on_time: number;
  delayed: number;
  on_time_rate: number;
  avg_delay_days: number;
  spend: number;
  quality_rating: number;
  avg_response_hours: number;
}

export interface PerformanceSummaryRow {
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  category: string;
  status: string;
  orders: number;
  delivered: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  on_time_rate: number;
  avg_delay_days: number;
  total_spend: number;
}

export interface ReliabilityFactors {
  delivery: number | null;
  quality: number | null;
  communication: number | null;
  compliance: number | null;
  purchase_history: number | null;
  issue_resolution: number | null;
}

export interface VendorReliability {
  vendor_id: number;
  vendor_name: string | null;
  vendor_code: string | null;
  category: string | null;
  overall_score: number;
  risk_level: RiskLevel;
  trend: PerformanceTrendDirection | null;
  rank_position: number | null;
  ranked_out_of: number | null;
  factors: ReliabilityFactors;
  weights: Record<string, number>;
  predicted_delay_risk: number | null;
  recommendation: string;
  orders_considered: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  avg_delay_days: number;
  total_spend: number;
  provisional: boolean;
  delivery: Record<string, number>;
  quality: Record<string, number>;
  communication: CommunicationMetrics;
  compliance: ComplianceMetrics;
}

export interface RankingRow {
  vendor_id: number;
  vendor_code: string;
  vendor_name: string;
  category: string;
  status: string;
  risk_level: RiskLevel;
  reliability_score: number;
  rank_position: number | null;
  trend: PerformanceTrendDirection | null;
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  orders_considered: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  total_spend: number;
  predicted_delay_risk: number | null;
}

export interface ReliabilityHistoryPoint {
  score_date: string;
  overall_score: number;
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  purchase_history_score: number;
  issue_resolution_score: number;
  risk_level: RiskLevel | null;
  trend: PerformanceTrendDirection | null;
  rank_position: number | null;
}

export interface FactorRef {
  factor: string;
  label: string;
  score: number;
}

export interface VendorRecommendation {
  vendor_id: number;
  risk_level: RiskLevel;
  overall_score: number;
  trend: PerformanceTrendDirection | null;
  recommendation: string;
  predicted_delay_risk: number | null;
  weakest_factors: FactorRef[];
  strongest_factors: FactorRef[];
}

export interface DelayPrediction {
  purchase_order_id: number | null;
  po_number: string | null;
  vendor_id: number;
  vendor_name: string | null;
  delay_probability: number;
  predicted_late: boolean;
  risk_band: RiskLevel;
  model_version: string;
  expected_delivery: string | null;
  explanation: string;
}

export interface ModelMetrics {
  model_version: string;
  trained_at: string;
  algorithm: string;
  target: string;
  split: string;
  rows_total: number;
  rows_train: number;
  rows_test: number;
  train_period: string[];
  test_period: string[];
  features: string[];
  baseline_accuracy_majority_class: number;
  test: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
    average_precision: number;
    brier_score: number;
    positive_rate: number;
    confusion_matrix: Record<string, number>;
  };
  permutation_importance?: { feature: string; importance: number }[];
}

export interface ModelInfo {
  ready: boolean;
  model_version: string;
  metrics: ModelMetrics | null;
  thresholds: Record<string, number>;
}

export interface AtRiskVendor {
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  category: string;
  risk_level: RiskLevel;
  reliability_score: number;
  trend: PerformanceTrendDirection | null;
  predicted_delay_risk: number | null;
  recommendation: string | null;
}

export interface RiskSummary {
  by_risk: Record<string, number>;
  high_risk_count: number;
  at_risk_vendors: AtRiskVendor[];
}

export interface AnalyticsFilterOptions {
  categories: string[];
  risk_levels: string[];
  order_statuses: string[];
  request_statuses: string[];
  vendors: { id: number; name: string; category: string }[];
  default_start: string;
  default_end: string;
}

export interface SpendPoint {
  period: string;
  orders: number;
  spend: number;
}

export interface CategoryPerformance {
  category: string;
  vendors: number;
  orders: number;
  delivered: number;
  on_time_rate: number;
  spend: number;
  avg_reliability: number;
}

export interface CostAnalysis {
  total_cost: number;
  budget: number;
  actual: number;
  cost_variance: number;
  cost_variance_pct: number;
  by_vendor: {
    vendor_id: number;
    vendor_name: string;
    category: string;
    spend: number;
    orders: number;
    share: number;
  }[];
  by_category: {
    category: string;
    spend: number;
    orders: number;
    share: number;
  }[];
}

export interface DeliveryStatusSummary {
  total_deliveries: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  pending_deliveries: number;
  delivery_rate: number;
}

export interface ContractStatusSummary {
  total_contracts: number;
  active_contracts: number;
  expiring_contracts: number;
  expired_contracts: number;
  renewed_contracts: number;
  compliant_contracts: number;
  non_compliant_contracts: number;
  compliance_rate: number;
  by_status: Record<string, number>;
  by_compliance: Record<string, number>;
  expiring_soon: {
    id: number;
    contract_number: string;
    vendor_id: number;
    vendor_name: string | null;
    contract_type: string;
    expiry_date: string;
    days_to_expiry: number;
    contract_value: number;
  }[];
}

export interface ProcurementAnalytics {
  filters: Record<string, unknown>;
  overview: Record<string, number> & { by_status: Record<string, number> };
  purchase_orders: Record<string, number> & {
    by_status: Record<string, number>;
    value_by_status: Record<string, number>;
  };
  vendor_performance: Record<string, number>;
  cost_analysis: CostAnalysis;
  delivery_status: DeliveryStatusSummary;
  spend_over_time: SpendPoint[];
  category_performance: CategoryPerformance[];
  invoices: Record<string, number> & { by_status: Record<string, number> };
}

export interface VendorDashboardAnalytics {
  filters: Record<string, unknown>;
  performance: Record<string, number>;
  contract_status: ContractStatusSummary;
  order_history: Record<string, number>;
  communication: Record<string, number>;
  delivery_status: DeliveryStatusSummary;
  trend: PerformanceTrendPoint[];
  reliability: {
    overall_score: number;
    delivery_score: number;
    quality_score: number;
    communication_score: number;
    compliance_score: number;
    purchase_history_score: number;
    issue_resolution_score: number;
    risk_level: RiskLevel;
    trend: PerformanceTrendDirection | null;
    rank_position: number | null;
    recommendation: string | null;
    predicted_delay_risk: number | null;
  } | null;
}

export interface AdminAnalytics {
  filters: Record<string, unknown>;
  user_management: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    by_role: Record<string, number>;
    pending_approvals: number;
  };
  vendor_analytics: Record<string, number> & {
    by_status: Record<string, number>;
    by_category: Record<string, number>;
    by_risk: Record<string, number>;
  };
  procurement: Record<string, number> & { by_status: Record<string, number> };
  purchase_orders: Record<string, number> & { by_status: Record<string, number> };
  compliance: Record<string, number>;
  system: Record<string, number>;
  risk: RiskSummary;
  spend_over_time: SpendPoint[];
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'money' | 'percent' | 'decimal';
}

export interface GeneratedReport {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  row_count: number;
  filters: Record<string, unknown>;
  summary: Record<string, string | number>;
  generated_at: string;
  truncated: boolean;
}

export interface AlertSweepResult {
  delivery_delays: number;
  contract_expiry: number;
  compliance: number;
  vendor_approvals: number;
  procurement: number;
  predicted_delays: number;
  total: number;
}

/** Filter set shared by every analytics and report endpoint. */
export interface AnalyticsFilters {
  start?: string | null;
  end?: string | null;
  vendor_id?: number | null;
  category?: string | null;
  risk_level?: string | null;
  status?: string | null;
}
