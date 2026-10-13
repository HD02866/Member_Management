import React from 'react';
import { CardSkeleton } from '../components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-8 w-64 bg-surface-200 dark:bg-surface-800 rounded-lg" />
        <div className="h-4 w-96 max-w-full bg-surface-100 dark:bg-surface-800/60 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
