// ExampleHeader.tsx — Shared header bar for all example pages.
// Renders a navigation menu (left), stats toggle, and optional right-side controls.

import { type JSX, useCallback, useEffect, useRef, useSyncExternalStore, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

// ─── Example directory ────────────────────────────────────────────────────────

export interface ExampleEntry {
  path: string;
  label: string;
  description: string;
  /** Package badge (e.g. "@brewsite/core"). Omit for general examples. */
  badge?: string;
}

export const EXAMPLES: ExampleEntry[] = [
  {
    path: '/core-showcase',
    label: 'Core Showcase',
    description: 'Architecture walkthrough of the scene DSL, compiler, camera, lighting, and theming.',
    badge: '@brewsite/core',
  },
  {
    path: '/chart',
    label: 'Charts',
    description: 'Bar, line, area, pie, heatmap, bubble, and linked-brush chart scenes.',
    badge: '@brewsite/charts',
  },
  {
    path: '/slides-demo',
    label: 'Slide Deck',
    description: 'Presentation-style slide player with themes and progress styles.',
    badge: '@brewsite/slides',
  },
  {
    path: '/views',
    label: 'Views & Layouts',
    description: 'Standalone views, stacks, carousels, and nested layout compositions.',
  },
  {
    path: '/input-showcase',
    label: 'Input Controls',
    description: 'Every InputController action — orbit, dolly, pan, key, pinch, and wheel maps.',
  },
  {
    path: '/model-showcase',
    label: 'Model & Labels',
    description: 'GLTF model loading, bone animation, label positioning, and carousel.',
    badge: '@brewsite/model',
  },
  {
    path: '/media-screen-demo',
    label: 'Media Screens',
    description: 'Live screen capture, canvas stream, and video texture on 3D panels.',
    badge: '@brewsite/screens',
  },
  {
    path: '/canvas-region',
    label: 'Canvas Region',
    description: 'Embedded 3D viewer in a flex layout — the canvas shares space with page content.',
  },
  {
    path: '/carousel-selection',
    label: 'Carousel Selection',
    description: 'Carousel item selection with scene navigation and React overlay patterns.',
  },
  {
    path: '/theme-gallery',
    label: 'Theme Gallery',
    description: 'Side-by-side visual comparison of all theme family and polarity variants.',
    badge: '@brewsite/themes',
  },
];

// ─── Stats toggle (module-level store so any component can read it) ───────────

let _showStats = false;
const _listeners = new Set<() => void>();

function subscribeStats(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getStatsSnapshot(): boolean {
  return _showStats;
}

function toggleStats(): void {
  _showStats = !_showStats;
  _listeners.forEach((cb) => cb());
}

/**
 * Read the stats-visible flag from anywhere in the tree.
 * Use inside <SceneEngine> to conditionally render <RendererStats>.
 */
export function useShowStats(): boolean {
  return useSyncExternalStore(subscribeStats, getStatsSnapshot);
}

// ─── FPS cap (module-level store) ─────────────────────────────────────────────

/** undefined = no cap (system native). */
let _fpsCap: number | undefined = undefined;
const _fpsListeners = new Set<() => void>();

function subscribeFps(cb: () => void): () => void {
  _fpsListeners.add(cb);
  return () => _fpsListeners.delete(cb);
}

function getFpsSnapshot(): number | undefined {
  return _fpsCap;
}

function setFpsCap(value: number | undefined): void {
  _fpsCap = value;
  _fpsListeners.forEach((cb) => cb());
}

const FPS_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'System', value: undefined },
  { label: '120', value: 120 },
  { label: '60', value: 60 },
  { label: '30', value: 30 },
  { label: '15', value: 15 },
];

/**
 * Read the current FPS cap. Returns `undefined` for no cap (system native).
 * Use in page components to pass to `timingProfile={{ fpsCap }}`.
 */
export function useFpsCap(): number | undefined {
  return useSyncExternalStore(subscribeFps, getFpsSnapshot);
}

// ─── Header component ─────────────────────────────────────────────────────────

export interface ExampleHeaderProps {
  /** Right-side content — typically ThemeToggle or custom controls. */
  children?: React.ReactNode;
}

export function ExampleHeader({ children }: ExampleHeaderProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const showStats = useShowStats();
  const fpsCap = useFpsCap();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  const current = EXAMPLES.find((ex) => location.pathname.endsWith(ex.path));

  const handleNavigate = useCallback((path: string) => {
    setMenuOpen(false);
    void navigate(path);
  }, [navigate]);

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: 48,
      flexShrink: 0,
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      background: 'rgba(255, 255, 255, 0.03)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#e0e0e8',
      position: 'relative',
      zIndex: 200,
    }}>
      {/* Left side — Logo + menu trigger */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: menuOpen ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
            border: 'none',
            borderRadius: 6,
            padding: '6px 12px 6px 8px',
            margin: '-6px -12px -6px -8px',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: 14,
            fontFamily: 'inherit',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!menuOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          }}
          onMouseLeave={(e) => {
            if (!menuOpen) e.currentTarget.style.background = 'transparent';
          }}
        >
          {/* BrewSite icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M17 8l4 4-4 4" />
            <path d="M3 12h18" />
            <path d="M7 8L3 12l4 4" />
          </svg>

          <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>
            {current?.label ?? 'Examples'}
          </span>

          {/* Chevron */}
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              opacity: 0.4,
              transition: 'transform 0.2s ease',
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: -8,
            width: 360,
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            background: 'rgba(16, 16, 28, 0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 10,
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
            padding: '6px',
            zIndex: 1000,
          }}>
            {/* Menu header */}
            <div style={{
              padding: '10px 12px 8px',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(165, 180, 252, 0.6)',
            }}>
              Examples
            </div>

            {EXAMPLES.map((ex) => {
              const isActive = current?.path === ex.path;
              return (
                <button
                  key={ex.path}
                  type="button"
                  onClick={() => handleNavigate(ex.path)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    width: '100%',
                    padding: '10px 12px',
                    background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Active indicator */}
                    <div style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: isActive ? '#a5b4fc' : 'rgba(255, 255, 255, 0.15)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#e0e8ff' : '#c0c8d8',
                    }}>
                      {ex.label}
                    </span>
                    {ex.badge && (
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#8b95cf',
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>
                        {ex.badge}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11,
                    lineHeight: 1.4,
                    color: 'rgba(180, 190, 210, 0.5)',
                    paddingLeft: 12,
                  }}>
                    {ex.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right side — stats toggle + page controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Stats toggle button */}
        <button
          type="button"
          onClick={toggleStats}
          title={showStats ? 'Hide renderer stats (S)' : 'Show renderer stats (S)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            background: showStats ? 'rgba(0, 255, 100, 0.1)' : 'transparent',
            border: showStats ? '1px solid rgba(0, 255, 100, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            cursor: 'pointer',
            color: showStats ? '#4ade80' : 'rgba(255, 255, 255, 0.45)',
            fontSize: 11,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!showStats) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showStats) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)';
            }
          }}
        >
          {/* Activity/pulse icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Stats
        </button>

        {/* FPS cap selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontSize: 11,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.45)',
          }}>
            FPS
          </span>
          <select
            value={fpsCap === undefined ? '' : String(fpsCap)}
            onChange={(e) => setFpsCap(e.target.value === '' ? undefined : Number(e.target.value))}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 5,
              padding: '4px 6px',
              color: '#e0e0e8',
              fontSize: 11,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {FPS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value === undefined ? '' : opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {children}
      </div>
    </header>
  );
}
