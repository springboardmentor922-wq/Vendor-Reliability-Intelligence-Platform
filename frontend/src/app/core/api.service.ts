import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserRole {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  roles: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
  user: User;
}

export interface VendorContact {
  id?: string;
  name: string;
  email: string;
  phone?: string;
}

export interface Vendor {
  id: string;
  company_name: string;
  registration_no: string;
  category: string;
  status: string; // pending, under_review, approved, rejected, ACTIVE, INACTIVE
  review_notes?: string;
  created_at: string;
  contacts?: VendorContact[];
}

export interface PRLineItem {
  id?: string;
  item_name: string;
  quantity: number;
  estimated_cost: number;
}

export interface ProcurementRequest {
  id: string;
  requester_id?: string;
  requester_name?: string;
  title: string;
  description?: string;
  budget_amount?: number;
  status: string; // pending, approved, ordered, delivered, completed, cancelled, PENDING_APPROVAL
  total_estimated_cost?: number;
  created_at: string;
  line_items?: PRLineItem[];
}

export interface POItem {
  id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface PODocument {
  id: string;
  po_id: string;
  file_name: string;
  doc_type: string;
  uploaded_by?: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  pr_id?: string;
  vendor_id: string;
  vendor_name?: string;
  total_amount: number;
  status: string; // SENT_TO_VENDOR, IN_FULFILLMENT, DELIVERED, COMPLETED
  delivery_status: 'in_progress' | 'shipped' | 'partial_delivery' | 'delivered';
  invoice_amount?: number;
  invoice_received_at?: string;
  created_at: string;
  items?: POItem[];
  documents?: PODocument[];
}

export interface Contract {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  title: string;
  start_date: string;
  end_date: string;
  renewal_notice_period_days: number;
  terms?: string;
  compliance_flags?: string;
  document_path?: string;
  status: string; // ACTIVE, EXPIRED, TERMINATED
  created_at: string;
  days_remaining?: number;
  risk_level?: 'green' | 'amber' | 'red';
  renewed_from_contract_id?: string;
}

export interface NotificationItem {
  id: string;
  user_id?: string;
  message: string;
  is_read: boolean;
  type?: string;
  created_at: string;
}

export interface VendorPerformance {
  id: string;
  vendor_id: string;
  on_time_deliveries: number;
  delayed_deliveries: number;
  quality_rating: number;
  service_rating?: number;
  response_time_hours: number;
  issue_resolution_time_hours: number;
  order_completion_rate: number;
  recorded_at: string;
}

export interface VendorPerformanceCreate {
  on_time_deliveries: number;
  delayed_deliveries: number;
  quality_rating: number;
  service_rating?: number;
  response_time_hours: number;
  issue_resolution_time_hours: number;
  order_completion_rate: number;
}

export interface VendorPerformanceSummary {
  vendor_id: string;
  total_entries: number;
  total_deliveries: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  on_time_delivery_rate: number;
  average_quality_rating: number;
  average_service_rating?: number;
  average_response_time_hours: number;
  average_issue_resolution_time_hours: number;
  order_completion_rate: number;
}

export interface VendorRankingItem {
  vendor_id: string;
  company_name: string;
  registration_no: string;
  category: string;
  status: string;
  performance_score: number;
  average_quality_rating: number;
  on_time_delivery_rate: number;
  order_completion_rate: number;
  total_evaluations: number;
}

export interface ReliabilityFactorBreakdown {
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  purchase_history_score: number;
  issue_resolution_score: number;
}

export interface VendorReliability {
  vendor_id: string;
  company_name: string;
  overall_reliability_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Unrated';
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  breakdown: ReliabilityFactorBreakdown;
  recommendation?: string;
  computed_at: string;
}

export interface VendorReliabilityRankingItem {
  vendor_id: string;
  company_name: string;
  registration_no: string;
  category: string;
  status: string;
  overall_reliability_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Unrated';
  delivery_score: number;
  quality_score: number;
  compliance_score: number;
  recommendation?: string;
}

export interface VendorReliabilitySnapshot {
  id: string;
  vendor_id: string;
  delivery_score: number;
  quality_score: number;
  communication_score: number;
  compliance_score: number;
  overall_reliability_score: number;
  risk_level: string;
  computed_at: string;
}

// --- Dashboard Analytics Interfaces ---
export interface PRSummary {
  status: string;
  count: number;
}

export interface POSummary {
  status: string;
  count: number;
  total_value: number;
}

export interface ProcurementDashboardResponse {
  total_pr_count: number;
  total_po_count: number;
  total_po_spend: number;
  pr_by_status: PRSummary[];
  po_by_status: POSummary[];
  recent_prs: any[];
  recent_pos: any[];
  budget_total?: number;
  actual_total?: number;
  cost_variance?: number;
  cost_variance_pct?: number;
}

export interface VendorRiskItem {
  vendor_id: string;
  company_name: string;
  category: string;
  overall_reliability_score: number;
  risk_level: string;
  computed_at: string;
}

export interface VendorDashboardResponse {
  total_vendors: number;
  active_vendors: number;
  suspended_vendors: number;
  high_risk_count: number;
  avg_reliability_score: number;
  risk_breakdown: { [key: string]: number };
  top_vendors: VendorRiskItem[];
  at_risk_vendors: VendorRiskItem[];
}

export interface SingleVendorDashboardResponse {
  vendor_id: string;
  company_name: string;
  registration_no: string;
  category: string;
  status: string;
  performance: {
    performance_score: number;
    delivery_rate: number;
    quality_rating: number;
    response_time_hours: number;
    issue_resolution_time_hours: number;
    order_completion_rate: number;
    total_evaluations: number;
  };
  reliability: {
    overall_reliability_score: number;
    risk_level: 'Low' | 'Medium' | 'High';
    breakdown: ReliabilityFactorBreakdown;
    recommendation?: string;
  };
  contracts: {
    total_contracts: number;
    active_contracts: number;
    expiring_soon_contracts: number;
    expired_contracts: number;
    has_compliance_flags: boolean;
    compliance_flags: string[];
  };
  orders: {
    total_orders: number;
    total_order_value: number;
    delivered_orders: number;
    pending_orders: number;
    cancelled_orders?: number;
    delayed_orders?: number;
    cancelled?: number;
    delayed?: number;
  };
  communication: {
    messages_sent: number;
    messages_received: number;
    unread_messages: number;
    total_messages?: number;
    order_inquiries?: number;
    rfq_count?: number;
    document_exchanges?: number;
    note: string;
  };
}

export interface AdminDashboardResponse {
  total_users: number;
  pending_users: number;
  approved_users: number;
  total_vendors: number;
  total_procurement_requests: number;
  total_purchase_orders: number;
  total_contracts: number;
  active_contracts: number;
  expired_contracts: number;
  total_po_spend: number;
  overdue_pos: number;
  unread_notifications: number;
  vendors_by_category?: Record<string, number>;
}

// --- Interactive Charts Interfaces ---
export interface MonthlyProcurementOverview {
  months: string[];
  costs: number[];
  po_counts: number[];
}

export interface ActivePurchaseOrdersDonut {
  labels: string[];
  counts: number[];
  colors: string[];
}

export interface VendorPerformanceSummaryRadar {
  categories: string[];
  scores: number[];
}

export interface ProcurementCostAnalysisDonut {
  categories: string[];
  costs: number[];
  percentages: number[];
  budget_total?: number;
  actual_total?: number;
  cost_variance?: number;
  cost_variance_pct?: number;
}

export interface DeliveryStatusGauge {
  on_time_rate: number;
  delayed_rate: number;
  total_deliveries: number;
  on_time_count: number;
  delayed_count: number;
}

export interface ProcurementChartsResponse {
  total_purchase_orders: number;
  po_change_pct: string;
  total_procurement_cost: number;
  cost_change_pct: string;
  active_vendors: number;
  active_vendors_change_pct: string;
  items_procured: number;
  items_change_pct: string;
  procurement_overview: MonthlyProcurementOverview;
  active_purchase_orders: ActivePurchaseOrdersDonut;
  vendor_performance_summary: VendorPerformanceSummaryRadar;
  procurement_cost_analysis: ProcurementCostAnalysisDonut;
  budget_total?: number;
  actual_total?: number;
  cost_variance?: number;
  cost_variance_pct?: number;
  delivery_status: DeliveryStatusGauge;
}

export interface VendorPerformanceGroupedBar {
  labels: string[];
  vendor_scores: number[];
  peer_average_scores: number[];
}

export interface ReliabilityScoreTrendLine {
  dates: string[];
  scores: number[];
}

export interface ContractStatusDonut {
  labels: string[];
  counts: number[];
  colors: string[];
}

export interface OrderHistoryCombo {
  months: string[];
  order_values: number[];
  order_counts: number[];
}

export interface CommunicationActivityDonut {
  labels: string[];
  counts: number[];
  colors: string[];
}

export interface VendorChartsResponse {
  vendor_id: string;
  company_name: string;
  performance_score: number;
  performance_score_change_pct: string;
  reliability_score: number;
  reliability_score_change_pct: string;
  active_contracts: number;
  contracts_change_pct: string;
  total_orders: number;
  orders_change_pct: string;
  vendor_performance: VendorPerformanceGroupedBar;
  reliability_score_trend: ReliabilityScoreTrendLine;
  contract_status: ContractStatusDonut;
  order_history: OrderHistoryCombo;
  communication_activity: CommunicationActivityDonut;
}

export interface UserManagementDonut {
  roles: string[];
  counts: number[];
  colors: string[];
}

export interface VendorRiskDistributionBar {
  risk_levels: string[];
  counts: number[];
  colors: string[];
}

export interface ComplianceMonitoringDonut {
  labels: string[];
  counts: number[];
  colors: string[];
}

export interface SystemStatisticsTiles {
  database_size: string;
  storage_usage: string;
  active_sessions: number;
  api_response_time: string;
  system_uptime: string;
}

export interface AdminChartsResponse {
  total_users: number;
  users_change_pct: string;
  total_vendors: number;
  vendors_change_pct: string;
  total_contracts: number;
  contracts_change_pct: string;
  system_uptime: string;
  user_management: UserManagementDonut;
  vendor_risk_distribution: VendorRiskDistributionBar;
  procurement_reports: MonthlyProcurementOverview;
  compliance_monitoring: ComplianceMonitoringDonut;
  system_statistics: SystemStatisticsTiles;
}

// --- Procurement Analytics Interfaces ---
export interface MonthlySpendItem {
  month: string;
  spend: number;
  order_count: number;
}

export interface TopVendorSpendItem {
  vendor_id: string;
  company_name: string;
  total_spend: number;
  order_count: number;
}

export interface CategorySpendItem {
  category: string;
  total_spend: number;
  vendor_count: number;
}

export interface ProcurementAnalyticsResponse {
  monthly_spend_trend: MonthlySpendItem[];
  top_vendors_by_spend: TopVendorSpendItem[];
  category_spend: CategorySpendItem[];
  average_approval_time_hours?: number | null;
  request_to_po_conversion_rate: number;
  total_spend: number;
  total_orders: number;
  total_requests: number;
}

// --- Communication & Activity Log Interfaces ---
export interface CommunicationMessage {
  id: string;
  vendor_id: string;
  procurement_request_id?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  sender_role: string;
  message: string;
  attachment_path?: string | null;
  created_at: string;
}

export interface ActivityLogItem {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: string | null;
  created_at: string;
}

// --- Certification Interfaces ---
export interface Certification {
  id: string;
  vendor_id: string;
  vendor_name?: string | null;
  certification_name: string;
  issued_date?: string | null;
  expiry_date?: string | null;
  status: string;
  document_path?: string | null;
  created_at: string;
  is_expiring_soon?: boolean;
}

export interface CertificationCreate {
  certification_name: string;
  issued_date?: string | null;
  expiry_date?: string | null;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // System Health
  getHealth(): Observable<{ status: string; database: string; redis: string }> {
    return this.http.get<{ status: string; database: string; redis: string }>(environment.healthUrl);
  }

