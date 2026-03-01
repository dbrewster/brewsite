import { JSX, ReactNode } from 'react';
import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';
import type { ScenePlayerProps } from '@brewsite/core';

// Module-level stable widget setup — MUST NOT be inline.
// If recreated on every render, ScenePlayer would rebuild the Three.js driver
// at 60fps, making the demo non-functional.
const stableWidgetSetup: NonNullable<ScenePlayerProps['widgetSetup']> =
  () => createDefaultWidgetRegistry(null);

interface InlineDemoProps {
  /** Scene JSX children for this demo's ScenePlayer instance */
  children: ReactNode;
  /** Height of the demo container in pixels. Default: 360 */
  height?: number;
  /**
   * External progress [0..1] driving the demo.
   * Typically supplied by useDemoProgress() from DemoProgressProvider.
   * When undefined, the ScenePlayer will use its own scroll/controlled logic.
   */
  controlledProgress?: number;
  /** Manifest URL for model assets. Default: '/scene-manifest.json' */
  manifestUrl?: string;
}

/**
 * InlineDemo — a self-contained 3D demo embedded in a scene's DocPanel.
 *
 * Creates a separate ScenePlayer/EngineProvider instance, fully independent
 * of the docs engine. Progress is driven externally via `controlledProgress`,
 * which is typically wired to `useDemoProgress()` from DemoProgressProvider.
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
      <ScenePlayer
        manifestUrl={manifestUrl}
        widgetSetup={stableWidgetSetup}
        quality="performance"
        controlledProgress={controlledProgress}
      >
        {children}
      </ScenePlayer>
    </div>
  );
}
