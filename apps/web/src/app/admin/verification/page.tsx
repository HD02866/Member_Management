'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth';
import { ApiClient } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  Shield,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Building,
} from 'lucide-react';

interface VerificationLogItem {
  id: string;
  verifiedAt: string;
  result: 'VALID' | 'EXPIRED' | 'SUSPENDED' | 'INVALID';
  ipAddress: string | null;
  card?: {
    id: string;
    cardNumber: string;
    status: string;
    organization?: {
      id: string;
      name: string;
      slug: string;
    } | null;
    memberProfile?: {
      firstName: string;
      lastName: string;
      memberNumber: string;
    } | null;
  } | null;
}

interface VerificationApiResponse {
  logs: VerificationLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PlatformVerificationPage() {
  const { user } = useAuth();

  const [logs, setLogs] = useState<VerificationLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [resultFilter, setResultFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadVerificationLogs = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams();
      if (resultFilter !== 'ALL') queryParams.set('result', resultFilter);
      queryParams.set('page', currentPage.toString());
      queryParams.set('limit', '25');

      const res = await ApiClient.get<VerificationApiResponse>(
        `/platform/verification?${queryParams.toString()}`,
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
      setErrorMsg(err.message || 'Failed to load verification logs');
    } finally {
      setLoading(false);
    }
  }, [resultFilter, currentPage]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadVerificationLogs();
    }
  }, [user, loadVerificationLogs]);

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Platform administrator privileges required to view Verification Oversight.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
            Card Security
          </span>
          <span className="text-xs text-surface-400">Total: {totalCount} Verification Scans</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
          Digital ID Verification Oversight
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Real-time verification history of dynamic rotating QR codes across all member organizations.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5">
        {['ALL', 'VALID', 'EXPIRED', 'SUSPENDED', 'INVALID'].map((res) => (
          <button
            key={res}
            onClick={() => {
              setResultFilter(res);
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              resultFilter === res
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {res === 'ALL' ? 'All Scans' : res}
          </button>
        ))}
      </div>

      {/* Verification Logs Table */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No verification events found"
          description="No digital card verification scans match your current filter."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Verification Result</th>
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Card ID</th>
                  <th className="px-5 py-3 font-semibold">Tenant Organization</th>
                  <th className="px-5 py-3 font-semibold">Scanner IP</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          log.result === 'VALID'
                            ? 'success'
                            : log.result === 'EXPIRED'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {log.result}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 font-medium text-surface-900 dark:text-white">
                      {log.card?.memberProfile ? (
                        <div>
                          <div>
                            {log.card.memberProfile.firstName} {log.card.memberProfile.lastName}
                          </div>
                          <div className="text-xs text-surface-400 font-mono">
                            #{log.card.memberProfile.memberNumber}
                          </div>
                        </div>
                      ) : (
                        <span className="text-surface-400">Unknown Member</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-surface-600 dark:text-surface-300">
                      {log.card?.cardNumber || '—'}
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      {log.card?.organization ? (
                        <Link
                          href={`/admin/organizations/${log.card.organization.slug || log.card.organization.id}`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {log.card.organization.name}
                        </Link>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-surface-400">
                      {log.ipAddress || '—'}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-400 whitespace-nowrap">
                      {new Date(log.verifiedAt).toLocaleString()}
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
                Page {currentPage} of {totalPages} ({totalCount} total scans)
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
