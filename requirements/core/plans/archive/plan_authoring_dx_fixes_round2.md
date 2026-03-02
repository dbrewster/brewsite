---
title: "Authoring DX Fixes — Round 2 Implementation Plan"
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-02-28
---

# Authoring DX Fixes — Round 2 Implementation Plan

## Overview

This plan covers all 14 issues from `note_authoring_dx_gaps_round2.md` (IDs T4-7 through T6-5) plus the two architect work items (A8 and A9). All issues are in the authoring surface — DSL components, prop types, JSDoc, compile-time validation, and runtime warnings. No Three.js internals, no new interfaces, no data-type changes to `SceneTrack`.

Issues are grouped into implementation tasks. Each task lists exact file paths, the precise edit needed, and the test to verify it (where applicable).

---

## Dependency Map

No cross-task dependencies exist. All tasks are independent and can be implemented in any order. The only intra-task ordering constraint is A8-part-1 (package.json exports) must land before A8-part-2 (the `@see` JSDoc references) can be verified end-to-end.

---

## Task 1 — Core Element JSDoc: Background, Floor, Environment (T4-7, T4-8, T4-9)

**Files modified:**
- `packages/core/src/elements/background/dsl.tsx`
- `packages/core/src/elements/floor/dsl.tsx`
- `packages/core/src/elements/floor/FloorWidget.ts`
- `packages/core/src/elements/environment/dsl.tsx`
- `packages/core/src/elements/environment/EnvironmentWidget.ts` (or wherever `enabled + no source` is compiled — confirm exact file before editing)

### 1a — `<Background>` JSDoc (T4-7)

**File:** `packages/core/src/elements/background/dsl.tsx`

Replace the existing `BackgroundProps` type definition with the following. No logic changes — JSDoc only.

```typescript
/**
 * Props for the <Background> DSL component.
 *
 * <Background> operates in two rendering modes:
 *
 * **3D plane mode** (default when `imageUrl` is set and no CSS override is active):
 * A flat Three.js mesh positioned in world space displays the image.
 * - `position` — world-space XYZ offset of the 3D background plane. Unrelated to CSS.
 * - `opacity`  — controls the 3D mesh material opacity.
 *
 * **CSS fallback mode** (used by the DOM layer independently of the 3D plane):
 * The following props set CSS `background-*` properties on the DOM overlay element.
 * They have no effect on the 3D plane.
 * - `cssPosition` — CSS `background-position` string (e.g. `'center'`, `'top left'`).
 * - `cssSize`     — CSS `background-size` string (e.g. `'cover'`, `'100% 100%'`).
 * - `cssRepeat`   — CSS `background-repeat` string (e.g. `'no-repeat'`, `'repeat-x'`).
 *
 * To offset the image within the frame, use `cssPosition` (CSS mode) or `position`
 * (3D plane world offset). They are independent — not the same prop.
 */
export type BackgroundProps = {
  /** URL of the background image. */
  imageUrl?: string;
  /** Opacity of the 3D background plane mesh [0–1]. */
  opacity?: number;
  /**
   * World-space XYZ position of the 3D background plane.
   * This is a Three.js world offset, not a CSS value.
   * To set CSS background-position use `cssPosition` instead.
   */
  position?: Vec3;
  /**
   * CSS `background-position` string for the DOM fallback layer.
   * Examples: `'center'`, `'top left'`, `'50% 20%'`.
   * This is a CSS value, not a 3D world position.
   * To offset the 3D plane use `position` instead.
   */
  cssPosition?: string;
  /**
   * CSS `background-size` string for the DOM fallback layer.
   * Examples: `'cover'`, `'contain'`, `'100% 100%'`.
   * Typos silently do nothing — check browser DevTools if the image is unexpected.
   */
  cssSize?: string;
  /**
   * CSS `background-repeat` string for the DOM fallback layer.
   * Examples: `'no-repeat'`, `'repeat-x'`, `'repeat'`.
   */
  cssRepeat?: string;
};

/**
 * Sets the scene background image.
 *
 * Operates in two modes simultaneously:
 * - **3D plane** — a textured mesh rendered in the Three.js scene.
 * - **CSS fallback** — a `background-image` CSS rule on the DOM overlay.
 *
 * Props prefixed with `css` control the CSS layer only.
 * `position` and `opacity` control the 3D plane only.
 *
 * @example
 * <Background imageUrl="/bg.jpg" cssPosition="center" cssSize="cover" />
 */
export const Background = (_props: BackgroundProps) => null;
Background.displayName = 'Background';
```

### 1b — `<Floor>` JSDoc + compile-time warning (T4-8)

**File:** `packages/core/src/elements/floor/dsl.tsx`

Add JSDoc to `FloorProps` and `Floor`:

