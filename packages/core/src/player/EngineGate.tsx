// EngineGate — renders placeholder until the engine has ticked at least once.
// Use inside SceneEngine to gate rendering on initial engine readiness.

import type { ReactElement, ReactNode } from 'react';
import { useEngineStateContext } from './EngineStateContext';

export type EngineGateProps = {
  /** Content shown before the engine's first tick. Defaults to null. */
  placeholder?: ReactNode;
  children: ReactNode;
};

/**
 * Conditionally renders children once the engine has produced its first frame.
 * Before the first tick, renders `placeholder` (or nothing if omitted).
 *
 * Must be placed inside a `<SceneEngine>` tree.
 *
 * @example
 * <SceneEngine plugins={[corePlugin()]} getFrame={() => <IntroScene />}>
 *   <EngineGate placeholder={<Spinner />}>
 *     <SceneCanvas />
 *     <EngineOverlayHost />
 *   </EngineGate>
 * </SceneEngine>
 */
export const EngineGate = ({ placeholder = null, children }: EngineGateProps): ReactElement => {
  const state = useEngineStateContext();
  if (state.tickIndex < 0) return <>{placeholder}</>;
  return <>{children}</>;
};
