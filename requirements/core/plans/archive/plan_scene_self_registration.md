---
title: "Scene Self-Registration (<MyScene/> Support)"
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-02-28
---

# Scene Self-Registration (`<MyScene/>` Support)

## 0. Background and Motivation

After `plan_scene_authoring_api.md`, `ScenePlayer` accepts `<Scene>` elements as children.
The extraction mechanism uses `React.Children.toArray` + `element.type === Scene` to find
them. This means only **direct** `<Scene>` elements are recognised — a React component that
returns `<Scene>` (`<MyScene/>`) is filtered out with a warning.

The goal of this plan is to allow any React component that renders a `<Scene>` to be used
as a child of `ScenePlayer`:

```tsx
// Before this plan — only works as a direct element
const MyScene = () => <Scene id="arch-auto"><Lighting /></Scene>;
<ScenePlayer>{sceneArchAuto}</ScenePlayer>     // ✅ works
<ScenePlayer><MyScene /></ScenePlayer>         // ❌ filtered, warning emitted
```

```tsx
// After this plan
<ScenePlayer><MyScene /></ScenePlayer>         // ✅ works
<ScenePlayer>{sceneArchAuto}</ScenePlayer>     // ✅ still works
<ScenePlayer>                                  // ✅ mixed also works
  {sceneArchAuto}
  <MyScene />
</ScenePlayer>
```

Because `<MyScene/>` renders inside ScenePlayer's React tree, **hooks work inside scene
components**. `useSceneRuntime()` can move from the page component down into the scene
component itself, placing dynamic values right next to the content they affect.

---

## 1. Key Architectural Decision: `id` is the scene identity in the new model

The `plan_scene_authoring_api.md` established `<Scene key="arch-auto">` as the canonical
identity. This plan revises that: **`id` on `<Scene>` is the canonical identity**, and
`key` is reserved for React reconciliation on the wrapper component.

**Why the change is necessary**: Inside a React component, `key` is stripped from `props`
before the component receives them. `MyScene`'s `<Scene>` has no way to read its own `key`.
The only accessible identity is `props.id`.

**Migration from Phase 1**: `plan_scene_authoring_api.md` already included `id` as a
backward-compat fallback in `sceneRootHandler` (`node.key ?? props.id`). This plan flips
the priority: `props.id` becomes primary, `node.key` becomes the fallback.

**Final authoring pattern after this plan:**

```tsx
// Scene component — id is the scene's identity
const MyScene = () => (
  <Scene id="arch-auto">
    <Lighting />
  </Scene>
);

// Static element — id still works, key is unused (or optional for reconciliation)
export const sceneArchAuto = (
  <Scene id="arch-auto">
    <Lighting />
  </Scene>
);

// Page
<ScenePlayer id="my-player" ...>
  {sceneArchAuto}            // direct element, no key needed (not in a list)
  <MyScene />                // component; add key="my-scene" if in a dynamic list
</ScenePlayer>
```

---

## 2. Architecture

### 2.1 `Scene` becomes a self-registering React component

`Scene` changes from a null-returning DSL marker to a component that:

1. Reads a `SceneRegistrationContext` provided by `ScenePlayer`
2. Uses `useIsomorphicLayoutEffect` to register/unregister itself
3. Still returns `null` — no visible DOM output

```typescript
// packages/core/src/compiler/sceneDslCompiler.ts

// Isomorphic layout effect: synchronous on client, deferred on server (avoids SSR warning).
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Scene = (props: {
  id: string;                                           // required — scene identity
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((ctx: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((ctx: SceneSnapshotContext) => number);
  children?: React.ReactNode;
}): null => {
  const registration = useContext(SceneRegistrationContext);

  // Capture the full element for compilation. We reconstruct it from props since
  // React does not expose the ReactElement from inside the component.
  // React.createElement is used to build an element identical to what the compiler
  // will walk — same type, same props, no key (id carries identity).
  const element = React.createElement(Scene, props);

  useIsomorphicLayoutEffect(() => {
    registration?.register(props.id, element);
    return () => registration?.unregister(props.id);
  });  // No dep array — re-registers on every render so content changes propagate.

  return null;
};
Scene.displayName = 'Scene';
```

**Why no dep array on `useIsomorphicLayoutEffect`**: The effect must fire on every render
so that prop changes (e.g. `metalnessMultiplier` changing) are reflected in the registered
element. The registration mechanism (see 2.2) deduplicates by content hash, preventing
unnecessary recompilation.

