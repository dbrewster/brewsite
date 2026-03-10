// Navigation context: section registration, active-section detection via
// IntersectionObserver, and scrollToSection() with optional within-panel progress.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';

export type NavContextValue = {
  /**
   * Called by ProseBlock and ScenePanel on mount to register their id and ref
   * so NavContext can observe them for active-section detection.
   */
  register: (id: string, ref: RefObject<HTMLElement | null>) => void;

  /** Called on unmount to stop observing the element. */
  unregister: (id: string) => void;

  /** The id of the section currently most visible in the upper-middle viewport. */
  activeSectionId: string | null;

  /**
   * Scrolls the viewport to bring the given section into view.
   *
   * @param id    - The section id (must have been registered via register()).
   * @param progress - Optional [0..1] within-panel progress offset.
   *   When omitted: scrolls to the panel top (progress=0).
   *   When provided: calculates targetY such that the panel sits at the
   *   given fraction of its scroll window.
   *   Formula: targetY = panelTop + clamp01(progress) * max(0, panelHeight - viewportHeight)
   */
  scrollToSection: (id: string, progress?: number) => void;
};

const NavContext = createContext<NavContextValue | null>(null);

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function NavProvider({ children }: { children: ReactNode }): JSX.Element {
  const registrations = useRef(new Map<string, RefObject<HTMLElement | null>>());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver for active section detection.
  // rootMargin: '-20% 0px -60% 0px' creates a detection band in the upper-middle
  // portion of the viewport. A section is "active" when >50% of it falls in this band.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.5) {
            const id = (entry.target as HTMLElement).dataset['navId'];
            if (id) {
              setActiveSectionId(id);
            }
          }
        }
      },
      {
        root: null, // viewport
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.5, 1],
      },
    );
    observerRef.current = observer;

    // Re-observe any elements that registered before the observer was created.
    for (const [id, ref] of registrations.current.entries()) {
      const el = ref.current;
      if (el) {
        el.dataset['navId'] = id;
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  const register = useCallback((id: string, ref: RefObject<HTMLElement | null>) => {
    registrations.current.set(id, ref);
    const el = ref.current;
    if (el && observerRef.current) {
      el.dataset['navId'] = id;
      observerRef.current.observe(el);
    }
  }, []);

  const unregister = useCallback((id: string) => {
    const ref = registrations.current.get(id);
    const el = ref?.current;
    if (el && observerRef.current) {
      observerRef.current.unobserve(el);
    }
    registrations.current.delete(id);
  }, []);

  const scrollToSection = useCallback((id: string, progress?: number) => {
    const ref = registrations.current.get(id);
    const el = ref?.current;
    if (!el) {
      // Fallback to native id-based scroll if not registered.
      const domEl = document.getElementById(id);
      if (domEl) {
        domEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.warn(`[NavContext] scrollToSection: id="${id}" not registered.`);
      }
      return;
    }

    if (progress === undefined) {
      // Simple top-of-section navigation — let the browser handle it.
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Within-panel navigation: compute the target scrollY that places the panel
    // at the given progress fraction of its scroll window.
    // panelTop is computed from live element measurement — handles any layout reflow.
    const panelTop = el.getBoundingClientRect().top + window.scrollY;
    const maxScroll = Math.max(0, el.offsetHeight - window.innerHeight);
    const targetY = panelTop + clamp01(progress) * maxScroll;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }, []);

  const value = useMemo(
    (): NavContextValue => ({ register, unregister, activeSectionId, scrollToSection }),
    [register, unregister, activeSectionId, scrollToSection],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavContext(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error('[useNavContext] must be called inside <NavProvider>.');
  }
  return ctx;
}
