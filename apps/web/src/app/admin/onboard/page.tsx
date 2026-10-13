'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Shield, CheckCircle2, AlertCircle, Building2, ArrowRight } from 'lucide-react';

const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'app',
  'login',
  'register',
  'pricing',
  'features',
  'about',
  'settings',
  'support',
  'docs',
  'www',
  'health',
  'auth',
  'me',
  'members',
  'organizations',
  'memberships',
  'org',
  'dashboard',
  'profile',
  'portal',
]);

export default function AdminOnboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  // Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [purpose, setPurpose] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrg, setCreatedOrg] = useState<any | null>(null);

  if (authLoading) {
    return <div className="p-12 text-center text-surface-400">Loading auth...</div>;
  }

  if (!isAuthenticated || !user?.isPlatformAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          Platform Admin Privileges Required
        </h2>
        <p className="text-sm text-surface-500">
          Only authorized SaaS platform administrators have permission to onboard new organizations.
        </p>
        <Link href="/app/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const handleSlugChange = (val: string) => {
    const formatted = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    setSlug(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.has(cleanSlug)) {
      setError(`Slug '${cleanSlug}' is reserved for platform routes. Please choose another.`);
      return;
    }

    try {
      setIsLoading(true);
      const res = await ApiClient.post('/organizations', {
        name: name.trim(),
        slug: cleanSlug,
        contactEmail: contactEmail.toLowerCase().trim(),
        contactPhone: contactPhone.trim() || undefined,
        address: address.trim() || undefined,
        currency,
        defaultLanguage,
        profile: {
          mission: mission.trim() || undefined,
          vision: vision.trim() || undefined,
          purpose: purpose.trim() || undefined,
        },
      });

      setCreatedOrg(res);
      await refreshUser();
    } catch (err: any) {
      setError(err?.message || 'Failed to onboard organization.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 mb-3 border border-indigo-200 dark:border-indigo-800">
          <Shield className="w-3.5 h-3.5" />
          <span>Platform Administrator Workflow</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-950 dark:text-white">
          Onboard New Organization
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Create a new tenant organization on the WaanOfii SaaS platform with full RLS partition
          and profile defaults.
        </p>
      </div>

      {createdOrg ? (
        <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="space-y-6 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-surface-900 dark:text-surface-100">
                Organization Onboarded Successfully!
              </h3>
              <p className="text-sm text-surface-500">
                Tenant <strong>{createdOrg.name}</strong> (@{createdOrg.slug}) is now active with
                PostgreSQL RLS security.
              </p>
            </div>

            <div className="flex justify-center gap-4 pt-2">
              <Link href={`/org/${createdOrg.slug}`}>
                <Button variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  View Public Page
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setCreatedOrg(null);
                  setName('');
                  setSlug('');
                  setContactEmail('');
                  setContactPhone('');
                  setAddress('');
                  setMission('');
                  setVision('');
                  setPurpose('');
                }}
              >
                Onboard Another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Organization Registration Details</CardTitle>
            <CardDescription>
              Organization slug will form the public portal path /org/[slug] and platform subdomain.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Organization Name"
                  placeholder="e.g. Ethiopian Horticultural Association"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      handleSlugChange(e.target.value);
                    }
                  }}
                  required
                />

                <Input
                  label="Organization Slug"
                  placeholder="e.g. ethio-hort"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  hint="Lowercase alphanumeric with hyphens. Must not collide with reserved platform routes."
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Email"
                  type="email"
                  placeholder="info@org.example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />

                <Input
                  label="Contact Phone"
                  placeholder="+251 91 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Headquarters Address"
                  placeholder="Bole, Addis Ababa"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Default Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="block w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm"
                  >
                    <option value="ETB">ETB (Ethiopian Birr)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Default Language
                  </label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="block w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm"
                  >
                    <option value="en">English</option>
                    <option value="am">Amharic (አማርኛ)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-surface-100 dark:border-surface-800">
                <h4 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                  Initial Profile & Governance
                </h4>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Mission Statement
                  </label>
                  <textarea
                    rows={2}
                    value={mission}
                    onChange={(e) => setMission(e.target.value)}
                    placeholder="Describe the organization's overarching mission..."
                    className="block w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Vision Statement
                  </label>
                  <textarea
                    rows={2}
                    value={vision}
                    onChange={(e) => setVision(e.target.value)}
                    placeholder="Describe the organization's long-term vision..."
                    className="block w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" variant="primary" isLoading={isLoading}>
                  Create Organization
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
