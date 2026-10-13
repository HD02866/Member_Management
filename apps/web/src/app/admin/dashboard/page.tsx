'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { AnimatedCounter } from '../../../components/ui/AnimatedCounter';
import {
  Shield,
  Building,
  Users,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  Activity,
  Layers,
  Sparkles,
  UserCheck,
  CreditCard,
  FileText,
  Clock,
  Settings,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';

interface PlatformStats {
  organizations: {
    total: number;
    active: number;
    onboarding: number;
    suspended: number;
    deactivated: number;
  };
  users: {
    total: number;
    active: number;
    suspended: number;
  };
  members: {
    total: number;
  };
  staff: {
    total: number;
  };
  subscriptions: {
    total: number;
    active: number;
  };
  plans: {
    total: number;
  };
  payments: {
    totalTransactions: number;
    approvedReviews: number;
    pendingReviews: number;
  };
  digitalCards: {
    total: number;
    active: number;
  };
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    actorUser?: {
      firstName: string;
      lastName: string;
      email: string | null;
    } | null;
    organization?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }>;
}

export default function PlatformAdminDashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadPlatformStats();
    }
  }, [user]);

  const loadPlatformStats = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await ApiClient.get<PlatformStats>('/platform/stats');
      setStats(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load platform administration metrics');
    } finally {
      setLoading(false);
    }
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Platform administrator privileges required to view the WaanOfii Control Center.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <LoadingSkeleton variant="title" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Platform Admin
            </span>
            <span className="text-xs text-surface-400">WaanOfii SaaS Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
            Platform Operator Command
          </h1>
          <p className="text-sm text-surface-500 mt-1 max-w-2xl">
            Cross-tenant system observability, tenant lifecycle control, SaaS billing, and platform security management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/onboard">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Onboard Organization
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" size="sm" leftIcon={<Users className="w-4 h-4" />}>
              Platform Users
            </Button>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Primary SaaS Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Organizations */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Organizations / Tenants
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
              <AnimatedCounter value={stats?.organizations.total ?? 0} />
            </div>
            <div className="flex items-center gap-2 text-xs text-surface-500 mt-1">
              <span className="font-semibold text-emerald-600">
                {stats?.organizations.active ?? 0} Active
              </span>
              <span>·</span>
              <span>{stats?.organizations.onboarding ?? 0} Onboarding</span>
              <span>·</span>
              <span className="text-amber-600">{stats?.organizations.suspended ?? 0} Suspended</span>
            </div>
          </div>
        </Card>

        {/* Global Users */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Global Platform Users
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
              <AnimatedCounter value={stats?.users.total ?? 0} />
            </div>
            <p className="text-xs text-surface-500 mt-1">
              <span className="font-semibold text-emerald-600">
                {stats?.users.active ?? 0} Active Accounts
              </span>
              {' '}· {stats?.users.suspended ?? 0} Suspended
            </p>
          </div>
        </Card>

        {/* Member & Staff Footprint */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Members & Staff
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
              <AnimatedCounter value={stats?.members.total ?? 0} />
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Registered Members · <strong className="text-surface-700 dark:text-surface-300">{stats?.staff.total ?? 0}</strong> Assigned Staff
            </p>
          </div>
        </Card>

        {/* Subscriptions & Tiers */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              SaaS Subscriptions
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-surface-950 dark:text-white">
              <AnimatedCounter value={stats?.subscriptions.active ?? 0} />
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Active Subscriptions across {stats?.plans.total ?? 0} SaaS Tiers
            </p>
          </div>
        </Card>
      </div>

      {/* Secondary Metrics: Operations & Verification */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Payment Transactions
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-surface-950 dark:text-white">
            <AnimatedCounter value={stats?.payments.totalTransactions ?? 0} />
          </div>
          <p className="text-xs text-surface-500 mt-1">
            {stats?.payments.approvedReviews ?? 0} Approved Reviews · {stats?.payments.pendingReviews ?? 0} Pending
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Digital ID Cards
            </span>
            <CreditCard className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-surface-950 dark:text-white">
            <AnimatedCounter value={stats?.digitalCards.total ?? 0} />
          </div>
          <p className="text-xs text-surface-500 mt-1">
            {stats?.digitalCards.active ?? 0} Active Digital Cards Issued
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              RLS Security Enforcement
            </span>
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            100% Isolated
          </div>
          <p className="text-xs text-surface-500 mt-1">
            PostgreSQL NOBYPASSRLS · Tenant-Isolated Contexts
          </p>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-5 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-surface-900 dark:text-white">Organizations</h3>
            <p className="text-xs text-surface-500">
              Manage tenants, lifecycle status, branding, feature overrides, and staff assignments.
            </p>
          </div>
          <Link href="/admin/organizations">
            <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Manage Tenants
            </Button>
          </Link>
        </Card>

        <Card className="p-5 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-surface-900 dark:text-white">Global Users</h3>
            <p className="text-xs text-surface-500">
              View all platform users, create administrative accounts, and inspect multi-tenant affiliations.
            </p>
          </div>
          <Link href="/admin/users">
            <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Users Directory
            </Button>
          </Link>
        </Card>

        <Card className="p-5 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-surface-900 dark:text-white">SaaS Subscriptions</h3>
            <p className="text-xs text-surface-500">
              Oversee tenant subscriptions, plan assignments, tier pricing, and capacity limits.
            </p>
          </div>
          <Link href="/admin/subscriptions">
            <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Subscriptions & Plans
            </Button>
          </Link>
        </Card>

        <Card className="p-5 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-surface-900 dark:text-white">Platform Operations</h3>
            <p className="text-xs text-surface-500">
              Audit trail logging, cross-tenant payment oversight, and verification token inspection.
            </p>
          </div>
          <Link href="/admin/audit">
            <Button variant="secondary" size="sm" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Audit & Operations
            </Button>
          </Link>
        </Card>
      </div>

      {/* Recent Platform Audit Activity Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Recent Platform Activity
            </h2>
            <p className="text-xs text-surface-500">
              Immutable audit log entries across all tenants and platform operations.
            </p>
          </div>
          <Link href="/admin/audit">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              View All Logs
            </Button>
          </Link>
        </div>

        {(!stats?.recentAudit || stats.recentAudit.length === 0) ? (
          <Card className="p-8 text-center text-sm text-surface-500">
            No audit events recorded yet.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {stats.recentAudit.map((event) => (
                <div key={event.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm hover:bg-surface-50/50 dark:hover:bg-surface-800/30 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-surface-900 dark:text-white font-mono text-xs">
                        {event.action}
                      </span>
                      <Badge variant="neutral" className="text-[10px]">
                        {event.entityType}
                      </Badge>
                      {event.organization && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          @{event.organization.slug}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500">
                      Actor:{' '}
                      {event.actorUser
                        ? `${event.actorUser.firstName} ${event.actorUser.lastName} (${event.actorUser.email || 'no email'})`
                        : 'System / Guest'}
                      {event.entityId && ` · Target ID: ${event.entityId.slice(0, 8)}...`}
                    </p>
                  </div>
                  <div className="text-xs text-surface-400 whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
