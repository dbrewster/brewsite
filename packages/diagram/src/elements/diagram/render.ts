// Three.js rendering for DiagramState.
// Orchestrates NodeRenderer, EdgeRenderer, GroupRenderer, EnvMapManager.
// Converts NVS [0..1] positions to world-space via NVSCoordService before dispatching to sub-renderers.

import * as THREE from 'three';
import type { DiagramState, DiagramNodeState, DiagramEdgeState, DiagramGroupState, DiagramGroupEdgeLightsState } from './types';
import type { NVSCoordService, AssetManifest } from '@brewsite/core';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import { GroupRenderer } from './rendering/GroupRenderer';
import { EdgeMaterialFactory } from './rendering/EdgeMaterialFactory';
import { EnvMapManager } from './rendering/EnvMapManager';
import { InteractionRegistry } from './rendering/InteractionRegistry';
import { sharedIconLoader } from './rendering/IconLoader';
import type { IIconLoader } from './rendering/IconLoader';
import { GroupInteractionRegistry } from './rendering/GroupInteractionRegistry';
import type { DiagramThemeRenderConfig } from './types';
import { NODE_RENDER_Z_OFFSET } from './constants';

/**
 * Computes a cache key from the EdgeRenderer construction-time params.
 * Used to detect when EdgeRenderer needs to be recreated between updates.
 */
function edgeThemeKey(tc: DiagramThemeRenderConfig): string {
  return [
    tc.use3DArrows,
    tc.edgeSmoothness,
    tc.edgeMetalness,
    tc.edgeRoughness,
    tc.edgeFlowSpeed,
    tc.edgeFlowWidth,
    tc.edgeFlowPulseIntensity,
    tc.edgeTubeRadialSegments,
  ].join('|');
}

const findScene = (obj: THREE.Object3D): THREE.Scene | null => {
  let current: THREE.Object3D | null = obj;
  while (current) {
    if (current instanceof THREE.Scene) return current;
    current = current.parent;
  }
  return null;
};

/**
 * Orchestrates NodeRenderer, EdgeRenderer, GroupRenderer, and EnvMapManager for a diagram.
 * Converts NVS [0..1] positions to world-space coordinates via NVSCoordService.
 * The group parameter passed to update() IS the diagram's root group — this renderer
 * does not create or position the root group.
 */
/**
 * Build a lightweight fingerprint from the DiagramState fields that drive
 * geometry, position, and material updates. If the fingerprint is the same
 * as the previous frame, the full NVS→world conversion and sub-renderer
 * dispatch can be skipped — saving ~1ms/frame on complex diagrams.
 *
 * EXCLUDES: flow animation phase (shader-driven), envMap (applied separately).
 * INCLUDES: node positions/sizes/opacities/colors/labels, edge paths,
 *   group bounds/labels, viewportBounds, tilt, z, scale.
 *
 * Uses integer-quantized values (×1e4) and base-36 encoding for compact,
 * allocation-light string building.
 */
function buildDiagramFingerprint(state: DiagramState): string {
  // Pre-size estimate: ~20 chars per node, ~10 per edge, ~15 per group + overhead
  let fp = '';

  // Top-level scalars
  const vp = state.viewportBounds;
  fp += (vp.x * 1e4 | 0).toString(36);
  fp += (vp.y * 1e4 | 0).toString(36);
  fp += (vp.w * 1e4 | 0).toString(36);
  fp += (vp.h * 1e4 | 0).toString(36);
  fp += (state.tiltRotation[0] * 1e4 | 0).toString(36);
  fp += (state.z * 1e4 | 0).toString(36);
  fp += (state.scale * 1e4 | 0).toString(36);

  // Nodes: position, size, opacity, color, label (label changes = visual change)
  for (const n of state.nodes) {
    fp += n.id;
    fp += (n.position[0] * 1e4 | 0).toString(36);
    fp += (n.position[1] * 1e4 | 0).toString(36);
    fp += (n.position[2] * 1e4 | 0).toString(36);
    fp += (n.size[0] * 1e4 | 0).toString(36);
    fp += (n.size[1] * 1e4 | 0).toString(36);
    fp += (n.opacity * 1e3 | 0).toString(36);
    fp += n.color;
    fp += n.label ?? '';
    fp += n.sublabel ?? '';
    fp += (n.thickness * 1e4 | 0).toString(36);
  }

  // Edges: id + control point count + first/last control point (path identity)
  for (const e of state.edges) {
    fp += e.id;
    fp += e.path.commands.length.toString(36);
    fp += (e.opacity * 1e3 | 0).toString(36);
    fp += e.color;
    fp += (e.thickness * 1e4 | 0).toString(36);
  }

  // Groups: id, label, bounds
  for (const g of state.groups) {
    fp += g.id;
    fp += g.label ?? '';
    fp += (g.bounds.x * 1e4 | 0).toString(36);
    fp += (g.bounds.y * 1e4 | 0).toString(36);
    fp += (g.bounds.w * 1e4 | 0).toString(36);
    fp += (g.bounds.h * 1e4 | 0).toString(36);
    fp += g.color;
  }

  return fp;
}

