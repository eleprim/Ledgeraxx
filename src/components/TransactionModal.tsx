import React, { useState, useEffect } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { executeAtomicPosting, round2, validateBalance } from '../lib/postingEngine';
import { JournalEntryLine, Account } from '../types';
import {
  X,
  Plus,
  Trash2,
  ArrowRightLeft,
  DollarSign,
  Calendar,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileText,
  HelpCircle,
} from 'lucide-react';

export const TransactionModal: React.FC = () => {
  const {
    user,
    companyId,
    accounts,
    customers,
    vendors,
    isTransactionModalOpen,
    setIsTransactionModalOpen,
    transactionModalInitialMode,
    addNewCustomer,
    addNewVendor,
  } = useAccounting();

  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // PATH A: Simple Mode State
  const [txType, setTxType] = useState<'sale' | 'expense'>('sale');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'paid_now' | 'on_account'>('paid_now');
  const [paidNowAccountId, setPaidNowAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [taxAmount, setTaxAmount] = useState<string>('0');
  const [memo, setMemo] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [itemDescription, setItemDescription] = useState<string>('');

  // Inline Customer / Vendor creation state
  const [showAddContact, setShowAddContact] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactEmail, setNewContactEmail] = useState<string>('');

  // PATH B: Advanced Manual Journal Entry State
  const [jeDate, setJeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [jeMemo, setJeMemo] = useState<string>('');
  const [jeReference, setJeReference] = useState<string>(`JE-${Date.now().toString().slice(-4)}`);
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
    { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
  ]);

  // Set default initial values when modal opens
  useEffect(() => {
    if (isTransactionModalOpen) {
      setMode(transactionModalInitialMode);
      setError(null);

      // Default revenue or expense account
      const revAcc = accounts.find(a => a.type === 'Revenue' && a.code === '4010') || accounts.find(a => a.type === 'Revenue');
      const expAcc = accounts.find(a => a.type === 'Expense' && a.code === '6040') || accounts.find(a => a.type === 'Expense');
      const bankAcc = accounts.find(a => a.code === '1020') || accounts.find(a => a.code === '1010') || accounts.find(a => a.type === 'Asset');

      if (txType === 'sale' && revAcc) setCategoryId(revAcc.id);
      if (txType === 'expense' && expAcc) setCategoryId(expAcc.id);
      if (bankAcc) setPaidNowAccountId(bankAcc.id);

      if (customers.length > 0 && !customerId) setCustomerId(customers[0].id);
      if (vendors.length > 0 && !vendorId) setVendorId(vendors[0].id);
    }
  }, [isTransactionModalOpen, transactionModalInitialMode, accounts, customers, vendors, txType]);

  // Handle Simple Type switch
  const handleTxTypeChange = (newType: 'sale' | 'expense') => {
    setTxType(newType);
    if (newType === 'sale') {
      const revAcc = accounts.find(a => a.type === 'Revenue' && a.code === '4010') || accounts.find(a => a.type === 'Revenue');
      if (revAcc) setCategoryId(revAcc.id);
      if (customers.length > 0 && !customerId) setCustomerId(customers[0].id);
    } else {
      const expAcc = accounts.find(a => a.type === 'Expense' && a.code === '6040') || accounts.find(a => a.type === 'Expense');
      if (expAcc) setCategoryId(expAcc.id);
      if (vendors.length > 0 && !vendorId) setVendorId(vendors[0].id);
    }
  };

  // Inline contact creator
  const handleCreateContact = async () => {
    if (!newContactName.trim()) return;
    try {
      if (txType === 'sale') {
        const created = await addNewCustomer(newContactName.trim(), newContactEmail.trim());
        setCustomerId(created.id);
      } else {
        const created = await addNewVendor(newContactName.trim(), newContactEmail.trim());
        setVendorId(created.id);
      }
      setNewContactName('');
      setNewContactEmail('');
      setShowAddContact(false);
    } catch (e) {
      console.error('Error creating contact:', e);
    }
  };

  // PATH B Line Helpers
  const handleLineChange = (index: number, field: keyof JournalEntryLine, value: any) => {
    const updated = [...lines];
    if (field === 'accountId') {
      const acc = accounts.find(a => a.id === value);
      updated[index] = {
        ...updated[index],
        accountId: value,
        accountName: acc?.name || '',
        accountCode: acc?.code || '',
      };
    } else if (field === 'debit' || field === 'credit') {
      const numVal = parseFloat(value) || 0;
      updated[index] = {
        ...updated[index],
        [field]: numVal,
      };
      // If user typed into debit, zero out credit and vice versa
      if (field === 'debit' && numVal > 0) updated[index].credit = 0;
      if (field === 'credit' && numVal > 0) updated[index].debit = 0;
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
    }
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  // Compute live validation for Path B
  const { isBalanced, totalDebits, totalCredits, diff } = validateBalance(lines);

  // Compute live preview for Path A
  const numericAmount = parseFloat(amount) || 0;
  const numericTax = parseFloat(taxAmount) || 0;
  const totalTransactionAmount = round2(numericAmount + numericTax);

  const selectedCategoryAccount = accounts.find(a => a.id === categoryId);
  const selectedCashAccount = accounts.find(a => a.id === paidNowAccountId) || accounts.find(a => a.code === '1020');
  const arAccount = accounts.find(a => a.code === '1200') || accounts.find(a => a.type === 'Asset' && a.name.toLowerCase().includes('receivable'));
  const apAccount = accounts.find(a => a.code === '2010') || accounts.find(a => a.type === 'Liability' && a.name.toLowerCase().includes('payable'));
  const taxAccount = accounts.find(a => a.code === '2200') || accounts.find(a => a.type === 'Liability' && a.name.toLowerCase().includes('tax'));

  // Build Preview Lines for Simple Mode
  let previewLines: { account: string; debit: number; credit: number }[] = [];
  if (totalTransactionAmount > 0) {
    if (txType === 'sale') {
      if (paymentMethod === 'paid_now') {
        previewLines.push({ account: selectedCashAccount?.name || 'Cash/Bank', debit: totalTransactionAmount, credit: 0 });
        previewLines.push({ account: selectedCategoryAccount?.name || 'Sales Revenue', debit: 0, credit: numericAmount });
        if (numericTax > 0) {
          previewLines.push({ account: taxAccount?.name || 'Sales Taxes Payable', debit: 0, credit: numericTax });
        }
      } else {
        previewLines.push({ account: arAccount?.name || 'Accounts Receivable', debit: totalTransactionAmount, credit: 0 });
        previewLines.push({ account: selectedCategoryAccount?.name || 'Sales Revenue', debit: 0, credit: numericAmount });
        if (numericTax > 0) {
          previewLines.push({ account: taxAccount?.name || 'Sales Taxes Payable', debit: 0, credit: numericTax });
        }
      }
    } else {
      // Expense
      if (paymentMethod === 'paid_now') {
        previewLines.push({ account: selectedCategoryAccount?.name || 'Expense Account', debit: numericAmount, credit: 0 });
        if (numericTax > 0) {
          previewLines.push({ account: taxAccount?.name || 'Sales Taxes Payable', debit: numericTax, credit: 0 });
        }
        previewLines.push({ account: selectedCashAccount?.name || 'Cash/Bank', debit: 0, credit: totalTransactionAmount });
      } else {
        previewLines.push({ account: selectedCategoryAccount?.name || 'Expense Account', debit: numericAmount, credit: 0 });
        if (numericTax > 0) {
          previewLines.push({ account: taxAccount?.name || 'Sales Taxes Payable', debit: numericTax, credit: 0 });
        }
        previewLines.push({ account: apAccount?.name || 'Accounts Payable', debit: 0, credit: totalTransactionAmount });
      }
    }
  }

  // Handle Path A Submit
  const handleSimpleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalTransactionAmount <= 0) {
      setError('Please enter a valid transaction amount greater than 0.');
      return;
    }
    if (!selectedCategoryAccount) {
      setError('Please select a category account.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const generatedLines: JournalEntryLine[] = [];
      const memoText = memo.trim() || (txType === 'sale' ? `Sale - ${selectedCategoryAccount.name}` : `Expense - ${selectedCategoryAccount.name}`);

      if (txType === 'sale') {
        if (paymentMethod === 'paid_now') {
          if (!selectedCashAccount) throw new Error('Cash/Bank account not found.');
          generatedLines.push({
            accountId: selectedCashAccount.id,
            accountName: selectedCashAccount.name,
            accountCode: selectedCashAccount.code,
            debit: totalTransactionAmount,
            credit: 0,
            memo: memoText,
          });
          generatedLines.push({
            accountId: selectedCategoryAccount.id,
            accountName: selectedCategoryAccount.name,
            accountCode: selectedCategoryAccount.code,
            debit: 0,
            credit: numericAmount,
            memo: memoText,
          });
          if (numericTax > 0 && taxAccount) {
            generatedLines.push({
              accountId: taxAccount.id,
              accountName: taxAccount.name,
              accountCode: taxAccount.code,
              debit: 0,
              credit: numericTax,
              memo: 'Sales tax collected',
            });
          }

          await executeAtomicPosting({
            companyId,
            userId: user?.uid || 'anonymous',
            date,
            memo: memoText,
            sourceType: 'Sale',
            referenceNumber: `SALE-${Date.now().toString().slice(-5)}`,
            lines: generatedLines,
            allAccounts: accounts,
          });
        } else {
          // On Account -> Create Invoice
          if (!arAccount) throw new Error('Accounts Receivable account not found.');
          const customerObj = customers.find(c => c.id === customerId);
          const invoiceNum = `INV-${Date.now().toString().slice(-4)}`;

          generatedLines.push({
            accountId: arAccount.id,
            accountName: arAccount.name,
            accountCode: arAccount.code,
            debit: totalTransactionAmount,
            credit: 0,
            memo: `Invoice ${invoiceNum} for ${customerObj?.name || 'Customer'}`,
          });
          generatedLines.push({
            accountId: selectedCategoryAccount.id,
            accountName: selectedCategoryAccount.name,
            accountCode: selectedCategoryAccount.code,
            debit: 0,
            credit: numericAmount,
            memo: memoText,
          });
          if (numericTax > 0 && taxAccount) {
            generatedLines.push({
              accountId: taxAccount.id,
              accountName: taxAccount.name,
              accountCode: taxAccount.code,
              debit: 0,
              credit: numericTax,
              memo: 'Sales tax on invoice',
            });
          }

          await executeAtomicPosting({
            companyId,
            userId: user?.uid || 'anonymous',
            date,
            memo: memoText,
            sourceType: 'Sale',
            referenceNumber: invoiceNum,
            lines: generatedLines,
            allAccounts: accounts,
            invoiceData: {
              customerId: customerId || 'general-customer',
              customerName: customerObj?.name || 'Direct Customer',
              invoiceNumber: invoiceNum,
              date,
              dueDate,
              lineItems: [
                {
                  description: itemDescription.trim() || selectedCategoryAccount.name,
                  qty: 1,
                  unitPrice: numericAmount,
                  amount: numericAmount,
                },
              ],
              subtotal: numericAmount,
              tax: numericTax,
              total: totalTransactionAmount,
              amountPaid: 0,
              balanceDue: totalTransactionAmount,
              status: 'Open',
              notes: memo.trim(),
            },
          });
        }
      } else {
        // Expense
        if (paymentMethod === 'paid_now') {
          if (!selectedCashAccount) throw new Error('Cash/Bank account not found.');
          generatedLines.push({
            accountId: selectedCategoryAccount.id,
            accountName: selectedCategoryAccount.name,
            accountCode: selectedCategoryAccount.code,
            debit: numericAmount,
            credit: 0,
            memo: memoText,
          });
          if (numericTax > 0 && taxAccount) {
            generatedLines.push({
              accountId: taxAccount.id,
              accountName: taxAccount.name,
              accountCode: taxAccount.code,
              debit: numericTax,
              credit: 0,
              memo: 'Tax on expense',
            });
          }
          generatedLines.push({
            accountId: selectedCashAccount.id,
            accountName: selectedCashAccount.name,
            accountCode: selectedCashAccount.code,
            debit: 0,
            credit: totalTransactionAmount,
            memo: memoText,
          });

          await executeAtomicPosting({
            companyId,
            userId: user?.uid || 'anonymous',
            date,
            memo: memoText,
            sourceType: 'Expense',
            referenceNumber: `EXP-${Date.now().toString().slice(-5)}`,
            lines: generatedLines,
            allAccounts: accounts,
          });
        } else {
          // On Account -> Create Bill
          if (!apAccount) throw new Error('Accounts Payable account not found.');
          const vendorObj = vendors.find(v => v.id === vendorId);
          const billNum = `BILL-${Date.now().toString().slice(-4)}`;

          generatedLines.push({
            accountId: selectedCategoryAccount.id,
            accountName: selectedCategoryAccount.name,
            accountCode: selectedCategoryAccount.code,
            debit: numericAmount,
            credit: 0,
            memo: `Bill ${billNum} from ${vendorObj?.name || 'Vendor'}`,
          });
          if (numericTax > 0 && taxAccount) {
            generatedLines.push({
              accountId: taxAccount.id,
              accountName: taxAccount.name,
              accountCode: taxAccount.code,
              debit: numericTax,
              credit: 0,
              memo: 'Tax on bill',
            });
          }
          generatedLines.push({
            accountId: apAccount.id,
            accountName: apAccount.name,
            accountCode: apAccount.code,
            debit: 0,
            credit: totalTransactionAmount,
            memo: memoText,
          });

          await executeAtomicPosting({
            companyId,
            userId: user?.uid || 'anonymous',
            date,
            memo: memoText,
            sourceType: 'Expense',
            referenceNumber: billNum,
            lines: generatedLines,
            allAccounts: accounts,
            billData: {
              vendorId: vendorId || 'general-vendor',
              vendorName: vendorObj?.name || 'Direct Supplier',
              billNumber: billNum,
              date,
              dueDate,
              lineItems: [
                {
                  description: itemDescription.trim() || selectedCategoryAccount.name,
                  qty: 1,
                  unitPrice: numericAmount,
                  amount: numericAmount,
                },
              ],
              subtotal: numericAmount,
              tax: numericTax,
              total: totalTransactionAmount,
              amountPaid: 0,
              balanceDue: totalTransactionAmount,
              status: 'Open',
              notes: memo.trim(),
            },
          });
        }
      }

      // Reset & close
      setAmount('');
      setTaxAmount('0');
      setMemo('');
      setItemDescription('');
      setIsTransactionModalOpen(false);
    } catch (err: any) {
      console.error('Failed to post transaction:', err);
      setError(err.message || 'Error posting transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Path B Submit
  const handleAdvancedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setError(`Cannot post an unbalanced entry. Total Debits: $${totalDebits.toFixed(2)}, Total Credits: $${totalCredits.toFixed(2)}`);
      return;
    }

    // Check that all lines have accounts selected
    const unselected = lines.some(l => !l.accountId);
    if (unselected) {
      setError('Please select an account for every row in the journal entry.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await executeAtomicPosting({
        companyId,
        userId: user?.uid || 'anonymous',
        date: jeDate,
        memo: jeMemo.trim() || 'General Journal Entry',
        sourceType: 'GeneralJournal',
        referenceNumber: jeReference.trim() || `JE-${Date.now().toString().slice(-4)}`,
        lines,
        allAccounts: accounts,
      });

      // Reset
      setJeMemo('');
      setJeReference(`JE-${Date.now().toString().slice(-4)}`);
      setLines([
        { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
        { accountId: '', accountName: '', debit: 0, credit: 0, memo: '' },
      ]);
      setIsTransactionModalOpen(false);
    } catch (err: any) {
      console.error('Failed to post journal entry:', err);
      setError(err.message || 'Error posting journal entry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isTransactionModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        id="modal-new-transaction"
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">New Transaction</h2>
              <p className="text-xs text-slate-400">
                Cascades automatically to General Journal, Account Ledgers &amp; Financial Statements
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsTransactionModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selector: Simple Mode vs Advanced General Journal Entry */}
        <div className="px-6 pt-4 bg-slate-900">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              id="tab-mode-simple"
              type="button"
              onClick={() => setMode('simple')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs sm:text-sm font-semibold transition ${
                mode === 'simple'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>Sales / Expense (Simple)</span>
            </button>
            <button
              id="tab-mode-advanced"
              type="button"
              onClick={() => setMode('advanced')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs sm:text-sm font-semibold transition ${
                mode === 'advanced'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>General Journal Entry (Manual Dr/Cr)</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {mode === 'simple' ? (
            /* PATH A: Simple Sales/Expense Form */
            <form onSubmit={handleSimpleSubmit} className="space-y-5">
              {/* Type Toggle: Sale vs Expense */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="toggle-type-sale"
                    onClick={() => handleTxTypeChange('sale')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition ${
                      txType === 'sale'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Receipt className="h-4 w-4 text-emerald-400" />
                    <span>Sale / Income (+)</span>
                  </button>
                  <button
                    type="button"
                    id="toggle-type-expense"
                    onClick={() => handleTxTypeChange('expense')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition ${
                      txType === 'expense'
                        ? 'bg-rose-950/40 border-rose-500 text-rose-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="h-4 w-4 text-rose-400" />
                    <span>Expense / Spending (−)</span>
                  </button>
                </div>
              </div>

              {/* Date & Contact (Customer / Vendor) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Date <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      {txType === 'sale' ? 'Customer' : 'Vendor'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddContact(!showAddContact)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                    >
                      <Plus className="h-3 w-3" />
                      {showAddContact ? 'Cancel' : '+ Add new'}
                    </button>
                  </div>

                  {showAddContact ? (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                      <input
                        type="text"
                        placeholder={`New ${txType === 'sale' ? 'Customer' : 'Vendor'} Name`}
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="email"
                        placeholder="Email (optional)"
                        value={newContactEmail}
                        onChange={(e) => setNewContactEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateContact}
                        disabled={!newContactName.trim()}
                        className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded"
                      >
                        Save Contact
                      </button>
                    </div>
                  ) : txType === 'sale' ? (
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Direct Customer / Unspecified --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.openBalance > 0 ? `(Owes $${c.openBalance.toFixed(2)})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Direct Vendor / Unspecified --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} {v.openBalance > 0 ? `(Owed $${v.openBalance.toFixed(2)})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Category (Account) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Category Account ({txType === 'sale' ? 'Revenue' : 'Expense'}) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {accounts
                    .filter((a) => (txType === 'sale' ? a.type === 'Revenue' : a.type === 'Expense'))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.subtype})
                      </option>
                    ))}
                </select>
              </div>

              {/* Payment Method Toggle: Paid now vs On Account */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Method <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="toggle-pay-now"
                    onClick={() => setPaymentMethod('paid_now')}
                    className={`py-2 px-3 rounded-lg border text-xs sm:text-sm font-medium transition ${
                      paymentMethod === 'paid_now'
                        ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    Paid Now (Cash / Bank)
                  </button>
                  <button
                    type="button"
                    id="toggle-on-account"
                    onClick={() => setPaymentMethod('on_account')}
                    className={`py-2 px-3 rounded-lg border text-xs sm:text-sm font-medium transition ${
                      paymentMethod === 'on_account'
                        ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400'
                    }`}
                  >
                    On Account ({txType === 'sale' ? 'Invoice / A/R' : 'Bill / A/P'})
                  </button>
                </div>
              </div>

              {/* Conditional Account / Due Date settings based on payment method */}
              {paymentMethod === 'paid_now' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Deposited To / Paid From Account
                  </label>
                  <select
                    value={paidNowAccountId}
                    onChange={(e) => setPaidNowAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {accounts
                      .filter((a) => a.type === 'Asset' && (a.subtype.includes('Current') || a.code === '1010' || a.code === '1020'))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name} (Current Bal: ${a.balance.toFixed(2)})
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                    <HelpCircle className="h-4 w-4 text-amber-400" />
                    <span>
                      {txType === 'sale'
                        ? 'Creates an open Invoice and debits Accounts Receivable subledger'
                        : 'Creates an open Bill and credits Accounts Payable subledger'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Item / Line Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Monthly consulting, server license"
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Amount, Tax & Memo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount ($) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-mono font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sales Tax ($ optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Memo / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 retainer fee, office supplies invoice"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Automatic Journal Entry Live Cascade Preview */}
              {previewLines.length > 0 && (
                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Automated Double-Entry Cascade Preview
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-medium">
                      Balanced: ${totalTransactionAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    {previewLines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className={l.debit > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500 ml-4'}>
                            {l.debit > 0 ? 'Dr.' : 'Cr.'}
                          </span>
                          <span>{l.account}</span>
                        </div>
                        <span className="text-slate-200">
                          ${(l.debit > 0 ? l.debit : l.credit).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Action */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-post-simple-transaction"
                  disabled={submitting || totalTransactionAmount <= 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-sm shadow transition"
                >
                  {submitting ? 'Posting Books...' : `Post Transaction ($${totalTransactionAmount.toFixed(2)})`}
                </button>
              </div>
            </form>
          ) : (
            /* PATH B: Advanced Multi-Line General Journal Entry */
            <form onSubmit={handleAdvancedSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={jeDate}
                    onChange={(e) => setJeDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Reference #</label>
                  <input
                    type="text"
                    value={jeReference}
                    onChange={(e) => setJeReference(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Memo / Explanation</label>
                  <input
                    type="text"
                    placeholder="e.g. Month-end depreciation adjustment"
                    value={jeMemo}
                    onChange={(e) => setJeMemo(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Dynamic Multi-Row Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-900/80 text-xs font-semibold text-slate-400 border-b border-slate-800">
                  <div className="col-span-5 sm:col-span-5">Account</div>
                  <div className="col-span-3 sm:col-span-3 text-right">Debit ($)</div>
                  <div className="col-span-3 sm:col-span-3 text-right">Credit ($)</div>
                  <div className="col-span-1 text-center"></div>
                </div>

                <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                  {lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 p-2 items-center text-xs">
                      {/* Account selector */}
                      <div className="col-span-5 sm:col-span-5">
                        <select
                          value={line.accountId}
                          onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
                          required
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Select Account --</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} — {acc.name} ({acc.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Debit */}
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.debit === 0 ? '' : line.debit}
                          onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs text-right font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Credit */}
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.credit === 0 ? '' : line.credit}
                          onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs text-right font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                          className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table Footer: Add Line + Running Totals */}
                <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium w-fit"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Line</span>
                  </button>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">Total Debits</span>
                      <span className="text-slate-200 font-bold">${totalDebits.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-sans">Total Credits</span>
                      <span className="text-slate-200 font-bold">${totalCredits.toFixed(2)}</span>
                    </div>
                    <div className="pl-3 border-l border-slate-700">
                      {isBalanced ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-sans">
                          <CheckCircle2 className="h-4 w-4" /> Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold font-sans">
                          <AlertCircle className="h-4 w-4" /> Diff: ${diff.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Submit Action */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransactionModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-post-advanced-journal-entry"
                  disabled={submitting || !isBalanced || totalDebits <= 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold text-sm shadow transition"
                >
                  {submitting ? 'Posting Entry...' : `Post Balanced Entry ($${totalDebits.toFixed(2)})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
