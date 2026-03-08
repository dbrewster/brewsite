// DiagramWidget — implements ISceneElement<DiagramState>, IRenderable, IAnimationController.

import * as THREE from 'three';
import type * as React from 'react';
import type {
  IAnimationController,
  IDslComposite,
  ILightingOverride,
  IRenderable,
  ISceneElement,
  AnimationTickContext,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  DiagramExit,
  DiagramEnter,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  FlowLayout,
} from './dsl';
import { functionalDiagramTransitionSpec } from './compile';
import { DiagramRenderer } from './render';
import type {
  DiagramInteractionEvent,
  DiagramNodeHoverEvent,
  DiagramGroupHoverEvent,
  DiagramHoverControls,
  DiagramNodeState,
  DiagramState,
} from './types';
import { rotateXYZ } from './canvas/compiler/pipeRouter';

type HoverTarget = {
  diagramId: string;
  groupPath: string[];
  nodeId?: string;
  point: readonly [number, number, number];
};

export class DiagramWidget
  implements ISceneElement<DiagramState>, IRenderable<DiagramState>, IAnimationController, IDslComposite, ILightingOverride
{
  readonly widgetId: string;
  readonly defaultState: DiagramState;
  readonly transitionSpec = functionalDiagramTransitionSpec;
  readonly DslComponent = Diagram;
  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    { component: DiagramNode as React.ComponentType<unknown>, displayName: 'DiagramNode', topLevelError: true },
    { component: DiagramEdge as React.ComponentType<unknown>, displayName: 'DiagramEdge', topLevelError: true },
    { component: DiagramGroup as React.ComponentType<unknown>, displayName: 'DiagramGroup', topLevelError: true },
    { component: DiagramExit as React.ComponentType<unknown>, displayName: 'DiagramExit', topLevelError: true },
    { component: DiagramEnter as React.ComponentType<unknown>, displayName: 'DiagramEnter', topLevelError: true },
    { component: GridLayout as React.ComponentType<unknown>, displayName: 'GridLayout', topLevelError: true },
    { component: HierarchicalLayout as React.ComponentType<unknown>, displayName: 'HierarchicalLayout', topLevelError: true },
    { component: ManualLayout as React.ComponentType<unknown>, displayName: 'ManualLayout', topLevelError: true },
    { component: FlowLayout as React.ComponentType<unknown>, displayName: 'FlowLayout', topLevelError: true },
  ];

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
  private cameraRef: THREE.PerspectiveCamera | null = null;
  /** Last applied state — used by onTick for camera auto-framing fallback. */
  private lastState: DiagramState | null = null;
  /** Injected by LightingWidget.setLightingOverrides() — used in hover callbacks. */
  private _lightController: ((lightId: string, enabled: boolean) => void) | null = null;

  // Click interaction plumbing
  private canvasElement: HTMLCanvasElement | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;
  private hovered: HoverTarget | null = null;

  // Reuse raycaster / NDC vector across clicks to avoid per-click allocation.
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(widgetId: string, defaultState: DiagramState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  /**
   * ILightingOverride — DiagramWidget does not suppress all lights.
   * Only the per-light setter matters here (receiveLightController).
   */
  getLightingOverride(): { disableAll: boolean } | null {
    return null;
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
      this.clickHandler = (e: MouseEvent) => this.handleClick(e);
      this.mouseMoveHandler = (e: MouseEvent) => this.handleMouseMove(e);
      this.mouseLeaveHandler = () => this.clearHover();
      this.canvasElement.addEventListener('click', this.clickHandler);
      this.canvasElement.addEventListener('mousemove', this.mouseMoveHandler);
      this.canvasElement.addEventListener('mouseleave', this.mouseLeaveHandler);
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

    const cam = this.cameraRef;
    if (!cam) return;

    // Stream 4 will recompute from viewportBounds in canvas-local space.
    const { viewportBounds, tiltRotation } = diagramState;
    const [drx, dry, drz] = tiltRotation;
    const corners: Array<readonly [number, number, number]> = [
      [viewportBounds.x, viewportBounds.y, 0],
      [viewportBounds.x + viewportBounds.w, viewportBounds.y, 0],
      [viewportBounds.x, viewportBounds.y + viewportBounds.h, 0],
      [viewportBounds.x + viewportBounds.w, viewportBounds.y + viewportBounds.h, 0],
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
      const cx = corner[0];
      const cy = corner[1];
      const cz = corner[2];
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
    cam.position.set(worldCX, worldCY + dist * 0.3, dist);
    cam.lookAt(worldCX, worldCY, 0);
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
      if (node.label !== undefined && !node.positionInherited) return node;

      const prevNode = prev.nodes.find((p) => p.id === node.id);
      if (!prevNode) return node;

      anyChanged = true;
      return {
        ...node,
        // Visual identity (ghost nodes only — when label is undefined).
        label:         node.label !== undefined ? node.label         : prevNode.label,
        sublabel:      node.label !== undefined ? node.sublabel      : prevNode.sublabel,
        shape:         node.label !== undefined ? node.shape         : prevNode.shape,
        iconUrl:       node.label !== undefined ? node.iconUrl       : prevNode.iconUrl,
        iconScale:     node.label !== undefined ? node.iconScale     : prevNode.iconScale,
        sublabelColor: node.label !== undefined ? node.sublabelColor : prevNode.sublabelColor,
        // Layout geometry (only when DSL omitted position entirely).
        position:  node.positionInherited ? prevNode.position  : node.position,
        size:      node.positionInherited ? prevNode.size      : node.size,
        thickness: node.positionInherited ? prevNode.thickness : node.thickness,
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

    const cam = this.cameraRef;
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

  private handleMouseMove(event: MouseEvent): void {
    if (!this.scene || !this.canvasElement || !this.lastState) return;
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const cam = this.cameraRef;
    if (!cam) return;
    this.raycaster.setFromCamera(this.ndc, cam);

    const nodeIntersects = this.raycaster.intersectObjects(
      Array.from(this.renderer.interactionRegistry.meshes),
      false,
    );
    const groupIntersects = this.raycaster.intersectObjects(
      Array.from(this.renderer.groupInteractionRegistry.meshes),
      false,
    );

    let next: HoverTarget | null = null;
    const nodeHit = nodeIntersects[0];
    if (nodeHit) {
      const nodeInfo = this.renderer.interactionRegistry.lookup(nodeHit.object as THREE.Mesh);
      if (nodeInfo && nodeInfo.diagramId === this.widgetId) {
        const node = this.lastState.nodes.find((n) => n.id === nodeInfo.nodeId);
        const groupPath = node?.groupId ? this.buildGroupPath(this.lastState, node.groupId) : [];
        next = {
          diagramId: nodeInfo.diagramId,
          nodeId: nodeInfo.nodeId,
          groupPath,
          point: [nodeHit.point.x, nodeHit.point.y, nodeHit.point.z],
        };
      }
    }
    if (!next && groupIntersects.length > 0) {
      const groupInfos = groupIntersects
        .map((hit) => {
          const info = this.renderer.groupInteractionRegistry.lookup(hit.object as THREE.Mesh);
          if (!info || info.diagramId !== this.widgetId) return null;
          return { info, hit };
        })
        .filter((v): v is NonNullable<typeof v> => !!v);
      if (groupInfos.length > 0) {
        let selected = groupInfos[0]!;
        let selectedDepth = this.groupDepth(this.lastState, selected.info.groupId);
        for (const candidate of groupInfos.slice(1)) {
          const depth = this.groupDepth(this.lastState, candidate.info.groupId);
          if (depth > selectedDepth) {
            selected = candidate;
            selectedDepth = depth;
          }
        }
        next = {
          diagramId: selected.info.diagramId,
          groupPath: this.buildGroupPath(this.lastState, selected.info.groupId),
          point: [selected.hit.point.x, selected.hit.point.y, selected.hit.point.z],
        };
      }
    }

    this.transitionHover(this.hovered, next, this.lastState);
    this.hovered = next;
  }

  private clearHover(): void {
    if (!this.lastState || !this.hovered) return;
    this.transitionHover(this.hovered, null, this.lastState);
    this.hovered = null;
  }

  private createHoverControls(defaultDiagramId: string): DiagramHoverControls {
    return {
      setLightEnabled: (lightId, enabled) => {
        this._lightController?.(lightId, enabled);
      },
      setNodeEmissive: (nodeId, enabled, options) => {
        const diagramId = options?.diagramId ?? defaultDiagramId;
        if (diagramId !== this.widgetId) return;
        this.renderer.setNodeEmissiveOverride(diagramId, nodeId, enabled);
      },
      setGroupNodesEmissive: (groupId, enabled, options) => {
        const diagramId = options?.diagramId ?? defaultDiagramId;
        if (diagramId !== this.widgetId || !this.lastState) return;
        const includeDescendants = options?.includeDescendants ?? true;
        const groupIds = this.collectGroupIds(this.lastState, groupId, includeDescendants);
        for (const node of this.lastState.nodes) {
          if (!node.groupId || !groupIds.has(node.groupId)) continue;
          this.renderer.setNodeEmissiveOverride(diagramId, node.id, enabled);
        }
      },
    };
  }

  private collectGroupIds(state: DiagramState, groupId: string, includeDescendants: boolean): Set<string> {
    const result = new Set<string>([groupId]);
    if (!includeDescendants) return result;
    const childMap = new Map<string, string[]>();
    for (const group of state.groups) {
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

  private transitionHover(prev: HoverTarget | null, next: HoverTarget | null, state: DiagramState): void {
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
      if (this.dispatchNodeHover(state, prev.diagramId, prev.nodeId, prev.point, 'node-mouse-leave')) return;
    }
    for (let i = shared; i < prevPath.length; i += 1) {
      if (this.dispatchGroupHover(state, prev!.diagramId, prevPath[i]!, prev!.point, 'group-mouse-leave')) return;
    }
    for (let i = shared; i < nextPath.length; i += 1) {
      if (this.dispatchGroupHover(state, next!.diagramId, nextPath[i]!, next!.point, 'group-mouse-enter')) return;
    }
    if (next?.nodeId && prevNodeChanged) {
      this.dispatchNodeHover(state, next.diagramId, next.nodeId, next.point, 'node-mouse-enter');
    }
  }

  private buildGroupPath(state: DiagramState, leafGroupId: string): string[] {
    const byId = new Map(state.groups.map((group) => [group.id, group] as const));
    const path: string[] = [];
    let cursor = byId.get(leafGroupId);
    while (cursor) {
      path.push(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return path.reverse();
  }

  private groupDepth(state: DiagramState, groupId: string): number {
    return this.buildGroupPath(state, groupId).length;
  }

  private dispatchGroupHover(
    state: DiagramState,
    diagramId: string,
    groupId: string,
    point: readonly [number, number, number],
    type: 'group-mouse-enter' | 'group-mouse-leave',
  ): boolean {
    if (diagramId !== this.widgetId) return false;
    const group = state.groups.find((g) => g.id === groupId);
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
    state: DiagramState,
    diagramId: string,
    nodeId: string,
    point: readonly [number, number, number],
    type: 'node-mouse-enter' | 'node-mouse-leave',
  ): boolean {
    if (diagramId !== this.widgetId) return false;
    const node = state.nodes.find((n) => n.id === nodeId);
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
}
