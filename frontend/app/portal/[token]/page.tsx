'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { ShieldCheck, FileText, Upload, CheckCircle, Camera, MessageSquare, ArrowRight, LockKeyhole, FolderOpen } from 'lucide-react';
import { errorMessage } from '@/lib/errors';
import type { Requirement, RequestMessage } from '@/lib/types';

type PortalRequirement = Requirement & { documents: { id: string; originalName: string; fileSize: number }[] };
type Info = { title: string; dueDate: string | null; organization: { name: string; brandColor?: string }; emailHint: string };
type Checklist = { total: number; completed: number; requirements: PortalRequirement[]; customer: { firstName: string }; description?: string; status: string };
const statusText: Record<string, string> = { missing: 'Needed', uploaded: 'Uploaded ? awaiting review', under_review: 'Under review', accepted: 'Accepted', rejected: 'Please upload a replacement', needs_replacement: 'Please upload a replacement', not_applicable: 'Not required' };

export default function BorrowerPortal() {
  const { token } = useParams<{ token: string }>();
  const client = useMemo(() => axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' }), []);
  const [info, setInfo] = useState<Info | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [accessToken, setAccessToken] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    client.get<Info>(`/v1/portal/${token}`, { signal: controller.signal }).then(r => { setInfo(r.data); setError(''); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [client, token, reload]);
  const headers = (jwt = accessToken) => ({ Authorization: `Bearer ${jwt}` });
  const refresh = async (jwt = accessToken) => {
    const [requirements, conversation] = await Promise.all([
      client.get<Checklist>(`/v1/portal/${token}/requirements`, { headers: headers(jwt) }),
      client.get<RequestMessage[]>(`/v1/portal/${token}/messages`, { headers: headers(jwt) }),
    ]);
    setChecklist(requirements.data); setMessages(conversation.data);
  };
  const sendCode = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await client.post(`/v1/portal/${token}/otp/send`); setSent(true); setNotice('Check your email for a six-digit code. It is valid for 10 minutes.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const r = await client.post<{ accessToken: string }>(`/v1/portal/${token}/otp/verify`, { code });
      setAccessToken(r.data.accessToken); await refresh(r.data.accessToken); setNotice('Your email is verified. You can upload your documents below.');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const upload = async (files: FileList | File[] | null, requirementId: string, documentId?: string) => {
    if (!files?.length || !requirementId) return;
    setBusy(true); setError(''); setNotice(''); setProgress(0);
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append('file', file); form.append('requirementId', requirementId);
        if (documentId) form.append('documentId', documentId);
        await client.post(`/v1/portal/${token}/upload`, form, { headers: headers(), onUploadProgress: e => setProgress(Math.round((uploaded + (e.total ? e.loaded / e.total : 0)) / files.length * 100)) });
        uploaded++;
      }
      await refresh(); setNotice(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded and checked. Your lender can now review ${uploaded === 1 ? 'it' : 'them'}.`);
    } catch (e) { setError(`${uploaded ? `${uploaded} file(s) uploaded. ` : ''}${errorMessage(e)}`); await refresh().catch(() => undefined); }
    finally { setBusy(false); setProgress(null); }
  };
  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault(); if (!message.trim()) return; setBusy(true); setError('');
    try { await client.post(`/v1/portal/${token}/messages`, { message }, { headers: headers() }); setMessage(''); await refresh(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const color = /^#[a-f0-9]{6}$/i.test(info?.organization.brandColor || '') ? info!.organization.brandColor : '#2d4a7a';
  const done = checklist?.status === 'completed';
  return <main className="min-h-svh bg-[#f4f6fa] px-4 py-8 sm:py-12 text-slate-900">
    <div className="max-w-3xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-4 mb-8"><div className="flex items-center gap-3"><span className="text-white p-3 rounded-xl" style={{ backgroundColor: color }}><ShieldCheck size={23} /></span><div><p className="font-bold text-lg">{info?.organization.name || 'Document portal'}</p><p className="text-xs text-slate-500">Secure document collection</p></div></div><span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500"><LockKeyhole size={14} />Private portal</span></header>
      {error && <div role="alert" className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-800">{error}{!info && <button className="block underline mt-2" onClick={() => setReload(n => n + 1)}>Try again</button>}</div>}
      {notice && <div role="status" className="border border-blue-100 bg-blue-50 rounded-xl p-4 text-sm text-blue-900">{notice}</div>}
      {!info && !error && <p className="text-center py-16 text-slate-500">Opening your request?</p>}
      {info && !checklist && <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-9 shadow-sm"><div className="p-3 rounded-xl bg-blue-50 text-blue-700 w-fit mb-5"><LockKeyhole size={25} /></div><h1 className="text-2xl font-bold tracking-tight">Let?s verify your email</h1><p className="mt-3 text-sm text-slate-500 leading-6">{info.organization.name} has requested documents. We?ll send a verification code to <strong className="text-slate-700">{info.emailHint || 'your registered email'}</strong> to protect your information.</p>
        {sent ? <form onSubmit={verify} className="mt-6 space-y-4"><label className="block text-sm font-medium" htmlFor="verification-code">Verification code</label><input id="verification-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" className="w-full border border-slate-300 rounded-xl p-4 text-2xl tracking-[.4em] outline-none focus:ring-2 focus:ring-blue-200" /><button disabled={busy || code.length !== 6} className="w-full text-white rounded-xl py-3.5 font-semibold disabled:opacity-50" style={{ backgroundColor: color }}>{busy ? 'Verifying?' : 'Verify and continue'}</button><button type="button" onClick={sendCode} disabled={busy} className="text-sm text-slate-600 underline disabled:opacity-50">Send another code</button></form> : <button onClick={sendCode} disabled={busy} className="mt-6 w-full flex items-center justify-center gap-2 text-white rounded-xl py-3.5 font-semibold disabled:opacity-50" style={{ backgroundColor: color }}>{busy ? 'Sending?' : 'Send verification code'}<ArrowRight size={17} /></button>}
      </section>}
      {info && checklist && <>
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{done ? 'Request complete' : 'Your document checklist'}</p><h1 className="text-2xl sm:text-3xl font-bold mt-3">{done ? 'You?re all set.' : `Hello, ${checklist.customer.firstName}`}</h1><p className="text-sm text-slate-600 mt-3">{info.title}</p>{checklist.description && <p className="text-sm text-slate-500 mt-2 whitespace-pre-wrap">{checklist.description}</p>}<div className="flex justify-between text-xs text-slate-500 mt-6 mb-2"><span>{checklist.completed} of {checklist.total} complete</span>{info.dueDate && <span>Due {new Date(info.dueDate).toLocaleDateString()}</span>}</div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ backgroundColor: color, width: `${checklist.total ? checklist.completed / checklist.total * 100 : 0}%` }} /></div><button disabled={busy} onClick={() => { setError(''); void refresh().catch(e => setError(errorMessage(e))); }} className="text-xs underline text-slate-500 mt-3">Refresh review status</button></section>
        {progress !== null && <div role="status" className="bg-blue-50 rounded-xl p-4 text-sm text-blue-900">{progress === 100 ? 'Checking your file for safety?' : `Uploading? ${progress}%`}<progress className="w-full mt-2" value={progress} max={100} /></div>}
        <section aria-label="Requested documents" className="space-y-3">{checklist.requirements.map(r => {
          const accepted = ['accepted', 'not_applicable'].includes(r.status);
          return <article key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && !done && !accepted) void upload(e.dataTransfer.files, r.id); }}><div className="flex items-start gap-3"><span className={`p-2.5 rounded-xl ${accepted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{accepted ? <CheckCircle size={20} /> : <FileText size={20} />}</span><div className="flex-1 min-w-0"><h2 className="font-semibold">{r.name}<span className="ml-2 text-[10px] font-normal text-slate-400">{r.required ? 'Required' : 'Optional'}</span></h2><p className={`text-xs mt-1 ${['rejected', 'needs_replacement'].includes(r.status) ? 'text-orange-700' : accepted ? 'text-emerald-700' : 'text-slate-500'}`}>{statusText[r.status] || r.status}</p>{(r.instructions || r.description) && <p className="text-sm text-slate-500 mt-3 whitespace-pre-wrap">{r.instructions || r.description}</p>}</div></div>
            {r.documents.map(doc => <div key={doc.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3 mt-3 text-xs"><span className="truncate text-slate-600">{doc.originalName} ? {(doc.fileSize / 1024).toFixed(0)} KB</span>{!done && !accepted && <label className="text-blue-700 cursor-pointer shrink-0">Replace<input aria-label={`Replace ${doc.originalName}`} type="file" className="sr-only" disabled={busy} onChange={e => { void upload(e.target.files, r.id, doc.id); e.target.value = ''; }} /></label>}</div>)}
            {!done && !accepted && <div className="flex flex-wrap items-center gap-3 mt-5"><label className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white cursor-pointer ${busy ? 'opacity-50' : ''}`} style={{ backgroundColor: color }}><Upload size={15} />Choose files<input aria-label={`Upload files for ${r.name}`} type="file" multiple disabled={busy} className="sr-only" onChange={e => { void upload(e.target.files, r.id); e.target.value = ''; }} /></label><label className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold border border-slate-200 text-slate-600 cursor-pointer"><Camera size={15} />Take photo<input aria-label={`Take a photo for ${r.name}`} type="file" accept="image/jpeg,image/png,image/heic" capture="environment" disabled={busy} className="sr-only" onChange={e => { void upload(e.target.files, r.id); e.target.value = ''; }} /></label><span className="text-[11px] text-slate-400">or drop files here ? Up to {r.maxFileSizeMb || 50} MB each</span></div>}
          </article>;
        })}</section>
        {!done && <section className="rounded-xl border border-dashed border-slate-300 p-4 flex flex-wrap gap-3 items-center"><FolderOpen size={18} className="text-slate-500" /><label className="text-xs text-slate-600" htmlFor="folder-requirement">Upload a folder to</label><select id="folder-requirement" value={selected} onChange={e => setSelected(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-xs max-w-full"><option value="">Choose requirement</option>{checklist.requirements.filter(r => !['accepted', 'not_applicable'].includes(r.status)).map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select><input aria-label="Choose folder to upload" type="file" multiple {...{ webkitdirectory: '' }} disabled={!selected || busy} onChange={e => { void upload(e.target.files, selected); e.target.value = ''; }} className="text-xs max-w-full" /></section>}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6"><h2 className="font-semibold flex items-center gap-2"><MessageSquare size={18} />Questions? Message your lender</h2><div className="space-y-3 my-5 max-h-72 overflow-y-auto">{!messages.length && <p className="text-sm text-slate-500">Need help with a document? Send a message below.</p>}{messages.map(m => <div key={m.id} className={`rounded-xl p-3 text-sm whitespace-pre-wrap ${m.senderType === 'customer' ? 'bg-blue-50 ml-5' : 'bg-slate-50 mr-5'}`}><p className="text-[10px] text-slate-500 mb-1">{m.senderType === 'customer' ? 'You' : info.organization.name} ? {new Date(m.createdAt).toLocaleString()}</p>{m.body}</div>)}</div><form onSubmit={sendMessage} className="flex gap-2"><input aria-label="Message your lender" value={message} onChange={e => setMessage(e.target.value)} maxLength={10000} required placeholder="Write a message?" className="flex-1 min-w-0 border border-slate-200 rounded-xl p-3 text-sm" /><button disabled={busy || !message.trim()} className="text-white px-4 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: color }}>Send</button></form></section>
      </>}
      <footer className="text-center text-[11px] text-slate-400 pt-4">Powered by FeedbackWell ? Share documents only through this portal.</footer>
    </div>
  </main>;
}