```typescript
/**
 * Props for the <Floor> DSL component.
 *
 * A `<FloorPhysical>` or `<FloorMirror>` child is required for visible output.
 * Without one, `enabled: true` produces either a black plane or nothing visible —
 * no error is thrown but a console.warn is emitted at compile time.
 */
export type FloorProps = {
  // ... existing props unchanged ...
};

/**
 * Renders a 3D floor plane beneath the scene.
 *
 * **Required:** include either `<FloorPhysical>` or `<FloorMirror>` as a child
 * to choose the surface type. Without a surface child, `enabled: true` renders
 * nothing visible and emits a console.warn.
 *
 * @example
 * <Floor enabled>
 *   <FloorPhysical color="#333" roughness={0.8} />
 * </Floor>
 *
 * @example
 * <Floor enabled>
 *   <FloorMirror mirrorOpacity={0.4} />
 * </Floor>
 */
export const Floor = (_props: FloorProps) => null;
Floor.displayName = 'Floor';
```

**File:** `packages/core/src/elements/floor/FloorWidget.ts`

In the `CUSTOM_NODE_HANDLER` implementation, after the surface-resolution loop and before calling `api.setWidgetState`, add the warning guard. The exact insertion point is after line 59 (where `surface ?? base.surface` is evaluated):

```typescript
// Insert after the resolved object is constructed, before api.setWidgetState call:
if (resolved.enabled && resolved.surface === undefined) {
  console.warn(
    '[Floor] enabled: true but no surface child found. ' +
    'Add <FloorPhysical> or <FloorMirror> as a child of <Floor> for visible output.',
  );
}
```

### 1c — `<Environment>` JSDoc + compile-time warning (T4-9)

**File:** `packages/core/src/elements/environment/dsl.tsx`

```typescript
/**
 * Props for the <Environment> DSL component.
 *
 * Requires a source child — `<EnvironmentHdri>`, `<EnvironmentExr>`, or
 * `<EnvironmentCube>` — to activate IBL lighting.
 * Without a source child, `enabled: true` produces flat unlit geometry
 * and a console.warn is emitted at compile time.
 */
export type EnvironmentProps = {
  /** Whether environment-based IBL lighting is active. Default: false */
  enabled?: boolean;
  /** IBL intensity multiplier [0–∞]. Default: 1.0 */
  intensity?: number;
  /**
   * Source child component. Must be one of:
   * - `<EnvironmentHdri>` — equirectangular HDR image (.hdr)
   * - `<EnvironmentExr>` — OpenEXR image (.exr)
   * - `<EnvironmentCube>` — six cubemap face images
   */
  children?: React.ReactNode;
};

/**
 * Enables Image-Based Lighting (IBL) in the scene using an environment map.
 * IBL provides realistic PBR reflections and ambient diffuse lighting for all models.
 *
 * **Required:** include exactly one source child to specify the environment texture:
 * `<EnvironmentHdri>`, `<EnvironmentExr>`, or `<EnvironmentCube>`.
 * Without a source child, `enabled: true` emits a console.warn and does nothing.
 *
 * @example
 * <Environment enabled intensity={0.9}>
 *   <EnvironmentHdri url="/env/studio.hdr" />
 * </Environment>
 */
export const Environment = (_props: EnvironmentProps) => null;
Environment.displayName = 'Environment';

/**
 * Loads an equirectangular HDR image (.hdr) as the scene environment map.
 * Must be a direct child of `<Environment>`.
 *
 * @param background When true, the environment texture is also set as the
 * Three.js scene background (`scene.background`), displaying the HDR image
 * behind all geometry. When false (default), the texture is used only for
 * PBR reflections and IBL — the scene background is not affected.
 */
export type EnvironmentHdriProps = {
  url: string;
  /**
   * When true, the HDR is also set as the Three.js scene.background texture
   * (visible as the sky/backdrop). When false, only PBR/IBL is affected.
   * Default: false.
   */
  background?: boolean;
};

// ... EnvironmentExrProps and EnvironmentCubeProps get the same `background` documentation ...
```

**Finding the warning site:** The `enabled + no source` warning should be emitted from the `EnvironmentWidget`'s `CUSTOM_NODE_HANDLER` (or wherever the compiler resolves the environment element). Locate the handler that processes `<Environment>` nodes. After resolving children, when `state.enabled === true && state.source === undefined`, emit:

```typescript
console.warn(
  '[Environment] enabled: true but no source child found. ' +
  'Add <EnvironmentHdri>, <EnvironmentExr>, or <EnvironmentCube> as a child of <Environment>.',
);
```

**Action required before implementing:** Read `packages/core/src/elements/environment/EnvironmentWidget.ts` to locate the exact handler site. The warning must go at the point where `source` is confirmed to be `undefined` after all children are processed.

---

## Task 2 — Diagram DSL JSDoc and Bug Fixes (T5-1 through T5-6)

**Files modified:**
- `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`
- `packages/diagram/src/elements/diagram/dsl.tsx`
- `packages/diagram/src/elements/diagram/types.ts`
- `packages/diagram/src/elements/diagram/shapes/shapeVariants.ts` (JSDoc only — confirm `DiagramIconVariant` location)
- `packages/diagram/src/elements/diagram/canvas/dsl.tsx`
- `packages/diagram/src/elements/diagram/canvas/compile.ts`

### 2a — `<DiagramEdge>` stub behavior and JSDoc (T5-1)

**File:** `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts` lines 963–966

