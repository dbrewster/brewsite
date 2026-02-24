---
title: "HUD Overlay System — Annotation System Replacement"
doc_type: plan
owner: brewflow-architect
status: active
updated: 2026-02-23
---

# HUD Overlay System — Annotation System Replacement

## Overview

This plan replaces the annotation system (follow/attach DOM positioning, `AnnotationPositioner`,
`ContentSlotContext`, `annotationBlocks.tsx`, `annotationCompiler.ts`, and `src/annotations/**`)
with a simple, tick-driven React HUD module (`src/hud/`). The HUD is pure DOM — no 3D attachment,
no direct DOM mutation, no positioner loop. Scene authors declare `<HudItem>` nodes inside a
`<Hud>` block; the compiler writes them onto `SceneFrame.hudItems`; the tick bake produces
`SceneTrackTick.hudPrimitives`; `ScenePlayer` renders them via `<HudOverlay>`.

The label system (3D bone-follow, line/dot, `LabelItem`) is preserved with a dedicated
`LabelPositioner`/`LabelPositionerContext` pair that replaces the annotation positioner
dependency in `LabelItem.tsx`. The label DSL, types, and `compileLabels()` are **not touched**.

---

## Goals

1. Delete the entire annotation subsystem: `src/annotations/`, `annotationPositioner`,
   `ContentSlotContext`, `annotationBlocks`, `annotationCompiler`.
2. Add `src/hud/` module: `types.ts`, `HudItem.tsx`, `HudOverlay.tsx`, `index.ts`.
3. Add HUD DSL block: `src/compiler/blocks/hudBlocks.tsx`.
4. Add HUD compiler: `src/compiler/hudCompiler.ts`.
5. Thread HUD data through `SceneFrame → SceneTrackTick` (analogous to labels).
6. Preserve label 3D positioning via a new `LabelPositioner` / `LabelPositionerContext`.
7. Update `ScenePlayer` and `useSceneEngine` to use the new HUD and label positioner.
8. Update `requirements/prd/prd_architecture.md`.
9. Add tests for the new HUD pipeline.

---

## Non-Goals

- No animation or transition logic for HUD items (consumer-owned via AnimeJS or CSS).
- No placement or follow-target API on HUD items.
- No changes to label DSL (`src/labels/dsl.tsx`), label types (`src/labels/types.ts`),
  or `compileLabels()` in `src/compiler/labelCompiler.ts`.

---

## File Inventory

### Files to CREATE (13 files)

| Path | Purpose |
|------|---------|
| `src/hud/types.ts` | `HudItemDefinition` and `HudItemResolved` contracts |
| `src/hud/HudItem.tsx` | Renders a single resolved HUD item as a DOM div |
| `src/hud/HudOverlay.tsx` | Maps `HudItemResolved[]` to `HudItem` components |
| `src/hud/index.ts` | Public barrel for the hud module |
| `src/hud/__tests__/HudItem.test.tsx` | Unit tests for HudItem rendering |
| `src/hud/__tests__/HudOverlay.test.tsx` | Unit tests for HudOverlay |
| `src/compiler/blocks/hudBlocks.tsx` | `<Hud>` and `<HudItem>` DSL components |
| `src/compiler/hudCompiler.ts` | `compileHudItems()` pass-through compiler |
| `src/compiler/__tests__/hudBlocks.test.tsx` | Tests for HUD DSL compilation |
| `src/compiler/__tests__/hudCompiler.test.ts` | Tests for `compileHudItems()` |
| `src/player/LabelPositioner.ts` | Label-only DOM positioning (replaces AnnotationPositioner) |
| `src/player/LabelPositionerContext.ts` | React context for `LabelPositioner` |
| `src/player/__tests__/LabelPositioner.test.ts` | Tests for `LabelPositioner.update()` |

### Files to MODIFY (10 files)

| Path | Change Summary |
|------|----------------|
| `src/compiler/sceneTrackTypes.ts` | Swap annotation fields → HUD fields |
| `src/compiler/sceneDslTypes.ts` | Replace `pushAnnotation` → `pushHudItem` in `CompileApi` |
| `src/compiler/sceneDslCompiler.ts` | Update `createApi` to wire `pushHudItem` |
| `src/compiler/sceneTrackCompiler.ts` | Replace `compileAnnotations` with `compileHudItems`; update `buildDelta` |
| `src/compiler/index.ts` | Replace annotation DSL exports with HUD DSL exports |
| `src/player/ScenePlayer.tsx` | Remove annotation system; add HudOverlay + LabelPositioner |
| `src/player/useSceneEngine.ts` | Replace `annotationPositioner` → `labelPositioner` |
| `src/player/index.ts` | Update barrel: remove annotation exports, add label positioner exports |
| `src/labels/LabelItem.tsx` | Minimal: swap `useAnnotationPositioner` → `useLabelPositioner` |
| `src/player/__tests__/useSceneEngine.test.tsx` | Update positioner test to use `LabelPositioner` |

### Files to DELETE (21 files)

```
src/annotations/annotationTypes.ts
src/annotations/annotationDefaults.ts
src/annotations/annotationLayout.ts
src/annotations/annotationLineMath.ts
src/annotations/annotationTargets.ts
src/annotations/annotationFonts.ts
src/annotations/AnnotationItem.tsx
src/annotations/index.ts
src/annotations/__tests__/AnnotationLayout.test.ts
src/annotations/__tests__/AnnotationLineMath.test.ts
src/annotations/__tests__/AnnotationItem.test.tsx
src/player/AnnotationPositioner.ts
src/player/AnnotationPositionerContext.ts
src/player/ContentSlotContext.ts
src/player/__tests__/AnnotationPositioner.test.ts
src/player/__tests__/AnnotationPositionerContext.test.tsx
src/player/__tests__/ContentSlotContext.test.tsx
src/compiler/annotationCompiler.ts
src/compiler/blocks/annotationBlocks.tsx
src/compiler/__tests__/annotationBlocks.test.tsx
src/compiler/__tests__/annotationCompiler.test.ts
```

---

## Section 1 — Create `src/hud/` Module

### 1.1 `src/hud/types.ts` (new file)

