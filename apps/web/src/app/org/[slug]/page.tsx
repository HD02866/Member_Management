'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '../../../lib/i18n';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { CardSkeleton } from '../../../components/ui/LoadingSkeleton';
import { ScrollReveal } from '../../../components/ui/ScrollReveal';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Megaphone,
} from 'lucide-react';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoUrl?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  currency: string;
  defaultLanguage: string;
  profile?: {
    mission?: any;
    vision?: any;
    history?: any;
    values?: any;
    brandingConfig?: any;
  };
  programs?: {
    id: string;
    title: any;
    description: any;
    category?: string;
    startDate?: string;
    endDate?: string;
  }[];
  benefits?: {
    id: string;
    title: any;
    description: any;
    icon?: string;
  }[];
  leaders?: {
    id: string;
    name: string;
    photoUrl?: string;
    bio?: any;
    position?: {
      code: string;
      title: any;
    };
  }[];
  rules?: {
    id: string;
    title: any;
    contentMarkdown?: any;
    pdfAttachmentUrl?: string;
  }[];
  announcements?: {
    id: string;
    title: any;
    content: any;
    isPinned: boolean;
    publishedAt: string;
  }[];
  membershipPlans?: {
    id: string;
    name: string;
    code: string;
    description?: any;
    price: string | number;
    currency: string;
    registrationFee: string | number;
    billingInterval: string;
    benefitsSummary?: any;
  }[];
}

