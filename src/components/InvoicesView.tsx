import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Invoice, InvoiceStatus } from '../types';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';

export const InvoicesView: React.FC = () => {
  const {
    invoices,
    journalEntries,
    setPaymentTargetInvoice,
    openNewTransaction,
    setSelectedJournalEntry,
  } = useAccounting();

  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Summary Metrics
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
  const overdueInvoices = invoices.filter(i => {
    if (i.status === 'Paid') return false;
    const today = new Date().toISOString().split('T')[0];
    return i.dueDate < today;
  });
  const totalOverdue = overdueInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

  // Filtered list
  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    const matchesSearch = (inv.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleViewJournalEntry = (journalEntryId: string) => {
    const entry = journalEntries.find(je => je.id === journalEntryId);
    if (entry) {
      setSelectedJournalEntry(entry);
    }
  };

  const getStatusBadge = (status: InvoiceStatus, dueDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    const isPastDue = status !== 'Paid' && dueDate < today;

    if (status === 'Paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" /> Paid
        </span>
      );
    }
    if (isPastDue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          <AlertCircle className="h-3 w-3" /> Overdue
        </span>
      );
    }
    if (status === 'Partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <Clock className="h-3 w-3" /> Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
        <Clock className="h-3 w-3" /> Open
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-sky-400" />
            <h1 className="text-lg sm:text-xl font-bold text-slate-100">Accounts Receivable (Invoices)</h1>
          </div>
          <p className="text-xs text-slate-400">
            Track customer receivables, issue invoices, and record incoming cash payments with atomic subledger posting.
          </p>
        </div>

        <button
          onClick={() => openNewTransaction('simple')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-semibold transition"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>+ Create Invoice</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Invoiced</span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">${totalInvoiced.toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Collected Cash</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">${totalCollected.toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Outstanding A/R</span>
          <div className="text-xl font-bold font-mono text-sky-400 mt-1">${totalOutstanding.toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Overdue Amount</span>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">${totalOverdue.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Pill Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(['All', 'Open', 'Partial', 'Paid', 'Overdue'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === status
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search customer or invoice #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Receipt className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No invoices match the selected filter.</p>
            <button
              onClick={() => openNewTransaction('simple')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-semibold rounded-lg"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> Create First Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total ($)</th>
                  <th className="py-3 px-4 text-right">Balance Due ($)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-950/40 transition">
                    <td className="py-3 px-4 text-slate-200 font-bold">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-sans font-medium">
                      {inv.customerName || 'Direct Customer'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {inv.date}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-sans">
                      {inv.dueDate}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-100">
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-sky-400">
                      ${inv.balanceDue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {getStatusBadge(inv.status, inv.dueDate)}
                    </td>
                    <td className="py-3 px-4 text-right font-sans space-x-2">
                      {inv.balanceDue > 0.001 && (
                        <button
                          id={`btn-receive-payment-${inv.id}`}
                          onClick={() => setPaymentTargetInvoice(inv)}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded text-xs font-semibold shadow-sm transition"
                        >
                          Record Payment
                        </button>
                      )}
                      {inv.journalEntryId && (
                        <button
                          onClick={() => handleViewJournalEntry(inv.journalEntryId)}
                          title="View linked General Journal entry"
                          className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition inline-flex items-center"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
