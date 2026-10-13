'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge, BadgeVariant } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Mail,
  Phone,
  Shield,
  Calendar,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Trash2,
  Edit2,
  User,
} from 'lucide-react';

interface StaffUser {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
}

interface StaffRole {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

interface StaffMembershipItem {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
  user: StaffUser;
  role: StaffRole;
}

const ROLE_COLORS: Record<string, BadgeVariant> = {
  OWNER: 'neutral',
  ADMIN: 'info',
  FINANCE_OFFICER: 'success',
  VERIFIER: 'warning',
};

export default function StaffManagementPage() {
  const { user, activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [staff, setStaff] = useState<StaffMembershipItem[]>([]);
  const [availableRoles, setAvailableRoles] = useState<StaffRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMembershipItem | null>(null);

  // Form states
  const [assignIdentifier, setAssignIdentifier] = useState('');
  const [assignRoleCode, setAssignRoleCode] = useState('ADMIN');
  const [editRoleCode, setEditRoleCode] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadStaffAndRoles = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [staffRes, rolesRes] = await Promise.all([
        ApiClient.request<StaffMembershipItem[]>(
          `/organizations/${activeOrg.slug || activeOrg.id}/staff`,
          { tenantId: activeOrg.id },
        ),
        ApiClient.get<StaffRole[]>('/organizations/roles/available'),
      ]);

      const staffList = (staffRes as any)?.data || staffRes || [];
      const rolesList = (rolesRes as any)?.data || rolesRes || [];

      setStaff(Array.isArray(staffList) ? staffList : []);
      setAvailableRoles(Array.isArray(rolesList) ? rolesList : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load staff roster');
    } finally {
      setLoading(false);
    }
  }, [activeOrg]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (activeOrg) {
      loadStaffAndRoles();
    } else {
      setLoading(false);
    }
  }, [activeOrg, isAuthenticated, authLoading, loadStaffAndRoles, router]);

  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !assignIdentifier.trim()) return;

    setIsSubmitting(true);
    setFormError('');
    try {
      await ApiClient.request(
        `/organizations/${activeOrg.slug || activeOrg.id}/staff`,
        {
          method: 'POST',
          tenantId: activeOrg.id,
          body: JSON.stringify({
            identifier: assignIdentifier.trim(),
            roleCode: assignRoleCode,
          }),
        },
      );
      setSuccessMsg(`Successfully assigned staff member with role ${assignRoleCode}`);
      setIsAssignModalOpen(false);
      setAssignIdentifier('');
      setAssignRoleCode('ADMIN');
      loadStaffAndRoles();
    } catch (err: any) {
      setFormError(err.message || 'Failed to assign staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !selectedStaff) return;

    setIsSubmitting(true);
    setFormError('');
    try {
      await ApiClient.request(
        `/organizations/${activeOrg.slug || activeOrg.id}/staff/${selectedStaff.id}`,
        {
          method: 'PATCH',
          tenantId: activeOrg.id,
          body: JSON.stringify({
            roleCode: editRoleCode,
            isActive: editIsActive,
          }),
        },
      );
      setSuccessMsg('Staff member updated successfully');
      setIsEditModalOpen(false);
      setSelectedStaff(null);
      loadStaffAndRoles();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update staff member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeStaff = async () => {
    if (!activeOrg || !selectedStaff) return;

    setIsSubmitting(true);
    setFormError('');
    try {
      await ApiClient.request(
        `/organizations/${activeOrg.slug || activeOrg.id}/staff/${selectedStaff.id}`,
        {
          method: 'DELETE',
          tenantId: activeOrg.id,
        },
      );
      setSuccessMsg(`Staff privileges revoked for ${selectedStaff.user.firstName} ${selectedStaff.user.lastName}`);
      setIsRevokeModalOpen(false);
      setSelectedStaff(null);
      loadStaffAndRoles();
    } catch (err: any) {
      setFormError(err.message || 'Failed to revoke staff membership');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <LoadingSkeleton variant="title" />
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  // Access check: only Organization Admin or Staff
  if (!activeOrg?.isStaff) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Organization administrator privileges required to access staff assignments.
        </p>
        <div className="pt-4">
          <Link href="/app/dashboard">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const filteredStaff = staff.filter((item) => {
    const query = searchQuery.toLowerCase().trim();
    const fullName = `${item.user.firstName} ${item.user.lastName}`.toLowerCase();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      (item.user.email && item.user.email.toLowerCase().includes(query)) ||
      (item.user.phoneNumber && item.user.phoneNumber.includes(query)) ||
      item.role.name.toLowerCase().includes(query);

    const matchesRole = roleFilter === 'ALL' || item.role.code === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {activeOrg.name}
            </span>
            <span className="text-xs text-surface-400">Administration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
            Staff & Role Assignments
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Manage organization administrators, verifiers, finance officers, and operational staff.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/app/dashboard">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Dashboard
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setFormError('');
              setIsAssignModalOpen(true);
            }}
          >
            Assign Staff Member
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-8">
          <Input
            placeholder="Search staff by name, email, phone, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="sm:col-span-4">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Roles ({staff.length})</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Staff Roster Cards / Table */}
      {filteredStaff.length === 0 ? (
        <EmptyState
          icon={<Shield className="w-12 h-12 text-surface-400" />}
          title="No staff members found"
          description={searchQuery ? 'Try adjusting your search criteria.' : 'Assign the first staff member using the button above.'}
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => setIsAssignModalOpen(true)}
            >
              Assign Staff Member
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((item) => (
            <Card
              key={item.id}
              className="border-surface-200 dark:border-surface-800 hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div
                className={`h-1.5 w-full ${
                  item.role.code === 'OWNER'
                    ? 'bg-purple-500'
                    : item.role.code === 'ADMIN'
                    ? 'bg-blue-500'
                    : item.role.code === 'FINANCE_OFFICER'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-sm">
                      {item.user.firstName[0]}
                      {item.user.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-surface-900 dark:text-white leading-tight">
                        {item.user.firstName} {item.user.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={ROLE_COLORS[item.role.code] || 'info'}>
                          {item.role.name}
                        </Badge>
                        {item.isActive ? (
                          <span className="inline-flex items-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-medium text-surface-400 gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-surface-500">
                  {item.user.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-surface-400" />
                      <span className="truncate">{item.user.email}</span>
                    </div>
                  )}
                  {item.user.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-surface-400" />
                      <span>{item.user.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 shrink-0 text-surface-400" />
                    <span>Assigned {new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-surface-100 dark:border-surface-800 flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Edit2 className="w-3 h-3" />}
                    onClick={() => {
                      setSelectedStaff(item);
                      setEditRoleCode(item.role.code);
                      setEditIsActive(item.isActive);
                      setFormError('');
                      setIsEditModalOpen(true);
                    }}
                  >
                    Edit Role
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    leftIcon={<Trash2 className="w-3 h-3" />}
                    onClick={() => {
                      setSelectedStaff(item);
                      setFormError('');
                      setIsRevokeModalOpen(true);
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Staff Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Staff Member"
      >
        <form onSubmit={handleAssignStaff} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Input
              label="User Email, Phone, or ID"
              placeholder="e.g. aster.finance@4bassociation.org"
              value={assignIdentifier}
              onChange={(e) => setAssignIdentifier(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
              hint="The user must already possess an active registered account in 4Baye."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Role & Responsibility
            </label>
            <select
              value={assignRoleCode}
              onChange={(e) => setAssignRoleCode(e.target.value)}
              className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {availableRoles.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.name} — {r.description || r.code}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-200 dark:border-surface-800 sticky bottom-0 bg-white dark:bg-surface-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 z-10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Staff: ${selectedStaff?.user.firstName} ${selectedStaff?.user.lastName}`}
      >
        <form onSubmit={handleUpdateStaff} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Role
            </label>
            <select
              value={editRoleCode}
              onChange={(e) => setEditRoleCode(e.target.value)}
              className="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {availableRoles.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.name} — {r.description || r.code}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Status
            </label>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="editIsActive"
                  checked={editIsActive}
                  onChange={() => setEditIsActive(true)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="editIsActive"
                  checked={!editIsActive}
                  onChange={() => setEditIsActive(false)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <span>Inactive (Suspended)</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-200 dark:border-surface-800 sticky bottom-0 bg-white dark:bg-surface-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 z-10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Revoke Staff Modal */}
      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Revoke Staff Privileges"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <p className="text-sm text-surface-600 dark:text-surface-300">
            Are you sure you want to revoke staff privileges for{' '}
            <strong className="text-surface-950 dark:text-white">
              {selectedStaff?.user.firstName} {selectedStaff?.user.lastName}
            </strong>
            ? They will lose administrative access to {activeOrg.name}.
          </p>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-200 dark:border-surface-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleRevokeStaff}
            >
              Revoke Privileges
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
