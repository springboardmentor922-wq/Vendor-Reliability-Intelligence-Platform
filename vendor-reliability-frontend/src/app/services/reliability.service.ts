import { Injectable } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { VendorService, VendorModel } from './vendor.service';
import { PurchaseOrderService, PurchaseOrder } from './purchase-order.service';
import { ContractService, Contract } from './contract.service';

export interface ReliabilityFactors {
  deliveryHistory: {
    score: number; // 0-100
    onTimeRate: number;
    totalDeliveries: number;
    onTimeDeliveries: number;
    delayedDeliveries: number;
  };
  productQuality: {
    score: number; // 0-100
    rating: number; // out of 5
    defectRate: number; // %
    inspectionPassRate: number; // %
  };
  communicationEfficiency: {
    score: number; // 0-100
    responseTimeHours: number;
    responseRate: number; // %
  };
  contractCompliance: {
    score: number; // 0-100
    complianceStatus: string;
    slaAdherenceRate: number; // %
  };
  purchaseHistory: {
    score: number; // 0-100
    totalOrders: number;
    completedOrders: number;
    totalSpend: number;
  };
  issueResolution: {
    score: number; // 0-100
    avgResolutionTimeHours: number;
    resolutionRate: number; // %
  };
}

export interface VendorReliabilityProfile {
  vendorId: number;
  vendorName: string;
  company: string;
  category: string;
  status: string;
  reliabilityScore: number; // 0 - 100
  tier: 'Tier-1 Strategic' | 'Tier-2 Preferred' | 'Tier-3 Standard' | 'At-Risk';
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  rank: number;
  trend: 'Improving' | 'Stable' | 'Declining';
  trendDelta: number; // e.g. +3.5%
  factors: ReliabilityFactors;
  recommendations: string[];
  historicalTrends: { month: string; score: number; onTimeRate: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class ReliabilityService {
  constructor(
    private vendorService: VendorService,
    private poService: PurchaseOrderService,
    private contractService: ContractService
  ) {}

  getReliabilityProfiles(): Observable<VendorReliabilityProfile[]> {
    return forkJoin({
      vendors: this.vendorService.getVendors(),
      orders: this.poService.getPurchaseOrders(),
      contracts: this.contractService.getContracts()
    }).pipe(
      map(({ vendors, orders, contracts }) => {
        const profiles: VendorReliabilityProfile[] = vendors.map(vendor => {
          return this.computeProfile(vendor, orders, contracts);
        });

        // Sort descending by reliability score to calculate ranks
        profiles.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
        profiles.forEach((p, idx) => p.rank = idx + 1);

        return profiles;
      })
    );
  }

  getVendorReliability(vendorId: number): Observable<VendorReliabilityProfile | null> {
    return this.getReliabilityProfiles().pipe(
      map(profiles => profiles.find(p => p.vendorId === vendorId) || null)
    );
  }

  private computeProfile(
    vendor: VendorModel,
    allOrders: PurchaseOrder[],
    allContracts: Contract[]
  ): VendorReliabilityProfile {
    const vOrders = allOrders.filter(o => o.vendor_id === vendor.id);
    const vContracts = allContracts.filter(c => c.vendor_id === vendor.id);

    if (vOrders.length === 0 && (!vendor.deliveryRate || vendor.deliveryRate === 0)) {
      const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
      return {
        vendorId: vendor.id || 0,
        vendorName: vendor.name,
        company: vendor.company,
        category: vendor.category,
        status: vendor.status,
        reliabilityScore: 0,
        tier: 'Tier-3 Standard',
        riskLevel: (vendor.risk_level as any) || 'Low',
        rank: 1,
        trend: 'Stable',
        trendDelta: 0.0,
        factors: {
          deliveryHistory: {
            score: 0,
            onTimeRate: 0,
            totalDeliveries: 0,
            onTimeDeliveries: 0,
            delayedDeliveries: 0
          },
          productQuality: {
            score: 0,
            rating: 0,
            defectRate: 0,
            inspectionPassRate: 100
          },
          communicationEfficiency: {
            score: 0,
            responseTimeHours: vendor.response_time_hours || 24,
            responseRate: 0
          },
          contractCompliance: {
            score: 0,
            complianceStatus: 'Under Review',
            slaAdherenceRate: 0
          },
          purchaseHistory: {
            score: 0,
            totalOrders: 0,
            completedOrders: 0,
            totalSpend: 0
          },
          issueResolution: {
            score: 0,
            avgResolutionTimeHours: 0,
            resolutionRate: 0
          }
        },
        recommendations: ['Newly approved vendor with no completed deliveries or tasks yet. Reliability will be evaluated upon order fulfillment.'],
        historicalTrends: months.map(m => ({ month: m, score: 0, onTimeRate: 0 }))
      };
    }

    // 1. Delivery History (25% weight)
    const totalDeliveries = Math.max(vOrders.length, 1);
    const delayedCount = vOrders.filter(o => o.status === 'Delayed').length;
    const onTimeDeliveries = Math.max(totalDeliveries - delayedCount, 0);
    const onTimeRate = vendor.deliveryRate || (totalDeliveries > 0 ? Math.round((onTimeDeliveries / totalDeliveries) * 100) : 92);
    const deliveryScore = Math.min(Math.max(onTimeRate, 0), 100);

    // 2. Product Quality (25% weight)
    const qualityRating = vendor.quality_rating || (deliveryScore > 90 ? 4.8 : deliveryScore > 80 ? 4.3 : 3.8);
    const defectRate = Math.max(0, +(5.0 - qualityRating).toFixed(1));
    const qualityScore = Math.round((qualityRating / 5.0) * 100);

    // 3. Communication Efficiency (15% weight)
    const responseTime = vendor.response_time_hours || (deliveryScore > 90 ? 6 : deliveryScore > 80 ? 12 : 24);
    const commScore = Math.max(40, Math.round(100 - (responseTime * 1.8)));

    // 4. Contract Compliance (15% weight)
    const hasContract = vContracts.length > 0;
    const isCompliant = vContracts.some(c => c.compliance_status === 'Compliant');
    const complianceScore = isCompliant ? 96 : hasContract ? 80 : 70;

    // 5. Purchase History (10% weight)
    const completedOrders = vOrders.filter(o => o.status === 'Delivered' || o.status === 'Approved').length;
    const totalSpend = vOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const purchaseScore = Math.min(100, 60 + completedOrders * 10);

    // 6. Issue Resolution (10% weight)
    const avgResolutionTime = responseTime * 1.5;
    const resolutionRate = deliveryScore > 85 ? 96 : 84;
    const issueScore = Math.round(resolutionRate);

    // Composite Weighted Reliability Score (100% Total)
    const compositeScore = Math.round(
      (deliveryScore * 0.25) +
      (qualityScore * 0.25) +
      (commScore * 0.15) +
      (complianceScore * 0.15) +
      (purchaseScore * 0.10) +
      (issueScore * 0.10)
    );

    // Tier Classification
    let tier: 'Tier-1 Strategic' | 'Tier-2 Preferred' | 'Tier-3 Standard' | 'At-Risk';
    if (compositeScore >= 90) tier = 'Tier-1 Strategic';
    else if (compositeScore >= 80) tier = 'Tier-2 Preferred';
    else if (compositeScore >= 65) tier = 'Tier-3 Standard';
    else tier = 'At-Risk';

    // Risk Level Determination (Low Risk, Medium Risk, High Risk, Critical Risk)
    let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    if (vendor.risk_level) {
      riskLevel = (vendor.risk_level === 'Critical' || vendor.risk_level === 'Critical Risk') ? 'Critical' : vendor.risk_level as any;
    } else if (compositeScore >= 85) {
      riskLevel = 'Low';
    } else if (compositeScore >= 70) {
      riskLevel = 'Medium';
    } else if (compositeScore >= 55) {
      riskLevel = 'High';
    } else {
      riskLevel = 'Critical';
    }

    // Trend Analysis
    let trend: 'Improving' | 'Stable' | 'Declining' = 'Stable';
    let trendDelta = 0.0;
    if (deliveryScore >= 92) {
      trend = 'Improving';
      trendDelta = +3.2;
    } else if (deliveryScore < 82) {
      trend = 'Declining';
      trendDelta = -4.1;
    } else {
      trend = 'Stable';
      trendDelta = +0.5;
    }

    // Algorithmic Recommendations
    const recommendations: string[] = [];
    if (compositeScore >= 90) {
      recommendations.push(`Primary recommended vendor for critical ${vendor.category} requisitions.`);
      recommendations.push('Eligible for expedited multi-year SLA renewal and preferred payment terms.');
    } else if (compositeScore >= 80) {
      recommendations.push(`Suitable for standard operational procurement in ${vendor.category}.`);
      if (responseTime > 14) {
        recommendations.push('Establish automated communication channels to improve response lead time.');
      }
    } else if (compositeScore >= 65) {
      recommendations.push(`Assign secondary backup vendor when issuing orders exceeding $50,000.`);
      recommendations.push('Schedule quarterly performance audit to improve delivery variance.');
    } else {
      recommendations.push('HIGH RISK: Implement mandatory pre-dispatch quality inspections.');
      recommendations.push('Freeze new high-volume purchase orders pending corrective action plan.');
    }

    // Historical 6-month trajectory
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const historicalTrends = months.map((m, idx) => {
      const offset = (idx - 5) * (trend === 'Improving' ? 1.2 : trend === 'Declining' ? -1.5 : 0.2);
      return {
        month: m,
        score: Math.min(100, Math.max(50, Math.round(compositeScore + offset))),
        onTimeRate: Math.min(100, Math.max(50, Math.round(onTimeRate + offset)))
      };
    });

    return {
      vendorId: vendor.id || 0,
      vendorName: vendor.name,
      company: vendor.company,
      category: vendor.category,
      status: vendor.status,
      reliabilityScore: compositeScore,
      tier,
      riskLevel,
      rank: 1, // updated after sorting
      trend,
      trendDelta,
      factors: {
        deliveryHistory: {
          score: deliveryScore,
          onTimeRate,
          totalDeliveries,
          onTimeDeliveries,
          delayedDeliveries: delayedCount
        },
        productQuality: {
          score: qualityScore,
          rating: qualityRating,
          defectRate,
          inspectionPassRate: 100 - defectRate
        },
        communicationEfficiency: {
          score: commScore,
          responseTimeHours: responseTime,
          responseRate: Math.min(100, Math.round(commScore + 5))
        },
        contractCompliance: {
          score: complianceScore,
          complianceStatus: isCompliant ? 'Compliant' : 'Under Review',
          slaAdherenceRate: Math.round(complianceScore * 0.98)
        },
        purchaseHistory: {
          score: purchaseScore,
          totalOrders: vOrders.length,
          completedOrders,
          totalSpend
        },
        issueResolution: {
          score: issueScore,
          avgResolutionTimeHours: avgResolutionTime,
          resolutionRate
        }
      },
      recommendations,
      historicalTrends
    };
  }
}
