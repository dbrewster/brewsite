import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { RefObject } from 'react';
import type { SceneGroup } from '../compiler/sceneTypes';
import { compileSceneTrack } from '../compiler/sceneTrackCompiler';
import { buildSceneTrackKey, getCachedTrack, setCachedTrack } from '../compiler/sceneTrackCache';
import type { SceneTrack, ClipMeta } from '../compiler/sceneTrackTypes';
import { RuntimeDriverImpl } from '../runtime/RuntimeDriver';
import { ModelRenderer } from '../elements/model/ModelRenderer';
import { RuntimeLoop } from '../runtime/RuntimeLoop';
import { VariableStore } from '../widget/VariableStore';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { EngineFrameDriver } from './EngineFrameDriver';
import type { EngineFrameState } from './engineTypes';
import { useEngineInput } from './useEngineInput';
import type { LabelPositioner } from './LabelPositioner';
import type { AssetManifest } from '../elements/model/metadata';
import type { SceneNavInputMap } from '../input/types';

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
  labelPositioner?: LabelPositioner;
  inputMap?: SceneNavInputMap;
};

export type UseSceneEngineResult = {
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  scrollRegionHeightPx: number;
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  /** Total number of scenes in the scene group. Used by TimelineWidget and useEngineInput. */
  sceneCount: number;
  variableStore: VariableStore;
  setCanvasRef: (canvas: HTMLCanvasElement | null) => void;
  setBackgroundRef: (element: HTMLDivElement | null) => void;
  setViewportSize: (width: number, height: number) => void;
  debug?: {
    driverReady: boolean;
    assetsReady: boolean;
    sceneTrackTicks: number;
    viewport: { width: number; height: number };
  };
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
  const [backgroundElement, setBackgroundElement] = useState<HTMLDivElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(1);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const driverRef = useRef<RuntimeDriverImpl | null>(null);
  const loopRef = useRef<RuntimeLoop | null>(null);
  const frameDriverRef = useRef<EngineFrameDriver | null>(null);
  const readyRef = useRef(false);
  const viewportRef = useRef({ width: 1, height: 1 });
  const engineIdRef = useRef(Math.random().toString(36).slice(2, 7));

  const blockSize = useMemo(
    () => Math.max(1, Math.round(options.framesPerTick ?? options.blockSize ?? DEFAULT_BLOCK_SIZE)),
    [options.framesPerTick, options.blockSize],
  );

  const debugLog = useCallback((...args: unknown[]) => {
    if (typeof window === 'undefined') return;
    const debug = (window as unknown as { __robotRuntimeDebug?: { logLifecycle?: boolean } }).__robotRuntimeDebug;
    if (!debug?.logLifecycle) return;
    // eslint-disable-next-line no-console
    console.log(`[SceneEngine:${engineIdRef.current}]`, ...args);
  }, []);

  const scrollRegionHeightPx = useMemo(() => {
    if (options.inputMap?.mode === 'direct') return Math.max(1, viewportHeight);
    const sceneCount = Math.max(1, options.sceneGroup.scenes.length);
    const numTransitions = Math.max(0, sceneCount - 1);
    const totalFrames = numTransitions * blockSize + 1;
    if (options.pixelsPerScene !== undefined) {
      return Math.max(1, options.pixelsPerScene * sceneCount);
    }
    if (sceneCount <= 1) return Math.max(1, viewportHeight);
    return Math.max(1, viewportHeight + totalFrames);
  }, [options.inputMap?.mode, options.pixelsPerScene, options.sceneGroup.scenes.length, blockSize, viewportHeight]);

  // wheelGuard: reads isWheelClaimedByInteraction from CameraWidget if registered.
  // This prevents scene navigation advancing while camera dolly is active.
  const wheelGuard = useCallback((): boolean => {
    const cameraWidget = options.widgetRegistry.get('camera') as { isWheelClaimedByInteraction?: () => boolean } | undefined;
    return cameraWidget?.isWheelClaimedByInteraction?.() ?? false;
  }, [options.widgetRegistry]);

  const { progress, scrollToProgress, getGlobalProgress } = useEngineInput({
    scrollRegionRef,
    scrollRegionHeightPx,
    sceneCount: options.sceneGroup.scenes.length,
    canvasRef: canvasElementRef,
    inputMap: options.inputMap,
    wheelGuard,
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
    canvasElementRef.current = next;
  }, []);

  const setBackgroundRef = useCallback((next: HTMLDivElement | null) => {
    setBackgroundElement(next);
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
    if (options.labelPositioner) {
      options.labelPositioner.setContainerSize(width, height);
    }
  }, [options.labelPositioner]);

  useEffect(() => {
    if (!canvas || typeof window === 'undefined') return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio ?? 1);
    if (typeof renderer.setClearColor === 'function') {
      renderer.setClearColor(0x000000, 0);
    }
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    debugLog('renderer:init', { canvas });

    const onContextLost = (event: Event) => {
      event.preventDefault();
      debugLog('renderer:contextLost');
    };
    const onContextRestored = () => {
      debugLog('renderer:contextRestored');
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    const { width, height } = viewportRef.current;
    renderer.setSize(width, height, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      debugLog('renderer:dispose');
      ModelRenderer.disposeKtx2Loader(renderer);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvas, debugLog]);

  useEffect(() => {
    const backgroundWidget = options.widgetRegistry.get('background');
    const backgroundWithDom = backgroundWidget as unknown as { setDomElement?: (el: HTMLElement | null) => void } | undefined;
    if (!backgroundWithDom || typeof backgroundWithDom.setDomElement !== 'function') {
      return;
    }
    backgroundWithDom.setDomElement(backgroundElement);
  }, [backgroundElement, options.widgetRegistry]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvas) return;
    readyRef.current = false;
    setDriverReady(false);
    setAssetsReady(false);
    setFrameState(makeInitialFrameState());
    if (!sceneTrack) return;
    debugLog('driver:init:start');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(0, 0, 100);
    scene.userData['__brewsite_camera'] = camera;
    scene.userData['__brewsite_renderer'] = rendererRef.current;
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
        debugLog('driver:init:ready');
      })
      .catch((error) => {
        if (disposed) return;
        const err = error instanceof Error ? error : new Error(String(error));
        options.onError?.(err);
        debugLog('driver:init:error', err);
      });

    return () => {
      disposed = true;
      driver.dispose();
      driverRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      delete (scene as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_camera'];
      delete (scene as unknown as { userData?: Record<string, unknown> })?.userData?.['__brewsite_renderer'];
      loopRef.current?.stop();
      loopRef.current = null;
      frameDriverRef.current?.reset();
      debugLog('driver:dispose');
    };
  }, [canvas, options.widgetRegistry, options.onError, options.manifest, variableStore, sceneTrack, debugLog]);

  useEffect(() => {
    if (options.manifest === null) {
      setSceneTrack(null);
      return;
    }
    const key = buildSceneTrackKey({
      scenes: options.sceneGroup.scenes,
      widgetRegistry: options.widgetRegistry,
      blockSize,
      prefersReducedMotion,
    });
    const cached = getCachedTrack(key);
    if (cached) {
      debugLog('sceneTrack:cacheHit', { key, totalTicks: cached.ticks?.length ?? 0 });
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
    debugLog('sceneTrack:compiled', { key, totalTicks: compiled.ticks?.length ?? 0 });
    setCachedTrack(key, compiled);
    setSceneTrack(compiled);
  }, [
    options.sceneGroup,
    options.widgetRegistry,
    options.clipMeta,
    options.manifest,
    blockSize,
    prefersReducedMotion,
    debugLog,
  ]);

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
        if (options.labelPositioner && tick) {
          options.labelPositioner.update(
            tick.labelPrimitives ?? [],
            camera,
            driver.getBoneWorldPositions(),
            driver.getTargetColors(),
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
    debugLog('loop:start');

    if (driverReady && !readyRef.current) {
      readyRef.current = true;
      options.onReady?.();
    }

    return () => {
      loop.stop();
      loopRef.current = null;
      frameDriver.reset();
      debugLog('loop:stop');
    };
  }, [sceneTrack, getGlobalProgress, options.labelPositioner, options.fpsCap, options.onReady, driverReady, debugLog]);

  return {
    frameState,
    scrollRegionRef,
    scrollRegionHeightPx,
    progress,
    scrollToProgress,
    getGlobalProgress,
    sceneCount: options.sceneGroup.scenes.length,
    variableStore,
    setCanvasRef,
    setBackgroundRef,
    setViewportSize,
    debug: {
      driverReady,
      assetsReady,
      sceneTrackTicks: sceneTrack?.ticks?.length ?? 0,
      viewport: { ...viewportRef.current },
    },
  };
};
