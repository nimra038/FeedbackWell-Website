'use client';
import { useState } from 'react';
import api from '@/lib/api';
import TeamSettings from '@/components/team-settings';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/lib/types';
function SettingsForm({ organization }: { organization: Organization }) {
  const { user, init }=useAuthStore();const canEdit=['owner','admin'].includes(user?.role||'');
  const [form,setForm]=useState({name:organization.name,brand_color:organization.brand_color||'#2d4a7a',timezone:organization.timezone,country:organization.country});const [notice,setNotice]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await api.patch(`/v1/organizations/${organization.id}`,form);await init();setNotice('Organization settings saved.');}catch(e){setError(errorMessage(e));}finally{setBusy(false);}};
  return <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}{(['name','brand_color','timezone','country'] as const).map(key=><label key={key} className="block text-sm text-slate-600 capitalize">{key.replaceAll('_',' ')}<input disabled={!canEdit} required type={key==='brand_color'?'color':'text'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className={`block mt-2 border border-slate-200 rounded-lg p-3 ${key==='brand_color'?'w-24 h-12':'w-full'} disabled:bg-slate-50`} /></label>)}{canEdit&&<button disabled={busy} className="bg-[#2d4a7a] text-white px-5 py-3 text-sm rounded-xl font-semibold disabled:opacity-50">Save settings</button>}</form>;
}
export default function SettingsPage(){const {organization,user}=useAuthStore();return <div className="p-4 sm:p-7 max-w-3xl mx-auto space-y-6"><header><h1 className="text-2xl font-bold text-slate-900">Organization settings</h1><p className="text-sm text-slate-500 mt-2">Manage the name and branding your borrowers see.</p></header>{organization&&<SettingsForm key={organization.id} organization={organization}/>} {['owner','admin'].includes(user?.role||'')&&<TeamSettings/>}</div>;}
