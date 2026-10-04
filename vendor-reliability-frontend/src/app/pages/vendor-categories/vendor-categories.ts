import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VendorService, VendorModel, VendorCategory } from '../../services/vendor.service';
import { AuthService } from '../../services/auth.service';
import { PurchaseOrderService } from '../../services/purchase-order.service';

export interface CategoryCardInfo {
  name: string;
  code: string;
  icon: string;
  color: string;
  description: string;
  typicalItems: string[];
  vendorCount: number;
  avgReliability: number;
  avgDelivery: number;
}

@Component({
  selector: 'app-vendor-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vendor-categories.html',
  styleUrl: './vendor-categories.css'
})
export class VendorCategories implements OnInit {
  officialCategories: CategoryCardInfo[] = [
    {
      name: 'IT & Electronics',
      code: 'ITE',
      icon: 'bi-laptop',
      color: '#2563eb',
      description: 'Enterprise computing hardware, laptops, servers, monitors, networking gear, and cloud infrastructure equipment.',
      typicalItems: ['Laptops', 'Desktops', 'Monitors', 'Servers', 'PoE Switches'],
      vendorCount: 0,
      avgReliability: 92.4,
      avgDelivery: 91.0
    },
    {
      name: 'Raw Materials',
      code: 'RAW',
      icon: 'bi-box-seam',
      color: '#f97316',
      description: 'Foundational industrial raw materials, structural steel, electrolytic copper, grade 53 cement, and polymers.',
      typicalItems: ['Structural Steel', 'Electrolytic Copper', 'Cement Grade 53', 'Polymers'],
      vendorCount: 0,
      avgReliability: 88.6,
      avgDelivery: 87.2
    },
    {
      name: 'Office Supplies & Equipment',
      code: 'OFF',
      icon: 'bi-briefcase',
      color: '#10b981',
      description: 'Corporate furniture, ergonomic workstation chairs, collaboration tables, paper, and workplace equipment.',
      typicalItems: ['Ergonomic Task Chairs', 'Modular Meeting Tables', 'Stationery Kits', 'Shredders'],
      vendorCount: 0,
      avgReliability: 94.1,
      avgDelivery: 93.5
    },
    {
      name: 'Machinery & Spare Parts',
      code: 'MSP',
      icon: 'bi-gear-wide-connected',
      color: '#8b5cf6',
      description: 'Industrial machinery, 3-phase electric motors, centrifugal slurry pumps, precision ball bearings, and plant components.',
      typicalItems: ['15kW Electric Motors', 'Centrifugal Water Pumps', 'Deep Groove Bearings', 'Gear Couplers'],
      vendorCount: 0,
      avgReliability: 89.8,
      avgDelivery: 88.0
    },
    {
      name: 'Logistics & Transportation',
      code: 'LOG',
      icon: 'bi-truck',
      color: '#06b6d4',
      description: 'Intermodal freight forwarding, 20-ton closed container linehaul, express air/rail freight, and warehousing.',
      typicalItems: ['20-Ton Linehaul Trips', 'Express Freight Shipments', 'Pallet Warehouse Storage'],
      vendorCount: 0,
      avgReliability: 95.3,
      avgDelivery: 94.8
    },
    {
      name: 'Services & Maintenance',
      code: 'SRV',
      icon: 'bi-tools',
      color: '#ec4899',
      description: 'Plant preventive maintenance SLAs, facility and HVAC quarterly service, certified 24x7 IT support, and repairs.',
      typicalItems: ['Preventive Maintenance SLAs', 'Facility & HVAC Contracts', '24x7 IT Support'],
      vendorCount: 0,
      avgReliability: 91.7,
      avgDelivery: 90.5
    }
  ];

  selectedCategory: string = 'IT & Electronics';
  allVendors: VendorModel[] = [];
  filteredVendors: VendorModel[] = [];
  searchQuery = '';
  selectedRiskFilter = 'All';
  selectedSort = 'reliability';
  isLoading = true;

