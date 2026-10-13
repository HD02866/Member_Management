'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { ApiClient } from '../../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Badge } from '../../../../components/ui/Badge';
import { Modal } from '../../../../components/ui/Modal';
import { LoadingSkeleton } from '../../../../components/ui/LoadingSkeleton';
import {
  Shield,
  Building,
  Users,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  Settings,
  Layers,
  ArrowLeft,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  QrCode,
  Save,
  Clock,
  UserPlus,
  Palette,
  Sliders,
  Hash,
} from 'lucide-react';

interface OrgDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrganizationDetailPage({ params }: OrgDetailPageProps) {
  const resolvedParams = use(params);
  const identifier = resolvedParams.id;
  const router = useRouter();
  const { user } = useAuth();

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'staff' | 'branding' | 'card' | 'features' | 'audit'
  >('overview');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Config Form State
  const [configName, setConfigName] = useState('');
  const [configSlug, setConfigSlug] = useState('');
  const [configEmail, setConfigEmail] = useState('');
  const [configPhone, setConfigPhone] = useState('');
  const [configCurrency, setConfigCurrency] = useState('USD');

  // Branding Form State
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#059669');
  const [secondaryColor, setSecondaryColor] = useState('#0284c7');
  const [accentColor, setAccentColor] = useState('#d97706');
  const [navbarMode, setNavbarMode] = useState<'ORGANIZATION_ONLY' | 'CO_BRANDED' | 'WAANOFII_ONLY'>('CO_BRANDED');

  // Digital Card Template State
  const [cardTemplateStyle, setCardTemplateStyle] = useState('MODERN');
  const [cardPrimaryColor, setCardPrimaryColor] = useState('#0f172a');
  const [cardSecondaryColor, setCardSecondaryColor] = useState('#059669');
  const [cardTextColor, setCardTextColor] = useState('#ffffff');
  const [cardShowLogo, setCardShowLogo] = useState(true);
  const [cardShowQr, setCardShowQr] = useState(true);
  const [cardShowBarcode, setCardShowBarcode] = useState(false);

  // Features Form State
  const [features, setFeatures] = useState<Record<string, string>>({
    digital_cards: 'INHERIT',
    payments: 'INHERIT',
    announcements: 'INHERIT',
    programs: 'INHERIT',
    benefits: 'INHERIT',
    custom_domain: 'INHERIT',
    sms_notifications: 'INHERIT',
  });
  const [maxMembersQuota, setMaxMembersQuota] = useState('');

  // Staff Assignment Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [assignUserEmail, setAssignUserEmail] = useState('');
  const [assignRoleCode, setAssignRoleCode] = useState('ORG_ADMIN');

  const loadOrgDetail = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await ApiClient.get(`/platform/organizations/${identifier}`);
      setOrg(data);

      // Populate config form
      setConfigName(data.name || '');
      setConfigSlug(data.slug || '');
      setConfigEmail(data.contactEmail || '');
      setConfigPhone(data.contactPhone || '');
      setConfigCurrency(data.currency || 'USD');

      // Populate branding
      const branding = data.profile?.brandingConfig || {};
      setLogoUrl(data.profile?.logoUrl || branding.logoUrl || '');
      setPrimaryColor(branding.primaryColor || '#059669');
      setSecondaryColor(branding.secondaryColor || '#0284c7');
      setAccentColor(branding.accentColor || '#d97706');
      setNavbarMode(branding.navbarMode || 'CO_BRANDED');

      // Populate card template
      const ct = branding.cardTemplate || {};
      setCardTemplateStyle(ct.templateStyle || 'MODERN');
      setCardPrimaryColor(ct.primaryColor || '#0f172a');
      setCardSecondaryColor(ct.secondaryColor || '#059669');
      setCardTextColor(ct.textColor || '#ffffff');
      setCardShowLogo(ct.showLogo !== false);
      setCardShowQr(ct.showQrCode !== false);
      setCardShowBarcode(ct.showBarcode === true);

