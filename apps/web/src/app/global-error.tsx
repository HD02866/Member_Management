'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root Layout Global Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans antialiased">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 mb-6">
            <span className="text-2xl">⚠️</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-2">
            Critical Application Error
          </h1>

          <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
            The application encountered a critical system error while loading the root layout.
          </p>

          {error.digest && (
            <p className="text-xs font-mono text-stone-500 mb-6 select-all">
              Reference ID: {error.digest}
            </p>
          )}

          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all duration-150 cursor-pointer shadow-xs"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
