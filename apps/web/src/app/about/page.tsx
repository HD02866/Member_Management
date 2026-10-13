'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ApiClient } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  ShieldCheck,
  Target,
  Award,
  Users,
  BookOpen,
  ArrowRight,
  Mail,
  Phone,
  Globe2,
} from 'lucide-react';

interface OrgAboutData {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  profile?: {
    mission?: any;
    vision?: any;
    history?: any;
    values?: any;
    socialLinks?: any;
  };
  leaders?: Array<{
    id: string;
    name: string;
    photoUrl?: string;
    bio?: any;
    position?: {
      title: any;
    };
  }>;
  rules?: Array<{
    id: string;
    title: any;
    contentMarkdown?: any;
  }>;
}

export default function AboutPage() {
  const { t, localize } = useI18n();
  const [data, setData] = useState<OrgAboutData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<OrgAboutData>('/organizations/4b')
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, []);

  const leaders = data?.leaders || [];
  const rules = data?.rules || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-amber-950/40 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800/60">
          <span>Official Institutional Profile</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-surface-950 dark:text-white">
          About 4Baye Association
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
          Founded to unite members, empower our community, and modernize community welfare through transparent and collaborative governance.
        </p>
      </div>

      {/* Mission & Vision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-amber-400">
              <Target className="w-5 h-5" />
            </div>
            <CardTitle>{t('memberHome.missionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              {localize(data?.profile?.mission) ||
                'To empower our community and foster sustainable growth through mutual support, cultural preservation, and institutional welfare.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <CardTitle>{t('memberHome.visionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              {localize(data?.profile?.vision) ||
                'A connected, transparent, and resilient network supporting generations of members.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {data?.profile?.history && (
        <Card className="border-surface-200 dark:border-surface-800">
          <CardHeader>
            <CardTitle className="text-xl">Our History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-surface-600 dark:text-surface-400 leading-relaxed text-sm sm:text-base">
              {localize(data.profile.history)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leadership Preview */}
      {leaders.length > 0 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-surface-950 dark:text-white">
              Leadership & Governance
            </h2>
            <p className="text-sm text-surface-500">
              Executive committee and officers serving 4Baye Association
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {leaders.slice(0, 6).map((leader) => (
              <Card key={leader.id} className="text-center">
                <CardContent className="pt-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 mx-auto flex items-center justify-center font-bold text-xl">
                    {leader.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-950 dark:text-white">{leader.name}</h3>
                    {leader.position && (
                      <p className="text-xs text-brand-600 dark:text-amber-400 font-medium">
                        {localize(leader.position.title)}
                      </p>
                    )}
                  </div>
                  {leader.bio && (
                    <p className="text-xs text-surface-500 line-clamp-2">
                      {localize(leader.bio)}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Call to Action */}
      <div className="text-center pt-8 border-t border-surface-200 dark:border-surface-800 space-y-4">
        <h3 className="text-2xl font-bold text-surface-950 dark:text-white">
          Become Part of 4Baye Association
        </h3>
        <p className="text-surface-500 max-w-lg mx-auto text-sm">
          Join our growing association to participate in development programs, access welfare benefits, and receive your verified digital membership card.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/register">
            <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Join 4Baye
            </Button>
          </Link>
          <Link href="/contact">
            <Button size="lg" variant="outline">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
