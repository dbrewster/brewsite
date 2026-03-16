// CanvasRegionPage.tsx — Canvas Region embedding mode example.

import { type JSX, useEffect, useMemo, useState } from 'react';
import { SceneReel, InputCoordinator, type ThemeFamily, type ThemePolarity, type ActiveTheme } from '@brewsite/core';
import { createCanvasRegionPlugins } from './widgetSetup';
import { ViewerScene } from './scenes/viewerScene';
import { ThemeToggle } from '../Lights';

/** Returns true when the viewport is narrower than `breakpoint` px, updates on resize. */
function useIsMobile(breakpoint = 700): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const handler = (): void => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

const PAGE_STYLES = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#0a0a1a',
    color: '#e0e0e8',
    overflow: 'hidden',
  },
  canvasColumn: {
    flex: 1,
    position: 'relative' as const,
    minWidth: 0,
    minHeight: 0,
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginBottom: '1rem',
    color: '#fff',
  },
  paragraph: {
    fontSize: '0.9rem',
    lineHeight: 1.7,
    marginBottom: '1rem',
    opacity: 0.75,
  },
  hint: {
    fontSize: '0.8rem',
    lineHeight: 1.5,
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    marginTop: '1.5rem',
  },
} as const;

export default function CanvasRegionPage(): JSX.Element {
  const plugins = useMemo(() => createCanvasRegionPlugins(), []);
  const isMobile = useIsMobile();

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({ family, polarity }), [family, polarity]);

  return (
    <div style={{ ...PAGE_STYLES.wrapper, position: 'relative', flexDirection: isMobile ? 'column' : 'row' }}>
      <ThemeToggle
        onPolarityChange={setPolarity}
        onFamilyChange={setFamily}
        persist
      />
      {/* Sidebar — top on mobile, left on desktop */}
      <aside style={{
        width: isMobile ? '100%' : 'clamp(220px, 28vw, 360px)',
        flexShrink: 0,
        padding: isMobile ? '1rem 1.5rem 1rem 1.5rem' : '2rem',
        paddingTop: isMobile ? '3rem' : undefined, // clear ThemeToggle on mobile
        overflowY: 'auto',
        maxHeight: isMobile ? '38vh' : 'none',
        borderRight: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: isMobile ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
      }}>
        <h1 style={PAGE_STYLES.heading}>Canvas Region</h1>
        <p style={PAGE_STYLES.paragraph}>
          This example demonstrates the <strong>Canvas Region</strong> embedding
          mode — a self-contained interactive 3D viewer embedded within a normal
          page layout.
        </p>
        <p style={PAGE_STYLES.paragraph}>
          The 3D canvas occupies only part of the page. There is no scene
          navigation — the viewer shows a single scene with full camera
          interaction.
        </p>
        <p style={PAGE_STYLES.paragraph}>
          All input bindings are provided automatically by the default input
          spec. No hand-authored <code>&lt;InputController&gt;</code> is needed.
        </p>
        <div style={PAGE_STYLES.hint}>
          <strong>Controls</strong>
          <br />
          {'\u2318'}/Ctrl+Scroll to orbit &middot; Shift+Scroll to pan
          <br />
          Pinch to zoom &middot; Press <kbd>R</kbd> to reset
        </div>
      </aside>

      {/* Right column — 3D canvas */}
      <div style={PAGE_STYLES.canvasColumn}>
        <SceneReel
          height={isMobile ? '100%' : '100vh'}
          plugins={plugins}
          theme={theme}
          defaultTransitionDuration={500}
        >
          <ViewerScene />
          {/* InputCoordinator processes the compiled input spec at runtime —
              without it, pointer/keyboard events are not dispatched to the
              ActionInputController and camera interaction is inert. */}
          <InputCoordinator />
        </SceneReel>
      </div>
    </div>
  );
}
