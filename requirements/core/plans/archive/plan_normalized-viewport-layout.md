---
title: "Normalized Viewport Layout System — Implementation Plan"
doc_type: plan
owner: Toolkit Architecture
status: complete
updated: 2026-03-04
reviewed_by: PM-2
review_status: approved
---

# Normalized Viewport Layout System — Implementation Plan

## Preamble

This plan is the authoritative specification for implementing the Normalized Viewport Space (NVS) system across all four published BrewSite packages. A developer reading only this plan (not the note) must be able to implement correctly. Every file is described with exact paths, exact TypeScript signatures, and exact descriptions of what is added and removed.

**No backward compatibility.** Every old API that is replaced is removed. No deprecated shims. No migration helpers.

---

## Section 1: Overview and Dependency Order

### What This Feature Delivers

The NVS system establishes a unified 2D coordinate system (normalized 0–1 ratios over the AR-locked container) that governs the placement of all overlay content — DOM text panels, chart tooltip projections, label projections, diagram raycast hit testing. Before this change, these systems each used independent coordinate strategies with no shared contract.

Concretely:
- `EngineARContainer` — new React component that wraps `SceneCanvas` + `EngineOverlayHost`. Maintains the fixed AR, injects `--scene-scale` CSS variable, handles four scale modes.
- `TextBox` element — new first-class DSL element for overlay content at a declared NVS position. Replaces the raw JSX children pattern on `<Scene>`.
- `NVSRect` / `NVSPosition` / `INVSBounded` — new types published from `@brewsite/core`.
- `DiagramCanvasWidget`, `ChartWidget`, `ModelWidget` — all implement `INVSBounded` and adjust raycasting/projection to their NVS sub-region.
- `LabelPositioner.setContainerSize()` — signature change to accept optional `nvsBounds`.
- `ChartTooltipOverlay` — `camera` and `domElement` props removed; `nvsBounds` required.

### Cross-Package Dependency Order

All packages import NVS types from `@brewsite/core`. The implementation must proceed in this exact order:

**Phase A — `@brewsite/core` foundational work.** Must land before any downstream package work. Subdivided into three work streams:
- A1: Layout types (`NVSRect`, `NVSPosition`, `INVSBounded`) + `EngineARContainer` component. No dependencies.
- A2: `TextBox` element module. Depends on A1 (needs `NVSRect` type, must follow element module pattern).
- A3: `EngineOverlayHost` update + `sceneRootHandler` raw-child removal. Depends on the VariableStore key scheme, which is defined in A2.

**Phases B, C, D — downstream packages.** All depend on A1 only (need `NVSRect` and `INVSBounded`). B, C, and D can run in parallel once A1 is merged.

**Phase E — app scene updates.** Depends on A1 + A2 + A3 + B + C + D. Scene author work only; no library code touched.

### Optimal Parallel Schedule

```
A1 (layout types + EngineARContainer)
  └─> A2 (TextBox element) ──> A3 (EngineOverlayHost + sceneRootHandler)
  └─> B  (diagram NVS)         [parallel with A2, A3]
  └─> C  (charts NVS)          [parallel with A2, A3, B]
  └─> D  (model NVS)           [parallel with A2, A3, B, C]
                                    └─> E (app scenes)
```

A2 and A3 are sequential (A3 reads the VariableStore key format defined in A2). B, C, and D only need `NVSRect` and `INVSBounded` from A1 — they can all start the moment A1 is merged, in parallel with A2 and A3. E starts only after all five library streams are complete.

This yields a maximum of five concurrent developers: one on A1, one on A2, one on B, one on C, one on D. A3 and E are sequential tail work.

---

## Section 2: Phase A — @brewsite/core Foundational Types and Layout Machinery

### Work Stream A1: Layout Types and EngineARContainer

**Owner: one developer, `@brewsite/core` only.**
**No dependencies — starts immediately.**

This stream creates the foundational NVS types and the `EngineARContainer` component. It does not touch any existing files except `packages/core/src/player/index.ts` and `packages/core/src/index.ts` (additions only).

---

#### File: `packages/core/src/layout/types.ts` — NEW

Single responsibility: NVS type contracts and the `INVSBounded` widget interface.

```typescript
// Normalized Viewport Space (NVS) type contracts.
// No runtime imports, no Three.js, no React.

/**
 * A rectangle in Normalized Viewport Space.
 * All values are ratios in [0, 1] relative to the AR-locked container.
 *
 * Origin is the top-left corner of the container.
 * x=0 is the left edge; x=1 is the right edge.
 * y=0 is the top edge; y=1 is the bottom edge.
 *
 * A fullscreen rect is { x: 0, y: 0, w: 1, h: 1 }.
 */
export interface NVSRect {
  /** Left edge in [0, 1]. */
  x: number;
  /** Top edge in [0, 1]. */
  y: number;
  /** Width in [0, 1]. */
  w: number;
  /** Height in [0, 1]. */
  h: number;
}

/**
 * A point in Normalized Viewport Space.
 * x=0 is the left edge; x=1 is the right edge.
 * y=0 is the top edge; y=1 is the bottom edge.
 */
export interface NVSPosition {
  x: number;
  y: number;
}

/**
 * Widget SDK interface for widgets that declare an NVS bounds.
 * Implemented by DiagramCanvasWidget, ChartWidget, and ModelWidget.
 *
 * The engine uses this to:
 * - Auto-frame Three.js cameras to fill the declared NVS region
 * - Allow authoring tools to query what occupies a given screen region
 * - Detect NVS bound conflicts at development time
 *
 * `nvsBounds` must return a non-nullable NVSRect. Widgets that have not
 * yet received a compiled state should return the fullscreen default
 * { x: 0, y: 0, w: 1, h: 1 }.
 */
export interface INVSBounded {
  readonly nvsBounds: NVSRect;
}
```

**Exports:** `NVSRect`, `NVSPosition`, `INVSBounded`.
**Forbidden imports:** Three.js, React, any other package.

---

#### File: `packages/core/src/layout/index.ts` — NEW

Single responsibility: barrel re-export for `packages/core/src/layout/`.

```typescript
// Barrel export for the layout module.
export type { NVSRect, NVSPosition, INVSBounded } from './types';
```

This file grows as `TextBox` is added in A2. At A1 completion it exports only the three types above.

---

#### File: `packages/core/src/player/EngineARContainer.tsx` — NEW

Single responsibility: AR-locked container with scale mode handling and `--scene-scale` injection.

**Props interface:**

```typescript
import type { ReactNode, ReactElement, CSSProperties } from 'react';
import type { NVSRect } from '../layout/types';

export type ScaleMode = 'fit-width' | 'fit-height' | 'contain' | 'cover';

export type EngineARContainerProps = {
  /**
   * Fixed aspect ratio for the engine container.
   * All 3D content and NVS-positioned elements are authored for this AR.
   * Default: 16/9
   */
  aspectRatio?: number;

  /**
   * The pixel width at which --scene-scale = 1.0.
   * TextBox content authored in reference-resolution pixels scales proportionally
   * from this baseline. Default: 1920
   */
  referenceWidth?: number;

  /**
   * How the fixed-AR container fits inside the available parent space.
   *
   * 'fit-width'  — Width fills the parent; height is derived from AR. Default.
   * 'fit-height' — Height fills the parent; width is derived from AR.
   * 'contain'    — Both dimensions fit; the shorter axis letterboxes.
   * 'cover'      — Both dimensions fill; content that exceeds bounds is clipped.
   *
   * Default: 'fit-width'
   */
  scaleMode?: ScaleMode;

  /** className applied to the AR-locked container div. */
  className?: string;

  /**
   * style applied to the outer wrapper div (not the AR container).
   * Use to set the background color of letterbox areas, for example.
   */
  style?: CSSProperties;

  /** All children — SceneCanvas, EngineOverlayHost, EngineInputRegion, etc. */
  children: ReactNode;
};
```

**Context:**

```typescript
// Exported so children can read container dimensions if needed.
export type EngineARContainerContextValue = {
  containerWidth: number;
  containerHeight: number;
  referenceWidth: number;
  scaleMode: ScaleMode;
};

export const EngineARContainerContext =
  React.createContext<EngineARContainerContextValue>({
    containerWidth: 0,
    containerHeight: 0,
    referenceWidth: 1920,
    scaleMode: 'fit-width',
  });
```

**Implementation specification:**

```typescript
export const EngineARContainer = ({
  aspectRatio = 16 / 9,
  referenceWidth = 1920,
  scaleMode = 'fit-width',
  className,
  style,
  children,
}: EngineARContainerProps): ReactElement => {
  const outerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ containerWidth: 0, containerHeight: 0 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDims({ containerWidth: width, containerHeight: height });
      // Compute and inject --scene-scale immediately on every resize.
      const scale = computeContainerDims(width, height, aspectRatio, scaleMode, referenceWidth);
      el.style.setProperty('--scene-scale', String(scale.sceneScale));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [aspectRatio, scaleMode, referenceWidth]);

  const containerStyle = computeContainerStyle(
    dims.containerWidth,
    dims.containerHeight,
    aspectRatio,
    scaleMode,
  );

  const contextValue: EngineARContainerContextValue = {
    containerWidth: dims.containerWidth,
    containerHeight: dims.containerHeight,
    referenceWidth,
    scaleMode,
  };

  return (
    <div ref={outerRef} style={{ position: 'relative', ...style }}>
      <EngineARContainerContext.Provider value={contextValue}>
        <div className={className} style={containerStyle}>
          {children}
        </div>
      </EngineARContainerContext.Provider>
    </div>
  );
};
```

**`computeContainerDims` helper (pure function, exported for testing):**

```typescript
/**
 * Computes the --scene-scale value and container pixel dimensions
 * for the given outer dimensions, AR, scale mode, and reference width.
 * Pure function — no DOM reads.
 */
export function computeContainerDims(
  outerWidth: number,
  outerHeight: number,
  aspectRatio: number,
  scaleMode: ScaleMode,
  referenceWidth: number,
): { containerW: number; containerH: number; sceneScale: number } {
  if (outerWidth <= 0 || outerHeight <= 0) {
    return { containerW: 0, containerH: 0, sceneScale: 0 };
  }
  let containerW: number;
  let containerH: number;

  switch (scaleMode) {
    case 'fit-width':
      containerW = outerWidth;
      containerH = outerWidth / aspectRatio;
      break;
    case 'fit-height':
      containerH = outerHeight;
      containerW = outerHeight * aspectRatio;
      break;
    case 'contain': {
      const byWidth = outerWidth / aspectRatio;
      if (byWidth <= outerHeight) {
        containerW = outerWidth;
        containerH = byWidth;
      } else {
        containerH = outerHeight;
        containerW = outerHeight * aspectRatio;
      }
      break;
    }
    case 'cover': {
      const byWidth = outerWidth / aspectRatio;
      if (byWidth >= outerHeight) {
        containerW = outerWidth;
        containerH = byWidth;
      } else {
        containerH = outerHeight;
        containerW = outerHeight * aspectRatio;
      }
      break;
    }
    default: {
      containerW = outerWidth;
      containerH = outerWidth / aspectRatio;
    }
  }

  const sceneScale = containerW / referenceWidth;
  return { containerW, containerH, sceneScale };
}
```

**`computeContainerStyle` helper (pure function):**

```typescript
/**
 * Returns the CSS style for the inner AR-locked div based on scale mode.
 */
function computeContainerStyle(
  outerWidth: number,
  outerHeight: number,
  aspectRatio: number,
  scaleMode: ScaleMode,
): CSSProperties {
  const { containerW, containerH } = computeContainerDims(
    outerWidth, outerHeight, aspectRatio, scaleMode, 1920, // referenceWidth irrelevant for style
  );

  const baseStyle: CSSProperties = {
    position: 'relative',
    overflow: scaleMode === 'cover' ? 'hidden' : 'visible',
    width: containerW > 0 ? `${containerW}px` : '100%',
    height: containerH > 0 ? `${containerH}px` : 'auto',
  };

  // For contain/fit-height: center the AR container inside the outer div.
  if (scaleMode === 'contain' || scaleMode === 'fit-height') {
    return {
      ...baseStyle,
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return baseStyle;
}
```

