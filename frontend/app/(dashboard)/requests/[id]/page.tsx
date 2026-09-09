'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Send, Plus, CheckCircle, FileText, MessageSquare,
  Eye, Download, X, Clock, Pencil, Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth.store';
import type {
  DocumentRequest,
  Requirement,
  RequestMessage,
  UploadedDocument,
} from '@/lib/types';

type Details = {
  request: DocumentRequest;
  requirements: Requirement[];
  messages: RequestMessage[];
};

async function fetchDetails(id: string): Promise<Details> {
  const [request, requirements, messages] = await Promise.all([
    api.get<DocumentRequest>(`/v1/requests/${id}`),
    api.get<Requirement[]>(`/v1/requests/${id}/requirements`),
    api.get<RequestMessage[]>(`/v1/messages/request/${id}`),
  ]);

  return {
    request: request.data,
    requirements: requirements.data,
    messages: messages.data,
  };
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);

  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [required, setRequired] = useState(true);
  const [minimum, setMinimum] = useState(1);

  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [review, setReview] = useState<{ id: string; status: string } | null>(null);
  const [reason, setReason] = useState('');

  const [preview, setPreview] = useState<{
    url: string;
    file: UploadedDocument;
  } | null>(null);

  const [reload, setReload] = useState(0);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [templateId, setTemplateId] = useState('');

  const [editRequest, setEditRequest] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editRequirement, setEditRequirement] = useState<Requirement | null>(null);

  const canEdit = ['owner', 'admin', 'manager', 'loan_officer'].includes(
    user?.role || '',
  );
  const canReview = Boolean(user && user.role !== 'read_only');

  useEffect(() => {
    api
      .get('/v1/templates')
      .then((response) => setTemplates(response.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    let active = true;

    fetchDetails(id)
      .then((result) => {
        if (active) {
          setData(result);
          setError('');
        }
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
  }, [id, reload]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const perform = async (
    action: () => Promise<unknown>,
    success: string,
  ) => {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await action();
      setData(await fetchDetails(id));
      setNotice(success);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEditRequest = () => {
    if (!data) return;

    setEditTitle(data.request.title);
    setEditDescription(data.request.description || '');
    setEditDueDate(data.request.dueDate?.slice(0, 10) || '');
    setEditRequest(true);
  };

  const saveRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    const saved = await perform(
      () =>
        api.patch(`/v1/requests/${id}`, {
          title: editTitle,
          description: editDescription,
          dueDate: editDueDate || null,
        }),
      'Request details updated.',
    );

    if (saved) setEditRequest(false);
  };

  const saveRequirement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editRequirement) return;

    const saved = await perform(
      () =>
        api.patch(`/v1/requests/requirements/${editRequirement.id}`, {
          name: editRequirement.name,
          instructions: editRequirement.instructions || '',
          required: editRequirement.required,
          minFiles: editRequirement.minFiles,
        }),
      'Requirement updated.',
    );

    if (saved) setEditRequirement(null);
  };

  const deleteRequirement = async (requirementId: string) => {
    if (!window.confirm('Delete this requirement?')) return;

    await perform(
      () => api.delete(`/v1/requests/requirements/${requirementId}`),
      'Requirement deleted.',
    );
  };

  const addRequirement = async (event: React.FormEvent) => {
    event.preventDefault();

    const saved = await perform(
      () =>
        api.post(`/v1/requests/${id}/requirements`, {
          name,
          instructions,
          required,
          minFiles: minimum,
          maxFiles: Math.max(minimum, 10),
        }),
      'Requirement added.',
    );

    if (saved) {
      setName('');
      setInstructions('');
      setMinimum(1);
    }
  };

  const updateStatus = (
    requirementId: string,
    status: string,
    explanation?: string,
  ) =>
    perform(
      () =>
        api.patch(`/v1/requests/requirements/${requirementId}/status`, {
          status,
          reason: explanation,
        }),
      'Review saved.',
    );

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (
      await perform(
        () =>
          api.post(`/v1/messages/request/${id}`, {
            message,
            isInternal: internal,
          }),
        internal ? 'Internal note saved.' : 'Message sent.',
      )
    ) {
      setMessage('');
    }
  };

  const openDocument = async (
    file: UploadedDocument,
    download = false,
  ) => {
    setError('');

    try {
      const response = await api.get(`/v1/documents/${file.id}/content`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data);

      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.originalName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setPreview({ url, file });
      }
    } catch (err) {
      setError(
        errorMessage(
          err,
          'Unable to open this document. It may not have passed scanning.',
        ),
      );
    }
  };

  const copy = async () => {
    if (!data) return;

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/portal/${data.request.portalToken}`,
      );
      setNotice('Portal link copied.');
    } catch {
      setError('Unable to copy the portal link.');
    }
  };

  const done =
    data?.requirements.filter((item) =>
      ['accepted', 'not_applicable'].includes(item.status),
    ).length || 0;

  const total = data?.requirements.length || 0;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/requests"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Back to requests
      </Link>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
          <button
            onClick={() => setReload((value) => value + 1)}
            className="ml-3 underline"
          >
            Reload
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {loading && (
        <p className="py-12 text-center text-sm text-slate-500">
          Loading request...
        </p>
      )}

      {data && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Document request
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                {data.request.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {data.request.customer?.firstName}{' '}
                {data.request.customer?.lastName} ·{' '}
                {data.request.customer?.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={startEditRequest}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold"
                >
                  <Pencil size={15} />
                  Edit details
                </button>
              )}

              {data.request.status === 'draft' && canEdit ? (
                <button
                  disabled={busy || !total}
                  onClick={() =>
                    perform(
                      () => api.patch(`/v1/requests/${id}/send`),
                      'Request queued for email delivery.',
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2d4a7a] px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <Send size={15} />
                  Send to customer
                </button>
              ) : (
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold"
                >
                  <Copy size={15} />
                  Copy portal link
                </button>
              )}

              <span className="rounded-xl bg-blue-50 px-4 py-3 text-xs capitalize text-blue-800">
                {data.request.status.replaceAll('_', ' ')}
              </span>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Document progress</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {done} of {total} requirements complete
                </p>
              </div>
              <p className="text-2xl font-bold text-[#2d4a7a]">
                {total ? Math.round((done / total) * 100) : 0}%
              </p>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{
                  width: `${total ? (done / total) * 100 : 0}%`,
                }}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white xl:col-span-2">
              <h2 className="flex items-center gap-2 border-b border-slate-100 p-5 font-semibold">
                <FileText size={18} />
                Requirements
              </h2>

              {!total && (
                <div className="space-y-3 p-5 text-sm text-slate-500">
                  <p>Add a checklist before sending the request.</p>

                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={templateId}
                        onChange={(event) => setTemplateId(event.target.value)}
                        className="max-w-full rounded-lg border border-slate-200 p-2"
                      >
                        <option value="">Choose a template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>

                      <button
                        disabled={!templateId || busy}
                        onClick={() =>
                          perform(
                            () =>
                              api.post(
                                `/v1/templates/${templateId}/apply/${id}`,
                              ),
                            'Template applied.',
                          )
                        }
                        className="rounded-lg bg-[#2d4a7a] px-3 py-2 text-xs text-white disabled:opacity-40"
                      >
                        Apply checklist
                      </button>
                    </div>
                  )}
                </div>
              )}

              {data.requirements.map((item) => (
                <article
                  key={item.id}
                  className="border-b border-slate-100 p-5 last:border-0"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        {item.name}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          {item.required ? 'Required' : 'Optional'} ·{' '}
                          {item.minFiles} file(s) minimum
                        </span>
                      </h3>

                      <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
                        {item.instructions || item.description}
                      </p>
                    </div>

                    <span className="h-fit rounded-full bg-blue-50 px-2.5 py-1.5 text-[10px] capitalize text-blue-700">
                      {item.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {item.documents?.map((file) => (
                      <div
                        key={file.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="break-all text-xs text-slate-700">
                            {file.originalName}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {(file.fileSize / 1024).toFixed(0)} KB ·{' '}
                            {file.malwareScanPassed
                              ? 'Scan passed'
                              : 'Awaiting scan'}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openDocument(file)}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
                            aria-label={`Preview ${file.originalName}`}
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            onClick={() => openDocument(file, true)}
                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
                            aria-label={`Download ${file.originalName}`}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canEdit && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => setEditRequirement({ ...item })}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>

                      <button
                        onClick={() => deleteRequirement(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  )}

                  {canReview &&
                    !['draft', 'cancelled', 'expired'].includes(
                      data.request.status,
                    ) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['uploaded', 'under_review'].includes(item.status) && (
                          <button
                            disabled={busy}
                            onClick={() => updateStatus(item.id, 'accepted')}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                          >
                            <CheckCircle size={13} />
                            Accept
                          </button>
                        )}

                        {(item.documents?.length || 0) > 0 && (
                          <button
                            disabled={busy}
                            onClick={() => {
                              setReview({
                                id: item.id,
                                status: 'needs_replacement',
                              });
                              setReason('');
                            }}
                            className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700"
                          >
                            Request replacement
                          </button>
                        )}

                        {item.status !== 'not_applicable' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              updateStatus(item.id, 'not_applicable')
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500"
                          >
                            Not applicable
                          </button>
                        )}
                      </div>
                    )}
                </article>
              ))}

              {canEdit &&
                !['completed', 'cancelled', 'expired'].includes(
                  data.request.status,
                ) && (
                  <form
                    onSubmit={addRequirement}
                    className="space-y-3 bg-slate-50 p-5"
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      Add a requirement
                    </p>

                    <input
                      required
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Last two months of bank statements"
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    />

                    <textarea
                      value={instructions}
                      onChange={(event) =>
                        setInstructions(event.target.value)
                      }
                      placeholder="Instructions for the borrower"
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                    />

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={required}
                          onChange={(event) =>
                            setRequired(event.target.checked)
                          }
                        />
                        Required
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        Minimum files
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={minimum}
                          onChange={(event) =>
                            setMinimum(Number(event.target.value))
                          }
                          className="w-16 rounded-lg border border-slate-200 p-2"
                        />
                      </label>

                      <button
                        disabled={busy}
                        className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#2d4a7a] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <Plus size={14} />
                        Add requirement
                      </button>
                    </div>
                  </form>
                )}
            </section>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-sm font-semibold">Request details</h2>

                <p className="text-[10px] uppercase text-slate-400">Due date</p>
                <p className="mt-1 text-sm text-slate-700">
                  {data.request.dueDate
                    ? new Date(data.request.dueDate).toLocaleDateString()
                    : 'No due date'}
                </p>

                <p className="mt-4 text-[10px] uppercase text-slate-400">
                  Created by
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {data.request.creator?.firstName}{' '}
                  {data.request.creator?.lastName}
                </p>

                {data.request.description && (
                  <p className="mt-4 whitespace-pre-wrap text-sm text-slate-500">
                    {data.request.description}
                  </p>
                )}

                <p className="mt-5 flex items-start gap-2 text-xs text-slate-400">
                  <Clock size={15} className="shrink-0" />
                  The request completes when all required documents are accepted
                  or marked not applicable.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare size={17} />
                  Messages & notes
                </h2>

                <div className="my-4 max-h-80 space-y-3 overflow-y-auto">
                  {!data.messages.length && (
                    <p className="py-5 text-xs text-slate-400">
                      No messages yet.
                    </p>
                  )}

                  {data.messages.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl p-3 text-xs whitespace-pre-wrap ${
                        item.isInternal
                          ? 'bg-amber-50 text-amber-900'
                          : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      <p className="mb-1 text-[10px] text-slate-400">
                        {item.isInternal
                          ? 'Internal note'
                          : item.senderType === 'customer'
                            ? 'Borrower'
                            : 'Staff'}{' '}
                        · {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {item.body}
                    </div>
                  ))}
                </div>

                {canReview && (
                  <form onSubmit={sendMessage} className="space-y-3">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(event) =>
                          setInternal(event.target.checked)
                        }
                      />
                      Internal note · staff only
                    </label>

                    <textarea
                      required
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={
                        internal
                          ? 'Write an internal note...'
                          : 'Write to your customer...'
                      }
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs"
                    />

                    <button
                      disabled={busy || !message.trim()}
                      className="rounded-lg bg-[#2d4a7a] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {internal ? 'Save note' : 'Send message'}
                    </button>
                  </form>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await updateStatus(review.id, review.status, reason)) {
                setReview(null);
              }
            }}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"
          >
            <h2 className="text-lg font-semibold">Request a replacement</h2>
            <p className="text-sm text-slate-500">
              This message will be visible to the borrower.
            </p>

            <textarea
              required
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReview(null)}
                className="text-sm text-slate-500"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-lg bg-[#2d4a7a] px-4 py-2.5 text-sm text-white"
              >
                Save review
              </button>
            </div>
          </form>
        </div>
      )}

      {editRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={saveRequest}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit request details</h2>
              <button
                type="button"
                onClick={() => setEditRequest(false)}
              >
                <X size={20} />
              </button>
            </div>

            <input
              required
              maxLength={500}
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="Request title"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Instructions for the customer"
              className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <label className="block text-sm text-slate-600">
              Due date
              <input
                type="date"
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRequest(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {busy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editRequirement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={saveRequirement}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit requirement</h2>
              <button
                type="button"
                onClick={() => setEditRequirement(null)}
              >
                <X size={20} />
              </button>
            </div>

            <input
              required
              value={editRequirement.name}
              onChange={(event) =>
                setEditRequirement({
                  ...editRequirement,
                  name: event.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <textarea
              value={editRequirement.instructions || ''}
              onChange={(event) =>
                setEditRequirement({
                  ...editRequirement,
                  instructions: event.target.value,
                })
              }
              placeholder="Instructions for borrower"
              className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm"
            />

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={editRequirement.required}
                onChange={(event) =>
                  setEditRequirement({
                    ...editRequirement,
                    required: event.target.checked,
                  })
                }
              />
              Required document
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRequirement(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-xl bg-[#2d4a7a] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {busy ? 'Saving...' : 'Save requirement'}
              </button>
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6">
          <div className="flex h-[85svh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center gap-4 border-b border-slate-200 p-4">
              <p className="flex-1 truncate text-sm font-medium">
                {preview.file.originalName}
              </p>

              <a
                href={preview.url}
                download={preview.file.originalName}
                className="text-xs text-blue-700"
              >
                Download
              </a>

              <button onClick={() => setPreview(null)}>
                <X size={20} />
              </button>
            </div>

            {['application/pdf', 'image/jpeg', 'image/png'].includes(
              preview.file.mimeType,
            ) ? (
              <iframe
                title={preview.file.originalName}
                src={preview.url}
                className="w-full flex-1 border-0"
              />
            ) : (
              <div className="p-12 text-center text-sm text-slate-500">
                Preview is not available for this format.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}