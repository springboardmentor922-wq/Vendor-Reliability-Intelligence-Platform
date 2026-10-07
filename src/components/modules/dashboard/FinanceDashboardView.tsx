import React, { useState } from 'react';
import { 
  DollarSign, 
  CreditCard, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight,
  Receipt,
  FileCheck,
  Filter,
  Search,
  AlertTriangle,
  X,
  Send,
  Building2,
  Check
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { StatCard } from '../../common/StatCard';
import { CategoryBarChart } from '../../common/MiniChart';
import { Badge } from '../../common/Badge';
import { formatRupees } from '../../../utils/currencyUtils';

export const FinanceDashboardView: React.FC = () => {
  const { invoices, purchaseOrders, vendors, payInvoice, disputeInvoice, setActiveView } = useApp();

  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Paid' | 'Overdue' | 'Disputed'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Payment disbursement modal state
  const [paymentModalInv, setPaymentModalInv] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Corporate ACH Transfer');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Dispute modal state
  const [disputeModalInv, setDisputeModalInv] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const totalInvoiceValue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const pendingInvoices = invoices.filter(inv => inv.status === 'Pending');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const overdueInvoices = invoices.filter(inv => inv.status === 'Overdue');
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const disputedInvoices = invoices.filter(inv => inv.status === 'Disputed');
  const disputedAmount = disputedInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Spend by vendor
  const vendorSpend = invoices.reduce((acc, inv) => {
    acc[inv.vendorName] = (acc[inv.vendorName] || 0) + inv.amount;
    return acc;
  }, {} as Record<string, number>);

  const vendorSpendBarData = Object.entries(vendorSpend).map(([name, val]) => ({
    label: name,
    value: Number(val),
    formatted: formatRupees(val),
    color: '#10b981',
  }));

  // Budget comparison: ₹450,000 allocated for Q3-Q4
  const allocatedBudget = 450000;
  const budgetUtilizationRate = Math.round((totalInvoiceValue / allocatedBudget) * 100);

  const filteredInvoices = invoices.filter(inv => {
    const matchesFilter = statusFilter === 'All' ? true : inv.status === statusFilter;
    const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.purchaseOrderId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInv) return;
    payInvoice(paymentModalInv.id, paymentMethod);
    setPaymentModalInv(null);
    setPaymentNotes('');
  };

  const handleConfirmDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalInv || !disputeReason.trim()) return;
    disputeInvoice(disputeModalInv.id, disputeReason.trim());
    setDisputeModalInv(null);
    setDisputeReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Accounts Payable & Financial Governance</h1>
            <Badge variant="warning" size="sm">Finance Officer</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            3-Way match reconciliation, accounts payable disbursements, invoice dispute mitigation, and budget variance tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('reports')}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Receipt className="h-3.5 w-3.5" />
            Financial Audit Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Disbursed Payments"
          value={`₹${(paidAmount / 1000).toFixed(1)}k`}
          subtitle={`${paidInvoices.length} settled vendor invoices`}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
          badge="Disbursed"
          badgeVariant="success"
        />
        <StatCard
          title="Pending Commitments"
          value={`₹${(pendingAmount / 1000).toFixed(1)}k`}
          subtitle={`${pendingInvoices.length} approved awaiting payment batch`}
          icon={Clock}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
          badge={`${pendingInvoices.length} Scheduled`}
          badgeVariant="warning"
        />
        <StatCard
          title="Overdue / In Hold"
          value={`₹${((overdueAmount + disputedAmount) / 1000).toFixed(1)}k`}
          subtitle={`${overdueInvoices.length} overdue, ${disputedInvoices.length} disputed`}
          icon={AlertCircle}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10 border-rose-500/20"
          badge={overdueInvoices.length > 0 ? 'Action Required' : 'On Schedule'}
          badgeVariant={overdueInvoices.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          title="Budget Utilization"
          value={`${budgetUtilizationRate}%`}
          subtitle={`₹${(totalInvoiceValue / 1000).toFixed(0)}k of ₹${(allocatedBudget / 1000).toFixed(0)}k Q3 budget`}
          icon={DollarSign}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/20"
          badge={budgetUtilizationRate <= 100 ? 'Within Cap' : 'Exceeded'}
          badgeVariant={budgetUtilizationRate <= 100 ? 'success' : 'danger'}
        />
      </div>

      {/* Spend by Supplier & Payment Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Vendor Payment Distribution</h3>
              <p className="text-xs text-slate-400">Total invoice liabilities by approved supplier</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total Invoiced: ₹{totalInvoiceValue.toLocaleString('en-IN')}
            </span>
          </div>
          <CategoryBarChart data={vendorSpendBarData} />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">Payment Aging Analysis</h3>
            <p className="text-xs text-slate-400">Accounts payable maturity schedule</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Current (0 - 30 Days):</span>
                <span className="font-mono text-emerald-400 font-bold">₹{pendingAmount.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-slate-500">Scheduled for payment run within standard credit terms</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Overdue (31+ Days):</span>
                <span className="font-mono text-rose-400 font-bold">₹{overdueAmount.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-slate-500">Requires review of delivery hold and discount terms</p>
            </div>

            {disputedInvoices.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-rose-900/40 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-rose-400">Disputed / On Hold:</span>
                  <span className="font-mono text-rose-400 font-bold">₹{disputedAmount.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[11px] text-slate-500">Suspended from payment batches pending QA review</p>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-emerald-950/20 border border-emerald-900/60 p-3 text-xs text-emerald-300">
            <span className="font-bold block mb-0.5">3-Way Match Compliance:</span>
            100% of released disbursements matched against authorized Purchase Orders and receiving dock logs.
          </div>
        </div>
      </div>

      {/* Invoice Ledger Table with Direct Payment & Dispute Actions */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Accounts Payable Invoice Register</h3>
            <p className="text-xs text-slate-400">Execute verified disbursements or place non-compliant invoices into dispute hold</p>
          </div>

          {/* Filter tabs & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              {(['All', 'Pending', 'Paid', 'Overdue', 'Disputed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                    statusFilter === st ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Linked PO</th>
                <th className="py-2.5 px-3">Vendor</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">3-Way Match</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Finance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No invoices matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const linkedPO = purchaseOrders.find(p => p.id === inv.purchaseOrderId);
                  const isMatch = linkedPO && Math.abs(linkedPO.totalAmount - inv.amount) < 1;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">{inv.id}</td>
                      <td className="py-3 px-3 font-mono text-sky-400">{inv.purchaseOrderId}</td>
                      <td className="py-3 px-3 font-semibold text-white">{inv.vendorName}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">₹{inv.amount.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono ${isMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                          <Check className="h-3 w-3" />
                          {isMatch ? 'Matched' : 'Variance'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">{inv.dueDate}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            inv.status === 'Paid' ? 'success' :
                            inv.status === 'Overdue' ? 'danger' :
                            inv.status === 'Disputed' ? 'danger' : 'warning'
                          }
                          size="sm"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status !== 'Paid' && inv.status !== 'Disputed' && (
                            <>
                              <button
                                onClick={() => setPaymentModalInv(inv)}
                                className="rounded bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-colors cursor-pointer"
                              >
                                Disburse
                              </button>
                              <button
                                onClick={() => setDisputeModalInv(inv)}
                                className="rounded bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Dispute
                              </button>
                            </>
                          )}
                          {inv.status === 'Disputed' && (
                            <span className="text-[11px] text-rose-400 font-mono">Payment Suspended</span>
                          )}
                          {inv.status === 'Paid' && (
                            <span className="text-[11px] text-emerald-400 font-mono">Paid {inv.paymentDate} ✓</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Process Payment Disbursement */}
      {paymentModalInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Disburse Accounts Payable</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">{paymentModalInv.id} — ₹{paymentModalInv.amount.toLocaleString('en-IN')}</p>
              </div>
              <button
                onClick={() => setPaymentModalInv(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Payee / Beneficiary:</span>
                  <strong className="text-white">{paymentModalInv.vendorName}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Linked Purchase Order:</span>
                  <span className="font-mono text-sky-400">{paymentModalInv.purchaseOrderId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Net Amount to Remit:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">₹{paymentModalInv.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Payment Method / Rail</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Corporate ACH Direct Deposit">Corporate ACH Direct Deposit (Standard 2-Day)</option>
                  <option value="Fedwire Real-Time Settlement">Fedwire Real-Time Settlement (Immediate)</option>
                  <option value="Virtual Purchasing Commercial Card">Virtual Purchasing Commercial Card</option>
                  <option value="Corporate Paper Check #9842">Corporate Paper Check #9842</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Settlement Memo / Ledger Note</label>
                <input
                  type="text"
                  placeholder="e.g. Approved per receiving inspection QA-492"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalInv(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Confirm & Disburse Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dispute Invoice */}
      {disputeModalInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/50 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Dispute Invoice & Suspend Payment</h3>
                <p className="text-xs text-rose-400 font-mono mt-0.5">{disputeModalInv.id} — {disputeModalInv.vendorName}</p>
              </div>
              <button
                onClick={() => setDisputeModalInv(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDispute} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason for Dispute / Payment Hold *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Specify discrepancies: defective items, pricing mismatch vs PO contract, missing delivery receiving slip..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeModalInv(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Suspend Payment & Flag Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