**Note on `computeContainerStyle` and the outer div:** The outer `<div ref={outerRef}>` always has `position: relative` and fills its parent (no explicit width/height — relies on parent). The inner AR-locked div is sized by `computeContainerStyle`. For `fit-width` and `cover`, it flows naturally. For `contain` and `fit-height`, it is centered with `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)`.

**`--scene-scale` is the only CSS custom property set by this component.** It is set on the outerRef element so it cascades to all children including the AR-locked div. Value: `containerW / referenceWidth`. At `referenceWidth = 1920px`, scale = 1.0. At 960px width, scale = 0.5.

**Imports this file may use:**
- `react` (hooks, types, createContext)
- `../layout/types` (for `NVSRect` in context if needed — note: the context does not expose NVSRect directly, but the import is permitted)

**Forbidden imports:** Three.js, `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, compiler internals.

---

#### File: `packages/core/src/player/index.ts` — MODIFIED

Add the following exports (additions only, no removals):

```typescript
export { EngineARContainer } from './EngineARContainer';
export type { EngineARContainerProps, ScaleMode, EngineARContainerContextValue } from './EngineARContainer';
export { EngineARContainerContext } from './EngineARContainer';
export { computeContainerDims } from './EngineARContainer';
```

Insert after the existing `EngineOverlayHost` export line.

---

#### File: `packages/core/src/index.ts` — MODIFIED

Add a new export line after the existing `export * from './elements'` line:

```typescript
export * from './layout';
```

This ensures `NVSRect`, `NVSPosition`, and `INVSBounded` are exported from `@brewsite/core`'s public surface.

---

#### File: `packages/core/src/widget/types.ts` — MODIFIED

Add `INVSBounded` to the re-export from `./layout/types`. This allows widget implementors in downstream packages to import `INVSBounded` from `@brewsite/core` (which resolves through `widget/` just as other widget interfaces do).

Add to the bottom of `packages/core/src/widget/index.ts`:

```typescript
export type { INVSBounded, NVSRect, NVSPosition } from '../layout/types';
```

This is an addition to `packages/core/src/widget/index.ts` — not `types.ts`. The widget index already re-exports from types; this adds the layout types alongside them so that `import type { INVSBounded } from '@brewsite/core'` works correctly.

---

### Work Stream A2: TextBox Element Module

**Owner: one developer, `@brewsite/core` only.**
**Depends on: A1 (needs `NVSRect` type).**

The `TextBox` element follows the mandatory element module pattern exactly. All five files are new.

**Placement:** `packages/core/src/elements/text-box/` — this is a sibling of `background/`, `camera/`, `lighting/`, etc. inside `packages/core/src/elements/`.

The element does NOT live in `packages/core/src/layout/` — that directory is reserved for pure types and the `INVSBounded` interface. Renderable elements live in `packages/core/src/elements/` per the established pattern.

---

#### File: `packages/core/src/elements/text-box/types.ts` — NEW

Single responsibility: `TextBox` state contracts. No React, no Three.js, no runtime.

```typescript
// TextBox element type contracts. No runtime imports, no Three.js, no React.

import type { NVSRect } from '../../layout/types';

/**
 * Anchor mode for a TextBox.
 * 'scene'    — positioned in NVS space relative to the AR-locked container.
 * 'viewport' — positioned relative to the full browser viewport using edge + inset.
 */
export type TextBoxAnchorMode = 'scene' | 'viewport';

/**
 * Viewport edge for TextBox with anchor='viewport'.
 * The box is pinned to this edge of the browser viewport.
 */
export type TextBoxEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Compiled runtime state for one TextBox instance.
 * All layout properties are pre-compiled into this state from the DSL props.
 * The `children` field carries the React content for runtime rendering.
 *
 * Fields `x`, `y`, `w`, `h` are in NVS space [0, 1] and only meaningful
 * when anchor='scene'. When anchor='viewport', use edge + inset instead.
 */
export type TextBoxState = {
  /** NVS x-coordinate of the left edge [0, 1]. Only meaningful for anchor='scene'. */
  x: number;
  /** NVS y-coordinate of the top edge [0, 1]. Only meaningful for anchor='scene'. */
  y: number;
  /** NVS width [0, 1]. Only meaningful for anchor='scene'. */
  w: number;
  /** NVS height [0, 1]. Only meaningful for anchor='scene'. */
  h: number;
  /** Opacity of the box and its contents. Default: 1. Animatable. */
  opacity: number;
  /**
   * Positioning context.
   * 'scene'    — position relative to the AR-locked container using x/y/w/h.
   * 'viewport' — position relative to the full browser viewport using edge/inset.
   */
  anchor: TextBoxAnchorMode;
  /**
   * Viewport edge to pin to. Only meaningful for anchor='viewport'.
   * The box spans the full perpendicular dimension of the viewport.
   */
  edge?: TextBoxEdge;
  /**
   * Distance from the declared edge as a fraction of the viewport dimension.
   * Only meaningful for anchor='viewport'. Default: 0.
   */
  inset?: number;
  /**
   * Content overflow behavior for the box.
   * 'hidden'  — clips content to the box bounds (default, intentional).
   * 'visible' — allows content to extend beyond the box (opt-in).
   */
  overflow: 'hidden' | 'visible';
  /**
   * z-index layer for the box. Default: 0. Higher values render on top.
   * Use discrete integers. Do not use z-index values above 100 — reserved for
   * engine chrome (tooltips, inspect panels).
   */
  layer: number;
  /**
   * The React content to render inside this box.
   * Not compiled into the SceneTrack tick array — carried by reference.
   * The widget reads this from the compiled state and passes it to EngineOverlayHost.
   */
  children: React.ReactNode;
};

// Re-export NVSRect for consumers that need it alongside TextBoxState.
export type { NVSRect };

// React import needed for ReactNode in TextBoxState.
import type React from 'react';
```

**Exports:** `TextBoxAnchorMode`, `TextBoxEdge`, `TextBoxState`, `NVSRect` (re-export).

---

#### File: `packages/core/src/elements/text-box/dsl.tsx` — NEW

Single responsibility: `TextBox` React DSL component for scene authoring. No Three.js.

```typescript
// TextBox DSL component — authored inside <Scene>, compiled by TextBoxWidget.
// Returns null; the engine renders content at runtime via EngineOverlayHost.

import React, { type ReactNode } from 'react';
import type { TextBoxAnchorMode, TextBoxEdge } from './types';

/**
 * Props for the <TextBox> DSL component.
 *
 * For anchor='scene' (default), place content at NVS coordinates within the
 * AR-locked container. x, y, w, h are [0, 1] ratios.
 *
 * For anchor='viewport', place content fixed relative to the browser viewport
 * using edge + inset. The box spans the full perpendicular viewport dimension.
 *
 * All numeric layout props are optional on the DSL. The compile step fills
 * defaults: x=0, y=0, w=1, h=1, opacity=1, layer=0, overflow='hidden'.
 */
export type TextBoxProps = {
  id: string;
  /** NVS x-coordinate of left edge [0, 1]. Default: 0. anchor='scene' only. */
  x?: number;
  /** NVS y-coordinate of top edge [0, 1]. Default: 0. anchor='scene' only. */
  y?: number;
  /** NVS width [0, 1]. Default: 1. anchor='scene' only. */
  w?: number;
  /** NVS height [0, 1]. Default: 1. anchor='scene' only. */
  h?: number;
  /** Box opacity [0, 1]. Default: 1. Animatable between scenes. */
  opacity?: number;
  /**
   * Positioning context. Default: 'scene'.
   * 'scene'    — relative to AR-locked container using x/y/w/h.
   * 'viewport' — relative to browser viewport using edge/inset.
   */
  anchor?: TextBoxAnchorMode;
  /** Viewport edge. Only used when anchor='viewport'. */
  edge?: TextBoxEdge;
  /** Inset fraction from the edge. Only used when anchor='viewport'. Default: 0. */
  inset?: number;
  /**
   * Content overflow behavior. Default: 'hidden'.
   * Use 'visible' for tooltips or dropdowns that extend beyond the box.
   */
  overflow?: 'hidden' | 'visible';
  /**
   * z-index layer. Default: 0. Higher values render on top.
   * Do not use values above 100 (reserved for engine chrome).
   */
  layer?: number;
  /**
   * The React content to render inside the box at runtime.
   * This is not compiled — it is passed through to EngineOverlayHost as-is.
   */
  children: ReactNode;
};

/**
 * DSL component for placing DOM content at an NVS position inside a scene.
 *
 * Returns null — the component is compiled by TextBoxWidget's NodeHandler,
 * never rendered directly by React.
 *
 * Usage:
 *   <TextBox id="panel-left" x={0.05} y={0.1} w={0.4} h={0.8}>
 *     <h2>Feature title</h2>
 *     <p>Description text</p>
 *   </TextBox>
 */
export const TextBox = (_props: TextBoxProps): null => null;
TextBox.displayName = 'TextBox';
```

**Exports:** `TextBox`, `TextBoxProps`.
**Forbidden imports:** Three.js, runtime, widget internals, compiler internals.

---

#### File: `packages/core/src/elements/text-box/compile.ts` — NEW

Single responsibility: pure `TextBoxState` compilation from DSL props. No React output, no Three.js.

```typescript
// Pure compiler function for the TextBox element.
// No React, no Three.js, no side effects.

import type { TextBoxState } from './types';
import type { TextBoxProps } from './dsl';

/**
 * Compiles TextBox DSL props into a TextBoxState.
 * Fills all optional fields with their documented defaults.
 * The children field is passed through by reference — it is React content
 * authored in the scene file and not transformed by the compiler.
 *
 * This function is pure: same inputs always produce the same output.
 */
export function compileTextBox(props: TextBoxProps): TextBoxState {
  return {
    x: props.x ?? 0,
    y: props.y ?? 0,
    w: props.w ?? 1,
    h: props.h ?? 1,
    opacity: props.opacity ?? 1,
    anchor: props.anchor ?? 'scene',
    edge: props.edge,
    inset: props.inset ?? 0,
    overflow: props.overflow ?? 'hidden',
    layer: props.layer ?? 0,
    children: props.children,
  };
}
```

**Exports:** `compileTextBox`.
**Forbidden imports:** Three.js, React, render.ts, widget internals.

---

#### File: `packages/core/src/elements/text-box/TextBoxWidget.ts` — NEW

Single responsibility: `IWidget` implementation bridging compiled `TextBoxState` to the VariableStore, so `EngineOverlayHost` can read and render it.

**Gap 3 resolved — VariableStore write access:** `TextBoxWidget` implements `IRenderable<TextBoxState>` alongside `ISceneElement<TextBoxState>`. This is a no-Three.js renderable: `initialize()` and `dispose()` have no Three.js lifecycle (children cleanup only). `apply(state, ctx)` receives `WidgetRenderContext` whose `.variables` field is typed as `VariableStoreReader` but is always a `VariableStore` instance at runtime — the widget casts it to `VariableStore` to call `.set()`. This is documented with an inline comment and is an intentional internal contract. No construction-time `VariableStore` reference is needed; the `IRenderable` `apply()` path is the correct, established pattern for widgets that write to the variable store.

**VariableStore key scheme (authoritative definition — A3 reads this):**

- Namespace: `'__textbox'`
- Per-widget key prefix: `widgetId + '.'` (e.g., `'panel-left.x'`, `'panel-left.opacity'`)
- Keys published per widget: `x`, `y`, `w`, `h`, `opacity`, `anchor`, `edge`, `inset`, `overflow`, `layer`
- Widget IDs are listed by `EngineOverlayHost` by iterating all keys in the `'__textbox'` namespace and collecting distinct widget-id prefixes (split on first `.`)

**Full implementation specification:**

```typescript
// TextBoxWidget — publishes TextBoxState to VariableStore for EngineOverlayHost.
// Implements ISceneElement + IRenderable<TextBoxState>. No Three.js scene presence.
// IRenderable is used solely for the apply(state, ctx) call path, which provides
// access to ctx.variables for writing layout state to the VariableStore.

