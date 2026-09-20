'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';
import api from '@/lib/api';
import { errorMessage } from '@/lib/errors';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rules = useMemo(
    () => [
      { label: 'At least 12 characters', valid: password.length >= 12 },
      { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
      { label: 'One lowercase letter', valid: /[a-z]/.test(password) },
      { label: 'One number', valid: /[0-9]/.test(password) },
      { label: 'One special character', valid: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );

  const passwordValid = rules.every((rule) => rule.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('This password reset link is invalid.');
      return;
    }

    if (!passwordValid) {
      setError('Please meet all password requirements.');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post<{ message: string }>('/v1/auth/reset-password', {
        token,
        password,
      });
      setMessage(data.message);
      setPassword('');
    } catch (err) {
      setError(errorMessage(err, 'Unable to reset password'));
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
            Create a new password
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose a strong password for your account.
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

          {!message && (
            <>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  New password
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
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2d4a7a] focus:ring-4 focus:ring-[#2d4a7a]/10"
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

                {password && (
                  <div className="mt-3 grid grid-cols-1 gap-1.5 rounded-xl bg-slate-50 px-4 py-3 text-xs sm:grid-cols-2">
                    {rules.map((rule) => (
                      <div
                        key={rule.label}
                        className={rule.valid ? 'text-emerald-600' : 'text-slate-500'}
                      >
                        {rule.valid ? '✓' : '○'} {rule.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#1a2744] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d4a7a] focus:outline-none focus:ring-4 focus:ring-[#2d4a7a]/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Resetting password...' : 'Reset Password'}
              </button>
            </>
          )}
        </form>

        {message && (
          <Link
            href="/login"
            className="mt-5 block w-full rounded-xl bg-[#1a2744] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2d4a7a]"
          >
            Sign in
          </Link>
        )}

        {!message && (
          <p className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-[#2d4a7a] hover:text-[#1a2744]">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
          <p className="text-sm text-slate-500">Loading...</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
