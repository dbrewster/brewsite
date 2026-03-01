---
title: "Engine Decomposition — EngineProvider, SceneCanvas, EngineOverlayHost"
doc_type: plan
owner: brewflow-architect
status: active
updated: 2026-02-28
---

# Engine Decomposition — Implementation Plan

## 0. Background and Motivation

`ScenePlayer` is a monolith. It fuses four independent concerns into one component:

1. **Engine creation** — manifest fetch, widget registry construction, `useSceneEngine` call,
   Three.js renderer lifecycle, the `RuntimeLoop`.
2. **Canvas rendering** — the `<canvas>` element, its `ref` wiring, its `ResizeObserver`.
3. **Scroll/input infrastructure** — the tall scroll spacer, sticky container, input listeners.
4. **Context provision** — the React contexts that hooks read from.

Because these concerns are fused, every consumer of `ScenePlayer` gets exactly one layout
model (scroll spacer + sticky canvas). There is no way to:

- Place the canvas freely in a CSS Grid or Flexbox layout.
- Have sibling React components outside `<ScenePlayer>` read engine state.
- Embed a scene canvas inside a scrolling page section without taking over the scroll.
- Replace the HUD overlay system with natural React children inside `<Scene>`.

The HUD system (`<Hud>`, `<HudItem>`, `hudCompiler.ts`, `HudOverlay.tsx`) exists precisely
because content could not live naturally inside the scene — it had to be compiled into the
`SceneTrack` and read back out. This was the wrong solution to the right problem. ReactNodes
should not live in compiled output.

This plan decomposes `ScenePlayer` into composable primitives, adds scene overlay content
as natural React children of `<Scene>`, removes the compiled HUD pipeline entirely, and
extends the global player registry so engine state is accessible from outside the React
subtree.

---

## 1. Architecture Summary

### Before this plan

```
<ScenePlayer>
  (manifest fetch, widget registry, useSceneEngine, Three.js lifecycle)
  <SceneRegistrationContext.Provider>
    <EngineContext.Provider>
      <EngineStateContext.Provider>
        <div style={{ position:'relative' }}>
          <EngineInputRegion>          ← owns canvas + scroll spacer + ResizeObserver
            <canvas ref={engine.setCanvasRef} />
            <HudOverlay items={tick.hudPrimitives} />   ← compiled HUD, wrong
            <LabelItem * />
          </EngineInputRegion>
        </div>
      </EngineStateContext.Provider>
    </EngineContext.Provider>
  </SceneRegistrationContext.Provider>
</ScenePlayer>
```

### After this plan

```
<EngineProvider>             ← engine creation + all context providers (no DOM)
  <Scene id="intro">
    <Camera />               ← DSL — compiled into SceneTrack as before
    <Model />
    <div className="panel">  ← HTML — new: collected as scene overlay, NOT compiled
      <h1>Hello</h1>
    </div>
  </Scene>

  {/* Host layout — any structure the caller wants */}
  <div className="docs-layout">
    <Sidebar />              ← reads useEngineState() — works because EngineProvider is above
    <main>
      <SceneCanvas />        ← renders <canvas>, registers itself, owns ResizeObserver
      <EngineOverlayHost />  ← renders current scene's HTML overlay above the canvas
    </main>
  </div>
</EngineProvider>
```

`ScenePlayer` survives as a **thin composition** of the above for the common full-page
scroll case. Its props contract is unchanged.

---

## 2. What is Deleted

The compiled HUD pipeline is removed in its entirety. It was the workaround for the
problem this plan solves.

| Deleted file | Reason |
|---|---|
| `packages/core/src/hud/HudOverlay.tsx` | Replaced by `EngineOverlayHost` |
| `packages/core/src/hud/HudItem.tsx` | No longer needed — overlay is raw React |
| `packages/core/src/hud/HudPhaseContext.ts` | No longer needed |
| `packages/core/src/hud/types.ts` | `HudItemDefinition`, `HudItemResolved` no longer exist |
| `packages/core/src/compiler/hudCompiler.ts` | Compiled HUD eliminated |
| `packages/core/src/compiler/blocks/hudBlocks.tsx` | `<Hud>` and `<HudItem>` DSL components eliminated |

**Retained from `hud/`:**
- `packages/core/src/hud/animejs/` — the animation utility hooks (`useScrollTimeline`,
  `transitions.tsx`) are independently useful for animating overlay content and are not
  tied to the compiled pipeline. They are retained unchanged.
- `packages/core/src/hud/index.ts` — updated to re-export only the animejs utilities.

**Migration note:** Existing usage of `<Hud>` and `<HudItem>` DSL components must be
migrated to HTML children directly inside `<Scene>`:

```tsx
// Before (compiled HUD — deleted):
<Scene id="hero">
  <Camera />
  <Hud>
    <HudItem id="title" style={{ top: '10%', left: '50%' }}>
      <h1>Hello World</h1>
    </HudItem>
  </Hud>
</Scene>

// After (overlay content — natural React):
<Scene id="hero">
  <Camera />
  <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)' }}>
    <h1>Hello World</h1>
  </div>
</Scene>
```

---

## 3. Data Model Changes

### 3.1 `SceneFrame` — remove hudItems, add sceneOverlay

File: `packages/core/src/compiler/sceneTrackTypes.ts`

```typescript
// REMOVE these fields from SceneFrame:
//   hudItems?: HudItemDefinition[];
//   labels?: LabelResolved[];         ← KEEP — labels are not being removed

// ADD this field to SceneFrame:

/**
 * Non-DSL React children collected from <Scene> during compilation.
 * These are HTML elements and non-registered React components that the
 * compiler passed over. They are NOT stored in the tick array — they are
 * rendered by EngineOverlayHost in the player layer when this scene is active.
 */
sceneOverlay?: ReactNode;
```

The `import type { ReactNode } from 'react'` must be added at the top of
`sceneTrackTypes.ts`. This is the only React import this file will ever have — it is
a type-only import and does not affect the module's runtime-independence.

### 3.2 `SceneTrackTick` — remove hudPrimitives

File: `packages/core/src/compiler/sceneTrackTypes.ts`

```typescript
// REMOVE from SceneTrackTick:
//   hudPrimitives?: HudItemResolved[];
```

Label primitives stay:
```typescript
// KEEP in SceneTrackTick:
labelPrimitives?: LabelResolved[];
```

### 3.3 `SceneTrack` — add sceneOverlays

File: `packages/core/src/compiler/sceneTrackTypes.ts`

