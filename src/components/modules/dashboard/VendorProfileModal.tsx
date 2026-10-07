import React, { useState } from 'react';
import { X, Building2, User, Mail, Phone, MapPin, CreditCard, FileText, CheckCircle } from 'lucide-react';
import { Vendor } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface VendorProfileModalProps {
  vendor: Vendor;
  isOpen: boolean;
  onClose: () => void;
}

export const VendorProfileModal: React.FC<VendorProfileModalProps> = ({ vendor, isOpen, onClose }) => {
  const { updateVendor } = useApp();

  const [companyName, setCompanyName] = useState(vendor.name);
  const [primaryContactName, setPrimaryContactName] = useState(vendor.contact?.primaryContactName || '');
  const [title, setTitle] = useState(vendor.contact?.title || '');
  const [email, setEmail] = useState(vendor.contact?.email || '');
  const [phone, setPhone] = useState(vendor.contact?.phone || '');
  const [address, setAddress] = useState(vendor.contact?.address || '');
  const [city, setCity] = useState(vendor.contact?.city || '');
  const [country, setCountry] = useState(vendor.contact?.country || 'India');
  const [taxId, setTaxId] = useState(vendor.taxId || '');
  const [bankAccount, setBankAccount] = useState(vendor.bankAccount || '');
  const [notes, setNotes] = useState(vendor.notes || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateVendor(vendor.id, {
      name: companyName.trim(),
      taxId: taxId.trim(),
      bankAccount: bankAccount.trim(),
      notes: notes.trim(),
      contact: {
        ...vendor.contact,
        primaryContactName: primaryContactName.trim(),
        title: title.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
      },
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Vendor Profile & Credential Management</h3>
              <p className="text-xs text-slate-400">Partition: <span className="text-emerald-400 font-semibold">{vendor.category}</span> • ID: <span className="font-mono text-slate-300">{vendor.id}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold">Supplier profile updated successfully and synced across Enterprise ERP.</span>
            </div>
          )}

          {/* Company & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Registered Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Assigned Category Partition</label>
              <input
                type="text"
                value={vendor.category}
                disabled
                className="w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3.5 py-2 text-slate-400 cursor-not-allowed font-medium"
              />
            </div>
          </div>

          {/* Primary Representative */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-emerald-400" />
              Primary Authorized Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Contact Name</label>
                <input
                  type="text"
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Official Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" />
                  Direct Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  Primary Phone / Mobile
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Physical Address */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-400" />
              Corporate Headquarters & Shipping Terminal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className="block text-slate-400 text-[11px] mb-1">Street Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-400 text-[11px] mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Statutory Tax & Bank Settlement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Statutory Tax Identification / GSTIN / TIN
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                Settlement Bank Account / IFSC
              </label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Operational Notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Operational Terms & Profile Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Standard Net-30 invoicing, priority freight dispatch, ISO audit compliance..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-white font-bold transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <CheckCircle className="h-4 w-4" />
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
