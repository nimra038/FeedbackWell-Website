'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Download, FileText, Clock, CheckCircle, AlertCircle, ArrowUpRight, Search, RefreshCw, FolderOpen } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { DocumentRequest } from '@/lib/types';

const labels: Record<string, string> = { draft: 'Draft', sent: 'Sent', opened: 'Opened', in_progress: 'In progress', waiting_on_customer: 'Waiting on borrower', under_review: 'Ready for review', completed: 'Completed', expired: 'Expired', cancelled: 'Cancelled' };
const styles: Record<string, string> = { draft: 'bg-slate-100 text-slate-600', sent: 'bg-blue-50 text-blue-700', opened: 'bg-violet-50 text-violet-700', in_progress: 'bg-amber-50 text-amber-700', waiting_on_customer: 'bg-orange-50 text-orange-700', under_review: 'bg-indigo-50 text-indigo-700', completed: 'bg-emerald-50 text-emerald-700', expired: 'bg-red-50 text-red-700', cancelled: 'bg-slate-100 text-slate-500' };
const terminal = ['completed', 'cancelled', 'expired'];
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date';

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [applications, setApplications] = useState(0);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [assigned, setAssigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.get<DocumentRequest[]>('/v1/requests', { signal: controller.signal }),
      api.get<{ status: string }[]>('/v1/applications', { signal: controller.signal }),
    ]).then(([r, a]) => {
      setRequests(r.data);
      setNow(Date.now());
      setApplications(a.data.filter(item => !['approved', 'declined', 'closed'].includes(item.status)).length);
      setError('');
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const isWaiting = (r: DocumentRequest) => ['sent', 'opened', 'in_progress', 'waiting_on_customer'].includes(r.status);
  const overdue = (r: DocumentRequest) => !!r.dueDate && new Date(r.dueDate).getTime() < now && !terminal.includes(r.status);
  const waiting = requests.filter(isWaiting).length;
  const completed = requests.filter(r => r.status === 'completed').length;
  const stats = [
    { label: 'Active applications', value: applications, icon: FolderOpen, color: 'text-blue-600 bg-blue-50' },
    { label: 'Waiting on borrower', value: waiting, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { label: 'Ready for review', value: requests.filter(r => r.status === 'under_review').length, icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Missing documents', value: requests.filter(r => !terminal.includes(r.status)).reduce((sum, r) => sum + (r.progress?.missing || 0), 0), icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { label: 'Completed requests', value: completed, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
  ];
  const visible = requests.filter(r => {
    const matchesTab = tab === 'all' || (tab === 'waiting' ? isWaiting(r) : tab === 'overdue' ? overdue(r) : tab === 'missing' ? (r.progress?.missing || 0) > 0 && !terminal.includes(r.status) : r.status === tab);
    const matchesSearch = `${r.title} ${r.customer?.firstName} ${r.customer?.lastName} ${r.customer?.email}`.toLowerCase().includes(search.toLowerCase().trim());
    return matchesTab && matchesSearch && (!assigned || r.assignedUser?.id === user?.id);
  });
  const exportCsv = () => {
    const cell = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [['Request', 'Customer', 'Status', 'Completed requirements', 'Total requirements', 'Due date', 'Assigned to'], ...visible.map(r => [r.title, `${r.customer?.firstName || ''} ${r.customer?.lastName || ''}`, labels[r.status] || r.status, r.progress?.completed || 0, r.progress?.total || 0, r.dueDate || '', r.assignedUser ? `${r.assignedUser.firstName} ${r.assignedUser.lastName}` : 'Unassigned'])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'feedbackwell-requests.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-[#2d4a7a] mb-2">Lender dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{user?.firstName ? `Welcome back, ${user.firstName}` : 'Your document workspace'}</h1>
        <p className="text-sm text-slate-500 mt-2">Track requests, follow up with borrowers, and keep every file moving.</p>
      </div>
      <Link href="/requests" className="inline-flex items-center justify-center gap-2 bg-[#2d4a7a] text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-[#1a2744] transition"><Plus size={17} /> Create a request</Link>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button onClick={() => { setLoading(true); setReload(n => n + 1); }} className="inline-flex gap-2 items-center font-semibold"><RefreshCw size={15} />Retry</button></div>}
    <section aria-label="Organization overview" className="grid grid-cols-2 xl:grid-cols-5 gap-3">
      {stats.map(s => <div key={s.label} className="rounded-2xl bg-white border border-slate-200 p-5 last:col-span-2 xl:last:col-span-1"><div className="flex justify-between gap-2 items-start"><p className="text-xs font-medium text-slate-500">{s.label}</p><span className={`p-2 rounded-lg ${s.color}`}><s.icon size={16} /></span></div><p className="text-3xl font-bold mt-3 text-slate-900">{loading || error ? '?' : s.value}</p></div>)}
    </section>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden" aria-labelledby="requests-heading">
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4"><div><h2 id="requests-heading" className="font-semibold text-lg text-slate-900">Document requests</h2><p className="text-xs text-slate-500 mt-1">{loading ? 'Loading your requests?' : `${visible.length} of ${requests.length} requests`}</p></div><button onClick={exportCsv} disabled={loading || !!error || !visible.length} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Download size={15} />Export CSV</button></div>
      <div className="px-5 pt-4 flex gap-1 overflow-x-auto border-b border-slate-100">
        {[['all', 'All requests'], ['waiting', 'Waiting on borrower'], ['under_review', 'Ready for review'], ['missing', 'Missing documents'], ['overdue', 'Overdue'], ['completed', 'Completed']].map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`px-3 pb-3 text-xs font-semibold whitespace-nowrap border-b-2 ${tab === value ? 'border-[#2d4a7a] text-[#2d4a7a]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>)}
      </div>
      <div className="p-4 sm:px-6 flex flex-wrap gap-4 justify-between items-center"><label className="relative flex-1 min-w-48 max-w-md"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search requests by title, customer or email" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests, customers or email" className="w-full border border-slate-200 rounded-lg py-2.5 pl-10 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-200" /></label><label className="text-xs text-slate-600 inline-flex items-center gap-2"><input type="checkbox" checked={assigned} onChange={e => setAssigned(e.target.checked)} />Assigned to me</label></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['Request / customer', 'Status', 'Progress', 'Due date', 'Assigned to', ''].map((label, i) => <th key={i} className="px-5 py-3 font-medium whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan={6} className="p-12 text-center text-slate-500">Loading requests?</td></tr> : error ? <tr><td colSpan={6} className="p-12 text-center text-slate-500">Requests could not be loaded.</td></tr> : !visible.length ? <tr><td colSpan={6} className="p-12 text-center"><FileText className="mx-auto text-slate-300 mb-3" size={30} /><p className="font-medium text-slate-700">{requests.length ? 'No matching requests' : 'Your first request starts here'}</p><p className="text-slate-500 mt-2">{requests.length ? 'Try another search or filter.' : 'Add a customer, create a checklist, then send their secure link.'}</p></td></tr> : visible.map(r => {
          const total = r.progress?.total || 0; const done = r.progress?.completed || 0;
          return <tr key={r.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><Link href={`/requests/${r.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{r.title}</Link><p className="text-slate-500 mt-1">{r.customer?.firstName} {r.customer?.lastName}</p></td><td className="px-5 py-4"><span className={`inline-flex px-2.5 py-1.5 rounded-full whitespace-nowrap font-medium ${styles[r.status] || styles.draft}`}>{labels[r.status] || r.status}</span></td><td className="px-5 py-4"><div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><p className="text-slate-500 mt-1.5">{done}/{total} complete</p></td><td className={`px-5 py-4 whitespace-nowrap ${overdue(r) ? 'text-red-600' : 'text-slate-500'}`}>{date(r.dueDate)}{overdue(r) && <p className="mt-1 text-[10px] font-semibold">Overdue</p>}</td><td className="px-5 py-4 text-slate-600 whitespace-nowrap">{r.assignedUser ? `${r.assignedUser.firstName} ${r.assignedUser.lastName}` : 'Unassigned'}</td><td className="px-5 py-4"><Link href={`/requests/${r.id}`} aria-label={`Open ${r.title}`} className="inline-flex rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-white hover:text-blue-700"><ArrowUpRight size={16} /></Link></td></tr>;
        })}
      </tbody></table></div>
    </section>
  </div>;
}