```typescript
// ADD to SceneTrack:

/**
 * Map from sceneId to overlay ReactNode for all scenes that declared
 * non-DSL React children. Built by sceneTrackCompiler from SceneFrame.sceneOverlay.
 *
 * Absent from the SceneTrack cache serialization concern because the cache
 * is in-memory only — Map<string, ReactNode> is safe here.
 *
 * EngineOverlayHost reads this to render the active scene's content.
 */
sceneOverlays: Map<string, ReactNode>;
```

### 3.4 `CompileApi` — remove pushHudItem, no other changes

File: `packages/core/src/compiler/sceneDslTypes.ts`

```typescript
// REMOVE from CompileApi:
//   pushHudItem(item: HudItemDefinition): void;

// All other CompileApi methods are unchanged.
```

### 3.5 `CompileHelpers` — add compileChildrenAndCollectOverlay

File: `packages/core/src/compiler/sceneDslTypes.ts`

```typescript
// ADD to CompileHelpers:

/**
 * Processes all children of node. DSL children (elements with registered
 * NodeHandlers) are compiled into api.state as usual. Non-DSL children
 * (HTML elements and non-registered React components) are collected and
 * returned as a ReactNode array for use as scene overlay content.
 *
 * Called only by sceneRootHandler. Other handlers use compileChildren.
 */
compileChildrenSeparated(
  node: ReactElement,
  api: CompileApi,
): ReactNode[];
```

### 3.6 `ScenePlayerRegistry.ts` — extend to full engine state

File: `packages/core/src/player/ScenePlayerRegistry.ts`

Add a second registry alongside `SceneRuntimeState` for live frame state:

```typescript
export type SceneEngineSnapshot = {
  readonly sceneId: string;
  readonly sceneIndex: number;
  readonly sceneProgress: number;
  readonly progress: number;
};

// Internal module-level storage (alongside existing `states` and `listeners` maps):
const engineSnapshots = new Map<string, SceneEngineSnapshot>();
const engineSnapshotListeners = new Map<string, Set<() => void>>();

export const setEngineSnapshot = (id: string, snapshot: SceneEngineSnapshot): void => {
  engineSnapshots.set(id, snapshot);
  engineSnapshotListeners.get(id)?.forEach((fn) => fn());
};

// Returns null (not a default snapshot) when the id is not registered.
// This gives consumers a reliable "not mounted" signal distinct from a mounted engine
// that happens to be at frame 0 with sceneId ''. The | null return type is honest.
export const getEngineSnapshot = (id: string): SceneEngineSnapshot | null =>
  engineSnapshots.get(id) ?? null;

export const subscribeEngineSnapshot = (id: string, listener: () => void): (() => void) => {
  if (!engineSnapshotListeners.has(id)) engineSnapshotListeners.set(id, new Set());
  engineSnapshotListeners.get(id)!.add(listener);
  return () => {
    engineSnapshotListeners.get(id)?.delete(listener);
    if (engineSnapshotListeners.get(id)?.size === 0) engineSnapshotListeners.delete(id);
  };
};

// Call this from unregisterSceneRuntime (existing function) to clean up both registries:
// engineSnapshots.delete(id);
// engineSnapshotListeners.delete(id);
```

---

## 4. Compiler Changes

### 4.1 `sceneDslCompiler.ts` — add `compileChildrenSeparated`

The key change: the `sceneRootHandler` no longer calls `helpers.compileChildren`. It calls
the new `compileChildrenSeparated` which separates DSL children from overlay children.

**Add `compileChildrenSeparated` to the `helpers` object:**

```typescript
// In the `helpers` constant in sceneDslCompiler.ts:
compileChildrenSeparated: (node: ReactElement, api: CompileApi): ReactNode[] => {
  const children = collectChildren(node);
  const overlayNodes: ReactNode[] = [];

  for (const child of children) {
    if (!isValidElement(child)) {
      // Text nodes, numbers, booleans — treat as overlay content
      if (child !== null && child !== undefined && child !== false) {
        overlayNodes.push(child as ReactNode);
      }
      continue;
    }
    const childEl = child as ReactElement;

    // String type = native HTML element (div, h1, p, span, etc.) → overlay
    if (typeof childEl.type === 'string') {
      overlayNodes.push(childEl);
      continue;
    }

    // Registered DSL component → compile as normal
    const handler = getNodeHandler(childEl.type);
    if (handler) {
      handler(childEl, api, helpers);
      continue;
    }

    // Non-registered function component → try expanding
    if (typeof childEl.type === 'function' && !isPrimitiveComponent(childEl.type)) {
      const expanded = expandNode(childEl);
      let anyCompiled = false;
      // Collect HTML nodes found during expansion separately before committing them.
      // This avoids the double-push bug: if a component renders only HTML (no DSL),
      // anyCompiled stays false AND the individual HTML nodes would already be in
      // overlayNodes — then the whole-component fallback would push childEl on top,
      // rendering the content twice. Using pendingHtml as a staging area prevents this.
      const pendingHtml: ReactNode[] = [];
      for (const next of expanded) {
        if (isValidElement(next)) {
          const nextEl = next as ReactElement;
          const nextHandler = getNodeHandler(nextEl.type);
          if (nextHandler) {
            nextHandler(nextEl, api, helpers);
            anyCompiled = true;
          } else if (typeof nextEl.type === 'string') {
            // HTML inside expanded component — stage, don't commit yet
            pendingHtml.push(nextEl);
          }
        }
      }
      if (anyCompiled) {
        // Mixed component: DSL parts compiled, HTML parts become overlay
        overlayNodes.push(...pendingHtml);
      } else if (pendingHtml.length > 0) {
        // HTML-only expansion: use the individual collected nodes (not the wrapper)
        overlayNodes.push(...pendingHtml);
      } else {
        // No expansion yield at all: treat whole element as overlay
        overlayNodes.push(childEl);
      }
    }
  }

  return overlayNodes;
},
```

**Update `sceneRootHandler` to use `compileChildrenSeparated`:**

```typescript
const sceneRootHandler: NodeHandler = (node, api, helpers) => {
  const props = node.props as { /* existing prop types */ };

  // ... all existing prop handling unchanged (id, meta, metalnessMultiplier, etc.) ...

  // Replace the final `helpers.compileChildren(node, api)` call with:
  const overlayNodes = helpers.compileChildrenSeparated(node, api);

  if (overlayNodes.length > 0) {
    api.state.sceneOverlay = overlayNodes.length === 1
      ? overlayNodes[0]
      : React.createElement(React.Fragment, null, ...overlayNodes);
  }
};
```

