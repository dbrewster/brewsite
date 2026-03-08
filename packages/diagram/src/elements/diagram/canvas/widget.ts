// DiagramCanvasWidget — owns all rendering for a DiagramCanvas and its children.

import * as THREE from 'three';
import type {
  IAnimationController,
  ICameraFocusTarget,
  IInputDefaultProvider,
  ILightingOverride,
  INVSBounded,
  IRenderable,
  ISceneElement,
  AnimationTickContext,
  InputActionSpec,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { DiagramCanvas } from './dsl';
import { functionalDiagramCanvasTransitionSpec } from './compile';
import { DiagramCanvasRenderer } from './render';
import type { DiagramCanvasState } from './types';
import type {
  DiagramGroupHoverEvent,
  DiagramHoverControls,
  DiagramInteractionEvent,
  DiagramNodeHoverEvent,
  DiagramNodeState,
} from '../types';
import {
  clearDiagramFocusRegion,
  publishDiagramFocusCanvas,
  publishDiagramFocusGroup,
} from '../focusRegion';


/**
 * Pure helper: computes NDC coordinates for a pointer event scoped to an NVS sub-region.
 *
 * @param pointerLocalX - Pointer X offset from the canvas element left edge (pixels).
 * @param pointerLocalY - Pointer Y offset from the canvas element top edge (pixels).
 * @param canvasWidth   - Full canvas element width in pixels.
 * @param canvasHeight  - Full canvas element height in pixels.
 * @param nvsBounds     - NVS sub-region this canvas occupies.
 * @returns NDC coordinates as { x: [-1, 1], y: [-1, 1] }.
 */
export function computeNdcForNvs(
  pointerLocalX: number,
  pointerLocalY: number,
  canvasWidth: number,
  canvasHeight: number,
  nvsBounds: NVSRect,
): { x: number; y: number } {
  const regionLeft   = nvsBounds.x * canvasWidth;
  const regionTop    = nvsBounds.y * canvasHeight;
  const regionWidth  = nvsBounds.w * canvasWidth;
  const regionHeight = nvsBounds.h * canvasHeight;
  const subX = pointerLocalX - regionLeft;
  const subY = pointerLocalY - regionTop;
  return {
    x: (subX / regionWidth) * 2 - 1,
    y: -(subY / regionHeight) * 2 + 1,
  };
}

type HoverTarget = {
  diagramId: string;
  groupPath: string[];
  nodeId?: string;
  point: readonly [number, number, number];
};

export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController,
    IInputDefaultProvider,
    INVSBounded,
    ILightingOverride
{
  readonly widgetId: string;
  readonly defaultState: DiagramCanvasState;
  readonly transitionSpec = functionalDiagramCanvasTransitionSpec;
  readonly DslComponent = DiagramCanvas;
  readonly tickPriority = 1;

  /**
   * Returns the NVS bounds from the last applied DiagramCanvasState.
   * Falls back to the fullscreen default { x: 0, y: 0, w: 1, h: 1 } before
   * the first apply() call.
   */
  get nvsBounds(): NVSRect {
    return this.lastState?.nvsBounds ?? this.defaultState.nvsBounds;
  }

  /**
   * Optional callback fired when a clickable node inside any child diagram
   * is clicked. Assign after construction.
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;

  private renderer = new DiagramCanvasRenderer();
  private scene: THREE.Scene | null = null;
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private _cameraFocusTarget: ICameraFocusTarget | null = null;
  private lastState: DiagramCanvasState | null = null;
  /** Injected by LightingWidget.setLightingOverrides() — used in hover callbacks. */
  private _lightController: ((lightId: string, enabled: boolean) => void) | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;
  private hovered: HoverTarget | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private inputTranslation: [number, number, number] = [0, 0, 0];
  private inputRotation: [number, number, number] = [0, 0, 0];
  /**
   * Current default input actions derived from the most recently applied
   * DiagramCanvasState. Updated in apply(); never reads from defaultState.
   */
  private currentInputActions: ReadonlyArray<InputActionSpec> | undefined = undefined;

  constructor(widgetId: string, defaultState: DiagramCanvasState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  /**
   * ILightingOverride — returns { disableAll: true } when the canvas is active
   * (initialized and rendering), so LightingWidget skips core light updates.
   * The diagram canvas manages its own lighting via HDR environment maps.
   */
  getLightingOverride(): { disableAll: boolean } | null {
    return this.scene !== null ? { disableAll: true } : null;
  }

  /**
   * ILightingOverride — stores the per-light setter injected by LightingWidget
   * so hover callbacks can toggle individual core lights.
   */
  receiveLightController(setter: (lightId: string, enabled: boolean) => void): void {
    this._lightController = setter;
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (camera) this.cameraRef = camera;
    if (renderer?.domElement) {
      this.canvasElement = renderer.domElement;
      this.clickHandler = (e) => this.handleClick(e);
      this.mouseMoveHandler = (e) => this.handleMouseMove(e);
      this.mouseLeaveHandler = () => this.clearHover();
      this.canvasElement.addEventListener('click', this.clickHandler);
      this.canvasElement.addEventListener('mousemove', this.mouseMoveHandler);
      this.canvasElement.addEventListener('mouseleave', this.mouseLeaveHandler);
    }
  }

  /**
   * Auto-framing removed. Camera is set deterministically in apply() based on canvas.scale.
   * Interactive zoom-to-group is handled via applyInputFocus() → focusMesh()/focusAll().
   * Stores ICameraFocusTarget from context for use by focusMesh/focusAll.
   */
  onTick(context: AnimationTickContext): void {
    if (context.cameraFocusTarget) this._cameraFocusTarget = context.cameraFocusTarget;
  }

  apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
    // Update currentInputActions so getDefaultInputActions() reflects current scene.
    this.currentInputActions = state.defaultInputActions;

    if (!this.scene) return;
    const effectiveState: DiagramCanvasState = {
      ...state,
      position: [
        state.position[0] + this.inputTranslation[0],
        state.position[1] + this.inputTranslation[1],
        state.position[2] + this.inputTranslation[2],
      ],
      rotation: [
        state.rotation[0] + this.inputRotation[0],
        state.rotation[1] + this.inputRotation[1],
        state.rotation[2] + this.inputRotation[2],
      ],
    };
    this.lastState = effectiveState;

    // Deterministic camera setup: position camera so the [0..1] canvas height fills the view.
    // Yields to Camera widget when a user-authored camera is active (cameraFocusTarget present).
    const cam = this.cameraRef;
    if (cam && !this._cameraFocusTarget) {
      const [cpx, cpy, cpz] = effectiveState.position;
      const fovRad = THREE.MathUtils.degToRad(cam.fov > 0 ? cam.fov : 45);
      // dist such that canvas height (= scale world units) exactly fills vertical FOV
      const dist = effectiveState.scale / (2 * Math.tan(fovRad / 2));
      cam.position.set(cpx, cpy, cpz + dist);
      cam.lookAt(cpx, cpy, cpz);
    }

    this.renderer.update(effectiveState, this.scene, cam ?? undefined);
  }

  /**
   * Returns the current scene's default input actions.
   * Returns this.currentInputActions (updated each frame in apply()), NOT defaultState.
   * Returns an empty array when no defaultInputActions are configured.
   */
  getDefaultInputActions(): InputActionSpec[] {
    return this.currentInputActions ? [...this.currentInputActions] : [];
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
        if (node.label !== undefined && !node.positionInherited) return node;
        const prevNode = prevDiagram.nodes.find((p) => p.id === node.id);
        if (!prevNode) return node;
        diagramChanged = true;
        anyChanged = true;
        return {
          ...node,
          label:         node.label !== undefined ? node.label         : prevNode.label,
          sublabel:      node.label !== undefined ? node.sublabel      : prevNode.sublabel,
          shape:         node.label !== undefined ? node.shape         : prevNode.shape,
          iconUrl:       node.label !== undefined ? node.iconUrl       : prevNode.iconUrl,
          iconScale:     node.label !== undefined ? node.iconScale     : prevNode.iconScale,
          sublabelColor: node.label !== undefined ? node.sublabelColor : prevNode.sublabelColor,
          position:  node.positionInherited ? prevNode.position  : node.position,
          size:      node.positionInherited ? prevNode.size      : node.size,
          thickness: node.positionInherited ? prevNode.thickness : node.thickness,
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
      if (this.mouseMoveHandler) this.canvasElement.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.mouseLeaveHandler) this.canvasElement.removeEventListener('mouseleave', this.mouseLeaveHandler);
      this.canvasElement = null;
      this.clickHandler = null;
      this.mouseMoveHandler = null;
      this.mouseLeaveHandler = null;
    }
    this.clearHover();
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
    this.cameraRef = null;
    this._cameraFocusTarget = null;
    this.lastState = null;
    this.inputTranslation = [0, 0, 0];
    this.inputRotation = [0, 0, 0];
    clearDiagramFocusRegion(this.widgetId);
    this.currentInputActions = undefined;
  }

  applyInputMove(dx: number, dy: number, dz: number = 0): void {
    this.inputTranslation = [
      this.inputTranslation[0] + dx * 0.03,
      this.inputTranslation[1] + dy * 0.03,
      this.inputTranslation[2] + dz * 0.03,
    ];
  }

  applyInputRotate(rx: number, ry: number, rz: number = 0): void {
    this.inputRotation = [
      this.inputRotation[0] + rx,
      this.inputRotation[1] + ry,
      this.inputRotation[2] + rz,
    ];
  }

  resetInputTransform(): void {
    this.inputTranslation = [0, 0, 0];
    this.inputRotation = [0, 0, 0];
  }

  applyInputFocus(
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
  ): void {
    if (!this.scene || !this.canvasElement) return;
    const requestedCenter = focusCenter ?? this.lastState?.focusCenter ?? this.defaultState.focusCenter;
    if (requestedCenter) {
      const cam = this.cameraRef;
      if (!cam) return;
      this.focusAll(cam, requestedCenter);
      return;
    }

    this.computeNdc(clientX, clientY);
    const cam = this.cameraRef;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);

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
    this.focusAll(cam, focusCenter);
  }

  /**
   * Handles diagram-canvas.move action dispatched via ActionInputController.onUnknownAction.
   * Accepts PointerEvent (drag) or WheelEvent (wheel) and applies pre-computed deltas from
   * the extra object — or falls back to movementX/Y for drag events.
   */
  handleMove(event: PointerEvent | WheelEvent, speed: number | undefined): void {
    const s = speed ?? 1;
    let dx: number;
    let dy: number;
    if ('deltaX' in event) {
      dx = (event as WheelEvent).deltaX;
      dy = -(event as WheelEvent).deltaY;
    } else {
      dx = (event as PointerEvent).movementX;
      dy = (event as PointerEvent).movementY;
    }
    this.applyInputMove(-dx * s, -dy * s, 0);
  }

  /**
   * Handles diagram-canvas.rotate action dispatched via ActionInputController.onUnknownAction.
   */
  handleRotate(event: PointerEvent | WheelEvent, speed: number | undefined): void {
    const s = speed ?? 1;
    let dx: number;
    let dy: number;
    if ('deltaX' in event) {
      dx = (event as WheelEvent).deltaX;
      dy = -(event as WheelEvent).deltaY;
    } else {
      dx = (event as PointerEvent).movementX;
      dy = (event as PointerEvent).movementY;
    }
    const scaledX = dx * 0.005 * s;
    const scaledY = dy * 0.005 * s;
    this.applyInputRotate(-scaledY, 0, -scaledX);
  }

  /**
   * Handles diagram-canvas.reset action dispatched via ActionInputController.onUnknownAction.
   */
  handleReset(): void {
    this.resetInputTransform();
  }

  /**
   * Handles diagram-canvas.focus action dispatched via ActionInputController.onUnknownAction.
   */
  handleFocus(
    event: PointerEvent | MouseEvent,
    focusCenter?: [number, number] | [number, number, number],
  ): void {
    this.applyInputFocus(event.clientX, event.clientY, focusCenter);
  }

  /**
   * Computes NDC coordinates for a pointer event, scoped to the NVS sub-region
   * this canvas occupies within the full renderer viewport.
   *
   * Delegates to the exported pure function `computeNdcForNvs` using the
   * canvas element's bounding rect and the current nvsBounds.
   */
  private computeNdc(clientX: number, clientY: number): void {
    if (!this.canvasElement) return;
    const rect = this.canvasElement.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const { x, y } = computeNdcForNvs(pointerX, pointerY, rect.width, rect.height, this.nvsBounds);
    this.ndc.set(x, y);
  }

  private handleClick(event: MouseEvent): void {
    if (!this.scene || !this.canvasElement) return;
    this.computeNdc(event.clientX, event.clientY);
    const cam = this.cameraRef;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);

    if (event.metaKey) return;

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

  private handleMouseMove(event: MouseEvent): void {
    if (!this.scene || !this.canvasElement || !this.lastState) return;
    this.computeNdc(event.clientX, event.clientY);
    const cam = this.cameraRef;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);

    const nodeIntersects = this.raycaster.intersectObjects(
      Array.from(this.renderer.getInteractionMeshes()),
      false,
    );
    const groupIntersects = this.raycaster.intersectObjects(
      Array.from(this.renderer.getGroupInteractionMeshes()),
      false,
    );

    let next: HoverTarget | null = null;
    const nodeHit = nodeIntersects[0];
    if (nodeHit) {
      const nodeInfo = this.renderer.lookupInteraction(nodeHit.object as THREE.Mesh);
      if (nodeInfo) {
        const diagram = this.lastState.diagrams.find((d) => d.id === nodeInfo.diagramId);
        if (diagram) {
          const node = diagram.nodes.find((n) => n.id === nodeInfo.nodeId);
          const groupPath = node?.groupId ? this.buildGroupPath(diagram, node.groupId) : [];
          next = {
            diagramId: nodeInfo.diagramId,
            nodeId: nodeInfo.nodeId,
            groupPath,
            point: [nodeHit.point.x, nodeHit.point.y, nodeHit.point.z],
          };
        }
      }
    }
    if (!next && groupIntersects.length > 0) {
      const groupInfos = groupIntersects
        .map((hit) => {
          const info = this.renderer.lookupGroupInteraction(hit.object as THREE.Mesh);
          if (!info) return null;
          return { info, hit };
        })
        .filter((v): v is NonNullable<typeof v> => !!v);
      if (groupInfos.length > 0) {
        let selected = groupInfos[0]!;
        let selectedDepth = this.groupDepth(selected.info.diagramId, selected.info.groupId);
        for (const candidate of groupInfos.slice(1)) {
          const depth = this.groupDepth(candidate.info.diagramId, candidate.info.groupId);
          if (depth > selectedDepth) {
            selected = candidate;
            selectedDepth = depth;
          }
        }
        const diagram = this.lastState.diagrams.find((d) => d.id === selected.info.diagramId);
        if (diagram) {
          next = {
            diagramId: selected.info.diagramId,
            groupPath: this.buildGroupPath(diagram, selected.info.groupId),
            point: [selected.hit.point.x, selected.hit.point.y, selected.hit.point.z],
          };
        }
      }
    }

    this.transitionHover(this.hovered, next);
    this.hovered = next;
  }

  private clearHover(): void {
    if (!this.lastState || !this.hovered) return;
    this.transitionHover(this.hovered, null);
    this.hovered = null;
  }

  private createHoverControls(defaultDiagramId: string): DiagramHoverControls {
    return {
      setLightEnabled: (lightId, enabled) => {
        this._lightController?.(lightId, enabled);
      },
      setNodeEmissive: (nodeId, enabled, options) => {
        const diagramId = options?.diagramId ?? defaultDiagramId;
        this.renderer.setNodeEmissiveOverride(diagramId, nodeId, enabled);
      },
      setGroupNodesEmissive: (groupId, enabled, options) => {
        if (!this.lastState) return;
        const diagramId = options?.diagramId ?? defaultDiagramId;
        const diagram = this.lastState.diagrams.find((d) => d.id === diagramId);
        if (!diagram) return;
        const includeDescendants = options?.includeDescendants ?? true;
        const groupIds = this.collectGroupIds(diagram, groupId, includeDescendants);
        for (const node of diagram.nodes) {
          if (!node.groupId || !groupIds.has(node.groupId)) continue;
          this.renderer.setNodeEmissiveOverride(diagramId, node.id, enabled);
        }
      },
    };
  }

  private collectGroupIds(
    diagram: DiagramCanvasState['diagrams'][number],
    groupId: string,
    includeDescendants: boolean,
  ): Set<string> {
    const result = new Set<string>([groupId]);
    if (!includeDescendants) return result;
    const childMap = new Map<string, string[]>();
    for (const group of diagram.groups) {
      if (!group.parentId) continue;
      const list = childMap.get(group.parentId) ?? [];
      list.push(group.id);
      childMap.set(group.parentId, list);
    }
    const queue = [groupId];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const children = childMap.get(current) ?? [];
      for (const child of children) {
        if (result.has(child)) continue;
        result.add(child);
        queue.push(child);
      }
    }
    return result;
  }

  private transitionHover(prev: HoverTarget | null, next: HoverTarget | null): void {
    if (!this.lastState) return;
    const prevPath = prev?.groupPath ?? [];
    const nextPath = next?.groupPath ?? [];
    let shared = 0;
    while (
      shared < prevPath.length &&
      shared < nextPath.length &&
      prevPath[shared] === nextPath[shared] &&
      prev?.diagramId === next?.diagramId
    ) {
      shared += 1;
    }
    const prevNodeChanged = prev?.diagramId !== next?.diagramId || prev?.nodeId !== next?.nodeId;
    if (prev?.nodeId && prevNodeChanged) {
      if (this.dispatchNodeHover(prev.diagramId, prev.nodeId, prev.point, 'node-mouse-leave')) return;
    }
    for (let i = shared; i < prevPath.length; i += 1) {
      if (this.dispatchGroupHover(prev!.diagramId, prevPath[i]!, prev!.point, 'group-mouse-leave')) return;
    }
    for (let i = shared; i < nextPath.length; i += 1) {
      if (this.dispatchGroupHover(next!.diagramId, nextPath[i]!, next!.point, 'group-mouse-enter')) return;
    }
    if (next?.nodeId && prevNodeChanged) {
      this.dispatchNodeHover(next.diagramId, next.nodeId, next.point, 'node-mouse-enter');
    }
  }

  private buildGroupPath(
    diagram: DiagramCanvasState['diagrams'][number],
    leafGroupId: string,
  ): string[] {
    const byId = new Map(diagram.groups.map((group) => [group.id, group] as const));
    const path: string[] = [];
    let cursor = byId.get(leafGroupId);
    while (cursor) {
      path.push(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return path.reverse();
  }

  private groupDepth(diagramId: string, groupId: string): number {
    const diagram = this.lastState?.diagrams.find((d) => d.id === diagramId);
    if (!diagram) return 0;
    return this.buildGroupPath(diagram, groupId).length;
  }

  private dispatchGroupHover(
    diagramId: string,
    groupId: string,
    point: readonly [number, number, number],
    type: 'group-mouse-enter' | 'group-mouse-leave',
  ): boolean {
    const diagram = this.lastState?.diagrams.find((d) => d.id === diagramId);
    const group = diagram?.groups.find((g) => g.id === groupId);
    if (!group) return false;
    const handler = type === 'group-mouse-enter' ? group.onMouseEnter : group.onMouseLeave;
    if (!handler) return false;
    let stopped = false;
    const event: DiagramGroupHoverEvent = {
      type,
      diagramId,
      groupId,
      intersectPoint: point,
      controls: this.createHoverControls(diagramId),
      stopPropagation: () => { stopped = true; },
      isPropagationStopped: () => stopped,
    };
    handler(event);
    return stopped;
  }

  private dispatchNodeHover(
    diagramId: string,
    nodeId: string,
    point: readonly [number, number, number],
    type: 'node-mouse-enter' | 'node-mouse-leave',
  ): boolean {
    const diagram = this.lastState?.diagrams.find((d) => d.id === diagramId);
    const node = diagram?.nodes.find((n) => n.id === nodeId);
    if (!node) return false;
    const handler = type === 'node-mouse-enter' ? node.onMouseEnter : node.onMouseLeave;
    if (!handler) return false;
    let stopped = false;
    const event: DiagramNodeHoverEvent = {
      type,
      diagramId,
      nodeId,
      groupId: node.groupId,
      intersectPoint: point,
      controls: this.createHoverControls(diagramId),
      stopPropagation: () => { stopped = true; },
      isPropagationStopped: () => stopped,
    };
    handler(event);
    return stopped;
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

    this._cameraFocusTarget?.requestFocus([pos.x, pos.y, pos.z], [center.x, center.y, center.z], true);
    const info = this.renderer.lookupGroupInteraction(mesh as THREE.Mesh);
    if (info) {
      publishDiagramFocusGroup(this.defaultState, info.diagramId, info.groupId);
    }
  }

  private focusAll(
    cam: THREE.PerspectiveCamera,
    focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
  ): void {
    if (!this.scene || !this.lastState) return;
    const state = this.lastState;
    const [cpx, cpy, cpz] = state.position;

    // Canvas extent is now fixed by canvas.scale and nvsBounds.
    // Full canvas in canvas-local: X ∈ [-aspect/2, aspect/2], Y ∈ [-0.5, 0.5].
    // In world space these are multiplied by canvas.scale.
    const engineAspect = cam.aspect || 16 / 9;
    const canvasAspect = (state.nvsBounds.w / state.nvsBounds.h) * engineAspect;
    const worldW = canvasAspect * state.scale;
    const worldH = state.scale;

    if (!Number.isFinite(worldW) || !Number.isFinite(worldH)) return;

    // Focus center priority:
    // 1) per-action focusCenter override
    // 2) canvas authored focusCenter
    // 3) authored canvas position
    const centerSource = focusCenter ?? state.focusCenter ?? this.defaultState.focusCenter ?? this.defaultState.position;
    const center = new THREE.Vector3(
      centerSource[0],
      centerSource[1],
      cpz,
    );
    const width = Math.max(0.001, worldW);
    const height = Math.max(0.001, worldH);
    const fov = THREE.MathUtils.degToRad(cam.fov);
    const aspect = cam.aspect || 1;
    const distY = (height / 2) / Math.tan(fov / 2);
    const distX = (width / 2) / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(distX, distY) * 1.2;

    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const pos = center.clone().sub(dir.multiplyScalar(dist));

    this._cameraFocusTarget?.requestFocus([pos.x, pos.y, pos.z], [center.x, center.y, center.z], true);
    publishDiagramFocusCanvas(this.defaultState);
  }
}
