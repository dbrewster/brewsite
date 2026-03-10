// PointerInput.tsx — Click-to-advance or hover-to-scrub pointer input.

import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';

/**
 * Props for PointerInput.
 * Handles click-to-advance or hover-to-scrub pointer interactions.
 */
export interface PointerInputProps {
  /** 'click' — advance one scene on click. 'hover' — scrub progress on cursor X position. */
  mode: 'click' | 'hover';

  /**
   * For hover mode: pixels of horizontal cursor movement spanning one full scene.
   * Default: 200.
   */
  sensitivity?: number;

  /** For click mode: wrap back to scene 0 after last scene. Default: false. */
  loop?: boolean;

  /**
   * Stop responding to pointer events when the nearest positioned ancestor falls below
   * this IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

/**
 * PointerInput handles click-to-advance and hover-to-scrub.
 * Renders a transparent overlay div covering the canvas area.
 */
export function PointerInput(props: PointerInputProps): ReactElement {
  const engine = useSceneEngineContext();
  const isPausedRef = useRef(false);
  const containerDivRef = useRef<HTMLDivElement | null>(null);

  // ── pauseWhenHidden wiring ────────────────────────────────────────────────────
  const onPauseChange = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
  }, []);

  usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, onPauseChange);

  // ── Click mode ────────────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (isPausedRef.current) return;
    const { progress, sceneCount } = engine;
    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;
    let next = progress + step;
    if (next > 1) {
      next = props.loop ? 0 : 1;
    }
    engine.setProgress(next);
  }, [engine, props.loop]);

  // ── Hover mode ────────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPausedRef.current) return;
    const containerEl = containerDivRef.current;
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sensitivity = props.sensitivity ?? 200;
    const progress = Math.max(0, Math.min(1, x / Math.max(sensitivity, rect.width)));
    engine.setProgress(progress);
  }, [engine, props.sensitivity]);

  // ── Event listener attachment ─────────────────────────────────────────────────
  useEffect(() => {
    const el = containerDivRef.current;
    if (!el) return;

    if (props.mode === 'click') {
      el.addEventListener('click', handleClick as EventListener);
      return () => el.removeEventListener('click', handleClick as EventListener);
    } else {
      el.addEventListener('mousemove', handleMouseMove as EventListener);
      return () => el.removeEventListener('mousemove', handleMouseMove as EventListener);
    }
  }, [props.mode, handleClick, handleMouseMove]);

  return (
    <div
      ref={containerDivRef}
      style={{
        position: 'absolute',
        inset: 0,
        cursor: props.mode === 'click' ? 'pointer' : 'crosshair',
      }}
    />
  );
}
