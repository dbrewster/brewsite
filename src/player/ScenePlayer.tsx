import { useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { SceneGroup } from '../compiler/sceneTypes';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { useSceneEngine } from './useSceneEngine';
import { EngineScrollRegion } from './EngineScrollRegion';
import { ContentSlotContext } from './ContentSlotContext';
import { EngineStateContext } from './EngineStateContext';
import { AnnotationPositioner } from './AnnotationPositioner';
import { AnnotationPositionerContext } from './AnnotationPositionerContext';
import { AnnotationItem } from '../annotations/AnnotationItem';
import { LabelItem } from '../labels/LabelItem';
import { clipMetaFromManifest, assertManifestValid } from '../elements/model/metadata';
import type { AssetManifest } from '../elements/model/metadata';
import { clearCache } from '../compiler/sceneTrackCache';
import { SceneMetaWidget } from './SceneMetaWidget';
import { clearRegistry } from '../compiler/registry';

export type ScenePlayerProps = {
  sceneGroup: SceneGroup;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null) => WidgetRegistry;
  className?: string;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  contentSlots?: Record<string, ReactNode>;
  placeholder?: ReactNode;
  children?: ReactNode;
};

export const ScenePlayer = (props: ScenePlayerProps): ReactElement | null => {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [hmrVersion, setHmrVersion] = useState(0);

  useEffect(() => {
    const hot = (import.meta as ImportMeta & { hot?: { on?: (event: string, cb: () => void) => void; off?: (event: string, cb: () => void) => void } }).hot;
    if (!hot) return undefined;
    const handler = () => {
      const debug = (window as unknown as { __robotRuntimeDebug?: { forceReloadOnHmr?: boolean } }).__robotRuntimeDebug;
      if (debug?.forceReloadOnHmr) {
        window.location.reload();
        return;
      }
      clearRegistry();
      clearCache();
      setHmrVersion((version) => version + 1);
    };
    if (typeof hot.on === 'function') {
      hot.on('vite:beforeUpdate', handler);
    }
    return () => {
      if (typeof hot.off === 'function') {
        hot.off('vite:beforeUpdate', handler);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(props.manifestUrl)
      .then((r) => r.json())
      .then((raw) => {
        if (cancelled) return;
        setManifest(assertManifestValid(raw));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e instanceof Error ? e : new Error(String(e));
        setLoadError(err);
        props.onError?.(err);
      });
    return () => {
      cancelled = true;
    };
  }, [props.manifestUrl, props.onError]);

  useEffect(() => () => clearCache(), []);

  const isBrowser = typeof window !== 'undefined';

  const widgetRegistry = useMemo(
    () => props.widgetSetup(manifest),
    [manifest],
  );

  useEffect(() => {
    const metaWidget = widgetRegistry.get('__scene_meta__');
    if (metaWidget && typeof (metaWidget as SceneMetaWidget).setOnSceneChange === 'function') {
      (metaWidget as SceneMetaWidget).setOnSceneChange(props.onSceneChange);
    }
  }, [widgetRegistry, props.onSceneChange]);

  const annotationPositioner = useMemo(() => new AnnotationPositioner(), []);
  const clipMeta = useMemo(() => (manifest ? clipMetaFromManifest(manifest) : []), [manifest]);
  const contentSlots = useMemo(() => props.contentSlots ?? {}, [props.contentSlots]);

  const engine = useSceneEngine({
    sceneGroup: props.sceneGroup,
    widgetRegistry,
    clipMeta,
    manifest,
    fpsCap: props.fpsCap,
    pixelsPerScene: props.pixelsPerScene,
    framesPerTick: props.framesPerTick,
    onReady: props.onReady,
    onError: props.onError,
    annotationPositioner,
  });

  const engineState = useMemo(() => ({
    progress: engine.progress,
    sceneId: engine.frameState.sceneId,
    sceneIndex: engine.frameState.sceneIndex,
    sceneProgress: engine.frameState.sceneProgress,
  }), [engine.progress, engine.frameState]);

  const annotations = engine.frameState.tick?.annotationPrimitives ?? [];
  const labels = engine.frameState.tick?.labelPrimitives ?? [];
  const showPlaceholder = props.placeholder && engine.frameState.tickIndex < 0;
  const debugOverlayEnabled =
    typeof window !== 'undefined' &&
    (window as unknown as { __robotRuntimeDebug?: { overlay?: boolean } }).__robotRuntimeDebug?.overlay;

  if (!isBrowser) {
    return (props.placeholder ?? null) as ReactElement | null;
  }

  return (
    <VariableStoreContext.Provider value={engine.variableStore}>
      <ContentSlotContext.Provider value={contentSlots}>
        <AnnotationPositionerContext.Provider value={annotationPositioner}>
          <EngineStateContext.Provider value={engineState}>
            <div className={props.className} style={{ position: 'relative' }}>
              {loadError && <div role="alert">Scene engine error: {loadError.message}</div>}
              {showPlaceholder && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {props.placeholder}
                </div>
              )}
              {debugOverlayEnabled && (
                <div
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    fontSize: 12,
                    padding: '8px 10px',
                    borderRadius: 6,
                    pointerEvents: 'none',
                    zIndex: 5,
                    lineHeight: 1.4,
                  }}
                >
                  <div>tickIndex: {engine.frameState.tickIndex}</div>
                  <div>sceneId: {engine.frameState.sceneId || '(none)'}</div>
                  <div>sceneIndex: {engine.frameState.sceneIndex}</div>
                  <div>sceneProgress: {engine.frameState.sceneProgress.toFixed(3)}</div>
                  <div>progress: {engine.progress.toFixed(3)}</div>
                  <div>driverReady: {String(engine.debug?.driverReady)}</div>
                  <div>assetsReady: {String(engine.debug?.assetsReady)}</div>
                  <div>sceneTrackTicks: {engine.debug?.sceneTrackTicks ?? 0}</div>
                  <div>viewport: {engine.debug?.viewport.width}×{engine.debug?.viewport.height}</div>
                </div>
              )}
              <EngineScrollRegion key={hmrVersion} engine={engine}>
                <>
                  {annotations.map((annotation) => (
                    <AnnotationItem key={annotation.id} annotation={annotation} />
                  ))}
                  {labels.map((label) => (
                    <LabelItem key={label.id} label={label} />
                  ))}
                  {props.children}
                </>
              </EngineScrollRegion>
            </div>
          </EngineStateContext.Provider>
        </AnnotationPositionerContext.Provider>
      </ContentSlotContext.Provider>
    </VariableStoreContext.Provider>
  );
};
