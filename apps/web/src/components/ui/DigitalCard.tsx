'use client';

import React from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { ShieldCheck, AlertTriangle, RefreshCw, QrCode, ExternalLink, Calendar, User, Hash } from 'lucide-react';
import Link from 'next/link';

export interface DigitalCardData {
  id: string;
  cardNumber: string;
  cardVersion: number;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  issueDate: string;
  expirationDate: string;
  qrToken?: string;
  verificationUrl?: string;
  organization?: {
    name: string;
    slug: string;
    logoUrl?: string;
  };
  memberProfile?: {
    firstName: string;
    lastName: string;
    memberNumber: string;
    photoUrl?: string;
  };
  membership?: {
    membershipPlan?: {
      name: string;
    };
  };
}

interface DigitalCardProps {
  card: DigitalCardData;
  onRotate?: () => void;
  isRotating?: boolean;
}

export function DigitalCard({ card, onRotate, isRotating }: DigitalCardProps) {
  const isExpired = new Date(card.expirationDate) < new Date();
  const isActive = card.status === 'ACTIVE' && !isExpired;

  const statusVariant =
    card.status === 'ACTIVE' && !isExpired
      ? 'success'
      : card.status === 'REVOKED'
      ? 'danger'
      : 'warning';

  const verificationUrl = card.qrToken
    ? `/verify/${card.qrToken}`
    : card.verificationUrl || '#';

  return (
    <div className="max-w-md w-full mx-auto">
      {/* Physical Card Mockup */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white shadow-2xl border border-emerald-500/30 p-6 flex flex-col justify-between aspect-[1.586/1] min-h-[260px]">
        {/* Decorative background geometry */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Card Header: Organization Logo + Name & Status */}
        <div className="relative z-10 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {card.organization?.logoUrl ? (
              <img
                src={card.organization.logoUrl}
                alt={card.organization.name}
                className="w-10 h-10 rounded-lg object-contain bg-white/10 p-1 border border-white/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-lg text-white shadow-inner">
                {card.organization?.name?.charAt(0) || '4'}
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm tracking-wide text-white leading-tight">
                {card.organization?.name || '4Baye Association'}
              </h3>
              <p className="text-[11px] text-emerald-300 font-medium">Digital Membership ID</p>
            </div>
          </div>
          <Badge variant={statusVariant} className="shadow-sm">
            {isExpired && card.status === 'ACTIVE' ? 'EXPIRED' : card.status}
          </Badge>
        </div>

        {/* Card Body: Member Info, Photo & QR Code preview */}
        <div className="relative z-10 my-auto flex items-center justify-between py-2 gap-3">
          <div className="flex items-center gap-3">
            {/* Member Photo / Avatar */}
            {card.memberProfile?.photoUrl ? (
              <img
                src={card.memberProfile.photoUrl}
                alt={`${card.memberProfile.firstName} ${card.memberProfile.lastName}`}
                className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-400/40 shadow-md shrink-0 bg-slate-800"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center font-bold text-lg text-emerald-300 shadow-inner shrink-0">
                {card.memberProfile?.firstName?.[0] || 'M'}
                {card.memberProfile?.lastName?.[0] || ''}
              </div>
            )}

            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-mono">Member Name</p>
              <p className="font-semibold text-base sm:text-lg text-white tracking-tight leading-tight">
                {card.memberProfile
                  ? `${card.memberProfile.firstName} ${card.memberProfile.lastName}`
                  : 'Active Member'}
              </p>
              <div className="flex items-center space-x-2 pt-0.5 text-xs text-slate-300">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Hash className="w-3 h-3 text-emerald-400" />
                  {card.memberProfile?.memberNumber || 'N/A'}
                </span>
                <span>•</span>
                <span className="font-medium text-emerald-300 text-[11px] truncate max-w-[120px]">
                  {card.membership?.membershipPlan?.name || 'Standard Plan'}
                </span>
              </div>
            </div>
          </div>


          {/* QR Code Container */}
          {card.qrToken && (
            <div className="bg-white p-2 rounded-xl shadow-lg border border-white/80 text-slate-900 flex flex-col items-center">
              {/* Minimal geometric QR mockup visual with link */}
              <Link href={verificationUrl} target="_blank" title="Scan to Verify">
                <div className="w-16 h-16 bg-slate-950 p-1 rounded flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                  <QrCode className="w-14 h-14 text-white" />
                </div>
              </Link>
              <span className="text-[9px] font-mono font-bold text-slate-600 mt-1 uppercase tracking-tighter">
                v{card.cardVersion} VERIFIED
              </span>
            </div>
          )}
        </div>

        {/* Card Footer: Card Number & Dates */}
        <div className="relative z-10 pt-2 border-t border-white/10 flex items-end justify-between text-[11px] text-slate-300">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Card ID</p>
            <p className="font-mono text-white tracking-widest font-semibold">{card.cardNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Valid Through</p>
            <p className="font-mono text-emerald-300 font-semibold">
              {new Date(card.expirationDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Card Controls & Actions */}
      <div className="mt-4 flex items-center justify-between gap-3 print:hidden">
        {card.qrToken && (
          <Link
            href={verificationUrl}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            <ShieldCheck className="w-4 h-4" />
            Public Verification Portal
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </Link>
        )}

        {onRotate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRotate}
            disabled={isRotating}
            className="ml-auto text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            Rotate Card Token
          </Button>
        )}
      </div>
    </div>
  );
}
