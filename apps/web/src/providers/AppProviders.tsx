'use client';

import React from 'react';
import { ThemeProvider } from '../lib/theme';
import { I18nProvider } from '../lib/i18n';
import { AuthProvider } from '../lib/auth';

export interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
};
