---
title: "Fix Diagram Node Aspect Ratio Distortion and Text/Font Defaults"
doc_type: plan
status: approved
owner: Toolkit Product
last_updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: Toolkit PM
    summary: "Initial plan created. Addresses two related rendering bugs: (1) rectangular nodes distorted by non-uniform NVS→world scaling, (2) diagram text uses wrong font and sub-optimal size defaults."
---

# Plan: Fix Diagram Node Aspect Ratio Distortion and Text/Font Defaults

## Problem Summary

Two rendering bugs affect diagram quality, especially when diagrams are embedded in slide decks:

### Bug 1: Rectangular nodes distorted — squares render as non-square

When a diagram author declares `size={[4, 4]}` on a rectangle node, the rendered geometry is wider than tall (or vice versa depending on diagram layout). Circles and polygons are unaffected because they derive radius from `Math.min(width, height)`, masking the underlying distortion.

**Root cause**: `normalizeToViewport()` normalizes each axis independently (`sw / safeSpanX`, `sh / safeSpanY`), then `render.ts` converts NVS→world using separate `uniformWorldW` and `uniformWorldH` scales. The two non-uniform transforms compound rather than cancel. The `contentAspect` field was computed specifically to enable correction but is never used in the render pass.

### Bug 2: Diagram text uses troika default font (Roboto) and lacks SceneTheme integration

No `fontUrl` reaches the diagram text renderer. The resolution chain `theme.fontUrl ?? theme.sceneTheme?.font.webglFontUrl` returns `undefined` because:
- No built-in diagram theme sets `fontUrl`
- The `sceneTheme` field on `DiagramTheme` is never populated — the engine-level `SceneTheme` (set by SlidePlayer or host app) is not bridged into the `DiagramTheme` during compilation

**Result**: troika-three-text uses its built-in Roboto Regular, which appears thin and low-contrast on dark backgrounds. HTML overlay text uses the deck's heading font (e.g. system-ui), creating a visual mismatch.

---

## Fix 1: Node Size Aspect Ratio Correction

### Strategy

Apply uniform scaling when converting NVS node sizes to world units. The key insight: `contentAspect = spanX / spanY` tells us the original aspect ratio of the diagram content. The viewport has its own aspect ratio (`uniformWorldW / uniformWorldH`). We need a correction factor so that equal DSL units produce equal world-space dimensions.

### Implementation

#### File: `packages/diagram/src/elements/diagram/render.ts`

**Location**: Inside `update()`, after the `uniformWorldW`/`uniformWorldH` computation (around line 199) and before the node loop (line 360).

**Add aspect-ratio correction computation** (insert after the `cachedWorldScale` block, before the `thicknessScale` line):

```ts
// ─── Aspect-ratio correction ─────────────────────────────────────────────
// NVS normalization scales each axis independently (÷ spanX, ÷ spanY).
// The render pass converts back via uniformWorldW/H which have the viewport
// aspect ratio baked in. When contentAspect ≠ viewportAspect, DSL-authored
// squares render as rectangles.
//
// Correction: compute a per-axis scale factor that undoes the distortion.
// viewportAspect = uniformWorldW / uniformWorldH
// contentAspect  = spanX / spanY  (from compiled DiagramState)
//
// Without correction: worldW = nvsW * uniformWorldW = (dslW/spanX) * uniformWorldW
//                     worldH = nvsH * uniformWorldH = (dslH/spanY) * uniformWorldH
// For dslW === dslH to produce worldW === worldH:
//   (1/spanX) * uniformWorldW * corrX = (1/spanY) * uniformWorldH * corrY
//
// We want the diagram to still fill its viewport bounds (positions unchanged),
// but node/group SIZES use uniform scaling. Use the smaller axis scale to
// guarantee nothing overflows, then correct the other axis.
//
// Uniform size scale = min(uniformWorldW / spanX, uniformWorldH / spanY) * span
// But since we only have NVS sizes (already ÷ span), we need:
//   sizeScaleX = uniformSizeScale * spanX  →  but spanX is lost after NVS normalization.
//
// Alternative (simpler): use contentAspect directly.
// viewportAspect = uniformWorldW / uniformWorldH
// If contentAspect > viewportAspect: diagram is wider than viewport → shrink X sizes
// If contentAspect < viewportAspect: diagram is taller than viewport → shrink Y sizes
const viewportAspect = uniformWorldH > 0 ? uniformWorldW / uniformWorldH : 1;
const ca = state.contentAspect > 0 ? state.contentAspect : 1;
// sizeCorrection: multiply into the axis that's "stretched" relative to content.
// Goal: (nvsW * uniformWorldW * corrW) / (nvsH * uniformWorldH * corrH) = dslW / dslH
// Given nvsW/nvsH = (dslW/spanX) / (dslH/spanY) = (dslW * spanY) / (dslH * spanX)
//   = (dslW / dslH) * (1 / ca)
// So we need: corrW * uniformWorldW / (corrH * uniformWorldH) = ca
//   → corrW / corrH = ca * (uniformWorldH / uniformWorldW) = ca / viewportAspect
// Set the larger correction to 1.0, shrink the other:
const aspectRatio = ca / viewportAspect;
let sizeScaleX: number;
let sizeScaleY: number;
if (aspectRatio <= 1) {
  // Content is relatively taller than viewport → X is over-stretched, shrink X sizes
  sizeScaleX = aspectRatio;
  sizeScaleY = 1;
} else {
  // Content is relatively wider than viewport → Y is over-stretched, shrink Y sizes
  sizeScaleX = 1;
  sizeScaleY = 1 / aspectRatio;
}
```

