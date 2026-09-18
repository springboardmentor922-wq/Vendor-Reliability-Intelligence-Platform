import Layout from '../components/Layout'
import apiClient from '../api/client'

const reports = [
  { key: 'vendor-performance', title: 'Vendor Performance Report', desc: 'Delivery, quality, and reliability by vendor' },
  { key: 'procurement', title: 'Procurement Report', desc: 'All requests, approvals, and spend summary' },
  { key: 'purchase-orders', title: 'Purchase Order Report', desc: 'All POs with line items and status' },
  { key: 'compliance', title: 'Compliance Report', desc: 'Contract compliance and certification status' },
  { key: 'contracts', title: 'Contract Report', desc: 'All contracts with renewal and expiry dates' },
]

function Reports() {
  const handleExport = async (reportKey, format) => {
    try {
      let data = []
      if (reportKey === 'vendor-performance' || reportKey === 'compliance') {
        data = (await apiClient.get('/vendors/')).data
      } else if (reportKey === 'procurement' || reportKey === 'purchase-orders') {
        data = (await apiClient.get('/purchase-orders/')).data
      } else if (reportKey === 'contracts') {
        data = (await apiClient.get('/contracts/')).data
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportKey}-report.${format === 'pdf' ? 'json' : 'json'}`
      a.click()
    } catch (err) {
      alert('Failed to export report')
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
                  <button onClick={() => handleExport(r.key, 'pdf')} className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold mr-2">
                    Export
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