import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import { CommonModule } from '@angular/common';

import {
  ReliabilityFactor,
  RiskAnalysisResponse,
  RiskAnalysisVendor,
  VendorReliabilitySummary,
  ReliabilityService
} from '../../core/services/reliability';

@Component({
  selector: 'app-reliability',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reliability.html',
  styleUrl: './reliability.scss'
})
export class Reliability implements OnInit {
  vendors: VendorReliabilitySummary[] = [];
  selectedVendor: VendorReliabilitySummary | null = null;

  riskAnalysis: RiskAnalysisResponse | null = null;
  selectedRiskVendor: RiskAnalysisVendor | null = null;

  loading = true;
  riskLoading = true;

  errorMessage = '';
  riskErrorMessage = '';

  constructor(
    private reliabilityService: ReliabilityService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReliability();
    this.loadRiskAnalysis();
  }

  loadReliability(): void {
    this.loading = true;
    this.errorMessage = '';

    this.reliabilityService.getReliability().subscribe({
      next: (data: VendorReliabilitySummary[]) => {
        this.vendors = data || [];

        if (this.selectedVendor) {
          this.selectedVendor =
            this.vendors.find(
              (vendor) =>
                vendor.vendor_id === this.selectedVendor?.vendor_id
            ) || this.vendors[0] || null;
        } else {
          this.selectedVendor = this.vendors[0] || null;
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Reliability API error:', error);

        this.loading = false;
        this.vendors = [];
        this.selectedVendor = null;

        const apiError = error as {
          error?: { detail?: string };
        };

        this.errorMessage =
          apiError?.error?.detail ||
          'Unable to load vendor reliability data.';

        this.cdr.detectChanges();
      }
    });
  }

  loadRiskAnalysis(): void {
    this.riskLoading = true;
    this.riskErrorMessage = '';

    this.reliabilityService.getRiskAnalysis().subscribe({
      next: (data: RiskAnalysisResponse) => {
        this.riskAnalysis = data;

        if (this.selectedRiskVendor) {
          this.selectedRiskVendor =
            data.vendors.find(
              (vendor) =>
                vendor.vendor_id ===
                this.selectedRiskVendor?.vendor_id
            ) || null;
        }

        this.riskLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        console.error('Risk Analysis API error:', error);

        this.riskAnalysis = null;
        this.selectedRiskVendor = null;
        this.riskLoading = false;

        const apiError = error as {
          error?: { detail?: string };
        };

        this.riskErrorMessage =
          apiError?.error?.detail ||
          'Unable to load risk analysis data.';

        this.cdr.detectChanges();
      }
    });
  }

  selectVendor(vendor: VendorReliabilitySummary): void {
    this.selectedVendor = vendor;

    this.selectedRiskVendor =
      this.riskAnalysis?.vendors.find(
        (item) => item.vendor_id === vendor.vendor_id
      ) || null;
  }

  selectRiskVendor(vendor: RiskAnalysisVendor): void {
    this.selectedRiskVendor = vendor;

    const matchingVendor = this.vendors.find(
      (item) => item.vendor_id === vendor.vendor_id
    );

    if (matchingVendor) {
      this.selectedVendor = matchingVendor;
    }
  }

  refresh(): void {
    this.loadReliability();
    this.loadRiskAnalysis();
  }

  getRiskClass(risk: string | null | undefined): string {
    switch (risk?.toLowerCase()) {
      case 'low risk':
        return 'low-risk';
      case 'medium risk':
        return 'medium-risk';
      case 'high risk':
        return 'high-risk';
      default:
        return '';
    }
  }

  getScoreClass(score: number | null | undefined): string {
    if (score === null || score === undefined) {
      return 'no-data';
    }

    const value = Number(score);

    if (value >= 75) {
      return 'strong';
    }

    if (value >= 50) {
      return 'moderate';
    }

    return 'weak';
  }

  formatScore(score: number | null | undefined): string {
    if (score === null || score === undefined) {
      return '—';
    }

    return Number(score).toFixed(0);
  }

  getFactor(name: string): ReliabilityFactor | undefined {
    return this.selectedVendor?.factors.find(
      (factor) => factor.name === name
    );
  }

  getFactorScore(name: string): number | null {
    return this.getFactor(name)?.score ?? null;
  }

  getFactorWidth(name: string): number {
    const score = this.getFactorScore(name);

    if (score === null) {
      return 0;
    }

    return Math.max(0, Math.min(100, Number(score)));
  }

  getTrendWidth(score: number): number {
    return Math.max(0, Math.min(100, Number(score)));
  }

  getRiskCount(risk: string): number {
    if (!this.riskAnalysis) {
      return 0;
    }

    if (risk === 'Low Risk') {
      return this.riskAnalysis.risk_distribution['Low Risk'];
    }

    if (risk === 'Medium Risk') {
      return this.riskAnalysis.risk_distribution['Medium Risk'];
    }

    if (risk === 'High Risk') {
      return this.riskAnalysis.risk_distribution['High Risk'];
    }

    return 0;
  }

  getRiskWidth(risk: string): number {
    const total = this.riskAnalysis?.total_vendors || 0;

    if (total === 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, (this.getRiskCount(risk) / total) * 100)
    );
  }

  getInsufficientDataCount(): number {
    return (
      this.riskAnalysis?.vendors.filter(
        (vendor) => vendor.available_factor_count === 0
      ).length || 0
    );
  }

  getCompletenessWidth(
    completeness: number | null | undefined
  ): number {
    return Math.max(
      0,
      Math.min(100, Number(completeness || 0))
    );
  }

  getRiskVendors(): RiskAnalysisVendor[] {
    return this.riskAnalysis?.vendors || [];
  }

  isInsufficientData(
    vendor: RiskAnalysisVendor
  ): boolean {
    return vendor.available_factor_count === 0;
  }

  trackByVendorId(
    index: number,
    vendor: VendorReliabilitySummary | RiskAnalysisVendor
  ): number {
    return vendor.vendor_id;
  }
}