**Remove `pushHudItem` from `createApi`:**

```typescript
// In createApi(), REMOVE:
//   pushHudItem: (item) => {
//     state.hudItems = state.hudItems ?? [];
//     state.hudItems.push(item);
//   },
```

### 4.2 `sceneTrackCompiler.ts` — build sceneOverlays, remove HUD compilation

After all `SceneFrame[]` are produced, collect overlay content into a Map:

```typescript
// At the end of the compilation pass, before returning SceneTrack:

const sceneOverlays = new Map<string, ReactNode>();
for (const frame of frames) {
  if (frame.sceneOverlay !== undefined) {
    sceneOverlays.set(frame.id, frame.sceneOverlay);
  }
}

// Include in SceneTrack:
const sceneTrack: SceneTrack = {
  ticks,
  sceneOverlays,
  progressProfile,   // from ProgressManager plan
  // ... other existing fields ...
};
```

Remove all HUD compilation calls. Search for references to `compileHudItems`,
`hudPrimitives`, and `hudItems` in `sceneTrackCompiler.ts` and delete them.
The `hudCompiler.ts` import is also removed.

### 4.3 `compiler/index.ts` — remove HUD DSL exports

```typescript
// REMOVE:
//   export { Hud, HudItem } from './blocks/hudBlocks';
//   export type { HudProps, HudItemDslProps } from './blocks/hudBlocks';
```

All other exports unchanged.

---

## 5. New Player Primitives

### 5.1 `EngineProvider`

File: `packages/core/src/player/EngineProvider.tsx`

`EngineProvider` owns everything `ScenePlayer` currently does except layout and DOM
rendering. It has no DOM output of its own — it renders only contexts and children.

```typescript
import {
  useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ReactElement,
} from 'react';
import type { AssetManifest } from '../elements/model/metadata';
import { clipMetaFromManifest, assertManifestValid } from '../elements/model/metadata';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import { createDefaultWidgetRegistry } from './defaultWidgets';
import { useSceneEngine } from './useSceneEngine';
import { EngineContext } from './EngineContext';
import { EngineStateContext } from './EngineStateContext';
import { VariableStoreContext } from '../widget/VariableStoreContext';
import { LabelPositioner } from './LabelPositioner';
import { LabelPositionerContext } from './LabelPositionerContext';
import { SceneRegistrationContext } from '../compiler/SceneRegistrationContext';
import type { SceneRegistrationValue } from '../compiler/SceneRegistrationContext';
import { clearCache } from '../compiler/sceneTrackCache';
import { serializeJsx } from './serializeJsx';
import {
  setSceneRuntimeState,
  setEngineSnapshot,
  unregisterSceneRuntime,
} from './ScenePlayerRegistry';
import { SceneMetaWidget } from './SceneMetaWidget';
import type { InternalSceneSpec } from './engineTypes';
import type { SceneModel } from '../elements/model/types';
import type { SceneNavInputMap } from '../input/types';
import type { CompileWarning } from '../compiler/sceneTrackTypes';

export type EngineProviderProps = {
  /** When provided, registers engine state in the global registry for useSceneEngineState(id). */
  id?: string;
  manifestUrl: string;
  widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;
  fpsCap?: number;
  pixelsPerScene?: number;
  framesPerTick?: number;
  quality?: 'performance' | 'balanced' | 'high';
  onReady?: () => void;
  onError?: (error: Error) => void;
  onManifestError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
  inputMap?: SceneNavInputMap;
  controlledProgress?: number;
  onControlledProgressChange?: (p: number) => void;
  /** All children — <Scene> declarations, layout, overlay hosts, siblings. */
  children: ReactNode;
};

const QUALITY_PRESET_FRAMES: Record<NonNullable<EngineProviderProps['quality']>, number> = {
  performance: 30,
  balanced: 60,
  high: 120,
} as const;

export const EngineProvider = (props: EngineProviderProps): ReactElement | null => {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);

  // Scene registration — same mechanism as ScenePlayer today
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

  // Sync scenes on every render (same pattern as ScenePlayer)
  useEffect(() => {
    const specs = Array.from(registrationsRef.current.entries()).map(
      ([id, element]): InternalSceneSpec => ({
        sceneKey: id,
        contentKey: serializeJsx(element),
        element,
      }),
    );
    const contentKey = specs.map((s) => s.contentKey).join('|||');
    if (contentKey === lastContentKeyRef.current) return;
    lastContentKeyRef.current = contentKey;
    setScenes(specs);
  });

  // Manifest fetch
  useEffect(() => {
    let cancelled = false;
    fetch(props.manifestUrl)
      .then((r) => r.json())
      .then((raw) => {
        if (cancelled) return;
        setManifest(assertManifestValid(raw));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e instanceof Error ? e : new Error(String(e));
        props.onError?.(err);
        props.onManifestError?.(err);
      });
    return () => { cancelled = true; };
  }, [props.manifestUrl]);

  // Cache cleanup on unmount
  useEffect(() => () => clearCache(), []);

  const widgetRegistry = useMemo(() => {
    if (!manifest) return createDefaultWidgetRegistry(null, { defaultModelStates: props.defaultModelStates });
    return props.widgetSetup
      ? props.widgetSetup(manifest)
      : createDefaultWidgetRegistry(manifest, { defaultModelStates: props.defaultModelStates });
  }, [manifest, props.widgetSetup, props.defaultModelStates]);

  // Wire onSceneChange to the SceneMetaWidget
  useEffect(() => {
    const metaWidget = widgetRegistry.get('__scene_meta__');
    if (metaWidget && typeof (metaWidget as SceneMetaWidget).setOnSceneChange === 'function') {
      (metaWidget as SceneMetaWidget).setOnSceneChange(props.onSceneChange);
    }
  }, [widgetRegistry, props.onSceneChange]);

  const labelPositioner = useMemo(() => new LabelPositioner(), []);
  const clipMeta = useMemo(() => (manifest ? clipMetaFromManifest(manifest) : []), [manifest]);

  const resolvedFramesPerTick =
    props.framesPerTick ??
    (props.quality !== undefined ? QUALITY_PRESET_FRAMES[props.quality] : undefined);

  const engine = useSceneEngine({
    scenes,
    widgetRegistry,
    clipMeta,
    manifest,
    fpsCap: props.fpsCap,
    pixelsPerScene: props.pixelsPerScene,
    framesPerTick: resolvedFramesPerTick,
    onReady: props.onReady,
    onError: props.onError,
    onWidgetError: props.onWidgetError,
    onCompileWarning: props.onCompileWarning,
    labelPositioner,
    inputMap: props.inputMap,
    controlledProgress: props.controlledProgress,
    onControlledProgressChange: props.onControlledProgressChange,
  });

  // Push full engine state to global registry every time frameState changes
  const { id } = props;
  const assetsReady = engine.debug?.assetsReady ?? false;
  const viewport = engine.debug?.viewport ?? { width: 1, height: 1 };

  useEffect(() => {
    if (!id) return undefined;
    setSceneRuntimeState(id, {
      assetsReady,
      viewport: {
        width: viewport.width,
        height: viewport.height,
        aspectRatio: viewport.width / Math.max(1, viewport.height),
      },
      variables: engine.variableStore,
      numScenes: scenes.length,
    });
    return () => unregisterSceneRuntime(id);
  }, [id, assetsReady, viewport.width, viewport.height, engine.variableStore, scenes.length]);

  // Push frame-level snapshot (sceneId, progress, etc.) every tick
  useEffect(() => {
    if (!id) return;
    setEngineSnapshot(id, {
      sceneId: engine.frameState.sceneId,
      sceneIndex: engine.frameState.sceneIndex,
      sceneProgress: engine.frameState.sceneProgress,
      progress: engine.progress,
    });
  }, [id, engine.frameState, engine.progress]);

  const engineState = useMemo(() => ({
    progress: engine.progress,
    sceneId: engine.frameState.sceneId,
    sceneIndex: engine.frameState.sceneIndex,
    sceneProgress: engine.frameState.sceneProgress,
  }), [engine.progress, engine.frameState]);

  // SSR policy: always render children. Contexts provide meaningful empty/default
  // values on the server so that layout, nav, and static content render correctly
  // during SSR or static generation. Engine internals (Three.js, RuntimeLoop, manifest
  // fetch) are guarded inside useSceneEngine with typeof window checks and return
  // no-op values on the server. SceneCanvas renders null on the server. This means
  // a docs page wrapping its sidebar and content column in EngineProvider gets a
  // fully-rendered HTML shell on the server that hydrates correctly on the client.
  //
  // Consumers who need a hard client-only boundary should wrap EngineProvider in a
  // Suspense boundary with a server-side fallback, or use React.lazy + dynamic import
  // with ssr: false. EngineProvider itself does not impose a client-only constraint.

  return (
    <SceneRegistrationContext.Provider value={registrationContextValue}>
      <VariableStoreContext.Provider value={engine.variableStore}>
        <LabelPositionerContext.Provider value={labelPositioner}>
          <EngineStateContext.Provider value={engineState}>
            <EngineContext.Provider value={engine}>
              {props.children}
            </EngineContext.Provider>
          </EngineStateContext.Provider>
        </LabelPositionerContext.Provider>
      </VariableStoreContext.Provider>
    </SceneRegistrationContext.Provider>
  );
};
```

