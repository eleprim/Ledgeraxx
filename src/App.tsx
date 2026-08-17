import React from 'react';
import { AccountingProvider, useAccounting } from './context/AccountingContext';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { StatementsView } from './components/StatementsView';
import { InvoicesView } from './components/InvoicesView';
import { BillsView } from './components/BillsView';
import { JournalView } from './components/JournalView';
import { LedgerView } from './components/LedgerView';
import { AccountsView } from './components/AccountsView';
import { DirectoryView } from './components/DirectoryView';
import { TransactionModal } from './components/TransactionModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { PayBillModal } from './components/PayBillModal';
import { JournalEntryDetailModal } from './components/JournalEntryDetailModal';

const AppContent: React.FC = () => {
  const { activeView } = useAccounting();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeView === 'dashboard' && <DashboardOverview />}
        {activeView === 'statements' && <StatementsView />}
        {activeView === 'invoices' && <InvoicesView />}
        {activeView === 'bills' && <BillsView />}
        {activeView === 'journal' && <JournalView />}
        {activeView === 'ledger' && <LedgerView />}
        {activeView === 'accounts' && <AccountsView />}
        {activeView === 'directory' && <DirectoryView />}
      </main>

      {/* Global Modals for Atomic Double-Entry Actions */}
      <TransactionModal />
      <RecordPaymentModal />
      <PayBillModal />
      <JournalEntryDetailModal />
    </div>
  );
};

export default function App() {
  return (
    <AccountingProvider>
      <AppContent />
    </AccountingProvider>
  );
}
