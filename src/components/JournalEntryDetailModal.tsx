import React from 'react';
import { useAccounting } from '../context/AccountingContext';
import { X, BookOpen, CheckCircle2, Link2, Calendar, User, Hash } from 'lucide-react';

export const JournalEntryDetailModal: React.FC = () => {
  const {
    selectedJournalEntry,
    setSelectedJournalEntry,
    setSelectedAccountIdForLedger,
    setActiveView,
  } = useAccounting();

  if (!selectedJournalEntry) return null;

  const totalDebits = selectedJournalEntry.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredits = selectedJournalEntry.lines.reduce((s, l) => s + (l.credit || 0), 0);

  const handleInspectLedger = (accountId: string) => {
    setSelectedAccountIdForLedger(accountId);
    setSelectedJournalEntry(null);
    setActiveView('ledger');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        id="modal-journal-entry-detail"
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Journal Entry {selectedJournalEntry.referenceNumber || selectedJournalEntry.id.slice(0, 8)}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                  {selectedJournalEntry.sourceType}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">{selectedJournalEntry.memo}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedJournalEntry(null)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata info strip */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>Date: <strong className="text-slate-200">{selectedJournalEntry.date}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Status: <strong className="text-emerald-400">Posted (Immutable)</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Hash className="h-3.5 w-3.5 text-slate-500" />
            <span>Doc ID: <strong className="text-slate-300 font-mono">{selectedJournalEntry.id.slice(0, 8)}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <User className="h-3.5 w-3.5 text-slate-500" />
            <span>Author: <strong className="text-slate-300 font-mono">System Engine</strong></span>
          </div>
        </div>

        {/* Multi-line table */}
        <div className="p-6">
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="py-2.5 px-3">Account Code &amp; Name</th>
                  <th className="py-2.5 px-3">Line Memo</th>
                  <th className="py-2.5 px-3 text-right">Debit ($)</th>
                  <th className="py-2.5 px-3 text-right">Credit ($)</th>
                  <th className="py-2.5 px-3 text-center">Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {selectedJournalEntry.lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50 transition">
                    <td className="py-2.5 px-3 text-slate-200">
                      <div className="font-sans font-medium text-slate-100">{line.accountName}</div>
                      {line.accountCode && (
                        <div className="text-[11px] text-slate-500">#{line.accountCode}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                      {line.memo || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-100">
                      {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-100">
                      {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleInspectLedger(line.accountId)}
                        title="View account ledger history"
                        className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition"
                      >
                        <Link2 className="h-3.5 w-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900/90 border-t border-slate-800 font-mono font-bold text-slate-100">
                  <td colSpan={2} className="py-2.5 px-3 font-sans text-right uppercase text-slate-400 text-[10px]">
                    Total Balance
                  </td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">${totalDebits.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">${totalCredits.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/60 text-xs">
          <span className="text-slate-400">
            Immutable Audit Trail — Guaranteed Atomic Firestore Batch Write
          </span>
          <button
            onClick={() => setSelectedJournalEntry(null)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
