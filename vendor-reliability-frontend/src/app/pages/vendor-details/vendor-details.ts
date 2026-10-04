import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, NgClass, DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { VendorService, VendorModel, VendorContact } from '../../services/vendor.service';
import { PurchaseOrderService, PurchaseOrder } from '../../services/purchase-order.service';
import { ContractService, Contract } from '../../services/contract.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-vendor-details',
  imports: [RouterLink, FormsModule, NgIf, NgFor, NgClass, DatePipe, CurrencyPipe, DecimalPipe],
  templateUrl: './vendor-details.html',
  styleUrl: './vendor-details.css'
})
export class VendorDetails implements OnInit {
  vendor: VendorModel | null = null;
  pos: PurchaseOrder[] = [];
  contracts: Contract[] = [];
  isLoading = true;
  errorMessage = '';
  feedbackMessage = '';
  feedbackType: 'success' | 'danger' = 'success';

  // Navigation tab state
  activeTab: 'overview' | 'deliveries' | 'orders' | 'catalog' | 'contracts' | 'audit' = 'overview';

  // Approval Workflow
  reviewNotes = '';
  isProcessingApproval = false;

  // Edit Profile Modal
  showEditModal = false;
  editVendorForm: Partial<VendorModel> = {};
  isSavingProfile = false;

  // Official Vendor Categories
  categories = [
    'IT & Electronics',
    'Raw Materials',
    'Office Supplies & Equipment',
    'Machinery & Spare Parts',
    'Logistics & Transportation',
    'Services & Maintenance'
  ];

  // Add Contact Modal
  showContactModal = false;
  newContact: VendorContact = {
    contact_name: '',
    title: '',
    email: '',
    phone: '',
    is_primary: false
  };