```typescript
// Defines the HUD item data contracts: HudItemDefinition (authored) and HudItemResolved (compiled/rendered).

import type { CSSProperties, ReactNode } from 'react';

/**
 * An authored HUD item definition — written by scene authors inside <HudItem>.
 * Stored on SceneFrame.hudItems during compilation.
 */
export type HudItemDefinition = {
  /** Stable identifier. Used for React keying and data-hud-id DOM attribute. */
  id: string;
  /** When false, excluded from compiled output. Defaults to true. */
  enabled?: boolean;
  /** Optional CSS class applied to the root div. */
  className?: string;
  /** Optional inline styles applied to the root div. All positioning is CSS-owned by the consumer. */
  style?: CSSProperties;
  /** React content to render inside this HUD slot. */
  node: ReactNode;
};

/**
 * A compiled/resolved HUD item. Currently a pass-through of HudItemDefinition.
 * Reserved as the stable seam for future defaulting or merging logic in hudCompiler.ts.
 */
export type HudItemResolved = HudItemDefinition;
```

### 1.2 `src/hud/HudItem.tsx` (new file)

```tsx
// Renders a single resolved HUD item as a positioned DOM container.

import type { ReactElement } from 'react';
import type { HudItemResolved } from './types';

export type HudItemProps = {
  item: HudItemResolved;
};

/**
 * Renders a single HUD item as a div with data-hud-id, className, and style.
 * Returns null when enabled === false (already filtered by compiler, but defensive).
 * All layout/positioning is CSS-owned by the consuming application.
 */
export const HudItem = ({ item }: HudItemProps): ReactElement | null => {
  if (item.enabled === false) return null;
  return (
    <div
      data-hud-id={item.id}
      className={item.className}
      style={item.style}
    >
      {item.node}
    </div>
  );
};
```

### 1.3 `src/hud/HudOverlay.tsx` (new file)

```tsx
// Renders all resolved HUD items from the current tick into the DOM overlay layer.

import type { ReactElement } from 'react';
import type { HudItemResolved } from './types';
import { HudItem } from './HudItem';

export type HudOverlayProps = {
  /** The hudPrimitives from the current SceneTrackTick. Pass [] when tick is null. */
  items: HudItemResolved[];
};

/**
 * Maps a tick's hudPrimitives into a flat set of HudItem components.
 * Renders as a React Fragment — no wrapping element.
 */
export const HudOverlay = ({ items }: HudOverlayProps): ReactElement => {
  return (
    <>
      {items.map((item) => (
        <HudItem key={item.id} item={item} />
      ))}
    </>
  );
};
```

### 1.4 `src/hud/index.ts` (new file)

```typescript
// Public exports for the HUD module. Import HudItemDefinition/HudItemResolved for
// type-level usage; import HudOverlay for rendering in ScenePlayer.

export type { HudItemDefinition, HudItemResolved } from './types';
export { HudItem } from './HudItem';
export type { HudItemProps } from './HudItem';
export { HudOverlay } from './HudOverlay';
export type { HudOverlayProps } from './HudOverlay';
```

---

## Section 2 — HUD DSL Blocks

### 2.1 `src/compiler/blocks/hudBlocks.tsx` (new file)

The naming convention follows the existing element pattern: the DSL components (`Hud`, `HudItem`)
compile to nothing at render time (they return null) and produce `HudItemDefinition` entries via
`api.pushHudItem()`. The `HudItem` exported here is the **DSL authoring component**, distinct
from the `HudItem` render component in `src/hud/HudItem.tsx`.

```tsx
// DSL authoring components for the HUD overlay system.
// <Hud> acts as a container; <HudItem> compiles into HudItemDefinition on SceneFrame.

import type { CSSProperties, ReactNode } from 'react';
import { registerNode } from '../registry';
import type { HudItemDefinition } from '../../hud/types';
import type { CompileApi, CompileHelpers } from '../sceneDslTypes';

export type HudProps = {
  children?: ReactNode;
};

export type HudItemDslProps = {
  /** Stable identifier. Used for React keying and data-hud-id DOM attribute. */
  id: string;
  /** When false, item is excluded from compiled hudPrimitives. Defaults to true. */
  enabled?: boolean;
  /** Optional CSS class applied to the rendered HudItem container. */
  className?: string;
  /** Optional inline styles. Positioning is fully CSS-owned — no placement logic here. */
  style?: CSSProperties;
  /** React content to place inside the HUD slot. */
  node: ReactNode;
};

/** Container DSL component. Compiles its children. No output of its own. */
export const Hud = (_props: HudProps) => null;
Hud.displayName = 'Hud';

/**
 * Authoring DSL component for a single HUD item.
 * Compiles into a HudItemDefinition pushed to SceneFrame.hudItems.
 */
export const HudItem = (_props: HudItemDslProps) => null;
HudItem.displayName = 'HudItem';

registerNode(Hud, (node: import('react').ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  helpers.compileChildren(node, api);
});

registerNode(HudItem, (node: import('react').ReactElement, api: CompileApi) => {
  const props = node.props as HudItemDslProps;
  const def: HudItemDefinition = {
    id: props.id,
    node: props.node,
  };
  if (props.enabled !== undefined) def.enabled = props.enabled;
  if (props.className !== undefined) def.className = props.className;
  if (props.style !== undefined) def.style = props.style;
  api.pushHudItem(def);
});
```

---

## Section 3 — Compiler Types and Pipeline

### 3.1 `src/compiler/sceneTrackTypes.ts` (full replacement)

Remove: `AnnotationDefinition`, `AnnotationDefaults`, `AnnotationResolved` imports/re-exports.
Remove: `annotations`, `annotationDefaults` from `SceneFrame`.
Remove: `annotationPrimitives` from `SceneTrackTick`.
Add: `hudItems?: HudItemDefinition[]` to `SceneFrame`.
Add: `hudPrimitives?: HudItemResolved[]` to `SceneTrackTick`.
Update: `SceneFrameDelta` — replace annotation fields with `hudItems`.

Complete new file:

