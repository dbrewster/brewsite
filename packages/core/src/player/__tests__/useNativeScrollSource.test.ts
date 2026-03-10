// @vitest-environment jsdom
// Tests for useNativeScrollSource: subscribe, scrollTo, multiple subscribers, unsubscribe.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useNativeScrollSource } from '../useNativeScrollSource';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Helper: create a fake HTMLDivElement with controllable scrollTop
 * and real addEventListener/removeEventListener.
 */
function makeFakeDiv(): HTMLDivElement {
  const div = document.createElement('div');
  Object.defineProperty(div, 'scrollTop', { writable: true, value: 0 });
  return div;
}

describe('useNativeScrollSource', () => {
  it('source.subscribe and unsubscribe work correctly', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 1000 }));
    const { source } = result.current;

    const callback = vi.fn();
    let unsub: (() => void) | undefined;
    act(() => {
      unsub = source.subscribe(callback);
    });

    // callback should be registered (we can verify by calling unsubscribe and testing it doesn't throw)
    act(() => { unsub?.(); });

    // After unsubscribe, the callback is removed — no throw expected
    expect(callback).not.toHaveBeenCalled();
  });

  it('scrollTo sets div.scrollTop proportionally to heightPx and innerHeight', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 2000 }));
    const { source, ref } = result.current;

    const div = makeFakeDiv();
    (ref as { current: HTMLDivElement | null }).current = div;

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    act(() => { source.scrollTo?.(0.5); });

    // max = 2000 - 800 = 1200; scrollTop = 0.5 * 1200 = 600
    expect(div.scrollTop).toBe(600);
  });

  it('scrollTo(0) sets scrollTop to 0', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 2000 }));
    const { source, ref } = result.current;

    const div = makeFakeDiv();
    (div as unknown as { scrollTop: number }).scrollTop = 400;
    (ref as { current: HTMLDivElement | null }).current = div;

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    act(() => { source.scrollTo?.(0); });

    expect(div.scrollTop).toBe(0);
  });

  it('scrollTo(1) sets scrollTop to max scroll distance', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 2000 }));
    const { source, ref } = result.current;

    const div = makeFakeDiv();
    (ref as { current: HTMLDivElement | null }).current = div;

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    act(() => { source.scrollTo?.(1); });

    // max = 2000 - 800 = 1200
    expect(div.scrollTop).toBe(1200);
  });

  it('scrollTo does nothing when ref is null', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 2000 }));
    const { source, ref } = result.current;

    // Do NOT assign a div — ref.current stays null
    expect((ref as { current: HTMLDivElement | null }).current).toBeNull();

    expect(() => {
      act(() => { source.scrollTo?.(0.5); });
    }).not.toThrow();
  });

  it('source object is stable across re-renders with same heightPx', () => {
    const { result, rerender } = renderHook(
      (opts: { heightPx: number }) => useNativeScrollSource(opts),
      { initialProps: { heightPx: 1000 } },
    );

    const source1 = result.current.source;
    rerender({ heightPx: 1000 });
    const source2 = result.current.source;

    expect(source1).toBe(source2);
  });

  it('source object changes when heightPx changes', () => {
    const { result, rerender } = renderHook(
      (opts: { heightPx: number }) => useNativeScrollSource(opts),
      { initialProps: { heightPx: 1000 } },
    );

    const source1 = result.current.source;
    rerender({ heightPx: 2000 });
    const source2 = result.current.source;

    expect(source1).not.toBe(source2);
  });

  it('multiple subscribers can be registered', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 1000 }));
    const { source } = result.current;

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();

    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;
    let unsub3: (() => void) | undefined;

    act(() => {
      unsub1 = source.subscribe(cb1);
      unsub2 = source.subscribe(cb2);
      unsub3 = source.subscribe(cb3);
    });

    // Unsubscribing one should not throw and should not affect others
    act(() => { unsub1?.(); });

    // Unsubscribing the same twice should not throw
    act(() => { unsub1?.(); });

    // Remaining subscriptions are still active (no assertion on calls since no scroll fired)
    act(() => {
      unsub2?.();
      unsub3?.();
    });

    // Clean unsubscription
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
    expect(cb3).not.toHaveBeenCalled();
  });

  it('source interface has subscribe and scrollTo methods', () => {
    const { result } = renderHook(() => useNativeScrollSource({ heightPx: 2000 }));
    const { source } = result.current;

    expect(typeof source.subscribe).toBe('function');
    expect(typeof source.scrollTo).toBe('function');
  });
});
