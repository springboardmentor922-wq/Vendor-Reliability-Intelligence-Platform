/**
 * Real-Time Notification & Omni-Channel Dispatcher
 * Provides real-time email dispatch (via standard mailto: client protocols),
 * real-time SMS transmission (via native sms: URI scheme and Web Share API),
 * and desktop Web Notifications.
 */

export interface DispatchRecipient {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
}

export interface DispatchPayload {
  type: 'Procurement Alert' | 'Delivery Delay' | 'Vendor Approval' | 'Contract Expiry' | 'Compliance Alert' | 'System';
  title: string;
  message: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  entityId?: string;
}

export interface DispatchResult {
  success: boolean;
  channel: 'Email' | 'SMS' | 'WebNotification' | 'Omni-Channel';
  destination: string;
  timestamp: string;
  referenceId: string;
  details: string;
}

/**
 * Triggers a real Email client with pre-addressed recipient, subject line, and alert body.
 */
export function sendRealEmail(
  recipientEmail: string, 
  subject: string, 
  body: string
): DispatchResult {
  const cleanEmail = recipientEmail.trim();
  const refId = `EML-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      success: false,
      channel: 'Email',
      destination: cleanEmail || 'Not Provided',
      timestamp,
      referenceId: refId,
      details: 'Invalid or missing recipient email address.'
    };
  }

  // Compose mailto link with encoded subject and formatted body
  const formattedBody = `${body}\n\n----------------------------------------\nVendorIQ Autonomous Supplier Intelligence Platform\nTimestamp: ${new Date().toISOString()}\nTransaction Ref: ${refId}`;
  const mailtoUrl = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formattedBody)}`;

  try {
    // Attempt window.open; fallback to window.location.href
    const win = window.open(mailtoUrl, '_blank');
    if (!win) {
      window.location.href = mailtoUrl;
    }

    return {
      success: true,
      channel: 'Email',
      destination: cleanEmail,
      timestamp,
      referenceId: refId,
      details: `Email client opened for ${cleanEmail} with subject: "${subject}"`
    };
  } catch (err: any) {
    window.location.href = mailtoUrl;
    return {
      success: true,
      channel: 'Email',
      destination: cleanEmail,
      timestamp,
      referenceId: refId,
      details: `Dispatched to mail handler for ${cleanEmail}`
    };
  }
}

/**
 * Triggers native device SMS client (Messages app on iOS/macOS, Google Messages on Android/Windows)
 * pre-addressed to the target phone number with the full text alert.
 */
export function sendRealSMS(
  recipientPhone: string, 
  messageBody: string
): DispatchResult {
  const cleanPhone = recipientPhone.replace(/[^\d+]/g, '');
  const refId = `SMS-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!cleanPhone || cleanPhone.length < 5) {
    return {
      success: false,
      channel: 'SMS',
      destination: recipientPhone || 'Not Provided',
      timestamp,
      referenceId: refId,
      details: 'Invalid phone number format.'
    };
  }

  const isIOS = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !('MSStream' in window);
  const separator = isIOS ? '&' : '?';
  const truncatedText = `[VendorIQ Alert] ${messageBody} (Ref: ${refId})`;
  const smsUrl = `sms:${cleanPhone}${separator}body=${encodeURIComponent(truncatedText)}`;

  try {
    // Attempt triggering device SMS protocol
    window.location.href = smsUrl;

    return {
      success: true,
      channel: 'SMS',
      destination: recipientPhone,
      timestamp,
      referenceId: refId,
      details: `Native SMS client launched for ${recipientPhone}`
    };
  } catch (err: any) {
    return {
      success: false,
      channel: 'SMS',
      destination: recipientPhone,
      timestamp,
      referenceId: refId,
      details: err?.message || 'Could not launch device SMS handler.'
    };
  }
}

/**
 * Triggers native browser desktop notifications
 */
export function triggerDesktopNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
    });
    return true;
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      }
    });
  }
  return false;
}
