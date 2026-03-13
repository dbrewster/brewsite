// apps/examples/src/slides-demo/SlidesDemoPage.tsx
// Enterprise slide deck demo — showcases @brewsite/slides with the enterprise
// dark theme, bar progress indicator, and full navigation controls.

import { useEffect, useRef, useState, type JSX } from 'react';
import { SlidePlayer, getDeckThemeForFamily } from '@brewsite/slides';
import type { DeckTheme, ProgressStyle } from '@brewsite/slides';
import type { ThemeFamily } from '@brewsite/core';
import { demoSlides } from './deck';

// ─── Theme options ──────────────────────────────────────────────────────────

type ThemeOption = {
  label: string;
  family: ThemeFamily;
  polarity: 'dark' | 'light';
};

const THEME_OPTIONS: ThemeOption[] = [
  { label: 'Midnight Dark', family: 'midnight', polarity: 'dark' },
  { label: 'Midnight Light', family: 'midnight', polarity: 'light' },
  { label: 'Neon Cyber', family: 'neonCyber', polarity: 'dark' },
  { label: 'Dark Glass', family: 'darkGlass', polarity: 'dark' },
  { label: 'Light Canvas', family: 'lightCanvas', polarity: 'light' },
  { label: 'Light Minimal', family: 'lightMinimal', polarity: 'light' },
];

const PROGRESS_OPTIONS: { label: string; value: ProgressStyle }[] = [
  { label: 'Bar', value: 'bar' },
  { label: 'Dots', value: 'dots' },
  { label: 'Numbers', value: 'numbers' },
  { label: 'None', value: 'none' },
];

export default function SlidesDemoPage(): JSX.Element {
  const [themeIndex, setThemeIndex] = useState(0);
  const [progressStyle, setProgressStyle] = useState<ProgressStyle>('bar');
  const [showControls, setShowControls] = useState(true);
  const [slideInfo, setSlideInfo] = useState({ index: 0, key: 'title' });

  const selected = THEME_OPTIONS[themeIndex]!;
  const theme: DeckTheme = getDeckThemeForFamily(selected.family, selected.polarity);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: theme.background.color,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      {showControls && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.5rem 1rem',
          background: theme.colorMode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${theme.colorMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          zIndex: 100,
          flexShrink: 0,
          fontFamily: theme.fonts.heading,
          fontSize: '0.8rem',
          color: theme.colors.body,
        }}>
          <span style={{ fontWeight: 700, color: theme.colors.heading, fontSize: '0.85rem' }}>
            @brewsite/slides
          </span>
          <span style={{ color: theme.colors.muted }}>|</span>

          {/* Theme selector */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Theme:
            <select
              value={themeIndex}
              onChange={(e) => setThemeIndex(Number(e.target.value))}
              style={{
                background: theme.colors.surface,
                color: theme.colors.heading,
                border: `1px solid ${theme.colors.muted}44`,
                borderRadius: '0.25rem',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
              }}
            >
              {THEME_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </label>

          {/* Progress style */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Progress:
            <select
              value={progressStyle}
              onChange={(e) => setProgressStyle(e.target.value as ProgressStyle)}
              style={{
                background: theme.colors.surface,
                color: theme.colors.heading,
                border: `1px solid ${theme.colors.muted}44`,
                borderRadius: '0.25rem',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                fontFamily: 'inherit',
              }}
            >
              {PROGRESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <span style={{ color: theme.colors.muted }}>|</span>
          <span style={{ fontSize: '0.75rem', color: theme.colors.muted }}>
            Slide {slideInfo.index + 1} / {demoSlides.length}
          </span>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: '0.7rem', color: theme.colors.muted }}>
            Arrow keys / Click / Swipe to navigate &middot; F for fullscreen &middot; Press H to toggle this bar
          </span>
        </div>
      )}

      {/* Player container */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SlidePlayer
          key={`${selected.family}-${selected.polarity}`}
          theme={theme}
          progressIndicator={progressStyle}
          transition="dissolve"
          aspectRatio={16 / 9}
          navigation={{ keyboard: true, touch: true, pointer: true }}
          onSlideChange={(index, key) => setSlideInfo({ index, key })}
        >
          {demoSlides}
        </SlidePlayer>
      </div>

      {/* H key toolbar toggle */}
      <ToolbarToggle onToggle={() => setShowControls((v) => !v)} />
    </div>
  );
}

/** Listens for 'H' key to toggle the toolbar via a proper useEffect. */
function ToolbarToggle({ onToggle }: { onToggle: () => void }): null {
  const cbRef = useRef(onToggle);
  cbRef.current = onToggle;

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'h' || e.key === 'H') {
        if ((e.target as HTMLElement).tagName === 'SELECT') return;
        cbRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
