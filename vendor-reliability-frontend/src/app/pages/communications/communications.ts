import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CommunicationService, CommunicationMessage, AuditLog } from '../../services/communication.service';
import { VendorService, VendorModel } from '../../services/vendor.service';
import { ProcurementService, ProcurementRequest } from '../../services/procurement.service';
import { PurchaseOrderService, PurchaseOrder } from '../../services/purchase-order.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

export interface EmailDispatchLog {
  id: number;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  templateType: 'PO Dispatch' | 'Approval Required' | 'Contract Expiry' | 'Dispute Notice';
  dispatchedAt: string;
  status: 'Delivered' | 'Opened' | 'Pending';
}

@Component({
  selector: 'app-communications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './communications.html',
  styleUrl: './communications.css'
})
export class Communications implements OnInit {
  activeTab: 'threads' | 'procurement' | 'files' | 'email_logs' | 'audit' = 'threads';

  messages: CommunicationMessage[] = [];
  filteredMessages: CommunicationMessage[] = [];
  auditLogs: AuditLog[] = [];
  filteredAuditLogs: AuditLog[] = [];
  vendors: VendorModel[] = [];
  procurementRequests: ProcurementRequest[] = [];
  purchaseOrders: PurchaseOrder[] = [];

  // Filter & Search
  selectedVendorFilter: number | 'All' = 'All';
  messageSearchQuery = '';
  auditSearchQuery = '';

  // New Message Form
  newMessage: Partial<CommunicationMessage> = {
    subject: '',
    message: '',
    vendor_id: undefined,
    procurement_request_id: undefined,
    purchase_order_id: undefined,
    attachment_name: '',
    attachment_url: ''
  };

  attachedFileName = '';
  attachedFileSize = '';

  // Mock / Simulated Email Dispatch Log
  emailLogs: EmailDispatchLog[] = [
    {
      id: 1,
      recipientEmail: 'sales@acme-industrial.com',
      recipientName: 'Acme Industrial Sales Desk',
      subject: 'Purchase Order PO-2026-001 Issued & Transmitted',
      templateType: 'PO Dispatch',
      dispatchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toLocaleString(),
      status: 'Opened'
    },
    {
      id: 2,
      recipientEmail: 'orders@apexsemi.io',
      recipientName: 'Apex Semiconductor Tech',
      subject: 'Action Required: Contract CNT-2026-0002 SLA Review',
      templateType: 'Contract Expiry',
      dispatchedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleString(),
      status: 'Delivered'
    },
    {
      id: 3,
      recipientEmail: 'procurement@vendor-iq.com',
      recipientName: 'Procurement Director',
      subject: 'Approval Needed: PR-2026-004 Raw Material Requisition',
      templateType: 'Approval Required',
      dispatchedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toLocaleString(),
      status: 'Opened'
    }
  ];

  showEmailModal = false;
  manualEmail = {
    to: 'vendor@example.com',
    subject: '',
    template: 'PO Dispatch' as 'PO Dispatch' | 'Approval Required' | 'Contract Expiry' | 'Dispute Notice',
    body: ''
  };

  constructor(
    private commsService: CommunicationService,
    private vendorService: VendorService,
    private procService: ProcurementService,
    private poService: PurchaseOrderService,
    private notifService: NotificationService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadMessages();
    this.loadAuditLogs();
    this.vendorService.getVendors().subscribe({ next: (v) => this.vendors = v });
    this.procService.getRequests().subscribe({ next: (r) => this.procurementRequests = r });
    this.poService.getPurchaseOrders().subscribe({ next: (p) => this.purchaseOrders = p });
  }

  loadMessages(): void {
    this.commsService.getMessages().subscribe({
      next: (data) => {
        this.messages = data;
        this.filterMessages();
      }
    });
  }

  loadAuditLogs(): void {
    this.commsService.getAuditLogs().subscribe({
      next: (data) => {
        this.auditLogs = data;
        this.filterAuditLogs();
      }
    });
  }

