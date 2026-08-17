import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Account,
  JournalEntry,
  Invoice,
  Bill,
  Customer,
  Vendor,
  Company,
} from '../types';
import { generateSeedDemoData, createInitialAccounts } from '../lib/seedData';
import {
  validateBalance,
  executeAtomicPostingCore,
  PostJournalEntryParams,
  setGlobalPostingHandler,
} from '../lib/postingEngine';

const STORAGE_KEY_PREFIX = 'ledger_accounting_app_';

interface AccountingContextType {
  companyId: string;
  company: Company | null;
  loading: boolean;
  accounts: Account[];
  journalEntries: JournalEntry[];
  invoices: Invoice[];
  bills: Bill[];
  customers: Customer[];
  vendors: Vendor[];
  isBooksInBalance: boolean;
  totalDebitsAllTime: number;
  totalCreditsAllTime: number;
  activeView: 'dashboard' | 'statements' | 'invoices' | 'bills' | 'journal' | 'ledger' | 'accounts' | 'directory';
  setActiveView: (view: 'dashboard' | 'statements' | 'invoices' | 'bills' | 'journal' | 'ledger' | 'accounts' | 'directory') => void;
  isTransactionModalOpen: boolean;
  setIsTransactionModalOpen: (open: boolean) => void;
  transactionModalInitialMode: 'simple' | 'advanced';
  openNewTransaction: (mode?: 'simple' | 'advanced') => void;
  selectedJournalEntry: JournalEntry | null;
  setSelectedJournalEntry: (je: JournalEntry | null) => void;
  selectedAccountIdForLedger: string | null;
  setSelectedAccountIdForLedger: (accId: string | null) => void;
  paymentTargetInvoice: Invoice | null;
  setPaymentTargetInvoice: (inv: Invoice | null) => void;
  paymentTargetBill: Bill | null;
  setPaymentTargetBill: (bill: Bill | null) => void;
  handleSeedDemoData: () => Promise<void>;
  handleResetToCleanBooks: () => void;
  addNewCustomer: (name: string, email: string, phone?: string, address?: string) => Promise<Customer>;
  addNewVendor: (name: string, email: string, phone?: string, address?: string) => Promise<Vendor>;
  addNewAccount: (account: Omit<Account, 'id' | 'balance' | 'isSystemAccount'>) => Promise<void>;
  executePosting: (params: PostJournalEntryParams) => Promise<{ entryId: string; invoiceId?: string; billId?: string }>;
}

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

