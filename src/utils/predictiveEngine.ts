import { Vendor, ReliabilityFactors, RiskLevel, PurchaseOrder } from '../types';

/**
 * Calculates dynamic vendor reliability factors and overall reliability score (0-100)
 */
export function calculateReliabilityScore(vendor: Partial<Vendor>): {
  score: number;
  factors: ReliabilityFactors;
  riskLevel: RiskLevel;
  tier: Vendor['tier'];
} {
  // If vendor has zero deliveries, pending status, or explicitly zero metrics, preserve 0 for every score
  if (
    vendor.metrics &&
    vendor.metrics.totalDeliveries === 0 &&
    vendor.metrics.onTimeDeliveryRate === 0 &&
    vendor.metrics.qualityRating === 0
  ) {
    return {
      score: 0,
      factors: {
        deliveryHistoryScore: 0,
        productQualityScore: 0,
        communicationEfficiencyScore: 0,
        contractComplianceScore: 0,
        purchaseHistoryScore: 0,
        issueResolutionScore: 0,
      },
      riskLevel: 'Low',
      tier: 'Tier 3 Conditional',
    };
  }

  const metrics = vendor.metrics || {
    onTimeDeliveries: 45,
    delayedDeliveries: 5,
    totalDeliveries: 50,
    onTimeDeliveryRate: 90,
    qualityRating: 4.5,
    defectRate: 1.5,
    communicationResponseTimeHours: 2.5,
    issueResolutionTimeDays: 1.5,
    orderCompletionRate: 96,
    serviceRating: 4.6,
  };

  // 1. Delivery History (30%): Base on on-time delivery rate
  const deliveryHistoryScore = Math.min(100, Math.max(0, Math.round(metrics.onTimeDeliveryRate)));

  // 2. Product Quality (25%): 5-star normalized to 100 minus defect penalty
  const qualityBase = (metrics.qualityRating / 5.0) * 100;
  const defectPenalty = metrics.defectRate * 3;
  const productQualityScore = Math.min(100, Math.max(0, Math.round(qualityBase - defectPenalty)));

  // 3. Communication Efficiency (10%): Faster response = higher score (0-4h = 100, 4-24h = 75-90, >24h = drop)
  let commScore = 100 - (metrics.communicationResponseTimeHours * 2.5);
  const communicationEfficiencyScore = Math.min(100, Math.max(10, Math.round(commScore)));

  // 4. Contract Compliance (15%): Default high unless issues
  const contractComplianceScore = Math.min(100, Math.max(40, Math.round(
    vendor.reliabilityFactors?.contractComplianceScore ?? 92
  )));

  // 5. Purchase History & Volume (10%): Based on order completion rate
  const purchaseHistoryScore = Math.min(100, Math.max(20, Math.round(metrics.orderCompletionRate)));

  // 6. Issue Resolution (10%): Faster resolution days = higher score
  const issueScore = 100 - (metrics.issueResolutionTimeDays * 12);
  const issueResolutionScore = Math.min(100, Math.max(15, Math.round(issueScore)));

  const factors: ReliabilityFactors = {
    deliveryHistoryScore,
    productQualityScore,
    communicationEfficiencyScore,
    contractComplianceScore,
    purchaseHistoryScore,
    issueResolutionScore,
  };

  // Weighted overall composite score (0-100)
  const weightedScore = (
    factors.deliveryHistoryScore * 0.30 +
    factors.productQualityScore * 0.25 +
    factors.contractComplianceScore * 0.15 +
    factors.communicationEfficiencyScore * 0.10 +
    factors.purchaseHistoryScore * 0.10 +
    factors.issueResolutionScore * 0.10
  );

  const score = Math.round(Math.min(100, Math.max(0, weightedScore)));

  let riskLevel: RiskLevel = 'Low';
  let tier: Vendor['tier'] = 'Tier 1 Preferred';

  if (score >= 85) {
    riskLevel = 'Low';
    tier = 'Tier 1 Preferred';
  } else if (score >= 70) {
    riskLevel = 'Medium';
    tier = 'Tier 2 Approved';
  } else if (score >= 50) {
    riskLevel = 'High';
    tier = 'Tier 3 Conditional';
  } else {
    riskLevel = 'Critical';
    tier = 'High Risk Watchlist';
  }

  return { score, factors, riskLevel, tier };
}

