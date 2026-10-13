'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ApiClient } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Award,
  ShieldCheck,
  HeartHandshake,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface BenefitItem {
  id: string;
  title: any;
  description: any;
  icon?: string;
  displayOrder?: number;
}

export default function BenefitsPage() {
  const { t, localize } = useI18n();
  const [benefits, setBenefits] = useState<BenefitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<any>('/organizations/4b')
      .then((data) => {
        if (data?.benefits) {
          setBenefits(data.benefits);
        }
      })
      .catch(() => setBenefits([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-amber-950/40 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800/60">
          <span>Official Member Welfare & Privileges</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-surface-950 dark:text-white">
          4Baye Member Benefits
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
          Every active member of 4Baye Association enjoys dedicated welfare programs, community privileges, and institutional support.
        </p>
      </div>

      {/* Benefits Grid */}
      {benefits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit) => (
            <Card key={benefit.id} className="border-surface-200/80 dark:border-surface-800 hover:border-brand-300 transition-all">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg">{localize(benefit.title)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                  {localize(benefit.description)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-surface-500">
          <p>No benefits published at this time.</p>
        </div>
      )}

      {/* Action Banner */}
      <div className="text-center pt-8 border-t border-surface-200 dark:border-surface-800 space-y-4">
        <h3 className="text-2xl font-bold text-surface-950 dark:text-white">
          Ready to Access These Benefits?
        </h3>
        <p className="text-surface-500 max-w-lg mx-auto text-sm">
          Register today to receive your verified credentials and become an active member of 4Baye Association.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/register">
            <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Join 4Baye
            </Button>
          </Link>
          <Link href="/membership">
            <Button size="lg" variant="outline">
              View Dues & Tiers
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
