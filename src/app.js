import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  initializeFirestore, getFirestore, collection, doc, setDoc, getDocs, onSnapshot,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
  projectId: "sunlit-transducer-24dh4",
  appId: "1:192857120140:web:c7b74030ef25820116caa9",
  apiKey: "AIzaSyBkupQD1L2nXT6Y7iQRc1l-666t_Lju8Fs",
  authDomain: "sunlit-transducer-24dh4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-ledger-a046526f-0b9b-4e14-9773-15ec7845da99",
  storageBucket: "sunlit-transducer-24dh4.firebasestorage.app",
  messagingSenderId: "192857120140"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
const storage = getStorage(app);

// Application State
let currentUser = null;
let accounts = [];
let journalEntries = [];
let invoices = [];
let bills = [];
let customers = [];
let vendors = [];

// Statement Period State (Period Filtering for Financial Statements)
let stmtPeriodPreset = 'all'; // 'all' | 'this_month' | 'this_quarter' | 'this_year' | 'last_month' | 'custom'
let stmtCustomStartDate = '';
let stmtCustomEndDate = '';

export function getStmtDateRangeBounds() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (stmtPeriodPreset === 'all') {
    return {
      start: null,
      end: null,
      startStr: '',
      endStr: todayStr,
      label: 'All Time (Cumulative)'
    };
  }

  if (stmtPeriodPreset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return {
      start,
      end,
      startStr,
      endStr,
      label: `This Month (${start.toLocaleString('default', { month: 'short' })} ${start.getFullYear()})`
    };
  }

  if (stmtPeriodPreset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return {
      start,
      end,
      startStr,
      endStr,
      label: `Last Month (${start.toLocaleString('default', { month: 'short' })} ${start.getFullYear()})`
    };
  }

  if (stmtPeriodPreset === 'this_quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), (q + 1) * 3, 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return {
      start,
      end,
      startStr,
      endStr,
      label: `This Quarter (Q${q + 1} ${now.getFullYear()})`
    };
  }

  if (stmtPeriodPreset === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return {
      start,
      end,
      startStr,
      endStr,
      label: `This Year (${now.getFullYear()})`
    };
  }

  if (stmtPeriodPreset === 'custom') {
    const startStr = stmtCustomStartDate || '1970-01-01';
    const endStr = stmtCustomEndDate || todayStr;
    return {
      start: new Date(startStr),
      end: new Date(endStr),
      startStr,
      endStr,
      label: `Custom: ${startStr} to ${endStr}`
    };
  }

  return { start: null, end: null, startStr: '', endStr: todayStr, label: 'All Time' };
}

// Helper to test if a journal entry line belongs to an account
export function lineMatchesAccount(line, acc) {
  if (!line || !acc) return false;
  if (line.accountId && (line.accountId === acc.id || line.accountId === acc.code)) return true;
  if (line.accountCode && line.accountCode === acc.code) return true;
  if (line.accountName && acc.name && line.accountName.toLowerCase().trim() === acc.name.toLowerCase().trim()) return true;
  return false;
}

// Dynamic Account Balance Recalculation from all Journal Entries
export function recalculateAllAccountBalances() {
  accounts.forEach(acc => {
    let bal = Number(acc.openingBalance) || 0;
    const isDebitNormal = acc.category === 'Asset' || acc.category === 'Expense' || (acc.normalBalance && acc.normalBalance.toLowerCase() === 'debit');

    journalEntries.forEach(je => {
      if (Array.isArray(je.lines)) {
        je.lines.forEach(line => {
          if (lineMatchesAccount(line, acc)) {
            const deb = Number(line.debit) || 0;
            const cred = Number(line.credit) || 0;
            if (isDebitNormal) {
              bal += (deb - cred);
            } else {
              bal += (cred - deb);
            }
          }
        });
      }
    });
    acc.balance = round2(bal);
  });
}

// Compute Account Balance as of a specific date (cumulative)
export function computeAccountBalanceAsOf(acc, asOfDateStr) {
  let bal = Number(acc.openingBalance) || 0;
  const isDebitNormal = acc.category === 'Asset' || acc.category === 'Expense' || (acc.normalBalance && acc.normalBalance.toLowerCase() === 'debit');

  journalEntries.forEach(je => {
    if (!asOfDateStr || (je.date && je.date <= asOfDateStr)) {
      if (Array.isArray(je.lines)) {
        je.lines.forEach(line => {
          if (lineMatchesAccount(line, acc)) {
            const deb = Number(line.debit) || 0;
            const cred = Number(line.credit) || 0;
            if (isDebitNormal) {
              bal += (deb - cred);
            } else {
              bal += (cred - deb);
            }
          }
        });
      }
    }
  });
  return round2(bal);
}

// Compute Account Activity within a period (from start date to end date)
export function computeAccountActivityForPeriod(acc, startStr, endStr) {
  let activity = 0;
  journalEntries.forEach(je => {
    const inRange = (!startStr || (je.date && je.date >= startStr)) &&
                    (!endStr || (je.date && je.date <= endStr));
    if (inRange && Array.isArray(je.lines)) {
      je.lines.forEach(line => {
        if (lineMatchesAccount(line, acc)) {
          const deb = Number(line.debit) || 0;
          const cred = Number(line.credit) || 0;
          if (acc.category === 'Revenue') {
            activity += (cred - deb);
          } else if (acc.category === 'Expense') {
            activity += (deb - cred);
          } else if (acc.category === 'Asset') {
            activity += (deb - cred);
          } else { // Liability, Equity
            activity += (cred - deb);
          }
        }
      });
    }
  });
  return round2(activity);
}

// Multi-Currency Static Matrix & Company Settings
export const CURRENCIES = [
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', sample: '₱ 1,250.00' },
  { code: 'USD', symbol: '$', name: 'US Dollar', sample: '$ 1,250.00' },
  { code: 'EUR', symbol: '€', name: 'Euro', sample: '€ 1,250.00' },
  { code: 'GBP', symbol: '£', name: 'British Pound', sample: '£ 1,250.00' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', sample: '¥ 1,250' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', sample: 'S$ 1,250.00' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', sample: 'C$ 1,250.00' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', sample: 'A$ 1,250.00' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', sample: 'HK$ 1,250.00' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', sample: 'CHF 1,250.00' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', sample: 'AED 1,250.00' }
];

let companySettings = {
  companyName: 'Ledger Enterprise',
  baseCurrency: 'PHP'
};

export function getCurrencyObj(code) {
  const match = CURRENCIES.find(c => c.code === (code || companySettings.baseCurrency));
  return match || { code: code || 'PHP', symbol: code || '₱', name: code || 'Currency', sample: '0.00' };
}

export function getCurrencySymbol(code) {
  return getCurrencyObj(code).symbol;
}

export function fmt(n, curCode) {
  const code = curCode || companySettings.baseCurrency || 'PHP';
  const sym = getCurrencySymbol(code);
  const num = Number(n) || 0;
  const isJpy = code === 'JPY';
  const formattedNum = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: isJpy ? 0 : 2,
    maximumFractionDigits: isJpy ? 0 : 2
  });
  if (num < 0) {
    return `-${sym} ${formattedNum}`;
  }
  return `${sym} ${formattedNum}`;
}

export const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

export function getEntryTimestamp(entry) {
  if (entry?.createdAt) {
    if (typeof entry.createdAt.toMillis === 'function') return entry.createdAt.toMillis();
    if (entry.createdAt.seconds) return entry.createdAt.seconds * 1000 + (entry.createdAt.nanoseconds || 0) / 1000000;
    const t = new Date(entry.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (entry?.date) {
    const t = new Date(entry.date).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

export function formatDateTime(entry) {
  let d = null;
  if (entry?.createdAt) {
    if (typeof entry.createdAt.toDate === 'function') {
      d = entry.createdAt.toDate();
    } else if (entry.createdAt.seconds) {
      d = new Date(entry.createdAt.seconds * 1000 + (entry.createdAt.nanoseconds || 0) / 1000000);
    } else if (typeof entry.createdAt === 'string' || typeof entry.createdAt === 'number') {
      d = new Date(entry.createdAt);
    }
  }
  if (!d || isNaN(d.getTime())) {
    if (entry?.date) {
      d = new Date(entry.date);
    } else {
      d = new Date();
    }
  }

  // Format: Aug 17, 2026 · 3:45:12 PM
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  return `${datePart} · ${timePart}`;
}

// Chart.js Instances & UI Filter State
let cashFlowChartInstance = null;
let salesChartInstance = null;
let dateRangePreset = '30d';
let customStartDate = '';
let customEndDate = '';
let cfChartPeriodOverride = null; // null = sync with header default; or 'this-week', 'this-month', '30d', 'this-quarter', 'this-year'
let salesChartPeriodOverride = null; // null = sync with header default; or 'this-week', 'this-month', '30d', 'this-quarter', 'this-year'
let salesViewMode = 'trend'; // 'trend' | 'customer'
let activeView = 'dashboard';
let simpleTxType = 'sale';
let simplePayMethod = 'paid_now';
let coaSearchQuery = '';
let coaCategoryFilter = 'all';
let coaShowDeactivated = false;
let coaCollapsedSections = {};
let journalSearchQuery = '';
let journalSourceFilter = 'all';
let ledgerSearchQuery = '';
let expandedJournalRows = new Set();

// COA Configuration & Standard Archetypes
const CATEGORY_SUBTYPES = {
  Asset: ['Current Asset', 'Cash and Cash Equivalents', 'Accounts Receivable', 'Inventory', 'Non-Current Asset', 'Property, Plant & Equipment'],
  Liability: ['Current Liability', 'Accounts Payable', 'Credit Card', 'Short-Term Debt', 'Non-Current Liability', 'Long-Term Debt'],
  Equity: ["Owner's Capital", "Owner's Drawings", 'Retained Earnings', 'Common Stock'],
  Revenue: ['Operating Revenue', 'Sales Revenue', 'Service Revenue', 'Other Income', 'Interest Income'],
  Expense: ['Operating Expense', 'Payroll & Salaries', 'Rent & Utilities', 'Marketing & Ads', 'Cost of Goods Sold (COGS)', 'Depreciation Expense', 'General & Admin']
};

const CATEGORY_NORMAL_BALANCE = {
  Asset: 'Debit',
  Liability: 'Credit',
  Equity: 'Credit',
  Revenue: 'Credit',
  Expense: 'Debit'
};

const SYSTEM_ACCOUNT_CODES = new Set(['1010', '1020', '1030', '1200', '2010', '3010', '3020', '3900', '4010', '4020', '4030', '5010', '5020', '5030']);

const COA_CATEGORIES_CONFIG = [
  { name: 'Asset', label: 'Assets', normal: 'Debit', range: '1000 - 1999', desc: 'Economic resources expected to produce future economic value' },
  { name: 'Liability', label: 'Liabilities', normal: 'Credit', range: '2000 - 2999', desc: 'Financial debts and contractual obligations owed to external parties' },
  { name: 'Equity', label: 'Equity', normal: 'Credit', range: '3000 - 3999', desc: "Residual interest in company assets after deducting all liabilities" },
  { name: 'Revenue', label: 'Revenue', normal: 'Credit', range: '4000 - 4999', desc: 'Gross inflows of economic benefits from primary business operations' },
  { name: 'Expense', label: 'Expenses', normal: 'Debit', range: '5000 - 5999', desc: 'Costs incurred in the daily operational conduct of business activities' }
];

const DEFAULT_CHART_OF_ACCOUNTS = [
  { code: '1010', name: 'Operating Cash & Checking', category: 'Asset', subtype: 'Cash and Cash Equivalents', normalBalance: 'Debit', system: true, currency: 'PHP', description: 'Primary business operational bank account' },
  { code: '1020', name: 'Petty Cash', category: 'Asset', subtype: 'Cash and Cash Equivalents', normalBalance: 'Debit', system: true, currency: 'PHP', description: 'Small day-to-day office cash buffer' },
  { code: '1030', name: 'USD Bank Account', category: 'Asset', subtype: 'Cash and Cash Equivalents', normalBalance: 'Debit', system: true, currency: 'USD', description: 'US Dollar operational account for foreign clients' },
  { code: '1200', name: 'Accounts Receivable (A/R)', category: 'Asset', subtype: 'Accounts Receivable', normalBalance: 'Debit', system: true, currency: 'PHP', description: 'Uncollected customer invoices billed on account' },
  { code: '1500', name: 'Office Equipment & Computers', category: 'Asset', subtype: 'Property, Plant & Equipment', normalBalance: 'Debit', system: false, currency: 'PHP', description: 'Hardware, workstations and office technology' },
  { code: '2010', name: 'Accounts Payable (A/P)', category: 'Liability', subtype: 'Accounts Payable', normalBalance: 'Credit', system: true, currency: 'PHP', description: 'Unpaid vendor bills received on credit terms' },
  { code: '2020', name: 'Corporate Credit Card', category: 'Liability', subtype: 'Credit Card', normalBalance: 'Credit', system: false, currency: 'PHP', description: 'Company charge card revolving credit line' },
  { code: '3010', name: "Owner's Capital", category: 'Equity', subtype: "Owner's Capital", normalBalance: 'Credit', system: true, currency: 'PHP', description: 'Initial seed capital invested by company founder' },
  { code: '3020', name: "Owner's Drawings", category: 'Equity', subtype: "Owner's Drawings", normalBalance: 'Debit', system: true, currency: 'PHP', description: 'Personal draws and distributions taken by owners' },
  { code: '3900', name: 'Retained Earnings', category: 'Equity', subtype: 'Retained Earnings', normalBalance: 'Credit', system: true, currency: 'PHP', description: 'Accumulated historical net income retained in business' },
  { code: '4010', name: 'Professional Services Revenue', category: 'Revenue', subtype: 'Service Revenue', normalBalance: 'Credit', system: true, currency: 'PHP', description: 'Income derived from client advisory and engineering' },
  { code: '4020', name: 'Product Sales Revenue', category: 'Revenue', subtype: 'Sales Revenue', normalBalance: 'Credit', system: true, currency: 'PHP', description: 'Gross sales of merchandise and physical goods' },
  { code: '4030', name: 'International SaaS Revenue (USD)', category: 'Revenue', subtype: 'Service Revenue', normalBalance: 'Credit', system: true, currency: 'USD', description: 'Global recurring software subscriptions billed in USD' },
  { code: '5010', name: 'Software & Cloud Subscriptions', category: 'Expense', subtype: 'Operating Expense', normalBalance: 'Debit', system: true, currency: 'PHP', description: 'SaaS platforms, servers, and developer tool licenses' },
  { code: '5020', name: 'Advertising & Marketing', category: 'Expense', subtype: 'Marketing & Ads', normalBalance: 'Debit', system: true, currency: 'PHP', description: 'Paid search, branding, design and marketing spend' },
  { code: '5030', name: 'Rent & Workspace Utilities', category: 'Expense', subtype: 'Rent & Utilities', normalBalance: 'Debit', system: true, currency: 'PHP', description: 'Physical office lease, electricity, internet' },
  { code: '5040', name: 'Professional & Legal Fees', category: 'Expense', subtype: 'General & Admin', normalBalance: 'Debit', system: false, currency: 'PHP', description: 'Audit, legal counsel, and compliance fees' }
];

// Auth Lifecycle & Initial Setup
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const authScreen = document.getElementById('auth-screen');
    const appShell = document.getElementById('app-shell');
    if (authScreen) authScreen.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');
    updateUserBadge(user);
    initCompanyData(user.uid);
  } else if (!currentUser) {
    const authScreen = document.getElementById('auth-screen');
    const appShell = document.getElementById('app-shell');
    if (authScreen) authScreen.classList.remove('hidden');
    if (appShell) appShell.classList.add('hidden');
  }
});

function updateUserBadge(user) {
  const isAnon = user.isAnonymous;
  const name = user.displayName || (isAnon ? 'Dilan (Demo)' : (user.email ? user.email.split('@')[0] : 'Founder'));
  const email = user.email || (isAnon ? 'demo@ledger.internal' : 'founder@ledger.app');
  const initial = name.charAt(0).toUpperCase();

  const nameEl = document.getElementById('user-display-name');
  const emailEl = document.getElementById('user-display-email');
  const avatarEl = document.getElementById('user-avatar-initials');
  const topAvatarEl = document.getElementById('top-user-avatar');
  const greetingEl = document.getElementById('page-greeting');

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = initial;
  if (topAvatarEl) topAvatarEl.textContent = initial;
  if (greetingEl) greetingEl.textContent = `Hi, ${name}!`;
}

// Fallback to Instant Demo Mode
export function enterDemoWorkspace() {
  const fakeUser = {
    uid: 'demo-workspace-user',
    displayName: 'Dilan (Demo)',
    email: 'founder@ledger.app',
    isAnonymous: true
  };
  currentUser = fakeUser;
  const authScreen = document.getElementById('auth-screen');
  const appShell = document.getElementById('app-shell');
  if (authScreen) authScreen.classList.add('hidden');
  if (appShell) appShell.classList.remove('hidden');
  updateUserBadge(fakeUser);
  initCompanyData(fakeUser.uid);
}

// Auth Handlers
const btnGoogle = document.getElementById('btn-google-login');
if (btnGoogle) {
  btnGoogle.addEventListener('click', async () => {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) errBox.classList.add('hidden');

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.warn("Google Auth error caught:", err);
      if (errBox) {
        errBox.innerHTML = `
          <div class="space-y-2">
            <p class="font-semibold text-rose-700">Google Sign-In Notice:</p>
            <p class="text-[11px] text-zinc-600 leading-relaxed">
              Google authentication popups are restricted within embedded iframe sandboxes. You can continue instantly with the demo workspace or open the app in a new tab.
            </p>
            <button id="btn-err-fallback-demo" class="mt-2 w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-sm">rocket_launch</span>
              <span>Open Demo Workspace Now</span>
            </button>
          </div>
        `;
        errBox.classList.remove('hidden');

        const fallbackBtn = document.getElementById('btn-err-fallback-demo');
        if (fallbackBtn) {
          fallbackBtn.addEventListener('click', () => {
            enterDemoWorkspace();
          });
        }
      }
    }
  });
}

const btnGuest = document.getElementById('btn-guest-login');
if (btnGuest) {
  btnGuest.addEventListener('click', async () => {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn("Anonymous auth fallback to local demo:", err);
      enterDemoWorkspace();
    }
  });
}

const btnSignout = document.getElementById('btn-signout');
if (btnSignout) {
  btnSignout.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    currentUser = null;
    const authScreen = document.getElementById('auth-screen');
    const appShell = document.getElementById('app-shell');
    if (authScreen) authScreen.classList.remove('hidden');
    if (appShell) appShell.classList.add('hidden');
  });
}

// Ensure default in-memory accounts if Firestore is unavailable
function seedInMemoryAccounts() {
  if (accounts.length === 0) {
    accounts = DEFAULT_CHART_OF_ACCOUNTS.map((a, idx) => ({
      id: `acc-local-${a.code}-${idx}`,
      ...a,
      active: true,
      balance: 0,
      currency: a.currency || companySettings.baseCurrency || 'PHP',
      createdAt: new Date().toISOString()
    }));
    accounts.sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0));
  }
}