```typescript
// Core data contracts for the scene compilation pipeline.
// Types here flow compiler → runtime → player with no circular dependencies.

import type { HudItemDefinition, HudItemResolved } from '../hud/types';
import type { LabelResolved } from '../labels/types';
import type { JsonPrimitive } from '../widget/VariableStore';

// Re-export for consumers that import from here for convenience
export type { LabelResolved } from '../labels/types';
export type { HudItemResolved } from '../hud/types';

// ─── ClipMeta ─────────────────────────────────────────────────────────────────

/** Metadata about a single animation clip, used in CompileExtraContext. */
export type ClipMeta = {
  name: string;
  duration: number;
};

// ─── SceneFrame ───────────────────────────────────────────────────────────────

/**
 * The declared state of a scene at a single point in time.
 * Produced by the DSL compiler. Consumed by the track compiler to bake SceneTrackTick[].
 */
export type SceneFrame = {
  id: string;
  scrollProgress: number;
  widgets: Record<string, unknown>;
  meta?: Record<string, JsonPrimitive>;
  /** HUD overlay items authored for this scene. Compiled to hudPrimitives per tick. */
  hudItems?: HudItemDefinition[];
  /** Label definitions authored for this scene. Compiled to labelPrimitives per tick. */
  labels?: LabelResolved[];
};

// ─── SceneFrameDelta ──────────────────────────────────────────────────────────

/**
 * A sparse diff between two SceneFrame states.
 * Fields are only present when the value changed.
 */
export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  hudItems?: HudItemDefinition[];
  labels?: SceneFrame['labels'];
};

// ─── SceneWindow ─────────────────────────────────────────────────────────────

export type SceneWindow = {
  id: string;
  index: number;
  start: number;
  end: number;
};

// ─── SceneTrackTick ───────────────────────────────────────────────────────────

/**
 * A single pre-baked frame in the scene track. Indexed for O(1) sampling.
 * Produced by sceneTrackCompiler. Consumed by RuntimeDriver and ScenePlayer.
 */
export type SceneTrackTick = {
  index: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  blockProgress: number;
  state: SceneFrame;
  /** Resolved HUD items for this tick. Rendered by HudOverlay in ScenePlayer. */
  hudPrimitives?: HudItemResolved[];
  /** Resolved labels for this tick. Positioned by LabelPositioner in render loop. */
  labelPrimitives?: LabelResolved[];
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  widgetExtras?: Record<string, unknown>;
};

// ─── SceneTrack ───────────────────────────────────────────────────────────────

export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
};
```

### 3.2 `src/compiler/sceneDslTypes.ts` (modified)

Replace `pushAnnotation` with `pushHudItem`. Remove `AnnotationDefinition` import.

**Old lines 4–5:**
```typescript
import type { AnnotationDefinition } from '../annotations/annotationTypes';
import type { LabelResolved } from '../labels/types';
```

**New lines 4–5:**
```typescript
import type { HudItemDefinition } from '../hud/types';
import type { LabelResolved } from '../labels/types';
```

**Old `CompileApi.pushAnnotation`:**
```typescript
  pushAnnotation: (annotation: AnnotationDefinition) => void;
```

**New `CompileApi.pushHudItem`:**
```typescript
  pushHudItem: (item: HudItemDefinition) => void;
```

Complete new `CompileApi` type:
```typescript
export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  pushHudItem: (item: HudItemDefinition) => void;
  pushLabel: (label: LabelResolved) => void;
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};
```

### 3.3 `src/compiler/sceneDslCompiler.ts` (modified — `createApi` function only)

Replace the `pushAnnotation` implementation with `pushHudItem`.

**Old `createApi`:**
```typescript
const createApi = (context: SceneSnapshotContext): CompileApi => {
  const state: SceneFrame = {
    id: '',
    scrollProgress: 0,
    widgets: {},
  };
  return {
    context,
    state,
    pushAnnotation: (annotation) => {
      state.annotations = state.annotations ?? [];
      state.annotations.push(annotation);
    },
    pushLabel: (label) => {
      state.labels = state.labels ?? [];
      state.labels.push(label);
    },
    setWidgetState: (widgetId, widgetState) => {
      state.widgets[widgetId] = widgetState;
    },
    setSceneMeta: (meta) => {
      if (meta.id) state.id = meta.id;
      if (meta.meta) state.meta = meta.meta;
    },
  };
};
```

**New `createApi`:**
```typescript
const createApi = (context: SceneSnapshotContext): CompileApi => {
  const state: SceneFrame = {
    id: '',
    scrollProgress: 0,
    widgets: {},
  };
  return {
    context,
    state,
    pushHudItem: (item) => {
      state.hudItems = state.hudItems ?? [];
      state.hudItems.push(item);
    },
    pushLabel: (label) => {
      state.labels = state.labels ?? [];
      state.labels.push(label);
    },
    setWidgetState: (widgetId, widgetState) => {
      state.widgets[widgetId] = widgetState;
    },
    setSceneMeta: (meta) => {
      if (meta.id) state.id = meta.id;
      if (meta.meta) state.meta = meta.meta;
    },
  };
};
```

### 3.4 `src/compiler/hudCompiler.ts` (new file)

```typescript
// Compiles HudItemDefinition[] into HudItemResolved[] for a single scene tick.
// Currently a pass-through filter; the dedicated function is the stable seam for
// future defaulting, merging, or style-resolution logic.

import type { HudItemDefinition, HudItemResolved } from '../hud/types';

/**
 * Compiles a scene's hudItems into resolved HUD primitives.
 * Items with enabled === false are excluded.
 * Returns an empty array for undefined or empty input.
 */
export const compileHudItems = (
  items: HudItemDefinition[] | undefined,
): HudItemResolved[] => {
  if (!items || items.length === 0) return [];
  return items.filter((item) => item.enabled !== false);
};
```

### 3.5 `src/compiler/sceneTrackCompiler.ts` (modified — two locations)

**Location A — Imports (top of file)**

Remove:
```typescript
import { compileAnnotations } from './annotationCompiler';
```

Add:
```typescript
import { compileHudItems } from './hudCompiler';
```

**Location B — `buildDelta` function**

Old delta body (replace the annotation/annotationDefaults comparisons):
```typescript
  if (serialize(prev.annotations) !== serialize(next.annotations)) {
    delta.annotations = next.annotations;
  }
  if (serialize(prev.annotationDefaults) !== serialize(next.annotationDefaults)) {
    delta.annotationDefaults = next.annotationDefaults;
  }
```

New delta body (HUD items):
```typescript
  if (serialize(prev.hudItems) !== serialize(next.hudItems)) {
    delta.hudItems = next.hudItems;
  }
```

**Location C — Step 6 (annotation/label compilation block)**