  // Quick view drawer / modal
  selectedVendorForQuickView: VendorModel | null = null;

  constructor(
    private vendorService: VendorService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        const found = this.officialCategories.find(c => c.name.toLowerCase() === params['category'].toLowerCase());
        if (found) {
          this.selectedCategory = found.name;
        }
      }
      this.loadVendors();
    });
  }

  loadVendors(): void {
    this.isLoading = true;
    this.vendorService.getVendors({}, true).subscribe({
      next: (vendors) => {
        this.allVendors = vendors || [];
        this.computeCategoryMetrics();
        this.applyFilter();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  computeCategoryMetrics(): void {
    this.officialCategories.forEach(cat => {
      const matching = this.allVendors.filter(v => this.isCategoryMatch(v.category, cat.name));
      cat.vendorCount = matching.length;
      if (matching.length > 0) {
        const totalRel = matching.reduce((sum, v) => sum + (v.deliveryRate || 85), 0);
        cat.avgReliability = Math.round((totalRel / matching.length) * 10) / 10;
        cat.avgDelivery = cat.avgReliability;
      }
    });
  }

  selectCategory(categoryName: string): void {
    this.selectedCategory = categoryName;
    this.searchQuery = '';
    this.applyFilter();
  }

  applyFilter(): void {
    let result = this.allVendors.filter(v => this.isCategoryMatch(v.category, this.selectedCategory));

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(v =>
        v.name?.toLowerCase().includes(q) ||
        v.company?.toLowerCase().includes(q) ||
        v.product?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q)
      );
    }

    if (this.selectedRiskFilter !== 'All') {
      result = result.filter(v => v.risk_level?.toLowerCase() === this.selectedRiskFilter.toLowerCase());
    }

    // Sort
    if (this.selectedSort === 'reliability') {
      result.sort((a, b) => (b.deliveryRate || 0) - (a.deliveryRate || 0));
    } else if (this.selectedSort === 'quality') {
      result.sort((a, b) => (b.quality_rating || 0) - (a.quality_rating || 0));
    } else if (this.selectedSort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    this.filteredVendors = result;
  }

  private isCategoryMatch(vendorCat: string, targetCat: string): boolean {
    if (!vendorCat) return false;
    const vc = vendorCat.toLowerCase().trim();
    const tc = targetCat.toLowerCase().trim();
    if (vc === tc) return true;
    if (tc.includes('it') && (vc.includes('it') || vc.includes('electronic'))) return true;
    if (tc.includes('raw') && vc.includes('raw')) return true;
    if (tc.includes('office') && vc.includes('office')) return true;
    if (tc.includes('machinery') && (vc.includes('machinery') || vc.includes('equipment'))) return true;
    if (tc.includes('logistics') && (vc.includes('logistics') || vc.includes('transport'))) return true;
    if (tc.includes('service') && (vc.includes('service') || vc.includes('maintenance'))) return true;
    return false;
  }

  getSelectedCategoryInfo(): CategoryCardInfo | undefined {
    return this.officialCategories.find(c => c.name === this.selectedCategory);
  }

  goToVendorSelection(categoryName: string): void {
    this.router.navigate(['/vendor-selection'], { queryParams: { category: categoryName } });
  }

  openQuickView(v: VendorModel): void {
    this.selectedVendorForQuickView = v;
  }

  closeQuickView(): void {
    this.selectedVendorForQuickView = null;
  }

  getScorePill(rate: number): string {
    if (rate >= 90) return 'score-high';
    if (rate >= 75) return 'score-medium';
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

  getStatusClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'approved': return 'badge-approved';
      case 'active': return 'badge-approved';
      case 'pending': return 'badge-pending';
      case 'rejected': return 'badge-rejected';
      default: return 'badge-pending';
    }
  }

  formatVendorId(id?: number): string {
    return id ? `VEN-${String(id).padStart(4, '0')}` : 'VEN-0000';
  }
}
