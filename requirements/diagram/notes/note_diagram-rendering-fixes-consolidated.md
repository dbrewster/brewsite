---
title: "Diagram Rendering Fixes — Consolidated Status and Remaining Work"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: Toolkit PM
    summary: "Consolidated note created from note_example-diagram-audit.md and plan_diagram-node-aspect-ratio-and-text-defaults.md. Verified implementation status of all work items against working tree diffs."
---

# Diagram Rendering Fixes — Consolidated Status and Remaining Work

## Context

Two source documents describe a set of rendering improvements for `@brewsite/diagram`:

1. `plan_diagram-node-aspect-ratio-and-text-defaults.md` — four numbered fixes (aspect ratio, SceneTheme bridge, font size bases, slides fontSize scales)
2. `note_example-diagram-audit.md` — post-fix work items (SceneTheme bridge, example diagram updates, bot docs updates, NVS sizing migration)

This note consolidates both into a single status view, verified against the current working tree.

---

## COMPLETED Items

All evidence below is from `git diff` of uncommitted changes on `main`.

### 1. Node Size Aspect Ratio Correction (Fix 1)

**Status: DONE**

`packages/diagram/src/elements/diagram/render.ts` contains the full aspect-ratio correction implementation:
- `viewportAspect`, `contentAspect`, `sizeScaleX`/`sizeScaleY` computed after the `uniformWorldW`/`uniformWorldH` block
- `scaledWorldW = uniformWorldW * sizeScaleX` and `scaledWorldH = uniformWorldH * sizeScaleY` used as unified conversion factors
- Applied uniformly to node sizes, node positions, group sizes, group positions, group padding, edge paths, and thickness scaling
- The implementation goes further than the original plan: positions AND sizes both use the corrected scale (via `scaledWorldW`/`scaledWorldH`), which ensures edge anchor points match rendered node geometry. The plan originally proposed correcting only sizes, but this was refined during implementation.

Test coverage added in `packages/diagram/src/elements/diagram/__tests__/diagramRenderer.test.ts`.

### 2. Font Size Bases Bumped (Fix 3)

**Status: DONE**

All 12 diagram theme files updated (`labelFontSizeBase` 0.28→0.32, `sublabelFontSizeBase` 0.18→0.22):
- `packages/diagram/src/elements/diagram/themes/` — all 6 themes (darkGlass, enterprise, lightCanvas, lightMinimal, midnight, neonCyber)
- `packages/themes/src/presets/diagram/` — all 6 corresponding theme presets

Test assertions updated in `packages/diagram/src/elements/diagram/compiler/__tests__/themeResolver.test.ts`.

### 3. Slides fontSize Scales Corrected (Fix 4)

**Status: DONE**

`packages/slides/src/compiler/themeCompiler.ts` updated:
- `fontSize.label`: 0.875 → 1.0
- `fontSize.caption`: 0.75 → 1.0

This ensures diagram text sizing is controlled solely by the diagram theme's own `labelFontSizeBase`/`sublabelFontSizeBase`, with the SceneTheme providing a neutral 1.0× multiplier by default.

### 4. Fit-to-Content Node Label Layout

**Status: DONE**

`packages/diagram/src/elements/diagram/rendering/nodeLabelLayout.ts` fully rewritten:
- `NodeLabelLayout` type extended with `iconY: number | undefined` and `effectiveIconScale: number`
- New algorithm computes total vertical demand of icon + gaps + label + sublabel, applies uniform `fitScale` when demand exceeds `contentH`
- Handles zero-height content area gracefully

Test coverage added in `packages/diagram/src/elements/diagram/rendering/__tests__/nodeLabelLayout.test.ts`.

### 5. NodeRenderer Icon Positioning

**Status: DONE**

`packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts` updated:
- Icon size uses `labelLayout.effectiveIconScale` instead of raw `state.iconScale`
- Icon Y position uses `labelLayout.iconY` instead of hardcoded `contentH * 0.2`

---

## REMAINING Items

### Remaining Item 1: SceneTheme → DiagramTheme Bridge at Compile Time

**Status: NOT STARTED**

**Evidence:** `packages/diagram/src/compiler/handlers.ts` has NO modifications in the working tree. `packages/core/src/compiler/sceneTypes.ts` has NO `sceneTheme` field on `SceneSnapshotContext`. No `sceneTheme` string appears anywhere in `packages/core/src/compiler/`.

**What exists today:**
- The `DiagramTheme` type already has an optional `sceneTheme?: SceneTheme` field (`packages/diagram/src/elements/diagram/types.ts:387`)
- `themeResolver.ts` already reads `theme.sceneTheme?.fontSize.label`, `theme.sceneTheme?.fontSize.caption`, and `theme.sceneTheme?.font.webglFontUrl` — the consumption side is fully wired
- `buildThemeRenderConfig()` already multiplies `labelSizeFactor × sceneTheme.fontSize.label` and `sublabelSizeFactor × sceneTheme.fontSize.caption`
- Tests in `themeResolver.test.ts` already verify sceneTheme bridging behavior (fontUrl fallback, fontSize multipliers)

**What's missing:** The compile-time plumbing that populates `DiagramTheme.sceneTheme` from the engine's active `SceneTheme`. The gap is:

