// CanvasRegionPage.tsx — Canvas Region embedding mode example.

import {type JSX, useEffect, useMemo, useState} from 'react';
import {type ActiveTheme, InputCoordinator, SceneReel, type ThemeFamily, type ThemePolarity} from '@brewsite/core';
import {createCanvasRegionPlugins} from './widgetSetup';
import {ViewerScene} from './scenes/viewerScene';
import {ThemeToggle} from '../Lights';
import {ExampleHeader, useFpsCap} from '../ExampleHeader';
import {StatsOverlay} from '../StatsOverlay';

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
  const theme = useMemo((): ActiveTheme => ({family, polarity}), [family, polarity]);

  const fpsCap = useFpsCap();
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#0a0a1a',
      color: '#e0e0e8',
      overflow: 'hidden',
    }}>
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>

      {/* ── Main content area ── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Sidebar — top on mobile, left on desktop */}
        <aside style={{
          width: isMobile ? '100%' : 'clamp(220px, 28vw, 360px)',
          flexShrink: 0,
          padding: isMobile ? '1rem 1.5rem' : '1.5rem 2rem',
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
            <br/>
            {'\u2318'}/Ctrl+Scroll to orbit &middot; Shift+Scroll to pan
            <br/>
            Pinch to zoom &middot; Press <kbd>R</kbd> to reset
          </div>
        </aside>

        {/* Right column — expandable info panel + 3D canvas */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          overflow: 'hidden',
        }}>
          {/* Expandable info panel */}
          <div
            onClick={() => setExpanded((prev) => !prev)}
            style={{
              flexShrink: 0,
              padding: expanded ? '24px 28px 28px' : '14px 24px',
              cursor: 'pointer',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: expanded ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.3s ease',
              userSelect: 'none',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              {/* Chevron icon */}
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  transition: 'transform 0.3s ease',
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  opacity: 0.5,
                  flexShrink: 0,
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>

              {/* Layout icon */}
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="#a5b4fc" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{flexShrink: 0}}
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>

              <span style={{fontSize: 13, fontWeight: 500}}>
                {expanded ? 'Click to collapse' : 'Flexible CSS layout'}
              </span>

              {!expanded && (
                <span style={{
                  fontSize: 11,
                  opacity: 0.4,
                  marginLeft: 4,
                }}>
                  — click to expand
                </span>
              )}
            </div>

            {/* Expanded content */}
            <div style={{
              maxHeight: expanded ? 600 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.3s ease, opacity 0.3s ease',
              opacity: expanded ? 1 : 0,
            }}>
              <div style={{paddingTop: 16}}>
                <p style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  opacity: 0.7,
                  margin: '0 0 16px 0',
                }}>
                  The 3D canvas can be positioned using any CSS layout technique — flexbox,
                  grid, absolute positioning, or any combination. This page uses a{' '}
                  <strong style={{color: '#c7d2fe'}}>flex layout</strong> where the sidebar,
                  this panel, and the canvas share the available viewport space.
                </p>
                <p style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  opacity: 0.7,
                  margin: '0 0 16px 0',
                }}>
                  Expanding or collapsing this region changes the flex distribution — the
                  canvas automatically resizes to fill the remaining space. No manual resize
                  handling is needed; the engine observes the canvas element and adapts.
                </p>

                {/* Layout techniques grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  margin: '20px 0',
                }}>
                  {[
                    {label: 'Flexbox', desc: 'This page', active: true},
                    {label: 'CSS Grid', desc: 'Grid cells', active: false},
                    {label: 'Absolute', desc: 'Free position', active: false},
                  ].map((item) => (
                    <div key={item.label} style={{
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: item.active ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: item.active ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                      <div style={{fontSize: 13, fontWeight: 600, color: item.active ? '#c7d2fe' : '#e0e0e8'}}>
                        {item.label}
                      </div>
                      <div style={{fontSize: 11, opacity: 0.5, marginTop: 4}}>
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Code snippet */}
                <pre style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  margin: '0 0 16px 0',
                  overflowX: 'auto',
                  color: '#a5b4fc',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}>
                  <code>{`<div style={{ display: 'flex', flexGrow: 1 }}>
  <aside>Sidebar content</aside>
  <div style={{ flex: 1 }}>
    <SceneReel height="100%" ...>
      <ViewerScene />
    </SceneReel>
  </div>
</div>`}</code>
                </pre>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  opacity: 0.45,
                  paddingTop: 4,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Try resizing your browser window to see the layout adapt.</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Canvas */}
          <div style={PAGE_STYLES.canvasColumn}>
            <SceneReel
              height={'100%'}
              plugins={plugins}
              theme={theme}
              defaultTransitionDuration={500}
              timingProfile={{ fpsCap }}
            >
              <ViewerScene/>
              {/* InputCoordinator processes the compiled input spec at runtime —
                without it, pointer/keyboard events are not dispatched to the
                ActionInputController and camera interaction is inert. */}
              <InputCoordinator/>
              <StatsOverlay />
            </SceneReel>
          </div>
        </div>
      </div>
    </div>
  );
}
