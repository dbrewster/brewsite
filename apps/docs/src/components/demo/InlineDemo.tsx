import { type JSX, type ReactNode } from 'react';
import {
  corePlugin,
  SceneEmbed,
} from '@brewsite/core';

// Module-level stable plugin list for InlineDemo instances.
// MUST be module-level — if recreated on every render, SceneEngine would
// rebuild the entire Three.js driver, causing constant flicker.
const INLINE_DEMO_PLUGINS = [corePlugin()];

interface InlineDemoProps {
  /** Scene JSX children for this demo's SceneEmbed instance */
  children: ReactNode;
  /** Height of the demo container in pixels. Default: 360 */
  height?: number;
  /**
   * External progress [0..1] driving the demo.
   * Typically supplied by useDemoProgress() from DemoProgressProvider.
   */
  controlledProgress?: number;
}

/**
 * InlineDemo — a self-contained 3D demo embedded in a scene's DocPanel.
 *
 * Creates a separate SceneEmbed instance, fully independent of the docs engine.
 * Progress is driven externally via `controlledProgress`, which is typically
 * wired to `useDemoProgress()` from DemoProgressProvider.
 *
 * Uses timingProfile 'performance' (30fps) to minimize GPU load when multiple
 * demos are present on the page.
 */
export function InlineDemo({
  children,
  height = 360,
  controlledProgress,
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
      <SceneEmbed
        height={height}
        plugins={INLINE_DEMO_PLUGINS}
        timingProfile={{ qualityPreset: 'performance' }}
        progress={controlledProgress}
        visibility="autopause"
      >
        {children}
      </SceneEmbed>
    </div>
  );
}