**Current code (paraphrased):**
```typescript
if (!fromPos || !toPos || !fromSize || !toSize) {
  console.warn(`Diagram routeEdges: missing node(s) for edge ${edge.from} -> ${edge.to}`);
  result.set(id, [fromPos ?? [0, 0, 0], toPos ?? [0, 0, 0]]);
  return;
}
```

**Replace with:**
```typescript
if (!fromPos || !toPos || !fromSize || !toSize) {
  const missing = [
    !fromPos && `'${edge.from}'`,
    !toPos && `'${edge.to}'`,
  ].filter(Boolean).join(' and ');
  console.warn(
    `[DiagramEdge] Edge "${edge.from}" → "${edge.to}": node ID ${missing} not found. ` +
    `Node IDs must exactly match a <DiagramNode id="..."> in the same <Diagram>. ` +
    `The edge will not be rendered.`,
  );
  // Use empty control points (zero-length) so no visible stub is rendered.
  result.set(id, []);
  return;
}
```

Setting `result.set(id, [])` produces an empty control-point array. The edge renderer must handle an empty array gracefully (no tube rendered). **Before implementing:** read `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts` (or equivalent) to confirm that an empty control-point array produces no geometry. If the renderer requires at least two points, use the null-island trick of collapsing to a degenerate segment: `[[0,0,-1000], [0,0,-1000]]` — off-screen and invisible. Prefer the empty-array approach if the renderer supports it.

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` — `DiagramEdgeProps` type

Add to the `from` and `to` JSDoc:

```typescript
/**
 * ID of the source node. Must exactly match a `<DiagramNode id="...">` within
 * the same `<Diagram>` element. A mismatch produces a console.warn and the edge
 * is not rendered (no stub geometry).
 */
from: string;
/**
 * ID of the destination node. Must exactly match a `<DiagramNode id="...">` within
 * the same `<Diagram>` element. A mismatch produces a console.warn and the edge
 * is not rendered (no stub geometry).
 */
to: string;
```

### 2b — `DiagramGroupVariant` JSDoc (T5-2)

**File:** `packages/diagram/src/elements/diagram/types.ts` line 235

Replace the bare type declaration:
```typescript
export type DiagramGroupVariant = 'swimlane' | 'boundary' | 'cluster' | 'container';
```

With:
```typescript
/**
 * Visual variant for a diagram group container.
 *
 * - `'boundary'`  — outlined rectangular region with a visible border frame.
 *                   Nodes inside are visually enclosed by the border.
 * - `'cluster'`   — shaded background fill with no prominent border.
 *                   Suitable for loosely grouping related nodes.
 * - `'swimlane'`  — labeled lane with a header and divider line.
 *                   The `orientation` prop controls horizontal vs vertical lanes.
 *                   Only meaningful for this variant.
 * - `'container'` — borderless region. The border is always suppressed for this
 *                   variant regardless of `borderStyle`. Any `borderStyle` value
 *                   set on a `'container'` group is silently ignored.
 */
export type DiagramGroupVariant = 'swimlane' | 'boundary' | 'cluster' | 'container';
```

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` — `DiagramGroupProps.variant`

Update the existing JSDoc line to:
```typescript
/**
 * Group visual variant. Determines the rendering style of the group boundary.
 * See `DiagramGroupVariant` for descriptions of each value.
 * Note: `'container'` always suppresses the border; setting `borderStyle` on a
 * container group has no effect.
 * Default: 'boundary'
 */
variant?: DiagramGroupVariant;
```

### 2c — `<DiagramNode icon>` namespace list and `custom:` prefix (T5-3)

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` — `DiagramNodeProps.icon` JSDoc

Find the `icon` prop (currently around lines 43–49). Update to:

```typescript
/**
 * SVG icon overlaid on the node's front face.
 *
 * **Available namespace prefixes:**
 * - `ui:*`       — Heroicons (e.g. `'ui:cloud'`, `'ui:server'`)
 * - `aws:*`      — AWS service icons
 * - `gcp:*`      — Google Cloud icons
 * - `azure:*`    — Azure service icons
 * - `tech:*`     — Technology/brand icons (e.g. `'tech:react'`, `'tech:postgres'`)
 * - `security:*` — Security-domain icons
 * - `data:*`     — Data/analytics icons
 * - `network:*`  — Network topology icons
 * - `custom:*`   — Author-registered SVGs (see below)
 *
 * **Registering a custom icon:**
 * Call `registerCustomIcon('myIcon', svgString)` in your widget setup file
 * (the same file where you call `registerDiagramHandlers()`). Then reference it
 * as `icon="custom:myIcon"`. The SVG must be a valid inline SVG string with a
 * `viewBox` attribute. Fill colors are rewritten to the node's `labelColor`.
 *
 * If omitted, no icon is rendered regardless of shape.
 */