**Why `React.createElement(Scene, props)`**: Inside the component, `this`/the element
object is not accessible. Reconstructing the element from `props` produces an equivalent
element for the compiler to walk. The `key` field is `null` on this reconstructed element —
`sceneRootHandler` falls back to `props.id`. This is correct.

### 2.2 `SceneRegistrationContext`

**New file: `packages/core/src/player/SceneRegistrationContext.ts`**

```typescript
// Context that Scene components use to register themselves with ScenePlayer.

import { createContext } from 'react';
import type { ReactElement } from 'react';

export type SceneRegistrationValue = {
  /**
   * Called by Scene on every render with the full scene element.
   * ScenePlayer deduplicates by content hash before triggering recompilation.
   */
  register: (id: string, element: ReactElement) => void;
  /** Called by Scene on unmount. */
  unregister: (id: string) => void;
};

export const SceneRegistrationContext = createContext<SceneRegistrationValue | null>(null);
```

### 2.3 Registration ordering and infinite-loop prevention

React renders depth-first, left-to-right. Effects (`useLayoutEffect`) fire in that same
order: s1, then s3 (child of MyScene), then s2 — matching source order. Insertion order
into a JavaScript `Map` is stable, so the Map preserves render order on first mount.

On subsequent renders (content change to one scene), `Map.set` on an existing key updates
the value **without changing insertion order**. The scene order is preserved.

**ScenePlayer** maintains:
- `registrationsRef: React.MutableRefObject<Map<string, ReactElement>>` — populated
  synchronously during the layout phase
- `lastContentKeyRef: React.MutableRefObject<string>` — the content key string of the last
  flushed registration state; compared before calling `setScenes` to prevent infinite loops

```typescript
// In ScenePlayer (internal, simplified):

const registrationsRef = useRef(new Map<string, ReactElement>());
const lastContentKeyRef = useRef('');
const [scenes, setScenes] = useState<InternalSceneSpec[]>([]);

const register = useCallback((id: string, element: ReactElement) => {
  registrationsRef.current.set(id, element);
}, []);

const unregister = useCallback((id: string) => {
  registrationsRef.current.delete(id);
}, []);

// Runs after every render. Computes content key; only calls setScenes when it changes,
// breaking the otherwise-infinite register → setScenes → re-render → register loop.
useEffect(() => {
  const specs = Array.from(registrationsRef.current.entries()).map(
    ([id, el]): InternalSceneSpec => ({
      sceneKey: id,
      contentKey: serializeJsx(el),
      element: el,
    }),
  );
  const newKey = specs.map((s) => s.contentKey).join('|||');
  if (newKey === lastContentKeyRef.current) return;
  lastContentKeyRef.current = newKey;
  setScenes(specs);
});
```

**Why `useEffect` (not `useLayoutEffect`)**: We read the registration Map after all child
layout effects have fired. `useEffect` runs after `useLayoutEffect`, so by the time
ScenePlayer's flush effect runs, all `Scene` `useLayoutEffect` callbacks have already
populated the Map. The update to `scenes` state then triggers `useSceneEngine`
recompilation asynchronously — this is correct since compilation is not timing-critical.

### 2.4 `ScenePlayer` provides the context

```typescript
// In ScenePlayer:
const contextValue = useMemo(
  (): SceneRegistrationValue => ({ register, unregister }),
  [register, unregister],
);

return (
  <SceneRegistrationContext.Provider value={contextValue}>
    <VariableStoreContext.Provider value={engine.variableStore}>
      {/* ... rest of providers ... */}
      <EngineInputRegion engine={engine} inputMap={props.inputMap}>
        <>
          {props.children}  {/* Scene components render here, self-register via context */}
          <HudOverlay ... />
          {labels.map(...)}
          {/* timeline etc. */}
        </>
      </EngineInputRegion>
    </VariableStoreContext.Provider>
  </SceneRegistrationContext.Provider>
);
```

`SceneRegistrationContext.Provider` must be the **outermost** wrapper so that `Scene`
components have access to it regardless of nesting depth.

### 2.5 Remove `Children.toArray` extraction from `ScenePlayer`

The `allChildren` / `rawSceneElements` / `sceneContentKey` / `useMemo` block from
`plan_scene_authoring_api.md` Step 4b is **removed entirely**. Scene extraction is now
driven by the registration context. `ScenePlayer` no longer needs to inspect `children`
at all — it just renders them.

