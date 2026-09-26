import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ActivityLogEntry,
  AppNotification,
  ApiMessage,
  Certification,
  ComplianceCheck,
  Contract,
  ContractDetail,
  ContractStats,
  DashboardOverview,
  Invoice,
  MessageThread,
  MessageThreadDetail,
  NotificationSummary,
  ProcurementRequest,
  ProcurementRequestDetail,
  ProcurementStats,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderItemInput,
  PurchaseOrderStats,
  ThreadMessage,
  User,
  Vendor,
  VendorApprovalEntry,
  VendorContact,
  VendorDetail,
  VendorPerformanceRecord,
  VendorStats,
} from './models';

/** Drops null/undefined/empty values so filters stay out of the query string. */
function toParams(filters: Record<string, unknown> = {}): HttpParams {
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
export class DashboardService {
  private readonly http = inject(HttpClient);

  overview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>(
      `${environment.apiUrl}/dashboard/overview`,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class VendorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendors`;

  list(filters: Record<string, unknown> = {}): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(this.base, { params: toParams(filters) });
  }

  get(id: number): Observable<VendorDetail> {
    return this.http.get<VendorDetail>(`${this.base}/${id}`);
  }

  stats(): Observable<VendorStats> {
    return this.http.get<VendorStats>(`${this.base}/stats/summary`);
  }

  pendingApprovals(): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(`${this.base}/pending-approvals`);
  }

  create(payload: Partial<Vendor> & { contacts?: unknown[] }): Observable<VendorDetail> {
    return this.http.post<VendorDetail>(this.base, payload);
  }

  update(id: number, payload: Partial<Vendor>): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.base}/${id}`, payload);
  }

  approve(id: number, comments?: string): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.base}/${id}/approve`, { comments });
  }

  reject(id: number, reason: string, comments?: string): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.base}/${id}/reject`, { reason, comments });
  }

  suspend(id: number, reason?: string): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.base}/${id}/suspend`, { reason });
  }

  reactivate(id: number, comments?: string): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.base}/${id}/reactivate`, { comments });
  }

  approvals(id: number): Observable<VendorApprovalEntry[]> {
    return this.http.get<VendorApprovalEntry[]>(`${this.base}/${id}/approvals`);
  }

  addContact(id: number, payload: Partial<VendorContact>): Observable<VendorContact> {
    return this.http.post<VendorContact>(`${this.base}/${id}/contacts`, payload);
  }

  removeContact(vendorId: number, contactId: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(
      `${this.base}/${vendorId}/contacts/${contactId}`,
    );
  }

  remove(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ProcurementService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/procurement-requests`;

  list(filters: Record<string, unknown> = {}): Observable<ProcurementRequest[]> {
    return this.http.get<ProcurementRequest[]>(this.base, {
      params: toParams(filters),
    });
  }

  get(id: number): Observable<ProcurementRequestDetail> {
    return this.http.get<ProcurementRequestDetail>(`${this.base}/${id}`);
  }

  stats(): Observable<ProcurementStats> {
    return this.http.get<ProcurementStats>(`${this.base}/stats/summary`);
  }

  pendingApprovals(): Observable<ProcurementRequest[]> {
    return this.http.get<ProcurementRequest[]>(`${this.base}/pending-approvals`);
  }

  create(payload: Partial<ProcurementRequest>): Observable<ProcurementRequestDetail> {
    return this.http.post<ProcurementRequestDetail>(this.base, payload);
  }

  update(
    id: number,
    payload: Partial<ProcurementRequest>,
  ): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(`${this.base}/${id}`, payload);
  }

  approve(id: number, comments?: string): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/${id}/approve`, {
      comments,
    });
  }

  reject(id: number, reason: string): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/${id}/reject`, {
      reason,
    });
  }

  assignVendor(id: number, vendorId: number): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/${id}/assign-vendor`, {
      vendor_id: vendorId,
    });
  }

  cancel(id: number, reason?: string): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(`${this.base}/${id}/cancel`, {
      reason,
    });
  }

  remove(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/purchase-orders`;

  list(filters: Record<string, unknown> = {}): Observable<PurchaseOrder[]> {
    return this.http.get<PurchaseOrder[]>(this.base, { params: toParams(filters) });
  }

  get(id: number): Observable<PurchaseOrderDetail> {
    return this.http.get<PurchaseOrderDetail>(`${this.base}/${id}`);
  }

  stats(): Observable<PurchaseOrderStats> {
    return this.http.get<PurchaseOrderStats>(`${this.base}/stats/summary`);
  }

  create(payload: {
    vendor_id: number;
    procurement_request_id?: number | null;
    title?: string | null;
    description?: string | null;
    expected_delivery?: string | null;
    tax_amount?: number;
    shipping_amount?: number;
    payment_terms?: string | null;
    shipping_address?: string | null;
    notes?: string | null;
    items: PurchaseOrderItemInput[];
  }): Observable<PurchaseOrderDetail> {
    return this.http.post<PurchaseOrderDetail>(this.base, payload);
  }

  update(id: number, payload: Record<string, unknown>): Observable<PurchaseOrderDetail> {
    return this.http.put<PurchaseOrderDetail>(`${this.base}/${id}`, payload);
  }

  changeStatus(
    id: number,
    status: string,
    extra: { actual_delivery?: string | null; comments?: string } = {},
  ): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/${id}/status`, {
      status,
      ...extra,
    });
  }

  invoices(id: number): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.base}/${id}/invoices`);
  }

  addInvoice(id: number, payload: Record<string, unknown>): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/invoices`, payload);
  }

  remove(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/invoices`;

  list(filters: Record<string, unknown> = {}): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(this.base, { params: toParams(filters) });
  }

  create(payload: Record<string, unknown>): Observable<Invoice> {
    return this.http.post<Invoice>(this.base, payload);
  }

  update(id: number, payload: Record<string, unknown>): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.base}/${id}`, payload);
  }

  remove(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/contracts`;

  list(filters: Record<string, unknown> = {}): Observable<Contract[]> {
    return this.http.get<Contract[]>(this.base, { params: toParams(filters) });
  }

  get(id: number): Observable<ContractDetail> {
    return this.http.get<ContractDetail>(`${this.base}/${id}`);
  }

  stats(): Observable<ContractStats> {
    return this.http.get<ContractStats>(`${this.base}/stats/summary`);
  }

  expiring(days = 30): Observable<Contract[]> {
    return this.http.get<Contract[]>(`${this.base}/expiring`, {
      params: toParams({ days }),
    });
  }

  types(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/meta/types`);
  }

  checkTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/meta/check-types`);
  }

  create(payload: Record<string, unknown>): Observable<ContractDetail> {
    return this.http.post<ContractDetail>(this.base, payload);
  }

  update(id: number, payload: Record<string, unknown>): Observable<ContractDetail> {
    return this.http.put<ContractDetail>(`${this.base}/${id}`, payload);
  }

  renew(
    id: number,
    payload: { start_date: string; expiry_date: string; contract_value?: number | null },
  ): Observable<ContractDetail> {
    return this.http.post<ContractDetail>(`${this.base}/${id}/renew`, payload);
  }

  terminate(id: number): Observable<Contract> {
    return this.http.post<Contract>(`${this.base}/${id}/terminate`, {});
  }

  runExpiryScan(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/run-expiry-scan`, {});
  }

  complianceChecks(id: number): Observable<ComplianceCheck[]> {
    return this.http.get<ComplianceCheck[]>(`${this.base}/${id}/compliance`);
  }

  recordComplianceCheck(
    id: number,
    payload: { check_type: string; result: string; remarks?: string },
  ): Observable<ComplianceCheck> {
    return this.http.post<ComplianceCheck>(`${this.base}/${id}/compliance`, payload);
  }

  certifications(vendorId: number): Observable<Certification[]> {
    return this.http.get<Certification[]>(
      `${this.base}/certifications/vendor/${vendorId}`,
    );
  }

  addCertification(
    vendorId: number,
    payload: Record<string, unknown>,
  ): Observable<Certification> {
    return this.http.post<Certification>(
      `${this.base}/certifications/vendor/${vendorId}`,
      payload,
    );
  }

  removeCertification(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/certifications/${id}`);
  }

  remove(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/communication`;

  threads(filters: Record<string, unknown> = {}): Observable<MessageThread[]> {
    return this.http.get<MessageThread[]>(`${this.base}/threads`, {
      params: toParams(filters),
    });
  }

  thread(id: number): Observable<MessageThreadDetail> {
    return this.http.get<MessageThreadDetail>(`${this.base}/threads/${id}`);
  }

  createThread(payload: {
    subject: string;
    vendor_id?: number | null;
    purchase_order_id?: number | null;
    procurement_request_id?: number | null;
    contract_id?: number | null;
    priority: string;
    body: string;
  }): Observable<MessageThreadDetail> {
    return this.http.post<MessageThreadDetail>(`${this.base}/threads`, payload);
  }

  updateThread(
    id: number,
    payload: { subject?: string; status?: string; priority?: string },
  ): Observable<MessageThread> {
    return this.http.put<MessageThread>(`${this.base}/threads/${id}`, payload);
  }

  postMessage(threadId: number, body: string): Observable<ThreadMessage> {
    return this.http.post<ThreadMessage>(
      `${this.base}/threads/${threadId}/messages`,
      { body },
    );
  }

  uploadAttachment(messageId: number, file: File): Observable<unknown> {
    const form = new FormData();
    form.append('file', file);

    return this.http.post(`${this.base}/messages/${messageId}/attachments`, form);
  }

  deleteThread(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/threads/${id}`);
  }

  activity(filters: Record<string, unknown> = {}): Observable<ActivityLogEntry[]> {
    return this.http.get<ActivityLogEntry[]>(`${this.base}/activity`, {
      params: toParams(filters),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/notifications`;

  list(filters: Record<string, unknown> = {}): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.base, { params: toParams(filters) });
  }

  summary(): Observable<NotificationSummary> {
    return this.http.get<NotificationSummary>(`${this.base}/summary`);
  }

  markRead(id: number): Observable<AppNotification> {
    return this.http.post<AppNotification>(`${this.base}/${id}/read`, {});
  }

  markAllRead(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/read-all`, {});
  }

  remove(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(filters: Record<string, unknown> = {}): Observable<User[]> {
    return this.http.get<User[]>(this.base, { params: toParams(filters) });
  }

  create(payload: Record<string, unknown>): Observable<User> {
    return this.http.post<User>(this.base, payload);
  }

  update(id: number, payload: Record<string, unknown>): Observable<User> {
    return this.http.put<User>(`${this.base}/${id}`, payload);
  }

  activate(id: number): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/activate`, {});
  }

  deactivate(id: number): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/deactivate`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vendor-performance`;

  list(filters: Record<string, unknown> = {}): Observable<VendorPerformanceRecord[]> {
    return this.http.get<VendorPerformanceRecord[]>(this.base, {
      params: toParams(filters),
    });
  }

  forVendor(vendorId: number): Observable<VendorPerformanceRecord[]> {
    return this.http.get<VendorPerformanceRecord[]>(`${this.base}/vendor/${vendorId}`);
  }
}

/* Milestone 3 services (performance, reliability, analytics, reports). */
export * from './api-m3.service';
