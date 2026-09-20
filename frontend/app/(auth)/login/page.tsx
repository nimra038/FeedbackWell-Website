'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { errorMessage } from '@/lib/errors';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password, remember);
      router.push('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-5 sm:py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8 sm:py-7">
        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-[#1a2744]"
          >
            Feedback<span className="text-[#2d4a7a]">Well</span>
          </Link>

          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Sign in to continue to your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Email
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2d4a7a] focus:ring-4 focus:ring-[#2d4a7a]/10"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2d4a7a] focus:ring-4 focus:ring-[#2d4a7a]/10"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#1a2744]"
              />
              Keep me logged in
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d4a7a] focus:outline-none focus:ring-4 focus:ring-[#2d4a7a]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4 text-center text-sm text-slate-500">
          New to FeedbackWell?{' '}
          <Link
            href="/register"
            className="font-semibold text-[#2d4a7a] hover:text-[#1a2744]"
          >
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}

