import { DEFAULT_ACCOUNTS } from '../data/defaultAccounts';
import { Account, Customer, Vendor, JournalEntry, Invoice, Bill } from '../types';

export function createInitialAccounts(): Account[] {
  return DEFAULT_ACCOUNTS.map((acc, idx) => ({
    ...acc,
    id: `acc-${acc.code}-${idx}`,
    balance: 0,
  }));
}

export function generateSeedDemoData(): {
  accounts: Account[];
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  bills: Bill[];
  customers: Customer[];
  vendors: Vendor[];
} {
  const initialAccounts = createInitialAccounts();

  const accountByCode = (code: string) => initialAccounts.find((a) => a.code === code)!;

  const bank = accountByCode('1020');
  const cash = accountByCode('1010');
  const ar = accountByCode('1200');
  const ap = accountByCode('2010');
  const equip = accountByCode('1500');
  const cap = accountByCode('3010');
  const drawings = accountByCode('3020');
  const salesRev = accountByCode('4010');
  const servRev = accountByCode('4020');
  const rentExp = accountByCode('6010');
  const supExp = accountByCode('6040');

  // Customers
  const cust1: Customer = {
    id: 'cust-101',
    name: 'Acme Global Enterprises',
    email: 'billing@acmeglobal.com',
    phone: '+1 (555) 234-5678',
    address: '100 Corporate Parkway, Suite 400',
    openBalance: 3500, // 8500 total - 5000 paid
    createdAt: new Date().toISOString(),
  };

  const cust2: Customer = {
    id: 'cust-102',
    name: 'Starlight Interactive Media',
    email: 'accounts@starlight.io',
    phone: '+1 (555) 876-5432',
    address: '42 Innovation Way',
    openBalance: 4200,
    createdAt: new Date().toISOString(),
  };

  // Vendors
  const vend1: Vendor = {
    id: 'vend-201',
    name: 'Vertex Cloud & Office Tech',
    email: 'sales@vertextech.com',
    phone: '+1 (555) 345-6789',
    address: '500 Silicon Way',
    openBalance: 0, // 1850 billed - 1850 paid in full
    createdAt: new Date().toISOString(),
  };

  const vend2: Vendor = {
    id: 'vend-202',
    name: 'Skyline Commercial Properties',
    email: 'rentals@skylineproperties.com',
    phone: '+1 (555) 901-2345',
    address: '1 Skyline Plaza',
    openBalance: 0,
    createdAt: new Date().toISOString(),
  };

  const today = new Date();
  const daysAgo = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  // Invoices
  const inv1: Invoice = {
    id: 'inv-1001',
    customerId: cust1.id,
    customerName: cust1.name,
    invoiceNumber: 'INV-1001',
    date: daysAgo(18),
    dueDate: daysAgo(4), // Overdue
    lineItems: [
      { description: 'Cloud Architecture & Systems Advisory', qty: 40, unitPrice: 175, amount: 7000 },
      { description: 'Security & Compliance Review', qty: 10, unitPrice: 150, amount: 1500 },
    ],
    subtotal: 8500,
    tax: 0,
    total: 8500,
    amountPaid: 5000,
    balanceDue: 3500,
    status: 'Partial',
    journalEntryId: 'je-seed-4',
  };

  const inv2: Invoice = {
    id: 'inv-1002',
    customerId: cust2.id,
    customerName: cust2.name,
    invoiceNumber: 'INV-1002',
    date: daysAgo(12),
    dueDate: daysAgo(-18),
    lineItems: [
      { description: 'Annual Enterprise Analytics License', qty: 1, unitPrice: 4200, amount: 4200 },
    ],
    subtotal: 4200,
    tax: 0,
    total: 4200,
    amountPaid: 0,
    balanceDue: 4200,
    status: 'Open',
    journalEntryId: 'je-seed-5',
  };

  // Bills
  const bill1: Bill = {
    id: 'bill-2001',
    vendorId: vend1.id,
    vendorName: vend1.name,
    billNumber: 'BILL-2001',
    date: daysAgo(10),
    dueDate: daysAgo(1),
    lineItems: [
      { description: 'Cloud Server Clusters & Database Nodes', qty: 1, unitPrice: 1450, amount: 1450 },
      { description: 'Enterprise Developer Tools License', qty: 4, unitPrice: 100, amount: 400 },
    ],
    subtotal: 1850,
    tax: 0,
    total: 1850,
    amountPaid: 1850,
    balanceDue: 0,
    status: 'Paid',
    journalEntryId: 'je-seed-6',
  };

  // Balanced Journal Entries
  const journalEntries: JournalEntry[] = [
    {
      id: 'je-seed-10',
      date: daysAgo(1),
      memo: 'Owner monthly distribution withdrawal',
      sourceType: 'GeneralJournal',
      sourceId: null,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'DRW-601',
      isBalanced: true,
      lines: [
        { accountId: drawings.id, accountName: drawings.name, accountCode: drawings.code, debit: 1200, credit: 0, memo: 'Owner dividend distribution' },
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 0, credit: 1200, memo: 'Bank withdrawal' },
      ],
    },
    {
      id: 'je-seed-9',
      date: daysAgo(2),
      memo: 'On-demand technical training workshop - Paid Now',
      sourceType: 'Sale',
      sourceId: null,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'SALE-501',
      isBalanced: true,
      lines: [
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 1600, credit: 0, memo: 'Direct workshop service cash' },
        { accountId: servRev.id, accountName: servRev.name, accountCode: servRev.code, debit: 0, credit: 1600, memo: 'Service revenue' },
      ],
    },
    {
      id: 'je-seed-8',
      date: daysAgo(3),
      memo: 'Settlement of Bill BILL-2001 to Vertex Cloud',
      sourceType: 'BillPayment',
      sourceId: bill1.id,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'PAY-401',
      isBalanced: true,
      lines: [
        { accountId: ap.id, accountName: ap.name, accountCode: ap.code, debit: 1850, credit: 0, memo: 'Relief of Accounts Payable' },
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 0, credit: 1850, memo: 'Payment disbursement' },
      ],
    },
    {
      id: 'je-seed-7',
      date: daysAgo(5),
      memo: 'Partial payment received for INV-1001 from Acme Global',
      sourceType: 'InvoicePayment',
      sourceId: inv1.id,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'PMT-301',
      isBalanced: true,
      lines: [
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 5000, credit: 0, memo: 'Customer cash collection' },
        { accountId: ar.id, accountName: ar.name, accountCode: ar.code, debit: 0, credit: 5000, memo: 'Relief of Accounts Receivable' },
      ],
    },
    {
      id: 'je-seed-6',
      date: daysAgo(10),
      memo: 'Cloud Hosting & SaaS Infrastructure Subscription',
      sourceType: 'Expense',
      sourceId: bill1.id,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'BILL-2001',
      isBalanced: true,
      lines: [
        { accountId: supExp.id, accountName: supExp.name, accountCode: supExp.code, debit: 1850, credit: 0, memo: 'Server infrastructure' },
        { accountId: ap.id, accountName: ap.name, accountCode: ap.code, debit: 0, credit: 1850, memo: 'Accounts payable obligation' },
      ],
    },
    {
      id: 'je-seed-5',
      date: daysAgo(12),
      memo: 'Annual Enterprise Software License for Starlight',
      sourceType: 'Sale',
      sourceId: inv2.id,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'INV-1002',
      isBalanced: true,
      lines: [
        { accountId: ar.id, accountName: ar.name, accountCode: ar.code, debit: 4200, credit: 0, memo: 'Receivable on credit' },
        { accountId: salesRev.id, accountName: salesRev.name, accountCode: salesRev.code, debit: 0, credit: 4200, memo: 'Software sales revenue' },
      ],
    },
    {
      id: 'je-seed-4',
      date: daysAgo(18),
      memo: 'Enterprise Architecture Consulting for Acme Global',
      sourceType: 'Sale',
      sourceId: inv1.id,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'INV-1001',
      isBalanced: true,
      lines: [
        { accountId: ar.id, accountName: ar.name, accountCode: ar.code, debit: 8500, credit: 0, memo: 'Consulting receivable' },
        { accountId: servRev.id, accountName: servRev.name, accountCode: servRev.code, debit: 0, credit: 8500, memo: 'Advisory service revenue' },
      ],
    },
    {
      id: 'je-seed-3',
      date: daysAgo(20),
      memo: 'Monthly office workspace rental',
      sourceType: 'Expense',
      sourceId: null,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'EXP-102',
      isBalanced: true,
      lines: [
        { accountId: rentExp.id, accountName: rentExp.name, accountCode: rentExp.code, debit: 2500, credit: 0, memo: 'Workspace rent' },
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 0, credit: 2500, memo: 'Bank payment' },
      ],
    },
    {
      id: 'je-seed-2',
      date: daysAgo(25),
      memo: 'Purchased high-performance development workstations',
      sourceType: 'Expense',
      sourceId: null,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'EXP-101',
      isBalanced: true,
      lines: [
        { accountId: equip.id, accountName: equip.name, accountCode: equip.code, debit: 4800, credit: 0, memo: 'Office workstations' },
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 0, credit: 4800, memo: 'Bank purchase' },
      ],
    },
    {
      id: 'je-seed-1',
      date: daysAgo(30),
      memo: 'Initial founder equity capital contribution',
      sourceType: 'GeneralJournal',
      sourceId: null,
      createdBy: 'founder',
      createdAt: new Date().toISOString(),
      referenceNumber: 'CAP-001',
      isBalanced: true,
      lines: [
        { accountId: bank.id, accountName: bank.name, accountCode: bank.code, debit: 50000, credit: 0, memo: 'Founder initial capital' },
        { accountId: cap.id, accountName: cap.name, accountCode: cap.code, debit: 0, credit: 50000, memo: 'Equity investment' },
      ],
    },
  ];

  // Calculate live account balances by summing all journal entry lines
  const accountBalances = new Map<string, number>();

  // Chronological order
  const chronologicalEntries = [...journalEntries].reverse();
  for (const je of chronologicalEntries) {
    for (const l of je.lines) {
      const acc = initialAccounts.find((a) => a.id === l.accountId || a.code === l.accountCode);
      if (!acc) continue;
      const isDebit = acc.normalBalance.toLowerCase() === 'debit';
      const delta = isDebit ? l.debit - l.credit : l.credit - l.debit;
      accountBalances.set(acc.id, (accountBalances.get(acc.id) || 0) + delta);
    }
  }

  const finalAccounts = initialAccounts.map((acc) => ({
    ...acc,
    balance: Math.round(((accountBalances.get(acc.id) || 0) + Number.EPSILON) * 100) / 100,
  }));

  return {
    accounts: finalAccounts,
    journalEntries,
    invoices: [inv1, inv2],
    bills: [bill1],
    customers: [cust1, cust2],
    vendors: [vend1, vend2],
  };
}