The non-Scene children warning from the previous plan is also **removed** — with
self-registration, ScenePlayer can't know what non-Scene children intend to do. A wrapper
`<div>` or a custom hook component are both valid.

### 2.6 `sceneRootHandler` priority flip

`sceneRootHandler` in `sceneDslCompiler.ts` now prioritises `props.id` over `node.key`:

```typescript
// Children.toArray is gone, so ".$" prefixing no longer occurs.
// props.id is always set by Scene (required prop).
// node.key fallback handles any remaining direct-element usage where id was omitted.
const sceneId = props.id ?? (
  typeof node.key === 'string' && node.key.startsWith('.$')
    ? node.key.slice(2)
    : node.key
) ?? null;
```

The `.$` stripping stays as defensive code — it is now unreachable in the normal path
(because `props.id` is required and always comes first) but guards against any edge case
where a `<Scene key="..." >` element without `id` is compiled directly.

### 2.7 `id` prop becomes required on `<Scene>`

`Scene`'s `id` prop changes from `id?: string` to `id: string`. This is a breaking change
in the DSL surface. All `<Scene>` usages must provide an `id`.

For any callsite that previously used only `key` (from Phase 1), a TypeScript error will
appear. The fix is always: add `id="..."` (same value as the former `key`).

Since `plan_scene_authoring_api.md` already migrated all examples, the remaining fix is
only in example files that used `key` without `id`.

### 2.8 Hooks inside scene components

Since `<MyScene/>` renders inside ScenePlayer's React tree, it has access to all contexts
ScenePlayer provides:

- `VariableStoreContext` → `useVariable()`
- `EngineContext` → `useSceneEngineContext()`
- `EngineStateContext` → `useEngineState()`, `useCurrentScene()`, `useSceneProgress()`
- `SceneRegistrationContext` → (used internally by `<Scene>`)

`useSceneRuntime(playerId)` **also** works inside `<MyScene/>`, but the engine context
hooks are richer and more direct. Prefer `useCurrentScene()` over
`useSceneRuntime(id).numScenes` when inside the tree.

**Example** — the full `<MyScene/>` pattern with hooks:

```tsx
const ArchDiagramScene = () => {
  const { assetsReady } = useSceneRuntime('main-player');
  // OR, since we're inside the tree:
  // const engineState = useEngineState();

  return (
    <Scene id="arch-auto">
      <Lighting intensityScale={assetsReady ? 1 : 0} />
      <DiagramCanvas>
        <Diagram id="arch-auto" pivot="center">
          <HierarchicalLayout spacing={[3, 2]} />
          {/* nodes, edges */}
        </Diagram>
      </DiagramCanvas>
    </Scene>
  );
};

// Page
<ScenePlayer id="main-player" manifestUrl="..." widgetSetup={...}>
  <ArchDiagramScene />
</ScenePlayer>
```

---

## 3. Implementation Sequence

### Step 1 — `SceneRegistrationContext`

**New file: `packages/core/src/player/SceneRegistrationContext.ts`**

Implement exactly as specified in section 2.2.

**Verification**: `pnpm typecheck` passes.

---

### Step 2 — `Scene` becomes a self-registering component; `id` required

**File: `packages/core/src/compiler/sceneDslCompiler.ts`**

2a. Add imports:

```typescript
import React, {
  Children,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  type ReactElement,
  type ReactNode,
} from 'react';
import { SceneRegistrationContext } from '../player/SceneRegistrationContext';
```

**Dependency direction note**: `sceneDslCompiler.ts` is in `compiler/` and now imports from
`player/` (`SceneRegistrationContext`). This is a direction violation under the standard
element module pattern (compiler must not import from player). The correct placement is to
move `SceneRegistrationContext.ts` into a neutral location accessible by both:

**Move `SceneRegistrationContext.ts` to `packages/core/src/compiler/SceneRegistrationContext.ts`.**

Both `compiler/sceneDslCompiler.ts` and `player/ScenePlayer.tsx` import from
`compiler/SceneRegistrationContext`. This preserves the `player → compiler` direction and
avoids any circular dependency.

2b. Add `useIsomorphicLayoutEffect`:

