'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import {
  Layers,
  Plus,
  CheckCircle,
  AlertCircle,
  Users,
  Briefcase,
  HardDrive,
  Shield,
} from 'lucide-react';

export default function AdminPlansPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('0');
  const [maxMembers, setMaxMembers] = useState('100');
  const [maxStaff, setMaxStaff] = useState('2');
  const [storageMb, setStorageMb] = useState('1024');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadPlans();
    }
  }, [user]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await ApiClient.request('/subscriptions/admin/plans');
      setPlans(res.data || res || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.request('/subscriptions/admin/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          price: parseFloat(price),
          currency: 'USD',
          maxMembers: parseInt(maxMembers, 10),
          maxStaff: parseInt(maxStaff, 10),
          storageLimitMb: parseInt(storageMb, 10),
        }),
      });
      setSuccessMsg('Plan created successfully');
      setName('');
      setCode('');
      setShowCreate(false);
      loadPlans();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm mt-1">
          Platform administrator privileges required to view plans administration.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <LoadingSkeleton variant="title" />
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-600" />
            {t('admin.plansTitle')}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            {t('admin.plansSubtitle')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create Plan
        </Button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {showCreate && (
        <Card className="p-6">
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Plan Name"
                placeholder="Enterprise Scale"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Plan Code"
                placeholder="ENTERPRISE_SCALE"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
              <Input
                label="Price (USD)"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <Input
                label="Max Members"
                type="number"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                required
              />
              <Input
                label="Max Staff"
                type="number"
                value={maxStaff}
                onChange={(e) => setMaxStaff(e.target.value)}
                required
              />
              <Input
                label="Storage Limit (MB)"
                type="number"
                value={storageMb}
                onChange={(e) => setStorageMb(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Save Plan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((p) => (
          <Card key={p.id} className="p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                  {p.name}
                </h3>
                <span className="text-xs font-mono text-surface-500">{p.code}</span>
              </div>
              <Badge variant={p.isActive ? 'success' : 'neutral'}>
                {p.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="text-2xl font-black text-surface-900 dark:text-white">
              ${p.price}{' '}
              <span className="text-xs font-normal text-surface-500">/ month</span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-surface-200 dark:border-surface-800 text-sm text-surface-600 dark:text-surface-300">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-500" />
                <span>Up to <strong>{p.maxMembers.toLocaleString()}</strong> members</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <span>Up to <strong>{p.maxStaff}</strong> staff administrators</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-500" />
                <span><strong>{(p.storageLimitMb / 1024).toFixed(1)} GB</strong> storage</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
