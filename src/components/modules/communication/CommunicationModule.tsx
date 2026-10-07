import React, { useState } from 'react';
import { 
  MessageSquareQuote, 
  Send, 
  Paperclip, 
  Search, 
  CheckCheck, 
  Building2, 
  ShoppingCart, 
  Mail, 
  Phone,
  FileText
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Badge } from '../../common/Badge';

export const CommunicationModule: React.FC = () => {
  const { 
    messages, 
    sendMessage, 
    vendors, 
    purchaseOrders, 
    currentUser, 
    currentRole,
    currentVendorId 
  } = useApp();

  // If role is Vendor, scope to this vendor only. Otherwise, allow selecting vendor thread.
  const isVendorRole = currentRole === 'Vendor';
  const defaultThreadId = isVendorRole ? currentVendorId : (vendors[0]?.id || 'VND-001');

  const [activeThreadId, setActiveThreadId] = useState<string>(defaultThreadId);
  const [activePOFilter, setActivePOFilter] = useState<string>('All');
  const [messageInput, setMessageInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);

  const activeVendor = vendors.find(v => v.id === activeThreadId) || vendors[0];
  const threadPOs = purchaseOrders.filter(po => po.vendorId === activeThreadId);

  // Messages in current thread
  const threadMessages = messages.filter(m => {
    const matchesThread = m.threadId === activeThreadId;
    const matchesPO = activePOFilter === 'All' || m.linkedPOId === activePOFilter;
    return matchesThread && matchesPO;
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const isSenderVendor = currentRole === 'Vendor';

    sendMessage({
      threadId: activeThreadId,
      senderId: currentUser.id,
      senderName: isSenderVendor ? activeVendor.name : currentUser.name,
      senderRole: currentRole,
      recipientId: isSenderVendor ? 'USER-PROC' : activeVendor.id,
      recipientName: isSenderVendor ? 'Procurement Team' : activeVendor.contact.person,
      subject: activePOFilter !== 'All' ? `Regarding ${activePOFilter}` : 'Supplier Inquiry',
      content: messageInput,
      channel: 'In-App Message',
      linkedPOId: activePOFilter !== 'All' ? activePOFilter : undefined,
      attachments: attachedFile ? [{ name: attachedFile, url: '#', size: '240 KB' }] : undefined,
    });

    setMessageInput('');
    setAttachedFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Supplier Communication Hub</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time procurement messaging, purchase order clarifications, delivery status discussions, and file attachments.
          </p>
        </div>
      </div>

      {/* Messaging Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[560px] rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        {/* Left Sidebar: Supplier Threads List */}
        {!isVendorRole ? (
          <div className="border-r border-slate-800 p-4 space-y-3 bg-slate-950/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Active Supplier Threads
            </h3>

            <div className="space-y-1">
              {vendors.map((v) => {
                const count = messages.filter(m => m.threadId === v.id).length;
                const isActive = activeThreadId === v.id;

                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setActiveThreadId(v.id);
                      setActivePOFilter('All');
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start justify-between ${
                      isActive
                        ? 'bg-sky-600/20 border border-sky-500/40 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">{v.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{v.contact.person}</p>
                      <span className="text-[10px] text-slate-500 font-mono">{v.category}</span>
                    </div>
                    {count > 0 && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border-r border-slate-800 p-4 space-y-3 bg-slate-950/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Procurement Desk Channel
            </h3>
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/60 text-xs text-emerald-300">
              <span className="font-bold block mb-1">Direct Secure Line</span>
              Messages sent here are received directly by the Enterprise Procurement and Supply Chain managers.
            </div>
          </div>
        )}

        {/* Right Chat Area */}
        <div className="md:col-span-2 flex flex-col justify-between p-5 space-y-4">
          {/* Thread Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">{activeVendor.name}</h3>
              <p className="text-xs text-slate-400">
                Rep: <strong className="text-slate-200">{activeVendor.contact.person}</strong> ({activeVendor.contact.email})
              </p>
            </div>

            {/* Link to specific PO */}
            {threadPOs.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Order Topic:</span>
                <select
                  value={activePOFilter}
                  onChange={(e) => setActivePOFilter(e.target.value)}
                  className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-sky-400 font-mono focus:outline-none focus:border-sky-500"
                >
                  <option value="All">General Supplier Discussion</option>
                  {threadPOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.id} (₹{po.totalAmount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 space-y-4 max-h-[380px] overflow-y-auto pr-2">
            {threadMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No messages yet in this discussion thread. Start the conversation below.
              </div>
            ) : (
              threadMessages.map((msg) => {
                const isMine = msg.senderRole === currentRole;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">{msg.senderName}</span>
                      <span>•</span>
                      <span className="text-[10px]">{msg.senderRole}</span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-slate-500">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-md rounded-2xl p-3.5 text-xs ${
                        isMine
                          ? 'bg-sky-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                      }`}
                    >
                      {msg.linkedPOId && (
                        <div className="mb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-sky-200">
                          Ref: {msg.linkedPOId}
                        </div>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1.5 text-[11px]">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="underline">{msg.attachments[0].name}</span>
                          <span className="text-[10px] opacity-80">({msg.attachments[0].size})</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input Box */}
          <form onSubmit={handleSend} className="border-t border-slate-800 pt-4 space-y-2">
            {attachedFile && (
              <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 w-fit">
                <Paperclip className="h-3.5 w-3.5 text-sky-400" />
                <span className="text-slate-300">{attachedFile}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-slate-500 hover:text-rose-400 font-bold ml-1"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAttachedFile(`Specification_Sheet_${Date.now().toString().slice(-4)}.pdf`)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 p-2.5 text-slate-400 hover:text-white transition-colors border border-slate-700"
                title="Attach specification or contract document"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={`Type a message to ${activeVendor.name}...`}
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />

              <button
                type="submit"
                className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-xs font-bold text-white transition-colors flex items-center gap-1.5 shadow-md shadow-sky-600/20"
              >
                <span>Send</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
