import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProcurementService,
  EligibleVendorCard,
  EligibleVendorsResponse,
  VendorFullDetails,
  VendorSelectionPayload
} from '../../services/procurement.service';
import { VendorService, VendorModel } from '../../services/vendor.service';
import { RequisitionService, PurchaseRequisition } from '../../services/requisition.service';
import { AuthService, VENDOR_CATEGORIES } from '../../services/auth.service';

export interface VendorComparisonRow {
  vendorId: number;
  name: string;
  company: string;
  category: string;
  reliabilityScore: number;
  deliveryRate: number;
  qualityScore: number;
  onTimeDeliveryRate: number;
  riskLevel: string;
  completedOrders: number;
  averageDeliveryTime: string;
  quotationEstimate: number;
  products: string[];
}

@Component({
  selector: 'app-vendor-selection',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vendor-selection.html',
  styleUrl: './vendor-selection.css'
})
export class VendorSelection implements OnInit {
  categories = VENDOR_CATEGORIES;
  selectedCategory = 'IT & Electronics';

  pendingRequisitions: PurchaseRequisition[] = [];
  selectedRequisition: PurchaseRequisition | null = null;
  requisitionIdParam: number | null = null;

  eligibleVendors: EligibleVendorCard[] = [];
  comparedVendorIds: number[] = [];
  searchFilter = '';
  viewMode: 'matrix' | 'cards' = 'matrix';
  isLoading = true;
  isSubmitting = false;

  actionSuccessMessage = '';
  actionErrorMessage = '';

  // Decision Modal
  showSelectModal = false;
  selectedVendorForAward: EligibleVendorCard | null = null;
  decisionForm = {
    quotation_amount: 2500000,
    justification: ''
  };

  // View Details Modal
  showDetailsModal = false;
  selectedVendorDetails: VendorFullDetails | null = null;
  isLoadingDetails = false;
  activeDetailsTab: 'profile' | 'performance' | 'risk' | 'history' = 'profile';

