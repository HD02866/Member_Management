'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { User, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

function RegisterForm() {
  const { register } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError('Please provide your first name');
      return;
    }
    if (!lastName.trim()) {
      setError('Please provide your last name');
      return;
    }
    if (!identifier.trim()) {
      setError('Please provide an email address or valid phone number');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      // Automatically register user into 4Baye Association as a regular member
      await register(firstName, lastName, identifier, password, '4b');
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your information and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-surface-200 dark:border-surface-800">
      <CardHeader className="text-center space-y-2 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 text-white mx-auto flex items-center justify-center font-extrabold text-xl shadow-md">
          4B
        </div>
        <CardTitle className="text-2xl">{t('auth.registerTitle')}</CardTitle>
        <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('auth.firstNameLabel', 'First Name')}
              placeholder={t('auth.firstNamePlaceholder', 'Selam')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
              autoComplete="given-name"
            />

            <Input
              label={t('auth.lastNameLabel', 'Last Name')}
              placeholder={t('auth.lastNamePlaceholder', 'Bekele')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
              autoComplete="family-name"
            />
          </div>

          <Input
            label={t('auth.identifierLabel')}
            placeholder={t('auth.identifierPlaceholder')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="username"
          />

          <Input
            label={t('auth.passwordLabel')}
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          <Input
            label={t('auth.confirmPasswordLabel')}
            type="password"
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="new-password"
          />

          <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 text-xs text-surface-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Signing up grants official member standing in 4Baye Association.</span>
          </div>

          <div className="cta-glow-wrapper w-full mt-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {t('auth.submitRegister')}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-surface-100 dark:border-surface-800 text-center text-xs text-surface-500">
          <span>{t('auth.haveAccountPrompt')} </span>
          <Link href="/login" className="font-semibold text-brand-600 dark:text-amber-400 hover:underline">
            {t('auth.loginLink')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-md space-y-6">
        <Suspense fallback={<div className="text-center py-12 text-surface-400">Loading...</div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
