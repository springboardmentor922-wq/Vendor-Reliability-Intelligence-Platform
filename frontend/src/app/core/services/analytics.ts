import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface DeliveryStatusSummary {
  pending: number;
  approved: number;
  ordered: number;
  delivered: number;
  completed: number;
  cancelled: number;
  delayed: number;
}

export interface ContractSummary {
  active: number;
  expiring: number;
  expired: number;
  renewed: number;
}

export interface OrderSummary {
  total: number;
  completed: number;
  pending: number;
  delayed: number;
}

export interface CommunicationSummary {
  messages: number;
  open_queries: number;
  resolved_queries: number;
  response_activity: number;
}

export interface VendorPerformanceDashboard {
  performance_score: number | null;
  delivery_rate: number | null;
  quality_rating: number | null;
  response_time_hours: number | null;
  reliability_score: number | null;
  reliability_factors: {
    Delivery: number | null;
    Quality: number | null;
    Communication: number | null;
    Compliance: number | null;
  };
}

export interface ProcurementDashboard {
  total_purchase_orders: number;
  active_purchase_orders: number;
  total_procurement_cost: number;
  average_order_value: number;
  vendor_count: number;
  delivery_status: DeliveryStatusSummary;
}

export interface AdminDashboard {
  total_users: number;
  active_users: number;
  total_vendors: number;
  approved_vendors: number;
  pending_vendors: number;
  total_purchase_orders: number;
  total_contracts: number;
  compliant_contracts: number;
  expiring_contracts: number;
  total_communications: number;
}

export interface DashboardAnalytics {
  role: string;
  vendor_name: string | null;

  vendor_performance: VendorPerformanceDashboard;

  contracts: ContractSummary;

  orders: OrderSummary;

  communication: CommunicationSummary;

  procurement: ProcurementDashboard;

  admin: AdminDashboard;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/analytics/dashboard';

  constructor(
    private http: HttpClient
  ) {}

  getDashboardAnalytics():
    Observable<DashboardAnalytics> {

    return this.http
      .get<DashboardAnalytics>(
        this.apiUrl
      )
      .pipe(
        map((data) => ({
          ...data,

          vendor_performance: {
            ...data.vendor_performance,

            performance_score:
              this.toNumberOrNull(
                data.vendor_performance.performance_score
              ),

            delivery_rate:
              this.toNumberOrNull(
                data.vendor_performance.delivery_rate
              ),

            quality_rating:
              this.toNumberOrNull(
                data.vendor_performance.quality_rating
              ),

            response_time_hours:
              this.toNumberOrNull(
                data.vendor_performance.response_time_hours
              ),

            reliability_score:
              this.toNumberOrNull(
                data.vendor_performance.reliability_score
              ),

            reliability_factors: {
              Delivery:
                this.toNumberOrNull(
                  data.vendor_performance
                    .reliability_factors.Delivery
                ),

              Quality:
                this.toNumberOrNull(
                  data.vendor_performance
                    .reliability_factors.Quality
                ),

              Communication:
                this.toNumberOrNull(
                  data.vendor_performance
                    .reliability_factors.Communication
                ),

              Compliance:
                this.toNumberOrNull(
                  data.vendor_performance
                    .reliability_factors.Compliance
                )
            }
          },

          procurement: {
            ...data.procurement,

            total_procurement_cost:
              Number(
                data.procurement
                  .total_procurement_cost
              ),

            average_order_value:
              Number(
                data.procurement
                  .average_order_value
              )
          }
        }))
      );
  }

  private toNumberOrNull(
    value: number | string | null
  ): number | null {

    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const numberValue = Number(value);

    return Number.isNaN(numberValue)
      ? null
      : numberValue;
  }
}