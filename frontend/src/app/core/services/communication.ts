import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Communication {
  id: number;
  vendor_id: number | null;
  user_id: number | null;
  communication_type: string;
  subject: string;
  message: string;
  recipient: string | null;
  attachment_name: string | null;
  status: string;
  created_at: string;
}

export interface CommunicationCreate {
  vendor_id: number | null;
  communication_type: string;
  subject: string;
  message: string;
  recipient: string | null;
  attachment_name: string | null;
  status: string;
}

export interface CommunicationStatusUpdate {
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {

  private readonly apiUrl =
    'http://127.0.0.1:8000/api/communications';

  constructor(private http: HttpClient) {}

  getCommunications(): Observable<Communication[]> {
    return this.http.get<Communication[]>(this.apiUrl);
  }

  createCommunication(
    payload: CommunicationCreate
  ): Observable<Communication> {
    return this.http.post<Communication>(
      this.apiUrl,
      payload
    );
  }

  updateStatus(
    id: number,
    status: string
  ): Observable<Communication> {
    return this.http.patch<Communication>(
      `${this.apiUrl}/${id}/status`,
      { status }
    );
  }

  deleteCommunication(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`
    );
  }
}