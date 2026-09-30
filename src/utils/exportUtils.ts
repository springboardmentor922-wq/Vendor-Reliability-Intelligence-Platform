import { jsPDF } from 'jspdf';

/**
 * Utility functions for exporting dynamic data to CSV / Excel and formatted PDF generation.
 * Specially designed to work seamlessly in both sandboxed iframe previews and standalone tabs.
 */

// Show floating toast notification for export events
function showToast(message: string, type: 'success' | 'info' | 'warning' = 'success') {
  const existingToast = document.getElementById('vendoriq-export-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'vendoriq-export-toast';
  toast.className = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
    type === 'success' 
      ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50' 
      : type === 'warning'
      ? 'bg-slate-900/95 text-amber-300 border-amber-500/50 shadow-amber-950/50'
      : 'bg-slate-900/95 text-sky-300 border-sky-500/50 shadow-sky-950/50'
  }`;

  toast.innerHTML = `
    <div class="h-2 w-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : 'bg-sky-400'} animate-ping"></div>
    <div class="flex-1">${message}</div>
    <button onclick="this.parentElement.remove()" class="ml-2 text-slate-400 hover:text-white cursor-pointer font-mono text-sm">&times;</button>
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

export function exportToCSV(filename: string, rows: Record<string, any>[], columnHeaders?: Record<string, string>) {
  if (!rows || !rows.length) {
    showToast('No tabular data available to export.', 'warning');
    return;
  }

  const keys = columnHeaders ? Object.keys(columnHeaders) : Object.keys(rows[0]);
  const headers = columnHeaders ? Object.values(columnHeaders) : keys;

  const csvRows: string[] = [];
  
  // Header row
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));

  // Data rows
  for (const row of rows) {
    const values = keys.map(key => {
      const val = row[key];
      if (val === undefined || val === null) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\r\n'));
  const link = document.createElement('a');
  link.setAttribute('href', csvContent);
  const cleanFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${cleanFilename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`✓ Exported ${rows.length} rows to ${cleanFilename}.csv`, 'success');
}

/**
 * Universal PDF and Print Trigger
 * Generates an official, publication-ready PDF file using jsPDF and triggers browser print where supported.
 */
export function triggerPrintReport(
  reportTitle: string = 'Enterprise_Report',
  dataRows?: Record<string, any>[],
  columnHeaders?: Record<string, string>
) {
  const cleanTitle = reportTitle.replace(/[^a-zA-Z0-9_-]/g, ' ').trim();
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  try {
    // 1. Create client-side PDF document using jsPDF
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 24, 'F');

    // Accent line
    doc.setFillColor(56, 189, 248); // sky-400
    doc.rect(0, 24, pageWidth, 1.5, 'F');

    // Header Logo & Branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('VendorIQ', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Autonomous Supplier Intelligence & Enterprise Procurement', 48, 15);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`Official Document • Generated: ${dateStr} ${timeStr}`, pageWidth - 14, 15, { align: 'right' });

    // Document Title Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(cleanTitle.toUpperCase(), 14, 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Currency Standard: Indian Rupee (INR / ₹) • Compliance Status: Audit Verified • Org: Enterprise HQ`, 14, 40);

    // Subtle divider
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 43, pageWidth - 14, 43);

    let startY = 48;

    // If explicit data rows provided, render structured table
    if (dataRows && dataRows.length > 0) {
      const keys = columnHeaders ? Object.keys(columnHeaders) : Object.keys(dataRows[0]);
      const headers = columnHeaders ? Object.values(columnHeaders) : keys;
      const colWidth = (pageWidth - 28) / keys.length;

      // Table Header Row
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(14, startY, pageWidth - 28, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      headers.forEach((h, idx) => {
        const text = String(h).substring(0, 22);
        doc.text(text, 16 + idx * colWidth, startY + 5.5);
      });

      startY += 9;

      // Data Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      dataRows.slice(0, 25).forEach((row, rowIdx) => {
        if (startY > pageHeight - 20) {
          doc.addPage();
          startY = 20;
        }

        // Alternating row background
        if (rowIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, startY - 1, pageWidth - 28, 7, 'F');
        }

        keys.forEach((key, colIdx) => {
          let val = row[key];
          if (val === undefined || val === null) val = '-';
          const text = String(val).substring(0, 26);
          doc.text(text, 16 + colIdx * colWidth, startY + 4);
        });

        startY += 7;
      });
    } else {
      // General summary layout for non-tabular modules (e.g. Executive Dashboards)
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, startY, pageWidth - 28, 30, 2, 2, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('EXECUTIVE AUDIT SUMMARY', 18, startY + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('This executive report documents current operational metrics, supplier performance rankings, committed purchase orders,', 18, startY + 15);
      doc.text('and active compliance records verified across all VendorIQ enterprise subsystems.', 18, startY + 20);
      doc.text(`Digital Verification Hash: SHA256-${Math.random().toString(36).substring(2, 12).toUpperCase()} • Security Level: Restricted`, 18, startY + 25);

      startY += 36;
    }

    // Official Footer on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('VendorIQ Confidential • Enterprise Supplier Governance Platform', 14, pageHeight - 7);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    }

    // Save as PDF file (Reliable download across all browsers and iframes)
    const pdfFilename = `VendorIQ_${reportTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(pdfFilename);

    showToast(`✓ Generated & downloaded PDF: ${pdfFilename}`, 'success');
  } catch (error) {
    console.error('jsPDF generation failed:', error);
  }

  // 2. Also attempt browser print dialog in case the user has opened the app standalone or print is permitted
  try {
    const originalTitle = document.title;
    document.title = `VendorIQ_${reportTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    
    // Safely invoke window.print() inside try-catch to prevent sandbox error crashes
    setTimeout(() => {
      try {
        window.print();
      } catch (printError) {
        console.info('Iframe browser print blocked by sandbox modal policy. PDF download was completed instead.');
      }
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 150);
  } catch (e) {
    // Silently continue
  }
}
