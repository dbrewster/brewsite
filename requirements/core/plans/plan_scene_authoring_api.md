---
title: "Scene Authoring API Simplification"
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-02-28
---

# Scene Authoring API Simplification

## 0. Background and Motivation

The current scene authoring surface has four friction points:

**Problem 1 — Redundant `id` and `index` on `SceneDefinition`.** The `id` field duplicates
what the `<Scene key="...">` element already carries, and the `index` field is pure
denormalization of the array position. Authors must keep them in sync manually. A reorder
that forgets to update indices is a silent bug.

**Problem 2 — The `SceneGroup` wrapper is structural boilerplate.** `SceneGroup` exists only
to bundle `id` and `scenes[]`. With `id` going away and scenes moving to children, the type
has no purpose.

**Problem 3 — `sceneGroup` prop breaks JSX composability.** The natural React idiom for
"this component owns these children" is `children`, not a prop containing an object
containing an array. Passing `<Scene>` elements as children of `<ScenePlayer>` is idiomatic
React.

**Problem 4 — No outside state can flow into scenes.** `SceneDefinition` is a module-level
constant constructed at module load time — completely outside any React component. The only
dynamic values available are the five fields in `SceneSnapshotContext` (`assetsReady`,
`viewport`, `variables`, `sceneIndex`, `numScenes`). Any other state — user preferences,
route params, fetched data, theme — is structurally impossible to inject. The children
approach fixes this: scene JSX is authored inside a React component body, so any state the
component holds flows in naturally.

**Problem 5 — Manual HMR cache-busting is unnecessary scaffolding.** `ScenePlayer` currently
subscribes to Vite's `vite:beforeUpdate` event to manually clear the compile cache and force
a re-render via a `hmrVersion` state counter. This was needed because `getFrame` was a
module-level function that held stale closure state across HMR updates. With content-hash
compilation, Vite HMR causes a natural re-render → new JSX children → new content hash →
automatic recompilation. The manual machinery and the `__robotRuntimeDebug` escape hatch
(named after an earlier version of this project) are dead weight.

**What this plan does:**

- **Phase 1**: Removes `index` and `id` from `SceneDefinition`. `<Scene key="...">` becomes
  the canonical scene identity. `ScenePlayer` accepts `<Scene>` children directly instead of
  `sceneGroup`. Compilation is keyed on **full JSX content** (not just scene key strings),
  so any prop change in any scene triggers a targeted recompilation. `SceneDefinition` and
  `SceneGroup` become internal types. The `hmrVersion` state, `import.meta.hot` subscription,
  and `__robotRuntimeDebug` debug scaffolding are removed.

- **Phase 2**: Adds `useSceneRuntime(playerId)` — a hook for scenes that need to react to
  `assetsReady`, `viewport`, or `variables`. The parent component calls this hook, re-renders
  with updated scene JSX, and content-hash detection triggers automatic recompilation. No
  version counters or special-cased recompile triggers are needed.

**What this plan does NOT do:**

- Does not change the compiler pipeline internals (`compileSceneTrack` is unchanged).
- Does not remove the `placeholder` prop or change placeholder behavior.
- Does not change `widgetSetup`, `manifestUrl`, or any rendering/engine prop on `ScenePlayer`.
- Does not implement per-scene incremental compilation. This was considered and deferred:
  cross-scene dependencies (snapshot merging, passthrough widgets, adjacent transition blocks)
  mean "change scene N" cannot stay fully local. Full recompilation is fast (sub-millisecond
  for typical scene counts) and the content-hash cache makes identical-content renders O(1).
  `SceneTrack.sceneWindows` already provides the index structure if this becomes necessary.
- Does not touch `@brewsite/diagram`.

---

## 1. Before and After

### Before

```tsx
// scene file
export const sceneArchAuto: SceneDefinition = {
  id: 'arch-auto',
  index: 0,
  getFrame: () => (
    <Scene id="arch-auto">
      <Lighting>...</Lighting>
    </Scene>
  ),
};

// page
<ScenePlayer
  sceneGroup={{ id: 'diagram-auto', scenes: [sceneArchAuto] }}
  manifestUrl="/scene-manifest.json"
  widgetSetup={createWidgetSetup}
/>
```

### After — static scene (Phase 1)

```tsx
// scene file — plain JSX constant, no wrapper object
export const sceneArchAuto = (
  <Scene key="arch-auto">
    <Lighting>...</Lighting>
  </Scene>
);

// page
<ScenePlayer manifestUrl="/scene-manifest.json" widgetSetup={createWidgetSetup}>
  {sceneArchAuto}
</ScenePlayer>
```

### After — dynamic scene using Phase 2 hook

```tsx
// Any React state flows into scenes naturally.
// useSceneRuntime provides player-internal values (assetsReady, viewport, variables).
// When these change, the parent re-renders → new JSX content → automatic recompile.
function DiagramPage() {
  const { assetsReady, viewport } = useSceneRuntime('my-player');
  const [theme] = useTheme(); // any external state works too

  return (
    <ScenePlayer id="my-player" manifestUrl="..." widgetSetup={...}>
      <Scene key="arch-auto">
        <Lighting
          intensityScale={assetsReady ? 1 : 0}
          color={theme === 'dark' ? '#ffffff' : '#111111'}
        />
        <DiagramCanvas
          rotation={viewport.aspectRatio > 1.5 ? [0, 0, 0] : [-Math.PI / 6, 0, 0]}
        />
      </Scene>
    </ScenePlayer>
  );
}
```

---

## 2. Architecture

### 2.1 Key Decision: `key` as Scene Identity

`<Scene key="arch-auto">` uses React's standard `key` prop. The `sceneRootHandler` in the
compiler reads identity from `node.key` (the React element's `.key` field, not from
`node.props`). This is correct: `element.key` is the raw string set by the author (e.g.
`"arch-auto"`); React only adds internal prefixes during reconciliation, not on the static
element descriptor.

