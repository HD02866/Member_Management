'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { CardSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AnimatedCounter } from '../../../components/ui/AnimatedCounter';
import {
  Building2,
  User,
  ShieldCheck,
  CreditCard,
  QrCode,
  ArrowRight,
  Clock,
  Layers,
  Users,
  FileText,
  Megaphone,
  CheckCircle2,
  DollarSign,
  Settings,
  Sparkles,
  Eye,
  Award,
} from 'lucide-react';

interface MemberProfileData {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  status: string;
  joinedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    currency: string;
  };
  memberships?: {
    id: string;
    status: string;
    membershipPlan: {
      id: string;
      name: string;
      code: string;
      price: string | number;
      currency: string;
      billingInterval: string;
    };
  }[];
}

interface OrgAdminStats {
  memberCount: number;
  announcementCount: number;
  plansCount: number;
}

export default function DashboardPage() {
  const { user, activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, localize } = useI18n();
  const router = useRouter();

  const [profile, setProfile] = useState<MemberProfileData | null>(null);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [memberAnnouncements, setMemberAnnouncements] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<OrgAdminStats>({
    memberCount: 0,
    announcementCount: 0,
    plansCount: 0,
  });
  const [viewMode, setViewMode] = useState<'admin' | 'member'>('admin');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (activeOrg) {
      setIsLoading(true);
      loadDashboardData();
    } else {
      setProfile(null);
      setOrgDetails(null);
      setMemberAnnouncements([]);
      setIsLoading(false);
    }
  }, [activeOrg, isAuthenticated, authLoading]);

  const loadDashboardData = async () => {
    if (!activeOrg) return;
    setIsLoading(true);
    try {
      // 1. Fetch organization public profile & CMS
      const orgData = await ApiClient.get<any>(`/organizations/${activeOrg.slug || activeOrg.id}`).catch(() => null);
      setOrgDetails(orgData);

      // 2. Fetch member profile for active tenant
      const myProfile = await ApiClient.get<MemberProfileData>('/members/me', { tenantId: activeOrg.id }).catch(() => null);
      setProfile(myProfile);

      // 3. Fetch announcements intended for members
      const memberAnns = await ApiClient.get<any[]>('/members/announcements', { tenantId: activeOrg.id }).catch(() => null);
      if (Array.isArray(memberAnns)) {
        setMemberAnnouncements(memberAnns);
      } else if (orgData?.announcements) {
        setMemberAnnouncements(orgData.announcements);
      }

      // 4. If staff, fetch admin stats
      if (activeOrg.isStaff) {
        const [membersRes, annRes, plansRes] = await Promise.all([
          ApiClient.request<any[]>(`/organizations/${activeOrg.slug || activeOrg.id}/members`, { tenantId: activeOrg.id }).catch(() => ({ data: [] })),
          ApiClient.request<any[]>('/cms/announcements', { tenantId: activeOrg.id }).catch(() => ({ data: [] })),
          ApiClient.request<any[]>('/memberships/plans', { tenantId: activeOrg.id }).catch(() => ({ data: [] })),
        ]);
        const membersList = (membersRes as any).data || membersRes || [];
        const annList = (annRes as any).data || annRes || [];
        const plansList = (plansRes as any).data || plansRes || [];
        setAdminStats({
          memberCount: Array.isArray(membersList) ? membersList.length : 0,
          announcementCount: Array.isArray(annList) ? annList.length : 0,
          plansCount: Array.isArray(plansList) ? plansList.length : 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="h-10 w-48 bg-surface-200 dark:bg-surface-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon={<ShieldCheck className="w-12 h-12 text-brand-600" />}
          title="Connecting to 4Baye Association..."
          description="Connecting to your official 4Baye member account."
          action={
            <Button variant="primary" onClick={() => loadDashboardData()}>
              Refresh
            </Button>
          }
        />
      </div>
    );
  }

  const isStaff = activeOrg.isStaff;
  const isViewingAdmin = isStaff && viewMode === 'admin';
  const latestMembership = profile?.memberships?.[0];
  const announcements = memberAnnouncements.length > 0 ? memberAnnouncements : (orgDetails?.announcements || []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {activeOrg.name}
            </span>
            <Badge variant={isStaff ? 'info' : 'success'}>
              {isStaff ? `${activeOrg.staffRole || 'Staff'}` : 'Verified Member'}
            </Badge>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white">
            {isViewingAdmin
              ? t('orgAdmin.title')
              : `${t('memberHome.welcome')} ${activeOrg.name}`}
          </h1>
          <p className="text-sm text-surface-500">
            {isViewingAdmin ? (
              <span>
                {t('orgAdmin.managingOrg')}{' '}
                <strong className="text-surface-900 dark:text-surface-100">{activeOrg.name}</strong>.
              </span>
            ) : (
              <span>{t('memberHome.digitalHome')}</span>
            )}
          </p>
        </div>

        {/* View Mode Toggle for Staff Members */}
        {isStaff && (
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === 'admin'
                  ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-surface-600 dark:text-surface-300 hover:text-surface-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('nav.viewAsAdmin')}</span>
            </button>
            <button
              onClick={() => setViewMode('member')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                viewMode === 'member'
                  ? 'bg-white dark:bg-surface-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-surface-600 dark:text-surface-300 hover:text-surface-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t('nav.viewAsMember')}</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EXPERIENCE A: ORGANIZATION ADMIN / STAFF DASHBOARD                        */}
      {/* ========================================================================= */}
      {isViewingAdmin ? (
        <div className="space-y-8">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  {t('orgAdmin.totalMembers')}
                </span>
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
                  <AnimatedCounter value={adminStats.memberCount} />
                </div>
                <p className="text-xs text-surface-500 mt-1">Active verified roster</p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  {t('orgAdmin.activePlans')}
                </span>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
                  <AnimatedCounter value={adminStats.plansCount} />
                </div>
                <p className="text-xs text-surface-500 mt-1">Configured membership tiers</p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  {t('orgAdmin.announcements')}
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
                  <Megaphone className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
                  <AnimatedCounter value={adminStats.announcementCount} />
                </div>
                <p className="text-xs text-surface-500 mt-1">Published community updates</p>
              </div>
            </Card>
          </div>

          {/* Organization Admin Management Action Cards */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">
              {t('orgAdmin.managingOrg')} {activeOrg.name} — Administrative Areas
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Member Management */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t('orgAdmin.manageMembers')}</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    View active members, search by ID, filter by approval status, and inspect verified profiles.
                  </p>
                </div>
                <Link href="/app/members">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Open Member Directory
                  </Button>
                </Link>
              </Card>

              {/* Staff & Roles */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">Staff & Roles</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Assign organization administrators, finance officers, verifiers, and manage staff privileges.
                  </p>
                </div>
                <Link href="/app/staff">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Manage Staff
                  </Button>
                </Link>
              </Card>

              {/* Identity & CMS */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t('orgAdmin.manageContent')}</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Update organization mission, vision, leadership boards, programs, member benefits, and bylaws.
                  </p>
                </div>
                <Link href="/app/organization">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Edit CMS & Identity
                  </Button>
                </Link>
              </Card>

              {/* Finance & Payments */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t('orgAdmin.manageFinance')}</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Review pending offline bank slips, reconcile member fee payments, and issue digital cards.
                  </p>
                </div>
                <Link href="/app/finance/reviews">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Review Payments
                  </Button>
                </Link>
              </Card>

              {/* Organization Settings */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 flex items-center justify-center">
                    <Settings className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t('orgAdmin.manageSettings')}</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Configure contact emails, physical address, currency, timezone, and communication preferences.
                  </p>
                </div>
                <Link href="/app/settings">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Settings
                  </Button>
                </Link>
              </Card>

              {/* Digital ID Cards */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t('cards.title')}</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Configure card branding, card templates, QR placement, and review active member ID credentials.
                  </p>
                </div>
                <Link href="/app/card">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Manage Digital ID
                  </Button>
                </Link>
              </Card>

              {/* Public Portal */}
              <Card className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{t('nav.organizationPage')}</CardTitle>
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Preview the live official website for 4Baye Association as seen by prospective members and visitors.
                  </p>
                </div>
                <Link href="/">
                  <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Open Public Portal
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* EXPERIENCE B: ORGANIZATION MEMBER DIGITAL HOME                            */
        /* ========================================================================= */
        <div className="space-y-8">
          {/* Organization Mission & Identity Banner */}
          <div className="p-6 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 flex items-center justify-center font-bold text-lg">
                {activeOrg.name[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-surface-950 dark:text-white">
                  {activeOrg.name}
                </h2>
                <p className="text-xs text-surface-400">@{activeOrg.slug}</p>
              </div>
            </div>

            {/* Mission & Vision */}
            {(orgDetails?.profile?.mission || orgDetails?.profile?.vision) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-surface-100 dark:border-surface-800">
                {orgDetails.profile?.mission && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                      {t('memberHome.missionTitle')}
                    </span>
                    <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                      {localize(orgDetails.profile.mission)}
                    </p>
                  </div>
                )}
                {orgDetails.profile?.vision && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                      {t('memberHome.visionTitle')}
                    </span>
                    <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                      {localize(orgDetails.profile.vision)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Membership Status & Direct Action */}
          {latestMembership && (
            <div className="p-5 rounded-2xl border border-brand-200 dark:border-brand-900/60 bg-brand-50/70 dark:bg-brand-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand-800 dark:text-brand-300 uppercase tracking-wide">
                    Membership Status:
                  </span>
                  <Badge status={latestMembership.status} />
                </div>
                <p className="text-sm text-surface-700 dark:text-surface-300">
                  {latestMembership.status === 'REGISTERED' || latestMembership.status === 'PAYMENT_PENDING'
                    ? t('membership.completePaymentNotice')
                    : latestMembership.status === 'ACTIVE'
                    ? 'Your membership is active and verified in this organization.'
                    : 'Your membership is currently under review by organization administrators.'}
                </p>
              </div>

              <Link href="/app/membership">
                <Button size="sm" variant="secondary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Manage Membership
                </Button>
              </Link>
            </div>
          )}

          {/* Member Information & Quick Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Member Identity Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-surface-500">
                  {t('membership.memberNumber')}
                </CardTitle>
                <User className="w-4 h-4 text-surface-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono text-surface-950 dark:text-white">
                  {profile?.memberNumber || 'Pending'}
                </div>
                <p className="text-xs text-surface-400">
                  Joined: {profile ? new Date(profile.joinedAt).toLocaleDateString() : 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Current Plan Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-surface-500">
                  {t('membership.membershipPlan')}
                </CardTitle>
                <CreditCard className="w-4 h-4 text-surface-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold text-surface-950 dark:text-white">
                  {latestMembership?.membershipPlan?.name || 'No Plan Selected'}
                </div>
                {latestMembership && (
                  <p className="text-xs text-surface-400">
                    {Number(latestMembership.membershipPlan.price).toLocaleString()}{' '}
                    {latestMembership.membershipPlan.currency} /{' '}
                    {latestMembership.membershipPlan.billingInterval}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Digital Card Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-surface-500">
                  {t('membership.digitalCardTitle')}
                </CardTitle>
                <QrCode className="w-4 h-4 text-surface-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/app/card">
                  <Button size="sm" variant="outline" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                    Open Digital ID
                  </Button>
                </Link>
                <p className="text-xs text-surface-400 mt-1">{t('membership.digitalCardNotice')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Latest Announcements Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-600" />
                {t('memberHome.announcementsTitle')}
              </h2>
            </div>

            {announcements.length === 0 ? (
              <Card className="p-6 text-center text-xs text-surface-400">
                {t('memberHome.noAnnouncements')}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {announcements.slice(0, 3).map((ann: any) => (
                  <Card key={ann.id} className="overflow-hidden flex flex-col justify-between">
                    <div>
                      {ann.coverImageUrl && (
                        <div className="w-full h-36 bg-surface-100 dark:bg-surface-800 overflow-hidden">
                          <img
                            src={ann.coverImageUrl}
                            alt={typeof ann.title === 'string' ? ann.title : 'Announcement'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-surface-400">
                          <span>{new Date(ann.publishedAt || ann.createdAt).toLocaleDateString()}</span>
                          {ann.isPinned && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              Pinned
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm text-surface-900 dark:text-white line-clamp-1">
                          {localize(ann.title)}
                        </h4>
                        <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-2">
                          {ann.summary || localize(ann.content)}
                        </p>
                      </div>
                    </div>
                    {ann.ctaUrl && ann.ctaLabel && (
                      <div className="px-4 pb-4 pt-1">
                        <a
                          href={ann.ctaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-amber-400 hover:underline"
                        >
                          <span>{ann.ctaLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Quick Member Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-600" />
                  Profile & Verified Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-surface-500 leading-relaxed">
                  Keep your personal contact details, residential address, and emergency information up-to-date for this organization.
                </p>
                <Link href="/app/profile">
                  <Button variant="secondary" size="sm">
                    Edit Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand-600" />
                  4Baye Programs & Benefits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-surface-500 leading-relaxed">
                  Discover community welfare benefits, educational initiatives, and development programs led by 4Baye.
                </p>
                <div className="flex gap-2">
                  <Link href="/benefits">
                    <Button variant="secondary" size="sm">
                      View Benefits
                    </Button>
                  </Link>
                  <Link href="/programs">
                    <Button variant="outline" size="sm">
                      View Programs
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
