// BackgroundLayer.tsx — Wires engine.setBackgroundRef to a positioned div.
// Required in custom layouts that use <Background> DSL element outside ScrollStage/SceneReel.

import type { CSSProperties, ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';

export interface BackgroundLayerProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * BackgroundLayer — wires the engine's background ref to a div element.
 * The Background DSL element writes CSS background properties to this div.
 * Place behind SceneCanvas (lower z-index or earlier in DOM order).
 *
 * ScrollStage and SceneReel provide a pre-wired BackgroundLayer internally —
 * only use this directly in raw SceneEngine + SceneCanvas layouts.
 */
export function BackgroundLayer({ className, style }: BackgroundLayerProps): ReactElement {
  const engine = useSceneEngineContext();
  return (
    <div
      ref={engine.setBackgroundRef}
      className={className}
      style={{
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