### 5.2 `SceneCanvas`

File: `packages/core/src/player/SceneCanvas.tsx`

`SceneCanvas` renders as a real `<canvas>` element. It registers itself with the engine
via `EngineContext` on mount and unregisters on unmount. It owns the `ResizeObserver`
that drives `engine.setViewportSize`. Three.js renders into this canvas because
`useSceneEngine` creates the `WebGLRenderer` with `canvas: canvasElement` when the
canvas ref arrives via `engine.setCanvasRef`.

```typescript
import { forwardRef, useEffect, useRef } from 'react';
import type { ReactElement, CanvasHTMLAttributes } from 'react';
import { useSceneEngineContext } from './EngineContext';

export interface SceneCanvasProps extends CanvasHTMLAttributes<HTMLCanvasElement> {
  /**
   * Optional React content to display while assets are loading (tickIndex < 0).
   * Rendered as a sibling absolutely positioned over the canvas.
   */
  placeholder?: ReactElement;
}

export const SceneCanvas = forwardRef<HTMLCanvasElement, SceneCanvasProps>(
  function SceneCanvas({ placeholder, style, ...rest }, forwardedRef) {
    const engine = useSceneEngineContext();
    const internalRef = useRef<HTMLCanvasElement>(null);

    // Register/unregister canvas with engine
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;
      engine.setCanvasRef(el);
      return () => { engine.setCanvasRef(null); };
    }, [engine.setCanvasRef]);

    // Forward external ref
    useEffect(() => {
      if (!forwardedRef) return;
      if (typeof forwardedRef === 'function') {
        forwardedRef(internalRef.current);
        return () => { forwardedRef(null); };
      }
      (forwardedRef as React.MutableRefObject<HTMLCanvasElement | null>).current =
        internalRef.current;
      return () => {
        (forwardedRef as React.MutableRefObject<HTMLCanvasElement | null>).current = null;
      };
    }, [forwardedRef]);

    // ResizeObserver drives engine.setViewportSize — moved here from EngineInputRegion
    useEffect(() => {
      const el = internalRef.current;
      if (!el) return;

      const update = () => {
        const rect = el.getBoundingClientRect();
        engine.setViewportSize(rect.width, rect.height);
      };
      update(); // initialize immediately

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(update);
        observer.observe(el);
      }
      window.addEventListener('resize', update, { passive: true });

      return () => {
        observer?.disconnect();
        window.removeEventListener('resize', update);
      };
    }, [engine.setViewportSize]);

    const isLoading = engine.frameState.tickIndex < 0;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <canvas
          ref={internalRef}
          tabIndex={-1}
          style={{ display: 'block', width: '100%', height: '100%' }}
          {...rest}
        />
        {isLoading && placeholder && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {placeholder}
          </div>
        )}
      </div>
    );
  },
);
```

**Important implementation note on `style` prop:** `SceneCanvas` wraps the `<canvas>` in
a `position: relative` container div so that the placeholder overlay can be absolutely
positioned over it. The `style` prop is applied to this outer div, not the inner canvas.
This means `width` and `height` on the `style` prop size the container (which is the
correct behavior — consumers size the container and the canvas fills it with `100%`).

If a consumer needs `ref` access to the raw `<canvas>` element, they use the forwarded
ref, which resolves to the `<canvas>` element, not the div.

### 5.3 `EngineOverlayHost`

File: `packages/core/src/player/EngineOverlayHost.tsx`

`EngineOverlayHost` reads the current `sceneId` from `EngineStateContext` and renders the
matching overlay `ReactNode` from `engine.sceneTrack.sceneOverlays`. It is positioned
`position: absolute; inset: 0` so it covers the canvas exactly. Place it as a sibling of
`SceneCanvas` inside a `position: relative` container.

