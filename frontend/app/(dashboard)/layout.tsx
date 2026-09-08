'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, FileText, Users, FolderOpen, Settings, Shield, LogOut, Menu, X, LayoutTemplate, History } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/requests', label: 'Document requests', icon: FileText },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/applications', label: 'Applications', icon: FolderOpen },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
];
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const { user, organization, initialized, init, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  useEffect(() => { void init(); const expired = () => logout(); window.addEventListener('auth:expired', expired); return () => window.removeEventListener('auth:expired', expired); }, [init, logout]);
  useEffect(() => { if (initialized && !user) router.replace('/login'); }, [initialized, user, router]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  if (!initialized || !user) return <div className="min-h-svh flex items-center justify-center text-sm text-slate-500">Opening your workspace?</div>;
  const canAudit = ['owner', 'admin', 'manager'].includes(user.role);
  return <div className="flex h-svh w-full overflow-hidden bg-[#f5f5f5]">
    {open && <button aria-label="Close navigation" className="fixed inset-0 bg-slate-950/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}
    <aside id="workspace-navigation" className={`fixed inset-y-0 left-0 z-40 w-[230px] bg-[#1a2744] flex flex-col transition-transform lg:static lg:translate-x-0 lg:shrink-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="px-5 py-6 flex items-center gap-3 border-b border-white/5"><span className="bg-white/10 p-2 rounded-xl text-white"><Shield size={21} /></span><div><p className="font-bold text-white text-lg">FeedbackWell</p><p className="text-[10px] text-white/40">Secure document collection</p></div><button aria-label="Close menu" onClick={() => setOpen(false)} className="text-white/60 lg:hidden ml-auto"><X size={18} /></button></div>
      <div className="m-4 p-3 rounded-xl bg-white/5 border border-white/[0.06]"><p className="text-sm text-white font-medium truncate">{organization?.name || 'FeedbackWell'}</p><p className="text-[10px] text-white/40 mt-1">Organization workspace</p></div>
      <nav aria-label="Workspace" className="px-3 flex-1 overflow-y-auto"><p className="text-[10px] text-white/35 font-semibold tracking-widest px-3 mb-3">WORKSPACE</p>{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href || pathname.startsWith(href + '/') ? 'page' : undefined} className={`flex gap-3 items-center px-3 py-3 rounded-xl text-xs font-medium mb-1 ${pathname === href || pathname.startsWith(href + '/') ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon size={17} />{label}</Link>)}{canAudit && <Link href="/audit" onClick={() => setOpen(false)} className="flex gap-3 items-center px-3 py-3 rounded-xl text-xs text-white/55 hover:bg-white/5"><History size={17} />Audit history</Link>}</nav>
      <div className="p-4 border-t border-white/5">
        <div className="rounded-xl bg-white/5 border border-white/[0.06] overflow-hidden">
          <Link href="/settings" onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-3 text-xs transition ${pathname.startsWith('/settings') ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/[0.07] hover:text-white'}`}><span className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center"><Settings size={16} /></span><span><span className="block font-medium">Settings</span><span className="block text-[9px] text-white/35 mt-0.5">Workspace & team</span></span></Link>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-3 text-xs text-white/65 hover:bg-red-500/10 hover:text-red-300 w-full border-t border-white/[0.06] transition"><span className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center"><LogOut size={16} /></span><span className="font-medium">Sign out</span></button>
        </div>
      </div>
    </aside>
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden"><header className="h-16 bg-white border-b border-slate-100 px-4 sm:px-6 flex gap-3 items-center shrink-0"><button aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={open} onClick={() => setOpen(true)} className="lg:hidden text-slate-600 p-2"><Menu size={21} /></button><p className="text-xs text-slate-500 hidden sm:block">{organization?.name || 'FeedbackWell'}</p><div className="ml-auto flex items-center gap-3"><div className="text-right"><p className="text-xs font-semibold text-slate-800">{user.firstName} {user.lastName}</p><p className="text-[10px] text-slate-400 capitalize mt-0.5">{user.role.replaceAll('_', ' ')}</p></div><span className="w-9 h-9 rounded-full bg-[#2d4a7a] flex items-center justify-center text-white text-xs font-semibold">{user.firstName[0]}{user.lastName[0]}</span></div></header><main className="flex-1 overflow-y-auto min-w-0">{children}</main></div>
  </div>;
}
