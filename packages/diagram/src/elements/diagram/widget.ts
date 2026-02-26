// DiagramWidget — implements ISceneElement<DiagramState>, IRenderable, IAnimationController.

import * as THREE from 'three';
import type {
  IAnimationController,
  IRenderable,
  ISceneElement,
  AnimationTickContext,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { Diagram } from './dsl';
import { functionalDiagramTransitionSpec } from './compile';
import {
  DiagramRenderer,
  diagramInteractionRegistry,
  diagramInteractionLookup,
} from './render';
import type { DiagramInteractionEvent, DiagramNodeState, DiagramState } from './types';

const CAMERA_KEY = '__brewsite_camera';

export class DiagramWidget
  implements ISceneElement<DiagramState>, IRenderable<DiagramState>, IAnimationController
{
  readonly widgetId: string;
  readonly defaultState: DiagramState;
  readonly transitionSpec = functionalDiagramTransitionSpec;
  readonly DslComponent = Diagram;

  /**
   * Runs after CameraWidget (tickPriority = 0), ensuring the scene camera has
   * been positioned by the Camera widget before DiagramWidget evaluates whether
   * auto-framing is needed.
   */
  readonly tickPriority = 1;

  /**
   * Optional callback for node-click interactions.
   * Assign after construction:
   *   const widget = new DiagramWidget('my-diagram', defaultState);
   *   widget.onInteraction = (evt) => { ... };
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined = undefined;

  private renderer = new DiagramRenderer();
  private scene: THREE.Scene | null = null;
  /** Last applied state — used by onTick for camera auto-framing fallback. */
  private lastState: DiagramState | null = null;

  // Click interaction plumbing
  private canvasElement: HTMLCanvasElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  // Reuse raycaster / NDC vector across clicks to avoid per-click allocation.
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(widgetId: string, defaultState: DiagramState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (renderer?.domElement) {
      this.canvasElement = renderer.domElement;
      this.clickHandler = (e: MouseEvent) => this.handleClick(e);
      this.canvasElement.addEventListener('click', this.clickHandler);
    }
  }

  /**
   * IAnimationController — runs before apply() in the engine tick cycle.
   *
   * When the scene has no active Camera widget (camera.enabled === false or
   * camera widget is absent), this method auto-frames the Three.js camera
   * using the compiler-pre-computed cameraTarget and cameraDistance from
   * DiagramState. This avoids needing to re-derive the bounding box in the
   * render layer (which would violate the render.ts contract).
   */
  onTick(context: AnimationTickContext): void {
    const tick = context.tick;

    // Resolve current diagram state: use the in-tick compiled value so there is
    // no one-frame lag when transitioning into a new scene. Fall back to the
    // last applied state (e.g. when tick is null outside playback).
    const rawDiagramState = tick?.state.widgets[this.widgetId];
    const diagramState = (rawDiagramState as DiagramState | undefined) ?? this.lastState;
    if (!diagramState) return;

    // Yield to the Camera widget when it is explicitly enabled for this tick.
    const rawCamState = tick?.state.widgets['camera'];
    const cameraActive =
      typeof rawCamState === 'object' &&
      rawCamState !== null &&
      'enabled' in rawCamState &&
      (rawCamState as { enabled: boolean }).enabled === true;
    if (cameraActive) return;

    const cam = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;

    // Use compiler-pre-computed camera hints.
    // cameraTarget = diagram bounds centre; cameraDistance = width / (2*tan(22.5°)).
    const [tx, ty, tz] = diagramState.cameraTarget;
    const dist = diagramState.cameraDistance;

    // Slightly elevated angle: 30% of distance up, full distance back along Z.
    cam.position.set(tx, ty + dist * 0.3, tz + dist);
    cam.lookAt(tx, ty, tz);
  }

  apply(state: DiagramState, _ctx: WidgetRenderContext): void {
    if (!this.scene) return;
    this.lastState = state;
    this.renderer.update(state, this.scene);
  }

  /**
   * Ghost-node merge: when a node appears in the next scene with an empty label
   * (the ghost/partial-update pattern used to animate position-only changes across
   * scenes), carry forward the visual identity properties from the previous scene's
   * compiled state so the node renders with the correct shape and label during the
   * transition.
   *
   * Fields carried forward: label, sublabel, shape, iconUrl, iconScale, sublabelColor.
   * Position, opacity, color, and other layout properties always come from next.
   */
  mergeSnapshot(
    prev: DiagramState | undefined,
    next: DiagramState | undefined,
  ): DiagramState | undefined {
    if (!next) return next;
    if (!prev) return next;

    let anyChanged = false;
    const mergedNodes = next.nodes.map((node): DiagramNodeState => {
      // Non-ghost: label is non-empty, no merge needed.
      if (node.label !== '') return node;

      const prevNode = prev.nodes.find((p) => p.id === node.id);
      if (!prevNode) return node;

      anyChanged = true;
      return {
        ...node,
        label: prevNode.label,
        sublabel: prevNode.sublabel,
        shape: prevNode.shape,
        iconUrl: prevNode.iconUrl,
        iconScale: prevNode.iconScale,
        sublabelColor: prevNode.sublabelColor,
      };
    });

    // Avoid allocating a new state object when nothing actually changed.
    return anyChanged ? { ...next, nodes: mergedNodes } : next;
  }

  dispose(): void {
    if (this.canvasElement && this.clickHandler) {
      this.canvasElement.removeEventListener('click', this.clickHandler);
      this.canvasElement = null;
      this.clickHandler = null;
    }
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
    this.lastState = null;
  }

  // ─── Private: click interaction ───────────────────────────────────────────

  private handleClick(event: MouseEvent): void {
    if (!this.onInteraction || !this.scene || !this.canvasElement) return;

    // Convert client coords to normalised device coordinates [-1, +1].
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const cam = this.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;

    this.raycaster.setFromCamera(this.ndc, cam);

    const targets = Array.from(diagramInteractionRegistry);
    const intersects = this.raycaster.intersectObjects(targets, false);
    if (intersects.length === 0) return;

    const hit = intersects[0];
    const mesh = hit.object as THREE.Mesh;
    const info = diagramInteractionLookup.get(mesh);
    if (!info) return;

    // Only fire events for nodes that belong to THIS widget's diagram.
    if (info.diagramId !== this.widgetId) return;

    this.onInteraction({
      type: 'node-click',
      diagramId: info.diagramId,
      nodeId: info.nodeId,
      intersectPoint: [hit.point.x, hit.point.y, hit.point.z],
    });
  }
}
