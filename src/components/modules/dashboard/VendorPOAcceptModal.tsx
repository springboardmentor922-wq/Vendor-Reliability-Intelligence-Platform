import React, { useState } from 'react';
import { X, CheckCircle2, ShoppingCart, Calendar, MapPin, AlertCircle, FileCheck, Shield } from 'lucide-react';
import { PurchaseOrder } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { Badge } from '../../common/Badge';

interface VendorPOAcceptModalProps {
  po: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VendorPOAcceptModal: React.FC<VendorPOAcceptModalProps> = ({ po, isOpen, onClose }) => {
  const { acceptPurchaseOrderByVendor } = useApp();
  const [acceptanceNotes, setAcceptanceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  if (!isOpen || !po) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    acceptPurchaseOrderByVendor(
      po.id, 
      acceptanceNotes.trim() || 'Vendor formal acceptance acknowledged. Production and dispatch initiated.'
    );
    setIsSubmitting(false);
    setConfirmedSuccess(true);
    setTimeout(() => {
      setConfirmedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-sky-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Purchase Order Review & Acceptance</h3>
                <Badge variant="warning" size="sm">Awaiting Your Approval</Badge>
              </div>
              <p className="text-xs text-slate-400">
                Order <span className="font-mono text-sky-400 font-bold">{po.id}</span> issued for <span className="text-white font-semibold">{po.vendorName}</span> ({po.vendorCategory})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-6 overflow-y-auto space-y-5 text-xs">
          {confirmedSuccess ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
              <h4 className="text-sm font-bold text-white">Purchase Order Confirmed & Proceeded!</h4>
              <p className="text-xs text-slate-300">
                Your acceptance has been formally registered. Procurement has been notified to proceed with order fulfillment.
              </p>
            </div>
          ) : (
            <>
              {/* Order Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Grand Total Amount</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    ₹{po.totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    Target Delivery ETA
                  </span>
                  <span className="text-sm font-bold text-white">
                    {po.expectedDeliveryDate}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Created By</span>
                  <span className="text-sm font-bold text-white">
                    {po.createdBy} (Procurement)
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-sky-400" />
                  Order Requisition Line Items ({po.items.length})
                </h4>
                <div className="divide-y divide-slate-800/80">
                  {po.items.map((item, idx) => (
                    <div key={item.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.description}</p>
                        <p className="text-[11px] text-slate-400">
                          Qty: <span className="font-mono text-slate-300 font-bold">{item.quantity}</span> • Unit Price: ₹{item.unitPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-slate-200">
                        ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Notes & Terms */}
              {po.notes && (
                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-1">
                  <span className="font-semibold text-slate-300">Procurement Requisition Notes:</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{po.notes}</p>
                </div>
              )}

              {/* Supplier Acceptance Note */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-300">
                  Supplier Confirmation Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={acceptanceNotes}
                  onChange={(e) => setAcceptanceNotes(e.target.value)}
                  placeholder="e.g. Order approved. Raw material allocation confirmed; batch delivery planned for dispatch on schedule."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white focus:outline-none focus:border-emerald-500 resize-none text-xs"
                />
              </div>

              {/* Legal Confirmation Notice */}
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-300 flex items-start gap-2">
                <Shield className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                <p>
                  By confirming this purchase order, your company formally accepts the requisition terms, delivery schedule, and pricing agreement under your category Master Service Agreement.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-2.5 text-white font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept & Confirm Purchase Order
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
