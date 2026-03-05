// Private context that wires DocsDemo scroll interception to DemoEngine progress.
// Not exported in packages/docs/src/index.ts — internal implementation detail only.

import { createContext } from 'react';

/**
 * Context value shared between DocsDemo and DemoEngine.
 * DocsDemo provides this context; DemoEngine consumes it.
 *
 * This is a private implementation detail of @brewsite/docs.
 * Demo authors never interact with this context directly.
 */
export interface DemoCaptureContextValue {
  /**
   * Called by DemoEngine on mount to register its `setRawProgress` function.
   * Returns a cleanup function that deregisters on unmount.
   */
  registerEngine: (setRawProgress: (progress: number) => void) => () => void;
  /**
   * Called by WheelCaptureDemo when a wheel delta has been normalized.
   * The DocsDemo accumulates this delta into current progress and calls setRawProgress.
   */
  onWheelDelta: (normalizedDeltaPx: number) => void;
  /**
   * Returns the current demo progress in [0, 1].
   * Used by WheelCaptureDemo for boundary pass-through checks.
   */
  getProgress: () => number;
  /**
   * The scroll budget for this demo in scroll units.
   * 1 scroll unit = 1 normalized pixel of deltaY.
   * Used by DocsDemo to convert normalizedDelta → progress increment.
   */
  readonly scrollUnits: number;
}

export const DemoCaptureContext = createContext<DemoCaptureContextValue | null>(null);
