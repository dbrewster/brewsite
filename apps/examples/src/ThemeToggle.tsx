// ThemeToggle.tsx — Theme family + polarity toggle widget.
// Extracted from Lights.tsx for reuse across example pages.

import { useCallback, useEffect, useState } from 'react';
import {
  clearSceneTrackCache,
  type ThemeFamily,
  type ThemePolarity,
} from '@brewsite/core';
import { bundles } from '@brewsite/themes';

// ─── Theme families — derived from registered bundles, no manual maintenance ──
const THEME_FAMILIES = Object.keys(bundles) as ThemeFamily[];

/** Convert a camelCase family key to a human-readable label. */
function familyLabel(family: string): string {
  return family
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ─── ThemeToggle ─────────────────────────────────────────────────────────────

export interface ThemeToggleProps {
  /** Called when polarity changes. */
  onPolarityChange: (polarity: ThemePolarity) => void;
  /** Called when family changes. */
  onFamilyChange: (family: ThemeFamily) => void;
  /** Initial polarity. Defaults to localStorage or 'dark'. */
  initialPolarity?: ThemePolarity;
  /** Initial family. Defaults to localStorage or 'darkGlass'. */
  initialFamily?: ThemeFamily;
  /** Persist selections to localStorage. */
  persist?: boolean;
  /** Override the wrapper div's inline styles (e.g. to remove absolute positioning). */
  style?: React.CSSProperties;
}

/**
 * Combined theme toggle: polarity (dark/light) button + family selector dropdown.
 * Positioned absolute at top-right. Calls clearSceneTrackCache() on each change
 * so the scene recompiles with the new theme.
 */
export const ThemeToggle = ({
  onPolarityChange,
  onFamilyChange,
  initialPolarity,
  initialFamily,
  persist = false,
  style: styleProp,
}: ThemeToggleProps) => {
  const [polarity, setPolarity] = useState<ThemePolarity>(
    initialPolarity ?? (localStorage.getItem('themePolarity') as ThemePolarity) ?? 'dark',
  );
  const [family, setFamily] = useState<ThemeFamily>(
    initialFamily ?? (localStorage.getItem('themeFamily') as ThemeFamily) ?? 'darkGlass',
  );

  useEffect(() => {
    if (!initialPolarity) {
      const pol = (localStorage.getItem('themePolarity') as ThemePolarity) || 'light'
      onPolarityChange(pol)
      setPolarity(pol)
    }
    if (!initialFamily) {
      const fam = (localStorage.getItem('themeFamily') as ThemeFamily) || 'darkGlass'
      onFamilyChange(fam)
      setFamily(fam)
    }
  }, [initialPolarity, initialFamily])

  const handlePolarityToggle = useCallback((): void => {
    clearSceneTrackCache();
    const next: ThemePolarity = polarity === 'dark' ? 'light' : 'dark';
    setPolarity(next);
    onPolarityChange(next);
    if (persist) localStorage.setItem('themePolarity', next);
  }, [polarity, onPolarityChange, persist]);

  const handleFamilyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    clearSceneTrackCache();
    const next = e.target.value as ThemeFamily;
    setFamily(next);
    onFamilyChange(next);
    if (persist) localStorage.setItem('themeFamily', next);
  }, [onFamilyChange, persist]);

  const isDark = polarity === 'dark';

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        ...styleProp,
      }}
    >
      {/* Family selector */}
      <select
        value={family}
        onChange={handleFamilyChange}
        aria-label="Theme family"
        className="ex-select ex-select--theme"
      >
        {THEME_FAMILIES.map((f) => (
          <option key={f} value={f}>{familyLabel(f)}</option>
        ))}
      </select>

      {/* Polarity toggle */}
      <button
        onClick={handlePolarityToggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="ex-polarity-toggle"
      >
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>
    </div>
  );
};

// ─── Legacy toggle (backward compat) ─────────────────────────────────────────

export interface LightDarkToggleProps {
  setPolarity: (polarity: ThemePolarity) => void;
  initialPolarity?: ThemePolarity;
  savePolarityInLocalStorage: boolean;
}

export const LightDarkToggle = ({initialPolarity, setPolarity, savePolarityInLocalStorage}: LightDarkToggleProps) => {
  const [polarity, setThemePolarity] = useState<ThemePolarity>(initialPolarity || (localStorage.getItem('themePolarity') as ThemePolarity) || 'light');

  useEffect(() => {
    if (!initialPolarity) {
      const pol = (localStorage.getItem('themePolarity') as ThemePolarity) || 'light'
      setThemePolarity(pol)
      setPolarity(pol)
    }
  }, [initialPolarity])

  const handlePolarityToggle = useCallback((): void => {
    clearSceneTrackCache();
    setThemePolarity((prev) => {
      const newPolarity: ThemePolarity = prev === 'dark' ? 'light' : 'dark';
      setPolarity(newPolarity);
      if (savePolarityInLocalStorage) {
        localStorage.setItem('themePolarity', newPolarity);
      }
      return newPolarity;
    });
  }, [setPolarity, savePolarityInLocalStorage]);

  return (
    <button
      onClick={handlePolarityToggle}
      aria-label={polarity === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="ex-polarity-toggle"
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 1000,
      }}
    >
      {polarity === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}
