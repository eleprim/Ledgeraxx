import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { JournalEntry, JournalSourceType } from '../types';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Scale,
  Calendar,
  Layers,
} from 'lucide-react';

export const JournalView: React.FC = () => {
  const {
    journalEntries,
    accounts,
    openNewTransaction,
    setSelectedJournalEntry,
    setSelectedAccountIdForLedger,
    setActiveView,
  } = useAccounting();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'All' | JournalSourceType>('All');

  // Compute summary totals
  let totalDebits = 0;
  let totalCredits = 0;
  journalEntries.forEach((je) => {
    je.lines.forEach((l) => {
      totalDebits += l.debit || 0;
      totalCredits += l.credit || 0;
    });
  });

  const filteredEntries = journalEntries.filter((entry) => {
    const matchesSource = sourceFilter === 'All' || entry.sourceType === sourceFilter;
    const matchesSearch =
      (entry.memo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.lines.some(
        (l) =>
          (l.accountName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (l.accountCode || '').includes(searchTerm)
      );
    return matchesSource && matchesSearch;
  });

  const getSourceBadge = (source: JournalSourceType) => {
    switch (source) {
      case 'Sale':
      case 'Invoice':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'Expense':
      case 'Bill':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Payment':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Manual':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'InitialBalance':
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const handleAccountClick = (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    setSelectedAccountIdForLedger(accountId);
    setActiveView('ledger');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100">General Journal</h1>
          </div>
          <p className="text-xs text-slate-400">
            Chronological audit log of all double-entry journal transactions. Every entry strictly maintains Debits = Credits.
          </p>
        </div>

        <button
          id="btn-journal-new-tx"
          onClick={() => openNewTransaction('advanced')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs sm:text-sm font-semibold transition shadow-md shadow-purple-950/30 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Journal Entry</span>
        </button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Entries</span>
          <div className="text-2xl font-bold font-mono text-slate-100">{journalEntries.length}</div>
          <p className="text-xs text-slate-500">Atomic journal records</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Debits</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">${totalDebits.toFixed(2)}</div>
          <p className="text-xs text-slate-500">All-time posted debits</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Credits</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">${totalCredits.toFixed(2)}</div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Debits = Credits Balanced
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['All', 'Sale', 'Expense', 'Invoice', 'Bill', 'Payment', 'Manual'] as const).map((src) => (
            <button
              key={src}
              onClick={() => setSourceFilter(src as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                sourceFilter === src
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search memo, ref, or account..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Journal Entries List */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <BookOpen className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No journal entries found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create a new transaction or seed sample data to generate journal entries.
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const entryDebits = entry.lines.reduce((s, l) => s + (l.debit || 0), 0);
            const entryCredits = entry.lines.reduce((s, l) => s + (l.credit || 0), 0);

            return (
              <div
                key={entry.id}
                onClick={() => setSelectedJournalEntry(entry)}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:border-slate-700 transition cursor-pointer"
              >
                {/* Entry Header */}
                <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-200">
                      {entry.referenceNumber || `JE-${entry.id.slice(0, 6)}`}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSourceBadge(entry.sourceType)}`}>
                      {entry.sourceType}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3 text-slate-500" />
                      {entry.date}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 truncate max-w-xs">{entry.memo}</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      ${entryDebits.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Lines Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/30 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800/40">
                      <tr>
                        <th className="py-2 px-5 font-semibold">Account</th>
                        <th className="py-2 px-5 font-semibold">Description</th>
                        <th className="py-2 px-5 font-semibold text-right">Debit</th>
                        <th className="py-2 px-5 font-semibold text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 font-medium">
                      {entry.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          <td className="py-2 px-5">
                            <button
                              onClick={(e) => handleAccountClick(e, line.accountId)}
                              className="text-left hover:text-emerald-400 transition group flex items-center gap-1.5"
                            >
                              <span className="font-mono text-slate-400 group-hover:text-emerald-400">
                                {line.accountCode}
                              </span>
                              <span className="text-slate-200 group-hover:text-emerald-300">
                                {line.accountName}
                              </span>
                            </button>
                          </td>
                          <td className="py-2 px-5 text-slate-400 text-xs">
                            {line.description || entry.memo}
                          </td>
                          <td className="py-2 px-5 text-right font-mono text-slate-200">
                            {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2 px-5 text-right font-mono text-slate-200">
                            {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
