'use client';

import React from 'react';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { LanguageToggle } from '../../../components/ui/LanguageToggle';
import { ShieldCheck, User } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-950 dark:text-white">
          {t('nav.settings')}
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Manage your official 4Baye account settings and preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Language Preference */}
        <Card>
          <CardHeader>
            <CardTitle>Language & Localization</CardTitle>
            <CardDescription>
              Select your preferred language interface. 4Baye natively supports English, Afaan Oromoo, and Amharic.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-surface-700 dark:text-surface-300 font-medium">
              Current Language
            </span>
            <LanguageToggle />
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card>
          <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>
              Your credentials are encrypted using Argon2id with database-backed session revocation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm py-2 border-b border-surface-100 dark:border-surface-800">
              <span className="text-surface-500">Global Account ID:</span>
              <span className="font-mono text-xs text-surface-700 dark:text-surface-300">
                {user?.id}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-b border-surface-100 dark:border-surface-800">
              <span className="text-surface-500">Authentication Method:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                Argon2id Hash + JWT Sessions
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