  constructor(
    private procService: ProcurementService,
    private vendorService: VendorService,
    private prService: RequisitionService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory = params['category'];
      }
      if (params['prId']) {
        this.requisitionIdParam = Number(params['prId']);
      }
      this.loadRequisitionsAndVendors();
    });
  }

  loadRequisitionsAndVendors(): void {
    this.isLoading = true;
    this.prService.getRequisitions().subscribe({
      next: (prs) => {
        // Filter requisitions needing vendor evaluation
        this.pendingRequisitions = (prs || []).filter(p =>
          ['SUBMITTED', 'UNDER_REVIEW', 'UNDER_EVALUATION', 'REJECTED_FINANCE', 'Pending'].includes(p.status)
        );

        if (this.requisitionIdParam) {
          const match = this.pendingRequisitions.find(p => p.id === this.requisitionIdParam);
          if (match) {
            this.selectRequisition(match);
            return;
          }
        }

        if (this.pendingRequisitions.length > 0) {
          this.selectRequisition(this.pendingRequisitions[0]);
        } else {
          this.loadCategoryVendors(this.selectedCategory);
        }
      },
      error: () => {
        this.loadCategoryVendors(this.selectedCategory);
      }
    });
  }

  selectRequisition(pr: PurchaseRequisition): void {
    this.selectedRequisition = pr;
    if (pr.category) {
      this.selectedCategory = pr.category;
    }
    this.decisionForm.quotation_amount = pr.estimated_budget || 2500000;
    this.loadEligibleVendorsForPR(pr.id!);
  }

  onCategoryChange(): void {
    this.loadCategoryVendors(this.selectedCategory);
  }

  loadEligibleVendorsForPR(prId: number): void {
    this.isLoading = true;
    this.procService.getEligibleVendors(prId).subscribe({
      next: (res: EligibleVendorsResponse) => {
        this.eligibleVendors = res.vendors || [];
        this.comparedVendorIds = this.eligibleVendors.slice(0, 3).map(v => v.vendor_id);
        this.isLoading = false;
      },
      error: () => {
        // Fallback to category query
        this.loadCategoryVendors(this.selectedCategory);
      }
    });
  }

  loadCategoryVendors(category: string): void {
    this.isLoading = true;
    this.vendorService.getVendors({ category }, true).subscribe({
      next: (vendors) => {
        const approvedOnly = (vendors || []).filter(v =>
          ['approved', 'active'].includes((v.status || '').toLowerCase())
        );
        this.eligibleVendors = approvedOnly.map(v => ({
          vendor_id: v.id!,
          id: v.id!,
          name: v.name,
          company: v.company,
          category: v.category,
          products: [v.product],
          reliability_score: v.deliveryRate ?? 0,
          on_time_delivery_rate: v.deliveryRate ?? 0,
          total_orders: 0,
          completed_orders: 0,
          delayed_orders: 0,
          partial_deliveries: 0,
          cancelled_orders: 0,
          average_delivery_time: 'N/A',
          risk_level: v.risk_level || 'Low',
          risk_reasons: v.risk_reasons || [],
          status: v.status,
          quotation_estimate: this.selectedRequisition?.estimated_budget || 2500000
        }));
        this.comparedVendorIds = this.eligibleVendors.slice(0, 3).map(v => v.vendor_id);
        this.isLoading = false;
      },
      error: () => {
        this.eligibleVendors = [];
        this.isLoading = false;
      }
    });
  }

  getFilteredVendors(): EligibleVendorCard[] {
    const q = this.searchFilter.toLowerCase().trim();
    if (!q) return this.eligibleVendors;
    return this.eligibleVendors.filter(v =>
      v.name?.toLowerCase().includes(q) ||
      v.company?.toLowerCase().includes(q) ||
      v.products?.some(p => p.toLowerCase().includes(q))
    );
  }

  toggleComparison(vendorId: number): void {
    const idx = this.comparedVendorIds.indexOf(vendorId);
    if (idx >= 0) {
      if (this.comparedVendorIds.length > 1) {
        this.comparedVendorIds.splice(idx, 1);
      } else {
        alert('Keep at least 1 vendor in the comparison view.');
      }
    } else {
      if (this.comparedVendorIds.length >= 4) {
        alert('You can compare a maximum of 4 suppliers side-by-side.');
        return;
      }
      this.comparedVendorIds.push(vendorId);
    }
  }

  isCompared(vendorId: number): boolean {
    return this.comparedVendorIds.includes(vendorId);
  }

  getComparedVendorsList(): EligibleVendorCard[] {
    return this.eligibleVendors.filter(v => this.comparedVendorIds.includes(v.vendor_id));
  }

  // Action 1: View Vendor Details
  viewVendor(vendorId: number): void {
    this.isLoadingDetails = true;
    this.showDetailsModal = true;
    this.activeDetailsTab = 'profile';
    this.procService.getVendorFullDetails(vendorId).subscribe({
      next: (details) => {
        this.selectedVendorDetails = details;
        this.isLoadingDetails = false;
      },
      error: () => {
        this.isLoadingDetails = false;
      }
    });
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedVendorDetails = null;
  }

  // Action 2: Open Vendor Selection Modal
  openSelectModal(vendor: EligibleVendorCard): void {
    this.selectedVendorForAward = vendor;
    if (vendor.quotation_estimate) {
      this.decisionForm.quotation_amount = vendor.quotation_estimate;
    } else if (this.selectedRequisition?.estimated_budget) {
      this.decisionForm.quotation_amount = this.selectedRequisition.estimated_budget;
    }
    const prNum = this.selectedRequisition?.request_number || 'Requisition';
    this.decisionForm.justification = `Selected ${vendor.name} (${vendor.company}) for ${prNum} based on verified category match '${vendor.category}', Reliability Score ${vendor.reliability_score}%, On-Time Delivery Rate ${vendor.on_time_delivery_rate}%, and ${vendor.risk_level} operational risk rating.`;
    this.showSelectModal = true;
  }

  closeSelectModal(): void {
    this.showSelectModal = false;
    this.selectedVendorForAward = null;
  }

  // Action 3: Confirm Vendor Selection (Submits to API)
  confirmVendorSelection(): void {
    if (!this.selectedVendorForAward) return;
    if (!this.selectedRequisition && !this.requisitionIdParam) {
      alert('Please select an active purchase requisition to assign this vendor to.');
      return;
    }

    const prId = this.selectedRequisition?.id || this.requisitionIdParam!;
    const vendor = this.selectedVendorForAward;

    if (!this.decisionForm.quotation_amount || this.decisionForm.quotation_amount <= 0) {
      alert('Please enter a valid quotation amount.');
      return;
    }
    if (!this.decisionForm.justification.trim()) {
      alert('Please provide a justification for selecting this vendor.');
      return;
    }

    const payload: VendorSelectionPayload = {
      requisition_id: prId,
      vendor_id: vendor.vendor_id,
      quotation_amount: Number(this.decisionForm.quotation_amount),
      justification: this.decisionForm.justification.trim()
    };

    this.isSubmitting = true;
    this.closeSelectModal();

    this.procService.selectVendor(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.actionSuccessMessage = `Successfully selected ${vendor.name} for ${this.selectedRequisition?.request_number || 'Requisition'}. The requisition is now forwarded to the Finance Officer for financial approval.`;
        this.actionErrorMessage = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.loadRequisitionsAndVendors();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.actionErrorMessage = err?.error?.detail || 'Failed to record vendor selection.';
      }
    });
  }

  getScorePill(score: number): string {
    if (score >= 90) return 'score-high';
    if (score >= 75) return 'score-medium';
    return 'score-low';
  }

  getRiskBadgeClass(risk?: string): string {
    switch (risk?.toLowerCase()) {
      case 'low': return 'bg-success-subtle text-success border border-success';
      case 'medium': return 'bg-warning-subtle text-warning border border-warning';
      case 'high': return 'bg-danger-subtle text-danger border border-danger';
      default: return 'bg-secondary-subtle text-secondary';
    }
  }

  formatVendorId(id?: number): string {
    return id ? `VEN-${String(id).padStart(4, '0')}` : 'VEN-0000';
  }
}
