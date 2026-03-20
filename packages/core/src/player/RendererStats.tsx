// RendererStats — live Three.js renderer diagnostics overlay.
// Shows FPS, draw calls, geometries, textures, triangle count,
// and widget-level rebuild diagnostics (via duck-typed _diag property).
//
// Place inside <SceneEngine> to access the engine context.
//
// Usage:
//   import { RendererStats } from '@brewsite/core/player/devtools';
//   <SceneEngine ...>
//     <RendererStats />
//   </SceneEngine>

import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';
import { useSceneEngineContext } from './EngineContext';
import type { WidgetRegistry } from '../widget/WidgetRegistry';

export type RendererStatsProps = {
  /** Position on screen. Default: 'bottom-right'. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Update interval in ms. Default: 250 (4 updates/sec). */
  interval?: number;
  /** Widget registry — if provided, scans widgets for _diag counters. */
  widgetRegistry?: WidgetRegistry;
  /** Additional CSS styles. */
  style?: CSSProperties;
};

type WidgetDiag = { widgetId: string; updateCalls: number; earlyOuts: number; fullRebuilds: number };
type FrameTiming = { tickMs: number; renderMs: number; totalMs: number; jitterMs: number; progress: number; progressDelta: number };

type StatsSnapshot = {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  points: number;
  lines: number;
  widgetDiags: WidgetDiag[];
  timing: FrameTiming | null;
};

/** Duck-type check for widgets that expose _diag counters. */
function collectWidgetDiags(engine: { sceneTrack: unknown }): WidgetDiag[] {
  // Access the internal widget registry through the engine's compiled scenes
  // We can't import WidgetRegistry directly, but we can duck-type through
  // the global window.__brewsite_diag hook if available.
  const hook = (globalThis as Record<string, unknown>).__brewsite_widget_diag as
    | (() => WidgetDiag[])
    | undefined;
  if (hook) return hook();
  return [];
}

export function RendererStats({
  position = 'bottom-right',
  interval = 250,
  style,
}: RendererStatsProps): JSX.Element {
  const engine = useSceneEngineContext();
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const prevDiagsRef = useRef<Map<string, WidgetDiag>>(new Map());

  useEffect(() => {
    const renderer = engine.getRenderer();
    if (!renderer) return;

    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      const fps = elapsed > 0 ? (frameCountRef.current / elapsed) * 1000 : 0;
      const frameMs = frameCountRef.current > 0 ? elapsed / frameCountRef.current : 0;

      const info = renderer.info;
      const widgetDiags = collectWidgetDiags(engine);
      const rawTiming = (globalThis as Record<string, unknown>).__brewsite_frame_timing as FrameTiming | undefined;

      // Compute per-interval deltas for widget diags
      const deltaWidgetDiags: WidgetDiag[] = widgetDiags.map((d) => {
        const prev = prevDiagsRef.current.get(d.widgetId);
        const delta = {
          widgetId: d.widgetId,
          updateCalls: d.updateCalls - (prev?.updateCalls ?? 0),
          earlyOuts: d.earlyOuts - (prev?.earlyOuts ?? 0),
          fullRebuilds: d.fullRebuilds - (prev?.fullRebuilds ?? 0),
        };
        prevDiagsRef.current.set(d.widgetId, { ...d });
        return delta;
      });

      setStats({
        fps: Math.round(fps),
        frameMs: Math.round(frameMs * 10) / 10,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        points: info.render.points,
        lines: info.render.lines,
        widgetDiags: deltaWidgetDiags,
        timing: rawTiming ? {
          tickMs: Math.round(rawTiming.tickMs * 100) / 100,
          renderMs: Math.round(rawTiming.renderMs * 100) / 100,
          totalMs: Math.round(rawTiming.totalMs * 100) / 100,
          jitterMs: Math.round(rawTiming.jitterMs * 10) / 10,
          progress: Math.round(rawTiming.progress * 10000) / 10000,
          progressDelta: Math.round((rawTiming as any).progressDelta * 100000) / 100000,
        } : null,
      });

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }, interval);

    // Count frames via a RAF loop
    let running = true;
    const countFrame = () => {
      if (!running) return;
      frameCountRef.current++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);

    return () => {
      running = false;
      clearInterval(id);
    };
  }, [engine, interval]);

  if (!stats) return <></>;

  const posStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    ...(position.includes('top') ? { top: 8 } : { bottom: 8 }),
    ...(position.includes('left') ? { left: 8 } : { right: 8 }),
  };

  return (
    <div
      style={{
        ...posStyle,
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#0f0',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        padding: '8px 12px',
        borderRadius: 6,
        pointerEvents: 'none',
        userSelect: 'none',
        minWidth: 200,
        ...style,
      }}
    >
      <div style={{ color: stats.fps < 30 ? '#f44' : stats.fps < 55 ? '#fa0' : '#0f0' }}>
        {stats.fps} FPS ({stats.frameMs}ms)
      </div>
      <div>Draw calls: {stats.drawCalls}</div>
      <div>Triangles: {stats.triangles.toLocaleString()}</div>
      <div>Geometries: {stats.geometries}</div>
      <div>Textures: {stats.textures}</div>
      <div>Programs: {stats.programs}</div>
      {stats.lines > 0 && <div>Lines: {stats.lines}</div>}
      {stats.timing && (
        <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 4 }}>
          <div>Tick: {stats.timing.tickMs}ms</div>
          <div>Render: {stats.timing.renderMs}ms</div>
          <div>Total: {stats.timing.totalMs}ms</div>
          <div style={{ color: stats.timing.jitterMs > 8 ? '#f44' : stats.timing.jitterMs > 4 ? '#fa0' : '#0f0' }}>
            Jitter: {stats.timing.jitterMs}ms
          </div>
          <div>Progress: {stats.timing.progress}</div>
          <div style={{ color: stats.timing.progressDelta > 0.01 ? '#f44' : '#0f0' }}>
            Δ Progress: {stats.timing.progressDelta}
          </div>
        </div>
      )}
      {stats.widgetDiags.length > 0 && (
        <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 4 }}>
          {stats.widgetDiags.map((d) => (
            <div key={d.widgetId} style={{
              color: d.fullRebuilds > 0 && d.earlyOuts === 0 ? '#f44' : '#0f0',
            }}>
              {d.widgetId.substring(0, 20)}: {d.fullRebuilds} rebuilds / {d.earlyOuts} skips
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
