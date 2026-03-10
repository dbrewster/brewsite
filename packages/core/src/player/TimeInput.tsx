// TimeInput.tsx — Drives engine progress via wall-clock auto-advance.

import { useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';

/**
 * Props for TimeInput.
 * Drives engine progress via elapsed wall time.
 */
export interface TimeInputProps {
  /** Seconds to traverse engine progress from 0 to `max`. Required. */
  duration: number;

  /** Maximum engine progress to advance to. Default: 1.0. */
  max?: number;

  /** Loop back to 0 when max is reached. Default: false. */
  loop?: boolean;

  /**
   * Reset engine progress to 0 when pauseWhenHidden triggers (element leaves viewport).
   * Default: true.
   */
  resetOnExit?: boolean;

  /**
   * Pause time-based advance when the nearest positioned ancestor falls below this
   * IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

/**
 * TimeInput drives engine progress via wall-clock elapsed time.
 * Renders a zero-size anchor div only.
 */
export function TimeInput(props: TimeInputProps): ReactElement {
  const engine = useSceneEngineContext();
  const isPausedByHiddenRef = useRef(false);
  const lastTimestampRef = useRef<number | null>(null);
  const containerDivRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);

  // ── pauseWhenHidden wiring ────────────────────────────────────────────────────
  const onPauseChange = useCallback((paused: boolean) => {
    isPausedByHiddenRef.current = paused;
    if (paused && (props.resetOnExit ?? true)) {
      engine.setProgress(0);
      lastTimestampRef.current = null;
    }
  }, [engine, props.resetOnExit]);

  usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, onPauseChange);

  // ── RAF loop ──────────────────────────────────────────────────────────────────
  // Capture props in refs so the RAF closure always uses current values.
  const durationRef = useRef(props.duration);
  const maxRef = useRef(props.max ?? 1.0);
  const loopRef = useRef(props.loop ?? false);
  durationRef.current = props.duration;
  maxRef.current = props.max ?? 1.0;
  loopRef.current = props.loop ?? false;

  useEffect(() => {
    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);

      if (isPausedByHiddenRef.current) {
        lastTimestampRef.current = null;
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = ts;
        return;
      }

      const elapsed = (ts - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = ts;

      const max = maxRef.current;
      const delta = elapsed / durationRef.current;
      const current = engine.frameState.progress;

      // Guard: if already at or past max and not looping, nothing to advance
      if (!loopRef.current && current >= max) {
        return;
      }

      let next = current + delta;

      if (next >= max) {
        if (loopRef.current) {
          next = next % max;
        } else {
          next = max;
        }
      }

      engine.setProgress(Math.max(0, Math.min(max, next)));
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [engine]);

  return <div ref={containerDivRef} style={{ position: 'absolute', width: 0, height: 0 }} />;
}
