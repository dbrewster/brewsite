---
title: "Carousel Selection Region — Implementation Plan"
doc_type: plan
owner: Architect
status: complete
updated: 2026-03-18
change_history:
  - date: 2026-03-18
    author: "Architect"
    summary: "Initial plan — 15 sections, 5 parallel work streams."
  - date: 2026-03-18
    author: "Architect (post-review)"
    summary: "Applied 6 revisions from PM-2 review: (1) Decoupled InteractionCallbackRegistry from SceneTrack caching — new extractInteractionCallbacks.ts utility, ref in useSceneEngine. (2) Fixed position type from { clientX, clientY } to { x, y } NVS coordinates. (3) Deferred focus ring to v2. (4) Trimmed ARIA §7 to decision statement. (5) Removed childApi.ts from modified files. (6) Clarified InputCoordinator two-pass phasing."
---

# Carousel Selection Region — Implementation Plan

## Overview

This plan implements the carousel-as-selection-region feature as specified in `requirements/core/notes/note_carousel-selection-region.md`. The feature adds `onSelect` to `ViewLayout` carousels, a rich `CarouselSelectEvent` type, keyboard selection via the ARIA listbox pattern, a `useCarouselSelection` hook, `getSceneProgress` helpers, and the `activeIndex` → `focusedIndex` naming migration.

**Semver impact:** Minor release. All additions are backward compatible. The `activeIndex` rename ships as a deprecation shim.

---

## Table of Contents