Old Step 6:
```typescript
  // ── Step 6: Compile annotations and labels ───────────────────────────────────
  // These live on SceneFrame directly and are compiled per-frame from the snapshots.
  const warnOnce = new Set<string>();
  for (const frame of frames) {
    const isLast = frame.index === totalFrames - 1;
    const blockIdx = isLast ? snapshots.length - 1 : Math.min(Math.floor(frame.index / blockSize), numTransitions - 1);
    const fromSnap = snapshots[blockIdx];
    const toSnap = snapshots[blockIdx + 1];
    if (!fromSnap) continue;
    if (fromSnap.annotations?.length || toSnap?.annotations?.length) {
      frame.annotationPrimitives = compileAnnotations(frame.state, fromSnap, warnOnce);
    }
    if (fromSnap.labels?.length || toSnap?.labels?.length) {
      frame.labelPrimitives = compileLabels(fromSnap.labels, toSnap?.labels, { sceneProgress: frame.blockProgress });
    }
  }
```

New Step 6:
```typescript
  // ── Step 6: Compile HUD items and labels ─────────────────────────────────────
  // HUD items come from the current scene snapshot (no interpolation across scenes).
  // Labels interpolate between fromSnap and toSnap using compileLabels().
  for (const frame of frames) {
    const isLast = frame.index === totalFrames - 1;
    const blockIdx = isLast ? snapshots.length - 1 : Math.min(Math.floor(frame.index / blockSize), numTransitions - 1);
    const fromSnap = snapshots[blockIdx];
    const toSnap = snapshots[blockIdx + 1];
    if (!fromSnap) continue;
    if (fromSnap.hudItems?.length) {
      frame.hudPrimitives = compileHudItems(fromSnap.hudItems);
    }
    if (fromSnap.labels?.length || toSnap?.labels?.length) {
      frame.labelPrimitives = compileLabels(fromSnap.labels, toSnap?.labels, { sceneProgress: frame.blockProgress });
    }
  }
```

### 3.6 `src/compiler/index.ts` (modified)

Old last line:
```typescript
export { Annotations, MessageAnnotation } from './blocks/annotationBlocks';
```

New last line:
```typescript
export { Hud, HudItem } from './blocks/hudBlocks';
export type { HudProps, HudItemDslProps } from './blocks/hudBlocks';
```

---

## Section 4 — Label Positioner (preserves label 3D positioning)

The existing `AnnotationPositioner` handles both annotations and labels. After annotation
deletion, labels still need DOM positioning via 3D bone projection. A dedicated
`LabelPositioner` is extracted from the annotation positioner with annotation-specific
code removed.

### 4.1 `src/player/LabelPositioner.ts` (new file)

```typescript
// Handles DOM positioning of label elements using 3D bone world-position projection.
// This is the label-only successor to AnnotationPositioner. No annotation logic here.

import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { LabelResolved } from '../labels/types';

/**
 * Manages DOM element registration and per-frame CSS-transform positioning
 * for label elements. Called once per render loop tick.
 */
export class LabelPositioner {
  private elements = new Map<string, HTMLElement>();
  private containerWidth = 0;
  private containerHeight = 0;
  private warnedMissingTargets = new Set<string>();

  registerElement(id: string, el: HTMLElement | null): void {
    if (el) {
      this.elements.set(id, el);
    } else {
      this.elements.delete(id);
    }
  }

  setContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  update(
    labels: LabelResolved[],
    camera: Camera,
    boneWorldPositions: Map<string, [number, number, number]>,
    targetColors?: Map<string, string>,
  ): void {
    if (this.containerWidth <= 0 || this.containerHeight <= 0) return;

    for (const label of labels) {
      const el = this.elements.get(label.id);
      if (!el) continue;
      if (label.enabled === false) {
        el.style.display = 'none';
        continue;
      }
      const targetId = label.targetPartId;
      const bonePos = boneWorldPositions.get(targetId);
      if (!bonePos) {
        if (!this.warnedMissingTargets.has(targetId)) {
          console.warn(`[LabelPositioner] missing target part "${targetId}" for label "${label.id}"`);
          this.warnedMissingTargets.add(targetId);
        }
        continue;
      }
      const targetColor = targetColors?.get(targetId);
      const offset = label.labelOffset ?? [0, 0, 0];
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
      const width = el.offsetWidth || 0;
      const height = el.offsetHeight || 0;
      const dx = targetScreen.x - labelScreen.x;
      const dy = targetScreen.y - labelScreen.y;
      const anchorX = dx >= 0 ? width : 0;
      const anchorY = dy >= 0 ? height : 0;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = length > 0.0001 ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
      el.style.setProperty('--label-line-length', `${length}px`);
      el.style.setProperty('--label-line-angle', `${angle}deg`);
      el.style.setProperty('--label-line-origin-x', `${anchorX}px`);
      el.style.setProperty('--label-line-origin-y', `${anchorY}px`);
      if (label.style?.color === 'target-color' && targetColor) {
        el.style.setProperty('--label-color', targetColor);
      } else {
        el.style.removeProperty('--label-color');
      }
      if (label.style?.lineColor === 'target-color' && targetColor) {
        el.style.setProperty('--label-line-color', targetColor);
      } else {
        el.style.removeProperty('--label-line-color');
      }
      el.style.transform = `translate(${labelScreen.x - anchorX}px, ${labelScreen.y - anchorY}px)`;
      el.style.display = '';
    }
  }
}

const projectToScreen = (
  worldPos: [number, number, number],
  camera: Camera,
  width: number,
  height: number,
): { x: number; y: number } => {
  const vec = new Vector3(worldPos[0], worldPos[1], worldPos[2]);
  vec.project(camera);
  const x = (vec.x * 0.5 + 0.5) * width;
  const y = (-vec.y * 0.5 + 0.5) * height;
  return { x, y };
};
```

### 4.2 `src/player/LabelPositionerContext.ts` (new file)

```typescript
// React context providing the LabelPositioner instance to LabelItem.

import { createContext, useContext } from 'react';
import type { LabelPositioner } from './LabelPositioner';

export const LabelPositionerContext = createContext<LabelPositioner | null>(null);

export const useLabelPositioner = (): LabelPositioner => {
  const ctx = useContext(LabelPositionerContext);
  if (!ctx) {
    throw new Error('[useLabelPositioner] must be used inside <ScenePlayer>');
  }
  return ctx;
};
```

---

## Section 5 — Update ScenePlayer

### 5.1 `src/labels/LabelItem.tsx` (minimal modification)

**Only change:** swap `useAnnotationPositioner` → `useLabelPositioner`.

Old import line:
```typescript
import { useAnnotationPositioner } from '../player/AnnotationPositionerContext';
```

