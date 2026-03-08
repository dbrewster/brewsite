// DiagramCanvasWidget — owns all rendering for a DiagramCanvas and its children.

import * as THREE from 'three';
import type {
  IExtraRenderPass,
  IInputDefaultProvider,
  INVSBounded,
  IRenderable,
  ISceneElement,
  InputActionSpec,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import type { DiagramCanvasProps, DiagramPipeProps } from './dsl';
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

/** Fixed FOV for the diagram's private perspective camera. */
const PRIVATE_CAMERA_FOV = 45;

/**
 * DiagramCanvas — NVS-primary container for one or more <Diagram> elements.
 *
 * Placement is declared via {x, y, w, h} NVS coordinates (top-left origin, [0,1]).
 * The diagram renders exclusively within its NVS region via a scissored
 * sub-viewport pass with an isolated depth buffer.
 *
 * @prop x       - NVS left edge [0,1]. Default: 0.
 * @prop y       - NVS top edge [0,1]. Default: 0.
 * @prop w       - NVS width [0,1]. Default: 1.
 * @prop h       - NVS height [0,1]. Default: 1.
 * @prop tilt    - Pitch tilt in radians. Negative = top tilts away. Default: 0.
 * @prop scale   - World-space geometry scale. Default: 1.
 * @prop padding - Auto-fit camera framing inset [0..1]. Default: 0.1.
 *
 * Multiple DiagramCanvas instances in a scene are fully independent.
 * If NVS regions overlap, the later-declared canvas renders on top.
 */
export function DiagramCanvas(_props: DiagramCanvasProps): null {
  return null;
}

/**
 * Declares a tube connector between nodes in two different <Diagram> elements
 * inside the same <DiagramCanvas>.
 * Must be a direct child of <DiagramCanvas>.
 *
 * Routing: CatmullRom arc in canvas-local space, computed at compile time.
 * The pipe is rendered by DiagramCanvasWidget alongside the diagram tubes.
 */
export function DiagramPipe(_props: DiagramPipeProps): null {
  return null;
}

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

/**
 * Pure helper: converts NVS bounds to a WebGL scissor/viewport pixel rect.
 *
 * WebGL origin is bottom-left; NVS origin is top-left. This function performs
 * the Y-flip and rounds to integer pixels to avoid sub-pixel rounding artifacts.
 *
 * @param nvs - NVS region { x, y, w, h } in [0,1].
 * @param vw  - Viewport width in CSS pixels.
 * @param vh  - Viewport height in CSS pixels.
 * @returns Pixel rect suitable for setScissor(left, bottom, width, height).
 */
export function nvsToScissorRect(
  nvs: { x: number; y: number; w: number; h: number },
  vw: number,
  vh: number,
): { left: number; bottom: number; width: number; height: number } {
  return {
    left:   Math.round(nvs.x * vw),
    bottom: Math.round((1 - nvs.y - nvs.h) * vh),
    width:  Math.round(nvs.w * vw),
    height: Math.round(nvs.h * vh),
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
    IExtraRenderPass,
    IInputDefaultProvider,
    INVSBounded
{
  readonly widgetId: string;
  readonly defaultState: DiagramCanvasState;
  readonly transitionSpec = functionalDiagramCanvasTransitionSpec;
  readonly DslComponent = DiagramCanvas;

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
  /** Private Three.js scene — diagram geometry lives here, NOT in the main scene. */
  private diagramScene: THREE.Scene | null = null;
  /** Private perspective camera for the scissored diagram render pass. */
  private privateCamera: THREE.PerspectiveCamera | null = null;
  /** Renderer reference for size queries in apply() and renderPass(). */
  private rendererRef: THREE.WebGLRenderer | null = null;
  private lastState: DiagramCanvasState | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;
  private hovered: HoverTarget | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private inputTranslation: [number, number, number] = [0, 0, 0];
  /** Pitch-only interactive rotation offset in radians. Y and Z are not supported. */
  private inputRotation: number = 0;
  /**
   * Current default input actions derived from the most recently applied
   * DiagramCanvasState. Updated in apply(); never reads from defaultState.
   */
  private currentInputActions: ReadonlyArray<InputActionSpec> | undefined = undefined;

  constructor(widgetId: string, defaultState: DiagramCanvasState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene: _mainScene, renderer, camera: _sharedCamera }: WidgetInitContext): void {
    // Create private scene — diagram geometry lives here, NOT in the main scene.
    this.diagramScene = new THREE.Scene();

    // Create private perspective camera for scissored diagram pass.
    // FOV 45° is the standard default; auto-fit adjusts distance to match geometry.
    this.privateCamera = new THREE.PerspectiveCamera(
      PRIVATE_CAMERA_FOV,
      1, // aspect updated in apply()
      0.01,
      1000,
    );

    // Store renderer reference for size queries in apply() and renderPass().
    if (renderer) this.rendererRef = renderer;

    // Register DOM event listeners for interaction.
    if (renderer?.domElement) {
      this.canvasElement = renderer.domElement;
      this.clickHandler = (e) => this.handleClick(e);
      this.mouseMoveHandler = (e) => this.handleMouseMove(e);
      this.mouseLeaveHandler = () => this.clearHover();
      this.canvasElement.addEventListener('click', this.clickHandler);
      this.canvasElement.addEventListener('mousemove', this.mouseMoveHandler);
      this.canvasElement.addEventListener('mouseleave', this.mouseLeaveHandler);
    }
    // Note: _mainScene and _sharedCamera are intentionally unused.
    // Diagram geometry is in this.diagramScene; camera is this.privateCamera.
  }

  apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
    this.currentInputActions = state.defaultInputActions;
    // Always update lastState so nvsBounds getter and interaction handlers reflect current state.
    this.lastState = state;

    if (!this.diagramScene || !this.privateCamera || !this.rendererRef) return;

    // Compute canvas aspect ratio from renderer size and NVS bounds.
    const size = new THREE.Vector2();
    this.rendererRef.getSize(size);
    const engineAspect = size.x > 0 && size.y > 0 ? size.x / size.y : 16 / 9;
    const canvasAspect = (state.nvsBounds.w / state.nvsBounds.h) * engineAspect;

    // Update private camera aspect and projection matrix.
    this.privateCamera.aspect = canvasAspect;
    this.privateCamera.updateProjectionMatrix();

    // Update diagram geometry in the private scene.
    this.renderer.update(
      state,
      this.diagramScene,
      canvasAspect,
      this.inputTranslation,
      this.inputRotation,
    );

    // Auto-fit private camera to the current geometry bounding box.
    this.updateAutoFitCamera(state, canvasAspect);
  }

  /**
   * IExtraRenderPass — issues a scissored render pass for this canvas.
   *
   * Called by useSceneEngine's render callback AFTER renderer.render(scene, camera)
   * completes the main scene pass. Renders the private diagram scene with the private
   * camera, scissored to the NVS bounds.
   *
   * Render order: main scene pass → [each DiagramCanvas.renderPass() in declaration order].
   *
   * Note: If two DiagramCanvas NVS regions overlap, the later-declared canvas renders
   * on top within the overlap region. This is intentional (see PRD §8.3). No compile-time
   * overlap validation is performed in V1.
   */
  renderPass(renderer: THREE.WebGLRenderer, viewportWidth: number, viewportHeight: number): void {
    if (!this.diagramScene || !this.privateCamera || !this.lastState) return;

    const { left, bottom, width, height } = nvsToScissorRect(
      this.lastState.nvsBounds,
      viewportWidth,
      viewportHeight,
    );

    // Guard against degenerate bounds (zero-area regions produce WebGL errors).
    if (width <= 0 || height <= 0) return;

    renderer.setScissorTest(true);
    renderer.setScissor(left, bottom, width, height);
    renderer.setViewport(left, bottom, width, height);

    // Clear depth buffer only — preserve main scene color underneath.
    // The diagram composites on top of the main scene within its NVS bounds.
    renderer.clearDepth();

    renderer.render(this.diagramScene, this.privateCamera);

    // Restore renderer state for subsequent passes.
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, viewportWidth, viewportHeight);
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
    // Remove DOM event listeners.
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

    // Dispose diagram scene geometry.
    if (this.diagramScene) {
      this.renderer.dispose(this.widgetId, this.diagramScene);
      this.diagramScene = null;
    }

    this.privateCamera = null;
    this.rendererRef = null;
    this.lastState = null;
    this.inputTranslation = [0, 0, 0];
    this.inputRotation = 0;
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

  applyInputRotate(rx: number, _ry: number = 0, _rz: number = 0): void {
    // Only pitch (X axis) is supported in the new model. Y and Z are ignored.
    this.inputRotation += rx;
  }

  resetInputTransform(): void {
    this.inputTranslation = [0, 0, 0];
    this.inputRotation = 0;
  }

  applyInputFocus(
    clientX: number,
    clientY: number,
    focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
  ): void {
    if (!this.diagramScene || !this.canvasElement) return;
    const requestedCenter = focusCenter ?? this.lastState?.focusCenter ?? this.defaultState.focusCenter;
    if (requestedCenter) {
      this.focusAll(requestedCenter);
      return;
    }

    this.computeNdc(clientX, clientY);
    const cam = this.privateCamera;
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
      this.focusMesh(hit.object);
      return;
    }
    this.focusAll(focusCenter);
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
    if (!this.diagramScene || !this.canvasElement) return;
    this.computeNdc(event.clientX, event.clientY);
    const cam = this.privateCamera;
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
    if (!this.diagramScene || !this.canvasElement || !this.lastState) return;
    this.computeNdc(event.clientX, event.clientY);
    const cam = this.privateCamera;
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
      setLightEnabled: (_lightId, _enabled) => {
        // DEBT: In the isolated render pass model, core scene lights do not reach
        // the diagram's private scene. Toggling them from a hover callback has no
        // visible effect on diagram geometry. For mixed scenes where toggling a main
        // scene light from a diagram hover is desired, V2 should publish a light
        // toggle event to the main scene via a shared bus.
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

  /**
   * Snaps the private camera to frame the given mesh.
   * DEBT: Snap focus (no smooth animation). V2 should interpolate cam.position
   * toward the target over several frames using a lerp or spring.
   */
  private focusMesh(mesh: THREE.Object3D): void {
    const cam = this.privateCamera;
    if (!cam) return;

    const box = new THREE.Box3().setFromObject(mesh);
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const width = Math.max(0.001, size.x);
    const height = Math.max(0.001, size.y);
    const fovRad = THREE.MathUtils.degToRad(PRIVATE_CAMERA_FOV);
    const canvasAspect = cam.aspect || 1;
    const distY = (height / 2) / Math.tan(fovRad / 2);
    const distX = (width / 2) / (Math.tan(fovRad / 2) * canvasAspect);
    const dist = Math.max(distX, distY) * 1.2;

    cam.position.set(center.x, center.y, center.z + dist);
    cam.lookAt(center.x, center.y, center.z);

    const info = this.renderer.lookupGroupInteraction(mesh as THREE.Mesh);
    if (info) {
      publishDiagramFocusGroup(this.defaultState, info.diagramId, info.groupId);
    }
  }

  /**
   * Snaps the private camera to frame the full canvas or a focus center.
   * DEBT: Snap focus. V2 should animate smoothly.
   */
  private focusAll(
    focusCenter?: [number, number] | [number, number, number] | readonly [number, number] | readonly [number, number, number],
  ): void {
    const cam = this.privateCamera;
    const state = this.lastState;
    if (!cam || !state) return;

    // Focus center priority: per-action override → authored focusCenter → geometry center.
    const centerSource = focusCenter ?? state.focusCenter ?? this.defaultState.focusCenter;
    let center: THREE.Vector3;

    if (centerSource) {
      center = new THREE.Vector3(
        centerSource[0],
        centerSource[1],
        (centerSource as readonly number[])[2] ?? 0,
      );
    } else {
      // Fall back to geometry bounding box center.
      const box = this.renderer.getBoundingBox();
      if (!box) return;
      center = new THREE.Vector3();
      box.getCenter(center);
    }

    // Compute camera distance to show the full diagram with canvas aspect.
    const canvasAspect = cam.aspect || 1;
    const box = this.renderer.getBoundingBox();
    if (!box) return;
    const size = new THREE.Vector3();
    box.getSize(size);

    const worldW = Math.max(0.001, size.x);
    const worldH = Math.max(0.001, size.y);
    const fovRad = THREE.MathUtils.degToRad(PRIVATE_CAMERA_FOV);
    const distY = (worldH / 2) / Math.tan(fovRad / 2);
    const distX = (worldW / 2) / (Math.tan(fovRad / 2) * canvasAspect);
    const dist = Math.max(distX, distY) * 1.2;

    cam.position.set(center.x, center.y, center.z + dist);
    cam.lookAt(center.x, center.y, center.z);

    publishDiagramFocusCanvas(this.defaultState);
  }

  /**
   * Auto-fits the private camera to the current geometry bounding box,
   * applying the authored padding as additional pullback.
   */
  private updateAutoFitCamera(state: DiagramCanvasState, canvasAspect: number): void {
    const cam = this.privateCamera;
    if (!cam) return;

    const box = this.renderer.getBoundingBox();
    if (!box) {
      // No geometry yet — position camera at sensible default.
      cam.position.set(0, 0, 5);
      cam.lookAt(0, 0, 0);
      return;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Approximate fit: select the dimension that requires more pullback.
    // Note: Math.max(size.x / canvasAspect, size.y) uses vertical FOV for both
    // horizontal and vertical fitting. This is a slight over-approximation for
    // wide canvases — the camera backs up a bit further than the exact tight fit.
    // The padding prop absorbs the visual difference. Exact correction is v2 DEBT.
    const fovRad = THREE.MathUtils.degToRad(PRIVATE_CAMERA_FOV);
    const maxDim = Math.max(size.x / canvasAspect, size.y);
    const dist = (maxDim / 2 / Math.tan(fovRad / 2)) * (1 + state.padding);

    if (!Number.isFinite(dist) || dist <= 0) return;

    cam.position.set(center.x, center.y, center.z + dist);
    cam.lookAt(center.x, center.y, center.z);
  }
}
