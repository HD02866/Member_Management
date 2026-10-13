'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please provide your email address or phone number');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    try {
      setIsLoading(true);
      await login(identifier, password);
      // Route seamlessly to 4Baye dashboard (Owner/Admin or Member mode)
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please verify your email/phone and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-lg border-surface-200 dark:border-surface-800">
          <CardHeader className="text-center space-y-2 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-700 to-brand-500 text-white mx-auto flex items-center justify-center font-extrabold text-xl shadow-md">
              4B
            </div>
            <CardTitle className="text-2xl">{t('auth.loginTitle')}</CardTitle>
            <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
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
                autoComplete="current-password"
              />

              <div className="cta-glow-wrapper w-full mt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('auth.submitLogin')}
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-surface-100 dark:border-surface-800 text-center text-xs text-surface-500">
              <span>{t('auth.noAccountPrompt')} </span>
              <Link href="/register" className="font-semibold text-brand-600 dark:text-amber-400 hover:underline">
                {t('auth.registerLink')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
