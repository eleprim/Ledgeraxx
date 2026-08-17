import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateCashFlowStatement,
  generateEquityStatement,
} from '../lib/financialStatements';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Scale,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowDownUp,
  HelpCircle,
} from 'lucide-react';

export const StatementsView: React.FC = () => {
  const { accounts, journalEntries } = useAccounting();

  // Tab State
  const [statementTab, setStatementTab] = useState<'balance_sheet' | 'income_statement' | 'cash_flows' | 'equity'>('balance_sheet');

  // Date Range Filters
  const [periodPreset, setPeriodPreset] = useState<'all' | 'this_month' | 'this_quarter' | 'this_year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Calculate resolved start/end dates
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let resolvedStartDate: string | undefined;
  let resolvedEndDate: string | undefined;
  let periodLabel = 'All Time';

  if (periodPreset === 'this_month') {
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
    resolvedStartDate = firstDay;
    resolvedEndDate = lastDay;
    periodLabel = `This Month (${new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })})`;
  } else if (periodPreset === 'this_quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    resolvedStartDate = new Date(year, quarterStartMonth, 1).toISOString().split('T')[0];
    resolvedEndDate = new Date(year, quarterStartMonth + 3, 0).toISOString().split('T')[0];
    periodLabel = `Q${Math.floor(month / 3) + 1} ${year}`;
  } else if (periodPreset === 'this_year') {
    resolvedStartDate = `${year}-01-01`;
    resolvedEndDate = `${year}-12-31`;
    periodLabel = `Fiscal Year ${year}`;
  } else if (periodPreset === 'custom') {
    resolvedStartDate = customStartDate || undefined;
    resolvedEndDate = customEndDate || undefined;
    periodLabel = `Custom Range (${customStartDate || 'Start'} to ${customEndDate || 'Present'})`;
  }

  // Generate Statements
  const balanceSheet = generateBalanceSheet(accounts, journalEntries, resolvedEndDate);
  const incomeStmt = generateIncomeStatement(accounts, journalEntries, resolvedStartDate, resolvedEndDate, periodLabel);
  const cashFlowStmt = generateCashFlowStatement(accounts, journalEntries, resolvedStartDate, resolvedEndDate, periodLabel);
  const equityStmt = generateEquityStatement(accounts, journalEntries, resolvedStartDate, resolvedEndDate, periodLabel);

  // Export to CSV helper
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    if (statementTab === 'balance_sheet') {
      csvContent += "Statement of Financial Position (Balance Sheet)\n";
      csvContent += `As of Date: ${balanceSheet.asOfDate}\n\n`;
      csvContent += "Category,Account Code,Account Name,Balance\n";
      balanceSheet.currentAssets.items.forEach(i => csvContent += `Current Assets,${i.code},"${i.name}",${i.balance}\n`);
      csvContent += `Total Current Assets,,,${balanceSheet.currentAssets.total}\n`;
      balanceSheet.nonCurrentAssets.items.forEach(i => csvContent += `Non-Current Assets,${i.code},"${i.name}",${i.balance}\n`);
      csvContent += `Total Assets,,,${balanceSheet.totalAssets}\n\n`;
      balanceSheet.currentLiabilities.items.forEach(i => csvContent += `Current Liabilities,${i.code},"${i.name}",${i.balance}\n`);
      balanceSheet.longTermLiabilities.items.forEach(i => csvContent += `Long-Term Liabilities,${i.code},"${i.name}",${i.balance}\n`);
      csvContent += `Total Liabilities,,,${balanceSheet.totalLiabilities}\n\n`;
      balanceSheet.equityItems.forEach(i => csvContent += `Equity,${i.code || ''},"${i.name}",${i.balance}\n`);
      csvContent += `Current Period Net Income,,,${balanceSheet.currentPeriodNetIncome}\n`;
      csvContent += `Total Equity,,,${balanceSheet.totalEquity}\n`;
      csvContent += `Total Liabilities & Equity,,,${balanceSheet.totalLiabilitiesAndEquity}\n`;
    } else if (statementTab === 'income_statement') {
      csvContent += `Income Statement (Profit and Loss)\nPeriod: ${incomeStmt.periodLabel}\n\n`;
      csvContent += "Type,Code,Name,Amount\n";
      incomeStmt.revenues.forEach(r => csvContent += `Revenue,${r.code},"${r.name}",${r.amount}\n`);
      csvContent += `Total Revenues,,,${incomeStmt.totalRevenue}\n`;
      incomeStmt.cogs.forEach(c => csvContent += `COGS,${c.code},"${c.name}",${c.amount}\n`);
      csvContent += `Gross Profit,,,${incomeStmt.grossProfit}\n`;
      incomeStmt.operatingExpenses.forEach(e => csvContent += `Operating Expense,${e.code},"${e.name}",${e.amount}\n`);
      csvContent += `Total Operating Expenses,,,${incomeStmt.totalOperatingExpenses}\n`;
      csvContent += `Net Income,,,${incomeStmt.netIncome}\n`;
    } else if (statementTab === 'cash_flows') {
      csvContent += `Statement of Cash Flows (Indirect Method)\nPeriod: ${cashFlowStmt.periodLabel}\n\n`;
      csvContent += "Section,Item,Amount\n";
      csvContent += `Operating Activities,Net Income,${cashFlowStmt.operatingActivities.netIncome}\n`;
      cashFlowStmt.operatingActivities.workingCapitalChanges.forEach(w => csvContent += `Operating Working Capital,"${w.name}",${w.amount}\n`);
      csvContent += `Net Cash from Operating Activities,,${cashFlowStmt.operatingActivities.netOperatingCash}\n`;
      cashFlowStmt.investingActivities.items.forEach(i => csvContent += `Investing Activities,"${i.name}",${i.amount}\n`);
      csvContent += `Net Cash from Investing Activities,,${cashFlowStmt.investingActivities.netInvestingCash}\n`;
      cashFlowStmt.financingActivities.items.forEach(f => csvContent += `Financing Activities,"${f.name}",${f.amount}\n`);
      csvContent += `Net Cash from Financing Activities,,${cashFlowStmt.financingActivities.netFinancingCash}\n`;
      csvContent += `Net Change in Cash,,${cashFlowStmt.netChangeInCash}\n`;
      csvContent += `Ending Cash Balance,,${cashFlowStmt.endingCash}\n`;
    } else {
      csvContent += `Statement of Changes in Equity\nPeriod: ${equityStmt.periodLabel}\n\n`;
      csvContent += `Beginning Equity,,${equityStmt.beginningCapital}\n`;
      csvContent += `Owner Contributions,,${equityStmt.ownerContributions}\n`;
      csvContent += `Net Income for Period,,${equityStmt.netIncome}\n`;
      csvContent += `Less: Owner Drawings,,${equityStmt.ownerDrawings}\n`;
      csvContent += `Ending Owner Equity,,${equityStmt.endingEquity}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Financial_Statement_${statementTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Controls & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg sm:text-xl font-bold text-slate-100">Financial Reporting Engine</h1>
            </div>
            <p className="text-xs text-slate-400">
              Live double-entry calculations update the exact moment any transaction is committed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 4 Statement Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setStatementTab('balance_sheet')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              statementTab === 'balance_sheet'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Scale className="h-4 w-4" />
            <span>Balance Sheet</span>
          </button>

          <button
            onClick={() => setStatementTab('income_statement')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              statementTab === 'income_statement'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Income Statement (P&amp;L)</span>
          </button>

          <button
            onClick={() => setStatementTab('cash_flows')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              statementTab === 'cash_flows'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ArrowDownUp className="h-4 w-4" />
            <span>Statement of Cash Flows</span>
          </button>

          <button
            onClick={() => setStatementTab('equity')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
              statementTab === 'equity'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Changes in Equity</span>
          </button>
        </div>

        {/* Period Filter Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>Reporting Period:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
              {(['all', 'this_month', 'this_quarter', 'this_year', 'custom'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPeriodPreset(preset)}
                  className={`px-2.5 py-1 rounded text-xs capitalize transition ${
                    periodPreset === preset
                      ? 'bg-slate-800 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs"
              />
            </div>
          )}

          <div className="text-xs text-slate-400 font-medium">
            Active: <strong className="text-slate-200">{periodLabel}</strong>
          </div>
        </div>
      </div>

      {/* STATEMENT 1: BALANCE SHEET (Statement of Financial Position) */}
      {statementTab === 'balance_sheet' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          {/* Statement Title & Balance Check Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Statement of Financial Position (Balance Sheet)</h2>
              <p className="text-xs text-slate-400">As of {balanceSheet.asOfDate}</p>
            </div>

            {/* Real-time Mathematical Verification */}
            <div className="flex items-center gap-2">
              {balanceSheet.isBalanced ? (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Equation Holds: Assets = Liabilities + Equity</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  <span>Out of Balance: Variance of ${balanceSheet.balanceDifference.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: ASSETS */}
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Assets</h3>
                <span className="text-xs text-slate-400 font-mono">Normal Balance: Debit</span>
              </div>

              {/* Current Assets */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Current Assets</h4>
                <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                  {balanceSheet.currentAssets.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[11px]">#{item.code}</span>
                        <span className="text-slate-200">{item.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-100">${item.balance.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 text-xs font-bold text-slate-200">
                    <span>Total Current Assets</span>
                    <span className="font-mono text-emerald-400">${balanceSheet.currentAssets.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Non-Current / Fixed Assets */}
              {balanceSheet.nonCurrentAssets.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Non-Current &amp; Fixed Assets</h4>
                  <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                    {balanceSheet.nonCurrentAssets.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[11px]">#{item.code}</span>
                          <span className="text-slate-200">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-100">${item.balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-2.5 bg-slate-900/60 text-xs font-bold text-slate-200">
                      <span>Total Non-Current Assets</span>
                      <span className="font-mono text-emerald-400">${balanceSheet.nonCurrentAssets.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TOTAL ASSETS ROW */}
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/40 rounded-lg flex items-center justify-between text-sm font-bold text-emerald-300">
                <span>TOTAL ASSETS</span>
                <span className="font-mono text-base text-emerald-400">${balanceSheet.totalAssets.toFixed(2)}</span>
              </div>
            </div>

            {/* Right: LIABILITIES & EQUITY */}
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Liabilities &amp; Equity</h3>
                <span className="text-xs text-slate-400 font-mono">Normal Balance: Credit</span>
              </div>

              {/* Current Liabilities */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Current Liabilities</h4>
                <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                  {balanceSheet.currentLiabilities.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[11px]">#{item.code}</span>
                        <span className="text-slate-200">{item.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-100">${item.balance.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 text-xs font-bold text-slate-200">
                    <span>Total Current Liabilities</span>
                    <span className="font-mono text-amber-400">${balanceSheet.currentLiabilities.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Long Term Liabilities */}
              {balanceSheet.longTermLiabilities.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Long-Term Liabilities</h4>
                  <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                    {balanceSheet.longTermLiabilities.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[11px]">#{item.code}</span>
                          <span className="text-slate-200">{item.name}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-100">${item.balance.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-2.5 bg-slate-900/60 text-xs font-bold text-slate-200">
                      <span>Total Long-Term Liabilities</span>
                      <span className="font-mono text-amber-400">${balanceSheet.longTermLiabilities.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TOTAL LIABILITIES ROW */}
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                <span>TOTAL LIABILITIES</span>
                <span className="font-mono text-amber-400">${balanceSheet.totalLiabilities.toFixed(2)}</span>
              </div>

              {/* EQUITY */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Owner's Equity</h4>
                <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                  {balanceSheet.equityItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        {item.code && <span className="text-slate-500 font-mono text-[11px]">#{item.code}</span>}
                        <span className="text-slate-200">{item.name}</span>
                        {item.isContra && <span className="text-[10px] text-rose-400 font-medium">(Contra)</span>}
                      </div>
                      <span className={`font-mono font-semibold ${item.isContra ? 'text-rose-400' : 'text-slate-100'}`}>
                        {item.isContra ? `-$${item.balance.toFixed(2)}` : `$${item.balance.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                  {/* Current Period Net Income included in Equity */}
                  <div className="flex items-center justify-between p-2.5 text-xs bg-slate-900/40">
                    <span className="text-emerald-400 font-medium">+ Current Period Net Income</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      ${balanceSheet.currentPeriodNetIncome.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 text-xs font-bold text-slate-200">
                    <span>Total Owner's Equity</span>
                    <span className="font-mono text-sky-400">${balanceSheet.totalEquity.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* TOTAL LIABILITIES AND EQUITY ROW */}
              <div className="p-3.5 bg-sky-950/30 border border-sky-500/40 rounded-lg flex items-center justify-between text-sm font-bold text-sky-300">
                <span>TOTAL LIABILITIES &amp; EQUITY</span>
                <span className="font-mono text-base text-sky-400">${balanceSheet.totalLiabilitiesAndEquity.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATEMENT 2: INCOME STATEMENT (Profit and Loss) */}
      {statementTab === 'income_statement' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Income Statement (Profit &amp; Loss)</h2>
              <p className="text-xs text-slate-400">{incomeStmt.periodLabel}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block uppercase">Net Profit Margin</span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                {incomeStmt.totalRevenue > 0
                  ? `${((incomeStmt.netIncome / incomeStmt.totalRevenue) * 100).toFixed(1)}%`
                  : '—'}
              </span>
            </div>
          </div>

          <div className="space-y-6 max-w-3xl mx-auto">
            {/* 1. REVENUE */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Revenues &amp; Operating Income</h3>
              <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                {incomeStmt.revenues.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono">#{r.code}</span>
                      <span className="text-slate-200 font-medium">{r.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-slate-100">${r.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-slate-900/70 text-xs font-bold text-emerald-300">
                  <span>TOTAL REVENUE</span>
                  <span className="font-mono text-sm">${incomeStmt.totalRevenue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 2. COGS & GROSS PROFIT */}
            {incomeStmt.cogs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cost of Goods Sold (COGS)</h3>
                <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                  {incomeStmt.cogs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono">#{c.code}</span>
                        <span className="text-slate-200">{c.name}</span>
                      </div>
                      <span className="font-mono text-rose-400">${c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-slate-900/70 text-xs font-bold text-slate-200">
                    <span>GROSS PROFIT</span>
                    <span className="font-mono text-emerald-400">${incomeStmt.grossProfit.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. OPERATING EXPENSES */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">Operating Expenses</h3>
              <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800">
                {incomeStmt.operatingExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-mono">#{e.code}</span>
                      <span className="text-slate-200">{e.name}</span>
                    </div>
                    <span className="font-mono text-rose-400">${e.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-slate-900/70 text-xs font-bold text-rose-300">
                  <span>TOTAL OPERATING EXPENSES</span>
                  <span className="font-mono text-sm">${incomeStmt.totalOperatingExpenses.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* 4. NET INCOME FINAL ROW */}
            <div className={`p-4 rounded-xl border flex items-center justify-between text-base font-bold ${
              incomeStmt.netIncome >= 0
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
            }`}>
              <div>
                <span>NET INCOME / (NET LOSS)</span>
                <p className="text-xs font-normal text-slate-400 mt-0.5">Total Revenue − Total Expenses</p>
              </div>
              <span className="text-xl font-mono">${incomeStmt.netIncome.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* STATEMENT 3: STATEMENT OF CASH FLOWS */}
      {statementTab === 'cash_flows' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Statement of Cash Flows (Indirect Method)</h2>
              <p className="text-xs text-slate-400">{cashFlowStmt.periodLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                Reconciliation: ${cashFlowStmt.endingCash.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Operating Activities */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Cash Flows from Operating Activities</h3>
              <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                <div className="flex items-center justify-between p-3">
                  <span className="font-semibold text-slate-200">Net Income</span>
                  <span className="font-mono font-bold text-slate-100">${cashFlowStmt.operatingActivities.netIncome.toFixed(2)}</span>
                </div>

                {cashFlowStmt.operatingActivities.workingCapitalChanges.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 pl-6">
                    <div>
                      <span className="text-slate-300">{item.name}</span>
                      {item.note && <span className="text-[10px] text-slate-500 block">{item.note}</span>}
                    </div>
                    <span className={`font-mono font-semibold ${item.amount < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {item.amount < 0 ? `-$${Math.abs(item.amount).toFixed(2)}` : `$${item.amount.toFixed(2)}`}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 bg-slate-900/70 font-bold text-emerald-300">
                  <span>Net Cash from Operating Activities</span>
                  <span className="font-mono text-sm">${cashFlowStmt.operatingActivities.netOperatingCash.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">Cash Flows from Investing Activities</h3>
              <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                {cashFlowStmt.investingActivities.items.length === 0 ? (
                  <div className="p-3 text-slate-500 italic">No capital expenditures in this period.</div>
                ) : (
                  cashFlowStmt.investingActivities.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3">
                      <div>
                        <span className="text-slate-300">{item.name}</span>
                        {item.note && <span className="text-[10px] text-slate-500 block">{item.note}</span>}
                      </div>
                      <span className={`font-mono font-semibold ${item.amount < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                        {item.amount < 0 ? `-$${Math.abs(item.amount).toFixed(2)}` : `$${item.amount.toFixed(2)}`}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between p-3 bg-slate-900/70 font-bold text-sky-300">
                  <span>Net Cash from Investing Activities</span>
                  <span className="font-mono text-sm">${cashFlowStmt.investingActivities.netInvestingCash.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Financing Activities */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Cash Flows from Financing Activities</h3>
              <div className="divide-y divide-slate-800/60 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                {cashFlowStmt.financingActivities.items.length === 0 ? (
                  <div className="p-3 text-slate-500 italic">No debt/equity financing changes in this period.</div>
                ) : (
                  cashFlowStmt.financingActivities.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3">
                      <div>
                        <span className="text-slate-300">{item.name}</span>
                        {item.note && <span className="text-[10px] text-slate-500 block">{item.note}</span>}
                      </div>
                      <span className={`font-mono font-semibold ${item.amount < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                        {item.amount < 0 ? `-$${Math.abs(item.amount).toFixed(2)}` : `$${item.amount.toFixed(2)}`}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between p-3 bg-slate-900/70 font-bold text-amber-300">
                  <span>Net Cash from Financing Activities</span>
                  <span className="font-mono text-sm">${cashFlowStmt.financingActivities.netFinancingCash.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Net Cash Change & Reconciliation Summary */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Net Increase / (Decrease) in Cash</span>
                <span className="font-mono text-emerald-400 font-bold">${cashFlowStmt.netChangeInCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Beginning Cash Balance</span>
                <span className="font-mono">${cashFlowStmt.beginningCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-bold text-slate-100">
                <span>Ending Cash Balance (Bank + Cash on Hand)</span>
                <span className="font-mono text-emerald-400">${cashFlowStmt.endingCash.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATEMENT 4: STATEMENT OF CHANGES IN EQUITY */}
      {statementTab === 'equity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-100">Statement of Changes in Owner's Equity</h2>
            <p className="text-xs text-slate-400">{equityStmt.periodLabel}</p>
          </div>

          <div className="max-w-2xl mx-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 text-xs">
            <div className="flex justify-between p-3.5 text-slate-300">
              <span>Beginning Owner's Equity</span>
              <span className="font-mono font-semibold">${equityStmt.beginningCapital.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3.5 text-emerald-400">
              <span>+ Owner Capital Injections &amp; Contributions</span>
              <span className="font-mono font-semibold">${equityStmt.ownerContributions.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3.5 text-emerald-400">
              <span>+ Net Income for the Period</span>
              <span className="font-mono font-semibold">${equityStmt.netIncome.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-3.5 text-rose-400">
              <span>− Owner Drawings &amp; Distributions</span>
              <span className="font-mono font-semibold">-${equityStmt.ownerDrawings.toFixed(2)}</span>
            </div>
            {equityStmt.retainedEarnings > 0 && (
              <div className="flex justify-between p-3.5 text-slate-300">
                <span>+ Retained Earnings</span>
                <span className="font-mono font-semibold">${equityStmt.retainedEarnings.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between p-4 bg-slate-900/90 text-sm font-bold text-sky-400">
              <span>ENDING OWNER'S EQUITY</span>
              <span className="font-mono text-base">${equityStmt.endingEquity.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
