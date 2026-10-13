import React from 'react';
import { clsx } from 'clsx';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-md bg-surface-200 dark:bg-surface-800',
        className,
      )}
      {...props}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="border border-surface-200 dark:border-surface-800 rounded-xl p-5 space-y-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="pt-2 flex justify-between items-center">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
};

export const LoadingSkeleton: React.FC<{
  variant?: 'title' | 'card' | 'text';
  className?: string;
}> = ({ variant = 'text', className }) => {
  if (variant === 'title') {
    return <Skeleton className={clsx('h-8 w-48 mb-2', className)} />;
  }
  if (variant === 'card') {
    return <CardSkeleton />;
  }
  return <Skeleton className={clsx('h-4 w-full', className)} />;
};
