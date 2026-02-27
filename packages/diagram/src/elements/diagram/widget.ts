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
import { DiagramRenderer } from './render';
import type { DiagramInteractionEvent, DiagramNodeState, DiagramState } from './types';
import { rotateXYZ } from './canvas/compiler/pipeRouter';

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
   * using diagram bounds + position + scale from DiagramState.
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
    const functionalCam = tick
      ? context.track?.transitionBlocks?.[tick.sceneIndex]?.widgetFns['camera']
      : undefined;
    const resolvedCamState = functionalCam
      ? (functionalCam.fn(tick!.blockProgress) as { enabled?: boolean })
      : (rawCamState as { enabled?: boolean } | undefined);
    const cameraActive =
      typeof resolvedCamState === 'object' &&
      resolvedCamState !== null &&
      'enabled' in resolvedCamState &&
      resolvedCamState.enabled === true;
    if (cameraActive) return;

    const cam = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;

    const { bounds, position, scale, rotation } = diagramState;
    const [drx, dry, drz] = rotation;
    const corners: Array<readonly [number, number, number]> = [
      [bounds.x, bounds.y, 0],
      [bounds.x + bounds.w, bounds.y, 0],
      [bounds.x, bounds.y + bounds.h, 0],
      [bounds.x + bounds.w, bounds.y + bounds.h, 0],
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
      const cx = corner[0] * scale + position[0];
      const cy = corner[1] * scale + position[1];
      const cz = corner[2] * scale + position[2];
      const [rx, ry] = rotateXYZ([cx, cy, cz], drx, dry, drz);
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
    }
    const worldCX = (minX + maxX) / 2;
    const worldCY = (minY + maxY) / 2;
    const worldMaxDim = Math.max(maxX - minX, maxY - minY);
    const fov45 = 45 * (Math.PI / 180);
    const dist = (worldMaxDim / (2 * Math.tan(fov45 / 2))) * 1.2;
    cam.position.set(worldCX, worldCY + dist * 0.3, position[2] + dist);
    cam.lookAt(worldCX, worldCY, position[2]);
  }

  apply(state: DiagramState, _ctx: WidgetRenderContext): void {
    if (!this.scene) return;
    this.lastState = state;
    this.renderer.update(state, this.scene);
  }

  /**
   * Ghost-node merge: when a node appears in the next scene with an empty label
   * OR with positionInherited=true (no explicit position in a manual-layout diagram),
   * carry forward properties from the previous scene's compiled state:
   *
   * Always carried for ghost nodes (empty label):
   *   label, sublabel, shape, iconUrl, iconScale, sublabelColor
   *
   * Additionally carried when positionInherited=true (no explicit position in DSL):
   *   position, size, depth
   *
   * This enables minimal ghost node declarations:
   *   <DiagramNode id="cdn" opacity={0.3} />   ← no position/label needed
   *
   * The positionInherited flag is cleared after merge so downstream code
   * always receives a fully-resolved DiagramNodeState.
   */
  mergeSnapshot(
    prev: DiagramState | undefined,
    next: DiagramState | undefined,
  ): DiagramState | undefined {
    if (!next) return next;
    if (!prev) return next;

    let anyChanged = false;
    const mergedNodes = next.nodes.map((node): DiagramNodeState => {
      // Fully-declared node: no merge needed.
      if (node.label !== '' && !node.positionInherited) return node;

      const prevNode = prev.nodes.find((p) => p.id === node.id);
      if (!prevNode) return node;

      anyChanged = true;
      return {
        ...node,
        // Visual identity (ghost nodes only — when label is empty).
        label:        node.label !== '' ? node.label        : prevNode.label,
        sublabel:     node.label !== '' ? node.sublabel     : prevNode.sublabel,
        shape:        node.label !== '' ? node.shape        : prevNode.shape,
        iconUrl:      node.label !== '' ? node.iconUrl      : prevNode.iconUrl,
        iconScale:    node.label !== '' ? node.iconScale    : prevNode.iconScale,
        sublabelColor: node.label !== '' ? node.sublabelColor : prevNode.sublabelColor,
        // Layout geometry (only when DSL omitted position entirely).
        position: node.positionInherited ? prevNode.position : node.position,
        size:     node.positionInherited ? prevNode.size     : node.size,
        depth:    node.positionInherited ? prevNode.depth    : node.depth,
        // Clear the flag — the state is now fully resolved.
        positionInherited: undefined,
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

    const targets = Array.from(this.renderer.interactionRegistry.meshes);
    const intersects = this.raycaster.intersectObjects(targets, false);
    if (intersects.length === 0) return;

    const hit = intersects[0];
    const mesh = hit.object as THREE.Mesh;
    const info = this.renderer.interactionRegistry.lookup(mesh);
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
