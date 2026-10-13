'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  FileText,
  Bell,
  Plus,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Eye,
  Globe,
  Users2,
  Lock,
  Pin,
  Calendar,
  ExternalLink,
  UploadCloud,
  X,
} from 'lucide-react';

interface AnnouncementItem {
  id: string;
  title: any;
  content: any;
  summary?: string;
  coverImageUrl?: string;
  imageAttachments?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  audience: 'PUBLIC' | 'MEMBERS' | 'STAFF';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPinned: boolean;
  publishedAt: string;
  scheduledAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export default function OrganizationCmsPage() {
  const { user, activeOrg, isLoading: authLoading } = useAuth();
  const { t, localize } = useI18n();

  const [activeTab, setActiveTab] = useState<'profile' | 'announcements'>('announcements');
  const [profile, setProfile] = useState<any>({});
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form & Modal States
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<AnnouncementItem | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formAudience, setFormAudience] = useState<'PUBLIC' | 'MEMBERS' | 'STAFF'>('PUBLIC');
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formCoverImageUrl, setFormCoverImageUrl] = useState('');
  const [formCtaLabel, setFormCtaLabel] = useState('');
  const [formCtaUrl, setFormCtaUrl] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  useEffect(() => {
    if (activeOrg?.id && activeOrg?.isStaff) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [activeOrg?.id, activeOrg?.isStaff]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [profRes, annRes] = await Promise.all([
        ApiClient.request('/cms/profile', { tenantId: activeOrg?.id }),
        ApiClient.request('/cms/announcements?includeDrafts=true', { tenantId: activeOrg?.id }),
      ]);
      setProfile(profRes.data || profRes || {});
      const list = annRes.data || annRes || [];
      setAnnouncements(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load organization CMS data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.request('/cms/profile', {
        method: 'PATCH',
        tenantId: activeOrg?.id,
        body: JSON.stringify(profile),
      });
      setSuccessMsg(t('cms.profileSaved'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update organization profile');
    } finally {
      setSaving(false);
    }
  };

  const openNewAnnouncementModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormSummary('');
    setFormContent('');
    setFormAudience('PUBLIC');
    setFormStatus('PUBLISHED');
    setFormIsPinned(false);
    setFormCoverImageUrl('');
    setFormCtaLabel('');
    setFormCtaUrl('');
    setFormScheduledAt('');
    setFormExpiresAt('');
    setShowEditorModal(true);
  };

  const openEditAnnouncementModal = (ann: AnnouncementItem) => {
    setEditingId(ann.id);
    const titleStr = typeof ann.title === 'object' ? ann.title.en || Object.values(ann.title)[0] || '' : ann.title || '';
    const contentStr = typeof ann.content === 'object' ? ann.content.en || Object.values(ann.content)[0] || '' : ann.content || '';
    setFormTitle(titleStr);
    setFormSummary(ann.summary || '');
    setFormContent(contentStr);
    setFormAudience(ann.audience || 'PUBLIC');
    setFormStatus(ann.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED');
    setFormIsPinned(ann.isPinned ?? false);
    setFormCoverImageUrl(ann.coverImageUrl || '');
    setFormCtaLabel(ann.ctaLabel || '');
    setFormCtaUrl(ann.ctaUrl || '');
    setFormScheduledAt(ann.scheduledAt ? new Date(ann.scheduledAt).toISOString().slice(0, 16) : '');
    setFormExpiresAt(ann.expiresAt ? new Date(ann.expiresAt).toISOString().slice(0, 16) : '');
    setShowEditorModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WebP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size cannot exceed 10MB');
      return;
    }

    setUploadingImage(true);
    setErrorMsg('');
    try {
      const uploadRes = await ApiClient.uploadFile<{ url: string }>(file, {
        tenantId: activeOrg?.id,
      });
      if (uploadRes && uploadRes.url) {
        setFormCoverImageUrl(uploadRes.url);
        setSuccessMsg('Cover image uploaded successfully');
      } else {
        throw new Error('Upload succeeded but no file URL was returned');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMsg('Announcement title is required');
      return;
    }
    if (!formContent.trim()) {
      setErrorMsg('Announcement content is required');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload: any = {
      title: { en: formTitle.trim() },
      content: { en: formContent.trim() },
      summary: formSummary.trim() || undefined,
      audience: formAudience,
      status: formStatus,
      isPinned: formIsPinned,
      coverImageUrl: formCoverImageUrl || undefined,
      ctaLabel: formCtaLabel.trim() || undefined,
      ctaUrl: formCtaUrl.trim() || undefined,
      scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : undefined,
      expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
    };

    try {
      if (editingId) {
        await ApiClient.request(`/cms/announcements/${editingId}`, {
          method: 'PATCH',
          tenantId: activeOrg?.id,
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Announcement updated successfully');
      } else {
        await ApiClient.request('/cms/announcements', {
          method: 'POST',
          tenantId: activeOrg?.id,
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Announcement created successfully');
      }

      setShowEditorModal(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (ann: AnnouncementItem) => {
    const isCurrentlyPublished = ann.status === 'PUBLISHED';
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const endpoint = isCurrentlyPublished
        ? `/cms/announcements/${ann.id}/archive`
        : `/cms/announcements/${ann.id}/publish`;

      await ApiClient.request(endpoint, {
        method: 'POST',
        tenantId: activeOrg?.id,
      });

      setSuccessMsg(
        isCurrentlyPublished
          ? 'Announcement archived and unpublished'
          : 'Announcement published successfully'
      );
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update publication status');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (annId: string) => {
    setDeletingId(annId);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await ApiClient.request(`/cms/announcements/${deletingId}`, {
        method: 'DELETE',
        tenantId: activeOrg?.id,
      });
      setSuccessMsg('Announcement deleted successfully');
      setShowDeleteConfirmModal(false);
      setDeletingId(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete announcement');
    } finally {
      setSaving(false);
    }
  };

  const openPreview = (ann: AnnouncementItem) => {
    setPreviewItem(ann);
    setShowPreviewModal(true);
  };

  if (loading || authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <LoadingSkeleton variant="title" />
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
          Organization administrator or staff privileges required to manage organization content.
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              {t('cms.title')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 dark:bg-amber-950/60 text-brand-700 dark:text-amber-300 border border-brand-200 dark:border-amber-800">
              {activeOrg.name}
            </span>
          </div>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            {t('cms.subtitle')}
          </p>
        </div>

        {activeTab === 'announcements' && (
          <Button
            onClick={openNewAnnouncementModal}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t('cms.addAnnouncement')}</span>
          </Button>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2 border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800 dark:hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-surface-200 dark:border-surface-800 gap-4">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'announcements'
              ? 'border-brand-600 text-brand-600 dark:border-amber-400 dark:text-amber-400'
              : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          {t('cms.announcementsTab')}
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
            {announcements.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-brand-600 text-brand-600 dark:border-amber-400 dark:text-amber-400'
              : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          {t('cms.profileTab')}
        </button>
      </div>

      {/* Tab: Announcements */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-12 h-12 text-brand-600" />}
              title="No announcements yet"
              description="Create announcements to publish official news, events, and updates to members or the public."
              action={
                <Button onClick={openNewAnnouncementModal} className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />
                  Create First Announcement
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {announcements.map((ann) => {
                const titleStr = typeof ann.title === 'object' ? ann.title.en || Object.values(ann.title)[0] : ann.title;
                const contentStr = typeof ann.content === 'object' ? ann.content.en || Object.values(ann.content)[0] : ann.content;
                const isScheduledFuture = ann.scheduledAt && new Date(ann.scheduledAt) > new Date();

                return (
                  <Card key={ann.id} className="overflow-hidden flex flex-col justify-between border-surface-200 dark:border-surface-800">
                    <div>
                      {/* Cover Image Thumbnail */}
                      {ann.coverImageUrl ? (
                        <div className="w-full h-40 bg-surface-100 dark:bg-surface-800 overflow-hidden relative">
                          <img
                            src={ann.coverImageUrl}
                            alt={String(titleStr)}
                            className="w-full h-full object-cover"
                          />
                          {ann.isPinned && (
                            <div className="absolute top-2 left-2 bg-amber-500 text-white px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-16 bg-gradient-to-r from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-900 flex items-center justify-between px-4">
                          <span className="text-xs text-surface-400 font-medium">Text Announcement</span>
                          {ann.isPinned && (
                            <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[11px] font-bold uppercase flex items-center gap-1">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </span>
                          )}
                        </div>
                      )}

                      {/* Announcement Details */}
                      <div className="p-5 space-y-3">
                        {/* Status & Audience Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={ann.status === 'PUBLISHED' ? 'success' : ann.status === 'DRAFT' ? 'warning' : 'neutral'}>
                            {ann.status}
                          </Badge>

                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                            ann.audience === 'PUBLIC'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : ann.audience === 'MEMBERS'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                              : 'bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                          }`}>
                            {ann.audience === 'PUBLIC' && <Globe className="w-3 h-3" />}
                            {ann.audience === 'MEMBERS' && <Users2 className="w-3 h-3" />}
                            {ann.audience === 'STAFF' && <Lock className="w-3 h-3" />}
                            {ann.audience}
                          </span>

                          {isScheduledFuture && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <Calendar className="w-3 h-3" />
                              Scheduled
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-base text-surface-900 dark:text-white line-clamp-2">
                          {titleStr}
                        </h3>

                        <p className="text-xs text-surface-600 dark:text-surface-400 line-clamp-3 leading-relaxed">
                          {ann.summary || contentStr}
                        </p>

                        <div className="text-[11px] text-surface-400 pt-1 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
                          <span>Date: {new Date(ann.publishedAt || ann.createdAt).toLocaleDateString()}</span>
                          {ann.ctaUrl && (
                            <span className="text-brand-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                              Has Action Link <ExternalLink className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="p-4 bg-surface-50 dark:bg-surface-900/60 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPreview(ann)}
                          title="Preview announcement"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditAnnouncementModal(ann)}
                          title="Edit announcement"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700 dark:hover:text-rose-400"
                          onClick={() => confirmDelete(ann.id)}
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <Button
                        variant={ann.status === 'PUBLISHED' ? 'outline' : 'primary'}
                        size="sm"
                        disabled={saving}
                        onClick={() => handleTogglePublish(ann)}
                      >
                        {ann.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Organization Profile */}
      {activeTab === 'profile' && (
        <Card className="p-6">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                {t('org.mission')}
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                rows={3}
                value={profile.mission?.en || profile.mission || ''}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    mission: { ...profile.mission, en: e.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                {t('org.vision')}
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                rows={3}
                value={profile.vision?.en || profile.vision || ''}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    vision: { ...profile.vision, en: e.target.value },
                  })
                }
              />
            </div>

            <Button type="submit" disabled={saving} isLoading={saving}>
              {saving ? t('common.submitting') : t('common.save')}
            </Button>
          </form>
        </Card>
      )}

      {/* Announcement Editor Modal */}
      <Modal
        isOpen={showEditorModal}
        onClose={() => setShowEditorModal(false)}
        title={editingId ? 'Edit Announcement' : 'Create New Announcement'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitAnnouncement} className="space-y-4">
          <Input
            label="Announcement Title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="e.g. Annual General Assembly Resolution 2026"
            required
          />

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Summary (Optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              value={formSummary}
              onChange={(e) => setFormSummary(e.target.value)}
              placeholder="Brief 1-2 sentence overview for cards and notification banners"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Full Announcement Content *
            </label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              rows={6}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Full text of the announcement..."
              required
            />
          </div>

          {/* Cover Image Upload & Preview */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Cover Image (Optional)
            </label>

            {formCoverImageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 max-h-48 w-full group">
                <img
                  src={formCoverImageUrl}
                  alt="Announcement cover"
                  className="w-full h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFormCoverImageUrl('')}
                  className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-full shadow-md hover:bg-rose-700 transition-colors"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl p-4 text-center hover:border-brand-500 transition-colors">
                <label className="cursor-pointer flex flex-col items-center gap-1.5">
                  <UploadCloud className="w-8 h-8 text-surface-400 group-hover:text-brand-500" />
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                    {uploadingImage ? 'Uploading image...' : 'Click to select cover image'}
                  </span>
                  <span className="text-xs text-surface-400">
                    Supports JPG, PNG, WebP, GIF (Max 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Audience & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Audience
              </label>
              <select
                value={formAudience}
                onChange={(e) => setFormAudience(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="PUBLIC">PUBLIC (Everyone, Public Home & Portal)</option>
                <option value="MEMBERS">MEMBERS (Signed-in Members & App)</option>
                <option value="STAFF">STAFF (Staff & Administrators only)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Initial Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="PUBLISHED">Publish Immediately</option>
                <option value="DRAFT">Save as Draft</option>
              </select>
            </div>
          </div>

          {/* Pinning Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="formIsPinned"
              checked={formIsPinned}
              onChange={(e) => setFormIsPinned(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-surface-300"
            />
            <label htmlFor="formIsPinned" className="text-sm font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
              Pin to top of announcement list
            </label>
          </div>

          {/* Action Link (CTA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-surface-100 dark:border-surface-800">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Action Button Label (Optional)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                value={formCtaLabel}
                onChange={(e) => setFormCtaLabel(e.target.value)}
                placeholder="e.g. Download Resolution PDF"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Action URL (Optional)
              </label>
              <input
                type="url"
                className="w-full px-3 py-2 border rounded-lg dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                value={formCtaUrl}
                onChange={(e) => setFormCtaUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-surface-100 dark:border-surface-800 sticky bottom-0 bg-white dark:bg-surface-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 z-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditorModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploadingImage} isLoading={saving}>
              {editingId ? 'Save Changes' : formStatus === 'PUBLISHED' ? 'Publish Now' : 'Save Draft'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        title="Confirm Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            Are you sure you want to delete this announcement? This action will archive and remove it from public and member views.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={saving}
              isLoading={saving}
              onClick={handleDelete}
            >
              Delete Announcement
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Announcement Preview"
        maxWidth="lg"
      >
        {previewItem && (
          <div className="space-y-4">
            {previewItem.coverImageUrl && (
              <div className="w-full h-52 rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-800">
                <img
                  src={previewItem.coverImageUrl}
                  alt="Preview cover"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Badge variant={previewItem.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                {previewItem.status}
              </Badge>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                {previewItem.audience}
              </span>
              <span className="text-xs text-surface-400">
                {new Date(previewItem.publishedAt || previewItem.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">
              {typeof previewItem.title === 'object' ? previewItem.title.en : previewItem.title}
            </h2>
            {previewItem.summary && (
              <p className="text-sm font-medium text-surface-600 dark:text-surface-300 italic">
                {previewItem.summary}
              </p>
            )}
            <div className="prose dark:prose-invert text-sm text-surface-700 dark:text-surface-300 whitespace-pre-line leading-relaxed">
              {typeof previewItem.content === 'object' ? previewItem.content.en : previewItem.content}
            </div>
            {previewItem.ctaUrl && previewItem.ctaLabel && (
              <div className="pt-2">
                <a
                  href={previewItem.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
                >
                  <span>{previewItem.ctaLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-surface-100 dark:border-surface-800">
              <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