// Real-time Firestore Listeners & Database Initializer
function initCompanyData(uid) {
  const companyPath = `companies/${uid}`;

  // 1. Settings listener
  try {
    onSnapshot(doc(db, `${companyPath}/settings/general`), (snapshot) => {
      if (snapshot.exists()) {
        companySettings = { ...companySettings, ...snapshot.data() };
      } else {
        try {
          setDoc(doc(db, `${companyPath}/settings/general`), {
            companyName: 'Ledger Enterprise',
            baseCurrency: 'PHP',
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        } catch (e) {}
      }
      renderCompanySettings();
      renderAllViews();
    }, (err) => {
      console.warn("Settings listener error (using defaults):", err);
      renderCompanySettings();
      renderAllViews();
    });
  } catch (e) {
    renderCompanySettings();
  }

  // 2. Accounts listener
  try {
    onSnapshot(collection(db, `${companyPath}/accounts`), async (snapshot) => {
      if (snapshot.empty) {
        // Seed Chart of Accounts
        try {
          const batch = writeBatch(db);
          DEFAULT_CHART_OF_ACCOUNTS.forEach((acc) => {
            const refDoc = doc(collection(db, `${companyPath}/accounts`));
            batch.set(refDoc, {
              ...acc,
              active: true,
              balance: 0,
              currency: acc.currency || companySettings.baseCurrency || 'PHP',
              createdAt: serverTimestamp()
            });
          });
          await batch.commit();
        } catch (batchErr) {
          console.warn("Batch seed error, populating memory:", batchErr);
          seedInMemoryAccounts();
          renderAllViews();
          populateModalDropdowns();
        }
        return;
      }

      accounts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      accounts.sort((a, b) => (Number(a.code) || 0) - (Number(b.code) || 0));
      renderAllViews();
      populateModalDropdowns();
    }, (err) => {
      console.warn("Accounts listener error, using in-memory state:", err);
      seedInMemoryAccounts();
      renderAllViews();
      populateModalDropdowns();
    });
  } catch (e) {
    seedInMemoryAccounts();
    renderAllViews();
    populateModalDropdowns();
  }

  // 3. General Journal Entries listener
  try {
    onSnapshot(collection(db, `${companyPath}/journalEntries`), (snapshot) => {
      journalEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      journalEntries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      renderAllViews();
    }, (err) => {
      console.warn("Journal listener error:", err);
      renderAllViews();
    });
  } catch (e) {}

  // 4. Invoices (A/R) listener
  try {
    onSnapshot(collection(db, `${companyPath}/invoices`), (snapshot) => {
      invoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      invoices.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      renderInvoices();
      renderDashboardMetrics();
    }, (err) => {
      console.warn("Invoices listener error:", err);
    });
  } catch (e) {}

  // 5. Bills (A/P) listener
  try {
    onSnapshot(collection(db, `${companyPath}/bills`), (snapshot) => {
      bills = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      bills.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      renderBills();
      renderDashboardMetrics();
    }, (err) => {
      console.warn("Bills listener error:", err);
    });
  } catch (e) {}

  // 6. Customers Directory listener
  try {
    onSnapshot(collection(db, `${companyPath}/customers`), (snapshot) => {
      customers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDirectory();
      populateModalDropdowns();
    }, (err) => {
      console.warn("Customers listener error:", err);
    });
  } catch (e) {}

  // 7. Vendors Directory listener
  try {
    onSnapshot(collection(db, `${companyPath}/vendors`), (snapshot) => {
      vendors = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDirectory();
      populateModalDropdowns();
    }, (err) => {
      console.warn("Vendors listener error:", err);
    });
  } catch (e) {}
}

// Master Render Trigger
export function renderAllViews() {
  recalculateAllAccountBalances();
  renderDashboard();
  renderStatements();
  renderJournal();
  renderLedgers();
  renderChartOfAccounts();
  renderDirectory();
  renderInvoices();
  renderBills();
  renderCompanySettings();
}

// Atomic Double-Entry Transaction Engine
export async function executeAtomicPosting({ date, memo, sourceType, lines, invoiceData, billData, fileAttachment, currency }) {
  if (!currentUser) throw new Error("Authentication required");

  // Multi-Currency tag for the transaction
  const txCurrency = currency || companySettings.baseCurrency || 'PHP';

  // 1. Verify Strict Double-Entry Balance
  let totalDebits = 0;
  let totalCredits = 0;

  lines.forEach(line => {
    totalDebits += Number(line.debit) || 0;
    totalCredits += Number(line.credit) || 0;
  });

  totalDebits = round2(totalDebits);
  totalCredits = round2(totalCredits);

  if (Math.abs(totalDebits - totalCredits) > 0.009) {
    throw new Error(`Double-Entry Imbalance: Debits (${totalDebits}) must equal Credits (${totalCredits})`);
  }

  // 2. Handle File Attachment if present
  let receiptUrl = '';
  if (fileAttachment) {
    try {
      const storageRef = ref(storage, `receipts/${currentUser.uid}/${Date.now()}_${fileAttachment.name}`);
      const snap = await uploadBytes(storageRef, fileAttachment);
      receiptUrl = await getDownloadURL(snap.ref);
    } catch (err) {
      console.warn("Storage upload warning:", err);
    }
  }

  const batch = writeBatch(db);
  const companyPath = `companies/${currentUser.uid}`;

  // 3. Create General Journal Entry
  const jeRef = doc(collection(db, `${companyPath}/journalEntries`));
  const jeDoc = {
    date: date || new Date().toISOString().split('T')[0],
    memo: memo || 'Transaction posted',
    sourceType: sourceType || 'Manual',
    currency: txCurrency,
    total: totalDebits,
    lines: lines.map(l => ({
      accountId: l.accountId,
      accountName: l.accountName,
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
      memo: l.memo || ''
    })),
    receiptUrl,
    createdAt: serverTimestamp()
  };
  batch.set(jeRef, jeDoc);

  // 4. Update T-Account Balances & Subledgers
  for (const line of lines) {
    const acc = accounts.find(a => a.id === line.accountId);
    if (!acc) continue;

    const accDocRef = doc(db, `${companyPath}/accounts/${acc.id}`);
    const normal = acc.normalBalance || (acc.category === 'Asset' || acc.category === 'Expense' ? 'Debit' : 'Credit');
    const netChange = normal === 'Debit'
      ? (Number(line.debit) || 0) - (Number(line.credit) || 0)
      : (Number(line.credit) || 0) - (Number(line.debit) || 0);

    const newBalance = round2((acc.balance || 0) + netChange);
    batch.update(accDocRef, {
      balance: newBalance,
      updatedAt: serverTimestamp()
    });

    // Write Ledger Entry Record
    const ledgerRef = doc(collection(db, `${companyPath}/accounts/${acc.id}/ledger`));
    batch.set(ledgerRef, {
      journalEntryId: jeRef.id,
      date: jeDoc.date,
      memo: line.memo || jeDoc.memo,
      debit: round2(line.debit || 0),
      credit: round2(line.credit || 0),
      runningBalance: newBalance,
      currency: acc.currency || txCurrency,
      createdAt: serverTimestamp()
    });
  }

  // 5. Write Invoices (A/R) or Bills (A/P) records if applicable
  if (invoiceData) {
    const invRef = doc(collection(db, `${companyPath}/invoices`));
    batch.set(invRef, {
      ...invoiceData,
      journalEntryId: jeRef.id,
      currency: txCurrency,
      createdAt: serverTimestamp()
    });
  }

  if (billData) {
    const billRef = doc(collection(db, `${companyPath}/bills`));
    batch.set(billRef, {
      ...billData,
      journalEntryId: jeRef.id,
      currency: txCurrency,
      createdAt: serverTimestamp()
    });
  }

  try {
    await batch.commit();
  } catch (commitErr) {
    console.warn("Firestore batch commit warning, updating local memory state:", commitErr);
    // Optimistic in-memory update
    journalEntries.unshift({
      id: jeRef.id || `je-local-${Date.now()}`,
      ...jeDoc,
      createdAt: new Date().toISOString()
    });

    lines.forEach(line => {
      const acc = accounts.find(a => a.id === line.accountId);
      if (acc) {
        const normal = acc.normalBalance || (acc.category === 'Asset' || acc.category === 'Expense' ? 'Debit' : 'Credit');
        const netChange = normal === 'Debit'
          ? (Number(line.debit) || 0) - (Number(line.credit) || 0)
          : (Number(line.credit) || 0) - (Number(line.debit) || 0);
        acc.balance = round2((acc.balance || 0) + netChange);
      }
    });

    if (invoiceData) {
      invoices.unshift({
        id: `inv-local-${Date.now()}`,
        ...invoiceData,
        journalEntryId: jeRef.id || `je-local-${Date.now()}`,
        currency: txCurrency,
        createdAt: new Date().toISOString()
      });
    }

    if (billData) {
      bills.unshift({
        id: `bill-local-${Date.now()}`,
        ...billData,
        journalEntryId: jeRef.id || `je-local-${Date.now()}`,
        currency: txCurrency,
        createdAt: new Date().toISOString()
      });
    }

    renderAllViews();
  }
}

// Multi-Currency Formatting & Rendering Utilities
function groupAmountsByCurrency(items, getAmountFn, getCurrencyFn) {
  const result = {};
  items.forEach(item => {
    const amt = getAmountFn(item);
    const cur = getCurrencyFn(item) || companySettings.baseCurrency || 'PHP';
    result[cur] = round2((result[cur] || 0) + amt);
  });
  return result;
}

// Renders multi-currency totals nicely as a formatted badge/list
function renderMultiCurrencyTotals(totalsObj) {
  const currencies = Object.keys(totalsObj).filter(c => Math.abs(totalsObj[c]) > 0.001);
  if (currencies.length === 0) {
    return `<span class="font-mono">${fmt(0, companySettings.baseCurrency)}</span>`;
  }
  if (currencies.length === 1) {
    const cur = currencies[0];
    return `<span class="font-mono">${fmt(totalsObj[cur], cur)}</span>`;
  }
  return currencies.map(cur => `<span class="inline-block px-2 py-0.5 rounded-lg bg-zinc-100 font-mono text-xs font-bold text-zinc-900 border border-zinc-200">${fmt(totalsObj[cur], cur)}</span>`).join(' ');
}

// -------------------------------------------------------------
// DASHBOARD & CHART.JS ANALYTICS ENGINE (PERIOD & GRANULARITY SENSITIVE)
// -------------------------------------------------------------
function getDateRangeBounds() {
  const now = new Date();
  let start = new Date();
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (dateRangePreset === 'this-week' || dateRangePreset === 'week' || dateRangePreset === '7d' || dateRangePreset === 'today') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  } else if (dateRangePreset === 'this-month' || dateRangePreset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (dateRangePreset === '30d') {
    start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  } else if (dateRangePreset === 'this-quarter' || dateRangePreset === 'quarter' || dateRangePreset === '90d') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
  } else if (dateRangePreset === 'this-year' || dateRangePreset === 'year' || dateRangePreset === 'ytd' || dateRangePreset === 'all') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else if (customStartDate && customEndDate) {
    const [sy, sm, sd] = customStartDate.split('-').map(Number);
    const [ey, em, ed] = customEndDate.split('-').map(Number);
    start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
  }

  return { start, end };
}

function getChartDateRangeBounds(overridePreset) {
  const effectivePreset = (overridePreset && overridePreset !== 'default') ? overridePreset : dateRangePreset;
  const now = new Date();
  let start = new Date();
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (effectivePreset === 'this-week' || effectivePreset === 'week' || effectivePreset === '7d' || effectivePreset === 'today') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  } else if (effectivePreset === 'this-month' || effectivePreset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (effectivePreset === '30d') {
    start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  } else if (effectivePreset === 'this-quarter' || effectivePreset === 'quarter' || effectivePreset === '90d') {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
  } else if (effectivePreset === 'this-year' || effectivePreset === 'year' || effectivePreset === 'ytd' || effectivePreset === 'all') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else if (effectivePreset === 'custom' && customStartDate && customEndDate) {
    const [sy, sm, sd] = customStartDate.split('-').map(Number);
    const [ey, em, ed] = customEndDate.split('-').map(Number);
    start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
  }

  return { start, end, effectivePreset };
}

function getPriorPeriodBounds(start, end) {
  const durationMs = end.getTime() - start.getTime() + 1;
  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(priorEnd.getTime() - durationMs + 1);
  return { priorStart, priorEnd };
}

function getAdaptiveGranularity(start, end, preset) {
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  if (preset === 'this-week' || preset === 'week' || preset === '7d' || preset === 'today') {
    return 'day';
  }
  if (preset === 'this-month' || preset === 'month') {
    return 'day';
  }
  if (preset === '30d') {
    return diffDays > 45 ? 'week' : 'day';
  }
  if (preset === 'this-quarter' || preset === 'quarter' || preset === '90d') {
    return 'week';
  }
  if (preset === 'this-year' || preset === 'year' || preset === 'ytd' || preset === 'all') {
    return 'month';
  }

  // Custom range rule: By day if <=31 days, by week if <=90 days, by month if longer
  if (diffDays <= 31) return 'day';
  if (diffDays <= 90) return 'week';
  return 'month';
}

function buildTimeBuckets(start, end, granularity) {
  const buckets = [];

  if (granularity === 'day') {
    const curr = new Date(start);
    curr.setHours(0, 0, 0, 0);
    const endLimit = new Date(end);
    endLimit.setHours(23, 59, 59, 999);

    while (curr <= endLimit) {
      const y = curr.getFullYear();
      const m = curr.getMonth();
      const d = curr.getDate();
      const bStart = new Date(y, m, d, 0, 0, 0, 0);
      const bEnd = new Date(y, m, d, 23, 59, 59, 999);
      const label = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullLabel = curr.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      buckets.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        label,
        fullLabel,
        start: bStart,
        end: bEnd,
        cashIn: 0,
        cashOut: 0,
        revenue: 0,
        customers: {}
      });
      curr.setDate(curr.getDate() + 1);
    }
  } else if (granularity === 'week') {
    let curr = new Date(start);
    let weekIdx = 1;
    while (curr <= end) {
      const bStart = new Date(curr);
      bStart.setHours(0, 0, 0, 0);
      const bEnd = new Date(curr.getTime() + 6 * 24 * 60 * 60 * 1000);
      bEnd.setHours(23, 59, 59, 999);
      const actualEnd = bEnd > end ? new Date(end) : bEnd;

      const sStr = bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const eStr = actualEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const label = `Wk ${weekIdx} (${sStr})`;
      const fullLabel = `Week ${weekIdx} (${sStr} - ${eStr}, ${actualEnd.getFullYear()})`;

      buckets.push({
        key: `wk-${weekIdx}-${bStart.toISOString().slice(0, 10)}`,
        label,
        fullLabel,
        start: bStart,
        end: actualEnd,
        cashIn: 0,
        cashOut: 0,
        revenue: 0,
        customers: {}
      });
      weekIdx++;
      curr = new Date(bEnd.getTime() + 1000);
    }
  } else {
    // month
    let curr = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0, 0);
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    while (curr.getFullYear() < endYear || (curr.getFullYear() === endYear && curr.getMonth() <= endMonth)) {
      const y = curr.getFullYear();
      const m = curr.getMonth();
      const bStart = new Date(y, m, 1, 0, 0, 0, 0);
      const bEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const label = curr.toLocaleDateString('en-US', { month: 'short' });
      const fullLabel = curr.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      buckets.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        label,
        fullLabel,
        start: bStart,
        end: bEnd,
        cashIn: 0,
        cashOut: 0,
        revenue: 0,
        customers: {}
      });
      curr.setMonth(curr.getMonth() + 1);
    }
  }

  return buckets;
}

function renderDashboard() {
  renderDashboardMetrics();
  renderCashFlowChart();
  renderSalesChart();
  renderRecentJournalFeed();
}

function renderDashboardMetrics() {
  const { start, end } = getDateRangeBounds();

  // Filter entries in range
  const filteredJEs = journalEntries.filter(je => {
    const d = new Date(je.date || 0);
    return d >= start && d <= end;
  });

  // Calculate Net Operating Income (Revenue accounts - Expense accounts)
  let totalRevenue = 0;
  let totalExpense = 0;

  const revAccounts = new Set(accounts.filter(a => a.category === 'Revenue').map(a => a.id));
  const expAccounts = new Set(accounts.filter(a => a.category === 'Expense').map(a => a.id));
  const cashAccounts = new Set(accounts.filter(a => a.category === 'Asset' && (a.subtype?.includes('Cash') || a.subtype?.includes('Bank') || a.code?.startsWith('10'))).map(a => a.id));
  const arAccounts = new Set(accounts.filter(a => a.subtype === 'Accounts Receivable' || a.code === '1200').map(a => a.id));
  const apAccounts = new Set(accounts.filter(a => a.subtype === 'Accounts Payable' || a.code === '2010').map(a => a.id));

  filteredJEs.forEach(je => {
    (je.lines || []).forEach(line => {
      if (revAccounts.has(line.accountId)) {
        totalRevenue += (Number(line.credit) || 0) - (Number(line.debit) || 0);
      }
      if (expAccounts.has(line.accountId)) {
        totalExpense += (Number(line.debit) || 0) - (Number(line.credit) || 0);
      }
    });
  });

  const netIncome = round2(totalRevenue - totalExpense);

  // Overall Cash & AR / AP Balances
  let cashTotal = 0;
  let arTotal = 0;
  let apTotal = 0;

  accounts.forEach(a => {
    if (cashAccounts.has(a.id)) cashTotal += (Number(a.balance) || 0);
    if (arAccounts.has(a.id)) arTotal += (Number(a.balance) || 0);
    if (apAccounts.has(a.id)) apTotal += (Number(a.balance) || 0);
  });

  const heroNet = document.getElementById('hero-net-income');
  const heroCount = document.getElementById('hero-entry-count');
  const heroSales = document.getElementById('hero-total-sales');
  const subCash = document.getElementById('sub-cash-val');
  const subAr = document.getElementById('sub-ar-val');
  const subAp = document.getElementById('sub-ap-val');

  const baseCur = companySettings.baseCurrency || 'PHP';

  if (heroNet) heroNet.textContent = fmt(netIncome, baseCur);
  if (heroCount) heroCount.textContent = filteredJEs.length.toString();
  if (heroSales) heroSales.textContent = fmt(totalRevenue, baseCur);
  if (subCash) subCash.textContent = fmt(cashTotal, baseCur);
  if (subAr) subAr.textContent = fmt(arTotal, baseCur);
  if (subAp) subAp.textContent = fmt(apTotal, baseCur);

  // Bento mini cards
  const openInvoices = invoices.filter(i => i.status !== 'Paid');
  const openBills = bills.filter(b => b.status !== 'Paid');
  const bentoInv = document.getElementById('bento-open-inv-text');
  const bentoBills = document.getElementById('bento-open-bills-text');

  if (bentoInv) bentoInv.textContent = `${openInvoices.length} unpaid invoices`;
  if (bentoBills) bentoBills.textContent = `${openBills.length} open payables`;
}

