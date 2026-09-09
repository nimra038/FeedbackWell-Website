'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { downloadCsv } from '@/lib/csv';
import type { Customer } from '@/lib/types';
import {
  Plus,
  Search,
  Users,
  UserCheck,
  UserX,
  Building2,
  Mail,
  Phone,
  Filter,
  Download,
  Pencil,
  FileText,
  Archive,
  X,
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

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  customerType: 'individual',
};

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
  const [form, setForm] = useState(emptyForm);

  const load = async (query = '') => {
    setLoading(true);

    try {
      const response = await api.get(
        `/v1/customers${
          query ? `?search=${encodeURIComponent(query)}` : ''
        }`,
      );

      setCustomers(response.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditing(null);
    setFormError('');
    setForm(emptyForm);
  };

  const openCreateModal = () => {
    setEditing(null);
    setFormError('');
    setForm(emptyForm);
    setShowModal(true);
  };

  const edit = (customer: Customer) => {
    setEditing(customer.id);
    setFormError('');

    setForm({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      companyName: customer.companyName || '',
      customerType: customer.customerType || 'individual',
    });

    setShowModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      if (editing) {
        await api.patch(`/v1/customers/${editing}`, form);
      } else {
        await api.post('/v1/customers', form);
      }

      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      await load(search);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to archive this customer?',
    );

    if (!confirmed) return;

    try {
      await api.delete(`/v1/customers/${id}`);
      await load(search);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const visible = customers.filter(
    (customer) => !onlyActive || customer.status === 'active',
  );

  const active = customers.filter(
    (customer) => customer.status === 'active',
  ).length;

  const inactive = customers.filter(
    (customer) => customer.status !== 'active',
  ).length;

  const stats = [
    {
      label: 'Total Customers',
      value: customers.length,
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      label: 'Active',
      value: active,
      icon: UserCheck,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      label: 'Inactive',
      value: inactive,
      icon: UserX,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-400',
    },
  ];

  return (
    <div className="space-y-4 p-3 sm:space-y-5 sm:p-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-[22px]">
            Customers
          </h2>

          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
            Manage your borrowers and clients
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv('customers.csv', [
                ['First name', 'Last name', 'Email', 'Phone', 'Company'],
                ...visible.map((customer) => [
                  customer.firstName,
                  customer.lastName,
                  customer.email,
                  customer.phone,
                  customer.companyName,
                ]),
              ])
            }
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 sm:px-3 sm:text-sm"
          >
            <Download size={13} />
            Export
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-[#2d4a7a] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3a5a8f] sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <Plus size={14} />
            Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="min-w-0 rounded-xl border border-gray-200 bg-white px-2.5 py-3 sm:rounded-2xl sm:px-4 sm:py-4"
            >
              <div className="flex items-center justify-between gap-1.5">
                <p className="truncate whitespace-nowrap text-[8px] font-bold uppercase tracking-normal text-gray-500 sm:text-[10px] sm:tracking-wide">
                  {stat.label}
                </p>

                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 sm:rounded-xl ${stat.iconBg}`}
                >
                  <Icon
                    size={14}
                    className={stat.iconColor}
                  />
                </div>
              </div>

              <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-gray-900 sm:text-[30px]">
                {loading ? '—' : stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-3 sm:px-5 sm:py-4">
          <div className="relative min-w-0 max-w-md flex-1">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-xs outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyActive((value) => !value)}
            aria-pressed={onlyActive}
            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
              onlyActive
                ? 'border-[#2d4a7a] bg-[#edf2f9] text-[#2d4a7a]'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={12} />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[820px] table-fixed">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="w-[22%] px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-3">
                  Customer
                </th>

                <th className="w-[24%] px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-3">
                  Contact
                </th>

                <th className="w-[15%] px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-3">
                  Company
                </th>

                <th className="w-[11%] px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-3">
                  Type
                </th>

                <th className="w-[11%] px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-3">
                  Status
                </th>

                <th className="w-[10%] px-2.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:px-3">
                  Added
                </th>

                <th className="w-[7%] px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2d4a7a] border-t-transparent" />
                      <p className="text-xs text-gray-400">
                        Loading customers...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
                        <Users size={20} className="text-gray-400" />
                      </div>

                      <p className="text-sm font-medium text-gray-700">
                        {search ? 'No customers found' : 'No customers yet'}
                      </p>

                      <p className="text-xs text-gray-400">
                        {search
                          ? 'Try a different search term'
                          : 'Add your first customer to get started'}
                      </p>

                      {!search && (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="mt-1 flex items-center gap-1 rounded-lg bg-[#2d4a7a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3a5a8f]"
                        >
                          <Plus size={12} />
                          Add Customer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((customer, index) => {
                  const initials = `${customer.firstName?.[0] || ''}${
                    customer.lastName?.[0] || ''
                  }`;

                  return (
                    <tr
                      key={customer.id}
                      className="transition hover:bg-gray-50/70"
                    >
                      <td className="px-2.5 py-2.5 sm:px-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
                              avatarColors[index % avatarColors.length]
                            } text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-xs`}
                          >
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-gray-900 sm:text-sm">
                              {customer.firstName} {customer.lastName}
                            </p>

                            {customer.externalReference && (
                              <p className="truncate text-[10px] text-gray-400">
                                #{customer.externalReference}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-2.5 py-2.5 sm:px-3">
                        <div className="min-w-0 space-y-0.5">
                          {customer.email && (
                            <div className="flex min-w-0 items-center gap-1 text-[10px] text-gray-500 sm:text-xs">
                              <Mail
                                size={10}
                                className="shrink-0 text-gray-400"
                              />
                              <span className="truncate">
                                {customer.email}
                              </span>
                            </div>
                          )}

                          {customer.phone && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 sm:text-xs">
                              <Phone
                                size={10}
                                className="shrink-0 text-gray-400"
                              />
                              {customer.phone}
                            </div>
                          )}

                          {!customer.email && !customer.phone && (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      <td className="px-2.5 py-2.5 sm:px-3">
                        {customer.companyName ? (
                          <div className="flex min-w-0 items-center gap-1 text-[10px] text-gray-600 sm:text-xs">
                            <Building2
                              size={11}
                              className="shrink-0 text-gray-400"
                            />
                            <span className="truncate">
                              {customer.companyName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2.5 sm:px-3">
                        <span
                          className={`inline-flex max-w-full truncate rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${
                            typeColors[customer.customerType] ||
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {customer.customerType?.replace('_', ' ') || '—'}
                        </span>
                      </td>

                      <td className="px-2.5 py-2.5 sm:px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                            customer.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              customer.status === 'active'
                                ? 'bg-green-500'
                                : 'bg-gray-400'
                            }`}
                          />

                          {customer.status}
                        </span>
                      </td>

                      <td className="px-2.5 py-2.5 text-[10px] text-gray-400 sm:px-3 sm:text-xs">
                        {new Date(customer.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </td>

                      <td className="px-1.5 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => edit(customer)}
                            aria-label="Edit customer"
                            title="Edit customer"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil size={12} />
                          </button>

                          <Link
                            href={`/requests?customerId=${customer.id}`}
                            aria-label="View customer documents"
                            title="View documents"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-[#2d4a7a] transition hover:border-blue-200 hover:bg-blue-50"
                          >
                            <FileText size={12} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => archive(customer.id)}
                            aria-label="Archive customer"
                            title="Archive customer"
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-red-100 text-red-500 transition hover:border-red-200 hover:bg-red-50"
                          >
                            <Archive size={12} />
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
          <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
            <p className="text-[11px] text-gray-400">
              Showing{' '}
              <span className="font-medium text-gray-600">
                {visible.length}
              </span>{' '}
              of{' '}
              <span className="font-medium text-gray-600">
                {customers.length}
              </span>{' '}
              customers
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-modal-title"
          onMouseDown={closeModal}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-slate-100 bg-[#f4f7fb] px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2d4a7a] text-white shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
                <Users size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  id="customer-modal-title"
                  className="text-base font-bold text-slate-900 sm:text-lg"
                >
                  {editing ? 'Edit customer' : 'Add customer'}
                </h3>

                <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs">
                  {editing
                    ? 'Update borrower or client details.'
                    : 'Add a new borrower or client to your workspace.'}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close customer form"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[65vh] space-y-4 overflow-y-auto [scrollbar-width:none] px-4 py-4 [&::-webkit-scrollbar]:hidden sm:space-y-5 sm:px-6 sm:py-5">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      First name <span className="text-red-500">*</span>
                    </span>

                    <input
                      required
                      value={form.firstName}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          firstName: event.target.value,
                        })
                      }
                      placeholder="John"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      Last name <span className="text-red-500">*</span>
                    </span>

                    <input
                      required
                      value={form.lastName}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          lastName: event.target.value,
                        })
                      }
                      placeholder="Smith"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      Email
                    </span>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          email: event.target.value,
                        })
                      }
                      placeholder="john@example.com"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">
                      Phone
                    </span>

                    <input
                      value={form.phone}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          phone: event.target.value,
                        })
                      }
                      placeholder="+1 (555) 000-0000"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    Company name
                  </span>

                  <input
                    value={form.companyName}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        companyName: event.target.value,
                      })
                    }
                    placeholder="Acme Corporation"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">
                    Customer type
                  </span>

                  <select
                    value={form.customerType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        customerType: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-[#52709f] focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                    <option value="joint">Joint</option>
                    <option value="guarantor">Guarantor</option>
                    <option value="co_borrower">Co-Borrower</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3a5a8f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : editing
                      ? 'Save changes'
                      : 'Add customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}