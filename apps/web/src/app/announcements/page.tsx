'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ApiClient } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Megaphone,
  Calendar,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface AnnouncementItem {
  id: string;
  title: any;
  content: any;
  isPinned: boolean;
  publishedAt: string;
}

export default function AnnouncementsPage() {
  const { t, localize } = useI18n();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<any>('/organizations/4b')
      .then((data) => {
        if (data?.announcements) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(() => setAnnouncements([]))
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
          4Baye Announcements
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
          Official resolutions, executive notices, and community updates from 4Baye Association leadership.
        </p>
      </div>

      {/* Announcements List */}
      {announcements.length > 0 ? (
        <div className="space-y-6">
          {announcements.map((ann) => (
            <Card key={ann.id} className="border-surface-200/80 dark:border-surface-800 overflow-hidden">
              {(ann as any).coverImageUrl && (
                <div className="w-full h-48 bg-surface-100 dark:bg-surface-800 overflow-hidden">
                  <img
                    src={(ann as any).coverImageUrl}
                    alt={typeof ann.title === 'string' ? ann.title : 'Announcement cover'}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-surface-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(ann.publishedAt).toLocaleDateString()}</span>
                  </div>
                  {ann.isPinned && <Badge variant="warning">Important Notice</Badge>}
                </div>
                <CardTitle className="text-xl">{localize(ann.title)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose dark:prose-invert max-w-none text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-line">
                  {localize(ann.content)}
                </div>
                {(ann as any).ctaUrl && (ann as any).ctaLabel && (
                  <div className="pt-2">
                    <a
                      href={(ann as any).ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-amber-400 hover:underline"
                    >
                      <span>{(ann as any).ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-surface-500">
          <p>No announcements published at this time.</p>
        </div>
      )}
    </div>
  );
}
