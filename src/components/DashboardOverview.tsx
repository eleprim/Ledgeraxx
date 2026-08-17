import React from 'react';
import { useAccounting } from '../context/AccountingContext';
import { generateBalanceSheet, generateIncomeStatement } from '../lib/financialStatements';
import {
  TrendingUp,
  Wallet,
  Receipt,
  FileText,
  Plus,
  Scale,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Calendar,
} from 'lucide-react';

export const DashboardOverview: React.FC = () => {
  const {
    accounts,
    journalEntries,
    invoices,
    bills,
    openNewTransaction,
    setActiveView,
    setSelectedJournalEntry,
    setPaymentTargetInvoice,
    setPaymentTargetBill,
    handleSeedDemoData,
    loading,
  } = useAccounting();

  // Compute live statements
  const incomeStmt = generateIncomeStatement(accounts, journalEntries);
  const balanceSheet = generateBalanceSheet(accounts, journalEntries);

  // Cash & Cash Equivalents
  const cashAccounts = accounts.filter(
    (a) => a.code === '1010' || a.code === '1020' || (a.type === 'Asset' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
  );
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Open A/R and A/P
  const openInvoices = invoices.filter((i) => i.status === 'Open' || i.status === 'Partial');
  const totalArBalance = openInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);

  const openBills = bills.filter((b) => b.status === 'Open' || b.status === 'Partial');
  const totalApBalance = openBills.reduce((sum, b) => sum + (b.balanceDue || 0), 0);

  const recentEntries = journalEntries.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Status Hero Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">Accounting Dashboard</h1>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Live Double-Entry Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Every transaction automatically posts balanced debits and credits across all ledgers and financial statements.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5">
          {journalEntries.length === 0 && (
            <button
              onClick={handleSeedDemoData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Populate Sample Books
            </button>
          )}

          <button
            id="dash-btn-sale-expense"
            onClick={() => openNewTransaction('simple')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-semibold transition shadow-sm"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Transaction
          </button>

          <button
            id="dash-btn-journal-entry"
            onClick={() => openNewTransaction('advanced')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition"
          >
            <Scale className="h-4 w-4 text-slate-400" />
            Journal Entry
          </button>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Income */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Net Income</span>
            <div className={`p-2 rounded-lg ${incomeStmt.netIncome >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono ${incomeStmt.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${incomeStmt.netIncome.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
              <span>Rev: ${incomeStmt.totalRevenue.toFixed(2)}</span>
              <span>Exp: ${incomeStmt.totalExpenses.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Total Cash & Bank */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Cash &amp; Bank Balance</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              ${totalCash.toFixed(2)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Operating bank + petty cash on hand
            </p>
          </div>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Accounts Receivable</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-sky-400">
              ${totalArBalance.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
              <span>{openInvoices.length} open invoice{openInvoices.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setActiveView('invoices')}
                className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5"
              >
                View A/R <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Accounts Payable */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Accounts Payable</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              ${totalApBalance.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
              <span>{openBills.length} open bill{openBills.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setActiveView('bills')}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-0.5"
              >
                View A/P <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health & Accounting Equation Check Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Scale className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-200">Fundamental Accounting Equation</h2>
              <p className="text-xs text-slate-400">Assets = Liabilities + Equity (including YTD Net Income)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {balanceSheet.isBalanced ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Perfectly Balanced ($0.00 Variance)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                <AlertCircle className="h-3.5 w-3.5" /> Variance: ${balanceSheet.balanceDifference.toFixed(2)}
              </span>
            )}
            <button
              onClick={() => setActiveView('statements')}
              className="text-xs text-slate-300 hover:text-emerald-400 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 transition"
            >
              Full Statements →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Total Assets</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              ${balanceSheet.totalAssets.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Total Liabilities</span>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
              ${balanceSheet.totalLiabilities.toFixed(2)}
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
            <span className="text-[11px] text-slate-400 uppercase font-medium">Total Equity</span>
            <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
              ${balanceSheet.totalEquity.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Open Invoices/Bills & Recent General Journal Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Outstanding Invoices & Bills Quick Action (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Outstanding Invoices (A/R) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-200">Open Invoices (A/R)</h3>
              </div>
              <button
                onClick={() => setActiveView('invoices')}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                All Invoices →
              </button>
            </div>

            {openInvoices.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No outstanding invoices due.</p>
            ) : (
              <div className="space-y-2.5">
                {openInvoices.slice(0, 4).map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{inv.customerName || 'Customer'}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        {inv.invoiceNumber} • Due {inv.dueDate}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="font-mono font-bold text-slate-100">${inv.balanceDue.toFixed(2)}</div>
                        <span className="text-[10px] text-amber-400">{inv.status}</span>
                      </div>
                      <button
                        onClick={() => setPaymentTargetInvoice(inv)}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-semibold text-[11px] transition"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outstanding Vendor Bills (A/P) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">Open Vendor Bills (A/P)</h3>
              </div>
              <button
                onClick={() => setActiveView('bills')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                All Bills →
              </button>
            </div>

            {openBills.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No outstanding vendor bills due.</p>
            ) : (
              <div className="space-y-2.5">
                {openBills.slice(0, 4).map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{bill.vendorName || 'Vendor'}</div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        {bill.billNumber} • Due {bill.dueDate}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="font-mono font-bold text-slate-100">${bill.balanceDue.toFixed(2)}</div>
                        <span className="text-[10px] text-amber-400">{bill.status}</span>
                      </div>
                      <button
                        onClick={() => setPaymentTargetBill(bill)}
                        className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-semibold text-[11px] transition"
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Recent Journal Entries Stream (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-200">Recent General Journal Entries</h3>
              <p className="text-xs text-slate-400">Click any entry to inspect debit/credit line breakdown</p>
            </div>
            <button
              onClick={() => setActiveView('journal')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Full Journal Log →
            </button>
          </div>

          {recentEntries.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Scale className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No journal transactions recorded yet.</p>
              <button
                onClick={() => openNewTransaction('simple')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-semibold rounded-lg"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> Record First Transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
              {recentEntries.map((je) => {
                const totalAmt = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
                return (
                  <div
                    key={je.id}
                    onClick={() => setSelectedJournalEntry(je)}
                    className="p-3.5 hover:bg-slate-900/70 transition cursor-pointer flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{je.memo}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {je.sourceType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {je.date}
                        </span>
                        <span className="font-mono">Ref: {je.referenceNumber || je.id.slice(0, 6)}</span>
                        <span>{je.lines.length} lines</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-100">${totalAmt.toFixed(2)}</div>
                      <span className="text-[10px] text-emerald-400 font-medium">Balanced ✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
