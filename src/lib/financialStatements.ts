import { Account, JournalEntry, LedgerEntry } from '../types';
import { round2 } from './postingEngine';

export interface BalanceSheetSection {
  title: string;
  items: { code: string; name: string; balance: number; subtype: string }[];
  total: number;
}

export interface BalanceSheetData {
  asOfDate: string;
  currentAssets: BalanceSheetSection;
  nonCurrentAssets: BalanceSheetSection;
  totalAssets: number;

  currentLiabilities: BalanceSheetSection;
  longTermLiabilities: BalanceSheetSection;
  totalLiabilities: number;

  equityItems: { code?: string; name: string; balance: number; isContra?: boolean }[];
  currentPeriodNetIncome: number;
  totalEquity: number;

  totalLiabilitiesAndEquity: number;
  balanceDifference: number;
  isBalanced: boolean;
}

export interface IncomeStatementItem {
  id: string;
  code: string;
  name: string;
  subtype: string;
  amount: number;
}

export interface IncomeStatementData {
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  revenues: IncomeStatementItem[];
  totalRevenue: number;
  cogs: IncomeStatementItem[];
  totalCogs: number;
  grossProfit: number;
  operatingExpenses: IncomeStatementItem[];
  totalOperatingExpenses: number;
  totalExpenses: number;
  netIncome: number;
}

export interface CashFlowLineItem {
  name: string;
  amount: number;
  note?: string;
}

export interface CashFlowStatementData {
  periodLabel: string;
  operatingActivities: {
    netIncome: number;
    adjustments: CashFlowLineItem[];
    workingCapitalChanges: CashFlowLineItem[];
    netOperatingCash: number;
  };
  investingActivities: {
    items: CashFlowLineItem[];
    netInvestingCash: number;
  };
  financingActivities: {
    items: CashFlowLineItem[];
    netFinancingCash: number;
  };
  netChangeInCash: number;
  beginningCash: number;
  endingCash: number;
  reconciledCash: number;
  cashDiscrepancy: number;
}

export interface EquityStatementData {
  periodLabel: string;
  beginningCapital: number;
  ownerContributions: number;
  netIncome: number;
  ownerDrawings: number;
  retainedEarnings: number;
  endingEquity: number;
}

/**
 * Filter ledger or journal entries by date range
 */
export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  const d = dateStr.slice(0, 10);
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

/**
 * Calculate the period-specific account balance from individual journal lines
 */
export function calculateAccountActivity(
  account: Account,
  journalEntries: JournalEntry[],
  startDate?: string,
  endDate?: string
): number {
  let balance = 0;
  for (const entry of journalEntries) {
    if (!isDateInRange(entry.date, startDate, endDate)) continue;
    for (const line of entry.lines) {
      if (line.accountId === account.id) {
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        if (account.normalBalance === 'debit') {
          balance += (debit - credit);
        } else {
          balance += (credit - debit);
        }
      }
    }
  }
  return round2(balance);
}

/**
 * 1. Build Income Statement
 */
