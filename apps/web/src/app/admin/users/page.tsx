'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Shield,
  Users,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  Building,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

interface PlatformUserAffiliation {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface PlatformUserItem {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  status: string;
  isPlatformAdmin: boolean;
  createdAt: string;
  memberProfiles: Array<{
    id: string;
    status: string;
    memberNumber: string;
    organization: PlatformUserAffiliation;
  }>;
  staffMemberships: Array<{
    id: string;
    role: {
      name: string;
      code: string;
    };
    organization: PlatformUserAffiliation;
  }>;
}

interface UsersApiResponse {
  users: PlatformUserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PlatformUsersPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState<PlatformUserItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // New User Form State
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsPlatformAdmin, setNewIsPlatformAdmin] = useState(false);

  const loadUsers = useCallback(async () => {
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

      const res = await ApiClient.get<UsersApiResponse>(
        `/platform/users?${queryParams.toString()}`,
      );

      if (res && Array.isArray(res.users)) {
        setUsers(res.users);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
      } else if (Array.isArray(res)) {
        setUsers(res);
        setTotalCount(res.length);
        setTotalPages(1);
      } else {
        setUsers([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load global platform users');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, currentPage]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadUsers();
    }
  }, [user, loadUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadUsers();
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.post('/platform/users', {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        email: newEmail.trim() || undefined,
        phoneNumber: newPhone.trim() || undefined,
        password: newPassword,
        isPlatformAdmin: newIsPlatformAdmin,
      });

      setSuccessMsg('Global platform user account created successfully');
      setIsCreateModalOpen(false);
      // Reset form
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewIsPlatformAdmin(false);

      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create platform user');
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
          Platform administrator privileges required to view the Global Users Directory.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Identity & Access
            </span>
            <span className="text-xs text-surface-400">Total: {totalCount} Platform Users</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
            Global Users Directory
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Global identities across all tenants, membership affiliations, staff roles, and platform administrator flags.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create Platform User
        </Button>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5">
          {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
            <button
              key={st}
              onClick={() => handleStatusFilterChange(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              {st === 'ALL' ? 'All Users' : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <Input
            placeholder="Search by name, email, phone..."
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

      {/* Users Table */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No users matched your query. Use Create Platform User to register a new user."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">User Identity</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Role & Status</th>
                  <th className="px-5 py-3 font-semibold">Multi-Tenant Affiliations</th>
                  <th className="px-5 py-3 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-surface-900 dark:text-white">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="text-[11px] font-mono text-surface-400">ID: {u.id.slice(0, 8)}...</div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-500 space-y-0.5">
                      {u.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-surface-400" />
                          <span>{u.email}</span>
                        </div>
                      )}
                      {u.phoneNumber && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-surface-400" />
                          <span>{u.phoneNumber}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={u.status === 'ACTIVE' ? 'success' : 'neutral'}>
                          {u.status}
                        </Badge>
                        {u.isPlatformAdmin && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Platform Admin
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-500">
                      <div className="space-y-1 max-w-xs">
                        {u.staffMemberships && u.staffMemberships.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
                              Staff:
                            </span>
                            {u.staffMemberships.map((sm) => (
                              <span
                                key={sm.id}
                                className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-[11px]"
                                title={`${sm.role.name} at ${sm.organization.name}`}
                              >
                                {sm.organization.name} ({sm.role.code})
                              </span>
                            ))}
                          </div>
                        )}
                        {u.memberProfiles && u.memberProfiles.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                              Member:
                            </span>
                            {u.memberProfiles.map((mp) => (
                              <span
                                key={mp.id}
                                className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-[11px]"
                              >
                                {mp.organization.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {(!u.staffMemberships?.length && !u.memberProfiles?.length) && (
                          <span className="text-surface-400 italic">No tenant affiliations</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-400 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-surface-200 dark:border-surface-800 text-sm">
              <span className="text-surface-500 text-xs">
                Page {currentPage} of {totalPages} ({totalCount} total users)
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
        </Card>
      )}

      {/* Modal: Create Platform User */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Global User Account"
        description="Provision a global identity on the WaanOfii platform"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              required
            />
            <Input
              label="Last Name"
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              required
            />
          </div>

          <Input
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />

          <Input
            label="Phone Number"
            placeholder="+251911234567"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            hint="Must be at least 8 characters"
          />

          <div className="p-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsPlatformAdmin}
                onChange={(e) => setNewIsPlatformAdmin(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div className="space-y-0.5 text-xs">
                <span className="font-bold text-surface-900 dark:text-white">
                  Grant Platform Administrator Privileges
                </span>
                <p className="text-surface-500 leading-relaxed">
                  Platform Admins have global administrative control across all organizations and SaaS plans.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800 sticky bottom-0 bg-white dark:bg-surface-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 z-10">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Creating User...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