/**
 * Predictive Machine Learning simulation for Late Delivery Risk on a Purchase Order.
 * Mimics a logistic classification model trained on shipping parameters.
 */
export function predictLateDeliveryRisk(
  vendor: Vendor,
  po: { totalAmount: number; expectedDaysLeadTime?: number }
): {
  probability: number; // 0 - 100%
  riskCategory: 'Low Delay Risk' | 'Moderate Delay Risk' | 'High Delay Risk' | 'Critical Delay Risk';
  contributingFactors: string[];
  recommendedAction: string;
} {
  // Baseline probability derived from vendor's historical delay percentage
  const historicalDelayRate = 100 - (vendor.metrics?.onTimeDeliveryRate || 85);
  let probability = historicalDelayRate * 0.8;

  const contributingFactors: string[] = [];

  // Factor 1: High Order Volume / Value Strain
  if (po.totalAmount > 100000) {
    probability += 12;
    contributingFactors.push('High value enterprise order (₹1,00,000+) exceeds median batch capacity');
  } else if (po.totalAmount > 40000) {
    probability += 6;
    contributingFactors.push('Elevated order size may require extended quality assurance window');
  }

  // Factor 2: Lead time tightness
  const leadTime = po.expectedDaysLeadTime || 7;
  if (leadTime < 5) {
    probability += 18;
    contributingFactors.push(`Expedited lead time (${leadTime} days) leaves narrow buffer for transit disruption`);
  }

  // Factor 3: Communication lag
  if (vendor.metrics.communicationResponseTimeHours > 12) {
    probability += 8;
    contributingFactors.push('Vendor average response time >12h limits rapid exception handling');
  }

  // Factor 4: Vendor status or risk level
  if (vendor.riskLevel === 'High' || vendor.riskLevel === 'Critical') {
    probability += 15;
    contributingFactors.push(`Vendor overall status is marked ${vendor.riskLevel} Risk`);
  }

  probability = Math.min(96, Math.max(4, Math.round(probability)));

  let riskCategory: 'Low Delay Risk' | 'Moderate Delay Risk' | 'High Delay Risk' | 'Critical Delay Risk' = 'Low Delay Risk';
  let recommendedAction = 'Standard order execution. Automated 48-hour milestone tracking recommended.';

  if (probability >= 70) {
    riskCategory = 'Critical Delay Risk';
    recommendedAction = `Immediate mitigation required. Consider split-allocation (60/40) with backup Tier 1 supplier and mandate daily dispatch telemetry.`;
  } else if (probability >= 45) {
    riskCategory = 'High Delay Risk';
    recommendedAction = `Escalate to Supply Chain Manager. Request formal expedited shipping commitment and buffer delivery by +3 business days.`;
  } else if (probability >= 25) {
    riskCategory = 'Moderate Delay Risk';
    recommendedAction = `Send pre-dispatch confirmation 72 hours prior to ship date and establish direct courier contact.`;
  }

  return { probability, riskCategory, contributingFactors, recommendedAction };
}

/**
 * Intelligent procurement recommendations generator for vendor allocation
 */
export function generateProcurementRecommendations(vendors: Vendor[]): {
  topRecommended: Vendor[];
  riskAlerts: { vendor: Vendor; reason: string; suggestedAlternative?: string }[];
} {
  const sorted = [...vendors].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  const topRecommended = sorted.slice(0, 3);

  const riskAlerts: { vendor: Vendor; reason: string; suggestedAlternative?: string }[] = [];

  vendors.forEach(v => {
    if (v.riskLevel === 'Critical' || v.riskLevel === 'High') {
      const alt = sorted.find(s => s.category === v.category && s.id !== v.id && s.riskLevel === 'Low');
      riskAlerts.push({
        vendor: v,
        reason: `Reliability score at ${v.reliabilityScore}% with ${v.metrics.delayedDeliveries} delayed deliveries in recent quarters.`,
        suggestedAlternative: alt ? `${alt.name} (Score: ${alt.reliabilityScore}%, ${alt.tier})` : undefined,
      });
    }
  });

  return { topRecommended, riskAlerts };
}
