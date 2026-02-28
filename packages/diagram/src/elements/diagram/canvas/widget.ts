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
import type { DiagramInteractionEvent, DiagramNodeState } from '../types';
import { rotateXYZ } from './compiler/pipeRouter';

const CAMERA_KEY = '__brewsite_camera';
const CAMERA_FOCUS_KEY = '__brewsite_camera_focus';

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

    const [crx, cry, crz] = state.rotation;
    const [cpx, cpy, cpz] = state.position;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const diagram of state.diagrams) {
      const { bounds: b } = diagram;
      const ds = diagram.scale;
      const [drx, dry, drz] = diagram.rotation;
      const [dpx, dpy, dpz] = diagram.position;
      const cs = state.scale;

      const corners: Array<readonly [number, number, number]> = [
        [b.x, b.y, 0],
        [b.x + b.w, b.y, 0],
        [b.x, b.y + b.h, 0],
        [b.x + b.w, b.y + b.h, 0],
      ];

      for (const corner of corners) {
        const cx = corner[0] * ds + dpx;
        const cy = corner[1] * ds + dpy;
        const cz = corner[2] * ds + dpz;
        const [rx1, ry1, rz1] = rotateXYZ([cx, cy, cz], drx, dry, drz);
        const wx = rx1 * cs + cpx;
        const wy = ry1 * cs + cpy;
        const wz = rz1 * cs + cpz;
        const [wx2, wy2] = rotateXYZ([wx, wy, wz], crx, cry, crz);
        minX = Math.min(minX, wx2);
        maxX = Math.max(maxX, wx2);
        minY = Math.min(minY, wy2);
        maxY = Math.max(maxY, wy2);
      }
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
    if (!this.scene || !this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const cam = this.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);

    if (event.metaKey) {
      const groupHits = this.raycaster.intersectObjects(
        Array.from(this.renderer.getGroupInteractionMeshes()),
        false,
      );
      if (groupHits.length > 0) {
        const pickSmallest = (hits: THREE.Intersection[]): THREE.Intersection => {
          let best = hits[0]!;
          let bestArea = Infinity;
          const box = new THREE.Box3();
          const size = new THREE.Vector3();
          for (const h of hits) {
            box.setFromObject(h.object);
            box.getSize(size);
            const area = size.x * size.y;
            if (!Number.isFinite(area)) continue;
            if (area < bestArea) {
              bestArea = area;
              best = h;
            }
          }
          return best;
        };
        const hit = pickSmallest(groupHits);
        this.focusMesh(hit.object, cam);
        return;
      }
      this.focusAll(cam);
      return;
    }

    if (!this.onInteraction) return;
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.renderer.getInteractionMeshes()),
      false,
    );
    if (intersects.length === 0) return;
    const hit = intersects[0];
    const info = this.renderer.lookupInteraction(hit.object as THREE.Mesh);
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

  private focusMesh(mesh: THREE.Object3D, cam: THREE.PerspectiveCamera): void {
    const box = new THREE.Box3().setFromObject(mesh);
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const width = Math.max(0.001, size.x);
    const height = Math.max(0.001, size.y);
    const fov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = cam.aspect || 1;
    const distY = (height / 2) / Math.tan(fov / 2);
    const distX = (width / 2) / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(distX, distY) * 1.2;

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const pos = center.clone().sub(dir.multiplyScalar(dist));

    this.scene!.userData[CAMERA_FOCUS_KEY] = {
      position: [pos.x, pos.y, pos.z],
      target: [center.x, center.y, center.z],
      smooth: true,
    };
  }

  private focusAll(cam: THREE.PerspectiveCamera): void {
    if (!this.scene || !this.lastState) return;
    const state = this.lastState;
    const [crx, cry, crz] = state.rotation;
    const [cpx, cpy, cpz] = state.position;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const diagram of state.diagrams) {
      const { bounds: b } = diagram;
      const ds = diagram.scale;
      const [drx, dry, drz] = diagram.rotation;
      const [dpx, dpy, dpz] = diagram.position;
      const cs = state.scale;

      const corners: Array<readonly [number, number, number]> = [
        [b.x, b.y, 0],
        [b.x + b.w, b.y, 0],
        [b.x, b.y + b.h, 0],
        [b.x + b.w, b.y + b.h, 0],
      ];

      for (const corner of corners) {
        const cx = corner[0] * ds + dpx;
        const cy = corner[1] * ds + dpy;
        const cz = corner[2] * ds + dpz;
        const [rx1, ry1, rz1] = rotateXYZ([cx, cy, cz], drx, dry, drz);
        const wx = rx1 * cs + cpx;
        const wy = ry1 * cs + cpy;
        const wz = rz1 * cs + cpz;
        const [wx2, wy2, wz2] = rotateXYZ([wx, wy, wz], crx, cry, crz);
        minX = Math.min(minX, wx2);
        maxX = Math.max(maxX, wx2);
        minY = Math.min(minY, wy2);
        maxY = Math.max(maxY, wy2);
        minZ = Math.min(minZ, wz2);
        maxZ = Math.max(maxZ, wz2);
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(minZ)) return;

    const center = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    );
    const width = Math.max(0.001, maxX - minX);
    const height = Math.max(0.001, maxY - minY);
    const fov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = cam.aspect || 1;
    const distY = (height / 2) / Math.tan(fov / 2);
    const distX = (width / 2) / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(distX, distY) * 1.2;

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const pos = center.clone().sub(dir.multiplyScalar(dist));

    this.scene.userData[CAMERA_FOCUS_KEY] = {
      position: [pos.x, pos.y, pos.z],
      target: [center.x, center.y, center.z],
      smooth: true,
    };
  }
}