import { TextBox } from './dsl';
import { compileTextBox } from './compile';
import type { TextBoxProps } from './dsl';
import type { TextBoxState } from './types';
import type {
  ISceneElement, IRenderable, IWidget,
  WidgetInitContext, WidgetRenderContext,
} from '../../widget/types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber } from '../../compiler/transitions/transitionTypes';
import type { VariableStore } from '../../widget/VariableStore';

// TextBox NodeHandler registration is done in coreHandlers.ts (see A3).
// TextBox factory registration is done in corePlugin().configureRegistry() (see A3/plugins.ts).

const TEXTBOX_NAMESPACE = '__textbox';

/**
 * Constructs a VariableStore key for a TextBoxState.
 * The value stored is JSON-serialized TextBoxState (without children —
 * children are stored separately under a parallel key in a Map held by the widget).
 */
export const textBoxStateKey = (widgetId: string): string => widgetId;

/**
 * Functional transition spec for TextBox.
 * Only `opacity` is animated; layout (x, y, w, h) snaps immediately.
 */
export const functionalTextBoxTransitionSpec: FunctionalTransitionSpec<TextBoxState> = {
  exitFn: (fromState) => (t) => ({ ...fromState, opacity: fromState.opacity * (1 - t) }),
  enterFn: (toState) => (t) => ({ ...toState, opacity: toState.opacity * t }),
  interpolateFn: (fromState, toState) => (t) => ({
    ...toState,
    opacity: blendNumber(fromState.opacity, toState.opacity, t),
    // Layout props snap to toState immediately — no interpolation.
  }),
};

export class TextBoxWidget implements ISceneElement<TextBoxState>, IRenderable<TextBoxState>, IWidget {
  readonly widgetId: string;
  readonly defaultState: TextBoxState;
  readonly transitionSpec = functionalTextBoxTransitionSpec;
  readonly DslComponent = TextBox;

  /**
   * Stores React children by widgetId. Cannot go in VariableStore (JsonPrimitive only).
   * Accessed by EngineOverlayHost via the shared childrenMap passed through
   * TextBoxChildrenContext. See EngineOverlayHost for the read path.
   */
  private readonly childrenMap: Map<string, import('react').ReactNode>;

  constructor(
    widgetId: string,
    childrenMap: Map<string, import('react').ReactNode>,
  ) {
    this.widgetId = widgetId;
    this.childrenMap = childrenMap;
    this.defaultState = compileTextBox({
      id: widgetId,
      children: null,
    });
  }

  /** No-op initialize — TextBoxWidget has no Three.js scene setup. */
  initialize(_context: WidgetInitContext): void {}

  /**
   * Called every tick by RuntimeDriverImpl. Publishes serializable layout state
   * to the VariableStore and stores React children in the shared childrenMap.
   *
   * ctx.variables is typed as VariableStoreReader (read-only interface) but
   * is always a VariableStore instance at runtime. We cast to VariableStore
   * for write access. This is an internal contract between TextBoxWidget and
   * the engine infrastructure — the engine exclusively constructs VariableStore
   * instances and passes them through WidgetRenderContext.
   */
  apply(state: TextBoxState, ctx: WidgetRenderContext): void {
    const { children, ...serializableState } = state;
    // Store children separately (cannot serialize ReactNode to JsonPrimitive).
    this.childrenMap.set(this.widgetId, children);
    // Cast to VariableStore for write access (see comment above).
    const store = ctx.variables as unknown as VariableStore;
    // Publish layout state fields as individual keys for reactive reads.
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.x`, serializableState.x);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.y`, serializableState.y);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.w`, serializableState.w);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.h`, serializableState.h);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.opacity`, serializableState.opacity);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.anchor`, serializableState.anchor);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.edge`, serializableState.edge ?? null);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.inset`, serializableState.inset ?? 0);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.overflow`, serializableState.overflow);
    store.set(TEXTBOX_NAMESPACE, `${this.widgetId}.layer`, serializableState.layer);
  }

  dispose(): void {
    this.childrenMap.delete(this.widgetId);
    // No Three.js resources to release.
  }
}
```

**IMPORTANT — The `childrenMap` design:**

`TextBoxWidget` cannot store React children in `VariableStore` because `VariableStore` only accepts `JsonPrimitive`. Instead, all `TextBoxWidget` instances share a single `Map<string, ReactNode>` that is created once in `corePlugin()` and passed to each widget's constructor. `EngineOverlayHost` receives a reference to this same map (also via `TextBoxChildrenContext`) and reads it to get the children for each `widgetId` when rendering.

The map is created in `packages/core/src/player/plugins.ts` inside `corePlugin()`. The factory registration is handled via `configureRegistry()` (see A3 / plugins.ts).

**Gap 1 resolved — Dynamic widget construction:** `TextBoxWidget` instances must be created on first encounter of each new `<TextBox id="...">`, since each instance has a unique `widgetId` and shares the `childrenMap` by reference. The existing `WidgetRegistry.registerTypeFactory(component, factory)` API is exactly the right mechanism — it accepts a DSL component type and a factory function `(props) => IWidget`, installs the NodeHandler, and creates+registers the widget on first encounter of each new `id`. No new `registerWidgetFactory` method is needed.

The factory is registered via `corePlugin().configureRegistry(registry)`:

```typescript
// Inside corePlugin().configureRegistry():
registry.registerTypeFactory(
  TextBox,
  (props) => new TextBoxWidget(props['id'] as string, textBoxChildrenMap),
);
```

`registerTypeFactory` already calls `registry.register(widget)` internally on first encounter, routing the NodeHandler by `id` prop. The `textBoxChildrenMap` is captured in the closure, closed over from `corePlugin()`'s scope.

**VariableStore namespace/key convention (full spec for A3 to read):**

- Namespace: `'__textbox'`
- Per-widget key prefix: `widgetId + '.'` (e.g., `'panel-left.x'`, `'panel-left.opacity'`)
- Keys published per widget: `x`, `y`, `w`, `h`, `opacity`, `anchor`, `edge`, `inset`, `overflow`, `layer`
- Widget IDs are listed by `EngineOverlayHost` by iterating all keys in the `'__textbox'` namespace and collecting distinct widget-id prefixes (split on first `.`)

**NodeHandler for TextBox (installed automatically by `registerTypeFactory` in `corePlugin().configureRegistry()`, not via `coreHandlers.ts`):**

`WidgetRegistry.registerTypeFactory(TextBox, factory)` installs the NodeHandler for `TextBox` automatically when called. The handler creates and registers a `TextBoxWidget` instance on first encounter of each new `id`, then routes subsequent encounters to the existing widget by `id` prop. There is no separate `registerNode(TextBox, ...)` call in `coreHandlers.ts` — adding one would conflict with the type factory handler and must not be done.

---

#### File: `packages/core/src/elements/text-box/index.ts` — NEW

```typescript
// TextBox element public re-exports.
export { TextBox } from './dsl';
export type { TextBoxProps } from './dsl';
export type { TextBoxState, TextBoxAnchorMode, TextBoxEdge } from './types';
export { TextBoxWidget, functionalTextBoxTransitionSpec, TEXTBOX_NAMESPACE } from './TextBoxWidget';
export { compileTextBox } from './compile';
```

Note: `TEXTBOX_NAMESPACE` must be exported so `EngineOverlayHost` (A3) can import it without re-defining the constant. `textBoxStateKey` is not exported — it is an internal implementation detail not needed by consumers.

---

#### File: `packages/core/src/elements/index.ts` — MODIFIED

Add the following to the existing barrel file (addition only):

```typescript
// TextBox overlay element
export { TextBox } from './text-box';
export type { TextBoxProps, TextBoxState, TextBoxAnchorMode, TextBoxEdge } from './text-box';
export { TextBoxWidget, functionalTextBoxTransitionSpec } from './text-box';
export { compileTextBox } from './text-box';
```

---

#### File: `packages/core/src/compiler/index.ts` — MODIFIED

Add `TextBox` to the DSL authoring surface (the only things scene authors need):

```typescript
export { TextBox } from '../elements/text-box';
export type { TextBoxProps } from '../elements/text-box';
```

Add after the existing `registerNode` export line.

---

### Work Stream A3: EngineOverlayHost Update and sceneRootHandler Removal

**Owner: one developer, `@brewsite/core` only.**
**Depends on: A2 (needs `TEXTBOX_NAMESPACE` constant and `childrenMap` pattern from A2).**

This stream makes two surgical modifications:
1. `EngineOverlayHost` learns to render `TextBox` widgets from the VariableStore.
2. `sceneRootHandler` stops collecting raw non-DSL overlay children.

---

#### File: `packages/core/src/player/EngineOverlayHost.tsx` — MODIFIED

**What is removed:**

- Line 50: `const overlayContent = engine.sceneOverlays?.get(sceneId);`
- Line 52: `if (!overlayContent) return null;`
- Lines 95–96: `{overlayContent}` inside the returned JSX

The entire path that reads `engine.sceneOverlays` from the engine context and renders it as children is removed. After this change, `EngineOverlayHost` renders zero content from `engine.sceneOverlays`.

**What is added:**

A new rendering path that reads all registered `TextBox` instances from the `VariableStore` (via `VariableStoreContext`) and the children map (via a new `TextBoxChildrenContext`), and renders each as a positioned `div`.

**New context for children map:**

```typescript
// New file: packages/core/src/player/TextBoxChildrenContext.ts
// Single responsibility: context carrying the TextBox children Map.

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export const TextBoxChildrenContext =
  createContext<Map<string, ReactNode>>(new Map());

export const useTextBoxChildren = (): Map<string, ReactNode> =>
  useContext(TextBoxChildrenContext);
```

This context is provided by `corePlugin().wrapProvider` (see plugins.ts changes in A3 below).

**Updated `EngineOverlayHost` implementation specification:**

The component reads from `VariableStoreContext` to find all registered TextBox widgets and renders each one. The rendering logic:

```typescript
import { useContext } from 'react';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { useTextBoxChildren } from './TextBoxChildrenContext';
import { TEXTBOX_NAMESPACE } from '../elements/text-box';

// Inside EngineOverlayHost component body:

const variableStore = useContext(VariableStoreContext);
const childrenMap = useTextBoxChildren();

// Collect all TextBox widget IDs currently registered in the VariableStore.
// Pattern: namespace '__textbox', keys like 'widgetId.x', 'widgetId.y', etc.
// We collect distinct widgetIds by splitting on the first '.'.
const nsEntries = variableStore?.getNamespace(TEXTBOX_NAMESPACE) ?? {};
const widgetIds = new Set<string>();
for (const key of Object.keys(nsEntries)) {
  const dotIdx = key.indexOf('.');
  if (dotIdx > 0) widgetIds.add(key.slice(0, dotIdx));
}

// Render each TextBox as a positioned div inside the overlay.
const textBoxElements = Array.from(widgetIds).map((widgetId) => {
  const get = (k: string) => nsEntries[`${widgetId}.${k}`];
  const anchor = get('anchor') as string ?? 'scene';
  const opacity = Number(get('opacity') ?? 1);
  const layer = Number(get('layer') ?? 0);
  const overflow = get('overflow') as string ?? 'hidden';
  const children = childrenMap.get(widgetId);

  if (anchor === 'viewport') {
    const edge = get('edge') as string | undefined;
    const inset = Number(get('inset') ?? 0);
    const viewportStyle = computeViewportAnchorStyle(edge, inset, opacity, layer, overflow);
    return (
      <div key={widgetId} style={viewportStyle}>
        {children}
      </div>
    );
  }

  // anchor === 'scene' — NVS percentage positioning
  const x = Number(get('x') ?? 0);
  const y = Number(get('y') ?? 0);
  const w = Number(get('w') ?? 1);
  const h = Number(get('h') ?? 1);
  const sceneStyle: CSSProperties = {
    position: 'absolute',
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    opacity,
    overflow,
    zIndex: layer,
  };
  return (
    <div key={widgetId} style={sceneStyle}>
      {children}
    </div>
  );
});
```

**`computeViewportAnchorStyle` helper (inline in EngineOverlayHost.tsx):**