icon?: DiagramIconVariant;
```

**Note:** Confirm the name of the custom icon registration function by reading `packages/diagram/src/elements/diagram/shapes/iconRegistry.ts` before implementing. The JSDoc must use the actual API surface name.

**File:** `packages/diagram/src/elements/diagram/shapes/shapeVariants.ts` — `DiagramIconVariant` type

Locate the `` `custom:${string}` `` template literal in `DiagramIconVariant`. Add JSDoc above the type:

```typescript
/**
 * Icon identifier for <DiagramNode icon>.
 * Namespaced string — see <DiagramNode>.icon for the full list of prefixes.
 * The `custom:*` prefix addresses author-registered SVGs; use `registerCustomIcon()`
 * in widget setup to associate a name with an SVG string.
 */
```

### 2d — `<Diagram theme>` and `<DiagramCanvasProps>.theme` import path (T5-4)

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` — `DiagramProps.theme`

Replace the current `theme` prop JSDoc with:

```typescript
/**
 * Visual + behavioral theme for this diagram.
 * Overrides the canvas-level theme (if inside a DiagramCanvas).
 * Falls back to the package default (darkGlassTheme) when absent.
 * Per-node / per-edge props take precedence over all theme values.
 *
 * Built-in themes (import from '@brewsite/diagram'):
 * @example
 * import { darkGlassTheme, lightMinimalTheme, enterpriseTheme, neonCyberTheme } from '@brewsite/diagram';
 * <Diagram theme={lightMinimalTheme}>...</Diagram>
 */
theme?: DiagramTheme;
```

**File:** `packages/diagram/src/elements/diagram/canvas/dsl.tsx` — `DiagramCanvasProps.theme`

Apply the same `@example` block to the `theme` prop on `DiagramCanvasProps`.

### 2e — `<DiagramPipe color>` default constant alignment (T5-5)

**Problem:** `PIPE_DEFAULTS.color` in `compile.ts` is `'#3d5a9a'` but the JSDoc in `canvas/dsl.tsx` documents `Default: '#667788'`.

**Fix — two-part:**

**Part A:** `packages/diagram/src/elements/diagram/canvas/compile.ts`

Extract the color default to a named export so it can be referenced from `dsl.tsx`:

```typescript
/** Default pipe color. Referenced in dsl.tsx JSDoc to prevent future drift. */
export const PIPE_DEFAULT_COLOR = '#3d5a9a';

const PIPE_DEFAULTS = {
  style: 'solid' as DiagramEdgeStyle,
  arrowStart: 'none' as DiagramArrowVariant,
  arrowEnd: 'open' as DiagramArrowVariant,
  color: PIPE_DEFAULT_COLOR,
  thickness: 0.08,
  opacity: 1,
};
```

**Part B:** `packages/diagram/src/elements/diagram/canvas/dsl.tsx` — `DiagramPipeProps.color` JSDoc

Import the constant (type-only import is fine — this is JSDoc, not runtime code):

```typescript
// At top of file, after existing imports:
import { PIPE_DEFAULT_COLOR } from './compile';
```

Then in the JSDoc:

```typescript
/**
 * Pipe color (CSS hex).
 * Default: '#3d5a9a' (see PIPE_DEFAULT_COLOR in compile.ts — kept in sync).
 */
color?: string;
```

**Dependency direction check:** `canvas/dsl.tsx` importing from `canvas/compile.ts` violates the element module pattern (dsl may not import from compile). The correct approach is the reverse: expose the constant from a shared location within the canvas module (a `constants.ts` sibling), or simply correct the JSDoc manually and add a test comment warning. **Use this approach instead:**

Create `packages/diagram/src/elements/diagram/canvas/constants.ts`:
```typescript
// Shared constants for DiagramCanvas compile.ts and dsl.tsx JSDoc alignment.
// This file has no imports. It is safe to import from both layers.
export const PIPE_DEFAULT_COLOR = '#3d5a9a' as const;
```

`compile.ts` imports `PIPE_DEFAULT_COLOR` from `./constants`.
`dsl.tsx` JSDoc references `PIPE_DEFAULT_COLOR` in a comment — **not an import**, just the human-readable default in the JSDoc string. No import in `dsl.tsx`. The canonical source of truth is `constants.ts`; the JSDoc string is updated to `'#3d5a9a'` at the same time.

### 2f — `<Screen rotation>` threshold alignment (T5-6)

**File:** `packages/diagram/src/elements/screen/dsl.tsx` lines 21–25

Update the `rotation` prop JSDoc so the threshold and prose are consistent:

```typescript
/**
 * World-space rotation in radians [x, y, z].
 * Keep near [0, 0, 0] — the iframe is a flat DOM rect and cannot tilt.
 * Values above ~0.15 rad will visibly misalign the iframe with the bezel.
 * compile.ts emits console.warn if |rotation[i]| > 0.15 radians.
 * Default: [0, 0, 0]
 */
rotation?: [number, number, number];
```

The actual compile threshold in `compile.ts` is `0.15` — change the prose from `~0.1` to `~0.15` to match. Do **not** change the compile threshold value — `0.15` is intentional.

**Render-time warning (additional fix):** The PM also asks for a render-time warning so CI/SSR builds don't hide the issue. Locate `packages/diagram/src/elements/screen/render.ts` (or the `ScreenWidget.ts` `apply` method). In `apply()`, when `state.rotation` has a component exceeding `0.15`, emit the same `console.warn`. This means the warning fires in both compile passes and every render frame until the rotation is fixed. Cap it with a one-time guard:

In `ScreenWidget.ts`:
```typescript
private _rotationWarned = false;

apply(state: ScreenState, context: WidgetRenderContext): void {
  const r = state.rotation;
  if (!this._rotationWarned && (Math.abs(r[0]) > 0.15 || Math.abs(r[1]) > 0.15 || Math.abs(r[2]) > 0.15)) {
    console.warn(
      `[Screen] rotation [${r.join(', ')}] exceeds 0.15 rad — ` +
      'the iframe overlay will visibly misalign with the bezel. Use <ImagePanel> for tilted content.',
    );
    this._rotationWarned = true;
  }
  // ... rest of apply logic unchanged ...
}
```

Reset `this._rotationWarned = false` in `initialize()` so new scenes re-emit if the scene changes.

---

## Task 3 — Label System JSDoc and `'target-color'` (T6-1, A9)

**Files modified:**
- `packages/core/src/labels/dsl.tsx`
- `packages/core/src/labels/types.ts`

### 3a — `<Label>` nesting requirement JSDoc (T6-1 part 1)

**File:** `packages/core/src/labels/dsl.tsx`

The `<Label>` component already throws when used outside `<BodyPart>` or `<Subpart>`. Add JSDoc:

```typescript
/**
 * Attaches a 3D-tracked label to a model bone or body part.
 *
 * **Nesting required:** `<Label>` must be a child of `<BodyPart>` or `<Subpart>`.
 * The `targetPartId` is resolved automatically from the parent element — do not
 * set it manually (it is not a prop on `LabelProps`).
 *
 * Placing `<Label>` at the scene top level throws a runtime error.
 *
 * @example
 * <BodyPart id="bone_head">
 *   <Label id="head-label" text="Head" />
 * </BodyPart>
 */
export const Label = (_props: LabelProps) => null;
```

### 3b — `'target-color'` in `LabelStyle` (T6-1 part 2, A9)

**File:** `packages/core/src/labels/types.ts`

**Architect decision (A9):** Use a string union `string | 'target-color'` for discoverability. TypeScript 5 with strict mode: `string | 'target-color'` preserves both the general `string` type and the specific literal in autocomplete. The literal is still subsumed by `string` at the type system level, but IDEs (VSCode, WebStorm) surface the literal in completion lists.

Replace `LabelStyle`:

```typescript
/**
 * Visual style options for a 3D-tracked label.
 */
export type LabelStyle = {
  /**
   * Label text color (CSS hex or named color).
   *
   * Special value: `'target-color'` — reads the bone's Three.js material color
   * at runtime and uses it as the label text color. This makes the label color
   * track the highlighted/selected state of its target bone automatically.
   *
   * Default: theme-determined (typically white).
   */
  color?: string | 'target-color';

  /**
   * Connector line color (CSS hex or named color).
   *
   * Special value: `'target-color'` — same behavior as `color: 'target-color'`:
   * reads the bone's material color at runtime for the line.
   *
   * Default: same as `color`.
   */
  lineColor?: string | 'target-color';

  /** Label font size (number in px, or CSS string). Default: 14 */
  fontSize?: number | string;

  /** Connector line opacity [0–1]. Default: 1 */
  lineOpacity?: number;

  /** Label text opacity [0–1]. Default: 1 */
  labelOpacity?: number;

  /** Connector line thickness in px. Default: 1 */
  lineThickness?: number;
};
```

**No change to `types.ts` shape of `LabelDefinition` or `LabelResolved`** — `targetPartId` correctly lives only on `LabelResolved`. The JSDoc fix for T6-1 part 1 is in `dsl.tsx` only, not `types.ts`.

**Test:** There is no runtime logic change here. The type change (`string | 'target-color'`) is backward-compatible — existing `color: '#ffffff'` props remain valid. No test required beyond `pnpm --filter @brewsite/core typecheck`.

---

## Task 4 — `hud/animejs` Subpath Export (T6-2, A8)

**Files modified:**
- `packages/core/package.json`
- `packages/core/vite.config.ts`
- `packages/core/tsconfig.build.json` (confirm include coverage — may not need editing)
- `packages/core/src/hud/index.ts`
- `packages/core/src/compiler/blocks/hudBlocks.tsx`

### 4a — Architect resolution for A8

**`animejs` dependency classification:**

`animejs` is currently a **direct dependency**. The correct classification is **optional peer dependency**, because:

- The majority of `@brewsite/core` consumers will use the HUD animation presets and will already have `animejs` in their own `package.json`. Bundling it as a direct dep risks two copies of `animejs` in the consumer's final bundle (one from core, one from the consumer's own install).
- The minority who do not use HUD animations should not be forced to install `animejs` at all. An optional peer dep imposes no penalty on them — no install warning, no bundle cost.
- A plain required `peerDependency` has no upside over optional here: it forces non-users to install, gives no benefit over optional for the users who do install it.

**Blocking prerequisite — grep check (must run before implementing):**