  constructor(
    private route: ActivatedRoute,
    private vendorService: VendorService,
    private poService: PurchaseOrderService,
    private contractService: ContractService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadVendor(Number(id));
      }
    });
  }

  loadVendor(id: number): void {
    this.isLoading = true;
    this.vendorService.getVendorProfile(id).subscribe({
      next: (profile) => {
        this.vendor = {
          ...profile,
          deliveryRate: profile.performance?.on_time_delivery_rate ?? profile.deliveryRate ?? 0,
          risk_level: profile.performance?.risk_level ?? profile.risk_level ?? 'Low',
          risk_reasons: profile.performance?.risk_reasons ?? []
        };
        this.isLoading = false;
        this.loadVendorPOs(id);
        this.loadVendorContracts(id);
      },
      error: () => {
        this.vendorService.getVendor(id).subscribe({
          next: (data) => {
            this.vendor = data;
            this.isLoading = false;
            this.loadVendorPOs(id);
            this.loadVendorContracts(id);
          },
          error: () => {
            this.isLoading = false;
            this.errorMessage = 'Vendor details not found or access restricted.';
          }
        });
      }
    });
  }

  loadVendorPOs(vendorId: number): void {
    this.poService.getPurchaseOrders({ vendor_id: vendorId }).subscribe({
      next: (data) => this.pos = data,
      error: () => {}
    });
  }

  loadVendorContracts(vendorId: number): void {
    this.contractService.getContracts({ vendor_id: vendorId }).subscribe({
      next: (data) => this.contracts = data,
      error: () => {}
    });
  }

  setActiveTab(tab: 'overview' | 'deliveries' | 'orders' | 'catalog' | 'contracts' | 'audit'): void {
    this.activeTab = tab;
  }

  showFeedback(msg: string, type: 'success' | 'danger' = 'success'): void {
    this.feedbackMessage = msg;
    this.feedbackType = type;
    setTimeout(() => {
      this.feedbackMessage = '';
    }, 6000);
  }

  approve(): void {
    if (!this.vendor?.id) return;
    this.isProcessingApproval = true;
    const vendorName = this.vendor.name;
    this.vendor.status = 'Approved';
    this.showFeedback(`Vendor "${vendorName}" successfully approved and activated! Initial reliability score set to 0.0%.`, 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.vendorService.approveVendor(this.vendor.id, this.reviewNotes).subscribe({
      next: (updated) => {
        this.vendor = { ...this.vendor, ...updated, status: 'Approved' };
        this.isProcessingApproval = false;
      },
      error: (err) => {
        this.isProcessingApproval = false;
        this.showFeedback(err?.error?.detail || 'Approval failed.', 'danger');
      }
    });
  }

  reject(): void {
    if (!this.vendor?.id) return;
    this.isProcessingApproval = true;
    this.vendorService.rejectVendor(this.vendor.id, this.reviewNotes).subscribe({
      next: (updated) => {
        this.vendor = { ...this.vendor, ...updated, status: 'Rejected' };
        this.isProcessingApproval = false;
        this.showFeedback('Vendor has been marked as Rejected.', 'danger');
      },
      error: (err) => {
        this.isProcessingApproval = false;
        this.showFeedback(err?.error?.detail || 'Rejection failed.', 'danger');
      }
    });
  }

  openContactModal(): void {
    this.newContact = { contact_name: '', title: '', email: '', phone: '', is_primary: false };
    this.showContactModal = true;
  }

  closeContactModal(): void {
    this.showContactModal = false;
  }

  saveContact(): void {
    if (!this.vendor?.id || !this.newContact.contact_name || !this.newContact.email || !this.newContact.phone) return;
    this.vendorService.addContact(this.vendor.id, this.newContact).subscribe({
      next: () => {
        this.closeContactModal();
        this.showFeedback('New vendor contact added successfully.', 'success');
        this.loadVendor(this.vendor!.id!);
      },
      error: (err) => {
        this.showFeedback(err?.error?.detail || 'Failed to add contact.', 'danger');
      }
    });
  }

  deleteContact(contactId: number | undefined): void {
    if (!this.vendor?.id || !contactId) return;
    if (!confirm('Are you sure you want to remove this vendor contact?')) return;
    this.vendorService.deleteContact(this.vendor.id, contactId).subscribe({
      next: () => {
        if (this.vendor && this.vendor.contacts) {
          this.vendor.contacts = this.vendor.contacts.filter(c => c.id !== contactId);
        }
        this.showFeedback('Contact removed successfully.', 'success');
      },
      error: (err) => {
        this.showFeedback(err?.error?.detail || 'Failed to remove contact.', 'danger');
      }
    });
  }

  openEditProfileModal(): void {
    if (!this.vendor) return;
    this.editVendorForm = {
      name: this.vendor.name,
      company: this.vendor.company,
      email: this.vendor.email,
      phone: this.vendor.phone,
      address: this.vendor.address || '',
      website: this.vendor.website || '',
      product: this.vendor.product,
      category: this.vendor.category,
      risk_level: this.vendor.risk_level || 'Low',
      status: this.vendor.status,
      notes: this.vendor.notes || ''
    };
    this.showEditModal = true;
  }

  closeEditProfileModal(): void {
    this.showEditModal = false;
  }

  saveVendorProfile(): void {
    if (!this.vendor?.id) return;
    this.isSavingProfile = true;
    this.vendorService.updateVendor(this.vendor.id, this.editVendorForm).subscribe({
      next: (updated) => {
        this.vendor = { ...this.vendor, ...updated };
        this.isSavingProfile = false;
        this.showEditModal = false;
        this.showFeedback('Vendor profile updated successfully.', 'success');
      },
      error: (err) => {
        this.isSavingProfile = false;
        this.showFeedback(err?.error?.detail || 'Failed to update vendor profile.', 'danger');
      }
    });
  }

  updateVendorStatus(newStatus: string): void {
    if (!this.vendor?.id) return;
    this.vendorService.updateVendor(this.vendor.id, { status: newStatus }).subscribe({
      next: (updated) => {
        if (this.vendor) this.vendor.status = updated.status;
        this.showFeedback(`Vendor status changed to ${newStatus}.`, 'success');
      },
      error: (err) => {
        this.showFeedback(err?.error?.detail || 'Failed to update status.', 'danger');
      }
    });
  }

  // --- UI Metric Helpers ---
  get reliabilityScore(): number {
    return Math.round(this.vendor?.performance?.reliability_score ?? this.vendor?.deliveryRate ?? 0);
  }

  get onTimeRate(): number {
    return Math.round(this.vendor?.performance?.on_time_delivery_rate ?? this.vendor?.deliveryRate ?? 0);
  }

  get fulfillmentRate(): number {
    return Math.round(this.vendor?.performance?.fulfillment_rate ?? 0);
  }

  get qualityScore(): number {
    return Number((this.vendor?.performance?.quality_rating ?? this.vendor?.quality_rating ?? 0).toFixed(1));
  }

  get deliveries(): any[] {
    return this.vendor?.delivery_history || [];
  }

  getCircumference(radius: number): number {
    return 2 * Math.PI * radius;
  }

  getStrokeDashoffset(score: number, radius: number): number {
    const c = this.getCircumference(radius);
    const clamped = Math.max(0, Math.min(100, score || 0));
    return c - (clamped / 100) * c;
  }

  getReliabilityColor(score: number): string {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#2563eb';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  getReliabilityGrade(score: number): string {
    if (score >= 95) return 'Grade A+ (Preferred Partner)';
    if (score >= 85) return 'Grade A (Qualified Tier 1)';
    if (score >= 70) return 'Grade B (Monitored Tier 2)';
    return 'Grade C (High Operational Risk)';
  }

  getInitials(name?: string, company?: string): string {
    const source = company || name || 'VN';
    const parts = source.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.substring(0, 2).toUpperCase();
  }

  formatVendorId(id?: number): string {
    return 'VND-' + String(id || 0).padStart(4, '0');
  }

  getStatusClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'active':
        return 'badge-approved';
      case 'pending':
        return 'badge-pending';
      case 'under review':
        return 'badge-ordered';
      case 'rejected':
      case 'suspended':
      case 'blacklisted':
        return 'badge-rejected';
      default:
        return 'badge-pending';
    }
  }

  getRiskBadgeClass(risk?: string): string {
    switch (risk?.toLowerCase()) {
      case 'low': return 'badge-low-risk';
      case 'medium': return 'badge-med-risk';
      case 'high': return 'badge-high-risk';
      default: return 'badge-low-risk';
    }
  }
}
