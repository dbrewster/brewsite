// ActionInput.tsx — Bridges compiled InputController DSL to runtime ActionInputController.

import { useContext, useEffect, useRef, type ReactElement } from 'react';
import { useSceneEngineContext } from './EngineContext';
import { ActionInputExtensionContext } from './ActionInputExtensionContext';
import { ActionInputController } from '../input/ActionInputController';
import type { ActionInputHandler } from '../input/ActionInputController';
import type { SceneInputControllerSpec } from '../input/types';

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

  return null; // No DOM output — pure side-effect component.
}
