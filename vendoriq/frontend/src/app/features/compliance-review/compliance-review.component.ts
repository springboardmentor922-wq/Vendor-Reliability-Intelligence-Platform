import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { Contract } from '../../core/models/models';
import { ContractService } from '../../core/services/contract.service';
import { VendorService } from '../../core/services/vendor.service';

interface CertificationRecord {
  id: number;
  vendor_id: string | number;
  contract_id?: number | null;
  name: string;
  issuing_body?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status?: string;
  file_path?: string | null;
  created_at?: string;
}

interface VendorRecord {
  id: string | number;
  company_name: string;
}

interface CertificationRow extends CertificationRecord {
  vendor_name: string;
  calculated_status: 'valid' | 'expiring' | 'expired';
}

@Component({
  selector: 'app-compliance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './compliance-review.component.html'
})
export class ComplianceReviewComponent implements OnInit {

  loading = true;
  error = '';

  certifications: CertificationRow[] = [];
  contracts: Contract[] = [];
  vendors: VendorRecord[] = [];

  complianceRate = 0;
  compliantCount = 0;
  expiredCount = 0;
  expiringCount = 0;

  activeContracts = 0;
  expiringContracts = 0;
  expiredContracts = 0;
  renewalRequired = 0;

  constructor(
    private http: HttpClient,
    private contractService: ContractService,
    private vendorService: VendorService
  ) {}

  ngOnInit(): void {
    this.loadCompliance();
  }

  loadCompliance(): void {
    this.loading = true;
    this.error = '';

    forkJoin({
      vendors: this.vendorService.list({}).pipe(
        catchError(() => of([]))
      ),

      contracts: this.contractService.list({}).pipe(
        catchError(() => of([]))
      )
    }).subscribe({
      next: ({ vendors, contracts }) => {

        this.vendors = (vendors || []) as VendorRecord[];
        this.contracts = contracts || [];

        this.calculateContractSummary();
        this.loadCertifications();

      },

      error: () => {
        this.error = 'Failed to load compliance information.';
        this.loading = false;
      }
    });
  }

  loadCertifications(): void {

    if (!this.vendors.length) {
      this.certifications = [];
      this.calculateCertificationSummary();
      this.loading = false;
      return;
    }

    const requests = this.vendors.map(vendor =>
      this.http
        .get<CertificationRecord[]>(
          `${environment.apiUrl}/contracts/certifications/by-vendor/${vendor.id}`
        )
        .pipe(
          catchError(() => of([]))
        )
    );

    forkJoin(requests).subscribe({
      next: (results) => {

        const rows: CertificationRow[] = [];

        results.forEach((records, index) => {

          const vendor = this.vendors[index];

          (records || []).forEach(certification => {

            rows.push({
              ...certification,
              vendor_name: vendor.company_name,
              calculated_status:
                this.calculateCertificationStatus(certification)
            });

          });

        });

        this.certifications = rows;

        this.calculateCertificationSummary();

        this.loading = false;
      },

      error: () => {
        this.error = 'Failed to load certification information.';
        this.loading = false;
      }
    });
  }

  calculateCertificationStatus(
    certification: CertificationRecord
  ): 'valid' | 'expiring' | 'expired' {

    if (!certification.expiry_date) {
      return 'valid';
    }

    const expiry = new Date(certification.expiry_date);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    if (expiry < today) {
      return 'expired';
    }

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(
      thirtyDaysFromNow.getDate() + 30
    );

    if (expiry <= thirtyDaysFromNow) {
      return 'expiring';
    }

    return 'valid';
  }

  calculateCertificationSummary(): void {

    this.compliantCount = this.certifications.filter(
      certification =>
        certification.calculated_status === 'valid'
    ).length;

    this.expiredCount = this.certifications.filter(
      certification =>
        certification.calculated_status === 'expired'
    ).length;

    this.expiringCount = this.certifications.filter(
      certification =>
        certification.calculated_status === 'expiring'
    ).length;

    const total = this.certifications.length;

    this.complianceRate =
      total > 0
        ? Math.round(
            (this.compliantCount / total) * 100
          )
        : 0;
  }

  calculateContractSummary(): void {

    this.activeContracts = this.contracts.filter(
      contract =>
        contract.status === 'active' ||
        contract.status === 'renewed'
    ).length;

    this.expiringContracts = this.contracts.filter(
      contract =>
        contract.status === 'expiring'
    ).length;

    this.expiredContracts = this.contracts.filter(
      contract =>
        contract.status === 'expired'
    ).length;

    this.renewalRequired =
      this.expiringContracts;
  }

  certificationStatusClass(
    status: string
  ): string {

    switch (status) {

      case 'valid':
        return 'bg-success';

      case 'expiring':
        return 'bg-warning text-dark';

      case 'expired':
        return 'bg-danger';

      default:
        return 'bg-secondary';
    }
  }

  contractStatusClass(
    status: string
  ): string {

    switch (status) {

      case 'active':
      case 'renewed':
        return 'bg-success';

      case 'expiring':
        return 'bg-warning text-dark';

      case 'expired':
        return 'bg-danger';

      case 'terminated':
        return 'bg-secondary';

      default:
        return 'bg-secondary';
    }
  }

  formatStatus(status: string): string {

    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  formatDate(date?: string | null): string {

    if (!date) {
      return '—';
    }

    return new Date(date).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );
  }

  vendorName(vendorId: string | number): string {

    const vendor = this.vendors.find(
      item => String(item.id) === String(vendorId)
    );

    return vendor?.company_name || `Vendor #${vendorId}`;
  }

  get hasComplianceAlerts(): boolean {

    return (
      this.expiredCount > 0 ||
      this.expiringCount > 0 ||
      this.expiredContracts > 0 ||
      this.expiringContracts > 0
    );
  }
}