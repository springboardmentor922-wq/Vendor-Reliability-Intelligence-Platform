import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReliabilityService, VendorReliabilityProfile } from '../../services/reliability.service';

@Component({
  selector: 'app-vendor-reliability',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vendor-reliability.html',
  styleUrl: './vendor-reliability.css'
})
export class VendorReliability implements OnInit {
  isLoading = true;
  profiles: VendorReliabilityProfile[] = [];
  filteredProfiles: VendorReliabilityProfile[] = [];
  selectedProfile: VendorReliabilityProfile | null = null;

  selectedTier = 'All';
  selectedRisk = 'All';
  selectedCategory = 'All';
  searchQuery = '';

  categories = [
    'Raw Material Suppliers',
    'Equipment Vendors',
    'IT Vendors',
    'Service Providers',
    'Logistics Partners',
    'Maintenance Vendors'
  ];

  constructor(private reliabilityService: ReliabilityService) {}

  ngOnInit(): void {
    this.loadProfiles();
  }

  loadProfiles(): void {
    this.isLoading = true;
    this.reliabilityService.getReliabilityProfiles().subscribe({
      next: (profs) => {
        this.profiles = profs;
        this.applyFilter();
        if (this.profiles.length > 0) {
          this.selectedProfile = this.profiles[0];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load reliability profiles:', err);
        this.isLoading = false;
      }
    });
  }

  selectProfile(p: VendorReliabilityProfile): void {
    this.selectedProfile = p;
  }

  applyFilter(): void {
    let result = [...this.profiles];

    if (this.selectedTier !== 'All') {
      result = result.filter(p => p.tier === this.selectedTier);
    }

    if (this.selectedRisk !== 'All') {
      result = result.filter(p => p.riskLevel === this.selectedRisk);
    }

    if (this.selectedCategory !== 'All') {
      result = result.filter(p => p.category === this.selectedCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(p =>
        p.vendorName.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    this.filteredProfiles = result;
    if (this.filteredProfiles.length > 0 && (!this.selectedProfile || !this.filteredProfiles.some(p => p.vendorId === this.selectedProfile?.vendorId))) {
      this.selectedProfile = this.filteredProfiles[0];
    }
  }

  getRiskBadgeClass(risk: string): string {
    switch (risk) {
      case 'Low': return 'bg-success text-white';
      case 'Medium': return 'bg-warning text-dark';
      case 'High': return 'bg-danger text-white';
      case 'Critical':
      case 'Critical Risk': return 'bg-dark text-white border border-danger';
      default: return 'bg-secondary text-white';
    }
  }

  getTierBadgeClass(tier: string): string {
    switch (tier) {
      case 'Tier-1 Strategic': return 'bg-primary text-white';
      case 'Tier-2 Preferred': return 'bg-info text-dark';
      case 'Tier-3 Standard': return 'bg-secondary text-white';
      case 'At-Risk': return 'bg-danger text-white';
      default: return 'bg-light text-dark';
    }
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'Improving': return 'bi-arrow-up-right text-success';
      case 'Declining': return 'bi-arrow-down-right text-danger';
      default: return 'bi-arrow-right text-muted';
    }
  }
}
