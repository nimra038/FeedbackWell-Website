'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { errorMessage } from '@/lib/errors';
import { downloadCsv } from '@/lib/csv';
import type { DocumentRequest, Customer } from '@/lib/types';
import {
  Plus, Search, FileText, Clock, CheckCircle, AlertCircle,
  Send, Eye, MoreVertical, Download, Copy, Check
} from 'lucide-react';
import Link from 'next/link';

const statusStyle: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  opened: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  waiting_on_customer: 'bg-orange-100 text-orange-700',
  under_review: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
};

const statusLabel: Record<string, string> = {
  waiting_on_customer: 'Waiting on Borrower',
  under_review: 'Ready for Review',
  in_progress: 'In Progress',
  completed: 'Completed',
  draft: 'Draft', sent: 'Sent', opened: 'Opened', expired: 'Expired',
};

const avatarColors = [
  'from-blue-400 to-blue-600', 'from-purple-400 to-purple-600',
  'from-green-400 to-green-600', 'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600', 'from-pink-400 to-pink-600',
];

const tabs = ['All', 'Draft', 'Sent', 'In Progress', 'Completed'];

export default function RequestsPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [applications, setApplications] = useState<{id:string;customerId:string;applicationType:string}[]>([]);
  const [applicationId, setApplicationId] = useState('');
  const [reminders, setReminders] = useState('24, 72, 168');
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ customerId: '', title: '', description: '', dueDate: '' });

  const load = () =>
    api.get('/v1/requests')
      .then((r) => setRequests(r.data))
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    api.get('/v1/customers').then((r) => setCustomers(r.data)).catch(e => setError(errorMessage(e)));
    api.get('/v1/applications').then(r => setApplications(r.data)).catch(e => setError(errorMessage(e)));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api.post('/v1/requests', { ...form, applicationId: applicationId || undefined, reminderScheduleHours: reminders.trim() ? reminders.split(',').map(h=>Number(h.trim())) : [] });
      router.push(`/requests/${created.data.id}`);
      setShowModal(false);
      setForm({ customerId: '', title: '', description: '', dueDate: '' });
      load();
    } catch(e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };

  const handleSend = async (id: string) => {
    try { await api.patch(`/v1/requests/${id}/send`); await load(); } catch(e) { setError(errorMessage(e)); }
  };

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`).catch(() => setError('Unable to copy portal link'));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = requests.filter(r => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Draft') return r.status === 'draft';
    if (activeTab === 'Sent') return ['sent', 'opened'].includes(r.status);
    if (activeTab === 'In Progress') return ['in_progress', 'waiting_on_customer', 'under_review'].includes(r.status);
    if (activeTab === 'Completed') return r.status === 'completed';
    return true;
  });

  const stats = [
    { label: 'Total Requests', value: requests.length, icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Waiting on Borrower', value: requests.filter(r => r.status === 'waiting_on_customer').length, icon: Clock, iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
    { label: 'Ready for Review', value: requests.filter(r => r.status === 'under_review').length, icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-600' },
    { label: 'Completed', value: requests.filter(r => r.status === 'completed').length, icon: AlertCircle, iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {error && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</p>}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900">Document Requests</h2>
          <p className="text-gray-500 text-sm mt-0.5">Create and manage document collection requests</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#2d4a7a] hover:bg-[#3a5a8f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
          <Plus size={15} /> New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => {
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
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Search requests..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <button onClick={() => downloadCsv('requests.csv', [['Title','Status','Customer','Due date'], ...filtered.map(r=>[r.title,r.status,`${r.customer?.firstName} ${r.customer?.lastName}`,r.dueDate])])} className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition font-medium ml-auto">
            <Download size={13} /> Export
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-100 flex overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const count = tab === 'All' ? requests.length
              : tab === 'Draft' ? requests.filter(r => r.status === 'draft').length
              : tab === 'Sent' ? requests.filter(r => ['sent','opened'].includes(r.status)).length
              : tab === 'In Progress' ? requests.filter(r => ['in_progress','waiting_on_customer','under_review'].includes(r.status)).length
              : requests.filter(r => r.status === 'completed').length;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${
                  activeTab === tab ? 'border-[#2d4a7a] text-[#2d4a7a]' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}>
                {tab}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab ? 'bg-[#2d4a7a]/10 text-[#2d4a7a]' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Request / Customer</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-[#2d4a7a] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-400">Loading requests...</p>
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <FileText size={22} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">No requests found</p>
                      <p className="text-xs text-gray-400 mt-0.5">Create your first document request</p>
                    </div>
                    <button onClick={() => setShowModal(true)}
                      className="flex items-center gap-1.5 bg-[#2d4a7a] hover:bg-[#3a5a8f] text-white px-4 py-2 rounded-lg text-xs font-semibold transition mt-1">
                      <Plus size={13} /> New Request
                    </button>
                  </div>
                </td></tr>
              ) : (
                filtered.map((r, i) => {
                  const initials = `${r.customer?.firstName?.[0] || '?'}${r.customer?.lastName?.[0] || ''}`;
                  const grad = avatarColors[i % avatarColors.length];
                  const isOverdue = r.dueDate && new Date(r.dueDate) < new Date();
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <Link href={`/requests/${r.id}`}
                              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition">
                              {r.title}
                            </Link>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {r.customer?.firstName} {r.customer?.lastName} · {r.customer?.email || 'No email'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle[r.status] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.dueDate ? (
                          <p className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                            {isOverdue && '⚠ '}
                            {new Date(r.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/requests/${r.id}`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                            <Eye size={14} />
                          </Link>
                          {r.status === 'draft' && (
                            <button onClick={() => handleSend(r.id)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition">
                              <Send size={14} />
                            </button>
                          )}
                          {r.portalToken && (
                            <button onClick={() => copyLink(r.portalToken, r.id)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition">
                              {copiedId === r.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                          )}
                          <button aria-label="Open request details" onClick={() => router.push(`/requests/${r.id}`)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
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

        {filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Showing <span className="font-medium text-gray-600">{filtered.length}</span> of <span className="font-medium text-gray-600">{requests.length}</span> requests
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">New Document Request</h3>
              <p className="text-sm text-gray-400 mt-0.5">Send a secure document request to your customer</p>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Customer *</label>
                <select required value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName} {c.email ? `— ${c.email}` : ''}</option>
                  ))}
                </select>
                {customers.length === 0 && (
                  <p className="text-[11px] text-orange-500 mt-1">No customers yet. <Link href="/customers" className="underline">Add one first.</Link></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Request Title *</label>
                <select aria-label="Optional application" value={applicationId} onChange={e=>setApplicationId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3"><option value="">No linked application</option>{applications.filter(a=>a.customerId===form.customerId).map(a=><option key={a.id} value={a.id}>{a.applicationType}</option>)}</select>
                <input required value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Mortgage Application Documents"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Instructions (optional)</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} placeholder="Instructions for the customer..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Due Date</label>
                <label className="block text-xs text-gray-600 mb-3">Reminder hours after sending (leave empty to disable)<input value={reminders} onChange={e=>setReminders(e.target.value)} className="block w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-2" /></label>
                <input type="date" value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-[#2d4a7a] hover:bg-[#3a5a8f] text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