function renderCashFlowChart() {
  const canvas = document.getElementById('cashFlowChart');
  if (!canvas) return;

  const { start, end, effectivePreset } = getChartDateRangeBounds(cfChartPeriodOverride);
  const { priorStart, priorEnd } = getPriorPeriodBounds(start, end);
  const granularity = getAdaptiveGranularity(start, end, effectivePreset);
  const buckets = buildTimeBuckets(start, end, granularity);

  const cashAccounts = new Set(accounts.filter(a => a.category === 'Asset' && (a.subtype?.includes('Cash') || a.subtype?.includes('Bank') || a.code?.startsWith('10'))).map(a => a.id));

  let totalIn = 0;
  let totalOut = 0;

  // Aggregate current period into buckets
  journalEntries.forEach(je => {
    const d = new Date(je.date || 0);
    if (d < start || d > end) return;

    const bucket = buckets.find(b => d >= b.start && d <= b.end);
    (je.lines || []).forEach(l => {
      if (cashAccounts.has(l.accountId)) {
        const deb = Number(l.debit) || 0;
        const cred = Number(l.credit) || 0;
        if (bucket) {
          bucket.cashIn += deb;
          bucket.cashOut += cred;
        }
        totalIn += deb;
        totalOut += cred;
      }
    });
  });

  const totalNet = round2(totalIn - totalOut);

  // Compute Prior Period net cash for comparison
  let priorIn = 0;
  let priorOut = 0;
  journalEntries.forEach(je => {
    const d = new Date(je.date || 0);
    if (d >= priorStart && d <= priorEnd) {
      (je.lines || []).forEach(l => {
        if (cashAccounts.has(l.accountId)) {
          priorIn += Number(l.debit) || 0;
          priorOut += Number(l.credit) || 0;
        }
      });
    }
  });
  const priorNet = round2(priorIn - priorOut);

  // Calculate Trend Indicator (plain text, black/grayscale only)
  let netGrowthPct = 0;
  if (priorNet !== 0) {
    netGrowthPct = ((totalNet - priorNet) / Math.abs(priorNet)) * 100;
  } else if (totalNet > 0) {
    netGrowthPct = 100;
  } else if (totalNet < 0) {
    netGrowthPct = -100;
  }

  const baseCur = companySettings.baseCurrency || 'PHP';
  const sym = getCurrencySymbol(baseCur);

  const elIn = document.getElementById('chart-cf-in');
  const elOut = document.getElementById('chart-cf-out');
  const elNet = document.getElementById('chart-cf-net');
  const elBadge = document.getElementById('cf-bucket-badge');
  const elTrend = document.getElementById('cf-trend-badge');
  const elCustomBadge = document.getElementById('cf-custom-badge');
  const elSelect = document.getElementById('cf-chart-period-select');
  const elFooter = document.getElementById('cf-date-footer');

  if (elIn) elIn.textContent = fmt(totalIn, baseCur);
  if (elOut) elOut.textContent = fmt(totalOut, baseCur);
  if (elNet) elNet.textContent = fmt(totalNet, baseCur);
  if (elBadge) {
    elBadge.textContent = granularity === 'day' ? 'By Day' : (granularity === 'week' ? 'By Week' : 'By Month');
  }

  // Update Custom override badge
  const isOverridden = cfChartPeriodOverride && cfChartPeriodOverride !== 'default' && cfChartPeriodOverride !== dateRangePreset;
  if (elCustomBadge) {
    if (isOverridden) {
      elCustomBadge.classList.remove('hidden');
    } else {
      elCustomBadge.classList.add('hidden');
    }
  }

  // Sync dropdown value
  if (elSelect && document.activeElement !== elSelect) {
    elSelect.value = cfChartPeriodOverride || 'default';
  }

  // Plain-text trend comparison label (strictly grayscale / black text)
  if (elTrend) {
    if (netGrowthPct > 0.05) {
      elTrend.textContent = `▲ ${netGrowthPct.toFixed(1)}% vs prior`;
    } else if (netGrowthPct < -0.05) {
      elTrend.textContent = `▼ ${Math.abs(netGrowthPct).toFixed(1)}% vs prior`;
    } else {
      elTrend.textContent = `— 0.0% vs prior`;
    }
    elTrend.className = `text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200`;
  }

  if (elFooter) {
    const sStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const eStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    elFooter.textContent = `${sStr} - ${eStr}`;
  }

  // Calculate Running Net Balance per bucket
  let runningNet = 0;
  const runningNetData = [];
  const inData = [];
  const outData = [];
  const labels = [];
  const fullLabels = [];
  const netValues = [];

  buckets.forEach(b => {
    labels.push(b.label);
    fullLabels.push(b.fullLabel);
    inData.push(round2(b.cashIn));
    outData.push(round2(b.cashOut));
    const netB = round2(b.cashIn - b.cashOut);
    netValues.push(netB);
    runningNet = round2(runningNet + netB);
    runningNetData.push(runningNet);
  });

  // Calculate Moving Average for Net Cash (if range is 28+ days or buckets >= 6)
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const showSMA = diffDays >= 28 && buckets.length >= 6;
  const smaData = [];
  if (showSMA) {
    const windowSize = Math.min(3, buckets.length);
    for (let i = 0; i < netValues.length; i++) {
      const wStart = Math.max(0, i - windowSize + 1);
      const slice = netValues.slice(wStart, i + 1);
      const avg = slice.reduce((a, c) => a + c, 0) / slice.length;
      smaData.push(round2(avg));
    }
  }

  if (cashFlowChartInstance) {
    cashFlowChartInstance.destroy();
  }

  // Strictly grayscale combo datasets: Cash In (solid dark gray #18181b), Cash Out (light gray #a1a1aa), Net Cash (solid black #000000 line on top)
  const datasets = [
    {
      type: 'bar',
      label: `Cash In`,
      data: inData,
      backgroundColor: '#18181b',
      hoverBackgroundColor: '#09090b',
      borderRadius: 4,
      borderSkipped: false,
      order: 2
    },
    {
      type: 'bar',
      label: `Cash Out`,
      data: outData,
      backgroundColor: '#a1a1aa',
      hoverBackgroundColor: '#71717a',
      borderRadius: 4,
      borderSkipped: false,
      order: 2
    },
    {
      type: 'line',
      label: `Running Net Cash`,
      data: runningNetData,
      borderColor: '#000000',
      backgroundColor: 'transparent',
      pointBackgroundColor: '#000000',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      tension: 0.25,
      fill: false,
      showLine: true,
      spanGaps: true,
      order: 0
    }
  ];

  if (showSMA) {
    datasets.push({
      type: 'line',
      label: `Net Cash Trend (Moving Avg)`,
      data: smaData,
      borderColor: '#71717a',
      borderDash: [5, 5],
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      fill: false,
      showLine: true,
      spanGaps: true,
      order: 0
    });
  }

  cashFlowChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            font: { size: 10, family: 'JetBrains Mono' },
            color: '#27272a'
          }
        },
        tooltip: {
          backgroundColor: '#18181b',
          titleFont: { size: 11, family: 'Plus Jakarta Sans', weight: 'bold' },
          bodyFont: { size: 10, family: 'JetBrains Mono' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              return fullLabels[idx] || items[0].label;
            },
            label: (ctx) => {
              const val = ctx.raw;
              return ` ${ctx.dataset.label}: ${fmt(val, baseCur)}`;
            },
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const netBucket = netValues[idx];
              return ` Net Period Cash: ${fmt(netBucket, baseCur)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10, family: 'JetBrains Mono' },
            color: '#52525b',
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 12
          }
        },
        y: {
          grid: { color: '#f4f4f5' },
          ticks: {
            font: { size: 10, family: 'JetBrains Mono' },
            color: '#52525b',
            callback: (v) => `${sym} ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`
          }
        }
      }
    }
  });
}

function renderSalesChart() {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;

  const { start, end, effectivePreset } = getChartDateRangeBounds(salesChartPeriodOverride);
  const { priorStart, priorEnd } = getPriorPeriodBounds(start, end);
  const granularity = getAdaptiveGranularity(start, end, effectivePreset);
  const buckets = buildTimeBuckets(start, end, granularity);

  const revAccounts = new Set(accounts.filter(a => a.category === 'Revenue').map(a => a.id));

  let totalSales = 0;
  const customerMap = {};

  journalEntries.forEach(je => {
    const d = new Date(je.date || 0);
    if (d < start || d > end) return;

    const bucket = buckets.find(b => d >= b.start && d <= b.end);
    let jeRevenue = 0;

    (je.lines || []).forEach(l => {
      if (revAccounts.has(l.accountId)) {
        const net = (Number(l.credit) || 0) - (Number(l.debit) || 0);
        if (net > 0) {
          jeRevenue += net;
        }
      }
    });

    if (jeRevenue > 0) {
      if (bucket) bucket.revenue += jeRevenue;
      totalSales += jeRevenue;

      // Extract customer name
      let custName = je.invoiceData?.customerName || '';
      if (!custName && je.memo) {
        if (je.memo.includes('Sale:') || je.memo.includes('Invoice:')) {
          const parts = je.memo.split(/[:–-]/);
          if (parts.length > 1) custName = parts[1].trim();
        }
      }
      if (!custName) custName = 'Direct Client';
      customerMap[custName] = (customerMap[custName] || 0) + jeRevenue;
    }
  });

  // Prior period revenue
  let priorSales = 0;
  journalEntries.forEach(je => {
    const d = new Date(je.date || 0);
    if (d >= priorStart && d <= priorEnd) {
      (je.lines || []).forEach(l => {
        if (revAccounts.has(l.accountId)) {
          const net = (Number(l.credit) || 0) - (Number(l.debit) || 0);
          if (net > 0) priorSales += net;
        }
      });
    }
  });

  // Calculate Growth Rate vs Prior Period (plain text, black/grayscale only)
  let salesGrowthPct = 0;
  if (priorSales !== 0) {
    salesGrowthPct = ((totalSales - priorSales) / Math.abs(priorSales)) * 100;
  } else if (totalSales > 0) {
    salesGrowthPct = 100;
  }

  const baseCur = companySettings.baseCurrency || 'PHP';
  const sym = getCurrencySymbol(baseCur);

  const elSales = document.getElementById('chart-sales-total');
  const elPrior = document.getElementById('chart-sales-prior');
  const elGrowth = document.getElementById('sales-growth-badge');
  const elCustomBadge = document.getElementById('sales-custom-badge');
  const elSelect = document.getElementById('sales-chart-period-select');
  const elFooter = document.getElementById('sales-date-footer');

  if (elSales) elSales.textContent = fmt(totalSales, baseCur);
  if (elPrior) elPrior.textContent = fmt(priorSales, baseCur);

  // Update Custom override badge
  const isOverridden = salesChartPeriodOverride && salesChartPeriodOverride !== 'default' && salesChartPeriodOverride !== dateRangePreset;
  if (elCustomBadge) {
    if (isOverridden) {
      elCustomBadge.classList.remove('hidden');
    } else {
      elCustomBadge.classList.add('hidden');
    }
  }

  // Sync dropdown value
  if (elSelect && document.activeElement !== elSelect) {
    elSelect.value = salesChartPeriodOverride || 'default';
  }

  // Plain-text trend comparison label (strictly grayscale / black text)
  if (elGrowth) {
    if (salesGrowthPct > 0.05) {
      elGrowth.textContent = `▲ ${salesGrowthPct.toFixed(1)}% vs prior`;
    } else if (salesGrowthPct < -0.05) {
      elGrowth.textContent = `▼ ${Math.abs(salesGrowthPct).toFixed(1)}% vs prior`;
    } else {
      elGrowth.textContent = `— 0.0% vs prior`;
    }
    elGrowth.className = `text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200`;
  }

  if (elFooter) {
    const sStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const eStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    elFooter.textContent = `${sStr} - ${eStr}`;
  }

  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  if (salesViewMode === 'customer') {
    // Render Top 5 Customers Horizontal Bar Chart with varying grayscale shades
    const sortedCusts = Object.keys(customerMap)
      .map(name => ({ name, revenue: customerMap[name] }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    if (sortedCusts.length === 0) {
      sortedCusts.push({ name: 'No sales recorded in period', revenue: 0 });
    }

    const grayPalette = ['#18181b', '#3f3f46', '#52525b', '#71717a', '#a1a1aa'];

    salesChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sortedCusts.map(c => c.name),
        datasets: [
          {
            label: `Revenue (${sym})`,
            data: sortedCusts.map(c => round2(c.revenue)),
            backgroundColor: sortedCusts.map((_, i) => grayPalette[i % grayPalette.length]),
            hoverBackgroundColor: '#09090b',
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { size: 11, family: 'Plus Jakarta Sans', weight: 'bold' },
            bodyFont: { size: 10, family: 'JetBrains Mono' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` Sales: ${fmt(ctx.raw, baseCur)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f4f4f5' },
            ticks: {
              font: { size: 10, family: 'JetBrains Mono' },
              color: '#52525b',
              callback: (v) => `${sym} ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`
            }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10, family: 'Plus Jakarta Sans' }, color: '#27272a' }
          }
        }
      }
    });
  } else {
    // Mode "By Period" (Trend combo: Bar + Line Overlay in Grayscale)
    const labels = [];
    const fullLabels = [];
    const revData = [];

    buckets.forEach(b => {
      labels.push(b.label);
      fullLabels.push(b.fullLabel);
      revData.push(round2(b.revenue));
    });

    // 3-Period Moving Average Trendline
    const trendData = [];
    for (let i = 0; i < revData.length; i++) {
      const wStart = Math.max(0, i - 2);
      const slice = revData.slice(wStart, i + 1);
      const avg = slice.reduce((a, c) => a + c, 0) / slice.length;
      trendData.push(round2(avg));
    }

    salesChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: `Sales Revenue`,
            data: revData,
            backgroundColor: '#27272a',
            hoverBackgroundColor: '#18181b',
            borderRadius: 4,
            order: 2
          },
          {
            type: 'line',
            label: `Sales Trend (3-Period Moving Avg)`,
            data: trendData,
            borderColor: '#000000',
            backgroundColor: 'transparent',
            pointBackgroundColor: '#000000',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2.5,
            tension: 0.25,
            fill: false,
            showLine: true,
            spanGaps: true,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              font: { size: 10, family: 'JetBrains Mono' },
              color: '#27272a'
            }
          },
          tooltip: {
            backgroundColor: '#18181b',
            titleFont: { size: 11, family: 'Plus Jakarta Sans', weight: 'bold' },
            bodyFont: { size: 10, family: 'JetBrains Mono' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return fullLabels[idx] || items[0].label;
              },
              label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw, baseCur)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10, family: 'JetBrains Mono' },
              color: '#52525b',
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            grid: { color: '#f4f4f5' },
            ticks: {
              font: { size: 10, family: 'JetBrains Mono' },
              color: '#52525b',
              callback: (v) => `${sym} ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`
            }
          }
        }
      }
    });
  }
}

function renderRecentJournalFeed() {
  const container = document.getElementById('dashboard-recent-entries');
  if (!container) return;

  const recent = journalEntries.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = `
      <div class="col-span-3 p-6 text-center text-zinc-400 bg-white rounded-3xl border border-zinc-200/70 text-xs">
        No transactions recorded yet. Click <strong>+ Record Entry</strong> to post your first journal transaction!
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(je => {
    const cur = je.currency || companySettings.baseCurrency || 'PHP';
    return `
      <div class="bg-white rounded-3xl p-5 border border-zinc-200/70 shadow-sm space-y-3 flex flex-col justify-between">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] font-mono font-bold text-zinc-400 block">${je.date} &middot; ${je.sourceType || 'Journal'}</span>
            <h4 class="font-bold text-xs text-zinc-900 line-clamp-1 mt-0.5">${je.memo}</h4>
          </div>
          <span class="font-mono font-extrabold text-xs text-zinc-900 bg-zinc-100 px-2.5 py-1 rounded-xl shrink-0">
            ${fmt(je.total || 0, cur)}
          </span>
        </div>
        <div class="space-y-1 text-[11px] font-mono text-zinc-600 border-t border-zinc-100 pt-2.5">
          ${(je.lines || []).slice(0, 2).map(l => `
            <div class="flex justify-between">
              <span class="truncate max-w-[140px]">${l.accountName}</span>
              <span>${l.debit > 0 ? `Dr ${fmt(l.debit, cur)}` : `Cr ${fmt(l.credit, cur)}`}</span>
            </div>
          `).join('')}
          ${(je.lines || []).length > 2 ? `<div class="text-[10px] text-zinc-400">+${je.lines.length - 2} more line items</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// REAL-TIME FINANCIAL STATEMENTS (BALANCE SHEET, P&L, CASH FLOW, EQUITY)
// -------------------------------------------------------------
function renderStatements() {
  renderBalanceSheet();
  renderIncomeStatement();
  renderCashFlowStatement();
  renderEquityStatement();
}

function renderBalanceSheet() {
  const assetContainer = document.getElementById('bs-assets-list');
  const liabContainer = document.getElementById('bs-liabilities-list');
  const equityContainer = document.getElementById('bs-equity-list');
  const totalAssetsEl = document.getElementById('bs-total-assets');
  const totalLiabEl = document.getElementById('bs-total-liabilities');
  const totalEquityEl = document.getElementById('bs-total-equity');
  const totalLiabEquityEl = document.getElementById('bs-total-liab-equity');
  const bsSubtitle = document.getElementById('bs-subtitle');
  const balanceIndicator = document.getElementById('bs-balance-indicator');

  if (!assetContainer || !liabContainer || !equityContainer) return;

  const bounds = getStmtDateRangeBounds();
  const asOfDateStr = bounds.endStr || new Date().toISOString().split('T')[0];
  const baseCur = companySettings.baseCurrency || 'PHP';

  if (bsSubtitle) {
    bsSubtitle.textContent = `Assets = Liabilities + Equity · As of ${asOfDateStr}`;
  }

  // 1. Assets List (Calculated as of asOfDateStr)
  const assetAccs = accounts.filter(a => a.category === 'Asset' && a.active !== false);
  let totalAssetVal = 0;
  const assetCurrencyTotals = {};

  assetContainer.innerHTML = assetAccs.map(a => {
    const bal = computeAccountBalanceAsOf(a, asOfDateStr);
    const cur = a.currency || baseCur;
    totalAssetVal += bal;
    assetCurrencyTotals[cur] = round2((assetCurrencyTotals[cur] || 0) + bal);
    return `
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-100">
        <span class="text-zinc-700 font-medium">${a.code} - ${a.name} ${cur !== baseCur ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">${cur}</span>` : ''}</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(bal, cur)}</span>
      </div>
    `;
  }).join('') || '<div class="text-zinc-400 py-2">No asset accounts active</div>';

  if (totalAssetsEl) totalAssetsEl.innerHTML = renderMultiCurrencyTotals(assetCurrencyTotals);

  // 2. Liabilities List (Calculated as of asOfDateStr)
  const liabAccs = accounts.filter(a => a.category === 'Liability' && a.active !== false);
  let totalLiabVal = 0;
  const liabCurrencyTotals = {};

  liabContainer.innerHTML = liabAccs.map(a => {
    const bal = computeAccountBalanceAsOf(a, asOfDateStr);
    const cur = a.currency || baseCur;
    totalLiabVal += bal;
    liabCurrencyTotals[cur] = round2((liabCurrencyTotals[cur] || 0) + bal);
    return `
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-100">
        <span class="text-zinc-700 font-medium">${a.code} - ${a.name} ${cur !== baseCur ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">${cur}</span>` : ''}</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(bal, cur)}</span>
      </div>
    `;
  }).join('') || '<div class="text-zinc-400 py-2">No liability accounts active</div>';

  if (totalLiabEl) totalLiabEl.innerHTML = renderMultiCurrencyTotals(liabCurrencyTotals);

  // 3. Equity List (including cumulative Net Income up to asOfDateStr)
  const equityAccs = accounts.filter(a => a.category === 'Equity' && a.active !== false);
  let totalEquityVal = 0;
  const equityCurrencyTotals = {};

  let equityHtml = equityAccs.map(a => {
    const bal = computeAccountBalanceAsOf(a, asOfDateStr);
    const cur = a.currency || baseCur;
    totalEquityVal += bal;
    equityCurrencyTotals[cur] = round2((equityCurrencyTotals[cur] || 0) + bal);
    return `
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-100">
        <span class="text-zinc-700 font-medium">${a.code} - ${a.name}</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(bal, cur)}</span>
      </div>
    `;
  }).join('');

  // Calculate Cumulative Net Income up to asOfDateStr
  let revTotal = 0;
  let expTotal = 0;
  accounts.forEach(a => {
    if (a.category === 'Revenue') revTotal += computeAccountBalanceAsOf(a, asOfDateStr);
    if (a.category === 'Expense') expTotal += computeAccountBalanceAsOf(a, asOfDateStr);
  });
  const periodNetIncome = round2(revTotal - expTotal);
  totalEquityVal += periodNetIncome;
  equityCurrencyTotals[baseCur] = round2((equityCurrencyTotals[baseCur] || 0) + periodNetIncome);

  equityHtml += `
    <div class="flex justify-between items-center py-1.5 border-b border-zinc-100 text-zinc-900 font-bold bg-zinc-50 px-2 rounded-lg mt-1">
      <span>Current Period Net Income (Retained)</span>
      <span class="font-mono">${fmt(periodNetIncome, baseCur)}</span>
    </div>
  `;

  equityContainer.innerHTML = equityHtml || '<div class="text-zinc-400 py-2">No equity accounts active</div>';
  if (totalEquityEl) totalEquityEl.innerHTML = renderMultiCurrencyTotals(equityCurrencyTotals);

  // Combined Liabilities & Equity
  const combinedTotals = {};
  Object.keys(liabCurrencyTotals).forEach(c => combinedTotals[c] = (combinedTotals[c] || 0) + liabCurrencyTotals[c]);
  Object.keys(equityCurrencyTotals).forEach(c => combinedTotals[c] = (combinedTotals[c] || 0) + equityCurrencyTotals[c]);

  if (totalLiabEquityEl) totalLiabEquityEl.innerHTML = renderMultiCurrencyTotals(combinedTotals);

  // Check balance
  const primaryAsset = assetCurrencyTotals[baseCur] || totalAssetVal;
  const primaryLiabEquity = combinedTotals[baseCur] || (totalLiabVal + totalEquityVal);
  const diff = round2(Math.abs(primaryAsset - primaryLiabEquity));

  if (balanceIndicator) {
    if (diff < 0.01) {
      balanceIndicator.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto';
      balanceIndicator.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span><span>Accounting Equation In Balance</span>`;
    } else {
      balanceIndicator.className = 'px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 self-start sm:self-auto';
      balanceIndicator.innerHTML = `<span class="material-symbols-outlined text-sm">warning</span><span>Imbalance Variance: ${fmt(diff, baseCur)}</span>`;
    }
  }
}

