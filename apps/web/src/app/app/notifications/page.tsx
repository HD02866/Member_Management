'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Bell,
  CheckCircle,
  Mail,
  Smartphone,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react';

export default function NotificationsPage() {
  const { user, activeOrg } = useAuth();
  const { t } = useI18n();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<any>({
    emailEnabled: true,
    inAppEnabled: true,
    smsEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (activeOrg?.id) {
      loadData();
    }
  }, [activeOrg?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notifsRes, prefsRes] = await Promise.all([
        ApiClient.request('/notifications'),
        ApiClient.request('/notifications/preferences'),
      ]);
      const notifsData = notifsRes.data || notifsRes || {};
      setNotifications(notifsData.items || []);
      setUnreadCount(notifsData.unreadCount || 0);
      setPreferences(prefsRes.data || prefsRes || {});
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await ApiClient.request(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(
        notifications.map((n) =>
          n.id === id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update notification status');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await ApiClient.request('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(
        notifications.map((n) => ({
          ...n,
          status: 'READ',
          readAt: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to mark all notifications as read');
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await ApiClient.request('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(preferences),
      });
      setSuccessMsg('Preferences saved successfully');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <LoadingSkeleton variant="title" />
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-600" />
            {t('notifications.title')}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            {t('notifications.subtitle')}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead} className="text-xs">
            {t('notifications.markAllRead')} ({unreadCount})
          </Button>
        )}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Notifications Feed */}
        <div className="md:col-span-2 space-y-3">
          {notifications.length === 0 ? (
            <EmptyState
              title={t('notifications.empty')}
              description={t('notifications.subtitle')}
            />
          ) : (
            notifications.map((notif) => {
              const isUnread = notif.status === 'UNREAD';
              return (
                <Card
                  key={notif.id}
                  className={`p-4 transition-colors ${
                    isUnread
                      ? 'border-brand-300 bg-brand-50/20 dark:bg-brand-950/20'
                      : 'border-surface-200 dark:border-surface-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0" />
                        )}
                        <h4 className="font-semibold text-sm text-surface-900 dark:text-white">
                          {notif.title}
                        </h4>
                      </div>
                      <p className="text-sm text-surface-600 dark:text-surface-300">
                        {notif.message}
                      </p>
                      <span className="text-xs text-surface-400 flex items-center gap-1 mt-2">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {isUnread && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-xs flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Read
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Preferences Side Card */}
        <div>
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-surface-900 dark:text-white text-sm">
              {t('notifications.preferencesTitle')}
            </h3>
            <form onSubmit={handleSavePreferences} className="space-y-3">
              <label className="flex items-center justify-between text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-surface-500" />
                  {t('notifications.emailEnabled')}
                </span>
                <input
                  type="checkbox"
                  checked={!!preferences.emailEnabled}
                  onChange={(e) =>
                    setPreferences({ ...preferences, emailEnabled: e.target.checked })
                  }
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>

              <label className="flex items-center justify-between text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-surface-500" />
                  {t('notifications.inAppEnabled')}
                </span>
                <input
                  type="checkbox"
                  checked={!!preferences.inAppEnabled}
                  onChange={(e) =>
                    setPreferences({ ...preferences, inAppEnabled: e.target.checked })
                  }
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>

              <label className="flex items-center justify-between text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-surface-500" />
                  {t('notifications.smsEnabled')}
                </span>
                <input
                  type="checkbox"
                  checked={!!preferences.smsEnabled}
                  onChange={(e) =>
                    setPreferences({ ...preferences, smsEnabled: e.target.checked })
                  }
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>

              <Button
                type="submit"
                size="sm"
                className="w-full mt-2"
                disabled={savingPrefs}
              >
                {savingPrefs ? t('common.submitting') : t('notifications.savePreferences')}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
