export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type NormalBalance = 'debit' | 'credit';
export type CashFlowCategory = 'Operating' | 'Investing' | 'Financing' | 'None';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string;
  normalBalance: NormalBalance;
  balance: number;
  isSystemAccount: boolean;
  cashFlowCategory?: CashFlowCategory;
  description?: string;
}

export interface JournalEntryLine {
  accountId: string;
  accountName: string;
  accountCode?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export type SourceType = 'Sale' | 'Expense' | 'GeneralJournal' | 'InvoicePayment' | 'BillPayment' | 'Manual' | 'InitialBalance' | 'Invoice' | 'Bill' | 'Payment' | string;
export type JournalSourceType = SourceType;

export interface JournalEntry {
  id: string;
  date: string; // ISO string YYYY-MM-DD or full timestamp
  memo: string;
  sourceType: SourceType;
  sourceId: string | null;
  createdBy: string;
  createdAt: string;
  lines: JournalEntryLine[];
  isBalanced: boolean;
  referenceNumber?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  journalEntryId: string;
  sourceType?: SourceType;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  openBalance: number;
  createdAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  openBalance: number;
  createdAt?: string;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export type InvoiceStatus = 'Open' | 'Partial' | 'Paid' | 'Overdue';
export type BillStatus = InvoiceStatus;

export interface Invoice {
  id: string;
  customerId: string;
  customerName?: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  journalEntryId: string;
  notes?: string;
}

export interface Bill {
  id: string;
  vendorId: string;
  vendorName?: string;
  billNumber: string;
  date: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  journalEntryId: string;
  notes?: string;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  currency: string;
  fiscalYearStartMonth?: number;
}

export interface FinancialStatementFilters {
  startDate?: string;
  endDate?: string;
  period: 'all' | 'this_month' | 'this_quarter' | 'this_year' | 'custom';
}