export const AccountingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const companyId = 'default-company';
  const [company, setCompany] = useState<Company>({
    id: companyId,
    name: 'Acme Technologies Inc.',
    ownerId: 'local-owner',
    createdAt: new Date().toISOString(),
    currency: 'USD',
    fiscalYearStartMonth: 1,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Core Data Collections
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Navigation & Modal States
  const [activeView, setActiveView] = useState<'dashboard' | 'statements' | 'invoices' | 'bills' | 'journal' | 'ledger' | 'accounts' | 'directory'>('dashboard');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [transactionModalInitialMode, setTransactionModalInitialMode] = useState<'simple' | 'advanced'>('simple');
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<JournalEntry | null>(null);
  const [selectedAccountIdForLedger, setSelectedAccountIdForLedger] = useState<string | null>(null);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<Invoice | null>(null);
  const [paymentTargetBill, setPaymentTargetBill] = useState<Bill | null>(null);

  // Save to localStorage
  const saveStateToStorage = (
    newAccs: Account[],
    newJEs: JournalEntry[],
    newInvs: Invoice[],
    newBills: Bill[],
    newCusts: Customer[],
    newVends: Vendor[]
  ) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}accounts`, JSON.stringify(newAccs));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}journal_entries`, JSON.stringify(newJEs));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}invoices`, JSON.stringify(newInvs));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}bills`, JSON.stringify(newBills));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}customers`, JSON.stringify(newCusts));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}vendors`, JSON.stringify(newVends));
    } catch (e) {
      console.warn('Unable to persist to localStorage', e);
    }
  };

  // Load from localStorage or initialize with rich starter data
  useEffect(() => {
    try {
      const storedAccounts = localStorage.getItem(`${STORAGE_KEY_PREFIX}accounts`);
      const storedJEs = localStorage.getItem(`${STORAGE_KEY_PREFIX}journal_entries`);
      const storedInvs = localStorage.getItem(`${STORAGE_KEY_PREFIX}invoices`);
      const storedBills = localStorage.getItem(`${STORAGE_KEY_PREFIX}bills`);
      const storedCusts = localStorage.getItem(`${STORAGE_KEY_PREFIX}customers`);
      const storedVends = localStorage.getItem(`${STORAGE_KEY_PREFIX}vendors`);

      if (storedAccounts && storedJEs) {
        setAccounts(JSON.parse(storedAccounts));
        setJournalEntries(JSON.parse(storedJEs));
        setInvoices(storedInvs ? JSON.parse(storedInvs) : []);
        setBills(storedBills ? JSON.parse(storedBills) : []);
        setCustomers(storedCusts ? JSON.parse(storedCusts) : []);
        setVendors(storedVends ? JSON.parse(storedVends) : []);
      } else {
        // Initialize with default demo dataset
        const demoData = generateSeedDemoData();
        setAccounts(demoData.accounts);
        setJournalEntries(demoData.journalEntries);
        setInvoices(demoData.invoices);
        setBills(demoData.bills);
        setCustomers(demoData.customers);
        setVendors(demoData.vendors);

        saveStateToStorage(
          demoData.accounts,
          demoData.journalEntries,
          demoData.invoices,
          demoData.bills,
          demoData.customers,
          demoData.vendors
        );
      }
    } catch (e) {
      console.error('Error loading initial data from storage:', e);
      const demoData = generateSeedDemoData();
      setAccounts(demoData.accounts);
      setJournalEntries(demoData.journalEntries);
      setInvoices(demoData.invoices);
      setBills(demoData.bills);
      setCustomers(demoData.customers);
      setVendors(demoData.vendors);
    } finally {
      setLoading(false);
    }
  }, []);

  // Centralized double-entry posting executor
  const executePosting = useCallback(
    async (params: PostJournalEntryParams): Promise<{ entryId: string; invoiceId?: string; billId?: string }> => {
      const currentState = {
        accounts,
        journalEntries,
        invoices,
        bills,
        customers,
        vendors,
      };

      const result = executeAtomicPostingCore(params, currentState);

      // Update state
      setAccounts(result.updatedState.accounts);
      setJournalEntries(result.updatedState.journalEntries);
      setInvoices(result.updatedState.invoices);
      setBills(result.updatedState.bills);
      setCustomers(result.updatedState.customers);
      setVendors(result.updatedState.vendors);

      // Persist
      saveStateToStorage(
        result.updatedState.accounts,
        result.updatedState.journalEntries,
        result.updatedState.invoices,
        result.updatedState.bills,
        result.updatedState.customers,
        result.updatedState.vendors
      );

      return {
        entryId: result.entryId,
        invoiceId: result.invoiceId,
        billId: result.billId,
      };
    },
    [accounts, journalEntries, invoices, bills, customers, vendors]
  );

  // Connect global posting hook for standalone execution
  useEffect(() => {
    setGlobalPostingHandler(executePosting);
  }, [executePosting]);

  // Balance calculations across all journal entries
  let totalDebitsAllTime = 0;
  let totalCreditsAllTime = 0;
  let isBooksInBalance = true;

  if (journalEntries.length > 0) {
    for (const je of journalEntries) {
      const val = validateBalance(je.lines);
      totalDebitsAllTime += val.totalDebits;
      totalCreditsAllTime += val.totalCredits;
      if (!val.isBalanced) {
        isBooksInBalance = false;
      }
    }
  }

  const openNewTransaction = (mode: 'simple' | 'advanced' = 'simple') => {
    setTransactionModalInitialMode(mode);
    setIsTransactionModalOpen(true);
  };

  const handleSeedDemoData = async () => {
    setLoading(true);
    try {
      const demoData = generateSeedDemoData();
      setAccounts(demoData.accounts);
      setJournalEntries(demoData.journalEntries);
      setInvoices(demoData.invoices);
      setBills(demoData.bills);
      setCustomers(demoData.customers);
      setVendors(demoData.vendors);

      saveStateToStorage(
        demoData.accounts,
        demoData.journalEntries,
        demoData.invoices,
        demoData.bills,
        demoData.customers,
        demoData.vendors
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetToCleanBooks = () => {
    const cleanAccounts = createInitialAccounts();
    setAccounts(cleanAccounts);
    setJournalEntries([]);
    setInvoices([]);
    setBills([]);
    setCustomers([]);
    setVendors([]);

    saveStateToStorage(cleanAccounts, [], [], [], [], []);
  };

  const addNewCustomer = async (name: string, email: string, phone?: string, address?: string): Promise<Customer> => {
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name,
      email,
      phone: phone || '',
      address: address || '',
      openBalance: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [newCust, ...customers];
    setCustomers(updated);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}customers`, JSON.stringify(updated));
    } catch (e) {}
    return newCust;
  };

  const addNewVendor = async (name: string, email: string, phone?: string, address?: string): Promise<Vendor> => {
    const newVend: Vendor = {
      id: `vend-${Date.now()}`,
      name,
      email,
      phone: phone || '',
      address: address || '',
      openBalance: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [newVend, ...vendors];
    setVendors(updated);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}vendors`, JSON.stringify(updated));
    } catch (e) {}
    return newVend;
  };

  const addNewAccount = async (accountData: Omit<Account, 'id' | 'balance' | 'isSystemAccount'>) => {
    const newAcc: Account = {
      ...accountData,
      id: `acc-${accountData.code}-${Date.now()}`,
      balance: 0,
      isSystemAccount: false,
    };
    const updated = [...accounts, newAcc].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    setAccounts(updated);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}accounts`, JSON.stringify(updated));
    } catch (e) {}
  };

  return (
    <AccountingContext.Provider
      value={{
        companyId,
        company,
        loading,
        accounts,
        journalEntries,
        invoices,
        bills,
        customers,
        vendors,
        isBooksInBalance,
        totalDebitsAllTime,
        totalCreditsAllTime,
        activeView,
        setActiveView,
        isTransactionModalOpen,
        setIsTransactionModalOpen,
        transactionModalInitialMode,
        openNewTransaction,
        selectedJournalEntry,
        setSelectedJournalEntry,
        selectedAccountIdForLedger,
        setSelectedAccountIdForLedger,
        paymentTargetInvoice,
        setPaymentTargetInvoice,
        paymentTargetBill,
        setPaymentTargetBill,
        handleSeedDemoData,
        handleResetToCleanBooks,
        addNewCustomer,
        addNewVendor,
        addNewAccount,
        executePosting,
      }}
    >
      {children}
    </AccountingContext.Provider>
  );
};

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider');
  }
  return context;
};
