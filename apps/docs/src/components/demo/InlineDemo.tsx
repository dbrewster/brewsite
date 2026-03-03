import { JSX, ReactNode, useMemo } from 'react';
import {
  corePlugin,
  EngineProvider,
  EngineInputRegion,
  SceneCanvas,
} from '@brewsite/core';

// Module-level stable plugin list for InlineDemo instances.
// MUST be module-level — if recreated on every render, EngineProvider would
// rebuild the entire Three.js driver, causing constant flicker.
const INLINE_DEMO_PLUGINS = [corePlugin()];

interface InlineDemoProps {
  /** Scene JSX children for this demo's EngineProvider instance */
  children: ReactNode;
  /** Height of the demo container in pixels. Default: 360 */
  height?: number;
  /**
   * External progress [0..1] driving the demo.
   * Typically supplied by useDemoProgress() from DemoProgressProvider.
   * When undefined, the EngineProvider will use its own scroll/controlled logic.
   */
  controlledProgress?: number;
  /** Manifest URL for model assets. Default: '/scene-manifest.json' */
  manifestUrl?: string;
}

/**
 * InlineDemo — a self-contained 3D demo embedded in a scene's DocPanel.
 *
 * Creates a separate EngineProvider instance, fully independent of the docs
 * engine. Progress is driven externally via `controlledProgress`, which is
 * typically wired to `useDemoProgress()` from DemoProgressProvider.
 *
 * Uses `quality="performance"` (30fps) to minimize GPU load when multiple
 * demos are present on the page.
 */
export function InlineDemo({
  children,
  height = 360,
  controlledProgress,
  manifestUrl = '/scene-manifest.json',
}: InlineDemoProps): JSX.Element {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        margin: '20px 0',
        background: 'var(--bg-demo)',
      }}
    >
      <EngineProvider
        manifestUrl={manifestUrl}
        plugins={INLINE_DEMO_PLUGINS}
        quality="performance"
        controlledProgress={controlledProgress}
      >
        {children}
        <EngineInputRegion fillContainer>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
