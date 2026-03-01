---
title: "BrewSite Core — Scene Authoring DSL"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-01
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full Scene Authoring DSL surface for @brewsite/core including SceneGroup, Scene, built-in DSL elements, authoring patterns, custom widget DSL extension, and snapshot context."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Scene Authoring API Simplification (plan_scene_authoring_api.md implemented). SceneGroup and SceneDefinition removed from public API and made internal. ScenePlayer now accepts <Scene key=\"...\"> elements as direct children instead of a sceneGroup prop. Scene identity migrated from id prop to React key prop (id retained as backward-compat fallback). index removed from SceneDefinition. getFrame(context) function form removed from public authoring surface — replaced by useSceneRuntime() hook. HMR handling made automatic via content-hash compilation. SceneSnapshotContext values now accessed via useSceneRuntime(playerId) in parent components. Added documentation for useSceneRuntime hook and ScenePlayerRegistry."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "DX improvements: transition easing added to Scene DSL. <Scene transition={{ easing: '...' }}> declares the easing curve for the transition into that scene. EasingName type exported with 5 built-in curves. Easing stored in SceneTrack.transitionEasings and applied to blockProgress in RuntimeDriverImpl before widget apply."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Two features implemented. (1) ProgressManager: <ProgressManager> added as a DSL child element inside <Scene>. Props: scrollUnits (proportional scroll budget) and fn (pure input pacing curve). Carry-forward merge semantics. Exported from compiler/index.ts. (2) Engine decomposition: <Hud> and <HudItem> removed from the DSL authoring surface. Non-DSL HTML children of <Scene> are collected by compileChildrenSeparated as overlay content rendered by EngineOverlayHost. Scene authoring section updated to replace Hud authoring pattern with HTML children pattern."
---

# BrewSite Core — Scene Authoring DSL

## 1. Overview

The Scene Authoring DSL is the primary developer-facing surface of `@brewsite/core`. It enables TypeScript developers to describe animated 3D marketing scenes as pure, declarative JSX — static snapshots of world state with no animation math, no Three.js, and no frame logic. Transitions between scenes are inferred structurally: when the same widget ID appears in two adjacent scenes, the compiler automatically produces a smooth interpolation. When an ID appears in only one of the two, the compiler produces an enter or exit transition.

This PRD defines the authoring contract: the components, props, types, and patterns that scene authors use to express intent. It does not cover the compiler's internal mechanics (see `prd_compiler.md`) or the runtime player integration (see the player PRD).

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Animated 3D web experiences are typically authored imperatively — developers write timeline callbacks, manage Three.js objects directly, and coordinate animation state across dozens of event listeners. This approach does not scale: it is brittle, hard to read, and impossible to hand off between team members.

BrewSite's DSL solves this by separating authoring concern from execution concern. Scene authors describe what the world looks like at each named moment. The compiler and runtime handle the mechanics of getting there. The DSL is the contract that makes this separation possible.

Without a clear, stable, well-typed authoring surface, consumer adoption is blocked. Every rough edge in the DSL API — ambiguous prop names, inconsistent patterns, missing TypeScript inference — translates directly to integration time and support burden.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- A developer with no prior BrewSite experience can author a two-scene scene with camera motion and model transitions in under 30 minutes, using only the TypeScript types and the examples app as reference.
- All authoring-surface errors (wrong prop types, missing required props, duplicate IDs) are caught at compile time, not runtime.
- The DSL surface is fully tree-shakeable — importing only `Scene` and `Camera` does not pull in Model or Lighting code.

**Success Metrics:**
- Zero TypeScript errors on a correctly authored scene DSL (tsc --strict).
- Integration time for a first scene: < 30 minutes from package install to rendered output.
- DSL-layer bundle contribution: < 2 KB gzipped (DSL components are null-returning stubs; all weight is in element implementations).
- Issue volume related to "how do I author X" is addressed by TypeScript types alone, without requiring documentation lookups.

**Guardrail Metrics:**
- No existing scene DSL in `apps/examples/` fails to compile after any DSL surface change.
- No change to the DSL authoring surface causes a major semver bump without an explicit migration path.

---

## 4. Non-Goals

- **Runtime scene navigation** (scroll, direct mode, programmatic seek) — belongs in the player PRD.
- **Animation curve authoring** — easing and transition physics belong in widget implementations and the compiler's transition spec types.
- **Scene hot-reload / HMR** — handled automatically via content-hash compilation. When a parent component re-renders (including from Vite HMR), new JSX content produces a new content hash, which triggers recompilation without manual cache-busting.
- **Scene validation tooling** (lint rules, schema validators) — future tooling work, not part of the authoring surface itself.
- **Server-side rendering of scenes** — the DSL compiler runs in a browser or Node.js context, but SSR output is not a current target.
- **Scene scripting / procedural generation** — scenes are static snapshots; procedural logic belongs in the host application before scenes are constructed.

---

## 5. Consumer Stories

1. As a toolkit consumer, I want to describe each animation scene as a named JSX element so that my scenes are readable and diffable in code review.
2. As a toolkit consumer, I want TypeScript to prevent me from using incorrect prop types on DSL elements so that I catch authoring mistakes at build time, not at runtime.
3. As a toolkit consumer, I want to transition a model between two positions by declaring it with the same ID in two adjacent scenes, without writing any animation code, so that the toolkit handles the interpolation automatically.
4. As a toolkit consumer, I want to add a new element to scene B without it appearing in scene A, so that the element enters with a fade or slide transition rather than existing in the initial state.
5. As a toolkit consumer, I want to compose custom widgets with their own DSL components so that I can extend the scene authoring surface without forking core.
6. As a toolkit consumer, I want access to viewport dimensions and scene index during scene compilation so that I can author responsive layouts that adapt to the consumer's display.
7. As a toolkit consumer, I want to attach metadata to scenes (title, description, tags) so that the host application can surface scene information in navigation UI.

