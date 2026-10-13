'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Shield,
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Building,
  User,
  Activity,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: string;
  actorUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  } | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface AuditApiResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PlatformAuditPage() {
  const { user } = useAuth();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams();
      if (actionFilter.trim()) queryParams.set('action', actionFilter.trim());
      if (entityFilter.trim()) queryParams.set('entityType', entityFilter.trim());
      queryParams.set('page', currentPage.toString());
      queryParams.set('limit', '25');

      const res = await ApiClient.get<AuditApiResponse>(
        `/platform/audit?${queryParams.toString()}`,
      );

      if (res && Array.isArray(res.logs)) {
        setLogs(res.logs);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
      } else if (Array.isArray(res)) {
        setLogs(res);
        setTotalCount(res.length);
        setTotalPages(1);
      } else {
        setLogs([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, currentPage]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadAuditLogs();
    }
  }, [user, loadAuditLogs]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadAuditLogs();
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Platform administrator privileges required to view the Global Audit Trail.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-200 dark:border-surface-700">
            Compliance & Security
          </span>
          <span className="text-xs text-surface-400">Total: {totalCount} Recorded Events</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
          Platform Audit Trail
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Immutable audit log stream of administrative, tenant lifecycle, and operational mutations.
        </p>
      </div>

      {/* Filter Form */}
      <form onSubmit={handleFilterSubmit} className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-64">
          <Input
            placeholder="Filter by action (e.g. USER_LOGIN)"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs py-1.5"
          />
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Filter by entity type (e.g. Organization)"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs py-1.5"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" leftIcon={<Filter className="w-3.5 h-3.5" />}>
          Filter Logs
        </Button>
      </form>

      {/* Logs Table */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit events found"
          description="No logs matched the selected filter criteria."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action & Target</th>
                  <th className="px-5 py-3 font-semibold">Actor</th>
                  <th className="px-5 py-3 font-semibold">Tenant Organization</th>
                  <th className="px-5 py-3 font-semibold">IP Address</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800 font-mono text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                    <td className="px-5 py-3.5 space-y-1">
                      <div className="font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                        <span>{log.action}</span>
                        <Badge variant="neutral" className="text-[10px] font-sans">
                          {log.entityType}
                        </Badge>
                      </div>
                      {log.entityId && (
                        <div className="text-[11px] text-surface-400">
                          Target ID: {log.entityId.slice(0, 12)}...
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-sans">
                      {log.actorUser ? (
                        <div>
                          <div className="font-semibold text-surface-900 dark:text-white">
                            {log.actorUser.firstName} {log.actorUser.lastName}
                          </div>
                          <div className="text-xs text-surface-400 font-mono">
                            {log.actorUser.email || 'no-email'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-surface-400 italic">System / Anonymous</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-sans">
                      {log.organization ? (
                        <div>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {log.organization.name}
                          </span>
                          <span className="text-xs text-surface-400 font-mono ml-1">
                            (@{log.organization.slug})
                          </span>
                        </div>
                      ) : (
                        <span className="text-surface-400">Platform Global</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-surface-500">
                      {log.ipAddress || '—'}
                    </td>

                    <td className="px-5 py-3.5 text-surface-400 whitespace-nowrap font-sans text-xs">
                      {new Date(log.createdAt).toLocaleString()}
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
                Page {currentPage} of {totalPages} ({totalCount} total events)
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
    </div>
  );
}