export default function OrganizationPublicPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { t, localize } = useI18n();
  const { user, isAuthenticated, switchOrganization, refreshUser } = useAuth();

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application Modal state
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    ApiClient.get<OrganizationDetail>(`/organizations/${slug}`)
      .then((data) => {
        setOrg(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Organization not found');
        setOrg(null);
      })
      .finally(() => setIsLoading(false));
  }, [slug]);

  const handleApplyClick = (plan: any) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/org/${slug}`);
      return;
    }
    setSelectedPlan(plan);
    setApplyError(null);
    setApplySuccess(null);
  };

  const handleConfirmApply = async () => {
    if (!org || !selectedPlan) return;

    try {
      setIsApplying(true);
      setApplyError(null);

      await ApiClient.post(
        '/memberships/apply',
        { planId: selectedPlan.id },
        { tenantId: org.id },
      );

      setApplySuccess(
        `Application registered for plan "${selectedPlan.name}"! Status: REGISTERED. Next step: complete payment.`,
      );

      // Refresh affiliations so Organization Switcher includes this tenant
      await refreshUser();
      switchOrganization(org.id);
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to submit application.');
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-48 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          Organization Not Found
        </h2>
        <p className="text-sm text-surface-500">
          {error || `The organization with slug "${slug}" does not exist or has been deactivated.`}
        </p>
        <Link href="/organizations">
          <Button variant="outline">Browse Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Organization Banner / Header */}
      <section className="bg-gradient-to-b from-surface-100 to-white dark:from-surface-900 dark:to-surface-950 border-b border-surface-200 dark:border-surface-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-3xl shadow-lg shrink-0">
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt={org.name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <Building2 className="w-10 h-10" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-950 dark:text-white">
                    {org.name}
                  </h1>
                  <Badge variant="success">Verified Tenant</Badge>
                </div>
                <p className="text-sm text-surface-500 font-mono">@{org.slug}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500 pt-1">
                  {org.contactEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-surface-400" />
                      {org.contactEmail}
                    </span>
                  )}
                  {org.contactPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-surface-400" />
                      {org.contactPhone}
                    </span>
                  )}
                  {org.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-surface-400" />
                      {org.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!isAuthenticated && (
                <Link href={`/register?org=${org.slug}`}>
                  <Button variant="outline" size="md">
                    Register as Member
                  </Button>
                </Link>
              )}
              <a href="#plans">
                <Button variant="primary" size="md">
                  {t('org.joinOrg')}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Mission, Vision, Purpose */}
        {org.profile && (
          <ScrollReveal>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {org.profile.mission && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-brand-600 dark:text-brand-400">
                      {t('org.mission')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                      {localize(org.profile.mission)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {org.profile.vision && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-indigo-600 dark:text-indigo-400">
                      {t('org.vision')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                      {localize(org.profile.vision)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {org.profile.values && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">
                      {t('org.purpose')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
                      {localize(org.profile.values)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>
          </ScrollReveal>
        )}

        {/* Announcements */}
        {org.announcements && org.announcements.length > 0 && (
          <ScrollReveal delay={50}>
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-surface-950 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-600" />
                {t('org.announcements')}
              </h2>
              <div className="space-y-3">
                {org.announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {a.isPinned && <Badge variant="warning">Pinned</Badge>}
                        <h4 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                          {localize(a.title)}
                        </h4>
                      </div>
                      <p className="text-xs text-surface-500 leading-relaxed">
                        {localize(a.content)}
                      </p>
                    </div>
                    <span className="text-[11px] text-surface-400 shrink-0">
                      {new Date(a.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </ScrollReveal>
        )}

        {/* Membership Plans Discovery */}
        <ScrollReveal delay={100}>
          <section id="plans" className="space-y-6 pt-4">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-bold text-surface-950 dark:text-white">
                {t('org.plans')}
              </h2>
              <p className="text-sm text-surface-500">
                Select an official membership tier to apply and register your verified membership.
              </p>
            </div>

          {org.membershipPlans && org.membershipPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {org.membershipPlans.map((plan) => (
                <Card
                  key={plan.id}
                  className="flex flex-col justify-between hover:border-brand-500 transition-colors"
                >
                  <div>
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <Badge variant="info">{plan.billingInterval}</Badge>
                      </div>
                      <div className="flex items-baseline gap-1 pt-2">
                        <span className="text-2xl font-bold text-surface-950 dark:text-white">
                          {Number(plan.price).toLocaleString()} {plan.currency}
                        </span>
                        <span className="text-xs text-surface-400">/ {plan.billingInterval}</span>
                      </div>
                      {Number(plan.registrationFee) > 0 && (
                        <p className="text-xs text-surface-500">
                          Registration Fee: {Number(plan.registrationFee).toLocaleString()}{' '}
                          {plan.currency}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-2">
                      <p className="text-xs text-surface-600 dark:text-surface-300">
                        {localize(plan.description) || 'Standard membership benefits and voting rights.'}
                      </p>
                    </CardContent>
                  </div>

                  <div className="p-5 border-t border-surface-100 dark:border-surface-800">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={() => handleApplyClick(plan)}
                    >
                      {t('common.apply')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-surface-400 border rounded-xl">
              No active membership plans currently listed.
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* Benefits & Programs Grid */}
      <ScrollReveal delay={150}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Programs */}
          {org.programs && org.programs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-600" />
                  {t('org.programs')}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-surface-100 dark:divide-surface-800 p-0">
                {org.programs.map((p) => (
                  <div key={p.id} className="p-4 space-y-1">
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                      {localize(p.title)}
                    </h4>
                    <p className="text-xs text-surface-500">{localize(p.description)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Benefits */}
          {org.benefits && org.benefits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  {t('org.benefits')}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-surface-100 dark:divide-surface-800 p-0">
                {org.benefits.map((b) => (
                  <div key={b.id} className="p-4 space-y-1">
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                      {localize(b.title)}
                    </h4>
                    <p className="text-xs text-surface-500">{localize(b.description)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollReveal>

      {/* Leadership & Rules */}
      <ScrollReveal delay={200}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Leadership */}
          {org.leaders && org.leaders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  {t('org.leaders')}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-surface-100 dark:divide-surface-800 p-0">
                {org.leaders.map((l) => (
                  <div key={l.id} className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                        {l.name}
                      </h4>
                      <p className="text-xs text-surface-500">
                        {localize(l.position?.title) || l.position?.code || 'Officer'}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Rules & Bylaws */}
          {org.rules && org.rules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-surface-600" />
                  {t('org.rules')}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-surface-100 dark:divide-surface-800 p-0">
                {org.rules.map((r) => (
                  <div key={r.id} className="p-4 space-y-1">
                    <h4 className="font-semibold text-sm text-surface-900 dark:text-surface-100">
                      {localize(r.title)}
                    </h4>
                    <p className="text-xs text-surface-500 leading-relaxed">
                      {localize(r.contentMarkdown)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollReveal>
      </div>

      {/* Membership Application Modal */}
      <Modal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        title={t('membership.applyModalTitle')}
        description={`Organization: ${org.name}`}
      >
        <div className="space-y-4">
          {applyError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}

          {applySuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-base text-surface-900 dark:text-surface-100">
                Application Received!
              </h4>
              <p className="text-xs text-surface-500">{applySuccess}</p>
              <div className="p-3 rounded-lg bg-surface-50 text-xs text-surface-600 border">
                <strong>Next Step:</strong> Complete payment (payment workflows will be enabled in
                Phase 5).
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setSelectedPlan(null);
                  router.push('/app/dashboard');
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-surface-500 uppercase">
                    Selected Plan
                  </span>
                  <Badge variant="info">{selectedPlan?.billingInterval}</Badge>
                </div>
                <h4 className="text-lg font-bold text-surface-900 dark:text-surface-100">
                  {selectedPlan?.name}
                </h4>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-surface-200 dark:border-surface-700">
                  <span className="text-surface-500">Plan Fee:</span>
                  <span className="font-semibold">
                    {Number(selectedPlan?.price).toLocaleString()} {selectedPlan?.currency}
                  </span>
                </div>
                {Number(selectedPlan?.registrationFee) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-surface-500">Registration Fee:</span>
                    <span className="font-semibold">
                      {Number(selectedPlan?.registrationFee).toLocaleString()}{' '}
                      {selectedPlan?.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-surface-200 dark:border-surface-700 text-brand-600">
                  <span>Total Due:</span>
                  <span>
                    {(
                      Number(selectedPlan?.price) + Number(selectedPlan?.registrationFee || 0)
                    ).toLocaleString()}{' '}
                    {selectedPlan?.currency}
                  </span>
                </div>
              </div>

              <div className="text-xs text-surface-500 leading-relaxed">
                By submitting this application, your member profile will be registered in{' '}
                <strong>{org.name}</strong> under status <code>REGISTERED</code>.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPlan(null)}
                  disabled={isApplying}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmApply}
                  isLoading={isApplying}
                >
                  {t('membership.confirmApplication')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
