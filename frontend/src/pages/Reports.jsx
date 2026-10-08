import { useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import Layout from '../components/Layout'
import apiClient from '../api/client'

const reports = [
  { key: 'vendor-performance', title: 'Vendor Performance Report', desc: 'Delivery, quality, and reliability by vendor' },
  { key: 'procurement', title: 'Procurement Report', desc: 'All requests, approvals, and spend summary' },
  { key: 'purchase-orders', title: 'Purchase Order Report', desc: 'All POs with line items and status' },
  { key: 'compliance', title: 'Compliance Report', desc: 'Contract compliance and certification status' },
  { key: 'contracts', title: 'Contract Report', desc: 'All contracts with renewal and expiry dates' },
]

async function getReportData(key) {
  const vendors = (await apiClient.get('/vendors/')).data
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.company_name]))
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '-')

  if (key === 'vendor-performance') {
    return {
      title: 'Vendor Performance Report',
      sheets: [{
        name: 'Vendor Performance',
        headers: ['Vendor', 'Category', 'Status', 'Reliability Score', 'Risk Level', 'Trend', 'Recommendation'],
        rows: vendors.map((v) => [v.company_name, v.category, v.status, v.reliability_score, v.risk_level || '-', v.trend || '-', v.recommendation || '-']),
      }],
    }
  }

  if (key === 'procurement') {
    const pos = (await apiClient.get('/purchase-orders/')).data
    return {
      title: 'Procurement Report',
      sheets: [{
        name: 'Procurement',
        headers: ['PO Number', 'Vendor', 'Department', 'Order Date', 'Status', 'Total Amount'],
        rows: pos.map((po) => [po.order_number, vendorMap[po.vendor_id] || po.vendor_id, po.department || '-', fmt(po.order_date), po.status, po.total_amount]),
      }],
    }
  }

  if (key === 'purchase-orders') {
    const pos = (await apiClient.get('/purchase-orders/')).data
    return {
      title: 'Purchase Order Report',
      sheets: [{
        name: 'Purchase Orders',
        headers: ['PO Number', 'Vendor', 'Items', 'Subtotal', 'Tax', 'Total', 'Expected Delivery', 'Status'],
        rows: pos.map((po) => [po.order_number, vendorMap[po.vendor_id] || po.vendor_id, po.items?.length || 0, po.subtotal, po.tax_amount, po.total_amount, fmt(po.expected_delivery_date), po.status]),
      }],
    }
  }

  if (key === 'contracts') {
    const contracts = (await apiClient.get('/contracts/')).data
    return {
      title: 'Contract Report',
      sheets: [{
        name: 'Contracts',
        headers: ['Title', 'Vendor', 'Start Date', 'End Date', 'Status', 'Notes'],
        rows: contracts.map((c) => [c.title, vendorMap[c.vendor_id] || c.vendor_id, fmt(c.start_date), fmt(c.end_date), c.status, c.compliance_notes || '-']),
      }],
    }
  }

  if (key === 'compliance') {
    const [contracts, certs] = await Promise.all([
      apiClient.get('/contracts/').then((r) => r.data),
      apiClient.get('/certifications/').then((r) => r.data),
    ])
    return {
      title: 'Compliance Report',
      sheets: [
        {
          name: 'Contract Compliance',
          headers: ['Title', 'Vendor', 'Status', 'End Date'],
          rows: contracts.map((c) => [c.title, vendorMap[c.vendor_id] || c.vendor_id, c.status, fmt(c.end_date)]),
        },
        {
          name: 'Certifications',
          headers: ['Certification', 'Vendor', 'Compliance Status', 'Expiry Date'],
          rows: certs.map((c) => [c.name, vendorMap[c.vendor_id] || c.vendor_id, c.compliance_status, fmt(c.expiry_date)]),
        },
      ],
    }
  }

  return { title: 'Report', sheets: [] }
}

function Reports() {
  const [loadingKey, setLoadingKey] = useState(null)

  const exportPDF = async (key) => {
    const { title, sheets } = await getReportData(key)
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(title, 14, 15)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21)
    doc.setTextColor(0)
    let startY = 28
    sheets.forEach((sheet) => {
      if (sheets.length > 1) {
        doc.setFontSize(11)
        doc.text(sheet.name, 14, startY)
        startY += 5
      }
      autoTable(doc, {
        startY,
        head: [sheet.headers],
        body: sheet.rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [20, 33, 61] },
      })
      startY = doc.lastAutoTable.finalY + 10
    })
    doc.save(`${key}-report.pdf`)
  }

  const exportExcel = async (key) => {
    const { sheets } = await getReportData(key)
    const wb = XLSX.utils.book_new()
    sheets.forEach((sheet) => {
      const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31))
    })
    XLSX.writeFile(wb, `${key}-report.xlsx`)
  }

  const handleExport = async (key, format) => {
    setLoadingKey(`${key}-${format}`)
    try {
      if (format === 'pdf') await exportPDF(key)
      else await exportExcel(key)
    } catch (err) {
      alert('Failed to export report')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <Layout title="Reports & Export" subtitle="Generate and download reports across all modules">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2">Report</th><th className="py-2">Description</th><th className="py-2">Export</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.key} className="border-b border-gray-100 last:border-0">
                <td className="py-3 font-medium">{r.title}</td>
                <td className="py-3 text-gray-500">{r.desc}</td>
                <td className="py-3">
                  <button
                    onClick={() => handleExport(r.key, 'pdf')}
                    disabled={loadingKey === `${r.key}-pdf`}
                    className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold mr-2 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingKey === `${r.key}-pdf` ? 'Exporting...' : 'PDF'}
                  </button>
                  <button
                    onClick={() => handleExport(r.key, 'excel')}
                    disabled={loadingKey === `${r.key}-excel`}
                    className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingKey === `${r.key}-excel` ? 'Exporting...' : 'Excel'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}

export default Reports