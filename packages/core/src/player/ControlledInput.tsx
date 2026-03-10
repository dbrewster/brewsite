// ControlledInput.tsx — Drives engine progress from an external value prop.

import { useLayoutEffect, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ControlledProgressContext } from './ControlledProgressContext';

/**
 * Props for ControlledInput.
 * Drives engine progress from an external value (highest priority input tier).
 */
export interface ControlledInputProps {
  /** Normalized engine progress [0, 1]. Drives the engine directly each render. */
  value: number;

  /**
   * Called when another input component (e.g., KeyboardInput) attempts to change
   * the controlled progress. Wire to the same state setter that feeds `value`.
   */
  onChange?: (progress: number) => void;

  /**
   * Optional children rendered inside the ControlledProgressContext.Provider.
   * Use when KeyboardInput or other input components need to receive the onChange context.
   */
  children?: ReactNode;
}

/**
 * ControlledInput drives engine progress from an external value prop.
 * Provides ControlledProgressContext so KeyboardInput can call onChange.
 * Renders no DOM — context provider only.
 */
export function ControlledInput(props: ControlledInputProps): ReactElement {
  const engine = useSceneEngineContext();

  // Write controlled value to engine before first paint — highest priority, always wins.
  // useLayoutEffect fires synchronously after DOM mutations and before the browser paints,
  // eliminating the one-frame lag that useEffect (post-paint) would produce.
  useLayoutEffect(() => {
    engine.setProgress(Math.max(0, Math.min(1, props.value)));
  }, [engine, props.value]);

  const controlledCtxValue = useMemo(
    () => ({ onChange: props.onChange }),
    [props.onChange],
  );

  return (
    <ControlledProgressContext.Provider value={controlledCtxValue}>
      {props.children ?? null}
    </ControlledProgressContext.Provider>
  );
}