**Modify node size conversion** (lines 367-369):

Before:
```ts
const worldW = nodeState.size[0] * uniformWorldW;
const worldH = nodeState.size[1] * uniformWorldH;
```

After:
```ts
const worldW = nodeState.size[0] * uniformWorldW * sizeScaleX;
const worldH = nodeState.size[1] * uniformWorldH * sizeScaleY;
```

**Modify group size conversion** (lines 229-230):

Before:
```ts
const worldGW = groupState.bounds.w * uniformWorldW;
const worldGH = groupState.bounds.h * uniformWorldH;
```

After:
```ts
const worldGW = groupState.bounds.w * uniformWorldW * sizeScaleX;
const worldGH = groupState.bounds.h * uniformWorldH * sizeScaleY;
```

**Also apply to group padding** (lines 234-238):

Before:
```ts
const worldPadTop = groupState.bounds.padding[0] * uniformWorldH;
const worldPadRight = groupState.bounds.padding[1] * uniformWorldW;
const worldPadBottom = groupState.bounds.padding[2] * uniformWorldH;
const worldPadLeft = groupState.bounds.padding[3] * uniformWorldW;
const worldTitleGap = groupState.bounds.titleGap * uniformWorldH;
```

After:
```ts
const worldPadTop = groupState.bounds.padding[0] * uniformWorldH * sizeScaleY;
const worldPadRight = groupState.bounds.padding[1] * uniformWorldW * sizeScaleX;
const worldPadBottom = groupState.bounds.padding[2] * uniformWorldH * sizeScaleY;
const worldPadLeft = groupState.bounds.padding[3] * uniformWorldW * sizeScaleX;
const worldTitleGap = groupState.bounds.titleGap * uniformWorldH * sizeScaleY;
```

**Apply to edge thickness scaling** (line 207):

Before:
```ts
const thicknessScale = Math.round(uniformWorldW * 10) / 10 || 0.1;
```

After (use corrected scale):
```ts
const thicknessScale = Math.round(uniformWorldW * sizeScaleX * 10) / 10 || 0.1;
```

**Apply to edge path conversion** — edge paths are positions, not sizes, so they should continue using `uniformWorldW`/`uniformWorldH` directly (positions fill the viewport). However, edge thickness (line 335) already uses `thicknessScale` which is corrected above. No change needed for edge path coordinates.

**Apply to edge control points and path commands** — these are position coordinates, not sizes. Positions should NOT be corrected (the diagram should still fill its viewport bounds). Only sizes (node geometry, group geometry, thickness, padding) need correction.

### What NOT to change

- **Node positions** (lines 363-364): Positions fill the viewport — keep `uniformWorldW`/`uniformWorldH`.
- **Group center positions** (lines 225-226): Same rationale — positions fill viewport.
- **Edge path commands** (lines 295-325, 338-339): Position data — no correction.

### Testing

#### File: `packages/diagram/src/elements/diagram/__tests__/diagramRenderer.test.ts`

Add a test case:

```ts
it('square node [4,4] renders as square geometry regardless of contentAspect', () => {
  // Create a state where contentAspect ≠ 1 (e.g., wide diagram → contentAspect > 1)
  const state: DiagramState = {
    ...baseDiagramState,
    contentAspect: 2.0, // diagram is 2× wider than tall
    nodes: [{
      ...baseNodeState,
      id: 'square-test',
      shape: 'rectangle',
      size: [0.2, 0.4], // NVS: dslSize/spanX, dslSize/spanY → 4/20, 4/10 (contentAspect=2)
      position: [0.5, 0.5, 0],
    }],
  };
  // After rendering, the node's world-space width should equal height
  renderer.update(state, group, mockCoords);
  const nodeGroup = /* extract from group */;
  // Verify the box geometry has equal width and height
});
```

