// ActionInput.tsx — Bridges compiled InputController DSL to runtime ActionInputController.

import { useContext, useEffect, useRef, type ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ActionInputExtensionContext } from './ActionInputExtensionContext';
import { ActionInputController } from '../input/ActionInputController';
import type { ActionInputHandler } from '../input/ActionInputController';
import type { SceneInputControllerSpec } from '../input/types';
import { resolveLayout } from '../layout/regionLayout';
import type { ViewLayoutState, ViewState } from '../compiler/viewTypes';
import type { CarouselLayoutConfig, ViewLayoutConfig } from '../layout/regionTypes';

export interface ActionInputProps {
  /**
   * DOM element that receives pointer/wheel events.
   * When omitted, uses engine.canvasRef.current (the <canvas> managed by SceneCanvas).
   */
  target?: HTMLElement | null;

  /**
   * DOM element or document that receives keyboard events.
   * Defaults to `document`. Scene authors who need canvas-scoped keyboard events
   * should pass the canvas element explicitly.
   */
  keyboardTarget?: HTMLElement | Document | Window | null;
}

/**
 * ActionInput — null-rendering React component that bridges compiled
 * <InputController> DSL state to the ActionInputController runtime class.
 *
 * Reads `__input_controller` from the current tick via a stable closure,
 * so spec changes across scenes take effect immediately without re-mounting.
 *
 * Known behavior: drops all events until the first engine tick fires and
 * populates `__input_controller` state. This <16ms gap matches the current
 * KeyboardInput behavior and is acceptable.
 */
