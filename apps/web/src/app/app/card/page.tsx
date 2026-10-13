'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { ApiClient } from '../../../lib/api';
import { DigitalCard, DigitalCardData } from '../../../components/ui/DigitalCard';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import { CardSkeleton } from '../../../components/ui/LoadingSkeleton';
import {
  CreditCard,
  RefreshCw,
  Printer,
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  User,
  CheckCircle2,
  Image,
  Download,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { generateDigitalIdPdf, downloadPdfBlob } from '../../../lib/pdf';


export default function MemberDigitalCardPage() {
  const { activeOrg, isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [card, setCard] = useState<DigitalCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rotation modal state
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotateReason, setRotateReason] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [rotateSuccess, setRotateSuccess] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);

  // PDF download state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  const fetchCard = async () => {
    if (!activeOrg?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await ApiClient.get<DigitalCardData>('/cards/me');
      setCard(res || null);
    } catch (err: any) {
      if (err.statusCode === 404 || err.status === 404) {
        setCard(null);
      } else {
        setError(err.message || 'Failed to retrieve digital membership card');
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
    if (activeOrg?.id) {
      fetchCard();
    }
  }, [authLoading, isAuthenticated, activeOrg?.id]);

  const handleRotateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg?.id) return;

    try {
      setIsRotating(true);
      setRotateError(null);
      const res = await ApiClient.post<{ card: DigitalCardData }>('/cards/rotate', {
        reason: rotateReason || 'Requested by member',
      });

      if (res?.card) {
        setCard(res.card);
        setRotateSuccess('Digital card rotated successfully! Your previous QR token has been invalidated.');
        setShowRotateModal(false);
        setRotateReason('');
      } else {
        setRotateError('Failed to rotate card token');
      }
    } catch (err: any) {
      setRotateError(err.message || 'Error occurred while rotating card');
    } finally {
      setIsRotating(false);
    }
  };

  const handlePrint = () => {
    const memberNum = card?.memberProfile?.memberNumber || card?.cardNumber || 'Member';
    const originalTitle = document.title;
    document.title = `4Baye-Digital-ID-${memberNum}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleDownloadPdf = async () => {
    if (!card) return;
    try {
      setIsDownloadingPdf(true);
      setError(null);

      const memberNum = card.memberProfile?.memberNumber || card.cardNumber || 'MEMBER';
      const filename = `4Baye-Digital-ID-${memberNum}.pdf`;

      const pdfData = {
        memberName: `${card.memberProfile?.firstName || ''} ${card.memberProfile?.lastName || ''}`.trim() || 'Active Member',
        memberNumber: card.memberProfile?.memberNumber || 'N/A',
        status: card.status || 'ACTIVE',
        organizationName: card.organization?.name || activeOrg?.name || '4Baye Association',
        planName: card.membership?.membershipPlan?.name || 'Standard Plan',
        cardNumber: card.cardNumber,
        expirationDate: new Date(card.expirationDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        issueDate: new Date(card.issueDate).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      };

      const photoUrl = card.memberProfile?.photoUrl;
      const pdfBytes = await generateDigitalIdPdf(pdfData, photoUrl);
      downloadPdfBlob(pdfBytes, filename);
    } catch (err: any) {
      console.error('[PDF Error]', err);
      setError('Failed to generate PDF document. Please try again or use the print option.');
    } finally {
      setIsDownloadingPdf(false);
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
      {/* Page Title & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Digital Membership ID
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official cryptographically verifiable identification card for {activeOrg?.name || 'your organization'}.
          </p>
        </div>

        {card && (
          <div className="flex items-center gap-3 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"
            >
              <Printer className="w-4 h-4" />
              Print Card
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isDownloadingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download ID (PDF)
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {rotateSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{rotateSuccess}</span>
          </div>
          <button
            onClick={() => setRotateSuccess(null)}
            className="text-xs font-bold text-emerald-700 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Card Content or Empty State */}
      {!card ? (
        <Card className="border-slate-200 dark:border-slate-800">
          <EmptyState
            icon={<CreditCard className="w-6 h-6" />}
            title="No Active Digital ID Issued"
            description="Your digital membership ID is automatically minted once your membership registration and payment are verified."
            action={
              <Button size="sm" onClick={() => router.push('/app/membership')}>
                View Membership & Payment Status
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Printable & Isolated Digital ID Container */}
          <div className="digital-id-print-area w-full space-y-6">
            {/* Primary Official Admin-Uploaded ID Card Section (Prominent if uploaded) */}
            {card.memberProfile?.photoUrl && (
              <Card className="border-emerald-500/30 dark:border-emerald-500/30 shadow-lg overflow-hidden bg-gradient-to-b from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
                <CardHeader className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-800 py-3.5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                          Official Digital Membership Card
                        </CardTitle>
                        <CardDescription className="text-[11px] text-slate-500">
                          Admin-issued verified membership credential document
                        </CardDescription>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Verified
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row items-center gap-8">
                    {/* Official ID Image Display Box (object-contain, readable, uncropped) */}
                    <div className="relative group w-full max-w-sm sm:max-w-md aspect-[1.586/1] rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-xl flex items-center justify-center">
                      <img
                        id="digital-id-member-image"
                        src={card.memberProfile.photoUrl}
                        alt={`Digital ID for ${card.memberProfile.firstName} ${card.memberProfile.lastName}`}
                        className="w-full h-full object-contain p-1"
                        onError={() => setImageLoadError(true)}
                      />
                      <a
                        href={card.memberProfile.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="print:hidden absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Full Size Image
                      </a>
                    </div>

                    {/* Member Credential Summary */}
                    <div className="w-full space-y-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                          Member Full Name
                        </span>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {card.memberProfile.firstName} {card.memberProfile.lastName}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                            Member ID
                          </span>
                          <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            {card.memberProfile.memberNumber || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                            Membership Plan
                          </span>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {card.membership?.membershipPlan?.name || 'Standard Plan'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                            Card Serial
                          </span>
                          <p className="font-mono text-slate-700 dark:text-slate-300">
                            {card.cardNumber}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                            Valid Through
                          </span>
                          <p className="font-mono font-semibold text-slate-900 dark:text-white">
                            {new Date(card.expirationDate).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        This digital identification is linked to your verified 4Baye membership record. Venue staff and event organizers can authenticate this document against the secure membership ledger.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cryptographic Digital Card Mockup & QR Token */}
            <div className="py-2">
              <DigitalCard
                card={card}
                onRotate={() => setShowRotateModal(true)}
                isRotating={isRotating}
              />
            </div>
          </div>

          {/* Security & Verification Guidelines */}
          <Card className="border-slate-200 dark:border-slate-800 print:hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-500" />
                Digital Credential Security
              </CardTitle>
              <CardDescription className="text-xs">
                Important instructions regarding the security and validity of your membership card.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <p>
                • <strong>Instant Verification:</strong> Venue security, partner organizations, and event organizers can scan your dynamic QR code using any smartphone camera to verify your membership status in real time.
              </p>
              <p>
                • <strong>Privacy by Design:</strong> Public verification reveals only your name, membership number, and validity status. Your contact information and sensitive personal data are never exposed.
              </p>
              <p>
                • <strong>Device Lost or Compromised?</strong> If you suspect someone has captured a screenshot or copy of your card, use the <em>Rotate Card Token</em> button above to immediately invalidate previous tokens and issue a fresh security cryptographic key.
              </p>
            </CardContent>
          </Card>

          {/* Supporting Official ID Document / Photo Section when pending upload */}
          {!card.memberProfile?.photoUrl && (
            <Card className="border-slate-200 dark:border-slate-800 print:hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-emerald-500" />
                    Official ID / Photo Document
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Pending Admin Upload
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Digital photo or physical membership document assigned by organization administrators.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                  <User className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    No physical ID photo has been uploaded yet
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
                    An organization administrator can upload your official photo or physical card copy from the Member Management console.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Rotate Token Modal */}
      <Modal
        isOpen={showRotateModal}
        onClose={() => setShowRotateModal(false)}
        title="Rotate Digital Membership Card"
        description="This will increment your card version and invalidate any previously printed or screenshotted QR verification tokens."
      >
        <form onSubmit={handleRotateCard} className="space-y-4">
          {rotateError && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
              {rotateError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason for Rotation (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Lost device, unauthorized screenshot, routine refresh"
              value={rotateReason}
              onChange={(e) => setRotateReason(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This reason will be recorded immutably in the organization audit trail.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowRotateModal(false)}
              disabled={isRotating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isRotating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isRotating ? 'Rotating Token...' : 'Confirm Card Rotation'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