---

## 6. Functional Requirements

1. Consumers must be able to define a collection of scenes by passing `<Scene key="...">` elements as direct children of `<ScenePlayer>`. No intermediate wrapper type or factory function is required.
2. Each scene must be uniquely identified by its React `key` prop within a `<ScenePlayer>`. The `key` is read from `element.key` by the compiler's `sceneRootHandler`. The `id` prop is retained as a backward-compat fallback. Duplicate keys within the same player are a compiler warning.
3. Scene order — the top-to-bottom order of `<Scene>` children — determines playback order. The first scene has no entry transition; the last scene has no exit transition.
4. Scene JSX elements are authored as plain `ReactElement` values (exported from scene files as constants). They are not wrapped in a factory function for normal static authoring. Dynamic values (viewport dimensions, asset-ready state, runtime variables) flow into scene JSX via React state in the parent component, using `useSceneRuntime()` if engine-internal values are needed.
5. The `<Scene>` DSL component must accept `key` (React standard), `id` (backward-compat fallback), `meta`, `metalnessMultiplier`, and `roughnessMultiplier` props.
6. The `<Scene>` root must delegate compilation of its children to registered DSL node handlers via `compileChildren`.
7. All DSL element components (`Model`, `Camera`, `Lighting`, etc.) must be null-returning React components with a `displayName` set, so they carry no runtime weight.
8. The compiler must register a node handler for each DSL component before any `resolveSceneFromDsl` call. The registration must be idempotent.
9. The `resolveSceneFromDsl` function must throw a descriptive error if the root element is not handled by the `Scene` handler.
10. Prop values on DSL elements may be static values or functions of `SceneSnapshotContext` — `(ctx: SceneSnapshotContext) => T`. Both forms must be resolved identically during compilation.
11. Non-DSL children of `<Scene>` (HTML elements, non-registered React components) must be collected by `compileChildrenSeparated` and stored as `sceneOverlay?: ReactNode` on `SceneFrame`. They are not compiled as part of the widget state tree.
12. The `<ProgressManager>` component must be usable as a child of `<Scene>` to declare scroll budget and input pacing for that scene. Carry-forward merge semantics apply: a scene that omits `<ProgressManager>` inherits the prior scene's spec.
13. The `<InputController>` component must be usable within a `<Scene>` tree to declare input action mappings. Only one `<InputController>` is permitted per `<Scene>`.
13. Custom widgets implementing `IDslComposite` must be able to declare child DSL components that are protected from accidental top-level usage with a descriptive error.
14. Widgets with the `CUSTOM_NODE_HANDLER` symbol set receive full control over DSL compilation, bypassing the default shallow-merge behavior.

---

## 7. API Design

### 7.1 SceneDefinition (internal) and InternalSceneSpec

`SceneDefinition` and `SceneGroup` are **internal types** as of the Scene Authoring API Simplification. They are no longer exported from `compiler/index.ts` or `player/index.ts`. Scene authors never construct them. The player layer converts `<Scene>` children into `InternalSceneSpec[]` before handing to the compiler adapter.

```typescript
// packages/core/src/compiler/sceneTypes.ts
// @internal — constructed by ScenePlayer from <Scene> children. Not exported.

export type SceneDefinition = {
  id: string;                    // derived from element.key or element.props.id
  meta?: Record<string, JsonPrimitive>;
  getFrame: (context: SceneSnapshotContext) => ReactNode | SceneFrame;
};

// SceneGroup removed entirely.
```

```typescript
// packages/core/src/player/ScenePlayer.tsx
// Internal to the player layer — not exported.

type InternalSceneSpec = {
  /** React key from the <Scene> element, or index-derived fallback. */
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

The compiler adapter in `useSceneEngine` converts `InternalSceneSpec[]` to `SceneDefinition[]` just before calling `compileSceneTrack`. This preserves the compiler's internal contract unchanged while exposing a cleaner external API.

`SceneSnapshotContext` remains the internal compilation-time context passed through the compiler:

```typescript
// packages/core/src/compiler/sceneTypes.ts

export type SceneSnapshotContext = {
  /** 0-based index of this scene in the ordered scene array. */
  sceneIndex: number;
  /** Total number of scenes in the group. */
  numScenes: number;
  /** Whether model and texture assets have finished loading. */
  assetsReady: boolean;
  /** Runtime variable store — for variable-driven DSL content. */
  variables?: VariableStoreReader;
  /** Viewport dimensions — for viewport-responsive DSL layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
};
```

See Section 10 for how these values are now surfaced to scene authors via `useSceneRuntime()`.

### 7.2 Scene DSL Component

`<Scene>` is the required root for every scene DSL tree. It is a null-returning React component that registers its handler on import.

Scene identity is determined by the React `key` prop (`element.key`), read directly by the compiler's `sceneRootHandler`. The `id` prop is retained as a backward-compat fallback for existing scenes. If neither is set, the compiler warns and falls back to the 0-based array index.

```typescript
// packages/core/src/compiler/sceneDslCompiler.ts

export const Scene = (_props: {
  /**
   * Backward-compat scene identity. Prefer React key prop: <Scene key="my-scene">.
   * When both key and id are present, key takes precedence.
   */
  id?: string;
  /** Optional metadata map. Values must be JSON-serializable primitives. */
  meta?: Record<string, JsonPrimitive>;
  /**
   * Multiplier applied to all material metalness values in this scene.
   * Supports context function form: (ctx: SceneSnapshotContext) => number
   */
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  /**
   * Multiplier applied to all material roughness values in this scene.
   * Supports context function form: (ctx: SceneSnapshotContext) => number
   */
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  children?: React.ReactNode;
}) => null;

