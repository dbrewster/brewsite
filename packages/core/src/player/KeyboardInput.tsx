// KeyboardInput.tsx — Focus management and pause-when-hidden for the engine canvas.

import { useCallback, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { usePauseWhenHidden } from './usePauseWhenHidden';
import type { PauseWhenHiddenOptions } from './usePauseWhenHidden';

/**
 * Props for KeyboardInput.
 * Provides focus management and optional pause-when-hidden behavior.
 * Keyboard scene navigation is handled by ActionInput via the compiled
 * __input_controller spec.
 */
export interface KeyboardInputProps {
  /** Whether to render a focusable container div. Default: true. */
  manageFocus?: boolean;

  /**
   * Pause when the nearest positioned ancestor falls below this
   * IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;

  children?: ReactNode;
}

/**
 * KeyboardInput provides focus management so keyboard events reach the canvas.
 * Renders a focusable div (when manageFocus=true) or null.
 * All keyboard scene navigation is delegated to ActionInput.
 */
export function KeyboardInput(props: KeyboardInputProps): ReactElement | null {
  const containerDivRef = useRef<HTMLDivElement | null>(null);
  const isPausedRef = useRef(false);
  const manageFocus = props.manageFocus ?? true;

  const onPauseChange = useCallback((paused: boolean) => {
    isPausedRef.current = paused;
    if (paused && containerDivRef.current) {
      containerDivRef.current.blur();
    }
  }, []);

  usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, onPauseChange);

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
      >
        {props.children}
      </div>
    );
  }

  return null;
}
