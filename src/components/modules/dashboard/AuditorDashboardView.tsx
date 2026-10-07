import React from 'react';
import { 
  FileCheck2, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  FileText, 
  History, 
  DownloadCloud,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { StatCard } from '../../common/StatCard';
import { ScoreGauge } from '../../common/MiniChart';
import { Badge } from '../../common/Badge';

export const AuditorDashboardView: React.FC = () => {
  const { 
    vendors, 
    certifications, 
    contracts, 
    vendorDocuments, 
    auditLogs, 
    verifyDocument,
    setActiveView 
  } = useApp();

  const validCerts = certifications.filter(c => c.status === 'Valid');
  const expiredCerts = certifications.filter(c => c.status === 'Expired');
  const expiringSoonCerts = certifications.filter(c => c.status === 'Expiring Soon');
  const unverifiedDocs = vendorDocuments.filter(d => !d.verified);

  const complianceRate = Math.round((validCerts.length / Math.max(1, certifications.length)) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-rose-950/40 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Compliance Audit & Governance Verification</h1>
            <Badge variant="danger" size="sm">Auditor Console</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Independent audit verification of vendor certifications, regulatory documentation, contract lifecycle integrity, and immutable audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('reports')}
            className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Compliance Audit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Audit Compliance Index"
          value={`${complianceRate}%`}
          subtitle={`${validCerts.length} verified valid standards`}
          icon={FileCheck2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
          badge={complianceRate >= 80 ? 'Passing' : 'Non-Compliant'}
          badgeVariant={complianceRate >= 80 ? 'success' : 'danger'}
        />
        <StatCard
          title="Certifications Expired"
          value={expiredCerts.length}
          subtitle="Mandatory audit exception flags"
          icon={ShieldAlert}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10 border-rose-500/20"
          badge={expiredCerts.length > 0 ? 'Violation' : 'Clear'}
          badgeVariant={expiredCerts.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          title="Expiring Within 30 Days"
          value={expiringSoonCerts.length}
          subtitle="Pending vendor submission"
          icon={AlertTriangle}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
          badge="Notice Issued"
          badgeVariant="warning"
        />
        <StatCard
          title="Unverified Documents"
          value={unverifiedDocs.length}
          subtitle="Awaiting auditor sign-off"
          icon={FileText}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/20"
          badge={`${unverifiedDocs.length} Pending`}
          badgeVariant="info"
        />
      </div>

      {/* Compliance Findings & Document Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance Radar */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Regulatory Assurance Score</h3>
            <p className="text-xs text-slate-400">Statutory and ISO compliance benchmark</p>
          </div>

          <ScoreGauge score={complianceRate} size={150} label="Governance Compliance Score" />

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Audited Contracts:</span>
              <span className="font-mono text-white font-bold">{contracts.length} active</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Verified Tax IDs:</span>
              <span className="font-mono text-emerald-400 font-bold">100% Verified</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Non-Compliance Findings:</span>
              <span className="font-mono text-rose-400 font-bold">{expiredCerts.length} active flags</span>
            </div>
          </div>
        </div>

        {/* Pending Document Verification Queue */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Submitted Vendor Documents Audit Queue</h3>
              <p className="text-xs text-slate-400">Review certificates, tax forms, and security audits</p>
            </div>
            <button
              onClick={() => setActiveView('contracts')}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
            >
              All Compliance Records →
            </button>
          </div>

          <div className="divide-y divide-slate-800">
            {vendorDocuments.map((doc) => (
              <div key={doc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{doc.title}</span>
                    <Badge variant={doc.verified ? 'success' : 'warning'} size="sm">
                      {doc.verified ? 'Verified' : 'Pending Verification'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Type: <span className="text-slate-300 font-medium">{doc.type}</span> • File: <span className="font-mono text-slate-300">{doc.fileName}</span> • Uploaded: {doc.uploadedAt}
                  </p>
                  {doc.verifiedBy && (
                    <p className="text-[10px] text-emerald-400 mt-0.5">
                      ✓ Verified by {doc.verifiedBy}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!doc.verified ? (
                    <button
                      onClick={() => verifyDocument(doc.id)}
                      className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
                    >
                      Verify & Sign Off
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">Signed & Archived</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Immutable Event Trail for Governance Audit</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{auditLogs.length} audit entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Entity Type</th>
                <th className="py-2.5 px-3">Entity ID</th>
                <th className="py-2.5 px-3">Performed By</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {auditLogs.slice(0, 10).map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-400">{log.timestamp}</td>
                  <td className="py-2.5 px-3 font-bold text-white">{log.action}</td>
                  <td className="py-2.5 px-3">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                      {log.entityType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-sky-400">{log.entityId}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-200">{log.userName}</span>
                    <span className="text-[10px] text-slate-500 block">{log.userRole}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