When the scene changes, the previous overlay is unmounted and the new one mounts with a
CSS fade-in animation. Fancy transitions can be added inside the overlay content itself
using `hud/animejs/` utilities.

```typescript
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { useEngineState } from './EngineStateContext';
import { useSceneEngineContext } from './EngineContext';

export interface EngineOverlayHostProps {
  className?: string;
  /**
   * When true, pointer events pass through the overlay to the canvas.
   * Individual overlay elements can re-enable pointer events with:
   *   style={{ pointerEvents: 'auto' }}
   * Default: false (overlay intercepts pointer events — use for interactive content).
   */
  passthroughPointerEvents?: boolean;
}

export const EngineOverlayHost = ({
  className,
  passthroughPointerEvents = false,
}: EngineOverlayHostProps): ReactElement | null => {
  const { sceneId } = useEngineState();
  const engine = useSceneEngineContext();
  const overlayContent = engine.sceneOverlays?.get(sceneId);

  if (!overlayContent) return null;

  return (
    <div
      key={sceneId}                   // unmount + remount on scene change → CSS enter animation
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: passthroughPointerEvents ? 'none' : 'auto',
        animation: 'brewsite-overlay-enter 200ms ease-out',
      }}
    >
      {overlayContent}
    </div>
  );
};
```

**CSS for `EngineOverlayHost`:** Add to the package's base CSS or inject via a
`<style>` tag in the component (implementation detail — use `@layer` to prevent
specificity conflicts):

```css
@keyframes brewsite-overlay-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

This is declared once in a CSS module co-located with `EngineOverlayHost`. It uses
CSS `@keyframes` — no JS animation dependency.

---

## 6. `useSceneEngine` Changes

File: `packages/core/src/player/useSceneEngine.ts`

### 6.1 `UseSceneEngineResult` — add sceneOverlays

```typescript
// ADD to UseSceneEngineResult:
/**
 * Map from sceneId to overlay ReactNode for scenes that contain non-DSL children.
 * Populated from sceneTrack.sceneOverlays after compilation.
 * Used by EngineOverlayHost to render active scene content.
 */
sceneOverlays: Map<string, ReactNode>;
```

### 6.2 Expose sceneOverlays in return value

```typescript
// In the return object of useSceneEngine:
sceneOverlays: sceneTrack?.sceneOverlays ?? new Map(),
```

No other changes to `useSceneEngine.ts`. The canvas ref, renderer lifecycle, and all
other engine logic is unchanged. The canvas element is still provided via `setCanvasRef`
— now called by `SceneCanvas` instead of `EngineInputRegion`.

---

## 7. `EngineInputRegion` Changes

File: `packages/core/src/player/EngineInputRegion.tsx`

`EngineInputRegion` loses canvas and ResizeObserver ownership. It becomes purely the
scroll-spacer + sticky container infrastructure for the standard scroll mode. Its
`children` prop is how the canvas and overlays are placed inside it.

**What is removed:**
- The `<canvas ref={engine.setCanvasRef} ...>` element — moved to `SceneCanvas`
- The `<div ref={engine.setBackgroundRef} ...>` — kept for background widget
- The `ResizeObserver` on the sticky div — moved to `SceneCanvas`
- `engine.setViewportSize` call — moved to `SceneCanvas`

**What remains:**
- The outer scroll spacer div in scroll mode
- The inner sticky/relative container div
- `tabIndex={-1}` and `onPointerDown` focus handling for keyboard events
- The `engine.scrollRegionRef` wiring
- The `fillContainer` / `mode` logic for height calculation

```typescript
// Updated EngineInputRegion — simplified:

export const EngineInputRegion = ({
  engine,
  className,
  children,
  fillContainer = false,
}: EngineInputRegionProps): ReactElement => {
  const mode = engine.inputMode;
  const viewportFill = fillContainer ? '100%' : '100vh';

  const innerContent = (
    <div
      tabIndex={-1}
      onPointerDown={(event) => {
        (event.currentTarget as HTMLDivElement).focus?.();
      }}
      style={{
        position: mode === 'scroll' ? 'sticky' : 'relative',
        top: 0,
        width: '100%',
        height: viewportFill,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* Background widget DOM element — unchanged */}
      <div
        ref={engine.setBackgroundRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundPosition: 'center', backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat', pointerEvents: 'none',
        }}
      />
      {/* Children — SceneCanvas, EngineOverlayHost, LabelItems, etc. */}
      {children && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          {children}
        </div>
      )}
    </div>
  );

  if (mode === 'direct') {
    return (
      <div
        ref={engine.scrollRegionRef}
        className={className}
        style={{ position: 'relative', height: viewportFill }}
      >
        {innerContent}
      </div>
    );
  }

  return (
    <div
      ref={engine.scrollRegionRef}
      className={className}
      style={{ position: 'relative', height: engine.scrollRegionHeightPx, overscrollBehavior: 'none' }}
    >
      {innerContent}
    </div>
  );
};
```

**Note:** `EngineInputRegion` no longer calls `engine.setViewportSize`. The
`ResizeObserver` is owned by `SceneCanvas`. This means `EngineInputRegion` no longer
imports or calls any viewport sizing function. The `engine` prop stays for access to
`inputMode`, `scrollRegionRef`, `scrollRegionHeightPx`, and `setBackgroundRef`.

---

## 8. `ScenePlayer` Refactor

File: `packages/core/src/player/ScenePlayer.tsx`

`ScenePlayer` becomes a thin composition of `EngineProvider` + `EngineInputRegion` +
`SceneCanvas` + `EngineOverlayHost` + `LabelItem` + `TimelineWidget`. Its props are
unchanged. It is the default entry point for the common full-page scroll case.

```typescript
import type { ReactElement, ReactNode } from 'react';
import { EngineProvider } from './EngineProvider';
import { EngineInputRegion } from './EngineInputRegion';
import { SceneCanvas } from './SceneCanvas';
import { EngineOverlayHost } from './EngineOverlayHost';
import { useSceneEngineContext } from './EngineContext';
import { useEngineState } from './EngineStateContext';
import { LabelItem } from '../labels/LabelItem';
import { TimelineWidget } from './TimelineWidget';
import { SceneInspector } from './SceneInspector';
// ... other imports ...