```typescript
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

2c. Replace the current `Scene` null-function with the self-registering component:

```typescript
export const Scene = (props: {
  /** Required: the scene's stable logical identity. Used as the compilation key. */
  id: string;
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  children?: React.ReactNode;
}): null => {
  const registration = useContext(SceneRegistrationContext);

  // Reconstruct the element from props for compiler consumption.
  // key is null on this element — sceneRootHandler uses props.id.
  const element = React.createElement(Scene, props);

  useIsomorphicLayoutEffect(() => {
    registration?.register(props.id, element);
    return () => registration?.unregister(props.id);
  });

  return null;
};
Scene.displayName = 'Scene';
```

2d. Update `sceneRootHandler` priority as specified in section 2.6:

```typescript
const sceneRootHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as {
    id?: string;
    meta?: Record<string, JsonPrimitive>;
    metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
    roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  };
  // props.id is primary (required in new model); node.key is fallback for any
  // direct-element usage that omits id. The ".$" strip handles Children.toArray
  // key prefixing which no longer occurs in normal flow but is kept defensively.
  const rawKey =
    typeof node.key === 'string' && node.key.startsWith('.$')
      ? node.key.slice(2)
      : node.key;
  const sceneId = props.id ?? rawKey ?? null;
  if (sceneId === null) {
    console.warn(
      '[ScenePlayer] A <Scene> element has no id. ' +
      'Assign id="..." to every <Scene> for stable scene identity.',
    );
  }
  if (sceneId) api.setSceneMeta({ id: String(sceneId) });
  // ... rest unchanged
};
```

**Verification**: `pnpm typecheck` passes.

---

### Step 3 — `ScenePlayer` provides context, switches to registration-based extraction

**File: `packages/core/src/player/ScenePlayer.tsx`**

3a. Add imports:

```typescript
import { SceneRegistrationContext } from '../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../compiler/SceneRegistrationContext';
```

3b. Remove the `Children.toArray` extraction block (introduced in `plan_scene_authoring_api.md`
Step 4b):

```typescript
// REMOVE entirely:
const allChildren = Children.toArray(props.children);
const rawSceneElements = allChildren.filter(...);
const nonSceneCount = allChildren.length - rawSceneElements.length;
// ... warning ...
const rawSpecs: InternalSceneSpec[] = rawSceneElements.map(...);
const sceneContentKey = ...;
const scenes = useMemo(() => rawSpecs, [sceneContentKey]);
```

3c. Replace with the registration-based mechanism from section 2.3:

```typescript
const registrationsRef = useRef(new Map<string, ReactElement>());
const lastContentKeyRef = useRef('');
const [scenes, setScenes] = useState<InternalSceneSpec[]>([]);

const register = useCallback((id: string, element: ReactElement) => {
  registrationsRef.current.set(id, element);
}, []);

const unregister = useCallback((id: string) => {
  registrationsRef.current.delete(id);
}, []);

const registrationContextValue = useMemo(
  (): SceneRegistrationValue => ({ register, unregister }),
  [register, unregister],
);

// Flush registrations to state after all child layout effects have fired.
// Guards with lastContentKeyRef to prevent the register → setState → re-render loop.
useEffect(() => {
  const specs = Array.from(registrationsRef.current.entries()).map(
    ([id, el]): InternalSceneSpec => ({
      sceneKey: id,
      contentKey: serializeJsx(el),
      element: el,
    }),
  );
  const newKey = specs.map((s) => s.contentKey).join('|||');
  if (newKey === lastContentKeyRef.current) return;
  lastContentKeyRef.current = newKey;
  setScenes(specs);
});
```

3d. Wrap the return JSX in `SceneRegistrationContext.Provider` as the outermost wrapper:

```tsx
return (
  <SceneRegistrationContext.Provider value={registrationContextValue}>
    <VariableStoreContext.Provider value={engine.variableStore}>
      {/* ... other providers ... */}
    </VariableStoreContext.Provider>
  </SceneRegistrationContext.Provider>
);
```

3e. Remove the non-Scene children warning (no longer applicable).

3f. `children` prop becomes completely unrestricted — any React content is valid. The JSDoc
comment on the `children` prop updates accordingly:

```typescript
/**
 * Scene content. Direct <Scene id="..."> elements and React components that
 * render <Scene> are both supported. Non-scene children are silently ignored
 * by the compilation pipeline but render normally in the React tree.
 */
