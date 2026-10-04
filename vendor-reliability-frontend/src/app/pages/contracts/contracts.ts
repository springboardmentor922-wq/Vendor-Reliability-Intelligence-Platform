import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ContractService, Contract } from '../../services/contract.service';
import { VendorService, VendorModel } from '../../services/vendor.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

export interface Certification {
  id: number;
  vendor_id: number;
  vendor_name: string;
  cert_name: string;
  cert_number: string;
  issuing_body: string;
  issue_date: string;
  expiry_date: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
}

export interface VendorDocument {
  id: number;
  vendor_id: number;
  vendor_name: string;
  title: string;
  category: string;
  file_name: string;
  upload_date: string;
  file_size: string;
  status: 'Verified' | 'Pending Review';
}

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contracts.html',
  styleUrl: './contracts.css'
})
export class Contracts implements OnInit {
  activeTab: 'repository' | 'renewals' | 'certifications' | 'documents' = 'repository';
  contracts: Contract[] = [];
  vendors: VendorModel[] = [];
  isLoading = false;

  selectedStatus = 'All';
  selectedCompliance = 'All';
  searchQuery = '';

  // Stats
  totalContractValue = 0;
  compliantCount = 0;
  expiringCount = 0;

  // New Contract Modal
  showModal = false;
  newContract: Partial<Contract> = {
    title: '',
    vendor_id: 0,
    start_date: new Date().toISOString().substring(0, 10),
    expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    renewal_terms: 'Auto-renewal with 60 days written notice',
    contract_value: 50000,
    compliance_status: 'Compliant'
  };

  // Renewal Modal
  showRenewModal = false;
  selectedContractForRenew: Contract | null = null;
  renewalForm = {
    extensionMonths: 12,
    adjustmentPercent: 0,
    revisedTerms: 'Extended for 12 additional months under updated master service agreement.'
  };

  // Certifications
  certifications: Certification[] = [
    {
      id: 1,
      vendor_id: 1,
      vendor_name: 'Acme Industrial Supplies',
      cert_name: 'ISO 9001:2015 Quality Management',
      cert_number: 'QM-84920-US',
      issuing_body: 'TUV Rheinland North America',
      issue_date: '2024-03-15',
      expiry_date: '2027-03-14',
      status: 'Valid'
    },
    {
      id: 2,
      vendor_id: 2,
      vendor_name: 'Apex Semiconductor Tech',
      cert_name: 'ISO 14001 Environmental Standard',
      cert_number: 'ENV-39102-CA',
      issuing_body: 'BSI Group',
      issue_date: '2023-08-10',
      expiry_date: '2026-10-15',
      status: 'Expiring Soon'
    },
    {
      id: 3,
      vendor_id: 3,
      vendor_name: 'Global Cargo Logistics',
      cert_name: 'C-TPAT Supply Chain Security',
      cert_number: 'CTPAT-99120-SEA',
      issuing_body: 'US Customs and Border Protection',
      issue_date: '2024-01-20',
      expiry_date: '2028-01-19',
      status: 'Valid'
    },
    {
      id: 4,
      vendor_id: 1,
      vendor_name: 'Acme Industrial Supplies',
      cert_name: 'OSHA 18001 Safety Standard',
      cert_number: 'OSH-48190-IL',
      issuing_body: 'Safety Board USA',
      issue_date: '2022-11-01',
      expiry_date: '2025-11-01',
      status: 'Valid'
    }
  ];

  showCertModal = false;
  newCert: Partial<Certification> = {
    vendor_id: 0,
    cert_name: '',
    cert_number: '',
    issuing_body: '',
    issue_date: new Date().toISOString().substring(0, 10),
    expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    status: 'Valid'
  };

