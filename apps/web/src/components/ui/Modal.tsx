'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  className = '',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const maxWidths: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    full: 'max-w-[calc(100vw-2rem)]',
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
    >
      {/* Backdrop: High contrast dark overlay without heavy blur trapping or text distortion */}
      <div
        className="fixed inset-0 bg-surface-950/75 dark:bg-black/80 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card: Viewport constrained flex column with min-h-0 to avoid overflow */}
      <div
        className={`relative w-full ${maxWidths[maxWidth] || 'max-w-lg'} max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col min-h-0 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-2xl z-10 overflow-hidden my-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky/Fixed Modal Header */}
        {(title || description) ? (
          <div className="p-4 sm:p-5 border-b border-surface-100 dark:border-surface-800 flex items-start justify-between shrink-0 bg-white dark:bg-surface-900">
            <div>
              {title && (
                <h3
                  id="modal-title"
                  className="text-base sm:text-lg font-bold text-surface-950 dark:text-surface-100 leading-tight"
                >
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-surface-500 mt-1 leading-normal">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors ml-3 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="absolute top-3 right-3 z-20">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable Body: Flex-1 with min-h-0 ensures clean scrolling inside modal body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 focus:outline-none">
          {children}
        </div>

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="p-4 sm:p-5 border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/50 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