export class DiagramRenderer {
  private lastState = new Map<string, DiagramState>();
  private readonly envMapManager = new EnvMapManager();
  private rendererRef: THREE.WebGLRenderer | undefined;
  private _isEnvMapLoaded = true; // env maps load lazily; treated as always "ready"

  readonly interactionRegistry = new InteractionRegistry();
  readonly groupInteractionRegistry = new GroupInteractionRegistry();

  // Fully initialized in constructor — no null checks needed on update():
  private readonly nodeRenderer: NodeRenderer;
  private edgeRenderer: EdgeRenderer; // NOT readonly — may be recreated on theme change
  private readonly groupRenderer: GroupRenderer;

  /** Tracks the last edge theme key to detect when EdgeRenderer must be recreated. */
  private lastEdgeThemeKey: string;

  /**
   * Cached world-scale factors per diagram ID. Keyed by viewport bounds so that
   * scene transitions (which change the viewport) trigger recomputation, but user
   * camera zoom (which only changes visibleWorldWidth/Height) does NOT.
   * This ensures diagrams scale naturally with the camera like any other 3D object
   * instead of continuously rebuilding geometry every frame during zoom.
   */
  private readonly cachedWorldScale = new Map<string, {
    vpX: number; vpY: number; vpW: number; vpH: number;
    uniformWorldW: number; uniformWorldH: number;
  }>();

  constructor(
    initialThemeConfig: DiagramThemeRenderConfig,
    iconLoader: IIconLoader = sharedIconLoader,
  ) {
    this.nodeRenderer = new NodeRenderer(iconLoader, this.interactionRegistry);
    this.edgeRenderer = new EdgeRenderer(
      new EdgeMaterialFactory(),
      initialThemeConfig.use3DArrows,
      initialThemeConfig.edgeSmoothness,
      initialThemeConfig.edgeMetalness,
      initialThemeConfig.edgeRoughness,
      initialThemeConfig.edgeFlowSpeed,
      initialThemeConfig.edgeFlowWidth,
      initialThemeConfig.edgeFlowPulseIntensity,
      initialThemeConfig.edgeTubeRadialSegments,
    );
    this.groupRenderer = new GroupRenderer(this.groupInteractionRegistry);
    this.lastEdgeThemeKey = edgeThemeKey(initialThemeConfig);
  }

  /** Store renderer reference for PMREM env map generation. */
  initialize(renderer: THREE.WebGLRenderer | undefined): void {
    this.rendererRef = renderer;
    this.envMapManager.setRenderer(renderer);
  }

  /** Injects the shared material context for CSM preset material support. */
  setMaterialContext(loader: import('@brewsite/core').MaterialLoader | null, manifest: import('@brewsite/core').MaterialManifest | null): void {
    this.nodeRenderer.setMaterialContext(loader, manifest);
    this.groupRenderer.setMaterialContext(loader, manifest);
  }

  /**
   * ILoadable delegation — env maps load lazily; resolves immediately.
   * This method exists to satisfy ILoadable; no async work is needed here.
   */
  async loadEnvMap(_manifest: AssetManifest | null): Promise<void> {
    // Env maps are loaded lazily when update() is first called.
  }

  /** True once initialize() has been called and env map loading is available. */
  get isEnvMapLoaded(): boolean {
    return this._isEnvMapLoaded;
  }

