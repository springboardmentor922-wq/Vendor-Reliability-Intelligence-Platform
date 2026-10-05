import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export const PROCUREMENT_PRIORITIES = [
  'Low',
  'Normal',
  'High',
  'Urgent'
];

export const PROCUREMENT_STATUSES = [
  'Pending',
  'Approved',
  'Ordered',
  'Delivered',
  'Completed',
  'Cancelled',
  'Rejected'
];

export interface ProcurementRequest {
  id: number;
  title: string;
  vendor_id: number | null;
  category: string;
  quantity: number;
  estimated_cost: number;
  priority: string;
  status: string;
  created_by: number | null;
  created_at: string;
}

export interface ProcurementCreate {
  title: string;
  vendor_id: number | null;
  category: string;
  quantity: number;
  estimated_cost: number;
  priority: string;
}

export interface ProcurementUpdate {
  title?: string;
  vendor_id?: number | null;
  category?: string;
  quantity?: number;
  estimated_cost?: number;
  priority?: string;
}

export interface ProcurementStatusUpdate {
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProcurementService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/procurement';

  constructor(private http: HttpClient) {}

  getPriorities(): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}/priorities`
    );
  }

  getStatuses(): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}/statuses`
    );
  }

  getRequests(status?: string): Observable<ProcurementRequest[]> {

    let params = new HttpParams();

    if (status) {
      params = params.set('request_status', status);
    }

    return this.http.get<ProcurementRequest[]>(
      this.apiUrl,
      { params }
    );
  }

  getRequest(id: number): Observable<ProcurementRequest> {
    return this.http.get<ProcurementRequest>(
      `${this.apiUrl}/${id}`
    );
  }

  createRequest(
    request: ProcurementCreate
  ): Observable<ProcurementRequest> {
    return this.http.post<ProcurementRequest>(
      this.apiUrl,
      request
    );
  }

  updateRequest(
    id: number,
    request: ProcurementUpdate
  ): Observable<ProcurementRequest> {
    return this.http.put<ProcurementRequest>(
      `${this.apiUrl}/${id}`,
      request
    );
  }

  updateRequestStatus(
    id: number,
    status: string
  ): Observable<ProcurementRequest> {
    return this.http.patch<ProcurementRequest>(
      `${this.apiUrl}/${id}/status`,
      { status }
    );
  }

  deleteRequest(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }
}