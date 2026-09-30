export type UserRole = 
  | 'Administrator'
  | 'Procurement Manager'
  | 'Supply Chain Manager'
  | 'Vendor'
  | 'Finance Officer'
  | 'Auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  password?: string;
  role: UserRole;
  department: string;
  companyName?: string;
  avatarUrl?: string;
  status: 'Active' | 'Inactive';
  vendorId?: string; // If role === 'Vendor'
  lastLogin?: string;
}

export type VendorCategory = 
  | 'Raw Material Suppliers'
  | 'Equipment Vendors'
  | 'IT Vendors'
  | 'Service Providers'
  | 'Logistics Partners'
  | 'Maintenance Vendors';

export type VendorStatus = 
  | 'Active'
  | 'Pending'
  | 'Pending Approval'
  | 'Under Review'
  | 'Inactive'
  | 'Suspended'
  | 'Rejected'
  | 'Blacklisted';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type VendorTier = 'Tier 1 Preferred' | 'Tier 2 Approved' | 'Tier 3 Conditional' | 'High Risk Watchlist';

export interface VendorContact {
  primaryContactName: string;
  role?: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  website?: string;
  person?: string;
}

export interface VendorMetric {
  onTimeDeliveries: number;
  delayedDeliveries: number;
  totalDeliveries: number;
  onTimeDeliveryRate: number; // percentage 0 - 100
  qualityRating: number; // 1.0 - 5.0
  defectRate: number; // percentage
  communicationResponseTimeHours: number; // avg hours
  issueResolutionTimeDays: number; // avg days
  orderCompletionRate: number; // percentage 0 - 100
  serviceRating: number; // 1.0 - 5.0
}

export interface ReliabilityFactors {
  deliveryHistoryScore: number; // 0 - 100
  productQualityScore: number; // 0 - 100
  communicationEfficiencyScore: number; // 0 - 100
  contractComplianceScore: number; // 0 - 100
  purchaseHistoryScore: number; // 0 - 100
  issueResolutionScore: number; // 0 - 100
}

export interface Vendor {
  id: string;
  name: string;
  tagline?: string;
  category: VendorCategory;
  status: VendorStatus;
  contact: VendorContact;
  registrationDate: string;
  taxId: string;
  bankAccount: string;
  paymentTerms?: string;
  reliabilityScore: number; // 0 - 100
  riskLevel: RiskLevel;
  tier: 'Tier 1 Preferred' | 'Tier 2 Approved' | 'Tier 3 Conditional' | 'High Risk Watchlist';
  metrics: VendorMetric;
  reliabilityFactors: ReliabilityFactors;
  performanceHistory: {
    month: string;
    onTimeRate: number;
    qualityScore: number;
    reliabilityScore: number;
  }[];
  activeContractsCount: number;
  totalSpend: number;
  notes?: string;
}

export type ProcurementStatus = 
  | 'Draft'
  | 'Pending Vendor Acceptance'
  | 'Pending'
  | 'Approved'
  | 'Ordered'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'Delayed';

export type PaymentStatus = 'Pending' | 'Paid' | 'Overdue' | 'Disputed';

export interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseOrder {
  id: string; // e.g. PO-2026-1042
  procurementRequestId?: string;
  purchaseRequestId?: string;
  vendorId: string;
  vendorName: string;
  vendorCategory: VendorCategory;
  items: POLineItem[];
  totalAmount: number;
  currency: string;
  createdAt: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  status: ProcurementStatus;
  shippingCarrier?: string;
  trackingNumber?: string;
  deliveryStatus: 'On Schedule' | 'In Transit' | 'Delayed' | 'Delivered' | 'Cancelled';
  deliveryDelayDays?: number;
  predictedLateRisk: number; // 0 - 100% predictive probability
  createdBy: string;
  approvedBy?: string;
  approvalDate?: string;
  vendorConfirmedDate?: string;
  cancellationReason?: string;
  notes?: string;
  invoiceId?: string;
  paymentTerms?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  department?: string;
  destinationHub?: string;
  urgency?: 'Standard' | 'Expedited' | 'Critical' | 'Low' | 'Medium' | 'High' | 'Urgent';
}

export interface ProcurementRequest {
  id: string; // e.g. PR-2026-089
  title: string;
  department: string;
  requestedBy: string;
  estimatedBudget: number;
  category: VendorCategory;
  preferredVendorId?: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  quantity?: number;
  neededBy?: string;
  requiredDate: string;
  status: 'Pending' | 'Approved' | 'Converted to PO' | 'Rejected' | 'Draft' | 'Submitted';
  justification: string;
  createdAt: string;
}

export interface Invoice {
  id: string; // e.g. INV-2026-4401
  purchaseOrderId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  paymentDate?: string;
  status: PaymentStatus;
  paymentMethod?: string;
  notes?: string;
}

export interface Contract {
  id: string; // e.g. CON-2025-091
  title: string;
  vendorId: string;
  vendorName: string;
  category: VendorCategory;
  contractValue: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Inactive' | 'Suspended' | 'Expiring Soon' | 'Expired' | 'Renewed';
  renewalNoticeDays: number;
  autoRenew: boolean;
  complianceRate: number; // 0 - 100%
  documentUrl?: string;
  documentName?: string;
  termsSummary: string;
}

export interface Certification {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string; // e.g. ISO 9001:2015, ISO 27001, RoHS, OSHA
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
  certificateNumber: string;
}

export interface VendorDocument {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  type: 'W-9 / Tax ID' | 'Non-Disclosure Agreement' | 'Insurance Certificate' | 'Bank Verification' | 'ESG Report';
  uploadedAt: string;
  verified: boolean;
  verifiedBy?: string;
  fileName: string;
}

export interface CommunicationMessage {
  id: string;
  threadId: string; // vendorId or poId
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  subject?: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachmentName?: string;
  attachmentSize?: string;
  channel: 'Portal Message' | 'Email' | 'Procurement Discussion';
  linkedPOId?: string;
}

export interface NotificationItem {
  id: string;
  type: 'Procurement Alert' | 'Delivery Delay' | 'Vendor Approval' | 'Contract Expiry' | 'Compliance Alert' | 'System';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  severity: 'info' | 'warning' | 'error' | 'success';
  linkedEntityId?: string; // poId, vendorId, contractId
  targetRole?: UserRole | 'All';
  emailSent?: boolean;
  smsSent?: boolean;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: 'Vendor' | 'Purchase Order' | 'Contract' | 'Invoice' | 'System' | 'Dataset' | 'User';
  entityId: string;
  details: string;
  ipAddress?: string;
}

export interface DatasetUploadRecord {
  id: string;
  fileName: string;
  uploadDate: string;
  rowCount: number;
  sourceType: string;
  matchedVendorsCount: number;
  sampleColumns: string[];
  status: 'Parsed & Ingested' | 'Active in Scoring Model';
}