```typescript
function computeViewportAnchorStyle(
  edge: string | undefined,
  inset: number,
  opacity: number,
  layer: number,
  overflow: string,
): CSSProperties {
  // Viewport-anchored boxes use position: fixed to escape the AR container.
  const insetPercent = `${inset * 100}%`;
  switch (edge) {
    case 'top':
      return {
        position: 'fixed',
        top: insetPercent,
        left: 0,
        right: 0,
        opacity,
        overflow,
        zIndex: layer,
      };
    case 'bottom':
      return {
        position: 'fixed',
        bottom: insetPercent,
        left: 0,
        right: 0,
        opacity,
        overflow,
        zIndex: layer,
      };
    case 'left':
      return {
        position: 'fixed',
        left: insetPercent,
        top: 0,
        bottom: 0,
        opacity,
        overflow,
        zIndex: layer,
      };
    case 'right':
      return {
        position: 'fixed',
        right: insetPercent,
        top: 0,
        bottom: 0,
        opacity,
        overflow,
        zIndex: layer,
      };
    default:
      return {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        opacity,
        overflow,
        zIndex: layer,
      };
  }
}
```

**Updated return from `EngineOverlayHost`:**

The outer div now renders `{textBoxElements}` instead of `{overlayContent}`:

```tsx
return (
  <div
    key={sceneId}
    className={className}
    style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      pointerEvents: passthroughPointerEvents ? 'none' : 'auto',
      ...(transitionEnabled
        ? { animation: `brewsite-overlay-enter ${transitionDurationMs}ms ${transitionEasing}` }
        : {}),
      ...themeStyles,
    }}
  >
    {textBoxElements}
  </div>
);
```

The `key={sceneId}` prop is retained — it causes the overlay div to unmount and remount on scene change, triggering the CSS entry animation. This behavior is unchanged.

**`EngineOverlayHostProps` interface — no changes.** The `passthroughPointerEvents` and `overlayTransition` props are unchanged. The `className` prop is unchanged.

**Do not remove:** `injectOverlayAnimation()` and the `useEffect` that calls it. The entry animation keyframe is still needed.

---

#### File: `packages/core/src/compiler/sceneDslCompiler.ts` — MODIFIED

**What is removed from `sceneRootHandler`:**

Remove lines 336–342 (the `compileChildrenSeparated` call and `sceneOverlay` assignment):

```typescript
// REMOVE THESE LINES from sceneRootHandler:
const overlayNodes = helpers.compileChildrenSeparated(node, api);

if (overlayNodes.length > 0) {
  api.state.sceneOverlay = overlayNodes.length === 1
    ? overlayNodes[0]
    : React.createElement(React.Fragment, null, ...overlayNodes);
}
```

After removal, the `sceneRootHandler` body ends with the warning check for `exitStart` on the last scene. Non-DSL children of `<Scene>` are now silently ignored.

**What is NOT removed:**
- `compileChildrenSeparated` helper function (lines 139–203). This helper is used internally by the DSL compiler for composite elements; leave it in place even though `sceneRootHandler` no longer calls it for overlay children.

**Gap 2 resolved — `sceneOverlay` removal in scope:** `SceneFrame.sceneOverlay` in `sceneTrackTypes.ts` and `SceneTrack.sceneOverlays` in `sceneTrackTypes.ts` are both removed as part of this stream. Audit confirms all references are in `@brewsite/core` only — `sceneTrackTypes.ts`, `sceneTrackCompiler.ts` (Step 8 builder), `EngineOverlayHost.tsx`, `useSceneEngine.ts`, and two test files — all of which are already modified by this plan or owned by A3. No downstream package imports these fields. Removing them in-scope is a clean break with no additional migration cost.

**Specific removals in `sceneTrackTypes.ts`:**
- Remove the `sceneOverlay?: ReactNode` field from `SceneFrame`.
- Remove the `sceneOverlays: Map<string, ReactNode>` field from `SceneTrack`.
- Remove the `ReactNode` import if it is no longer used after these removals.

**Specific removals in `sceneTrackCompiler.ts`:**
- Remove Step 8 (the `sceneOverlays` map builder, lines 608–632).
- Remove the `sceneOverlays` property from the `SceneTrack` construction object at the end of `compileSceneTrack`.

**Specific removals in `useSceneEngine.ts`:**
- Remove lines 105–108 (the `sceneOverlays: Map<string, ReactNode>` field declaration on the engine state type).
- Remove line 1002 (`sceneOverlays: sceneTrack?.sceneOverlays ?? new Map()`).

**`coreHandlers.ts` — no TextBox handler:** Do not add a `registerNode(TextBox, ...)` call to `registerCoreHandlers()`. The TextBox NodeHandler is installed by `WidgetRegistry.registerTypeFactory()` in `corePlugin().configureRegistry()`. Adding a handler to `coreHandlers.ts` would conflict with the type factory handler.

---

#### File: `packages/core/src/player/plugins.ts` — MODIFIED

**What is added:**

The `childrenMap` for TextBox instances must be created once per engine and passed to:
1. Each `TextBoxWidget` constructor (so the widget can write children into it).
2. `EngineOverlayHost` (so it can read children from it).

The mechanism:
- Create `textBoxChildrenMap` inside `corePlugin()` at plugin instantiation time.
- Register the `TextBoxWidget` type factory via `configureRegistry(registry)` using `registry.registerTypeFactory(TextBox, factory)`. This installs both the NodeHandler and the per-id widget factory in one call. No changes to `WidgetRegistry.ts` are required — `registerTypeFactory` already exists and does exactly what is needed.
- Provide `textBoxChildrenMap` to `EngineOverlayHost` via `TextBoxChildrenContext.Provider` in `wrapProvider`.

**Complete `corePlugin()` shape after modification:**

```typescript
import React from 'react';
import { TextBox } from '../elements/text-box/dsl';
import { TextBoxWidget } from '../elements/text-box/TextBoxWidget';
import { TextBoxChildrenContext } from './TextBoxChildrenContext';

export function corePlugin(options?: CorePluginOptions): WidgetPlugin {
  const textBoxChildrenMap = new Map<string, import('react').ReactNode>();

  return {
    createWidgets: () => [
      new LightingWidget(),
      new BackgroundWidget(),
      new EnvironmentWidget(),
      new FloorWidget(),
      new CameraWidget(),
      new SceneMetaWidget({ onSceneChange: options?.onSceneChange }),
      // TextBoxWidgets are NOT pre-created here. They are created dynamically
      // by registerTypeFactory when the compiler first encounters each <TextBox id="...">.
    ],
    registerHandlers: () => {
      registerCoreHandlers();
      // No TextBox handler here — it is installed by configureRegistry via registerTypeFactory.
    },
    configureRegistry: (registry) => {
      // Register the TextBoxWidget type factory.
      // registerTypeFactory installs both the NodeHandler and the per-id widget factory.
      // On first encounter of <TextBox id="panel-left">, the factory creates and registers
      // a TextBoxWidget("panel-left", textBoxChildrenMap). Subsequent encounters route to
      // the existing widget by id prop.
      registry.registerTypeFactory(
        TextBox,
        (props) => new TextBoxWidget(props['id'] as string, textBoxChildrenMap),
      );
    },
    wrapProvider: (innerContent) => (
      <TextBoxChildrenContext.Provider value={textBoxChildrenMap}>
        {innerContent}
      </TextBoxChildrenContext.Provider>
    ),
  };
}
```

**No changes to `WidgetRegistry.ts` are required.** `registerTypeFactory(component, factory)` already exists with exactly the right contract: it accepts a DSL component type and a factory `(props) => IWidget`, installs the NodeHandler once, and creates+registers a new widget instance on first encounter of each new `id` prop value.

---

## Section 3: Phase B — @brewsite/diagram NVS Integration

### Work Stream B: DiagramCanvas NVS

**Owner: one developer, `@brewsite/diagram` only.**
**Depends on: A1 (`NVSRect`, `INVSBounded` exported from `@brewsite/core`).**

This stream modifies four files in `packages/diagram/src/elements/diagram/canvas/`.

---

#### File: `packages/diagram/src/elements/diagram/canvas/types.ts` — MODIFIED

**What is added:**

Import `NVSRect` from `@brewsite/core`. Add `nvsBounds` as a required field on `DiagramCanvasState` and `DiagramCanvasDSL`.

**`DiagramCanvasState` after modification:**

```typescript
import type { NVSRect } from '@brewsite/core';

export interface DiagramCanvasState {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  readonly diagrams: ReadonlyArray<DiagramState>;
  readonly pipes: ReadonlyArray<DiagramPipeState>;
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
  /**
   * NVS bounds declaring what region of the AR-locked container this canvas occupies.
   * Fullscreen is { x: 0, y: 0, w: 1, h: 1 }. Required — always filled by compile step.
   */
  readonly nvsBounds: NVSRect;
}
```

**`DiagramCanvasDSL` after modification** (at bottom of types.ts):

```typescript
export interface DiagramCanvasDSL {
  readonly id: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly theme?: DiagramTheme;
  readonly pipeRouting?: PipeRoutingAlgorithm;
  readonly pipeLanding?: PipeLandingAlgorithm;
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  /** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the canvas [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the canvas [0, 1]. Default: 1 */
  readonly h?: number;
}
```

---

#### File: `packages/diagram/src/elements/diagram/canvas/dsl.tsx` — MODIFIED

**What is added to `DiagramCanvasProps`:**

```typescript
// New optional props added to DiagramCanvasProps:
/** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
x?: number;
/** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
y?: number;
/** NVS width of the canvas [0, 1]. Default: 1 */
w?: number;
/** NVS height of the canvas [0, 1]. Default: 1 */
h?: number;
```

The `DiagramCanvas` DSL component's TypeScript prop type gains these four optional fields. The component body is unchanged (it returns null — it is a compiled DSL component).

**What is NOT changed:** Existing props. `children?: React.ReactNode`.

---

#### File: `packages/diagram/src/elements/diagram/canvas/compile.ts` — MODIFIED

**What is added to the `compileDiagramCanvas` function:**

The function signature does not change. The returned `DiagramCanvasState` object must include `nvsBounds`.

Locate the return statement in `compileDiagramCanvas()` and add `nvsBounds`:

```typescript
// Inside compileDiagramCanvas() return value:
nvsBounds: {
  x: dsl.x ?? 0,
  y: dsl.y ?? 0,
  w: dsl.w ?? 1,
  h: dsl.h ?? 1,
},
```

Add `import type { NVSRect } from '@brewsite/core';` at the top of the file (after existing imports).

**What is NOT changed:** Pipe routing, layout algorithms, existing compiled fields.

---

#### File: `packages/diagram/src/elements/diagram/canvas/widget.ts` — MODIFIED

**What is added:**

1. `implements INVSBounded` on the class declaration.
2. `get nvsBounds(): NVSRect` accessor.
3. NVS-aware NDC computation in `handleClick`, `handleMouseMove`, and `applyInputFocus`.

**Import addition:**

```typescript
import type { INVSBounded, NVSRect } from '@brewsite/core';
```

**Class declaration change:**

```typescript
export class DiagramCanvasWidget
  implements
    ISceneElement<DiagramCanvasState>,
    IRenderable<DiagramCanvasState>,
    IAnimationController,
    IInputDefaultProvider,
    INVSBounded   // ADD THIS
{
```

**New getter:**

```typescript
get nvsBounds(): NVSRect {
  return this.lastState?.nvsBounds ?? this.defaultState.nvsBounds;
}
```

Add after the `widgetId` and `defaultState` field declarations.

**NVS-aware NDC computation — the projection formula:**

Currently, `handleClick`, `handleMouseMove`, and `applyInputFocus` all compute NDC via:

```typescript
const rect = this.canvasElement.getBoundingClientRect();
this.ndc.set(
  ((event.clientX - rect.left) / rect.width) * 2 - 1,
  -((event.clientY - rect.top) / rect.height) * 2 + 1,
);
```

This maps pointer coords relative to the full canvas element to NDC [-1, 1]. When the canvas occupies only an NVS sub-region, this formula is wrong — the Three.js camera for this canvas fills only the NVS sub-region of the renderer, but the DOM canvas element still represents the full renderer viewport.

**After the NVS change**, the NDC must be computed relative to the sub-region. Add a private helper method:

```typescript
/**
 * Computes NDC coordinates for a pointer event, scoped to the NVS sub-region
 * this canvas occupies within the full renderer viewport.
 *
 * The pointer's position relative to the full canvas element is first converted
 * to a position within the NVS sub-region, then that sub-region position is
 * converted to NDC [-1, 1] space.
 *
 * Formula:
 *   fullRect = canvasElement.getBoundingClientRect()
 *   pointerLocalX = clientX - fullRect.left    (pixels from canvas left)
 *   pointerLocalY = clientY - fullRect.top     (pixels from canvas top)
 *
 *   regionLeft   = nvsBounds.x * fullRect.width
 *   regionTop    = nvsBounds.y * fullRect.height
 *   regionWidth  = nvsBounds.w * fullRect.width
 *   regionHeight = nvsBounds.h * fullRect.height
 *
 *   // Position relative to sub-region origin, clamped:
 *   subX = pointerLocalX - regionLeft
 *   subY = pointerLocalY - regionTop
 *
 *   // NDC:
 *   ndcX = (subX / regionWidth) * 2 - 1     range [-1, 1]
 *   ndcY = -(subY / regionHeight) * 2 + 1   range [-1, 1] (Y inverted)
 */
private computeNdc(clientX: number, clientY: number): void {
  if (!this.canvasElement) return;
  const nvsBounds = this.nvsBounds;
  const rect = this.canvasElement.getBoundingClientRect();
  const pointerX = clientX - rect.left;
  const pointerY = clientY - rect.top;
  const regionLeft   = nvsBounds.x * rect.width;
  const regionTop    = nvsBounds.y * rect.height;
  const regionWidth  = nvsBounds.w * rect.width;
  const regionHeight = nvsBounds.h * rect.height;
  const subX = pointerX - regionLeft;
  const subY = pointerY - regionTop;
  this.ndc.set(
    (subX / regionWidth) * 2 - 1,
    -(subY / regionHeight) * 2 + 1,
  );
}
```

Replace all three existing NDC computation sites (`handleClick`, `handleMouseMove`, `applyInputFocus`) with calls to `this.computeNdc(event.clientX, event.clientY)`.

In `applyInputFocus`, the existing path that calls `this.canvasElement.getBoundingClientRect()` for focus-by-hit-test also uses NDC. Replace that path:

```typescript
// Old:
const rect = this.canvasElement.getBoundingClientRect();
this.ndc.set(
  ((clientX - rect.left) / rect.width) * 2 - 1,
  -((clientY - rect.top) / rect.height) * 2 + 1,
);

// New:
this.computeNdc(clientX, clientY);
```

---

## Section 4: Phase C — @brewsite/charts NVS Integration

### Work Stream C: ChartWidget and ChartTooltipOverlay NVS

**Owner: one developer, `@brewsite/charts` only.**
**Depends on: A1 (`NVSRect`, `INVSBounded` exported from `@brewsite/core`).**

This stream modifies five files in `packages/charts/src/`.

---

#### File: `packages/charts/src/elements/chart/types.ts` — MODIFIED

**What is added:**

Import `NVSRect` from `@brewsite/core`. Add `nvsBounds` as a required field on `ChartState`. Update `DEFAULT_CHART_STATE` to include the fullscreen default.

**`ChartState` after modification:**

```typescript
import type { NVSRect } from '@brewsite/core';

export type ChartState = {
  readonly type: ChartType;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  readonly dataSource: string;
  readonly transforms: readonly DataTransform[];
  readonly filterGroup?: FilterGroupId;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly legend: ChartLegendState | null;
  readonly theme: ChartThemeName | ChartTheme;
  readonly opacity: number;
  readonly interactive: boolean;
  readonly innerRadius?: number;
  readonly timeField?: string;
  readonly sceneTheme?: SceneTheme;
  /**
   * NVS bounds declaring what region of the AR-locked container this chart occupies.
   * Fullscreen is { x: 0, y: 0, w: 1, h: 1 }. Required — always filled by compile step.
   */
  readonly nvsBounds: NVSRect;
};
```

**`DEFAULT_CHART_STATE` after modification:**

```typescript
export const DEFAULT_CHART_STATE: ChartState = {
  // ... all existing fields unchanged ...
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
};
```

**`ChartDSL` after modification:**

```typescript
export type ChartDSL = {
  readonly id: string;
  readonly type: ChartType;
  // ... all existing props unchanged ...
  /** NVS x-coordinate of the chart left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the chart top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the chart [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the chart [0, 1]. Default: 1 */
  readonly h?: number;
};
```

---

#### File: `packages/charts/src/elements/chart/dsl.tsx` — MODIFIED

Add the same four optional NVS props to `ChartProps` (the React component props type, which mirrors `ChartDSL`):

```typescript
x?: number;
y?: number;
w?: number;
h?: number;
```

The `Chart` DSL component is unchanged in behavior.

---

#### File: `packages/charts/src/elements/chart/compile.ts` — MODIFIED

Locate the compile function (likely `compileChart()` or inline in the NodeHandler). Add `nvsBounds` to the returned `ChartState`:

```typescript
nvsBounds: {
  x: props.x ?? 0,
  y: props.y ?? 0,
  w: props.w ?? 1,
  h: props.h ?? 1,
},
```

Add `import type { NVSRect } from '@brewsite/core';` at the top of the file.

---

#### File: `packages/charts/src/elements/chart/ChartWidget.ts` — MODIFIED

**What is added:**

1. `implements INVSBounded` on the class declaration.
2. `get nvsBounds(): NVSRect` accessor.
3. Two new public methods: `getCamera()` and `getContainerSize()` — exposed for `ChartTooltipOverlay`.
4. NVS-aware NDC computation in `getNdc()`.

**Import addition:**

```typescript
import type { INVSBounded, NVSRect } from '@brewsite/core';
```

**Class declaration change:**

```typescript
export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    INVSBounded   // ADD THIS
{
```

**New getter:**

```typescript
get nvsBounds(): NVSRect {
  return this.lastState?.nvsBounds ?? DEFAULT_CHART_STATE.nvsBounds;
}
```

**The private `getCamera()` method becomes public:**

```typescript
// Change from private to public:
public getCamera(): THREE.Camera | null {
  if (!this.scene) return null;
  if (!this.camera) {
    const cam = (this.scene.userData as Record<string, unknown>)[SCENE_CAMERA_KEY];
    if (cam instanceof THREE.Camera) this.camera = cam;
  }
  return this.camera;
}
```

**New public method `getContainerSize()`:**

```typescript
/**
 * Returns the pixel dimensions of the renderer's DOM element.
 * Used by ChartTooltipOverlay to project NDC to pixel offsets within
 * the AR-locked container.
 * Returns null if the widget has not been initialized.
 */
public getContainerSize(): { width: number; height: number } | null {
  if (!this.rendererDom) return null;
  return {
    width: this.rendererDom.offsetWidth,
    height: this.rendererDom.offsetHeight,
  };
}
```

**NVS-aware NDC computation:**

The private `getNdc()` method currently computes NDC relative to the full renderer DOM element:

```typescript
// Current (incorrect for sub-region):
private getNdc(e: MouseEvent, dom: HTMLElement): THREE.Vector2 | null {
  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
}
```

**After the NVS change:**

```typescript
private getNdc(e: MouseEvent, dom: HTMLElement): THREE.Vector2 | null {
  const rect = dom.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const nvsBounds = this.nvsBounds;
  const pointerX = e.clientX - rect.left;
  const pointerY = e.clientY - rect.top;
  const regionLeft   = nvsBounds.x * rect.width;
  const regionTop    = nvsBounds.y * rect.height;
  const regionWidth  = nvsBounds.w * rect.width;
  const regionHeight = nvsBounds.h * rect.height;
  if (regionWidth <= 0 || regionHeight <= 0) return null;
  const subX = pointerX - regionLeft;
  const subY = pointerY - regionTop;
  return new THREE.Vector2(
    (subX / regionWidth) * 2 - 1,
    -(subY / regionHeight) * 2 + 1,
  );
}
```

This is the same formula as `DiagramCanvasWidget.computeNdc()`. The math is identical — pointer → sub-region offset → NDC.

---

#### File: `packages/charts/src/player/ChartTooltipOverlay.tsx` — MODIFIED

**What is removed:**

From `ChartTooltipOverlayProps`:
- `camera?: THREE.Camera` — removed entirely
- `domElement?: HTMLElement` — removed entirely

From the `project` callback:
- `if (!info || !camera || !domElement) {` — the `camera` and `domElement` guards
- `const rect = domElement.getBoundingClientRect();` — DOM rect read
- `const x = ((point.x + 1) / 2) * rect.width + rect.left;` — old projection
- `const y = ((-point.y + 1) / 2) * rect.height + rect.top;` — old projection

From the rendered div style:
- `position: 'fixed'` — replaced with `position: 'absolute'`

**What is added:**

To `ChartTooltipOverlayProps`:
- `nvsBounds: NVSRect` — required

To the import:
- `import type { NVSRect } from '@brewsite/core';`
- Remove the `import * as THREE from 'three';` since the component no longer uses Three.js types directly.

**`ChartTooltipOverlayProps` after modification:**

```typescript
export type ChartTooltipOverlayProps = {
  /** The ChartWidget instance to subscribe to hover events on. */
  widget: ChartWidget;
  /**
   * NVS bounds of the chart within the AR-locked container.
   * Must match the nvsBounds declared in the Chart DSL.
   * Used to project the 3D hit point to absolute pixel offsets
   * within EngineOverlayHost.
   */
  nvsBounds: NVSRect;
  /** Custom render function for the tooltip content. */
  renderContent?: (info: ChartHoverInfo) => React.ReactNode;
  /** Extra CSS class name applied to the tooltip container. */
  className?: string;
};
```

**Updated `project` callback:**

```typescript
const project = useCallback(
  (info: ChartHoverInfo | null): void => {
    if (!info) { setTooltip(null); return; }
    const camera = widget.getCamera();
    const containerSize = widget.getContainerSize();
    if (!camera || !containerSize) { setTooltip(null); return; }

    // Project 3D world position to NDC.
    const point = new THREE.Vector3(info.point[0], info.point[1], info.point[2]);
    point.project(camera); // NDC in [-1, 1] x [-1, 1]

    // Map NDC into the NVS sub-region pixel footprint within the AR container.
    // containerSize is the full AR container pixel dimensions.
    const regionX = nvsBounds.x * containerSize.width;
    const regionY = nvsBounds.y * containerSize.height;
    const regionW = nvsBounds.w * containerSize.width;
    const regionH = nvsBounds.h * containerSize.height;

    // NDC (-1 to 1) → sub-region pixel position relative to AR container origin.
    const x = regionX + ((point.x + 1) / 2) * regionW;
    const y = regionY + ((-point.y + 1) / 2) * regionH;

    setTooltip({ info, x, y });
  },
  [widget, nvsBounds],
);
```

**Note:** `THREE.Vector3` is still used here for `point.project(camera)`. Keep the Three.js import:
```typescript
import * as THREE from 'three';
```

**Updated rendered tooltip div:**

```tsx
<div
  className={className}
  style={{
    position: 'absolute',  // WAS: 'fixed'
    left: tooltip.x + 12,
    top: tooltip.y - 12,
    // ... all other styles unchanged ...
  }}
>
  {renderContent(tooltip.info)}
</div>
```

The tooltip now positions with `position: absolute` inside `EngineOverlayHost` (which spans `inset: 0` over the AR-locked container). The `x` and `y` values are in pixels relative to the AR container top-left, which is exactly what `position: absolute` with `left: x; top: y` inside a `position: absolute; inset: 0` container produces.

The tooltip component should be placed inside the `EngineOverlayHost` by the consumer — this was already the correct placement, now it is required.

---

## Section 5: Phase D — @brewsite/model NVS Integration

### Work Stream D: ModelWidget and LabelPositioner NVS

**Owner: one developer, `@brewsite/model` only.**
**Depends on: A1 (`NVSRect`, `INVSBounded` exported from `@brewsite/core`).**

This stream modifies four files in `packages/model/src/`.

---

#### File: `packages/model/src/elements/model/types.ts` — MODIFIED

**What is added:**

Import `NVSRect` from `@brewsite/core`. Add `nvsBounds` as a required field on `SceneModelInstanceState`.

