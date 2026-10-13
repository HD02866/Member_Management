import React from 'react';
import { clsx } from 'clsx';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xs transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:border-surface-300 dark:hover:border-surface-700 motion-reduce:transform-none motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx('p-5 border-b border-surface-100 dark:border-surface-800', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3
      className={clsx(
        'text-base font-semibold text-surface-900 dark:text-surface-100 leading-none tracking-tight',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p className={clsx('text-sm text-surface-500 mt-1.5', className)} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={clsx('p-5', className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'p-5 border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50 rounded-b-xl flex items-center justify-between',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
