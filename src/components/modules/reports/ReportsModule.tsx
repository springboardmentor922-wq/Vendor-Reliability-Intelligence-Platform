import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Filter, 
  FileText, 
  CheckCircle, 
  DollarSign, 
  Building2, 
  ShieldCheck,
  ShoppingCart
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { exportToCSV, triggerPrintReport } from '../../../utils/exportUtils';
import { Badge } from '../../common/Badge';

export const ReportsModule: React.FC = () => {
  const { 
    vendors, 
    purchaseOrders, 
    procurementRequests, 
    contracts, 
    certifications, 
    invoices 
  } = useApp();

  const [activeReport, setActiveReport] = useState<
    'performance' | 'procurement' | 'po' | 'compliance' | 'contract'
  >('performance');

  const [categoryFilter, setCategoryFilter] = useState('All');

  // 1. Vendor Performance Report Data
  const performanceRows = vendors.map((v, i) => ({
    rank: i + 1,
    vendorId: v.id,
    vendorName: v.name,
    category: v.category,
    reliabilityScore: v.reliabilityScore,
    tier: v.tier,
    riskLevel: v.riskLevel,
    onTimeDeliveryRate: `${v.metrics.onTimeDeliveryRate}%`,
    qualityRating: `${v.metrics.qualityRating} / 5.0`,
    defectRate: `${v.metrics.defectRate}%`,
    responseTimeHours: `${v.metrics.communicationResponseTimeHours} hrs`,
    totalDeliveries: v.metrics.totalDeliveries,
    totalSpend: `₹${v.totalSpend.toLocaleString('en-IN')}`,
    status: v.status,
  }));

  // 2. Procurement Report Data
  const procurementRows = procurementRequests.map(pr => ({
    requestId: pr.id,
    title: pr.title,
    department: pr.department,
    requestedBy: pr.requestedBy,
    category: pr.category,
    estimatedBudget: `₹${pr.estimatedBudget.toLocaleString('en-IN')}`,
    urgency: pr.urgency,
    status: pr.status,
    createdAt: pr.createdAt,
    justification: pr.justification,
  }));

  // 3. Purchase Order Report Data
  const poRows = purchaseOrders.map(po => ({
    poNumber: po.id,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    category: po.vendorCategory,
    totalAmount: `₹${po.totalAmount.toLocaleString('en-IN')}`,
    createdAt: po.createdAt,
    expectedDeliveryDate: po.expectedDeliveryDate,
    status: po.status,
    deliveryStatus: po.deliveryStatus,
    carrier: po.shippingCarrier || 'N/A',
    trackingNumber: po.trackingNumber || 'N/A',
    lateRisk: `${po.predictedLateRisk}%`,
  }));

  // 4. Compliance Report Data
  const complianceRows = certifications.map(c => ({
    certId: c.id,
    vendorId: c.vendorId,
    vendorName: c.vendorName,
    certName: c.name,
    issuingAuthority: c.issuingAuthority,
    certNumber: c.certificateNumber,
    issueDate: c.issueDate,
    expiryDate: c.expiryDate,
    status: c.status,
  }));

  // 5. Contract Report Data
  const contractRows = contracts.map(c => ({
    contractId: c.id,
    title: c.title,
    vendorName: c.vendorName,
    contractValue: `₹${c.contractValue.toLocaleString('en-IN')}`,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    renewalNoticeDays: `${c.renewalNoticeDays} Days`,
    termsSummary: c.termsSummary,
  }));

  const handleExportCSV = () => {
    if (activeReport === 'performance') {
      exportToCSV('Vendor_Performance_Report', performanceRows);
    } else if (activeReport === 'procurement') {
      exportToCSV('Procurement_Requisition_Report', procurementRows);
    } else if (activeReport === 'po') {
      exportToCSV('Purchase_Order_Tracking_Report', poRows);
    } else if (activeReport === 'compliance') {
      exportToCSV('Vendor_Compliance_Audit_Report', complianceRows);
    } else {
      exportToCSV('Vendor_Contracts_Register_Report', contractRows);
    }
  };

  const handlePrintPDF = () => {
    if (activeReport === 'performance') {
      triggerPrintReport('Vendor_Performance_Report', performanceRows);
    } else if (activeReport === 'procurement') {
      triggerPrintReport('Procurement_Requisition_Report', procurementRows);
    } else if (activeReport === 'po') {
      triggerPrintReport('Purchase_Order_Tracking_Report', poRows);
    } else if (activeReport === 'compliance') {
      triggerPrintReport('Vendor_Compliance_Audit_Report', complianceRows);
    } else {
      triggerPrintReport('Vendor_Contracts_Register_Report', contractRows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Analytics & Reports Engine</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic generation of 5 mandatory governance reports synchronized to underlying system state.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPDF}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Print or save as formatted PDF"
          >
            <Printer className="h-4 w-4 text-sky-400" />
            Print / Save PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-md shadow-emerald-600/20"
            title="Export dynamic records to standard CSV / Excel"
          >
            <Download className="h-4 w-4" />
            Export to Excel/CSV
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveReport('performance')}
          className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-center ${
            activeReport === 'performance' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>1. Vendor Performance</span>
        </button>
        <button
          onClick={() => setActiveReport('procurement')}
          className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-center ${
            activeReport === 'procurement' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>2. Procurement Requisitions</span>
        </button>
        <button
          onClick={() => setActiveReport('po')}
          className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-center ${
            activeReport === 'po' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>3. Purchase Orders</span>
        </button>
        <button
          onClick={() => setActiveReport('compliance')}
          className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-center ${
            activeReport === 'compliance' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>4. Compliance Audit</span>
        </button>
        <button
          onClick={() => setActiveReport('contract')}
          className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-center ${
            activeReport === 'contract' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>5. Contracts Register</span>
        </button>
      </div>

      {/* REPORT CONTENT VIEW */}
      <div id="printable-report" className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        {/* Report Top Meta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight">
              {activeReport === 'performance' && 'Mandatory Report: Vendor Performance & Reliability Evaluation'}
              {activeReport === 'procurement' && 'Mandatory Report: Departmental Procurement Requisitions'}
              {activeReport === 'po' && 'Mandatory Report: Purchase Order Pipeline & Fulfillment Tracking'}
              {activeReport === 'compliance' && 'Mandatory Report: Regulatory Compliance & Certification Audit'}
              {activeReport === 'contract' && 'Mandatory Report: Vendor Contracts & Renewal Expiry Register'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generated dynamically from current application database state • As of {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Records: {
                activeReport === 'performance' ? performanceRows.length :
                activeReport === 'procurement' ? procurementRows.length :
                activeReport === 'po' ? poRows.length :
                activeReport === 'compliance' ? complianceRows.length : contractRows.length
              }
            </span>
          </div>
        </div>

        {/* Dynamic Table for Active Report */}
        <div className="overflow-x-auto">
          {activeReport === 'performance' && (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Supplier Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Reliability Score</th>
                  <th className="py-3 px-3">Tier / Risk</th>
                  <th className="py-3 px-3">On-Time %</th>
                  <th className="py-3 px-3">Quality Rating</th>
                  <th className="py-3 px-3">Defect %</th>
                  <th className="py-3 px-3">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {performanceRows.map((r) => (
                  <tr key={r.vendorId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">#{r.rank}</td>
                    <td className="py-3 px-3 font-bold text-white">{r.vendorName}</td>
                    <td className="py-3 px-3 text-slate-400">{r.category}</td>
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{r.reliabilityScore}/100</td>
                    <td className="py-3 px-3">
                      <Badge variant={r.riskLevel === 'Low' ? 'success' : r.riskLevel === 'Medium' ? 'info' : 'danger'} size="sm">
                        {r.tier}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400 font-bold">{r.onTimeDeliveryRate}</td>
                    <td className="py-3 px-3 font-mono text-amber-400">{r.qualityRating}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{r.defectRate}</td>
                    <td className="py-3 px-3 font-mono text-slate-200 font-bold">{r.totalSpend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'procurement' && (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Req ID</th>
                  <th className="py-3 px-3">Title</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Requested By</th>
                  <th className="py-3 px-3">Estimated Budget</th>
                  <th className="py-3 px-3">Urgency</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {procurementRows.map((r) => (
                  <tr key={r.requestId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{r.requestId}</td>
                    <td className="py-3 px-3 font-bold text-white">{r.title}</td>
                    <td className="py-3 px-3 text-slate-300">{r.department}</td>
                    <td className="py-3 px-3 text-slate-400">{r.requestedBy}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">{r.estimatedBudget}</td>
                    <td className="py-3 px-3">
                      <Badge variant={r.urgency === 'Critical' ? 'danger' : 'info'} size="sm">
                        {r.urgency}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={r.status === 'Approved' ? 'success' : 'warning'} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">{r.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'po' && (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">PO #</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Expected ETA</th>
                  <th className="py-3 px-3">Order Status</th>
                  <th className="py-3 px-3">Delivery Status</th>
                  <th className="py-3 px-3">Carrier / Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {poRows.map((r) => (
                  <tr key={r.poNumber} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{r.poNumber}</td>
                    <td className="py-3 px-3 font-bold text-white">{r.vendorName}</td>
                    <td className="py-3 px-3 text-slate-400">{r.category}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">{r.totalAmount}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{r.expectedDeliveryDate}</td>
                    <td className="py-3 px-3">
                      <Badge variant={r.status === 'Completed' ? 'success' : 'info'} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={r.deliveryStatus === 'Delayed' ? 'danger' : 'success'} size="sm">
                        {r.deliveryStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {r.carrier}: {r.trackingNumber}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'compliance' && (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Cert ID</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Certification Standard</th>
                  <th className="py-3 px-3">Issuing Body</th>
                  <th className="py-3 px-3">Certificate Number</th>
                  <th className="py-3 px-3">Validity Window</th>
                  <th className="py-3 px-3">Compliance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {complianceRows.map((r) => (
                  <tr key={r.certId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{r.certId}</td>
                    <td className="py-3 px-3 font-bold text-white">{r.vendorName}</td>
                    <td className="py-3 px-3 text-slate-200 font-medium">{r.certName}</td>
                    <td className="py-3 px-3 text-slate-400">{r.issuingAuthority}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">{r.certNumber}</td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {r.issueDate} - {r.expiryDate}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={r.status === 'Valid' ? 'success' : 'danger'} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeReport === 'contract' && (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Contract ID</th>
                  <th className="py-3 px-3">Title & Summary</th>
                  <th className="py-3 px-3">Vendor</th>
                  <th className="py-3 px-3">Committed Value</th>
                  <th className="py-3 px-3">Term Period</th>
                  <th className="py-3 px-3">Renewal Notice</th>
                  <th className="py-3 px-3">Contract Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {contractRows.map((r) => (
                  <tr key={r.contractId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">{r.contractId}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-white">{r.title}</p>
                      <p className="text-[11px] text-slate-500">{r.termsSummary}</p>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200">{r.vendorName}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">{r.contractValue}</td>
                    <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                      {r.startDate} to {r.endDate}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{r.renewalNoticeDays}</td>
                    <td className="py-3 px-3">
                      <Badge variant={r.status === 'Active' ? 'success' : 'warning'} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