Scene.displayName = 'Scene';
```

The updated `Scene` component signature with all current props:

```typescript
export const Scene = (_props: {
  id?: string;         // backward-compat; prefer React key prop
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  /**
   * Easing curve applied to blockProgress for the transition INTO this scene.
   * Declared on the incoming scene (the one being transitioned to).
   * Has no effect on the first scene (no incoming transition).
   */
  transition?: { easing?: EasingName };
  /**
   * Children may be any of:
   * - Registered DSL elements (Model, Camera, Lighting, etc.) — compiled into widget state.
   * - <ProgressManager> — compiled into SceneFrame.progressManager.
   * - <InputController> — compiled into the __input_controller passthrough state.
   * - HTML elements or non-registered React components — collected as sceneOverlay
   *   by compileChildrenSeparated and stored as SceneFrame.sceneOverlay (ReactNode).
   *   Rendered by EngineOverlayHost in the player layer.
   */
  children?: React.ReactNode;
}) => null;
```

Available easing curves (`EasingName`):
- `'linear'` — constant rate (default when unset)
- `'easeOutCubic'` — fast start, smooth deceleration
- `'easeOutExpo'` — very fast start, long gentle tail
- `'easeInOutSine'` — smooth acceleration and deceleration
- `'easeInOutCubic'` — stronger S-curve acceleration/deceleration

The `Scene` component handler:
1. Reads `id`, `meta`, `metalnessMultiplier`, `roughnessMultiplier`, and `transition.easing` from props.
2. Stores `transitionEasing` on the `SceneFrame` if set.
3. Calls `helpers.compileChildren(node, api)` to recurse into child DSL elements.
4. Sets scene-level metadata via `api.setSceneMeta`.

### 7.3 resolveSceneFromDsl

`resolveSceneFromDsl` is the low-level DSL evaluator. It takes a JSX tree (rooted at `<Scene>`), a `SceneSnapshotContext`, and a `WidgetRegistry`, and returns a `ResolvedScene` containing the compiled `SceneFrame`.

```typescript
export type ResolvedScene = {
  frame: SceneFrame;
};

export const resolveSceneFromDsl = (
  tree: unknown,
  context: SceneSnapshotContext,
  widgetRegistry: WidgetRegistry,
): ResolvedScene;
```

This function:
- Validates that `tree` is a valid React element; throws if not.
- Looks up the root element's handler from the node registry; throws if the root is not `<Scene>`.
- Creates a mutable `CompileApi` with an empty `SceneFrame`.
- Invokes the root handler, which recursively compiles children.
- Returns the finalized `SceneFrame` wrapped in `ResolvedScene`.

The `widgetRegistry` parameter is present on the signature but is passed through to the `CompileApi` context for handlers that need to look up registered widgets during compilation (for example, type-factory-routed model variants). It is not used by the `Scene` root handler itself.

### 7.4 CompileApi and CompileHelpers

These types form the internal API available to every DSL node handler. They are not part of the public scene-authoring surface but are essential for widget and element implementers extending the DSL.

```typescript
// packages/core/src/compiler/sceneDslTypes.ts

export type CompileApi = {
  /** The snapshot context for this scene evaluation. */
  context: SceneSnapshotContext;
  /** The mutable SceneFrame being built. Handlers write into this directly. */
  state: SceneFrame;
  /** Push a resolved label onto state.labels. */
  pushLabel: (label: LabelResolved) => void;
  /** Set the compiled state for a widget by its stable widgetId. */
  setWidgetState: (widgetId: string, state: unknown) => void;
  /** Set scene-level metadata (id and meta map) on the frame. */
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};

export type CompileHelpers = {
  /** Recurse into a node's children, dispatching each to its registered handler. */
  compileChildren: (node: ReactElement, api: CompileApi) => void;
  /**
   * Separate DSL children from non-DSL children (HTML elements and non-registered
   * React components). DSL children are compiled normally via the node handler
   * registry. Non-DSL children are returned as ReactNode[] for storage as
   * SceneFrame.sceneOverlay. Used by the Scene root handler.
   */
  compileChildrenSeparated: (node: ReactElement, api: CompileApi) => ReactNode[];
  /** Resolve a value or context function to a concrete value. */
  resolveValue: <T>(
    value: T | ((context: SceneSnapshotContext) => T),
    context: SceneSnapshotContext,
  ) => T;
  /** Resolve all values in an object, including nested context functions. */
  resolveObjectValues: <T extends Record<string, unknown>>(
    value: T,
    context: SceneSnapshotContext,
  ) => T;
  /** Remove undefined values recursively from an object. */
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  /** Collect direct children of a node as a flat array. */
  collectChildren: (node: ReactElement) => unknown[];
};