```bash
grep -r "from 'animejs'" packages/core/src --include="*.ts" --include="*.tsx" \
  | grep -v "hud/animejs/"
```

If this grep returns any matches, `animejs` is used outside the opt-in sub-module and cannot be made optional — those usages would throw at runtime for consumers who do not install it. In that case: keep as a direct dependency and bundle `animejs` into the `hud/animejs` chunk. Do not proceed with the peer-dep migration.

If the grep returns nothing, proceed with the full migration below.

**`package.json` changes (assuming grep returns nothing):**

Remove `animejs` from `dependencies`. Add to `peerDependencies` and `peerDependenciesMeta`:

```json
{
  "dependencies": {
    "camera-controls": "^3.1.2",
    "meshoptimizer": "^0.23.0",
    "react-router": "^7.13.0"
  },
  "peerDependencies": {
    "animejs": "^3.2.2",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "three": "^0.183.1"
  },
  "peerDependenciesMeta": {
    "animejs": {
      "optional": true
    }
  }
}
```

**Build pipeline — subpath output:**

`packages/core` uses a single-entry `vite build`. With a single entry point (`src/index.ts`), the output is one file: `dist/index.js`. **`dist/hud/animejs/index.js` will not exist** after the current build — the subpath export in `package.json` would point to a file that does not exist.

Two files require changes to produce the subpath chunk:

1. **`packages/core/vite.config.ts`** — change `build.lib.entry` from a single string to an object with two entry points:

```typescript
build: {
  lib: {
    entry: {
      index: 'src/index.ts',
      'hud/animejs': 'src/hud/animejs/index.ts',
    },
    formats: ['es'],
  },
  rollupOptions: {
    external: [
      'react', 'react-dom', 'three',
      'animejs',           // externalize — it is an optional peer dep
      'camera-controls',  // confirm whether this is already external
    ],
  },
}
```

The `animejs` external declaration is what makes the optional peer dep safe: the `dist/hud/animejs/index.js` chunk will contain `import 'animejs'` resolved by the consumer's bundler, not a bundled copy.

2. **`packages/core/tsconfig.build.json`** — confirm `src/hud/animejs/index.ts` is included in the compilation. If `include` is set to `["src/index.ts"]` only, add `"src/hud/animejs/**"` or widen to `["src/**"]`. Read the file before editing.

**Validation:** After the Vite config change, run `pnpm --filter @brewsite/core build` and confirm both `dist/index.js` and `dist/hud/animejs/index.js` exist. Then run `pnpm --filter @brewsite/examples typecheck` to confirm the subpath resolves without errors.

### 4b — `package.json` exports map

**File:** `packages/core/package.json`

Add the subpath entry to `"exports"`. The dependency and Vite config changes are in 4a above — this is the exports map entry only:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./hud/animejs": {
      "types": "./dist/hud/animejs/index.d.ts",
      "import": "./dist/hud/animejs/index.js",
      "default": "./dist/hud/animejs/index.js"
    }
  }
}
```

This entry is only valid after the Vite config in 4a produces `dist/hud/animejs/index.js`. Do not merge this change before confirming the build output exists.

### 4c — `@see` references (T6-2)

**File:** `packages/core/src/compiler/blocks/hudBlocks.tsx`

Locate the `HudItem` component definition. Add to its JSDoc:

```typescript
/**
 * ...existing JSDoc...
 *
 * @see {@link @brewsite/core/hud/animejs} for scroll-driven transition presets
 * (Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff) to animate children
 * as HudItem enters and exits the viewport.
 *
 * @example
 * import { Fade } from '@brewsite/core/hud/animejs';
 * <HudItem id="caption"><Fade><p>Text</p></Fade></HudItem>
 */
```

**File:** `packages/core/src/hud/index.ts`

Add a comment at the top of the barrel:

```typescript
// Public exports for the HUD module.
// For scroll-driven transition presets (Fade, SlideUp, etc.), import from
// '@brewsite/core/hud/animejs' — that sub-module is an explicit opt-in.
```

---

## Task 5 — animejs Preset Phase Awareness and Duration Documentation (T6-3)

**File modified:**
- `packages/core/src/hud/animejs/transitions.tsx`

### 5a — `Fade` phase-aware behavior JSDoc

Update the `Fade` component JSDoc:

```typescript
/**
 * Fades from opacity 0 → 1 across the full sceneProgress range.
 *
 * **Phase-aware:** This is the only preset that reads `useHudPhase()` and
 * automatically reverses in the exit phase. When the `<HudItem>` is in
 * `phase === 'exit'`, `Fade` plays a fade-out (opacity 1 → 0) instead of a
 * fade-in. You do not need to configure this manually.
 *
 * Other enter presets (MidFade, SlideUp, SlideDown, ScrollOn) do NOT reverse
 * in the exit phase — they are enter-only. For exit animations use `<ScrollOff>`
 * (exit-phase, not phase-context-aware) or `<Fade>` (phase-aware, auto-reverses).
 *
 * Default `duration`: 600ms.
 *
 * @example
 * <HudItem id="label"><Fade><span>Caption</span></Fade></HudItem>
 */
