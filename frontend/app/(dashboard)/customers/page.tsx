'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { downloadCsv } from '@/lib/csv';
import type { Customer } from '@/lib/types';
import {
  Plus, Search, Users, UserCheck, UserX, Building2,
  MoreVertical, Mail, Phone, Filter, Download, Eye, X
} from 'lucide-react';

const typeColors: Record<string, string> = {
  individual: 'bg-blue-50 text-blue-700',
  business: 'bg-purple-50 text-purple-700',
  joint: 'bg-teal-50 text-teal-700',
  guarantor: 'bg-orange-50 text-orange-700',
  co_borrower: 'bg-pink-50 text-pink-700',
  other: 'bg-gray-100 text-gray-600',
};

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-green-400 to-green-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-pink-400 to-pink-600',
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    phone: '', companyName: '', customerType: 'individual',
  });

  const load = (q = '') =>
    api.get(`/v1/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`)
      .then((r) => { setCustomers(r.data); setError(''); })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));



  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing) await api.patch(`/v1/customers/${editing}`, form);
      else await api.post('/v1/customers', form);
      setEditing(null);
      setShowModal(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', companyName: '', customerType: 'individual' });
      load(search);
    } catch(e) { setFormError(errorMessage(e)); } finally {
      setSaving(false);
    }
  };

  const visible = customers.filter(c => !onlyActive || c.status === 'active');
  const edit = (c: Customer) => { setEditing(c.id); setFormError(''); setForm({firstName:c.firstName,lastName:c.lastName,email:c.email||'',phone:c.phone||'',companyName:c.companyName||'',customerType:c.customerType});setShowModal(true); };
  const archive = async(id:string) => { try { await api.delete(`/v1/customers/${id}`);load(search); } catch(e) {setError(errorMessage(e));} };
  const active = customers.filter(c => c.status === 'active').length;
  const inactive = customers.filter(c => c.status !== 'active').length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {error && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</p>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 text-sm mt-0.5">Manage your borrowers and clients</p>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button onClick={() => downloadCsv('customers.csv', [['First name','Last name','Email','Phone','Company'], ...visible.map(c=>[c.firstName,c.lastName,c.email,c.phone,c.companyName])])} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 transition font-medium">
            <Download size={14} /> Export
          </button>
          <button onClick={() => { setEditing(null); setFormError(''); setForm({firstName:'',lastName:'',email:'',phone:'',companyName:'',customerType:'individual'}); setShowModal(true); }}
            className="flex flex-1 sm:flex-none justify-center items-center gap-2 bg-[#2d4a7a] hover:bg-[#3a5a8f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
            <Plus size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Total Customers', value: customers.length, icon: Users, iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
          { label: 'Active', value: active, icon: UserCheck, iconBg: 'bg-green-50', iconColor: 'text-green-500' },
          { label: 'Inactive', value: inactive, icon: UserX, iconBg: 'bg-gray-100', iconColor: 'text-gray-400' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border-2 border-gray-200 px-5 py-5 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{s.label}</p>
                <div className={`w-8 h-8 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={15} className={s.iconColor} />
                </div>
              </div>
              <p className="text-[32px] font-extrabold text-gray-900 leading-none tracking-tight">{loading ? '—' : s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, company..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <button onClick={() => setOnlyActive(v=>!v)} aria-pressed={onlyActive} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition font-medium">
            <Filter size={13} /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Added</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#2d4a7a] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-gray-400">Loading customers...</p>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <Users size={22} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {search ? 'No customers found' : 'No customers yet'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {search ? 'Try a different search term' : 'Add your first customer to get started'}
                        </p>
                      </div>
                      {!search && (
                        <button onClick={() => { setEditing(null); setFormError(''); setForm({firstName:'',lastName:'',email:'',phone:'',companyName:'',customerType:'individual'}); setShowModal(true); }}
                          className="flex items-center gap-1.5 bg-[#2d4a7a] hover:bg-[#3a5a8f] text-white px-4 py-2 rounded-lg text-xs font-semibold transition mt-1">
                          <Plus size={13} /> Add Customer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((c, i) => {
                  const initials = `${c.firstName?.[0] || ''}${c.lastName?.[0] || ''}`;
                  const grad = avatarColors[i % avatarColors.length];
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {c.firstName} {c.lastName}
                            </p>
                            {c.externalReference && (
                              <p className="text-[11px] text-gray-400">#{c.externalReference}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Mail size={11} className="text-gray-400" />
                              {c.email}
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Phone size={11} className="text-gray-400" />
                              {c.phone}
                            </div>
                          )}
                          {!c.email && !c.phone && <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {c.companyName ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Building2 size={12} className="text-gray-400" />
                            {c.companyName}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${typeColors[c.customerType] || 'bg-gray-100 text-gray-600'}`}>
                          {c.customerType?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button aria-label={`Edit ${c.firstName}`} onClick={() => edit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Eye size={14} />
                          </button>
                          <button aria-label={`Archive ${c.firstName}`} onClick={() => archive(c.id)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {customers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing <span className="font-medium text-gray-600">{customers.length}</span> customers
            </p>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm flex items-start sm:items-center justify-center z-[100] p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100svh-1.5rem)] sm:max-h-[calc(100svh-3rem)] flex flex-col overflow-hidden my-auto">
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-start gap-4 shrink-0">
              <div className="flex-1"><h3 id="customer-modal-title" className="text-lg font-bold text-gray-900">{editing ? 'Edit customer' : 'Add customer'}</h3>
              <p className="text-sm text-gray-400 mt-0.5">{editing ? 'Update borrower or client details' : 'Add a new borrower or client'}</p></div>
              <button type="button" aria-label="Close customer form" onClick={() => setShowModal(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
              {formError && <p role="alert" className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{formError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">First Name *</label>
                  <input required value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="John"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last Name *</label>
                  <input required value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Smith"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone</label>
                <input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company Name</label>
                <input value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="Acme Corp"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Customer Type</label>
                <select value={form.customerType}
                  onChange={(e) => setForm({ ...form, customerType: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                  <option value="joint">Joint</option>
                  <option value="guarantor">Guarantor</option>
                  <option value="co_borrower">Co-Borrower</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#2d4a7a] hover:bg-[#3a5a8f] text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Add customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
