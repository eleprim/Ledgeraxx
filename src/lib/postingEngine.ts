import {
  Account,
  JournalEntry,
  JournalEntryLine,
  Invoice,
  Bill,
  Customer,
  Vendor,
  SourceType,
} from '../types';

// Helper to safely format numbers to 2 decimal places
export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Check if debits equals credits
export const validateBalance = (
  lines: JournalEntryLine[]
): { isBalanced: boolean; totalDebits: number; totalCredits: number; diff: number } => {
  const totalDebits = round2(lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0));
  const totalCredits = round2(lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0));
  const diff = round2(Math.abs(totalDebits - totalCredits));
  const isBalanced = diff < 0.001 && totalDebits > 0;
  return { isBalanced, totalDebits, totalCredits, diff };
};

export interface PostJournalEntryParams {
  companyId?: string;
  userId?: string;
  date: string;
  memo: string;
  sourceType: SourceType;
  sourceId?: string | null;
  referenceNumber?: string;
  lines: JournalEntryLine[];
  allAccounts: Account[];
  // Optional payloads for invoice / bill / payment cascading
  invoiceData?: Omit<Invoice, 'id' | 'journalEntryId'>;
  billData?: Omit<Bill, 'id' | 'journalEntryId'>;
  invoicePaymentData?: {
    invoiceId: string;
    customerId: string;
    paymentAmount: number;
    currentInvoice: Invoice;
    currentCustomer?: Customer;
  };
  billPaymentData?: {
    billId: string;
    vendorId: string;
    paymentAmount: number;
    currentBill: Bill;
    currentVendor?: Vendor;
  };
}

export interface AccountingState {
  accounts: Account[];
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  bills: Bill[];
  customers: Customer[];
  vendors: Vendor[];
}

export interface AtomicPostingResult {
  updatedState: AccountingState;
  entryId: string;
  invoiceId?: string;
  billId?: string;
}

/**
 * Pure double-entry execution engine:
 * Atomically computes journal entry, updates affected account balances,
 * and cascades changes to subledgers (invoices, bills, customers, vendors).
 */
