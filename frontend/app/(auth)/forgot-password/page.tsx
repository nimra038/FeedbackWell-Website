'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data } = await api.post<{ message: string }>('/v1/auth/forgot-password', {
        email: email.trim(),
      });
      setMessage(data.message);
    } catch (err) {
      setError(errorMessage(err, 'Unable to send password reset link'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-7 py-8 shadow-sm sm:px-9">
        <div className="text-center">
          <Link href="/" className="inline-block text-3xl font-bold tracking-tight text-[#1a2744]">
            Feedback<span className="text-[#2d4a7a]">Well</span>
          </Link>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Forgot your password?
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Enter your email and we’ll send you a secure password reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2d4a7a] focus:ring-4 focus:ring-[#2d4a7a]/10"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1a2744] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d4a7a] focus:outline-none focus:ring-4 focus:ring-[#2d4a7a]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-semibold text-[#2d4a7a] hover:text-[#1a2744]">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
