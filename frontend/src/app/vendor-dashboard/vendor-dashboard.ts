import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface VendorReliabilityDetail {
  vendorName: string;
  category: string;
  deliveryScore: number;       // 25%
  qualityScore: number;        // 25%
  communicationScore: number;  // 10%
  complianceScore: number;     // 15%
  purchaseScore: number;       // 10%
  issueScore: number;          // 15%
  compositeScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendation: string;
}

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vendor-dashboard.html',
  styleUrl: './vendor-dashboard.scss'
})
export class VendorDashboardComponent implements AfterViewInit {
  @ViewChild('performanceBarChart') performanceBarChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('reliabilityTrendChart') reliabilityTrendChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('contractStatusChart') contractStatusChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('orderHistoryChart') orderHistoryChart!: ElementRef<HTMLCanvasElement>;
  @ViewChild('communicationChart') communicationChart!: ElementRef<HTMLCanvasElement>;

  kpis = [
    { title: 'Avg Performance Score', value: '88%', trend: '↑ 6% vs last month', icon: '⭐' },
    { title: 'Avg Reliability Score', value: '85.5%', trend: '↑ 4% vs last month', icon: '🛡️' },
    { title: 'Active Contracts', value: '42', trend: '↑ 10% vs last month', icon: '📑' },
    { title: 'Total Vendor Orders', value: '320', trend: '↑ 18% vs last month', icon: '🛒' }
  ];

  // 6-Factor Reliability Breakdown Engine Data
  vendorsReliability: VendorReliabilityDetail[] = [
    { vendorName: 'Apex Raw Materials', category: 'Raw Material Suppliers', deliveryScore: 90, qualityScore: 84, communicationScore: 80, complianceScore: 100, purchaseScore: 95, issueScore: 70, compositeScore: 86.5, riskLevel: 'Low', recommendation: 'Preferred vendor. Safe to assign.' },
    { vendorName: 'LogiSpeed Corp', category: 'Logistics Partners', deliveryScore: 65, qualityScore: 70, communicationScore: 70, complianceScore: 80, purchaseScore: 75, issueScore: 60, compositeScore: 69.5, riskLevel: 'Medium', recommendation: 'Acceptable with monitoring. Review recent issues.' },
    { vendorName: 'TechSphere IT Solutions', category: 'Information Technology Vendors', deliveryScore: 95, qualityScore: 90, communicationScore: 85, complianceScore: 90, purchaseScore: 90, issueScore: 88, compositeScore: 91.2, riskLevel: 'Low', recommendation: 'Preferred vendor. High reliability.' },
    { vendorName: 'Global Equipment Ltd', category: 'Equipment Vendors', deliveryScore: 45, qualityScore: 50, communicationScore: 40, complianceScore: 60, purchaseScore: 50, issueScore: 30, compositeScore: 47.0, riskLevel: 'High', recommendation: 'Avoid for critical orders. Needs review before assignment.' }
  ];

  selectedVendorForScore: VendorReliabilityDetail | null = null;
  showBreakdownModal = false;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initPerformanceBarChart();
      this.initReliabilityTrendChart();
      this.initContractStatusChart();
      this.initOrderHistoryChart();
      this.initCommunicationChart();
    }, 0);
  }

  // Calculate composite reliability score using exact 6-factor formulas
  calculateCompositeScore(v: VendorReliabilityDetail): number {
    const score = (v.deliveryScore * 0.25) +
                  (v.qualityScore * 0.25) +
                  (v.communicationScore * 0.10) +
                  (v.complianceScore * 0.15) +
                  (v.purchaseScore * 0.10) +
                  (v.issueScore * 0.15);
    return Math.round(score * 10) / 10;
  }

  openScoreBreakdown(v: VendorReliabilityDetail): void {
    this.selectedVendorForScore = v;
    this.showBreakdownModal = true;
  }

  // --- Charts ---
  private initPerformanceBarChart(): void {
    new Chart(this.performanceBarChart.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Apex Materials', 'LogiSpeed', 'TechSphere', 'Global Equip', 'CleanCare'],
        datasets: [
          { label: 'Delivery (25%)', data: [90, 65, 95, 45, 92], backgroundColor: '#10b981' },
          { label: 'Quality (25%)', data: [84, 70, 90, 50, 88], backgroundColor: '#3b82f6' },
          { label: 'Compliance (15%)', data: [100, 80, 90, 60, 95], backgroundColor: '#8b5cf6' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initReliabilityTrendChart(): void {
    new Chart(this.reliabilityTrendChart.nativeElement, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{ label: 'Reliability Index (%)', data: [78, 81, 80, 85, 88, 91], borderColor: '#10b981', tension: 0.3 }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initContractStatusChart(): void {
    new Chart(this.contractStatusChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Expiring Soon', 'Under Renewal', 'Expired'],
        datasets: [{ data: [50, 17, 25, 8], backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initOrderHistoryChart(): void {
    new Chart(this.orderHistoryChart.nativeElement, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          { type: 'bar', label: 'Orders Placed', data: [10, 15, 12, 18, 22, 25], backgroundColor: '#a7f3d0' },
          { type: 'line', label: 'Value (₹ Lakh)', data: [20, 35, 30, 42, 48, 55], borderColor: '#059669', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  private initCommunicationChart(): void {
    new Chart(this.communicationChart.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Emails', 'Calls', 'Portal Messages', 'Support Tickets'],
        datasets: [{ data: [36, 18, 27, 7], backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899'] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  exportReliabilityReport(): void {
    const headers = ['Vendor Name', 'Category', 'Delivery Score (25%)', 'Quality Score (25%)', 'Comm. Score (10%)', 'Compliance Score (15%)', 'Purchase Score (10%)', 'Issue Score (15%)', 'Composite Score', 'Risk Level', 'Recommendation'];
    const rows = this.vendorsReliability.map(v => [
      `"${v.vendorName}"`,
      `"${v.category}"`,
      v.deliveryScore,
      v.qualityScore,
      v.communicationScore,
      v.complianceScore,
      v.purchaseScore,
      v.issueScore,
      this.calculateCompositeScore(v),
      v.riskLevel,
      `"${v.recommendation}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vendor_Reliability_Calculations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}