export function executeAtomicPostingCore(
  params: PostJournalEntryParams,
  currentState: AccountingState
): AtomicPostingResult {
  const {
    userId = 'local-user',
    date,
    memo,
    sourceType,
    sourceId = null,
    referenceNumber = `JE-${Date.now().toString().slice(-6)}`,
    lines,
    invoiceData,
    billData,
    invoicePaymentData,
    billPaymentData,
  } = params;

  // 1. Double-Entry Balance Validation (Debits === Credits)
  const { isBalanced, totalDebits, totalCredits } = validateBalance(lines);
  if (!isBalanced) {
    throw new Error(
      `Transaction is not in balance. Total Debits: $${totalDebits.toFixed(2)}, Total Credits: $${totalCredits.toFixed(2)}`
    );
  }

  const entryId = `je-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let createdInvoiceId: string | undefined;
  let createdBillId: string | undefined;

  let newInvoices = [...currentState.invoices];
  let newBills = [...currentState.bills];
  let newCustomers = [...currentState.customers];
  let newVendors = [...currentState.vendors];
  let newAccounts = [...currentState.accounts];

  // 2. Cascade Invoice creation if provided
  if (invoiceData) {
    createdInvoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newInvoice: Invoice = {
      ...invoiceData,
      id: createdInvoiceId,
      journalEntryId: entryId,
    };
    newInvoices = [newInvoice, ...newInvoices];

    // Update customer openBalance
    if (invoiceData.customerId) {
      newCustomers = newCustomers.map((cust) => {
        if (cust.id === invoiceData.customerId) {
          return {
            ...cust,
            openBalance: round2((cust.openBalance || 0) + (invoiceData.balanceDue || invoiceData.total || 0)),
          };
        }
        return cust;
      });
    }
  }

  // 3. Cascade Bill creation if provided
  if (billData) {
    createdBillId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newBill: Bill = {
      ...billData,
      id: createdBillId,
      journalEntryId: entryId,
    };
    newBills = [newBill, ...newBills];

    // Update vendor openBalance
    if (billData.vendorId) {
      newVendors = newVendors.map((vend) => {
        if (vend.id === billData.vendorId) {
          return {
            ...vend,
            openBalance: round2((vend.openBalance || 0) + (billData.balanceDue || billData.total || 0)),
          };
        }
        return vend;
      });
    }
  }

  // 4. Cascade Invoice Payment
  if (invoicePaymentData) {
    const { invoiceId, customerId, paymentAmount } = invoicePaymentData;
    newInvoices = newInvoices.map((inv) => {
      if (inv.id === invoiceId) {
        const newPaid = round2((inv.amountPaid || 0) + paymentAmount);
        const newDue = round2(Math.max(0, inv.total - newPaid));
        return {
          ...inv,
          amountPaid: newPaid,
          balanceDue: newDue,
          status: newDue <= 0.001 ? 'Paid' : 'Partial',
        };
      }
      return inv;
    });

    if (customerId) {
      newCustomers = newCustomers.map((cust) => {
        if (cust.id === customerId) {
          return {
            ...cust,
            openBalance: round2(Math.max(0, (cust.openBalance || 0) - paymentAmount)),
          };
        }
        return cust;
      });
    }
  }

  // 5. Cascade Bill Payment
  if (billPaymentData) {
    const { billId, vendorId, paymentAmount } = billPaymentData;
    newBills = newBills.map((b) => {
      if (b.id === billId) {
        const newPaid = round2((b.amountPaid || 0) + paymentAmount);
        const newDue = round2(Math.max(0, b.total - newPaid));
        return {
          ...b,
          amountPaid: newPaid,
          balanceDue: newDue,
          status: newDue <= 0.001 ? 'Paid' : 'Partial',
        };
      }
      return b;
    });

    if (vendorId) {
      newVendors = newVendors.map((vend) => {
        if (vend.id === vendorId) {
          return {
            ...vend,
            openBalance: round2(Math.max(0, (vend.openBalance || 0) - paymentAmount)),
          };
        }
        return vend;
      });
    }
  }

  // 6. Post to Chart of Accounts and recalculate Account Balances
  const balanceDeltas = new Map<string, number>();
  const accountMap = new Map<string, Account>();
  newAccounts.forEach((acc) => accountMap.set(acc.id, acc));

  for (const line of lines) {
    const acc = accountMap.get(line.accountId) || newAccounts.find((a) => a.code === line.accountCode);
    if (!acc) {
      throw new Error(`Account ${line.accountId} (${line.accountName}) not found in Chart of Accounts.`);
    }

    const debitAmt = round2(Number(line.debit) || 0);
    const creditAmt = round2(Number(line.credit) || 0);

    let delta = 0;
    if (acc.normalBalance.toLowerCase() === 'debit') {
      delta = debitAmt - creditAmt;
    } else {
      delta = creditAmt - debitAmt;
    }

    const currentDelta = balanceDeltas.get(acc.id) || 0;
    balanceDeltas.set(acc.id, currentDelta + delta);
  }

  newAccounts = newAccounts.map((acc) => {
    if (balanceDeltas.has(acc.id)) {
      const delta = balanceDeltas.get(acc.id)!;
      return {
        ...acc,
        balance: round2(acc.balance + delta),
      };
    }
    return acc;
  });

  // 7. Create General Journal Entry
  const resolvedSourceId = sourceId || createdInvoiceId || createdBillId || null;
  const journalEntryPayload: JournalEntry = {
    id: entryId,
    date,
    memo,
    sourceType,
    sourceId: resolvedSourceId,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    lines: lines.map((l) => ({
      accountId: l.accountId,
      accountName: l.accountName,
      accountCode: l.accountCode || accountMap.get(l.accountId)?.code,
      debit: round2(Number(l.debit) || 0),
      credit: round2(Number(l.credit) || 0),
      memo: l.memo || memo,
    })),
    isBalanced: true,
    referenceNumber,
  };

  const newJournalEntries = [journalEntryPayload, ...currentState.journalEntries];

  return {
    updatedState: {
      accounts: newAccounts,
      journalEntries: newJournalEntries,
      invoices: newInvoices,
      bills: newBills,
      customers: newCustomers,
      vendors: newVendors,
    },
    entryId,
    invoiceId: createdInvoiceId,
    billId: createdBillId,
  };
}

/**
 * Dispatcher helper: Can be used if called directly
 */
let globalPostingHandler: ((params: PostJournalEntryParams) => Promise<{ entryId: string; invoiceId?: string; billId?: string }>) | null = null;

export function setGlobalPostingHandler(
  handler: (params: PostJournalEntryParams) => Promise<{ entryId: string; invoiceId?: string; billId?: string }>
) {
  globalPostingHandler = handler;
}

export async function executeAtomicPosting(
  params: PostJournalEntryParams
): Promise<{ entryId: string; invoiceId?: string; billId?: string }> {
  if (globalPostingHandler) {
    return globalPostingHandler(params);
  }
  throw new Error('Posting engine is initializing. Please try again in a moment.');
}