```typescript
import type { NVSRect } from '@brewsite/core';

export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  labels?: import('../../labels/types').LabelResolved[];
  /**
   * NVS bounds declaring what region of the AR-locked container this model occupies.
   * Fullscreen is { x: 0, y: 0, w: 1, h: 1 }. Required — always filled by compile step.
   */
  nvsBounds: NVSRect;
};
```

`nvsBounds` is added at the end of the type, after `labels`.

---

#### File: `packages/model/src/elements/model/dsl.tsx` — MODIFIED

**What is added to `ModelProps`:**

```typescript
/** NVS x-coordinate of the model's viewport region [0, 1]. Default: 0 */
x?: number;
/** NVS y-coordinate of the model's viewport region [0, 1]. Default: 0 */
y?: number;
/** NVS width of the model's viewport region [0, 1]. Default: 1 */
w?: number;
/** NVS height of the model's viewport region [0, 1]. Default: 1 */
h?: number;
```

Add these four optional props to `ModelProps`. Their documentation must be included.

**What is NOT changed:** All existing `ModelProps` fields. The `ModelRouter` component is unchanged.

---

#### File: `packages/model/src/elements/model/compile.ts` — MODIFIED

Locate `createDefaultModelInstanceState()` and the compile function that constructs `SceneModelInstanceState`. Add `nvsBounds` to the output:

**In `createDefaultModelInstanceState()`:**

```typescript
export function createDefaultModelInstanceState(): SceneModelInstanceState {
  return {
    model: createDefaultSceneModel(),
    playback: createDefaultScenePlayback(),
    nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  };
}
```

