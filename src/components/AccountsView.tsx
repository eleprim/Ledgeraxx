import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Account, AccountType, NormalBalance } from '../types';
import {
  Scale,
  Plus,
  Search,
  CheckCircle2,
  ExternalLink,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const AccountsView: React.FC = () => {
  const {
    accounts,
    addNewAccount,
    setSelectedAccountIdForLedger,
    setActiveView,
  } = useAccounting();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'All' | AccountType>('All');

  // New Account Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<AccountType>('Expense');
  const [newSubtype, setNewSubtype] = useState<string>('Operating');
  const [newDescription, setNewDescription] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const getNormalBalanceForType = (type: AccountType): NormalBalance => {
    switch (type) {
      case 'Asset':
      case 'Expense':
        return 'debit';
      case 'Liability':
      case 'Equity':
      case 'Revenue':
        return 'credit';
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    setSaving(true);
    try {
      await addNewAccount({
        code: newCode.trim(),
        name: newName.trim(),
        type: newType,
        subtype: newSubtype,
        normalBalance: getNormalBalanceForType(newType),
        description: newDescription.trim(),
      });
      setShowAddModal(false);
      setNewCode('');
      setNewName('');
      setNewDescription('');
    } catch (err) {
      console.error('Failed to create account:', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesType = typeFilter === 'All' || acc.type === typeFilter;
    const matchesSearch =
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.code.includes(searchTerm) ||
      acc.subtype.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Group accounts by major classification
  const assetAccounts = filteredAccounts.filter((a) => a.type === 'Asset');
  const liabilityAccounts = filteredAccounts.filter((a) => a.type === 'Liability');
  const equityAccounts = filteredAccounts.filter((a) => a.type === 'Equity');
  const revenueAccounts = filteredAccounts.filter((a) => a.type === 'Revenue');
  const expenseAccounts = filteredAccounts.filter((a) => a.type === 'Expense');

  const handleInspect = (accId: string) => {
    setSelectedAccountIdForLedger(accId);
    setActiveView('ledger');
  };

  const renderTableSection = (title: string, list: Account[], badgeColor: string) => {
    if (list.length === 0) return null;

    const groupTotal = list.reduce((sum, a) => sum + a.balance, 0);

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm space-y-0">
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
              {title}
            </span>
            <span className="text-xs text-slate-400 font-medium">({list.length} accounts)</span>
          </div>
          <div className="text-xs font-mono font-bold text-slate-200">
            Section Balance: ${groupTotal.toFixed(2)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/30 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800/50">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Code</th>
                <th className="py-2.5 px-4 font-semibold">Account Name</th>
                <th className="py-2.5 px-4 font-semibold">Subtype</th>
                <th className="py-2.5 px-4 font-semibold">Normal Balance</th>
                <th className="py-2.5 px-4 font-semibold text-right">Live Balance</th>
                <th className="py-2.5 px-4 font-semibold text-right">Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-medium">
              {list.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-200">{acc.code}</td>
                  <td className="py-2.5 px-4 text-slate-200">
                    <div>{acc.name}</div>
                    {acc.description && (
                      <div className="text-[10px] text-slate-500">{acc.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">{acc.subtype}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {acc.normalBalance}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-100">
                    ${acc.balance.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => handleInspect(acc.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition"
                      title="Inspect Subledger"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Scale className="h-5 w-5" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100">Chart of Accounts</h1>
          </div>
          <p className="text-xs text-slate-400">
            Standard general ledger accounting structure with predefined Asset, Liability, Equity, Revenue, and Expense codes.
          </p>
        </div>

        <button
          id="btn-add-account"
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-semibold transition shadow-md shadow-emerald-950/30 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add Custom Account</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => setTypeFilter(tp as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                typeFilter === tp
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
              }`}
            >
              {tp}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search code, name, subtype..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Grouped Account Tables */}
      <div className="space-y-6">
        {renderTableSection('Assets (1000 - 1999)', assetAccounts, 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30')}
        {renderTableSection('Liabilities (2000 - 2999)', liabilityAccounts, 'bg-amber-500/10 text-amber-400 border border-amber-500/30')}
        {renderTableSection('Equity (3000 - 3999)', equityAccounts, 'bg-sky-500/10 text-sky-400 border border-sky-500/30')}
        {renderTableSection('Revenue (4000 - 4999)', revenueAccounts, 'bg-teal-500/10 text-teal-400 border border-teal-500/30')}
        {renderTableSection('Expenses & COGS (5000 - 6999)', expenseAccounts, 'bg-rose-500/10 text-rose-400 border border-rose-500/30')}
      </div>

      {/* Add Custom Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-100">Add Account to Chart</h2>
            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Account Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6150"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software Subscriptions"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Classification Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Asset">Asset (Debit Normal)</option>
                  <option value="Liability">Liability (Credit Normal)</option>
                  <option value="Equity">Equity (Credit Normal)</option>
                  <option value="Revenue">Revenue (Credit Normal)</option>
                  <option value="Expense">Expense (Debit Normal)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Subtype / Category</label>
                <input
                  type="text"
                  placeholder="e.g. Operating Expenses"
                  value={newSubtype}
                  onChange={(e) => setNewSubtype(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Notes about when to use this account..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
