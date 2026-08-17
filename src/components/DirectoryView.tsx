import React, { useState } from 'react';
import { useAccounting } from '../context/AccountingContext';
import { Customer, Vendor } from '../types';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Receipt,
  FileText,
} from 'lucide-react';

export const DirectoryView: React.FC = () => {
  const {
    customers,
    vendors,
    invoices,
    bills,
    addNewCustomer,
    addNewVendor,
    openNewTransaction,
  } = useAccounting();

  const [activeTab, setActiveTab] = useState<'customers' | 'vendors'>('customers');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (activeTab === 'customers') {
        await addNewCustomer(name.trim(), email.trim(), phone.trim(), address.trim());
      } else {
        await addNewVendor(name.trim(), email.trim(), phone.trim(), address.trim());
      }
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
    } catch (err) {
      console.error('Failed to create contact:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100">Customers &amp; Vendors</h1>
          </div>
          <p className="text-xs text-slate-400">
            Maintain accounts receivable customer accounts and accounts payable supplier records.
          </p>
        </div>

        <button
          id="btn-add-contact"
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs sm:text-sm font-semibold transition shadow-md shadow-teal-950/30 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Add {activeTab === 'customers' ? 'Customer' : 'Vendor'}</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Customers ({customers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'vendors'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Vendors ({vendors.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeTab === 'customers' ? (
          filteredCustomers.length === 0 ? (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              No customers found. Click &quot;Add Customer&quot; above to create one.
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const custInvoices = invoices.filter((i) => i.customerId === cust.id);
              const openBalance = custInvoices
                .filter((i) => i.status !== 'Paid')
                .reduce((s, i) => s + (i.balanceDue || 0), 0);

              return (
                <div
                  key={cust.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{cust.name}</h3>
                      <p className="text-[11px] text-slate-400">{cust.email || 'No email'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                      Customer
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400">
                    {cust.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                    {cust.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate">{cust.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Open Receivables</span>
                      <span className="font-mono font-bold text-sky-400">
                        ${openBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase">Invoices</span>
                      <span className="font-mono text-slate-300">{custInvoices.length} total</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          filteredVendors.length === 0 ? (
            <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              No vendors found. Click &quot;Add Vendor&quot; above to create one.
            </div>
          ) : (
            filteredVendors.map((vend) => {
              const vendBills = bills.filter((b) => b.vendorId === vend.id);
              const openBalance = vendBills
                .filter((b) => b.status !== 'Paid')
                .reduce((s, b) => s + (b.balanceDue || 0), 0);

              return (
                <div
                  key={vend.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">{vend.name}</h3>
                      <p className="text-[11px] text-slate-400">{vend.email || 'No email'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Vendor
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400">
                    {vend.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span>{vend.phone}</span>
                      </div>
                    )}
                    {vend.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate">{vend.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Open Payables</span>
                      <span className="font-mono font-bold text-amber-400">
                        ${openBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase">Bills</span>
                      <span className="font-mono text-slate-300">{vendBills.length} total</span>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-slate-100">
              Add New {activeTab === 'customers' ? 'Customer' : 'Vendor'}
            </h2>
            <form onSubmit={handleAddContact} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Company / Individual Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Innovations Ltd."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="billing@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Billing / Street Address</label>
                <textarea
                  rows={2}
                  placeholder="100 Market St, Suite 400..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold transition cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