```

### 5b — Document phase behavior on all other presets

`ScrollOff` is **not** an enter-only preset — it starts visible and animates out. It and the enter presets require different JSDoc.

**For `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn` — enter-phase presets:**

```typescript
/**
 * ...existing description...
 *
 * **Enter-only:** Does not check `useHudPhase()` and will not reverse in the exit
 * phase. Use inside enter-phase `<HudItem>` sections only.
 * For exit-phase animation, use `<ScrollOff>` or `<Fade>`.
 *
 * Default `duration`: [600 | 1000]ms.
 */
```

**For `ScrollOff` — exit-phase preset:**

```typescript
/**
 * ...existing description...
 *
 * **Exit-phase preset:** Starts visible and animates out. Designed for use inside
 * exit-phase `<HudItem>` sections. Does not check `useHudPhase()` — it is not
 * phase-context-aware, it is simply designed for exit scenarios by construction
 * (no initial `opacity: 0`). Pair with an enter preset (`ScrollOn`, `SlideUp`, etc.)
 * on the corresponding enter-phase `<HudItem>`.
 *
 * Default `duration`: 1000ms.
 */
```

Per-component default durations to document explicitly:

| Component | Phase role | Default duration |
|-----------|-----------|-----------------|
| `Fade`    | Phase-aware (auto-reverses) | 600ms |
| `MidFade` | Enter-only | 1000ms |
| `SlideUp` | Enter-only | 600ms |
| `SlideDown` | Enter-only | 600ms |
| `ScrollOn` | Enter-only | 1000ms |
| `ScrollOff` | Exit-phase | 1000ms |

Update the shared `TransitionProps.duration` JSDoc:

```typescript
/**
 * Total scrub duration in ms. sceneProgress 0→1 maps to 0→duration.
 * Default varies per preset:
 * - Fade, SlideUp, SlideDown: 600ms
 * - MidFade, ScrollOn, ScrollOff: 1000ms
 */
duration?: number;
```

---

## Task 6 — Camera Interaction Config JSDoc (T6-4)

**File modified:**
- `packages/core/src/elements/camera/types.ts`

### 6a — `TrackpadCameraConfig.enabled` JSDoc

The current JSDoc on `enabled` is: `"Whether interactive control is active for this scene. Default: false"`.

Replace with:

```typescript
/**
 * Whether interactive camera control is active for this scene.
 *
 * **Setting this to `false` disables all interaction** — `rotate`, `pan`, `zoom`,
 * and `wheelZoom` configurations are ignored when `enabled` is false.
 * To enable interaction with specific constraints, set `enabled: true` and then
 * configure the individual axis options.
 *
 * @default false
 */
enabled: boolean;
```

---

## Task 7 — Compiler Error Messages (T6-5)

**File modified:**
- `packages/core/src/compiler/sceneDslCompiler.ts`

### 7a — Improve two throw messages

**Current (lines ~251–259):**
```typescript
throw new Error('Scene DSL must return a JSX element.');
// ...
throw new Error('Scene DSL root must be <Scene>.');
```

**Replace with:**

```typescript
// First throw:
throw new Error(
  `Scene DSL must return a JSX element (got: ${typeof tree}). ` +
  'Ensure getFrame() has a return statement returning <Scene key="...">.',
);

