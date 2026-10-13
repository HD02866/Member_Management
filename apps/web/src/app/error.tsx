'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client exceptions for observability
    console.error('App Router Caught Error:', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        {/* Visual Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 mb-6 shadow-xs">
          <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
        </div>

        <div className="text-sm font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">
          Application Error
        </div>

        <h1 className="text-3xl font-extrabold text-surface-900 dark:text-surface-100 tracking-tight mb-3">
          Something went wrong
        </h1>

        <p className="text-surface-600 dark:text-surface-400 text-sm leading-relaxed mb-6">
          An unexpected error occurred while rendering this page. Our team has been notified. You can attempt to refresh the view or return to the main dashboard.
        </p>

        {error.digest && (
          <div className="mb-6 p-2 rounded bg-surface-100 dark:bg-surface-800 text-xs font-mono text-surface-500 dark:text-surface-400 select-all">
            Error ID: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-200 font-medium text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
