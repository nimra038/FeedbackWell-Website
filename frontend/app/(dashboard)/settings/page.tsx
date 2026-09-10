'use client';
import { useState } from 'react';
import api from '@/lib/api';
import TeamSettings from '@/components/team-settings';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/lib/types';
import { Building2, Check, Globe2, Palette, Save, ShieldCheck } from 'lucide-react';

function SettingsForm({ organization }: { organization: Organization }) {
  const { user, init }=useAuthStore();const canEdit=['owner','admin'].includes(user?.role||'');
  const [form,setForm]=useState({name:organization.name,brand_color:organization.brand_color||'#2d4a7a',timezone:organization.timezone,country:organization.country});const [notice,setNotice]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await api.patch(`/v1/organizations/${organization.id}`,form);await init();setNotice('Organization settings saved.');}catch(e){setError(errorMessage(e));}finally{setBusy(false);}};
  const fields = [
    { key: 'name' as const, label: 'Organization name', icon: Building2, type: 'text' },
    { key: 'timezone' as const, label: 'Timezone', icon: Globe2, type: 'text' },
    { key: 'country' as const, label: 'Country / region', icon: Globe2, type: 'text' },
  ];
  return <form onSubmit={save} className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(30,41,59,0.06)]">
    <div className="border-b border-slate-100 bg-gradient-to-br from-[#f4f7fb] to-white p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2d4a7a] text-white"><Building2 size={19} /></span><div><h2 className="font-semibold text-slate-900">Organization details</h2><p className="mt-1 text-xs leading-5 text-slate-500">Control the workspace name and the branding borrowers see.</p></div></div></div>
    <div className="space-y-4 p-5 sm:p-6">{error&&<p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><Check size={16} />{notice}</p>}
      {fields.map(({ key, label, icon: Icon, type })=><label key={key} className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600"><Icon size={14} className="text-[#52709f]" />{label}</span><input disabled={!canEdit} required type={type} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#52709f] focus:ring-4 focus:ring-[#2d4a7a]/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" /></label>)}
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"><div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-1.5 text-xs font-medium text-slate-700"><Palette size={14} className="text-[#52709f]" />Brand colour</p><p className="mt-1 text-[11px] text-slate-500">Used in your borrower-facing experience.</p></div><input aria-label="Brand colour" disabled={!canEdit} required type="color" value={form.brand_color} onChange={e=>setForm({...form,brand_color:e.target.value})} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 disabled:cursor-not-allowed" /></div></div>
      {canEdit ? <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d4a7a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#213a64] disabled:opacity-50"><Save size={16} />{busy ? 'Saving…' : 'Save changes'}</button> : <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><ShieldCheck size={15} />Only owners and admins can edit organization details.</p>}</div>
  </form>;
}
export default function SettingsPage(){const {organization,user}=useAuthStore();const canManageTeam=['owner','admin'].includes(user?.role||'');return <div className="mx-auto max-w-7xl p-4 sm:p-7"><header className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6"><p className="text-[11px] font-semibold tracking-[0.16em] text-[#52709f]">WORKSPACE SETTINGS</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Organization settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage your workspace identity, borrower-facing branding, and team access from one place.</p></header><div className={`grid items-start gap-6 ${canManageTeam ? 'xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.35fr)]' : 'max-w-xl'}`}>{organization&&<SettingsForm key={organization.id} organization={organization}/>} {canManageTeam&&<TeamSettings/>}</div></div>;}