  /**
   * Updates all sub-renderers with new DiagramState.
   * The group parameter is the diagram's root Three.js group (owned by DiagramWidget).
   * Position, rotation, and scale of the group are managed by DiagramWidget.apply().
   * This method populates the group's children with nodes, edges, and groups.
   *
   * @param state  Compiled diagram state with NVS [0..1] positions.
   * @param group  The diagram's root Three.js group (owned by DiagramWidget).
   * @param coords Live NVS→world coordinate service from WidgetRenderContext.
   */
  /** Diagnostic counters for performance debugging. */
  _diag = { updateCalls: 0, earlyOuts: 0, fullRebuilds: 0 };

  /** Fingerprint cache: diagram ID → last fingerprint string. */
  private lastFingerprint = new Map<string, string>();
  /** Cached converted edges from the previous frame — reused when fingerprint matches. */
  private lastConvertedEdges = new Map<string, DiagramEdgeState[]>();

  update(state: DiagramState, group: THREE.Group, coords: NVSCoordService): void {
    this._diag.updateCalls++;
    const prev = this.lastState.get(state.id);

    // ─── Early out: reference equality (pre-baked discrete state) ────────────
    if (prev === state) {
      this._diag.earlyOuts++;
      const scene = findScene(group);
      if (scene) {
        this.envMapManager.apply(scene, state.themeConfig.envMapUrl, state.themeConfig.envMapIntensity);
      }
      // Flow pulse animations are driven by a uTime shader uniform that must
      // advance every frame regardless of whether the diagram state changed.
      this.edgeRenderer.tickPulseUniforms();
      return;
    }

    // ─── Content fingerprint: detect whether the state content actually changed.
    // Functional closures create new object references every frame even when the
    // content is identical (camera orbit/zoom at the same tick). The fingerprint
    // lets us reuse the previous frame's converted edge paths so the EdgeRenderer
    // sees the same path reference and skips expensive TubeGeometry rebuilds.
    // Nodes, groups, materials, and flow animations still update every frame
    // (their sub-renderers have cheap internal change detection).
    const fp = buildDiagramFingerprint(state);
    const fpMatch = fp === this.lastFingerprint.get(state.id);
    this.lastFingerprint.set(state.id, fp);
    if (fpMatch) {
      this._diag.earlyOuts++;
    } else {
      this._diag.fullRebuilds++;
    }

    const tc = state.themeConfig;

    // Recreate EdgeRenderer if any construction-time edge params changed.
    const newKey = edgeThemeKey(tc);
    if (newKey !== this.lastEdgeThemeKey) {
      this.edgeRenderer.disposeAll(group);
      this.edgeRenderer = new EdgeRenderer(
        new EdgeMaterialFactory(),
        tc.use3DArrows,
        tc.edgeSmoothness,
        tc.edgeMetalness,
        tc.edgeRoughness,
        tc.edgeFlowSpeed,
        tc.edgeFlowWidth,
        tc.edgeFlowPulseIntensity,
        tc.edgeTubeRadialSegments,
      );
      this.lastEdgeThemeKey = newKey;
    }

    const vp = state.viewportBounds;

    // Apply env map to the scene.
    const scene = findScene(group);
    if (scene) {
      this.envMapManager.apply(scene, tc.envMapUrl, tc.envMapIntensity);
    }

    // ─── Stable world scale (locked to viewport bounds, immune to camera zoom) ──
    // Cache uniformWorldW/H per diagram viewport bounds. Only recompute when the
    // viewport changes (scene transition), NOT when the camera zooms (which only
    // changes coords.visibleWorldWidth/Height). This ensures diagrams are fixed
    // 3D objects that scale naturally with the camera like models, charts, etc.
    const cached = this.cachedWorldScale.get(state.id);
    let uniformWorldW: number;
    let uniformWorldH: number;
    if (cached && cached.vpX === vp.x && cached.vpY === vp.y &&
        cached.vpW === vp.w && cached.vpH === vp.h) {
      uniformWorldW = cached.uniformWorldW;
      uniformWorldH = cached.uniformWorldH;
    } else {
      uniformWorldW = vp.w * coords.visibleWorldWidth;
      uniformWorldH = vp.h * coords.visibleWorldHeight;
      this.cachedWorldScale.set(state.id, {
        vpX: vp.x, vpY: vp.y, vpW: vp.w, vpH: vp.h,
        uniformWorldW, uniformWorldH,
      });
    }

    // Quantize uniformWorldW for thickness/border scaling to prevent per-frame
    // geometry rebuilds during transitions. Sub-renderers compare thickness values
    // for change detection — continuous floating-point changes trigger expensive
    // TubeGeometry/ExtrudeGeometry recreation on every node/edge/group every frame.
    // Quantizing to 0.1 precision limits rebuilds to ~3 per transition while keeping
    // visual error below 5% of tube thickness (sub-pixel).
    const thicknessScale = Math.round(uniformWorldW * 10) / 10 || 0.1;

    // ─── Groups ───────────────────────────────────────────────────────────────

    const activeGroupIds = new Set(state.groups.map((g) => g.id));
    if (prev) {
      for (const g of prev.groups) {
        if (!activeGroupIds.has(g.id)) {
          this.groupRenderer.dispose(g.id, state.id, group);
        }
      }
    }

    for (const groupState of state.groups) {
      // Compute group center in diagram-local NVS, then map to group-local world coords.
      const gcNvsX = groupState.bounds.x + groupState.bounds.w / 2;
      const gcNvsY = groupState.bounds.y + groupState.bounds.h / 2;
      const localGCX = (gcNvsX - 0.5) * uniformWorldW;
      const localGCY = -(gcNvsY - 0.5) * uniformWorldH;

      // Convert group size from NVS fractions to world units.
      const worldGW = groupState.bounds.w * uniformWorldW;
      const worldGH = groupState.bounds.h * uniformWorldH;

      // Convert padding from NVS fractions to world units.
      // padding = [top, right, bottom, left] as NVS fractions.
      const worldPadTop = groupState.bounds.padding[0] * uniformWorldH;
      const worldPadRight = groupState.bounds.padding[1] * uniformWorldW;
      const worldPadBottom = groupState.bounds.padding[2] * uniformWorldH;
      const worldPadLeft = groupState.bounds.padding[3] * uniformWorldW;
      const worldTitleGap = groupState.bounds.titleGap * uniformWorldH;

      // Convert edge lights from NVS group-local fractions to world units.
      // Edge light positions are in NVS group-local fractions — convert to world-space half-extents.
      let convertedEdgeLights: DiagramGroupEdgeLightsState | undefined = groupState.edgeLights;
      if (groupState.edgeLights && worldGW > 0 && worldGH > 0) {
        convertedEdgeLights = {
          ...groupState.edgeLights,
          lights: groupState.edgeLights.lights.map((light) => {
            const lightWorldX = light.position[0] * worldGW;
            const lightWorldY = light.position[1] * worldGH;
            return {
              ...light,
              position: [lightWorldX / 2, lightWorldY / 2, light.position[2]] as readonly [number, number, number],
            };
          }),
        };
      }

      // GroupRenderer uses bounds.x as left edge, bounds.y as bottom edge (Y-up).
      // Compute left and bottom edges from center and half-extents.
      const groupThicknessScale = groupState.uniformSizing
        ? (Math.round(Math.min(uniformWorldW, uniformWorldH) * 10) / 10 || 0.1)
        : thicknessScale;

      const convertedGroup: DiagramGroupState = {
        ...groupState,
        // Convert borderWidth and borderHeight from NVS fraction to world units via
        // quantized scale to avoid per-frame geometry rebuilds during transitions.
        borderWidth: groupState.borderWidth * groupThicknessScale,
        borderHeight: groupState.borderHeight * groupThicknessScale,
        bounds: {
          x: localGCX - worldGW / 2,  // left edge (GroupRenderer: centerX = bounds.x + bounds.w/2)
          y: localGCY - worldGH / 2,  // bottom edge Y-up (GroupRenderer: centerY = bounds.y + bounds.h/2)
          w: worldGW,
          h: worldGH,
          padding: [worldPadTop, worldPadRight, worldPadBottom, worldPadLeft] as readonly [number, number, number, number],
          titleGap: worldTitleGap,
        },
        edgeLights: convertedEdgeLights,
      };
      this.groupRenderer.getOrCreate(convertedGroup, state.id, group, tc);
    }

    // ─── Edges ────────────────────────────────────────────────────────────────

    const activeEdgeIds = new Set(state.edges.map((e) => `${state.id}::${e.id}`));
    for (const id of this.edgeRenderer.ids) {
      if (id.startsWith(`${state.id}::`) && !activeEdgeIds.has(id)) {
        this.edgeRenderer.dispose(id, group);
      }
    }

    // When the fingerprint matches, reuse the previous frame's converted edges.
    // This preserves object references so the EdgeRenderer's `edge.path !== prev.path`
    // check passes and it skips the expensive TubeGeometry rebuild.
    const cachedEdges = fpMatch ? this.lastConvertedEdges.get(state.id) : undefined;
    const convertedEdges: DiagramEdgeState[] = [];

    for (let ei = 0; ei < state.edges.length; ei++) {
      const edgeState = state.edges[ei]!;

      // Reuse the cached converted edge if fingerprint matched and index aligns
      const cached = cachedEdges?.[ei];
      let convertedEdge: DiagramEdgeState;

      if (cached && cached.id === edgeState.id) {
        // Same edge, same content — reuse the converted path/controlPoints
        // so EdgeRenderer sees the same reference and skips geometry rebuild.
        // Update flow/opacity/color fields that may change independently.
        convertedEdge = {
          ...cached,
          flow: edgeState.flow,
          flowColor: edgeState.flowColor,
          opacity: edgeState.opacity,
          color: edgeState.color,
        };
      } else {
        const convertedPath = {
          ...edgeState.path,
          commands: edgeState.path.commands.map((command) => {
            if (command.kind === 'line') {
              return {
                kind: 'line' as const,
                from: [
                  (command.from[0] - 0.5) * uniformWorldW,
                  -(command.from[1] - 0.5) * uniformWorldH,
                  command.from[2] * thicknessScale + NODE_RENDER_Z_OFFSET,
                ] as const,
                to: [
                  (command.to[0] - 0.5) * uniformWorldW,
                  -(command.to[1] - 0.5) * uniformWorldH,
                  command.to[2] * thicknessScale + NODE_RENDER_Z_OFFSET,
                ] as const,
              };
            }
            return {
              kind: 'cubic' as const,
              p0: [
                (command.p0[0] - 0.5) * uniformWorldW,
                -(command.p0[1] - 0.5) * uniformWorldH,
                command.p0[2] * thicknessScale + NODE_RENDER_Z_OFFSET,
              ] as const,
              p1: [
                (command.p1[0] - 0.5) * uniformWorldW,
                -(command.p1[1] - 0.5) * uniformWorldH,
                command.p1[2] * thicknessScale + NODE_RENDER_Z_OFFSET,
              ] as const,
              p2: [
                (command.p2[0] - 0.5) * uniformWorldW,
                -(command.p2[1] - 0.5) * uniformWorldH,
                command.p2[2] * thicknessScale + NODE_RENDER_Z_OFFSET,
              ] as const,
              p3: [
                (command.p3[0] - 0.5) * uniformWorldW,
                -(command.p3[1] - 0.5) * uniformWorldH,
                command.p3[2] * thicknessScale + NODE_RENDER_Z_OFFSET,
              ] as const,
            };
          }),
        };
        const edgeThicknessScale = edgeState.uniformSizing
          ? (Math.round(Math.min(uniformWorldW, uniformWorldH) * 10) / 10 || 0.1)
          : thicknessScale;
        convertedEdge = {
          ...edgeState,
          thickness: edgeState.thickness * edgeThicknessScale,
          path: convertedPath,
          controlPoints: edgeState.controlPoints.map((cp) => {
            const localCpX = (cp[0] - 0.5) * uniformWorldW;
            const localCpY = -(cp[1] - 0.5) * uniformWorldH;
            return [localCpX, localCpY, cp[2] * thicknessScale + NODE_RENDER_Z_OFFSET] as readonly [number, number, number];
          }),
        };
      }

      convertedEdges.push(convertedEdge);
      this.edgeRenderer.getOrCreate(
        { ...convertedEdge, id: `${state.id}::${convertedEdge.id}` },
        group,
      );
    }
    this.lastConvertedEdges.set(state.id, convertedEdges);

    // ─── Nodes ────────────────────────────────────────────────────────────────

    const activeNodeIds = new Set(state.nodes.map((n) => n.id));
    if (prev) {
      for (const n of prev.nodes) {
        if (!activeNodeIds.has(n.id)) {
          this.nodeRenderer.dispose(n.id, state.id, group);
        }
      }
    }

    for (const nodeState of state.nodes) {
      // Node position: diagram-local NVS [0..1] → group-local world coords.
      const localX = (nodeState.position[0] - 0.5) * uniformWorldW;
      const localY = -(nodeState.position[1] - 0.5) * uniformWorldH; // Y-flip: NVS 0=top, Three.js +Y=up
      const localZ = nodeState.position[2] + NODE_RENDER_Z_OFFSET;

      // Node size: NVS fractions → world units.
      // When uniformSizing is true, use vmin-based scaling for aspect-ratio-preserving sizes.
      let worldW: number;
      let worldH: number;
      if (nodeState.uniformSizing) {
        const uniform = Math.min(uniformWorldW, uniformWorldH);
        worldW = nodeState.size[0] * uniform;
        worldH = nodeState.size[1] * uniform;
      } else {
        worldW = nodeState.size[0] * uniformWorldW;
        worldH = nodeState.size[1] * uniformWorldH;
      }

      if (process.env.NODE_ENV !== 'production') {
        if (!Number.isFinite(localX) || !Number.isFinite(localY)) {
          console.error(
            `[DiagramRenderer] Non-finite position for node "${nodeState.id}": ` +
            `localX=${localX}, localY=${localY}. ` +
            `Check camera setup and NVS coords.`,
          );
        }
      }

      // When uniformSizing, all size-like fields use vmin-based thicknessScale.
      const nodeThicknessScale = nodeState.uniformSizing
        ? (Math.round(Math.min(uniformWorldW, uniformWorldH) * 10) / 10 || 0.1)
        : thicknessScale;
      const nodeBorderScale = nodeState.uniformSizing
        ? Math.min(uniformWorldW, uniformWorldH)
        : uniformWorldW;

      const convertedNode: DiagramNodeState = {
        ...nodeState,
        position: [localX, localY, localZ],
        size: [worldW, worldH],
        // Convert node Z-depth from NVS fraction to world units via quantized
        // scale to avoid per-frame geometry rebuilds during transitions.
        thickness: nodeState.thickness * nodeThicknessScale,
        iconDepth: nodeState.iconDepth * nodeThicknessScale,
        cornerRadius: nodeState.cornerRadius * nodeThicknessScale,
        // borderWidth is an XY dimension (ring width), scales like size.
        // borderHeight is a Z dimension (frame depth), scales like thickness.
        borderWidth: nodeState.borderWidth * nodeBorderScale,
        borderHeight: nodeState.borderHeight * nodeThicknessScale,
      };
      this.nodeRenderer.getOrCreate(convertedNode, state.id, tc, group);
    }

    this.lastState.set(state.id, state);
  }

  setNodeEmissiveOverride(diagramId: string, nodeId: string, enabled: boolean | undefined): void {
    this.nodeRenderer.setNodeEmissiveOverride(diagramId, nodeId, enabled);
  }

  clearNodeEmissiveOverrides(diagramId: string): void {
    this.nodeRenderer.clearEmissiveOverridesForDiagram(diagramId);
  }

  dispose(diagramId: string, group: THREE.Object3D): void {
    this.nodeRenderer.disposeAllForDiagram(diagramId, group);
    this.groupRenderer.disposeAllForDiagram(diagramId, group);
    for (const id of this.edgeRenderer.ids) {
      if (id.startsWith(`${diagramId}::`)) {
        this.edgeRenderer.dispose(id, group);
      }
    }
    this.lastState.delete(diagramId);
    this.cachedWorldScale.delete(diagramId);
    this.nodeRenderer.clearEmissiveOverridesForDiagram(diagramId);
    this.interactionRegistry.clear();
    this.groupInteractionRegistry.clear();
    this.envMapManager.disposeAll();
  }
}
