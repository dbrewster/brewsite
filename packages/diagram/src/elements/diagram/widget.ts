// DiagramWidget — implements ISceneElement<DiagramState>, IRenderable, ILoadable, INVSBounded.

import * as THREE from 'three';
import type * as React from 'react';
import type {
  IDslComposite,
  ILightingOverride,
  ILoadable,
  IRenderable,
  ISceneElement,
  AssetManifest,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
} from '@brewsite/core';
import { validateNVSRect } from '@brewsite/core';
import type { INVSBounded } from '@brewsite/core';
import type {
  DiagramNodeProps,
  DiagramEdgeProps,
  DiagramGroupProps,
  GridLayoutProps,
  HierarchicalLayoutProps,
  ManualLayoutProps,
  FlowLayoutProps,
  DiagramProps,
  DiagramExitProps,
  DiagramEnterProps,
} from './dsl';
import { functionalDiagramTransitionSpec } from './compile';
import { DiagramRenderer } from './render';
import { buildThemeRenderConfig } from './compiler/themeResolver';
import { darkGlassTheme } from './themes';
import type {
  DiagramInteractionEvent,
  DiagramNodeHoverEvent,
  DiagramGroupHoverEvent,
  DiagramHoverControls,
  DiagramState,
} from './types';
import { clearDiagramFocusRegion } from './focusRegion';
import {
  computeHoverTransitionEvents,
  buildGroupPath,
  collectGroupIds,
  type HoverTarget,
  type HoverEvent,
} from './compiler/hoverStateMachine';
import { mergeGhostNodeSnapshot } from './compiler/ghostNodeMerge';

/**
 * Declares a diagram node (shape with label).
 * Must be a direct or indirect child of <Diagram>.
 * Can be nested inside <DiagramGroup> to establish group membership.
 *
 * ### Ghost Nodes
 *
 * When `label` is omitted, this node is a **ghost node** — it inherits its
 * visual identity (label, sublabel, shape, icon, size) from the matching node
 * in the previous scene. Ghost nodes enable drill-down animations where a prior
 * scene's diagram appears as faded context behind the new focal point.
 *
 * To make a node appear as a ghost:
 * - Omit the `label` prop entirely (do NOT pass `label=""`).
 * - Optionally set `opacity` to reduce visual weight (e.g., `opacity={0.3}`).
 * - In a manual-layout diagram, also omit `position` — it will be inherited.
 *
 * @example
 * // Scene 1: full diagram with named nodes
 * <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" size={[4, 2]} />
 *
 * // Scene 2: api appears as ghost context (no label = inherit identity from Scene 1)
 * <DiagramNode id="api" opacity={0.3} />
 * // ↑ inherits label, icon, shape, size from Scene 1; only opacity changes
 *
 * Contrast with an intentionally labelless node (NOT a ghost):
 * // This node has a label — it is an empty string, not absent.
 * <DiagramNode id="cdn" label="" size={[3, 2]} color="#1a3d5c" />
 * // ↑ fully-declared node, no inheritance from prior scenes
 */
export function DiagramNode(_props: DiagramNodeProps): null {
  return null;
}

/**
 * Declares a directed connector between two diagram nodes.
 * `from` and `to` must match `<DiagramNode id="...">` values in the same
 * parent `<Diagram>`.
 * Unresolvable endpoints are compiled as hidden edges (no control points).
 * Must be a direct or indirect child of <Diagram>.
 */
export function DiagramEdge(_props: DiagramEdgeProps): null {
  return null;
}

/**
 * Declares a visual grouping container (boundary, cluster, swimlane, or container).
 * Direct children that are <DiagramNode> elements are assigned to this group.
 */
export function DiagramGroup(_props: DiagramGroupProps): null {
  return null;
}

/**
 * Declares a grid auto-layout for the parent <Diagram> or <DiagramGroup>.
 * Must be a direct child of <Diagram> or <DiagramGroup>. At most one layout
 * element per container. Cascades with parent layouts of the same kind.
 */
export function GridLayout(_props: GridLayoutProps): null {
  return null;
}

/**
 * Declares a topological (edge-driven) auto-layout for the parent
 * <Diagram> or <DiagramGroup>. Must be a direct child of either container.
 * At most one layout element per container. Cascades with parent layouts
 * of the same kind.
 */
export function HierarchicalLayout(_props: HierarchicalLayoutProps): null {
  return null;
}

