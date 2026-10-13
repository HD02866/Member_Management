'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Shield,
  Building,
  Users,
  CheckCircle,
  PauseCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Search,
  Plus,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface PlatformOrganizationItem {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'ONBOARDING' | 'SUSPENDED' | 'DEACTIVATED';
  contactEmail: string;
  contactPhone?: string | null;
  currency: string;
  createdAt: string;
  _count?: {
    memberProfiles: number;
    staffMemberships: number;
  };
  subscription?: {
    id: string;
    status: string;
    plan: {
      name: string;
      code: string;
    };
  } | null;
}

interface OrganizationsApiResponse {
  organizations: PlatformOrganizationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminOrganizationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  const [organizations, setOrganizations] = useState<PlatformOrganizationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams();
      if (searchTerm.trim()) {
        queryParams.set('search', searchTerm.trim());
      }
      if (selectedStatus !== 'ALL') {
        queryParams.set('status', selectedStatus);
      }
      queryParams.set('page', currentPage.toString());
      queryParams.set('limit', '15');

      const res = await ApiClient.get<OrganizationsApiResponse>(
        `/platform/organizations?${queryParams.toString()}`,
      );

      if (res && Array.isArray(res.organizations)) {
        setOrganizations(res.organizations);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
      } else if (Array.isArray(res)) {
        // Fallback if returned as raw array
        setOrganizations(res);
        setTotalCount(res.length);
        setTotalPages(1);
      } else {
        setOrganizations([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load platform organizations');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, currentPage]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadOrganizations();
    }
  }, [user, loadOrganizations]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadOrganizations();
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const handleUpdateStatus = async (identifier: string, newStatus: string) => {
    setUpdatingId(identifier);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.patch(`/platform/organizations/${identifier}/status`, {
        status: newStatus,
      });
      setSuccessMsg(`Organization status successfully updated to ${newStatus}`);
      loadOrganizations();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update organization status');
    } finally {
      setUpdatingId(null);
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
          Platform administrator privileges required to view the Organizations directory.
        </p>
      </div>
    );
  }

  const statusTabs = [
    { label: 'All Tenants', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Onboarding', value: 'ONBOARDING' },
    { label: 'Suspended', value: 'SUSPENDED' },
    { label: 'Deactivated', value: 'DEACTIVATED' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Tenants & Multi-Tenancy
            </span>
            <span className="text-xs text-surface-400">Total: {totalCount} Organizations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
            Platform Organizations
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Inspect all customer tenants, lifecycle statuses, staff rosters, branding, and entitlement overrides.
          </p>
        </div>

        <Link href="/admin/onboard">
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
            Onboard New Organization
          </Button>
        </Link>
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

      {/* Filters & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusFilterChange(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === tab.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <Input
            placeholder="Search by name, slug, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-surface-400" />}
            className="py-1.5 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {/* Organization List */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : organizations.length === 0 ? (
        <EmptyState
          title="No organizations found"
          description={
            searchTerm || selectedStatus !== 'ALL'
              ? 'No tenants match the specified search query or lifecycle filter.'
              : 'No organizations currently exist on the platform. Click Onboard New Organization to create one.'
          }
        />
      ) : (
        <div className="space-y-4">
          {organizations.map((org) => {
            const isBusy = updatingId === org.id || updatingId === org.slug;

            return (
              <Card
                key={org.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-indigo-200 dark:hover:border-indigo-900 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/admin/organizations/${org.slug || org.id}`}
                      className="text-lg font-bold text-surface-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {org.name}
                    </Link>
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
                    {org.subscription?.plan && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {org.subscription.plan.name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-surface-500">
                    <span>
                      Slug: <strong className="text-surface-700 dark:text-surface-300 font-mono">@{org.slug}</strong>
                    </span>
                    <span>Email: {org.contactEmail}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      {org._count?.memberProfiles ?? 0} members · {org._count?.staffMemberships ?? 0} staff
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Created {new Date(org.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Right Side: Navigation & Lifecycle Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-surface-100 dark:border-surface-800">
                  {/* Deep Detail Button */}
                  <Link href={`/admin/organizations/${org.slug || org.id}`}>
                    <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Manage Tenant
                    </Button>
                  </Link>

                  {/* Public Org Link */}
                  <Link href={`/org/${org.slug}`} target="_blank">
                    <Button size="sm" variant="ghost" title="Open Public Page">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>

                  {/* Lifecycle State Actions */}
                  {org.status !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      onClick={() => handleUpdateStatus(org.slug, 'ACTIVE')}
                      disabled={isBusy}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Activate
                    </Button>
                  )}

                  {org.status !== 'SUSPENDED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                      onClick={() => handleUpdateStatus(org.slug, 'SUSPENDED')}
                      disabled={isBusy}
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1" />
                      Suspend
                    </Button>
                  )}

                  {org.status !== 'DEACTIVATED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      onClick={() => handleUpdateStatus(org.slug, 'DEACTIVATED')}
                      disabled={isBusy}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Deactivate
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-800 text-sm">
              <span className="text-surface-500 text-xs">
                Page {currentPage} of {totalPages} ({totalCount} total organizations)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