export function generateIncomeStatement(
  accounts: Account[],
  journalEntries: JournalEntry[],
  startDate?: string,
  endDate?: string,
  periodLabel = 'Current Period'
): IncomeStatementData {
  const isFiltered = !!(startDate || endDate);

  const revenueAccounts = accounts.filter(a => a.type === 'Revenue');
  const expenseAccounts = accounts.filter(a => a.type === 'Expense');

  const revenues: IncomeStatementItem[] = revenueAccounts.map(acc => {
    const amount = isFiltered
      ? calculateAccountActivity(acc, journalEntries, startDate, endDate)
      : acc.balance;
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      subtype: acc.subtype,
      amount: round2(amount),
    };
  }).filter(item => isFiltered ? true : Math.abs(item.amount) >= 0 || true);

  const totalRevenue = round2(revenues.reduce((sum, r) => sum + r.amount, 0));

  const cogsAccounts = expenseAccounts.filter(a => a.subtype.toLowerCase().includes('cogs') || a.subtype.toLowerCase().includes('direct') || a.name.toLowerCase().includes('cost of goods'));
  const opExpAccounts = expenseAccounts.filter(a => !cogsAccounts.some(c => c.id === a.id));

  const cogs: IncomeStatementItem[] = cogsAccounts.map(acc => {
    const amount = isFiltered
      ? calculateAccountActivity(acc, journalEntries, startDate, endDate)
      : acc.balance;
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      subtype: acc.subtype,
      amount: round2(amount),
    };
  });

  const operatingExpenses: IncomeStatementItem[] = opExpAccounts.map(acc => {
    const amount = isFiltered
      ? calculateAccountActivity(acc, journalEntries, startDate, endDate)
      : acc.balance;
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      subtype: acc.subtype,
      amount: round2(amount),
    };
  });

  const totalCogs = round2(cogs.reduce((sum, c) => sum + c.amount, 0));
  const grossProfit = round2(totalRevenue - totalCogs);
  const totalOperatingExpenses = round2(operatingExpenses.reduce((sum, e) => sum + e.amount, 0));
  const totalExpenses = round2(totalCogs + totalOperatingExpenses);
  const netIncome = round2(totalRevenue - totalExpenses);

  return {
    periodLabel,
    startDate,
    endDate,
    revenues,
    totalRevenue,
    cogs,
    totalCogs,
    grossProfit,
    operatingExpenses,
    totalOperatingExpenses,
    totalExpenses,
    netIncome,
  };
}

/**
 * 2. Build Balance Sheet (Statement of Financial Position)
 */
export function generateBalanceSheet(
  accounts: Account[],
  journalEntries: JournalEntry[],
  asOfDate: string = new Date().toISOString().split('T')[0]
): BalanceSheetData {
  // Compute Net Income up to asOfDate
  const incomeStmt = generateIncomeStatement(accounts, journalEntries, undefined, asOfDate);
  const currentPeriodNetIncome = incomeStmt.netIncome;

  const currentAssetsItems: BalanceSheetSection['items'] = [];
  const nonCurrentAssetsItems: BalanceSheetSection['items'] = [];

  const currentLiabItems: BalanceSheetSection['items'] = [];
  const longTermLiabItems: BalanceSheetSection['items'] = [];

  const equityItemsList: { code?: string; name: string; balance: number; isContra?: boolean }[] = [];

  accounts.forEach(acc => {
    // If asOfDate is today/unrestricted, use acc.balance, or calculate balance up to asOfDate
    const balance = asOfDate
      ? calculateAccountActivity(acc, journalEntries, undefined, asOfDate)
      : acc.balance;

    if (acc.type === 'Asset') {
      const item = { code: acc.code, name: acc.name, balance: round2(balance), subtype: acc.subtype };
      if (acc.subtype.toLowerCase().includes('non-current') || acc.subtype.toLowerCase().includes('fixed') || acc.subtype.toLowerCase().includes('equipment')) {
        nonCurrentAssetsItems.push(item);
      } else {
        currentAssetsItems.push(item);
      }
    } else if (acc.type === 'Liability') {
      const item = { code: acc.code, name: acc.name, balance: round2(balance), subtype: acc.subtype };
      if (acc.subtype.toLowerCase().includes('long') || acc.subtype.toLowerCase().includes('loan')) {
        longTermLiabItems.push(item);
      } else {
        currentLiabItems.push(item);
      }
    } else if (acc.type === 'Equity') {
      if (acc.subtype.toLowerCase().includes('contra') || acc.normalBalance === 'debit' || acc.name.toLowerCase().includes('drawing')) {
        equityItemsList.push({
          code: acc.code,
          name: acc.name,
          balance: round2(balance),
          isContra: true,
        });
      } else {
        equityItemsList.push({
          code: acc.code,
          name: acc.name,
          balance: round2(balance),
          isContra: false,
        });
      }
    }
  });

  const totalCurrentAssets = round2(currentAssetsItems.reduce((s, i) => s + i.balance, 0));
  const totalNonCurrentAssets = round2(nonCurrentAssetsItems.reduce((s, i) => s + i.balance, 0));
  const totalAssets = round2(totalCurrentAssets + totalNonCurrentAssets);

  const totalCurrentLiab = round2(currentLiabItems.reduce((s, i) => s + i.balance, 0));
  const totalLongTermLiab = round2(longTermLiabItems.reduce((s, i) => s + i.balance, 0));
  const totalLiabilities = round2(totalCurrentLiab + totalLongTermLiab);

  // Sum equity items: standard credit equity positive, contra equity (drawings) negative + net income
  let sumEquityAccounts = 0;
  equityItemsList.forEach(eq => {
    if (eq.isContra) {
      sumEquityAccounts -= eq.balance;
    } else {
      sumEquityAccounts += eq.balance;
    }
  });

  const totalEquity = round2(sumEquityAccounts + currentPeriodNetIncome);
  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  const balanceDifference = round2(Math.abs(totalAssets - totalLiabilitiesAndEquity));
  const isBalanced = balanceDifference < 0.01;

  return {
    asOfDate,
    currentAssets: {
      title: 'Current Assets',
      items: currentAssetsItems,
      total: totalCurrentAssets,
    },
    nonCurrentAssets: {
      title: 'Non-Current / Fixed Assets',
      items: nonCurrentAssetsItems,
      total: totalNonCurrentAssets,
    },
    totalAssets,

    currentLiabilities: {
      title: 'Current Liabilities',
      items: currentLiabItems,
      total: totalCurrentLiab,
    },
    longTermLiabilities: {
      title: 'Long-Term Liabilities',
      items: longTermLiabItems,
      total: totalLongTermLiab,
    },
    totalLiabilities,

    equityItems: equityItemsList,
    currentPeriodNetIncome,
    totalEquity,

    totalLiabilitiesAndEquity,
    balanceDifference,
    isBalanced,
  };
}

