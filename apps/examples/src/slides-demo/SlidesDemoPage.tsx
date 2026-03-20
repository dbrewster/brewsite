// apps/examples/src/slides-demo/SlidesDemoPage.tsx
// Enterprise slide deck demo — showcases @brewsite/slides with the enterprise
// dark theme, bar progress indicator, and full navigation controls.

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { SlidePlayer, getDeckThemeForFamily, DECK_THEME_PAIRS } from '@brewsite/slides';
import type { DeckTheme, ProgressStyle } from '@brewsite/slides';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';
import { ExampleHeader } from '../ExampleHeader';
import { ThemeToggle } from '../Lights';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
import { themesPlugin } from '@brewsite/themes';
import { demoSlides } from './deck';
import { useThemeCss } from '../hooks/useThemeCss';

// Stable plugin instances — must be created outside the component to avoid
// reference instability that causes infinite driver rebuilds.
const extraPlugins = [diagramPlugin(), chartPlugin(), themesPlugin()];

const PROGRESS_OPTIONS: { label: string; value: ProgressStyle }[] = [
  { label: 'Bar', value: 'bar' },
  { label: 'Dots', value: 'dots' },
  { label: 'Numbers', value: 'numbers' },
  { label: 'None', value: 'none' },
];

export default function SlidesDemoPage(): JSX.Element {
  const [family, setFamily] = useState<ThemeFamily>('enterprise');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const [progressStyle, setProgressStyle] = useState<ProgressStyle>('bar');
  const [showControls, setShowControls] = useState(true);
  const [slideInfo, setSlideInfo] = useState({ index: 0, key: 'title' });
  useThemeCss(family, polarity);

  const theme: DeckTheme = useMemo(
    () => getDeckThemeForFamily(family, polarity),
    [family, polarity],
  );

  return (
    <div className="ex-page" style={{ width: '100vw' }}>
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          initialFamily="enterprise"
          initialPolarity="dark"
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>

      {/* Hide keyboard-only hints on touch/narrow screens */}
      <style>{`
        @media (max-width: 640px) { .slides-keyboard-hint { display: none !important; } }
      `}</style>

      {/* Toolbar — progress style + slide info */}
      {showControls && (
        <div className="ex-toolbar">
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
        <SlidePlayer
          key={`${family}-${polarity}`}
          theme={theme}
          plugins={extraPlugins}
          progressIndicator={progressStyle}
          transition="dissolve"
          aspectRatio={9 / 9}
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
