'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { Building2, ChevronDown, Check, ShieldCheck, User } from 'lucide-react';

export const OrganizationSwitcher: React.FC = () => {
  const { organizations, activeOrg, switchOrganization } = useAuth();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (organizations.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors shadow-2xs"
      >
        <Building2 className="w-3.5 h-3.5 text-brand-600 shrink-0" />
        <span className="max-w-[140px] truncate font-semibold">
          {activeOrg?.name || t('switcher.title')}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-surface-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl ring-1 ring-black/5 z-50 overflow-hidden divide-y divide-surface-100 dark:divide-surface-800">
          <div className="px-4 py-2.5 bg-surface-50/70 dark:bg-surface-950/40">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">
              {t('switcher.title')}
            </p>
          </div>

          <div className="py-1 max-h-60 overflow-y-auto">
            {organizations.map((org) => {
              const isSelected = activeOrg?.id === org.id;
              return (
                <button
                  key={org.id}
                  onClick={() => {
                    switchOrganization(org.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-xs transition-colors hover:bg-surface-50 dark:hover:bg-surface-800 ${
                    isSelected ? 'bg-brand-50/60 dark:bg-brand-950/30' : ''
                  }`}
                >
                  <div className="flex flex-col">
                    <span
                      className={`font-semibold ${
                        isSelected
                          ? 'text-brand-700 dark:text-brand-300'
                          : 'text-surface-900 dark:text-surface-100'
                      }`}
                    >
                      {org.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-surface-400">
                      {org.isStaff ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400">
                          <ShieldCheck className="w-3 h-3" />
                          {org.staffRole || 'Staff'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-surface-500">
                          <User className="w-3 h-3" />
                          {org.memberNumber || 'Member'}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
