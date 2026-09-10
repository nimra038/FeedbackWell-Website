'use client';

import { useEffect, useState } from 'react';
import { Building2, Check, Copy, FileCheck2, Files, Landmark, LoaderCircle, Plus, Save, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth.store';

type TemplateRequirement = { name: string };
type Template = { id: string; name: string; builtIn?: boolean; requirements: TemplateRequirement[] };

const categoryStyle = [
  { icon: Landmark, iconClass: 'bg-blue-50 text-blue-700', accent: 'bg-blue-600' },
  { icon: Building2, iconClass: 'bg-violet-50 text-violet-700', accent: 'bg-violet-600' },
  { icon: FileCheck2, iconClass: 'bg-emerald-50 text-emerald-700', accent: 'bg-emerald-600' },
];

export default function TemplatesPage() {
  const user = useAuthStore((state) => state.user);
  const canEdit = ['owner', 'admin', 'manager', 'loan_officer'].includes(user?.role || '');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState('');
  const [lines, setLines] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.get<Template[]>('/v1/templates')
      .then((response) => { setTemplates(response.data); setError(''); })
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [reload]);

  const requirementNames = lines.split('\n').map((line) => line.trim()).filter(Boolean);

  const customize = (template: Template) => {
    setName(`${template.name.replaceAll('?', '-')} - custom`);
    setLines(template.requirements.map((requirement) => requirement.name).join('\n'));
    requestAnimationFrame(() => document.getElementById('template-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/v1/templates', {
        name,
        requirements: requirementNames.map((requirementName) => ({ name: requirementName, required: true, minFiles: 1, maxFiles: 10 })),
      });
      setName('');
      setLines('');
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-7 max-w-7xl mx-auto space-y-7">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2d4a7a]">Checklist library</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 mt-2">Document templates</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">Build consistent requests faster with ready-made lending checklists or your organization&apos;s own document sets.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
          <Files size={16} className="text-[#2d4a7a]" /><strong className="text-slate-800">{templates.length}</strong> templates available
        </div>
      </header>

      {error && <p role="alert" className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{error}</p>}

      {loading ? (
        <div className="min-h-56 flex items-center justify-center text-sm text-slate-500"><LoaderCircle size={20} className="animate-spin mr-2" />Loading templates...</div>
      ) : (
        <section aria-label="Available templates" className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((template, index) => {
            const style = categoryStyle[index % categoryStyle.length];
            const Icon = template.builtIn ? style.icon : Sparkles;
            return (
              <article key={template.id} className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 transition duration-200 flex flex-col min-h-[390px]">
                <div className={`h-1 ${template.builtIn ? style.accent : 'bg-amber-500'}`} />
                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${template.builtIn ? style.iconClass : 'bg-amber-50 text-amber-700'}`}><Icon size={21} /></span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${template.builtIn ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{template.builtIn ? 'FeedbackWell starter' : 'Your organization'}</span>
                  </div>
                  <h2 className="font-bold text-lg text-slate-900 mt-5 leading-snug">{template.name.replaceAll('?', '-')}</h2>
                  <p className="text-xs text-slate-500 mt-2">{template.requirements.length} required document{template.requirements.length === 1 ? '' : 's'}</p>
                  <ul className="space-y-2.5 mt-5 flex-1" aria-label={`${template.name} documents`}>
                    {template.requirements.slice(0, 5).map((requirement, requirementIndex) => (
                      <li key={`${requirement.name}-${requirementIndex}`} className="flex gap-2.5 text-sm text-slate-600">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-px"><Check size={12} strokeWidth={3} /></span>
                        <span className="leading-5">{requirement.name}</span>
                      </li>
                    ))}
                    {template.requirements.length > 5 && <li className="text-xs font-medium text-slate-400 pl-7">+ {template.requirements.length - 5} more documents</li>}
                  </ul>
                  {canEdit && <button onClick={() => customize(template)} className="mt-6 w-full flex items-center justify-center gap-2 border border-slate-200 bg-slate-50 hover:bg-[#2d4a7a] hover:border-[#2d4a7a] hover:text-white text-slate-700 rounded-xl px-4 py-3 text-sm font-semibold transition"><Copy size={15} />Customize a copy</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {canEdit && (
        <section id="template-editor" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#edf3fc] text-[#2d4a7a] flex items-center justify-center shrink-0"><Plus size={19} /></span>
            <div><h2 className="font-bold text-slate-900">Create organization template</h2><p className="text-sm text-slate-500 mt-1">Add one document per line. You can apply this checklist while creating a document request.</p></div>
          </div>
          <form onSubmit={save} className="p-5 sm:p-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] gap-6">
            <div className="space-y-5">
              <label className="block text-sm font-semibold text-slate-700">Template name
                <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Self-employed borrower" className="block w-full border border-slate-200 rounded-xl px-4 py-3 mt-2 font-normal focus:outline-none focus:ring-2 focus:ring-[#2d4a7a]/20 focus:border-[#2d4a7a]" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Required documents
                <textarea required value={lines} onChange={(event) => setLines(event.target.value)} placeholder={'Government-issued ID\nLast 3 months bank statements\nProof of address'} className="block w-full border border-slate-200 rounded-xl px-4 py-3 mt-2 min-h-52 font-normal leading-7 resize-y focus:outline-none focus:ring-2 focus:ring-[#2d4a7a]/20 focus:border-[#2d4a7a]" />
              </label>
            </div>
            <aside className="bg-slate-50 border border-slate-200 rounded-xl p-5 self-start">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live summary</p>
              <p className="font-semibold text-slate-800 mt-3 break-words">{name.trim() || 'Untitled template'}</p>
              <p className="text-sm text-slate-500 mt-1">{requirementNames.length} document{requirementNames.length === 1 ? '' : 's'} in checklist</p>
              <button disabled={busy || !name.trim() || requirementNames.length === 0} className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#2d4a7a] hover:bg-[#243e69] text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"><Save size={15} />{busy ? 'Saving...' : 'Save template'}</button>
            </aside>
          </form>
        </section>
      )}
    </div>
  );
}