**Warning policy**: If a `<Scene>` element has no `key`, the player emits `console.warn` and
falls back to the 0-based index stringified (`"0"`, `"1"`, ...). Matches React's own
behavior for unkeyed list items.

**Backward compat**: `node.props.id` is checked as a fallback after `node.key`. Any existing
`<Scene id="...">` usage keeps working. The `id` prop can be removed from the `Scene`
component signature in a future cleanup once all callsites migrate to `key`.

### 2.2 `SceneDefinition` and `SceneGroup` become internal

These types are downgraded to internal implementation details. They are no longer exported
from `compiler/index.ts` or `player/index.ts`. Authors never construct them.

`ScenePlayer` converts its children to an array of `InternalSceneSpec` before handing to
`useSceneEngine`:

```typescript
// packages/core/src/player/ScenePlayer.tsx — internal, never exported
type InternalSceneSpec = {
  /** React key, or index-derived fallback. Used for scene identity and warnings. */
  readonly sceneKey: string;
  /**
   * Stable serialized string of the full JSX prop tree.
   * Changes whenever any prop in this scene's subtree changes.
   * Used as the cache key component and useMemo dependency for recompilation.
   */
  readonly contentKey: string;
  /** The <Scene> ReactElement passed directly to the compiler. */
  readonly element: ReactElement;
};
```

The compiler adapter converts `InternalSceneSpec[]` to the existing `SceneDefinition[]`
shape, so `compileSceneTrack` requires zero changes.

### 2.3 JSX content serializer

A dedicated serializer computes a stable string from a JSX element tree. This is the
mechanism that makes any prop change trigger recompilation.

**New file: `packages/core/src/player/serializeJsx.ts`**

```typescript
// Serializes a JSX element tree to a stable string for content-change detection.

import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Converts a JSX subtree to a stable string for cache key computation and
 * recompilation detection. Called once per scene per parent render.
 *
 * Design constraints:
 * - Object keys are sorted so prop order doesn't matter.
 * - Functions serialize to their displayName/name. Inline arrow functions with
 *   no name serialize to '[fn]' — acceptable since the context-based function
 *   prop pattern (getFrame) is being replaced by this approach entirely.
 * - Depth is capped at 15 to prevent stack overflow on pathological inputs.
 * - This is NOT a general-purpose serializer. Its sole purpose is detecting
 *   meaningful scene prop changes between parent renders.
 *
 * NOTE: Function-valued props serialize to displayName/name, or '[fn]' for anonymous
 * functions. DSL scene components must NOT accept function-valued props that affect
 * compiled output — if a DSL component needs dynamic behavior, the value should come
 * from external state (useSceneRuntime, useState, etc.) that produces a concrete prop
 * change, not a function change. A callback prop that changes identity every render
 * but has no name will always produce '[fn]' and never trigger recompilation.
 */
export const serializeJsx = (value: unknown, depth = 0): string => {
  if (depth > 15) return '[deep]';
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') {
    return (value as { displayName?: string; name?: string }).displayName
      ?? (value as { name?: string }).name
      ?? '[fn]';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serializeJsx(v, depth + 1)).join(',')}]`;
  }
  if (isValidElement(value)) {
    const el = value as ReactElement;
    const typeName =
      typeof el.type === 'function'
        ? ((el.type as { displayName?: string; name?: string }).displayName
            ?? (el.type as { name?: string }).name
            ?? '[fn]')
        : String(el.type);
    const { children: childrenProp, ...restProps } = el.props as Record<string, unknown>;
    const propsStr = Object.keys(restProps)
      .sort()
      .map((k) => `${k}:${serializeJsx(restProps[k], depth + 1)}`)
      .join(',');
    const childrenStr =
      childrenProp != null
        ? Children.toArray(childrenProp as ReactNode)
            .map((c) => serializeJsx(c, depth + 1))
            .join(',')
        : '';
    return `${typeName}[${el.key ?? ''}](${propsStr}){${childrenStr}}`;
  }
  if (typeof value === 'object') {
    try {
      const obj = value as Record<string, unknown>;
      return `{${Object.keys(obj)
        .sort()
        .map((k) => `${k}:${serializeJsx(obj[k], depth + 1)}`)
        .join(',')}}`;
    } catch {
      return '[obj]';
    }
  }
  return '[unknown]';
};
```

`serializeJsx` is used in two places:
1. `ScenePlayer` — to compute `contentKey` per scene element when building `InternalSceneSpec[]`
2. It is **not** called in the hot render path — only called in `ScenePlayer`'s render body
   when building `rawSpecs`. For typical scenes (5–10 elements with shallow props), this is
   sub-millisecond per render.

### 2.4 Compilation stability — content-hash, not key-hash

The core insight: children JSX objects are re-created on every parent render. `useMemo`
needs a dependency that is stable when content is identical and changes when any prop
changes. `sceneContentKey` (the concatenation of per-scene `contentKey` strings) is exactly
this.

```typescript
// In ScenePlayer — computed every render (fast), drives useMemo stability
const allChildren = Children.toArray(props.children);
const rawSceneElements = allChildren.filter(
  (c): c is ReactElement => isValidElement(c) && (c as ReactElement).type === Scene,
) as ReactElement[];

// Warn on non-<Scene> children — they are silently ignored and this is almost always a mistake.
const nonSceneCount = allChildren.length - rawSceneElements.length;
if (nonSceneCount > 0) {
  console.warn(
    `[ScenePlayer] ${nonSceneCount} non-<Scene> child(ren) were passed and will be ignored. ` +
    `ScenePlayer only processes direct <Scene key="..."> children. ` +
    `For overlay UI, use the HUD system or place content outside ScenePlayer.`,
  );
}

