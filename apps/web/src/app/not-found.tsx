import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, Building2, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        {/* Visual Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 dark:bg-amber-950/40 border border-brand-100 dark:border-amber-900/50 mb-6 shadow-xs">
          <Search className="w-8 h-8 text-brand-600 dark:text-amber-400" />
        </div>

        <div className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-amber-400 mb-2">
          404 Not Found
        </div>

        <h1 className="text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight mb-3">
          Page Not Found
        </h1>

        <p className="text-surface-600 dark:text-surface-400 text-sm leading-relaxed mb-8">
          The page or organization resource you are looking for doesn&apos;t exist, has been relocated, or is temporarily unavailable.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-xs"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>

          <Link
            href="/organizations"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            <Building2 className="w-4 h-4" />
            <span>Browse Organizations</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