New import line:
```typescript
import { useLabelPositioner } from '../player/LabelPositionerContext';
```

Old usage line:
```typescript
  const positioner = useAnnotationPositioner();
```

New usage line:
```typescript
  const positioner = useLabelPositioner();
```

No other changes to `LabelItem.tsx`. The rendering logic, CSS custom properties, and
line/dot geometry remain identical.

### 5.2 `src/player/useSceneEngine.ts` (modified)

**Change 1 — imports:** Remove annotation positioner import, add label positioner import.

Old:
```typescript
import type { AnnotationPositioner } from './AnnotationPositioner';
```

New:
```typescript
import type { LabelPositioner } from './LabelPositioner';
```

**Change 2 — `UseSceneEngineOptions` type:** Rename field.

Old:
```typescript
  annotationPositioner?: AnnotationPositioner;
```

New:
```typescript
  labelPositioner?: LabelPositioner;
```

**Change 3 — `setViewportSize` callback:** Update field reference.

Old:
```typescript
    if (options.annotationPositioner) {
      options.annotationPositioner.setContainerSize(width, height);
    }
  }, [options.annotationPositioner]);
```

New:
```typescript
    if (options.labelPositioner) {
      options.labelPositioner.setContainerSize(width, height);
    }
  }, [options.labelPositioner]);
```

**Change 4 — render loop:** Update positioner call. Remove annotation primitives.

Old:
```typescript
        if (options.annotationPositioner && tick) {
          options.annotationPositioner.update(
            tick.annotationPrimitives ?? [],
            tick.labelPrimitives ?? [],
            camera,
            driver.getBoneWorldPositions(),
            driver.getTargetColors(),
          );
        }
```

New:
```typescript
        if (options.labelPositioner && tick) {
          options.labelPositioner.update(
            tick.labelPrimitives ?? [],
            camera,
            driver.getBoneWorldPositions(),
            driver.getTargetColors(),
          );
        }
```

**Change 5 — useEffect dependency array:** Update dep reference.

Old:
```typescript
  }, [sceneTrack, getGlobalProgress, options.annotationPositioner, options.fpsCap, options.onReady, driverReady, debugLog]);
```

New:
```typescript
  }, [sceneTrack, getGlobalProgress, options.labelPositioner, options.fpsCap, options.onReady, driverReady, debugLog]);
```

### 5.3 `src/player/ScenePlayer.tsx` (major modification)

**Remove imports:**
```typescript
import { ContentSlotContext } from './ContentSlotContext';
import { AnnotationPositioner } from './AnnotationPositioner';
import { AnnotationPositionerContext } from './AnnotationPositionerContext';
import { AnnotationItem } from '../annotations/AnnotationItem';
```

**Add imports:**
```typescript
import { HudOverlay } from '../hud/HudOverlay';
import { LabelPositioner } from './LabelPositioner';
import { LabelPositionerContext } from './LabelPositionerContext';
```

**Remove from `ScenePlayerProps`:**
```typescript
  contentSlots?: Record<string, ReactNode>;
```

**Remove from component body:**
```typescript
  const annotationPositioner = useMemo(() => new AnnotationPositioner(), []);
  // ...
  const contentSlots = useMemo(() => props.contentSlots ?? {}, [props.contentSlots]);
```

**Add to component body:**
```typescript
  const labelPositioner = useMemo(() => new LabelPositioner(), []);
```

**Remove from `useSceneEngine` call:**
```typescript
    annotationPositioner,
```

**Add to `useSceneEngine` call:**
```typescript
    labelPositioner,
```

**Remove variables:**
```typescript
  const annotations = engine.frameState.tick?.annotationPrimitives ?? [];
```

**Update labels variable (no change needed, already reads `tick?.labelPrimitives`).**

**Remove Provider wrappers:**
```tsx
<ContentSlotContext.Provider value={contentSlots}>
  <AnnotationPositionerContext.Provider value={annotationPositioner}>
    ...
  </AnnotationPositionerContext.Provider>
</ContentSlotContext.Provider>
```

**Add LabelPositioner Provider** (replaces annotation provider in the JSX tree):
```tsx
<LabelPositionerContext.Provider value={labelPositioner}>
  ...
</LabelPositionerContext.Provider>
```

**Replace annotation rendering inside EngineScrollRegion children:**

Old:
```tsx
              <EngineScrollRegion key={hmrVersion} engine={engine}>
                <>
                  {annotations.map((annotation) => (
                    <AnnotationItem key={annotation.id} annotation={annotation} />
                  ))}
                  {labels.map((label) => (
                    <LabelItem key={label.id} label={label} />
                  ))}
                  {props.children}
                </>
              </EngineScrollRegion>
```

New:
```tsx
              <EngineScrollRegion key={hmrVersion} engine={engine}>
                <>
                  <HudOverlay items={engine.frameState.tick?.hudPrimitives ?? []} />
                  {labels.map((label) => (
                    <LabelItem key={label.id} label={label} />
                  ))}
                  {props.children}
                </>
              </EngineScrollRegion>
```

Complete updated `ScenePlayerProps` type:
```typescript
export type ScenePlayerProps = {
  sceneGroup: SceneGroup;
  manifestUrl: string;
  widgetSetup: (manifest: AssetManifest | null) => WidgetRegistry;
  className?: string;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  placeholder?: ReactNode;
  children?: ReactNode;
};
```

Note: `contentSlots` is removed. Consumers using `contentSlots` to inject React content
must migrate to authoring that content directly via the HUD DSL (`<HudItem node={...} />`).

### 5.4 `src/player/index.ts` (modified barrel)

Remove:
```typescript
export { ContentSlotContext, useContentSlot } from './ContentSlotContext';
export { AnnotationPositioner } from './AnnotationPositioner';
export { useAnnotationPositioner } from './AnnotationPositionerContext';
```

Add:
```typescript
export { LabelPositioner } from './LabelPositioner';
export { LabelPositionerContext, useLabelPositioner } from './LabelPositionerContext';
```

---

## Section 6 — Delete Annotation System

The following files must be deleted in their entirety. No references to these files
should remain after the modifications in Sections 3–5 are applied.

