import React, { useRef } from 'react';

// Number to Words converter for Indian Rupees
const numberToWords = (num) => {
  if (!num || isNaN(num)) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    let str = '';
    if (n > 9999999) {
      str += inWords(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n > 99999) {
      str += inWords(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n > 999) {
      str += inWords(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 99) {
      str += inWords(Math.floor(n / 100)) + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) str += a[n];
      else str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    }
    return str.trim();
  };

  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);
  let words = 'Rupees ' + inWords(whole);
  if (fraction > 0) {
    words += ' and ' + inWords(fraction) + ' Paise';
  }
  return words + ' Only';
};

export const InvoicePDFModal = ({ isOpen, onClose, invoice }) => {
  const printAreaRef = useRef(null);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const po = invoice.purchase_order || {};
  const vendor = po.vendor || {};
  const items = po.items && po.items.length > 0 ? po.items : [
    {
      id: 1,
      item_name: 'Procurement Supply Line Item (Standard Delivery)',
      quantity: 1,
      unit_price: invoice.amount ? (invoice.amount / 1.18).toFixed(2) : 0
    }
  ];

  // GST 18% calculation
  const totalAmount = Number(invoice.amount) || 0;
  const taxableValue = Math.round((totalAmount / 1.18) * 100) / 100;
  const cgstAmount = Math.round(((totalAmount - taxableValue) / 2) * 100) / 100;
  const sgstAmount = Math.round((totalAmount - taxableValue - cgstAmount) * 100) / 100;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1000, overflowY: 'auto', padding: '20px 0' }}>
      <div
        className="modal-content printable-modal"
        style={{
          maxWidth: '820px',
          width: '95%',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          margin: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Action Bar (Hidden in Print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            
            <span style={{ fontWeight: 700, fontSize: '15px' }}>Tax Invoice Preview & Download</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: invoice.status === 'paid' ? '#10b981' : '#f59e0b',
                color: '#ffffff',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              {invoice.status || 'PENDING'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '7px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
              }}
            >
              Download / Print PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: 'none',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice A4 Document */}
        <div
          ref={printAreaRef}
          id="printable-tax-invoice"
          style={{
            padding: '36px 40px',
            color: '#1e293b',
            fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
            fontSize: '12px',
            lineHeight: 1.5,
            backgroundColor: '#ffffff'
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0284c7', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                  V
                </div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  VendorIQ Platform
                </h1>
              </div>
              <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>
                Enterprise Supplier Intelligence & Procurement Operations
              </p>
              <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>
                GSTIN: <strong>29AAACB1234F1Z5</strong> | State Code: 29 (Karnataka)
              </p>
              <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>
                Level 7, Cyber Tech Park, Whitefield, Bangalore - 560066, India
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', letterSpacing: '1px' }}>
                TAX INVOICE
              </div>
              <p style={{ margin: '4px 0 2px 0', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                Invoice No: <span style={{ color: '#0284c7' }}>{invoice.invoice_number}</span>
              </p>
              <p style={{ margin: '2px 0', fontSize: '11.5px', color: '#475569' }}>
                Date: <strong>{invoice.due_date ? new Date().toLocaleDateString('en-IN') : 'N/A'}</strong>
              </p>
              <p style={{ margin: '2px 0', fontSize: '11.5px', color: '#475569' }}>
                Due Date: <strong>{invoice.due_date || 'N/A'}</strong>
              </p>
              <div style={{ marginTop: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: invoice.status === 'paid' ? '1.5px solid #10b981' : '1.5px solid #f59e0b',
                    color: invoice.status === 'paid' ? '#047857' : '#b45309',
                    backgroundColor: invoice.status === 'paid' ? '#ecfdf5' : '#fffbeb'
                  }}
                >
                  {invoice.status === 'paid' ? 'PAYMENT COMPLETED' : 'PAYMENT DUE'}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier & Buyer Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {/* Supplier / Vendor */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
                Billed By (Supplier / Vendor)
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                {vendor.company_name || invoice.vendor_name || 'Apex Raw Materials Ltd'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Vendor ID: <strong>{vendor.code || `VND-${vendor.id || '001'}`}</strong>
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                GSTIN: <strong>{vendor.gst_number || '27AABCT3529Q1ZM'}</strong>
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Address: {vendor.address || 'Plot 42, Heavy Industrial Area, Phase II, Pune - 411018, Maharashtra'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Contact: {vendor.email || 'procurement-orders@apexmaterials.com'} | {vendor.phone || '+91 98200 45678'}
              </div>
            </div>

            {/* Buyer Details */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
                Billed To (Buyer / Recipient)
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                VendorIQ Global SCM Operations Ltd
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Purchase Order Ref: <strong>{po.po_number || invoice.po_number || 'PO-2026-F6124E'}</strong>
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Buyer GSTIN: <strong>29AAACB1234F1Z5</strong>
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Delivery Site: Central Warehouse Dock 4, Bangalore East - 560048
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Payment Terms: <strong>Net 30 Days (Direct Bank Transfer)</strong>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 10px', borderRadius: '4px 0 0 0', width: '40px' }}>#</th>
                <th style={{ padding: '8px 10px' }}>Item Description</th>
                <th style={{ padding: '8px 10px', width: '90px' }}>HSN/SAC</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '60px' }}>Qty</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Unit Rate (₹)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', borderRadius: '0 4px 0 0', width: '120px' }}>Taxable Amt (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const lineTotal = (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 600, color: '#0f172a' }}>
                      {it.item_name}
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 400 }}>
                        High-grade aerospace industrial specification standard batch
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px', color: '#64748b' }}>7208 90 00</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600 }}>{it.quantity}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>₹{Number(it.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Financials & Tax Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'flex-start', marginBottom: '24px' }}>
            {/* Amount in words & Bank Details */}
            <div>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                  Total In Words:
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {numberToWords(totalAmount)}
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', marginBottom: '4px' }}>
                  Bank Remittance Details
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  Beneficiary Name: <strong>{vendor.company_name || 'Apex Raw Materials Ltd'}</strong>
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  Bank: <strong>HDFC Bank Ltd</strong> | Branch: Pune Industrial Area
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  Account No: <strong>50200084920194</strong> (Current A/C)
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  IFSC: <strong>HDFC0001234</strong> | MICR: 411240012
                </div>
              </div>
            </div>

            {/* Calculations Card */}
            <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569', fontSize: '11.5px' }}>
                <span>Taxable Amount (Subtotal):</span>
                <span style={{ fontWeight: 600 }}>₹{taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569', fontSize: '11.5px' }}>
                <span>Central GST (CGST @ 9%):</span>
                <span style={{ fontWeight: 600 }}>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569', fontSize: '11.5px' }}>
                <span>State GST (SGST @ 9%):</span>
                <span style={{ fontWeight: 600 }}>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ height: '1px', background: '#cbd5e1', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                <span>Grand Total (INR):</span>
                <span style={{ color: '#0284c7' }}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'right', marginTop: '2px' }}>
                (Inclusive of all statutory taxes)
              </div>
            </div>
          </div>

          {/* Declarations & Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'flex-end', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#475569' }}>Terms & Declaration:</p>
              <p style={{ margin: 0 }}>
                1. Goods once sold will not be accepted back after 15 calendar days from site inspection.
              </p>
              <p style={{ margin: 0 }}>
                2. Disputes are subject to Pune / Bangalore jurisdiction only.
              </p>
              <p style={{ margin: 0 }}>
                3. This is a computer-generated tax invoice verified under digital ERP compliance.
              </p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '12px', fontWeight: 700 }}>
                  [DIGITALLY SIGNED]
                </span>
              </div>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>
                For {vendor.company_name || 'Apex Raw Materials Ltd'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                Authorized Signatory & Finance Controller
              </div>
            </div>
          </div>
        </div>

        {/* Print Stylesheet */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-tax-invoice, #printable-tax-invoice * {
              visibility: visible;
            }
            #printable-tax-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 20px;
              background: #ffffff !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
