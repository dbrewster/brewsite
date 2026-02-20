import type {RefObject} from 'react';
import {useEffect, useRef, useState} from 'react';
import type {SceneTrack} from '../runtime/compiler/sceneTrackTypes';
import type {SceneTrackSampler} from '../runtime/compiler/sceneTrackSampler';
import type {RuntimeDriver} from '../runtime/types';
import type {RuntimeFrame} from '../runtime/RuntimeLoop';
import {RuntimeLoop} from '../runtime/RuntimeLoop';
import {EngineFrameDriver} from './EngineFrameDriver';
import {useEngineScroll} from './useEngineScroll';
import type {EngineFrameState} from './engineTypes';

export type UseSceneEngineOptions = {
  sceneTrack: SceneTrack | null;
  sceneSampler: SceneTrackSampler | null;
  /** null until model loads — loop is deferred until non-null. */
  driver: RuntimeDriver | null;
  /** Three.js render function — stable wrapper, reads from a ref set at model-load time. */
  render: () => void;
  mainRef: RefObject<HTMLElement | null>;
  /** RAF fps cap. Default 60. */
  fpsCap?: number;
  /** Pixels of scroll travel per scene. Default 400. */
  pixelsPerScene?: number;
  /** Called every RAF frame with delta/wall time — use for logo ticks, perf tracking, etc. */
  onWallTimeTick?: (options: { deltaSeconds: number; wallTimeSeconds: number }) => void;
};

export type UseSceneEngineResult = {
  /** Updated when scroll crosses a compiled frame boundary. */
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  /** Height for the ScrollRegion spacer div. */
  scrollRegionHeightPx: number;
  /** React state [0,1] — for scrubber display and background CSS. */
  progress: number;
  /** Write scroll position — single source of truth for scrubber. */
  scrollToProgress: (next: number) => void;
  /** Direct DOM progress reader — zero lag, passed to RuntimeLoop. */
  getGlobalProgress: () => number;
};

/**
 * Main integration hook for the scroll-driven 3D scene engine.
 *
 * Wires useEngineScroll + EngineFrameDriver + RuntimeLoop into a single
 * page-agnostic hook. Pages call this once and consume the narrow result API.
 *
 * Accepts null for sceneTrack/sceneSampler — the loop will not start until
 * both are non-null and the driver is ready.
 */
export const useSceneEngine = ({
  sceneTrack,
  sceneSampler,
  driver,
  render,
  mainRef,
  fpsCap = 60,
  pixelsPerScene,
  onWallTimeTick,
}: UseSceneEngineOptions): UseSceneEngineResult => {
  const { scrollRegionRef, getGlobalProgress, progress, scrollToProgress, scrollRegionHeightPx } =
    useEngineScroll({
      sceneCount: sceneTrack?.sceneWindows.length ?? 0,
      subTickCount: sceneTrack?.subTickCount ?? 1,
      pixelsPerScene,
      mainRef,
    });

  const [frameState, setFrameState] = useState<EngineFrameState>(() => {
    if (!sceneSampler) return { frameIndex: 0, globalProgress: 0, wallTimeSeconds: 0, tick: null };
    const tick = sceneSampler.sample(0);
    return { frameIndex: tick.index, globalProgress: 0, wallTimeSeconds: 0, tick };
  });

  // Keep refs stable so loop closures always read current values without restarting.
  const getGlobalProgressRef = useRef(getGlobalProgress);
  getGlobalProgressRef.current = getGlobalProgress;

  const onWallTimeTickRef = useRef(onWallTimeTick);
  onWallTimeTickRef.current = onWallTimeTick;

  const renderRef = useRef(render);
  renderRef.current = render;

  // EngineFrameDriver ref — rebuilt when sceneSampler changes (quality tier switch).
  const frameDriverRef = useRef<EngineFrameDriver | null>(null);

  useEffect(() => {
    if (!sceneSampler) return;
    frameDriverRef.current = new EngineFrameDriver({
      sampler: sceneSampler,
      onScrollFrameChange: setFrameState,
    });
  }, [sceneSampler]);

  // Update driver's scene track when it changes (quality tier switch, assets ready, etc.).
  useEffect(() => {
    if (!driver || !sceneTrack || !sceneSampler) return;
    driver.setSceneTrack(sceneTrack, sceneSampler);
  }, [driver, sceneTrack, sceneSampler]);

  // Start/stop RuntimeLoop when driver becomes ready.
  // render, sceneSampler, sceneTrack changes are handled via refs — loop does not restart.
  useEffect(() => {
    if (!driver || !sceneTrack || !sceneSampler) return;

    // Ensure track is set before the first tick (no-op if same reference).
    driver.setSceneTrack(sceneTrack, sceneSampler);

    // Create a fresh frame driver for this loop instance.
    frameDriverRef.current = new EngineFrameDriver({
      sampler: sceneSampler,
      onScrollFrameChange: setFrameState,
    });

    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => getGlobalProgressRef.current(),
      render: () => renderRef.current(),
      onAfterTick: (frame: RuntimeFrame) => {
        frameDriverRef.current?.tick({
          globalProgress: frame.globalProgress,
          wallTimeSeconds: frame.wallTimeSeconds,
        });
        onWallTimeTickRef.current?.({
          deltaSeconds: frame.deltaSeconds,
          wallTimeSeconds: frame.wallTimeSeconds,
        });
      },
      fpsCap,
    });

    loop.start();
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    loop.stepImmediate(now);

    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, fpsCap]);

  return {
    frameState,
    scrollRegionRef,
    scrollRegionHeightPx,
    progress,
    scrollToProgress,
    getGlobalProgress,
  };
};
