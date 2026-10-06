import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-contract-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contract-management.component.html',
  styleUrls: ['./contract-management.component.css']
})
export class ContractManagementComponent implements OnInit {

  contracts: any[] = [];
  certifications: any[] = [];

  showForm = false;
  showCertificationForm = false;

  contract = {
    vendor_id: 1,
    contract_number: '',
    contract_type: '',
    start_date: '',
    end_date: '',
    contract_value: null as number | null,
    renewal_date: '',
    terms: '',
    document: '',
    compliance_status: 'COMPLIANT'
  };

  certification = {
    vendor_id: 1,
    certification_name: '',
    certificate_number: '',
    issue_date: '',
    expiry_date: '',
    document: ''
  };

  private apiUrl = 'http://localhost:8000/api/contracts/';
  private certificationApiUrl = 'http://localhost:8000/api/certifications/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadContracts();
    this.loadCertifications();
  }

  // =========================
  // CONTRACTS
  // =========================

  get totalContracts(): number {
    return this.contracts.length;
  }

  get activeContracts(): number {
    return this.contracts.filter(
      item => item.status === 'ACTIVE'
    ).length;
  }

  get expiringSoon(): number {
    const today = new Date();
    const limit = new Date();

    limit.setDate(today.getDate() + 30);

    return this.contracts.filter(item => {
      if (!item.end_date || item.status === 'TERMINATED') {
        return false;
      }

      const endDate = new Date(item.end_date);

      return endDate >= today && endDate <= limit;
    }).length;
  }

  get nonCompliant(): number {
    return this.contracts.filter(
      item => item.compliance_status === 'NON_COMPLIANT'
    ).length;
  }

  loadContracts(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.contracts = data;
      },
      error: (error) => {
        console.error('Error loading contracts:', error);
      }
    });
  }

  createContract(): void {
    const params: any = {
      vendor_id: this.contract.vendor_id,
      contract_number: this.contract.contract_number,
      contract_type: this.contract.contract_type,
      start_date: this.contract.start_date,
      end_date: this.contract.end_date,
      contract_value: this.contract.contract_value ?? '',
      renewal_date: this.contract.renewal_date || '',
      terms: this.contract.terms,
      document: this.contract.document,
      compliance_status: this.contract.compliance_status
    };

    this.http.post(this.apiUrl, null, { params }).subscribe({
      next: () => {
        alert('Contract created successfully');

        this.showForm = false;

        this.contract = {
          vendor_id: 1,
          contract_number: '',
          contract_type: '',
          start_date: '',
          end_date: '',
          contract_value: null,
          renewal_date: '',
          terms: '',
          document: '',
          compliance_status: 'COMPLIANT'
        };

        this.loadContracts();
      },
      error: (error) => {
        console.error('Error creating contract:', error);
        alert('Failed to create contract');
      }
    });
  }

  terminateContract(id: number): void {
    if (!confirm('Are you sure you want to terminate this contract?')) {
      return;
    }

    this.http.put(`${this.apiUrl}${id}/terminate`, null).subscribe({
      next: () => {
        alert('Contract terminated');
        this.loadContracts();
      },
      error: (error) => {
        console.error('Error terminating contract:', error);
        alert('Failed to terminate contract');
      }
    });
  }

  // =========================
  // CERTIFICATIONS
  // =========================

  get totalCertifications(): number {
    return this.certifications.length;
  }

  get validCertifications(): number {
    return this.certifications.filter(
      item => item.expiry_status === 'VALID'
    ).length;
  }

  get expiringCertifications(): number {
    return this.certifications.filter(
      item => item.expiry_status === 'EXPIRING_SOON'
    ).length;
  }

  get expiredCertifications(): number {
    return this.certifications.filter(
      item => item.expiry_status === 'EXPIRED'
    ).length;
  }

  loadCertifications(): void {
    this.http.get<any[]>(this.certificationApiUrl).subscribe({
      next: (data) => {
        this.certifications = data;
      },
      error: (error) => {
        console.error('Error loading certifications:', error);
      }
    });
  }

  createCertification(): void {
    const params: any = {
      vendor_id: this.certification.vendor_id,
      certification_name: this.certification.certification_name,
      certificate_number: this.certification.certificate_number,
      issue_date: this.certification.issue_date,
      expiry_date: this.certification.expiry_date,
      document: this.certification.document
    };

    this.http.post(this.certificationApiUrl, null, { params }).subscribe({
      next: () => {
        alert('Certification added successfully');

        this.showCertificationForm = false;

        this.certification = {
          vendor_id: 1,
          certification_name: '',
          certificate_number: '',
          issue_date: '',
          expiry_date: '',
          document: ''
        };

        this.loadCertifications();
      },
      error: (error) => {
        console.error('Error creating certification:', error);

        if (error.status === 400) {
          alert(error.error?.detail || 'Certificate number already exists');
        } else {
          alert('Failed to add certification');
        }
      }
    });
  }

  updateCertificationStatus(
    id: number,
    status: string
  ): void {

    const params = {
      status: status
    };

    this.http.put(
      `${this.certificationApiUrl}${id}/update-status`,
      null,
      { params }
    ).subscribe({
      next: () => {
        this.loadCertifications();
      },
      error: (error) => {
        console.error(
          'Error updating certification status:',
          error
        );

        alert('Failed to update certification status');
      }
    });
  }

}