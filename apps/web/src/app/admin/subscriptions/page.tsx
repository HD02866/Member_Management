'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Shield,
  Layers,
  Building,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowRight,
  ExternalLink,
  Calendar,
  CreditCard,
  DollarSign,
  PauseCircle,
  XCircle,
} from 'lucide-react';

interface AdminSubscriptionItem {
  id: string;
  organizationId: string;
  planId: string;
  status: string;
  billingPeriod: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  plan: {
    id: string;
    name: string;
    code: string;
    price: number;
    maxMembers: number;
    maxStaff: number;
  };
}

export default function AdminSubscriptionsPage() {
  const { user } = useAuth();

  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign Plan Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('MONTHLY');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadSubscriptionsData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [subsRes, plansRes, orgsRes] = await Promise.all([
        ApiClient.get<AdminSubscriptionItem[]>('/subscriptions/admin/all'),
        ApiClient.get<any[]>('/subscriptions/admin/plans'),
        ApiClient.get<any>('/platform/organizations?limit=100'),
      ]);

      setSubscriptions(Array.isArray(subsRes) ? subsRes : (subsRes as any)?.data || []);
      setPlans(Array.isArray(plansRes) ? plansRes : (plansRes as any)?.data || []);
      const orgList = orgsRes?.organizations || (Array.isArray(orgsRes) ? orgsRes : []);
      setOrganizations(orgList);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load subscription administration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadSubscriptionsData();
    }
  }, [user, loadSubscriptionsData]);

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedPlanId) return;

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.post('/subscriptions/admin/assign', {
        organizationId: selectedOrgId,
        planId: selectedPlanId,
        billingPeriod,
      });

      setSuccessMsg('SaaS plan successfully assigned to organization');
      setIsAssignModalOpen(false);
      setSelectedOrgId('');
      setSelectedPlanId('');
      loadSubscriptionsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign plan');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (subscriptionId: string, status: string) => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch(`/subscriptions/admin/${subscriptionId}/status`, {
        status,
      });
      setSuccessMsg(`Subscription status updated to ${status}`);
      loadSubscriptionsData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update subscription status');
    } finally {
      setSaving(false);
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
          Platform administrator privileges required to view subscriptions management.
        </p>
      </div>
    );
  }

  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const trialCount = subscriptions.filter((s) => s.status === 'TRIALING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              SaaS Billing & Subscriptions
            </span>
            <span className="text-xs text-surface-400">Total: {subscriptions.length} Subscriptions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
            Subscription Oversight
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Manage organization SaaS plans, billing statuses, renewals, and tier assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/plans">
            <Button variant="outline" size="sm" leftIcon={<Layers className="w-4 h-4" />}>
              Configure Plan Tiers
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAssignModalOpen(true)}
          >
            Assign Plan to Tenant
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-2 border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Active Subscriptions
            </span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-surface-900 dark:text-white">
            {activeCount}
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Tenants with active billing licenses
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Trialing Tenants
            </span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-surface-900 dark:text-white">
            {trialCount}
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Organizations in evaluation period
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
              Configured SaaS Tiers
            </span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-surface-900 dark:text-white">
            {plans.length}
          </div>
          <p className="text-xs text-surface-500 mt-1">
            Available subscription plan packages
          </p>
        </Card>
      </div>

      {/* Subscriptions Table */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          title="No active subscriptions found"
          description="Use Assign Plan to Tenant to provision SaaS subscriptions."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tenant Organization</th>
                  <th className="px-5 py-3 font-semibold">Plan Tier</th>
                  <th className="px-5 py-3 font-semibold">Price / Cycle</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Current Period</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/organizations/${sub.organization.slug || sub.organization.id}`}
                        className="font-bold text-surface-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {sub.organization.name}
                      </Link>
                      <div className="text-xs text-surface-400 font-mono">@{sub.organization.slug}</div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-surface-900 dark:text-white">
                        {sub.plan.name}
                      </span>
                      <div className="text-xs text-surface-400 font-mono">{sub.plan.code}</div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-600 dark:text-surface-300 font-mono">
                      ${sub.plan.price} / {sub.billingPeriod.toLowerCase()}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          sub.status === 'ACTIVE'
                            ? 'success'
                            : sub.status === 'TRIALING'
                            ? 'info'
                            : sub.status === 'PAST_DUE'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {sub.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-500">
                      <div>Start: {new Date(sub.currentPeriodStart).toLocaleDateString()}</div>
                      <div>End: {new Date(sub.currentPeriodEnd).toLocaleDateString()}</div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {sub.status !== 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600 text-xs p-1"
                            onClick={() => handleUpdateStatus(sub.id, 'ACTIVE')}
                            disabled={saving}
                          >
                            Activate
                          </Button>
                        )}
                        {sub.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-amber-600 text-xs p-1"
                            onClick={() => handleUpdateStatus(sub.id, 'CANCELED')}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Assign Plan */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign SaaS Subscription Plan"
        description="Provision or upgrade a tenant organization's subscription tier"
      >
        <form onSubmit={handleAssignPlan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Select Tenant Organization
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">-- Choose Tenant --</option>
              {organizations.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.name} (@{o.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Select SaaS Plan Tier
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">-- Choose Plan Tier --</option>
              {plans.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${p.price}/mo - up to {p.maxMembers} members)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
              Billing Period
            </label>
            <select
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Assigning...' : 'Assign Subscription'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
