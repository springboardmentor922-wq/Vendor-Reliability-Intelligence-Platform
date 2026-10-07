/**
 * High-performance CSV parser supporting large supply chain datasets (10,000+ to 100,000+ rows)
 * Handles quoted fields, comma delimiters, and CRLF line breaks accurately without truncation.
 */

export interface ParsedCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  previewRows: Record<string, string>[];
  metricsSummary: {
    totalRecords: number;
    delayCount: number;
    onTimeCount: number;
    totalSales: number;
    avgRealDays: number;
    avgScheduledDays: number;
    detectedLateRate: number;
  };
}

export function parseSupplyChainCSV(csvText: string, previewLimit: number = 15): ParsedCSVResult {
  if (!csvText || !csvText.trim()) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      previewRows: [],
      metricsSummary: {
        totalRecords: 0,
        delayCount: 0,
        onTimeCount: 0,
        totalSales: 0,
        avgRealDays: 0,
        avgScheduledDays: 0,
        detectedLateRate: 0,
      },
    };
  }

  // Fast line extraction that respects quotes containing newlines if any
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || (char === '\r' && csvText[i + 1] === '\n')) && !inQuotes) {
      if (char === '\r') i++; // Skip '\n' of '\r\n'
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) {
    return {
      headers: [],
      rows: [],
      totalRows: 0,
      previewRows: [],
      metricsSummary: {
        totalRecords: 0,
        delayCount: 0,
        onTimeCount: 0,
        totalSales: 0,
        avgRealDays: 0,
        avgScheduledDays: 0,
        detectedLateRate: 0,
      },
    };
  }

  // Parse headers
  const parseRowCells = (line: string): string[] => {
    const cells: string[] = [];
    let currentCell = '';
    let cellInQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (cellInQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          cellInQuotes = !cellInQuotes;
        }
      } else if (char === ',' && !cellInQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());
    return cells;
  };

  const rawHeaders = parseRowCells(lines[0]);
  const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());

  // Metrics trackers
  let delayCount = 0;
  let onTimeCount = 0;
  let totalSales = 0;
  let sumRealDays = 0;
  let sumScheduledDays = 0;
  let validDaysCount = 0;

  const totalLines = lines.length;
  const rows: Record<string, string>[] = new Array(totalLines - 1);
  const previewRows: Record<string, string>[] = [];

  for (let i = 1; i < totalLines; i++) {
    const cells = parseRowCells(lines[i]);
    const rowObj: Record<string, string> = {};

    for (let h = 0; h < headers.length; h++) {
      const colName = headers[h];
      const val = cells[h] !== undefined ? cells[h].replace(/^["']|["']$/g, '').trim() : '';
      rowObj[colName] = val;
    }

    rows[i - 1] = rowObj;

    if (i - 1 < previewLimit) {
      previewRows.push(rowObj);
    }

    // Metric parsing across standard DataCo & supply chain columns
    const realDays = parseFloat(rowObj['Days for shipping (real)'] || rowObj['shipping_days_real'] || rowObj['real_days'] || '0');
    const scheduledDays = parseFloat(rowObj['Days for shipment (scheduled)'] || rowObj['shipping_days_scheduled'] || rowObj['scheduled_days'] || '0');
    const lateRisk = parseInt(rowObj['Late_delivery_risk'] || rowObj['late_risk'] || '-1', 10);
    const deliveryStatus = (rowObj['Delivery Status'] || rowObj['delivery_status'] || rowObj['Status'] || '').toLowerCase();
    const sales = parseFloat(rowObj['Sales'] || rowObj['Sales per customer'] || rowObj['sales'] || rowObj['Order Value'] || '0');

    if (!isNaN(sales)) totalSales += sales;
    if (!isNaN(realDays) && realDays > 0) {
      sumRealDays += realDays;
      validDaysCount++;
    }
    if (!isNaN(scheduledDays) && scheduledDays > 0) {
      sumScheduledDays += scheduledDays;
    }

    const isLate = lateRisk === 1 || 
      deliveryStatus.includes('late') || 
      deliveryStatus.includes('delay') || 
      (realDays > scheduledDays && scheduledDays > 0);

    if (isLate) {
      delayCount++;
    } else {
      onTimeCount++;
    }
  }

  const totalRecords = rows.length;
  const detectedLateRate = totalRecords > 0 ? Math.round((delayCount / totalRecords) * 100) : 0;
  const avgRealDays = validDaysCount > 0 ? Number((sumRealDays / validDaysCount).toFixed(1)) : 4.2;
  const avgScheduledDays = validDaysCount > 0 ? Number((sumScheduledDays / validDaysCount).toFixed(1)) : 3.8;

  return {
    headers,
    rows,
    totalRows: totalRecords,
    previewRows,
    metricsSummary: {
      totalRecords,
      delayCount,
      onTimeCount,
      totalSales: Math.round(totalSales),
      avgRealDays,
      avgScheduledDays,
      detectedLateRate,
    },
  };
}
