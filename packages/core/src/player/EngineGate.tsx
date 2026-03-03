// EngineGate — renders placeholder until the engine has ticked at least once.
// Use inside EngineProvider to gate rendering on initial engine readiness.

import type { ReactElement, ReactNode } from 'react';
import { useEngineState } from './EngineStateContext';

export type EngineGateProps = {
  /** Content shown before the engine's first tick. Defaults to null. */
  placeholder?: ReactNode;
  children: ReactNode;
};

/**
 * Conditionally renders children once the engine has produced its first frame.
 * Before the first tick, renders `placeholder` (or nothing if omitted).
 *
 * Must be placed inside an `<EngineProvider>` tree.
 *
 * @example
 * <EngineProvider manifestUrl="/manifest.json" plugins={[corePlugin()]}>
 *   <Scene id="intro">...</Scene>
 *   <EngineGate placeholder={<Spinner />}>
 *     <EngineInputRegion>
 *       <SceneCanvas />
 *       <EngineOverlayHost />
 *     </EngineInputRegion>
 *   </EngineGate>
 * </EngineProvider>
 * // EngineInputRegion reads from EngineContext — no engine prop needed (see §9.2)
 */
export const EngineGate = ({ placeholder = null, children }: EngineGateProps): ReactElement => {
  const state = useEngineState();
  if (state.tickIndex < 0) return <>{placeholder}</>;
  return <>{children}</>;
};
