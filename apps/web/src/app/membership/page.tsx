'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ApiClient } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  QrCode,
  ArrowRight,
  Sparkles,
  Users,
  Award,
} from 'lucide-react';

interface MembershipPlan {
  id: string;
  name: string;
  code: string;
  price: string | number;
  currency: string;
  registrationFee: string | number;
  billingInterval: string;
  description?: any;
}

export default function MembershipPublicPage() {
  const { t, localize } = useI18n();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<any>('/organizations/4b')
      .then((data) => {
        if (data?.membershipPlans) {
          setPlans(data.membershipPlans);
        }
      })
      .catch(() => setPlans([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-amber-950/40 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800/60">
          <span>Official 4Baye Membership</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-surface-950 dark:text-white">
          Join 4Baye Association
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
          Gain official recognition, receive your cryptographic digital membership card, and participate in community programs and welfare initiatives.
        </p>
      </div>

      {/* Member Value Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Digital Membership ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              Every verified member receives a secure, tamper-proof digital membership card with a dynamic QR code for instant standing verification.
            </p>
          </CardContent>
        </Card>

        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Community Welfare Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              Access emergency assistance, bereavement support, educational scholarships, and mutual aid programs managed transparently by 4Baye.
            </p>
          </CardContent>
        </Card>

        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Democratic Governance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
              Vote on association initiatives, attend official assemblies, and contribute directly to community resolutions and leadership.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Membership Tiers & Dues */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white">
            Membership Dues & Plans
          </h2>
          <p className="text-surface-500 text-sm">
            Choose the membership tier that suits your participation in 4Baye
          </p>
        </div>

        {plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card key={plan.id} className="border-surface-200 dark:border-surface-800 flex flex-col justify-between">
                <CardHeader className="space-y-2 pb-4">
                  <Badge variant="neutral">{plan.code}</Badge>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 pt-2">
                    <span className="text-3xl font-black text-surface-950 dark:text-white">
                      {plan.currency} {Number(plan.price).toLocaleString()}
                    </span>
                    <span className="text-xs text-surface-500">/ {plan.billingInterval}</span>
                  </div>
                  {Number(plan.registrationFee) > 0 && (
                    <p className="text-xs text-surface-400">
                      Registration Fee: {plan.currency} {Number(plan.registrationFee).toLocaleString()}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    {localize(plan.description) || 'Official member standing, digital card access, and voting rights.'}
                  </p>
                  <div className="pt-4">
                    <Link href="/register">
                      <Button className="w-full" variant="primary">
                        Apply with this Plan
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Link href="/register">
              <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Register for 4Baye Membership
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
