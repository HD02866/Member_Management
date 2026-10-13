'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ApiClient } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  BookOpen,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface ProgramItem {
  id: string;
  title: any;
  description: any;
  category?: string;
  startDate?: string;
  endDate?: string;
  isMembersOnly?: boolean;
}

export default function ProgramsPage() {
  const { t, localize } = useI18n();
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<any>('/organizations/4b')
      .then((data) => {
        if (data?.programs) {
          setPrograms(data.programs);
        }
      })
      .catch(() => setPrograms([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-amber-950/40 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800/60">
          <span>Community Development & Welfare</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-surface-950 dark:text-white">
          4Baye Programs & Initiatives
        </h1>
        <p className="text-lg text-surface-600 dark:text-surface-300 max-w-2xl mx-auto">
          Explore ongoing development projects, community assemblies, and member welfare programs initiated by 4Baye Association.
        </p>
      </div>

      {/* Programs List */}
      {programs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((prog) => (
            <Card key={prog.id} className="border-surface-200/80 dark:border-surface-800 hover:border-brand-300 transition-all flex flex-col justify-between">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="neutral">{prog.category || 'Initiative'}</Badge>
                  {prog.isMembersOnly && <Badge variant="info">Members Only</Badge>}
                </div>
                <CardTitle className="text-lg">{localize(prog.title)}</CardTitle>
                {prog.startDate && (
                  <div className="flex items-center gap-1.5 text-xs text-surface-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(prog.startDate).toLocaleDateString()}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                  {localize(prog.description)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-surface-500">
          <p>No active programs at this time.</p>
        </div>
      )}

      {/* Action Banner */}
      <div className="text-center pt-8 border-t border-surface-200 dark:border-surface-800 space-y-4">
        <h3 className="text-2xl font-bold text-surface-950 dark:text-white">
          Participate in 4Baye Community Initiatives
        </h3>
        <p className="text-surface-500 max-w-lg mx-auto text-sm">
          Join our association to collaborate on community projects and attend official assemblies.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link href="/register">
            <Button size="lg" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Join 4Baye
            </Button>
          </Link>
          <Link href="/contact">
            <Button size="lg" variant="outline">
              Contact Committee
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
