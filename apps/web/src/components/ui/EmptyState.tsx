import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="text-center py-12 px-4 rounded-xl border border-dashed border-surface-300 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/30">
      <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-surface-100 dark:bg-surface-800 text-surface-400 mb-3">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-medium text-surface-900 dark:text-surface-100">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-surface-500 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