```bash
# Annotation module
rm -rf src/annotations/

# Annotation positioner and context
rm src/player/AnnotationPositioner.ts
rm src/player/AnnotationPositionerContext.ts
rm src/player/ContentSlotContext.ts

# Annotation compiler
rm src/compiler/annotationCompiler.ts
rm src/compiler/blocks/annotationBlocks.tsx

# Annotation tests
rm src/annotations/__tests__/AnnotationLayout.test.ts
rm src/annotations/__tests__/AnnotationLineMath.test.ts
rm src/annotations/__tests__/AnnotationItem.test.tsx
rm src/player/__tests__/AnnotationPositioner.test.ts
rm src/player/__tests__/AnnotationPositionerContext.test.tsx
rm src/player/__tests__/ContentSlotContext.test.tsx
rm src/compiler/__tests__/annotationBlocks.test.tsx
rm src/compiler/__tests__/annotationCompiler.test.ts
```

**Verify after deletion:** `pnpm typecheck` must pass with no remaining references to
`AnnotationPositioner`, `ContentSlotContext`, `pushAnnotation`, `annotationPrimitives`,
`compileAnnotations`, or any import from `src/annotations/`.

---

## Section 7 — PRD Update

### 7.1 `requirements/prd/prd_architecture.md`

**Target section:** "Overlay Architecture" (or equivalent section describing the two-tier
overlay model, AnnotationPositioner, AnnotationPlacement, and ContentSlotContext).

**Replace the overlay architecture section** with the following content:

```markdown
## Overlay Architecture

The overlay system is split into two independent layers:

### HUD Overlay (React DOM — tick-driven)

`HudOverlay` renders a flat list of `HudItemResolved` items from `SceneTrackTick.hudPrimitives`.
It has no knowledge of 3D space. All positioning is CSS-owned by the consuming application.
Scene authors declare items using `<Hud><HudItem id="..." node={...} /></Hud>` in scene DSL.
The compiler writes `HudItemDefinition[]` to `SceneFrame.hudItems`; `compileHudItems()` produces
`HudItemResolved[]` per tick; `ScenePlayer` renders `<HudOverlay items={tick.hudPrimitives ?? []} />`.

There is no positioner loop, no DOM mutation, and no contentId resolution mechanism.
External animation tooling (e.g., AnimeJS) targets items via the `data-hud-id` attribute.

**Data flow:**
```
<HudItem> DSL → HudItemDefinition (SceneFrame.hudItems)
  → compileHudItems() → HudItemResolved (SceneTrackTick.hudPrimitives)
  → <HudOverlay> → <HudItem> DOM div[data-hud-id]
```

### Label Overlay (3D bone-follow — positioner-driven)

`LabelItem` renders label text and a connecting line targeting a 3D bone. Position is
computed in the render loop via `LabelPositioner.update()`, which projects bone world
positions through the camera into screen space and applies CSS `transform: translate(...)`.

`LabelPositioner` is instantiated in `ScenePlayer`, provided via `LabelPositionerContext`,
and consumed by `LabelItem` via `useLabelPositioner()`. It is passed to `useSceneEngine`
as `options.labelPositioner` so the render loop can call `.update()` each frame.
```

**Remove from PRD:**
- Any mention of `AnnotationPositioner`, `AnnotationPositionerContext`
- Any mention of `ContentSlotContext`, `useContentSlot`, `contentSlots` prop
- Any mention of `annotationPrimitives`, `compileAnnotations`, `annotationDefaults`
- The two-tier annotation overlay model
- `AnnotationPlacement` (mode: `fixed`, mode: `follow`)
- `AnnotationDefinition`, `AnnotationResolved`, `AnnotationDefaults`

**Update data structure tables/sections** to reflect:
- `SceneFrame.hudItems?: HudItemDefinition[]` (replaces `annotations`)
- `SceneTrackTick.hudPrimitives?: HudItemResolved[]` (replaces `annotationPrimitives`)
- `ScenePlayerProps.contentSlots` removed

---

## Section 8 — Tests

Testing philosophy: interface-based stateful tests. Pass real inputs, assert real outputs.
No `vi.fn()` mocks of internal implementations. No `any` in test code.

### 8.1 `src/hud/__tests__/HudItem.test.tsx` (new file)

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { HudItem } from '../HudItem';
import type { HudItemResolved } from '../types';

const item = (overrides?: Partial<HudItemResolved>): HudItemResolved => ({
  id: 'test-item',
  node: <span>Hello</span>,
  ...overrides,
});

