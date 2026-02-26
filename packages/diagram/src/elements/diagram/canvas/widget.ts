// DiagramCanvasWidget — owns all rendering for a DiagramCanvas and its children.

import * as THREE from 'three';
import type {
  IAnimationController,
  IRenderable,
  ISceneElement,
  AnimationTickContext,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { DiagramCanvas } from './dsl';
import { functionalDiagramCanvasTransitionSpec } from './compile';
import { DiagramCanvasRenderer } from './render';
import type { DiagramCanvasState } from './types';
import {
  diagramInteractionRegistry,
  diagramInteractionLookup,
} from '../render';
import type { DiagramInteractionEvent, DiagramNodeState } from '../types';

const CAMERA_KEY = '__brewsite_camera';

export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController
{
  readonly widgetId: string;
  readonly defaultState: DiagramCanvasState;
  readonly transitionSpec = functionalDiagramCanvasTransitionSpec;
  readonly DslComponent = DiagramCanvas;
  readonly tickPriority = 1;

  /**
   * Optional callback fired when a clickable node inside any child diagram
   * is clicked. Assign after construction.
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;

  private renderer = new DiagramCanvasRenderer();
  private scene: THREE.Scene | null = null;
  private lastState: DiagramCanvasState | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(widgetId: string, defaultState: DiagramCanvasState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (renderer?.domElement) {
      this.canvasElement = renderer.domElement;
      this.clickHandler = (e) => this.handleClick(e);
      this.canvasElement.addEventListener('click', this.clickHandler);
    }
  }

  /**
   * Camera auto-framing: computes world-space bounds over all child diagrams
   * and frames the camera to show everything. Yields to Camera widget if active.
   */
  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    const rawState = tick?.state.widgets[this.widgetId];
    const state = (rawState as DiagramCanvasState | undefined) ?? this.lastState;
    if (!state || state.diagrams.length === 0) return;

    const rawCamState = tick?.state.widgets['camera'];
    const cameraActive =
      typeof rawCamState === 'object' &&
      rawCamState !== null &&
      'enabled' in rawCamState &&
      (rawCamState as { enabled: boolean }).enabled === true;
    if (cameraActive) return;

    const cam = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const cs = state.scale;
    const [cpx, cpy, cpz] = state.position;

    for (const diagram of state.diagrams) {
      const ds = diagram.scale * cs;
      const [dpx, dpy] = diagram.position;
      const { bounds: b } = diagram;
      const wx0 = (b.x * diagram.scale + dpx) * cs + cpx;
      const wy0 = (b.y * diagram.scale + dpy) * cs + cpy;
      const wx1 = ((b.x + b.w) * diagram.scale + dpx) * cs + cpx;
      const wy1 = ((b.y + b.h) * diagram.scale + dpy) * cs + cpy;
      minX = Math.min(minX, wx0, wx1);
      maxX = Math.max(maxX, wx0, wx1);
      minY = Math.min(minY, wy0, wy1);
      maxY = Math.max(maxY, wy0, wy1);
    }

    const worldCX = (minX + maxX) / 2;
    const worldCY = (minY + maxY) / 2;
    const maxDim = Math.max(maxX - minX, maxY - minY);
    const fov45 = 45 * (Math.PI / 180);
    const dist = (maxDim / (2 * Math.tan(fov45 / 2))) * 1.2;
    cam.position.set(worldCX, worldCY + dist * 0.3, cpz + dist);
    cam.lookAt(worldCX, worldCY, cpz);
  }

  apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
    if (!this.scene) return;
    this.lastState = state;
    this.renderer.update(state, this.scene);
  }

  /**
   * Ghost-node merge: carries forward label/shape/iconUrl for empty-label nodes
   * in each child diagram, exactly as DiagramWidget.mergeSnapshot does.
   */
  mergeSnapshot(
    prev: DiagramCanvasState | undefined,
    next: DiagramCanvasState | undefined,
  ): DiagramCanvasState | undefined {
    if (!next || !prev) return next;

    let anyChanged = false;
    const mergedDiagrams = next.diagrams.map((nextDiagram) => {
      const prevDiagram = prev.diagrams.find((d) => d.id === nextDiagram.id);
      if (!prevDiagram) return nextDiagram;

      let diagramChanged = false;
      const mergedNodes = nextDiagram.nodes.map((node): DiagramNodeState => {
        if (node.label !== '' && !node.positionInherited) return node;
        const prevNode = prevDiagram.nodes.find((p) => p.id === node.id);
        if (!prevNode) return node;
        diagramChanged = true;
        anyChanged = true;
        return {
          ...node,
          label:        node.label !== '' ? node.label        : prevNode.label,
          sublabel:     node.label !== '' ? node.sublabel     : prevNode.sublabel,
          shape:        node.label !== '' ? node.shape        : prevNode.shape,
          iconUrl:      node.label !== '' ? node.iconUrl      : prevNode.iconUrl,
          iconScale:    node.label !== '' ? node.iconScale    : prevNode.iconScale,
          sublabelColor: node.label !== '' ? node.sublabelColor : prevNode.sublabelColor,
          position: node.positionInherited ? prevNode.position : node.position,
          size:     node.positionInherited ? prevNode.size     : node.size,
          depth:    node.positionInherited ? prevNode.depth    : node.depth,
          positionInherited: undefined,
        };
      });
      return diagramChanged ? { ...nextDiagram, nodes: mergedNodes } : nextDiagram;
    });

    return anyChanged ? { ...next, diagrams: mergedDiagrams } : next;
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

  private handleClick(event: MouseEvent): void {
    if (!this.onInteraction || !this.scene || !this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const cam = this.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);
    const intersects = this.raycaster.intersectObjects(
      Array.from(diagramInteractionRegistry),
      false,
    );
    if (intersects.length === 0) return;
    const hit = intersects[0];
    const info = diagramInteractionLookup.get(hit.object as THREE.Mesh);
    if (!info) return;
    const ownsDiagram = this.lastState?.diagrams.some((d) => d.id === info.diagramId) ?? false;
    if (!ownsDiagram) return;
    this.onInteraction({
      type: 'node-click',
      diagramId: info.diagramId,
      nodeId: info.nodeId,
      intersectPoint: [hit.point.x, hit.point.y, hit.point.z],
    });
  }
}
