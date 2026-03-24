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
  {
    path: '/mdx-embed',
    label: 'MDX Embed',
    description: 'Dynamic MDX article with 3D diagrams via @brewsite/mdx runtime compilation.',
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
    <header className="ex-header">
      {/* Left side — Logo + menu trigger */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="ex-header__menu-trigger"
          aria-expanded={menuOpen}
        >
          {/* BrewSite icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
            <path d="M17 8l4 4-4 4" />
            <path d="M3 12h18" />
            <path d="M7 8L3 12l4 4" />
          </svg>

          <span className="ex-header__title">
            {current?.label ?? 'Examples'}
          </span>

          {/* Chevron */}
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={`ex-header__chevron${menuOpen ? ' ex-header__chevron--open' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="ex-dropdown">
            {/* Menu header */}
            <div className="ex-dropdown__header">
              Examples
            </div>

            {EXAMPLES.map((ex) => {
              const isActive = current?.path === ex.path;
              return (
                <button
                  key={ex.path}
                  type="button"
                  onClick={() => handleNavigate(ex.path)}
                  className={`ex-dropdown__item${isActive ? ' ex-dropdown__item--active' : ''}`}
                >
                  <div className="ex-dropdown__item-label">
                    {/* Active indicator */}
                    <div className="ex-dropdown__item-dot" />
                    <span className="ex-dropdown__item-name">
                      {ex.label}
                    </span>
                    {ex.badge && (
                      <span className="ex-badge">
                        {ex.badge}
                      </span>
                    )}
                  </div>
                  <span className="ex-dropdown__item-desc">
                    {ex.description}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right side — stats toggle + page controls */}
      <div className="ex-header__right">
        {/* Stats toggle button */}
        <button
          type="button"
          onClick={toggleStats}
          title={showStats ? 'Hide renderer stats (S)' : 'Show renderer stats (S)'}
          className={`ex-btn-ghost${showStats ? ' ex-btn-ghost--active' : ''}`}
        >
          {/* Activity/pulse icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Stats
        </button>

        {/* FPS cap selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--ex-font-mono)', fontWeight: 500, color: 'var(--ex-text-muted)' }}>
            FPS
          </span>
          <select
            value={fpsCap === undefined ? '' : String(fpsCap)}
            onChange={(e) => setFpsCap(e.target.value === '' ? undefined : Number(e.target.value))}
            className="ex-select"
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
