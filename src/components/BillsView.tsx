import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Bill, BillStatus } from '../types';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

export const BillsView: React.FC = () => {
  const {
    bills,
    journalEntries,
    setPaymentTargetBill,
    openNewTransaction,
    setSelectedJournalEntry,
  } = useAccounting();

  const [statusFilter, setStatusFilter] = useState<'All' | BillStatus>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Summary Metrics
  const totalBilled = bills.reduce((s, b) => s + (b.total || 0), 0);
  const totalPaid = bills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const totalOutstanding = bills.reduce((s, b) => s + (b.balanceDue || 0), 0);
  const overdueBills = bills.filter((b) => {
    if (b.status === 'Paid') return false;
    const today = new Date().toISOString().split('T')[0];
    return b.dueDate < today;
  });
  const totalOverdue = overdueBills.reduce((s, b) => s + (b.balanceDue || 0), 0);

  // Filtered list
  const filteredBills = bills.filter((bill) => {
    const matchesStatus = statusFilter === 'All' || bill.status === statusFilter;
    const matchesSearch =
      (bill.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleViewJournalEntry = (journalEntryId: string) => {
    const entry = journalEntries.find((je) => je.id === journalEntryId);
    if (entry) {
      setSelectedJournalEntry(entry);
    }
  };

  const getStatusBadge = (status: BillStatus, dueDate: string) => {
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
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <Clock className="h-3 w-3" /> Open
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100">Accounts Payable (Bills)</h1>
          </div>
          <p className="text-xs text-slate-400">
            Track vendor obligations, manage payments, and settle liabilities with atomic cash &amp; AP subledger updates.
          </p>
        </div>

        <button
          id="btn-new-bill-tx"
          onClick={() => openNewTransaction('simple')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-semibold transition shadow-md shadow-amber-950/30 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Record New Expense / Bill</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Billed</span>
          <div className="text-2xl font-bold font-mono text-slate-100">${totalBilled.toFixed(2)}</div>
          <p className="text-xs text-slate-500">{bills.length} total bills</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Paid Out</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">${totalPaid.toFixed(2)}</div>
          <p className="text-xs text-slate-500">Settled disbursements</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Outstanding A/P</span>
          <div className="text-2xl font-bold font-mono text-amber-400">${totalOutstanding.toFixed(2)}</div>
          <p className="text-xs text-slate-500">Pending obligations</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Overdue A/P</span>
          <div className="text-2xl font-bold font-mono text-rose-400">${totalOverdue.toFixed(2)}</div>
          <p className="text-xs text-slate-500">{overdueBills.length} past due bills</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Open', 'Partial', 'Paid'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vendor or bill #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {filteredBills.length === 0 ? (
          <div className="text-center py-12 px-4">
            <FileText className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No bills found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Record a new expense on account or use Seed Sample Data to populate bills.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Bill #</th>
                  <th className="py-3.5 px-4 font-semibold">Vendor</th>
                  <th className="py-3.5 px-4 font-semibold">Bill Date</th>
                  <th className="py-3.5 px-4 font-semibold">Due Date</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Balance Due</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-100">{bill.billNumber}</td>
                    <td className="py-3 px-4 text-slate-200">{bill.vendorName || 'Vendor'}</td>
                    <td className="py-3 px-4 text-slate-400">{bill.date}</td>
                    <td className="py-3 px-4 text-slate-400">{bill.dueDate}</td>
                    <td className="py-3 px-4">{getStatusBadge(bill.status, bill.dueDate)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-200">
                      ${bill.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      ${bill.balanceDue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {bill.status !== 'Paid' && (
                          <button
                            id={`btn-pay-bill-${bill.id}`}
                            onClick={() => setPaymentTargetBill(bill)}
                            className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold transition cursor-pointer"
                          >
                            Pay Bill
                          </button>
                        )}
                        <button
                          onClick={() => handleViewJournalEntry(bill.journalEntryId)}
                          title="View Journal Posting"
                          className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