function renderIncomeStatement() {
  const revContainer = document.getElementById('is-revenues-list');
  const expContainer = document.getElementById('is-expenses-list');
  const totalRevEl = document.getElementById('is-total-revenue');
  const totalExpEl = document.getElementById('is-total-expense');
  const netIncomeEl = document.getElementById('is-net-income');
  const isSubtitle = document.getElementById('is-subtitle');

  if (!revContainer || !expContainer) return;

  const bounds = getStmtDateRangeBounds();
  const baseCur = companySettings.baseCurrency || 'PHP';

  if (isSubtitle) {
    isSubtitle.textContent = bounds.start
      ? `Revenues − Expenses = Net Operating Income · For period: ${bounds.startStr} to ${bounds.endStr}`
      : `Revenues − Expenses = Net Operating Income · Cumulative All Time`;
  }

  // Revenues for the period
  const revAccs = accounts.filter(a => a.category === 'Revenue' && a.active !== false);
  const revCurrencyTotals = {};

  revContainer.innerHTML = revAccs.map(a => {
    const bal = bounds.start
      ? computeAccountActivityForPeriod(a, bounds.startStr, bounds.endStr)
      : computeAccountBalanceAsOf(a, bounds.endStr);
    const cur = a.currency || baseCur;
    revCurrencyTotals[cur] = round2((revCurrencyTotals[cur] || 0) + bal);
    return `
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-100">
        <span class="text-zinc-700 font-medium">${a.code} - ${a.name} ${cur !== baseCur ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">${cur}</span>` : ''}</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(bal, cur)}</span>
      </div>
    `;
  }).join('') || '<div class="text-zinc-400 py-2">No revenue accounts active</div>';

  if (totalRevEl) totalRevEl.innerHTML = renderMultiCurrencyTotals(revCurrencyTotals);

  // Expenses for the period
  const expAccs = accounts.filter(a => a.category === 'Expense' && a.active !== false);
  const expCurrencyTotals = {};

  expContainer.innerHTML = expAccs.map(a => {
    const bal = bounds.start
      ? computeAccountActivityForPeriod(a, bounds.startStr, bounds.endStr)
      : computeAccountBalanceAsOf(a, bounds.endStr);
    const cur = a.currency || baseCur;
    expCurrencyTotals[cur] = round2((expCurrencyTotals[cur] || 0) + bal);
    return `
      <div class="flex justify-between items-center py-1.5 border-b border-zinc-100">
        <span class="text-zinc-700 font-medium">${a.code} - ${a.name} ${cur !== baseCur ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">${cur}</span>` : ''}</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(bal, cur)}</span>
      </div>
    `;
  }).join('') || '<div class="text-zinc-400 py-2">No expense accounts active</div>';

  if (totalExpEl) totalExpEl.innerHTML = renderMultiCurrencyTotals(expCurrencyTotals);

  // Net Operating Income
  const netIncomeTotals = {};
  const allCurrencies = new Set([...Object.keys(revCurrencyTotals), ...Object.keys(expCurrencyTotals), baseCur]);
  allCurrencies.forEach(c => {
    netIncomeTotals[c] = round2((revCurrencyTotals[c] || 0) - (expCurrencyTotals[c] || 0));
  });

  if (netIncomeEl) netIncomeEl.innerHTML = renderMultiCurrencyTotals(netIncomeTotals);
}

function renderCashFlowStatement() {
  const container = document.getElementById('cf-content');
  const cfSubtitle = document.getElementById('cf-subtitle');
  if (!container) return;

  const bounds = getStmtDateRangeBounds();
  const baseCur = companySettings.baseCurrency || 'PHP';

  if (cfSubtitle) {
    cfSubtitle.textContent = bounds.start
      ? `Operating, Investing, and Financing Cash Activities · For period: ${bounds.startStr} to ${bounds.endStr}`
      : `Operating, Investing, and Financing Cash Activities · Cumulative All Time`;
  }

  // 1. Operating Net Income
  let revTotal = 0;
  let expTotal = 0;
  accounts.forEach(a => {
    if (a.category === 'Revenue') {
      revTotal += bounds.start
        ? computeAccountActivityForPeriod(a, bounds.startStr, bounds.endStr)
        : computeAccountBalanceAsOf(a, bounds.endStr);
    }
    if (a.category === 'Expense') {
      expTotal += bounds.start
        ? computeAccountActivityForPeriod(a, bounds.startStr, bounds.endStr)
        : computeAccountBalanceAsOf(a, bounds.endStr);
    }
  });
  const netIncome = round2(revTotal - expTotal);

  // 2. Working Capital Changes (A/R and A/P)
  const arAcc = accounts.find(a => a.code === '1200') || accounts.find(a => a.subtype === 'Accounts Receivable');
  const apAcc = accounts.find(a => a.code === '2010') || accounts.find(a => a.subtype === 'Accounts Payable');

  const arChange = arAcc
    ? (bounds.start ? computeAccountActivityForPeriod(arAcc, bounds.startStr, bounds.endStr) : computeAccountBalanceAsOf(arAcc, bounds.endStr))
    : 0;
  const apChange = apAcc
    ? (bounds.start ? computeAccountActivityForPeriod(apAcc, bounds.startStr, bounds.endStr) : computeAccountBalanceAsOf(apAcc, bounds.endStr))
    : 0;

  const operatingCashFlow = round2(netIncome - arChange + apChange);

  // 3. Financing Activities
  const capAcc = accounts.find(a => a.code === '3010');
  const drawAcc = accounts.find(a => a.code === '3020');
  const capInflow = capAcc
    ? (bounds.start ? computeAccountActivityForPeriod(capAcc, bounds.startStr, bounds.endStr) : computeAccountBalanceAsOf(capAcc, bounds.endStr))
    : 0;
  const drawOutflow = drawAcc
    ? (bounds.start ? computeAccountActivityForPeriod(drawAcc, bounds.startStr, bounds.endStr) : computeAccountBalanceAsOf(drawAcc, bounds.endStr))
    : 0;
  const financingCashFlow = round2(capInflow - drawOutflow);

  // 4. Total Cash Balances
  const cashAccounts = accounts.filter(a => a.category === 'Asset' && (a.subtype?.includes('Cash') || a.code?.startsWith('10')));
  
  let beginningCash = 0;
  if (bounds.start) {
    const prevDate = new Date(bounds.start.getTime() - 86400000).toISOString().split('T')[0];
    cashAccounts.forEach(a => {
      beginningCash += computeAccountBalanceAsOf(a, prevDate);
    });
  }
  beginningCash = round2(beginningCash);

  let endingCash = 0;
  cashAccounts.forEach(a => {
    endingCash += computeAccountBalanceAsOf(a, bounds.endStr);
  });
  endingCash = round2(endingCash);

  const netCashChange = round2(endingCash - beginningCash);

  container.innerHTML = `
    <div class="space-y-4">
      <div class="p-5 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3">
        <h4 class="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">1. Cash Flows from Operating Activities</h4>
        <div class="space-y-1.5 pl-2 border-l-2 border-zinc-200">
          <div class="flex justify-between py-1 border-b border-zinc-100">
            <span class="text-zinc-600">Net Operating Income</span>
            <span class="font-mono font-semibold text-zinc-900">${fmt(netIncome, baseCur)}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-zinc-100">
            <span class="text-zinc-600">Change in Accounts Receivable (A/R)</span>
            <span class="font-mono text-zinc-700">${arChange >= 0 ? `(${fmt(arChange, baseCur)})` : fmt(Math.abs(arChange), baseCur)}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-zinc-100">
            <span class="text-zinc-600">Change in Accounts Payable (A/P)</span>
            <span class="font-mono text-zinc-700">${fmt(apChange, baseCur)}</span>
          </div>
          <div class="flex justify-between py-1.5 font-bold text-zinc-900">
            <span>Net Cash Provided by Operating Activities</span>
            <span class="font-mono">${fmt(operatingCashFlow, baseCur)}</span>
          </div>
        </div>

        <h4 class="font-bold text-zinc-900 uppercase tracking-wider text-[11px] pt-2">2. Cash Flows from Financing Activities</h4>
        <div class="space-y-1.5 pl-2 border-l-2 border-zinc-200">
          <div class="flex justify-between py-1 border-b border-zinc-100">
            <span class="text-zinc-600">Owner Capital Injections</span>
            <span class="font-mono font-semibold text-zinc-900">${fmt(capInflow, baseCur)}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-zinc-100">
            <span class="text-zinc-600">Owner Drawings / Distributions</span>
            <span class="font-mono text-rose-600">(${fmt(drawOutflow, baseCur)})</span>
          </div>
          <div class="flex justify-between py-1.5 font-bold text-zinc-900">
            <span>Net Cash Provided by Financing Activities</span>
            <span class="font-mono">${fmt(financingCashFlow, baseCur)}</span>
          </div>
        </div>

        <div class="pt-3 border-t-2 border-zinc-900 space-y-1.5 font-mono text-xs">
          <div class="flex justify-between font-bold text-zinc-900">
            <span>Net Increase / (Decrease) in Cash:</span>
            <span>${fmt(netCashChange, baseCur)}</span>
          </div>
          <div class="flex justify-between text-zinc-500">
            <span>Beginning Cash Balance:</span>
            <span>${fmt(beginningCash, baseCur)}</span>
          </div>
          <div class="flex justify-between font-extrabold text-sm text-zinc-900 pt-1 border-t border-zinc-200">
            <span>Ending Cash &amp; Cash Equivalents:</span>
            <span>${fmt(endingCash, baseCur)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEquityStatement() {
  const container = document.getElementById('eq-content');
  const eqSubtitle = document.getElementById('eq-subtitle');
  if (!container) return;

  const bounds = getStmtDateRangeBounds();
  const baseCur = companySettings.baseCurrency || 'PHP';

  if (eqSubtitle) {
    eqSubtitle.textContent = bounds.start
      ? `Beginning Equity + Capital Injections + Net Income − Drawings = Ending Equity · For period: ${bounds.startStr} to ${bounds.endStr}`
      : `Beginning Equity + Capital Injections + Net Income − Drawings = Ending Equity · Cumulative All Time`;
  }

  // Beginning equity as of start date
  let begEquity = 0;
  if (bounds.start) {
    const prevDate = new Date(bounds.start.getTime() - 86400000).toISOString().split('T')[0];
    accounts.forEach(a => {
      if (a.category === 'Equity') begEquity += computeAccountBalanceAsOf(a, prevDate);
      if (a.category === 'Revenue') begEquity += computeAccountBalanceAsOf(a, prevDate);
      if (a.category === 'Expense') begEquity -= computeAccountBalanceAsOf(a, prevDate);
    });
  } else {
    // Opening balances
    accounts.forEach(a => {
      if (a.category === 'Equity') begEquity += (Number(a.openingBalance) || 0);
    });
  }
  begEquity = round2(begEquity);

  // Period Capital Contributions and Drawings
  const capAcc = accounts.find(a => a.code === '3010');
  const drawAcc = accounts.find(a => a.code === '3020');
  const capContributions = capAcc
    ? (bounds.start ? computeAccountActivityForPeriod(capAcc, bounds.startStr, bounds.endStr) : computeAccountBalanceAsOf(capAcc, bounds.endStr))
    : 0;
  const ownerDrawings = drawAcc
    ? (bounds.start ? computeAccountActivityForPeriod(drawAcc, bounds.startStr, bounds.endStr) : computeAccountBalanceAsOf(drawAcc, bounds.endStr))
    : 0;

  // Period Net Income
  let revTotal = 0;
  let expTotal = 0;
  accounts.forEach(a => {
    if (a.category === 'Revenue') {
      revTotal += bounds.start
        ? computeAccountActivityForPeriod(a, bounds.startStr, bounds.endStr)
        : computeAccountBalanceAsOf(a, bounds.endStr);
    }
    if (a.category === 'Expense') {
      expTotal += bounds.start
        ? computeAccountActivityForPeriod(a, bounds.startStr, bounds.endStr)
        : computeAccountBalanceAsOf(a, bounds.endStr);
    }
  });
  const netIncome = round2(revTotal - expTotal);
  const endingEquity = round2(begEquity + capContributions + netIncome - ownerDrawings);

  container.innerHTML = `
    <div class="space-y-2 divide-y divide-zinc-100 bg-zinc-50 p-6 rounded-2xl border border-zinc-200/80">
      <div class="flex justify-between py-1.5">
        <span class="text-zinc-600">Beginning Total Equity</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(begEquity, baseCur)}</span>
      </div>
      <div class="flex justify-between py-1.5">
        <span class="text-zinc-600">+ Capital Injections / Contributions (3010)</span>
        <span class="font-mono font-semibold text-zinc-900">${fmt(capContributions, baseCur)}</span>
      </div>
      <div class="flex justify-between py-1.5 font-semibold text-zinc-900">
        <span>+ Net Income for Period</span>
        <span class="font-mono">${fmt(netIncome, baseCur)}</span>
      </div>
      <div class="flex justify-between py-1.5 text-rose-600">
        <span>− Owner's Drawings / Distributions (3020)</span>
        <span class="font-mono">(${fmt(ownerDrawings, baseCur)})</span>
      </div>
      <div class="flex justify-between py-2 pt-3 font-extrabold text-sm text-zinc-900 border-t-2 border-zinc-900">
        <span>Ending Total Equity</span>
        <span class="font-mono">${fmt(endingEquity, baseCur)}</span>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// INVOICES (A/R) & BILLS (A/P) SUBLEDGER VIEWS
// -------------------------------------------------------------
function renderInvoices() {
  const tbody = document.getElementById('invoices-table-body');
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-zinc-400 text-xs">
          No customer invoices posted. Use <strong>+ New Invoice</strong> to record a sale on account!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = invoices.map(inv => {
    const cur = inv.currency || companySettings.baseCurrency || 'PHP';
    const isPaid = inv.status === 'Paid';
    return `
      <tr class="odd:bg-white even:bg-[#fafafa] hover:bg-zinc-100/70 border-b border-[#e0e0e0] transition text-xs">
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-mono font-bold text-zinc-900 whitespace-nowrap">#${inv.invoiceNumber || 'INV-001'}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-semibold text-zinc-900">${inv.customerName || 'Customer'}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-mono text-[11px] text-zinc-600 whitespace-nowrap">${inv.date} &middot; Due ${inv.dueDate || 'On Receipt'}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmt(inv.total || 0, cur)}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold ${isPaid ? 'text-zinc-400' : 'text-zinc-900'} whitespace-nowrap">${fmt(inv.balanceDue || 0, cur)}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded font-mono text-[11px] font-bold ${isPaid ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'bg-zinc-200 text-zinc-900 border border-zinc-300'}">
            [${inv.status || 'Unpaid'}]
          </span>
        </td>
        <td class="py-2 px-3 text-center whitespace-nowrap">
          ${!isPaid ? `
            <button data-inv-id="${inv.id}" class="btn-pay-invoice px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[11px] cursor-pointer shadow-xs transition">
              Record Payment
            </button>
          ` : `<span class="text-[11px] text-zinc-400 font-mono">Settled ✓</span>`}
        </td>
      </tr>
    `;
  }).join('');

  // Attach record payment handlers
  tbody.querySelectorAll('.btn-pay-invoice').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-inv-id');
      const inv = invoices.find(i => i.id === id);
      if (!inv) return;

      const bankAcc = accounts.find(a => a.code === '1010') || accounts.find(a => a.category === 'Asset' && a.subtype?.includes('Cash'));
      const arAcc = accounts.find(a => a.code === '1200') || accounts.find(a => a.subtype === 'Accounts Receivable');

      if (!bankAcc || !arAcc) {
        alert("Cannot record payment: Missing Cash or A/R account in Chart of Accounts.");
        return;
      }

      const amount = Number(inv.balanceDue || inv.total) || 0;
      const cur = inv.currency || companySettings.baseCurrency || 'PHP';

      try {
        await executeAtomicPosting({
          date: new Date().toISOString().split('T')[0],
          memo: `Payment collected for Invoice ${inv.invoiceNumber} (${inv.customerName})`,
          sourceType: 'PaymentCollection',
          currency: cur,
          lines: [
            { accountId: bankAcc.id, accountName: bankAcc.name, debit: amount, credit: 0, memo: `Collection for ${inv.invoiceNumber}` },
            { accountId: arAcc.id, accountName: arAcc.name, debit: 0, credit: amount, memo: `Clear A/R for ${inv.invoiceNumber}` }
          ]
        });

        // Update invoice in Firestore
        await setDoc(doc(db, `companies/${currentUser.uid}/invoices/${inv.id}`), {
          status: 'Paid',
          balanceDue: 0,
          paidAt: serverTimestamp()
        }, { merge: true });

      } catch (err) {
        console.error("Payment error:", err);
        alert(`Error recording payment: ${err.message}`);
      }
    });
  });
}

function renderBills() {
  const tbody = document.getElementById('bills-table-body');
  if (!tbody) return;

  if (bills.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-zinc-400 text-xs">
          No vendor bills recorded. Use <strong>+ New Bill</strong> to record an expense on account!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bills.map(b => {
    const cur = b.currency || companySettings.baseCurrency || 'PHP';
    const isPaid = b.status === 'Paid';
    return `
      <tr class="odd:bg-white even:bg-[#fafafa] hover:bg-zinc-100/70 border-b border-[#e0e0e0] transition text-xs">
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-mono font-bold text-zinc-900 whitespace-nowrap">#${b.billNumber || 'BILL-001'}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-semibold text-zinc-900">${b.vendorName || 'Vendor'}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-mono text-[11px] text-zinc-600 whitespace-nowrap">${b.date} &middot; Due ${b.dueDate || 'Net 30'}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmt(b.total || 0, cur)}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold ${isPaid ? 'text-zinc-400' : 'text-zinc-900'} whitespace-nowrap">${fmt(b.balanceDue || 0, cur)}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded font-mono text-[11px] font-bold ${isPaid ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'bg-zinc-200 text-zinc-900 border border-zinc-300'}">
            [${b.status || 'Unpaid'}]
          </span>
        </td>
        <td class="py-2 px-3 text-center whitespace-nowrap">
          ${!isPaid ? `
            <button data-bill-id="${b.id}" class="btn-pay-bill px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-[11px] cursor-pointer shadow-xs transition">
              Pay Bill
            </button>
          ` : `<span class="text-[11px] text-zinc-400 font-mono">Settled ✓</span>`}
        </td>
      </tr>
    `;
  }).join('');

  // Attach pay bill handlers
  tbody.querySelectorAll('.btn-pay-bill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-bill-id');
      const b = bills.find(item => item.id === id);
      if (!b) return;

      const bankAcc = accounts.find(a => a.code === '1010') || accounts.find(a => a.category === 'Asset' && a.subtype?.includes('Cash'));
      const apAcc = accounts.find(a => a.code === '2010') || accounts.find(a => a.subtype === 'Accounts Payable');

      if (!bankAcc || !apAcc) {
        alert("Cannot pay bill: Missing Cash or A/P account in Chart of Accounts.");
        return;
      }

      const amount = Number(b.balanceDue || b.total) || 0;
      const cur = b.currency || companySettings.baseCurrency || 'PHP';

      try {
        await executeAtomicPosting({
          date: new Date().toISOString().split('T')[0],
          memo: `Payment of vendor bill ${b.billNumber} to ${b.vendorName}`,
          sourceType: 'BillPayment',
          currency: cur,
          lines: [
            { accountId: apAcc.id, accountName: apAcc.name, debit: amount, credit: 0, memo: `Settle A/P for ${b.billNumber}` },
            { accountId: bankAcc.id, accountName: bankAcc.name, debit: 0, credit: amount, memo: `Disbursement for ${b.billNumber}` }
          ]
        });

        // Update bill in Firestore
        await setDoc(doc(db, `companies/${currentUser.uid}/bills/${b.id}`), {
          status: 'Paid',
          balanceDue: 0,
          paidAt: serverTimestamp()
        }, { merge: true });

      } catch (err) {
        console.error("Bill payment error:", err);
        alert(`Error paying bill: ${err.message}`);
      }
    });
  });
}

// -------------------------------------------------------------
// GENERAL JOURNAL AUDIT STREAM (Flattened One-Row-Per-Account)
// -------------------------------------------------------------
function getAccountCodeAndName(line) {
  if (!line) return { code: '', name: 'Unknown', display: 'Unknown' };
  const acc = accounts.find(a => a.id === line.accountId || a.code === line.accountCode || a.name === line.accountName);
  const code = line.accountCode || (acc ? acc.code : '');
  const name = line.accountName || (acc ? acc.name : 'Unknown Account');
  const display = code ? `${code} · ${name}` : name;
  return { code, name, display, acc };
}

function fmtCellNum(num, cur, isCreditOrDebit = true) {
  if (isCreditOrDebit && (!num || Number(num) === 0)) {
    return '—';
  }
  return fmt(num || 0, cur);
}

function renderJournal() {
  const tbody = document.getElementById('journal-table-tbody');
  if (!tbody) return;

  const baseCur = companySettings.baseCurrency || 'PHP';

  // Apply filters: Search Query & Source Filter
  const q = (journalSearchQuery || '').toLowerCase().trim();
  const srcFilter = journalSourceFilter || 'all';

  const filtered = journalEntries.filter(je => {
    if (srcFilter !== 'all' && (je.sourceType || 'General') !== srcFilter) {
      return false;
    }
    if (q) {
      const matchMemo = (je.memo || '').toLowerCase().includes(q);
      const matchRef = (je.refNumber || '').toLowerCase().includes(q) || (je.id || '').toLowerCase().includes(q);
      const matchLines = (je.lines || []).some(l => {
        const info = getAccountCodeAndName(l);
        return info.display.toLowerCase().includes(q) || (l.memo || '').toLowerCase().includes(q);
      });
      return matchMemo || matchRef || matchLines;
    }
    return true;
  });

  // Sort by posting timestamp newest first (using serverTimestamp / createdAt)
  filtered.sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));

  // Compute total debits & credits for verification bar
  let sumDebits = 0;
  let sumCredits = 0;
  filtered.forEach(je => {
    (je.lines || []).forEach(l => {
      sumDebits += Number(l.debit) || 0;
      sumCredits += Number(l.credit) || 0;
    });
  });
  sumDebits = round2(sumDebits);
  sumCredits = round2(sumCredits);
  const variance = round2(Math.abs(sumDebits - sumCredits));

  const totalDebEl = document.getElementById('gj-total-debits');
  const totalCredEl = document.getElementById('gj-total-credits');
  const balBadgeEl = document.getElementById('gj-balance-badge');
  const countBadgeEl = document.getElementById('journal-count-badge');

  if (totalDebEl) totalDebEl.textContent = fmt(sumDebits, baseCur);
  if (totalCredEl) totalCredEl.textContent = fmt(sumCredits, baseCur);
  if (countBadgeEl) countBadgeEl.textContent = `${filtered.length} entries`;
  if (balBadgeEl) {
    if (variance === 0) {
      balBadgeEl.className = 'px-2 py-0.5 font-mono text-[11px] font-bold rounded bg-zinc-200 text-zinc-800 border border-zinc-300';
      balBadgeEl.textContent = 'Balanced ✓ • Variance $0.00';
    } else {
      balBadgeEl.className = 'px-2 py-0.5 font-mono text-[11px] font-bold rounded bg-zinc-300 text-zinc-900 border border-zinc-400';
      balBadgeEl.textContent = `Out of Balance ⚠ • Variance ${fmt(variance, baseCur)}`;
    }
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="p-8 text-center text-zinc-400 text-xs">
          No journal entries found matching criteria. Click <strong>+ Record Entry</strong> to post your first journal transaction!
        </td>
      </tr>
    `;
    return;
  }

  // Render Two Clean Layers Per Entry:
  // Layer 1: Entry header row (thin, bold, light-gray #f0f0f0): Date & Time · Entry # · Memo/Description · Source
  // Layer 2: Line detail rows (Account · Line Memo · Debit · Credit) ending in a bold "Total — Balanced" row per entry
  let rowsHtml = '';
  filtered.forEach((je, idx) => {
    const cur = je.currency || baseCur;
    const refNum = je.refNumber || `JE-${String(filtered.length - idx).padStart(4, '0')}`;
    const lines = je.lines || [];

    let entryDebits = 0;
    let entryCredits = 0;
    lines.forEach(l => {
      entryDebits += Number(l.debit) || 0;
      entryCredits += Number(l.credit) || 0;
    });
    entryDebits = round2(entryDebits);
    entryCredits = round2(entryCredits);

    // 1. Entry Header Row (compact single divider row)
    rowsHtml += `
      <tr class="bg-[#f0f0f0] border-t-2 border-b border-[#d4d4d8] text-xs font-bold text-zinc-900 select-none">
        <td colspan="4" class="py-1.5 px-3">
          <div class="flex items-center justify-between gap-2 overflow-hidden">
            <div class="flex items-center gap-2 truncate font-medium text-zinc-800 text-xs">
              <span class="font-mono text-zinc-600 text-[11px] whitespace-nowrap">${formatDateTime(je)}</span>
              <span class="text-zinc-300">·</span>
              <span class="font-mono font-bold text-zinc-900 text-[11px] whitespace-nowrap">#${refNum}</span>
              <span class="text-zinc-300">·</span>
              <span class="font-semibold text-zinc-900 truncate" title="${je.memo || ''}">${je.memo || '-'}</span>
              ${je.receiptUrl ? `<a href="${je.receiptUrl}" target="_blank" class="inline-flex items-center text-zinc-500 hover:text-zinc-900 shrink-0 ml-0.5" title="View Attachment"><span class="material-symbols-outlined text-[13px]">attach_file</span></a>` : ''}
            </div>
            <div class="shrink-0 flex items-center gap-1.5">
              <span class="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-zinc-700 bg-zinc-200/80 border border-zinc-300 whitespace-nowrap">
                [${je.sourceType || 'General'}]
              </span>
            </div>
          </div>
        </td>
      </tr>
    `;

    // 2. Line Detail Rows (fixed columns: Account, Line Memo, Debit, Credit)
    lines.forEach(l => {
      const accInfo = getAccountCodeAndName(l);
      const isCredit = (Number(l.credit) || 0) > 0;
      const debitVal = Number(l.debit) || 0;
      const creditVal = Number(l.credit) || 0;

      rowsHtml += `
        <tr class="odd:bg-white even:bg-[#fafafa] hover:bg-zinc-100/70 border-b border-[#e0e0e0] text-xs transition">
          <td class="py-1.5 px-3 border-r border-[#e0e0e0] truncate ${isCredit ? 'pl-8 text-zinc-700' : 'font-semibold text-zinc-900'}" title="${accInfo.display}">
            ${accInfo.display}
          </td>
          <td class="py-1.5 px-3 border-r border-[#e0e0e0] text-zinc-600 truncate text-[11px]" title="${l.memo || je.memo || ''}">
            ${l.memo || je.memo || '—'}
          </td>
          <td class="py-1.5 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">
            ${debitVal > 0 ? fmt(debitVal, cur) : '—'}
          </td>
          <td class="py-1.5 px-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap">
            ${creditVal > 0 ? fmt(creditVal, cur) : '—'}
          </td>
        </tr>
      `;
    });

    // 3. Per-Entry "Total — Balanced" Row
    rowsHtml += `
      <tr class="bg-zinc-100/80 border-b-2 border-[#d4d4d8] text-xs font-bold text-zinc-900">
        <td colspan="2" class="py-1.5 px-3 text-right font-semibold text-zinc-700 border-r border-[#e0e0e0]">
          Total — Balanced ✓
        </td>
        <td class="py-1.5 px-3 text-right font-mono font-bold text-zinc-900 border-r border-[#e0e0e0] whitespace-nowrap">
          ${fmt(entryDebits, cur)}
        </td>
        <td class="py-1.5 px-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap">
          ${fmt(entryCredits, cur)}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;
}

// -------------------------------------------------------------
// INDIVIDUAL ACCOUNT LEDGERS (T-ACCOUNTS - Compact Spreadsheet)
// -------------------------------------------------------------
function renderLedgers() {
  const select = document.getElementById('ledger-account-select');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = accounts.map(a => `<option value="${a.id}">${a.code} - ${a.name} [${a.category}] (${a.currency || companySettings.baseCurrency || 'PHP'})</option>`).join('');

  if (currentVal && accounts.some(a => a.id === currentVal)) {
    select.value = currentVal;
  }

  loadActiveAccountLedger(select.value || (accounts[0]?.id));
}

function loadActiveAccountLedger(accountId) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return;

  const select = document.getElementById('ledger-account-select');
  if (select && select.value !== acc.id) {
    select.value = acc.id;
  }

  const codeBadge = document.getElementById('ledger-acc-code-badge');
  const nameEl = document.getElementById('ledger-acc-name');
  const metaEl = document.getElementById('ledger-acc-meta');
  const balEl = document.getElementById('ledger-acc-balance');
  const countEl = document.getElementById('ledger-entry-count');
  const tbody = document.getElementById('ledger-entries-tbody');

  const cur = acc.currency || companySettings.baseCurrency || 'PHP';

  if (codeBadge) codeBadge.textContent = acc.code;
  if (nameEl) nameEl.textContent = acc.name;
  if (metaEl) metaEl.textContent = `Normal: ${acc.normalBalance || 'Debit'} • Category: ${acc.category} • Currency: ${cur}`;
  if (balEl) balEl.textContent = fmt(acc.balance || 0, cur);

  if (!tbody) return;

  // Filter journal entries for this account
  const accountEntries = [];
  journalEntries.forEach(je => {
    const timeVal = getEntryTimestamp(je);
    const dateFormatted = formatDateTime(je);
    const refNum = je.refNumber || `JE-${je.id ? je.id.slice(0, 6) : '0000'}`;

    (je.lines || []).forEach(l => {
      if (l.accountId === acc.id) {
        accountEntries.push({
          entryTimestamp: timeVal,
          entryDateFormatted: dateFormatted,
          jeRef: refNum,
          memo: l.memo || je.memo || '-',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          fullEntry: je
        });
      }
    });
  });

  // Calculate running balance in ascending chronological order (oldest to newest)
  accountEntries.sort((a, b) => a.entryTimestamp - b.entryTimestamp);

  let running = 0;
  const normal = acc.normalBalance || 'Debit';

  accountEntries.forEach(e => {
    running += normal === 'Debit' ? (e.debit - e.credit) : (e.credit - e.debit);
    e.runningBalance = round2(running);
  });

  // Now sort descending (newest first at the top of the table)
  accountEntries.sort((a, b) => b.entryTimestamp - a.entryTimestamp);

  // Apply ledger search query
  const q = (ledgerSearchQuery || '').toLowerCase().trim();
  const filtered = accountEntries.filter(e => {
    if (!q) return true;
    return e.memo.toLowerCase().includes(q) || e.jeRef.toLowerCase().includes(q) || e.entryDateFormatted.toLowerCase().includes(q);
  });

  if (countEl) countEl.textContent = `${filtered.length} postings`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-zinc-400 text-xs">
          No ledger transactions posted to this account yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    return `
      <tr class="odd:bg-white even:bg-[#fafafa] hover:bg-zinc-100/70 border-b border-[#e0e0e0] transition cursor-pointer ledger-row" data-je-id="${e.fullEntry.id}">
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-mono text-[11px] whitespace-nowrap text-zinc-600">${e.entryDateFormatted}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-medium text-zinc-900">${e.memo}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] font-mono text-center font-bold text-zinc-800 whitespace-nowrap">#${e.jeRef}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmtCellNum(e.debit, cur)}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmtCellNum(e.credit, cur)}</td>
        <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmt(e.runningBalance, cur)}</td>
        <td class="py-2 px-3 text-center whitespace-nowrap">
          <button class="btn-view-ledger-je px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold cursor-pointer transition" data-je-id="${e.fullEntry.id}">
            View Entry
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach click listener to rows and buttons
  tbody.querySelectorAll('.ledger-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-je-id');
      openJournalDetailModal(id);
    });
  });

  tbody.querySelectorAll('.btn-view-ledger-je').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-je-id');
      openJournalDetailModal(id);
    });
  });
}

