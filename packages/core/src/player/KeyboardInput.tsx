// KeyboardInput.tsx — Captures keyboard events for scene navigation.

import { useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ControlledProgressContext } from './ControlledProgressContext';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import { InputController } from '../input/InputController';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';
import type { SceneNavInputMap } from '../input/types';

/**
 * Props for KeyboardInput.
 * Handles keyboard scene navigation with optional focus management.
 */
export interface KeyboardInputProps {
  /** Key bindings. Default: arrow keys. */
  inputMap?: SceneNavInputMap;

  /**
   * Renders a focus-capture div (tabIndex={-1}) to receive keyboard events on click.
   * Default: true. Set false if parent already manages focus.
   */
  manageFocus?: boolean;

  /**
   * Pause keyboard navigation when the nearest positioned ancestor falls below
   * this IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

/**
 * KeyboardInput handles keyboard scene navigation.
 * Renders a focus-capture div (when manageFocus=true) or null.
 */
export function KeyboardInput(props: KeyboardInputProps): ReactElement | null {
  const engine = useSceneEngineContext();
  const controlledCtx = useContext(ControlledProgressContext);
  const isPausedRef = useRef(false);
  const containerDivRef = useRef<HTMLDivElement | null>(null);

  // ── pauseWhenHidden wiring ────────────────────────────────────────────────────
  const onPauseChange = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
    if (paused && containerDivRef.current) {
      containerDivRef.current.blur();
    }
  }, []);

  usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, onPauseChange);

  // ── InputController setup ─────────────────────────────────────────────────────
  // Capture mutable props in refs for use inside stable handler callbacks.
  const manageFocus = props.manageFocus ?? true;
  const inputMapRef = useRef(props.inputMap);
  inputMapRef.current = props.inputMap;

  useEffect(() => {
    const attachTarget: HTMLElement | Window = manageFocus
      ? (containerDivRef.current ?? window)
      : window;

    const ctrl = new InputController(
      attachTarget,
      {
        mode: 'scroll',
        wheel: false,
        drag: false,
        swipe: false,
        click: false,
        keys: inputMapRef.current?.keys,
      },
      {
        onScroll: (delta: number) => {
          if (isPausedRef.current) return;
          // delta from InputController for key events is already ±1/(N-1).
          // We re-derive the canonical step so the KeyboardInput test contract holds
          // (exactly 1/(sceneCount-1) per keypress, per §14.6 items 1 and 2).
          const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;
          if (direction === 0) return;
          const step = engine.sceneCount > 1 ? direction / (engine.sceneCount - 1) : direction;
          const target = Math.max(0, Math.min(1, engine.frameState.progress + step));
          if (controlledCtx?.onChange) {
            controlledCtx.onChange(target);
          } else {
            engine.setProgress(target);
          }
        },
        onJumpToScene: (index: number) => {
          if (isPausedRef.current) return;
          const progress = engine.sceneCount > 1 ? index / (engine.sceneCount - 1) : 0;
          if (controlledCtx?.onChange) {
            controlledCtx.onChange(progress);
          } else {
            engine.setProgress(progress);
          }
        },
        getProgress: () => engine.frameState.progress,
        getSceneCount: () => engine.sceneCount,
      },
    );

    ctrl.attach();
    return () => ctrl.detach();
  }, [manageFocus, engine, controlledCtx]);

  if (manageFocus) {
    return (
      <div
        ref={containerDivRef}
        tabIndex={-1}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          if (typeof el.focus === 'function') el.focus({ preventScroll: true });
        }}
        style={{
          position: 'absolute',
          inset: 0,
          outline: 'none',
          pointerEvents: 'auto',
        }}
      />
    );
  }

  return null;
}
