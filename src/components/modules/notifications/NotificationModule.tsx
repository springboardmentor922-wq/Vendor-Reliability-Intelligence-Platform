import React, { useState } from 'react';
import { 
  BellRing, 
  CheckCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Smartphone, 
  Filter, 
  Send,
  Plus,
  Printer,
  Download,
  Building2,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Calendar,
  FileCheck2,
  RefreshCw,
  Sparkles,
  Info
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { NotificationItem } from '../../../types';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { exportToCSV, triggerPrintReport } from '../../../utils/exportUtils';
import { 
  sendRealEmail, 
  sendRealSMS, 
  triggerDesktopNotification, 
  DispatchResult 
} from '../../../utils/notificationDispatcher';

export const NotificationModule: React.FC = () => {
  const { 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    dispatchNotification,
    unreadNotificationCount,
    vendors,
    currentUser,
    updateVendorStatus
  } = useApp();

  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<'All' | 'Email' | 'SMS'>('All');

  // Dispatcher Modal State
  const [isDispatcherOpen, setIsDispatcherOpen] = useState(false);
  const [dispatchType, setDispatchType] = useState<NotificationItem['type']>('Delivery Delay');
  const [selectedVendorId, setSelectedVendorId] = useState<string>(vendors[0]?.id || '');
  const [recipientEmail, setRecipientEmail] = useState('logistics@transocean-logistics.com');
  const [recipientPhone, setRecipientPhone] = useState('+1 (555) 928-1102');
  const [recipientName, setRecipientName] = useState('Logistics Operations Lead');
  const [alertSubject, setAlertSubject] = useState('URGENT: Delivery Delay Notification - PO-2026-1039');
  const [alertMessage, setAlertMessage] = useState('TransOcean Global Freight reports a 4-day rail congestion delay on shipment MSK-771920-TR. Revised arrival ETA is Oct 03, 2026.');
  const [dispatchFeedback, setDispatchFeedback] = useState<DispatchResult | null>(null);

  // Transmission Log state
  const [transmissionHistory, setTransmissionHistory] = useState<DispatchResult[]>([
    {
      success: true,
      channel: 'Email',
      destination: 'logistics@transocean-logistics.com',
      timestamp: '03:15:10 PM',
      referenceId: 'EML-TX982A',
      details: 'Email client launched: High Delivery Delay Alert: PO-2026-1039'
    },
    {
      success: true,
      channel: 'SMS',
      destination: '+1 (555) 928-1102',
      timestamp: '03:15:12 PM',
      referenceId: 'SMS-77192B',
      details: 'Native SMS client triggered for shipment delay alert'
    },
    {
      success: true,
      channel: 'Email',
      destination: 'orders@apexind.com',
      timestamp: '10:00:22 AM',
      referenceId: 'EML-APX401',
      details: 'Purchase order approval dispatch confirmation'
    }
  ]);

  // Handle Preset Selection in Dispatcher
  const applyAlertPreset = (type: NotificationItem['type']) => {
    setDispatchType(type);
    const vendor = vendors.find(v => v.id === selectedVendorId) || vendors[0];

    if (type === 'Delivery Delay') {
      setAlertSubject(`URGENT: Logistics Delivery Delay - ${vendor.name}`);
      setAlertMessage(`Alert from VendorIQ: Machine learning risk models detected a potential 3-5 day delivery delay on critical orders from ${vendor.name}. Please confirm shipment status immediately.`);
    } else if (type === 'Procurement Alert') {
      setAlertSubject(`Procurement Notification: Requisition & PO Authorization Required`);
      setAlertMessage(`Purchase Order PO-2026-${Math.floor(1000 + Math.random() * 9000)} has been routed to your approval queue with committed budget of ₹4,50,000.`);
    } else if (type === 'Vendor Approval') {
      setAlertSubject(`Vendor Approval Status: ${vendor.name}`);
      setAlertMessage(`Supplier Governance Notice: ${vendor.name} credentials have been verified and approved by ${currentUser.name}. Vendor is active for purchase orders.`);
    } else if (type === 'Contract Expiry') {
      setAlertSubject(`Contract Expiry Notice (<30 Days): ${vendor.name}`);
      setAlertMessage(`Master Supply Agreement with ${vendor.name} is scheduled to expire within 30 days. Formal renewal review is requested.`);
    } else if (type === 'Compliance Alert') {
      setAlertSubject(`Compliance Audit Notice: Certification Expiration`);
      setAlertMessage(`VendorIQ Compliance Audit flag: Mandatory ISO 9001 / SOC 2 certification for ${vendor.name} requires renewal to maintain Active tier standing.`);
    } else {
      setAlertSubject(`System Notification from VendorIQ Platform`);
      setAlertMessage(`Direct communication dispatch from ${currentUser.name} (${currentUser.role}).`);
    }
  };

  // Vendor selection change in Dispatcher
  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    const v = vendors.find(item => item.id === vendorId);
    if (v) {
      setRecipientEmail(v.contact.email || '');
      setRecipientPhone(v.contact.phone || '');
      setRecipientName(v.contact.primaryContactName || v.name);
      applyAlertPreset(dispatchType);
    }
  };

  // Execution: Send Real Email
  const handleSendRealEmail = (customEmail?: string, customSubj?: string, customMsg?: string) => {
    const targetEmail = customEmail || recipientEmail;
    const targetSubj = customSubj || alertSubject;
    const targetMsg = customMsg || alertMessage;

    const result = sendRealEmail(targetEmail, targetSubj, targetMsg);
    setDispatchFeedback(result);
    setTransmissionHistory(prev => [result, ...prev]);

    // Record in notifications state
    dispatchNotification({
      type: dispatchType,
      title: targetSubj,
      message: `${targetMsg} [Sent via Email to ${targetEmail}]`,
      severity: dispatchType === 'Delivery Delay' ? 'error' : dispatchType === 'Vendor Approval' ? 'success' : 'warning',
      emailSent: true,
      recipientEmail: targetEmail,
      recipientName: recipientName,
    });
  };

  // Execution: Send Real SMS
  const handleSendRealSMS = (customPhone?: string, customMsg?: string) => {
    const targetPhone = customPhone || recipientPhone;
    const targetMsg = customMsg || `${alertSubject}: ${alertMessage}`;

    const result = sendRealSMS(targetPhone, targetMsg);
    setDispatchFeedback(result);
    setTransmissionHistory(prev => [result, ...prev]);

    // Record in notifications state
    dispatchNotification({
      type: dispatchType,
      title: alertSubject,
      message: `${alertMessage} [Sent via SMS to ${targetPhone}]`,
      severity: dispatchType === 'Delivery Delay' ? 'error' : dispatchType === 'Vendor Approval' ? 'success' : 'info',
      smsSent: true,
      recipientPhone: targetPhone,
      recipientName: recipientName,
    });
  };

  // Execution: Omni-Channel (Email + SMS + Desktop)
  const handleOmniDispatch = () => {
    const emailRes = sendRealEmail(recipientEmail, alertSubject, alertMessage);
    const smsRes = sendRealSMS(recipientPhone, `${alertSubject}: ${alertMessage}`);
    triggerDesktopNotification(`[VendorIQ] ${alertSubject}`, alertMessage);

    const omniResult: DispatchResult = {
      success: true,
      channel: 'Omni-Channel',
      destination: `${recipientEmail} & ${recipientPhone}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      referenceId: `OMNI-${Date.now().toString(36).toUpperCase()}`,
      details: `Dispatched to Email (${recipientEmail}), native SMS (${recipientPhone}), and system desktop notification.`
    };

    setDispatchFeedback(omniResult);
    setTransmissionHistory(prev => [omniResult, emailRes, smsRes, ...prev]);

    dispatchNotification({
      type: dispatchType,
      title: alertSubject,
      message: `${alertMessage} [Omni-Channel Dispatched]`,
      severity: dispatchType === 'Delivery Delay' ? 'error' : 'warning',
      emailSent: true,
      smsSent: true,
      recipientEmail,
      recipientPhone,
      recipientName,
    });
  };

  // Filter Logic
  const filteredNotifications = notifications.filter((n) => {
    const matchesType = selectedType === 'All' || n.type === selectedType;
    const matchesSeverity = selectedSeverity === 'All' || n.severity === selectedSeverity;
    const matchesChannel = 
      selectedChannelFilter === 'All' ? true :
      selectedChannelFilter === 'Email' ? n.emailSent :
      selectedChannelFilter === 'SMS' ? n.smsSent : true;

    return matchesType && matchesSeverity && matchesChannel;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const rows = filteredNotifications.map(n => ({
      NotificationID: n.id,
      Type: n.type,
      Severity: n.severity.toUpperCase(),
      Title: n.title,
      Message: n.message,
      Timestamp: n.timestamp,
      ReadStatus: n.read ? 'Read' : 'Unread',
      EmailDispatched: n.emailSent ? 'Yes' : 'No',
      SMSDispatched: n.smsSent ? 'Yes' : 'No',
      RecipientEmail: n.recipientEmail || 'N/A',
      RecipientPhone: n.recipientPhone || 'N/A',
      RecipientName: n.recipientName || 'N/A'
    }));

    exportToCSV('VendorIQ_Notification_Register', rows, {
      NotificationID: 'Alert ID',
      Type: 'Category',
      Severity: 'Severity',
      Title: 'Subject / Title',
      Message: 'Alert Content',
      Timestamp: 'Dispatched Timestamp',
      ReadStatus: 'Status',
      EmailDispatched: 'Email Sent',
      SMSDispatched: 'SMS Sent',
      RecipientEmail: 'Recipient Email',
      RecipientPhone: 'Recipient Phone',
      RecipientName: 'Recipient Name'
    });
  };

  // Print PDF
  const handlePrintPDF = () => {
    const rows = filteredNotifications.map(n => ({
      ID: n.id,
      Type: n.type,
      Severity: n.severity,
      Title: n.title,
      Recipient: n.recipientName || n.recipientEmail || 'All Stakeholders',
      Timestamp: n.timestamp
    }));
    triggerPrintReport('Notification_Alert_Center_Report', rows, {
      ID: 'Alert ID',
      Type: 'Category',
      Severity: 'Severity',
      Title: 'Notification Title',
      Recipient: 'Recipient',
      Timestamp: 'Dispatched At'
    });
  };

  // Pending vendor approvals test helper
  const pendingVendors = vendors.filter(v => v.status === 'Pending Approval' || v.status === 'Under Review');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Notification & Alert Center</h1>
            <Badge variant="info" size="sm">Real-Time Dispatch</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Omni-channel alert hub: send real-time Email and SMS messages to vendors and stakeholders for procurement authorizations, 
            machine learning delivery delays, vendor approvals, contract expiries, and compliance audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsDispatcherOpen(true)}
            className="rounded-xl bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-md shadow-sky-600/20 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            Send Email / SMS Alert
          </button>
          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Export notifications to CSV/Excel"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Export CSV
          </button>
          <button
            onClick={handlePrintPDF}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Print or Save PDF"
          >
            <Printer className="h-3.5 w-3.5 text-sky-400" />
            Print / PDF
          </button>
          <button
            onClick={markAllNotificationsRead}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Pending Vendor Approvals Fast-Action Banner (Workflow Demonstration - Administrator Only) */}
      {pendingVendors.length > 0 && currentUser.role === 'Administrator' && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <UserCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                Administrator Supplier Governance Action Required ({pendingVendors.length} Pending Approval)
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {pendingVendors.map(v => v.name).join(', ')} submitted registration documents. 
                Administrator approval activates supplier records and dispatches onboarding confirmation alerts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingVendors.slice(0, 2).map(pv => (
              <button
                key={pv.id}
                onClick={() => {
                  updateVendorStatus(pv.id, 'Active', 'Approved via Administrator Notification Center workflow review');
                  sendRealEmail(
                    pv.contact.email, 
                    `Vendor Approved: ${pv.name}`, 
                    `Congratulations! ${pv.name} has been officially approved and activated on the VendorIQ Autonomous Supplier Platform by Enterprise Administrator.`
                  );
                }}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve {pv.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Category:</span>
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="All">All Categories ({notifications.length})</option>
            <option value="Procurement Alert">Procurement Alerts</option>
            <option value="Delivery Delay">Delivery Delays</option>
            <option value="Vendor Approval">Vendor Approvals</option>
            <option value="Contract Expiry">Contract Expirations</option>
            <option value="Compliance Alert">Compliance Alerts</option>
            <option value="System">System Announcements</option>
          </select>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Severity:</span>
          </div>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="All">All Severities</option>
            <option value="error">Critical / Delay Error</option>
            <option value="warning">Warning / Expiry</option>
            <option value="info">Informational</option>
            <option value="success">Success / Approvals</option>
          </select>

          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Dispatched Channel:</span>
          </div>
          <select
            value={selectedChannelFilter}
            onChange={(e) => setSelectedChannelFilter(e.target.value as any)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="All">All Channels</option>
            <option value="Email">Email Sent Only</option>
            <option value="SMS">SMS Sent Only</option>
          </select>
        </div>

        <div className="text-slate-400 font-mono text-[11px]">
          Showing <span className="text-white font-bold">{filteredNotifications.length}</span> of {notifications.length} ({unreadNotificationCount} unread)
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-500 text-xs">
            No notifications found matching selected filters.
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => markNotificationRead(notif.id)}
              className={`p-4 rounded-xl border transition-all ${
                !notif.read
                  ? 'bg-slate-900 border-sky-500/40 shadow-sm shadow-sky-950/30'
                  : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {notif.severity === 'error' ? (
                      <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <AlertTriangle className="h-4 w-4 text-rose-400" />
                      </div>
                    ) : notif.severity === 'warning' ? (
                      <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      </div>
                    ) : notif.severity === 'success' ? (
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                        <Info className="h-4 w-4 text-sky-400" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={`text-sm ${!notif.read ? 'font-bold text-white' : 'font-semibold text-slate-200'}`}>
                        {notif.title}
                      </h4>
                      <Badge
                        variant={
                          notif.severity === 'error' ? 'danger' :
                          notif.severity === 'warning' ? 'warning' :
                          notif.severity === 'success' ? 'success' : 'info'
                        }
                        size="sm"
                      >
                        {notif.type}
                      </Badge>
                      {!notif.read && (
                        <span className="inline-block h-2 w-2 rounded-full bg-sky-400 ring-2 ring-sky-400/20" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.message}</p>

                    {/* Recipient info if attached */}
                    {(notif.recipientEmail || notif.recipientPhone) && (
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                        {notif.recipientName && (
                          <span className="text-slate-300 font-semibold">Recipient: {notif.recipientName}</span>
                        )}
                        {notif.recipientEmail && (
                          <span className="flex items-center gap-1 text-sky-400">
                            <Mail className="h-3 w-3" />
                            {notif.recipientEmail}
                          </span>
                        )}
                        {notif.recipientPhone && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Smartphone className="h-3 w-3" />
                            {notif.recipientPhone}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-2 shrink-0">
                  <span className="font-mono text-[11px] text-slate-500">{notif.timestamp}</span>

                  {/* Direct action buttons: Send Real Email or Send Real SMS to this recipient */}
                  <div className="flex items-center gap-1.5">
                    {notif.recipientEmail && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendRealEmail(notif.recipientEmail, notif.title, notif.message);
                        }}
                        className="rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-1 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title={`Open mail client to send real email to ${notif.recipientEmail}`}
                      >
                        <Mail className="h-3 w-3" />
                        Send Real Email
                      </button>
                    )}

                    {notif.recipientPhone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendRealSMS(notif.recipientPhone, `${notif.title}: ${notif.message}`);
                        }}
                        className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title={`Open device SMS app to send real text to ${notif.recipientPhone}`}
                      >
                        <Smartphone className="h-3 w-3" />
                        Send Real SMS
                      </button>
                    )}
                  </div>

                  {/* Delivery Channel Badges */}
                  <div className="flex items-center gap-1.5">
                    {notif.emailSent && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-300 rounded bg-slate-800/80 border border-slate-700/50 px-1.5 py-0.5">
                        <Mail className="h-3 w-3 text-sky-400" />
                        Email Dispatched
                      </span>
                    )}
                    {notif.smsSent && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-300 rounded bg-slate-800/80 border border-slate-700/50 px-1.5 py-0.5">
                        <Smartphone className="h-3 w-3 text-emerald-400" />
                        SMS Sent
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Real-Time Transmission Audit Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Live Email & SMS Transmission Activity Register</h3>
            <Badge variant="success" size="sm">Carrier & Gateway Active</Badge>
          </div>
          <p className="text-xs text-slate-400">Chronological telemetry of client dispatches and external protocol triggers</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Destination (Email / Phone)</th>
                <th className="py-2.5 px-3">Transmission Details</th>
                <th className="py-2.5 px-3">Dispatch Time</th>
                <th className="py-2.5 px-3">Gateway Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {transmissionHistory.map((t, idx) => (
                <tr key={`${t.referenceId}-${idx}`} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono font-bold text-sky-400">{t.referenceId}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={t.channel === 'Email' ? 'info' : t.channel === 'SMS' ? 'success' : 'primary'} size="sm">
                      {t.channel}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">{t.destination}</td>
                  <td className="py-2.5 px-3 text-slate-400">{t.details}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{t.timestamp}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="success" size="sm">Delivered / Handled</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DISPATCH MODAL: REAL EMAIL & SMS TRANSMITTER */}
      <Modal
        isOpen={isDispatcherOpen}
        onClose={() => {
          setIsDispatcherOpen(false);
          setDispatchFeedback(null);
        }}
        title="Real-Time Email & SMS Alert Dispatcher"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-400">
            Send real-time alerts directly to any email address or mobile phone number. 
            Clicking <strong className="text-sky-400">"Send Real Email"</strong> launches your local email client with all fields filled in, 
            and <strong className="text-emerald-400">"Send Real SMS"</strong> connects directly to your device's native messaging application.
          </p>

          {/* Feedback banner */}
          {dispatchFeedback && (
            <div className={`p-3 rounded-xl border ${
              dispatchFeedback.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            } flex items-start gap-2`}>
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{dispatchFeedback.details}</p>
                <p className="text-[11px] font-mono opacity-80">Reference ID: {dispatchFeedback.referenceId} • {dispatchFeedback.timestamp}</p>
              </div>
            </div>
          )}

          {/* Alert Type Selector */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Alert Category / Template</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { type: 'Delivery Delay', label: 'Delivery Delay Alert', color: 'border-rose-500/40 text-rose-300' },
                { type: 'Procurement Alert', label: 'Procurement Alert', color: 'border-sky-500/40 text-sky-300' },
                { type: 'Vendor Approval', label: 'Vendor Approval', color: 'border-emerald-500/40 text-emerald-300' },
                { type: 'Contract Expiry', label: 'Contract Expiry (<30d)', color: 'border-amber-500/40 text-amber-300' },
                { type: 'Compliance Alert', label: 'Compliance Audit', color: 'border-purple-500/40 text-purple-300' },
                { type: 'System', label: 'Custom Urgent Message', color: 'border-slate-500/40 text-slate-300' },
              ].map(item => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => applyAlertPreset(item.type as any)}
                  className={`p-2 rounded-xl border text-left font-semibold transition-all cursor-pointer ${
                    dispatchType === item.type
                      ? 'bg-sky-600/20 border-sky-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="text-xs">{item.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Quick-Select */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Vendor Contact (Auto-fills Email & Phone)</label>
            <select
              value={selectedVendorId}
              onChange={(e) => handleVendorChange(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.category}) — {v.contact.primaryContactName} ({v.contact.email} / {v.contact.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Custom Recipients Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Recipient Email Address <span className="text-sky-400">*</span>
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="e.g. supplier@domain.com or your email"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-white focus:outline-none focus:border-sky-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Will open in default email client (Gmail, Outlook, Apple Mail)</p>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Recipient Phone Number <span className="text-emerald-400">*</span>
              </label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="e.g. +1 (555) 000-0000"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">Will open in device SMS app (iOS Messages / Android / Windows)</p>
            </div>
          </div>

          {/* Alert Subject */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Email Subject / Alert Headline</label>
            <input
              type="text"
              value={alertSubject}
              onChange={(e) => setAlertSubject(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-white focus:outline-none focus:border-sky-500 font-semibold"
            />
          </div>

          {/* Alert Message Body */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Message Content / Alert Body</label>
            <textarea
              rows={3}
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-white focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsDispatcherOpen(false)}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSendRealEmail()}
                className="rounded-xl bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md shadow-sky-600/20 cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5" />
                Send Real Email
              </button>

              <button
                type="button"
                onClick={() => handleSendRealSMS()}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Send Real SMS
              </button>

              <button
                type="button"
                onClick={handleOmniDispatch}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 px-4 py-2 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-md shadow-sky-600/30 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Dispatch Both (Omni-Channel)
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
