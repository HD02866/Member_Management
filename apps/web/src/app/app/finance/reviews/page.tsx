'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../lib/auth';
import { useI18n } from '../../../../lib/i18n';
import { ApiClient } from '../../../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { Input } from '../../../../components/ui/Input';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { CardSkeleton } from '../../../../components/ui/LoadingSkeleton';
import {
  DollarSign,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  User,
  Hash,
  Calendar,
  ArrowLeft,
} from 'lucide-react';

interface PendingPaymentReview {
  id: string;
  transactionReference: string;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string;
  memberProfile: {
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    memberNumber: string;
    phoneNumber?: string;
  };
  membership: {
    id: string;
    membershipPlan: {
      name: string;
      code: string;
    };
  };
  paymentMethod?: {
    name: string;
    type: string;
  };
  proofs?: Array<{
    id: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    originalFileName?: string;
    transactionReference?: string;
    notes?: string;
    createdAt: string;
  }>;
}

export default function FinanceReviewPage() {
  const { activeOrg, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [reviews, setReviews] = useState<PendingPaymentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval Modal State
  const [approvingPayment, setApprovingPayment] = useState<PendingPaymentReview | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Rejection Modal State
  const [rejectingPayment, setRejectingPayment] = useState<PendingPaymentReview | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isProcessingRejection, setIsProcessingRejection] = useState(false);

  // Feedback Messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReviews = async () => {
    if (!activeOrg?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await ApiClient.get<PendingPaymentReview[]>('/payments/review');
      setReviews(res || []);
    } catch (err: any) {
      if (err.statusCode === 403 || err.status === 403) {
        setError('Access Denied: You do not possess the finance review authority in this tenant.');
      } else {
        setError(err.message || 'Failed to retrieve payment review queue');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (activeOrg?.id && activeOrg?.isStaff) {
      fetchReviews();
    } else {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, activeOrg?.id, activeOrg?.isStaff]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingPayment) return;

    try {
      setIsProcessingApproval(true);
      setActionError(null);

      await ApiClient.post(`/payments/${approvingPayment.id}/approve`, {
        notes: approvalNotes || 'Approved by finance officer',
      });

      setActionSuccess(
        `Payment for ${approvingPayment.memberProfile.firstName} ${approvingPayment.memberProfile.lastName} approved! Membership activated and Digital ID minted.`
      );
      setApprovingPayment(null);
      setApprovalNotes('');
      await fetchReviews();
    } catch (err: any) {
      setActionError(err.message || 'Error occurred while approving payment');
    } finally {
      setIsProcessingApproval(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPayment) return;

    if (!rejectionReason.trim()) {
      setActionError('Rejection reason is mandatory.');
      return;
    }

    try {
      setIsProcessingRejection(true);
      setActionError(null);

      await ApiClient.post(`/payments/${rejectingPayment.id}/reject`, {
        rejectionReason: rejectionReason.trim(),
        notes: rejectionNotes || undefined,
      });

      setActionSuccess(
        `Payment rejected. Member has been notified to resubmit authentic proof.`
      );
      setRejectingPayment(null);
      setRejectionReason('');
      setRejectionNotes('');
      await fetchReviews();
    } catch (err: any) {
      setActionError(err.message || 'Error occurred while rejecting payment');
    } finally {
      setIsProcessingRejection(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <CardSkeleton />
      </div>
    );
  }

  // Enforce staff/admin authorization
  if (!activeOrg?.isStaff) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Access Restricted
        </h2>
        <p className="text-surface-500 text-sm">
          Finance officer or administrator privileges required to access payment verification.
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          Finance Review & Verification Queue
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review manual bank deposit slips, verify transaction amounts, and activate memberships for {activeOrg?.name}.
        </p>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-xs font-bold text-emerald-700 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {error ? (
        <Card className="border-red-200 dark:border-red-900/50 p-6 bg-red-50/50 dark:bg-red-950/20 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-red-700 dark:text-red-400">Queue Access Restricted</h2>
          <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
        </Card>
      ) : reviews.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800">
          <EmptyState
            icon={<CheckCircle className="w-6 h-6" />}
            title="Review Queue is Clean"
            description="There are currently no manual payment proofs waiting for finance verification."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => {
            const latestProof = r.proofs && r.proofs.length > 0 ? r.proofs[r.proofs.length - 1] : null;
            const isSelfSubmission = user?.id === r.memberProfile.userId;

            return (
              <Card
                key={r.id}
                className="overflow-hidden border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: Applicant & Payment info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-slate-500">
                        REF: {r.transactionReference}
                      </span>
                      <Badge variant="warning">UNDER REVIEW</Badge>
                      {isSelfSubmission && (
                        <Badge variant="danger">
                          SELF SUBMISSION (LOCKED)
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-500" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {r.memberProfile.firstName} {r.memberProfile.lastName}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">
                        ({r.memberProfile.memberNumber})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Plan: <strong>{r.membership.membershipPlan.name}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Method: <strong>{r.paymentMethod?.name || 'Manual Bank'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Submitted: {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Proof Details Preview */}
                    {latestProof ? (
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            Proof Slip Attached ({latestProof.fileType})
                          </span>
                          <a
                            href={latestProof.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1"
                          >
                            View Receipt <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        {latestProof.transactionReference && (
                          <p className="text-slate-600 dark:text-slate-400">
                            Bank Reference: <span className="font-mono font-medium">{latestProof.transactionReference}</span>
                          </p>
                        )}
                        {latestProof.notes && (
                          <p className="text-slate-500 italic">
                            &quot;{latestProof.notes}&quot;
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 italic">No proof file attached yet.</p>
                    )}
                  </div>

                  {/* Right: Amount & Decision Buttons */}
                  <div className="flex flex-col items-end justify-between gap-4">
                    <div className="text-right">
                      <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {Number(r.amount).toFixed(2)} {r.currency}
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono">Server Authoritative Amount</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRejectingPayment(r);
                          setRejectionReason('');
                          setRejectionNotes('');
                        }}
                        disabled={isSelfSubmission}
                        className="text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject Proof
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setApprovingPayment(r);
                          setApprovalNotes('');
                        }}
                        disabled={isSelfSubmission}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve & Mint ID
                      </Button>
                    </div>

                    {isSelfSubmission && (
                      <p className="text-[10px] text-red-500 font-semibold">
                        🔒 Segregation of Duties: You cannot approve your own payment.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={!!approvingPayment}
        onClose={() => setApprovingPayment(null)}
        title="Approve Payment & Activate Member"
        description={`Approving this payment will mark transaction ${approvingPayment?.transactionReference} as VERIFIED, activate the membership, and issue a digital membership ID card.`}
      >
        <form onSubmit={handleApprove} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Internal Audit Notes (Optional)
            </label>
            <Input
              type="text"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="e.g. Verified with CBE statement slip FT26090123"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApprovingPayment(null)}
              disabled={isProcessingApproval}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isProcessingApproval}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessingApproval ? 'Activating...' : 'Confirm Approval & Mint ID'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectingPayment}
        onClose={() => setRejectingPayment(null)}
        title="Reject Payment Proof"
        description={`Rejecting this payment will inform the member why their proof was insufficient and allow them to upload a corrected bank slip.`}
      >
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Rejection Reason (Mandatory)
            </label>
            <Input
              type="text"
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Slip blurred, amount mismatch, duplicate reference"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Additional Notes (Optional)
            </label>
            <Input
              type="text"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Instructions for applicant..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingPayment(null)}
              disabled={isProcessingRejection}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={isProcessingRejection}
            >
              {isProcessingRejection ? 'Rejecting...' : 'Reject Proof'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
