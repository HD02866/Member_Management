'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import {
  Shield,
  Settings,
  Save,
  CheckCircle,
  AlertCircle,
  Lock,
  Globe,
  Sliders,
} from 'lucide-react';

export default function PlatformSettingsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // General Settings
  const [platformName, setPlatformName] = useState('WaanOfii Platform');
  const [supportEmail, setSupportEmail] = useState('support@waanofii.com');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Security Settings
  const [sessionExpiryMinutes, setSessionExpiryMinutes] = useState(1440);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await ApiClient.get('/platform/settings');
      if (data) {
        if (data.general) {
          setPlatformName(data.general.platformName || 'WaanOfii Platform');
          setSupportEmail(data.general.supportEmail || 'support@waanofii.com');
          setDefaultCurrency(data.general.defaultCurrency || 'USD');
          setMaintenanceMode(data.general.maintenanceMode === true);
        }
        if (data.security) {
          setSessionExpiryMinutes(data.security.sessionExpiryMinutes ?? 1440);
          setMaxLoginAttempts(data.security.maxLoginAttempts ?? 5);
          setAllowPublicRegistration(data.security.allowPublicRegistration !== false);
          setRequireEmailVerification(data.security.requireEmailVerification === true);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch('/platform/settings', {
        general: {
          platformName: platformName.trim(),
          supportEmail: supportEmail.trim(),
          defaultCurrency: defaultCurrency.trim().toUpperCase(),
          maintenanceMode,
        },
        security: {
          sessionExpiryMinutes: Number(sessionExpiryMinutes),
          maxLoginAttempts: Number(maxLoginAttempts),
          allowPublicRegistration,
          requireEmailVerification,
        },
      });

      setSuccessMsg('Platform settings successfully updated');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update platform settings');
    } finally {
      setSaving(false);
    }
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Platform administrator privileges required to configure system settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <LoadingSkeleton variant="title" />
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            System Configuration
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
          Platform Global Settings
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Global policies, operational parameters, session lifetimes, and security thresholds across the WaanOfii SaaS environment.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-2 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* General Parameters */}
        <Card className="p-6 space-y-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-500" />
            General Platform Settings
          </CardTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Platform Name"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              required
            />
            <Input
              label="Support Email"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              required
            />
            <Input
              label="Default Base Currency"
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              required
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-sm">
                <span className="font-semibold text-surface-900 dark:text-white">
                  Enable Maintenance Mode
                </span>
                <p className="text-xs text-surface-500">
                  Temporarily restricts access to non-platform administrators.
                </p>
              </div>
            </label>
          </div>
        </Card>

        {/* Security & Access Thresholds */}
        <Card className="p-6 space-y-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-500" />
            Security & Authentication Policies
          </CardTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="JWT Session Expiry (Minutes)"
              type="number"
              value={sessionExpiryMinutes}
              onChange={(e) => setSessionExpiryMinutes(Number(e.target.value))}
              required
            />
            <Input
              label="Max Consecutive Failed Logins"
              type="number"
              value={maxLoginAttempts}
              onChange={(e) => setMaxLoginAttempts(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-3 pt-2 text-sm">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowPublicRegistration}
                onChange={(e) => setAllowPublicRegistration(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-semibold text-surface-900 dark:text-white">
                  Allow Public User Self-Registration
                </span>
                <p className="text-xs text-surface-500">
                  Enables users to sign up via public registration pages.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requireEmailVerification}
                onChange={(e) => setRequireEmailVerification(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-semibold text-surface-900 dark:text-white">
                  Enforce Mandatory Email Verification
                </span>
                <p className="text-xs text-surface-500">
                  Requires new accounts to verify email before completing onboarding.
                </p>
              </div>
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saving} leftIcon={<Save className="w-4 h-4" />}>
            {saving ? 'Saving Settings...' : 'Save Platform Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
