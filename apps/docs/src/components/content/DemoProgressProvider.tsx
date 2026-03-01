import { JSX, ReactNode, createContext, useContext } from 'react';
import { useEngineState } from '@brewsite/core';

interface DemoProgressContextValue {
  demoProgress: number;
}

const DemoProgressContext = createContext<DemoProgressContextValue>({ demoProgress: 0 });

interface DemoProgressProviderProps {
  /**
   * The sceneProgress value at which the demo begins (0..1).
   * Default 0.25 — demo starts after the panel has slid in (first 25% of scroll).
   */
  startAt?: number;
  children: ReactNode;
}

/**
 * DemoProgressProvider — derives demo progress [0..1] from scene progress.
 *
 * Maps sceneProgress [startAt..1] → demoProgress [0..1].
 * Use this above InlineDemo so the demo plays during the dwell phase
 * (after the DocPanel has slid fully into view).
 *
 * Must be placed inside the ScenePlayer/EngineProvider tree (i.e., inside
 * a <Scene>'s HTML overlay content) so that useEngineState() has a provider.
 */
export function DemoProgressProvider({
  startAt = 0.25,
  children,
}: DemoProgressProviderProps): JSX.Element {
  const { sceneProgress: p } = useEngineState();
  const demoProgress = Math.max(0, Math.min(1, (p - startAt) / (1 - startAt)));
  return (
    <DemoProgressContext.Provider value={{ demoProgress }}>
      {children}
    </DemoProgressContext.Provider>
  );
}

/** Consume the demo progress provided by DemoProgressProvider. */
export function useDemoProgress(): number {
  return useContext(DemoProgressContext).demoProgress;
}