**In the compile path that reads DSL props and constructs `SceneModelInstanceState`** (wherever `ModelWidget`'s `CUSTOM_NODE_HANDLER` processes `ModelProps`):

```typescript
// Add nvsBounds to the accumulated state:
const nvsBounds: NVSRect = {
  x: resolvedProps.x ?? 0,
  y: resolvedProps.y ?? 0,
  w: resolvedProps.w ?? 1,
  h: resolvedProps.h ?? 1,
};
// Include in the state object returned/set.
```

Add `import type { NVSRect } from '@brewsite/core';` at the top of the file.

---

#### File: `packages/model/src/elements/model/ModelWidget.ts` — MODIFIED

**What is added:**

1. `implements INVSBounded` on the class declaration.
2. `get nvsBounds(): NVSRect` accessor.
3. Forward `nvsBounds` to `LabelPositioner.setContainerSize()` on every resize.

**Import addition:**

```typescript
import type { INVSBounded, NVSRect } from '@brewsite/core';
```

**Class declaration change:**

```typescript
export class ModelWidget
  implements
    ISceneElement<SceneModelInstanceState>,
    IRenderable<SceneModelInstanceState>,
    ILoadable,
    IDslComposite,
    IAttachmentHost,
    IRenderContributor,
    IHasCustomDslHandler,
    INVSBounded   // ADD THIS
{
```

**New getter:**

```typescript
get nvsBounds(): NVSRect {
  return this.lastAppliedState?.nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 };
}
```

Note: `ModelWidget` tracks its last applied state in a private field. Use whatever that field is called (check the actual source). The fallback `{ x: 0, y: 0, w: 1, h: 1 }` is the fullscreen default — it must not be `null | undefined`.

**Forwarding `nvsBounds` to `LabelPositioner`:**

Find where `ModelWidget` calls `this.labelPositioner.setContainerSize(width, height)`. This is likely in a `ResizeObserver` callback or in `initialize()`. Add the third argument:

```typescript
// Old:
this.labelPositioner.setContainerSize(containerWidth, containerHeight);

// New:
this.labelPositioner.setContainerSize(containerWidth, containerHeight, this.nvsBounds);
```

If `setContainerSize` is called in multiple places, update all of them.

---

#### File: `packages/model/src/player/LabelPositioner.ts` — MODIFIED

**What is changed (public API breaking change):**

`setContainerSize` signature changes from:
```typescript
setContainerSize(width: number, height: number): void
```
to:
```typescript
setContainerSize(width: number, height: number, nvsBounds?: NVSRect): void
```

**What is added:**

A private `nvsBounds` field that stores the current sub-region bounds:

```typescript
import type { NVSRect } from '@brewsite/core';

// In the class body:
private nvsBounds: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
```

Updated `setContainerSize` implementation:

```typescript
setContainerSize(width: number, height: number, nvsBounds?: NVSRect): void {
  this.containerWidth = width;
  this.containerHeight = height;
  this.nvsBounds = nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 };
}
```

**Updated `projectToScreen` function:**

The private `projectToScreen` function currently takes `(worldPos, camera, width, height)` and produces pixel coordinates relative to the full container. It must be updated to project into the NVS sub-region.

```typescript
/**
 * Projects a 3D world position to 2D pixel coordinates within the AR-locked container,
 * scoped to the NVS sub-region the model occupies.
 *
 * Steps:
 * 1. vec.project(camera) → NDC in [-1, 1]
 * 2. Compute the sub-region's pixel footprint within the container:
 *      regionLeft   = nvsBounds.x * containerWidth
 *      regionTop    = nvsBounds.y * containerHeight
 *      regionWidth  = nvsBounds.w * containerWidth
 *      regionHeight = nvsBounds.h * containerHeight
 * 3. Map NDC to pixel offset within that footprint:
 *      x = regionLeft + (ndcX * 0.5 + 0.5) * regionWidth
 *      y = regionTop  + (-ndcY * 0.5 + 0.5) * regionHeight
 *
 * The returned (x, y) are in the same coordinate space as the EngineOverlayHost div
 * (absolute pixels from the AR container top-left). Label DOM elements positioned
 * with `position: absolute; top: 0; left: 0; transform: translate(x, y)` inside
 * that container will be placed correctly.
 */
const projectToScreen = (
  worldPos: [number, number, number],
  camera: Camera,
  containerWidth: number,
  containerHeight: number,
  nvsBounds: NVSRect,
): { x: number; y: number } => {
  const vec = new Vector3(worldPos[0], worldPos[1], worldPos[2]);
  vec.project(camera);
  const regionLeft   = nvsBounds.x * containerWidth;
  const regionTop    = nvsBounds.y * containerHeight;
  const regionWidth  = nvsBounds.w * containerWidth;
  const regionHeight = nvsBounds.h * containerHeight;
  const x = regionLeft   + (vec.x * 0.5 + 0.5) * regionWidth;
  const y = regionTop    + (-vec.y * 0.5 + 0.5) * regionHeight;
  return { x, y };
};
```

**Update the call sites inside `LabelPositioner.update()`** to pass `this.nvsBounds`:

```typescript
// Old:
const targetScreen = projectToScreen(
  [bonePos[0], bonePos[1], bonePos[2]],
  camera,
  this.containerWidth,
  this.containerHeight,
);
const labelScreen = projectToScreen(
  [bonePos[0] + offset[0], bonePos[1] + offset[1], bonePos[2] + offset[2]],
  camera,
  this.containerWidth,
  this.containerHeight,
);

// New:
const targetScreen = projectToScreen(
  [bonePos[0], bonePos[1], bonePos[2]],
  camera,
  this.containerWidth,
  this.containerHeight,
  this.nvsBounds,
);
const labelScreen = projectToScreen(
  [bonePos[0] + offset[0], bonePos[1] + offset[1], bonePos[2] + offset[2]],
  camera,
  this.containerWidth,
  this.containerHeight,
  this.nvsBounds,
);
```

All other `LabelPositioner` logic — element registration, CSS property setting, line angle computation — is unchanged.

---

## Section 6: Phase E — App Scene Updates

**Owner: scene author (one developer), `apps/` only.**
**Depends on: Phases A1, A2, A3, B, C, D all complete.**
**No library code is touched in Phase E.**

### What Must Change in `apps/`

#### 1. Replace Hand-Rolled AR Wrapper Divs with `EngineARContainer`

**Specific files to update** (identified by audit of `apps/examples/src/`):

- `apps/examples/src/brewflow-memory/MemorySubsystemPage.tsx`
- `apps/examples/src/brewflow-sidecar/SidecarNotePage.tsx`
- `apps/examples/src/architecture/ArchitecturePage.tsx`
- `apps/examples/src/brewflow-comparison/ComparisonPage.tsx`
- `apps/examples/src/chart/ChartDemoPage.tsx`
- `apps/examples/src/brewflow-multiuser/MultiUserPage.tsx`

Each of these wraps `<SceneCanvas>` + `<EngineOverlayHost>` + `<EngineInputRegion>` inside a container div with inline styles (e.g., `style={{ background: '#020812', minHeight: '100vh' }}`). The inner layout is currently the responsibility of the outer `<div>` in each page. Wrap `<EngineInputRegion>` (and its children) with `<EngineARContainer>`.

**Before (representative example from `MemorySubsystemPage.tsx`):**
```tsx
<div style={{ background: '#eeeeee', minHeight: '100vh', fontSize: '20px' }}>
  <EngineProvider ...>
    {/* scenes */}
    <EngineInputRegion>
      <SceneCanvas style={{background: '#444444'}}/>
      <EngineOverlayHost />
    </EngineInputRegion>
  </EngineProvider>
</div>
```

**After:**
```tsx
<div style={{ background: '#eeeeee', minHeight: '100vh', fontSize: '20px' }}>
  <EngineProvider ...>
    {/* scenes */}
    <EngineARContainer aspectRatio={16/9} scaleMode="fit-width">
      <EngineInputRegion>
        <SceneCanvas style={{background: '#444444'}}/>
        <EngineOverlayHost />
      </EngineInputRegion>
    </EngineARContainer>
  </EngineProvider>
</div>
```

#### 2. Migrate Raw JSX Overlay Children to `TextBox`

**Audit result:** No scene files in `apps/examples/src/` use raw non-DSL JSX children directly inside `<Scene>` — all current scenes in the examples app use only registered DSL components as `<Scene>` children. This migration step has zero instances to update in the current codebase.

The before/after pattern is documented here for future scene authors:

**Before (pattern no longer supported):**
```tsx
<Scene id="s1">
  <Camera ... />
  <div className="panel-left">
    <h2>Feature Title</h2>
    <p>Description text</p>
  </div>
</Scene>
```

**After:**
```tsx
<Scene id="s1">
  <Camera ... />
  <TextBox id="panel-left" x={0.05} y={0.1} w={0.4} h={0.8}>
    <h2>Feature Title</h2>
    <p>Description text</p>
  </TextBox>
</Scene>
```

#### 3. Update `ChartTooltipOverlay` Usage

**Audit result:** No files in `apps/examples/src/` use `ChartTooltipOverlay` directly (it is referenced in label strings in `scene_charts.tsx` but not instantiated as a React component). The `ChartDemoPage.tsx` and `chartDemo.tsx` scene do not use `ChartTooltipOverlay`. This migration step has zero instances to update in the current codebase.

The before/after pattern is documented here for future consumers:

**Before:**
```tsx
<ChartTooltipOverlay widget={chartWidget} camera={camera} domElement={domElement} />
```

**After:**
```tsx
<ChartTooltipOverlay widget={chartWidget} nvsBounds={{ x: 0, y: 0, w: 1, h: 1 }} />
```

(Pass the same `x`/`y`/`w`/`h` values used in the `<Chart>` DSL when the chart is non-fullscreen.)

#### 4. Add NVS Props to DiagramCanvas, Chart, and Model DSL Where Non-Fullscreen

For any diagram canvases, charts, or models that should occupy less than the full container, add `x`/`y`/`w`/`h` props. Fullscreen uses require no change (defaults apply).

**Audit result:** All current diagram canvases, charts, and models in `apps/examples/src/` are fullscreen. No `x`/`y`/`w`/`h` props need to be added. If the author wishes to demonstrate split-screen layouts, this is a new authoring task, not a migration.

---

## Section 7: Test Strategy

All tests use Vitest with the Node environment. No real WebGL context, no real browser DOM (except where jsdom is required). Tests are interface-based stateful tests: real inputs, assert real outputs. No mocking of internals.

---

### Work Stream A1 Tests

**File: `packages/core/src/__tests__/layout.test.ts`** — NEW

- Test `NVSRect` shape: construct a valid `NVSRect`, confirm TypeScript accepts it without errors.
- Test `computeContainerDims` for all four scale modes with representative inputs:
  - `fit-width`: `outerWidth=960, outerHeight=600, AR=16/9` → `containerW=960, containerH=540, sceneScale=0.5` (at `referenceWidth=1920`)
  - `fit-height`: `outerWidth=1920, outerHeight=1080, AR=16/9` → `containerW=1920, containerH=1080, sceneScale=1.0`
  - `contain` (width-constrained): `outerWidth=800, outerHeight=600, AR=16/9` → constrained by height: `containerH=600, containerW=600*(16/9)=1066.7` — no, actually by width: `byWidth = 800/(16/9) = 450` which is `<= 600`, so `containerW=800, containerH=450`.
  - `contain` (height-constrained): `outerWidth=1920, outerHeight=400, AR=16/9` → `byWidth = 1920/(16/9) = 1080 > 400`, so `containerH=400, containerW=400*(16/9)=711.1`.
  - `cover` (width-dominant): `outerWidth=1920, outerHeight=600, AR=16/9` → `byWidth=1920/(16/9)=1080 >= 600`, so `containerW=1920, containerH=1080`.
  - `cover` (height-dominant): `outerWidth=800, outerHeight=1200, AR=16/9` → `byWidth=800/(16/9)=450 < 1200`, so `containerH=1200, containerW=1200*(16/9)=2133.3`.
  - Zero dimensions: `outerWidth=0` → `{containerW:0, containerH:0, sceneScale:0}`.
  - `--scene-scale` at `referenceWidth=1920, containerW=960` → `0.5`.
  - `--scene-scale` at `referenceWidth=1920, containerW=1920` → `1.0`.

**File: `packages/core/src/player/__tests__/EngineARContainer.test.tsx`** — NEW

- Test `EngineARContainerContext` default value: construct the context, read defaults.
- Mock `ResizeObserver` with a real interface-conforming implementation that fires callbacks synchronously.
- Render `<EngineARContainer>` in jsdom, fire a resize event, assert `--scene-scale` is set on the outer div.
- Test all four scale modes produce correct container dimensions (via `computeContainerDims` directly — no need to mount the component for this).

---

### Work Stream A2 Tests

**File: `packages/core/src/elements/text-box/__tests__/compile.test.ts`** — NEW

```typescript
// Real inputs → assert real TextBoxState output.

import { describe, it, expect } from 'vitest';
import { compileTextBox } from '../compile';

describe('compileTextBox', () => {
  it('fills all defaults when only id and children are provided', () => {
    const state = compileTextBox({ id: 'box1', children: null });
    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
    expect(state.w).toBe(1);
    expect(state.h).toBe(1);
    expect(state.opacity).toBe(1);
    expect(state.anchor).toBe('scene');
    expect(state.edge).toBeUndefined();
    expect(state.inset).toBe(0);
    expect(state.overflow).toBe('hidden');
    expect(state.layer).toBe(0);
    expect(state.children).toBeNull();
  });

  it('preserves explicit values', () => {
    const child = { type: 'div' }; // any React node
    const state = compileTextBox({
      id: 'box2',
      x: 0.1, y: 0.2, w: 0.5, h: 0.3,
      opacity: 0.8,
      anchor: 'viewport',
      edge: 'bottom',
      inset: 0.05,
      overflow: 'visible',
      layer: 5,
      children: child as any,
    });
    expect(state.x).toBe(0.1);
    expect(state.y).toBe(0.2);
    expect(state.w).toBe(0.5);
    expect(state.h).toBe(0.3);
    expect(state.opacity).toBe(0.8);
    expect(state.anchor).toBe('viewport');
    expect(state.edge).toBe('bottom');
    expect(state.inset).toBe(0.05);
    expect(state.overflow).toBe('visible');
    expect(state.layer).toBe(5);
    expect(state.children).toBe(child);
  });
});
```

**File: `packages/core/src/elements/text-box/__tests__/TextBoxWidget.test.ts`** — NEW

- Construct `TextBoxWidget` with a `widgetId` and a fresh `childrenMap`.
- Create a `VariableStore` instance and construct a minimal `WidgetRenderContext` with `variables: store`.
- Call `apply(state, ctx)` with a real `TextBoxState`.
- Assert `childrenMap.get(widgetId)` returns the correct children.
- Assert `store.get('__textbox', 'box1.x')` returns the correct value.
- Test transition spec: call `functionalTextBoxTransitionSpec.interpolateFn(stateA, stateB)(0.5)` and assert `opacity` is blended correctly.
- Test `dispose()` clears the widgetId from the childrenMap.

---

### Work Stream A3 Tests

**File: `packages/core/src/compiler/__tests__/sceneRootHandler.test.ts`** — NEW or MODIFIED (if it exists)

- Compile a `<Scene>` with a raw non-DSL `<div>` child. Assert the resulting `SceneFrame` has no `sceneOverlay` field (field is removed). The div must be silently dropped.
- Compile a `<Scene>` with a `<TextBox>` child (requires a `TextBoxWidget` registered via `registerTypeFactory` before compilation). Assert the resulting `SceneFrame.widgets['box-id']` is set to the compiled `TextBoxState`. Assert the TextBox state fields are correct.
- Compile a `<Scene>` with both DSL elements and a `<TextBox>`. Assert both the DSL element widget state and the TextBox widget state are present.

**File: `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx`** — MODIFIED

This file already exists and uses `sceneOverlays: new Map([['scene-a', <div>Overlay A</div>]])` in its mock engine. That test must be removed and replaced with the new pattern.

- Remove any test that sets up `sceneOverlays` on the mock engine — this field no longer exists.
- Add: Render `EngineOverlayHost` with a `VariableStoreContext` containing TextBox state for one widget (written via `VariableStore.set()`) and a `TextBoxChildrenContext` with the matching children. Assert the rendered output contains a `div` with `position: absolute` and correct percentage positioning.
- Add: Test `anchor='viewport'` renders with `position: fixed` and the correct `bottom` inset.
- Add: Test `layer` maps to `zIndex`.
- Add: Test `overflow: 'visible'` vs `overflow: 'hidden'` styles.
- Add: Test that a scene with no TextBox widgets in the VariableStore renders no positioned overlay divs.

**File: `packages/core/src/runtime/__tests__/SceneLifecycle.test.ts`** — MODIFIED

This file exists and uses `sceneOverlays: new Map()` in its mock `SceneTrack`. Update the mock to remove the `sceneOverlays` property — the field no longer exists on `SceneTrack`. No new assertions needed for this file.

---

### Work Stream B Tests

**File: `packages/diagram/src/elements/diagram/canvas/__tests__/compile.test.ts`** — MODIFIED

Add tests:
- `compileDiagramCanvas` with `x=0.1, y=0.2, w=0.5, h=0.6` → `nvsBounds = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 }`.
- `compileDiagramCanvas` with no `x`/`y`/`w`/`h` → `nvsBounds = { x: 0, y: 0, w: 1, h: 1 }`.

**File: `packages/diagram/src/elements/diagram/canvas/__tests__/DiagramCanvasWidget.test.ts`** — NEW or MODIFIED

- Construct `DiagramCanvasWidget` with a `defaultState` that has `nvsBounds = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }`.
- Call `apply(state, ctx)`.
- Assert `widget.nvsBounds` returns `{ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }`.
- Test the `computeNdc` formula in isolation (extract as a named exportable pure function if needed for test access). Assert:
  - For a fullscreen NVS `{ x:0, y:0, w:1, h:1 }` and a canvas of 1920×1080:
    - Pointer at top-left `(0, 0)` → NDC `(-1, 1)`.
    - Pointer at center `(960, 540)` → NDC `(0, 0)`.
    - Pointer at bottom-right `(1920, 1080)` → NDC `(1, -1)`.
  - For NVS `{ x:0.5, y:0, w:0.5, h:1 }` (right half) and canvas 1920×1080:
    - Pointer at `(960, 540)` (left edge of sub-region) → NDC `(-1, 0)` approx.
    - Pointer at `(1440, 540)` (center of sub-region) → NDC `(0, 0)` approx.

---

### Work Stream C Tests

**File: `packages/charts/src/elements/chart/__tests__/compile.test.ts`** — MODIFIED or NEW

- Test that `compileChart()` with `x=0.1, y=0.2, w=0.5, h=0.6` produces `nvsBounds = { x: 0.1, y: 0.2, w: 0.5, h: 0.6 }`.
- Test that `DEFAULT_CHART_STATE.nvsBounds = { x: 0, y: 0, w: 1, h: 1 }`.

**File: `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`** — NEW

- Construct `ChartWidget`, call `apply(state)` with a state that has `nvsBounds = { x: 0.5, y: 0, w: 0.5, h: 1 }`.
- Assert `widget.nvsBounds` returns the correct value.

**File: `packages/charts/src/player/__tests__/ChartTooltipOverlay.test.tsx`** — NEW

Test the NVS-to-pixel projection formula in isolation. Extract `computeTooltipPosition` as a pure function (separate from the React component) and test it:

```typescript
// projectNdcToNvsPixels(ndcX, ndcY, containerW, containerH, nvsBounds) → {x, y}
// This is the math extracted from the `project` callback.

import { projectNdcToNvsPixels } from '../ChartTooltipOverlay';

it('projects NDC (0,0) to center of sub-region', () => {
  const result = projectNdcToNvsPixels(0, 0, 1920, 1080, { x: 0.5, y: 0, w: 0.5, h: 1 });
  // regionX = 0.5 * 1920 = 960; regionY = 0 * 1080 = 0
  // regionW = 0.5 * 1920 = 960; regionH = 1 * 1080 = 1080
  // ndcX=0 → (0+1)/2 * 960 = 480; x = 960 + 480 = 1440
  // ndcY=0 → (-0+1)/2 * 1080 = 540; y = 0 + 540 = 540
  expect(result.x).toBeCloseTo(1440);
  expect(result.y).toBeCloseTo(540);
});
```

For this test to work, the projection formula must be extracted into an exportable pure function `projectNdcToNvsPixels` in `ChartTooltipOverlay.tsx`. This is a test-driven requirement on the implementation.

---

### Work Stream D Tests

**File: `packages/model/src/player/__tests__/LabelPositioner.test.ts`** — MODIFIED

This file already exists. Add tests for the NVS sub-region projection:

```typescript
it('projects label to sub-region when nvsBounds is provided', () => {
  const positioner = new LabelPositioner();
  positioner.setContainerSize(1920, 1080, { x: 0.5, y: 0, w: 0.5, h: 1 });

  // Mock a label element
  const el = document.createElement('div');
  positioner.registerElement('label1', el);

  // Mock camera that projects to NDC (0, 0) — world center maps to screen center
  // The test must use a real THREE.Camera stub or mock the project() method.
  // For interface-based testing, use a real OrthographicCamera configured so
  // that a known world position projects to a known NDC.
  // ...
});

it('falls back to full container when nvsBounds is absent', () => {
  const positioner = new LabelPositioner();
  positioner.setContainerSize(1920, 1080);
  // nvsBounds defaults to { x:0, y:0, w:1, h:1 }
  // projectToScreen with full bounds should produce the same result as the old implementation
});
```

**Note on camera mocking:** Three.js `Camera.project()` requires a real camera. Use `THREE.OrthographicCamera` with a known configuration to produce deterministic NDC values in tests. Do not mock `project()` — use a real camera object.

---

## Section 8: Removed APIs Summary

The following APIs are removed without deprecation shims. Any code that uses these APIs will fail to compile or produce incorrect behavior after this change is merged.

### `@brewsite/core`

1. **`sceneRootHandler` raw-child overlay collection** — The `sceneRootHandler` function in `packages/core/src/compiler/sceneDslCompiler.ts` no longer calls `helpers.compileChildrenSeparated(node, api)` or populates `api.state.sceneOverlay`. Non-DSL, non-`TextBox` JSX children of `<Scene>` are silently ignored.

2. **`SceneFrame.sceneOverlay` field** — The `sceneOverlay?: ReactNode` field is removed from the `SceneFrame` type in `sceneTrackTypes.ts`. Any code that reads `frame.sceneOverlay` will fail to compile.

3. **`SceneTrack.sceneOverlays` field** — The `sceneOverlays: Map<string, ReactNode>` field is removed from the `SceneTrack` type in `sceneTrackTypes.ts`. The field was previously used by `EngineOverlayHost` via `useSceneEngine`. Both the population path (in `sceneTrackCompiler.ts`) and the read path (in `useSceneEngine.ts` and `EngineOverlayHost.tsx`) are removed.

4. **`EngineOverlayHost` rendering `engine.sceneOverlays`** — `EngineOverlayHost` no longer reads any overlay content from the engine context. The old `const overlayContent = engine.sceneOverlays?.get(sceneId)` path and its rendered output are removed.

### `@brewsite/charts`

3. **`ChartTooltipOverlay` `camera` prop** — `ChartTooltipOverlayProps.camera?: THREE.Camera` is removed. Passing `camera` to `ChartTooltipOverlay` is a TypeScript compile error after this change.

4. **`ChartTooltipOverlay` `domElement` prop** — `ChartTooltipOverlayProps.domElement?: HTMLElement` is removed. Passing `domElement` to `ChartTooltipOverlay` is a TypeScript compile error after this change.

5. **`ChartTooltipOverlay` `position: fixed` rendering** — The tooltip no longer uses `position: fixed` with raw viewport pixel coordinates. It uses `position: absolute` within `EngineOverlayHost`. Any consumer code that relies on the tooltip appearing at viewport-level z-ordering (e.g., overlapping browser chrome) must restructure to place `ChartTooltipOverlay` inside `EngineOverlayHost`.

### `@brewsite/model`

7. **`LabelPositioner.setContainerSize(width, height)` two-arg signature** — The method signature is now `setContainerSize(width: number, height: number, nvsBounds?: NVSRect)`. The two-argument call continues to compile and work correctly at runtime (the optional parameter defaults to fullscreen). This is a backward-compatible extension of the public API signature — it is a minor change, not a breaking one.

### Confirmed No-Change: `EngineProvider`

`EngineProvider` gains no new props. The feature brief initially suggested adding AR layout props to `EngineProvider` — this was explicitly rejected in favor of the separate `EngineARContainer` component. `EngineProviderProps` is unchanged.

---

## Section 9: Parallelization Map

| Stream | Depends On | Files Exclusively Owned |
|---|---|---|
| A1 | Nothing | `packages/core/src/layout/types.ts` (new), `packages/core/src/layout/index.ts` (new), `packages/core/src/player/EngineARContainer.tsx` (new) |
| A1 also touches | — | `packages/core/src/player/index.ts` (add exports), `packages/core/src/index.ts` (add `./layout`), `packages/core/src/widget/index.ts` (add layout type re-exports) |
| A2 | A1 | `packages/core/src/elements/text-box/types.ts` (new), `packages/core/src/elements/text-box/dsl.tsx` (new), `packages/core/src/elements/text-box/compile.ts` (new), `packages/core/src/elements/text-box/TextBoxWidget.ts` (new), `packages/core/src/elements/text-box/index.ts` (new) |
| A2 also touches | — | `packages/core/src/elements/index.ts` (add TextBox exports), `packages/core/src/compiler/index.ts` (add TextBox to DSL surface) |
| A3 | A2 | `packages/core/src/player/EngineOverlayHost.tsx` (modified), `packages/core/src/compiler/sceneDslCompiler.ts` (modified), `packages/core/src/compiler/sceneTrackCompiler.ts` (remove Step 8 + sceneOverlays field from output), `packages/core/src/compiler/sceneTrackTypes.ts` (remove sceneOverlay + sceneOverlays fields), `packages/core/src/player/useSceneEngine.ts` (remove sceneOverlays field), `packages/core/src/player/TextBoxChildrenContext.ts` (new), `packages/core/src/player/plugins.ts` (modified — add configureRegistry + wrapProvider) |
| B | A1 | `packages/diagram/src/elements/diagram/canvas/types.ts`, `packages/diagram/src/elements/diagram/canvas/dsl.tsx`, `packages/diagram/src/elements/diagram/canvas/compile.ts`, `packages/diagram/src/elements/diagram/canvas/widget.ts` |
| C | A1 | `packages/charts/src/elements/chart/types.ts`, `packages/charts/src/elements/chart/dsl.tsx`, `packages/charts/src/elements/chart/compile.ts`, `packages/charts/src/elements/chart/ChartWidget.ts`, `packages/charts/src/player/ChartTooltipOverlay.tsx` |
| D | A1 | `packages/model/src/elements/model/types.ts`, `packages/model/src/elements/model/dsl.tsx`, `packages/model/src/elements/model/compile.ts`, `packages/model/src/elements/model/ModelWidget.ts`, `packages/model/src/player/LabelPositioner.ts` |
| E | A1, A2, A3, B, C, D | `apps/` scene files and page components only |

**No two streams own the same file.** The A2 developer must not touch `EngineOverlayHost.tsx`, `sceneDslCompiler.ts`, `sceneTrackTypes.ts`, `sceneTrackCompiler.ts`, `useSceneEngine.ts`, or `plugins.ts` — those belong to A3. The A3 developer must not touch `text-box/` source files or `coreHandlers.ts` — those belong to A2. B, C, and D own entirely separate packages.

**Note on `coreHandlers.ts`:** A3 does NOT modify `coreHandlers.ts`. The TextBox NodeHandler is installed via `registry.registerTypeFactory()` in `plugins.ts`, not via `registerNode()` in `coreHandlers.ts`. A2 also does not modify `coreHandlers.ts`. This file is untouched by both streams.

**Confirmed parallel schedule:**

```
Day 1:  A1 starts alone.
Day 2+: A1 merges → A2, B, C, D start in parallel.
        A2 defines TEXTBOX_NAMESPACE and childrenMap pattern.
Day 3+: A2 merges → A3 starts.
        B, C, D continue in parallel.
Day 4+: A3, B, C, D all merge → E starts.
```

---

## Section 10: Resolved Gaps

All three architect-flagged gaps are resolved. No TBD items remain.

### Gap 1: `WidgetRegistry.registerWidgetFactory` — RESOLVED

**Decision:** Use the existing `WidgetRegistry.registerTypeFactory(component, factory)` method. No new method is needed and `WidgetRegistry.ts` requires no changes. `registerTypeFactory` accepts a DSL component type and a factory `(props: Record<string, unknown>) => IWidget`, installs the NodeHandler once, and creates+registers a new widget on first encounter of each new `id` prop value. This is called from `corePlugin().configureRegistry(registry)` — the correct seam, since `configureRegistry` receives the live registry instance after all pre-constructed widgets are registered.

```typescript
// In corePlugin().configureRegistry():
registry.registerTypeFactory(
  TextBox,
  (props) => new TextBoxWidget(props['id'] as string, textBoxChildrenMap),
);
```

`coreHandlers.ts` is not modified. There is no `registerNode(TextBox, ...)` call anywhere.

### Gap 2: `sceneOverlays` Dead Fields — RESOLVED, REMOVED IN SCOPE

**Decision:** Remove `SceneFrame.sceneOverlay` and `SceneTrack.sceneOverlays` in scope. Audit confirmed all references are in `@brewsite/core` only — `sceneTrackTypes.ts`, `sceneTrackCompiler.ts`, `EngineOverlayHost.tsx`, `useSceneEngine.ts`, and two test files — all already modified or owned by streams A3. No downstream package or external consumer imports these fields. Removing them in scope eliminates dead code with no additional migration cost beyond what is already required by the overlay removal itself.

A3 stream scope additions for this removal:
- `packages/core/src/compiler/sceneTrackTypes.ts` — remove `sceneOverlay?: ReactNode` from `SceneFrame`; remove `sceneOverlays: Map<string, ReactNode>` from `SceneTrack`.
- `packages/core/src/compiler/sceneTrackCompiler.ts` — remove Step 8 (sceneOverlays map builder); remove `sceneOverlays` from the returned `SceneTrack` object.
- `packages/core/src/player/useSceneEngine.ts` — remove `sceneOverlays` field from the engine state type and its initialization.
- `packages/core/src/runtime/__tests__/SceneLifecycle.test.ts` — update mock to remove `sceneOverlays: new Map()`.
- `packages/core/src/player/__tests__/EngineOverlayHost.test.tsx` — update to remove `sceneOverlays` mock setup.

### Gap 3: `TextBoxWidget` VariableStore Write Access — RESOLVED

**Decision:** `TextBoxWidget` implements `IRenderable<TextBoxState>` alongside `ISceneElement<TextBoxState>`. `apply(state, ctx)` casts `ctx.variables` (typed as `VariableStoreReader`) to `VariableStore` for write access. The cast is documented with an inline comment: `ctx.variables` is always a `VariableStore` instance at runtime — the `VariableStoreReader` interface is a read-only view over the same object. This is an intentional internal contract between widget infrastructure and the engine. No construction-time `VariableStore` reference is passed. No changes to `WidgetInitContext` or `WidgetPlugin` are needed.

The `initialize()` method is a no-op. `dispose()` clears the widgetId from `childrenMap`. These satisfy the `IRenderable` contract without requiring any Three.js lifecycle.

---

## Appendix: Full Projection Formula Reference

All four projection formulas in this plan use the same math. For reference:

**NDC → NVS-sub-region pixel coordinates (absolute from AR container top-left):**

```
Given:
  ndcX ∈ [-1, 1]     (from THREE.Vector3.project(camera).x)
  ndcY ∈ [-1, 1]     (from THREE.Vector3.project(camera).y)
  containerWidth      (pixels — full AR-locked container width)
  containerHeight     (pixels — full AR-locked container height)
  nvsBounds.x ∈ [0,1] (sub-region left edge as fraction of container width)
  nvsBounds.y ∈ [0,1] (sub-region top edge as fraction of container height)
  nvsBounds.w ∈ [0,1] (sub-region width as fraction of container width)
  nvsBounds.h ∈ [0,1] (sub-region height as fraction of container height)

Compute:
  regionLeft   = nvsBounds.x * containerWidth
  regionTop    = nvsBounds.y * containerHeight
  regionWidth  = nvsBounds.w * containerWidth
  regionHeight = nvsBounds.h * containerHeight

  pixelX = regionLeft + (ndcX * 0.5 + 0.5) * regionWidth
  pixelY = regionTop  + (-ndcY * 0.5 + 0.5) * regionHeight

Result:
  (pixelX, pixelY) are absolute pixel offsets from the AR container top-left.
  These can be used directly with:
    - CSS: position: absolute; left: pixelX; top: pixelY
    - CSS transform: transform: translate(pixelXpx, pixelYpx)
```

**Pointer → NDC within NVS sub-region (for raycasting):**

```
Given:
  clientX, clientY     (MouseEvent.clientX/Y)
  canvasElement        (HTMLCanvasElement — the Three.js renderer DOM element)
  nvsBounds            (NVSRect of the widget within the AR container)

Compute:
  rect         = canvasElement.getBoundingClientRect()
  pointerX     = clientX - rect.left    (pixels from canvas left)
  pointerY     = clientY - rect.top     (pixels from canvas top)

  regionLeft   = nvsBounds.x * rect.width
  regionTop    = nvsBounds.y * rect.height
  regionWidth  = nvsBounds.w * rect.width
  regionHeight = nvsBounds.h * rect.height

  subX = pointerX - regionLeft   (pixels from sub-region left)
  subY = pointerY - regionTop    (pixels from sub-region top)

  ndcX = (subX / regionWidth) * 2 - 1        range [-1, 1]
  ndcY = -(subY / regionHeight) * 2 + 1      range [-1, 1] (Y inverted)

Use ndcX, ndcY with THREE.Raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera).
```

**`--scene-scale` CSS variable:**

```
sceneScale = containerPixelWidth / referenceWidth

At referenceWidth=1920, containerPixelWidth=1920: sceneScale=1.0
At referenceWidth=1920, containerPixelWidth=960:  sceneScale=0.5
At referenceWidth=1920, containerPixelWidth=3840: sceneScale=2.0

Applied as: element.style.setProperty('--scene-scale', String(sceneScale))
Used in CSS: transform: scale(var(--scene-scale))
```
