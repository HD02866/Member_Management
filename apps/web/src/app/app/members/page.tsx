'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Users,
  Search,
  Filter,
  User,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  Building2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Slash,
  RotateCcw,
  KeyRound,
  Trash2,
  Edit3,
  FileText,
  Copy,
  Check,
  MapPin,
  Clock,
  AlertTriangle,
  Upload,
  Image,
  Camera,
  UserPlus,
  RefreshCw,
} from 'lucide-react';


interface MemberRosterItem {
  id: string;
  organizationId: string;
  userId?: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  nationalIdNumber?: string | null;
  address?: string | null;
  city?: string | null;
  status: string;
  adminNotes?: string | null;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  joinedAt: string;
  createdAt?: string;
  memberships?: {
    id: string;
    status: string;
    startDate?: string;
    endDate?: string;
    membershipPlan?: {
      id: string;
      name: string;
      code: string;
      price: string | number;
      currency: string;
      billingInterval: string;
    };
  }[];
}

export default function OrganizationMembersPage() {
  const { user, activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [members, setMembers] = useState<MemberRosterItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Modals state
  const [viewMember, setViewMember] = useState<MemberRosterItem | null>(null);
  const [editMember, setEditMember] = useState<MemberRosterItem | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    city: '',
  });

  // Action dialogs
  const [suspendTarget, setSuspendTarget] = useState<MemberRosterItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const [rejectTarget, setRejectTarget] = useState<MemberRosterItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<MemberRosterItem | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [resetTarget, setResetTarget] = useState<MemberRosterItem | null>(null);
  const [temporaryPasswordResult, setTemporaryPasswordResult] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Notes editing in details modal
  const [notesEdit, setNotesEdit] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Digital ID Photo Upload modal state
  const [uploadIdTarget, setUploadIdTarget] = useState<MemberRosterItem | null>(null);
  const [uploadIdFile, setUploadIdFile] = useState<File | null>(null);
  const [uploadIdPreview, setUploadIdPreview] = useState<string | null>(null);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [uploadIdError, setUploadIdError] = useState<string | null>(null);

  // Create User modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    memberNumber: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    city: '',
    roleCode: 'MEMBER',
    membershipPlanId: '',
    initialStatus: 'ACTIVE',
    initialPassword: '',
  });
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{
    email?: string;
    phoneNumber?: string;
    temporaryPassword?: string;
    memberNumber?: string;
  } | null>(null);

  // Detailed record loading for details view
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (activeOrg) {
      loadMembers();
      loadPlans();
    } else {
      setLoading(false);
    }
  }, [activeOrg, isAuthenticated, authLoading]);

  const loadPlans = async () => {
    if (!activeOrg) return;
    try {
      let list: any[] = [];
      try {
        const res = await ApiClient.get(`/memberships/plans`, {
          tenantId: activeOrg.id,
        });
        list = (res as any)?.data || res || [];
      } catch {
        const res = await ApiClient.get(`/organizations/${activeOrg.slug || activeOrg.id}/plans`, {
          tenantId: activeOrg.id,
        });
        list = (res as any)?.data || res || [];
      }
      if (Array.isArray(list)) {
        setAvailablePlans(list);
      }
    } catch {
      // Fallback silently if plans endpoint is different
    }
  };

  const loadMembers = async () => {
    if (!activeOrg) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await ApiClient.request<MemberRosterItem[]>(
        `/organizations/${activeOrg.slug || activeOrg.id}/members`,
        { tenantId: activeOrg.id },
      );
      const list = (res as any).data || res || [];
      setMembers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load organization member roster');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4500);
  };

  // Open Edit Modal
  const openEditModal = (member: MemberRosterItem) => {
    setEditMember(member);
    setEditForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      phoneNumber: member.phoneNumber || '',
      gender: member.gender || '',
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
      address: member.address || '',
      city: member.city || '',
    });
  };

  // Open Details Modal with live deep-fetch from API
  const openDetailsModal = async (member: MemberRosterItem) => {
    setViewMember(member);
    setNotesEdit(member.adminNotes || '');
    setLoadingDetailsId(member.id);
    try {
      const detailed = await ApiClient.get<any>(`/members/admin/${member.id}`, {
        tenantId: activeOrg?.id,
      });
      if (detailed) {
        setViewMember((prev) => (prev?.id === member.id ? { ...prev, ...detailed } : prev));
        if (detailed.adminNotes !== undefined) {
          setNotesEdit(detailed.adminNotes || '');
        }
      }
    } catch {
      // Keep roster record data if deep detail fails
    } finally {
      setLoadingDetailsId(null);
    }
  };

  // Handle Create User Submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setIsCreatingUser(true);
    setCreateUserError(null);
    try {
      const payload: any = {
        firstName: createUserForm.firstName.trim(),
        lastName: createUserForm.lastName.trim(),
        roleCode: createUserForm.roleCode || 'MEMBER',
        initialStatus: createUserForm.initialStatus || 'ACTIVE',
      };
      if (createUserForm.email.trim()) payload.email = createUserForm.email.trim();
      if (createUserForm.phoneNumber.trim()) payload.phoneNumber = createUserForm.phoneNumber.trim();
      if (createUserForm.memberNumber.trim()) payload.memberNumber = createUserForm.memberNumber.trim();
      if (createUserForm.gender) payload.gender = createUserForm.gender;
      if (createUserForm.dateOfBirth) payload.dateOfBirth = createUserForm.dateOfBirth;
      if (createUserForm.address.trim()) payload.address = createUserForm.address.trim();
      if (createUserForm.city.trim()) payload.city = createUserForm.city.trim();
      if (createUserForm.membershipPlanId) payload.membershipPlanId = createUserForm.membershipPlanId;
      if (createUserForm.initialPassword.trim()) payload.initialPassword = createUserForm.initialPassword.trim();

      const res = await ApiClient.post<any>('/members/admin/create-user', payload, {
        tenantId: activeOrg.id,
      });

      const temporaryPassword = res?.temporaryPassword || payload.initialPassword;
      setCreatedUserCredentials({
        email: res?.user?.email || payload.email,
        phoneNumber: res?.user?.phoneNumber || payload.phoneNumber,
        temporaryPassword,
        memberNumber: res?.user?.memberNumber,
      });

      showNotification('New user created and added to organization directory.');
      await loadMembers();
      // Reset form
      setCreateUserForm({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        memberNumber: '',
        gender: '',
        dateOfBirth: '',
        address: '',
        city: '',
        roleCode: 'MEMBER',
        membershipPlanId: '',
        initialStatus: 'ACTIVE',
        initialPassword: '',
      });
    } catch (err: any) {
      setCreateUserError(err.message || 'Failed to create user account');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Handle Approve Member
  const handleApprove = async (memberId: string) => {
    setActionLoading(true);
    try {
      await ApiClient.post(
        `/members/admin/${memberId}/review`,
        { decision: 'APPROVED' },
        { tenantId: activeOrg?.id },
      );
      showNotification('Member registration approved successfully.');
      if (viewMember?.id === memberId) setViewMember(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Member
  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await ApiClient.post(
        `/members/admin/${rejectTarget.id}/review`,
        { decision: 'REJECTED', reason: rejectReason.trim() || undefined },
        { tenantId: activeOrg?.id },
      );
      showNotification('Application rejected successfully.');
      setRejectTarget(null);
      setRejectReason('');
      if (viewMember?.id === rejectTarget.id) setViewMember(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Suspend Member
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      alert('Please provide a reason for suspension.');
      return;
    }
    setActionLoading(true);
    try {
      await ApiClient.post(
        `/members/admin/${suspendTarget.id}/suspend`,
        { reason: suspendReason.trim() },
        { tenantId: activeOrg?.id },
      );
      showNotification('Member account has been suspended and sessions revoked.');
      setSuspendTarget(null);
      setSuspendReason('');
      if (viewMember?.id === suspendTarget.id) setViewMember(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Suspension failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reinstate Member
  const handleReinstate = async (memberId: string) => {
    if (!confirm('Reinstate this member account to ACTIVE status?')) return;
    setActionLoading(true);
    try {
      await ApiClient.post(
        `/members/admin/${memberId}/reinstate`,
        {},
        { tenantId: activeOrg?.id },
      );
      showNotification('Member account reinstated to ACTIVE successfully.');
      if (viewMember?.id === memberId) setViewMember(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Reinstatement failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit Member Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setActionLoading(true);
    try {
      await ApiClient.patch(
        `/members/admin/${editMember.id}`,
        {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          email: editForm.email.trim() || undefined,
          phoneNumber: editForm.phoneNumber.trim() || undefined,
          gender: editForm.gender || undefined,
          dateOfBirth: editForm.dateOfBirth || undefined,
          address: editForm.address.trim() || undefined,
          city: editForm.city.trim() || undefined,
        },
        { tenantId: activeOrg?.id },
      );
      showNotification('Member details updated successfully.');
      setEditMember(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to update member profile');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reset Password Submit
  const handleConfirmResetPassword = async () => {
    if (!resetTarget) return;
    setActionLoading(true);
    try {
      const res = await ApiClient.post<{ success: boolean; temporaryPassword?: string }>(
        `/members/admin/${resetTarget.id}/reset-password`,
        {},
        { tenantId: activeOrg?.id },
      );
      setTemporaryPasswordResult(res.temporaryPassword || 'Reset successfully');
      showNotification('Account password reset. All previous sessions terminated.');
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
      setResetTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete / Revoke Member Submit
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await ApiClient.delete(
        `/members/admin/${deleteTarget.id}`,
        { reason: deleteReason.trim() || undefined },
        { tenantId: activeOrg?.id },
      );
      showNotification('Member profile revoked and removed from organization.');
      setDeleteTarget(null);
      setDeleteReason('');
      if (viewMember?.id === deleteTarget.id) setViewMember(null);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Save Admin Notes
  const handleSaveNotes = async () => {
    if (!viewMember) return;
    setIsSavingNotes(true);
    try {
      await ApiClient.patch(
        `/members/admin/${viewMember.id}/notes`,
        { adminNotes: notesEdit },
        { tenantId: activeOrg?.id },
      );
      showNotification('Internal admin notes updated.');
      viewMember.adminNotes = notesEdit;
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Open Digital ID Photo Upload Modal
  const openUploadIdModal = (member: MemberRosterItem) => {
    setUploadIdTarget(member);
    setUploadIdFile(null);
    setUploadIdPreview(null);
    setUploadIdError(null);
  };

  // Handle file selection and validation
  const handleSelectIdFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadIdError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadIdError('File exceeds 10MB limit. Please choose a smaller image.');
      return;
    }

    // Validate MIME type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setUploadIdError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    setUploadIdFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadIdPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Uploaded Digital ID Photo
  const handleUploadIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadIdTarget || !uploadIdFile) {
      setUploadIdError('Please select an image file to upload.');
      return;
    }

    setIsUploadingId(true);
    setUploadIdError(null);

    try {
      // 1. Upload file to /uploads with purpose MEMBER_PHOTO
      const formData = new FormData();
      formData.append('file', uploadIdFile);
      formData.append('purpose', 'MEMBER_PHOTO');

      const uploadRes = await ApiClient.uploadFile<{ url: string }>(uploadIdFile, {
        tenantId: activeOrg?.id,
        purpose: 'MEMBER_PHOTO',
      });

      const photoUrl = uploadRes?.url;
      if (!photoUrl) {
        throw new Error('Upload succeeded but no file URL was returned.');
      }

      // 2. Associate photoUrl with memberProfile via PATCH /members/admin/:id/digital-id-photo
      await ApiClient.patch(
        `/members/admin/${uploadIdTarget.id}/digital-id-photo`,
        { photoUrl },
        { tenantId: activeOrg?.id },
      );

      showNotification('Digital membership ID photo uploaded and associated successfully.');
      if (viewMember && viewMember.id === uploadIdTarget.id) {
        viewMember.photoUrl = photoUrl;
      }
      setUploadIdTarget(null);
      setUploadIdFile(null);
      setUploadIdPreview(null);
      await loadMembers();
    } catch (err: any) {
      setUploadIdError(err.message || 'Failed to upload digital ID image');
    } finally {
      setIsUploadingId(false);
    }
  };

  // Handle Remove Digital ID Photo
  const handleRemoveIdPhoto = async () => {
    if (!uploadIdTarget) return;
    if (!confirm(`Are you sure you want to remove the digital ID photo for ${uploadIdTarget.firstName} ${uploadIdTarget.lastName}?`)) {
      return;
    }

    setIsUploadingId(true);
    setUploadIdError(null);

    try {
      await ApiClient.delete(
        `/members/admin/${uploadIdTarget.id}/digital-id-photo`,
        { tenantId: activeOrg?.id },
      );

      showNotification('Digital ID photo removed successfully.');
      if (viewMember && viewMember.id === uploadIdTarget.id) {
        viewMember.photoUrl = null;
      }
      setUploadIdTarget(null);
      setUploadIdFile(null);
      setUploadIdPreview(null);
      await loadMembers();
    } catch (err: any) {
      setUploadIdError(err.message || 'Failed to remove digital ID image');
    } finally {
      setIsUploadingId(false);
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

  // Enforce staff/admin authorization
  if (!activeOrg?.isStaff) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Organization administrator or staff privileges required to inspect the member directory.
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

  // Member counts by status
  const pendingCount = members.filter((m) => m.status === 'PENDING_APPROVAL').length;
  const activeCount = members.filter((m) => m.status === 'ACTIVE').length;
  const suspendedCount = members.filter((m) => m.status === 'SUSPENDED').length;

  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase().trim();
    const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      m.memberNumber.toLowerCase().includes(query) ||
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.phoneNumber && m.phoneNumber.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === 'ALL' || m.status.toUpperCase() === statusFilter.toUpperCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-xl animate-fade-in text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              {activeOrg.name}
            </span>
            <span className="text-xs text-surface-400">Owner & Admin Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
            {t('members.rosterTitle', '4Baye Member Directory')}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Manage membership applications, inspect verified details, and control account lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              setCreatedUserCredentials(null);
              setCreateUserError(null);
              setIsCreateUserModalOpen(true);
            }}
          >
            Create User
          </Button>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={loadMembers}
            disabled={loading}
            title="Refresh member directory"
          >
            Refresh
          </Button>

          <Link href="/app/dashboard">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Dashboard
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

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-2xs">
          <div className="text-xs font-medium text-surface-400">Total Members</div>
          <div className="text-2xl font-bold text-surface-900 dark:text-white mt-1">
            {members.length}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 shadow-2xs">
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending Review</div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
            {pendingCount}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-2xs">
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Active Members</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            {activeCount}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 shadow-2xs">
          <div className="text-xs font-medium text-rose-700 dark:text-rose-400">Suspended</div>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
            {suspendedCount}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="max-w-md w-full">
          <Input
            placeholder={t('members.searchPlaceholder', 'Search by name, member number, email...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-surface-400" />}
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'ALL', label: 'All Members', count: members.length },
            { id: 'PENDING_APPROVAL', label: 'Pending', count: pendingCount },
            { id: 'ACTIVE', label: 'Active', count: activeCount },
            { id: 'SUSPENDED', label: 'Suspended', count: suspendedCount },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === st.id
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === st.id
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
                }`}
              >
                {st.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Members Table */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          title={t('common.emptyState', 'No records found')}
          description="No members found matching your search and filter criteria."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-200 dark:border-surface-800 bg-surface-50/70 dark:bg-surface-950/40 text-xs font-semibold uppercase tracking-wider text-surface-500">
                <tr>
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Member ID</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Plan</th>
                  <th className="px-6 py-3.5">Joined Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {filteredMembers.map((m) => {
                  const plan = m.memberships?.[0]?.membershipPlan;
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-50/60 dark:hover:bg-surface-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold text-xs shrink-0 border border-brand-200 dark:border-brand-800">
                            {m.firstName?.[0] || 'M'}
                            {m.lastName?.[0] || ''}
                          </div>
                          <div>
                            <div className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                              <span>
                                {m.firstName} {m.lastName}
                              </span>
                            </div>
                            <div className="text-xs text-surface-400">
                              {m.email || m.phoneNumber || 'No contact on file'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-surface-700 dark:text-surface-300">
                        {m.memberNumber}
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={m.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-surface-600 dark:text-surface-400">
                        {plan?.name ? (
                          <span className="font-medium text-surface-900 dark:text-surface-100">
                            {plan.name}
                          </span>
                        ) : (
                          <span className="text-surface-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-surface-500">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Lifecycle Action: Approve if pending */}
                          {m.status === 'PENDING_APPROVAL' && (
                            <Button
                              size="sm"
                              variant="primary"
                              className="text-xs py-1 px-2.5 h-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={actionLoading}
                              onClick={() => handleApprove(m.id)}
                            >
                              Approve
                            </Button>
                          )}

                          {/* Quick Lifecycle Action: Reinstate if suspended */}
                          {m.status === 'SUSPENDED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs py-1 px-2.5 h-auto text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              disabled={actionLoading}
                              onClick={() => handleReinstate(m.id)}
                            >
                              Reinstate
                            </Button>
                          )}

                          {/* View Details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs py-1 px-2.5 h-auto font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                            onClick={() => openDetailsModal(m)}
                            disabled={loadingDetailsId === m.id}
                          >
                            {loadingDetailsId === m.id ? 'Loading...' : 'Details'}
                          </Button>

                          {/* Edit Member */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs py-1 px-2 h-auto text-surface-500 hover:text-surface-900 dark:hover:text-white"
                            title="Edit Profile"
                            onClick={() => openEditModal(m)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Quick Upload Digital ID */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs py-1 px-2 h-auto text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title={m.photoUrl ? 'Replace Digital ID Image' : 'Upload Digital ID Image'}
                            onClick={() => openUploadIdModal(m)}
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </Button>

                          {/* Delete / Revoke Member */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs py-1 px-2 h-auto text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Revoke / Delete Member"
                            onClick={() => {
                              setDeleteTarget(m);
                              setDeleteReason('');
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. MEMBER DETAILS MODAL                                   */}
      {/* ========================================================= */}
      {viewMember && (
        <Modal
          isOpen={!!viewMember}
          onClose={() => setViewMember(null)}
          title="Member Dossier & Lifecycle Controls"
          maxWidth="lg"
        >
          <div className="space-y-6 pt-2">
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-surface-100 dark:border-surface-800">
              <div className="flex items-center gap-3">
                {viewMember.photoUrl ? (
                  <img
                    src={viewMember.photoUrl}
                    alt={`${viewMember.firstName} ${viewMember.lastName}`}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-brand-300 dark:border-brand-700 shadow-md shrink-0 bg-surface-100"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold text-lg border border-brand-200 dark:border-brand-800 shrink-0">
                    {viewMember.firstName?.[0] || 'M'}
                    {viewMember.lastName?.[0] || ''}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-surface-950 dark:text-white">
                    {viewMember.firstName} {viewMember.lastName}
                  </h3>
                  <p className="text-xs font-mono text-surface-500">
                    Member ID: {viewMember.memberNumber}
                  </p>
                </div>
              </div>

              <div>
                <Badge status={viewMember.status} />
              </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                <span className="text-surface-400 font-medium flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </span>
                <p className="font-semibold text-surface-900 dark:text-white truncate">
                  {viewMember.email || 'N/A'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                <span className="text-surface-400 font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </span>
                <p className="font-semibold text-surface-900 dark:text-white">
                  {viewMember.phoneNumber || 'N/A'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                <span className="text-surface-400 font-medium flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Membership Plan
                </span>
                <p className="font-semibold text-surface-900 dark:text-white truncate">
                  {viewMember.memberships?.[0]?.membershipPlan?.name || 'Standard'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                <span className="text-surface-400 font-medium flex items-center gap-1">
                  <User className="w-3 h-3" /> Gender
                </span>
                <p className="font-semibold text-surface-900 dark:text-white">
                  {viewMember.gender || 'Not specified'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                <span className="text-surface-400 font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> City / Location
                </span>
                <p className="font-semibold text-surface-900 dark:text-white truncate">
                  {viewMember.city || viewMember.address || 'Not specified'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                <span className="text-surface-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Registration Date
                </span>
                <p className="font-semibold text-surface-900 dark:text-white">
                  {new Date(viewMember.joinedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Suspension or Rejection context if present */}
            {viewMember.status === 'SUSPENDED' && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Account Suspended
                </div>
                <p className="text-rose-700 dark:text-rose-300">
                  Reason: {viewMember.suspensionReason || 'Administrative decision'}
                </p>
                {viewMember.suspendedAt && (
                  <p className="text-[11px] text-rose-500">
                    Suspended on {new Date(viewMember.suspendedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Internal Admin Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-surface-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Internal Administrative Notes
              </label>
              <textarea
                value={notesEdit}
                onChange={(e) => setNotesEdit(e.target.value)}
                placeholder="Private administrative observations, verification notes, or audit memos..."
                rows={3}
                className="w-full text-xs p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs py-1 px-3 h-auto"
                  disabled={isSavingNotes}
                  onClick={handleSaveNotes}
                >
                  {isSavingNotes ? 'Saving...' : 'Save Notes'}
                </Button>
              </div>
            </div>

            {/* Lifecycle Operations Bar */}
            <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-surface-500">
                Administrative Lifecycle Actions
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                {/* Approve / Reject */}
                {viewMember.status === 'PENDING_APPROVAL' && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      disabled={actionLoading}
                      onClick={() => handleApprove(viewMember.id)}
                    >
                      Approve Member
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="text-xs"
                      disabled={actionLoading}
                      onClick={() => setRejectTarget(viewMember)}
                    >
                      Reject Application
                    </Button>
                  </>
                )}

                {/* Suspend */}
                {viewMember.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="danger"
                    className="text-xs"
                    disabled={actionLoading}
                    onClick={() => setSuspendTarget(viewMember)}
                  >
                    Suspend Member
                  </Button>
                )}

                {/* Reinstate */}
                {viewMember.status === 'SUSPENDED' && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    disabled={actionLoading}
                    onClick={() => handleReinstate(viewMember.id)}
                  >
                    Reinstate Member
                  </Button>
                )}

                {/* Upload / Replace Digital ID Photo */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    openUploadIdModal(viewMember);
                  }}
                >
                  <Camera className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  {viewMember.photoUrl ? 'Replace Digital ID' : 'Upload Digital ID'}
                </Button>

                {/* Reset Password */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    setResetTarget(viewMember);
                    setTemporaryPasswordResult(null);
                  }}
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1" /> Reset Password
                </Button>


                {/* Edit Details */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    openEditModal(viewMember);
                    setViewMember(null);
                  }}
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Profile
                </Button>

                {/* Revoke / Delete */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 ml-auto"
                  onClick={() => setDeleteTarget(viewMember)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke Access
                </Button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setViewMember(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 2. EDIT MEMBER MODAL                                      */}
      {/* ========================================================= */}
      {editMember && (
        <Modal
          isOpen={!!editMember}
          onClose={() => setEditMember(null)}
          title={`Edit Member: ${editMember.firstName} ${editMember.lastName}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  First Name *
                </label>
                <Input
                  required
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  placeholder="First Name"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  Last Name *
                </label>
                <Input
                  required
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  placeholder="Last Name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  Phone Number
                </label>
                <Input
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  placeholder="+251911234567"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  Gender
                </label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-900 dark:text-white"
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                  City
                </label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="Addis Ababa"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                Physical Address
              </label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Subcity, Woreda, House No."
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-surface-100 dark:border-surface-800 sticky bottom-0 bg-white dark:bg-surface-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 z-10">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditMember(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 3. SUSPEND MEMBER MODAL                                   */}
      {/* ========================================================= */}
      {suspendTarget && (
        <Modal
          isOpen={!!suspendTarget}
          onClose={() => setSuspendTarget(null)}
          title={`Suspend Member Account`}
          maxWidth="sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-surface-600 dark:text-surface-300">
              Suspending <strong>{suspendTarget.firstName} {suspendTarget.lastName}</strong> will immediately terminate all active sessions, block API and web access, and lock membership services.
            </p>
            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                Administrative Suspension Reason *
              </label>
              <textarea
                required
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Specify the policy breach or governance rationale..."
                className="w-full text-xs p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white mt-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSuspendTarget(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmSuspend}
                disabled={actionLoading}
              >
                {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 4. REJECT APPLICATION MODAL                               */}
      {/* ========================================================= */}
      {rejectTarget && (
        <Modal
          isOpen={!!rejectTarget}
          onClose={() => setRejectTarget(null)}
          title="Reject Member Application"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-surface-600 dark:text-surface-300">
              Rejecting <strong>{rejectTarget.firstName} {rejectTarget.lastName}</strong>'s application will decline their registration for 4Baye Association.
            </p>
            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                Rejection Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Criteria not met, invalid documentation, etc..."
                className="w-full text-xs p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white mt-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRejectTarget(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmReject}
                disabled={actionLoading}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 5. RESET PASSWORD MODAL                                   */}
      {/* ========================================================= */}
      {resetTarget && (
        <Modal
          isOpen={!!resetTarget}
          onClose={() => {
            setResetTarget(null);
            setTemporaryPasswordResult(null);
          }}
          title="Administrative Password Reset"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-2">
            {!temporaryPasswordResult ? (
              <>
                <p className="text-xs text-surface-600 dark:text-surface-300">
                  Reset password for <strong>{resetTarget.firstName} {resetTarget.lastName}</strong>. A secure temporary password will be generated, and all existing active sessions will be terminated immediately.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setResetTarget(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmResetPassword}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Generating...' : 'Generate New Password'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <span className="font-bold">Password reset successful!</span> Please share this temporary password with the member over a secure channel.
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
                  <span className="font-mono text-sm font-bold text-surface-900 dark:text-white select-all">
                    {temporaryPasswordResult}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(temporaryPasswordResult);
                      setCopiedPass(true);
                      setTimeout(() => setCopiedPass(false), 2500);
                    }}
                  >
                    {copiedPass ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-surface-400">
                  This temporary password will not be displayed again once closed.
                </p>
                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setResetTarget(null);
                      setTemporaryPasswordResult(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 6. REVOKE / DELETE MEMBER MODAL                           */}
      {/* ========================================================= */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Revoke Member Access & Archive"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-surface-600 dark:text-surface-300">
              Are you sure you want to revoke membership for <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong> ({deleteTarget.memberNumber})? Their profile will be archived and access revoked while preserving historical audit logs.
            </p>
            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                Administrative Revocation Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Reason for revoking membership..."
                className="w-full text-xs p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white mt-1 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
              >
                {actionLoading ? 'Revoking...' : 'Confirm Revocation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 7. UPLOAD / REPLACE DIGITAL ID PHOTO MODAL                */}
      {/* ========================================================= */}
      {uploadIdTarget && (
        <Modal
          isOpen={!!uploadIdTarget}
          onClose={() => {
            setUploadIdTarget(null);
            setUploadIdFile(null);
            setUploadIdPreview(null);
            setUploadIdError(null);
          }}
          title={`Digital Membership ID Photo — ${uploadIdTarget.firstName} ${uploadIdTarget.lastName}`}
          maxWidth="md"
        >
          <form onSubmit={handleUploadIdSubmit} className="space-y-5 pt-2">
            {uploadIdError && (
              <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadIdError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50">
              {/* Existing Photo or Fallback */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                  Current ID
                </span>
                {uploadIdTarget.photoUrl ? (
                  <img
                    src={uploadIdTarget.photoUrl}
                    alt="Current ID"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-400 dark:border-brand-600 shadow-md bg-surface-100"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-surface-200 dark:bg-surface-800 text-surface-500 flex flex-col items-center justify-center text-xs font-bold border border-surface-300 dark:border-surface-700">
                    <User className="w-6 h-6 mb-1 text-surface-400" />
                    <span>None</span>
                  </div>
                )}
                {uploadIdTarget.photoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveIdPhoto}
                    disabled={isUploadingId}
                    className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-medium mt-1 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remove Photo
                  </button>
                )}
              </div>

              {/* Arrow divider */}
              <div className="hidden sm:block text-surface-300 dark:text-surface-600 font-bold text-lg">
                →
              </div>

              {/* New Preview / Dropzone */}
              <div className="flex flex-col items-center gap-2 flex-1 w-full">
                <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                  New Preview
                </span>
                {uploadIdPreview ? (
                  <img
                    src={uploadIdPreview}
                    alt="New Preview"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-lg bg-surface-100"
                  />
                ) : (
                  <label
                    htmlFor="id-photo-input"
                    className="w-full sm:h-20 border-2 border-dashed border-surface-300 dark:border-surface-700 hover:border-brand-500 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer transition-colors bg-white dark:bg-surface-800/40 text-center"
                  >
                    <Upload className="w-5 h-5 text-surface-400 mb-1" />
                    <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
                      Choose ID Image
                    </span>
                    <span className="text-[10px] text-surface-400">
                      JPEG, PNG, or WebP (max 10MB)
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Hidden File Input & File Selector Button */}
            <div>
              <input
                id="id-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleSelectIdFile}
              />
              <div className="flex items-center justify-between text-xs text-surface-500">
                <span>
                  {uploadIdFile ? (
                    <span className="text-surface-900 dark:text-white font-medium">
                      Selected: {uploadIdFile.name} ({(uploadIdFile.size / 1024).toFixed(1)} KB)
                    </span>
                  ) : (
                    'Select a photo from device or camera'
                  )}
                </span>
                <label
                  htmlFor="id-photo-input"
                  className="cursor-pointer text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {uploadIdFile ? 'Change File' : 'Browse Files'}
                </label>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800/50 text-[11px] text-surface-500 space-y-1">
              <p>• <strong>Member Digital ID:</strong> This photo will be rendered on the member's digital membership card and profile.</p>
              <p>• <strong>Privacy & Security:</strong> Photos are protected by organization tenant isolation and accessible only to authorized administrators and the member themselves.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-100 dark:border-surface-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setUploadIdTarget(null);
                  setUploadIdFile(null);
                  setUploadIdPreview(null);
                }}
                disabled={isUploadingId}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isUploadingId || !uploadIdFile}
              >
                {isUploadingId ? 'Uploading ID...' : 'Save & Associate Photo'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 8. CREATE USER MODAL                                      */}
      {/* ========================================================= */}
      {isCreateUserModalOpen && (
        <Modal
          isOpen={isCreateUserModalOpen}
          onClose={() => {
            setIsCreateUserModalOpen(false);
            setCreatedUserCredentials(null);
            setCreateUserError(null);
          }}
          title={createdUserCredentials ? 'User Account Created' : 'Create New User & Member'}
          description={
            createdUserCredentials
              ? 'Account provisioned successfully. Save or transmit the credentials below.'
              : 'Add a new member or staff user directly to this organization.'
          }
          maxWidth="lg"
        >
          {createdUserCredentials ? (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  Account successfully created and linked to organization!
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Please securely deliver these initial credentials to the user. They can sign in immediately at the login portal.
                </p>
              </div>

              <div className="space-y-2.5 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/60 text-xs">
                {createdUserCredentials.email && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-200/60 dark:border-surface-700/60">
                    <span className="text-surface-500 font-medium">Email / Login ID:</span>
                    <span className="font-semibold text-surface-900 dark:text-white font-mono">
                      {createdUserCredentials.email}
                    </span>
                  </div>
                )}
                {createdUserCredentials.phoneNumber && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-200/60 dark:border-surface-700/60">
                    <span className="text-surface-500 font-medium">Phone Number:</span>
                    <span className="font-semibold text-surface-900 dark:text-white font-mono">
                      {createdUserCredentials.phoneNumber}
                    </span>
                  </div>
                )}
                {createdUserCredentials.memberNumber && (
                  <div className="flex items-center justify-between py-1 border-b border-surface-200/60 dark:border-surface-700/60">
                    <span className="text-surface-500 font-medium">Member Number:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {createdUserCredentials.memberNumber}
                    </span>
                  </div>
                )}
                {createdUserCredentials.temporaryPassword && (
                  <div className="flex items-center justify-between py-1.5 bg-white dark:bg-surface-900 p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 mt-2">
                    <div>
                      <span className="text-[11px] text-surface-400 block">Initial / Temporary Password:</span>
                      <span className="font-mono text-sm font-bold text-surface-900 dark:text-white select-all">
                        {createdUserCredentials.temporaryPassword}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(createdUserCredentials.temporaryPassword || '');
                        showNotification('Password copied to clipboard!');
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    setIsCreateUserModalOpen(false);
                    setCreatedUserCredentials(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-4 pt-1">
              {createUserError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createUserError}</span>
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    First Name *
                  </label>
                  <Input
                    required
                    value={createUserForm.firstName}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, firstName: e.target.value })}
                    placeholder="e.g. Tolasa"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Last Name *
                  </label>
                  <Input
                    required
                    value={createUserForm.lastName}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, lastName: e.target.value })}
                    placeholder="e.g. Gemechu"
                  />
                </div>
              </div>

              {/* Contact fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Email Address (Optional)
                  </label>
                  <Input
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Phone Number (Optional)
                  </label>
                  <Input
                    type="tel"
                    value={createUserForm.phoneNumber}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, phoneNumber: e.target.value })}
                    placeholder="+251911000000"
                  />
                </div>
              </div>
              <p className="text-[11px] text-surface-400 -mt-2">
                * At least one contact method (email or phone number) is required for user sign-in.
              </p>

              {/* Member Number & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-surface-100 dark:border-surface-800">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Member ID / Number (Optional)
                  </label>
                  <Input
                    value={createUserForm.memberNumber}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, memberNumber: e.target.value })}
                    placeholder="Auto-generated if left blank"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Account Role
                  </label>
                  <select
                    value={createUserForm.roleCode}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, roleCode: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="MEMBER">Standard Member</option>
                    <option value="ADMIN">Organization Administrator</option>
                    <option value="FINANCE_OFFICER">Finance Officer</option>
                    <option value="VERIFIER">Verifier</option>
                  </select>
                </div>
              </div>

              {/* Membership Plan & Initial Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availablePlans.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                      Membership Plan
                    </label>
                    <select
                      value={createUserForm.membershipPlanId}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, membershipPlanId: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">No Plan Assigned</option>
                      {availablePlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.currency} {p.price})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Initial Member Status
                  </label>
                  <select
                    value={createUserForm.initialStatus}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, initialStatus: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="ACTIVE">Active (Approved immediately)</option>
                    <option value="PENDING_APPROVAL">Pending Review</option>
                  </select>
                </div>
              </div>

              {/* Demographic & Location (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-surface-100 dark:border-surface-800">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Gender
                  </label>
                  <select
                    value={createUserForm.gender}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, gender: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    City
                  </label>
                  <Input
                    value={createUserForm.city}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, city: e.target.value })}
                    placeholder="e.g. Addis Ababa"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Date of Birth
                  </label>
                  <Input
                    type="date"
                    value={createUserForm.dateOfBirth}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, dateOfBirth: e.target.value })}
                  />
                </div>
              </div>

              {/* Password option */}
              <div className="pt-1 border-t border-surface-100 dark:border-surface-800">
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Custom Initial Password (Optional)
                </label>
                <Input
                  type="text"
                  value={createUserForm.initialPassword}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, initialPassword: e.target.value })}
                  placeholder="Leave blank to auto-generate a secure random temporary password"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800 sticky bottom-0 bg-white dark:bg-surface-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 z-10">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  disabled={isCreatingUser}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? 'Creating Account...' : 'Create User & Member'}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