/**
 * Declares that all node positions are manually specified.
 * Non-ghost nodes (those with a label) that lack an explicit position
 * will throw a compile-time error.
 */
export function ManualLayout(_props: ManualLayoutProps): null {
  return null;
}

/**
 * Declares a sequential flow auto-layout for the parent <Diagram> or <DiagramGroup>.
 * Places all direct children in a single line in their JSX declaration order.
 * Items are positioned along the direction axis with edge-to-edge gap spacing.
 * Secondary axis (cross-axis) position is always 0 — items are center-aligned.
 * Must be a direct child of <Diagram> or <DiagramGroup>. At most one layout
 * element per container. Cascades with parent layouts of the same kind.
 */
export function FlowLayout(_props: FlowLayoutProps): null {
  return null;
}

/**
 * A standalone 3D diagram element with nodes, edges, groups, and layout.
 * Use <Diagram> for single-diagram scenes. Supports x/y/w/h NVS bounds,
 * tilt (pitch rotation), z (world depth), and scale.
 */
export function Diagram(_props: DiagramProps): null {
  return null;
}

/**
 * Declares exit animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <DiagramExit> per diagram.
 * @example <DiagramExit to={[0, -50, 0]} fade easing="ease-out" />
 */
export function DiagramExit(_props: DiagramExitProps): null {
  return null;
}

/**
 * Declares enter animation for the parent <Diagram>.
 * Must be a direct child of <Diagram>. At most one <DiagramEnter> per diagram.
 * @example <DiagramEnter from={[-50, 0, 0]} fade easing="spring" />
 */
export function DiagramEnter(_props: DiagramEnterProps): null {
  return null;
}

/**
 * Widget for the <Diagram> DSL element. Renders the diagram directly into
 * the main Three.js scene using a diagramGroup positioned via NVSCoordService.
 */
