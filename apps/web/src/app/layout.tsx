import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '../providers/AppProviders';
import { Navbar } from '../components/ui/Navbar';
import { Footer } from '../components/ui/Footer';

export const metadata: Metadata = {
  title: '4Baye — Official Digital Platform',
  description:
    'The official digital membership, verification, and community operations platform for 4Baye Association.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased selection:bg-brand-500 selection:text-white bg-[var(--background)] text-[var(--foreground)]">
        <AppProviders>
          {/* Global Decorative Dot-Field Background */}
          <div className="app-dot-bg" aria-hidden="true" />
          {/* Application Content Layer */}
          <div className="relative z-10 flex-1 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