export function ActionInput(props: ActionInputProps): ReactElement | null {
  const engine = useSceneEngineContext();
  const pluginExtension = useContext(ActionInputExtensionContext);
  const controllerRef = useRef<ActionInputController | null>(null);

  // Keep a ref that is always current so effect closures read the latest engine
  // without needing engine in the dependency array (which would cause the
  // controller to detach+reattach on every tick index change during scroll).
  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => {
    // Resolve target: use provided target, fall back to the engine's canvas ref.
    const targetEl = props.target ?? engineRef.current.canvasRef.current;
    if (!targetEl) return;

    // Stable closure that reads the current tick's input spec.
    // Called on every DOM event — spec changes across scenes take effect
    // immediately without re-mounting the controller.
    const getSpec = (): SceneInputControllerSpec | null => {
      const tick = engineRef.current.frameState.tick;
      if (!tick) return null;
      return (tick.state.widgets['__input_controller'] as SceneInputControllerSpec) ?? null;
    };

    const handler: ActionInputHandler = {
      getSceneCount: () => engineRef.current.sceneCount,

      onSceneStep: (direction, stepScenes) => {
        const count = engineRef.current.sceneCount;
        if (count <= 1) return;
        const delta = direction * (stepScenes / (count - 1));
        engineRef.current.advanceProgress(delta);
      },

      onCameraOrbit: (cameraId, dx, dy, speed) => {
        engineRef.current.applyCameraOrbit(cameraId, dx, dy, speed);
      },

      onCameraDolly: (cameraId, delta, speed) => {
        engineRef.current.applyCameraDolly(cameraId, delta, speed);
      },

      onCameraReset: (cameraId) => {
        engineRef.current.applyCameraReset(cameraId);
      },

      onCarouselStep: (layoutId, direction, stepSlides) => {
        // 1. Read the compiled ViewLayoutState for this layout.
        const tick = engineRef.current.frameState.tick;
        if (!tick) return;

        const layoutState = tick.state.widgets[layoutId] as ViewLayoutState | undefined;
        if (!layoutState || layoutState.kind !== 'carousel') {
          console.warn(
            `[ActionInput] onCarouselStep: ViewLayout "${layoutId}" not found or not a carousel.`,
          );
          return;
        }
        if (!layoutState.layoutConfig || !layoutState.childSizeHints) {
          console.warn(
            `[ActionInput] onCarouselStep: ViewLayout "${layoutId}" missing layoutConfig or childSizeHints. ` +
            `Ensure the scene was compiled with carousel scrubbing support.`,
          );
          return;
        }

        const childCount = layoutState.viewIds.length;
        if (childCount === 0) return;

        const config = layoutState.layoutConfig as CarouselLayoutConfig;
        const loop = config.loop ?? false;

        // 2. Read current activeIndex from VariableStore (falls back to compiled value).
        //    Clamp the fallback: compiled activeIndex may be out of bounds if the
        //    scene author wrote activeIndex={99} with only 3 children.
        const variableStore = engineRef.current.variableStore;
        const storedIndex = variableStore.get('carousel', `${layoutId}.activeIndex`);
        const currentIndex = typeof storedIndex === 'number'
          ? storedIndex
          : Math.max(0, Math.min(childCount - 1, config.activeIndex));

        // 3. Compute new index.
        const rawNext = currentIndex + direction * stepSlides;
        let newIndex: number;
        if (loop) {
          newIndex = ((rawNext % childCount) + childCount) % childCount;
        } else {
          newIndex = Math.max(0, Math.min(childCount - 1, rawNext));
        }

        // 4. No-op if index didn't change (e.g., clamped at boundary).
        if (newIndex === currentIndex) return;

        // 5. Write new index to VariableStore.
        variableStore.set('carousel', `${layoutId}.activeIndex`, newIndex);

        // 6. Recompute layout with updated activeIndex.
        const updatedConfig: ViewLayoutConfig = { ...config, activeIndex: newIndex };
        const layoutResults = resolveLayout(
          updatedConfig,
          layoutState.bounds,
          layoutState.childSizeHints,
        );

        // 7. Build patches: ViewLayoutState override + each child ViewState override.
        const patches: Record<string, unknown> = {};

        const patchedLayoutState: ViewLayoutState = {
          ...layoutState,
          layoutConfig: updatedConfig,
        };
        patches[layoutId] = patchedLayoutState;

        for (let i = 0; i < layoutState.viewIds.length; i++) {
          const viewId = layoutState.viewIds[i]!;
          const result = layoutResults[i];
          if (!result) continue;

          const existingViewState = tick.state.widgets[viewId] as ViewState | undefined;
          if (!existingViewState) continue;

          // Recompute contentBounds from new bounds + existing padding.
          const [pt, pr, pb, pl] = existingViewState.padding;
          const newContentBounds = {
            x: result.bounds.x + pl * result.bounds.w,
            y: result.bounds.y + pt * result.bounds.h,
            w: result.bounds.w * (1 - pl - pr),
            h: result.bounds.h * (1 - pt - pb),
          };

          const patchedViewState: ViewState = {
            ...existingViewState,
            bounds: result.bounds,
            contentBounds: newContentBounds,
            layer: result.layer,
            scale: result.scale,
            z: result.z,
            opacity: result.opacity,
          };
          patches[viewId] = patchedViewState;
        }

        // 8. Apply patches.
        engineRef.current.patchWidgetStates(patches);
      },

      onUnknownAction: pluginExtension ?? undefined,
    };

    // Keyboard defaults to document for broadest compatibility.
    // Scene authors needing canvas-scoped keyboard events should pass keyboardTarget explicitly.
    const keyboardTarget = props.keyboardTarget ?? document;

    const controller = new ActionInputController(
      targetEl,
      getSpec,
      handler,
      keyboardTarget,
      {
        idDefaults: {
          cameraId: engineRef.current.primaryCameraId,
          canvasId: engineRef.current.primaryCanvasActionTargetId,
        },
      },
    );
    controller.attach();
    controllerRef.current = controller;

    return () => {
      controller.detach();
      controllerRef.current = null;
    };
  }, [props.target, props.keyboardTarget, pluginExtension]); // engine intentionally NOT in deps — use engineRef instead

  // Clear widget state patches when the scene track changes (recompilation resets
  // carousels to their compiled activeIndex). Skips the initial mount — patches
  // are only relevant to clear on recompilation, not on first load.
  const sceneTrack = engine.sceneTrack;
  const sceneTrackInitializedRef = useRef(false);
  useEffect(() => {
    if (!sceneTrackInitializedRef.current) {
      sceneTrackInitializedRef.current = true;
      return;
    }
    engineRef.current.patchWidgetStates({});
  }, [sceneTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // No DOM output — pure side-effect component.
}