const rawSpecs: InternalSceneSpec[] = rawSceneElements.map((el, i) => {
  const key = el.key;
  if (key === null) {
    console.warn(
      `[ScenePlayer] <Scene> at index ${i} has no key prop. ` +
      `Assign key="..." to each <Scene> for stable identity. ` +
      `Falling back to index "${i}".`,
    );
  }
  return {
    sceneKey: key ?? String(i),
    contentKey: serializeJsx(el),  // full content hash
    element: el,
  };
});

// Single string representing all scene content. Changes on any prop change in any scene.
const sceneContentKey = rawSpecs.map((s) => s.contentKey).join('|||');

// Only update scenes reference when content actually changes.
// This is the only dependency needed — content-hash covers key changes, order changes,
// prop changes, and HMR-driven re-renders identically.
const scenes = useMemo(
  () => rawSpecs,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [sceneContentKey],
);
```

**Why this replaces version counters**: When `assetsReady` changes (Phase 2 hook use case),
the parent re-renders with new prop values in the scene JSX. `serializeJsx` produces a
different `contentKey`. `sceneContentKey` changes. `useMemo` fires. No `assetsReadyVersionRef`,
no `viewportVersionRef`, no `hmrVersion` — the content change IS the signal.

**Why no `hmrVersion`**: Vite HMR re-evaluates the module, React re-renders the parent page
component, the `<Scene>` elements are re-created with potentially new content (if the edit
changed props), `contentKey` changes, recompile fires. If the edit had no effect on scene
content (e.g. a comment change), `contentKey` is identical, no recompile. This is correct
behavior.

### 2.5 Content-aware cache key

`buildSceneTrackKey` uses `s.contentKey` from `InternalSceneSpec`, replacing the old
`s.id`-based key. This ensures that a content change on the same-keyed scene produces a
cache miss and triggers recompilation.

```typescript
// packages/core/src/compiler/sceneTrackCache.ts
export const buildSceneTrackKey = (options: {
  // Structural type — does not import InternalSceneSpec (avoids player→compiler direction)
  scenes: ReadonlyArray<{ readonly contentKey: string }>;
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion: boolean;
}): string => {
  const contentKeys = options.scenes.map((s) => s.contentKey).join('|');
  const blockKey = `b:${options.blockSize}`;
  const widgetKey = `w:${options.widgetRegistry.buildCacheKey()}`;
  const rmKey = `rm:${options.prefersReducedMotion ? 1 : 0}`;
  return [contentKeys, blockKey, widgetKey, rmKey].join('::');
};
```

Note: `contentKey` strings can be long for complex scenes. The cache key is a string and is
only used as a `Map` lookup key — length has no meaningful performance impact.

### 2.6 Compiler adapter (zero change to `compileSceneTrack`)

`useSceneEngine` converts `InternalSceneSpec[]` to `SceneDefinition[]` before calling
`compileSceneTrack`. The compiler contract is unchanged.

```typescript
// In useSceneEngine.ts — internal, not exported
const sceneDefs = useMemo(
  (): SceneDefinition[] =>
    options.scenes.map((spec) => ({
      id: spec.sceneKey,
      getFrame: () => spec.element,
    })),
  [options.scenes],
);
```

`buildSceneTrackKey` is called with `options.scenes` (which has `contentKey`).
`compileSceneTrack` is called with `sceneDefs` (which has `getFrame`).
These are separate references to the same stable array — no redundant work.

### 2.7 `TimelineWidget` adjustment

`ScenePlayer` currently passes `props.sceneGroup.scenes` to `TimelineWidget` for scene
label rendering. With the new API it passes the derived scenes array:

```typescript
{props.timeline && (
  <TimelineWidget
    engine={engine}
    scenes={scenes.map((s) => ({ id: s.sceneKey }))}
    {...(typeof props.timeline === 'object' ? props.timeline : {})}
  />
)}
```

### 2.8 HMR and legacy debug scaffolding removal

The following code is removed entirely from `ScenePlayer.tsx`:

**`hmrVersion` state and `import.meta.hot` subscription** (lines 48–71):
```typescript
// REMOVE: entire block
const [hmrVersion, setHmrVersion] = useState(0);
useEffect(() => {
  const hot = (import.meta as ImportMeta & { hot?: ... }).hot;
  // ... clearRegistry(), clearCache(), setHmrVersion(v => v + 1) ...
}, []);
```

**`key={hmrVersion}` on `EngineInputRegion`** (line 181):
```tsx
// BEFORE:
<EngineInputRegion key={hmrVersion} engine={engine} inputMap={props.inputMap}>
// AFTER:
<EngineInputRegion engine={engine} inputMap={props.inputMap}>
```

**`__robotRuntimeDebug` debug overlay** (lines 134–179):
```typescript
// REMOVE: debugOverlayEnabled variable and the entire debug overlay div
const debugOverlayEnabled = typeof window !== 'undefined' && ...;
// REMOVE: the <div> block guarded by {debugOverlayEnabled && ...}
```

The following code is removed entirely from `useSceneEngine.ts`:

**`debugLog` function and all call sites** (~12 occurrences):
```typescript
// REMOVE: debugLog definition
const debugLog = useCallback((...args: unknown[]) => {
  if (typeof window === 'undefined') return;
  const debug = (window as unknown as { __robotRuntimeDebug?: ... }).__robotRuntimeDebug;
  if (!debug?.logLifecycle) return;
  console.log(`[SceneEngine:${engineIdRef.current}]`, ...args);
}, []);

