'use client';

import React from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/i18n';
import { ShieldCheck, Award, Mail, Phone, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useI18n();

  return (
    <footer className="border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                4B
              </div>
              <span className="text-lg font-bold tracking-tight text-surface-950 dark:text-white">
                4Baye Association
              </span>
            </div>
            <p className="text-sm text-surface-500 max-w-sm">
              {t('home.heroSubtitle')}
            </p>
            <div className="flex items-center gap-2 text-xs text-surface-400 pt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Official Cryptographic Digital Identity Verification</span>
            </div>
          </div>

          {/* Institutional Links */}
          <div className="space-y-3 text-sm">
            <h4 className="font-semibold text-surface-900 dark:text-surface-100">
              4Baye Association
            </h4>
            <ul className="space-y-2 text-surface-500">
              <li>
                <Link href="/about" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link href="/membership" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  {t('nav.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/benefits" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  {t('nav.benefits')}
                </Link>
              </li>
              <li>
                <Link href="/programs" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  {t('nav.programs')}
                </Link>
              </li>
              <li>
                <Link href="/announcements" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  {t('nav.announcements')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  {t('nav.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Member Access & Trust */}
          <div className="space-y-3 text-sm">
            <h4 className="font-semibold text-surface-900 dark:text-surface-100">
              Member Services
            </h4>
            <ul className="space-y-2 text-surface-500">
              <li>
                <Link href="/login" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  Member Portal Login
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-surface-900 dark:hover:text-surface-100 transition-colors">
                  New Member Registration
                </Link>
              </li>
              <li>Digital ID Card Verification</li>
              <li>Community Welfare Governance</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-surface-100 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between text-xs text-surface-400 gap-4">
          <p>© {new Date().getFullYear()} 4Baye Association. All rights reserved.</p>
          <p>Official Digital Membership Platform</p>
        </div>
      </div>
    </footer>
  );
};
