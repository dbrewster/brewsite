// RendererStats — live Three.js renderer diagnostics overlay.
// Metrics grouped by pipeline stage: Compiler → Tick → Render → GPU → Frame Pacing.
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
import { getCacheStats, type CacheStats } from '../compiler/sceneTrackCache';

export type RendererStatsProps = {
  /** Position on screen. Default: 'bottom-right'. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Update interval in ms. Default: 250 (4 updates/sec). */
  interval?: number;
  /** Additional CSS styles. */
  style?: CSSProperties;
};

type FrameTiming = {
  tickMs: number;
  renderMs: number;
  totalMs: number;
  jitterMs: number;
  frameP01: number;
  frameP99: number;
  progress: number;
  progressDelta: number;
  fpsCap: number | null;
};

type StatsSnapshot = {
  fps: number;
  fpsCap: number | null;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  points: number;
  lines: number;
  timing: FrameTiming | null;
  cache: CacheStats;
};

export function RendererStats({
  position = 'bottom-right',
  interval = 250,
  style,
}: RendererStatsProps): JSX.Element {
  const engine = useSceneEngineContext();
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [hoveredTip, setHoveredTip] = useState<string | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    const renderer = engine.getRenderer();
    if (!renderer) return;

    const id = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      const fps = elapsed > 0 ? (frameCountRef.current / elapsed) * 1000 : 0;
      const frameMs = frameCountRef.current > 0 ? elapsed / frameCountRef.current : 0;

      const info = renderer.info;
      const rawTiming = (globalThis as Record<string, unknown>).__brewsite_frame_timing as FrameTiming | undefined;

      setStats({
        fps: Math.round(fps),
        fpsCap: rawTiming?.fpsCap ?? null,
        frameMs: Math.round(frameMs * 10) / 10,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        points: info.render.points,
        lines: info.render.lines,
        timing: rawTiming ? {
          tickMs: Math.round(rawTiming.tickMs * 100) / 100,
          renderMs: Math.round(rawTiming.renderMs * 100) / 100,
          totalMs: Math.round(rawTiming.totalMs * 100) / 100,
          jitterMs: Math.round(rawTiming.jitterMs * 100) / 100,
          frameP01: Math.round(rawTiming.frameP01 * 10) / 10,
          frameP99: Math.round(rawTiming.frameP99 * 10) / 10,
          progress: Math.round(rawTiming.progress * 10000) / 10000,
          progressDelta: Math.round((rawTiming as Record<string, number>).progressDelta * 100000) / 100000,
          fpsCap: rawTiming.fpsCap,
        } : null,
        cache: getCacheStats(),
      });

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }, interval);

    let running = true;
    const countFrame = (): void => {
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

  const fpsColor = stats.fps < 30 ? '#f44' : stats.fps < 55 ? '#fa0' : '#0f0';
  const jitterColor = stats.timing
    ? (stats.timing.jitterMs > 4 ? '#f44' : stats.timing.jitterMs > 2 ? '#fa0' : '#0f0')
    : '#0f0';
  const progressDeltaColor = stats.timing && stats.timing.progressDelta > 0.01 ? '#f44' : '#0f0';

  const showTip = (tip: string | undefined): void => { if (tip) setHoveredTip(tip); };
  const hideTip = (): void => setHoveredTip(null);

  return (
    <div
      style={{
        ...posStyle,
        background: 'rgba(0, 0, 0, 0.92)',
        color: '#0f0',
        fontFamily: 'JetBrains Mono, Fira Code, ui-monospace, monospace',
        fontSize: 11,
        lineHeight: 1.4,
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid rgba(0, 255, 0, 0.12)',
        pointerEvents: 'auto',
        userSelect: 'none',
        minWidth: 240,
        ...style,
      }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          {/* ── 1. Compiler ── */}
          <SectionHeader label="Compiler" onHover={showTip} onLeave={hideTip}
            tip="Scene DSL compilation pipeline. Scenes are compiled once into a pre-baked SceneTrack; results are cached for reuse." />
          <Row label="Cache hits" value={stats.cache.hits} onHover={showTip} onLeave={hideTip}
            tip="Reused a previously compiled SceneTrack. Hits are rare because theme changes clear the cache." />
          <Row label="Cache misses" value={stats.cache.misses} onHover={showTip} onLeave={hideTip}
            tip="Full compilation triggered (DSL → SceneTrack). Expected on first load and after theme changes." />
          <Row label="Cache entries" value={stats.cache.size} onHover={showTip} onLeave={hideTip}
            tip="Compiled SceneTracks held in memory. Each unique scenes + theme + widget combination produces one." />

          {/* ── 2. Engine Tick ── */}
          {stats.timing && (
            <>
              <SectionHeader label="Engine Tick" onHover={showTip} onLeave={hideTip}
                tip="Per-frame engine tick: samples the SceneTrack at current progress, diffs widget state, dispatches updates to renderers." />
              <Row label="Tick" value={`${stats.timing.tickMs}ms`} onHover={showTip} onLeave={hideTip}
                tip="Time spent sampling the SceneTrack and updating widget state. Pure JS, no GPU. Should be < 2ms." />
              <Row label="Progress" value={stats.timing.progress} onHover={showTip} onLeave={hideTip}
                tip="Global scene progress [0…1]. Driven by scroll or programmatic control. 0 = first scene start, 1 = last scene end." />
              <Row label={'Δ Progress'} value={stats.timing.progressDelta} color={progressDeltaColor} onHover={showTip} onLeave={hideTip}
                tip="Frame-to-frame progress change. Values > 0.01 (red) indicate a jump or fast scroll that may cause visual discontinuity." />
            </>
          )}

          {/* ── 3. GPU / Render ── */}
          <SectionHeader label="GPU" onHover={showTip} onLeave={hideTip}
            tip="Three.js WebGL renderer statistics for the current frame's scene graph." />
          {stats.timing && (
            <Row label="Render" value={`${stats.timing.renderMs}ms`} onHover={showTip} onLeave={hideTip}
              tip="Three.js render call: scene graph traversal, draw call submission, GPU command buffering." />
          )}
          <Row label="Draw calls" value={stats.drawCalls} onHover={showTip} onLeave={hideTip}
            tip="GPU draw commands this frame. Each renders a batch of geometry. Lower = better; batch similar materials to reduce." />
          <Row label="Triangles" value={stats.triangles.toLocaleString()} onHover={showTip} onLeave={hideTip}
            tip="Total triangles rasterized. High counts increase GPU fill cost and fragment shader work." />
          <Row label="Geometries" value={stats.geometries} onHover={showTip} onLeave={hideTip}
            tip="Geometry buffers in GPU memory. Watch for unexpected growth over time (leak indicator)." />
          <Row label="Textures" value={stats.textures} onHover={showTip} onLeave={hideTip}
            tip="Texture objects in GPU memory. Each consumes VRAM proportional to its resolution." />
          <Row label="Programs" value={stats.programs} onHover={showTip} onLeave={hideTip}
            tip="Compiled WebGL shader programs. Each unique material creates one. More = more state switches." />
          {stats.lines > 0 && (
            <Row label="Lines" value={stats.lines} onHover={showTip} onLeave={hideTip}
              tip="Line segments rendered (wireframe, edges, debug lines)." />
          )}

          {/* ── 4. Frame Pacing ── */}
          <SectionHeader label="Frame Pacing" onHover={showTip} onLeave={hideTip}
            tip="Overall frame delivery quality. Measures how smoothly and consistently frames reach the display." />
          <Row label="FPS" value={`${stats.fps}  (${stats.frameMs}ms)`} color={fpsColor} onHover={showTip} onLeave={hideTip}
            tip="Measured frames per second (avg frame time). Green ≥ 55fps, amber ≥ 30fps, red < 30fps." />
          <Row label="FPS Cap" value={stats.fpsCap ?? 'none'} onHover={showTip} onLeave={hideTip}
            tip="Frame rate cap set on the RuntimeLoop. 'none' = uncapped, runs at monitor native refresh rate." />
          {stats.timing && (
            <>
              <Row label="Frame total" value={`${stats.timing.totalMs}ms`} onHover={showTip} onLeave={hideTip}
                tip="Wall-clock time for one complete frame (tick + render). Must stay under 16.7ms for 60fps, 8.3ms for 120fps." />
              <Row label="Stddev" value={`${stats.timing.jitterMs}ms`} color={jitterColor} onHover={showTip} onLeave={hideTip}
                tip="Standard deviation of frame intervals over 60 frames. Measures pacing consistency. Green < 2ms, amber < 4ms, red ≥ 4ms." />
              <Row label="P1 / P99" value={`${stats.timing.frameP01}ms / ${stats.timing.frameP99}ms`} onHover={showTip} onLeave={hideTip}
                tip="1st and 99th percentile frame times. P1 = best case, P99 = worst case. Large gap = inconsistent delivery." />
            </>
          )}
        </tbody>
      </table>

      {/* ── Tooltip popover ── */}
      {hoveredTip && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          background: 'rgba(20, 40, 20, 0.95)',
          border: '1px solid rgba(0, 255, 0, 0.2)',
          borderRadius: 6,
          fontSize: 10,
          lineHeight: 1.5,
          color: 'rgba(200, 255, 200, 0.85)',
          maxWidth: 280,
        }}>
          {hoveredTip}
        </div>
      )}
    </div>
  );
}

