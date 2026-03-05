---
title: "NVS System — Known Limitations"
doc_type: note
owner: Toolkit Product
status: active
last_updated: 2026-03-04
---

# NVS System — Known Limitations

These limitations were formally documented by the architect upon completion of the NVS implementation. Each entry describes the root cause, the affected code path, and the correct fix for when a sub-region model is first introduced in production.

---

## Limitation 1: LabelPositionerSyncer Does Not Re-Fire on nvsBounds Change Without Resize

**Affected file:** `packages/model/src/plugin.ts`

**Root cause:** `LabelPositionerSyncer` wires `setContainerSize` in a `useEffect` that has `[containerWidth, containerHeight]` as its dependency array. When a scene transition causes the active `ModelWidget`'s `nvsBounds` to change (because the next scene declares different NVS sub-region props), but the host container has not resized (width and height are unchanged), the `useEffect` does not re-fire. `setContainerSize` is therefore not called with the new `nvsBounds`, and labels continue to project against the stale NVS bounds from the previous scene.

**Affected scenario:** A sequence where scene A has a model with fullscreen NVS bounds and scene B has the same model with a declared sub-region (`x`, `y`, `w`, `h` props). On transition from A to B, label positions will be incorrect until the next container resize event.

**Fix:** Add `widget?.nvsBounds` to the `useEffect` dependency array in `LabelPositionerSyncer`:

```typescript
// packages/model/src/plugin.ts — LabelPositionerSyncer useEffect
useEffect(() => {
  if (!labelPositioner || !containerWidth || !containerHeight) return;
  const modelWidgets = registry.getNVSBoundedWidgets().filter(isModelWidget);
  const nvsBounds = modelWidgets[0]?.nvsBounds;
  labelPositioner.setContainerSize(containerWidth, containerHeight, nvsBounds);
}, [labelPositioner, registry, containerWidth, containerHeight, widget?.nvsBounds]);
//                                                                ^^^^^^^^^^^^^^^^^^
// Add this dependency. Without it, LabelPositionerSyncer does not re-fire when
// the model transitions to a scene with different NVS sub-region bounds.
```

**Priority:** Required fix before shipping any scene sequence that changes a model's NVS sub-region between scenes.

---

## Limitation 2: Multiple Simultaneous Models in Distinct NVS Sub-Regions Receive Incorrect Label Positioning

**Affected file:** `packages/model/src/plugin.ts`

**Root cause:** `LabelPositionerSyncer` currently calls `registry.getNVSBoundedWidgets().filter(isModelWidget)[0]?.nvsBounds` — it selects only the first registered `ModelWidget`'s NVS bounds and passes them as the single `nvsBounds` argument to `setContainerSize`. `LabelPositioner` has a single NVS bounds value for the entire projection context; it cannot independently apply different NVS bounds to labels belonging to different models.

**Affected scenario:** Two models registered in the same scene, each with distinct `x`, `y`, `w`, `h` NVS sub-region props. Labels attached to `ModelWidget` B (the second registered widget) will project against `ModelWidget` A's (the first registered widget) NVS bounds, producing incorrect screen positions.

**Fix:** This limitation requires a design change to `LabelPositioner`. The current architecture maintains a single NVS bounds value for the full label projection context. The correct fix is a per-widget `LabelPositioner` design — one `LabelPositioner` instance per `ModelWidget`, each configured with its own `nvsBounds`. This is a non-trivial refactor and is deferred until a multi-model NVS scene is required in production.

**Workaround:** Until the per-widget `LabelPositioner` design is implemented, restrict NVS sub-region usage to scenes where only one `ModelWidget` is active at a time. Multiple models are fully supported when all use fullscreen bounds (`x=0, y=0, w=1, h=1`).

**Priority:** Deferred. Only blocks scenes with simultaneous multi-model NVS sub-regions, which are not yet required in any published scene.

---

## NVS Package Ownership Reference

This table is the authoritative reference for which package owns each NVS concept. It is duplicated in `requirements/core/prd/prd_player_runtime.md` Section 25.

| Concept | Package | Source File |
|---|---|---|
| `NVSRect`, `NVSPosition`, `INVSBounded` | `@brewsite/core` | `src/layout/types.ts` |
| `EngineARContainer` | `@brewsite/core` | `src/player/EngineARContainer.tsx` |
| `TextBox` DSL element | `@brewsite/core` | `src/elements/text-box/` |
| `--scene-scale` CSS variable | `@brewsite/core` | injected by `EngineARContainer` |
| `DiagramCanvas` NVS bounds (`x`, `y`, `w`, `h` props) | `@brewsite/diagram` | `src/elements/diagram/canvas/` |
| `Chart` NVS bounds (`x`, `y`, `w`, `h` props) | `@brewsite/charts` | `src/elements/chart/` |
| `ChartTooltipOverlay` NVS bounds | `@brewsite/charts` | `src/elements/chart/ChartTooltipOverlay.tsx` |
| `Model` NVS bounds (`x`, `y`, `w`, `h` props) | `@brewsite/model` | `src/elements/model/` |
| `LabelPositioner` NVS sub-region | `@brewsite/model` | `src/player/LabelPositioner.ts` |
