'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useI18n, Language } from '../../lib/i18n';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageOption {
  code: Language;
  label: string;
  nativeName: string;
  badge: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeName: 'English', badge: 'EN' },
  { code: 'om', label: 'Afaan Oromoo', nativeName: 'Afaan Oromoo', badge: 'OM' },
  { code: 'am', label: 'Amharic', nativeName: 'አማርኛ', badge: 'AM' },
];

export const LanguageSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Language) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className || ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select Language"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 text-xs font-medium text-surface-700 dark:text-surface-200 hover:text-surface-950 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer"
      >
        <Globe className="w-3.5 h-3.5 text-surface-500 dark:text-surface-400" />
        <span className="font-semibold">{current.badge}</span>
        <span className="hidden sm:inline text-surface-500 dark:text-surface-400 font-normal">
          · {current.nativeName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute right-0 mt-1.5 w-48 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-lg py-1 z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {LANGUAGES.map((item) => {
            const isSelected = item.code === language;
            return (
              <button
                key={item.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                    : 'text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 px-1 py-0.5 rounded text-[10px] font-bold text-center bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                    {item.badge}
                  </span>
                  <span>{item.nativeName}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