// -------------------------------------------------------------
// CHART OF ACCOUNTS (COA) - One Continuous Master Table
// -------------------------------------------------------------
function renderChartOfAccounts() {
  const tbody = document.getElementById('coa-table-tbody');
  if (!tbody) return;

  const baseCur = companySettings.baseCurrency || 'PHP';

  // Apply filters: Search Query & Category Filter
  const q = coaSearchQuery.toLowerCase().trim();

  const filtered = accounts.filter(a => {
    if (!coaShowDeactivated && a.active === false) return false;
    if (coaCategoryFilter !== 'all' && a.category !== coaCategoryFilter) return false;
    if (q) {
      const matchCode = (a.code || '').toLowerCase().includes(q);
      const matchName = (a.name || '').toLowerCase().includes(q);
      const matchDesc = (a.description || '').toLowerCase().includes(q);
      return matchCode || matchName || matchDesc;
    }
    return true;
  });

  let masterTableHtml = '';

  COA_CATEGORIES_CONFIG.forEach(cat => {
    const catAccounts = filtered.filter(a => a.category === cat.name);
    if (catAccounts.length === 0 && coaCategoryFilter !== 'all' && coaCategoryFilter !== cat.name) {
      return;
    }

    let catTotal = 0;
    const catCurrencyTotals = {};
    catAccounts.forEach(a => {
      const bal = Number(a.balance) || 0;
      const cur = a.currency || baseCur;
      catTotal += bal;
      catCurrencyTotals[cur] = round2((catCurrencyTotals[cur] || 0) + bal);
    });

    // 1. Shaded Bold Category Header Row
    masterTableHtml += `
      <tr class="bg-[#f0f0f0] border-t-2 border-b border-[#d4d4d8] text-xs font-bold text-zinc-900 select-none">
        <td colspan="4" class="py-2 px-3 pl-4 uppercase tracking-wider font-bold text-zinc-900 border-r border-[#e0e0e0]">
          ${cat.label} (${cat.range})
        </td>
        <td class="py-2 px-3 text-center font-mono text-[11px] text-zinc-700 border-r border-[#e0e0e0]">
          [${cat.normal === 'Debit' ? 'Dr' : 'Cr'}]
        </td>
        <td class="py-2 px-3 text-right font-mono font-bold text-zinc-900 border-r border-[#e0e0e0] whitespace-nowrap">
          ${renderMultiCurrencyTotals(catCurrencyTotals)}
        </td>
        <td class="py-2 px-3 text-center font-mono text-[11px] text-zinc-600 border-r border-[#e0e0e0]">
          ${catAccounts.length} accts
        </td>
        <td class="py-2 px-3 text-center text-[11px] text-zinc-500 border-r border-[#e0e0e0]">—</td>
        <td class="py-2 px-3 pr-4 text-center text-[11px] text-zinc-500">—</td>
      </tr>
    `;

    if (catAccounts.length === 0) {
      masterTableHtml += `
        <tr class="border-b border-[#e0e0e0]">
          <td colspan="9" class="py-4 text-center text-zinc-400 text-xs italic">
            No accounts in this category matching search criteria
          </td>
        </tr>
      `;
      return;
    }

    // Group accounts by subtype if multiple exist
    const subtypeMap = new Map();
    catAccounts.forEach(a => {
      const sub = a.subtype || cat.name;
      if (!subtypeMap.has(sub)) subtypeMap.set(sub, []);
      subtypeMap.get(sub).push(a);
    });

    const hasMultipleSubtypes = subtypeMap.size > 1;

    subtypeMap.forEach((accsInSub, subName) => {
      if (hasMultipleSubtypes) {
        masterTableHtml += `
          <tr class="bg-zinc-100/70 border-b border-[#e0e0e0] text-zinc-700 text-[11px] font-semibold">
            <td colspan="9" class="py-1 px-3 pl-6 italic">
              ↳ ${subName} (${accsInSub.length})
            </td>
          </tr>
        `;
      }

      accsInSub.forEach(a => {
        const cur = a.currency || baseCur;
        const isSys = SYSTEM_ACCOUNT_CODES.has(a.code);
        const isInactive = a.active === false;
        const bal = Number(a.balance) || 0;
        const formattedBal = bal < 0 ? `(${fmt(Math.abs(bal), cur)})` : fmt(bal, cur);
        const normalBadge = a.normalBalance === 'Credit' ? '[Cr]' : '[Dr]';

        masterTableHtml += `
          <tr class="odd:bg-white even:bg-[#fafafa] hover:bg-zinc-100/70 border-b border-[#e0e0e0] transition cursor-pointer coa-account-row ${isInactive ? 'opacity-60 text-zinc-400' : 'text-zinc-800'}" data-acc-id="${a.id}">
            <td class="py-2 px-3 pl-4 border-r border-[#e0e0e0] font-mono font-bold text-zinc-900 whitespace-nowrap">${a.code}</td>
            <td class="py-2 px-3 border-r border-[#e0e0e0]">
              <span class="font-bold text-zinc-900 ${isInactive ? 'line-through text-zinc-500' : ''}">${a.name}</span>
              ${a.description ? `<p class="text-[11px] text-zinc-500 line-clamp-1">${a.description}</p>` : ''}
            </td>
            <td class="py-2 px-3 border-r border-[#e0e0e0] text-zinc-600 whitespace-nowrap">${a.category}</td>
            <td class="py-2 px-3 border-r border-[#e0e0e0] text-zinc-600 whitespace-nowrap">${a.subtype || a.category}</td>
            <td class="py-2 px-3 border-r border-[#e0e0e0] text-center font-mono text-[11px] text-zinc-600 whitespace-nowrap">${normalBadge}</td>
            <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${formattedBal}</td>
            <td class="py-2 px-3 border-r border-[#e0e0e0] text-center font-mono text-[11px] text-zinc-700 whitespace-nowrap">[${cur}]</td>
            <td class="py-2 px-3 border-r border-[#e0e0e0] text-center whitespace-nowrap text-[11px]">
              ${isInactive ? '<span class="text-zinc-400 font-mono italic">Inactive</span>' : (isSys ? '<span class="text-zinc-500 italic font-mono">System</span>' : '<span class="text-zinc-700 font-mono">Active</span>')}
            </td>
            <td class="py-2 px-3 pr-4 text-center whitespace-nowrap">
              <div class="flex items-center justify-center gap-1.5">
                <button data-acc-id="${a.id}" class="btn-goto-ledger px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold cursor-pointer transition border border-zinc-200">
                  Ledger
                </button>
                <button data-acc-id="${a.id}" class="btn-edit-account px-2 py-0.5 rounded border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-[11px] font-bold cursor-pointer transition">
                  Edit
                </button>
              </div>
            </td>
          </tr>
        `;
      });
    });
  });

  tbody.innerHTML = masterTableHtml || `
    <tr>
      <td colspan="9" class="p-8 text-center text-zinc-400 text-xs">
        No accounts found matching search criteria.
      </td>
    </tr>
  `;

  // Attach Row Click to navigate to Ledger
  tbody.querySelectorAll('.coa-account-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-acc-id');
      navigateToLedger(id);
    });
  });

  // Attach Ledger button
  tbody.querySelectorAll('.btn-goto-ledger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-acc-id');
      navigateToLedger(id);
    });
  });

  // Attach Edit Account buttons
  tbody.querySelectorAll('.btn-edit-account').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-acc-id');
      openEditAccountModal(id);
    });
  });
}

