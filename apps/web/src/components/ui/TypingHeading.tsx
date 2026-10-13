'use client';

import React, { useEffect, useState } from 'react';

export interface TypingHeadingProps {
  prefix?: string;
  phrases: string[];
  className?: string;
}

export const TypingHeading: React.FC<TypingHeadingProps> = ({
  prefix = '',
  phrases,
  className = '',
}) => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState(phrases[0] || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsReducedMotion(true);
      setDisplayedText(phrases[0] || '');
    }
  }, [phrases]);

  useEffect(() => {
    if (isReducedMotion || phrases.length <= 1) return;

    const currentPhrase = phrases[currentPhraseIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      if (displayedText.length < currentPhrase.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
        }, 50);
      } else {
        // Pause at full phrase
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(currentPhrase.slice(0, displayedText.length - 1));
        }, 25);
      } else {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentPhraseIndex, phrases, isReducedMotion]);

  const fullHeadline = `${prefix} ${phrases[0] || ''}`.trim();

  return (
    <h1 className={className}>
      {/* Accessible screen reader text */}
      <span className="sr-only">{fullHeadline}</span>

      {/* Visual animated text */}
      <span aria-hidden="true">
        {prefix && <span>{prefix} </span>}
        <span className="bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-amber-400 dark:to-amber-200 bg-clip-text text-transparent">
          {displayedText}
        </span>
        {!isReducedMotion && (
          <span className="inline-block ml-1 w-0.5 h-[0.9em] bg-brand-500 dark:bg-amber-400 animate-pulse align-middle" />
        )}
      </span>
    </h1>
  );
};
