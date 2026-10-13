'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ApiClient } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  Mail,
  Phone,
  MapPin,
  Globe2,
  Send,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

interface ContactData {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  profile?: {
    socialLinks?: {
      website?: string;
      telegram?: string;
    };
  };
}

export default function ContactPage() {
  const { t } = useI18n();
  const [data, setData] = useState<ContactData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<ContactData>('/organizations/4b')
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-amber-950/40 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800/60">
          <span>Official Communications</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-surface-950 dark:text-white">
          Contact 4Baye Association
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
          Get in touch with executive officers, membership coordinators, and welfare administration.
        </p>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <Mail className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Email Administration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {data?.contactEmail || 'contact@4bassociation.org'}
            </p>
            <p className="text-xs text-surface-500">Official membership & executive correspondence</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Phone className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Telephone Inquiry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {data?.contactPhone || '+251 91 100 0002'}
            </p>
            <p className="text-xs text-surface-500">Member services line (Mon - Fri, 9:00 - 17:00)</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
              <MapPin className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Headquarters Office</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {data?.address || 'Addis Ababa, Ethiopia'}
            </p>
            <p className="text-xs text-surface-500">Official registry and association secretariat</p>
          </CardContent>
        </Card>

        <Card className="border-surface-200/80 dark:border-surface-800">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Send className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Telegram Community</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <a
              href={data?.profile?.socialLinks?.telegram || 'https://t.me/waanofii_4b'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-brand-600 dark:text-amber-400 hover:underline"
            >
              Official 4Baye Channel
            </a>
            <p className="text-xs text-surface-500">Direct announcements and broadcast notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* Member Portal Banner */}
      <div className="p-6 rounded-2xl bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-surface-950 dark:text-white">Are you an existing member?</h4>
          <p className="text-xs text-surface-500">Log in to update your profile, submit dues receipts, or view your digital ID card.</p>
        </div>
        <Link href="/login">
          <Button variant="primary" size="sm">
            Sign In to Member Portal
          </Button>
        </Link>
      </div>
    </div>
  );
}