// REMOVE: all debugLog(...) call sites throughout the file
```

**`engineIdRef`** (line 97): remove `useRef` and all usages (only used by `debugLog`).

**`clearRegistry` import** in `ScenePlayer.tsx`: remove (was only used in the HMR handler).

**Why these are safe to remove**: Content-hash compilation makes HMR work automatically via
React's reactivity. The `__robotRuntimeDebug` system was a development convenience from an
earlier project phase. Any debug overlay needs belong in a proper dev tool, not a global
`window` flag. `clearCache()` on unmount (`useEffect(() => () => clearCache(), [])`) is
retained — it is correct hygiene regardless of HMR approach.

### 2.9 Phase 2: `useSceneRuntime` hook

**Motivation**: Authors who previously used `getFrame(context)` to access `assetsReady`,
`viewport`, or `variables` now get these values via a hook in their page component. When
hook values change, the parent re-renders, produces updated `<Scene>` JSX, and content-hash
detection triggers recompilation automatically.

**Architecture**: Module-level registry with `useSyncExternalStore`. `ScenePlayer` publishes
its runtime state to this registry when an `id` prop is set.

**New file: `packages/core/src/player/ScenePlayerRegistry.ts`**

```typescript
// Module-level registry for per-player runtime state exposed via useSceneRuntime().

import type { VariableStoreReader } from '../widget/VariableStore';

export type SceneRuntimeState = {
  readonly assetsReady: boolean;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly aspectRatio: number;
  };
  readonly variables: VariableStoreReader | undefined;
  /** Total number of <Scene> children registered with this player. */
  readonly numScenes: number;
};

const DEFAULT_STATE: SceneRuntimeState = {
  assetsReady: false,
  viewport: { width: 1, height: 1, aspectRatio: 1 },
  variables: undefined,
  numScenes: 0,
};

const states = new Map<string, SceneRuntimeState>();
const listeners = new Map<string, Set<() => void>>();

export const setSceneRuntimeState = (id: string, state: SceneRuntimeState): void => {
  states.set(id, state);
  listeners.get(id)?.forEach((l) => l());
};

export const getSceneRuntimeState = (id: string): SceneRuntimeState =>
  states.get(id) ?? DEFAULT_STATE;

export const subscribeSceneRuntime = (id: string, listener: () => void): () => void => {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id)!.add(listener);
  return () => {
    listeners.get(id)?.delete(listener);
    if (listeners.get(id)?.size === 0) listeners.delete(id);
  };
};

export const unregisterSceneRuntime = (id: string): void => {
  states.delete(id);
  listeners.delete(id);
};

/** Development utility: returns true if a player with this id has registered itself. */
export const hasRegisteredPlayer = (id: string): boolean => states.has(id);
```

**New file: `packages/core/src/player/useSceneRuntime.ts`**

```typescript
// Hook: read ScenePlayer runtime state (assetsReady, viewport, variables) from a parent component.

import { useSyncExternalStore } from 'react';
import {
  getSceneRuntimeState,
  subscribeSceneRuntime,
  type SceneRuntimeState,
} from './ScenePlayerRegistry';

/**
 * Returns reactive runtime state published by <ScenePlayer id={playerId}>.
 *
 * Call this in a component that is a *parent* of the target <ScenePlayer>.
 * When assetsReady, viewport, variables, or numScenes change, this hook causes the
 * parent to re-render. The updated values flow into the scene JSX children, and
 * ScenePlayer's content-hash detection triggers automatic recompilation.
 *
 * Requires the <ScenePlayer> to have a matching `id` prop.
 * Returns default state (assetsReady: false, 1×1 viewport, numScenes: 0) before mount.
 *
 * FOOTGUN: If no <ScenePlayer id={playerId}> is mounted, this hook returns default
 * state forever with no error. In development, a warning is logged after mount if the
 * target player is not found.
 */
