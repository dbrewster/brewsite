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
  - date: 2026-03-18
    author: Toolkit PM
    summary: "Revised after PM-2 review: expanded SceneTheme bridge plumbing details with exact file paths and 4-level chain; clarified sceneTheme placement on CompileSceneTrackOptions not ActiveTheme; added Fix 4 dependency note on Fix 2; inlined recommended node minimums table for Item 2; added Orama index rebuild note for bot docs; noted SceneSnapshotContext is a public type."
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

**Dependency on Remaining Item 1 (SceneTheme bridge):** These 1.0 values are correct and harmless today, but they become *load-bearing* once the SceneTheme bridge lands — they are the neutral multiplier that prevents the bridge from inadvertently shrinking diagram text. If the bridge never ships, the 1.0 values are inert but cause no harm. The correctness of this fix is contingent on the bridge eventually landing to make the `fontSize` fields actually flow through to diagram compilation.

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

**What's missing:** The compile-time plumbing that populates `DiagramTheme.sceneTheme` from the engine's active `SceneTheme`. The gap is a 4-level chain across 4 files:

**Level 1 — `packages/core/src/compiler/sceneTrackCompiler.ts`** (line 27):
Add `sceneTheme?: SceneTheme` to `CompileSceneTrackOptions`. This is the correct location — `sceneTheme` is theme *content* (font URLs, font size multipliers), not theme *selection* (`family`/`polarity`), so it belongs as a separate option alongside `activeTheme`, NOT merged into the `ActiveTheme` type.

Then at line 373, where the `context` object is constructed for `scene.getFrame(context)`, spread `sceneTheme: options.sceneTheme` into the context object so it reaches `SceneSnapshotContext`.

**Level 2 — `packages/core/src/compiler/sceneTypes.ts`** (line 6):
Add `sceneTheme?: SceneTheme` to the `SceneSnapshotContext` type. This is a **public type** — it's the context parameter for `Resolvable<T>` callbacks, so it's part of the DSL authoring surface. The field is optional, so existing consumers who construct `SceneSnapshotContext` manually (e.g., in tests) will not break.

**Level 3 — `packages/core/src/player/useSceneEngine.ts`** (lines 650 and 681):
Both `compileSceneTrack()` call sites must pass `sceneTheme: options.sceneTheme` through to the compiler options. The `SceneTheme` is available on `options.sceneTheme` (the hook already receives it as a prop and stores it on `scene.userData` at line 522, but the compiler is pure and cannot access Three.js `userData`). The compiler must receive the reference directly via its options.

**Level 4 — `packages/diagram/src/compiler/handlers.ts`**:
In the Diagram `registerNode` handler, after `resolveDiagramTheme(api.context.themeFamily, api.context.themePolarity)`, merge `api.context.sceneTheme` into the resolved theme: `{ ...resolvedTheme, sceneTheme: api.context.sceneTheme }`. Pass this merged theme to `compileDiagram()` instead of the bare `resolvedTheme`.

**Cross-package scope:** This fix spans `@brewsite/core` (Levels 1–3: type change + compiler plumbing + engine hook) and `@brewsite/diagram` (Level 4: handler bridging). The core changes add optional fields to `CompileSceneTrackOptions` and `SceneSnapshotContext` — both are minor, backward-compatible API extensions. No existing consumer code breaks because both fields are optional.

**Why it matters:** Without this bridge, diagram text always uses troika's built-in Roboto Regular (thin, low-contrast on dark backgrounds) instead of the host app's configured webgl font. The `fontSize.label` and `fontSize.caption` multipliers on `SceneTheme` also have no effect on diagram text, making the slides `themeCompiler` corrections (Fix 4, completed above) inert.

### Remaining Item 2: Fix All 13 Example Diagrams

**Status: NOT STARTED**

**Evidence:** `git diff --name-only` shows only `apps/examples/src/slides-demo/deck.tsx` and `SlidesDemoPage.tsx` modified — and those changes are related to the slides package refactor (import restructuring, 3D scene additions), NOT diagram rendering adjustments. None of the other 12 example files listed in `note_example-diagram-audit.md` appear in the working tree diff.

**Scope:** 13 files across `apps/examples/` and `apps/website/` contain `<Diagram>`, `<DiagramNode>`, `<DiagramGroup>`, or `<DiagramEdge>` declarations that must be visually reviewed and updated after the rendering fixes.

**Implementation spec:** `note_example-diagram-audit.md` § Work Item 2 contains the full file list, per-file step-by-step fix procedure, and snapshot baseline update instructions. That note is the implementation spec for this item — no separate architect plan is needed.

**Nature of this task:** This is a manual visual review task. There is no automated way to determine which node sizes were "compensating for distortion" vs intentionally non-square. The implementer MUST:
1. Run `pnpm dev` and visually compare each example before and after
2. Assess each node's intended shape from context (labels, layout role, surrounding nodes)
3. Adjust sizes, spacing, and group labels based on visual inspection

**Recommended minimum node sizes (for reference):**

| Content | Minimum Size | Notes |
|---------|-------------|-------|
| Label only | `[4, 2]` | Theme default, good for most cases |
| Label + sublabel | `[4, 2.5]` | Needs vertical room for two text lines |
| Icon + label | `[3, 3]` | Icon needs vertical space above label |
| Icon + label + sublabel | `[4, 3]` | All three stack vertically — safe minimum |
| Icon + label + sublabel (circle/hex) | `[3.5, 3.5]` | Polygon content area is smaller than bounding box |
| Icon + label + sublabel (diamond) | `[4, 4]` | Diamond content area is ~50% of bounding box |

**Key adjustments needed per file:**
- Node sizes that were compensating for aspect ratio distortion (e.g., `[4, 3]` that was visually square) should be corrected to true intent (e.g., `[4, 4]` for square)
- Nodes with icon + label + sublabel need minimum sizes per the table above
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

After doc changes, rebuild the Orama search index: `pnpm --filter @brewsite/claude-author build`. The build-index script (`packages/claude-author/scripts/build-index.mjs`) auto-discovers all files under `docs/`, chunks by `##` heading, embeds each chunk, and serializes to `index/orama-index.json`. No separate manifest or docs registry needs updating — any new `.md` file in `docs/` is automatically indexed on rebuild.

**Dependency:** Should be done after Remaining Items 1 and 2 so the docs reflect the final, verified rendering behavior.

---

## EXCLUDED Item: NVS Sizing Migration

Work Item 4 from `note_example-diagram-audit.md` (migrating diagram node sizes from diagram content units to NVS fractions) is explicitly deferred as a future breaking API change. It is out of scope for this work stream and should be scoped as its own PRD if approved.

---

## Implementation Sequence

```
1. SceneTheme → DiagramTheme bridge  (core + diagram, needs architect plan)
2. Fix all 13 example diagrams       (apps only, depends on #1, spec in audit note)
3. Update bot docs                    (claude-author only, depends on #2, needs architect plan)
```

- **Item 1** needs an architect plan — it's a cross-package compile pipeline change with 4 files and type-level API implications.
- **Item 2** does NOT need a separate plan — `note_example-diagram-audit.md` § Work Item 2 already provides the full per-file fix procedure. It is a manual visual review + adjustment task.
- **Item 3** needs an architect plan for the doc structure and content, referencing the content outline in `note_example-diagram-audit.md` § Work Item 3.