  // Vendor Documentation
  documents: VendorDocument[] = [
    {
      id: 1,
      vendor_id: 1,
      vendor_name: 'Acme Industrial Supplies',
      title: 'Master Service Agreement 2026',
      category: 'Legal Contract',
      file_name: 'Acme_MSA_Executed_2026.pdf',
      upload_date: '2026-01-15',
      file_size: '2.4 MB',
      status: 'Verified'
    },
    {
      id: 2,
      vendor_id: 1,
      vendor_name: 'Acme Industrial Supplies',
      title: 'Mutual Non-Disclosure Agreement (NDA)',
      category: 'Compliance NDA',
      file_name: 'Acme_Bilateral_NDA.pdf',
      upload_date: '2025-06-10',
      file_size: '680 KB',
      status: 'Verified'
    },
    {
      id: 3,
      vendor_id: 2,
      vendor_name: 'Apex Semiconductor Tech',
      title: 'W-9 Federal Tax Exemption Certificate',
      category: 'Finance & Tax',
      file_name: 'Apex_W9_Signed_2026.pdf',
      upload_date: '2026-02-01',
      file_size: '410 KB',
      status: 'Verified'
    },
    {
      id: 4,
      vendor_id: 3,
      vendor_name: 'Global Cargo Logistics',
      title: 'Certificate of Marine & Freight Insurance (COI)',
      category: 'Insurance Certificate',
      file_name: 'GlobalCargo_COI_10M_Policy.pdf',
      upload_date: '2026-01-20',
      file_size: '1.2 MB',
      status: 'Verified'
    }
  ];

  constructor(
    private contractService: ContractService,
    private vendorService: VendorService,
    private notifService: NotificationService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadContracts();
    if (this.authService.currentUserValue?.role !== 'Vendor') {
      this.vendorService.getVendors().subscribe({
        next: (v) => {
          this.vendors = v;
          if (v.length > 0 && !this.newContract.vendor_id) {
            this.newContract.vendor_id = v[0].id;
          }
        }
      });
    }
  }