export const useSceneRuntime = (playerId: string): SceneRuntimeState => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    const timer = setTimeout(() => {
      if (!hasRegisteredPlayer(playerId)) {
        console.warn(
          `[useSceneRuntime] No <ScenePlayer id="${playerId}"> was found after component mount. ` +
          `Check that the target ScenePlayer has id="${playerId}" and is mounted in the tree.`,
        );
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [playerId]);

  return useSyncExternalStore(
    (onStoreChange) => subscribeSceneRuntime(playerId, onStoreChange),
    () => getSceneRuntimeState(playerId),
    () => ({
      assetsReady: false,
      viewport: { width: 1, height: 1, aspectRatio: 1 },
      variables: undefined,
      numScenes: 0,
    }),
  );
};
```

**`ScenePlayer` publishes state** when an `id` prop is provided:

```typescript
// In ScenePlayer.tsx:
const assetsReady = engine.debug?.assetsReady ?? false;
const viewport = engine.debug?.viewport ?? { width: 1, height: 1 };

useEffect(() => {
  if (!props.id) return undefined;
  setSceneRuntimeState(props.id, {
    assetsReady,
    viewport: {
      width: viewport.width,
      height: viewport.height,
      aspectRatio: viewport.width / Math.max(1, viewport.height),
    },
    variables: engine.variableStore,
    numScenes: scenes.length,
  });
  return () => unregisterSceneRuntime(props.id!);
}, [props.id, assetsReady, viewport.width, viewport.height, engine.variableStore, scenes.length]);
```

**Migration notes — `SceneSnapshotContext` fields:**

`SceneSnapshotContext` previously gave `getFrame` access to `sceneIndex`, `numScenes`,
`assetsReady`, `variables`, and `viewport`. Here is the mapping in the new model:

| Old `context` field | New equivalent |
|---|---|
| `assetsReady` | `useSceneRuntime(id).assetsReady` |
| `viewport` | `useSceneRuntime(id).viewport` |
| `variables` | `useSceneRuntime(id).variables` |
| `numScenes` | `useSceneRuntime(id).numScenes` |
| `sceneIndex` | **No equivalent at authoring time — by design.** In the JSX model each `<Scene>` is written individually; the author always knows which scene they are writing. `useCurrentScene()` provides runtime scene index for progress-driven behavior. |

`prefersReducedMotion` was never in `SceneSnapshotContext` — it was always internal to the
compiler. Authors who need it at the JSX level should read it directly via
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` or a custom hook.

**Recompile flow** (no version counters needed):

1. Assets load → `engine.debug.assetsReady` becomes `true`
2. The publish effect fires → `setSceneRuntimeState` → notifies listeners
3. `useSceneRuntime` subscribers re-render (parent page components)
4. Parent re-renders with new JSX (e.g. `intensityScale={1}` instead of `0`)
5. `serializeJsx` produces a different `contentKey`
6. `sceneContentKey` changes → `useMemo` fires → new `scenes` reference
7. `useSceneEngine` compilation effect fires → cache miss → `compileSceneTrack`
8. New `SceneTrack` → engine applies updated state

---

## 3. Implementation Sequence

Implement in this order. Each step is independently compilable and testable.

---

### Step 1 — Remove `index` from `SceneDefinition`

**File: `packages/core/src/compiler/sceneTypes.ts`**

Remove `index: number` from `SceneDefinition`. Keep `id` for now (removed in Step 4).

```typescript
export type SceneDefinition = {
  id: string;
  // index removed — always derived from array position in compileSceneTrack
  meta?: Record<string, JsonPrimitive>;
  getFrame: (context: SceneSnapshotContext) => ReactNode | SceneFrame;
};
```

**Files to update:**
- All files in `apps/examples/` that construct `SceneDefinition` objects: remove `index: N`.
  Search: `grep -rn "index:" apps/examples --include="*.ts" --include="*.tsx"`
- `packages/core/src/compiler/__tests__/` — update any test fixtures constructing
  `SceneDefinition`.

**Verification**: `pnpm typecheck` passes. No behavioral change.

---

### Step 2 — `<Scene key>` as canonical identity

**File: `packages/core/src/compiler/sceneDslCompiler.ts`**

Update `sceneRootHandler` to read identity from `node.key` first, `node.props.id` as
backward-compat fallback:

```typescript
const sceneRootHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as {
    id?: string;
    meta?: Record<string, JsonPrimitive>;
    metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
    roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  };

  // key (React standard) takes priority over id prop (kept for backward compat).
  const sceneId = node.key ?? props.id ?? null;
  if (sceneId === null) {
    console.warn(
      '[ScenePlayer] A <Scene> element has no key or id. ' +
      'Assign key="..." for stable scene identity.',
    );
  }
  if (sceneId) api.setSceneMeta({ id: sceneId });
  if (props.meta) api.setSceneMeta({ meta: props.meta });
  if (props.metalnessMultiplier !== undefined) {
    api.state.materialMetalnessMultiplier = helpers.resolveValue(
      props.metalnessMultiplier,
      api.context,
    );
  }
  if (props.roughnessMultiplier !== undefined) {
    api.state.materialRoughnessMultiplier = helpers.resolveValue(
      props.roughnessMultiplier,
      api.context,
    );
  }
  helpers.compileChildren(node, api);
};
```

**Note**: `node.key` is typed `string | null` on React elements. It is the raw string the
author wrote (e.g. `"arch-auto"`). Do not use `node.props.key` — `key` is never in `props`.

**File: `packages/core/src/compiler/sceneTrackCompiler.ts`**

Remove the `scene.id` reference from the error message at Step 1's line:

```typescript
// Before:
throw new Error(`Scene "${scene.id}" getFrame must return a JSX element or SceneFrame`);

// After:
throw new Error(
  `Scene at index ${i} getFrame() must return a JSX element or SceneFrame (got: ${typeof raw})`,
);
```

**Files to update (examples):**
In all scene files under `apps/examples/`, migrate `<Scene id="...">` to `<Scene key="...">`.
The outer `SceneDefinition.id` field is left for now (removed in Step 4).

**Verification**: `pnpm typecheck` passes. All existing tests pass. Scene identity
(`sceneId` in `onSceneChange`) still works correctly.

---

### Step 3 — `InternalSceneSpec`, `serializeJsx`, content-aware cache key

**New file: `packages/core/src/player/serializeJsx.ts`**

Implement `serializeJsx` exactly as specified in section 2.3. This file is not exported from
`player/index.ts` — it is an internal implementation detail.

**File: `packages/core/src/player/ScenePlayer.tsx`**

Add the `InternalSceneSpec` type (not exported) as specified in section 2.2.

**File: `packages/core/src/compiler/sceneTrackCache.ts`**

Update `buildSceneTrackKey` to use the structural `contentKey` field. The function does not
import from `player/` — it accepts a structural type to avoid the layer violation:

```typescript
export const buildSceneTrackKey = (options: {
  scenes: ReadonlyArray<{ readonly contentKey: string }>;
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion: boolean;
}): string => {
  const contentKeys = options.scenes.map((s) => s.contentKey).join('|');
  const blockKey = `b:${options.blockSize}`;
  const widgetKey = `w:${options.widgetRegistry.buildCacheKey()}`;
  const rmKey = `rm:${options.prefersReducedMotion ? 1 : 0}`;
  return [contentKeys, blockKey, widgetKey, rmKey].join('::');
};
```

**Verification**: `pnpm typecheck` passes. Cache behavior unchanged for same-content scenes.

---

### Step 4 — `ScenePlayer` accepts children; HMR and debug scaffolding removed

This is the primary breaking change step. It combines the API change and the dead-code
removal in a single pass since they touch the same file.

**File: `packages/core/src/player/ScenePlayer.tsx`**

**4a — Prop type change:**

```typescript
export type ScenePlayerProps = {
  /** Optional player ID. Required if using useSceneRuntime(). */
  id?: string;
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
  /** Input configuration for scene navigation. */
  inputMap?: SceneNavInputMap;
  /**
   * Whether to render the built-in timeline widget at the bottom.
   * Pass `true` for defaults, or a `TimelineWidgetProps` subset to configure it.
   */
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;
  /**
   * Scene content. Each direct child must be a <Scene key="..."> element.
   * The key prop is required per scene; a warning is emitted and index used as fallback
   * if omitted.
   */
  children: ReactNode;
};
```

`sceneGroup` is hard-removed. `children` is required.

**4b — Scene extraction with content hashing:**

Replace the `hmrVersion` state, the `import.meta.hot` useEffect, and the old extraction
logic with:

```typescript
// Extract <Scene> children and compute content keys.
const allChildren = Children.toArray(props.children);
const rawSceneElements = allChildren.filter(
  (c): c is ReactElement => isValidElement(c) && (c as ReactElement).type === Scene,
) as ReactElement[];

// Warn loudly on non-<Scene> children — silently ignoring them is a common mistake.
const nonSceneCount = allChildren.length - rawSceneElements.length;
if (nonSceneCount > 0) {
  console.warn(
    `[ScenePlayer] ${nonSceneCount} non-<Scene> child(ren) were passed and will be ignored. ` +
    `ScenePlayer only processes direct <Scene key="..."> children. ` +
    `For overlay UI, use the HUD system or place content outside ScenePlayer.`,
  );
}

const rawSpecs: InternalSceneSpec[] = rawSceneElements.map((el, i) => {
  const key = el.key;
  if (key === null) {
    console.warn(
      `[ScenePlayer] <Scene> at index ${i} has no key prop. ` +
      `Assign key="..." to each <Scene> for stable identity. ` +
      `Falling back to index "${i}".`,
    );
  }
  return {
    sceneKey: key ?? String(i),
    contentKey: serializeJsx(el),
    element: el,
  };
});

// Stable string representing the full content of all scenes.
// Changes when any prop in any scene changes — drives compilation and caching.
const sceneContentKey = rawSpecs.map((s) => s.contentKey).join('|||');

const scenes = useMemo(
  () => rawSpecs,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [sceneContentKey],
);
```

**4c — Remove HMR and debug code:**

Remove from `ScenePlayer.tsx`:
- `const [hmrVersion, setHmrVersion] = useState(0);`
- The entire `useEffect` that subscribes to `import.meta.hot` (lines 50–71)
- `const debugOverlayEnabled = ...` and the debug overlay `<div>` block
- Import of `clearRegistry` (no longer used)
- `key={hmrVersion}` from `<EngineInputRegion>`

**4d — `EngineInputRegion` cleanup:**

```tsx
// Before:
<EngineInputRegion key={hmrVersion} engine={engine} inputMap={props.inputMap}>
// After:
<EngineInputRegion engine={engine} inputMap={props.inputMap}>
```

**File: `packages/core/src/player/useSceneEngine.ts`**

**4e — Replace `sceneGroup: SceneGroup` with `scenes: InternalSceneSpec[]`:**

```typescript
export type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];   // replaces sceneGroup: SceneGroup
  widgetRegistry: WidgetRegistry;
  clipMeta: ClipMeta[];
  manifest?: AssetManifest | null;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  blockSize?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  labelPositioner?: LabelPositioner;
  inputMap?: SceneNavInputMap;
};
```

**4f — Internal adapter and compilation call:**

```typescript
// Convert InternalSceneSpec[] → SceneDefinition[] for compileSceneTrack.
// SceneDefinition is purely internal from this point forward.
const sceneDefs = useMemo(
  (): SceneDefinition[] =>
    options.scenes.map((spec) => ({
      id: spec.sceneKey,
      getFrame: () => spec.element,
    })),
  [options.scenes],
);
```

Update the compilation `useEffect`:
- Change `buildSceneTrackKey({ scenes: options.sceneGroup.scenes, ... })` to
  `buildSceneTrackKey({ scenes: options.scenes, ... })` (passes `InternalSceneSpec[]`
  which has `contentKey`)
- Change `compileSceneTrack({ scenes: options.sceneGroup.scenes, ... })` to
  `compileSceneTrack({ scenes: sceneDefs, ... })` (passes `SceneDefinition[]`)
- Change all `options.sceneGroup.scenes.length` to `options.scenes.length`
- Update `useEffect` dependency array: replace `options.sceneGroup` with `options.scenes`

**4g — Remove `debugLog` and `engineIdRef` from `useSceneEngine.ts`:**

Remove:
- `const engineIdRef = useRef(...)` (line 97)
- `const debugLog = useCallback(...)` (lines 115–121)
- All `debugLog(...)` call sites throughout the file (~12 occurrences)
- Any `__robotRuntimeDebug` references

**File: `packages/core/src/compiler/sceneTypes.ts`**

```typescript
/**
 * @internal — constructed by ScenePlayer from <Scene> children. Not exported.
 */
export type SceneDefinition = {
  id: string;
  meta?: Record<string, JsonPrimitive>;
  getFrame: (context: SceneSnapshotContext) => ReactNode | SceneFrame;
};

// SceneGroup removed entirely.
```

**File: `packages/core/src/compiler/index.ts`**

Remove `SceneGroup` and `SceneDefinition` from exports.

**File: `packages/core/src/player/index.ts`**

Remove `SceneGroup` and `SceneDefinition` from exports.

**Files to update — `apps/examples/`:**

Each scene file:
```tsx
// Before:
export const sceneArchAuto: SceneDefinition = {
  id: 'arch-auto',
  index: 0,
  getFrame: () => (
    <Scene key="arch-auto">...</Scene>
  ),
};

// After:
export const sceneArchAuto = (
  <Scene key="arch-auto">...</Scene>
);
```

Each page file:
```tsx
// Before:
<ScenePlayer
  sceneGroup={{ id: 'diagram-auto', scenes: [sceneArchAuto] }}
  ...
/>

// After:
<ScenePlayer ...>
  {sceneArchAuto}
</ScenePlayer>
```

**Verification**: `pnpm typecheck` passes. `pnpm test` passes. All example pages render
correctly. `onSceneChange` fires with correct `sceneId` values. Editing a scene file in the
dev server causes a visible recompile without a full page reload and without any
`hmrVersion` counter.

---

### Step 5 — Phase 2: `useSceneRuntime` hook

**New file: `packages/core/src/player/ScenePlayerRegistry.ts`**

Implement exactly as specified in section 2.9. Ensure `numScenes` is included in
`SceneRuntimeState` and `DEFAULT_STATE`, and that `hasRegisteredPlayer` is exported.

**New file: `packages/core/src/player/useSceneRuntime.ts`**

Implement exactly as specified in section 2.9. Include the `useEffect` dev-mode warning
(1000ms timeout, `process.env.NODE_ENV !== 'production'` gate, uses `hasRegisteredPlayer`).
Import `useEffect` from `react`.

**File: `packages/core/src/player/ScenePlayer.tsx`**

Add the publish `useEffect` specified in section 2.9. Add `id?: string` to
`ScenePlayerProps` (already present in the Step 4 type definition above).

Note: no `assetsReadyVersionRef` or `viewportVersionRef` are needed. The content-hash
mechanism handles all recompilation triggers uniformly.

**File: `packages/core/src/player/index.ts`**

Add:
```typescript
export { useSceneRuntime } from './useSceneRuntime';
export type { SceneRuntimeState } from './ScenePlayerRegistry';
```

**Verification**: `pnpm typecheck` passes. `pnpm test` passes.
Manual verification: add `useSceneRuntime('test-player')` to an example page, verify that
`assetsReady` transitioning false → true causes the scene to recompile with the updated
values (observe via `onSceneChange` or the dev-server console).

---

## 4. Files Changed Summary

| File | Change |
|---|---|
| `packages/core/src/compiler/sceneTypes.ts` | Remove `index` from `SceneDefinition`; mark `@internal`; remove `SceneGroup` |
| `packages/core/src/compiler/sceneDslCompiler.ts` | `sceneRootHandler` reads `node.key` first, `node.props.id` as fallback, warns if neither |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Update error message; remove `scene.id` reference |
| `packages/core/src/compiler/sceneTrackCache.ts` | `buildSceneTrackKey` uses structural `contentKey` field instead of `SceneDefinition.id` |
| `packages/core/src/compiler/index.ts` | Remove `SceneGroup`, `SceneDefinition` from exports |
| `packages/core/src/player/serializeJsx.ts` | **New** — JSX content serializer for change detection |
| `packages/core/src/player/ScenePlayer.tsx` | Remove `sceneGroup`; add `children: ReactNode` and `id?: string`; content-hash scene extraction; remove `hmrVersion` state + `import.meta.hot` effect + `__robotRuntimeDebug` overlay; add registry publish effect |
| `packages/core/src/player/useSceneEngine.ts` | Replace `sceneGroup: SceneGroup` with `scenes: InternalSceneSpec[]`; internal `SceneDefinition[]` adapter; remove `debugLog`, `engineIdRef`, all `__robotRuntimeDebug` references |
| `packages/core/src/player/ScenePlayerRegistry.ts` | **New** — module-level registry for player runtime state |
| `packages/core/src/player/useSceneRuntime.ts` | **New** — `useSceneRuntime(playerId)` hook via `useSyncExternalStore` |
| `packages/core/src/player/index.ts` | Remove `SceneGroup`; add `useSceneRuntime`, `SceneRuntimeState` |
| `apps/examples/**/*.tsx` | All scene files: remove `SceneDefinition` wrapper, export plain JSX; all page files: replace `sceneGroup` prop with children |

---

## 5. Testing Strategy

### Unit tests — `serializeJsx`

**New file: `packages/core/src/player/__tests__/serializeJsx.test.ts`**

Test cases (real inputs, real outputs, no mocks):
- Primitive values: `serializeJsx(42)` → `"42"`, `serializeJsx("hello")` → `'"hello"'`,
  `serializeJsx(true)` → `"true"`, `serializeJsx(null)` → `"null"`
- React element: `serializeJsx(<Foo a={1} b={2} />)` → includes component name, `a:1`, `b:2`
- Prop order independence: `<Foo b={2} a={1}>` and `<Foo a={1} b={2}>` → identical string
- Content change detection: `serializeJsx(<Lighting intensityScale={1} />)` ≠
  `serializeJsx(<Lighting intensityScale={0.5} />)`
- Key is included: `<Scene key="a">` ≠ `<Scene key="b">` (different keys → different string)
- Nested children are included: changing a deeply nested prop changes the output
- **Depth limit**: a tree nested 20 levels deep does not throw; output contains `[deep]`
  ```typescript
  it('caps depth at 15 without throwing', () => {
    let deep: React.ReactNode = <span />;
    for (let i = 0; i < 20; i++) deep = <div>{deep}</div>;
    expect(() => serializeJsx(deep)).not.toThrow();
    expect(serializeJsx(deep)).toContain('[deep]');
  });
  ```
- **Wide tree (breadth)**: 50 sibling nodes serialize correctly, same content produces same
  key, one changed prop produces a different key
  ```typescript
  it('handles a wide tree (50 nodes) with correct equality', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => (
      <Node key={`n${i}`} label={`Node ${i}`} x={i * 100} />
    ));
    const scene1 = <Scene key="big">{nodes}</Scene>;
    const scene2 = <Scene key="big">{nodes}</Scene>;
    // Same content — should be equal
    expect(serializeJsx(scene1)).toBe(serializeJsx(scene2));
    // One changed prop — should differ
    const nodesModified = [
      ...nodes.slice(0, 49),
      <Node key="n49" label="CHANGED" x={49 * 100} />,
    ];
    const scene3 = <Scene key="big">{nodesModified}</Scene>;
    expect(serializeJsx(scene3)).not.toBe(serializeJsx(scene1));
  });
  ```

### Unit tests — compiler layer

**File: `packages/core/src/compiler/__tests__/sceneDslCompiler.test.tsx`**

Add:
- `<Scene key="arch">` → `SceneFrame.id === "arch"`
- `<Scene>` with no key or id → `SceneFrame.id === "scene"` (fallback) + warning emitted
- `<Scene id="legacy">` (no key) → `SceneFrame.id === "legacy"` (backward compat)

### Unit tests — registry

**New file: `packages/core/src/player/__tests__/ScenePlayerRegistry.test.ts`**

- `setSceneRuntimeState` → listener is called
- `unregisterSceneRuntime` → subsequent `setSceneRuntimeState` does not call the removed listener
- `getSceneRuntimeState` returns `DEFAULT_STATE` (including `numScenes: 0`) for unregistered player
- Subscribe/unsubscribe cleanup: map entry is removed when last listener unsubscribes
- `hasRegisteredPlayer` returns `false` before registration, `true` after, `false` after unregister
- `SceneRuntimeState.numScenes` is correctly published and read: register a player with
  `numScenes: 3`, verify `getSceneRuntimeState` returns `numScenes: 3`

**`useSceneRuntime` dev-mode warning** (in `ScenePlayer.test.tsx` or a dedicated hook test):
- Use `vi.useFakeTimers()`. Mount a component that calls `useSceneRuntime('missing-player')`.
  Advance timers by 1001ms. Assert `console.warn` was called with a message containing
  `"missing-player"`. No `<ScenePlayer id="missing-player">` is mounted in this test.
- Verify the warning is NOT emitted when `process.env.NODE_ENV === 'production'`
  (set env before mounting, restore after).

### Unit tests — scene extraction and content hashing

**File: `packages/core/src/player/__tests__/ScenePlayer.test.tsx`** (new or existing)

- Two `<Scene key="a">` + `<Scene key="b">` → `InternalSceneSpec[]` with correct `sceneKey` values
- `<Scene>` with no key → `console.warn` is called, `sceneKey` falls back to `"0"`
- Non-`<Scene>` children are filtered out AND `console.warn` is called with the count
- A `<div>` child mixed with `<Scene>` children → one scene spec produced, warning emitted
- Changing a prop on a scene element changes its `contentKey`
- Two renders with identical JSX content produce the same `contentKey`

### Integration — example pages

All `apps/examples/` pages must render without error in dev mode after migration:
- `DiagramAutoPage` renders with `<Scene key="arch-auto">` as a child
- `onSceneChange` fires with `sceneId === "arch-auto"`
- Timeline widget shows correct scene label
- Editing a scene file in the dev server recompiles correctly without a full page reload
- Editing a scene file with no content change (e.g. whitespace only) does NOT cause a
  recompile (verify via absence of `compileSceneTrack` side-effects or compile-timing logs)

---

## 6. Backward Compatibility and Migration Notes

- **`SceneDefinition` and `SceneGroup` types**: Removed from public exports. Consuming code
  that imports them directly must update.
- **`<Scene id="...">` prop**: Continues to work as a fallback identity source during
  migration. The `id` prop can be removed from the `Scene` component signature in a future
  cleanup once all callsites use `key`.
- **`sceneGroup` prop on `ScenePlayer`**: Hard removed. No soft-deprecation period — the
  only consumer is `apps/examples/` which is updated in the same pass.
- **`getFrame(context)` pattern**: Removed from the public authoring surface. Authors who
  need `assetsReady`, `viewport`, or `variables` use `useSceneRuntime()` in their page
  component instead.

---

## 7. Decisions Resolved

| Topic | Decision |
|---|---|
| Scene identity | `key` prop on `<Scene>`. `node.key` read in `sceneRootHandler`. `node.props.id` kept as fallback. |
| Filename-derived ID | Rejected — fragile, invisible coupling between file path and runtime identity. |
| Children vs function array | Option A (children). Static `{sceneElement}` JSX for static scenes; React state in parent + `useSceneRuntime` for dynamic scenes. |
| `<SceneArchAuto />` component syntax | Not supported — compiler calls `getFrame` as a function, which breaks React hooks. Content-hash approach makes it unnecessary. |
| Recompile trigger | Content hash of full JSX tree (`serializeJsx`), not key string. Covers all state changes uniformly — HMR, `assetsReady`, viewport, theme, any parent state. |
| Incremental per-scene compilation | Deferred — cross-scene dependencies (snapshot merging, transition blocks, passthrough widgets) make it non-trivial. Full recompile is sub-millisecond for typical scene counts. `SceneTrack.sceneWindows` provides the index structure if this becomes necessary. |
| HMR handling | Removed entirely. Content-hash compilation + React's natural HMR re-render makes manual cache-busting redundant. |
| `__robotRuntimeDebug` system | Removed entirely. Legacy from previous project name. Any future debug tooling should be a proper dev tool, not a global window flag. |
| Placeholder | Unchanged — the `position: absolute; pointerEvents: none` wrapper in `ScenePlayer` is intentional and provides a consistent guarantee regardless of what the consumer passes. |
| Non-`<Scene>` children | Filtered out silently was a bug. `console.warn` now emitted with count and guidance. |
| `useSceneRuntime` missing `id` footgun | Documented prominently. Dev-mode `useEffect` with 1000ms timeout warns if no matching `<ScenePlayer id>` is found after mount. Gated on `process.env.NODE_ENV !== 'production'`. |
| `sceneIndex` migration | No authoring-time equivalent — by design. Authors know which scene they're writing. `useCurrentScene()` provides runtime index. |
| `numScenes` migration | Added to `SceneRuntimeState`. Published by `ScenePlayer` as `scenes.length`. |
| `prefersReducedMotion` | Never was in `SceneSnapshotContext` — remains internal to the compiler. Authors use `window.matchMedia` directly at JSX level. |
| `serializeJsx` function props | Documented as a design constraint: DSL components must not accept function-valued props that affect compiled state. `[fn]` serialization of anonymous callbacks is correct and intentional. |