/**
 * 3. Build Statement of Cash Flows (Indirect Method)
 */
export function generateCashFlowStatement(
  accounts: Account[],
  journalEntries: JournalEntry[],
  startDate?: string,
  endDate?: string,
  periodLabel = 'All Time'
): CashFlowStatementData {
  const incomeStmt = generateIncomeStatement(accounts, journalEntries, startDate, endDate, periodLabel);
  const netIncome = incomeStmt.netIncome;

  const operatingAdjustments: CashFlowLineItem[] = [];
  const workingCapitalChanges: CashFlowLineItem[] = [];
  const investingItems: CashFlowLineItem[] = [];
  const financingItems: CashFlowLineItem[] = [];

  // Reconcile working capital changes based on accounts
  accounts.forEach(acc => {
    const activity = calculateAccountActivity(acc, journalEntries, startDate, endDate);
    if (Math.abs(activity) < 0.001) return;

    if (acc.code === '1200' || acc.name.toLowerCase().includes('receivable')) {
      workingCapitalChanges.push({
        name: `Change in Accounts Receivable (${acc.name})`,
        amount: round2(-activity), // Increase in A/R decreases cash
        note: activity > 0 ? 'Increase in receivables reduces cash flow' : 'Collection of receivables increases cash flow',
      });
    } else if (acc.code === '1300' || acc.name.toLowerCase().includes('inventory')) {
      workingCapitalChanges.push({
        name: `Change in Inventory (${acc.name})`,
        amount: round2(-activity),
        note: activity > 0 ? 'Purchased inventory reduces operating cash' : 'Depleted inventory',
      });
    } else if (acc.code === '1400' || acc.name.toLowerCase().includes('prepaid')) {
      workingCapitalChanges.push({
        name: `Change in Prepaid Expenses`,
        amount: round2(-activity),
        note: 'Prepaid outflows',
      });
    } else if (acc.code === '2010' || acc.name.toLowerCase().includes('payable') && acc.type === 'Liability') {
      if (acc.subtype.toLowerCase().includes('current')) {
        workingCapitalChanges.push({
          name: `Change in Accounts Payable (${acc.name})`,
          amount: round2(activity), // Increase in A/P preserves cash
          note: activity > 0 ? 'Deferred vendor billings increase cash' : 'Vendor bill settlements reduce cash',
        });
      }
    } else if (acc.type === 'Asset' && (acc.subtype.toLowerCase().includes('non-current') || acc.subtype.toLowerCase().includes('equipment') || acc.code === '1500')) {
      investingItems.push({
        name: `Capital Expenditures / Equipment Purchases (${acc.name})`,
        amount: round2(-activity), // Buying asset is cash outflow
        note: 'Acquisition of property, plant, & equipment',
      });
    } else if (acc.code === '3010' || (acc.type === 'Equity' && acc.name.toLowerCase().includes('capital'))) {
      financingItems.push({
        name: `Owner Capital Injections / Financing (${acc.name})`,
        amount: round2(activity),
        note: 'Equity capital contributions',
      });
    } else if (acc.code === '3020' || (acc.type === 'Equity' && (acc.name.toLowerCase().includes('drawing') || acc.subtype.toLowerCase().includes('contra')))) {
      financingItems.push({
        name: `Owner Drawings & Distributions`,
        amount: round2(-activity),
        note: 'Distributions to equity holders',
      });
    } else if (acc.code === '2100' || (acc.type === 'Liability' && acc.subtype.toLowerCase().includes('long'))) {
      financingItems.push({
        name: `Proceeds / Repayments of Long-Term Loans (${acc.name})`,
        amount: round2(activity),
        note: 'Debt borrowings or principal repayments',
      });
    }
  });

  const sumWorkingCapital = round2(workingCapitalChanges.reduce((s, i) => s + i.amount, 0));
  const sumOperatingAdjustments = round2(operatingAdjustments.reduce((s, i) => s + i.amount, 0));
  const netOperatingCash = round2(netIncome + sumOperatingAdjustments + sumWorkingCapital);

  const netInvestingCash = round2(investingItems.reduce((s, i) => s + i.amount, 0));
  const netFinancingCash = round2(financingItems.reduce((s, i) => s + i.amount, 0));

  const netChangeInCash = round2(netOperatingCash + netInvestingCash + netFinancingCash);

  // Cash and Cash Equivalents (Cash + Bank accounts)
  const cashAccounts = accounts.filter(a => a.code === '1010' || a.code === '1020' || (a.type === 'Asset' && a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
  
  const endingCash = round2(cashAccounts.reduce((s, a) => s + a.balance, 0));
  const beginningCash = round2(endingCash - netChangeInCash);
  const reconciledCash = endingCash;
  const cashDiscrepancy = round2(Math.abs(reconciledCash - (beginningCash + netChangeInCash)));

  return {
    periodLabel,
    operatingActivities: {
      netIncome,
      adjustments: operatingAdjustments,
      workingCapitalChanges,
      netOperatingCash,
    },
    investingActivities: {
      items: investingItems,
      netInvestingCash,
    },
    financingActivities: {
      items: financingItems,
      netFinancingCash,
    },
    netChangeInCash,
    beginningCash,
    endingCash,
    reconciledCash,
    cashDiscrepancy,
  };
}

/**
 * 4. Build Statement of Changes in Equity
 */
export function generateEquityStatement(
  accounts: Account[],
  journalEntries: JournalEntry[],
  startDate?: string,
  endDate?: string,
  periodLabel = 'Current Period'
): EquityStatementData {
  const incomeStmt = generateIncomeStatement(accounts, journalEntries, startDate, endDate, periodLabel);
  const netIncome = incomeStmt.netIncome;

  const capitalAcc = accounts.find(a => a.code === '3010' || a.name.toLowerCase().includes('capital'));
  const drawingsAcc = accounts.find(a => a.code === '3020' || a.name.toLowerCase().includes('drawing'));
  const retainedAcc = accounts.find(a => a.code === '3900' || a.name.toLowerCase().includes('retained'));

  const ownerContributions = capitalAcc ? round2(capitalAcc.balance) : 0;
  const ownerDrawings = drawingsAcc ? round2(drawingsAcc.balance) : 0;
  const retainedEarnings = retainedAcc ? round2(retainedAcc.balance) : 0;
  const beginningCapital = 0; // standard zero starting point for new enterprise

  const endingEquity = round2(beginningCapital + ownerContributions + netIncome - ownerDrawings + retainedEarnings);

  return {
    periodLabel,
    beginningCapital,
    ownerContributions,
    netIncome,
    ownerDrawings,
    retainedEarnings,
    endingEquity,
  };
}
