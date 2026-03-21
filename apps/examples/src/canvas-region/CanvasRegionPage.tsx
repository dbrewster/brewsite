// CanvasRegionPage.tsx — Multi-canvas region embedding mode example.

import {type JSX, useMemo, useState, useCallback} from 'react';
import {type ActiveTheme, InputCoordinator, SceneReel, type ThemeFamily, type ThemePolarity} from '@brewsite/core';
import {createCanvasRegionPlugins} from './widgetSetup';
import {ViewerScene} from './scenes/viewerScene';
import {NetworkScene} from './scenes/networkScene';
import {PipelineScene} from './scenes/pipelineScene';
import {ThemeToggle} from '../Lights';
import {ExampleHeader, useFpsCap} from '../ExampleHeader';
import {StatsOverlay} from '../StatsOverlay';
import { useThemeCss } from '../hooks/useThemeCss';

/* ── Canvas definitions ──────────────────────────────────────────── */

interface CanvasDef {
  id: string;
  label: string;
  description: string;
  icon: JSX.Element;
  Scene: () => JSX.Element;
}

const EYE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CANVASES: CanvasDef[] = [
  {
    id: 'architecture',
    label: 'Architecture',
    description: 'Backend services topology',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
    Scene: ViewerScene,
  },
  {
    id: 'network',
    label: 'Network',
    description: 'Load balanced cluster',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" />
        <line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" />
      </svg>
    ),
    Scene: NetworkScene,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    description: 'CI/CD deployment flow',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    Scene: PipelineScene,
  },
];

/* ── Layout modes ────────────────────────────────────────────────── */

type LayoutMode = 'stack' | 'grid' | 'tabs';

interface LayoutDef {
  id: LayoutMode;
  label: string;
  description: string;
  icon: JSX.Element;
}

const LAYOUTS: LayoutDef[] = [
  {
    id: 'stack',
    label: 'Vertical Stack',
    description: 'Canvases stacked vertically using flexbox',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="5" rx="1" /><rect x="3" y="10" width="18" height="5" rx="1" />
        <rect x="3" y="17" width="18" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: 'grid',
    label: '2×2 Grid',
    description: 'CSS grid with auto-fill columns',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'tabs',
    label: 'Tabbed',
    description: 'One canvas at a time with tab selector',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h5l2-2h6l2 2h3v12H3z" /><line x1="3" y1="7" x2="21" y2="7" />
      </svg>
    ),
  },
];

/* ── Single canvas renderer ──────────────────────────────────────── */

