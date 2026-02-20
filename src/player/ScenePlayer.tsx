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

export type ScenePlayerProps = {
  sceneGroup: SceneGroup;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null, options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void }) => WidgetRegistry;
  className?: string;
  fpsCap?: number;
  pixelsPerScene?: number;
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
    () => props.widgetSetup(manifest, { onSceneChange: props.onSceneChange }),
    [manifest, props.widgetSetup, props.onSceneChange],
  );

  const annotationPositioner = useMemo(() => new AnnotationPositioner(), []);
  const clipMeta = useMemo(() => (manifest ? clipMetaFromManifest(manifest) : []), [manifest]);
  const contentSlots = useMemo(() => props.contentSlots ?? {}, [props.contentSlots]);

  const engine = useSceneEngine({
    sceneGroup: props.sceneGroup,
    widgetRegistry,
    clipMeta,
    fpsCap: props.fpsCap,
    pixelsPerScene: props.pixelsPerScene,
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
              <EngineScrollRegion engine={engine}>
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
