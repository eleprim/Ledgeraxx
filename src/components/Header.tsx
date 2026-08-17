import React from 'react';
import { useAccounting } from '../context/AccountingContext';
import {
  Plus,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Receipt,
  FileText,
  BookOpen,
  Layers,
  LayoutDashboard,
  Users,
  Sparkles,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    company,
    activeView,
    setActiveView,
    openNewTransaction,
    isBooksInBalance,
    journalEntries,
    handleSeedDemoData,
    handleResetToCleanBooks,
    loading,
  } = useAccounting();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      {/* Top Banner / Brand & Primary Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Company info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-100">Ledger</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 font-mono font-medium">
                  In-Browser Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs font-medium">
                {company?.name || 'Company Books'}
              </p>
            </div>
          </div>

          {/* Center: Live Mathematical Balance Check Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs">
            {isBooksInBalance ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300 font-medium">Books in Balance</span>
                <span className="text-slate-500 font-mono">({journalEntries.length} entries)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300 font-medium">Balance Alert</span>
              </>
            )}
          </div>

          {/* Right Actions: Sample Data / Reset + Pinned Primary "+ New Transaction" Button */}
          <div className="flex items-center gap-2.5">
            <button
              id="btn-seed-sample-data"
              onClick={handleSeedDemoData}
              disabled={loading}
              title="Reload realistic sample business transactions"
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition font-medium cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Sample Books</span>
            </button>

            <button
              id="btn-reset-clean-books"
              onClick={() => {
                if (window.confirm('Reset books to a fresh empty chart of accounts?')) {
                  handleResetToCleanBooks();
                }
              }}
              title="Clear all transactions and reset to fresh chart of accounts"
              className="hidden lg:flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl bg-slate-800/50 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/50 transition cursor-pointer"
            >
              Reset
            </button>

            {/* High-visibility Primary Entry Point Button */}
            <button
              id="btn-primary-new-transaction"
              onClick={() => openNewTransaction('simple')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold text-sm shadow-md shadow-emerald-950/40 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>New Transaction</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="bg-slate-950/70 border-t border-slate-800/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto py-2 no-scrollbar" aria-label="Main Navigation">
            <button
              id="nav-dashboard"
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'dashboard'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Overview</span>
            </button>

            <button
              id="nav-statements"
              onClick={() => setActiveView('statements')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'statements'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Financial Statements</span>
            </button>

            <button
              id="nav-invoices"
              onClick={() => setActiveView('invoices')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'invoices'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>Invoices (A/R)</span>
            </button>

            <button
              id="nav-bills"
              onClick={() => setActiveView('bills')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'bills'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Bills (A/P)</span>
            </button>

            <button
              id="nav-journal"
              onClick={() => setActiveView('journal')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'journal'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>General Journal</span>
            </button>

            <button
              id="nav-ledger"
              onClick={() => setActiveView('ledger')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'ledger'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Account Ledgers</span>
            </button>

            <button
              id="nav-accounts"
              onClick={() => setActiveView('accounts')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'accounts'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Chart of Accounts</span>
            </button>

            <button
              id="nav-directory"
              onClick={() => setActiveView('directory')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeView === 'directory'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Customers & Vendors</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
