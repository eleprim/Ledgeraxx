import React, { useState, useEffect } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { executeAtomicPosting, round2 } from '../lib/postingEngine';
import { X, FileText, AlertCircle } from 'lucide-react';

export const PayBillModal: React.FC = () => {
  const {
    user,
    companyId,
    accounts,
    vendors,
    paymentTargetBill,
    setPaymentTargetBill,
  } = useAccounting();

  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paidFromAccountId, setPaidFromAccountId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentTargetBill) {
      setPaymentAmount(paymentTargetBill.balanceDue.toFixed(2));
      setReference(`PAY-${Date.now().toString().slice(-4)}`);
      setError(null);
      const defaultBank = accounts.find(a => a.code === '1020') || accounts.find(a => a.code === '1010') || accounts.find(a => a.type === 'Asset');
      if (defaultBank) setPaidFromAccountId(defaultBank.id);
    }
  }, [paymentTargetBill, accounts]);

  if (!paymentTargetBill) return null;

  const numericAmount = parseFloat(paymentAmount) || 0;
  const paidFromAccount = accounts.find(a => a.id === paidFromAccountId) || accounts.find(a => a.code === '1020');
  const apAccount = accounts.find(a => a.code === '2010') || accounts.find(a => a.type === 'Liability' && a.name.toLowerCase().includes('payable'));
  const vendorObj = vendors.find(v => v.id === paymentTargetBill.vendorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      setError('Please enter a payment amount greater than 0.');
      return;
    }
    if (numericAmount > paymentTargetBill.balanceDue + 0.001) {
      setError(`Payment amount ($${numericAmount.toFixed(2)}) cannot exceed balance due ($${paymentTargetBill.balanceDue.toFixed(2)}).`);
      return;
    }
    if (!paidFromAccount || !apAccount) {
      setError('Payment Bank account or Accounts Payable account is missing.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const memoText = `Settlement of Bill ${paymentTargetBill.billNumber} to ${paymentTargetBill.vendorName || 'Vendor'}`;

      const lines = [
        {
          accountId: apAccount.id,
          accountName: apAccount.name,
          accountCode: apAccount.code,
          debit: round2(numericAmount),
          credit: 0,
          memo: memoText,
        },
        {
          accountId: paidFromAccount.id,
          accountName: paidFromAccount.name,
          accountCode: paidFromAccount.code,
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
        sourceType: 'BillPayment',
        sourceId: paymentTargetBill.id,
        referenceNumber: reference || `PAY-${Date.now().toString().slice(-4)}`,
        lines,
        allAccounts: accounts,
        billPaymentData: {
          billId: paymentTargetBill.id,
          vendorId: paymentTargetBill.vendorId,
          paymentAmount: round2(numericAmount),
          currentBill: paymentTargetBill,
          currentVendor: vendorObj,
        },
      });

      setPaymentTargetBill(null);
    } catch (err: any) {
      console.error('Error paying bill:', err);
      setError(err.message || 'Error paying vendor bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div
        id="modal-pay-vendor-bill"
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Pay Vendor Bill</h2>
              <p className="text-xs text-slate-400">
                Bill {paymentTargetBill.billNumber} — {paymentTargetBill.vendorName || 'Vendor'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPaymentTargetBill(null)}
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
          {/* Bill Summary Box */}
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Bill Total</span>
              <span className="font-semibold text-slate-200">${paymentTargetBill.total.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Paid to Date</span>
              <span className="font-semibold text-emerald-400">${paymentTargetBill.amountPaid.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Balance Due</span>
              <span className="font-bold text-amber-400">${paymentTargetBill.balanceDue.toFixed(2)}</span>
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
                max={paymentTargetBill.balanceDue}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Pay From Bank / Cash Account</label>
            <select
              value={paidFromAccountId}
              onChange={(e) => setPaidFromAccountId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {accounts
                .filter((a) => a.type === 'Asset' && (a.code === '1010' || a.code === '1020' || a.subtype.includes('Current')))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name} (Available: ${a.balance.toFixed(2)})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Reference / Confirmation #</label>
            <input
              type="text"
              placeholder="e.g. Wire-893 or ACH Ref"
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
              <span className="text-emerald-400 font-semibold">Dr. Accounts Payable</span>
              <span>${numericAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pl-4">
              <span className="text-slate-400">Cr. {paidFromAccount?.name || 'Bank Account'}</span>
              <span>${numericAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPaymentTargetBill(null)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || numericAmount <= 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold text-sm shadow transition"
            >
              {submitting ? 'Processing Payment...' : `Confirm Payment ($${numericAmount.toFixed(2)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
