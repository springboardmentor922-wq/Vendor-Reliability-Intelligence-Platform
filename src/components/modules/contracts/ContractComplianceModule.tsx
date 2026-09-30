import React, { useState } from 'react';
import { 
  FileCheck2, 
  Plus, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Search,
  DownloadCloud,
  FileCheck,
  UploadCloud,
  X,
  Building2,
  Printer,
  Download
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Badge } from '../../common/Badge';
import { Modal } from '../../common/Modal';
import { VendorDocument } from '../../../types';
import { exportToCSV, triggerPrintReport } from '../../../utils/exportUtils';

export const ContractComplianceModule: React.FC = () => {
  const { 
    contracts, 
    certifications, 
    vendorDocuments, 
    vendors, 
    renewContract, 
    verifyDocument, 
    uploadVendorDocument,
    currentUser,
    currentRole,
    currentVendorId 
  } = useApp();

  const isVendor = currentRole === 'Vendor';
  const effectiveVendorId = (isVendor && currentUser.vendorId) ? currentUser.vendorId : currentVendorId;

  // Strict Vendor Scope
  const scopedContracts = isVendor ? contracts.filter(c => c.vendorId === effectiveVendorId) : contracts;
  const scopedCerts = isVendor ? certifications.filter(c => c.vendorId === effectiveVendorId) : certifications;
  const scopedDocs = isVendor ? vendorDocuments.filter(d => d.vendorId === effectiveVendorId) : vendorDocuments;

  const [activeTab, setActiveTab] = useState<'contracts' | 'certs' | 'docs'>('contracts');
  const [searchTerm, setSearchTerm] = useState('');

  // Contract renewal modal
  const [renewingContractId, setRenewingContractId] = useState<string | null>(null);
  const [newEndDate, setNewEndDate] = useState('2027-12-31');

  // Document upload modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDocVendorId, setNewDocVendorId] = useState(effectiveVendorId || vendors[0]?.id || '');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState<VendorDocument['type']>('Insurance Certificate');
  const [newDocFileName, setNewDocFileName] = useState('');

  const selectedContract = contracts.find(c => c.id === renewingContractId);

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingContractId) return;
    renewContract(renewingContractId, newEndDate);
    setRenewingContractId(null);
  };

  const handleUploadDocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    const targetVendor = vendors.find(v => v.id === newDocVendorId) || vendors[0];
    uploadVendorDocument({
      vendorId: targetVendor.id,
      vendorName: targetVendor.name,
      title: newDocTitle.trim(),
      type: newDocType,
      fileName: newDocFileName.trim() || `${newDocTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
    });
    setNewDocTitle('');
    setNewDocFileName('');
    setIsDocModalOpen(false);
  };

  const filteredContracts = scopedContracts.filter(c =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCerts = scopedCerts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDocs = scopedDocs.filter(d =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canVerify = currentRole === 'Administrator' || currentRole === 'Auditor';

  const handleExportCSV = () => {
    if (activeTab === 'contracts') {
      const rows = filteredContracts.map(c => ({
        ContractID: c.id,
        Title: c.title,
        VendorName: c.vendorName,
        StartDate: c.startDate,
        EndDate: c.endDate,
        Value: `₹${c.contractValue.toLocaleString('en-IN')}`,
        Status: c.status,
        AutoRenew: c.autoRenew ? 'Yes' : 'No'
      }));
      exportToCSV('VendorIQ_Contracts_Register', rows, {
        ContractID: 'Contract ID',
        Title: 'Agreement Title',
        VendorName: 'Vendor Name',
        StartDate: 'Commencement Date',
        EndDate: 'Expiration Date',
        Value: 'Total Contract Value (₹)',
        Status: 'Contract Status',
        AutoRenew: 'Auto-Renew Clause'
      });
    } else if (activeTab === 'certs') {
      const rows = filteredCerts.map(cert => ({
        CertID: cert.id,
        VendorName: cert.vendorName,
        Name: cert.name,
        IssuingBody: cert.issuingBody,
        ValidUntil: cert.validUntil,
        Status: cert.status
      }));
      exportToCSV('VendorIQ_Certifications_Audit', rows, {
        CertID: 'Cert ID',
        VendorName: 'Vendor Name',
        Name: 'Certification Name',
        IssuingBody: 'Issuing Authority',
        ValidUntil: 'Valid Until',
        Status: 'Audit Status'
      });
    } else {
      const rows = filteredDocs.map(doc => ({
        DocumentID: doc.id,
        Title: doc.title,
        Type: doc.type,
        VendorName: doc.vendorName,
        UploadDate: doc.uploadDate,
        Status: doc.status,
        VerifiedBy: doc.verifiedBy || 'Pending'
      }));
      exportToCSV('VendorIQ_Compliance_Filings', rows, {
        DocumentID: 'Doc ID',
        Title: 'Document Title',
        Type: 'Document Type',
        VendorName: 'Vendor Name',
        UploadDate: 'Uploaded Date',
        Status: 'Verification Status',
        VerifiedBy: 'Verified By'
      });
    }
  };

  const handlePrintPDF = () => {
    if (activeTab === 'contracts') {
      const rows = filteredContracts.map(c => ({
        ContractID: c.id,
        Title: c.title,
        Vendor: c.vendorName,
        Term: `${c.startDate} to ${c.endDate}`,
        Value: `₹${c.contractValue.toLocaleString('en-IN')}`,
        Status: c.status
      }));
      triggerPrintReport('Contract_Agreements_Register_Report', rows);
    } else if (activeTab === 'certs') {
      const rows = filteredCerts.map(cert => ({
        CertID: cert.id,
        Vendor: cert.vendorName,
        Standard: cert.name,
        Issuer: cert.issuingBody,
        ValidUntil: cert.validUntil,
        Status: cert.status
      }));
      triggerPrintReport('Statutory_Certifications_Audit_Report', rows);
    } else {
      const rows = filteredDocs.map(doc => ({
        DocID: doc.id,
        Title: doc.title,
        Type: doc.type,
        Vendor: doc.vendorName,
        UploadDate: doc.uploadDate,
        Status: doc.status
      }));
      triggerPrintReport('Compliance_Filings_Verification_Report', rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              {isVendor ? 'Company Contracts & Compliance Registry' : 'Contract & Compliance Repository'}
            </h1>
            {isVendor && <Badge variant="success" size="sm">Supplier Scoped View</Badge>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isVendor
              ? `Authorized repository of legally binding Master Service Agreements, required ISO certifications, and submitted filings for ${vendors.find(v => v.id === effectiveVendorId)?.name || 'your company'}.`
              : 'Enterprise repository of master agreements, renewal schedules, statutory ISO/ESG certifications, and audited compliance records.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Export to CSV/Excel"
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
            onClick={() => setIsDocModalOpen(true)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload Document
          </button>
        </div>
      </div>

      {/* Tab Selector & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'contracts' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Contracts ({scopedContracts.length})
          </button>
          <button
            onClick={() => setActiveTab('certs')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'certs' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Certifications ({scopedCerts.length})
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'docs' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Compliance Documents ({scopedDocs.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search contracts or certs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* TAB 1: CONTRACTS */}
      {activeTab === 'contracts' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Active Master Service Agreements & Terms</h3>
              <p className="text-xs text-slate-400">Review expiration milestones, SLA adherence benchmarks, and renewal notices</p>
            </div>
            <span className="text-xs font-mono font-bold text-sky-400">
              Total Contract Value: ₹{scopedContracts.reduce((sum, c) => sum + c.contractValue, 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {filteredContracts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No contracts matching search criteria.</p>
            ) : (
              filteredContracts.map((contract) => (
                <div key={contract.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{contract.title}</h4>
                      <Badge
                        variant={
                          contract.status === 'Active' ? 'success' :
                          contract.status === 'Expiring Soon' ? 'warning' : 'danger'
                        }
                        size="sm"
                      >
                        {contract.status}
                      </Badge>
                      <span className="text-[11px] font-mono text-slate-400">[{contract.id}]</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {contract.termsSummary}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        <strong className="text-slate-200">{contract.vendorName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        Term: {contract.startDate} to <strong className="text-white">{contract.endDate}</strong>
                      </span>
                      <span className="font-mono text-emerald-400 font-bold">
                        ₹{contract.contractValue.toLocaleString('en-IN')} Value
                      </span>
                      <span className="text-slate-300">
                        SLA Compliance: <strong className="text-sky-400">{contract.complianceRate}%</strong>
                      </span>
                    </div>
                  </div>

                  {!isVendor && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setRenewingContractId(contract.id);
                          setNewEndDate('2027-12-31');
                        }}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                        Extend Term
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CERTIFICATIONS */}
      {activeTab === 'certs' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Regulatory & ISO Quality Certifications</h3>
              <p className="text-xs text-slate-400">Track statutory compliance, certificate numbers, and expiration deadlines</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {scopedCerts.filter(c => c.status === 'Valid').length} of {scopedCerts.length} Valid
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCerts.map((cert) => (
              <div key={cert.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                    <CheckCircle className={`h-4 w-4 ${cert.status === 'Valid' ? 'text-emerald-400' : 'text-amber-400'}`} />
                    {cert.name}
                  </div>
                  <Badge variant={cert.status === 'Valid' ? 'success' : cert.status === 'Expiring Soon' ? 'warning' : 'danger'} size="sm">
                    {cert.status}
                  </Badge>
                </div>

                <p className="text-slate-400 font-semibold">{cert.vendorName}</p>

                <div className="space-y-1 text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Issuing Body:</span>
                    <strong className="text-slate-200">{cert.issuingBody}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Certificate No:</span>
                    <span className="font-mono text-sky-400">{cert.certificateNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valid Period:</span>
                    <span>{cert.issueDate} to {cert.expiryDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLIANCE DOCUMENTS */}
      {activeTab === 'docs' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Vendor Documentation & Filings</h3>
              <p className="text-xs text-slate-400">Audited evidence: tax IDs, insurance certificates, banking forms, and non-disclosure agreements</p>
            </div>
            <Badge variant="info" size="sm">{scopedDocs.length} Total Files</Badge>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-sky-400 mt-0.5">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{doc.title}</span>
                      <Badge variant={doc.verified ? 'success' : 'warning'} size="sm">
                        {doc.verified ? 'Verified ✓' : 'Pending Verification'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Vendor: <strong className="text-slate-200">{doc.vendorName}</strong> • Type: <strong className="text-slate-300">{doc.type}</strong> • File: <span className="font-mono text-slate-300">{doc.fileName}</span> • Uploaded: {doc.uploadedAt}
                    </p>
                    {doc.verifiedBy && (
                      <p className="text-[10px] text-emerald-400 mt-0.5">
                        Verified by Auditor: {doc.verifiedBy}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!doc.verified && canVerify ? (
                    <button
                      onClick={() => verifyDocument(doc.id)}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      Audit & Sign Off
                    </button>
                  ) : doc.verified ? (
                    <span className="text-xs text-emerald-400 font-mono">Archived to Record ✓</span>
                  ) : (
                    <span className="text-xs text-amber-400 font-mono">Pending Auditor Sign-off</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract Renewal Modal */}
      {selectedContract && (
        <Modal
          isOpen={!!renewingContractId}
          onClose={() => setRenewingContractId(null)}
          title={`Renew Contract: ${selectedContract.title}`}
          subtitle={`Supplier: ${selectedContract.vendorName} | Current Expiry: ${selectedContract.endDate}`}
          maxWidth="md"
        >
          <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">New Contract End Date *</label>
              <input
                type="date"
                required
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-slate-300">
              <span className="font-bold text-white block">Current Contract Terms:</span>
              <p className="text-[11px] text-slate-400">{selectedContract.termsSummary}</p>
              <p className="text-[11px] text-emerald-400 font-mono font-bold">
                Value: ₹{selectedContract.contractValue.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="border-t border-slate-800 pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenewingContractId(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-sky-600/20"
              >
                Confirm Extension
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload Compliance Document Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Upload Compliance Document</h3>
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocSubmit} className="space-y-4">
              {!isVendor && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Vendor *</label>
                  <select
                    value={newDocVendorId}
                    onChange={(e) => setNewDocVendorId(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  >
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 Commercial General Liability Policy"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Category</label>
                <select
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value as any)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Insurance Certificate">Insurance Certificate</option>
                  <option value="W-9 / Tax ID">W-9 / Tax ID Verification</option>
                  <option value="Non-Disclosure Agreement">Non-Disclosure Agreement (NDA)</option>
                  <option value="Bank Verification">Bank Routing Verification</option>
                  <option value="ESG Report">ESG / Sustainability Audit Report</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">File Name</label>
                <input
                  type="text"
                  placeholder="e.g. general_liability_cert_2026.pdf"
                  value={newDocFileName}
                  onChange={(e) => setNewDocFileName(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
                >
                  <UploadCloud className="h-4 w-4" />
                  Submit File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
