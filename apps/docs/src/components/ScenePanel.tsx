// Block-level 3D scene panel in normal document flow.
// Each ScenePanel owns its SceneEngine and WebGL context lifecycle.
// Progress is driven by auto-play via SceneEmbed.

import { type JSX, type ReactNode } from 'react';
import { SceneEmbed } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';

export interface ScenePanelProps {
  /**
   * The HTML id for this panel. Used as the anchor target for sidebar nav
   * and native browser anchor links (e.g., /docs#scene-what-is-brewsite).
   */
  id: string;

  /** CSS height string. Default: '480px'. */
  height?: string;

  /** Seconds to animate through the scene (0→1 progress). Default: 3. */
  duration?: number;

  /** WidgetPlugin array for this panel's SceneEngine. */
  plugins: WidgetPlugin[];

  /** Scene DSL children (<Scene> declarations). */
  children: ReactNode;
}

/**
 * ScenePanel — a fixed-height block element in normal document flow containing
 * a real <canvas> for 3D scene rendering.
 *
 * Uses visibility="lazy" to defer WebGL context creation until the panel
 * is near the viewport, and auto-plays the scene via wall-clock time.
 */
export function ScenePanel({
  id,
  height,
  duration,
  plugins,
  children,
}: ScenePanelProps): JSX.Element {
  return (
    <SceneEmbed
      id={id}
      height={height ?? '480px'}
      plugins={plugins}
      timingProfile={{ qualityPreset: 'balanced' }}
      autoPlay={{ duration: duration ?? 3, loop: true }}
      visibility="lazy"
      onError={(err) => console.error(`[ScenePanel id="${id}"]`, err)}
    >
      {children}
    </SceneEmbed>
  );
}