Also update the existing test at line 247:
```
'diagram fills view bounds directly — |X| > |Y| on 16:9 viewport regardless of contentAspect'
```
to verify the new behaviour — node sizes are corrected while positions still fill the viewport.

---

## Fix 2: Bridge SceneTheme into DiagramTheme at Compile Time

### Strategy

The diagram handler in `handlers.ts` already has access to `api.context`, which carries the engine's active `SceneTheme`. We need to:
1. Make the engine-level `SceneTheme` available to the compile context
2. Pass it into the resolved `DiagramTheme` before calling `compileDiagram()`
3. This automatically flows through `buildThemeRenderConfig()` to set `fontUrl` and font-size factors

### Implementation

#### Step 2a: Expose SceneTheme in compile context

#### File: `packages/core/src/compiler/sceneTypes.ts`

Add `sceneTheme` to the compile context type:

```ts
import type { SceneTheme } from '../types'; // or wherever SceneTheme is defined

export type CompileContext = {
  sceneIndex: number;
  themeFamily: ThemeFamily;
  themePolarity: 'dark' | 'light';
  sceneTheme?: SceneTheme; // NEW
};
```

#### File: `packages/core/src/compiler/sceneTrackCompiler.ts`

Pass the `sceneTheme` through from options into the compile context (around line 377):

```ts
// Look up sceneTheme from the scene object's userData (set by useSceneEngine)
const sceneTheme = (options as any).sceneTheme ?? null; // or proper typed access
```

Actually — the sceneTheme is stored on the Three.js scene's userData, which is not accessible during compilation (the compiler is pure — no Three.js). Let me trace how to pass it through.

The `useSceneEngine` hook receives `sceneTheme` as an option and stores it on `scene.userData`. But the compiler receives `options` which includes `activeTheme`. We need to add `sceneTheme` to the compiler options.

#### File: `packages/core/src/compiler/sceneTrackCompiler.ts`

In the `CompileSceneTrackOptions` type (or wherever compile options are defined), add:

```ts
sceneTheme?: SceneTheme;
```

In the context construction (around line 377), add:

```ts
sceneTheme: options.sceneTheme ?? undefined,
```

#### File: `packages/core/src/player/useSceneEngine.ts`

Where the compiler is invoked (around line 655), pass through the sceneTheme:

```ts
sceneTheme: options.sceneTheme ?? undefined,
```

#### Step 2b: Expose sceneTheme on CompileApi

#### File: `packages/core/src/compiler/sceneTypes.ts` (or wherever CompileApi/CompileContext is defined)

Ensure `api.context.sceneTheme` is accessible. Check the actual file:

```ts
// In CompileContext:
sceneTheme?: SceneTheme;
```

#### Step 2c: Use sceneTheme in diagram handler

#### File: `packages/diagram/src/compiler/handlers.ts`

In the Diagram `registerNode` handler (around line 292), after resolving the theme:

Before:
```ts
const resolvedTheme = resolveDiagramTheme(
  api.context.themeFamily,
  api.context.themePolarity,
);
```

After:
```ts
const resolvedTheme = resolveDiagramTheme(
  api.context.themeFamily,
  api.context.themePolarity,
);

// Bridge the engine-level SceneTheme into the DiagramTheme so that
// fontUrl, font-size scales, and colorMode flow through to the renderer.
const themedDiagram: DiagramTheme = api.context.sceneTheme
  ? { ...resolvedTheme, sceneTheme: api.context.sceneTheme }
  : resolvedTheme;
```

Then use `themedDiagram` instead of `resolvedTheme` in the `compileDiagram()` call:

```ts
let diagramState = compileDiagram(
  { ...dsl, ... },
  themedDiagram,  // was: resolvedTheme
  onWarn,
);
```

Also update `makeDefaultDiagramState` to use the same pattern if it receives context.

### Testing

#### File: `packages/diagram/src/compiler/__tests__/handlers.test.tsx`

Add test:

