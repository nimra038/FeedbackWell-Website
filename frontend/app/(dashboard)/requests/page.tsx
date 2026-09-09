'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { downloadCsv } from '@/lib/csv';
import type { DocumentRequest, Customer } from '@/lib/types';
import {
  Plus,
  Search,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Pencil,
  Download,
  Copy,
  Check,
  X,
} from 'lucide-react';

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
  draft: 'Draft',
  sent: 'Sent',
  opened: 'Opened',
  expired: 'Expired',
};

const avatarColors = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-green-400 to-green-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-pink-400 to-pink-600',
];

const tabs = ['All', 'Draft', 'Sent', 'In Progress', 'Completed'];

export default function RequestsPage() {
  const router = useRouter();

  const [error, setError] = useState('');
  const [applications, setApplications] = useState<
    { id: string; customerId: string; applicationType: string }[]
  >([]);
  const [applicationId, setApplicationId] = useState('');
  const [reminders, setReminders] = useState('24, 72, 168');
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerId: '',
    title: '',
    description: '',
    dueDate: '',
  });

  const load = async () => {
    try {
      const response = await api.get<DocumentRequest[]>('/v1/requests');
      setRequests(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    api
      .get<Customer[]>('/v1/customers')
      .then((response) => setCustomers(response.data))
      .catch((err) => setError(errorMessage(err)));

    api
      .get('/v1/applications')
      .then((response) => setApplications(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const openModal = () => {
    setError('');
    setForm({
      customerId: '',
      title: '',
      description: '',
      dueDate: '',
    });
    setApplicationId('');
    setReminders('24, 72, 168');
    setShowModal(true);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const reminderScheduleHours = reminders
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      const created = await api.post('/v1/requests', {
        ...form,
        applicationId: applicationId || undefined,
        reminderScheduleHours,
      });

      setShowModal(false);
      await load();
      router.push(`/requests/${created.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await api.patch(`/v1/requests/${id}/send`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const copyLink = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/portal/${token}`,
      );
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Unable to copy portal link');
    }
  };

  const filtered = requests.filter((request) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Draft') return request.status === 'draft';
    if (activeTab === 'Sent') {
      return ['sent', 'opened'].includes(request.status);
    }
    if (activeTab === 'In Progress') {
      return [
        'in_progress',
        'waiting_on_customer',
        'under_review',
      ].includes(request.status);
    }
    if (activeTab === 'Completed') {
      return request.status === 'completed';
    }
    return true;
  });

  const stats = [
    {
      label: 'Total Requests',
      value: requests.length,
      icon: FileText,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Waiting on Borrower',
      value: requests.filter((request) => request.status === 'waiting_on_customer')
        .length,
      icon: Clock,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-500',
    },
    {
      label: 'Ready for Review',
      value: requests.filter((request) => request.status === 'under_review')
        .length,
      icon: CheckCircle,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      label: 'Completed',
      value: requests.filter((request) => request.status === 'completed')
        .length,
      icon: AlertCircle,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-gray-900">
            Document Requests
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Create and manage document collection requests
          </p>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a5a8f]"
        >
          <Plus size={15} />
          New Request
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="flex flex-col gap-2 rounded-2xl border-2 border-gray-200 bg-white px-5 py-5"
            >
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {stat.label}
                </p>

                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${stat.iconBg}`}
                >
                  <Icon size={15} className={stat.iconColor} />
                </div>
              </div>

              <p className="text-[32px] font-extrabold leading-none tracking-tight text-gray-900">
                {loading ? '—' : stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="relative max-w-sm flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              placeholder="Search requests..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              downloadCsv('requests.csv', [
                ['Title', 'Status', 'Customer', 'Due date'],
                ...filtered.map((request) => [
                  request.title,
                  request.status,
                  `${request.customer?.firstName || ''} ${
                    request.customer?.lastName || ''
                  }`,
                  request.dueDate || '',
                ]),
              ])
            }
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Download size={13} />
            Export
          </button>
        </div>

        <div className="flex overflow-x-auto border-b border-gray-100 px-6 scrollbar-none">
          {tabs.map((tab) => {
            const count =
              tab === 'All'
                ? requests.length
                : tab === 'Draft'
                  ? requests.filter((request) => request.status === 'draft')
                      .length
                  : tab === 'Sent'
                    ? requests.filter((request) =>
                        ['sent', 'opened'].includes(request.status),
                      ).length
                    : tab === 'In Progress'
                      ? requests.filter((request) =>
                          [
                            'in_progress',
                            'waiting_on_customer',
                            'under_review',
                          ].includes(request.status),
                        ).length
                      : requests.filter(
                          (request) => request.status === 'completed',
                        ).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition ${
                  activeTab === tab
                    ? 'border-[#2d4a7a] text-[#2d4a7a]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab}

                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      activeTab === tab
                        ? 'bg-[#2d4a7a]/10 text-[#2d4a7a]'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Request / Customer
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2d4a7a] border-t-transparent" />
                      <p className="text-sm text-gray-400">
                        Loading requests...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                        <FileText size={22} className="text-gray-400" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          No requests found
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Create your first document request
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={openModal}
                        className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#2d4a7a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3a5a8f]"
                      >
                        <Plus size={13} />
                        New Request
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((request, index) => {
                  const initials = `${request.customer?.firstName?.[0] || '?'}${
                    request.customer?.lastName?.[0] || ''
                  }`;

                  const isOverdue =
                    Boolean(request.dueDate) &&
                    new Date(request.dueDate as string) < new Date();

                  return (
                    <tr
                      key={request.id}
                      className="transition group hover:bg-gray-50/70"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              avatarColors[index % avatarColors.length]
                            } text-xs font-bold text-white`}
                          >
                            {initials}
                          </div>

                          <div>
                            <Link
                              href={`/requests/${request.id}`}
                              className="text-sm font-semibold text-gray-900 transition hover:text-blue-600"
                            >
                              {request.title}
                            </Link>

                            <p className="mt-0.5 text-[11px] text-gray-400">
                              {request.customer?.firstName}{' '}
                              {request.customer?.lastName} ·{' '}
                              {request.customer?.email || 'No email'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            statusStyle[request.status] ||
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {statusLabel[request.status] || request.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {request.dueDate ? (
                          <p
                            className={`text-xs font-medium ${
                              isOverdue ? 'text-red-500' : 'text-gray-500'
                            }`}
                          >
                            {isOverdue && '⚠ '}
                            {new Date(request.dueDate).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              },
                            )}
                          </p>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-gray-400">
                        {new Date(request.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/requests/${request.id}?edit=true`}
                            aria-label="Edit request"
                            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil size={14} />
                          </Link>

                          {request.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleSend(request.id)}
                              aria-label="Send request by email"
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-green-50 hover:text-green-600"
                            >
                              <Send size={14} />
                            </button>
                          )}

                          {request.portalToken && (
                            <button
                              type="button"
                              onClick={() =>
                                copyLink(request.portalToken, request.id)
                              }
                              aria-label="Copy portal link"
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-purple-50 hover:text-purple-600"
                            >
                              {copiedId === request.id ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          )}
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
          <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <p className="text-xs text-gray-400">
              Showing{' '}
              <span className="font-medium text-gray-600">
                {filtered.length}
              </span>{' '}
              of{' '}
              <span className="font-medium text-gray-600">
                {requests.length}
              </span>{' '}
              requests
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4 border-b border-slate-100 bg-[#f4f7fb] px-5 py-5 sm:px-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2d4a7a] text-white shadow-sm">
                <FileText size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  New document request
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Send a secure document collection request to your customer.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="max-h-[65vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    Customer <span className="text-red-500">*</span>
                  </span>

                  <select
                    required
                    value={form.customerId}
                    onChange={(event) => {
                      setForm({
                        ...form,
                        customerId: event.target.value,
                      });
                      setApplicationId('');
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.firstName} {customer.lastName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    Link to application
                  </span>

                  <select
                    value={applicationId}
                    onChange={(event) => setApplicationId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="">No application</option>

                    {applications
                      .filter(
                        (application) =>
                          !form.customerId ||
                          application.customerId === form.customerId,
                      )
                      .map((application) => (
                        <option key={application.id} value={application.id}>
                          {application.applicationType}
                        </option>
                      ))}
                  </select>

                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Linking an application keeps all document requests together.
                  </p>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    Request title <span className="text-red-500">*</span>
                  </span>

                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        title: event.target.value,
                      })
                    }
                    placeholder="e.g. Income verification documents"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    Instructions for customer
                  </span>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description: event.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Tell the customer what documents are needed..."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      Due date
                    </span>

                    <input
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          dueDate: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      Reminders
                    </span>

                    <input
                      value={reminders}
                      onChange={(event) => setReminders(event.target.value)}
                      placeholder="24, 72, 168"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                    />

                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Enter hours separated by commas.
                    </p>
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d4a7a] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a5a8f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
                  {saving ? 'Creating request...' : 'Create request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}