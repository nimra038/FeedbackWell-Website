'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { errorMessage } from '@/lib/errors';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);

  const [orgName, setOrgName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

    if (!passwordValid) {
      setError('Please meet all password requirements.');
      return;
    }

    setLoading(true);

    try {
      await register({
        orgName: orgName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });

      router.push('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Unable to create account'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-300 py-2.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2d4a7a] focus:ring-4 focus:ring-[#2d4a7a]/10';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-4 sm:py-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm sm:px-8 sm:py-6">
        <div className="text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-bold tracking-tight text-[#1a2744]"
          >
            Feedback<span className="text-[#2d4a7a]">Well</span>
          </Link>

          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            Create your account
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Get started with FeedbackWell.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="orgName"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Organization name
            </label>

            <div className="relative">
              <Building2
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="orgName"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Your organization"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                First name
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="firstName"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Last name
              </label>

              <div className="relative">
                <User
                  size={18}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="lastName"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Work email
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
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
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

            {password && (
              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs sm:grid-cols-2">
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
            className="w-full rounded-xl bg-[#1a2744] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d4a7a] focus:outline-none focus:ring-4 focus:ring-[#2d4a7a]/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 border-t border-slate-200 pt-3 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-[#2d4a7a] hover:text-[#1a2744]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
