'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import om from '../locales/om.json';
import am from '../locales/am.json';

export type Language = 'en' | 'om' | 'am';

const translations: Record<Language, any> = { en, om, am };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  localize: (content: any) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (path) => path,
  localize: (content) => (typeof content === 'string' ? content : ''),
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('waanofii_lang') as Language;
      if (saved && (saved === 'en' || saved === 'om' || saved === 'am')) {
        setLanguageState(saved);
      }
    } catch {
      // LocalStorage unavailable in SSR
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('waanofii_lang', lang);
    } catch {
      // ignore
    }
  };

  const t = (path: string, fallback?: string): string => {
    const keys = path.split('.');
    let current: any = translations[language] || translations.en;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English
        let fallbackVal: any = translations.en;
        for (const fbKey of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && fbKey in fallbackVal) {
            fallbackVal = fallbackVal[fbKey];
          } else {
            return fallback || path;
          }
        }
        return typeof fallbackVal === 'string' ? fallbackVal : fallback || path;
      }
    }

    return typeof current === 'string' ? current : fallback || path;
  };

  const localize = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      if (content[language]) return content[language];
      if (content.en) return content.en;
      if (content.om) return content.om;
      if (content.am) return content.am;
      const values = Object.values(content);
      if (values.length > 0 && typeof values[0] === 'string') return values[0] as string;
    }
    return '';
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, localize }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
