'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { CardSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
} from 'lucide-react';

interface MemberProfileData {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  nationalIdNumber?: string;
  address?: string;
  city?: string;
  status: string;
  joinedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function MemberProfilePage() {
  const { activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (activeOrg) {
      setIsLoading(true);
      ApiClient.get<MemberProfileData>('/members/me', { tenantId: activeOrg.id })
        .then((data) => {
          setProfile(data);
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setEmail(data.email || '');
          setPhoneNumber(data.phoneNumber || '');
          setAddress(data.address || '');
          setCity(data.city || '');
          setNationalIdNumber(data.nationalIdNumber || '');
          setGender(data.gender || '');
          setDateOfBirth(data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '');
        })
        .catch(() => setProfile(null))
        .finally(() => setIsLoading(false));
    } else {
      setProfile(null);
      setIsLoading(false);
    }
  }, [activeOrg, isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const updated = await ApiClient.patch<MemberProfileData>(
        '/members/me',
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          nationalIdNumber: nationalIdNumber.trim() || undefined,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
        },
        { tenantId: activeOrg.id },
      );

      setProfile(updated);
      setSuccessMsg(t('profile.saveSuccess'));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <CardSkeleton />
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No Organization Selected"
          description="Please select or join an organization to manage your member profile."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-950 dark:text-white">
          {t('profile.title')}
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          {t('profile.subtitle')} in <strong>{activeOrg.name}</strong>
        </p>
      </div>

      {successMsg && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Server Controlled Readonly Badge Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-surface-100/70 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 space-y-1">
          <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {t('membership.memberNumber')}
          </span>
          <div className="text-base font-bold font-mono text-surface-900 dark:text-surface-100">
            {profile?.memberNumber || 'Pending'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-100/70 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 space-y-1">
          <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {t('membership.membershipStatus')}
          </span>
          <div className="pt-0.5">
            <Badge status={profile?.status || 'PENDING_APPROVAL'} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface-100/70 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700 space-y-1">
          <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Joined Organization
          </span>
          <div className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            {profile?.joinedAt ? new Date(profile.joinedAt).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Editable Information Form */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>
            Update your verifiable information for records and communications.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('profile.firstName')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                label={t('profile.lastName')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('profile.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label={t('profile.phone')}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label={t('profile.address')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                label={t('profile.city')}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                label={t('profile.nationalId')}
                value={nationalIdNumber}
                onChange={(e) => setNationalIdNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                  {t('profile.gender')}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="block w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <Input
                label={t('profile.dateOfBirth')}
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800 text-[11px] text-surface-500 border border-surface-200 dark:border-surface-700 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <span>{t('profile.protectedFieldsNotice')}</span>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" isLoading={isSaving}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