function navigateToLedger(accountId) {
  // Switch view to Ledgers
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('bg-zinc-900', 'text-white', 'shadow-xs');
    b.classList.add('text-zinc-600', 'hover:bg-zinc-100');
  });
  const ledgerNavBtn = document.querySelector('[data-view="ledgers"]');
  if (ledgerNavBtn) {
    ledgerNavBtn.classList.add('bg-zinc-900', 'text-white', 'shadow-xs');
    ledgerNavBtn.classList.remove('text-zinc-600', 'hover:bg-zinc-100');
  }

  document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
  const ledgerView = document.getElementById('view-ledgers');
  if (ledgerView) ledgerView.classList.remove('hidden');

  currentView = 'ledgers';
  loadActiveAccountLedger(accountId);
}

// -------------------------------------------------------------
// JOURNAL ENTRY DETAIL MODAL
// -------------------------------------------------------------
function openJournalDetailModal(journalId) {
  const je = journalEntries.find(j => j.id === journalId);
  if (!je) return;

  const modal = document.getElementById('modal-journal-detail');
  if (!modal) return;

  const cur = je.currency || companySettings.baseCurrency || 'PHP';
  const refNum = je.refNumber || `JE-${je.id ? je.id.slice(0, 6) : '0000'}`;

  const memoEl = document.getElementById('jed-modal-memo');
  const badgeEl = document.getElementById('jed-modal-source-badge');
  const metaEl = document.getElementById('jed-modal-meta');
  const tsEl = document.getElementById('jed-modal-timestamp');
  const debEl = document.getElementById('jed-modal-debits');
  const credEl = document.getElementById('jed-modal-credits');
  const statusEl = document.getElementById('jed-modal-status');
  const attachRow = document.getElementById('jed-modal-attachment-row');
  const attachLink = document.getElementById('jed-modal-attachment-link');
  const tbody = document.getElementById('jed-modal-lines-tbody');
  const footDeb = document.getElementById('jed-modal-foot-debit');
  const footCred = document.getElementById('jed-modal-foot-credit');

  if (memoEl) memoEl.textContent = je.memo || 'Journal Entry';
  if (badgeEl) badgeEl.textContent = je.sourceType || 'General';
  if (metaEl) metaEl.textContent = `Date: ${je.date || '-'} • Ref #${refNum}`;
  if (tsEl) tsEl.textContent = formatDateTime(je);

  let totDeb = 0;
  let totCred = 0;
  (je.lines || []).forEach(l => {
    totDeb += Number(l.debit) || 0;
    totCred += Number(l.credit) || 0;
  });
  totDeb = round2(totDeb);
  totCred = round2(totCred);

  if (debEl) debEl.textContent = fmt(totDeb, cur);
  if (credEl) credEl.textContent = fmt(totCred, cur);
  if (footDeb) footDeb.textContent = fmt(totDeb, cur);
  if (footCred) footCred.textContent = fmt(totCred, cur);

  if (statusEl) {
    if (Math.abs(totDeb - totCred) < 0.001) {
      statusEl.textContent = 'Balanced ✓';
      statusEl.className = 'font-mono font-bold text-zinc-900 text-xs block truncate';
    } else {
      statusEl.textContent = `Variance: ${fmt(Math.abs(totDeb - totCred), cur)} ⚠`;
      statusEl.className = 'font-mono font-bold text-zinc-900 text-xs block truncate';
    }
  }

  if (attachRow && attachLink) {
    if (je.receiptUrl) {
      attachRow.classList.remove('hidden');
      attachLink.href = je.receiptUrl;
    } else {
      attachRow.classList.add('hidden');
    }
  }

  if (tbody) {
    tbody.innerHTML = (je.lines || []).map(l => {
      const accInfo = getAccountCodeAndName(l);
      const isCredit = (Number(l.credit) || 0) > 0;
      return `
        <tr class="odd:bg-white even:bg-[#fafafa] hover:bg-zinc-50 border-b border-[#e0e0e0]">
          <td class="py-2 px-3 border-r border-[#e0e0e0] font-semibold text-zinc-900 ${isCredit ? 'pl-8' : ''}">${accInfo.display}</td>
          <td class="py-2 px-3 border-r border-[#e0e0e0] text-zinc-500 font-sans text-xs">${l.memo || '-'}</td>
          <td class="py-2 px-3 border-r border-[#e0e0e0] text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmtCellNum(l.debit, cur)}</td>
          <td class="py-2 px-3 text-right font-mono font-bold text-zinc-900 whitespace-nowrap">${fmtCellNum(l.credit, cur)}</td>
        </tr>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
}

// -------------------------------------------------------------
// COMPANY SETTINGS & MULTI-CURRENCY MATRIX
// -------------------------------------------------------------
function renderCompanySettings() {
  const nameInput = document.getElementById('setting-company-name');
  const curSelect = document.getElementById('setting-base-currency');
  const tableBody = document.getElementById('currency-directory-table');

  if (nameInput && companySettings.companyName) {
    nameInput.value = companySettings.companyName;
  }
  if (curSelect && companySettings.baseCurrency) {
    curSelect.value = companySettings.baseCurrency;
  }

  if (tableBody) {
    tableBody.innerHTML = CURRENCIES.map(c => `
      <tr class="hover:bg-zinc-50">
        <td class="py-2.5 font-bold text-zinc-900">${c.code} ${c.code === companySettings.baseCurrency ? '<span class="text-[9px] bg-zinc-900 text-white font-sans px-1.5 py-0.5 rounded ml-1">Base</span>' : ''}</td>
        <td class="py-2.5 font-bold text-zinc-900">${c.symbol}</td>
        <td class="py-2.5 font-sans text-zinc-800">${c.name}</td>
        <td class="py-2.5 text-right font-bold text-zinc-900">${fmt(1250, c.code)}</td>
      </tr>
    `).join('');
  }
}

// -------------------------------------------------------------
// CONTACTS DIRECTORY (CUSTOMERS & VENDORS)
// -------------------------------------------------------------
function renderDirectory() {
  const custList = document.getElementById('customers-list');
  const vendList = document.getElementById('vendors-list');

  if (custList) {
    if (customers.length === 0) {
      custList.innerHTML = '<div class="text-zinc-400 py-3">No customers registered yet. Auto-created upon invoicing.</div>';
    } else {
      custList.innerHTML = customers.map(c => `
        <div class="py-2.5 flex justify-between items-center">
          <div>
            <h4 class="font-bold text-zinc-900">${c.name}</h4>
            <p class="text-[11px] text-zinc-400 font-mono">${c.email || 'customer@company.com'}</p>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">Customer</span>
        </div>
      `).join('');
    }
  }

  if (vendList) {
    if (vendors.length === 0) {
      vendList.innerHTML = '<div class="text-zinc-400 py-3">No vendors registered yet. Auto-created upon entering bills.</div>';
    } else {
      vendList.innerHTML = vendors.map(v => `
        <div class="py-2.5 flex justify-between items-center">
          <div>
            <h4 class="font-bold text-zinc-900">${v.name}</h4>
            <p class="text-[11px] text-zinc-400 font-mono">${v.email || 'vendor@supplier.com'}</p>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">Vendor</span>
        </div>
      `).join('');
    }
  }
}

// -------------------------------------------------------------
// MODALS & INTERACTIVE TRANSACTION FORMS
// -------------------------------------------------------------
function populateModalDropdowns() {
  // Simple transaction customer & vendor select
  const contactSelect = document.getElementById('simple-tx-contact');
  const catSelect = document.getElementById('simple-tx-category');
  const cashSelect = document.getElementById('simple-tx-cash-acc');

  if (contactSelect) {
    if (simpleTxType === 'sale') {
      contactSelect.innerHTML = `
        <option value="Direct Client">Direct Client / Walk-in</option>
        <option value="Acme Corp">Acme Corp</option>
        <option value="Global Logistics">Global Logistics</option>
        <option value="Apex Holdings">Apex Holdings</option>
      `;
    } else {
      contactSelect.innerHTML = `
        <option value="General Supplier">General Supplier / Merchant</option>
        <option value="Amazon Web Services">Amazon Web Services</option>
        <option value="Google Workspace">Google Workspace</option>
        <option value="Office Depot">Office Depot</option>
      `;
    }
  }

  if (catSelect) {
    const targetCat = simpleTxType === 'sale' ? 'Revenue' : 'Expense';
    const accs = accounts.filter(a => a.category === targetCat && a.active !== false);
    catSelect.innerHTML = accs.map(a => `<option value="${a.id}">${a.code} - ${a.name} (${a.currency || companySettings.baseCurrency || 'PHP'})</option>`).join('');
  }

  if (cashSelect) {
    const cashAccs = accounts.filter(a => a.category === 'Asset' && (a.subtype?.includes('Cash') || a.code?.startsWith('10')) && a.active !== false);
    cashSelect.innerHTML = cashAccs.map(a => `<option value="${a.id}">${a.code} - ${a.name} (${a.currency || companySettings.baseCurrency || 'PHP'})</option>`).join('');
  }

  updateSimpleTxPreview();
}

function updateSimpleTxPreview() {
  const preview = document.getElementById('simple-tx-preview');
  if (!preview) return;

  const amt = Number(document.getElementById('simple-tx-amount')?.value) || 0;
  const cur = document.getElementById('simple-tx-currency')?.value || companySettings.baseCurrency || 'PHP';
  const catAccId = document.getElementById('simple-tx-category')?.value;
  const cashAccId = document.getElementById('simple-tx-cash-acc')?.value;

  const catAcc = accounts.find(a => a.id === catAccId);
  const cashAcc = accounts.find(a => a.id === cashAccId);
  const arAcc = accounts.find(a => a.code === '1200') || accounts.find(a => a.subtype === 'Accounts Receivable');
  const apAcc = accounts.find(a => a.code === '2010') || accounts.find(a => a.subtype === 'Accounts Payable');

  if (simpleTxType === 'sale') {
    if (simplePayMethod === 'paid_now') {
      preview.innerHTML = `
        <div class="flex justify-between text-zinc-900 font-bold">
          <span>Dr. ${cashAcc ? cashAcc.name : 'Cash & Bank'}</span>
          <span>${fmt(amt, cur)}</span>
        </div>
        <div class="flex justify-between text-zinc-700 pl-4">
          <span>Cr. ${catAcc ? catAcc.name : 'Revenue Account'}</span>
          <span>${fmt(amt, cur)}</span>
        </div>
      `;
    } else {
      preview.innerHTML = `
        <div class="flex justify-between text-zinc-900 font-bold">
          <span>Dr. Accounts Receivable (1200)</span>
          <span>${fmt(amt, cur)}</span>
        </div>
        <div class="flex justify-between text-zinc-700 pl-4">
          <span>Cr. ${catAcc ? catAcc.name : 'Revenue Account'}</span>
          <span>${fmt(amt, cur)}</span>
        </div>
      `;
    }
  } else {
    if (simplePayMethod === 'paid_now') {
      preview.innerHTML = `
        <div class="flex justify-between text-zinc-900 font-bold">
          <span>Dr. ${catAcc ? catAcc.name : 'Expense Account'}</span>
          <span>${fmt(amt, cur)}</span>
        </div>
        <div class="flex justify-between text-zinc-700 pl-4">
          <span>Cr. ${cashAcc ? cashAcc.name : 'Cash & Bank'}</span>
          <span>${fmt(amt, cur)}</span>
        </div>
      `;
    } else {
      preview.innerHTML = `
        <div class="flex justify-between text-zinc-900 font-bold">
          <span>Dr. ${catAcc ? catAcc.name : 'Expense Account'}</span>
          <span>${fmt(amt, cur)}</span>
        </div>
        <div class="flex justify-between text-zinc-700 pl-4">
          <span>Cr. Accounts Payable (2010)</span>
          <span>${fmt(amt, cur)}</span>
        </div>
      `;
    }
  }
}

// Edit Account Modal Helper
function openEditAccountModal(accountId) {
  const acc = accounts.find(a => a.id === accountId);
  if (!acc) return;

  const modal = document.getElementById('modal-edit-account');
  if (!modal) return;

  document.getElementById('edit-acc-id').value = acc.id;
  document.getElementById('edit-acc-code').value = acc.code;
  document.getElementById('edit-acc-name').value = acc.name;
  document.getElementById('edit-acc-category').value = acc.category;
  document.getElementById('edit-acc-currency').value = acc.currency || companySettings.baseCurrency || 'PHP';
  document.getElementById('edit-acc-desc').value = acc.description || '';

  const modalTitle = document.getElementById('edit-acc-modal-title');
  const modalSubtitle = document.getElementById('edit-acc-modal-subtitle');
  const curBal = document.getElementById('edit-acc-curr-balance');
  const curNormal = document.getElementById('edit-acc-curr-normal');

  const cur = acc.currency || companySettings.baseCurrency || 'PHP';

  if (modalTitle) modalTitle.textContent = `${acc.code} - ${acc.name}`;
  if (modalSubtitle) modalSubtitle.textContent = `Category: ${acc.category} &middot; Currency: ${cur}`;
  if (curBal) curBal.textContent = fmt(acc.balance || 0, cur);
  if (curNormal) curNormal.textContent = `${acc.normalBalance || 'Debit'} (Normal)`;

  // Populate subtypes for category
  populateSubtypes('edit-acc-category', 'edit-acc-subtype', acc.subtype);

  modal.classList.remove('hidden');
}

function populateSubtypes(catSelectId, subtypeSelectId, selectedVal) {
  const cat = document.getElementById(catSelectId)?.value || 'Asset';
  const subSelect = document.getElementById(subtypeSelectId);
  if (!subSelect) return;

  const list = CATEGORY_SUBTYPES[cat] || [];
  subSelect.innerHTML = list.map(s => `<option value="${s}" ${s === selectedVal ? 'selected' : ''}>${s}</option>`).join('');
}

// -------------------------------------------------------------
// EVENT LISTENERS & DOM HOOKS
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Navigation tabs switching
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-view');
      activeView = view;

      // Update sidebar tab styling
      document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.remove('active', 'bg-zinc-900', 'text-white');
        t.classList.add('text-zinc-600');
      });
      tab.classList.add('active', 'bg-zinc-900', 'text-white');
      tab.classList.remove('text-zinc-600');

      // Update mobile select if present
      const mobileNav = document.getElementById('mobile-nav-select');
      if (mobileNav) mobileNav.value = view;

      // Hide all views and show active
      document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
      const activeSec = document.getElementById(`view-${view}`);
      if (activeSec) activeSec.classList.remove('hidden');
    });
  });

  const mobileNav = document.getElementById('mobile-nav-select');
  if (mobileNav) {
    mobileNav.addEventListener('change', (e) => {
      const tab = document.querySelector(`.nav-tab[data-view="${e.target.value}"]`);
      if (tab) tab.click();
    });
  }

  // Statements subtabs switching
  document.querySelectorAll('.stmt-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.stmt-tab').forEach(t => {
        t.classList.remove('active', 'bg-zinc-900', 'text-white');
        t.classList.add('text-zinc-600', 'bg-zinc-100');
      });
      tab.classList.add('active', 'bg-zinc-900', 'text-white');
      tab.classList.remove('text-zinc-600', 'bg-zinc-100');

      const target = tab.getAttribute('data-stmt');
      ['balance-sheet', 'income-statement', 'cash-flow', 'equity-statement'].forEach(s => {
        const el = document.getElementById(`stmt-container-${s}`);
        if (el) el.classList.toggle('hidden', s !== target);
      });
    });
  });

  // Financial Statements Date Range Presets
  document.querySelectorAll('.stmt-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stmt-range-btn').forEach(b => {
        b.classList.remove('active', 'bg-zinc-900', 'text-white', 'shadow-xs');
        b.classList.add('text-zinc-600');
      });
      btn.classList.add('active', 'bg-zinc-900', 'text-white', 'shadow-xs');
      btn.classList.remove('text-zinc-600');

      stmtPeriodPreset = btn.getAttribute('data-stmt-range');
      const bounds = getStmtDateRangeBounds();

      // Sync custom input date values
      const sInput = document.getElementById('stmt-start-date');
      const eInput = document.getElementById('stmt-end-date');
      if (sInput && bounds.start) sInput.value = bounds.start.toISOString().split('T')[0];
      if (eInput && bounds.end) eInput.value = bounds.end.toISOString().split('T')[0];

      const badge = document.getElementById('stmt-period-badge');
      if (badge) badge.textContent = bounds.label;
      const display = document.getElementById('stmt-period-range-display');
      if (display) display.textContent = bounds.start ? `Period: ${bounds.startStr} to ${bounds.endStr}` : `Showing all recorded transactions`;

      renderStatements();
    });
  });

  // Statement custom date apply button & inputs
  const stmtStartInput = document.getElementById('stmt-start-date');
  const stmtEndInput = document.getElementById('stmt-end-date');
  const btnApplyStmtDates = document.getElementById('btn-apply-stmt-dates');

  const applyCustomStmtDates = () => {
    if (stmtStartInput && stmtEndInput && stmtStartInput.value && stmtEndInput.value) {
      document.querySelectorAll('.stmt-range-btn').forEach(b => {
        b.classList.remove('active', 'bg-zinc-900', 'text-white', 'shadow-xs');
        b.classList.add('text-zinc-600');
      });
      stmtPeriodPreset = 'custom';
      stmtCustomStartDate = stmtStartInput.value;
      stmtCustomEndDate = stmtEndInput.value;

      const badge = document.getElementById('stmt-period-badge');
      if (badge) badge.textContent = `Custom: ${stmtCustomStartDate} to ${stmtCustomEndDate}`;
      const display = document.getElementById('stmt-period-range-display');
      if (display) display.textContent = `Period: ${stmtCustomStartDate} to ${stmtCustomEndDate}`;

      renderStatements();
    }
  };

  if (btnApplyStmtDates) btnApplyStmtDates.addEventListener('click', applyCustomStmtDates);
  if (stmtStartInput) stmtStartInput.addEventListener('change', applyCustomStmtDates);
  if (stmtEndInput) stmtEndInput.addEventListener('change', applyCustomStmtDates);

  // Date Range Presets (Header Overall Period)
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => {
        b.classList.remove('bg-zinc-900', 'text-white', 'shadow-xs');
        b.classList.add('text-zinc-600');
      });
      btn.classList.add('bg-zinc-900', 'text-white', 'shadow-xs');
      btn.classList.remove('text-zinc-600');

      dateRangePreset = btn.getAttribute('data-range');
      const label = document.getElementById('dashboard-date-range-label');
      if (label) label.textContent = btn.textContent;

      // Changing header date selector resets both charts to default sync
      cfChartPeriodOverride = null;
      salesChartPeriodOverride = null;

      const cfSelect = document.getElementById('cf-chart-period-select');
      const salesSelect = document.getElementById('sales-chart-period-select');
      if (cfSelect) cfSelect.value = 'default';
      if (salesSelect) salesSelect.value = 'default';

      // Sync custom input date values
      const { start, end } = getDateRangeBounds();
      const sInput = document.getElementById('chart-start-date');
      const eInput = document.getElementById('chart-end-date');
      if (sInput) sInput.value = start.toISOString().split('T')[0];
      if (eInput) eInput.value = end.toISOString().split('T')[0];

      renderDashboard();
    });
  });

  // Custom date range inputs (Header Overall Period)
  const startInput = document.getElementById('chart-start-date');
  const endInput = document.getElementById('chart-end-date');
  if (startInput && endInput) {
    const { start: initStart, end: initEnd } = getDateRangeBounds();
    startInput.value = initStart.toISOString().split('T')[0];
    endInput.value = initEnd.toISOString().split('T')[0];

    const onDateChange = () => {
      if (startInput.value && endInput.value) {
        document.querySelectorAll('.range-btn').forEach(b => {
          b.classList.remove('bg-zinc-900', 'text-white', 'shadow-xs');
          b.classList.add('text-zinc-600');
        });
        dateRangePreset = 'custom';
        customStartDate = startInput.value;
        customEndDate = endInput.value;
        const label = document.getElementById('dashboard-date-range-label');
        if (label) label.textContent = 'Custom Range';

        // Changing header date selector resets chart overrides
        cfChartPeriodOverride = null;
        salesChartPeriodOverride = null;
        const cfSelect = document.getElementById('cf-chart-period-select');
        const salesSelect = document.getElementById('sales-chart-period-select');
        if (cfSelect) cfSelect.value = 'default';
        if (salesSelect) salesSelect.value = 'default';

        renderDashboard();
      }
    };
    startInput.addEventListener('change', onDateChange);
    endInput.addEventListener('change', onDateChange);
  }

  // Independent Chart Period Selectors
  const cfChartSelect = document.getElementById('cf-chart-period-select');
  if (cfChartSelect) {
    cfChartSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      cfChartPeriodOverride = (val === 'default') ? null : val;
      renderCashFlowChart();
    });
  }

  const salesChartSelect = document.getElementById('sales-chart-period-select');
  if (salesChartSelect) {
    salesChartSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      salesChartPeriodOverride = (val === 'default') ? null : val;
      renderSalesChart();
    });
  }

  // Sales View Toggle Buttons (By Period vs Top Customers)
  const btnSalesPeriod = document.getElementById('btn-sales-period');
  const btnSalesCustomer = document.getElementById('btn-sales-customer');
  if (btnSalesPeriod && btnSalesCustomer) {
    btnSalesPeriod.addEventListener('click', () => {
      salesViewMode = 'trend';
      btnSalesPeriod.classList.add('bg-white', 'text-zinc-900', 'shadow-xs');
      btnSalesPeriod.classList.remove('text-zinc-500');
      btnSalesCustomer.classList.remove('bg-white', 'text-zinc-900', 'shadow-xs');
      btnSalesCustomer.classList.add('text-zinc-500');
      renderSalesChart();
    });

    btnSalesCustomer.addEventListener('click', () => {
      salesViewMode = 'customer';
      btnSalesCustomer.classList.add('bg-white', 'text-zinc-900', 'shadow-xs');
      btnSalesCustomer.classList.remove('text-zinc-500');
      btnSalesPeriod.classList.remove('bg-white', 'text-zinc-900', 'shadow-xs');
      btnSalesPeriod.classList.add('text-zinc-500');
      renderSalesChart();
    });
  }

  // ================= MODAL OPEN & CLOSE ENGINE =================
  const txModal = document.getElementById('modal-transaction');
  const addAccModal = document.getElementById('modal-add-account');
  const editAccModal = document.getElementById('modal-edit-account');
  const jedModal = document.getElementById('modal-journal-detail');

  const allModals = [txModal, addAccModal, editAccModal, jedModal].filter(Boolean);

  function closeAllModals() {
    allModals.forEach(m => m.classList.add('hidden'));
  }

  // Universal backdrop click to close
  allModals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // Global Escape key listener to close active modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeAllModals();
    }
  });

  // Universal close button delegation
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const parentModal = btn.closest('[id^="modal-"]');
      if (parentModal) {
        parentModal.classList.add('hidden');
      } else {
        closeAllModals();
      }
    });
  });

  // Transaction Modal Open/Close
  const openTxBtns = [document.getElementById('btn-open-tx-modal'), document.getElementById('btn-bento-add-tx')];
  openTxBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
      if (txModal) txModal.classList.remove('hidden');
      // Default transaction date to today
      const dateInput = document.getElementById('simple-tx-date');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
      populateModalDropdowns();
    });
  });

  const closeTxBtn = document.getElementById('modal-close-btn');
  const cancelSimpleTxBtn = document.getElementById('btn-cancel-simple-tx');
  const cancelAdvTxBtn = document.getElementById('btn-cancel-adv-tx');
  [closeTxBtn, cancelSimpleTxBtn, cancelAdvTxBtn].forEach(btn => {
    if (btn && txModal) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        txModal.classList.add('hidden');
      });
    }
  });

  // Journal Detail Modal Close
  const closeJedBtn = document.getElementById('modal-close-journal-detail-btn');
  const footCloseJedBtn = document.getElementById('btn-close-jed-modal');
  [closeJedBtn, footCloseJedBtn].forEach(btn => {
    if (btn && jedModal) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        jedModal.classList.add('hidden');
      });
    }
  });

  // Simple Mode Toggle Buttons
  const btnTypeSale = document.getElementById('btn-type-sale');
  const btnTypeExp = document.getElementById('btn-type-expense');
  const contactLabel = document.getElementById('contact-label');
  const catLabel = document.getElementById('category-label');

  if (btnTypeSale && btnTypeExp) {
    btnTypeSale.addEventListener('click', () => {
      simpleTxType = 'sale';
      btnTypeSale.classList.add('bg-zinc-900', 'text-white');
      btnTypeSale.classList.remove('text-zinc-500');
      btnTypeExp.classList.remove('bg-zinc-900', 'text-white');
      btnTypeExp.classList.add('text-zinc-500');
      if (contactLabel) contactLabel.textContent = 'Customer';
      if (catLabel) catLabel.textContent = 'Revenue Category';
      populateModalDropdowns();
    });

    btnTypeExp.addEventListener('click', () => {
      simpleTxType = 'expense';
      btnTypeExp.classList.add('bg-zinc-900', 'text-white');
      btnTypeExp.classList.remove('text-zinc-500');
      btnTypeSale.classList.remove('bg-zinc-900', 'text-white');
      btnTypeSale.classList.add('text-zinc-500');
      if (contactLabel) contactLabel.textContent = 'Vendor / Supplier';
      if (catLabel) catLabel.textContent = 'Expense Category';
      populateModalDropdowns();
    });
  }

  const btnPayNow = document.getElementById('btn-pay-now');
  const btnPayAcc = document.getElementById('btn-pay-account');
  const dueDateContainer = document.getElementById('due-date-container');
  const cashAccContainer = document.getElementById('cash-account-container');

  if (btnPayNow && btnPayAcc) {
    btnPayNow.addEventListener('click', () => {
      simplePayMethod = 'paid_now';
      btnPayNow.classList.add('bg-white', 'text-zinc-900', 'shadow-sm');
      btnPayNow.classList.remove('text-zinc-500');
      btnPayAcc.classList.remove('bg-white', 'text-zinc-900', 'shadow-sm');
      btnPayAcc.classList.add('text-zinc-500');
      if (dueDateContainer) dueDateContainer.classList.add('hidden');
      if (cashAccContainer) cashAccContainer.classList.remove('hidden');
      updateSimpleTxPreview();
    });

    btnPayAcc.addEventListener('click', () => {
      simplePayMethod = 'on_account';
      btnPayAcc.classList.add('bg-white', 'text-zinc-900', 'shadow-sm');
      btnPayAcc.classList.remove('text-zinc-500');
      btnPayNow.classList.remove('bg-white', 'text-zinc-900', 'shadow-sm');
      btnPayNow.classList.add('text-zinc-500');
      if (dueDateContainer) dueDateContainer.classList.remove('hidden');
      if (cashAccContainer) cashAccContainer.classList.add('hidden');
      updateSimpleTxPreview();
    });
  }

  // Currency select in Simple Transaction Modal
  const simpleCurrencySelect = document.getElementById('simple-tx-currency');
  const simpleCurrencySymbol = document.getElementById('simple-tx-currency-symbol');
  if (simpleCurrencySelect) {
    simpleCurrencySelect.addEventListener('change', (e) => {
      const cur = e.target.value;
      if (simpleCurrencySymbol) simpleCurrencySymbol.textContent = getCurrencySymbol(cur);
      updateSimpleTxPreview();
    });
  }

  const simpleAmtInput = document.getElementById('simple-tx-amount');
  if (simpleAmtInput) {
    simpleAmtInput.addEventListener('input', updateSimpleTxPreview);
  }

  // Simple Form Submission
  const simpleForm = document.getElementById('form-simple-tx');
  if (simpleForm) {
    simpleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('simple-tx-date').value;
      const dueDate = document.getElementById('simple-tx-due-date')?.value || '';
      const contactName = document.getElementById('simple-tx-contact')?.value || 'Direct Contact';
      const catAccId = document.getElementById('simple-tx-category').value;
      const cashAccId = document.getElementById('simple-tx-cash-acc')?.value;
      const currency = document.getElementById('simple-tx-currency').value;
      const amount = Number(document.getElementById('simple-tx-amount').value) || 0;
      const memo = document.getElementById('simple-tx-memo').value || `${simpleTxType === 'sale' ? 'Sale' : 'Expense'}: ${contactName}`;
      const file = document.getElementById('simple-tx-file')?.files[0];

      if (amount <= 0) {
        alert("Amount must be greater than zero.");
        return;
      }

      const catAcc = accounts.find(a => a.id === catAccId);
      const cashAcc = accounts.find(a => a.id === cashAccId);
      const arAcc = accounts.find(a => a.code === '1200') || accounts.find(a => a.subtype === 'Accounts Receivable');
      const apAcc = accounts.find(a => a.code === '2010') || accounts.find(a => a.subtype === 'Accounts Payable');

      let lines = [];
      let invoiceData = null;
      let billData = null;

      if (simpleTxType === 'sale') {
        if (simplePayMethod === 'paid_now') {
          lines = [
            { accountId: cashAcc.id, accountName: cashAcc.name, debit: amount, credit: 0, memo: `Receipt from ${contactName}` },
            { accountId: catAcc.id, accountName: catAcc.name, debit: 0, credit: amount, memo: `Sales revenue` }
          ];
        } else {
          lines = [
            { accountId: arAcc.id, accountName: arAcc.name, debit: amount, credit: 0, memo: `Invoice to ${contactName}` },
            { accountId: catAcc.id, accountName: catAcc.name, debit: 0, credit: amount, memo: `Sales revenue` }
          ];
          invoiceData = {
            invoiceNumber: `INV-${Date.now().toString().slice(-4)}`,
            customerName: contactName,
            date,
            dueDate,
            total: amount,
            balanceDue: amount,
            status: 'Unpaid'
          };
        }
      } else {
        if (simplePayMethod === 'paid_now') {
          lines = [
            { accountId: catAcc.id, accountName: catAcc.name, debit: amount, credit: 0, memo: `Expense for ${contactName}` },
            { accountId: cashAcc.id, accountName: cashAcc.name, debit: 0, credit: amount, memo: `Payment out` }
          ];
        } else {
          lines = [
            { accountId: catAcc.id, accountName: catAcc.name, debit: amount, credit: 0, memo: `Bill from ${contactName}` },
            { accountId: apAcc.id, accountName: apAcc.name, debit: 0, credit: amount, memo: `Obligation to ${contactName}` }
          ];
          billData = {
            billNumber: `BILL-${Date.now().toString().slice(-4)}`,
            vendorName: contactName,
            date,
            dueDate,
            total: amount,
            balanceDue: amount,
            status: 'Unpaid'
          };
        }
      }

      try {
        await executeAtomicPosting({
          date,
          memo,
          sourceType: simpleTxType === 'sale' ? 'SalesReceipt' : 'ExpenseVoucher',
          lines,
          invoiceData,
          billData,
          fileAttachment: file,
          currency
        });

        simpleForm.reset();
        txModal.classList.add('hidden');
      } catch (err) {
        console.error("Posting error:", err);
        alert(`Failed to post transaction: ${err.message}`);
      }
    });
  }

  // Transaction Modal Tab Switching (Simple vs Advanced)
  const tabModeSimple = document.getElementById('tab-mode-simple');
  const tabModeAdvanced = document.getElementById('tab-mode-advanced');
  const formSimpleTx = document.getElementById('form-simple-tx');
  const formAdvancedTx = document.getElementById('form-advanced-tx');

  function addAdvJournalLine() {
    const container = document.getElementById('adv-lines-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'adv-line-item grid grid-cols-12 gap-2 items-center bg-zinc-50 p-2.5 rounded-xl border border-zinc-200';

    const accOptions = accounts.map(a => `<option value="${a.id}">${a.code} - ${a.name} (${a.category})</option>`).join('');

    row.innerHTML = `
      <div class="col-span-5">
        <select class="adv-line-acc w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-900 font-mono text-xs focus:outline-none">
          ${accOptions}
        </select>
      </div>
      <div class="col-span-3">
        <input type="number" step="0.01" min="0" placeholder="Debit 0.00" class="adv-line-debit w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-900 font-mono text-xs text-right focus:outline-none">
      </div>
      <div class="col-span-3">
        <input type="number" step="0.01" min="0" placeholder="Credit 0.00" class="adv-line-credit w-full px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-900 font-mono text-xs text-right focus:outline-none">
      </div>
      <div class="col-span-1 flex justify-center">
        <button type="button" class="btn-remove-adv-line text-zinc-400 hover:text-rose-600 cursor-pointer p-1">
          <span class="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    `;

    const debInput = row.querySelector('.adv-line-debit');
    const credInput = row.querySelector('.adv-line-credit');
    const removeBtn = row.querySelector('.btn-remove-adv-line');

    debInput.addEventListener('input', () => {
      if (Number(debInput.value) > 0) credInput.value = '';
      updateAdvJournalTotals();
    });

    credInput.addEventListener('input', () => {
      if (Number(credInput.value) > 0) debInput.value = '';
      updateAdvJournalTotals();
    });

    removeBtn.addEventListener('click', () => {
      row.remove();
      updateAdvJournalTotals();
    });

    container.appendChild(row);
    updateAdvJournalTotals();
  }

  function updateAdvJournalTotals() {
    let totalDebits = 0;
    let totalCredits = 0;

    document.querySelectorAll('.adv-line-item').forEach(row => {
      const d = Number(row.querySelector('.adv-line-debit')?.value) || 0;
      const c = Number(row.querySelector('.adv-line-credit')?.value) || 0;
      totalDebits += d;
      totalCredits += c;
    });

    totalDebits = round2(totalDebits);
    totalCredits = round2(totalCredits);

    const debEl = document.getElementById('adv-total-debits');
    const credEl = document.getElementById('adv-total-credits');
    const statusEl = document.getElementById('adv-balance-status');
    const submitBtn = document.getElementById('btn-submit-adv');

    const baseCur = companySettings.baseCurrency || 'PHP';
    if (debEl) debEl.textContent = fmt(totalDebits, baseCur);
    if (credEl) credEl.textContent = fmt(totalCredits, baseCur);

    const isBalanced = totalDebits > 0 && Math.abs(totalDebits - totalCredits) < 0.001;

    if (statusEl) {
      if (isBalanced) {
        statusEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1';
        statusEl.textContent = 'Balanced ✓';
      } else {
        statusEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1';
        const diff = round2(Math.abs(totalDebits - totalCredits));
        statusEl.textContent = `Unbalanced (Diff: ${fmt(diff, baseCur)})`;
      }
    }

    if (submitBtn) {
      if (isBalanced) {
        submitBtn.disabled = false;
        submitBtn.className = 'w-full py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-md transition cursor-pointer';
        submitBtn.textContent = 'Post Journal Entry & Update Statements';
      } else {
        submitBtn.disabled = true;
        submitBtn.className = 'w-full py-3 rounded-2xl bg-zinc-200 text-zinc-400 font-bold text-xs transition cursor-not-allowed';
        submitBtn.textContent = 'Debits Must Equal Credits to Save';
      }
    }
  }

  if (tabModeSimple && tabModeAdvanced && formSimpleTx && formAdvancedTx) {
    tabModeSimple.addEventListener('click', () => {
      tabModeSimple.classList.add('bg-white', 'text-zinc-900', 'shadow-sm', 'font-semibold');
      tabModeSimple.classList.remove('text-zinc-500', 'font-medium');
      tabModeAdvanced.classList.remove('bg-white', 'text-zinc-900', 'shadow-sm', 'font-semibold');
      tabModeAdvanced.classList.add('text-zinc-500', 'font-medium');

      formSimpleTx.classList.remove('hidden');
      formAdvancedTx.classList.add('hidden');
    });

    tabModeAdvanced.addEventListener('click', () => {
      tabModeAdvanced.classList.add('bg-white', 'text-zinc-900', 'shadow-sm', 'font-semibold');
      tabModeAdvanced.classList.remove('text-zinc-500', 'font-medium');
      tabModeSimple.classList.remove('bg-white', 'text-zinc-900', 'shadow-sm', 'font-semibold');
      tabModeSimple.classList.add('text-zinc-500', 'font-medium');

      formAdvancedTx.classList.remove('hidden');
      formSimpleTx.classList.add('hidden');

      const advDateInput = document.getElementById('adv-tx-date');
      if (advDateInput && !advDateInput.value) {
        advDateInput.value = new Date().toISOString().split('T')[0];
      }

      // Initialize with at least 2 lines if empty
      const container = document.getElementById('adv-lines-container');
      if (container && container.children.length === 0) {
        addAdvJournalLine();
        addAdvJournalLine();
      }
    });
  }

  const btnAddAdvLine = document.getElementById('btn-add-adv-line');
  if (btnAddAdvLine) {
    btnAddAdvLine.addEventListener('click', () => addAdvJournalLine());
  }

  // Advanced Form Submission
  if (formAdvancedTx) {
    formAdvancedTx.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('adv-tx-date').value;
      const refNo = document.getElementById('adv-tx-ref')?.value || '';
      const memo = document.getElementById('adv-tx-memo').value || 'General Journal Adjustment';
      const currency = companySettings.baseCurrency || 'PHP';

      const lines = [];
      document.querySelectorAll('.adv-line-item').forEach(row => {
        const accId = row.querySelector('.adv-line-acc')?.value;
        const d = Number(row.querySelector('.adv-line-debit')?.value) || 0;
        const c = Number(row.querySelector('.adv-line-credit')?.value) || 0;
        const acc = accounts.find(a => a.id === accId);
        if (acc && (d > 0 || c > 0)) {
          lines.push({
            accountId: acc.id,
            accountName: acc.name,
            accountCode: acc.code,
            debit: d,
            credit: c,
            memo: refNo ? `[${refNo}] ${memo}` : memo
          });
        }
      });

      if (lines.length < 2) {
        alert("Please provide at least 2 line items for a double-entry journal entry.");
        return;
      }

      try {
        await executeAtomicPosting({
          date,
          memo: refNo ? `[${refNo}] ${memo}` : memo,
          sourceType: 'GeneralJournal',
          lines,
          currency
        });

        formAdvancedTx.reset();
        const container = document.getElementById('adv-lines-container');
        if (container) container.innerHTML = '';
        updateAdvJournalTotals();
        txModal.classList.add('hidden');
      } catch (err) {
        console.error("Advanced posting error:", err);
        alert(`Failed to post journal entry: ${err.message}`);
      }
    });
  }

  // Chart of Accounts (COA) Add Account Modal
  const btnOpenAddAcc = document.getElementById('btn-open-add-account');
  const btnCloseAddAcc = document.getElementById('modal-close-add-acc-btn');
  const btnCancelAddAcc = document.getElementById('btn-cancel-add-acc');

  if (btnOpenAddAcc && addAccModal) {
    btnOpenAddAcc.addEventListener('click', () => {
      populateSubtypes('new-acc-category', 'new-acc-subtype');
      const curSelect = document.getElementById('new-acc-currency');
      if (curSelect) curSelect.value = companySettings.baseCurrency || 'PHP';
      const curSym = document.getElementById('new-acc-currency-symbol');
      if (curSym) curSym.textContent = getCurrencySymbol(companySettings.baseCurrency);
      addAccModal.classList.remove('hidden');
    });
  }

  [btnCloseAddAcc, btnCancelAddAcc].forEach(btn => {
    if (btn && addAccModal) {
      btn.addEventListener('click', () => addAccModal.classList.add('hidden'));
    }
  });

  const newAccCatSelect = document.getElementById('new-acc-category');
  if (newAccCatSelect) {
    newAccCatSelect.addEventListener('change', () => {
      populateSubtypes('new-acc-category', 'new-acc-subtype');
    });
  }

  const newAccCurSelect = document.getElementById('new-acc-currency');
  if (newAccCurSelect) {
    newAccCurSelect.addEventListener('change', (e) => {
      const sym = document.getElementById('new-acc-currency-symbol');
      if (sym) sym.textContent = getCurrencySymbol(e.target.value);
    });
  }

  // Add Account Form Submit
  const addAccForm = document.getElementById('form-add-account');
  if (addAccForm) {
    addAccForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('new-acc-code').value.trim();
      const name = document.getElementById('new-acc-name').value.trim();
      const category = document.getElementById('new-acc-category').value;
      const subtype = document.getElementById('new-acc-subtype').value;
      const currency = document.getElementById('new-acc-currency').value;
      const openingBal = Number(document.getElementById('new-acc-opening-balance')?.value) || 0;
      const desc = document.getElementById('new-acc-desc')?.value || '';

      const errEl = document.getElementById('new-acc-error');
      if (errEl) errEl.classList.add('hidden');

      // Check code uniqueness
      if (accounts.some(a => a.code === code)) {
        if (errEl) {
          errEl.textContent = `Account code ${code} is already in use. Please choose a unique code.`;
          errEl.classList.remove('hidden');
        }
        return;
      }

      try {
        const companyPath = `companies/${currentUser.uid}`;
        const newAccRef = doc(collection(db, `${companyPath}/accounts`));
        const normalBalance = CATEGORY_NORMAL_BALANCE[category] || 'Debit';

        await setDoc(newAccRef, {
          code,
          name,
          category,
          subtype,
          currency,
          normalBalance,
          description: desc,
          balance: openingBal,
          active: true,
          system: false,
          createdAt: serverTimestamp()
        });

        // Record opening balance balancing transaction if entered
        if (openingBal > 0) {
          const capAcc = accounts.find(a => a.code === '3010') || accounts.find(a => a.category === 'Equity');
          if (capAcc) {
            await executeAtomicPosting({
              date: new Date().toISOString().split('T')[0],
              memo: `Opening Balance for ${code} - ${name}`,
              sourceType: 'OpeningBalance',
              currency,
              lines: [
                { accountId: newAccRef.id, accountName: name, debit: normalBalance === 'Debit' ? openingBal : 0, credit: normalBalance === 'Credit' ? openingBal : 0, memo: 'Initial opening balance' },
                { accountId: capAcc.id, accountName: capAcc.name, debit: normalBalance === 'Debit' ? 0 : openingBal, credit: normalBalance === 'Credit' ? 0 : openingBal, memo: "Owner's capital equilibrium" }
              ]
            });
          }
        }

        addAccForm.reset();
        addAccModal.classList.add('hidden');
      } catch (err) {
        console.error("Add account error:", err);
        if (errEl) {
          errEl.textContent = `Failed to create account: ${err.message}`;
          errEl.classList.remove('hidden');
        }
      }
    });
  }

  // Edit Account Form Submit
  const editAccForm = document.getElementById('form-edit-account');
  const btnCloseEditAcc = document.getElementById('modal-close-edit-acc-btn');
  const btnCancelEditAcc = document.getElementById('btn-cancel-edit-acc');

  [btnCloseEditAcc, btnCancelEditAcc].forEach(btn => {
    if (btn && editAccModal) {
      btn.addEventListener('click', () => editAccModal.classList.add('hidden'));
    }
  });

  if (editAccForm) {
    editAccForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-acc-id').value;
      const code = document.getElementById('edit-acc-code').value.trim();
      const name = document.getElementById('edit-acc-name').value.trim();
      const category = document.getElementById('edit-acc-category').value;
      const subtype = document.getElementById('edit-acc-subtype').value;
      const currency = document.getElementById('edit-acc-currency').value;
      const desc = document.getElementById('edit-acc-desc').value;

      try {
        await setDoc(doc(db, `companies/${currentUser.uid}/accounts/${id}`), {
          code,
          name,
          category,
          subtype,
          currency,
          description: desc,
          updatedAt: serverTimestamp()
        }, { merge: true });

        editAccModal.classList.add('hidden');
      } catch (err) {
        console.error("Save account error:", err);
        alert(`Error saving changes: ${err.message}`);
      }
    });
  }

  // Toggle Deactivate Account
  const btnToggleDeact = document.getElementById('btn-toggle-deactivate-account');
  if (btnToggleDeact) {
    btnToggleDeact.addEventListener('click', async () => {
      const id = document.getElementById('edit-acc-id').value;
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;

      if (SYSTEM_ACCOUNT_CODES.has(acc.code)) {
        alert("System accounts cannot be deactivated to protect core double-entry integrity.");
        return;
      }

      const newStatus = acc.active === false ? true : false;
      try {
        await setDoc(doc(db, `companies/${currentUser.uid}/accounts/${id}`), {
          active: newStatus,
          updatedAt: serverTimestamp()
        }, { merge: true });

        editAccModal.classList.add('hidden');
      } catch (err) {
        console.error("Toggle active error:", err);
      }
    });
  }

  // COA Search & Filters
  const coaSearch = document.getElementById('coa-search-input');
  if (coaSearch) {
    coaSearch.addEventListener('input', (e) => {
      coaSearchQuery = e.target.value;
      renderChartOfAccounts();
    });
  }

  document.querySelectorAll('.coa-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.coa-filter-chip').forEach(c => {
        c.classList.remove('font-bold', 'underline', 'text-zinc-900');
        c.classList.add('text-zinc-600');
      });
      chip.classList.add('font-bold', 'underline', 'text-zinc-900');
      chip.classList.remove('text-zinc-600');

      coaCategoryFilter = chip.getAttribute('data-cat');
      renderChartOfAccounts();
    });
  });

  const coaShowDeactToggle = document.getElementById('coa-show-deactivated');
  if (coaShowDeactToggle) {
    coaShowDeactToggle.addEventListener('change', (e) => {
      coaShowDeactivated = e.target.checked;
      renderChartOfAccounts();
    });
  }

  // Journal Search & Filters
  const journalSearch = document.getElementById('journal-search-input');
  if (journalSearch) {
    journalSearch.addEventListener('input', (e) => {
      journalSearchQuery = e.target.value;
      renderJournal();
    });
  }

  document.querySelectorAll('.journal-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.journal-filter-chip').forEach(c => {
        c.classList.remove('font-bold', 'underline', 'text-zinc-900');
        c.classList.add('text-zinc-600');
      });
      chip.classList.add('font-bold', 'underline', 'text-zinc-900');
      chip.classList.remove('text-zinc-600');

      journalSourceFilter = chip.getAttribute('data-src');
      renderJournal();
    });
  });

  // Ledger Search & Account Selector
  const ledgerSearch = document.getElementById('ledger-search-input');
  if (ledgerSearch) {
    ledgerSearch.addEventListener('input', (e) => {
      ledgerSearchQuery = e.target.value;
      const select = document.getElementById('ledger-account-select');
      if (select) loadActiveAccountLedger(select.value);
    });
  }

  const ledgerSelect = document.getElementById('ledger-account-select');
  if (ledgerSelect) {
    ledgerSelect.addEventListener('change', (e) => {
      loadActiveAccountLedger(e.target.value);
    });
  }

  // Company Settings Form Submit
  const settingsForm = document.getElementById('form-company-settings');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const compName = document.getElementById('setting-company-name').value.trim();
      const baseCur = document.getElementById('setting-base-currency').value;

      try {
        await setDoc(doc(db, `companies/${currentUser.uid}/settings/general`), {
          companyName: compName,
          baseCurrency: baseCur,
          updatedAt: serverTimestamp()
        }, { merge: true });

        companySettings.companyName = compName;
        companySettings.baseCurrency = baseCur;

        const alertEl = document.getElementById('settings-save-alert');
        if (alertEl) {
          alertEl.classList.remove('hidden');
          setTimeout(() => alertEl.classList.add('hidden'), 3500);
        }

        renderAllViews();
      } catch (err) {
        console.error("Settings save error:", err);
        alert(`Failed to save settings: ${err.message}`);
      }
    });
  }

  // Sample Books Seeder Button
  const btnSeed = document.getElementById('btn-seed-data');
  if (btnSeed) {
    btnSeed.addEventListener('click', async () => {
      if (!currentUser) return;
      if (!confirm("Load full sample books with multi-currency double-entry transactions?")) return;

      const cash = accounts.find(a => a.code === '1010');
      const usdBank = accounts.find(a => a.code === '1030') || accounts.find(a => a.currency === 'USD');
      const ar = accounts.find(a => a.code === '1200');
      const ap = accounts.find(a => a.code === '2010');
      const cap = accounts.find(a => a.code === '3010');
      const revServ = accounts.find(a => a.code === '4010');
      const revSales = accounts.find(a => a.code === '4020');
      const revUsd = accounts.find(a => a.code === '4030');
      const expSoftware = accounts.find(a => a.code === '5010');
      const expMarketing = accounts.find(a => a.code === '5020');
      const expRent = accounts.find(a => a.code === '5030');

      const today = new Date();
      const getISOOffset = (daysAgo) => {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
      };

      try {
        // 1. Initial Founder Seed Capital (75 days ago)
        if (cash && cap) {
          await executeAtomicPosting({
            date: getISOOffset(75),
            memo: "Owner Initial Equity Investment",
            sourceType: "OpeningCapital",
            currency: 'PHP',
            lines: [
              { accountId: cash.id, accountName: cash.name, debit: 500000, credit: 0, memo: 'Seed capital injection' },
              { accountId: cap.id, accountName: cap.name, debit: 0, credit: 500000, memo: 'Founder initial investment' }
            ]
          });
        }

        // 2. Office Lease Payment (60 days ago)
        if (expRent && cash) {
          await executeAtomicPosting({
            date: getISOOffset(60),
            memo: "Monthly Office Workspace Lease",
            sourceType: "ExpenseVoucher",
            currency: 'PHP',
            lines: [
              { accountId: expRent.id, accountName: expRent.name, debit: 35000, credit: 0, memo: 'HQ workspace rent' },
              { accountId: cash.id, accountName: cash.name, debit: 0, credit: 35000, memo: 'Direct bank debit' }
            ]
          });
        }

        // 3. Early Advisory Service to Acme Corp (45 days ago)
        if (cash && revServ) {
          await executeAtomicPosting({
            date: getISOOffset(45),
            memo: "Sale: Acme Corp - Strategy Architecture Advisory",
            sourceType: "SalesReceipt",
            currency: 'PHP',
            lines: [
              { accountId: cash.id, accountName: cash.name, debit: 65000, credit: 0, memo: 'Consulting retainer' },
              { accountId: revServ.id, accountName: revServ.name, debit: 0, credit: 65000, memo: 'Professional advisory revenue' }
            ]
          });
        }

        // 4. Product Licensing to Horizon Retailers (35 days ago)
        if (cash && revSales) {
          await executeAtomicPosting({
            date: getISOOffset(35),
            memo: "Sale: Horizon Retailers - Point of Sale POS Terminal Suite",
            sourceType: "SalesReceipt",
            currency: 'PHP',
            lines: [
              { accountId: cash.id, accountName: cash.name, debit: 92000, credit: 0, memo: 'Terminal hardware and license' },
              { accountId: revSales.id, accountName: revSales.name, debit: 0, credit: 92000, memo: 'Product sales revenue' }
            ]
          });
        }

        // 5. Office Lease Payment (30 days ago)
        if (expRent && cash) {
          await executeAtomicPosting({
            date: getISOOffset(30),
            memo: "Monthly Office Workspace Lease",
            sourceType: "ExpenseVoucher",
            currency: 'PHP',
            lines: [
              { accountId: expRent.id, accountName: expRent.name, debit: 35000, credit: 0, memo: 'HQ workspace rent' },
              { accountId: cash.id, accountName: cash.name, debit: 0, credit: 35000, memo: 'Direct bank debit' }
            ]
          });
        }

        // 6. International SaaS Sale in USD (22 days ago)
        if (usdBank && revUsd) {
          await executeAtomicPosting({
            date: getISOOffset(22),
            memo: "Sale: Apex Global Technologies - Annual Enterprise Tier (USD)",
            sourceType: "SalesReceipt",
            currency: 'USD',
            lines: [
              { accountId: usdBank.id, accountName: usdBank.name, debit: 2400, credit: 0, memo: 'US wire transfer' },
              { accountId: revUsd.id, accountName: revUsd.name, debit: 0, credit: 2400, memo: 'USD SaaS subscription revenue' }
            ]
          });
        }

        // 7. Cloud Hosting Bill from AWS (16 days ago - On Account)
        if (expSoftware && ap) {
          await executeAtomicPosting({
            date: getISOOffset(16),
            memo: "Bill: Amazon Web Services Cloud Infrastructure",
            sourceType: "VendorBill",
            currency: 'PHP',
            lines: [
              { accountId: expSoftware.id, accountName: expSoftware.name, debit: 18500, credit: 0, memo: 'Server instances & storage' },
              { accountId: ap.id, accountName: ap.name, debit: 0, credit: 18500, memo: 'Payable to AWS' }
            ],
            billData: {
              billNumber: 'BILL-AWS-091',
              vendorName: 'Amazon Web Services',
              date: getISOOffset(16),
              dueDate: getISOOffset(-14),
              total: 18500,
              balanceDue: 18500,
              status: 'Unpaid'
            }
          });
        }

        // 8. Invoiced Client Global Logistics (12 days ago - On Account)
        if (ar && revServ) {
          await executeAtomicPosting({
            date: getISOOffset(12),
            memo: "Invoice: Global Logistics Inc - Custom ERP Architecture",
            sourceType: "CustomerInvoice",
            currency: 'PHP',
            lines: [
              { accountId: ar.id, accountName: ar.name, debit: 120000, credit: 0, memo: 'Receivable from Global Logistics' },
              { accountId: revServ.id, accountName: revServ.name, debit: 0, credit: 120000, memo: 'ERP implementation services' }
            ],
            invoiceData: {
              invoiceNumber: 'INV-GL-104',
              customerName: 'Global Logistics Inc',
              date: getISOOffset(12),
              dueDate: getISOOffset(-18),
              total: 120000,
              balanceDue: 120000,
              status: 'Unpaid'
            }
          });
        }

        // 9. Digital Marketing Expense (6 days ago)
        if (expMarketing && cash) {
          await executeAtomicPosting({
            date: getISOOffset(6),
            memo: "Google & LinkedIn Growth Ad Campaign",
            sourceType: "ExpenseVoucher",
            currency: 'PHP',
            lines: [
              { accountId: expMarketing.id, accountName: expMarketing.name, debit: 22000, credit: 0, memo: 'Ad network charges' },
              { accountId: cash.id, accountName: cash.name, debit: 0, credit: 22000, memo: 'Credit card settlement' }
            ]
          });
        }

        // 10. Service Retainer from Acme Corp (3 days ago)
        if (cash && revServ) {
          await executeAtomicPosting({
            date: getISOOffset(3),
            memo: "Sale: Acme Corp - Monthly Financial Analytics Retainer",
            sourceType: "SalesReceipt",
            currency: 'PHP',
            lines: [
              { accountId: cash.id, accountName: cash.name, debit: 75000, credit: 0, memo: 'Direct bank transfer' },
              { accountId: revServ.id, accountName: revServ.name, debit: 0, credit: 75000, memo: 'Consulting revenue' }
            ]
          });
        }

        // 11. Hardware Sale to Quantum Dynamics (1 day ago)
        if (cash && revSales) {
          await executeAtomicPosting({
            date: getISOOffset(1),
            memo: "Sale: Quantum Dynamics - Workstation Infrastructure Deployment",
            sourceType: "SalesReceipt",
            currency: 'PHP',
            lines: [
              { accountId: cash.id, accountName: cash.name, debit: 58000, credit: 0, memo: 'Equipment deployment' },
              { accountId: revSales.id, accountName: revSales.name, debit: 0, credit: 58000, memo: 'Product sales' }
            ]
          });
        }

        alert("Sample books successfully loaded with multi-currency transactions!");
      } catch (err) {
        console.error("Seed error:", err);
        alert(`Failed to seed data: ${err.message}`);
      }
    });
  }
});