// Internal component that accesses engine context (must be child of EngineProvider)
const ScenePlayerInner = (props: ScenePlayerInnerProps): ReactElement => {
  const engine = useSceneEngineContext();
  const { sceneId } = useEngineState();
  const labels = engine.frameState.tick?.labelPrimitives ?? [];
  const isControlled = props.controlledProgress !== undefined;

  return (
    <div
      className={props.className}
      style={{ position: 'relative', ...(isControlled ? { height: '100%' } : {}) }}
    >
      {props.loadError && (
        <div role="alert">Scene engine error: {props.loadError.message}</div>
      )}
      <EngineInputRegion engine={engine} fillContainer={isControlled}>
        {/* Canvas fills the EngineInputRegion viewport */}
        <SceneCanvas
          placeholder={props.placeholder}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Scene overlay content — HTML children from <Scene> */}
        <EngineOverlayHost passthroughPointerEvents={false} />

        {/* 3D-tracked labels */}
        {labels.map((label) => (
          <LabelItem key={label.id} label={label} />
        ))}

        {/* Optional built-in timeline scrubber */}
        {props.timeline && (
          <TimelineWidget
            engine={engine}
            scenes={props.sceneIds}
            {...(typeof props.timeline === 'object' ? props.timeline : {})}
          />
        )}

        {/* Dev-mode inspector */}
        {props.debug && <SceneInspector scenes={props.sceneSpecs} />}
      </EngineInputRegion>
    </div>
  );
};

// Outer component — wraps EngineProvider then renders ScenePlayerInner
export const ScenePlayer = (props: ScenePlayerProps): ReactElement | null => {
  const [loadError, setLoadError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    setLoadError(err);
    props.onError?.(err);
  }, [props.onError]);

  if (typeof window === 'undefined') {
    return (props.placeholder ?? null) as ReactElement | null;
  }

  return (
    <EngineProvider
      id={props.id}
      manifestUrl={props.manifestUrl}
      widgetSetup={props.widgetSetup}
      fpsCap={props.fpsCap}
      pixelsPerScene={props.pixelsPerScene}
      framesPerTick={props.framesPerTick}
      quality={props.quality}
      onReady={props.onReady}
      onError={handleError}
      onManifestError={props.onManifestError}
      onWidgetError={props.onWidgetError}
      onCompileWarning={props.onCompileWarning}
      onSceneChange={props.onSceneChange}
      defaultModelStates={props.defaultModelStates}
      inputMap={props.inputMap}
      controlledProgress={props.controlledProgress}
      onControlledProgressChange={props.onControlledProgressChange}
    >
      {/* Scene declarations — <Scene> components register via SceneRegistrationContext */}
      {props.children}

      {/* Layout and rendering — reads EngineContext */}
      <ScenePlayerInner
        loadError={loadError}
        placeholder={props.placeholder}
        className={props.className}
        controlledProgress={props.controlledProgress}
        timeline={props.timeline}
        debug={props.debug}
        sceneIds={/* passed down from EngineProvider's scene list */}
        sceneSpecs={/* passed down from EngineProvider's scene list */}
      />
    </EngineProvider>
  );
};
```

**Resolution for `sceneIds`/`sceneSpecs` in ScenePlayerInner:** Add `sceneIds: string[]`
to `UseSceneEngineResult` in `useSceneEngine.ts`, derived from
`options.scenes.map((s) => s.sceneKey)`. `ScenePlayerInner` reads `engine.sceneIds`
directly — no prop-drilling needed. `SceneInspector` receives `engine.sceneIds` mapped
to `{ sceneKey: id, contentKey: '', element: null }` stubs (it only needs the ids for
display). `TimelineWidget` receives `engine.sceneIds.map((id) => ({ id }))`. This field
must be added to `UseSceneEngineResult` before `ScenePlayer.tsx` is refactored (step 10
in the implementation sequence), so `ScenePlayerInner` can be written without
placeholders from the start.

---

## 9. New Hook: `useSceneEngineState`

File: `packages/core/src/player/useSceneEngineState.ts`

Reads full engine state from the global registry. Works from anywhere in the React tree
— no `EngineProvider` ancestor required.

```typescript
import { useSyncExternalStore } from 'react';
import {
  getEngineSnapshot,
  subscribeEngineSnapshot,
  type SceneEngineSnapshot,
} from './ScenePlayerRegistry';

/**
 * Returns live engine state for a <ScenePlayer> or <EngineProvider> identified
 * by the given id prop. Works from anywhere in the React tree — the component
 * calling this hook does not need to be a descendant of the engine.
 *
 * Returns null if no engine with the given id is currently mounted.
 *
 * Updates on every frame tick (via useSyncExternalStore). For performance-sensitive
 * components that only need scene identity (not per-frame progress), use
 * useCurrentSceneExternal(id) instead.
 *
 * @example
 * function DocsSidebar() {
 *   const state = useSceneEngineState('docs');
 *   if (!state) return null;
 *   return <nav data-active={state.sceneId}>...</nav>;
 * }
 */
export function useSceneEngineState(id: string): SceneEngineSnapshot | null {
  // getEngineSnapshot returns null when the id is not in the registry, so the
  // | null return type is honest. Consumers can reliably write:
  //   const state = useSceneEngineState('docs');
  //   if (!state) return null; // engine not yet mounted
  return useSyncExternalStore(
    (onStoreChange) => subscribeEngineSnapshot(id, onStoreChange),
    () => getEngineSnapshot(id),   // null when not mounted
    () => null,                    // server: always null (no engine on server)
  );
}
```

**Performance note:** `useSceneEngineState` updates on every frame tick because
`setEngineSnapshot` is called from `useEffect` on `frameState` change in `EngineProvider`.
That effect fires on every React render triggered by `setFrameState` — which is every
animation frame. This is appropriate for components that display frame-level progress
(progress bars, animated sidebars). For components that only care about scene identity
changes (sidebar highlighting, URL sync), use a separate hook:

```typescript
// packages/core/src/player/useCurrentSceneExternal.ts
// Same mechanism but only fires when sceneId or sceneIndex changes.
// Implementation: derived from useSceneEngineState but memo-filtered.
```

This derived hook is out of scope for this plan but noted for future work.

---

## 10. `player/index.ts` — Updated Exports

```typescript
// NEW exports:
export { EngineProvider } from './EngineProvider';
export type { EngineProviderProps } from './EngineProvider';
export { SceneCanvas } from './SceneCanvas';
export type { SceneCanvasProps } from './SceneCanvas';
export { EngineOverlayHost } from './EngineOverlayHost';
export type { EngineOverlayHostProps } from './EngineOverlayHost';
export { useSceneEngineState } from './useSceneEngineState';
export type { SceneEngineSnapshot } from './ScenePlayerRegistry';