// Second throw — need the element type name:
const rootType = (treeEl.type as { displayName?: string; name?: string });
const elementTypeName = rootType.displayName ?? rootType.name ?? String(treeEl.type);
throw new Error(
  `Scene DSL root must be <Scene> (got: <${elementTypeName}>). ` +
  'Wrap your content in <Scene key="...">.',
);
```

**Note:** The `elementTypeName` extraction must happen before the `throw`. Read lines 254–260 of `sceneDslCompiler.ts` to verify the exact variable names (`treeEl`, `handler`) match before writing the edit.

**Current (sceneTrackCompiler.ts line ~129):**
```typescript
throw new Error(
  `Scene at index ${i} getFrame() must return a JSX element or SceneFrame (got: ${typeof raw})`,
);
```

Add an actionable suggestion:
```typescript
throw new Error(
  `Scene at index ${i} getFrame() must return a JSX element or SceneFrame (got: ${typeof raw}). ` +
  'Ensure getFrame() returns <Scene key="..."> or a pre-compiled SceneFrame object.',
);
```

---

## Testing Strategy

All changes in this plan are JSDoc, warning additions, and error message improvements. The testing strategy is:

### Type-checking (mandatory for all tasks)
```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/diagram typecheck
```

### Unit tests for new behavior

**Task 1 (Floor warning, T4-8):** Add a test in `packages/core/src/elements/floor/__tests__/FloorWidget.test.ts` (create if not present):
```typescript
it('emits console.warn when enabled with no surface child', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // Invoke the CUSTOM_NODE_HANDLER with a node that has enabled=true and no children
  // Assert warnSpy was called with a message including '[Floor]'
  warnSpy.mockRestore();
});
```

**Task 1 (Environment warning, T4-9):** Similarly add a test in `packages/core/src/elements/environment/__tests__/EnvironmentWidget.test.ts`.

**Task 2a (edge stub, T5-1):** Add/update `packages/diagram/src/elements/diagram/__tests__/edgeRouter.test.ts` to assert:
- An edge with an unresolved `from` ID produces an empty (or degenerate) control-point array, not `[[0,0,0], ...]`.
- A `console.warn` is emitted with the missing node ID name included.

**Task 7 (compiler errors, T6-5):** Add or update `packages/core/src/compiler/__tests__/sceneDslCompiler.test.ts`:
```typescript
it('throws with type info when getFrame returns a non-JSX value', () => {
  // Pass a number as tree — expect the error message to include 'got: number'
});
it('throws with element name when root is not <Scene>', () => {
  // Pass a <div> element — expect error to include 'got: <div>'
});
```

**Task 4 (subpath export, T6-2):** Manual verification: after build, confirm the export path resolves correctly. Add to `pnpm --filter @brewsite/examples typecheck` as a canary (examples already import from `@brewsite/core`; add a test import of `@brewsite/core/hud/animejs` in one example file to confirm the path).

### No regression tests needed for
- JSDoc-only changes (Tasks 3b, 4c, 5, 6, 2b, 2c, 2d, 2f) — these have zero runtime impact.
- `LabelStyle` union change (Task 3b) — backward-compatible type widening. Existing `string` values remain valid.

---

## Implementation Order

Suggested order (lower dependency risk first):

1. **Task 7** (compiler errors) — pure string change, zero risk, immediate DX win
2. **Task 6** (camera JSDoc) — pure JSDoc
3. **Task 5** (animejs JSDoc) — pure JSDoc
4. **Task 3** (label JSDoc + union type) — small type change + JSDoc
5. **Task 1** (Background/Floor/Environment) — JSDoc + two warning additions
6. **Task 2b–2f** (diagram JSDoc + constant alignment) — JSDoc + one small refactor
7. **Task 4** (subpath export) — package.json change, requires build verification
8. **Task 2a** (edge stub behavior) — logic change, requires EdgeRenderer read first

---

## Out of Scope

The following items are noted in the PM note but deferred:

- **`animejs` peerDependency migration (A8):** `animejs` is currently a direct dependency and is used beyond the opt-in sub-module. Converting to peerDependency would require auditing all non-animejs-preset usages in the HUD system. Deferred to a dedicated dependency-cleanup pass.
- **Render-time `<Screen>` warning (T5-6 secondary):** The `ScreenWidget.apply()` one-time guard is listed as an additional fix. If timeline is tight, the JSDoc alignment alone (prose `~0.15` to match the `0.15` compile threshold) closes the documentation inconsistency. The render-time guard is a nice-to-have.
- **`DiagramCanvas id` compile-time validation (T3-5):** Mentioned in round 1 notes. Not part of round 2 scope.

---

## File Change Summary

| File | Change type | Task |
|---|---|---|
| `packages/core/src/elements/background/dsl.tsx` | JSDoc rewrite | 1a |
| `packages/core/src/elements/floor/dsl.tsx` | JSDoc addition | 1b |
| `packages/core/src/elements/floor/FloorWidget.ts` | Warning addition | 1b |
| `packages/core/src/elements/environment/dsl.tsx` | JSDoc rewrite | 1c |
| `packages/core/src/elements/environment/EnvironmentWidget.ts` | Warning addition | 1c |
| `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts` | Logic + message fix | 2a |
| `packages/diagram/src/elements/diagram/dsl.tsx` | JSDoc additions (multiple) | 2a, 2b, 2d |
| `packages/diagram/src/elements/diagram/types.ts` | JSDoc addition | 2b |
| `packages/diagram/src/elements/diagram/shapes/shapeVariants.ts` | JSDoc addition | 2c |
| `packages/diagram/src/elements/diagram/canvas/dsl.tsx` | JSDoc update, color fix | 2d, 2e |
| `packages/diagram/src/elements/diagram/canvas/compile.ts` | Extract constant | 2e |
| `packages/diagram/src/elements/diagram/canvas/constants.ts` | **New file** (shared constant) | 2e |
| `packages/diagram/src/elements/screen/dsl.tsx` | JSDoc threshold alignment | 2f |
| `packages/diagram/src/elements/screen/ScreenWidget.ts` | One-time render warn (optional) | 2f |
| `packages/core/src/labels/dsl.tsx` | JSDoc addition | 3a |
| `packages/core/src/labels/types.ts` | Type union + JSDoc | 3b |
| `packages/core/package.json` | Move animejs to optional peerDep; add subpath export | 4a, 4b |
| `packages/core/vite.config.ts` | Add second library entry point; externalize animejs | 4a |
| `packages/core/tsconfig.build.json` | Confirm subpath is in compilation scope | 4a |
| `packages/core/src/hud/index.ts` | Comment | 4c |
| `packages/core/src/compiler/blocks/hudBlocks.tsx` | JSDoc `@see` | 4c |
| `packages/core/src/hud/animejs/transitions.tsx` | JSDoc additions | 5a, 5b |
| `packages/core/src/elements/camera/types.ts` | JSDoc update | 6a |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Error message improvement | 7a |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Error message improvement | 7a |