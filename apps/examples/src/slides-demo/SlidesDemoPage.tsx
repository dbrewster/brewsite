// apps/examples/src/slides-demo/SlidesDemoPage.tsx
// Enterprise slide deck demo — showcases @brewsite/slides with the new Phase 1B
// layout DSL, three-axis theming (SceneTheme + SlideTheme + SlideTemplate),
// section dividers, entrance animations, graphics components, and 3D sceneDsl.

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  SlidePlayer,
  slidesPlugin,
  defaultSlideTheme,
  compactSlideTheme,
  cinematicSlideTheme,
  minimalSlideTheme,
} from '@brewsite/slides';
import type { ProgressStyle, SlideTheme, SlideTemplate } from '@brewsite/slides';
import { SceneEngine, corePlugin } from '@brewsite/core';
import type { ThemeFamily, ThemePolarity, ActiveTheme } from '@brewsite/core';
import { ExampleHeader } from '../ExampleHeader';
import { ThemeToggle } from '../Lights';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import { themesPlugin } from '@brewsite/themes';
import { demoSlides } from './deck';
import { useThemeCss } from '../hooks/useThemeCss';

// Stable plugin instances — must be created outside the component to avoid
// reference instability that causes infinite driver rebuilds.
const plugins = [corePlugin(), slidesPlugin(), diagramPlugin(), chartPlugin(), themesPlugin()];

// ─── Slide Theme Presets ────────────────────────────────────────────────────

const SLIDE_THEME_OPTIONS: { label: string; value: SlideTheme }[] = [
  { label: 'Default', value: defaultSlideTheme },
  { label: 'Compact', value: compactSlideTheme },
  { label: 'Cinematic', value: cinematicSlideTheme },
  { label: 'Minimal', value: minimalSlideTheme },
];

const PROGRESS_OPTIONS: { label: string; value: ProgressStyle }[] = [
  { label: 'Dots', value: 'dots' },
  { label: 'Bar', value: 'bar' },
  { label: 'Numbers', value: 'numbers' },
  { label: 'None', value: 'none' },
];

// ─── Slide Template (corporate chrome) ──────────────────────────────────────

const nexusTemplate: SlideTemplate = {
  name: 'Nexus Platform',
  master: {
    footer: {
      text: 'Nexus Platform · Confidential',
      showPageNumbers: true,
      position: 'bottom-center',
      excludeLayouts: ['title'],
    },
  },
  defaultTransition: 'dissolve',
  defaultProgressIndicator: 'dots',
};

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SlidesDemoPage(): JSX.Element {
  const [family, setFamily] = useState<ThemeFamily>('enterprise');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const [slideThemeIndex, setSlideThemeIndex] = useState(0);
  const [progressStyle, setProgressStyle] = useState<ProgressStyle>('dots');
  const [showControls, setShowControls] = useState(true);
  const [slideInfo, setSlideInfo] = useState({ index: 0, key: 'title' });
  useThemeCss(family, polarity);

  const theme: ActiveTheme = useMemo(
    () => ({ family, polarity }),
    [family, polarity],
  );

  const slideTheme = SLIDE_THEME_OPTIONS[slideThemeIndex]!.value;

  const handleSlideChange = useCallback((index: number, key: string) => {
    setSlideInfo({ index, key });
  }, []);

  return (
    <div className="ex-page" style={{ width: '100vw' }}>
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          initialFamily="enterprise"
          initialPolarity="dark"
          persist
          style={{ position: 'static', zIndex: 'auto' }}
        />
      </ExampleHeader>

      {/* Hide keyboard-only hints on touch/narrow screens */}
      <style>{`
        @media (max-width: 640px) { .slides-keyboard-hint { display: none !important; } }
      `}</style>

      {/* Toolbar — theme/progress controls + slide info */}
      {showControls && (
        <div className="ex-toolbar">
          {/* Slide theme */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Feel:
            <select
              value={slideThemeIndex}
              onChange={(e) => setSlideThemeIndex(Number(e.target.value))}
              className="ex-select"
            >
              {SLIDE_THEME_OPTIONS.map((opt, i) => (
                <option key={opt.label} value={i}>{opt.label}</option>
              ))}
            </select>
          </label>

          <span className="ex-toolbar__muted">|</span>

          {/* Progress style */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Progress:
            <select
              value={progressStyle}
              onChange={(e) => setProgressStyle(e.target.value as ProgressStyle)}
              className="ex-select"
            >
              {PROGRESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <span className="ex-toolbar__muted">|</span>
          <span className="ex-toolbar__muted" style={{ fontSize: '0.75rem' }}>
            Slide {slideInfo.index + 1} / {demoSlides.length}
          </span>

          <div style={{ flex: 1 }} />

          <span className="slides-keyboard-hint ex-toolbar__hint">
            Arrow keys / Click / Swipe to navigate &middot; F for fullscreen &middot; Press H to toggle this bar
          </span>
        </div>
      )}

      {/* Player container */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SceneEngine
          key={`${family}-${polarity}`}
          plugins={plugins}
          theme={theme}
        >
          <SlidePlayer
            slideTheme={slideTheme}
            template={nexusTemplate}
            progressIndicator={progressStyle}
            transition="dissolve"
            aspectRatio={16 / 9}
            navigation={{ keyboard: true, touch: true, pointer: true }}
            onSlideChange={handleSlideChange}
          >
            {demoSlides}
          </SlidePlayer>
        </SceneEngine>
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