1. [Type Definitions](#1-type-definitions)
2. [DSL Changes — ViewLayout onSelect](#2-dsl-changes)
3. [Interaction Callback Registry](#3-interaction-callback-registry)
4. [Compilation Pipeline Changes](#4-compilation-pipeline-changes)
5. [Runtime: Selection Dispatch in ActionInputController](#5-runtime-selection-dispatch)
6. [Runtime: Selection Dispatch in InputCoordinator](#6-runtime-inputcoordinator)
7. [Keyboard Selection — ARIA Listbox Pattern](#7-keyboard-selection)
8. [Focus Ring Rendering — Deferred to v2](#8-focus-ring-rendering)
9. [useCarouselSelection Hook](#9-usecarouselselection-hook)
10. [getSceneProgress Helpers](#10-getsceneprogress-helpers)
11. [activeIndex → focusedIndex Migration](#11-focusedindex-migration)
12. [Public API Exports](#12-public-api-exports)
13. [Example App](#13-example-app)
14. [Test Strategy](#14-test-strategy)
15. [Implementation Schedule](#15-implementation-schedule)

---

## 1. Type Definitions

### File: `packages/core/src/input/carouselSelectTypes.ts` (NEW)

This file defines the `CarouselSelectEvent` type and the `CarouselSelectHandler` type alias. It has zero dependencies on React, Three.js, or runtime — only plain TypeScript types.

```typescript
// carouselSelectTypes.ts — Type contracts for carousel selection events.

/**
 * Source that triggered a carousel selection event.
 * - 'pointer': mouse click or touch tap within carousel bounds.
 * - 'keyboard': Enter or Space key while carousel has keyboard focus.
 * - 'programmatic': selection triggered via code (e.g., clearCarouselSelection).
 */
export type CarouselSelectSource = 'pointer' | 'keyboard' | 'programmatic';

/**
 * Rich event dispatched when a carousel item is selected.
 * Modeled after DOM Event with a custom preventDefault().
 *
 * When preventDefault() is called, the event does NOT propagate to the
 * ActionInputController's normal click dispatch waterfall. This allows
 * consumers to handle selection exclusively (e.g., navigate to a scene)
 * without also triggering any PointerMap click actions.
 */
export type CarouselSelectEvent = {
  /** 0-based index of the selected (focused) carousel item. */
  readonly index: number;

  /** Widget ID of the selected View (from ViewLayout.viewIds[index]). */
  readonly viewId: string;

  /** Widget ID of the ViewLayout that fired this event. */
  readonly layoutId: string;

  /** Number of child views in the carousel. */
  readonly childCount: number;

  /**
   * NVS (Normalized Viewport Space, [0..1]) pointer position at the moment of selection.
   * Null for keyboard and programmatic sources.
   * Consistent with ViewLayout bounds and View bounds coordinate system.
   */
  readonly position: { readonly x: number; readonly y: number } | null;

  /** What triggered this selection. */
  readonly source: CarouselSelectSource;

  /**
   * Call to prevent the event from propagating to the normal
   * ActionInputController click dispatch waterfall.
   */
  preventDefault(): void;

  /** True after preventDefault() has been called. */
  readonly defaultPrevented: boolean;
};

/**
 * Handler type for carousel selection events.
 * Stored in the InteractionCallbackRegistry, keyed by layoutId.
 */
export type CarouselSelectHandler = (event: CarouselSelectEvent) => void;

/**
 * Factory function to create a CarouselSelectEvent instance.
 * Used by InputCoordinator when dispatching selection events.
 */
export function createCarouselSelectEvent(
  index: number,
  viewId: string,
  layoutId: string,
  childCount: number,
  position: { x: number; y: number } | null,
  source: CarouselSelectSource,
): CarouselSelectEvent {
  let _defaultPrevented = false;
  return {
    index,
    viewId,
    layoutId,
    childCount,
    position,
    source,
    preventDefault() { _defaultPrevented = true; },
    get defaultPrevented() { return _defaultPrevented; },
  };
}
```

**Dependencies:** None. Pure types + one factory function.

**Test file:** `packages/core/src/input/__tests__/carouselSelectTypes.test.ts` — tests `createCarouselSelectEvent` factory: verify `defaultPrevented` starts false, becomes true after `preventDefault()`, verify all fields match construction args.

---

## 2. DSL Changes — ViewLayout onSelect

### File: `packages/core/src/compiler/blocks/viewLayoutDsl.tsx` (MODIFY)

Add `onSelect` and `focusedIndex` props. Keep `activeIndex` as a deprecated alias.

```typescript
// ADD these imports at top:
import type { CarouselSelectHandler } from '../../input/carouselSelectTypes';

export type ViewLayoutProps = {
  // ... all existing props unchanged ...

  // RENAME: activeIndex → focusedIndex (keep activeIndex as deprecated alias)
  /**
   * 0-indexed focused (front) view. Only used when kind='carousel'. Default: 0.
   * @deprecated Use `focusedIndex` instead. Will be removed in the next major version.
   */
  activeIndex?: number;

  /** 0-indexed focused (front) view. Only used when kind='carousel'. Default: 0. */
  focusedIndex?: number;

  /**
   * Called when a carousel item is selected via pointer click, keyboard Enter/Space,
   * or programmatic trigger. Only used when kind='carousel'.
   *
   * The callback receives a CarouselSelectEvent with the selected item's index,
   * viewId, layoutId, pointer position (if applicable), and trigger source.
   *
   * Call event.preventDefault() to stop the event from propagating to the
   * ActionInputController's normal click dispatch waterfall.
   *
   * NOTE: This callback is extracted during compilation and stored in the
   * InteractionCallbackRegistry. It is NOT baked into the SceneTrack.
   */
  onSelect?: CarouselSelectHandler;

  /** React children — <View> elements. */
  children?: import('react').ReactNode;
};
```

**Key design decision:** `focusedIndex` takes precedence over `activeIndex` when both are set. The viewLayoutHandler resolves this (see §4).

---

## 3. Interaction Callback Registry

### File: `packages/core/src/compiler/interactionCallbackRegistry.ts` (NEW)

The callback registry is the **side-channel** that allows `onSelect` functions to survive compilation. Functions cannot be serialized into the flat `SceneTrack` tick array. Instead, they are extracted from the DSL on every render and stored in a separate ref that the runtime (`InputCoordinator`) reads.

**Critical design constraint:** The registry must NOT be cached with the `SceneTrack`. The `SceneTrack` is cached by `sceneTrackCache.ts` using a key that does not include closure identity. If the registry were attached to the cached track, a re-render that produces a new `onSelect` closure (capturing fresh React state) would hit the cache and silently return the old, stale closure. This would cause `onSelect` handlers to operate on stale state — a product-breaking bug. Instead, callback extraction runs on every render via a lightweight `extractInteractionCallbacks()` function (see §4.5), and the result is stored in a `useRef` in `useSceneEngine`.

```typescript
// interactionCallbackRegistry.ts — Side-channel for DSL callbacks that cannot be baked into SceneTrack.

import type { CarouselSelectHandler } from '../input/carouselSelectTypes';

/**
 * Registry for interaction callbacks extracted from DSL during compilation.
 *
 * Lifecycle: created fresh on every render by `extractInteractionCallbacks()`.
 * Stored in a `useRef` in `useSceneEngine`. InputCoordinator reads from the ref.
 * NOT cached with the SceneTrack — closures must always reflect current React state.
 *
 * Thread-safe by construction: only one compilation runs at a time, and the
 * registry is consumed by a single InputCoordinator instance.
 */
export class InteractionCallbackRegistry {
  private readonly selectHandlers = new Map<string, CarouselSelectHandler>();

  /**
   * Register a carousel selection handler for a layout.
   * Called by viewLayoutHandler during compilation when onSelect prop is present.
   *
   * @param layoutId - The ViewLayout's stable identity.
   * @param handler - The onSelect callback from DSL props.
   */
  registerSelectHandler(layoutId: string, handler: CarouselSelectHandler): void {
    this.selectHandlers.set(layoutId, handler);
  }

  /**
   * Look up the carousel selection handler for a layout.
   * Returns undefined if no onSelect was declared for this layout.
   */
  getSelectHandler(layoutId: string): CarouselSelectHandler | undefined {
    return this.selectHandlers.get(layoutId);
  }

  /**
   * Returns true if any selection handlers are registered.
   * Used by InputCoordinator to skip selection logic entirely when no handlers exist.
   */
  hasAnySelectHandlers(): boolean {
    return this.selectHandlers.size > 0;
  }

  /** Clears all registered handlers. Called on recompilation. */
  clear(): void {
    this.selectHandlers.clear();
  }
}
```

**Dependencies:** Only `CarouselSelectHandler` from `carouselSelectTypes.ts`.

**Test file:** `packages/core/src/compiler/__tests__/interactionCallbackRegistry.test.ts` — tests register/get/has/clear methods with real handler functions.

---

## 4. Compilation Pipeline Changes

### 4.1 SceneTrack is NOT modified

**`packages/core/src/compiler/sceneTrackTypes.ts` — NO CHANGES.**

The `InteractionCallbackRegistry` is deliberately kept off the `SceneTrack` type. `SceneTrack` is cached by `sceneTrackCache.ts`, and the cache key does not (and should not) include closure identity. Attaching the registry to the cached track would cause stale closures on cache hits. Instead, the registry is extracted separately on every render (see §4.5) and stored in a `useRef` in `useSceneEngine`.

### 4.2 Compilation pipeline — NO changes for callbacks

**The following files are NOT modified for the callback registry:**
- `packages/core/src/compiler/sceneTrackCompiler.ts` — no change
- `packages/core/src/compiler/sceneDslTypes.ts` — no change to `CompileApi`
- `packages/core/src/compiler/sceneDslCompiler.ts` — no change
- `packages/core/src/compiler/childApi.ts` — no change (spread propagation makes this moot regardless, since `withLayoutContext` and `createChildApi` both use `...api` / `...parentApi` spread)

Callback extraction is decoupled from the compilation pipeline entirely. The new `extractInteractionCallbacks()` function (§4.5) walks the scene JSX independently of `compileSceneTrack`. This cleanly separates mutable state (closures that change on every render) from immutable state (the cached `SceneTrack`).

### 4.3 viewLayoutHandler resolves focusedIndex

#### File: `packages/core/src/compiler/blocks/viewHandlers.ts` (MODIFY)

In `viewLayoutHandler`, add logic to resolve `focusedIndex` from props (with `activeIndex` fallback + deprecation warning). The `onSelect` callback is NOT handled here — it is extracted separately by `extractInteractionCallbacks()` (§4.5).

**Specific changes inside `viewLayoutHandler`:**

```typescript
// After destructuring props, add:
const { focusedIndex: explicitFocusedIndex, activeIndex: deprecatedActiveIndex } = props;

// Resolve focusedIndex with deprecation shim:
let resolvedFocusedIndex: number;
if (explicitFocusedIndex !== undefined) {
  resolvedFocusedIndex = explicitFocusedIndex;
} else if (deprecatedActiveIndex !== undefined) {
  // Emit deprecation warning once per layout per compilation
  console.warn(
    `[ViewLayout] "${layoutId}": \`activeIndex\` is deprecated. Use \`focusedIndex\` instead. ` +
    `\`activeIndex\` will be removed in the next major version.`
  );
  resolvedFocusedIndex = deprecatedActiveIndex;
} else {
  resolvedFocusedIndex = 0;
}

// Use resolvedFocusedIndex where activeIndex was previously used:
// In the carousel branch of layoutConfig construction:
layoutConfig = {
  kind: 'carousel',
  activeIndex: resolvedFocusedIndex,  // Internal config still uses 'activeIndex' key
  gap,
  inactiveScale,
  zStep,
  loop,
  spread,
  fadeMin,
};
```

**Important:** The `onSelect` function is NOT stored in `ViewLayoutState` and is NOT extracted by the compiler. It must be stripped/ignored by the viewLayoutHandler. The handler lives only in the `InteractionCallbackRegistry`, populated by `extractInteractionCallbacks()` (§4.5).

### 4.4 `compileSceneTrack` — NO changes for callbacks

`compileSceneTrack` is NOT modified. The `SceneTrack` return type is unchanged. Callbacks are handled entirely outside the compilation pipeline.

### 4.5 Callback extraction utility (NEW)

#### File: `packages/core/src/compiler/extractInteractionCallbacks.ts` (NEW)

A pure function that walks scene JSX trees to find `ViewLayout` nodes with `onSelect` and populates a fresh `InteractionCallbackRegistry`. Called on every render in `useSceneEngine` — this is cheap (just JSX tree walking, no tick baking).

```typescript
// extractInteractionCallbacks.ts — Lightweight DSL callback extraction, decoupled from SceneTrack caching.

import { Children, isValidElement, type ReactElement } from 'react';
import type { SceneDefinition } from './sceneTypes';
import { InteractionCallbackRegistry } from './interactionCallbackRegistry';
import type { CarouselSelectHandler } from '../input/carouselSelectTypes';

// The ViewLayout DSL component reference — imported for identity comparison.
// This avoids a string-based displayName check.
import { ViewLayout } from './blocks/viewLayoutDsl';

/**
 * Walks scene JSX trees and extracts interaction callbacks into a fresh registry.
 *
 * This function runs on every render, independent of the SceneTrack cache.
 * It ensures onSelect closures always reflect the latest React state,
 * avoiding the stale-closure bug that would occur if callbacks were cached
 * with the SceneTrack.
 *
 * Performance: O(n) where n is the number of JSX nodes across all scenes.
 * In practice this is very fast — scene trees are small (tens to low hundreds
 * of nodes) and we only inspect ViewLayout nodes.
 *
 * @param scenes - The scene definitions containing JSX getFrame() functions.
 * @returns A fresh InteractionCallbackRegistry with all onSelect handlers registered.
 */
export function extractInteractionCallbacks(
  scenes: ReadonlyArray<SceneDefinition>,
): InteractionCallbackRegistry {
  const registry = new InteractionCallbackRegistry();

  for (const scene of scenes) {
    const frame = scene.getFrame();
    walkJsx(frame, registry);
  }

  return registry;
}

/**
 * Recursively walks a JSX tree looking for ViewLayout elements with onSelect.
 */
function walkJsx(node: unknown, registry: InteractionCallbackRegistry): void {
  if (!isValidElement(node)) return;

  const element = node as ReactElement<Record<string, unknown>>;

  // Check if this is a ViewLayout with kind='carousel' and onSelect
  if (element.type === ViewLayout) {
    const props = element.props;
    const onSelect = props.onSelect as CarouselSelectHandler | undefined;
    const layoutId = props.id as string | undefined;
    const kind = props.kind as string | undefined;

    if (onSelect && layoutId && kind === 'carousel') {
      registry.registerSelectHandler(layoutId, onSelect);
    }
  }

  // Recurse into children
  const children = (element.props as { children?: unknown }).children;
  if (children) {
    Children.forEach(children, (child) => walkJsx(child, registry));
  }
}
```

**Dependencies:** React (for JSX walking), `InteractionCallbackRegistry`, `CarouselSelectHandler`, `SceneDefinition`, `ViewLayout` component identity.

**Test file:** `packages/core/src/compiler/__tests__/extractInteractionCallbacks.test.tsx` — tests:
1. Returns empty registry when no ViewLayout has onSelect.
2. Returns registry with handler when ViewLayout has onSelect.
3. Handles multiple ViewLayouts across multiple scenes.
4. Ignores non-carousel ViewLayouts with onSelect (kind='stack' etc.).
5. Always returns fresh closures — call twice with different closures, assert second result has the new closure.

#### File: `packages/core/src/player/useSceneEngine.ts` (MODIFY — for callback ref)

In `useSceneEngine`, add a ref to hold the current `InteractionCallbackRegistry` and update it on every render:

```typescript
// ADD import:
import { extractInteractionCallbacks } from '../compiler/extractInteractionCallbacks';
import type { InteractionCallbackRegistry } from '../compiler/interactionCallbackRegistry';

// In hook body, BEFORE the compilation effect:
const interactionCallbacksRef = useRef<InteractionCallbackRegistry | null>(null);

// On every render (not in an effect — must be synchronous with the render):
interactionCallbacksRef.current = options.scenes.length > 0
  ? extractInteractionCallbacks(options.scenes)
  : null;
```

The ref is passed to `InputCoordinator` as a prop or via the engine context. See §6.1 for how `InputCoordinator` reads it.

---

## 5. Runtime: Selection Dispatch in ActionInputController

### File: `packages/core/src/input/ActionInputController.ts` (MODIFY)

Add a new action type `'carousel.select'` and a new dispatch method for selection events.

### 5.1 New action type

#### File: `packages/core/src/input/types.ts` (MODIFY)

Add `'carousel.select'` to the `InputActionType` union:

```typescript
export type InputActionType =
  | 'camera.orbit'
  | 'camera.zoom'
  | 'camera.pan'
  | 'camera.reset'
  | 'scene.next'
  | 'scene.prev'
  | 'carousel.next'
  | 'carousel.prev'
  | 'carousel.select'  // NEW
  | (string & {});
```

### 5.2 New handler method on ActionInputHandler

#### File: `packages/core/src/input/types.ts` (MODIFY)

Add `onCarouselSelect` to `ActionInputHandler`:

```typescript
export type ActionInputHandler = {
  // ... all existing methods unchanged ...

  /**
   * Called when a carousel selection event is triggered (click within bounds
   * or keyboard Enter/Space). Returns true if the event was consumed
   * (preventDefault was called), false otherwise.
   *
   * When true is returned, ActionInputController skips its normal click
   * dispatch for this event.
   */
  onCarouselSelect?: (
    layoutId: string,
    source: 'pointer' | 'keyboard',
    clientX: number | null,
    clientY: number | null,
  ) => boolean;
};
```

### 5.3 Selection detection in handleClick

#### File: `packages/core/src/input/ActionInputController.ts` (MODIFY)

In `handleClick`, add carousel selection detection **before** the existing click action matching loop but **after** the overlay element forwarding check:

```typescript
private handleClick(e: MouseEvent): void {
  // Priority 1: Forward to interactive overlay elements.
  if (this.forwardClickToOverlayElement(e)) return;

  const spec = this.resolveSpec();
  if (!spec) return;

  // Priority 2: Carousel selection — check if click is within any carousel
  // layout bounds that has an onSelect handler registered.
  if (this.handler.onCarouselSelect) {
    for (const action of spec.actions) {
      if (action.type !== 'carousel.next' && action.type !== 'carousel.prev') continue;
      if (!action.layoutId) continue;
      // Check spatial gating
      if (this.handler.getLayoutBounds) {
        const bounds = this.handler.getLayoutBounds(action.layoutId);
        if (bounds) {
          const nvsPoint = this.clientToNvs(e.clientX, e.clientY);
          if (nvsPoint && this.isInsideBounds(nvsPoint, bounds)) {
            const consumed = this.handler.onCarouselSelect(
              action.layoutId,
              'pointer',
              e.clientX,
              e.clientY,
            );
            if (consumed) {
              e.preventDefault();
              this.fireActionEvent('carousel.select', action.id, {
                layoutId: action.layoutId,
              });
              return; // Short-circuit — do not process other click actions
            }
            // If not consumed, fall through to normal click processing
            break; // Only check the first matching carousel layout
          }
        }
      }
    }
  }

  // Priority 3: Normal click action matching (existing code)
  let best: /* ... existing code unchanged ... */
  // ... rest of existing handleClick unchanged ...
}
```

**Design rationale for spatial gating:** We reuse the existing `carousel.next`/`carousel.prev` action entries to discover which layouts are active in the current scene and what their `layoutId` values are. We reuse the same `getLayoutBounds` and `clientToNvs` infrastructure that already exists for carousel spatial gating. This means no new DSL action is needed — the presence of carousel navigation actions implies the carousel is selectable if `onSelect` is registered.

### 5.4 Keyboard selection in handleKeyDown

#### File: `packages/core/src/input/ActionInputController.ts` (MODIFY)

Add Enter/Space handling for carousel selection. This fires **before** the normal key action matching:

```typescript
private handleKeyDown(e: KeyboardEvent): void {
  const spec = this.resolveSpec();
  if (!spec) return;

  // Priority 1: Carousel selection via Enter/Space (ARIA listbox pattern)
  if ((e.key === 'Enter' || e.key === ' ') && this.handler.onCarouselSelect) {
    // Find the first carousel layout in the spec
    for (const action of spec.actions) {
      if (action.type !== 'carousel.next' && action.type !== 'carousel.prev') continue;
      if (!action.layoutId) continue;
      const consumed = this.handler.onCarouselSelect(
        action.layoutId,
        'keyboard',
        null,
        null,
      );
      if (consumed) {
        e.preventDefault();
        this.fireActionEvent('carousel.select', action.id, {
          layoutId: action.layoutId,
        });
        return;
      }
      break; // Only check the first matching carousel layout
    }
  }

  // Priority 2: Normal key action matching (existing code unchanged)
  const matches: Array</* ... */> = [];
  // ... rest of existing handleKeyDown unchanged ...
}
```

---

## 6. Runtime: Selection Dispatch in InputCoordinator

### File: `packages/core/src/player/InputCoordinator.tsx` (MODIFY)

InputCoordinator wires the `onCarouselSelect` handler to the `ActionInputHandler` and connects it to the `InteractionCallbackRegistry`.

### 6.1 Read the registry from the ref

`InputCoordinator` receives the `interactionCallbacksRef` from `useSceneEngine` (passed as a prop or via engine context). Inside the handler closure, it reads from the ref on every invocation to always get the latest closures:

```typescript
// InputCoordinator receives:
//   interactionCallbacksRef: React.RefObject<InteractionCallbackRegistry | null>
// (passed from useSceneEngine — see §4.5)
```

### 6.2 Implement onCarouselSelect handler

Add `onCarouselSelect` to the `handler` object:

```typescript
import { createCarouselSelectEvent } from '../input/carouselSelectTypes';
import type { CarouselSelectSource } from '../input/carouselSelectTypes';

// Inside the handler object:
onCarouselSelect: (layoutId, source, clientX, clientY) => {
  // Read from the ref on every invocation — always gets the latest closures
  const interactionCallbacks = interactionCallbacksRef.current;
  if (!interactionCallbacks) return false;

  // Resolve '__primary_carousel__' sentinel if needed
  const resolvedLayoutId = layoutId === PRIMARY_CAROUSEL_SENTINEL
    ? resolvePrimaryCarouselId()
    : layoutId;
  if (!resolvedLayoutId) return false;

  const selectHandler = interactionCallbacks.getSelectHandler(resolvedLayoutId);
  if (!selectHandler) return false;

  // Read current focused index from VariableStore
  const variableStore = engineRef.current.variableStore;
  const storedIndex = variableStore.get('carousel', `${resolvedLayoutId}.focusedIndex`)
    ?? variableStore.get('carousel', `${resolvedLayoutId}.activeIndex`)
    ?? 0;
  const focusedIndex = typeof storedIndex === 'number' ? storedIndex : 0;

  // Read view IDs from compiled state
  const tick = engineRef.current.frameState.tick;
  if (!tick) return false;
  const layoutState = tick.state.widgets[resolvedLayoutId] as
    | { kind: string; viewIds: readonly string[] }
    | undefined;
  if (!layoutState || layoutState.kind !== 'carousel') return false;

  const viewIds = layoutState.viewIds;
  const childCount = viewIds.length;
  if (childCount === 0) return false;

  const viewId = viewIds[focusedIndex] ?? viewIds[0] ?? '';

  // Build the event — convert client coords to NVS for the public API
  const position = clientX !== null && clientY !== null
    ? clientToNvs(clientX, clientY)  // Uses existing clientToNvs infrastructure
    : null;

  const event = createCarouselSelectEvent(
    focusedIndex,
    viewId,
    resolvedLayoutId,
    childCount,
    position,
    source as CarouselSelectSource,
  );

  // Invoke the handler
  selectHandler(event);

  // Write selectedIndex to VariableStore for reactive consumers
  variableStore.set('carousel', `${resolvedLayoutId}.selectedIndex`, focusedIndex);

  // Return whether the event was consumed
  return event.defaultPrevented;
},
```

**NVS coordinate conversion:** The `clientToNvs` function already exists in `InputCoordinator` (used by carousel spatial gating). It converts client pixel coordinates to Normalized Viewport Space [0..1] coordinates. The conversion happens here, before building the event, so consumers always receive NVS — consistent with `ViewLayout` bounds and `View` bounds.

### 6.3 Effect dependencies — no changes needed

The `interactionCallbacksRef` is a ref, not state. It is updated synchronously on every render (§4.5). The `onCarouselSelect` handler reads from the ref on every invocation. No effect dependency changes are needed — the handler always gets the latest closures without requiring an effect re-run.

---

## 7. Keyboard Selection — ARIA Attributes

ARIA semantic attributes (`role="listbox"`, `aria-activedescendant`) are **NOT implemented in v1**. The toolkit provides keyboard operability:

- **Enter/Space** → `onSelect` dispatch (§5.4)
- **ArrowLeft/ArrowRight** → carousel navigation (existing `carousel.next`/`carousel.prev` actions)
- **Tab** → focus container (standard DOM behavior)

ARIA attributes for screen reader support are the consumer's responsibility if needed. This is a documented v2 candidate.

**No files are modified for this section.** `EngineOverlayHost.tsx` is NOT modified.

---

## 8. Focus Ring Rendering — Deferred to v2

Automatic focus ring rendering is **deferred to v2**. Implementing an automatic focus ring requires design decisions about theme, color, and mode (glow vs outline vs CSS border) that should not be baked into the initial release.

For v1, consumers who want a focus ring have two options:
1. **3D highlight:** Use the existing `<Highlight>` DSL component on the focused carousel item. The `useCarouselSelection().focusedIndex` hook provides the index needed to control it.
2. **CSS focus ring:** Use `useCarouselSelection().focusedIndex` in an overlay component to apply custom CSS styling.

**No files are modified for this section.** `EngineOverlayHost.tsx` is NOT modified.

---

## 9. useCarouselSelection Hook

### File: `packages/core/src/widget/useCarouselSelection.ts` (NEW)

```typescript
// useCarouselSelection — reactive hook for carousel selection and focus state.

import { useCallback, useContext } from 'react';
import { useVariable } from './useVariable';
import { VariableStoreContext } from './VariableStoreContext';

/**
 * Returns the current selection state and focus state of a carousel ViewLayout.
 * Re-renders whenever the focused index, selected index, or child count changes.
 *
 * @param layoutId - The ViewLayout `id` prop (e.g. `"products"`).
 *
 * @example
 * ```tsx
 * const { selectedIndex, focusedIndex, childCount, clearSelection } = useCarouselSelection('products');
 * if (selectedIndex !== null) {
 *   // A carousel item was selected — show detail view
 * }
 * ```
 */
export function useCarouselSelection(layoutId: string): {
  /** Index of the selected item, or null if nothing is selected. */
  selectedIndex: number | null;
  /** Index of the currently focused (front) carousel item. */
  focusedIndex: number;
  /** Number of child views in the carousel. */
  childCount: number;
  /** Programmatically clear the selection. Triggers reactive updates. */
  clearSelection: () => void;
} {
  const store = useContext(VariableStoreContext);
  if (!store) throw new Error('[useCarouselSelection] must be used inside <SceneEngine>');

  const selectedRaw = useVariable<number>('carousel', `${layoutId}.selectedIndex`);
  const selectedIndex = typeof selectedRaw === 'number' ? selectedRaw : null;

  // Read focusedIndex first, fall back to activeIndex for backward compat
  const focusedRaw = useVariable<number>('carousel', `${layoutId}.focusedIndex`);
  const activeRaw = useVariable<number>('carousel', `${layoutId}.activeIndex`);
  const focusedIndex = (typeof focusedRaw === 'number' ? focusedRaw : undefined)
    ?? (typeof activeRaw === 'number' ? activeRaw : 0);

  const childCount = useVariable<number>('carousel', `${layoutId}.childCount`) ?? 0;

  const clearSelection = useCallback(() => {
    store.set('carousel', `${layoutId}.selectedIndex`, null);
  }, [store, layoutId]);

  return { selectedIndex, focusedIndex, childCount, clearSelection };
}
```

**Dependencies:** `useVariable`, `VariableStoreContext`. No Three.js, no runtime.

### File: `packages/core/src/widget/clearCarouselSelection.ts` (NEW)

```typescript
// clearCarouselSelection — imperative deselect for non-React contexts.

import type { VariableStore } from './VariableStore';

/**
 * Programmatically clears the carousel selection.
 * Triggers reactive updates in any component using useCarouselSelection.
 *
 * For React consumers, prefer the `clearSelection()` method from useCarouselSelection.
 * This function is for imperative contexts (widget implementations, event handlers
 * that don't have hook access).
 *
 * @param layoutId - The ViewLayout `id` prop.
 * @param store - The VariableStore instance (from engine.variableStore).
 */
export function clearCarouselSelection(layoutId: string, store: VariableStore): void {
  store.set('carousel', `${layoutId}.selectedIndex`, null);
}
```

**Test file:** `packages/core/src/widget/__tests__/useCarouselSelection.test.tsx` — tests:
1. Returns `selectedIndex: null` initially.
2. After `store.set(... selectedIndex, 2)`, returns `selectedIndex: 2`.
3. `clearSelection()` sets `selectedIndex` back to null.
4. Reads `focusedIndex` from both new and old VariableStore keys.
5. Returns `childCount: 0` initially, updates when set.

**Test file:** `packages/core/src/widget/__tests__/clearCarouselSelection.test.ts` — tests that calling `clearCarouselSelection` sets the VariableStore key to null.

---

## 10. getSceneProgress Helpers

### 10.1 Pure function

#### File: `packages/core/src/compiler/sceneTrackHelpers.ts` (NEW)

```typescript
// sceneTrackHelpers.ts — Pure utility functions for SceneTrack queries.

import type { SceneTrack } from './sceneTrackTypes';

/**
 * Returns the engine progress value [0..1] corresponding to the start of the named scene.
 *
 * Pure function — no side effects, no DOM, no React. Usable in:
 * - Widget implementations
 * - Non-React code (Node.js tooling, SSR, build scripts)
 * - Test code that computes expected progress values
 *
 * @param track - The compiled SceneTrack.
 * @param sceneId - The Scene's `id` prop value.
 * @returns Engine progress [0..1] at the start of the named scene.
 * @throws Error if sceneId is not found in the compiled track (fail-fast).
 */
export function getSceneProgressFromTrack(track: SceneTrack, sceneId: string): number {
  const window = track.sceneWindows.find(w => w.id === sceneId);
  if (!window) {
    throw new Error(
      `[getSceneProgressFromTrack] Scene "${sceneId}" not found in compiled track. ` +
      `Available scenes: ${track.sceneWindows.map(w => w.id).join(', ')}`
    );
  }
  return window.start;
}
```

**Dependencies:** Only `SceneTrack` and `SceneWindow` types from `sceneTrackTypes.ts`.

**Test file:** `packages/core/src/compiler/__tests__/sceneTrackHelpers.test.ts` — tests:
1. Returns `0` for the first scene.
2. Returns correct start value for middle scenes.
3. Throws descriptive error for unknown scene ID.
4. Works with single-scene tracks.

### 10.2 Engine convenience method

#### File: `packages/core/src/player/useSceneEngine.ts` (MODIFY)

Add `getSceneProgress` to `UseSceneEngineResult`:

```typescript
// In the UseSceneEngineResult type:

/**
 * Returns the engine progress value [0..1] corresponding to the start of the named scene.
 * Delegates to getSceneProgressFromTrack using the compiled sceneTrack.
 * Throws if sceneId is not found or no sceneTrack is compiled yet.
 */
getSceneProgress(sceneId: string): number;
```

Add the implementation:

```typescript
// ADD import:
import { getSceneProgressFromTrack } from '../compiler/sceneTrackHelpers';

// In the hook body, after sceneTrack state:
const getSceneProgress = useCallback((sceneId: string): number => {
  const track = sceneTrack;  // read from state, not ref
  if (!track) {
    throw new Error(
      `[getSceneProgress] No compiled scene track available. ` +
      `Ensure scenes are provided before calling getSceneProgress.`
    );
  }
  return getSceneProgressFromTrack(track, sceneId);
}, [sceneTrack]);

// In the return object:
return {
  // ... existing fields ...
  getSceneProgress,
};
```

---

## 11. activeIndex → focusedIndex Migration

This is a naming migration with a deprecation shim. The internal data model keeps `activeIndex` as the key name in `CarouselLayoutConfig` and `VariableStore` for now — only the public DSL surface and hooks get the new name.

### 11.1 ViewLayoutProps (§2 above)

Already covered: `focusedIndex` prop added, `activeIndex` marked deprecated.

### 11.2 VariableStore keys

#### File: `packages/core/src/player/InputCoordinator.tsx` (MODIFY)

In `handleCarouselStep`, after writing `activeIndex` to the VariableStore, also write `focusedIndex`:

```typescript
// After: variableStore.set('carousel', `${resolvedLayoutId}.activeIndex`, newIndex);
// ADD:
variableStore.set('carousel', `${resolvedLayoutId}.focusedIndex`, newIndex);
```

This ensures both old and new consumers work. The old `useCarouselState` reads `activeIndex`, the new `useCarouselSelection` reads `focusedIndex` first with `activeIndex` fallback.

### 11.3 useCarouselState deprecation

#### File: `packages/core/src/widget/useCarouselState.ts` (MODIFY)

Add a deprecation JSDoc comment but keep the function working:

```typescript
/**
 * @deprecated Use `useCarouselSelection(layoutId)` instead, which provides
 * `focusedIndex`, `selectedIndex`, `childCount`, and `clearSelection()`.
 * This hook will be removed in the next major version.
 *
 * Returns the current active index and child count of a carousel ViewLayout.
 * Re-renders whenever the carousel advances or retreats.
 */
export function useCarouselState(layoutId: string): [activeIndex: number, childCount: number] {
  // Read focusedIndex first, fall back to activeIndex for compat
  const focusedIndex = useVariable<number>('carousel', `${layoutId}.focusedIndex`);
  const activeIndex = useVariable<number>('carousel', `${layoutId}.activeIndex`);
  const childCount = useVariable<number>('carousel', `${layoutId}.childCount`) ?? 0;
  const resolved = (typeof focusedIndex === 'number' ? focusedIndex : undefined)
    ?? (typeof activeIndex === 'number' ? activeIndex : 0);
  return [resolved, childCount];
}
```

### 11.4 CarouselLayoutConfig

#### File: `packages/core/src/layout/regionTypes.ts` (MODIFY)

The `CarouselLayoutConfig.activeIndex` field is an internal type. It keeps the name `activeIndex` internally — only the DSL-facing name changes. This avoids a large internal refactor and keeps the migration scope minimal. Document this:

```typescript
export type CarouselLayoutConfig = {
  kind: 'carousel';
  /**
   * Internal active index. Maps to the DSL's `focusedIndex` (or deprecated `activeIndex`).
   * The DSL-to-internal mapping happens in viewLayoutHandler.
   */
  activeIndex: number;
  // ... rest unchanged ...
};
```

---

## 12. Public API Exports

### File: `packages/core/src/compiler/index.ts` (MODIFY)

Add exports for the new types:

```typescript
// ADD:
export type { CarouselSelectEvent, CarouselSelectSource, CarouselSelectHandler } from '../input/carouselSelectTypes';
```

### File: `packages/core/src/widget/index.ts` (MODIFY)

Add exports for the new hooks:

```typescript
// ADD:
export { useCarouselSelection } from './useCarouselSelection';
export { clearCarouselSelection } from './clearCarouselSelection';
```

### File: `packages/core/src/player/index.ts` (MODIFY)

Add export for the new engine method type. Check if `getSceneProgress` is already part of the `UseSceneEngineResult` export — it should be, since the type is exported from `useSceneEngine.ts` and re-exported via the player index.

Also export the pure function from the compiler:

```typescript
// ADD to compiler/index.ts or a new top-level export:
export { getSceneProgressFromTrack } from '../compiler/sceneTrackHelpers';
```

**Actually**, per the CLAUDE.md rule, `compiler/index.ts` exports only the DSL authoring surface. The pure function `getSceneProgressFromTrack` is infrastructure — it should be imported directly from its source file. Add it to the package's main `index.ts` instead:

### File: `packages/core/src/index.ts` (MODIFY)

```typescript
// ADD:
export { getSceneProgressFromTrack } from './compiler/sceneTrackHelpers';
```

Verify this file exists and is the package entry point. If the package exports from `player/index.ts` as the main entry, add it there.

---

## 13. Example App

### Directory: `apps/examples/src/carousel-selection/` (NEW)

The example follows the specification in the feature note exactly.

### 13.1 File Structure

```
apps/examples/src/carousel-selection/
├── CarouselSelectionPage.tsx          # Page component, route entry point
├── scenes/
│   ├── scenePicker.tsx                # Main picker scene (3-view carousel)
│   ├── sceneChartDetail.tsx           # Full-screen chart scene (view 0 target)
│   ├── sceneDiagramDetail.tsx         # Full-screen diagram scene (view 1 target)
│   └── sceneShared.tsx                # Shared camera/lighting constants
├── overlays/
│   ├── ExplorerOverlay.tsx            # React overlay for view 2 (nested scroll stage)
│   └── FullScreenCloseButton.tsx      # Reusable close/back button
└── data/
    └── sampleData.ts                  # Chart data + diagram node definitions
```

### 13.2 `CarouselSelectionPage.tsx`

Route entry point. Renders a `SceneEngine` with `ScrollStage`, `InputCoordinator`, and three scenes. Manages `onSelect` dispatch: views 0 and 1 trigger scene navigation, view 2 triggers a React overlay.

Key implementation details:
- Uses `useCarouselSelection('showcase')` to read selection state.
- Uses `engine.getSceneProgress('detail-chart-view')` and `engine.beginTransition(...)` for scene navigation.
- Manages `detailOverlayItem` state for the React overlay pattern.
- The `onSelect` handler uses `event.preventDefault()` for all three cases.
- Close button calls `clearSelection()` and `engine.beginTransition(engine.getSceneProgress('picker'))`.

### 13.3 Scene Files

Scene content matches the feature note's example code verbatim (see §Example in the note). Key props:
- `scenePicker.tsx`: ViewLayout with `id="showcase"`, `kind="carousel"`, `loop`, `focusedIndex={0}`, `onSelect={onSelect}`.
- `sceneChartDetail.tsx`: Same chart ID `"picker-chart"` for seamless morphing.
- `sceneDiagramDetail.tsx`: Same diagram ID `"picker-diagram"` for seamless morphing.

### 13.4 Route Registration

#### File: `apps/examples/src/App.tsx` (MODIFY)

Add a route for the carousel selection demo:

```typescript
import { CarouselSelectionPage } from './carousel-selection/CarouselSelectionPage';

// In the route config:
{ path: '/carousel-selection', element: <CarouselSelectionPage /> }
```

### 13.5 Navigation

#### File: `apps/examples/src/navigation.ts` (MODIFY, or equivalent)

Add the carousel selection demo to the navigation sidebar.

---

## 14. Test Strategy

### 14.1 Test Files Summary

| Test file | What it tests | Strategy |
|---|---|---|
| `packages/core/src/input/__tests__/carouselSelectTypes.test.ts` | `createCarouselSelectEvent` factory | Real inputs → assert fields, `defaultPrevented` state |
| `packages/core/src/compiler/__tests__/interactionCallbackRegistry.test.ts` | Registry register/get/has/clear | Real handler functions, assert registration and retrieval |
| `packages/core/src/compiler/__tests__/sceneTrackHelpers.test.ts` | `getSceneProgressFromTrack` | Real SceneTrack with known sceneWindows, assert start values and error on missing |
| `packages/core/src/compiler/__tests__/extractInteractionCallbacks.test.tsx` | `extractInteractionCallbacks` utility | Walk real scene JSX with ViewLayout+onSelect, assert registry population. Test freshness: two calls with different closures return different handlers |
| `packages/core/src/compiler/__tests__/viewHandlers.focusedIndex.test.ts` | focusedIndex/activeIndex resolution | Compile with each prop, assert correct config.activeIndex and deprecation warning |
| `packages/core/src/widget/__tests__/useCarouselSelection.test.tsx` | `useCarouselSelection` hook | React test with real VariableStore, assert reactive updates |
| `packages/core/src/widget/__tests__/clearCarouselSelection.test.ts` | `clearCarouselSelection` function | Real VariableStore, assert key set to null |
| `packages/core/src/input/__tests__/ActionInputController.selection.test.ts` | Click/keyboard selection dispatch | Real AIC with mock handler, simulate events, assert `onCarouselSelect` called with correct args |

### 14.2 Test Patterns

All tests follow the project's **interface-based stateful test** pattern:

- **Pure functions** (carouselSelectTypes, sceneTrackHelpers, interactionCallbackRegistry): Real inputs, real outputs. No mocks.
- **Compiler handlers** (viewHandlers): Construct real `CompileApi` and `CompileHelpers` (or the project's existing test helpers for these), invoke the handler, assert `api.state` mutations (focusedIndex resolution, deprecation warning).
- **Extraction utility** (extractInteractionCallbacks): Construct real scene JSX trees with ViewLayout+onSelect, call the function, assert registry contents. Verify closure freshness by calling twice with different closures.
- **React hooks** (useCarouselSelection): Use `renderHook` from `@testing-library/react` with a real `VariableStore` wrapped in `VariableStoreContext.Provider`. Assert return values after `act()` mutations.
- **ActionInputController** selection: Construct a real AIC with a handler object implementing `onCarouselSelect`. Dispatch synthetic `MouseEvent`/`KeyboardEvent` to the target element. Assert the handler was called with correct arguments. Use a real `SceneInputControllerSpec` with carousel actions.

### 14.3 What NOT to test

- `render.ts` files — excluded per project convention.
- Three.js visual output — not testable in Node environment.
- EngineOverlayHost ARIA attributes — deferred to v2.
- Focus ring rendering — deferred to v2.
- Full end-to-end InputCoordinator → engine → DOM — this is integration-level and covered by the example app.

---

## 15. Implementation Schedule

### Work Streams (5 parallel developers)

```
Stream A: Types + Registry + Extraction Utility + Compiler (focusedIndex)
Stream B: ActionInputController Selection Dispatch
Stream C: useCarouselSelection Hook + clearCarouselSelection
Stream D: getSceneProgress Helpers
Stream E: Example App
Stream F: InputCoordinator Integration (Developer 1, second pass)

Dependencies:
  B depends on A (needs CarouselSelectEvent types)
  C is independent (only depends on VariableStore, which exists)
  D is independent (only depends on SceneTrack types, which exist)
  F depends on A + B (needs extraction utility + onCarouselSelect handler type)
  E depends on A + B + C + D + F (exercises all features)

Timeline:
  Phase 1 (parallel): A, C, D start simultaneously
  Phase 2 (after A completes): B starts; Developer 1 from A begins Phase 1 of InputCoordinator (focusedIndex write)
  Phase 3 (after A + B complete): F starts (Developer 1 does Phase 2 of InputCoordinator — onCarouselSelect wiring)
  Phase 4 (after A + B + C + D + F complete): E starts
```

### Stream A: Types + Registry + Extraction Utility + Compiler

**Owner:** Developer 1

**Files created:**
- `packages/core/src/input/carouselSelectTypes.ts`
- `packages/core/src/compiler/interactionCallbackRegistry.ts`
- `packages/core/src/compiler/extractInteractionCallbacks.ts`
- `packages/core/src/input/__tests__/carouselSelectTypes.test.ts`
- `packages/core/src/compiler/__tests__/interactionCallbackRegistry.test.ts`
- `packages/core/src/compiler/__tests__/extractInteractionCallbacks.test.tsx`
- `packages/core/src/compiler/__tests__/viewHandlers.focusedIndex.test.ts`

**Files modified:**
- `packages/core/src/compiler/blocks/viewLayoutDsl.tsx` — add `onSelect`, `focusedIndex` props
- `packages/core/src/compiler/blocks/viewHandlers.ts` — resolve focusedIndex with deprecation shim
- `packages/core/src/compiler/index.ts` — export new types
- `packages/core/src/widget/useCarouselState.ts` — deprecation + focusedIndex fallback

**Files NOT modified (per review):**
- `packages/core/src/compiler/sceneTrackTypes.ts` — registry is NOT on SceneTrack
- `packages/core/src/compiler/sceneTrackCompiler.ts` — no callback changes
- `packages/core/src/compiler/sceneDslTypes.ts` — no CompileApi changes for callbacks
- `packages/core/src/compiler/sceneDslCompiler.ts` — no changes
- `packages/core/src/compiler/childApi.ts` — spread propagation handles any new CompileApi fields automatically; no explicit change needed

**Phase 1 (Stream A):** Developer 1 also modifies `packages/core/src/player/InputCoordinator.tsx` to write `focusedIndex` to VariableStore alongside `activeIndex` in the existing `handleCarouselStep` closure. This is a small, isolated change.

**Phase 2 (Stream F, after Stream B completes):** Same Developer 1 makes a second pass on `InputCoordinator.tsx` to add the `onCarouselSelect` handler and wire it to the `interactionCallbacksRef`. See Stream F below.

**No file conflicts with other streams.**

### Stream B: ActionInputController Selection Dispatch

**Owner:** Developer 2

**Files created:**
- `packages/core/src/input/__tests__/ActionInputController.selection.test.ts`

**Files modified:**
- `packages/core/src/input/types.ts` — add `carousel.select` to InputActionType, add `onCarouselSelect` to ActionInputHandler
- `packages/core/src/input/ActionInputController.ts` — add selection detection in handleClick and handleKeyDown

**Depends on:** Stream A (needs `CarouselSelectEvent` type from `carouselSelectTypes.ts`).

**No file conflicts:** Stream A does not modify `ActionInputController.ts` or `input/types.ts`.

### Stream C: useCarouselSelection Hook

**Owner:** Developer 3

**Files created:**
- `packages/core/src/widget/useCarouselSelection.ts`
- `packages/core/src/widget/clearCarouselSelection.ts`
- `packages/core/src/widget/__tests__/useCarouselSelection.test.tsx`
- `packages/core/src/widget/__tests__/clearCarouselSelection.test.ts`

**Files modified:**
- `packages/core/src/widget/index.ts` — add exports

**No file conflicts with other streams.** Stream A modifies `useCarouselState.ts` but not `index.ts` in a conflicting way (both add exports, different lines).

### Stream D: getSceneProgress Helpers

**Owner:** Developer 4

**Files created:**
- `packages/core/src/compiler/sceneTrackHelpers.ts`
- `packages/core/src/compiler/__tests__/sceneTrackHelpers.test.ts`

**Files modified:**
- `packages/core/src/player/useSceneEngine.ts` — add `getSceneProgress` method + import

**No file conflicts with other streams.** Stream A no longer creates `sceneTrackHelpers.ts`.

### Stream E: Example App

**Owner:** Developer 5

**Files created:**
- All files under `apps/examples/src/carousel-selection/`

**Files modified:**
- `apps/examples/src/App.tsx` — add route
- `apps/examples/src/navigation.ts` (or equivalent) — add nav entry

**Depends on:** All other streams (exercises the full feature).

**No file conflicts with other streams** (only touches `apps/`).

### Stream F: InputCoordinator Integration (Stream A owner, after B completes)

**Owner:** Developer 1 (continuation of Stream A — second pass on InputCoordinator.tsx)

**Files modified:**
- `packages/core/src/player/InputCoordinator.tsx` — add `onCarouselSelect` handler, wire to `interactionCallbacksRef`
- `packages/core/src/player/useSceneEngine.ts` — add `interactionCallbacksRef` and `extractInteractionCallbacks` call (§4.5), pass ref to InputCoordinator

**Depends on:** Stream A (extraction utility + registry) + Stream B (`onCarouselSelect` on `ActionInputHandler`).

**Two-pass clarification:** Developer 1 makes two passes on `InputCoordinator.tsx`:
1. **Phase 1 (Stream A):** Add `focusedIndex` VariableStore write to `handleCarouselStep`.
2. **Phase 2 (Stream F):** Add `onCarouselSelect` handler implementation and wire to `interactionCallbacksRef`.

This is the final integration step that connects the callback extraction side-channel to the runtime dispatch.

---

## Appendix: Complete File Inventory

### New Files (11)

| File | Stream | Description |
|---|---|---|
| `packages/core/src/input/carouselSelectTypes.ts` | A | Event type + factory |
| `packages/core/src/compiler/interactionCallbackRegistry.ts` | A | Callback side-channel registry class |
| `packages/core/src/compiler/extractInteractionCallbacks.ts` | A | Lightweight JSX walker for callback extraction |
| `packages/core/src/compiler/sceneTrackHelpers.ts` | D | Pure getSceneProgressFromTrack |
| `packages/core/src/widget/useCarouselSelection.ts` | C | Selection hook |
| `packages/core/src/widget/clearCarouselSelection.ts` | C | Imperative deselect |
| `packages/core/src/input/__tests__/carouselSelectTypes.test.ts` | A | Event factory tests |
| `packages/core/src/compiler/__tests__/interactionCallbackRegistry.test.ts` | A | Registry tests |
| `packages/core/src/compiler/__tests__/extractInteractionCallbacks.test.tsx` | A | Extraction utility tests |
| `packages/core/src/compiler/__tests__/sceneTrackHelpers.test.ts` | D | getSceneProgress tests |
| `packages/core/src/widget/__tests__/useCarouselSelection.test.tsx` | C | Hook tests |
| `packages/core/src/widget/__tests__/clearCarouselSelection.test.ts` | C | Deselect tests |

### Modified Files (10)

| File | Stream | Changes |
|---|---|---|
| `packages/core/src/compiler/blocks/viewLayoutDsl.tsx` | A | Add `onSelect`, `focusedIndex` props |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | A | Resolve focusedIndex with deprecation shim |
| `packages/core/src/compiler/index.ts` | A | Export new types |
| `packages/core/src/input/types.ts` | B | Add `carousel.select`, `onCarouselSelect` |
| `packages/core/src/input/ActionInputController.ts` | B | Selection in handleClick + handleKeyDown |
| `packages/core/src/player/InputCoordinator.tsx` | A (phase 1) + F (phase 2) | Phase 1: write focusedIndex. Phase 2: add onCarouselSelect handler wired to interactionCallbacksRef |
| `packages/core/src/player/useSceneEngine.ts` | D + F | D: add getSceneProgress method. F: add interactionCallbacksRef + extractInteractionCallbacks call |
| `packages/core/src/widget/useCarouselState.ts` | A | Deprecation + focusedIndex fallback |
| `packages/core/src/widget/index.ts` | C | Export new hooks |
| `packages/core/src/layout/regionTypes.ts` | A | Document activeIndex internal mapping |

**Files NOT modified (per review):**
- `packages/core/src/compiler/sceneTrackTypes.ts` — registry is NOT on SceneTrack
- `packages/core/src/compiler/sceneTrackCompiler.ts` — no callback changes
- `packages/core/src/compiler/sceneDslTypes.ts` — no CompileApi changes for callbacks
- `packages/core/src/compiler/sceneDslCompiler.ts` — no changes
- `packages/core/src/compiler/childApi.ts` — spread propagation handles field forwarding automatically
- `packages/core/src/player/EngineOverlayHost.tsx` — ARIA + focus ring deferred to v2

### Test Files (9 new, listed above)

Plus:
- `packages/core/src/input/__tests__/ActionInputController.selection.test.ts` (NEW, Stream B)
- `packages/core/src/compiler/__tests__/viewHandlers.focusedIndex.test.ts` (NEW, Stream A)

### Example App Files (8+ new, Stream E)

All under `apps/examples/src/carousel-selection/` — no conflicts with library code.
