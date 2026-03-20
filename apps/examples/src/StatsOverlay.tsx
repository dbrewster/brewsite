// StatsOverlay.tsx — Renders RendererStats when the header stats toggle is active.
// Must be placed inside <SceneEngine> (requires useSceneEngineContext).

import type { JSX } from 'react';
import { RendererStats } from '@brewsite/core/player/devtools';
import { useShowStats } from './ExampleHeader';

export function StatsOverlay(): JSX.Element | null {
  const show = useShowStats();
  if (!show) return null;
  return <RendererStats position="top-right" style={{ top: 56, right: 8 }} />;
}
