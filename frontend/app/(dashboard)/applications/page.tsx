'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  UserRound,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth.store';
import type { Customer, StaffUser } from '@/lib/types';

type Application = {
  id: string;
  applicationNumber: string;
  applicationType: string;
  status: string;
  customer: Customer;
  assignedUser?: StaffUser;
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

const applicationTypes = [
  'Residential mortgage',
  'Mortgage refinance',
  'Home equity loan / HELOC',
  'Commercial real estate loan',
  'Business / commercial loan',
  'SBA loan',
  'Equipment finance',
  'Auto finance',
  'Consumer loan',
  'Private / hard-money loan',
  'Debt / credit service',
  'Accounting / tax engagement',
  'Other financial application',
];

const completedStatuses = new Set(['approved', 'declined', 'closed']);

const colors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  requested: 'bg-blue-50 text-blue-700',
  collecting: 'bg-blue-50 text-blue-700',
  documents_in_review: 'bg-violet-50 text-violet-700',
  missing_documents: 'bg-amber-50 text-amber-700',
  ready_for_review: 'bg-indigo-50 text-indigo-700',
  approved: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-rose-50 text-rose-700',
  closed: 'bg-slate-100 text-slate-600',
};

const label = (value: string) => value.replaceAll('_', ' ');

export default function ApplicationsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [apps, setApps] = useState<Application[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [view, setView] = useState<'active' | 'completed'>('active');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    applicationType: '',
    assignedUserId: '',
  });

  const canEdit = [
    'owner',
    'admin',
    'manager',
    'loan_officer',
  ].includes(user?.role || '');

  const activeApps = apps.filter(
    (app) => !completedStatuses.has(app.status),
  );

  const completedApps = apps.filter((app) =>
    completedStatuses.has(app.status),
  );

  const visibleApps = view === 'active' ? activeApps : completedApps;

  useEffect(() => {
    let live = true;

    Promise.all([
      api.get<Application[]>('/v1/applications'),
      api.get<Customer[]>('/v1/customers'),
    ])
      .then(([applicationsResponse, customersResponse]) => {
        if (!live) return;
        setApps(applicationsResponse.data);
        setCustomers(customersResponse.data);
      })
      .catch((err) => {
        if (live) setError(errorMessage(err));
      });

    return () => {
      live = false;
    };
  }, [reload]);

  useEffect(() => {
    if (user && ['owner', 'admin', 'manager'].includes(user.role)) {
      api
        .get<StaffUser[]>('/v1/users')
        .then((response) => setStaff(response.data))
        .catch((err) => setError(errorMessage(err)));
    }
  }, [user]);

  const openForm = () => {
    setError('');
    setForm({
      customerId: '',
      applicationType: '',
      assignedUserId: '',
    });
    setShowForm(true);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await api.post('/v1/applications', {
        ...form,
        assignedUserId: form.assignedUserId || user?.id,
      });

      setShowForm(false);
      setReload((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setBusy(true);
    setError('');

    try {
      await api.patch(`/v1/applications/${id}/status`, { status });
      setReload((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-7">
      <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#52709f]">
            WORKFLOW MANAGEMENT
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Applications
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage customer applications and document workflows.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#213a64]"
          >
            <Plus size={16} />
            New application
          </button>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView('active')}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
              view === 'active'
                ? 'bg-[#2d4a7a] text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Active ({activeApps.length})
          </button>

          <button
            type="button"
            onClick={() => setView('completed')}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
              view === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            Completed ({completedApps.length})
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Select an application to view its details.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          {view === 'active' ? (
            <FolderOpen size={20} className="text-[#52709f]" />
          ) : (
            <CheckCircle2 size={20} className="text-emerald-600" />
          )}

          <div>
            <h2 className="font-semibold capitalize text-slate-900">
              {view} applications
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {view === 'active'
                ? 'Applications currently moving through your workflow.'
                : 'Approved, declined and closed applications.'}
            </p>
          </div>
        </div>

        {visibleApps.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Application</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Assigned to</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleApps.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() =>
                      router.push(`/applications/${app.id}`)
                    }
                    className="cursor-pointer transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#edf2f9] text-[#2d4a7a]">
                          <FileText size={17} />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {app.applicationType}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {app.applicationNumber}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-700">
                        {app.customer?.firstName} {app.customer?.lastName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {app.customer?.email}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <UserRound size={14} className="text-slate-400" />
                        {app.assignedUser
                          ? `${app.assignedUser.firstName} ${app.assignedUser.lastName}`
                          : 'Unassigned'}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      {canEdit ? (
                        <select
                          aria-label={`Status for ${app.applicationNumber}`}
                          value={app.status}
                          disabled={busy}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateStatus(app.id, event.target.value)
                          }
                          className={`rounded-full border-0 px-3 py-1.5 text-[11px] font-semibold capitalize outline-none ${
                            colors[app.status] || colors.draft
                          }`}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {label(status)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize ${
                            colors[app.status] || colors.draft
                          }`}
                        >
                          {label(app.status)}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/applications/${app.id}`);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#2d4a7a] hover:bg-[#edf2f9]"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            {view === 'active' ? (
              <FolderOpen className="mx-auto text-slate-300" size={30} />
            ) : (
              <CheckCircle2 className="mx-auto text-slate-300" size={30} />
            )}

            <p className="mt-3 text-sm font-medium text-slate-700">
              No {view} applications
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {view === 'active'
                ? 'Create an application to begin.'
                : 'Completed applications will appear here.'}
            </p>

            {view === 'active' && canEdit && (
              <button
                type="button"
                onClick={openForm}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-xs font-semibold text-white"
              >
                <Plus size={15} />
                New application
              </button>
            )}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 bg-[#f4f7fb] p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2d4a7a] text-white">
                <ClipboardList size={18} />
              </span>

              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">
                  New application
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Choose a financial product and assign the application.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close application form"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={create} className="space-y-4 p-5">
              <label className="block text-xs font-medium text-slate-600">
                Customer
                <select
                  required
                  value={form.customerId}
                  onChange={(event) =>
                    setForm({ ...form, customerId: event.target.value })
                  }
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.firstName} {customer.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Application type
                <select
                  required
                  value={form.applicationType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      applicationType: event.target.value,
                    })
                  }
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose application type</option>
                  {applicationTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Assign to
                <select
                  value={form.assignedUserId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      assignedUserId: event.target.value,
                    })
                  }
                  className="mt-1.5 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Assign to me</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <ClipboardList size={16} />
                  {busy ? 'Creating...' : 'Create application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}