      // Populate feature overrides
      const overrides = branding.featureOverrides || {};
      const newFeaturesState: Record<string, string> = {
        digital_cards: 'INHERIT',
        payments: 'INHERIT',
        announcements: 'INHERIT',
        programs: 'INHERIT',
        benefits: 'INHERIT',
        custom_domain: 'INHERIT',
        sms_notifications: 'INHERIT',
      };
      for (const key of Object.keys(newFeaturesState)) {
        if (overrides[key] === true) newFeaturesState[key] = 'ENABLED';
        else if (overrides[key] === false) newFeaturesState[key] = 'DISABLED';
      }
      setFeatures(newFeaturesState);

      const quotas = branding.quotas || {};
      setMaxMembersQuota(quotas.maxMembers ? String(quotas.maxMembers) : '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadOrgDetail();
    }
  }, [user, loadOrgDetail]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch(`/platform/organizations/${identifier}`, {
        name: configName.trim(),
        slug: configSlug.trim().toLowerCase(),
        contactEmail: configEmail.trim(),
        contactPhone: configPhone.trim() || undefined,
        currency: configCurrency.trim().toUpperCase(),
      });
      setSuccessMsg('Organization configuration successfully updated');
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update organization configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch(`/platform/organizations/${identifier}/status`, {
        status: newStatus,
      });
      setSuccessMsg(`Organization status successfully updated to ${newStatus}`);
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update organization status');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch(`/platform/organizations/${identifier}/branding`, {
        logoUrl: logoUrl.trim() || undefined,
        primaryColor,
        secondaryColor,
        accentColor,
        navbarMode,
      });
      setSuccessMsg('Branding and website customization saved');
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCardTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch(`/platform/organizations/${identifier}/branding`, {
        cardTemplate: {
          templateStyle: cardTemplateStyle,
          primaryColor: cardPrimaryColor,
          secondaryColor: cardSecondaryColor,
          textColor: cardTextColor,
          showLogo: cardShowLogo,
          showQrCode: cardShowQr,
          showBarcode: cardShowBarcode,
        },
      });
      setSuccessMsg('Digital Card template customization saved');
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save card template');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeatures = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const overrides: Record<string, boolean> = {};
      for (const [key, state] of Object.entries(features)) {
        if (state === 'ENABLED') overrides[key] = true;
        if (state === 'DISABLED') overrides[key] = false;
      }

      const quotas: Record<string, number> = {};
      if (maxMembersQuota.trim() && !isNaN(parseInt(maxMembersQuota, 10))) {
        quotas.maxMembers = parseInt(maxMembersQuota, 10);
      }

      await ApiClient.patch(`/platform/organizations/${identifier}/features`, {
        featureOverrides: overrides,
        quotas,
      });
      setSuccessMsg('Feature overrides and quotas successfully applied');
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save feature overrides');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.post(`/platform/organizations/${identifier}/staff`, {
        userEmail: assignUserEmail.trim().toLowerCase(),
        roleCode: assignRoleCode,
      });
      setSuccessMsg(`Staff member assigned successfully`);
      setIsStaffModalOpen(false);
      setAssignUserEmail('');
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to revoke this staff member role?')) return;
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.delete(`/platform/organizations/${identifier}/staff/${staffId}`);
      setSuccessMsg('Staff member role revoked');
      loadOrgDetail();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to revoke staff membership');
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
          Platform administrator privileges required to view organization management.
        </p>
      </div>
    );
  }

  if (loading || !org) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <LoadingSkeleton variant="title" />
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="space-y-1">
          <Link
            href="/admin/organizations"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Organizations Directory
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white">
              {org.name}
            </h1>
            <Badge
              variant={
                org.status === 'ACTIVE'
                  ? 'success'
                  : org.status === 'SUSPENDED'
                  ? 'warning'
                  : org.status === 'ONBOARDING'
                  ? 'info'
                  : 'neutral'
              }
            >
              {org.status}
            </Badge>
          </div>
          <p className="text-xs text-surface-500">
            Tenant ID: <span className="font-mono">{org.id}</span> · Slug: <strong className="font-mono">@{org.slug}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/org/${org.slug}`} target="_blank">
            <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Public Portal
            </Button>
          </Link>
          {org.status !== 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={() => handleUpdateStatus('ACTIVE')}
              disabled={saving}
            >
              Activate
            </Button>
          )}
          {org.status !== 'SUSPENDED' && (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              onClick={() => handleUpdateStatus('SUSPENDED')}
              disabled={saving}
            >
              Suspend
            </Button>
          )}
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

      {/* Detail Navigation Tabs */}
      <div className="flex border-b border-surface-200 dark:border-surface-800 space-x-1 sm:space-x-4 overflow-x-auto pb-px">
        {[
          { key: 'overview', label: 'Overview & Config', icon: Building },
          { key: 'staff', label: `Staff & Roles (${org.staffMemberships?.length ?? 0})`, icon: Users },
          { key: 'branding', label: 'Branding & Website', icon: Palette },
          { key: 'card', label: 'Card Template', icon: CreditCard },
          { key: 'features', label: 'Features & Quotas', icon: Sliders },
          { key: 'audit', label: 'Audit History', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-surface-500 hover:text-surface-900 dark:hover:text-surface-100 hover:border-surface-300 dark:hover:border-surface-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & CONFIG */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <CardTitle className="text-base mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                Organization Core Settings
              </CardTitle>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Organization Name"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    required
                  />
                  <Input
                    label="Slug (URL identifier)"
                    value={configSlug}
                    onChange={(e) => setConfigSlug(e.target.value)}
                    required
                  />
                  <Input
                    label="Contact Email"
                    type="email"
                    value={configEmail}
                    onChange={(e) => setConfigEmail(e.target.value)}
                    required
                  />
                  <Input
                    label="Contact Phone"
                    value={configPhone}
                    onChange={(e) => setConfigPhone(e.target.value)}
                  />
                  <Input
                    label="Default Currency"
                    value={configCurrency}
                    onChange={(e) => setConfigCurrency(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" disabled={saving} leftIcon={<Save className="w-4 h-4" />}>
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Subscription & Entitlement Info */}
            <Card className="p-6">
              <CardTitle className="text-base mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                SaaS Subscription & Capacity
              </CardTitle>
              {org.subscription ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                    <div>
                      <p className="font-bold text-surface-900 dark:text-white text-sm">
                        {org.subscription.plan.name} Tier
                      </p>
                      <p className="text-xs text-surface-500">
                        Status: <strong className="text-emerald-600">{org.subscription.status}</strong> · Price: ${org.subscription.plan.price}/mo
                      </p>
                    </div>
                    <Badge variant="success">{org.subscription.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-surface-600 dark:text-surface-300">
                    <div className="p-3 rounded-lg border border-surface-200 dark:border-surface-800">
                      <p className="text-surface-400">Max Members</p>
                      <p className="font-bold text-base mt-0.5">{org.subscription.plan.maxMembers.toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-surface-200 dark:border-surface-800">
                      <p className="text-surface-400">Max Staff</p>
                      <p className="font-bold text-base mt-0.5">{org.subscription.plan.maxStaff}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-surface-200 dark:border-surface-800">
                      <p className="text-surface-400">Current Usage</p>
                      <p className="font-bold text-base mt-0.5">{org.usage?.memberCount ?? 0} Members</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-surface-500">No active SaaS subscription assigned.</p>
              )}
            </Card>
          </div>

          {/* Quick Metrics Sidebar */}
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <h3 className="font-bold text-sm text-surface-900 dark:text-white uppercase tracking-wider">
                Tenant Footprint
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" /> Members
                  </span>
                  <span className="font-bold text-surface-900 dark:text-white">
                    {org.usage?.memberCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-500" /> Staff
                  </span>
                  <span className="font-bold text-surface-900 dark:text-white">
                    {org.usage?.staffCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-brand-500" /> Digital Cards
                  </span>
                  <span className="font-bold text-surface-900 dark:text-white">
                    {org.usage?.cardsCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-surface-100 dark:border-surface-800">
                  <span className="text-surface-500 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Created
                  </span>
                  <span className="text-xs text-surface-600 dark:text-surface-400">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF & ROLES */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                Assigned Organization Staff ({org.staffMemberships?.length ?? 0})
              </h3>
              <p className="text-xs text-surface-500">
                Staff members hold administrative privileges inside this specific tenant.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => setIsStaffModalOpen(true)}
            >
              Assign Staff Member
            </Button>
          </div>

          {(!org.staffMemberships || org.staffMemberships.length === 0) ? (
            <Card className="p-8 text-center text-sm text-surface-500">
              No staff members assigned to this organization. Click "Assign Staff Member" to grant administrative access.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Assigned Date</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {org.staffMemberships.map((sm: any) => (
                    <tr key={sm.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                      <td className="px-5 py-3.5 font-medium text-surface-900 dark:text-white">
                        {sm.user?.firstName} {sm.user?.lastName}
                      </td>
                      <td className="px-5 py-3.5 text-surface-500 text-xs">
                        {sm.user?.email || sm.user?.phoneNumber || 'N/A'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="neutral" className="font-mono text-xs">
                          {sm.role?.name || sm.role?.code}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-surface-400">
                        {new Date(sm.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5"
                          onClick={() => handleRevokeStaff(sm.id)}
                          title="Revoke Staff Role"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Modal to assign staff */}
          <Modal
            isOpen={isStaffModalOpen}
            onClose={() => setIsStaffModalOpen(false)}
            title="Assign Staff Member"
            description={`Grant staff administration permissions for ${org.name}`}
          >
            <form onSubmit={handleAssignStaff} className="space-y-4">
              <Input
                label="User Email Address"
                placeholder="staff.member@example.com"
                type="email"
                value={assignUserEmail}
                onChange={(e) => setAssignUserEmail(e.target.value)}
                required
              />
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Staff Role
                </label>
                <select
                  value={assignRoleCode}
                  onChange={(e) => setAssignRoleCode(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ORG_ADMIN">Organization Administrator (Full Org Access)</option>
                  <option value="FINANCE_ADMIN">Finance & Payments Admin</option>
                  <option value="MEMBERSHIP_ADMIN">Membership & Roster Admin</option>
                  <option value="CONTENT_ADMIN">Content & Announcements Admin</option>
                  <option value="SUPPORT_STAFF">Support Staff</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setIsStaffModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Assigning...' : 'Assign Staff'}
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* TAB 3: BRANDING & WEBSITE */}
      {activeTab === 'branding' && (
        <div className="max-w-3xl space-y-6">
          <Card className="p-6">
            <CardTitle className="text-base mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4 text-indigo-500" />
              Tenant Branding & Navbar Mode
            </CardTitle>
            <p className="text-xs text-surface-500 mb-6">
              Customize how this organization appears to its members and in public pages.
            </p>

            <form onSubmit={handleSaveBranding} className="space-y-5">
              <Input
                label="Organization Logo URL"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Navbar Branding Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'ORGANIZATION_ONLY',
                      label: 'Organization Only',
                      desc: 'Displays only the tenant logo and name.',
                    },
                    {
                      id: 'CO_BRANDED',
                      label: 'Co-Branded (Default)',
                      desc: 'Displays tenant logo + "powered by WaanOfii".',
                    },
                    {
                      id: 'WAANOFII_ONLY',
                      label: 'WaanOfii Only',
                      desc: 'Displays standard platform WaanOfii branding.',
                    },
                  ].map((mode) => (
                    <label
                      key={mode.id}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        navbarMode === mode.id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="navbarMode"
                        value={mode.id}
                        checked={navbarMode === mode.id}
                        onChange={() => setNavbarMode(mode.id as any)}
                        className="sr-only"
                      />
                      <div className="font-bold text-surface-900 dark:text-white mb-1">
                        {mode.label}
                      </div>
                      <div className="text-surface-500 leading-relaxed">{mode.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <Button type="submit" variant="primary" disabled={saving} leftIcon={<Save className="w-4 h-4" />}>
                  {saving ? 'Saving...' : 'Save Branding'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 4: DIGITAL CARD TEMPLATE */}
      {activeTab === 'card' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Card Template Configuration Controls */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="p-6">
              <CardTitle className="text-base mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                Digital Membership Card Template
              </CardTitle>
              <p className="text-xs text-surface-500 mb-6">
                Design the visual appearance and layout of membership cards issued by this tenant.
              </p>

              <form onSubmit={handleSaveCardTemplate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Template Visual Style
                  </label>
                  <select
                    value={cardTemplateStyle}
                    onChange={(e) => setCardTemplateStyle(e.target.value)}
                    className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="MODERN">Modern Emerald (Gradient Glow)</option>
                    <option value="CLASSIC">Classic Corporate (Dark Navy)</option>
                    <option value="MINIMAL">Minimalist Monochrome</option>
                    <option value="VIBRANT">Vibrant Ruby & Gold</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Card Base Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={cardPrimaryColor}
                        onChange={(e) => setCardPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={cardPrimaryColor}
                        onChange={(e) => setCardPrimaryColor(e.target.value)}
                        className="font-mono text-xs py-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Accent Gradient
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={cardSecondaryColor}
                        onChange={(e) => setCardSecondaryColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={cardSecondaryColor}
                        onChange={(e) => setCardSecondaryColor(e.target.value)}
                        className="font-mono text-xs py-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Text Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={cardTextColor}
                        onChange={(e) => setCardTextColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={cardTextColor}
                        onChange={(e) => setCardTextColor(e.target.value)}
                        className="font-mono text-xs py-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-surface-100 dark:border-surface-800 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardShowLogo}
                      onChange={(e) => setCardShowLogo(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Include Organization Logo on card</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardShowQr}
                      onChange={(e) => setCardShowQr(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Include Verification QR Code on front</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardShowBarcode}
                      onChange={(e) => setCardShowBarcode(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Include 1D Barcode</span>
                  </label>
                </div>

                <div className="flex justify-end pt-3">
                  <Button type="submit" variant="primary" disabled={saving} leftIcon={<Save className="w-4 h-4" />}>
                    {saving ? 'Saving...' : 'Save Card Template'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Live Interactive Preview Card */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <div className="text-center mb-3">
              <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                Live Interactive Preview
              </span>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl shadow-2xl p-6 flex flex-col justify-between aspect-[1.586/1] min-h-[260px] max-w-md mx-auto w-full transition-all"
              style={{
                backgroundColor: cardPrimaryColor,
                color: cardTextColor,
                border: `1px solid ${cardSecondaryColor}55`,
              }}
            >
              {/* Background gradient element */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-2xl pointer-events-none opacity-40"
                style={{ backgroundColor: cardSecondaryColor }}
              />

              {/* Card Header */}
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  {cardShowLogo && (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner"
                      style={{ backgroundColor: cardSecondaryColor }}
                    >
                      {org.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-sm tracking-wide leading-tight">{org.name}</h3>
                    <p className="text-[11px] opacity-80">Digital Membership ID</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white">
                  ACTIVE
                </span>
              </div>

              {/* Card Body */}
              <div className="relative z-10 my-auto flex items-center justify-between py-2">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider opacity-70 font-mono">Member Name</p>
                  <p className="font-semibold text-lg tracking-tight">John Doe</p>
                  <div className="flex items-center space-x-3 pt-1 text-xs opacity-80">
                    <span className="flex items-center gap-1 font-mono">
                      <Hash className="w-3.5 h-3.5" />
                      MEM-0001
                    </span>
                    <span>•</span>
                    <span>Regular Member</span>
                  </div>
                </div>

                {cardShowQr && (
                  <div className="bg-white p-2 rounded-xl shadow-lg text-slate-900 flex flex-col items-center">
                    <div className="w-14 h-14 bg-slate-950 p-1 rounded flex items-center justify-center">
                      <QrCode className="w-12 h-12 text-white" />
                    </div>
                    <span className="text-[8px] font-mono font-bold text-slate-600 mt-0.5 uppercase">
                      VERIFIED
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="relative z-10 pt-2 border-t border-white/20 flex items-end justify-between text-[11px] opacity-80">
                <div>
                  <p className="text-[9px] uppercase tracking-wider font-mono">Card ID</p>
                  <p className="font-mono font-semibold tracking-wider">CRD-84920481</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider font-mono">Valid Through</p>
                  <p className="font-mono font-semibold">Dec 31, 2027</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FEATURES & ENTITLEMENTS OVERRIDES */}
      {activeTab === 'features' && (
        <div className="max-w-3xl space-y-6">
          <Card className="p-6">
            <CardTitle className="text-base mb-2 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              Tenant Feature Overrides & Quotas
            </CardTitle>
            <p className="text-xs text-surface-500 mb-6">
              Platform Admins can force-enable or force-disable specific features for this tenant regardless of their SaaS plan.
            </p>

            <form onSubmit={handleSaveFeatures} className="space-y-6">
              <div className="space-y-3">
                {[
                  { key: 'digital_cards', name: 'Digital ID Cards & Token Rotation' },
                  { key: 'payments', name: 'Online Payments & Verification' },
                  { key: 'announcements', name: 'Announcements & CMS Publishing' },
                  { key: 'programs', name: 'Programs & Events Registration' },
                  { key: 'benefits', name: 'Member Benefits & Perks Directory' },
                  { key: 'custom_domain', name: 'Custom Domain Mapping' },
                  { key: 'sms_notifications', name: 'SMS Notifications' },
                ].map((feat) => (
                  <div
                    key={feat.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-surface-800 gap-2"
                  >
                    <div>
                      <p className="font-semibold text-sm text-surface-900 dark:text-white">{feat.name}</p>
                      <p className="text-[11px] font-mono text-surface-400">{feat.key}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {['INHERIT', 'ENABLED', 'DISABLED'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFeatures((prev) => ({ ...prev, [feat.key]: opt }))}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                            features[feat.key] === opt
                              ? opt === 'ENABLED'
                                ? 'bg-emerald-600 text-white'
                                : opt === 'DISABLED'
                                ? 'bg-rose-600 text-white'
                                : 'bg-surface-800 text-white dark:bg-surface-200 dark:text-surface-900'
                              : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Quota Override */}
              <div className="pt-4 border-t border-surface-100 dark:border-surface-800">
                <h4 className="text-sm font-bold text-surface-900 dark:text-white mb-2">
                  Custom Quota Overrides
                </h4>
                <div className="max-w-xs">
                  <Input
                    label="Override Max Members Limit"
                    type="number"
                    placeholder="Leave blank to use Plan limit"
                    value={maxMembersQuota}
                    onChange={(e) => setMaxMembersQuota(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <Button type="submit" variant="primary" disabled={saving} leftIcon={<Save className="w-4 h-4" />}>
                  {saving ? 'Saving...' : 'Apply Feature Overrides'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 6: AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Tenant Audit Trail
          </h3>

          {(!org.recentAuditLogs || org.recentAuditLogs.length === 0) ? (
            <Card className="p-8 text-center text-sm text-surface-500">
              No audit logs recorded specifically for this tenant yet.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {org.recentAuditLogs.map((log: any) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-surface-900 dark:text-white font-mono text-xs">
                          {log.action}
                        </span>
                        <Badge variant="neutral" className="text-[10px]">
                          {log.entityType}
                        </Badge>
                      </div>
                      <p className="text-xs text-surface-500">
                        Actor: {log.actorUser ? `${log.actorUser.firstName} ${log.actorUser.lastName}` : 'System'}
                        {log.entityId && ` · ID: ${log.entityId}`}
                      </p>
                    </div>
                    <div className="text-xs text-surface-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
