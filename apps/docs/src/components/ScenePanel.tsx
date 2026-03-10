// Block-level 3D scene panel in normal document flow.
// Each ScenePanel owns its SceneEngine and WebGL context lifecycle.
// Progress is driven by wall-clock time (TimeInput) — no scroll wiring.

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { SceneEngine, SceneCanvas, TimeInput } from '@brewsite/core';
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
 * Lazy mounting: SceneEngine is not created until the panel is within ~2 viewport
 * heights of the current scroll position (rootMargin: '600px'). Once mounted,
 * the engine stays mounted for the session.
 *
 * Progress: driven by TimeInput via wall-clock elapsed time. The scene auto-plays
 * when in view, pauses when off-screen, and resets+replays each time it scrolls
 * back into view.
 */
export function ScenePanel({
  id,
  height,
  duration,
  plugins,
  children,
}: ScenePanelProps): JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);

  // SceneEngine is only mounted once the panel is within 2 viewports of scroll position.
  // Once true, never reverts to false.
  const [engineMounted, setEngineMounted] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setEngineMounted(true);
          obs.disconnect(); // Never unmount — stay mounted after first trigger.
        }
      },
      { rootMargin: '600px' },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={mountRef}
      id={id}
      style={{
        position: 'relative',
        height: height ?? '480px',
        width: '100%',
      }}
    >
      {engineMounted && (
        <SceneEngine
          plugins={plugins}
          timingProfile={{ qualityPreset: 'balanced' }}
          onError={(err) => console.error(`[ScenePanel id="${id}"]`, err)}
        >
          {children}
          <TimeInput duration={duration ?? 3} />
          <SceneCanvas style={{ width: '100%', height: '100%', display: 'block' }} />
        </SceneEngine>
      )}
    </div>
  );
}