// ── Table helper components ──────────────────────────────────────────────────

type HoverProps = {
  tip?: string;
  onHover: (tip: string | undefined) => void;
  onLeave: () => void;
};

function SectionHeader({ label, tip, onHover, onLeave }: { label: string } & HoverProps): JSX.Element {
  return (
    <tr
      onMouseEnter={() => onHover(tip)}
      onMouseLeave={onLeave}
    >
      <td
        colSpan={2}
        style={{
          paddingTop: 8,
          paddingBottom: 4,
          cursor: tip ? 'help' : undefined,
        }}
      >
        <div style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#000',
          background: 'rgba(0, 255, 0, 0.45)',
          padding: '2px 6px',
          borderRadius: 3,
          display: 'inline-block',
        }}>
          {label}
        </div>
      </td>
    </tr>
  );
}

function Row({ label, value, color, tip, onHover, onLeave }: {
  label: string;
  value: string | number;
  color?: string;
} & HoverProps): JSX.Element {
  return (
    <tr
      onMouseEnter={() => onHover(tip)}
      onMouseLeave={onLeave}
      style={{ cursor: tip ? 'help' : undefined }}
    >
      <td style={{ paddingRight: 12, color: 'rgba(0, 255, 0, 0.5)', whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ textAlign: 'right', color: color ?? '#0f0', whiteSpace: 'nowrap' }}>{value}</td>
    </tr>
  );
}
