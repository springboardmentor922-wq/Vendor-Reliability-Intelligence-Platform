import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  Contract,
  ContractService,
  Certification,
  VendorDocument,
  CONTRACT_STATUSES,
  COMPLIANCE_STATUSES,
  CERTIFICATION_STATUSES,
  DOCUMENT_STATUSES
} from '../../core/services/contract';

import {
  Vendor,
  VendorService
} from '../../core/services/vendor';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './contracts.html',
  styleUrl: './contracts.scss'
})
export class Contracts implements OnInit {

  contracts: Contract[] = [];
  certifications: Certification[] = [];
  documents: VendorDocument[] = [];
  vendors: Vendor[] = [];

  expiringContracts: Contract[] = [];

  statuses = [...CONTRACT_STATUSES];
  complianceStatuses = [...COMPLIANCE_STATUSES];
  certificationStatuses = [...CERTIFICATION_STATUSES];
  documentStatuses = [...DOCUMENT_STATUSES];

  showContractForm = false;
  showCertificationForm = false;
  showDocumentForm = false;

  loading = false;
  saving = false;

  successMessage = '';
  errorMessage = '';

  contractForm!: FormGroup;
  certificationForm!: FormGroup;
  documentForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private contractService: ContractService,
    private vendorService: VendorService
  ) {}

  ngOnInit(): void {
    this.initializeForms();
    this.loadAll();
  }

  initializeForms(): void {

    this.contractForm = this.fb.group({
      contract_number: [
        '',
        [
          Validators.required,
          Validators.minLength(2)
        ]
      ],

      title: [
        '',
        [
          Validators.required,
          Validators.minLength(2)
        ]
      ],

      contract_type: [
        '',
        [
          Validators.required,
          Validators.minLength(2)
        ]
      ],

      vendor_id: [
        '',
        Validators.required
      ],

      start_date: [
        '',
        Validators.required
      ],

      end_date: [
        '',
        Validators.required
      ],

      renewal_date: [
        ''
      ],

      contract_value: [
        0,
        [
          Validators.required,
          Validators.min(0)
        ]
      ],

      payment_terms: [
        ''
      ],

      notes: [
        ''
      ]
    });

    this.certificationForm = this.fb.group({
      vendor_id: [
        '',
        Validators.required
      ],

      name: [
        '',
        Validators.required
      ],

      certificate_number: [
        '',
        Validators.required
      ],

      issue_date: [
        '',
        Validators.required
      ],

      expiry_date: [
        '',
        Validators.required
      ]
    });

    this.documentForm = this.fb.group({
      vendor_id: [
        '',
        Validators.required
      ],

      document_type: [
        '',
        Validators.required
      ],

      document_name: [
        '',
        Validators.required
      ],

      document_number: [
        ''
      ],

      issue_date: [
        ''
      ],

      expiry_date: [
        ''
      ],

      status: [
        'Active'
      ],

      notes: [
        ''
      ]
    });
  }

  loadAll(): void {

    this.loading = true;
    this.clearMessages();

    this.loadVendors();
    this.loadContracts();
    this.loadCertifications();
    this.loadDocuments();
    this.loadExpiringContracts();

    setTimeout(() => {
      this.loading = false;
    }, 300);
  }

  loadVendors(): void {

    this.vendorService.getVendors().subscribe({

      next: (data: Vendor[]) => {
        this.vendors = data;
      },

      error: (error: HttpErrorResponse) => {
        console.error('Vendor loading error:', error);

        this.vendors = [];

        if (error.status === 500) {
          this.errorMessage =
            'Unable to load vendors. Please check the vendor email validation issue in the backend.';
        }
      }
    });
  }

  loadContracts(): void {

    this.contractService.getContracts().subscribe({

      next: (data: Contract[]) => {
        this.contracts = data;
      },

      error: (error: HttpErrorResponse) => {
        this.handleError(error);
      }
    });
  }

  loadCertifications(): void {

    this.contractService.getCertifications().subscribe({

      next: (data: Certification[]) => {
        this.certifications = data;
      },

      error: (error: HttpErrorResponse) => {
        this.handleError(error);
      }
    });
  }

  loadDocuments(): void {

    this.contractService.getDocuments().subscribe({

      next: (data: VendorDocument[]) => {
        this.documents = data;
      },

      error: (error: HttpErrorResponse) => {
        this.handleError(error);
      }
    });
  }

  loadExpiringContracts(): void {

    this.contractService
      .getExpiringContracts(30)
      .subscribe({

        next: (data: Contract[]) => {
          this.expiringContracts = data;
        },

        error: (error: HttpErrorResponse) => {
          this.handleError(error);
        }
      });
  }

  // ============================================================
  // CONTRACT MANAGEMENT
  // ============================================================

  openContractForm(): void {

    this.clearMessages();

    this.showContractForm = true;
  }

  closeContractForm(): void {

    this.showContractForm = false;

    this.contractForm.reset({
      contract_number: '',
      title: '',
      contract_type: '',
      vendor_id: '',
      start_date: '',
      end_date: '',
      renewal_date: '',
      contract_value: 0,
      payment_terms: '',
      notes: ''
    });
  }

  saveContract(): void {

    if (this.contractForm.invalid) {

      this.contractForm.markAllAsTouched();

      return;
    }

    const value = this.contractForm.value;

    if (
      value.start_date &&
      value.end_date &&
      value.end_date < value.start_date
    ) {

      this.errorMessage =
        'End date cannot be before start date.';

      return;
    }

    this.saving = true;
    this.clearMessages();

    const payload = {
      contract_number:
        String(value.contract_number).trim(),

      title:
        String(value.title).trim(),

      contract_type:
        String(value.contract_type).trim(),

      vendor_id:
        Number(value.vendor_id),

      start_date:
        value.start_date,

      end_date:
        value.end_date,

      renewal_date:
        value.renewal_date || null,

      contract_value:
        Number(value.contract_value || 0),

      payment_terms:
        String(value.payment_terms || '').trim(),

      notes:
        value.notes
          ? String(value.notes).trim()
          : null
    };

    this.contractService
      .createContract(payload)
      .subscribe({

        next: () => {

          this.successMessage =
            'Contract created successfully.';

          this.closeContractForm();

          this.loadContracts();
          this.loadExpiringContracts();

          this.saving = false;
        },

        error: (error: HttpErrorResponse) => {

          this.saving = false;

          this.handleError(error);
        }
      });
  }

  changeStatus(
    contract: Contract,
    newStatus: string
  ): void {

    if (!newStatus || newStatus === contract.status) {
      return;
    }

    this.contractService
      .updateContractStatus(
        contract.id,
        newStatus
      )
      .subscribe({

        next: (updatedContract: Contract) => {

          contract.status =
            updatedContract.status;

          this.successMessage =
            'Contract status updated successfully.';

          this.loadExpiringContracts();
        },

        error: (error: HttpErrorResponse) => {

          this.handleError(error);

          this.loadContracts();
        }
      });
  }

  changeCompliance(
    contract: Contract,
    complianceStatus: string
  ): void {

    if (
      !complianceStatus ||
      complianceStatus === contract.compliance_status
    ) {
      return;
    }

    this.contractService
      .updateCompliance(
        contract.id,
        complianceStatus
      )
      .subscribe({

        next: (updatedContract: Contract) => {

          contract.compliance_status =
            updatedContract.compliance_status;

          this.successMessage =
            'Compliance status updated successfully.';
        },

        error: (error: HttpErrorResponse) => {

          this.handleError(error);

          this.loadContracts();
        }
      });
  }

  deleteContract(contract: Contract): void {

    const confirmed = confirm(
      `Delete contract "${contract.contract_number}"?`
    );

    if (!confirmed) {
      return;
    }

    this.contractService
      .deleteContract(contract.id)
      .subscribe({

        next: () => {

          this.successMessage =
            'Contract deleted successfully.';

          this.loadContracts();
          this.loadExpiringContracts();
        },

        error: (error: HttpErrorResponse) => {

          this.handleError(error);
        }
      });
  }

  // ============================================================
  // CERTIFICATION MANAGEMENT
  // ============================================================

  openCertificationForm(): void {

    this.clearMessages();

    this.showCertificationForm = true;
  }

  closeCertificationForm(): void {

    this.showCertificationForm = false;

    this.certificationForm.reset({
      vendor_id: '',
      name: '',
      certificate_number: '',
      issue_date: '',
      expiry_date: ''
    });
  }

  saveCertification(): void {

    if (this.certificationForm.invalid) {

      this.certificationForm.markAllAsTouched();

      return;
    }

    const value = this.certificationForm.value;

    if (
      value.issue_date &&
      value.expiry_date &&
      value.expiry_date < value.issue_date
    ) {

      this.errorMessage =
        'Expiry date cannot be before issue date.';

      return;
    }

    this.saving = true;
    this.clearMessages();

    const payload = {
      vendor_id:
        Number(value.vendor_id),

      name:
        String(value.name).trim(),

      certificate_number:
        String(value.certificate_number).trim(),

      issue_date:
        value.issue_date,

      expiry_date:
        value.expiry_date
    };

    this.contractService
      .createCertification(payload)
      .subscribe({

        next: () => {

          this.successMessage =
            'Certification added successfully.';

          this.closeCertificationForm();

          this.loadCertifications();

          this.saving = false;
        },

        error: (error: HttpErrorResponse) => {

          this.saving = false;

          this.handleError(error);
        }
      });
  }

  changeCertificationStatus(
    certification: Certification,
    status: string
  ): void {

    if (
      !status ||
      status === certification.status
    ) {
      return;
    }

    this.contractService
      .updateCertificationStatus(
        certification.id,
        status
      )
      .subscribe({

        next: (updated: Certification) => {

          certification.status =
            updated.status;

          this.successMessage =
            'Certification status updated successfully.';
        },

        error: (error: HttpErrorResponse) => {

          this.handleError(error);

          this.loadCertifications();
        }
      });
  }

  // ============================================================
  // VENDOR DOCUMENT MANAGEMENT
  // ============================================================

  openDocumentForm(): void {

    this.clearMessages();

    this.showDocumentForm = true;
  }

  closeDocumentForm(): void {

    this.showDocumentForm = false;

    this.documentForm.reset({
      vendor_id: '',
      document_type: '',
      document_name: '',
      document_number: '',
      issue_date: '',
      expiry_date: '',
      status: 'Active',
      notes: ''
    });
  }

  saveDocument(): void {

    if (this.documentForm.invalid) {

      this.documentForm.markAllAsTouched();

      return;
    }

    const value = this.documentForm.value;

    if (
      value.issue_date &&
      value.expiry_date &&
      value.expiry_date < value.issue_date
    ) {

      this.errorMessage =
        'Expiry date cannot be before issue date.';

      return;
    }

    this.saving = true;
    this.clearMessages();

    const payload = {
      vendor_id:
        Number(value.vendor_id),

      document_type:
        String(value.document_type).trim(),

      document_name:
        String(value.document_name).trim(),

      document_number:
        value.document_number
          ? String(value.document_number).trim()
          : null,

      issue_date:
        value.issue_date || null,

      expiry_date:
        value.expiry_date || null,

      status:
        value.status || 'Active',

      notes:
        value.notes
          ? String(value.notes).trim()
          : null
    };

    this.contractService
      .createDocument(payload)
      .subscribe({

        next: () => {

          this.successMessage =
            'Vendor document added successfully.';

          this.closeDocumentForm();

          this.loadDocuments();

          this.saving = false;
        },

        error: (error: HttpErrorResponse) => {

          this.saving = false;

          this.handleError(error);
        }
      });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  vendorName(vendorId: number): string {

    const vendor = this.vendors.find(
      item => item.id === vendorId
    );

    return vendor
      ? vendor.name
      : `Vendor #${vendorId}`;
  }

  activeCount(): number {

    return this.contracts.filter(
      contract =>
        contract.status === 'Active'
    ).length;
  }

  renewedCount(): number {

    return this.contracts.filter(
      contract =>
        contract.status === 'Renewed'
    ).length;
  }

  compliantCount(): number {

    return this.contracts.filter(
      contract =>
        contract.compliance_status === 'Compliant'
    ).length;
  }

  nonCompliantCount(): number {

    return this.contracts.filter(
      contract =>
        contract.compliance_status === 'Non-Compliant'
    ).length;
  }

  underReviewCount(): number {

    return this.contracts.filter(
      contract =>
        contract.compliance_status === 'Under Review'
    ).length;
  }

  expiringCount(): number {

    return this.expiringContracts.length;
  }

  validCertificationCount(): number {

    return this.certifications.filter(
      certification =>
        certification.status === 'Active'
    ).length;
  }

  expiredCertificationCount(): number {

    return this.certifications.filter(
      certification =>
        certification.status === 'Expired'
    ).length;
  }

  pendingCertificationCount(): number {

    return this.certifications.filter(
      certification =>
        certification.status === 'Pending'
    ).length;
  }

  validDocumentCount(): number {

    return this.documents.filter(
      document =>
        document.status === 'Active'
    ).length;
  }

  expiredDocumentCount(): number {

    return this.documents.filter(
      document =>
        document.status === 'Expired'
    ).length;
  }

  pendingDocumentCount(): number {

    return this.documents.filter(
      document =>
        document.status === 'Pending'
    ).length;
  }

  totalContractValue(): number {

    return this.contracts.reduce(
      (total, contract) =>
        total + Number(contract.contract_value || 0),
      0
    );
  }

  formatCurrency(
    value: number | null | undefined
  ): string {

    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }
    ).format(value ?? 0);
  }

  formatDate(
    value: string | null | undefined
  ): string {

    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    );
  }

  daysUntil(
    value: string | null | undefined
  ): number | null {

    if (!value) {
      return null;
    }

    const target = new Date(value);
    const now = new Date();

    target.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const difference =
      target.getTime() - now.getTime();

    return Math.ceil(
      difference /
      (1000 * 60 * 60 * 24)
    );
  }

  clearMessages(): void {

    this.successMessage = '';
    this.errorMessage = '';
  }

  handleError(
    error: HttpErrorResponse
  ): void {

    console.error(
      'Contracts error:',
      error
    );

    if (error.error?.detail) {

      this.errorMessage =
        error.error.detail;

    } else if (error.status === 401) {

      this.errorMessage =
        'Your session has expired. Please log in again.';

    } else if (error.status === 403) {

      this.errorMessage =
        'You do not have permission to perform this action.';

    } else {

      this.errorMessage =
        'Something went wrong. Please try again.';
    }

    this.saving = false;
  }
}