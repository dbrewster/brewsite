// @vitest-environment jsdom
// useVisibilityGate.test.ts — Tests for viewport-aware mount/pause lifecycle hook.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, type RefObject } from 'react';
import { useVisibilityGate, type VisibilityMode } from '../useVisibilityGate';

// ---------------------------------------------------------------------------
// IntersectionObserver test double
// ---------------------------------------------------------------------------

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let lastObserverInstance: {
  callback: IOCallback;
  options: IntersectionObserverInit | undefined;
  observedElements: Set<Element>;
  disconnect: ReturnType<typeof vi.fn>;
} | null = null;

class FakeIntersectionObserver {
  readonly callback: IOCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly observedElements = new Set<Element>();
  readonly disconnect = vi.fn(() => {
    this.observedElements.clear();
  });

  constructor(callback: IOCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    lastObserverInstance = this;
  }

  observe(el: Element): void {
    this.observedElements.add(el);
  }

  unobserve(el: Element): void {
    this.observedElements.delete(el);
  }
}

/** Simulate an intersection change on the most recently created observer. */
function fireIntersection(isIntersecting: boolean): void {
  if (!lastObserverInstance) throw new Error('No IntersectionObserver created');
  lastObserverInstance.callback([
    { isIntersecting } as IntersectionObserverEntry,
  ]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render the hook with a real ref pointing to a real div element. */
function renderVisibilityGate(
  mode: VisibilityMode,
  rootMargin?: string,
): {
  result: { current: ReturnType<typeof useVisibilityGate> };
  unmount: () => void;
  containerEl: HTMLDivElement;
} {
  const containerEl = document.createElement('div');
  document.body.appendChild(containerEl);

  const { result, unmount: hookUnmount } = renderHook(() => {
    const ref = useRef<HTMLElement | null>(containerEl);
    return useVisibilityGate(ref, mode, rootMargin);
  });

  return {
    result,
    unmount: () => {
      hookUnmount();
      containerEl.remove();
    },
    containerEl,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let originalIO: typeof globalThis.IntersectionObserver;
let originalHidden: PropertyDescriptor | undefined;

beforeEach(() => {
  lastObserverInstance = null;
  originalIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;

  // Ensure document.hidden is writable for tests.
  originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  Object.defineProperty(document, 'hidden', {
    writable: true,
    configurable: true,
    value: false,
  });
});

afterEach(() => {
  globalThis.IntersectionObserver = originalIO;
  if (originalHidden) {
    Object.defineProperty(document, 'hidden', originalHidden);
  } else {
    // Restore by deleting our override so the prototype value is visible again.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (document as Record<string, unknown>)['hidden'];
  }
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVisibilityGate', () => {
  // ── 'always' mode ─────────────────────────────────────────────────────────

  describe("mode = 'always'", () => {
    it('returns mounted=true and visible=true immediately', () => {
      const { result, unmount } = renderVisibilityGate('always');
      expect(result.current.mounted).toBe(true);
      expect(result.current.visible).toBe(true);
      unmount();
    });

    it('does not create an IntersectionObserver', () => {
      const { unmount } = renderVisibilityGate('always');
      expect(lastObserverInstance).toBeNull();
      unmount();
    });
  });

  // ── 'autopause' mode ─────────────────────────────────────────────────────

  describe("mode = 'autopause'", () => {
    it('mounted is always true', () => {
      const { result, unmount } = renderVisibilityGate('autopause');
      expect(result.current.mounted).toBe(true);

      act(() => fireIntersection(false));
      expect(result.current.mounted).toBe(true);

      act(() => fireIntersection(true));
      expect(result.current.mounted).toBe(true);

      unmount();
    });

    it('visible starts true (optimistic) and observer can correct to false', () => {
      const { result, unmount } = renderVisibilityGate('autopause');
      // Optimistic initial: visible = true before observer fires.
      expect(result.current.visible).toBe(true);

      // Observer fires: element is off-screen.
      act(() => fireIntersection(false));
      expect(result.current.visible).toBe(false);

      // Observer fires: element is on-screen.
      act(() => fireIntersection(true));
      expect(result.current.visible).toBe(true);

      unmount();
    });

    it('visible becomes false when document is hidden, even if intersecting', () => {
      const { result, unmount } = renderVisibilityGate('autopause');

      // Element is intersecting.
      act(() => fireIntersection(true));
      expect(result.current.visible).toBe(true);

      // Tab switches away.
      act(() => {
        (document as Record<string, unknown>).hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.visible).toBe(false);

      unmount();
    });

    it('visible recovers to intersection state when document becomes visible again', () => {
      const { result, unmount } = renderVisibilityGate('autopause');

      act(() => fireIntersection(true));

      // Tab switches away.
      act(() => {
        (document as Record<string, unknown>).hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.visible).toBe(false);

      // Tab switches back.
      act(() => {
        (document as Record<string, unknown>).hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.visible).toBe(true);

      unmount();
    });

    it('passes rootMargin to IntersectionObserver', () => {
      const { unmount } = renderVisibilityGate('autopause', '400px');
      expect(lastObserverInstance).not.toBeNull();
      expect(lastObserverInstance!.options?.rootMargin).toBe('400px');
      unmount();
    });
  });

  // ── 'lazy' mode ───────────────────────────────────────────────────────────

  describe("mode = 'lazy'", () => {
    it('mounted and visible start as false', () => {
      const { result, unmount } = renderVisibilityGate('lazy');
      expect(result.current.mounted).toBe(false);
      expect(result.current.visible).toBe(false);
      unmount();
    });

    it('mounted becomes true when observer fires isIntersecting', () => {
      const { result, unmount } = renderVisibilityGate('lazy');
      expect(result.current.mounted).toBe(false);

      act(() => fireIntersection(true));
      expect(result.current.mounted).toBe(true);
      expect(result.current.visible).toBe(true);

      unmount();
    });

    it('mounted reverts to false after 500ms debounce when no longer intersecting', () => {
      vi.useFakeTimers();
      const { result, unmount } = renderVisibilityGate('lazy');

      // Mount.
      act(() => fireIntersection(true));
      expect(result.current.mounted).toBe(true);

      // Leave viewport.
      act(() => fireIntersection(false));
      // visible is immediately false, mounted still true (debounced).
      expect(result.current.visible).toBe(false);
      expect(result.current.mounted).toBe(true);

      // Advance past the 500ms debounce.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.mounted).toBe(false);

      unmount();
      vi.useRealTimers();
    });

    it('re-intersecting within 500ms cancels the unmount debounce', () => {
      vi.useFakeTimers();
      const { result, unmount } = renderVisibilityGate('lazy');

      // Mount.
      act(() => fireIntersection(true));
      expect(result.current.mounted).toBe(true);

      // Leave viewport.
      act(() => fireIntersection(false));
      expect(result.current.mounted).toBe(true);

      // Re-enter before 500ms.
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => fireIntersection(true));

      // Advance well past the original 500ms mark.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      // mounted should still be true — debounce was cancelled.
      expect(result.current.mounted).toBe(true);
      expect(result.current.visible).toBe(true);

      unmount();
      vi.useRealTimers();
    });

    it('visible tracks intersection AND document.hidden', () => {
      const { result, unmount } = renderVisibilityGate('lazy');

      act(() => fireIntersection(true));
      expect(result.current.visible).toBe(true);

      // Hide document.
      act(() => {
        (document as Record<string, unknown>).hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.visible).toBe(false);

      // Unhide document.
      act(() => {
        (document as Record<string, unknown>).hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.visible).toBe(true);

      unmount();
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('disconnects observer and removes event listener on unmount', () => {
      const { unmount } = renderVisibilityGate('autopause');
      const observer = lastObserverInstance;
      expect(observer).not.toBeNull();

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      unmount();

      expect(observer!.disconnect).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });

    it('clears pending debounce timeout on unmount (lazy mode)', () => {
      vi.useFakeTimers();
      const { result, unmount } = renderVisibilityGate('lazy');

      // Mount then leave viewport to start the debounce timer.
      act(() => fireIntersection(true));
      act(() => fireIntersection(false));
      expect(result.current.mounted).toBe(true);

      // Unmount before the 500ms debounce fires.
      unmount();

      // Advance time — the debounce callback should not throw or leak.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      vi.useRealTimers();
    });
  });

  // ── SSR fallback ──────────────────────────────────────────────────────────

  describe('SSR fallback', () => {
    it('returns mounted=true and visible=true when IntersectionObserver is unavailable', () => {
      // Remove IntersectionObserver to simulate SSR.
      const saved = globalThis.IntersectionObserver;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as Record<string, unknown>).IntersectionObserver;

      try {
        const containerEl = document.createElement('div');
        document.body.appendChild(containerEl);

        const { result, unmount } = renderHook(() => {
          const ref = useRef<HTMLElement | null>(containerEl);
          return useVisibilityGate(ref, 'lazy');
        });

        // In SSR fallback, even 'lazy' mode should return mounted and visible.
        expect(result.current.mounted).toBe(true);
        expect(result.current.visible).toBe(true);

        unmount();
        containerEl.remove();
      } finally {
        globalThis.IntersectionObserver = saved;
      }
    });
  });
});
