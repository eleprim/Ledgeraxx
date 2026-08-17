import React, { useState, useMemo } from 'react';
import { useAccounting } from '../context/AccountingContext';
import {
  Layers,
  Search,
  BookOpen,
  Calendar,
  ArrowRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';

export const LedgerView: React.FC = () => {
  const {
    accounts,
    journalEntries,
    selectedAccountIdForLedger,
    setSelectedAccountIdForLedger,
    setSelectedJournalEntry,
  } = useAccounting();

  // Selected Account (fallback to first asset account or selected)
  const activeAccountId = selectedAccountIdForLedger || accounts[0]?.id || '';
  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  const [searchAccountTerm, setSearchAccountTerm] = useState<string>('');

  // Filter accounts for left selector sidebar
  const filteredAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(searchAccountTerm.toLowerCase()) ||
      a.code.includes(searchAccountTerm) ||
      a.type.toLowerCase().includes(searchAccountTerm.toLowerCase())
  );

  // Compute ledger lines with running balance for active account
  const ledgerTransactions = useMemo(() => {
    if (!activeAccount) return [];

    // Chronological order (oldest to newest for running balance)
    const sortedEntries = [...journalEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const isDebitNormal = activeAccount.normalBalance.toLowerCase() === 'debit';
    let runningBal = 0;

    const rows: Array<{
      journalEntryId: string;
      referenceNumber?: string;
      sourceType: string;
      date: string;
      memo: string;
      lineDescription?: string;
      debit: number;
      credit: number;
      runningBalance: number;
      rawEntry: any;
    }> = [];

    for (const entry of sortedEntries) {
      for (const line of entry.lines) {
        if (line.accountId === activeAccount.id || line.accountCode === activeAccount.code) {
          const debit = line.debit || 0;
          const credit = line.credit || 0;

          if (isDebitNormal) {
            runningBal += debit - credit;
          } else {
            runningBal += credit - debit;
          }

          rows.push({
            journalEntryId: entry.id,
            referenceNumber: entry.referenceNumber,
            sourceType: entry.sourceType,
            date: entry.date,
            memo: entry.memo,
            lineDescription: line.description,
            debit,
            credit,
            runningBalance: runningBal,
            rawEntry: entry,
          });
        }
      }
    }

    // Display newest first in ledger table
    return rows.reverse();
  }, [activeAccount, journalEntries]);

  const totalDebits = ledgerTransactions.reduce((s, r) => s + r.debit, 0);
  const totalCredits = ledgerTransactions.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100">Account Ledgers (Subledgers)</h1>
          </div>
          <p className="text-xs text-slate-400">
            View detailed individual ledger activity and audit-trail running balances for every account in the chart.
          </p>
        </div>
      </div>

      {/* Main Split Layout: Left Account Navigator / Right Ledger Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="relative mb-3">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter accounts..."
                value={searchAccountTerm}
                onChange={(e) => setSearchAccountTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
              {filteredAccounts.map((acc) => {
                const isSelected = acc.id === activeAccountId;
                return (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccountIdForLedger(acc.id)}
                    className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                        : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          {acc.code}
                        </span>
                        <span className="text-xs font-semibold truncate text-slate-200">
                          {acc.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{acc.type} ({acc.normalBalance} Normal)</span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        ${acc.balance.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ledger Details & Transactions (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {activeAccount ? (
            <>
              {/* Account Summary Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-emerald-400">
                        {activeAccount.code}
                      </span>
                      <h2 className="text-lg font-bold text-slate-100">{activeAccount.name}</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeAccount.description || `${activeAccount.type} account with ${activeAccount.normalBalance} normal balance`}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 uppercase font-medium">Live Ledger Balance</span>
                    <div className="text-2xl font-bold font-mono text-emerald-400">
                      ${activeAccount.balance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Substats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase">Account Type</span>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{activeAccount.type}</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase">Total Debits</span>
                    <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">${totalDebits.toFixed(2)}</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase">Total Credits</span>
                    <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">${totalCredits.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Ledger Activity Stream ({ledgerTransactions.length} postings)</span>
                  <span className="text-slate-500 font-normal text-[11px]">Click row to inspect Journal Entry</span>
                </div>

                {ledgerTransactions.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <BookOpen className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No transactions recorded for this account yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/40 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800/60">
                        <tr>
                          <th className="py-3 px-4 font-semibold">Date</th>
                          <th className="py-3 px-4 font-semibold">Ref / Source</th>
                          <th className="py-3 px-4 font-semibold">Description / Memo</th>
                          <th className="py-3 px-4 font-semibold text-right">Debit</th>
                          <th className="py-3 px-4 font-semibold text-right">Credit</th>
                          <th className="py-3 px-4 font-semibold text-right">Running Bal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40 font-medium">
                        {ledgerTransactions.map((tx, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedJournalEntry(tx.rawEntry)}
                            className="hover:bg-slate-800/30 transition cursor-pointer"
                          >
                            <td className="py-2.5 px-4 font-mono text-slate-400">{tx.date}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-200">
                                  {tx.referenceNumber || 'JE'}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  {tx.sourceType}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-300 max-w-xs truncate">
                              {tx.lineDescription || tx.memo}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-200">
                              {tx.debit > 0 ? `$${tx.debit.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-200">
                              {tx.credit > 0 ? `$${tx.credit.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400">
                              ${tx.runningBalance.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              Select an account from the left list to inspect its ledger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
