// Helpers for constructing a single-scene ScenePlayer setup from diagram data.
// Uses React.createElement directly (no JSX) so this stays a plain .ts module.
//
// Two variants:
//   buildPreviewScene / buildPreviewWidgetSetup   — for DiagramState (Lucid API path)
//   buildDslPreviewScene / buildDslPreviewWidgetSetup — for DiagramDSL (local file path)
//
// The DSL variants are preferred when possible because they embed the full node/edge
// tree inside <DiagramCanvas>, ensuring the SceneTrack contains the correct compiled
// state. The DiagramState variants put an empty <DiagramCanvas> in the DSL which can
// be overwritten by the compiler; those are kept for backward compatibility.

import { createElement } from 'react';
import type { SceneDefinition, AssetManifest } from '@brewsite/core';
import { createDefaultWidgetRegistry, Scene, Camera, Lighting, Ambient, Directional } from '@brewsite/core';
import type { DiagramDSL, DiagramState } from '@brewsite/diagram';
import {
  DiagramCanvas, DiagramCanvasWidget, Diagram, DiagramNode, DiagramEdge,
  compileCanvas, compileDiagram, registerDiagramHandlers, darkGlassTheme,
} from '@brewsite/diagram';

const CANVAS_ID = 'lucid-preview-canvas';

// ─── DSL-based variants (correct: full tree in the SceneTrack) ────────────────

/**
 * Builds a scene whose DSL contains the full Diagram element tree derived from
 * the DiagramDSL. This ensures the SceneTrack state matches the pre-compiled
 * widgetSetup state — no overwrite, no black screen.
 *
 * @param dsl      - DiagramDSL produced by convertLucidPage()
 * @param compiled - DiagramState from compileDiagram(dsl) — used only for camera fit
 */
export function buildDslPreviewScene(dsl: DiagramDSL, compiled: DiagramState): SceneDefinition {
  const { w, h } = compiled.bounds;
  const worldW = (isFinite(w) ? w : 20) * (isFinite(compiled.scale) ? compiled.scale : 1);
  const worldH = (isFinite(h) ? h : 15) * (isFinite(compiled.scale) ? compiled.scale : 1);
  const cameraZ = Math.max(worldW, worldH, 10) * 1.5 + 10;

  return {
    id: `lucid-preview-${dsl.id}`,
    index: 0,
    getFrame: () => createElement(
      Scene, { id: `lucid-preview-${dsl.id}` },
      createElement(Camera, {
        mode: 'world', fov: 50,
        position: [0, 0, cameraZ],
        target: [0, 0, 0],
      }),
      createElement(
        Lighting, { intensityScale: 1 },
        createElement(Ambient, { intensity: 1.4, color: '#ffffff' }),
        createElement(Directional, { intensity: 0.6, color: '#aaccff', position: [-20, 20, 30] }),
        createElement(Directional, { intensity: 0.4, color: '#ffeedd', position: [20, -10, 20] }),
      ),
      createElement(
        DiagramCanvas, { id: CANVAS_ID, scale: 1, theme: darkGlassTheme },
        createElement(
          Diagram, {
            id: dsl.id,
            layout: dsl.layout,
            // Spread readonly tuples to mutable for JSX prop compatibility
            layoutSpacing: dsl.layoutSpacing
              ? [dsl.layoutSpacing[0], dsl.layoutSpacing[1]] as [number, number]
              : undefined,
            pivot: dsl.pivot ?? 'center',
            scale: dsl.scale ?? 1,
          },
          // Spread all nodes and edges as createElement children.
          // Cast readonly tuples to mutable to satisfy DiagramNode/Edge prop types.
          ...dsl.nodes.map((node) =>
            createElement(DiagramNode, {
              key: node.id,
              ...node,
              position: node.position ? [node.position[0], node.position[1], node.position[2]] as [number, number, number] : undefined,
              size:     node.size     ? [node.size[0],     node.size[1]]                        as [number, number]          : undefined,
            }),
          ),
          ...dsl.edges.map((edge, i) =>
            createElement(DiagramEdge, { key: `e${i}`, ...edge }),
          ),
        ),
      ),
    ),
  };
}

/**
 * Widget registry for use with buildDslPreviewScene.
 * Pre-compiles the diagram from the DSL so the first frame renders correctly.
 */
export function buildDslPreviewWidgetSetup(
  manifest: AssetManifest | null,
  dsl: DiagramDSL,
  compiled: DiagramState,
) {
  registerDiagramHandlers();
  const registry = createDefaultWidgetRegistry(manifest);

  const canvasState = compileCanvas(
    { id: CANVAS_ID, scale: 1 },
    [compiled],
    [],
  );

  registry.register(new DiagramCanvasWidget(CANVAS_ID, canvasState));
  return registry;
}

// ─── DiagramState-based variants (legacy: kept for LucidPickerPage) ───────────

/**
 * @deprecated Prefer buildDslPreviewScene when a DiagramDSL is available.
 * This variant puts an empty <DiagramCanvas> in the scene DSL which may be
 * overwritten by the compiler for large or hierarchically-laid-out diagrams.
 */
export function buildPreviewScene(diagramState: DiagramState): SceneDefinition {
  return buildDslPreviewScene(
    // Synthesise a minimal DSL shell — the pre-compiled state from the
    // widgetSetup will prevail for the first few frames until the compiler
    // catches up. For API-loaded diagrams this is imperceptible.
    {
      id: diagramState.id,
      layout: 'manual',
      layoutSpacing: [2, 2],
      nodes: diagramState.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        shape: n.shape,
        position: n.position,
        size: n.size,
        color: n.color,
        opacity: n.opacity,
        enabled: n.enabled,
      })),
      edges: diagramState.edges.map((e) => ({
        id: e.id,
        from: e.fromId,
        to: e.toId,
        color: e.color,
        style: e.style,
        flow: e.flow,
        thickness: e.thickness,
        opacity: e.opacity,
      })),
      groups: [],
      scale: diagramState.scale,
      position: diagramState.position,
      rotation: diagramState.rotation,
      pivot: diagramState.pivot,
    },
    diagramState,
  );
}

/**
 * @deprecated Prefer buildDslPreviewWidgetSetup.
 */
export function buildPreviewWidgetSetup(
  manifest: AssetManifest | null,
  diagramState: DiagramState,
) {
  registerDiagramHandlers();
  const registry = createDefaultWidgetRegistry(manifest);

  const canvasState = compileCanvas(
    { id: CANVAS_ID, scale: 1 },
    [diagramState],
    [],
  );

  registry.register(new DiagramCanvasWidget(CANVAS_ID, canvasState));
  return registry;
}
