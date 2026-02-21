import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';
import type { SceneGroup } from '../compiler/sceneTypes';
import { compileSceneTrack } from '../compiler/sceneTrackCompiler';
import { buildSceneTrackKey, getCachedTrack, setCachedTrack } from '../compiler/sceneTrackCache';
import type { SceneTrack, ClipMeta } from '../compiler/sceneTrackTypes';
import { RuntimeDriverImpl } from '../runtime/RuntimeDriver';
import { RuntimeLoop } from '../runtime/RuntimeLoop';
import { VariableStore } from '../widget/VariableStore';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { EngineFrameDriver } from './EngineFrameDriver';
import type { EngineFrameState } from './engineTypes';
import { useEngineScroll } from './useEngineScroll';
import type { AnnotationPositioner } from './AnnotationPositioner';
import type { AssetManifest } from '../elements/model/metadata';

export type UseSceneEngineOptions = {
  sceneGroup: SceneGroup;
  widgetRegistry: WidgetRegistry;
  clipMeta: ClipMeta[];
  manifest?: AssetManifest | null;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  blockSize?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  annotationPositioner?: AnnotationPositioner;
};

export type UseSceneEngineResult = {
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  scrollRegionHeightPx: number;
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  variableStore: VariableStore;
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  setViewportSize: (width: number, height: number) => void;
};

const DEFAULT_PIXELS_PER_SCENE = 800;
const DEFAULT_BLOCK_SIZE = 10;

const makeInitialFrameState = (): EngineFrameState => ({
  tickIndex: -1,
  progress: 0,
  sceneId: '',
  sceneIndex: 0,
  sceneProgress: 0,
  tick: null,
});

export const useSceneEngine = (options: UseSceneEngineOptions): UseSceneEngineResult => {
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const variableStore = useMemo(() => new VariableStore(), []);
  const [frameState, setFrameState] = useState<EngineFrameState>(makeInitialFrameState);
  const [assetsReady, setAssetsReady] = useState(false);
  const [driverReady, setDriverReady] = useState(false);
  const [sceneTrack, setSceneTrack] = useState<SceneTrack | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(1);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const driverRef = useRef<RuntimeDriverImpl | null>(null);
  const loopRef = useRef<RuntimeLoop | null>(null);
  const frameDriverRef = useRef<EngineFrameDriver | null>(null);
  const readyRef = useRef(false);
  const viewportRef = useRef({ width: 1, height: 1 });

  const blockSize = useMemo(
    () => Math.max(1, Math.round(options.framesPerTick ?? options.blockSize ?? DEFAULT_BLOCK_SIZE)),
    [options.framesPerTick, options.blockSize],
  );

  const scrollRegionHeightPx = useMemo(() => {
    const sceneCount = Math.max(1, options.sceneGroup.scenes.length);
    const numTransitions = Math.max(0, sceneCount - 1);
    const totalFrames = numTransitions * blockSize + 1;
    if (options.pixelsPerScene !== undefined) {
      return Math.max(1, options.pixelsPerScene * sceneCount);
    }
    if (sceneCount <= 1) return Math.max(1, viewportHeight);
    return Math.max(1, viewportHeight + totalFrames);
  }, [options.pixelsPerScene, options.sceneGroup.scenes.length, blockSize, viewportHeight]);

  const { progress, scrollToProgress, getGlobalProgress } = useEngineScroll({
    scrollRegionRef,
    scrollRegionHeightPx,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    if (typeof (media as MediaQueryList).addListener === 'function') {
      (media as MediaQueryList).addListener(update);
      return () => (media as MediaQueryList).removeListener(update);
    }
    return undefined;
  }, []);

  const setCanvasRef = useCallback((next: HTMLCanvasElement | null) => {
    setCanvas(next);
  }, []);

  const setViewportSize = useCallback((width: number, height: number) => {
    viewportRef.current = { width, height };
    setViewportHeight(height);
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (renderer) renderer.setSize(width, height, false);
    if (camera) {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    }
    if (options.annotationPositioner) {
      options.annotationPositioner.setContainerSize(width, height);
    }
  }, [options.annotationPositioner]);

  useEffect(() => {
    if (!canvas || typeof window === 'undefined') return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio ?? 1);
    rendererRef.current = renderer;
    const { width, height } = viewportRef.current;
    renderer.setSize(width, height, false);

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvas]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvas) return;
    readyRef.current = false;
    setDriverReady(false);
    setAssetsReady(false);
    setFrameState(makeInitialFrameState());

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, 100);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const driver = new RuntimeDriverImpl({
      widgetRegistry: options.widgetRegistry,
      variableStore,
      manifest: options.manifest ?? null,
      onAssetsReady: () => setAssetsReady(true),
      onError: options.onError,
    });
    driverRef.current = driver;

    let disposed = false;
    driver.initialize(scene, rendererRef.current ?? undefined)
      .then(() => {
        if (disposed) return;
        setDriverReady(true);
      })
      .catch((error) => {
        if (disposed) return;
        const err = error instanceof Error ? error : new Error(String(error));
        options.onError?.(err);
      });

    return () => {
      disposed = true;
      driver.dispose();
      driverRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      loopRef.current?.stop();
      loopRef.current = null;
      frameDriverRef.current?.reset();
    };
  }, [canvas, options.widgetRegistry, options.onError, options.manifest, variableStore]);

  useEffect(() => {
    const key = buildSceneTrackKey({
      scenes: options.sceneGroup.scenes,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      prefersReducedMotion,
    });
    const cached = getCachedTrack(key);
    if (cached) {
      setSceneTrack(cached);
      return;
    }
    const compiled = compileSceneTrack({
      scenes: options.sceneGroup.scenes,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      clipMeta: options.clipMeta,
      prefersReducedMotion,
    });
    setCachedTrack(key, compiled);
    setSceneTrack(compiled);
  }, [options.sceneGroup, options.widgetRegistry, options.clipMeta, blockSize, prefersReducedMotion]);

  useEffect(() => {
    const driver = driverRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!driver || !renderer || !scene || !camera || !sceneTrack || !driverReady) return;

    driver.setSceneTrack(sceneTrack);
    const frameDriver = new EngineFrameDriver((state) => setFrameState(state));
    frameDriverRef.current = frameDriver;

    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress,
      render: () => {
        renderer.render(scene, camera);
        const tick = driver.getCurrentTick();
        if (options.annotationPositioner && tick) {
          options.annotationPositioner.update(
            tick.annotationPrimitives ?? [],
            tick.labelPrimitives ?? [],
            camera,
            driver.getBoneWorldPositions(),
          );
        }
      },
      onAfterTick: () => {
        frameDriver.handleTick(driver.getCurrentTick());
      },
      fpsCap: options.fpsCap,
    });

    loopRef.current = loop;
    loop.start();

    if (driverReady && !readyRef.current) {
      readyRef.current = true;
      options.onReady?.();
    }

    return () => {
      loop.stop();
      loopRef.current = null;
      frameDriver.reset();
    };
  }, [sceneTrack, getGlobalProgress, options.annotationPositioner, options.fpsCap, options.onReady, driverReady]);

  return {
    frameState,
    scrollRegionRef,
    scrollRegionHeightPx,
    progress,
    scrollToProgress,
    getGlobalProgress,
    variableStore,
    setCanvasRef,
    setViewportSize,
  };
};
