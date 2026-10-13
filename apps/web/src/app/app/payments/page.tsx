'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { CardSkeleton } from '../../../components/ui/LoadingSkeleton';
import {
  CreditCard,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

interface PaymentItem {
  id: string;
  transactionReference: string;
  amount: string | number;
  currency: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'FAILED';
  createdAt: string;
  paymentMethod?: {
    name: string;
    type: string;
  };
  membership?: {
    id: string;
    membershipPlan?: {
      name: string;
    };
  };
  proofs?: Array<{
    id: string;
    fileUrl: string;
    originalFileName?: string;
    transactionReference?: string;
    createdAt: string;
  }>;
  reviews?: Array<{
    decision: 'APPROVED' | 'REJECTED';
    notes?: string;
    rejectionReason?: string;
    createdAt: string;
  }>;
}

export default function MemberPaymentsPage() {
  const { activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proof Upload Modal State
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('image/jpeg');
  const [fileSize, setFileSize] = useState(102400); // 100KB default
  const [txRef, setTxRef] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState<string | null>(null);

  const fetchPayments = async () => {
    if (!activeOrg?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await ApiClient.get<PaymentItem[]>('/payments/me');
      setPayments(res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve payment history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (activeOrg?.id) {
      fetchPayments();
    }
  }, [authLoading, isAuthenticated, activeOrg?.id]);

  const handleOpenProofModal = (payment: PaymentItem) => {
    setSelectedPayment(payment);
    setFileUrl(`https://storage.4baye.org/proofs/bank_slip_${payment.transactionReference}.jpg`);
    setFileType('image/jpeg');
    setFileSize(250000);
    setTxRef(payment.transactionReference);
    setNotes('');
    setProofError(null);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    try {
      setIsSubmittingProof(true);
      setProofError(null);

      const res = await ApiClient.post(`/payments/${selectedPayment.id}/proof`, {
        fileUrl,
        fileType,
        fileSize: Number(fileSize),
        originalFileName: 'bank_transfer_receipt.jpg',
        transactionReference: txRef,
        notes,
      });

      setProofSuccess('Payment proof submitted successfully! Our finance department will review your verification.');
      setSelectedPayment(null);
      await fetchPayments();
    } catch (err: any) {
      setProofError(err.message || 'Error occurred submitting proof');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const getStatusBadge = (status: PaymentItem['status']) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="success">VERIFIED</Badge>;
      case 'UNDER_REVIEW':
        return <Badge variant="warning">UNDER REVIEW</Badge>;
      case 'PENDING':
        return <Badge variant="neutral">PAYMENT PENDING</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      case 'FAILED':
        return <Badge variant="danger">FAILED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Payment History & Proofs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track membership dues, transaction references, and submit bank transfer receipts for {activeOrg?.name}.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/app/membership')}
          className="text-xs"
        >
          View Memberships
        </Button>
      </div>

      {proofSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{proofSuccess}</span>
          </div>
          <button
            onClick={() => setProofSuccess(null)}
            className="text-xs font-bold text-emerald-700 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {payments.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800">
          <EmptyState
            icon={<CreditCard className="w-6 h-6" />}
            title="No Payment Records Found"
            description="You have not initiated any payments yet. Apply for a membership plan to begin your subscription."
            action={
              <Button size="sm" onClick={() => router.push('/app/membership')}>
                Explore Membership Plans
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => {
            const latestReview = p.reviews && p.reviews.length > 0 ? p.reviews[p.reviews.length - 1] : null;

            return (
              <Card
                key={p.id}
                className="overflow-hidden border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Payment details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                        REF: {p.transactionReference}
                      </span>
                      {getStatusBadge(p.status)}
                    </div>

                    <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                      {p.membership?.membershipPlan?.name || 'Membership Payment'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <span>
                        Method: <strong>{p.paymentMethod?.name || 'Manual Bank'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Date: {new Date(p.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Rejection notice if applicable */}
                    {p.status === 'REJECTED' && latestReview?.rejectionReason && (
                      <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
                        <strong>Rejection Reason:</strong> {latestReview.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right">
                      <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {Number(p.amount).toFixed(2)} {p.currency}
                      </span>
                    </div>

                    <div>
                      {p.status === 'PENDING' || p.status === 'REJECTED' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenProofModal(p)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          {p.status === 'REJECTED' ? 'Resubmit Proof' : 'Upload Proof'}
                        </Button>
                      ) : p.status === 'UNDER_REVIEW' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Review in progress
                        </span>
                      ) : p.status === 'VERIFIED' ? (
                        <Link
                          href="/app/card"
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          View Digital ID
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manual Proof Submission Modal */}
      <Modal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title="Submit Payment Proof"
        description={`Attach your deposit slip or transaction confirmation for reference ${selectedPayment?.transactionReference}.`}
      >
        <form onSubmit={handleSubmitProof} className="space-y-4">
          {proofError && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
              {proofError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Receipt / Slip URL or Cloud Storage Path
            </label>
            <Input
              type="text"
              required
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://storage.organization.org/proofs/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                File Type (MIME)
              </label>
              <select
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100"
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
              >
                <option value="image/jpeg">image/jpeg</option>
                <option value="image/png">image/png</option>
                <option value="image/webp">image/webp</option>
                <option value="application/pdf">application/pdf</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                File Size (Bytes, Max 5MB)
              </label>
              <Input
                type="number"
                value={fileSize}
                onChange={(e) => setFileSize(Number(e.target.value))}
                min={1024}
                max={5242880}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bank Transaction / Reference Number
            </label>
            <Input
              type="text"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
              placeholder="e.g. FT260901ABCD / Telebirr Transaction ID"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes for Finance Officer (Optional)
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Deposited at Bole Branch under Abebe Bikila"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedPayment(null)}
              disabled={isSubmittingProof}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingProof}
              isLoading={isSubmittingProof}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Submit Proof
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