export class DiagramWidget
  implements ISceneElement<DiagramState>, IRenderable<DiagramState>, ILoadable, INVSBounded, IDslComposite, ILightingOverride
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
   * Optional callback for node-click interactions.
   * Assign after construction:
   *   const widget = new DiagramWidget('my-diagram', defaultState);
   *   widget.onInteraction = (evt) => { ... };
   */
  public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined = undefined;

  private renderer = new DiagramRenderer(buildThemeRenderConfig(darkGlassTheme));
  private scene: THREE.Scene | null = null;
  private mainCamera: THREE.PerspectiveCamera | null = null;
  private diagramGroup: THREE.Group | null = null;
  /** Last applied state — used by hover handlers. */
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

  /**
   * INVSBounded — returns the current NVS viewport bounds for this diagram.
   * Used by the engine to track which NVS region is occupied by this widget.
   */
  get nvsBounds(): NVSRect {
    return this.lastState?.viewportBounds ?? this.defaultState.viewportBounds;
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    if (camera) this.mainCamera = camera as THREE.PerspectiveCamera;

    // Create the Three.js group that will hold diagram geometry.
    this.diagramGroup = new THREE.Group();
    this.diagramGroup.name = `diagram:${this.widgetId}`;
    (scene as THREE.Scene).add(this.diagramGroup);

    // Store renderer reference for env map setup.
    this.renderer.initialize(renderer);

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

  apply(state: DiagramState, context: WidgetRenderContext): void {
    if (!this.scene || !this.diagramGroup) return;
    this.lastState = state;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSRect(state.viewportBounds, `DiagramWidget(${this.widgetId})`);
    }

    // Compute the group's world-space anchor point (center of viewportBounds).
    const cx = state.viewportBounds.x + state.viewportBounds.w / 2;
    const cy = state.viewportBounds.y + state.viewportBounds.h / 2;
    const [worldCX, worldCY, worldCZ] = context.coords.toWorld(cx, cy, state.z);

    // Apply world position, tilt, and scale to the group.
    this.diagramGroup.position.set(worldCX, worldCY, worldCZ);
    this.diagramGroup.rotation.set(state.tiltRotation[0], state.tiltRotation[1], state.tiltRotation[2]);
    this.diagramGroup.scale.setScalar(state.scale);

    // Pass state and coord service to the renderer.
    this.renderer.update(state, this.diagramGroup, context.coords);
  }

  /**
   * ILoadable — loads the HDR environment map via DiagramRenderer.
   * Env maps load lazily on first apply(); this resolves immediately.
   */
  async load(manifest: AssetManifest | null): Promise<void> {
    await this.renderer.loadEnvMap(manifest);
  }

  /** ILoadable — true once the env map has been initialized. */
  get isLoaded(): boolean {
    return this.renderer.isEnvMapLoaded;
  }

  /**
   * Ghost-node merge: when a node appears in the next scene with an empty label
   * OR with positionInherited=true (no explicit position in a manual-layout diagram),
   * carry forward properties from the previous scene's compiled state.
   *
   * Delegates to mergeGhostNodeSnapshot for pure transformation logic.
   */
  mergeSnapshot(
    prev: DiagramState | undefined,
    next: DiagramState | undefined,
  ): DiagramState | undefined {
    return mergeGhostNodeSnapshot(prev, next);
  }

  dispose(): void {
    // Remove DOM event listeners.
    if (this.canvasElement) {
      if (this.clickHandler) this.canvasElement.removeEventListener('click', this.clickHandler);
      if (this.mouseMoveHandler) this.canvasElement.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.mouseLeaveHandler) this.canvasElement.removeEventListener('mouseleave', this.mouseLeaveHandler);
      this.canvasElement = null;
      this.clickHandler = null;
      this.mouseMoveHandler = null;
      this.mouseLeaveHandler = null;
    }
    this.clearHover();
    if (this.diagramGroup) {
      this.scene?.remove(this.diagramGroup);
      this.renderer.dispose(this.widgetId, this.diagramGroup);
      this.diagramGroup = null;
    }
    this.scene = null;
    this.mainCamera = null;
    this.lastState = null;
    clearDiagramFocusRegion(this.widgetId);
  }

  // ─── Private: click interaction ───────────────────────────────────────────

  private handleClick(event: MouseEvent): void {
    if (!this.onInteraction || !this.diagramGroup || !this.canvasElement) return;

    // Convert client coords to normalised device coordinates [-1, +1].
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const cam = this.mainCamera;
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
    if (!this.diagramGroup || !this.canvasElement || !this.lastState) return;
    const rect = this.canvasElement.getBoundingClientRect();
    this.ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const cam = this.mainCamera;
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
        const groupPath = node?.groupId ? buildGroupPath(this.lastState, node.groupId) : [];
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
        let selectedDepth = buildGroupPath(this.lastState, selected.info.groupId).length;
        for (const candidate of groupInfos.slice(1)) {
          const depth = buildGroupPath(this.lastState, candidate.info.groupId).length;
          if (depth > selectedDepth) {
            selected = candidate;
            selectedDepth = depth;
          }
        }
        next = {
          diagramId: selected.info.diagramId,
          groupPath: buildGroupPath(this.lastState, selected.info.groupId),
          point: [selected.hit.point.x, selected.hit.point.y, selected.hit.point.z],
        };
      }
    }

    this.dispatchHoverEvents(this.hovered, next);
    this.hovered = next;
  }

  private clearHover(): void {
    if (!this.lastState || !this.hovered) return;
    this.dispatchHoverEvents(this.hovered, null);
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
        const groupIds = collectGroupIds(this.lastState, groupId, includeDescendants);
        for (const node of this.lastState.nodes) {
          if (!node.groupId || !groupIds.has(node.groupId)) continue;
          this.renderer.setNodeEmissiveOverride(diagramId, node.id, enabled);
        }
      },
    };
  }

  /**
   * Dispatches hover events computed by the pure hover state machine.
   * stopPropagation semantics: if any handler stops propagation, remaining events are skipped.
   */
  private dispatchHoverEvents(prev: HoverTarget | null, next: HoverTarget | null): void {
    if (!this.lastState) return;
    const state = this.lastState;
    const events = computeHoverTransitionEvents(prev, next);
    for (const event of events) {
      const stopped = this.dispatchSingleEvent(event, state);
      if (stopped) break;
    }
  }

  /**
   * Dispatches a single HoverEvent to the appropriate node or group handler.
   * Returns true if the handler called stopPropagation().
   */
  private dispatchSingleEvent(event: HoverEvent, state: DiagramState): boolean {
    if (event.type === 'node-mouse-enter' || event.type === 'node-mouse-leave') {
      return this.dispatchNodeHover(state, event.diagramId, event.nodeId, event.point, event.type);
    }
    return this.dispatchGroupHover(state, event.diagramId, event.groupId, event.point, event.type);
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