export type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;
```

### 7.5 Built-in DSL Elements

The following DSL components are built into `@brewsite/core`. Each is a null-returning React component registered with the node handler system. Detailed prop contracts live in element-specific PRDs. This section documents the authoring surface available at the `<Scene>` level.

**`<Model>`** — GLTF model with spatial transform and animation state.
- Required props: `id` (string), `type` (string — the model variant key registered with `WidgetRegistry.registerTypeFactory`).
- Optional props: `position`, `rotation`, `scale`, `opacity`, `enabled`, `axisRotation`, `axisTranslation`, and animation-specific props.
- Transitions: interpolates position/rotation/scale/opacity between scenes. Supports both `ElementTransitionSpec` (pre-baked) and `FunctionalTransitionSpec` (closure-based) depending on the model widget's configuration.

**`<Camera>`** — Camera position and lens descriptor.
- Required props: `descriptor` — a camera state object specifying `mode`, `position`, `target`, `fov`, and optional post-processing parameters.
- One `<Camera>` per scene. Interpolates position and target between scenes.

**`<Lighting>`** — Scene lighting configuration.
- Props: `ambient`, `directional`, `point`, `spot`, `panel` — each accepting a typed lighting spec.
- Transitions: interpolates light intensities and colors between scenes.

**`<Background>`** — Background image plane.
- Props: `src` (asset URL), `opacity`, `enabled`.
- Transitions: interpolates opacity; swaps image when `src` changes.

**`<Floor>`** — Reflective floor plane.
- Props: `enabled`, `opacity`, `color`, `roughness`, `metalness`.
- Transitions: interpolates opacity and material properties between scenes.

**`<Environment>`** — HDR environment map.
- Props: `src` (HDR asset URL), `intensity`, `enabled`.
- Transitions: interpolates intensity between scenes.

**`<ProgressManager>`** — Scroll budget and input pacing configuration for a scene.
- Optional props: `scrollUnits` (number, default 1), `fn` (pure pacing curve function).
- Carry-forward merge semantics: a scene that omits `<ProgressManager>` inherits the prior scene's spec.
- See Section 7.8 for full type documentation.

**`<InputController>`** — Input action mapping for a scene.
- Props: `id` (optional, defaults to `'main'`), `scope` (`'canvas'` | `'window'`, defaults to `'canvas'`), `children`.
- Only one `<InputController>` per `<Scene>` is permitted. A duplicate throws at compile time.
- Children must be `<Action>` elements.

**`<Action>`** — A single named input action within `<InputController>`.
- Required props: `id` (string), `type` (string — one of the `InputActionType` values).
- Optional props: `cameraId`, `canvasId`, `focusCenter`, `speed`, `stepScenes`, `children`.
- Children must be one or more input mapping elements: `<PointerMap>`, `<WheelMap>`, `<PinchMap>`, `<KeyMap>`.
- At least one mapping is required. An action with no mappings throws at compile time.

**`<PointerMap>`** — Maps pointer (mouse/touch) events to an action.
- Props: `drag`, `click` (boolean), `button`, `modifiers`, `axis`, `lockAxis`, `lockThreshold`.

**`<WheelMap>`** — Maps wheel scroll events to an action.
- Props: `modifiers`, `axis`, `lockAxis`.

**`<PinchMap>`** — Maps pinch gesture to an action.
- Props: `direction` (`'in'` | `'out'` | `'both'`, defaults to `'both'`), `modifiers`, `threshold`.

**`<KeyMap>`** — Maps a keyboard key to an action.
- Props: `key` or `keyName` (string, one must be provided and non-empty).

### 7.6 InputController DSL Types

```typescript
// packages/core/src/compiler/blocks/inputController.tsx

export type InputControllerProps = {
  id?: string;
  scope?: InputControllerScope;  // 'canvas' | 'window'
  children?: ReactNode;
};

export type ActionProps = {
  id: string;
  type: InputActionType;
  cameraId?: string;
  canvasId?: string;
  focusCenter?: [number, number] | [number, number, number];
  speed?: number;
  stepScenes?: number;
  children?: ReactNode;
};

export type PointerMapProps = {
  drag?: boolean;
  click?: boolean;
  button?: MouseButton;
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  lockAxis?: 'sticky' | 'free';
  lockThreshold?: number;
};

export type WheelMapProps = {
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  lockAxis?: 'sticky' | 'free';
};

export type PinchMapProps = {
  direction?: 'in' | 'out' | 'both';
  modifiers?: ModifierKey[];
  threshold?: number;
};

export type KeyMapProps = {
  key?: string;
  keyName?: string;
  modifiers?: ModifierKey[];
};
```

### 7.7 ProgressManager DSL Types

```typescript
// packages/core/src/compiler/blocks/progressManager.tsx

export type ProgressManagerProps = {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * The engine normalizes all scene scroll budgets so they sum to 1.
   * Default: 1. A scene with scrollUnits=2 receives twice the scroll
   * distance of a scene with scrollUnits=1.
   */
  scrollUnits?: number;
  /**
   * Pure input pacing curve mapping local raw input progress [0..1]
   * to local engine progress [0..1].
   *
   * Constraints (enforced at compile time):
   * - fn(0) === 0
   * - fn(1) === 1
   * - Continuous and monotonically non-decreasing
   *
   * Default: identity (t => t).
   *
   * Example — ease-in-out curve:
   * fn={(t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t}
   */
  fn?: (localT: number) => number;
};

export const ProgressManager: (_props: ProgressManagerProps) => null;
ProgressManager.displayName = 'ProgressManager';
```

**Merge semantics:** `<ProgressManager>` uses carry-forward merging — identical to `<InputController>`. A scene that omits `<ProgressManager>` inherits the prior scene's `ProgressManagerSpec` unchanged. This ensures a pacing curve declared once applies to all subsequent scenes without repetition. To reset to the default (linear, `scrollUnits=1`), declare `<ProgressManager scrollUnits={1} />` with no `fn` prop.

**Authoring examples:**

```tsx
// Give scene "features" twice the scroll travel of other scenes
<Scene key="features">
  <ProgressManager scrollUnits={2} />
  <Model id="product" type="product-model" position={[0, 0, 0]} />
</Scene>

// Apply a quadratic ease-in pacing curve: slow start, fast finish
<Scene key="reveal">
  <ProgressManager fn={(t) => t * t} />
  <Model id="hero" type="hero-model" position={[0, 0, 0]} />
</Scene>

// Combine: larger scroll budget + custom pacing
<Scene key="deep-dive">
  <ProgressManager scrollUnits={3} fn={(t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t} />
  <Camera descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }} />
</Scene>
```

---

## 8. Authoring Patterns

### 8.1 Minimal Single Scene

Scenes are plain JSX constants exported from scene files. They are passed as direct children of `<ScenePlayer>`.

```tsx
// scene01_intro.tsx
import { Scene } from '@brewsite/core';

