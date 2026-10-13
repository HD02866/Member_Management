'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ApiClient } from '../../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertOctagon,
  Calendar,
  Hash,
  Award,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface VerificationData {
  isValid: boolean;
  result: 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID';
  message: string;
  organization?: {
    name: string;
    slug: string;
    logoUrl?: string;
  };
  member?: {
    displayName: string;
    memberNumber: string;
    membershipPlan?: string;
    status?: string;
  };
  card?: {
    cardNumber: string;
    status: string;
    cardVersion?: number;
    issueDate?: string;
    expirationDate?: string;
  };
}

export default function PublicVerifyCardPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setLoading(false);
        setError('No verification token provided in request');
        return;
      }

      try {
        setLoading(true);
        // Direct public API call to /api/v1/verify/:token
        const res = await ApiClient.get<VerificationData>(`/verify/${token}`);
        if (res) {
          setData(res);
        } else {
          setError('Verification query returned no result');
        }
      } catch (err: any) {
        setError(err.message || 'Network error attempting to verify token');
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* 4Baye Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20 mb-3 font-bold text-lg">
            4B
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            4Baye Verification Portal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Official Cryptographic Digital ID Check
          </p>
        </div>

        {loading ? (
          <Card className="p-8 text-center shadow-lg border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Validating token against tenant authority...
            </p>
          </Card>
        ) : error || !data ? (
          <Card className="p-6 text-center border-red-200 dark:border-red-900/50 shadow-lg bg-red-50/50 dark:bg-red-950/20">
            <ShieldX className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Verification Query Failed</h2>
            <p className="text-xs text-red-600 dark:text-red-300 mt-2">{error || 'Unknown error occurred.'}</p>
          </Card>
        ) : (
          <Card className="shadow-xl overflow-hidden border-slate-200 dark:border-slate-800">
            {/* Verification Result Banner */}
            <div
              className={`p-6 text-center text-white ${
                data.isValid && data.result === 'VALID'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  : data.result === 'EXPIRED'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600'
                  : 'bg-gradient-to-r from-red-600 to-rose-700'
              }`}
            >
              {data.isValid && data.result === 'VALID' ? (
                <>
                  <CheckCircle2 className="w-14 h-14 mx-auto mb-2 text-white drop-shadow" />
                  <h2 className="text-xl font-extrabold tracking-wide uppercase">Verified Valid Member</h2>
                  <p className="text-xs text-emerald-100 font-medium mt-1">
                    Authentic credential recognized by organization authority
                  </p>
                </>
              ) : data.result === 'EXPIRED' ? (
                <>
                  <ShieldAlert className="w-14 h-14 mx-auto mb-2 text-white drop-shadow" />
                  <h2 className="text-xl font-extrabold tracking-wide uppercase">Membership Expired</h2>
                  <p className="text-xs text-amber-100 font-medium mt-1">
                    Card was previously valid but is past its expiration date
                  </p>
                </>
              ) : data.result === 'REVOKED' ? (
                <>
                  <ShieldX className="w-14 h-14 mx-auto mb-2 text-white drop-shadow" />
                  <h2 className="text-xl font-extrabold tracking-wide uppercase">Card Revoked</h2>
                  <p className="text-xs text-red-100 font-medium mt-1">
                    This credential has been invalidated or reported lost
                  </p>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-14 h-14 mx-auto mb-2 text-white drop-shadow" />
                  <h2 className="text-xl font-extrabold tracking-wide uppercase">Invalid Token</h2>
                  <p className="text-xs text-rose-100 font-medium mt-1">
                    Token is unrecognized, forged, or belongs to another system
                  </p>
                </>
              )}
            </div>

            <CardContent className="p-6 space-y-5">
              {/* Organization Info */}
              {data.organization && (
                <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  {data.organization.logoUrl ? (
                    <img
                      src={data.organization.logoUrl}
                      alt={data.organization.name}
                      className="w-10 h-10 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 p-1"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white">
                      {data.organization.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                      {data.organization.name}
                    </h3>
                    <p className="text-xs text-slate-500">Verified Organization Authority</p>
                  </div>
                </div>
              )}

              {/* Minimal Disclosure Member Details */}
              {data.member && (
                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Member Name
                    </span>
                    <p className="font-semibold text-lg text-slate-900 dark:text-white">
                      {data.member.displayName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <Hash className="w-3.5 h-3.5 text-emerald-500" />
                        Member ID
                      </div>
                      <p className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                        {data.member.memberNumber}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                        <Award className="w-3.5 h-3.5 text-emerald-500" />
                        Plan
                      </div>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                        {data.member.membershipPlan || 'Standard'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Meta details */}
              {data.card && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Card Identifier:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {data.card.cardNumber}
                    </span>
                  </div>
                  {data.card.expirationDate && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Expiration Date:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(data.card.expirationDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Privacy Notice */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/30 text-[11px] text-emerald-800 dark:text-emerald-300 text-center">
                🛡️ <strong>Minimal Disclosure Policy:</strong> Private contact details (email, phone, national ID) are never disclosed during public card scans.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            ← Back to 4Baye Home
          </Link>
        </div>
      </div>
    </div>
  );
}
