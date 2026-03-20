// CanvasRegionPage.tsx — Canvas Region embedding mode example.

import {type JSX, useMemo, useState} from 'react';
import {type ActiveTheme, InputCoordinator, SceneReel, type ThemeFamily, type ThemePolarity} from '@brewsite/core';
import {createCanvasRegionPlugins} from './widgetSetup';
import {ViewerScene} from './scenes/viewerScene';
import {ThemeToggle} from '../Lights';
import {ExampleHeader, useFpsCap} from '../ExampleHeader';
import {StatsOverlay} from '../StatsOverlay';
import { useThemeCss } from '../hooks/useThemeCss';

export default function CanvasRegionPage(): JSX.Element {
  const plugins = useMemo(() => createCanvasRegionPlugins(), []);

  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({family, polarity}), [family, polarity]);

  const fpsCap = useFpsCap();
  const [expanded, setExpanded] = useState(false);
  useThemeCss(family, polarity);

  return (
    <div className="ex-page">
      <ExampleHeader>
        <ThemeToggle
          onPolarityChange={setPolarity}
          onFamilyChange={setFamily}
          persist
          style={{position: 'static', zIndex: 'auto'}}
        />
      </ExampleHeader>

      {/* ── Main content area ── */}
      <div className="ex-content">
        {/* Sidebar — top on mobile, left on desktop */}
        <aside className="ex-sidebar">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>Canvas Region</h1>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem', opacity: 0.75 }}>
            This example demonstrates the <strong>Canvas Region</strong> embedding
            mode — a self-contained interactive 3D viewer embedded within a normal
            page layout.
          </p>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem', opacity: 0.75 }}>
            The 3D canvas occupies only part of the page. There is no scene
            navigation — the viewer shows a single scene with full camera
            interaction.
          </p>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem', opacity: 0.75 }}>
            All input bindings are provided automatically by the default input
            spec. No hand-authored <code>&lt;InputController&gt;</code> is needed.
          </p>
          <div className="ex-hint">
            <strong>Controls</strong>
            <br/>
            {'\u2318'}/Ctrl+Scroll to orbit &middot; Shift+Scroll to pan
            <br/>
            Pinch to zoom &middot; Press <kbd>R</kbd> to reset
          </div>
        </aside>

        {/* Right column — expandable info panel + 3D canvas */}
        <div className="ex-fill-column">
          {/* Expandable info panel */}
          <div
            onClick={() => setExpanded((prev) => !prev)}
            className={`ex-expand-panel${expanded ? ' ex-expand-panel--open' : ''}`}
          >
            <div className="ex-expand-panel__trigger">
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
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{flexShrink: 0, opacity: 0.6}}
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
                <span className="ex-expand-panel__hint">
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
                  <strong>flex layout</strong> where the sidebar,
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
                <div className="ex-info-grid">
                  {[
                    {label: 'Flexbox', desc: 'This page', active: true},
                    {label: 'CSS Grid', desc: 'Grid cells', active: false},
                    {label: 'Absolute', desc: 'Free position', active: false},
                  ].map((item) => (
                    <div key={item.label} className={`ex-info-card${item.active ? ' ex-info-card--active' : ''}`}>
                      <div className="ex-info-card__title">
                        {item.label}
                      </div>
                      <div className="ex-info-card__desc">
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Code snippet */}
                <pre className="ex-code-block">
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
          <div style={{ flex: 1, position: 'relative', minWidth: 0, minHeight: 0 }}>
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