function CanvasPanel({
  def,
  theme,
  fpsCap,
  onClose,
}: {
  def: CanvasDef;
  theme: ActiveTheme;
  fpsCap: number | undefined;
  onClose: () => void;
}): JSX.Element {
  // Each canvas needs its own plugin instances so each SceneEngine gets
  // independent widget objects (IRenderable lifecycle is per-engine).
  const plugins = useMemo(() => createCanvasRegionPlugins(), []);

  return (
    <div style={{
      flex: 1,
      position: 'relative',
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 'var(--ex-radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--ex-border)',
    }}>
      {/* Canvas label bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'var(--ex-surface)',
        borderBottom: '1px solid var(--ex-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5, display: 'flex' }}>{def.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{def.label}</span>
          <span style={{ fontSize: 11, opacity: 0.4 }}>{def.description}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            opacity: 0.4,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '0.4'; }}
          title={`Hide ${def.label}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 3D canvas */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <SceneReel
          height={'100%'}
          plugins={plugins}
          theme={theme}
          defaultTransitionDuration={500}
          timingProfile={{ fpsCap }}
        >
          <def.Scene />
          <InputCoordinator />
          <StatsOverlay />
        </SceneReel>
      </div>
    </div>
  );
}

/* ── Main page component ─────────────────────────────────────────── */

export default function CanvasRegionPage(): JSX.Element {
  const [family, setFamily] = useState<ThemeFamily>('darkGlass');
  const [polarity, setPolarity] = useState<ThemePolarity>('dark');
  const theme = useMemo((): ActiveTheme => ({family, polarity}), [family, polarity]);

  const fpsCap = useFpsCap();
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(CANVASES.map((c) => c.id)));
  const [activeTab, setActiveTab] = useState<string>(CANVASES[0].id);
  useThemeCss(family, polarity);

  const toggleCanvas = useCallback((id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // If we hid the active tab, move to the first remaining visible
        if (id === activeTab) {
          const remaining = CANVASES.find((c) => next.has(c.id));
          if (remaining) setActiveTab(remaining.id);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, [activeTab]);

  const showAll = useCallback(() => {
    setVisibleIds(new Set(CANVASES.map((c) => c.id)));
  }, []);

  const visibleCanvases = CANVASES.filter((c) => visibleIds.has(c.id));

  /* ── Layout container styles ──────────────────────────────────── */

  const containerStyle = useMemo((): React.CSSProperties => {
    switch (layout) {
      case 'stack':
        return {
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flex: 1,
          overflow: 'auto',
          padding: 12,
          minHeight: 0,
        };
      case 'grid':
        return {
          display: 'grid',
          gridTemplateColumns: visibleCanvases.length === 1 ? '1fr' : 'repeat(2, 1fr)',
          gridAutoRows: '1fr',
          gap: 12,
          flex: 1,
          overflow: 'auto',
          padding: 12,
          minHeight: 0,
        };
      case 'tabs':
        return {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          padding: 12,
          paddingTop: 0,
          minHeight: 0,
        };
    }
  }, [layout, visibleCanvases.length]);

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
        {/* ── Sidebar ── */}
        <aside className="ex-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Multi-Canvas
          </h1>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.65, marginBottom: '1rem', opacity: 0.65 }}>
            Multiple independent 3D canvas regions on the same page, each with
            its own scene and camera controls.
          </p>

          {/* ── Layout picker ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              opacity: 0.45,
              marginBottom: 10,
            }}>
              Layout
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--ex-radius)',
                    border: '1px solid',
                    borderColor: layout === l.id ? 'var(--ex-accent-border)' : 'transparent',
                    background: layout === l.id ? 'var(--ex-accent-surface)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                    width: '100%',
                  }}
                >
                  <span style={{
                    opacity: layout === l.id ? 0.9 : 0.4,
                    display: 'flex',
                    color: layout === l.id ? 'var(--ex-accent-text)' : 'inherit',
                  }}>
                    {l.icon}
                  </span>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: layout === l.id ? 600 : 500,
                      color: layout === l.id ? 'var(--ex-accent-text)' : 'inherit',
                    }}>
                      {l.label}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>
                      {l.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Canvas visibility ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                opacity: 0.45,
              }}>
                Canvases
              </div>
              {visibleIds.size < CANVASES.length && (
                <button
                  onClick={showAll}
                  style={{
                    fontSize: 11,
                    background: 'none',
                    border: 'none',
                    color: 'var(--ex-accent-text)',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontFamily: 'inherit',
                  }}
                >
                  Show all
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {CANVASES.map((c) => {
                const visible = visibleIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCanvas(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--ex-radius)',
                      border: 'none',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                      opacity: visible ? 1 : 0.4,
                      width: '100%',
                    }}
                  >
                    {/* Toggle indicator */}
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: '1.5px solid',
                      borderColor: visible ? 'var(--ex-accent)' : 'var(--ex-border-hover)',
                      background: visible ? 'var(--ex-accent-surface)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}>
                      {visible && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ex-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span style={{ display: 'flex', opacity: 0.5, flexShrink: 0 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.45 }}>{c.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Controls hint ── */}
          <div className="ex-hint" style={{ marginTop: 'auto' }}>
            <strong>Controls</strong>
            <br/>
            {'\u2318'}/Ctrl+Scroll to orbit &middot; Shift+Scroll to pan
            <br/>
            Pinch to zoom &middot; Press <kbd>R</kbd> to reset
          </div>
        </aside>

        {/* ── Canvas area ── */}
        <div className="ex-fill-column">
          {/* Tab bar for tabbed layout */}
          {layout === 'tabs' && visibleCanvases.length > 0 && (
            <div style={{
              display: 'flex',
              gap: 2,
              padding: '12px 12px 0',
              flexShrink: 0,
            }}>
              {visibleCanvases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveTab(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 'var(--ex-radius) var(--ex-radius) 0 0',
                    border: '1px solid',
                    borderBottom: 'none',
                    borderColor: activeTab === c.id ? 'var(--ex-border)' : 'transparent',
                    background: activeTab === c.id ? 'var(--ex-surface)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: activeTab === c.id ? 600 : 400,
                    opacity: activeTab === c.id ? 1 : 0.5,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ display: 'flex', opacity: 0.6 }}>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Canvas container */}
          {visibleCanvases.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              opacity: 0.5,
            }}>
              <span style={{ display: 'flex', opacity: 0.3 }}>{EYE_ICON}</span>
              <p style={{ fontSize: 14, margin: 0 }}>No canvases visible</p>
              <button
                onClick={showAll}
                className="ex-btn-ghost"
                style={{ fontSize: 12 }}
              >
                Show all canvases
              </button>
            </div>
          ) : (
            <div style={containerStyle}>
              {layout === 'tabs' ? (
                // Tabbed: render only the active tab
                (() => {
                  const activeDef = visibleCanvases.find((c) => c.id === activeTab)
                    ?? visibleCanvases[0];
                  return (
                    <CanvasPanel
                      key={activeDef.id}
                      def={activeDef}
                      theme={theme}
                      fpsCap={fpsCap}
                      onClose={() => toggleCanvas(activeDef.id)}
                    />
                  );
                })()
              ) : (
                // Stack / Grid: render all visible
                visibleCanvases.map((c) => (
                  <CanvasPanel
                    key={c.id}
                    def={c}
                    theme={theme}
                    fpsCap={fpsCap}
                    onClose={() => toggleCanvas(c.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