1. **`SceneSnapshotContext` lacks `sceneTheme`** — The context type in `packages/core/src/compiler/sceneTypes.ts` only has `themeFamily` and `themePolarity`. It needs an optional `sceneTheme?: SceneTheme` field so that `api.context.sceneTheme` is available to node handlers.

2. **`useSceneEngine` doesn't pass `sceneTheme` into the compiler** — The `SceneTheme` is stored on `scene.userData[SCENE_THEME_USERDATA_KEY]` (line 522 of `useSceneEngine.ts`), but the compiler is pure and has no access to Three.js `userData`. The compiler options (or the snapshot context) must carry the `SceneTheme` reference.

3. **`handlers.ts` doesn't bridge context → DiagramTheme** — The diagram node handler in `packages/diagram/src/compiler/handlers.ts` calls `resolveDiagramTheme(api.context.themeFamily, api.context.themePolarity)` but never sets `resolvedTheme.sceneTheme`. It needs to merge `api.context.sceneTheme` into the resolved theme before passing it to `compileDiagram()`.

**Cross-package scope:** This fix spans `@brewsite/core` (type change + engine plumbing) and `@brewsite/diagram` (handler change). The core change adds an optional field to `SceneSnapshotContext` — this is a minor, backward-compatible API extension.

**Why it matters:** Without this bridge, diagram text always uses troika's built-in Roboto Regular (thin, low-contrast on dark backgrounds) instead of the host app's configured webgl font. The `fontSize.label` and `fontSize.caption` multipliers on `SceneTheme` also have no effect on diagram text, making the slides `themeCompiler` corrections (Fix 4, completed above) inert.

### Remaining Item 2: Fix All 13 Example Diagrams

**Status: NOT STARTED**

**Evidence:** `git diff --name-only` shows only `apps/examples/src/slides-demo/deck.tsx` and `SlidesDemoPage.tsx` modified — and those changes are related to the slides package refactor (import restructuring, 3D scene additions), NOT diagram rendering adjustments. None of the other 12 example files listed in `note_example-diagram-audit.md` appear in the working tree diff.

**Scope:** 13 files across `apps/examples/` and `apps/website/` contain `<Diagram>`, `<DiagramNode>`, `<DiagramGroup>`, or `<DiagramEdge>` declarations that must be visually reviewed and updated after the rendering fixes. The full file list and per-file fix instructions are in `note_example-diagram-audit.md` § Work Item 2.

**Key adjustments needed per file:**
- Node sizes that were compensating for aspect ratio distortion (e.g., `[4, 3]` that was visually square) should be corrected to true intent (e.g., `[4, 4]` for square)
- Nodes with icon + label + sublabel need minimum sizes per the recommended table (rectangle: `[4, 3]`, circle/hex: `[3.5, 3.5]`, diamond: `[4, 4]`)
- Layout `spacing` values may need adjustment since the aspect ratio correction changes how diagram units map to screen space
- Snapshot baselines must be regenerated after all fixes

**Dependency:** This item should be done AFTER Remaining Item 1 (SceneTheme bridge), so that font rendering is also correct during visual review. Otherwise the examples will need a second visual pass after fonts land.

### Remaining Item 3: Update Bot Docs in `@brewsite/claude-author`

**Status: NOT STARTED**

**Evidence:** No files in `packages/claude-author/` appear in the working tree diff.

**Scope:** The MCP server docs consumed by AI scene-authoring bots need updates to reflect the rendering changes. Full specification is in `note_example-diagram-audit.md` § Work Item 3. Summary of files:

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `packages/claude-author/docs/guides/layout-spatial-awareness.md` | Primary spatial reference: NVS vs world coords, diagram unit sizing, recommended node sizes |
| UPDATE | `packages/claude-author/docs/guides/nvs-spatial-model.md` | Add world-coords callout, fix unrealistic `<Diagram>` example |
| UPDATE | `packages/claude-author/docs/diagram/nodes-edges-groups.md` | Update `size` prop docs, add sizing guide, update `iconScale` docs |
| UPDATE | `packages/claude-author/docs/guides/common-gotchas.md` | Add gotchas for node sizing, coordinate system confusion, square nodes |
| UPDATE | `packages/claude-author/docs/diagram/overview.md` | Add "Coordinate Systems in Diagrams" section |

After doc changes, rebuild the search index: `pnpm --filter @brewsite/claude-author build`

**Dependency:** Should be done after Remaining Items 1 and 2 so the docs reflect the final, verified rendering behavior.

---

## EXCLUDED Item: NVS Sizing Migration

Work Item 4 from `note_example-diagram-audit.md` (migrating diagram node sizes from diagram content units to NVS fractions) is explicitly deferred as a future breaking API change. It is out of scope for this work stream and should be scoped as its own PRD if approved.

---

## Implementation Sequence

```
1. SceneTheme → DiagramTheme bridge  (core + diagram, ~1 plan)
2. Fix all 13 example diagrams       (apps only, depends on #1)
3. Update bot docs                    (claude-author only, depends on #2)
```

Items 1 and 3 need architect plans. Item 2 is a visual review + adjustment task that can be specified directly.
