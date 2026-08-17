import React, { useState, useEffect } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { executeAtomicPosting, round2 } from '../lib/postingEngine';
import { X, Receipt, CheckCircle2, AlertCircle } from 'lucide-react';

export const RecordPaymentModal: React.FC = () => {
  const {
    user,
    companyId,
    accounts,
    customers,
    paymentTargetInvoice,
    setPaymentTargetInvoice,
  } = useAccounting();

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [depositAccountId, setDepositAccountId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentTargetInvoice) {
      setPaymentAmount(paymentTargetInvoice.balanceDue.toFixed(2));
      setReference(`PMT-${Date.now().toString().slice(-4)}`);
      setError(null);
      const defaultBank = accounts.find(a => a.code === '1020') || accounts.find(a => a.code === '1010') || accounts.find(a => a.type === 'Asset');
      if (defaultBank) setDepositAccountId(defaultBank.id);
    }
  }, [paymentTargetInvoice, accounts]);

  if (!paymentTargetInvoice) return null;

  const numericAmount = parseFloat(paymentAmount) || 0;
  const depositAccount = accounts.find(a => a.id === depositAccountId) || accounts.find(a => a.code === '1020');
  const arAccount = accounts.find(a => a.code === '1200') || accounts.find(a => a.type === 'Asset' && a.name.toLowerCase().includes('receivable'));
  const customerObj = customers.find(c => c.id === paymentTargetInvoice.customerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setError('Please enter a payment amount greater than 0.');
      return;
    }
    if (numericAmount > paymentTargetInvoice.balanceDue + 0.001) {
      setError(`Payment amount ($${numericAmount.toFixed(2)}) cannot exceed balance due ($${paymentTargetInvoice.balanceDue.toFixed(2)}).`);
      return;
    }
    if (!depositAccount || !arAccount) {
      setError('Deposit or Accounts Receivable account is missing.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const memoText = `Payment received for Invoice ${paymentTargetInvoice.invoiceNumber} (${paymentTargetInvoice.customerName || 'Customer'})`;

      const lines = [
        {
          accountId: depositAccount.id,
          accountName: depositAccount.name,
          accountCode: depositAccount.code,
          debit: round2(numericAmount),
          credit: 0,
          memo: memoText,
        },
        {
          accountId: arAccount.id,
          accountName: arAccount.name,
          accountCode: arAccount.code,
          debit: 0,
          credit: round2(numericAmount),
          memo: memoText,
        },
      ];

      await executeAtomicPosting({
        companyId,
        userId: user?.uid || 'anonymous',
        date: paymentDate,
        memo: memoText,
        sourceType: 'InvoicePayment',
        sourceId: paymentTargetInvoice.id,
        referenceNumber: reference || `PMT-${Date.now().toString().slice(-4)}`,
        lines,
        allAccounts: accounts,
        invoicePaymentData: {
          invoiceId: paymentTargetInvoice.id,
          customerId: paymentTargetInvoice.customerId,
          paymentAmount: round2(numericAmount),
          currentInvoice: paymentTargetInvoice,
          currentCustomer: customerObj,
        },
      });

      setPaymentTargetInvoice(null);
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Error recording invoice payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        id="modal-record-invoice-payment"
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Record Customer Payment</h2>
              <p className="text-xs text-slate-400">
                Invoice {paymentTargetInvoice.invoiceNumber} — {paymentTargetInvoice.customerName || 'Customer'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPaymentTargetInvoice(null)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Invoice Summary Box */}
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Invoice Total</span>
              <span className="font-semibold text-slate-200">${paymentTargetInvoice.total.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Paid to Date</span>
              <span className="font-semibold text-emerald-400">${paymentTargetInvoice.amountPaid.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Balance Due</span>
              <span className="font-bold text-amber-400">${paymentTargetInvoice.balanceDue.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Payment Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={paymentTargetInvoice.balanceDue}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Deposit To Bank / Cash Account</label>
            <select
              value={depositAccountId}
              onChange={(e) => setDepositAccountId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {accounts
                .filter((a) => a.type === 'Asset' && (a.code === '1010' || a.code === '1020' || a.subtype.includes('Current')))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reference # / Check #</label>
            <input
              type="text"
              placeholder="e.g. Check #4021 or ACH-883"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Journal Entry Preview */}
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
            <div className="text-[10px] uppercase font-sans font-semibold text-slate-500 mb-1.5">
              Automated Posting Cascade:
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-400 font-semibold">Dr. {depositAccount?.name || 'Bank'}</span>
              <span>${numericAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-slate-400">Cr. Accounts Receivable</span>
              <span>${numericAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPaymentTargetInvoice(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || numericAmount <= 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-sm shadow transition"
            >
              {submitting ? 'Recording...' : `Record Payment ($${numericAmount.toFixed(2)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
