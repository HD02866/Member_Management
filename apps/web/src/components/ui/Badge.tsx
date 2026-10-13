import React from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'neutral'
  | 'registered'
  | 'active'
  | 'pending';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant,
  status,
  ...props
}) => {
  // Infer variant from status if provided
  let determinedVariant: BadgeVariant = variant || 'neutral';

  if (status) {
    const s = status.toUpperCase();
    if (s === 'ACTIVE' || s === 'APPROVED' || s === 'PUBLISHED') {
      determinedVariant = 'success';
    } else if (
      s === 'REGISTERED' ||
      s === 'PAYMENT_PENDING' ||
      s === 'UNDER_REVIEW' ||
      s === 'PENDING_APPROVAL' ||
      s === 'PENDING'
    ) {
      determinedVariant = 'warning';
    } else if (s === 'EXPIRED' || s === 'SUSPENDED' || s === 'REJECTED' || s === 'CANCELLED') {
      determinedVariant = 'danger';
    } else if (s === 'ADMIN' || s === 'STAFF') {
      determinedVariant = 'info';
    }
  }

  const styles = {
    success:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    warning:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    danger:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    neutral:
      'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300 border-surface-200 dark:border-surface-700',
    registered:
      'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    active:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    pending:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide uppercase',
        styles[determinedVariant],
        className,
      )}
      {...props}
    >
      {children || status}
    </span>
  );
};
