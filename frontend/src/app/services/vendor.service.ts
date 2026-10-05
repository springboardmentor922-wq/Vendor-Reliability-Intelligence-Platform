import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  Vendor,
  PurchaseOrder,
  ProcurementRequest,
  Contract,
  PerformanceMetric,
  ReportSummary,
  NotificationItem
} from './vendor.model';

@Injectable({
  providedIn: 'root'
})
export class VendorService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000/api';

  // Signals for state management
  vendors = signal<Vendor[]>([]);
  purchaseOrders = signal<PurchaseOrder[]>([]);
  procurements = signal<ProcurementRequest[]>([]);
  contracts = signal<Contract[]>([]);
  performance = signal<PerformanceMetric[]>([]);
  notifications = signal<NotificationItem[]>([]);
  reports = signal<ReportSummary[]>([
    { id: 1, title: 'Q3 Vendor Reliability Scorecard', category: 'Performance', format: 'PDF', size: '2.4 MB', generated_date: '2026-09-10' },
    { id: 2, title: 'Quarterly Procurement Risk Audit', category: 'Compliance', format: 'XLSX', size: '1.8 MB', generated_date: '2026-09-01' },
    { id: 3, title: 'SLA Breach & Penalty Log', category: 'Legal', format: 'PDF', size: '950 KB', generated_date: '2026-08-28' }
  ]);

  constructor() {
    this.refreshAllData();
  }

  // Initializer / Refresh Method
  refreshAllData(): void {
    this.fetchVendors().subscribe();
    this.fetchPurchaseOrders().subscribe();
    this.fetchProcurements().subscribe();
    this.fetchContracts().subscribe();
    this.fetchPerformance().subscribe();
    this.fetchNotifications().subscribe();
  }

  // --- API FETCH METHODS ---
  fetchVendors(): Observable<Vendor[]> {
    return this.http.get<Vendor[]>(`${this.baseUrl}/vendors`).pipe(
      tap(data => this.vendors.set(data))
    );
  }

  fetchPurchaseOrders(): Observable<PurchaseOrder[]> {
    return this.http.get<PurchaseOrder[]>(`${this.baseUrl}/purchase-orders`).pipe(
      tap(data => this.purchaseOrders.set(data))
    );
  }

  fetchProcurements(): Observable<ProcurementRequest[]> {
    return this.http.get<ProcurementRequest[]>(`${this.baseUrl}/procurement`).pipe(
      tap(data => this.procurements.set(data))
    );
  }

  fetchContracts(): Observable<Contract[]> {
    return this.http.get<Contract[]>(`${this.baseUrl}/contracts`).pipe(
      tap(data => this.contracts.set(data))
    );
  }

  fetchPerformance(): Observable<PerformanceMetric[]> {
    return this.http.get<PerformanceMetric[]>(`${this.baseUrl}/performance`).pipe(
      tap(data => this.performance.set(data))
    );
  }

  fetchNotifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${this.baseUrl}/notifications`).pipe(
      tap(data => this.notifications.set(data))
    );
  }

  // --- API MUTATION METHODS ---
  createVendor(vendor: Vendor): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.baseUrl}/vendors`, vendor).pipe(
      tap(newVendor => this.vendors.update(list => [...list, newVendor]))
    );
  }

  approveVendor(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/vendors/${id}/approve`, {}).pipe(
      tap(() => {
        this.vendors.update(list =>
          list.map(v => v.id === id ? { ...v, status: 'Active' } : v)
        );
      })
    );
  }

  createPO(po: PurchaseOrder): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.baseUrl}/purchase-orders`, po).pipe(
      tap(newPo => this.purchaseOrders.update(list => [...list, newPo]))
    );
  }

  predictMLRisk(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/predictive/predict-risk`, payload);
  }

  exportReport(reportType: string = 'performance', format: string = 'pdf'): void {
    window.open(`${this.baseUrl}/reports/export?report_type=${reportType}&format=${format}`, '_blank');
  }

  // Dynamic KPI Calculations (Calculated dynamically off Signals)
  totalSpend = computed(() => this.purchaseOrders().reduce((acc, po) => acc + po.total_amount, 0));
  avgReliability = computed(() => {
    const list = this.vendors();
    if (!list.length) return 0;
    const total = list.reduce((acc, v) => acc + v.reliabilityScore, 0);
    return Number((total / list.length).toFixed(1));
  });
  highRiskCount = computed(() => this.vendors().filter(v => v.riskLevel === 'High').length);
  activeVendorCount = computed(() => this.vendors().filter(v => v.status === 'Active').length);
}