// REMOVE:
// (nothing removed from public API — all previous exports are kept)

// ScenePlayer, useSceneEngine, EngineInputRegion, etc. all remain.
```

---

## 11. `engineTypes.ts` — `InternalSceneSpec` Moves Here

Currently `InternalSceneSpec` is defined in `ScenePlayer.tsx` and imported by
`useSceneEngine.ts`. With `ScenePlayer` becoming a composition, and `EngineProvider`
also needing this type, it should live in a neutral location:

File: `packages/core/src/player/engineTypes.ts` (already exists — add to it)

```typescript
// Add to existing engineTypes.ts:
export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};
```

Remove the definition from `ScenePlayer.tsx`. Update imports in `ScenePlayer.tsx` and
`useSceneEngine.ts` to import from `./engineTypes`.

---

## 12. Composable Layout Patterns

These are not new components in this plan — they are usage examples that demonstrate
what becomes possible. Include in docs as reference patterns.

### Pattern A: Full-page scroll (ScenePlayer — unchanged)
```tsx
<ScenePlayer manifestUrl="..." quality="balanced">
  <Scene id="intro"><Camera /><Model /></Scene>
  <Scene id="next"><Camera position={[0,2,8]} /></Scene>
</ScenePlayer>
```

### Pattern B: Docs "movie" layout
```tsx
<EngineProvider id="docs" manifestUrl="...">
  <Scene id="getting-started">
    <Camera type="world" position={[2, 1.5, 6]} />
    <Model id="bot" src="robot" />
    <div className="panel">
      <h1>Getting Started</h1>
      <p>BrewSite is a TypeScript + React + Three.js framework.</p>
    </div>
  </Scene>

  <div className="layout">
    <DocsSidebar />   {/* reads useEngineState() — works! */}
    <main style={{ position: 'relative' }}>
      <SceneCanvas style={{ width: '100%', height: '55vh' }} />
      <EngineOverlayHost />
    </main>
  </div>
</EngineProvider>
```

### Pattern C: Embedded scroll-capture canvas in content page
```tsx
<article>
  <p>Normal page content above.</p>

  <EngineProvider manifestUrl="...">
    <Scene id="demo">
      <ProgressManager scrollUnits={2400} fn={(t) => Math.min(1, t * 4)} />
      <Camera type="orbit" />
      <Model id="bot" src="robot" />
      <div className="side-panel">
        <h2>Camera Controls</h2>
        <PropTable rows={cameraDocs} />
      </div>
    </Scene>

    <ScrollCaptureSection height={2400}>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <EngineOverlayHost />
    </ScrollCaptureSection>
  </EngineProvider>

  <p>Normal page content continues.</p>