export const scene01Intro = (
  <Scene key="intro">
    <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
    <Model id="bot" type="mesh" position={[0, 0, 0]} scale={[1, 1, 1]} />
    <Lighting ambient={{ intensity: 0.5, color: '#ffffff' }} />
  </Scene>
);

// page.tsx
<ScenePlayer manifestUrl="/manifest.json" widgetSetup={createWidgetSetup}>
  {scene01Intro}
</ScenePlayer>
```

### 8.2 Multi-Scene Interpolation

Declaring the same widget ID in adjacent scenes causes the compiler to generate an interpolation transition between the two states:

```tsx
// sceneLeft.tsx
export const sceneLeft = (
  <Scene key="left">
    <Model id="bot" type="mesh" position={[-2, 0, 0]} scale={[1, 1, 1]} />
  </Scene>
);

// sceneRight.tsx — same id="bot", different position
// Compiler produces: interpolate(botStateA, botStateB) across the transition block
export const sceneRight = (
  <Scene key="right">
    <Model id="bot" type="mesh" position={[2, 0, 0]} scale={[1, 1, 1]} />
  </Scene>
);

// page.tsx
<ScenePlayer ...>
  {sceneLeft}
  {sceneRight}
</ScenePlayer>
```

### 8.3 Enter Transition

An element present in scene B but absent from scene A triggers an enter transition:

```tsx
export const sceneIntro = (
  <Scene key="intro">
    <Model id="bot" type="mesh" position={[0, 0, 0]} />
  </Scene>
);

// "badge" appears fresh in "detail" — enter transition fires
export const sceneDetail = (
  <Scene key="detail">
    <Model id="bot" type="mesh" position={[0, 0, 0]} />
    <Model id="badge" type="badge-model" position={[1, 0.5, 0]} opacity={0} />
  </Scene>
);
```

### 8.4 Exit Transition

An element present in scene A but absent from scene B triggers an exit transition:

```tsx
export const sceneDetail = (
  <Scene key="detail">
    <Model id="tooltip" type="tooltip-mesh" position={[0, 1.5, 0]} />
  </Scene>
);

// "tooltip" absent in "summary" — exit transition fires
export const sceneSummary = (
  <Scene key="summary">
    <Model id="bot" type="mesh" position={[0, 0, 0]} />
  </Scene>
);
```

### 8.5 Dynamic / Context-Responsive Layout

For scenes that need to respond to runtime values (viewport dimensions, asset-ready state, runtime variables), use `useSceneRuntime()` in the parent page component. When those values change, React re-renders the parent, new JSX content is produced, the content hash changes, and the scene track is automatically recompiled.

```tsx
// page.tsx
function DiagramPage() {
  // useSceneRuntime reads engine-internal values reactively.
  // Requires matching id prop on <ScenePlayer>.
  const { assetsReady, viewport } = useSceneRuntime('my-player');
  const [theme] = useTheme(); // any external state also works

  return (
    <ScenePlayer id="my-player" manifestUrl="..." widgetSetup={...}>
      <Scene key="responsive">
        <Model
          id="bot"
          type="mesh"
          position={[viewport.aspectRatio > 1.5 ? -2 : 0, 0, 0]}
          scale={[1, 1, 1]}
          opacity={assetsReady ? 1 : 0}
        />
        <Lighting
          ambient={{ intensity: theme === 'dark' ? 1.0 : 0.5, color: '#ffffff' }}
        />
      </Scene>
    </ScenePlayer>
  );
}
```

Individual DSL props also accept a context-function form that is evaluated once during compilation. This pattern is still supported for `SceneSnapshotContext` fields available internally to the compiler (`sceneIndex`, `numScenes`):

```tsx
export const sceneAdaptive = (
  <Scene key="adaptive" roughnessMultiplier={(ctx) => ctx.sceneIndex === 0 ? 1.0 : 0.7}>
    <Model id="bot" type="mesh" position={[0, 0, 0]} />
  </Scene>
);
```

### 8.6 Transition Easing

Declare a custom easing curve on the incoming scene's `transition` prop. Easing affects how `blockProgress` advances through the transition — it controls the pacing of every widget's enter/exit/interpolate animation for that transition.

```tsx
export const sceneReveal = (
  // Transition INTO this scene uses easeOutExpo — snappy start, long gentle settle
  <Scene key="reveal" transition={{ easing: 'easeOutExpo' }}>
    <Model id="product" type="product-model" position={[0, 0, 0]} />
  </Scene>
);

export const sceneClose = (
  // Smooth symmetric S-curve for a more considered exit feel
  <Scene key="close" transition={{ easing: 'easeInOutCubic' }}>
    <Model id="product" type="product-model" position={[0, -3, 0]} opacity={0} />
  </Scene>
);
```

**Easing applies to all widgets in the transition.** It is a scene-level property, not per-element. A widget's `transitionSpec` still controls the shape of the animation (e.g., fade vs slide); easing controls its tempo.

**The first scene has no incoming transition** — its `transition` prop has no effect.

### 8.7 Scene Overlay Content

Non-DSL children of `<Scene>` — HTML elements and non-registered React components — are collected as overlay content and rendered by `EngineOverlayHost` over the canvas. They are not compiled as widget state.

```tsx
<Scene key="features">
  <Model id="bot" type="mesh" position={[0, 0, 0]} />
  <div style={{ position: 'absolute', top: '20%', left: '10%' }}>
    <div className="feature-callout">Battery Life</div>
  </div>
  <div style={{ position: 'absolute', top: '40%', left: '10%' }}>
    <div className="feature-callout">Memory</div>
  </div>
