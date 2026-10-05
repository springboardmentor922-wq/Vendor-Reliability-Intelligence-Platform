import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DatasetDeliveryStatus {
  late_delivery: number;
  advance_shipping: number;
  shipping_on_time: number;
  shipping_canceled: number;
}

export interface DatasetShippingMode {
  shipping_mode: string;
  records: number;
  percentage: number;
}

export interface DatasetMarket {
  market: string;
  records: number;
  percentage: number;
}

export interface DatasetMonthlyTrend {
  month: string;
  total_records: number;
  late_deliveries: number;
  on_time_deliveries: number;
  late_delivery_rate: number;
}

export interface DatasetAnalytics {
  dataset_name: string;
  total_records: number;
  unique_orders: number;

  late_delivery_count: number;
  late_delivery_rate: number;
  on_time_delivery_rate: number;

  average_actual_shipping_days: number;
  average_scheduled_shipping_days: number;
  average_shipping_delay_days: number;

  total_sales: number;
  total_profit: number;
  average_order_item_value: number;

  delivery_status: DatasetDeliveryStatus;

  shipping_modes: DatasetShippingMode[];
  markets: DatasetMarket[];
  monthly_trend: DatasetMonthlyTrend[];
}

@Injectable({
  providedIn: 'root'
})
export class DatasetAnalyticsService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/dataset-analytics';

  constructor(
    private http: HttpClient
  ) {}

  getDatasetAnalytics(): Observable<DatasetAnalytics> {
    return this.http.get<DatasetAnalytics>(this.apiUrl);
  }
}