  loadContracts(): void {
    this.isLoading = true;
    const user = this.authService.currentUserValue;
    const filters: any = {
      status: this.selectedStatus,
      compliance_status: this.selectedCompliance
    };
    if (user?.role === 'Vendor' && user.vendor_id) {
      filters.vendor_id = user.vendor_id;
    }
    this.contractService.getContracts(filters, true).subscribe({
      next: (data) => {
        if (user?.role === 'Vendor') {
          this.contracts = data.filter(c =>
            (user.vendor_id && c.vendor_id === user.vendor_id) ||
            (user.company && (c.vendor?.company === user.company || c.vendor?.name === user.company)) ||
            (!user.vendor_id && !user.company)
          );
        } else {
          this.contracts = data;
        }

        // Compute Key Metrics
        this.totalContractValue = this.contracts.reduce((sum, c) => sum + Number(c.contract_value || 0), 0);
        this.compliantCount = this.contracts.filter(c => c.compliance_status === 'Compliant').length;
        this.expiringCount = this.contracts.filter(c => this.getDaysUntilExpiry(c.expiry_date) <= 60 && this.getDaysUntilExpiry(c.expiry_date) > 0).length;

        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  getDaysUntilExpiry(expiryDate: string): number {
    if (!expiryDate) return 999;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getExpiryBadgeClass(expiryDate: string): string {
    const days = this.getDaysUntilExpiry(expiryDate);
    if (days < 0) return 'bg-danger text-white';
    if (days <= 30) return 'bg-danger-subtle text-danger border border-danger';
    if (days <= 60) return 'bg-warning-subtle text-warning-emphasis border border-warning';
    return 'bg-success-subtle text-success border border-success';
  }

  getExpiryLabel(expiryDate: string): string {
    const days = this.getDaysUntilExpiry(expiryDate);
    if (days < 0) return 'Expired';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `${days} days left`;
  }

  get expiringContracts(): Contract[] {
    return this.contracts.filter(c => {
      const days = this.getDaysUntilExpiry(c.expiry_date);
      return days <= 90;
    });
  }

  openNewModal(): void {
    this.newContract = {
      title: '',
      vendor_id: this.vendors[0]?.id || 0,
      start_date: new Date().toISOString().substring(0, 10),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      renewal_terms: 'Annual renewal with 30-day notice',
      contract_value: 50000,
      compliance_status: 'Compliant'
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  submitContract(): void {
    if (!this.newContract.title || !this.newContract.vendor_id) return;
    this.contractService.createContract(this.newContract).subscribe({
      next: () => {
        this.closeModal();
        this.loadContracts();
      },
      error: (err) => alert(err?.error?.detail || 'Failed to create contract.')
    });
  }

  openRenewModal(c: Contract): void {
    this.selectedContractForRenew = c;
    this.renewalForm = {
      extensionMonths: 12,
      adjustmentPercent: 0,
      revisedTerms: `Extended for 12 months. Auto-renewal terms maintained.`
    };
    this.showRenewModal = true;
  }

  closeRenewModal(): void {
    this.showRenewModal = false;
    this.selectedContractForRenew = null;
  }

  submitRenewal(): void {
    if (!this.selectedContractForRenew) return;
    const currentExp = new Date(this.selectedContractForRenew.expiry_date);
    currentExp.setMonth(currentExp.getMonth() + Number(this.renewalForm.extensionMonths));

    const updatedData: Partial<Contract> = {
      expiry_date: currentExp.toISOString().substring(0, 10),
      status: 'Active',
      renewal_terms: this.renewalForm.revisedTerms
    };

    this.contractService.updateContract(this.selectedContractForRenew.id!, updatedData).subscribe({
      next: () => {
        alert(`Contract ${this.selectedContractForRenew?.contract_number} renewed successfully until ${updatedData.expiry_date}!`);
        this.notifService.createNotification({
          title: `Contract Renewed: ${this.selectedContractForRenew?.contract_number}`,
          message: `Contract with ${this.selectedContractForRenew?.vendor?.name} was renewed for ${this.renewalForm.extensionMonths} months.`,
          type: 'contract_expiry'
        }).subscribe();
        this.closeRenewModal();
        this.loadContracts();
      },
      error: (err) => alert(err?.error?.detail || 'Renewal update completed.')
    });
  }

  openCertModal(): void {
    this.newCert = {
      vendor_id: this.vendors[0]?.id || 1,
      cert_name: 'ISO 9001:2015 Quality Management',
      cert_number: `CERT-${Math.floor(10000 + Math.random() * 90000)}`,
      issuing_body: 'Global Certification Body',
      issue_date: new Date().toISOString().substring(0, 10),
      expiry_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      status: 'Valid'
    };
    this.showCertModal = true;
  }

  submitCert(): void {
    if (!this.newCert.cert_name || !this.newCert.cert_number) return;
    const vendor = this.vendors.find(v => v.id === Number(this.newCert.vendor_id));
    this.certifications.unshift({
      id: Date.now(),
      vendor_id: Number(this.newCert.vendor_id),
      vendor_name: vendor ? vendor.name : 'Registered Supplier',
      cert_name: this.newCert.cert_name,
      cert_number: this.newCert.cert_number,
      issuing_body: this.newCert.issuing_body || 'Accredited Registrar',
      issue_date: this.newCert.issue_date || new Date().toISOString().substring(0, 10),
      expiry_date: this.newCert.expiry_date || new Date().toISOString().substring(0, 10),
      status: 'Valid'
    });
    this.showCertModal = false;
  }

  downloadDoc(doc: VendorDocument): void {
    const sampleText = `VENDORIQ DOCUMENT REPOSITORY\nTitle: ${doc.title}\nVendor: ${doc.vendor_name}\nCategory: ${doc.category}\nFile: ${doc.file_name}\nStatus: Verified\nVerified by Corporate Compliance`;
    const blob = new Blob([sampleText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.file_name;
    link.click();
    URL.revokeObjectURL(url);
  }
}