</Scene>
```

`EngineOverlayHost` applies a CSS fade-in keyed on the scene ID when the scene changes. Overlay content per scene is a snapshot captured at compile time — it is a `ReactNode` stored on `SceneFrame.sceneOverlay`. The overlay renders with `pointer-events: none` by default; individual elements within can opt in with `style={{ pointerEvents: 'auto' }}`.

For overlay content that must persist across all scenes regardless of which is active (navigation arrows, progress dots), render those components as direct children of the page layout alongside `<ScenePlayer>`, not inside `<Scene>`.

### 8.8 ProgressManager

```tsx
// Give "hero" a large scroll budget with an ease-in-out pacing curve
export const sceneHero = (
  <Scene key="hero">
    <ProgressManager
      scrollUnits={2}
      fn={(t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t}
    />
    <Camera descriptor={{ mode: 'world', position: [0, 1.5, 8], target: [0, 0, 0] }} />
    <Model id="product" type="product-model" position={[0, 0, 0]} />
  </Scene>
);

// Subsequent scene inherits scroll budget and pacing via carry-forward.
// Explicitly reset to uniform if needed:
export const sceneDetail = (
  <Scene key="detail">
    <ProgressManager scrollUnits={1} />
    <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
  </Scene>
);
```

The `fn` prop applies only in scroll mode and direct mode. It does not apply when `controlledProgress` is set on `EngineProvider` (controlled-progress mode drives the engine directly).

### 8.9 Input Controller

```tsx
<Scene id="interactive">
  <Camera descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }} />
  <Model id="product" type="product-model" position={[0, 0, 0]} />
  <InputController id="main" scope="canvas">
    <Action id="orbit" type="camera-orbit" cameraId="main-camera">
      <PointerMap drag axis="xy" />
    </Action>
    <Action id="dolly" type="camera-dolly" cameraId="main-camera">
      <WheelMap axis="y" />
    </Action>
    <Action id="reset" type="camera-reset" cameraId="main-camera">
      <PointerMap click />
    </Action>
    <Action id="next-scene" type="step-scenes" stepScenes={1}>
      <KeyMap keyName="ArrowRight" />
    </Action>
  </InputController>
</Scene>
```

### 8.10 Scene Metadata

```tsx
<Scene
  id="intro"
  meta={{ title: 'Introduction', description: 'Overview of core features', tags: 'intro,overview' }}
>
  <Camera descriptor={{ mode: 'world', position: [0, 1, 8], target: [0, 0, 0] }} />
</Scene>
```

The `meta` map accepts `JsonPrimitive` values (`string | number | boolean | null`). It is available on `SceneFrame.meta` and surfaced to the host application via the player layer.

### 8.11 Material Multipliers

Scene-level metalness and roughness multipliers apply uniformly to all materials rendered in that scene. Useful for adjusting material appearance per-scene without modifying model assets:

```tsx
<Scene id="shiny-variant" metalnessMultiplier={1.5} roughnessMultiplier={0.6}>
  <Model id="product" type="product-model" position={[0, 0, 0]} />
</Scene>
```

Both props support the context function form:

```tsx
<Scene
  id="adaptive"
  roughnessMultiplier={(ctx) => ctx.sceneIndex === 0 ? 1.0 : 0.7}
>
  ...
</Scene>
```

---

## 9. Entry Transitions Rule

Entry transitions belong to the incoming scene, not the outgoing one. The compiler processes transitions between adjacent scene pairs (sceneA → sceneB). For each widget:

- If the widget appears in sceneA but not sceneB: **exit** — widget runs its exit transition during the first half of the block, then holds the absent default for the second half.
- If the widget appears in sceneB but not sceneA: **enter** — widget holds the appropriate state for the first half of the block, then runs its enter transition during the second half.
- If the widget appears in both scenes: **interpolate** — widget transitions from sceneA state to sceneB state across the full block.

Consequences for authors:
- The first scene in a `SceneGroup` never has entry transitions applied. It renders at its authored state from progress 0.
- The last scene in a `SceneGroup` never has exit transitions applied. It holds its authored state at progress 1.
- An element added to scene N but not scene N-1 will **enter** when the user scrolls into scene N, regardless of what scene N+1 contains.

---

## 10. SceneSnapshotContext and useSceneRuntime

### 10.1 SceneSnapshotContext (compiler-internal)

`SceneSnapshotContext` is the compilation-time context used internally by the compiler. It is available to DSL components that use the context-function prop form (e.g., `position={(ctx) => ...}`). Scene authors don't typically construct or receive this directly.

```typescript
export type SceneSnapshotContext = {
  sceneIndex: number;          // 0-based position of this scene in the group
  numScenes: number;           // Total scene count — for relative positioning
  assetsReady: boolean;        // True after assets loaded; false during first compilation pass
  variables?: VariableStoreReader;   // Runtime variable store (injected by player)
  viewport?: {                 // Viewport dimensions (injected by player)
    width: number;
    height: number;
    aspectRatio: number;
  };
};
```

**`sceneIndex`** — Available via the context-function form only. Authors who need the current scene index at authoring time can use `(ctx) => ctx.sceneIndex`. There is no runtime equivalent at JSX authoring time — each `<Scene>` element is written individually and the author knows which scene they're in.

**`assetsReady`** — The compiler runs twice internally: once before assets load (`false`) for a loading state, once after (`true`) for the final track. This is used by the player to trigger recompilation via `useSceneRuntime`. See Section 10.2.

### 10.2 useSceneRuntime Hook

`useSceneRuntime(playerId)` is the primary hook for authoring dynamic scene content that responds to engine-internal state. It replaces the old `getFrame(context)` function pattern.

```typescript
// packages/core/src/player/useSceneRuntime.ts

export type SceneRuntimeState = {
  readonly assetsReady: boolean;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly aspectRatio: number;
  };
  readonly variables: VariableStoreReader | undefined;
  readonly numScenes: number;
};

