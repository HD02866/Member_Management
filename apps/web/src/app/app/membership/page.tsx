'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { CardSkeleton } from '../../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Clock,
  UploadCloud,
  Hash,
} from 'lucide-react';
import Link from 'next/link';

interface MembershipItem {
  id: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  membershipPlan: {
    id: string;
    name: string;
    code: string;
    price: string | number;
    currency: string;
    registrationFee: string | number;
    billingInterval: string;
  };
  digitalCard?: {
    id: string;
    cardNumber: string;
    status: string;
    expirationDate: string;
  };
}

interface PlanItem {
  id: string;
  name: string;
  code: string;
  description?: any;
  price: string | number;
  currency: string;
  registrationFee: string | number;
  billingInterval: string;
}

interface PaymentMethodItem {
  id: string;
  name: string;
  type: string;
  instructions?: any;
}

export default function MembershipManagementPage() {
  const { activeOrg, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const { t, localize } = useI18n();
  const router = useRouter();

  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Application Modal state
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Payment Initiation Modal state
  const [payingMembership, setPayingMembership] = useState<MembershipItem | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [paymentInitiationResult, setPaymentInitiationResult] = useState<any | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (activeOrg) {
      setIsLoading(true);
      Promise.all([
        ApiClient.get<MembershipItem[]>('/memberships/me', { tenantId: activeOrg.id }),
        ApiClient.get<PlanItem[]>('/memberships/plans', { tenantId: activeOrg.id }),
      ])
        .then(([userMemberships, activePlans]) => {
          setMemberships(userMemberships || []);
          setPlans(activePlans || []);
        })
        .catch(() => {
          setMemberships([]);
          setPlans([]);
        })
        .finally(() => setIsLoading(false));
    } else {
      setMemberships([]);
      setPlans([]);
      setIsLoading(false);
    }
  }, [activeOrg, isAuthenticated, authLoading, router]);

  const handleApply = async () => {
    if (!activeOrg || !selectedPlan) return;

    try {
      setIsApplying(true);
      setApplyError(null);

      await ApiClient.post(
        '/memberships/apply',
        { planId: selectedPlan.id },
        { tenantId: activeOrg.id },
      );

      setApplySuccess(
        `Application registered for plan "${selectedPlan.name}"! Status: REGISTERED. Next step: complete payment.`,
      );

      // Refresh memberships list
      const updated = await ApiClient.get<MembershipItem[]>('/memberships/me', {
        tenantId: activeOrg.id,
      });
      setMemberships(updated || []);
      await refreshUser();
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to submit membership application.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleOpenPaymentModal = async (membership: MembershipItem) => {
    setPayingMembership(membership);
    setPaymentError(null);
    setPaymentInitiationResult(null);

    try {
      const res = await ApiClient.get<PaymentMethodItem[]>('/payments/methods');
      if (res && res.length > 0) {
        setPaymentMethods(res);
        setSelectedMethodId(res[0].id);
      } else {
        setPaymentMethods([]);
      }
    } catch (e: any) {
      setPaymentError(e.message || 'Failed to load payment methods');
    }
  };

  const handleConfirmPayment = async () => {
    if (!payingMembership || !selectedMethodId) return;

    try {
      setIsInitiatingPayment(true);
      setPaymentError(null);
      const idempotencyKey = `pay_${payingMembership.id}_${Date.now()}`;

      const res = await ApiClient.post<any>(
        '/payments',
        {
          membershipId: payingMembership.id,
          paymentMethodId: selectedMethodId,
          paymentType: 'MEMBERSHIP_DUES',
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );

      if (res) {
        setPaymentInitiationResult(res);
        // Refresh memberships list
        if (activeOrg) {
          const updated = await ApiClient.get<MembershipItem[]>('/memberships/me', {
            tenantId: activeOrg.id,
          });
          setMemberships(updated || []);
        }
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Payment initiation failed');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No Organization Selected"
          description="Please select or join an organization to view your membership."
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-950 dark:text-white">
            {t('nav.membership')}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Membership records and subscriptions for <strong>{activeOrg.name}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/app/payments')}
            className="text-xs flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Payment History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/app/card')}
            className="text-xs flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Digital Card
          </Button>
        </div>
      </div>

      {/* Current Memberships */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-surface-950 dark:text-white">
          My Organization Memberships
        </h2>

        {memberships.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {memberships.map((m) => (
              <Card key={m.id} className="border-l-4 border-l-brand-600">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{m.membershipPlan.name}</CardTitle>
                    <p className="text-xs text-surface-400 font-mono">ID: {m.id.substring(0, 8)}...</p>
                  </div>
                  <Badge status={m.status} />
                </CardHeader>

                <CardContent className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-surface-500">{t('membership.fee')}:</span>
                    <span className="font-semibold">
                      {Number(m.membershipPlan.price).toLocaleString()} {m.membershipPlan.currency} /{' '}
                      {m.membershipPlan.billingInterval}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-surface-500">Applied On:</span>
                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Status Dependent Lifecycle Actions */}
                  {m.status === 'ACTIVE' ? (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <div>
                          <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                            Digital ID Active #{m.digitalCard?.cardNumber || 'Issued'}
                          </span>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            Valid through {m.digitalCard?.expirationDate ? new Date(m.digitalCard.expirationDate).toLocaleDateString() : 'Annual cycle'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push('/app/card')}
                        className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:border-emerald-700"
                      >
                        View ID Card
                      </Button>
                    </div>
                  ) : m.status === 'UNDER_REVIEW' ? (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                        <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Payment Under Review</span>
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            Finance officers are verifying your deposit slip.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push('/app/payments')}
                        className="text-xs text-amber-700 border-amber-300 hover:bg-amber-100 dark:border-amber-700"
                      >
                        Track Status
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Payment Required
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Complete payment to activate membership & receive digital ID.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleOpenPaymentModal(m)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Pay Dues
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="p-8 border border-dashed rounded-xl text-center space-y-2">
            <CreditCard className="w-8 h-8 text-surface-400 mx-auto" />
            <h3 className="font-semibold text-surface-900 dark:text-surface-100">
              {t('membership.noActiveMembership')}
            </h3>
            <p className="text-xs text-surface-500 max-w-sm mx-auto">
              {t('membership.browsePlansPrompt')}
            </p>
          </div>
        )}
      </div>

      {/* Available Plans to Apply */}
      <div className="space-y-4 pt-6 border-t border-surface-200 dark:border-surface-800">
        <div>
          <h2 className="text-xl font-bold text-surface-950 dark:text-white">
            Available Membership Plans
          </h2>
          <p className="text-xs text-surface-500 mt-0.5">
            Select an active plan to apply or add a membership tier.
          </p>
        </div>

        {plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const alreadyHas = memberships.some((m) => m.membershipPlan.id === p.id);
              return (
                <Card key={p.id} className="flex flex-col justify-between">
                  <CardHeader className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant="info">{p.billingInterval}</Badge>
                    </div>
                    <div className="text-2xl font-bold pt-2">
                      {Number(p.price).toLocaleString()} {p.currency}
                    </div>
                    {Number(p.registrationFee) > 0 && (
                      <p className="text-xs text-surface-400">
                        Registration Fee: {Number(p.registrationFee).toLocaleString()} {p.currency}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent>
                    <p className="text-xs text-surface-500">
                      {localize(p.description) || 'Standard voting rights and member privileges.'}
                    </p>
                  </CardContent>

                  <div className="p-5 border-t border-surface-100 dark:border-surface-800">
                    <Button
                      variant={alreadyHas ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full"
                      disabled={alreadyHas}
                      onClick={() => {
                        setSelectedPlan(p);
                        setApplyError(null);
                        setApplySuccess(null);
                      }}
                    >
                      {alreadyHas ? 'Already Applied' : t('common.apply')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-surface-400">No active plans found for this organization.</p>
        )}
      </div>

      {/* Modal for application */}
      <Modal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        title={t('membership.applyModalTitle')}
        description={`Organization: ${activeOrg.name}`}
      >
        <div className="space-y-4">
          {applyError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{applyError}</span>
            </div>
          )}

          {applySuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-base">Application Received!</h4>
              <p className="text-xs text-surface-500">{applySuccess}</p>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setSelectedPlan(null)}
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-surface-500 uppercase">Plan</span>
                  <Badge variant="info">{selectedPlan?.billingInterval}</Badge>
                </div>
                <h4 className="text-lg font-bold">{selectedPlan?.name}</h4>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-surface-200 dark:border-surface-700">
                  <span className="text-surface-500">Plan Dues:</span>
                  <span className="font-semibold">
                    {Number(selectedPlan?.price).toLocaleString()} {selectedPlan?.currency}
                  </span>
                </div>
                {Number(selectedPlan?.registrationFee) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-surface-500">Registration Fee:</span>
                    <span className="font-semibold">
                      {Number(selectedPlan?.registrationFee).toLocaleString()}{' '}
                      {selectedPlan?.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-surface-200 dark:border-surface-700 text-brand-600">
                  <span>Total Due:</span>
                  <span>
                    {(
                      Number(selectedPlan?.price) + Number(selectedPlan?.registrationFee || 0)
                    ).toLocaleString()}{' '}
                    {selectedPlan?.currency}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPlan(null)}
                  disabled={isApplying}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleApply}
                  isLoading={isApplying}
                >
                  {t('membership.confirmApplication')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Payment Initiation Modal */}
      <Modal
        isOpen={!!payingMembership}
        onClose={() => setPayingMembership(null)}
        title="Initiate Membership Payment"
        description={`Paying dues for plan "${payingMembership?.membershipPlan.name}"`}
      >
        <div className="space-y-4">
          {paymentError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-xs flex items-center gap-2 border border-red-200 dark:border-red-900/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          {paymentInitiationResult ? (
            <div className="space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Payment Order Initiated!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Reference: <span className="font-mono font-bold text-emerald-600">{paymentInitiationResult.payment.transactionReference}</span>
                </p>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  Amount: {Number(paymentInitiationResult.payment.amount).toFixed(2)} {paymentInitiationResult.payment.currency}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Payment Instructions:
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {paymentInitiationResult.providerResult?.instructions?.instruction ||
                    'Deposit or transfer the exact amount using the reference code above. Keep the transaction slip and upload it in the payments tab.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setPayingMembership(null)}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center justify-center gap-1.5"
                  onClick={() => {
                    setPayingMembership(null);
                    router.push('/app/payments');
                  }}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload Proof Now
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Plan Amount:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Number(payingMembership?.membershipPlan.price).toFixed(2)} {payingMembership?.membershipPlan.currency}
                  </span>
                </div>
                {Number(payingMembership?.membershipPlan.registrationFee) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Registration Fee:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {Number(payingMembership?.membershipPlan.registrationFee).toFixed(2)} {payingMembership?.membershipPlan.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-slate-200 dark:border-slate-700 text-emerald-600">
                  <span>Authoritative Total:</span>
                  <span className="font-mono text-base">
                    {(
                      Number(payingMembership?.membershipPlan.price) +
                      Number(payingMembership?.membershipPlan.registrationFee || 0)
                    ).toFixed(2)}{' '}
                    {payingMembership?.membershipPlan.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Payment Method
                </label>
                {paymentMethods.length > 0 ? (
                  <div className="space-y-2">
                    {paymentMethods.map((pm) => (
                      <label
                        key={pm.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedMethodId === pm.id
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={pm.id}
                            checked={selectedMethodId === pm.id}
                            onChange={() => setSelectedMethodId(pm.id)}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <p className="font-medium text-xs text-slate-900 dark:text-white">
                              {pm.name}
                            </p>
                            <p className="text-[11px] text-slate-500 uppercase font-mono">
                              {pm.type}
                            </p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Loading available payment methods...</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  onClick={() => setPayingMembership(null)}
                  disabled={isInitiatingPayment}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmPayment}
                  disabled={isInitiatingPayment || !selectedMethodId}
                  isLoading={isInitiatingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isInitiatingPayment ? 'Initiating Order...' : 'Proceed with Order'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
