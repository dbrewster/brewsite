// Root layout: sidebar + scroll content region + IntersectionObserver coordination.

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
import type { DocsNav } from '../nav/types';
import { DocsSidebar } from './DocsSidebar';
import { DocsScrollRegion } from './DocsScrollRegion';

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
   * All page content as children. Must contain <Section> elements
   * (or components that render them). Mounts eagerly in a single
   * scrollable div — no lazy loading.
   */
  children: ReactNode;
}

/**
 * Root docs layout component.
 *
 * Layout: CSS Grid with a fixed-width sidebar column and a scroll content column.
 * The scroll region fills the remaining width and has `overflow-y: auto`.
 *
 * Active section tracking:
 * - Mounts one IntersectionObserver watching all [data-section-id] elements.
 * - rootMargin: '-10% 0px -80% 0px' approximates "section is at top of viewport".
 * - The last intersecting section becomes activeId.
 *
 * Hash navigation on initial load:
 * - Reads window.location.hash on mount.
 * - setTimeout(0) defers scroll until after first paint.
 * - scrollIntoView({ behavior: 'instant' }) lands at the element.
 * - Works correctly because all Section elements and DocsDemo placeholder divs
 *   mount eagerly with stable heights.
 *
 * URL hash update:
 * - Updates window.location.hash whenever activeId changes (via replaceState).
 */
export function DocsApp({ nav, children }: DocsAppProps): ReactElement {
  const [activeId, setActiveId] = useState<string>('');
  const scrollRegionRef = useRef<HTMLDivElement>(null);

  // ── IntersectionObserver for active section ────────────────────────────────
  useEffect(() => {
    const scrollEl = scrollRegionRef.current;
    if (!scrollEl) return;

    // Observe all [data-section-id] elements within the scroll region.
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
        root: scrollEl,
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0,
      },
    );

    const targets = scrollEl.querySelectorAll('[data-section-id]');
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
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
  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const layoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'var(--sidebar-width, 260px) 1fr',
    minHeight: '100vh',
    background: 'var(--bg-page, #0d0d12)',
  };

  return (
    <DocsAppContext.Provider value={{ activeId }}>
      <div style={layoutStyle}>
        <DocsSidebar
          nav={nav}
          activeId={activeId}
          onSectionClick={scrollToSection}
        />
        <DocsScrollRegion ref={scrollRegionRef}>
          {children}
        </DocsScrollRegion>
      </div>
    </DocsAppContext.Provider>
  );
}

