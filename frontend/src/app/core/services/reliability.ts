import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface ReliabilityFactor {
  name: string;
  score: number | null;
  description: string;
  status: string;
}

export interface ReliabilityTrend {
  evaluation_date: string;
  performance_score: number;
  reliability_score: number;
}

export interface VendorReliabilitySummary {
  vendor_id: number;
  vendor_name: string;
  category: string;
  vendor_status: string;
  reliability_score: number | null;
  supplier_ranking: number | null;
  procurement_risk_level: string;
  data_completeness: number;
  available_factor_count: number;
  total_factor_count: number;
  factors: ReliabilityFactor[];
  trend: ReliabilityTrend[];
  recommendations: string[];
}

export interface RiskAnalysisVendor {
  vendor_id: number;
  vendor_name: string;
  category: string;
  vendor_status: string;
  reliability_score: number | null;
  procurement_risk_level: string;
  data_completeness: number;
  available_factor_count: number;
  total_factor_count: number;
  purchase_order_count: number;
  factors: ReliabilityFactor[];
  risk_explanation: string;
  recommendations: string[];
}

export interface RiskAnalysisResponse {
  total_vendors: number;
  total_purchase_orders: number;
  risk_distribution: {
    'Low Risk': number;
    'Medium Risk': number;
    'High Risk': number;
  };
  risk_thresholds: {
    'Low Risk': string;
    'Medium Risk': string;
    'High Risk': string;
  };
  vendors: RiskAnalysisVendor[];
}

@Injectable({
  providedIn: 'root'
})
export class ReliabilityService {
  private readonly apiUrl =
    'http://127.0.0.1:8000/api/vendor-reliability';

  constructor(private http: HttpClient) {}

  getReliability(): Observable<VendorReliabilitySummary[]> {
    return this.http
      .get<VendorReliabilitySummary[]>(this.apiUrl)
      .pipe(
        map((vendors) =>
          (vendors || []).map((vendor) => ({
            ...vendor,
            reliability_score:
              vendor.reliability_score === null ||
              vendor.reliability_score === undefined
                ? null
                : Number(vendor.reliability_score),
            supplier_ranking:
              vendor.supplier_ranking === null ||
              vendor.supplier_ranking === undefined
                ? null
                : Number(vendor.supplier_ranking),
            data_completeness: Number(vendor.data_completeness ?? 0),
            available_factor_count: Number(
              vendor.available_factor_count ?? 0
            ),
            total_factor_count: Number(
              vendor.total_factor_count ?? 0
            ),
            factors: (vendor.factors || []).map((factor) => ({
              ...factor,
              score:
                factor.score === null || factor.score === undefined
                  ? null
                  : Number(factor.score)
            })),
            trend: (vendor.trend || []).map((item) => ({
              ...item,
              performance_score: Number(item.performance_score),
              reliability_score: Number(item.reliability_score)
            })),
            recommendations: vendor.recommendations || []
          }))
        )
      );
  }

  getVendorReliability(
    vendorId: number
  ): Observable<VendorReliabilitySummary> {
    return this.http
      .get<VendorReliabilitySummary>(
        `${this.apiUrl}/${vendorId}`
      )
      .pipe(
        map((vendor) => ({
          ...vendor,
          reliability_score:
            vendor.reliability_score === null ||
            vendor.reliability_score === undefined
              ? null
              : Number(vendor.reliability_score),
          supplier_ranking:
            vendor.supplier_ranking === null ||
            vendor.supplier_ranking === undefined
              ? null
              : Number(vendor.supplier_ranking),
          data_completeness: Number(vendor.data_completeness ?? 0),
          available_factor_count: Number(
            vendor.available_factor_count ?? 0
          ),
          total_factor_count: Number(
            vendor.total_factor_count ?? 0
          ),
          factors: (vendor.factors || []).map((factor) => ({
            ...factor,
            score:
              factor.score === null || factor.score === undefined
                ? null
                : Number(factor.score)
          })),
          trend: (vendor.trend || []).map((item) => ({
            ...item,
            performance_score: Number(item.performance_score),
            reliability_score: Number(item.reliability_score)
          })),
          recommendations: vendor.recommendations || []
        }))
      );
  }

  getRiskAnalysis(): Observable<RiskAnalysisResponse> {
    return this.http
      .get<RiskAnalysisResponse>(
        `${this.apiUrl}/risk-analysis`
      )
      .pipe(
        map((response) => ({
          ...response,
          total_vendors: Number(response.total_vendors ?? 0),
          total_purchase_orders: Number(
            response.total_purchase_orders ?? 0
          ),
          risk_distribution: {
            'Low Risk': Number(
              response.risk_distribution?.['Low Risk'] ?? 0
            ),
            'Medium Risk': Number(
              response.risk_distribution?.['Medium Risk'] ?? 0
            ),
            'High Risk': Number(
              response.risk_distribution?.['High Risk'] ?? 0
            )
          },
          vendors: (response.vendors || []).map((vendor) => ({
            ...vendor,
            reliability_score:
              vendor.reliability_score === null ||
              vendor.reliability_score === undefined
                ? null
                : Number(vendor.reliability_score),
            data_completeness: Number(
              vendor.data_completeness ?? 0
            ),
            available_factor_count: Number(
              vendor.available_factor_count ?? 0
            ),
            total_factor_count: Number(
              vendor.total_factor_count ?? 0
            ),
            purchase_order_count: Number(
              vendor.purchase_order_count ?? 0
            ),
            factors: (vendor.factors || []).map((factor) => ({
              ...factor,
              score:
                factor.score === null || factor.score === undefined
                  ? null
                  : Number(factor.score)
            })),
            recommendations: vendor.recommendations || []
          }))
        }))
      );
  }
}