children: ReactNode;
```

**File: `packages/core/src/player/useSceneEngine.ts`**

3g. The `UseSceneEngineOptions.scenes` field changes from being derived from `Children.toArray`
to being derived from the registration mechanism. The type and the internal adapter are
unchanged — `scenes: InternalSceneSpec[]` is still the input. No changes needed in
`useSceneEngine.ts`.

**Verification**: `pnpm typecheck` passes.

---

### Step 4 — Migrate `id` prop to required on `<Scene>` in all examples

**Files: `apps/examples/**`**

Any `<Scene key="arch-auto">` without an `id` prop is now a TypeScript error. For each
failing callsite: add `id="arch-auto"` matching the former `key` value.

Since `plan_scene_authoring_api.md` already converted all examples to the `{sceneElement}`
pattern and most used `key`, this step converts those to `id`:

```tsx
// Before (from plan_scene_authoring_api.md):
export const sceneArchAuto = (
  <Scene key="arch-auto">...</Scene>
);

// After:
export const sceneArchAuto = (
  <Scene id="arch-auto">...</Scene>
);
```

**Search**: `grep -rn 'key=' apps/examples --include="*.tsx" | grep '<Scene'`

**Verification**: `pnpm typecheck` passes on the examples package.

---

### Step 5 — Update tests

**File: `packages/core/src/compiler/__tests__/sceneRootIdentity.test.tsx`**

Update existing tests to use `id` as primary:
- `<Scene id="arch">` → `SceneFrame.id === "arch"` ✅ (was already testing id as fallback)
- Remove test for `key`-only identity (key is now secondary) or retain as backward-compat test

**New file: `packages/core/src/player/__tests__/SceneRegistration.test.tsx`**

Test the self-registration mechanism:

```typescript
// Test that Scene self-registers into SceneRegistrationContext
it('Scene registers its id into the provided context', () => {
  const registered = new Map<string, ReactElement>();
  const value: SceneRegistrationValue = {
    register: (id, el) => registered.set(id, el),
    unregister: (id) => registered.delete(id),
  };
  render(
    <SceneRegistrationContext.Provider value={value}>
      <Scene id="test-scene">
        <Lighting />
      </Scene>
    </SceneRegistrationContext.Provider>,
  );
  expect(registered.has('test-scene')).toBe(true);
});

// Test that Scene unregisters on unmount
it('Scene unregisters on unmount', () => {
  const registered = new Map<string, ReactElement>();
  // ...mount and unmount...
  expect(registered.has('test-scene')).toBe(false);
});

// Test that re-render with new props updates the registered element
it('Scene updates registration when props change', () => { ... });

// Test ordering: multiple Scenes register in render order
it('multiple Scenes register in source order', () => {
  // render <Scene id="a"/>, <Scene id="b"/>, <Scene id="c"/>
  // assert Map keys are ["a", "b", "c"]
});

// Test MyScene pattern
it('a component wrapping Scene registers correctly', () => {
  const MyScene = () => <Scene id="wrapped"><Lighting /></Scene>;
  // render <MyScene />, assert registration id="wrapped"
});
```

**File: `packages/core/src/player/__tests__/ScenePlayer.sceneExtraction.test.tsx`**

Update extraction tests to reflect the registration model:
- Remove tests that assert non-Scene children trigger warnings (warning removed)
- Add test that a mixed `<MyScene/>` + direct `<Scene id>` arrangement produces correct
  ordered `InternalSceneSpec[]`

**Verification**: `pnpm --filter @brewsite/core test` passes.

---

## 4. Files Changed Summary

| File | Change |
|---|---|
| `packages/core/src/compiler/SceneRegistrationContext.ts` | **New** — context and `SceneRegistrationValue` type |
| `packages/core/src/compiler/sceneDslCompiler.ts` | `Scene` becomes a self-registering component; `id` required; `sceneRootHandler` prioritises `props.id`; `useIsomorphicLayoutEffect` added |
| `packages/core/src/player/ScenePlayer.tsx` | Remove `Children.toArray` extraction; remove non-Scene warning; add `registrationsRef`, `register`/`unregister` callbacks, flush `useEffect`; wrap JSX in `SceneRegistrationContext.Provider` |
| `packages/core/src/compiler/SceneRegistrationContext.ts` | (same as new file above) |
| `packages/core/src/compiler/sceneTypes.ts` | `Scene` `id` prop: `id?: string` → `id: string` (required) |
| `packages/core/src/player/index.ts` | No public API change — `SceneRegistrationContext` is internal |
| `apps/examples/**/*.tsx` | All `<Scene key="...">` without `id` → add `id="..."` |
| `packages/core/src/compiler/__tests__/sceneRootIdentity.test.tsx` | Update for `id`-primary handler |
| `packages/core/src/player/__tests__/SceneRegistration.test.tsx` | **New** — self-registration tests |
| `packages/core/src/player/__tests__/ScenePlayer.sceneExtraction.test.tsx` | Update for registration-based extraction |

---

## 5. Edge Cases and Constraints

### Scene outside ScenePlayer

If `<Scene id="...">` renders outside a `SceneRegistrationContext.Provider`, the context
value is `null`. The `useIsomorphicLayoutEffect` checks `registration?.register(...)` —
optional chaining means this silently no-ops. No crash, no registration.

This is the correct behavior for `<Scene>` used in tests or standalone without a player.
Add a dev-mode warning if desired in a future pass.

### Dynamic scene lists

```tsx
// Adding/removing scenes dynamically works correctly:
<ScenePlayer id="player" ...>
  {scenes.map(s => <MyScene key={s.id} sceneId={s.id} />)}