describe('HudItem', () => {
  it('renders a div with data-hud-id', () => {
    const { container } = render(<HudItem item={item()} />);
    const div = container.querySelector('[data-hud-id="test-item"]');
    expect(div).not.toBeNull();
  });

  it('renders the node content', () => {
    const { getByText } = render(<HudItem item={item({ node: <span>World</span> })} />);
    expect(getByText('World')).toBeDefined();
  });

  it('applies className when provided', () => {
    const { container } = render(<HudItem item={item({ className: 'my-hud' })} />);
    const div = container.querySelector('[data-hud-id="test-item"]');
    expect(div?.classList.contains('my-hud')).toBe(true);
  });

  it('applies inline style when provided', () => {
    const { container } = render(
      <HudItem item={item({ style: { top: '50px' } })} />,
    );
    const div = container.querySelector('[data-hud-id="test-item"]') as HTMLElement | null;
    expect(div?.style.top).toBe('50px');
  });

  it('returns null when enabled is false', () => {
    const { container } = render(<HudItem item={item({ enabled: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when enabled is true', () => {
    const { container } = render(<HudItem item={item({ enabled: true })} />);
    expect(container.querySelector('[data-hud-id="test-item"]')).not.toBeNull();
  });

  it('renders when enabled is undefined (default on)', () => {
    const { container } = render(<HudItem item={item({ enabled: undefined })} />);
    expect(container.querySelector('[data-hud-id="test-item"]')).not.toBeNull();
  });
});
```

### 8.2 `src/hud/__tests__/HudOverlay.test.tsx` (new file)

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { HudOverlay } from '../HudOverlay';
import type { HudItemResolved } from '../types';

const makeItem = (id: string): HudItemResolved => ({
  id,
  node: <span>{id}</span>,
});

describe('HudOverlay', () => {
  it('renders nothing for empty items array', () => {
    const { container } = render(<HudOverlay items={[]} />);
    expect(container.querySelectorAll('[data-hud-id]').length).toBe(0);
  });

  it('renders one HudItem per entry', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')];
    const { container } = render(<HudOverlay items={items} />);
    expect(container.querySelectorAll('[data-hud-id]').length).toBe(3);
  });

  it('uses item id as data-hud-id', () => {
    const items = [makeItem('my-id')];
    const { container } = render(<HudOverlay items={items} />);
    expect(container.querySelector('[data-hud-id="my-id"]')).not.toBeNull();
  });

  it('does not render disabled items', () => {
    const items: HudItemResolved[] = [
      { id: 'visible', node: <span />, enabled: true },
      { id: 'hidden', node: <span />, enabled: false },
    ];
    const { container } = render(<HudOverlay items={items} />);
    expect(container.querySelector('[data-hud-id="visible"]')).not.toBeNull();
    expect(container.querySelector('[data-hud-id="hidden"]')).toBeNull();
  });
});
```

### 8.3 `src/compiler/__tests__/hudBlocks.test.tsx` (new file)

Tests that the DSL authoring pipeline produces correct `SceneFrame.hudItems`.
Uses `resolveSceneFromDsl` exactly as the compiler does — no internal mocking.

```tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl } from '../sceneDslCompiler';
import { Hud, HudItem } from '../blocks/hudBlocks';
import { WidgetRegistry } from '../../widget/WidgetRegistry';

// Ensure blocks are registered before first use
import '../blocks/hudBlocks';

const context = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
};

const registry = new WidgetRegistry();

describe('hudBlocks DSL compilation', () => {
  it('compiles a single HudItem into SceneFrame.hudItems', () => {
    const tree = (
      <Scene id="s1">
        <Hud>
          <HudItem id="banner" node={<span>Hello</span>} />
        </Hud>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems).toHaveLength(1);
    expect(frame.hudItems?.[0]?.id).toBe('banner');
  });

  it('compiles multiple HudItems', () => {
    const tree = (
      <Scene id="s1">
        <Hud>
          <HudItem id="a" node={null} />
          <HudItem id="b" node={null} />
        </Hud>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems).toHaveLength(2);
    expect(frame.hudItems?.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('preserves enabled, className, and style props', () => {
    const style = { top: '10px' };
    const tree = (
      <Scene id="s1">
        <Hud>
          <HudItem id="x" node={null} enabled={false} className="my-cls" style={style} />
        </Hud>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    const item = frame.hudItems?.[0];
    expect(item?.enabled).toBe(false);
    expect(item?.className).toBe('my-cls');
    expect(item?.style).toEqual({ top: '10px' });
  });

  it('produces no hudItems when Hud has no children', () => {
    const tree = (
      <Scene id="s1">
        <Hud />
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems ?? []).toHaveLength(0);
  });

  it('produces no hudItems when scene has no Hud block', () => {
    const tree = <Scene id="s1" />;
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    expect(frame.hudItems).toBeUndefined();
  });
});
```

### 8.4 `src/compiler/__tests__/hudCompiler.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { compileHudItems } from '../hudCompiler';
import type { HudItemDefinition } from '../../hud/types';

const item = (id: string, overrides?: Partial<HudItemDefinition>): HudItemDefinition => ({
  id,
  node: null,
  ...overrides,
});

describe('compileHudItems', () => {
  it('returns empty array for undefined input', () => {
    expect(compileHudItems(undefined)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(compileHudItems([])).toEqual([]);
  });

  it('passes through enabled items', () => {
    const items = [item('a'), item('b', { enabled: true })];
    const result = compileHudItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('excludes items with enabled === false', () => {
    const items = [item('visible'), item('hidden', { enabled: false })];
    const result = compileHudItems(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('visible');
  });

  it('excludes all items when all are disabled', () => {
    const items = [item('x', { enabled: false }), item('y', { enabled: false })];
    expect(compileHudItems(items)).toHaveLength(0);
  });

  it('preserves item identity (no deep clone)', () => {
    const items = [item('z')];
    const result = compileHudItems(items);
    expect(result[0]).toBe(items[0]);
  });
});
```

### 8.5 `src/player/__tests__/LabelPositioner.test.ts` (new file)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { LabelPositioner } from '../LabelPositioner';
import type { Camera } from 'three';
import type { LabelResolved } from '../../labels/types';

// Minimal camera stub — project() writes to the vec in-place
const makeCamera = (projX = 0.5, projY = -0.5): Camera => ({
  project: vi.fn().mockImplementation((vec: { x: number; y: number; z: number }) => {
    vec.x = projX;
    vec.y = projY;
    vec.z = 0;
  }),
} as unknown as Camera);

const makeLabel = (id: string, overrides?: Partial<LabelResolved>): LabelResolved => ({
  id,
  text: 'Test',
  targetPartId: 'bone_head',
  ...overrides,
});

describe('LabelPositioner', () => {
  it('does nothing when container size is zero', () => {
    const positioner = new LabelPositioner();
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    const label = makeLabel('l1');
    positioner.update([label], makeCamera(), new Map([['bone_head', [0, 1, 0] as [number, number, number]]]));
    // transform should not be set since containerWidth/Height are 0
    expect(el.style.transform).toBe('');
  });

  it('sets container size and applies transform after update', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    const camera = makeCamera(0, 0); // projects to center
    const bones = new Map<string, [number, number, number]>([['bone_head', [0, 0, 0]]]);
    positioner.update([makeLabel('l1')], camera, bones);
    expect(el.style.transform).toContain('translate');
  });

  it('hides element when enabled is false', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.update(
      [makeLabel('l1', { enabled: false })],
      makeCamera(),
      new Map([['bone_head', [0, 0, 0] as [number, number, number]]]),
    );
    expect(el.style.display).toBe('none');
  });

  it('warns once for missing bone target', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.update([makeLabel('l1')], makeCamera(), new Map()); // no bones
    positioner.update([makeLabel('l1')], makeCamera(), new Map()); // second call
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('unregisters element on null', () => {
    const positioner = new LabelPositioner();
    positioner.setContainerSize(800, 600);
    const el = document.createElement('div');
    positioner.registerElement('l1', el);
    positioner.registerElement('l1', null);
    // Should not throw with no registered element
    positioner.update([makeLabel('l1')], makeCamera(), new Map([['bone_head', [0, 0, 0] as [number, number, number]]]));
  });
});
```

### 8.6 `src/player/__tests__/useSceneEngine.test.tsx` (updated)

The existing test `"setViewportSize forwards to annotation positioner"` must be updated to
use `LabelPositioner` instead of `AnnotationPositioner`.

**Remove:**
```typescript
import { AnnotationPositioner } from '../AnnotationPositioner';
```

**Add:**
```typescript
import { LabelPositioner } from '../LabelPositioner';
```

**Replace test body (lines ~61–88):**

Old test name: `'setViewportSize forwards to annotation positioner'`
New test name: `'setViewportSize forwards to label positioner'`

Old body:
```typescript
    const positioner = new AnnotationPositioner();
    positioner.setContainerSize = (w: number, h: number) => { size = { w, h }; };
    // ...
    const engine = useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [], annotationPositioner: positioner });
```

New body:
```typescript
    const positioner = new LabelPositioner();
    positioner.setContainerSize = (w: number, h: number) => { size = { w, h }; };
    // ...
    const engine = useSceneEngine({ sceneGroup, widgetRegistry: registry, clipMeta: [], labelPositioner: positioner });
```

---

## Section 9 — Implementation Order

Execute in this exact sequence to maintain a compilable state at each step:

### Step 1 — Create `src/hud/` module (no dependencies on anything being changed)
1. Create `src/hud/types.ts`
2. Create `src/hud/HudItem.tsx`
3. Create `src/hud/HudOverlay.tsx`
4. Create `src/hud/index.ts`
5. Create `src/hud/__tests__/HudItem.test.tsx`
6. Create `src/hud/__tests__/HudOverlay.test.tsx`
7. Run `pnpm test src/hud` — all HUD module tests should pass.

### Step 2 — Create HUD compiler and DSL block
1. Create `src/compiler/hudCompiler.ts`
2. Create `src/compiler/blocks/hudBlocks.tsx`
3. Create `src/compiler/__tests__/hudCompiler.test.ts`
4. Create `src/compiler/__tests__/hudBlocks.test.tsx`
5. Run `pnpm test src/compiler/__tests__/hudCompiler.test.ts src/compiler/__tests__/hudBlocks.test.tsx`

### Step 3 — Create LabelPositioner
1. Create `src/player/LabelPositioner.ts`
2. Create `src/player/LabelPositionerContext.ts`
3. Create `src/player/__tests__/LabelPositioner.test.ts`
4. Run `pnpm test src/player/__tests__/LabelPositioner.test.ts`

### Step 4 — Update compiler types (SceneFrame, SceneTrackTick)
1. Modify `src/compiler/sceneTrackTypes.ts` (Section 3.1)
2. Modify `src/compiler/sceneDslTypes.ts` (Section 3.2)
3. Run `pnpm typecheck` — this will surface all files that now need updating.
   Expected failures at this point: `sceneDslCompiler.ts`, `sceneTrackCompiler.ts`,
   `annotationBlocks.tsx`, `annotationCompiler.ts`, `ScenePlayer.tsx`, `useSceneEngine.ts`.

### Step 5 — Update compiler pipeline
1. Modify `src/compiler/sceneDslCompiler.ts` (Section 3.3)
2. Modify `src/compiler/sceneTrackCompiler.ts` (Section 3.4)
3. Modify `src/compiler/index.ts` (Section 3.6)
4. Run `pnpm typecheck` — should pass for the compiler layer.

### Step 6 — Update player layer
1. Modify `src/labels/LabelItem.tsx` (Section 5.1)
2. Modify `src/player/useSceneEngine.ts` (Section 5.2)
3. Modify `src/player/ScenePlayer.tsx` (Section 5.3)
4. Modify `src/player/index.ts` (Section 5.4)
5. Run `pnpm typecheck` — should pass cleanly.

### Step 7 — Delete annotation system files
Run the `rm` commands from Section 6. Then:
1. Run `pnpm typecheck` — must produce zero errors.
2. Run `pnpm test` — all tests should pass; deleted test files are gone.

### Step 8 — Update tests
1. Modify `src/player/__tests__/useSceneEngine.test.tsx` (Section 8.6)
2. Run `pnpm test` — full suite must pass.

### Step 9 — Update PRD
1. Modify `requirements/prd/prd_architecture.md` (Section 7.1)

### Final verification
```bash
pnpm typecheck     # zero errors
pnpm test          # all pass
pnpm build         # clean build
```

---

## Dependency Direction Verification

| Import | Direction | Valid? |
|--------|-----------|--------|
| `src/hud/types.ts` → `react` | hud → react | ✅ (types only) |
| `src/hud/HudItem.tsx` → `src/hud/types.ts` | render → types | ✅ |
| `src/hud/HudOverlay.tsx` → `src/hud/HudItem.tsx` | render → render | ✅ |
| `src/compiler/hudCompiler.ts` → `src/hud/types.ts` | compiler → hud types | ✅ |
| `src/compiler/blocks/hudBlocks.tsx` → `src/hud/types.ts` | dsl → hud types | ✅ |
| `src/compiler/blocks/hudBlocks.tsx` → `src/compiler/registry.ts` | dsl → registry | ✅ |
| `src/compiler/sceneTrackTypes.ts` → `src/hud/types.ts` | types → hud types | ✅ |
| `src/player/LabelPositioner.ts` → `three` | player → three | ✅ |
| `src/player/LabelPositioner.ts` → `src/labels/types.ts` | player → labels | ✅ |
| `src/labels/LabelItem.tsx` → `src/player/LabelPositionerContext.ts` | labels → player | ✅ (existing pattern) |
| `src/player/ScenePlayer.tsx` → `src/hud/HudOverlay.tsx` | player → hud | ✅ |

No circular dependencies introduced.

---

## Consumer Migration Notes

Projects using `ScenePlayer` need the following changes:

1. **`contentSlots` prop removed.** Migrate injected React content to `<HudItem>` nodes in
   scene DSL. If the content varies per-render (not per-scene), pass it as a `children`
   prop to `ScenePlayer` instead.

2. **`Annotations` and `MessageAnnotation` DSL components removed.** Replace with `<Hud>`
   and `<HudItem>`. Note: `<HudItem>` does not support `placement` or `follow` — all
   positioning must be CSS.

3. **`AnnotationPositioner` and `useAnnotationPositioner` removed.** If custom annotation
   positioning was being done outside of `ScenePlayer`, replace with `LabelPositioner` for
   label work, or implement custom CSS/animation for HUD positioning.

4. **`useContentSlot` hook removed.** Content that was resolved from a registry via
   `contentId` must be inlined as `node` props in the scene DSL.