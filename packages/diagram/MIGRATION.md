---
title: "@brewsite/diagram v3 Migration Guide"
doc_type: note
owner: architect
status: active
updated: 2026-03-08
---

# @brewsite/diagram v3 Migration Guide

This document covers breaking changes introduced in `@brewsite/diagram` v3 as part of the NVS Universal Coordinate System plan.

## 1. `<DiagramCanvas>` removed — use `<Diagram>` directly

The `<DiagramCanvas>` wrapper element is removed. Move its `x`, `y`, `w`, `h`, `tilt`, `scale`, and `theme` props directly onto each child `<Diagram>`.

**Before:**
```tsx
<DiagramCanvas id="bfc-cf-canvas" x={0} y={0} w={1} h={0.66} tilt={-0.3} scale={1} theme={brewflowTheme}>
  <Diagram id="cf-overview">
    ...
  </Diagram>
</DiagramCanvas>
```

**After:**
```tsx
<Diagram id="cf-overview" x={0} y={0} w={1} h={0.66} tilt={-0.3} scale={1} theme={brewflowTheme}>
  ...
</Diagram>
```

When a single `<DiagramCanvas>` contained multiple `<Diagram>` children, each `<Diagram>` gets the canvas-level props. If child diagrams had their own `viewportBounds`, those remain on the child as `x/y/w/h`.

## 2. `diagramPlugin({ canvases: [...] })` → `diagramPlugin({ diagrams: [...] })`

The plugin option `canvases` is renamed to `diagrams`, and the IDs are the `<Diagram id>` values (not the former canvas IDs).

**Before:**
```typescript
diagramPlugin({
  canvases: ['bfc-cf-canvas', 'bfc-bf-canvas'],
})
```

**After:**
```typescript
diagramPlugin({
  diagrams: ['cf-overview', 'bf-overview'],
})
```

## 3. `DiagramDSL.viewportBounds` removed — use `x/y/w/h` props

If you were constructing `DiagramDSL` objects directly (e.g., in tests or import utilities), replace `viewportBounds: { x, y, w, h }` with top-level `x`, `y`, `w`, `h` fields.

**Before:**
```typescript
const dsl: DiagramDSL = {
  id: 'my-diagram',
  viewportBounds: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
  ...
};
```

**After:**
```typescript
const dsl: DiagramDSL = {
  id: 'my-diagram',
  x: 0.1,
  y: 0.1,
  w: 0.8,
  h: 0.8,
  ...
};
```

## 4. `<DiagramPipe>` removed

`<DiagramPipe>` cross-diagram connectors are no longer supported. Replace:
- **Within-diagram connections**: use `<DiagramEdge>` inside the same `<Diagram>`
- **Cross-diagram connections**: Remove and add a comment for future work

```tsx
{/* TODO: cross-diagram pipe — awaiting multi-diagram composition plan */}
```

## 5. Diagrams now use the main scene camera

Diagrams previously rendered in a private scissored scene with an auto-fit camera. They now render directly in the main Three.js scene. Add an explicit camera to diagram-only scenes:

```tsx
<Camera mode="nvsViewport" worldScale={10} zRange={5} />
```

## 6. Removed public exports

The following are no longer exported from `@brewsite/diagram`:
- `DiagramCanvasState`, `DiagramCanvasDSL`, `DiagramCanvasProps`
- `DiagramPipeState`, `DiagramPipeDSL`, `DiagramPipeProps`
- `DiagramCanvas`, `DiagramPipe` (DSL components)
- `DiagramCanvasWidget`, `DiagramCanvasRenderer`
- `compileCanvas`, `compilePipe`, `functionalDiagramCanvasTransitionSpec`
- `defaultDiagramCanvasInputActions`
