// Root layout: sidebar + window-scroll content column + IntersectionObserver coordination.

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ActionInput,
  EngineOverlayHost,
  KeyboardInput,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
  type WidgetPlugin,
} from '@brewsite/core';
import type { DocsNav } from '../nav/types';
import { DocsSidebar } from './DocsSidebar';
import { DocsMainColumn } from './DocsMainColumn';

/** Context provided to all descendants — allows reading the active section id. */
interface DocsAppContextValue {
  readonly activeId: string;
}

export const DocsAppContext = createContext<DocsAppContextValue>({ activeId: '' });

export interface DocsAppProps {
  /**
   * The nav manifest produced by defineDocsNav().
   * The sidebar renders from this manifest. Section intersection tracking
   * uses allSectionIds to register the IntersectionObserver.
   */
  nav: DocsNav<string>;
  /**
   * Optional engine configuration. When provided, DocsApp wraps the content
   * column in a SceneEngine and mounts a sticky SceneCanvas driven by
   * window scroll. When omitted, DocsApp renders a pure documentation layout
   * with no 3D canvas.
   */
  engineConfig?: {
    plugins: WidgetPlugin[];
    /** @deprecated Removed in v2. Pass manifestUrl to your model plugin instead. */
    manifestUrl?: string;
    /**
     * Total scroll height in pixels. Sum of all scene scrollUnits.
     * Passed to <ScrollStage scrollHeightPx={...}>.
     */
    scrollHeightPx: number;
    /** Scene DSL children (Scene elements with their DSL props). */
    scenes: ReactNode;
    quality?: 'performance' | 'balanced' | 'high';
  };
  /**
   * All page content as children. Must contain <Section> elements
   * (or components that render them). Mounts eagerly in a single
   * scrollable div — no lazy loading.
   */
  children: ReactNode;
}

/**
 * Root docs layout component.
 *
 * Layout: CSS Grid with a fixed-width sidebar column and a content column.
 * The content column has NO overflow-y: auto — the window is the scroll source.
 * The sidebar is sticky at height: 100vh.
 *
 * When engineConfig is provided, the content column is wrapped in a SceneEngine
 * with a sticky SceneCanvas driven by window scroll via ScrollStage + ActionInput.
 *
 * Active section tracking:
 * - Mounts one IntersectionObserver watching all [data-section-id] elements.
 * - root: null → uses the window viewport as the intersection root.
 * - rootMargin: '-10% 0px -80% 0px' approximates "section is at top of viewport".
 *
 * Hash navigation:
 * - Reads window.location.hash on mount.
 * - scrollIntoView works against window scroll (no nested scroll container).
 *
 * URL hash sync:
 * - Updates window.location.hash via replaceState on activeId change.
 */
export function DocsApp({ nav, engineConfig, children }: DocsAppProps): ReactElement {
  const [activeId, setActiveId] = useState<string>('');
  // columnRef is kept for future use (e.g., injecting EngineProvider context)
  // but is NOT passed as the IntersectionObserver root.
  const columnRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: root: null → window viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section-id') ?? '';
            if (id) setActiveId(id);
          }
        }
      },
      {
        root: null, // <-- window viewport, not a scroll div
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0,
      },
    );

    // Observe after a tick so that Section elements are mounted.
    const timer = setTimeout(() => {
      const targets = document.querySelectorAll('[data-section-id]');
      targets.forEach((el) => observer.observe(el));
    }, 0);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
    // Re-register if nav changes (nav is static in practice, but defensive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // ── Hash navigation on initial load ───────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const timer = setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'instant' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // ── URL hash sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeId) {
      history.replaceState(null, '', `#${activeId}`);
    }
  }, [activeId]);

  // ── Sidebar scroll-to handler ──────────────────────────────────────────────
  // Sidebar scroll-to handler — uses window scroll (scrollIntoView default)
  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const layoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'var(--sidebar-width, 260px) 1fr',
    minHeight: '100vh',
    background: 'var(--bg-page, #0d0d12)',
    alignItems: 'start', // <-- prevent grid stretching main column
  };

  // The content column: either a plain docs column or an engine-driven column.
  // When engineConfig is provided, EngineProvider wraps the content. Since
  // EngineProvider has no DOM output (context only), ScrollCaptureSection and
  // DocsMainColumn would both become direct grid children. A wrapper div
  // keeps them in a single second-column block.
  const contentColumn: ReactNode = engineConfig ? (
    <SceneEngine
      plugins={engineConfig.plugins}
      timingProfile={engineConfig.quality ? { qualityPreset: engineConfig.quality } : undefined}
    >
      {/* Scene declarations — compile to SceneTrack, no DOM output */}
      {engineConfig.scenes}
      {/* Wrapper div ensures ScrollStage + DocsMainColumn occupy the
          same second grid column rather than splitting across grid rows. */}
      <div>
        {/* Sticky canvas driven by window scroll */}
        <ScrollStage scrollHeightPx={engineConfig.scrollHeightPx} stageHeight="100vh">
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <ActionInput />
          <KeyboardInput />
          <EngineOverlayHost />
        </ScrollStage>
        {/* Documentation content flows after the scroll region */}
        <DocsMainColumn ref={columnRef}>
          {children}
        </DocsMainColumn>
      </div>
    </SceneEngine>
  ) : (
    <DocsMainColumn ref={columnRef}>
      {children}
    </DocsMainColumn>
  );

  return (
    <DocsAppContext.Provider value={{ activeId }}>
      <div style={layoutStyle}>
        <DocsSidebar
          nav={nav}
          activeId={activeId}
          onSectionClick={scrollToSection}
        />
        {contentColumn}
      </div>
    </DocsAppContext.Provider>
  );
}