</article>
```

### Pattern D: Access engine state from outside (sidebar, URL sync)
```tsx
function DocsSidebar() {
  // No EngineProvider ancestor required
  const state = useSceneEngineState('docs');

  return (
    <nav>
      {NAV_ITEMS.map((item) => (
        <a
          key={item.sceneId}
          className={state?.sceneId === item.sceneId ? 'active' : ''}
          onClick={() => { /* scrollToProgress via EngineProvider ref */ }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
```

---

## 13. Files Affected

| File | Change |
|---|---|
| `packages/core/src/compiler/sceneTrackTypes.ts` | Add `sceneOverlay` to `SceneFrame`; add `sceneOverlays` to `SceneTrack`; remove `hudItems` from `SceneFrame`; remove `hudPrimitives` from `SceneTrackTick` |
| `packages/core/src/compiler/sceneDslTypes.ts` | Add `compileChildrenSeparated` to `CompileHelpers`; remove `pushHudItem` from `CompileApi` |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Implement `compileChildrenSeparated`; update `sceneRootHandler` to use it; remove `pushHudItem` from `createApi` |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Build `sceneOverlays` map; attach to `SceneTrack`; remove all HUD compilation |
| `packages/core/src/compiler/index.ts` | Remove `Hud`, `HudItem`, `HudProps`, `HudItemDslProps` exports |
| `packages/core/src/player/engineTypes.ts` | Add `InternalSceneSpec` type |
| `packages/core/src/player/ScenePlayerRegistry.ts` | Add `SceneEngineSnapshot`, `setEngineSnapshot`, `getEngineSnapshot`, `subscribeEngineSnapshot`; update `unregisterSceneRuntime` to clean both registries |
| `packages/core/src/player/EngineContext.tsx` | `UseSceneEngineResult` gains `sceneOverlays`; fix error message to reference `EngineProvider` not `ScenePlayer` |
| `packages/core/src/player/useSceneEngine.ts` | Add `sceneOverlays` to return value; add `sceneIds: string[]` to return; import moved from `ScenePlayer.tsx` |
| `packages/core/src/player/EngineInputRegion.tsx` | Remove canvas element; remove ResizeObserver; remove `setViewportSize` call; keep scroll spacer + sticky container |
| `packages/core/src/player/ScenePlayer.tsx` | Refactor to `EngineProvider` + `ScenePlayerInner` composition; keep all props unchanged |
| `packages/core/src/player/index.ts` | Export `EngineProvider`, `SceneCanvas`, `EngineOverlayHost`, `useSceneEngineState`, `SceneEngineSnapshot` |
| `packages/core/src/hud/index.ts` | Remove all HUD component exports; keep only `animejs/` exports |
| **New** `packages/core/src/player/EngineProvider.tsx` | New file — engine creation + context provision |
| **New** `packages/core/src/player/SceneCanvas.tsx` | New file — `<canvas>` with registration + ResizeObserver |
| **New** `packages/core/src/player/EngineOverlayHost.tsx` | New file — scene overlay renderer |
| **New** `packages/core/src/player/useSceneEngineState.ts` | New file — global registry hook |
| **Delete** `packages/core/src/hud/HudOverlay.tsx` | Replaced by `EngineOverlayHost` |
| **Delete** `packages/core/src/hud/HudItem.tsx` | No longer needed |
| **Delete** `packages/core/src/hud/HudPhaseContext.ts` | No longer needed |
| **Delete** `packages/core/src/hud/types.ts` | `HudItemDefinition` eliminated |
| **Delete** `packages/core/src/compiler/hudCompiler.ts` | Compiled HUD eliminated |
| **Delete** `packages/core/src/compiler/blocks/hudBlocks.tsx` | `<Hud>` and `<HudItem>` DSL eliminated |

---

## 14. Testing Strategy

### 14.1 `compileChildrenSeparated.test.ts`

Location: `packages/core/src/compiler/__tests__/compileChildrenSeparated.test.ts`

```typescript
// Test: HTML elements are collected as overlay, not compiled
// Given: <Scene> with <Camera> and <div className="panel"><h1>Hello</h1></div>
// Assert: api.state.widgets['camera'] is set; api.state.sceneOverlay is the div element
//
// Test: Only DSL children → overlay is undefined
// Given: <Scene> with only <Camera> and <Lighting>
// Assert: api.state.sceneOverlay is undefined
//
// Test: Non-registered React component → treated as overlay
// Given: <Scene> with <Camera> and <MyCustomCard /> (no registered handler)
// Assert: api.state.sceneOverlay is <MyCustomCard />
//
// Test: React component that expands to DSL → compiled, not overlay
// Given: <Scene> with <MyCameraWrapper /> where MyCameraWrapper renders <Camera>
// Assert: api.state.widgets['camera'] is set; api.state.sceneOverlay undefined
//
// Test: Mixed — expands to DSL AND HTML → DSL compiled, HTML as overlay
// Given: Component renders <Camera /> and <div>text</div>
// Assert: camera compiled AND div in overlay
//
// Test: Multiple HTML children → wrapped in Fragment
// Given: <Scene> with <h1/> and <p/> as overlay
// Assert: api.state.sceneOverlay is a Fragment containing both elements
```

### 14.2 `sceneTrackCompiler.test.ts` additions

```typescript
// Test: sceneOverlays map is empty when no scene has overlay content
// Assert: sceneTrack.sceneOverlays.size === 0
//
// Test: sceneOverlays populated for scenes that have overlay content
// Given: Two scenes, one with overlay, one without
// Assert: map has exactly one entry with correct sceneId key
//
// Test: HUD compilation is fully removed
// Assert: SceneTrackTick has no hudPrimitives field
// Assert: SceneFrame has no hudItems field (TypeScript check sufficient)
```

### 14.3 `SceneCanvas.test.tsx`

Location: `packages/core/src/player/__tests__/SceneCanvas.test.tsx`

```typescript
// Setup: render SceneCanvas inside a mock EngineProvider that exposes a spy for setCanvasRef
//
// Test: setCanvasRef called with canvas element on mount
// Assert: engine.setCanvasRef called with HTMLCanvasElement
//
// Test: setCanvasRef called with null on unmount
// Assert: engine.setCanvasRef called with null during cleanup
//
// Test: placeholder shown when tickIndex < 0
// Assert: placeholder element present in DOM
//
// Test: placeholder hidden when tickIndex >= 0
// Assert: placeholder element absent from DOM
//
// Test: ResizeObserver calls engine.setViewportSize
// Requires: resize observer mock (vitest/jsdom supports ResizeObserver mock)
// Assert: engine.setViewportSize called with correct width/height
```

### 14.4 `EngineOverlayHost.test.tsx`

```typescript
// Test: renders nothing when current scene has no overlay
// Assert: returns null / empty DOM
//
// Test: renders overlay content for current scene
// Given: engine.sceneOverlays has entry for 'scene-1', current sceneId is 'scene-1'
// Assert: overlay content present in DOM
//
// Test: re-renders with new content when scene changes
// Given: sceneId changes from 'scene-1' to 'scene-2' with different overlays
// Assert: scene-2 overlay content present; scene-1 overlay not present
//
// Test: key changes on scene change (triggers React unmount/remount)
// Verify by checking that the overlay div has the correct key behavior
```

### 14.5 `useSceneEngineState.test.ts`

```typescript
// Test: returns null when no engine is registered with the given id
// Assert: hook returns null initially
//
// Test: returns snapshot when engine is registered
// Given: setEngineSnapshot('test', { sceneId: 'intro', ... })
// Assert: hook returns matching snapshot
//
// Test: updates when snapshot changes
// Given: snapshot set twice with different sceneId values
// Assert: hook value reflects latest snapshot
//
// Test: cleans up subscription on unmount
// Assert: no memory leak (listener set is empty after unmount)
```

### 14.6 `EngineProvider.test.tsx`

```typescript
// Test: SceneRegistrationContext is provided to children
// Assert: <Scene> components can register via useContext(SceneRegistrationContext)
//
// Test: EngineContext is provided to children
// Assert: useSceneEngineContext() succeeds inside EngineProvider
//
// Test: useEngineState() works inside EngineProvider
// Assert: returns { sceneId, sceneIndex, progress, sceneProgress }
//
// Test: global registry is updated when id prop is provided
// Assert: getEngineSnapshot('test-id') returns current snapshot
//
// Test: registry is cleaned up on unmount
// Assert: getEngineSnapshot('test-id') returns null after unmount
```

---

## 15. Implementation Sequence

Implement in this order to minimize broken intermediate states:

1. **`sceneTrackTypes.ts`** — data model changes first (types anchor everything)
2. **`sceneDslTypes.ts`** — add `compileChildrenSeparated` to `CompileHelpers`
3. **`sceneDslCompiler.ts`** — implement `compileChildrenSeparated` + update `sceneRootHandler`
4. **`sceneTrackCompiler.ts`** — build `sceneOverlays` map; remove HUD compilation
5. **`compiler/blocks/hudBlocks.tsx`** — delete
6. **`compiler/hudCompiler.ts`** — delete
7. **`compiler/index.ts`** — remove HUD exports
8. **`engineTypes.ts`** — move `InternalSceneSpec` here
9. **`ScenePlayerRegistry.ts`** — add `SceneEngineSnapshot` registry
10. **`useSceneEngine.ts`** — expose `sceneOverlays` and `sceneIds` in result
11. **`EngineProvider.tsx`** — new file (extracted from `ScenePlayer.tsx`)
12. **`SceneCanvas.tsx`** — new file
13. **`EngineOverlayHost.tsx`** — new file
14. **`useSceneEngineState.ts`** — new file
15. **`EngineInputRegion.tsx`** — remove canvas + ResizeObserver
16. **`ScenePlayer.tsx`** — refactor to composition
17. **Delete HUD files** — `HudOverlay.tsx`, `HudItem.tsx`, `HudPhaseContext.ts`, `hud/types.ts`
18. **`hud/index.ts`** — update to animejs-only exports
19. **`player/index.ts`** — add new exports
20. **Tests** — write after each file in the sequence above

Steps 1–7 (compiler layer) can be done in one pass and must be complete before the
player layer begins. Steps 11–16 are the player decomposition and should be done
together in a single commit.
