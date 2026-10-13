import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-surface-700 dark:text-surface-300"
          >
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-sm">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={clsx(
              'block w-full rounded-lg border text-sm',
              'transition-[border-color,box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none',
              'bg-white dark:bg-surface-900',
              'text-surface-900 dark:text-surface-100 placeholder:text-surface-400',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
              leftIcon ? 'pl-10' : 'pl-3.5',
              rightIcon ? 'pr-10' : 'pr-3.5',
              'py-2',
              error
                ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500 focus:border-rose-500'
                : 'border-surface-300 dark:border-surface-700 hover:border-surface-400 dark:hover:border-surface-600',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-surface-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-500 font-medium">{error}</p>
        ) : hint ? (
          <p className="text-xs text-surface-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
