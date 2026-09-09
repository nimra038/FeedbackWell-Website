'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';

type Application = {
  id: string;
  applicationNumber?: string;
  applicationType?: string;
  status: string;
  customer?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  assignedUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  loanAmount?: number;
  propertyAddress?: string;
  description?: string;
};

type DocumentRequest = {
  id: string;
  applicationId?: string;
  application?: { id?: string };
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  requirements?: {
    id: string;
    name: string;
    status: string;
  }[];
};

type Message = {
  id: string;
  body?: string;
  message?: string;
  isInternal?: boolean;
  createdAt?: string;
  senderType?: string;
};

const statuses = [
  'draft',
  'requested',
  'collecting',
  'documents_in_review',
  'missing_documents',
  'ready_for_review',
  'approved',
  'declined',
  'closed',
];

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  requested: 'bg-blue-50 text-blue-700',
  collecting: 'bg-blue-50 text-blue-700',
  documents_in_review: 'bg-violet-50 text-violet-700',
  missing_documents: 'bg-amber-50 text-amber-700',
  ready_for_review: 'bg-indigo-50 text-indigo-700',
  approved: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-700',
  closed: 'bg-slate-100 text-slate-700',
};

const formatStatus = (value: string) => value.replaceAll('_', ' ');

export default function ApplicationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);

  const [form, setForm] = useState({
    applicationType: '',
    loanAmount: '',
    propertyAddress: '',
    description: '',
  });

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get<Application>(`/v1/applications/${id}`),
      api.get<DocumentRequest[]>('/v1/requests'),
    ])
      .then(async ([applicationResponse, requestsResponse]) => {
        const allRequests = requestsResponse.data || [];

        const applicationRequests = allRequests.filter((request) => {
          const item = request as DocumentRequest;

          return (
            item.applicationId === id ||
            item.application?.id === id
          );
        });

        const messageResults = await Promise.all(
          applicationRequests.map((request) =>
            api
              .get<Message[]>(`/v1/messages/request/${request.id}`)
              .then((response) =>
                (response.data || []).map((item) => ({
                  ...item,
                  requestTitle: request.title,
                })),
              )
              .catch(() => []),
          ),
        );

        if (!active) return;

        setApplication(applicationResponse.data);
        setRequests(applicationRequests);
        setMessages(messageResults.flat());
        setError('');
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const refresh = async () => {
    const [applicationResponse, requestsResponse] = await Promise.all([
      api.get<Application>(`/v1/applications/${id}`),
      api.get<DocumentRequest[]>('/v1/requests'),
    ]);

    const applicationRequests = (requestsResponse.data || []).filter(
      (request) =>
        request.applicationId === id ||
        request.application?.id === id,
    );

    const messageResults = await Promise.all(
      applicationRequests.map((request) =>
        api
          .get<Message[]>(`/v1/messages/request/${request.id}`)
          .then((response) => response.data || [])
          .catch(() => []),
      ),
    );

    setApplication(applicationResponse.data);
    setRequests(applicationRequests);
    setMessages(messageResults.flat());
  };

  const openEdit = () => {
    if (!application) return;

    setForm({
      applicationType: application.applicationType || '',
      loanAmount: application.loanAmount?.toString() || '',
      propertyAddress: application.propertyAddress || '',
      description: application.description || '',
    });

    setEditing(true);
  };

  const saveApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.patch(`/v1/applications/${id}`, {
        applicationType: form.applicationType,
        loanAmount: form.loanAmount ? Number(form.loanAmount) : null,
        propertyAddress: form.propertyAddress,
        description: form.description,
      });

      await refresh();
      setEditing(false);
      setNotice('Application details updated.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: string) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.patch(`/v1/applications/${id}/status`, { status });
      await refresh();
      setNotice('Application status updated.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!message.trim()) return;

    const requestId = requests[0]?.id;

    if (!requestId) {
      setError('Create a document request before sending a message.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.post(`/v1/messages/request/${requestId}`, {
        message: message.trim(),
        isInternal: internal,
      });

      await refresh();
      setMessage('');
      setNotice(internal ? 'Internal note saved.' : 'Message sent.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Loading application...
      </div>
    );
  }

  if (!application) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">
          {error || 'Application not found.'}
        </p>
        <Link
          href="/applications"
          className="mt-4 inline-block text-sm text-blue-700"
        >
          Back to applications
        </Link>
      </div>
    );
  }

  const customerName =
    `${application.customer?.firstName || ''} ${application.customer?.lastName || ''}`.trim() ||
    'Unknown customer';

  const totalRequirements = requests.reduce(
    (total, request) => total + (request.requirements?.length || 0),
    0,
  );

  const completedRequirements = requests.reduce(
    (total, request) =>
      total +
      (request.requirements?.filter((item) =>
        ['accepted', 'not_applicable'].includes(item.status),
      ).length || 0),
    0,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Back to applications
        </Link>

        <button
          type="button"
          onClick={openEdit}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          <Pencil size={15} />
          Edit application
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Application
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {application.applicationType || 'Application'}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {application.applicationNumber || application.id}
            </p>
          </div>

          <select
            value={application.status}
            disabled={busy}
            onChange={(event) => changeStatus(event.target.value)}
            className={`rounded-full border-0 px-4 py-2.5 text-sm font-semibold capitalize outline-none ${
              statusColors[application.status] || statusColors.draft
            }`}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-5 flex items-center gap-2 font-semibold text-slate-900">
            <UserRound size={18} />
            Customer and application details
          </h2>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase text-slate-400">Customer</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {customerName}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-slate-400">Email</p>
              <p className="mt-1 text-sm text-slate-700">
                {application.customer?.email || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-slate-400">Phone</p>
              <p className="mt-1 text-sm text-slate-700">
                {application.customer?.phone || 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-slate-400">
                Assigned staff
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {application.assignedUser
                  ? `${application.assignedUser.firstName || ''} ${application.assignedUser.lastName || ''}`
                  : 'Unassigned'}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-slate-400">
                Loan amount
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {application.loanAmount
                  ? `$${application.loanAmount.toLocaleString()}`
                  : 'Not provided'}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-slate-400">
                Property address
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {application.propertyAddress || 'Not provided'}
              </p>
            </div>
          </div>

          {application.description && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-[10px] uppercase text-slate-400">
                Description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {application.description}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-5 font-semibold text-slate-900">
            Workflow progress
          </h2>

          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
              <FileText size={20} />
            </span>

            <div>
              <p className="text-2xl font-bold text-slate-900">
                {requests.length}
              </p>
              <p className="text-xs text-slate-500">Document requests</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <CheckCircle2 size={20} />
            </span>

            <div>
              <p className="text-2xl font-bold text-slate-900">
                {completedRequirements}/{totalRequirements}
              </p>
              <p className="text-xs text-slate-500">Documents complete</p>
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${
                  totalRequirements
                    ? (completedRequirements / totalRequirements) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <FileText size={18} />
              Document requests
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Review documents required from this customer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/requests/new?applicationId=${id}`)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-xs font-semibold text-white"
          >
            <Plus size={15} />
            New document request
          </button>
        </div>

        {requests.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Request</th>
                  <th className="px-5 py-4">Progress</th>
                  <th className="px-5 py-4">Due date</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => {
                  const count = request.requirements?.length || 0;
                  const complete =
                    request.requirements?.filter((item) =>
                      ['accepted', 'not_applicable'].includes(item.status),
                    ).length || 0;

                  return (
                    <tr
                      key={request.id}
                      onClick={() => router.push(`/requests/${request.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-800">
                          {request.title}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {request.description || 'Document collection request'}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {complete} of {count}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {request.dueDate
                          ? new Date(request.dueDate).toLocaleDateString()
                          : 'No due date'}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] capitalize text-blue-700">
                          {formatStatus(request.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/requests/${request.id}`);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#2d4a7a]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500">
            No document requests have been created yet.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <MessageSquare size={18} />
          Messages and internal notes
        </h2>

        <div className="my-5 max-h-80 space-y-3 overflow-y-auto">
          {!messages.length && (
            <p className="py-6 text-center text-sm text-slate-400">
              No messages yet.
            </p>
          )}

          {messages.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl p-3 text-sm ${
                item.isInternal
                  ? 'bg-amber-50 text-amber-900'
                  : 'bg-slate-50 text-slate-700'
              }`}
            >
              <p className="mb-1 text-[10px] text-slate-400">
                {item.isInternal ? 'Internal note' : 'Customer message'} ·{' '}
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : ''}
              </p>

              {item.body || item.message}
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={internal}
              onChange={(event) => setInternal(event.target.checked)}
            />
            Internal note · staff only
          </label>

          <textarea
            required
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              internal ? 'Write an internal note...' : 'Write to customer...'
            }
            className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
          />

          <button
            disabled={busy || !message.trim() || !requests.length}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Send size={14} />
            {internal ? 'Save note' : 'Send message'}
          </button>
        </form>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={saveApplication}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit application</h2>

              <button type="button" onClick={() => setEditing(false)}>
                <X size={20} />
              </button>
            </div>

            <input
              required
              value={form.applicationType}
              onChange={(event) =>
                setForm({ ...form, applicationType: event.target.value })
              }
              placeholder="Application type"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <input
              type="number"
              min="0"
              value={form.loanAmount}
              onChange={(event) =>
                setForm({ ...form, loanAmount: event.target.value })
              }
              placeholder="Loan amount"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <input
              value={form.propertyAddress}
              onChange={(event) =>
                setForm({ ...form, propertyAddress: event.target.value })
              }
              placeholder="Property address"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder="Application description"
              className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                Cancel
              </button>

              <button
                disabled={busy}
                className="rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}