export const useSceneRuntime = (playerId: string): SceneRuntimeState;
```

**How it works:** `ScenePlayer` publishes its runtime state to a module-level `ScenePlayerRegistry` whenever its `id` prop is set. `useSceneRuntime` reads from this registry via `useSyncExternalStore`, making it concurrent-mode safe. When engine state changes (assets finish loading, viewport resizes), `useSceneRuntime` causes the parent component to re-render with updated values. The new JSX content produces a different `contentKey` via `serializeJsx`, which triggers automatic recompilation of the SceneTrack.

**Requirements:**
- The `<ScenePlayer>` must have a matching `id` prop.
- `useSceneRuntime` must be called in a component that **renders above or alongside** `<ScenePlayer>` in the tree — i.e., a parent or sibling, not a child.
- In development, a 1000ms timeout warning is emitted if no matching player is found after mount.

**Migration from old `getFrame(context)` pattern:**

| Old `SceneSnapshotContext` field | New equivalent |
|---|---|
| `assetsReady` | `useSceneRuntime(id).assetsReady` |
| `viewport` | `useSceneRuntime(id).viewport` |
| `variables` | `useSceneRuntime(id).variables` |
| `numScenes` | `useSceneRuntime(id).numScenes` |
| `sceneIndex` | No authoring-time equivalent (by design). Use `useCurrentScene()` for runtime index. |

---

## 11. IDslComposite and Custom Child DSL

Widgets that compose multiple child DSL components implement `IDslComposite`. This interface allows a widget to declare child DSL components that the `WidgetRegistry` will protect against accidental top-level usage.

```typescript
// packages/core/src/widget/types.ts

export type ChildDslComponentSpec = {
  /** The null-returning React component used in DSL trees. */
  component: unknown;
  /** Display name for error messages. */
  displayName: string;
  /**
   * When true, using this component at the top level of a <Scene>
   * (outside its parent composite widget) throws a descriptive error.
   * When false, it is silently ignored at the top level.
   */
  topLevelError?: boolean;
};

export interface IDslComposite {
  childDslComponents: ChildDslComponentSpec[];
}
```

When a widget implementing `IDslComposite` is registered with `WidgetRegistry.register()`, the registry installs protective handlers for each `childDslComponent`. A child component with `topLevelError: true` will throw if used outside its parent widget's DSL context:

```
<DiagramNode> must be used inside <DiagramCanvas>.
It cannot appear at the top level of a scene.
```

**Example from `@brewsite/diagram`:**

```typescript
class DiagramCanvasWidget implements ISceneElement<DiagramCanvasState>, IDslComposite {
  childDslComponents = [
    { component: DiagramNode, displayName: 'DiagramNode', topLevelError: true },
    { component: DiagramEdge, displayName: 'DiagramEdge', topLevelError: true },
    { component: DiagramGroup, displayName: 'DiagramGroup', topLevelError: true },
  ];
}
```

---

## 12. Custom Widget DSL with CUSTOM_NODE_HANDLER

Widgets that need full control over their DSL compilation — rather than the default shallow-merge behavior — set the `CUSTOM_NODE_HANDLER` symbol on their instance before registration. The handler receives the full `(node, api, helpers)` signature and may inspect children, resolve context functions, and write arbitrary state to the `SceneFrame`.

```typescript
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';
import type { NodeHandler } from '@brewsite/core/compiler/sceneDslTypes';

class LightingWidget implements ISceneElement<LightingState> {
  widgetId = 'lighting';
  DslComponent = Lighting;
  defaultState: LightingState = { /* ... */ };
  transitionSpec = lightingTransitionSpec;

  [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const props = helpers.resolveObjectValues(
      node.props as LightingProps,
      api.context
    );
    // Custom compilation: flatten nested lighting specs into a single state object
    api.setWidgetState(this.widgetId, compileLightingProps(props));
  };
}
```

The registry routing handler checks for `CUSTOM_NODE_HANDLER` before falling back to the default shallow-merge. This means any widget can opt into custom compilation without modifying the registry itself.

**Pattern requirements for custom handlers:**
- Must call `api.setWidgetState(this.widgetId, state)` to write the compiled state.
- May call `helpers.compileChildren` to process nested DSL subtrees.
- Must not throw for valid prop combinations; should throw with descriptive messages for invalid ones.
- Must not import Three.js or React rendering APIs.

---

## 13. DSL Node Registration

The node registry is a module-level `Map` from component reference to `NodeHandler`. Registration is side-effectful and happens at module import time.

```typescript
// packages/core/src/compiler/registry.ts

