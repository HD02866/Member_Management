import React from 'react';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';

export default function AppLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-200 dark:border-surface-800 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface-200 dark:bg-surface-800 rounded-lg" />
          <div className="h-4 w-72 bg-surface-100 dark:bg-surface-800/60 rounded-md" />
        </div>
        <div className="h-9 w-40 bg-surface-200 dark:bg-surface-800 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="h-64 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-100/50 dark:bg-surface-900/50" />
    </div>
  );
}
