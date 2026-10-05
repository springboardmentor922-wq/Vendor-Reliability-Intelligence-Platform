import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams
} from '@angular/common/http';
import { Observable } from 'rxjs';

export const CONTRACT_STATUSES = [
  'Active',
  'Expiring Soon',
  'Expired',
  'Renewed',
  'Terminated'
];

export const COMPLIANCE_STATUSES = [
  'Compliant',
  'Non-Compliant',
  'Under Review'
];

export const CERTIFICATION_STATUSES = [
  'Active',
  'Expired',
  'Pending'
];

export const DOCUMENT_STATUSES = [
  'Active',
  'Expired',
  'Pending'
];

export interface Contract {

  id: number;

  contract_number: string;

  title: string;

  contract_type: string;

  vendor_id: number;

  start_date: string;

  end_date: string;

  renewal_date: string | null;

  status: string;

  compliance_status: string;

  contract_value: number;

  payment_terms: string;

  notes: string | null;

  created_by: number | null;

  created_at: string;
}

export interface ContractCreate {

  contract_number: string;

  title: string;

  contract_type: string;

  vendor_id: number;

  start_date: string;

  end_date: string;

  renewal_date: string | null;

  contract_value: number;

  payment_terms: string;

  notes: string | null;
}

export interface Certification {

  id: number;

  vendor_id: number;

  name: string;

  certificate_number: string;

  issue_date: string;

  expiry_date: string;

  status: string;

  created_at: string;
}

export interface CertificationCreate {

  vendor_id: number;

  name: string;

  certificate_number: string;

  issue_date: string;

  expiry_date: string;
}

export interface VendorDocument {

  id: number;

  vendor_id: number;

  document_type: string;

  document_name: string;

  document_number: string | null;

  issue_date: string | null;

  expiry_date: string | null;

  status: string;

  notes: string | null;

  created_at: string;
}

export interface VendorDocumentCreate {

  vendor_id: number;

  document_type: string;

  document_name: string;

  document_number: string | null;

  issue_date: string | null;

  expiry_date: string | null;

  status: string;

  notes: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ContractService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/contracts';

  constructor(
    private http: HttpClient
  ) {}

  getContracts(
    status?: string,
    complianceStatus?: string,
    vendorId?: number
  ): Observable<Contract[]> {

    let params = new HttpParams();

    if (status) {

      params = params.set(
        'contract_status',
        status
      );
    }

    if (complianceStatus) {

      params = params.set(
        'compliance_status',
        complianceStatus
      );
    }

    if (vendorId !== undefined) {

      params = params.set(
        'vendor_id',
        vendorId.toString()
      );
    }

    return this.http.get<Contract[]>(
      this.apiUrl,
      { params }
    );
  }

  getExpiringContracts(
    days = 30
  ): Observable<Contract[]> {

    const params =
      new HttpParams()
        .set(
          'days',
          days.toString()
        );

    return this.http.get<Contract[]>(
      `${this.apiUrl}/expiring`,
      { params }
    );
  }

  createContract(
    contract: ContractCreate
  ): Observable<Contract> {

    return this.http.post<Contract>(
      this.apiUrl,
      contract
    );
  }

  updateContractStatus(
    id: number,
    status: string
  ): Observable<Contract> {

    return this.http.patch<Contract>(
      `${this.apiUrl}/${id}/status`,
      { status }
    );
  }

  updateCompliance(
    id: number,
    complianceStatus: string
  ): Observable<Contract> {

    return this.http.patch<Contract>(
      `${this.apiUrl}/${id}/compliance`,
      {
        compliance_status:
          complianceStatus
      }
    );
  }

  deleteContract(
    id: number
  ): Observable<any> {

    return this.http.delete(
      `${this.apiUrl}/${id}`
    );
  }

  getCertifications(
    vendorId?: number
  ): Observable<Certification[]> {

    let params = new HttpParams();

    if (vendorId !== undefined) {

      params = params.set(
        'vendor_id',
        vendorId.toString()
      );
    }

    return this.http.get<Certification[]>(
      `${this.apiUrl}/certifications/list`,
      { params }
    );
  }

  createCertification(
    certification: CertificationCreate
  ): Observable<Certification> {

    return this.http.post<Certification>(
      `${this.apiUrl}/certifications`,
      certification
    );
  }

  updateCertificationStatus(
    id: number,
    status: string
  ): Observable<Certification> {

    return this.http.patch<Certification>(
      `${this.apiUrl}/certifications/${id}/status`,
      { status }
    );
  }

  getDocuments(
    vendorId?: number
  ): Observable<VendorDocument[]> {

    let params = new HttpParams();

    if (vendorId !== undefined) {

      params = params.set(
        'vendor_id',
        vendorId.toString()
      );
    }

    return this.http.get<VendorDocument[]>(
      `${this.apiUrl}/documents/list`,
      { params }
    );
  }

  createDocument(
    document: VendorDocumentCreate
  ): Observable<VendorDocument> {

    return this.http.post<VendorDocument>(
      `${this.apiUrl}/documents`,
      document
    );
  }
}