export const registerNode = (component: unknown, handler: NodeHandler): void;
export const getNodeHandler = (component: unknown): NodeHandler | undefined;
export const isPrimitiveComponent = (component: unknown): boolean;
export const clearRegistry = (): void;  // Used in tests only
```

**Registration by component reference:** The primary key is the component function/class reference itself. A secondary index by `displayName` string is maintained to support Hot Module Replacement scenarios where module identity is lost across reloads.

**Idempotency:** `ensureInputControllerRegistry()` and `ensureSceneRegistry()` guard their registration calls with `if (!getNodeHandler(...))` checks, making repeated imports safe. Direct calls to `registerNode` overwrite existing handlers — this is intentional for testing and widget override scenarios.

**`registerNode` is exported from `compiler/index.ts`** so that external packages (e.g., `@brewsite/diagram`) can register their own DSL node handlers into the same registry without depending on internal registry internals.

---

## 14. Technical Considerations

### Build and Bundle

All DSL component functions (`Scene`, `Model`, `Camera`, etc.) return `null` and carry no rendering logic. Their module weight is limited to the props type declaration and the `displayName` assignment. The handler registration side-effect at module load is a Map.set call — negligible.

Tree-shaking: because each element's DSL component and handler live in the same module, importing only `Scene` and `Camera` from `@brewsite/core` does not pull in `Model`, `Lighting`, or any Three.js rendering code. The render layer is fully separate per the element module pattern.

### Context Function Resolution

`resolveObjectValues` recursively walks prop objects resolving any function values against `SceneSnapshotContext`. This includes nested objects and flat arrays, but not arrays of objects (nested array items that are functions are resolved; nested object items within arrays are recursively walked). Authors should prefer flat prop shapes to avoid subtle resolution gaps.

### Fragment Expansion

`expandNode` in `sceneDslCompiler.ts` handles React Fragments and non-primitive wrapper components transparently. A scene author can wrap DSL children in a Fragment or a plain wrapper component, and the compiler will expand it correctly. Only components registered as "primitive" (i.e., having a node handler) stop the expansion.

### Snapshot Context Injection

`SceneSnapshotContext` values for `variables` and `viewport` are injected by the player layer immediately before `compileSceneTrack` is called. The DSL itself has no dependency on the player — `SceneSnapshotContext` is a plain data type defined in `compiler/sceneTypes.ts` with no runtime imports.

---

## 15. Breaking Change Assessment

### Breaking changes introduced by Scene Authoring API Simplification (2026-02-28)

1. **`sceneGroup` prop removed from `ScenePlayer`** — Hard removed. Migrate: replace `sceneGroup={{ id: 'x', scenes: [s1, s2] }}` with `<ScenePlayer>{s1}{s2}</ScenePlayer>`.
2. **`SceneDefinition` and `SceneGroup` removed from public exports** — Code importing these types directly must update. Neither type is needed in the new authoring model.
3. **`getFrame(context)` function pattern removed from public authoring surface** — Authors needing `assetsReady`, `viewport`, `variables`, `numScenes` must use `useSceneRuntime(id)` in the parent component. The `id` prop on `ScenePlayer` becomes required to use this hook.
4. **`SceneDefinition.index` removed** — Was always redundant. Any code constructing `SceneDefinition` objects manually must remove the `index` field.

### Future breaking changes

Any future change to the following constitutes a breaking change requiring a major semver bump:

- Removing or renaming any prop on `Scene`, `Model`, `Camera`, `Lighting`, `Background`, `Floor`, `Environment`, `ProgressManager`, `InputController`, `Action`, or any `*Map` component.
- Changing the signature of `resolveSceneFromDsl`.
- Changing the shape of `SceneSnapshotContext` in a way that removes existing fields.
- Removing `CUSTOM_NODE_HANDLER` or changing its contract.
- Removing `registerNode` from the public exports of `compiler/index.ts`.
- Removing `useSceneRuntime` or changing the shape of `SceneRuntimeState`.
- Changing the `ProgressManagerSpec` type or the merge semantics of `<ProgressManager>`.
- Removing the `compileChildrenSeparated` helper or changing its contract for separating DSL from overlay children.

---

## 16. Dependencies

- `react` (peer) — JSX evaluation and `isValidElement`. No rendering, no hooks.
- `packages/core/src/widget/WidgetRegistry` — consumed by `resolveSceneFromDsl` for handler dispatch.
- `packages/core/src/compiler/registry` — the node handler Map; no external dependencies.
- `packages/core/src/labels/types` — `LabelResolved` type; no Three.js.
- `packages/core/src/input/types` — `InputActionType`, `InputActionMap`, and related types.
- `packages/core/src/compiler/sceneTrackTypes` — `ProgressManagerSpec` type; no Three.js.

---

## 17. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| API regret on `SceneSnapshotContext` shape | High | Fields are additive-only. New fields are optional. Removing fields is a breaking change. |
| `resolveObjectValues` missing deeply nested context functions | Medium | Document the resolution depth limitation. Encourage flat prop shapes. |
| `displayName`-based secondary registry lookup causing wrong handler dispatch after HMR | Low | Test HMR scenarios in `apps/examples/` before each release. `displayName` fallback is opt-in. |
| Fragment-wrapped DSL trees not compiling correctly | Low | `expandNode` has tests in `sceneTrackCompiler.test.ts`. Any expansion regression is caught by CI. |
| Consumers misusing `registerNode` to override core handlers | Medium | Document that `registerNode` overwrites. Core handlers are registered at module load; consumer overrides registered later win. Prefer `CUSTOM_NODE_HANDLER` for per-widget customization. |

---

## 18. Open Questions

1. Should `metalnessMultiplier` and `roughnessMultiplier` be promoted to a dedicated `<Material>` DSL component for extensibility, or are scene-level multipliers sufficient for the foreseeable authoring surface?
2. Should `SceneSnapshotContext.variables` be typed with a generic to allow stronger inference of variable key names, or does the ergonomic cost outweigh the type-safety benefit?
3. Should `<InputController>` support multiple instances per scene (with different `scope` values), or does the single-instance constraint serve the current use cases?

---

## 19. Launch Criteria

- All existing scenes in `apps/examples/` compile without TypeScript errors under `pnpm typecheck`.
- `resolveSceneFromDsl` has unit test coverage for: root element validation, Fragment expansion, context function resolution, `CUSTOM_NODE_HANDLER` dispatch, `IDslComposite` child protection, `InputController` duplicate-action validation, `ProgressManager` carry-forward merge semantics, and `compileChildrenSeparated` HTML overlay collection.
- `ProgressManager` compile-time validation tests cover: `fn(0) !== 0` warning, `fn(1) !== 1` warning, and `scrollUnits <= 0` warning.
- At least one example in `apps/examples/` demonstrates `<ProgressManager>` with a custom `scrollUnits` and `fn`.
- At least one example in `apps/examples/` demonstrates HTML overlay children inside `<Scene>` rendered by `EngineOverlayHost`.
- `README.md` for `@brewsite/core` includes a minimal scene example demonstrating `<Scene>`, `<Camera>`, `<Model>`, and `<Lighting>`.
- Every exported symbol from `compiler/index.ts` is documented with a JSDoc comment.
- CHANGELOG entry written for the current release version.
