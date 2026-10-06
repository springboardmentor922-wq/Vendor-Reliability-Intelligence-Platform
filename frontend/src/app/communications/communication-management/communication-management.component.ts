import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-communication-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './communication-management.component.html',
  styleUrls: ['./communication-management.component.css']
})
export class CommunicationManagementComponent implements OnInit {

  communications: any[] = [];
  showForm = false;

  communication = {
    sender: 'prasanna',
    receiver: '',
    subject: '',
    message: '',
    communication_type: 'MESSAGE',
    related_record: '',
    attachment: ''
  };

  private apiUrl = 'http://localhost:8000/api/communications/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.communications = data;
      },
      error: (error) => {
        console.error('Error loading communications:', error);
      }
    });
  }

  get totalMessages(): number {
    return this.communications.length;
  }

  get unreadMessages(): number {
    return this.communications.filter(
      item => item.status === 'UNREAD'
    ).length;
  }

  get readMessages(): number {
    return this.communications.filter(
      item => item.status === 'READ'
    ).length;
  }

  get discussionMessages(): number {
    return this.communications.filter(
      item => item.communication_type === 'DISCUSSION'
    ).length;
  }

  sendMessage(): void {

    const params: any = {
      sender: this.communication.sender,
      receiver: this.communication.receiver,
      subject: this.communication.subject,
      message: this.communication.message,
      communication_type: this.communication.communication_type,
      related_record: this.communication.related_record || '',
      attachment: this.communication.attachment || ''
    };

    this.http.post(this.apiUrl, null, { params }).subscribe({
      next: () => {
        alert('Communication sent successfully');

        this.showForm = false;

        this.communication = {
          sender: 'prasanna',
          receiver: '',
          subject: '',
          message: '',
          communication_type: 'MESSAGE',
          related_record: '',
          attachment: ''
        };

        this.loadMessages();
      },
      error: (error) => {
        console.error('Error sending communication:', error);
        alert('Failed to send communication');
      }
    });
  }

  markAsRead(id: number): void {

    this.http.put(`${this.apiUrl}${id}/read`, null).subscribe({
      next: () => {
        this.loadMessages();
      },
      error: (error) => {
        console.error('Error marking communication as read:', error);
        alert('Failed to update communication');
      }
    });
  }

  getCommunicationClass(type: string): string {
    switch (type) {
      case 'DISCUSSION':
        return 'discussion';

      case 'SYSTEM':
        return 'system';

      case 'MESSAGE':
        return 'message';

      default:
        return 'message';
    }
  }
}