</ScenePlayer>
```

When a scene unmounts, its `useIsomorphicLayoutEffect` cleanup calls `unregister(id)`.
The flush `useEffect` runs, computes a new content key, calls `setScenes`. Recompilation
triggers. This is correct and expected behavior.

`key` on `<MyScene>` is for React reconciliation — prevents remount/unmount churn when the
list reorders. `id` on `<Scene>` is the logical scene identity for compilation.

### Scene that doesn't render a `<Scene>` component

A component that renders nothing or renders non-Scene content inside ScenePlayer has no
effect on the scene registry. It renders normally as a React component. The compilation
pipeline ignores it entirely.

### `serializeJsx` on reconstructed elements

The reconstructed element `React.createElement(Scene, props)` has `key: null`. The
`serializeJsx` function serializes it as `Scene[null](id:"arch-auto",...){}...}`. The
`null` key is stable — same element reconstructed from same props always produces the same
`contentKey`. Content change detection works correctly.

### `Children.toArray` removal — `.$` prefix no longer occurs

The `.$` prefix stripping in `sceneRootHandler` is now unreachable in the normal path
(props.id is primary and always set) but is kept as dead-but-safe code. It can be removed
in a future cleanup once the migration is confirmed complete.

---

## 6. Dependency Direction Validation

| Import | Direction | Valid? |
|---|---|---|
| `sceneDslCompiler.ts` → `compiler/SceneRegistrationContext.ts` | `compiler → compiler` | ✅ |
| `ScenePlayer.tsx` → `compiler/SceneRegistrationContext.ts` | `player → compiler` | ✅ |
| `ScenePlayer.tsx` → `compiler/sceneDslCompiler.ts` (Scene component) | `player → compiler` | ✅ |
| `compiler/SceneRegistrationContext.ts` → (nothing) | no deps | ✅ |

No layer violations. `SceneRegistrationContext` living in `compiler/` is correct because
`Scene` (which uses it) is defined in `compiler/sceneDslCompiler.ts`.

---

## 7. Decisions Resolved

| Topic | Decision |
|---|---|
| `<MyScene/>` vs `{myScene}` | Both supported after this plan. `<MyScene/>` renders inside the React tree; direct elements work identically to Phase 1. |
| Identity: `key` vs `id` | `id` on `<Scene>` is canonical. `key` on `<Scene>` or wrapper is React reconciliation only. |
| `id` required or optional | Required on `<Scene>`. This is a breaking change from Phase 1's `key`-only approach, but is the only mechanism accessible inside a component. |
| Hook availability inside scene components | All ScenePlayer contexts are accessible because `<MyScene/>` renders inside the provider tree. |
| Infinite loop prevention | `lastContentKeyRef` guards the flush `useEffect` — only calls `setScenes` when content actually changes. |
| Registration ordering | JavaScript `Map` insertion order + React's depth-first render order = stable scene ordering. `Map.set` on existing key preserves position. |
| Non-Scene children warning | Removed. Any React content can be a child of ScenePlayer; non-Scene components are inert from the compilation pipeline's perspective. |
| `SceneRegistrationContext` placement | `compiler/` — because `Scene` (its consumer) lives in `compiler/`. Both `compiler` and `player` can import from `compiler`. |
| SSR | `useIsomorphicLayoutEffect` = `useLayoutEffect` on client, `useEffect` on server. No SSR warnings. Registration is a no-op on server (context is null-safe). |
