import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const ROLE_COLORS = {
  'Procurement Manager': { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', dot: '#10b981' },
  'Finance Officer': { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', dot: '#3b82f6' },
  'Supply Chain Manager': { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', dot: '#14b8a6' },
  'Administrator': { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', dot: '#8b5cf6' },
  'Auditor': { bg: '#f8fafc', border: '#cbd5e1', text: '#334155', dot: '#64748b' },
  'Vendor': { bg: '#fffbeb', border: '#fde68a', text: '#92400e', dot: '#f59e0b' }
};

export const Communication = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState('procurement-finance');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState('team');

  const [vendorsList, setVendorsList] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');

  const [emailSubject, setEmailSubject] = useState('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailPriority, setEmailPriority] = useState('Standard');
  const [emailRefType, setEmailRefType] = useState('Purchase Order');
  const [emailRefId, setEmailRefId] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAttachment, setEmailAttachment] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(null);

  const [showGmailModal, setShowGmailModal] = useState(false);
  const [formattedPreviewSubject, setFormattedPreviewSubject] = useState('');
  const [formattedPreviewBody, setFormattedPreviewBody] = useState('');
  const [gmailUrl, setGmailUrl] = useState('');

  const [smsPhone, setSmsPhone] = useState('+91 98765 43210');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState(null);
  const [smsLoadingLogs, setSmsLoadingLogs] = useState(false);

  const messagesEndRef = useRef(null);

  const loadInternalDirectory = async () => {
    try {
      const data = await api.getInternalChannels();
      setChannels(data.channels || []);
      setDirectMessages(data.direct_messages || []);
      if (!activeChannelId && data.channels?.length > 0) {
        setActiveChannelId(data.channels[0].id);
      }
    } catch (err) {
      console.error('Failed to load internal channels:', err);
      setError(err.message || 'Failed to load channels');
    }
  };

  const loadChannelMessages = async (channelId) => {
    if (!channelId) return;
    try {
      const msgs = await api.getInternalMessages(channelId);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load channel messages:', err);
    }
  };

  const loadVendorsForGateway = async () => {
    try {
      const vList = await api.getVendors();
      setVendorsList(vList || []);
      if (vList?.length > 0 && !selectedVendorId) {
        setSelectedVendorId(vList[0].id);
        setEmailRecipient(vList[0].email || 'contact@supplier.com');
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadSmsLogs = async () => {
    setSmsLoadingLogs(true);
    try {
      const logs = await api.getSMSLogs();
      setSmsLogs(logs || []);
    } catch (err) {
      console.error('Failed to load SMS logs:', err);
    } finally {
      setSmsLoadingLogs(false);
    }
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadInternalDirectory();
      await loadVendorsForGateway();
      setLoading(false);
    }
    init();
  }, [user]);

  useEffect(() => {
    if (activeChannelId) {
      loadChannelMessages(activeChannelId);
    }
  }, [activeChannelId, user]);

  useEffect(() => {
    if (activeMode === 'team') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeMode]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannelId) return;

    setSending(true);
    try {
      const sent = await api.sendInternalMessage({
        channel: activeChannelId,
        body: newMessage.trim()
      });
      setMessages((prev) => [...prev, sent]);
      setNewMessage('');
      loadInternalDirectory();
    } catch (err) {
      alert('Error sending message: ' + (err.message || 'Server error'));
    } finally {
      setSending(false);
    }
  };

  const activeChannelObj = [
    ...channels,
    ...directMessages
  ].find((c) => c.id === activeChannelId) || {
    name: 'Team Channel',
    subtitle: 'Cross-functional operational coordination',
    type: 'channel'
  };

  const handleOpenGmailModal = (e) => {
    e.preventDefault();
    if (!emailRecipient.trim() || !emailSubject.trim() || !emailBody.trim()) {
      alert('Please enter recipient, subject, and body.');
      return;
    }

    const priorityTag = emailPriority !== 'Standard' ? `[${emailPriority.toUpperCase()}] ` : '';
    const refTag = emailRefId.trim() ? `[${emailRefType.toUpperCase()}: ${emailRefId.trim()}] ` : '';
    const fullSubject = `${priorityTag}${refTag}${emailSubject.trim()}`;

    let fullBody = `${emailBody.trim()}\n\n`;
    fullBody += `--------------------------------------------------\n`;
    fullBody += `Sent via VendorIQ Enterprise Procurement Platform\n`;
    fullBody += `Sender: ${user?.full_name} (${user?.role})\n`;
    fullBody += `Security Classification: Official Business Correspondence\n`;
    if (emailAttachment.trim()) {
      fullBody += `Reference Document: ${emailAttachment.trim()}\n`;
    }

    setFormattedPreviewSubject(fullSubject);
    setFormattedPreviewBody(fullBody);

    const targetUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailRecipient.trim())}&su=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(fullBody)}`;
    setGmailUrl(targetUrl);
    setShowGmailModal(true);
  };

  const handleExecuteGmailDispatch = async () => {
    setEmailSending(true);
    try {
      await api.sendDirectEmail({
        vendor_id: Number(selectedVendorId) || 1,
        recipient_email: emailRecipient.trim(),
        subject: emailSubject.trim(),
        priority: emailPriority,
        reference_type: emailRefType,
        reference_id: emailRefId.trim() || null,
        body: emailBody.trim(),
        attachment_name: emailAttachment.trim() || null
      });

      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
      setShowGmailModal(false);
      setEmailSuccess(`Official email registered in audit log and opened in Gmail composer.`);
      setEmailSubject('');
      setEmailBody('');
      setEmailAttachment('');
      setEmailRefId('');
    } catch (err) {
      alert('Failed to register email: ' + (err.message || 'Server error'));
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendSMS = async (e) => {
    e.preventDefault();
    if (!smsPhone.trim() || !smsMessage.trim()) return;

    setSmsSending(true);
    setSmsSuccess(null);
    try {
      const res = await api.sendSMSNotification({
        phone: smsPhone.trim(),
        message: smsMessage.trim(),
        vendor_id: Number(selectedVendorId) || null,
        trigger_type: 'operational_dispatch'
      });
      setSmsSuccess(res.message || 'SMS alert dispatched successfully.');
      setSmsMessage('');
      await loadSmsLogs();
    } catch (err) {
      alert('Failed to dispatch SMS: ' + (err.message || 'Network error'));
    } finally {
      setSmsSending(false);
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'TM';
    return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="communication-page">
      
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Team Collaboration Hub</span>
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
            Real-time inter-departmental collaboration across Procurement, Finance, Supply Chain, and Administration.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: ROLE_COLORS[user?.role]?.bg || '#f8fafc',
              border: `1px solid ${ROLE_COLORS[user?.role]?.border || '#e2e8f0'}`,
              color: ROLE_COLORS[user?.role]?.text || '#1e293b',
              fontSize: '12.5px',
              fontWeight: 600
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: ROLE_COLORS[user?.role]?.dot || '#0d7658'
              }}
            />
            <span>Active as: {user?.full_name} ({user?.role})</span>
          </div>

          
          <div style={{ display: 'flex', gap: '6px', background: '#f4f0e6', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveMode('team')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeMode === 'team' ? '#ffffff' : 'transparent',
                color: activeMode === 'team' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeMode === 'team' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Team Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('email');
                setEmailSuccess(null);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeMode === 'email' ? '#ffffff' : 'transparent',
                color: activeMode === 'email' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeMode === 'email' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Email External Vendor
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('sms');
                loadSmsLogs();
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeMode === 'sms' ? '#ffffff' : 'transparent',
                color: activeMode === 'sms' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeMode === 'sms' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              SMS Vendor Alert
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '18px' }}>{error}</div>}

      
      {activeMode === 'team' && (
        <div className="chat-layout">
          
          <div className="chat-sidebar">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Internal Channels
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  loadInternalDirectory();
                  if (activeChannelId) loadChannelMessages(activeChannelId);
                }}
                style={{ fontSize: '11px', padding: '3px 8px' }}
                title="Refresh channels"
              >
                Refresh
              </button>
            </div>

            <div className="chat-threads-list" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 270px)' }}>
              
              <div style={{ padding: '8px 14px 4px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Operational Channels
              </div>
              {channels.map((c) => {
                const isActive = activeChannelId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`chat-thread-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChannelId(c.id)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                      background: isActive ? 'var(--bg-hover)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '14px' }}>
                        #
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.last_message || c.subtitle}
                    </div>
                  </div>
                );
              })}

              
              <div style={{ padding: '16px 14px 4px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', borderTop: '1px solid var(--border-subtle)', marginTop: '8px' }}>
                Direct Colleagues
              </div>
              {directMessages.map((dm) => {
                const isActive = activeChannelId === dm.id;
                const colors = ROLE_COLORS[dm.role] || { bg: '#f8fafc', border: '#e2e8f0', text: '#334155', dot: '#64748b' };
                return (
                  <div
                    key={dm.id}
                    className={`chat-thread-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChannelId(dm.id)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                      background: isActive ? 'var(--bg-hover)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            color: colors.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            fontWeight: 700
                          }}
                        >
                          {getUserInitials(dm.name)}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {dm.name}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: colors.bg,
                          color: colors.text,
                          fontWeight: 600
                        }}
                      >
                        {dm.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          
          <div className="chat-main" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 230px)', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', background: '#fdfcf9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {activeChannelObj.type === 'channel' ? `# ${activeChannelObj.name}` : activeChannelObj.name}
                  </span>
                  {activeChannelObj.role && (
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: ROLE_COLORS[activeChannelObj.role]?.bg || '#f1f5f9',
                        color: ROLE_COLORS[activeChannelObj.role]?.text || '#475569',
                        fontWeight: 600
                      }}
                    >
                      {activeChannelObj.role}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {activeChannelObj.subtitle}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                  Internal Staff Network Online
                </span>
              </div>
            </div>

            
            <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '80px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    No messages in this channel yet.
                  </div>
                  <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                    Be the first to post a coordination note as {user?.full_name} ({user?.role}).
                  </div>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user?.id;
                  const senderRole = m.sender?.role || 'Staff';
                  const colors = ROLE_COLORS[senderRole] || { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' };

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        marginBottom: '16px'
                      }}
                    >
                      
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '4px',
                          fontSize: '11.5px',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <strong style={{ color: isMe ? 'var(--primary)' : 'var(--text-primary)' }}>
                          {isMe ? 'You' : m.sender?.full_name || 'Team Member'}
                        </strong>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            fontWeight: 600
                          }}
                        >
                          {senderRole}
                        </span>
                        <span>&bull;</span>
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      
                      <div
                        style={{
                          maxWidth: '75%',
                          padding: '12px 16px',
                          borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          background: isMe ? '#145e47' : '#f8fafc',
                          color: isMe ? '#ffffff' : 'var(--text-primary)',
                          border: isMe ? 'none' : '1px solid #e2e8f0',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          wordBreak: 'break-word',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                        }}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            
            <form onSubmit={handleSendMessage} style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', background: '#ffffff', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                className="form-control"
                style={{ flex: 1, padding: '10px 14px', fontSize: '13px', borderRadius: '8px' }}
                placeholder={`Message #${activeChannelObj.name} as ${user?.full_name} (${user?.role})...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !newMessage.trim()}
                style={{ padding: '10px 20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>{sending ? 'Sending...' : 'Send'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      
      {activeMode === 'email' && (
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          {emailSuccess && (
            <div className="alert alert-success" style={{ marginBottom: '18px' }}>
              <strong>{emailSuccess}</strong>
            </div>
          )}

          <div className="card" style={{ margin: 0, border: '1px solid var(--border-color)', background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
            <div className="card-header" style={{ background: '#fdfcf9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '16px', fontWeight: 800 }}>
                  Compose Direct Formal Email to External Vendor
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Dispatches audited enterprise correspondence directly to the external supplier's executive email.
                </div>
              </div>
              <span className="badge badge-neutral">Audited Enterprise Gateway</span>
            </div>

            <div className="card-body">
              <form onSubmit={handleOpenGmailModal}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Select External Vendor *</label>
                    <select
                      className="form-select"
                      value={selectedVendorId}
                      onChange={(e) => {
                        const vid = e.target.value;
                        setSelectedVendorId(vid);
                        const found = vendorsList.find((v) => String(v.id) === String(vid));
                        if (found) setEmailRecipient(found.email || '');
                      }}
                    >
                      {vendorsList.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.company_name} ({v.category})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Recipient Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email Priority</label>
                    <select
                      className="form-select"
                      value={emailPriority}
                      onChange={(e) => setEmailPriority(e.target.value)}
                    >
                      <option value="Standard">Standard Routine</option>
                      <option value="High / Urgent">High / Urgent Priority</option>
                      <option value="Confidential">Confidential / Executive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference Type</label>
                    <select
                      className="form-select"
                      value={emailRefType}
                      onChange={(e) => setEmailRefType(e.target.value)}
                    >
                      <option value="Purchase Order">Purchase Order (PO)</option>
                      <option value="Compliance Audit">Compliance Audit</option>
                      <option value="RFQ / Requisition">RFQ / Requisition</option>
                      <option value="Invoice Remittance">Invoice Remittance</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference ID (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. PO-2026-F6124E"
                      value={emailRefId}
                      onChange={(e) => setEmailRefId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject Line *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Shipping Manifest & Delivery Schedule Verification"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Formal Correspondence Body *</label>
                  <textarea
                    className="form-control"
                    rows={6}
                    placeholder="Enter formal communication, instructions, delivery milestones, or audit inquiries..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Attach File Name (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Shipping_Manifest_AWB_9921.pdf or ISO_Certification.pdf"
                    value={emailAttachment}
                    onChange={(e) => setEmailAttachment(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Clicking <strong>"Send Email"</strong> opens a preview modal and seamlessly launches Gmail with all details pre-filled.
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '9px 24px', fontWeight: 600 }}
                  >
                    Send Email via Gmail
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      
      {activeMode === 'sms' && (
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          {smsSuccess && (
            <div className="alert alert-success" style={{ marginBottom: '18px' }}>
              <strong>{smsSuccess}</strong>
            </div>
          )}

          <div className="card" style={{ margin: 0, marginBottom: '24px', border: '1px solid var(--border-color)', background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
            <div className="card-header" style={{ background: '#fdfcf9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '16px', fontWeight: 800 }}>Dispatch SMS Mobile Alert</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Send high-priority SMS alerts directly to the supplier's emergency operations mobile.
                </div>
              </div>
              <span className="badge badge-delivered" style={{ padding: '6px 12px' }}>
                Gateway Online
              </span>
            </div>

            <div className="card-body">
              <form onSubmit={handleSendSMS}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Recipient Mobile Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={smsPhone}
                      onChange={(e) => setSmsPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Supplier</label>
                    <select
                      className="form-select"
                      value={selectedVendorId}
                      onChange={(e) => setSelectedVendorId(e.target.value)}
                    >
                      {vendorsList.map((v) => (
                        <option key={v.id} value={v.id}>{v.company_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">SMS Alert Message * (Max 160 chars)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={160}
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    placeholder="e.g. URGENT VendorIQ: PO-2026-F6124E delivery scheduled for tomorrow. Confirm dock intake."
                    required
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                    {smsMessage.length}/160 characters
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={smsSending || !smsMessage.trim()}
                    style={{ padding: '9px 24px', fontWeight: 600 }}
                  >
                    {smsSending ? 'Transmitting SMS...' : 'Dispatch SMS Alert'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ fontSize: '14.5px', fontWeight: 800 }}>SMS Gateway Dispatch Registry</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadSmsLogs}
                disabled={smsLoadingLogs}
              >
                {smsLoadingLogs ? 'Loading...' : 'Refresh Registry'}
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Recipient</th>
                      <th>Message Body</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smsLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No SMS alerts dispatched yet.
                        </td>
                      </tr>
                    ) : (
                      smsLogs.map((log) => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td><strong>{log.phone}</strong></td>
                          <td style={{ fontSize: '12.5px' }}>{log.message}</td>
                          <td>
                            <span className="badge badge-delivered" style={{ fontSize: '11px' }}>
                              Delivered
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {showGmailModal && (
        <div className="modal-backdrop" onClick={() => setShowGmailModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Confirm & Open in Gmail</h2>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowGmailModal(false)}
              >
                Close
              </button>
            </div>

            <div className="modal-body">
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  Recipient:
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  {emailRecipient}
                </div>

                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  Subject Line:
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  {formattedPreviewSubject}
                </div>

                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  Message Preview:
                </div>
                <div style={{ fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                  {formattedPreviewBody}
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Platform Audit: Recorded under <code>SEND_FORMAL_EMAIL</code> by {user?.full_name} ({user?.role}).
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowGmailModal(false)}
                disabled={emailSending}
              >
                Back to Edit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteGmailDispatch}
                disabled={emailSending}
                style={{ padding: '10px 22px', fontWeight: 700 }}
              >
                {emailSending ? 'Launching & Dispatching...' : 'Open in Gmail & Record Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Communication;