```ts
it('bridges sceneTheme.font.webglFontUrl into themeConfig.fontUrl', () => {
  // Set up a compile context with sceneTheme that has a webglFontUrl
  // Compile a diagram
  // Assert that the resulting DiagramState.themeConfig.fontUrl equals the sceneTheme URL
});

it('bridges sceneTheme.fontSize.label into effectiveLabelSizeFactor', () => {
  // Set up compile context with sceneTheme.fontSize.label = 1.2
  // Compile a diagram
  // Assert effectiveLabelSizeFactor = 1.0 * 1.2 = 1.2
});
```

---

## Fix 3: Improve Default Font Size Bases

### Strategy

Independent of the SceneTheme bridging, the default `labelFontSizeBase` and `sublabelFontSizeBase` values are too small for non-rectangular shapes (diamond, hexagon, circle). Bump the base values slightly in all themes for better out-of-the-box readability.

### Implementation

#### All theme files in `packages/diagram/src/elements/diagram/themes/`

Files to update:
- `enterprise.ts`
- `darkGlass.ts`
- `neonCyber.ts`
- `lightMinimal.ts`
- Any other themes with explicit `labelFontSizeBase` / `sublabelFontSizeBase`

Change:
```ts
labelFontSizeBase: 0.28,    →  labelFontSizeBase: 0.32,
sublabelFontSizeBase: 0.18, →  sublabelFontSizeBase: 0.22,
```

This is a ~14% increase for labels and ~22% increase for sublabels. The sublabel increase is proportionally larger because sublabels are the primary readability complaint — they're currently 64% of label size (0.18/0.28), and this brings them to 69% (0.22/0.32).

### Also update `packages/themes/` if these values are duplicated there

Check if `@brewsite/themes` re-exports the same theme objects or has its own copies. If copies, update there too.

### Testing

Update any snapshot tests or explicit font-size assertions in:
- `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`
- `packages/diagram/src/elements/diagram/rendering/__tests__/nodeLabelLayout.test.ts`
- `packages/diagram/src/elements/diagram/themes/__tests__/index.test.ts`

---

## Fix 4: Correct SceneTheme fontSize Scales for Diagram Context

### Problem

The slides `themeCompiler.ts` sets `fontSize.label = 0.875` and `fontSize.caption = 0.75`. These were designed for HTML text scaling, not as multipliers on 3D diagram text. If the SceneTheme bridge (Fix 2) lands without adjusting these, diagram text would shrink by 12.5% (labels) and 25% (sublabels), making things worse.

### Implementation

#### File: `packages/slides/src/compiler/themeCompiler.ts`

Change the fontSize values in the derived SceneTheme:

Before:
```ts
fontSize: {
  heading: 2.4,
  body: 1.0,
  label: 0.875,
  caption: 0.75,
  annotation: 0.7,
},
```

After:
```ts
fontSize: {
  heading: 2.4,
  body: 1.0,
  label: 1.0,
  caption: 1.0,
  annotation: 0.7,
},
```

Setting `label` and `caption` to `1.0` means diagram text is unscaled by default — the diagram theme's own `labelFontSizeBase` and `sublabelFontSizeBase` (from Fix 3) are the sole size authority. This is the correct separation of concerns: diagram themes own diagram text sizing; the SceneTheme provides a host-level override when needed.

### Testing

Update `packages/slides/src/compiler/__tests__/themeCompiler.test.ts` if it asserts specific fontSize values.

---

## Implementation Order

1. **Fix 1** (aspect ratio) — standalone, no cross-package dependencies
2. **Fix 3** (font size bases) — standalone, theme-only change
3. **Fix 4** (slides fontSize scales) — standalone, slides-only change
4. **Fix 2** (SceneTheme bridge) — depends on core compiler type changes

Fixes 1, 3, and 4 can be implemented in parallel. Fix 2 requires core changes first, then diagram handler changes.

## Verification

After all fixes:
1. A `<DiagramNode size={[4, 4]} shape="rectangle">` renders visually square on a 16:9 viewport
2. A `<DiagramNode size={[4, 4]} shape="circle">` remains circular (no regression)
3. Diagram text in slides uses the SceneTheme's webglFontUrl (if provided) instead of Roboto
4. Sublabel text is noticeably more readable on dark backgrounds
5. Existing diagram-heavy example scenes (`diagram/`, `lucid/`) render without visual regressions
6. All tests pass: `pnpm --filter @brewsite/diagram test` and `pnpm --filter @brewsite/core test` and `pnpm --filter @brewsite/slides test`

## Semver Impact

**Minor** — no public API signatures change. The rendering output changes visually (bug fixes), and a new optional field (`sceneTheme`) is added to the compile context. All changes are backward-compatible.
