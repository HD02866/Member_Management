'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './Button';
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  UserCheck,
  Users,
  CreditCard,
  CheckCircle2,
  Bell,
  FileText,
  Shield,
  Settings,
  User as UserIcon,
  Award,
  BookOpen,
  Megaphone,
  PhoneCall,
  DollarSign,
  MessageSquare,
  MessageCircle,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, activeOrg } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isOrgStaff = !!activeOrg?.isStaff;
  const isAppRoute = pathname.startsWith('/app');

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-surface-200 dark:border-surface-800 bg-white/95 dark:bg-surface-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 4Baye Logo / Branding */}
          <div className="flex items-center gap-6">
            <Link
              href={isAuthenticated ? '/app/dashboard' : '/'}
              className="flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white font-extrabold text-base shadow-sm">
                4B
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-surface-950 to-surface-700 dark:from-white dark:to-surface-300 bg-clip-text text-transparent">
                  4Baye
                </span>
                {isAuthenticated && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-amber-400">
                    {isOrgStaff ? 'Owner / Admin' : 'Member Portal'}
                  </span>
                )}
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center space-x-1 text-sm font-medium">
              {!isAuthenticated ? (
                /* PUBLIC VISITOR NAVIGATION */
                <>
                  <Link
                    href="/"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    Home
                  </Link>
                  <Link
                    href="/about"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/about'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {t('nav.about')}
                  </Link>
                  <Link
                    href="/membership"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/membership'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {t('nav.pricing')}
                  </Link>
                  <Link
                    href="/benefits"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/benefits'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {t('nav.benefits')}
                  </Link>
                  <Link
                    href="/programs"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/programs'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {t('nav.programs')}
                  </Link>
                  <Link
                    href="/announcements"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/announcements'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {t('nav.announcements')}
                  </Link>
                  <Link
                    href="/contact"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      pathname === '/contact'
                        ? 'text-brand-600 dark:text-amber-400 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {t('nav.contact')}
                  </Link>
                </>
              ) : isOrgStaff ? (
                /* EXPERIENCE 1: 4BAYE OWNER / ADMIN */
                <>
                  <Link
                    href="/app/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/dashboard'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-brand-600" />
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    href="/app/members"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/members'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Users className="w-4 h-4 text-brand-600" />
                    {t('nav.membersRoster')}
                  </Link>
                  <Link
                    href="/app/staff"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/staff'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-brand-600" />
                    Staff
                  </Link>
                  <Link
                    href="/app/finance/reviews"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/finance/reviews'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {t('nav.finance')}
                  </Link>
                  <Link
                    href="/app/organization"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/organization'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-brand-600" />
                    {t('nav.cms')}
                  </Link>
                  <Link
                    href="/app/card"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/card'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-brand-600" />
                    Digital ID
                  </Link>
                  <Link
                    href="/app/messages"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname.startsWith('/app/messages')
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-brand-600" />
                    Messages
                  </Link>
                  <Link
                    href="/app/groups"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname.startsWith('/app/groups')
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4 text-brand-600" />
                    Groups
                  </Link>
                  <Link
                    href="/app/notifications"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/notifications'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    Alerts
                  </Link>
                  <Link
                    href="/app/settings"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/settings'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    {t('nav.settings')}
                  </Link>
                </>
              ) : (
                /* EXPERIENCE 2: 4BAYE MEMBER */
                <>
                  <Link
                    href="/app/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/dashboard'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-brand-600" />
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    href="/app/membership"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/membership'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-brand-600" />
                    {t('nav.membership')}
                  </Link>
                  <Link
                    href="/app/card"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/card'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-brand-600" />
                    Digital ID
                  </Link>
                  <Link
                    href="/app/messages"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname.startsWith('/app/messages')
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-brand-600" />
                    Messages
                  </Link>
                  <Link
                    href="/app/groups"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname.startsWith('/app/groups')
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4 text-brand-600" />
                    Groups
                  </Link>
                  <Link
                    href="/app/payments"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/payments'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <DollarSign className="w-4 h-4 text-brand-600" />
                    Dues & Payments
                  </Link>
                  <Link
                    href="/benefits"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/benefits'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Award className="w-4 h-4 text-brand-600" />
                    {t('nav.benefits')}
                  </Link>
                  <Link
                    href="/programs"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/programs'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-brand-600" />
                    {t('nav.programs')}
                  </Link>
                  <Link
                    href="/announcements"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/announcements'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Megaphone className="w-4 h-4 text-brand-600" />
                    {t('nav.announcements')}
                  </Link>
                  <Link
                    href="/app/profile"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/profile'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <UserIcon className="w-4 h-4" />
                    {t('nav.profile')}
                  </Link>
                  <Link
                    href="/app/notifications"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/notifications'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    Alerts
                  </Link>
                  <Link
                    href="/app/settings"
                    className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                      pathname === '/app/settings'
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    {t('nav.settings')}
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <LanguageToggle />

            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-2 border-l border-surface-200 dark:border-surface-800">
                {!isAppRoute && (
                  <Link href="/app/dashboard">
                    <Button size="sm" variant="secondary">
                      {t('nav.dashboard')}
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => logout()}
                  aria-label="Logout"
                  title={t('common.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button size="sm" variant="ghost">
                    {t('common.login')}
                  </Button>
                </Link>
                <div className="cta-glow-wrapper">
                  <Link href="/register">
                    <Button size="sm" variant="primary">
                      {t('common.register')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950 px-4 pt-2 pb-6 space-y-3">
          {isAuthenticated ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-surface-400 border-b border-surface-100 dark:border-surface-800 mb-2">
                {isOrgStaff ? '4Baye Owner / Admin' : '4Baye Member'}
              </div>

              <Link
                href="/app/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <LayoutDashboard className="w-4 h-4" />
                {t('nav.dashboard')}
              </Link>

              {isOrgStaff ? (
                <>
                  <Link
                    href="/app/members"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <Users className="w-4 h-4" />
                    {t('nav.membersRoster')}
                  </Link>
                  <Link
                    href="/app/staff"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <Shield className="w-4 h-4" />
                    Staff
                  </Link>
                  <Link
                    href="/app/finance/reviews"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {t('nav.finance')}
                  </Link>
                  <Link
                    href="/app/organization"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <FileText className="w-4 h-4" />
                    {t('nav.cms')}
                  </Link>
                  <Link
                    href="/app/card"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <CreditCard className="w-4 h-4" />
                    Digital ID
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/app/membership"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <UserCheck className="w-4 h-4" />
                    {t('nav.membership')}
                  </Link>
                  <Link
                    href="/app/card"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <CreditCard className="w-4 h-4" />
                    Digital ID
                  </Link>
                  <Link
                    href="/app/payments"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <DollarSign className="w-4 h-4" />
                    Dues & Payments
                  </Link>
                  <Link
                    href="/benefits"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <Award className="w-4 h-4" />
                    {t('nav.benefits')}
                  </Link>
                  <Link
                    href="/programs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <BookOpen className="w-4 h-4" />
                    {t('nav.programs')}
                  </Link>
                  <Link
                    href="/announcements"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                  >
                    <Megaphone className="w-4 h-4" />
                    {t('nav.announcements')}
                  </Link>
                </>
              )}

              <Link
                href="/app/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <Bell className="w-4 h-4" />
                Alerts
              </Link>
              <Link
                href="/app/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <UserIcon className="w-4 h-4" />
                {t('nav.profile')}
              </Link>
              <Link
                href="/app/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <Settings className="w-4 h-4" />
                {t('nav.settings')}
              </Link>

              <Button
                variant="outline"
                className="w-full mt-4 justify-start text-rose-600 dark:text-rose-400"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('common.logout')}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  Home
                </Link>
                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  {t('nav.about')}
                </Link>
                <Link
                  href="/membership"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  {t('nav.pricing')}
                </Link>
                <Link
                  href="/benefits"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  {t('nav.benefits')}
                </Link>
                <Link
                  href="/programs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  {t('nav.programs')}
                </Link>
                <Link
                  href="/announcements"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  {t('nav.announcements')}
                </Link>
                <Link
                  href="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  {t('nav.contact')}
                </Link>
              </div>

              <div className="pt-4 border-t border-surface-100 dark:border-surface-800 flex flex-col gap-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full" variant="outline">
                    {t('common.login')}
                  </Button>
                </Link>
                <div className="cta-glow-wrapper w-full">
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="w-full">
                    <Button className="w-full" variant="primary">
                      {t('common.register')}
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
};