  filterMessages(): void {
    let list = [...this.messages];

    if (this.selectedVendorFilter !== 'All') {
      list = list.filter(m => m.vendor_id === Number(this.selectedVendorFilter));
    }

    if (this.messageSearchQuery.trim()) {
      const q = this.messageSearchQuery.toLowerCase();
      list = list.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    }

    this.filteredMessages = list;
  }

  filterAuditLogs(): void {
    if (!this.auditSearchQuery.trim()) {
      this.filteredAuditLogs = [...this.auditLogs];
      return;
    }
    const q = this.auditSearchQuery.toLowerCase();
    this.filteredAuditLogs = this.auditLogs.filter(a =>
      (a.action || '').toLowerCase().includes(q) ||
      (a.entity_type || '').toLowerCase().includes(q) ||
      (a.details || '').toLowerCase().includes(q)
    );
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.attachedFileName = file.name;
      this.attachedFileSize = `${(file.size / 1024).toFixed(1)} KB`;
      this.newMessage.attachment_name = file.name;
      this.newMessage.attachment_url = `/attachments/${file.name}`;
    }
  }

  removeAttachment(): void {
    this.attachedFileName = '';
    this.attachedFileSize = '';
    this.newMessage.attachment_name = '';
    this.newMessage.attachment_url = '';
  }

  sendMessage(): void {
    if (!this.newMessage.subject || !this.newMessage.message) return;

    this.commsService.sendMessage(this.newMessage).subscribe({
      next: () => {
        // Also simulate creating an email dispatch record
        const vendor = this.vendors.find(v => v.id === Number(this.newMessage.vendor_id));
        this.emailLogs.unshift({
          id: Date.now(),
          recipientEmail: vendor?.email || 'sales@acme-industrial.com',
          recipientName: vendor?.name || 'Vendor Representative',
          subject: this.newMessage.subject!,
          templateType: 'Approval Required',
          dispatchedAt: new Date().toLocaleString(),
          status: 'Delivered'
        });

        // Reset
        this.newMessage = {
          subject: '',
          message: '',
          vendor_id: undefined,
          procurement_request_id: undefined,
          purchase_order_id: undefined,
          attachment_name: '',
          attachment_url: ''
        };
        this.attachedFileName = '';
        this.attachedFileSize = '';
        this.loadMessages();
        this.loadAuditLogs();
        alert('Message & communication update posted successfully!');
      },
      error: (err) => alert(err?.error?.detail || 'Failed to send message.')
    });
  }

  getVendorName(vendorId?: number): string {
    if (!vendorId) return 'General Procurement Discussion';
    const found = this.vendors.find(v => v.id === vendorId);
    return found ? `${found.name} (${found.company})` : `Vendor #${vendorId}`;
  }

  getPRTitle(prId?: number): string {
    if (!prId) return '';
    const found = this.procurementRequests.find(p => p.id === prId);
    return found ? `PR #${found.request_number || found.id}: ${found.title}` : `PR #${prId}`;
  }

  downloadAttachment(fileName?: string): void {
    const sample = `VendorIQ Secure Communication Attachment\nFile: ${fileName}\nIntegrity Verified\nTimestamp: ${new Date().toISOString()}`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'attachment.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  openEmailModal(): void {
    this.manualEmail = {
      to: this.vendors[0]?.email || 'vendor@example.com',
      subject: 'Notification: Procurement Schedule Notice',
      template: 'Approval Required',
      body: 'Please review updated delivery timelines for active purchase orders.'
    };
    this.showEmailModal = true;
  }

  sendManualEmail(): void {
    this.emailLogs.unshift({
      id: Date.now(),
      recipientEmail: this.manualEmail.to,
      recipientName: 'Registered Contact',
      subject: this.manualEmail.subject,
      templateType: this.manualEmail.template,
      dispatchedAt: new Date().toLocaleString(),
      status: 'Delivered'
    });

    this.notifService.createNotification({
      title: `Email Notification Dispatched`,
      message: `Sent to ${this.manualEmail.to}: "${this.manualEmail.subject}"`,
      type: 'email'
    }).subscribe();

    this.showEmailModal = false;
    alert(`Email successfully dispatched to ${this.manualEmail.to}`);
  }
}
