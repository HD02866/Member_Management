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
  DollarSign,
  CreditCard,
  Building,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  reference: string | null;
  createdAt: string;
  user?: {
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
  review?: {
    id: string;
    status: string;
    reviewedAt: string;
  } | null;
}

interface PaymentsApiResponse {
  payments: PaymentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function PlatformPaymentsPage() {
  const { user } = useAuth();

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
      queryParams.set('page', currentPage.toString());
      queryParams.set('limit', '25');

      const res = await ApiClient.get<PaymentsApiResponse>(
        `/platform/payments?${queryParams.toString()}`,
      );

      if (res && Array.isArray(res.payments)) {
        setPayments(res.payments);
        setTotalCount(res.total);
        setTotalPages(res.totalPages);
      } else if (Array.isArray(res)) {
        setPayments(res);
        setTotalCount(res.length);
        setTotalPages(1);
      } else {
        setPayments([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load payments oversight data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentPage]);

  useEffect(() => {
    if (user?.isPlatformAdmin) {
      loadPayments();
    }
  }, [user, loadPayments]);

  if (!user?.isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Platform administrator privileges required to view Payments Oversight.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Financial Oversight
          </span>
          <span className="text-xs text-surface-400">Total: {totalCount} Transactions</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-surface-950 dark:text-white mt-1">
          Payments & Transactions Oversight
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Cross-tenant operational visibility over membership fee collections, manual review proofs, and payment gateways.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5">
        {['ALL', 'COMPLETED', 'PENDING', 'FAILED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === st
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {st === 'ALL' ? 'All Payments' : st}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description="No payment records match the selected filter criteria."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/60 text-xs text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Amount & Currency</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Tenant Organization</th>
                  <th className="px-5 py-3 font-semibold">Payer / Member</th>
                  <th className="px-5 py-3 font-semibold">Gateway & Reference</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-surface-900 dark:text-white font-mono text-base">
                        {p.amount.toLocaleString()} {p.currency}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            p.status === 'COMPLETED'
                              ? 'success'
                              : p.status === 'PENDING'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {p.status}
                        </Badge>
                        {p.review && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                            Review: {p.review.status}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      {p.organization ? (
                        <Link
                          href={`/admin/organizations/${p.organization.slug || p.organization.id}`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {p.organization.name}
                        </Link>
                      ) : (
                        <span className="text-surface-400">Platform Global</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-500">
                      {p.user ? (
                        <div>
                          <div className="font-semibold text-surface-900 dark:text-white">
                            {p.user.firstName} {p.user.lastName}
                          </div>
                          <div className="text-surface-400 font-mono">{p.user.email || '—'}</div>
                        </div>
                      ) : (
                        <span className="text-surface-400">Anonymous Payer</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-500 font-mono">
                      <div>{p.provider}</div>
                      {p.reference && <div className="text-surface-400">{p.reference}</div>}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-surface-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString()}
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
                Page {currentPage} of {totalPages} ({totalCount} total transactions)
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
