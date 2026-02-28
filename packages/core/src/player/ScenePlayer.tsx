import { Children, isValidElement, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Scene } from '../compiler/sceneDslCompiler';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { useSceneEngine } from './useSceneEngine';
import { EngineInputRegion } from './EngineInputRegion';
import { EngineStateContext } from './EngineStateContext';
import { EngineContext } from './EngineContext';
import { HudOverlay } from '../hud/HudOverlay';
import { LabelPositioner } from './LabelPositioner';
import { LabelPositionerContext } from './LabelPositionerContext';
import { LabelItem } from '../labels/LabelItem';
import { clipMetaFromManifest, assertManifestValid } from '../elements/model/metadata';
import type { AssetManifest } from '../elements/model/metadata';
import { clearCache } from '../compiler/sceneTrackCache';
import { SceneMetaWidget } from './SceneMetaWidget';
import type { SceneNavInputMap } from '../input/types';
import { TimelineWidget } from './TimelineWidget';
import type { TimelineWidgetProps } from './TimelineWidgetTypes';
import { serializeJsx } from './serializeJsx';
import { setSceneRuntimeState, unregisterSceneRuntime } from './ScenePlayerRegistry';

export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};

export type ScenePlayerProps = {
  id?: string;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null) => WidgetRegistry;
  className?: string;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  placeholder?: ReactNode;
  /** Input configuration for scene navigation. */
  inputMap?: SceneNavInputMap;
  /**
   * Whether to render the built-in timeline widget at the bottom.
   * Pass `true` for defaults, or a `TimelineWidgetProps` subset to configure it.
   */
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;
  /**
   * Scene content. Each direct child must be a <Scene key="..."> element.
   * The key prop is required per scene; a warning is emitted and index used as fallback
   * if omitted.
   */
  children: ReactNode;
};

export const ScenePlayer = (props: ScenePlayerProps): ReactElement | null => {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const allChildren = Children.toArray(props.children);
  const rawSceneElements = allChildren.filter(
    (c): c is ReactElement => isValidElement(c) && (c as ReactElement).type === Scene,
  ) as ReactElement[];

  const nonSceneCount = allChildren.length - rawSceneElements.length;
  if (nonSceneCount > 0) {
    console.warn(
      `[ScenePlayer] ${nonSceneCount} non-<Scene> child(ren) were passed and will be ignored. ` +
      'ScenePlayer only processes direct <Scene key="..."> children. ' +
      'For overlay UI, use the HUD system or place content outside ScenePlayer.',
    );
  }

  const rawSpecs: InternalSceneSpec[] = rawSceneElements.map((el, i) => {
    const key = el.key;
    const keyString = key === null ? null : String(key);
    const hasExplicitKey = keyString !== null && keyString.startsWith('.$');
    if (!hasExplicitKey) {
      console.warn(
        `[ScenePlayer] <Scene> at index ${i} has no key prop. ` +
        'Assign key="..." to each <Scene> for stable identity. ' +
        `Falling back to index "${i}".`,
      );
    }
    return {
      sceneKey: hasExplicitKey ? keyString.slice(2) : String(i),
      contentKey: serializeJsx(el),
      element: el,
    };
  });

  const sceneContentKey = rawSpecs.map((s) => s.contentKey).join('|||');

  const scenes = useMemo(
    () => rawSpecs,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneContentKey],
  );

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

  const labelPositioner = useMemo(() => new LabelPositioner(), []);
  const clipMeta = useMemo(() => (manifest ? clipMetaFromManifest(manifest) : []), [manifest]);

  const engine = useSceneEngine({
    scenes,
    widgetRegistry,
    clipMeta,
    manifest,
    fpsCap: props.fpsCap,
    pixelsPerScene: props.pixelsPerScene,
    framesPerTick: props.framesPerTick,
    onReady: props.onReady,
    onError: props.onError,
    labelPositioner,
    inputMap: props.inputMap,
  });

  const assetsReady = engine.debug?.assetsReady ?? false;
  const viewport = engine.debug?.viewport ?? { width: 1, height: 1 };

  useEffect(() => {
    const playerId = props.id;
    if (!playerId) return undefined;
    setSceneRuntimeState(playerId, {
      assetsReady,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / Math.max(1, viewport.height),
      },
      variables: engine.variableStore,
      numScenes: scenes.length,
    });
    return () => unregisterSceneRuntime(playerId);
  }, [props.id, assetsReady, viewport.width, viewport.height, engine.variableStore, scenes.length]);

  const engineState = useMemo(() => ({
    progress: engine.progress,
    sceneId: engine.frameState.sceneId,
    sceneIndex: engine.frameState.sceneIndex,
    sceneProgress: engine.frameState.sceneProgress,
  }), [engine.progress, engine.frameState]);

  const labels = engine.frameState.tick?.labelPrimitives ?? [];
  const showPlaceholder = props.placeholder && engine.frameState.tickIndex < 0;

  if (!isBrowser) {
    return (props.placeholder ?? null) as ReactElement | null;
  }

  return (
    <VariableStoreContext.Provider value={engine.variableStore}>
      <LabelPositionerContext.Provider value={labelPositioner}>
        <EngineStateContext.Provider value={engineState}>
          <EngineContext.Provider value={engine}>
            <div className={props.className} style={{ position: 'relative' }}>
              {loadError && <div role="alert">Scene engine error: {loadError.message}</div>}
              {showPlaceholder && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {props.placeholder}
                </div>
              )}
              <EngineInputRegion engine={engine} inputMap={props.inputMap}>
                <>
                  <HudOverlay items={engine.frameState.tick?.hudPrimitives ?? []} />
                  {labels.map((label) => (
                    <LabelItem key={label.id} label={label} />
                  ))}
                  {props.timeline && (
                    <TimelineWidget
                      engine={engine}
                      scenes={scenes.map((scene) => ({ id: scene.sceneKey }))}
                      {...(typeof props.timeline === 'object' ? props.timeline : {})}
                    />
                  )}
                </>
              </EngineInputRegion>
            </div>
          </EngineContext.Provider>
        </EngineStateContext.Provider>
      </LabelPositionerContext.Provider>
    </VariableStoreContext.Provider>
  );
};
