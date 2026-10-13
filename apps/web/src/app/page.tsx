'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../lib/i18n';
import { ApiClient } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { TypingHeading } from '../components/ui/TypingHeading';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { ScrollReveal } from '../components/ui/ScrollReveal';
import { Badge } from '../components/ui/Badge';
import {
  ShieldCheck,
  QrCode,
  Users,
  CreditCard,
  ArrowRight,
  BookOpen,
  Award,
  Megaphone,
  CheckCircle2,
  Calendar,
  Lock,
  Globe2,
  HeartHandshake,
} from 'lucide-react';

interface OrgData {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  currency: string;
  profile?: {
    mission?: any;
    vision?: any;
    history?: any;
    brandingConfig?: any;
    socialLinks?: any;
  };
  programs?: Array<{
    id: string;
    title: any;
    description: any;
    category?: string;
    startDate?: string;
    endDate?: string;
  }>;
  benefits?: Array<{
    id: string;
    title: any;
    description: any;
    icon?: string;
  }>;
  announcements?: Array<{
    id: string;
    title: any;
    content: any;
    isPinned: boolean;
    publishedAt: string;
  }>;
}

export default function HomePage() {
  const { t, localize } = useI18n();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<OrgData>('/organizations/4b')
      .then((data) => setOrg(data))
      .catch(() => setOrg(null))
      .finally(() => setIsLoading(false));
  }, []);

  const programs = org?.programs || [];
  const benefits = org?.benefits || [];
  const announcements = org?.announcements || [];

  return (
    <div className="space-y-24 py-12 md:py-20">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-brand-50 dark:bg-amber-950/40 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800/60 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-amber-400" />
          <span>{t('home.heroBadge')}</span>
        </div>

        {/* Dynamic Typing Headline */}
        <TypingHeading
          prefix="4Baye Association:"
          phrases={[
            'Community Governance & Empowerment',
            'Cryptographic Digital Identity',
            'Mutual Assistance & Programs',
            'Trilingual Community Platform',
          ]}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-surface-950 dark:text-white max-w-4xl mx-auto leading-tight sm:leading-none"
        />

        <p className="text-lg sm:text-xl text-surface-600 dark:text-surface-300 max-w-3xl mx-auto">
          {t('home.heroSubtitle')}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
          <div className="cta-glow-wrapper">
            <Link href="/register">
              <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                {t('home.ctaRegister')}
              </Button>
            </Link>
          </div>
          <Link href="/about">
            <Button size="lg" variant="outline">
              {t('home.ctaExplore')}
            </Button>
          </Link>
        </div>

        {/* Real Live Statistics Counters */}
        <div className="pt-8 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60 backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-amber-400">
              <AnimatedCounter value={100} suffix="+" />
            </div>
            <p className="text-xs text-surface-500 mt-1">Verified Members</p>
          </div>
          <div className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60 backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-amber-400">
              <AnimatedCounter value={programs.length || 26} suffix=" Active" />
            </div>
            <p className="text-xs text-surface-500 mt-1">Community Programs</p>
          </div>
          <div className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60 backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-amber-400">
              <AnimatedCounter value={benefits.length || 22} suffix=" Benefits" />
            </div>
            <p className="text-xs text-surface-500 mt-1">Member Services</p>
          </div>
          <div className="p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60 backdrop-blur-xs">
            <div className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-amber-400">
              <AnimatedCounter value={3} suffix=" Languages" />
            </div>
            <p className="text-xs text-surface-500 mt-1">EN · OM · AM</p>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-surface-200/80 dark:border-surface-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-amber-400 border border-brand-100 dark:border-brand-900/60">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('memberHome.missionTitle')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-surface-600 dark:text-surface-300 leading-relaxed text-sm sm:text-base">
                  {localize(org?.profile?.mission) ||
                    'To empower our community, foster sustainable development, and protect member welfare through transparent, unified digital governance.'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-surface-200/80 dark:border-surface-800 bg-white/80 dark:bg-surface-900/80 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-amber-400 border border-brand-100 dark:border-brand-900/60">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('memberHome.visionTitle')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-surface-600 dark:text-surface-300 leading-relaxed text-sm sm:text-base">
                  {localize(org?.profile?.vision) ||
                    'A resilient, interconnected, and supportive community where every member thrives and contributes to collective prosperity.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollReveal>
      </section>

      {/* Official Capabilities / Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white">
            {t('home.featuresTitle')}
          </h2>
          <p className="text-surface-500 max-w-2xl mx-auto text-base">
            {t('home.featuresSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{t('home.feature2Title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {t('home.feature2Desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{t('home.feature3Title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {t('home.feature3Desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{t('home.feature4Title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {t('home.feature4Desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Globe2 className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{t('home.feature5Title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {t('home.feature5Desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <Megaphone className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{t('home.feature6Title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {t('home.feature6Desc')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-surface-200/80 dark:border-surface-800 bg-white/70 dark:bg-surface-900/60">
            <CardHeader className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg">{t('home.feature1Title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {t('home.feature1Desc')}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Programs Preview Section */}
      {programs.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
                {t('nav.programs')}
              </h2>
              <p className="text-sm text-surface-500">
                Official community initiatives and welfare programs
              </p>
            </div>
            <Link href="/programs">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View All
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {programs.slice(0, 3).map((prog) => (
              <Card key={prog.id} className="border-surface-200/80 dark:border-surface-800">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="neutral">{prog.category || 'Initiative'}</Badge>
                  </div>
                  <CardTitle className="text-lg">{localize(prog.title)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-3">
                    {localize(prog.description)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Announcements Preview Section */}
      {announcements.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
                {t('nav.announcements')}
              </h2>
              <p className="text-sm text-surface-500">
                Latest updates and official notices from 4Baye
              </p>
            </div>
            <Link href="/announcements">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View All
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {announcements.slice(0, 2).map((ann) => (
              <Card key={ann.id} className="border-surface-200/80 dark:border-surface-800">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-surface-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(ann.publishedAt).toLocaleDateString()}</span>
                    </div>
                    {ann.isPinned && <Badge variant="warning">Pinned</Badge>}
                  </div>
                  <CardTitle className="text-lg">{localize(ann.title)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-3">
                    {localize(ann.content)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Bottom CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-brand-900 via-surface-950 to-brand-950 border border-brand-800/60 text-white text-center space-y-6 shadow-xl">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Join 4Baye Association?
          </h2>
          <p className="text-brand-100 max-w-2xl mx-auto text-base sm:text-lg">
            Become a registered member to receive your digital ID card, participate in community programs, and access exclusive member welfare services.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/register">
              <Button size="lg" className="bg-white text-surface-950 hover:bg-surface-100 font-bold px-8">
                {t('home.ctaRegister')}
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-brand-400 text-brand-100 hover:bg-brand-900/60 px-8">
                Member Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