  // Admin APIs
  getPendingUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/admin/pending-users`);
  }

  approveUser(userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${userId}/approve`, {});
  }

  rejectUser(userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/admin/users/${userId}/reject`, {});
  }

  // Vendor APIs
  getVendors(filters?: { category?: string; status?: string; search?: string }): Observable<Vendor[]> {
    let params = new HttpParams();
    if (filters?.category) params = params.set('category', filters.category);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.search) params = params.set('search', filters.search);
    return this.http.get<Vendor[]>(`${this.base}/vendors`, { params });
  }

  createVendor(payload: {
    company_name: string;
    registration_no: string;
    category: string;
    status?: string;
    review_notes?: string;
    contacts?: { name: string; email: string; phone?: string }[];
  }): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.base}/vendors`, payload);
  }

  updateVendor(id: string, payload: Partial<Vendor>): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.base}/vendors/${id}`, payload);
  }

  updateVendorStatus(id: string, payload: { status: string; review_notes?: string }): Observable<Vendor> {
    return this.http.patch<Vendor>(`${this.base}/vendors/${id}/status`, payload);
  }

  deleteVendor(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/vendors/${id}`);
  }

  // Procurement Requests APIs
  getProcurementRequests(status?: string): Observable<ProcurementRequest[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ProcurementRequest[]>(`${this.base}/procurement-requests`, { params });
  }

  createProcurementRequest(payload: {
    title: string;
    description?: string;
    line_items?: { item_name: string; quantity: number; estimated_cost: number }[];
  }): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/procurement-requests`, payload);
  }

  updateProcurementRequestStatus(id: string, payload: { status: string; notes?: string }): Observable<ProcurementRequest> {
    return this.http.patch<ProcurementRequest>(`${this.base}/procurement-requests/${id}/status`, payload);
  }

  // Purchase Orders APIs
  getPurchaseOrders(filters?: { status?: string; delivery_status?: string }): Observable<PurchaseOrder[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.delivery_status) params = params.set('delivery_status', filters.delivery_status);
    return this.http.get<PurchaseOrder[]>(`${this.base}/purchase-orders`, { params });
  }

  createPurchaseOrder(payload: {
    pr_id?: string;
    vendor_id: string;
    items: { item_name: string; quantity: number; unit_price: number }[];
  }): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders`, payload);
  }

  createPOFromPR(prId: string, payload?: { vendor_id?: string }): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders/from-pr/${prId}`, payload || {});
  }

  updatePODeliveryStatus(id: string, delivery_status: string): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/purchase-orders/${id}/delivery-status`, { delivery_status });
  }

  updatePurchaseOrderStatus(id: string, status: string): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/purchase-orders/${id}/status`, { status });
  }

  completePurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders/${id}/complete`, {});
  }

  cancelPurchaseOrder(id: string): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders/${id}/cancel`, {});
  }

  completeProcurementRequest(id: string): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/procurement-requests/${id}/complete`, {});
  }

  cancelProcurementRequest(id: string): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/procurement-requests/${id}/cancel`, {});
  }

  uploadPODocument(id: string, formData: FormData): Observable<PODocument> {
    return this.http.post<PODocument>(`${this.base}/purchase-orders/${id}/documents`, formData);
  }

  recordPOInvoice(id: string, payload: { invoice_amount: number; invoice_received_at?: string }): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${this.base}/purchase-orders/${id}/invoice`, payload);
  }

  // Contract APIs
  getContracts(filters?: { vendor_id?: string; status?: string }): Observable<Contract[]> {
    let params = new HttpParams();
    if (filters?.vendor_id) params = params.set('vendor_id', filters.vendor_id);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<Contract[]>(`${this.base}/contracts`, { params });
  }

  getExpiringContracts(days: number = 30): Observable<Contract[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<Contract[]>(`${this.base}/contracts/expiring`, { params });
  }

  createContract(payload: {
    vendor_id: string;
    title: string;
    start_date: string;
    end_date: string;
    renewal_notice_period_days?: number;
    terms?: string;
    compliance_flags?: string;
    status?: string;
  }): Observable<Contract> {
    return this.http.post<Contract>(`${this.base}/contracts`, payload);
  }

  updateContract(id: string, payload: Partial<Contract>): Observable<Contract> {
    return this.http.put<Contract>(`${this.base}/contracts/${id}`, payload);
  }

  uploadContractDocument(id: string, formData: FormData): Observable<Contract> {
    return this.http.post<Contract>(`${this.base}/contracts/${id}/document`, formData);
  }

  deleteContract(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/contracts/${id}`);
  }

  renewContract(id: string, payload: {
    new_start_date: string;
    new_end_date: string;
    renewal_notice_period_days?: number;
    terms?: string;
  }): Observable<Contract> {
    return this.http.post<Contract>(`${this.base}/contracts/${id}/renew`, payload);
  }

  // Notifications APIs
  getNotifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${this.base}/notifications`);
  }

  markNotificationAsRead(id: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(`${this.base}/notifications/${id}/read`, {});
  }

  markAllNotificationsAsRead(): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.base}/notifications/read-all`, {});
  }

  // Performance & Reliability APIs
  getVendorPerformance(vendorId: string): Observable<VendorPerformance[]> {
    return this.http.get<VendorPerformance[]>(`${this.base}/vendors/${vendorId}/performance`);
  }

  createVendorPerformance(vendorId: string, payload: VendorPerformanceCreate): Observable<VendorPerformance> {
    return this.http.post<VendorPerformance>(`${this.base}/vendors/${vendorId}/performance`, payload);
  }

  getVendorPerformanceSummary(vendorId: string): Observable<VendorPerformanceSummary> {
    return this.http.get<VendorPerformanceSummary>(`${this.base}/vendors/${vendorId}/performance/summary`);
  }

  getVendorRankings(): Observable<VendorRankingItem[]> {
    return this.http.get<VendorRankingItem[]>(`${this.base}/vendors/ranking`);
  }

  getVendorReliability(vendorId: string): Observable<VendorReliability> {
    return this.http.get<VendorReliability>(`${this.base}/vendors/${vendorId}/reliability`);
  }

  getVendorReliabilityRanking(): Observable<VendorReliabilityRankingItem[]> {
    return this.http.get<VendorReliabilityRankingItem[]>(`${this.base}/vendors/reliability-ranking`);
  }

  getVendorReliabilityTrend(vendorId: string): Observable<VendorReliabilitySnapshot[]> {
    return this.http.get<VendorReliabilitySnapshot[]>(`${this.base}/vendors/${vendorId}/reliability/trend`);
  }

  // Dashboard Analytics APIs
  getProcurementDashboard(): Observable<ProcurementDashboardResponse> {
    return this.http.get<ProcurementDashboardResponse>(`${this.base}/dashboard/procurement`);
  }

  getVendorsDashboard(): Observable<VendorDashboardResponse> {
    return this.http.get<VendorDashboardResponse>(`${this.base}/dashboard/vendors`);
  }

  getVendorDashboard(vendorId: string): Observable<SingleVendorDashboardResponse> {
    return this.http.get<SingleVendorDashboardResponse>(`${this.base}/dashboard/vendor/${vendorId}`);
  }

  getAdminDashboard(): Observable<AdminDashboardResponse> {
    return this.http.get<AdminDashboardResponse>(`${this.base}/dashboard/admin`);
  }

  // Interactive Charts API (Milestone 3 Extension)
  getProcurementCharts(): Observable<ProcurementChartsResponse> {
    return this.http.get<ProcurementChartsResponse>(`${this.base}/dashboard/procurement/charts`);
  }

  getVendorCharts(vendorId: string): Observable<VendorChartsResponse> {
    return this.http.get<VendorChartsResponse>(`${this.base}/dashboard/vendor/${vendorId}/charts`);
  }

  getAdminCharts(): Observable<AdminChartsResponse> {
    return this.http.get<AdminChartsResponse>(`${this.base}/dashboard/admin/charts`);
  }

  // Procurement Analytics API
  getProcurementAnalytics(): Observable<ProcurementAnalyticsResponse> {
    return this.http.get<ProcurementAnalyticsResponse>(`${this.base}/analytics/procurement`);
  }

  // Reports Export API (returns binary Blob for PDF/Excel)
  downloadReport(reportType: string, format: 'pdf' | 'excel'): Observable<Blob> {
    return this.http.get(`${this.base}/reports/${reportType}`, {
      params: { format },
      responseType: 'blob'
    });
  }

  // Communication & Activity APIs
  getVendorMessages(vendorId: string): Observable<CommunicationMessage[]> {
    return this.http.get<CommunicationMessage[]>(`${this.base}/vendors/${vendorId}/messages`);
  }

  sendVendorMessage(vendorId: string, payload: { message: string; procurement_request_id?: string }): Observable<CommunicationMessage> {
    return this.http.post<CommunicationMessage>(`${this.base}/vendors/${vendorId}/messages`, payload);
  }

  uploadMessageAttachment(vendorId: string, messageId: string, formData: FormData): Observable<CommunicationMessage> {
    return this.http.post<CommunicationMessage>(`${this.base}/vendors/${vendorId}/messages/${messageId}/attachment`, formData);
  }

  getVendorActivity(vendorId: string): Observable<ActivityLogItem[]> {
    return this.http.get<ActivityLogItem[]>(`${this.base}/vendors/${vendorId}/activity`);
  }

  getMessageAttachmentUrl(vendorId: string, messageId: string): string {
    return `${this.base}/vendors/${vendorId}/messages/${messageId}/attachment`;
  }

  // Certification APIs
  getVendorCertifications(vendorId: string, status?: string): Observable<Certification[]> {
    let params = new HttpParams();
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Certification[]>(`${this.base}/contracts/vendors/${vendorId}/certifications`, { params });
  }

  createVendorCertification(vendorId: string, payload: CertificationCreate): Observable<Certification> {
    return this.http.post<Certification>(`${this.base}/contracts/vendors/${vendorId}/certifications`, payload);
  }

  uploadCertificationDocument(certId: string, file: File): Observable<Certification> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Certification>(`${this.base}/contracts/certifications/${certId}/document`, formData);
  }

  deleteCertification(certId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/contracts/certifications/${certId}`);
  }
}
