'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
  Shield,
  User,
  Mail,
  Phone,
  Key,
  Lock,
  Building,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function PlatformAdminProfilePage() {
  const { user } = useAuth();

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Platform administrator privileges required to view this profile.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Platform Operator
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
          Platform Administrator Profile
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Verified global operator credentials and security boundaries for WaanOfii SaaS platform administration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Admin Identity */}
        <Card className="p-6 md:col-span-1 space-y-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white font-bold text-2xl flex items-center justify-center mx-auto shadow-md">
            {user.firstName?.charAt(0)}
            {user.lastName?.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">
              {user.firstName} {user.lastName}
            </h2>
            <Badge variant="success" className="mt-1">
              Active Operator
            </Badge>
          </div>
          <div className="pt-2 border-t border-surface-100 dark:border-surface-800 text-xs text-surface-500 space-y-1">
            <p>Platform ID: <span className="font-mono text-surface-700 dark:text-surface-300">{user.id.slice(0, 10)}...</span></p>
            <p>Member since {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </Card>

        {/* Right Column: Credentials & Security Context */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" />
              Operator Information
            </CardTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40">
                <span className="text-xs text-surface-400 block">Email Address</span>
                <span className="font-semibold text-surface-900 dark:text-white">
                  {user.email || 'None registered'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40">
                <span className="text-xs text-surface-400 block">Phone Number</span>
                <span className="font-semibold text-surface-900 dark:text-white">
                  {user.phoneNumber || 'None registered'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40">
                <span className="text-xs text-surface-400 block">Role</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Global Platform Administrator
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/40">
                <span className="text-xs text-surface-400 block">RLS Context Execution</span>
                <span className="font-semibold text-emerald-600">
                  NOBYPASSRLS Platform Session
                </span>
              </div>
            </div>
          </Card>

          {/* Platform Security Boundaries */}
          <Card className="p-6 space-y-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              Administrative Permissions & Capabilities
            </CardTitle>
            <div className="space-y-2 text-xs text-surface-600 dark:text-surface-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Multi-tenant organization lifecycle management (Activate, Suspend, Deactivate)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Global user provisioning and staff administrator assignments</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>SaaS tier subscriptions, billing pricing, and feature entitlement overrides</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Digital membership card template customization and live interactive previews</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Cross-tenant immutable audit logging, financial transactions, and verification oversight</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
