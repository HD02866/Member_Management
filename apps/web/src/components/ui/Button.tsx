import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  ...props
}) => {
  const baseStyles = clsx(
    'group inline-flex items-center justify-center font-medium rounded-lg select-none',
    // 150ms smooth transition on transform, colors, shadow, opacity
    'transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out',
    // Recognizable physical response: subtle upward lift on hover
    'hover:-translate-y-0.5 hover:shadow-sm',
    // Press tactile feedback (80-120ms): settle down and slight scale
    'active:translate-y-0 active:scale-[0.98] active:duration-75',
    // Accessible focus indicator
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-950',
    // Disabled state: clearly visible, non-interactive, no hover/press motion
    'disabled:opacity-50 disabled:pointer-events-none disabled:transform-none disabled:shadow-none cursor-pointer disabled:cursor-not-allowed',
    // Reduced-motion support
    'motion-reduce:transform-none motion-reduce:hover:translate-y-0 motion-reduce:transition-none',
  );

  const variants = {
    primary: clsx(
      'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-xs hover:shadow-md focus-visible:ring-brand-500',
      'dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-stone-950 dark:font-semibold dark:shadow-amber-500/20 dark:hover:shadow-amber-500/30 dark:active:bg-amber-600',
    ),
    secondary: clsx(
      'bg-surface-200 text-surface-900 hover:bg-surface-300 dark:bg-surface-800 dark:text-surface-100 dark:hover:bg-surface-700 active:bg-surface-300 dark:active:bg-surface-700 border border-transparent dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 focus-visible:ring-surface-400',
    ),
    outline: clsx(
      'border border-surface-300 dark:border-surface-700 bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-900 dark:text-surface-100 hover:border-brand-500 dark:hover:border-amber-400 active:bg-surface-200 dark:active:bg-surface-800 focus-visible:ring-brand-500',
    ),
    ghost: clsx(
      'bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 hover:text-surface-950 dark:hover:text-white active:bg-surface-200 dark:active:bg-surface-700 focus-visible:ring-surface-400',
    ),
    danger: clsx(
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs hover:shadow-md focus-visible:ring-rose-500',
    ),
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-2.5 gap-2.5',
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0 motion-reduce:animate-none" />
      ) : (
        leftIcon && (
          <span className="shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5 motion-reduce:group-hover:translate-x-0">
            {leftIcon}
          </span>
        )
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="shrink-0 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0">
          {rightIcon}
        </span>
      )}
    </button>
  );
};
