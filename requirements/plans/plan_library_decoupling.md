---
title: "BrewFlow Scene Engine — Generic Library Architecture Plan"
doc_type: plan
owner: brewflow-architect
status: active
updated: 2026-02-20
---

# BrewFlow Scene Engine — Generic Library Architecture Plan

> **PATH CONVENTION:** All file paths in this document use `src/` as the library root
> (e.g., `src/widget/types.ts`, `src/compiler/sceneTrackCompiler.ts`). Inline code
> comments that show `src/robot/` are legacy artifacts from earlier draft iterations —
> treat them as `src/` with the `robot/` prefix removed. The directory structure
> section (below) is the definitive authority on file locations.
>
> **CANONICAL TYPE LOCATIONS:** `SceneFrame`, `SceneTrackTick`, `SceneTrack`,
> `SceneFrameDelta`, `CompiledAnimation` all live in `src/compiler/sceneTrackTypes.ts`.
> The old `src/robot/model/robotSceneTypes.ts` is gone. Any reference in this document
> to `model/robotSceneTypes.ts` refers to the legacy file — the new equivalent is
> `src/compiler/sceneTrackTypes.ts` plus `src/elements/model/types.ts`.

## Executive Summary

This document defines the complete architectural redesign of `src/robot/` into a
**general-purpose, consumer-extensible 3D scene engine**. The implementation starts
clean in a new `src/` directory. The existing `src/robot/` is preserved as `src/legacy/`
for reference only and is excluded from compilation. It is deleted once the new
implementation passes all acceptance criteria.

The design does not preserve backward compatibility with the original BrewBlast site —
that site becomes an example consumer.

The central architectural insight is that **every scene element — including the built-in
model, lighting, background, environment, and floor — can be implemented using the same
Widget SDK interfaces**. This makes the compiler and runtime truly generic: they operate on
registered widgets without any knowledge of what those widgets represent. Built-ins become
first-party widgets. Consumer-defined effects use the identical interfaces.

---

## Implementation Approach: Start Clean

**The existing `src/robot/` is NOT refactored in place.** Instead:

1. Rename `src/robot/` → `src/legacy/` and remove it from `tsconfig.json` paths
2. Write the new library in `src/` (the root, no namespace prefix)
3. The `examples/` directory is updated to import from `src/` (the new library)
4. Pure utilities that require no redesign are **copied** from `src/legacy/` with renames:
   - `runtime/math.ts` → `src/math/index.ts` (unchanged logic)
   - `runtime/pose.ts` → `src/math/pose.ts` (unchanged logic)
   - `robotTimelineMath.ts` → `src/timeline/math.ts` (renamed, unchanged logic)
5. Files requiring redesign are rewritten from scratch using `src/legacy/` as reference
6. The `src/legacy/` directory is deleted once the new implementation is green

**Why not refactor in place?**
- `src/robot/` has broken imports (`components/logoParticleOptimizedViewer`) that prevent
  compilation right now — fighting a broken build while redesigning core types is not viable
- `SceneFrame`, `CompileApi`, `SceneTrackTick`, and the compiler signature all change
  simultaneously — cascading type errors make incremental change impractical
- The new architecture is a structural redesign, not an additive change
- Starting clean keeps the build green from day 1 and lets tests be written alongside

---

## The Target Consumer Journey

```
1. Prepare assets      → GLB model(s) + animation GLBs → public/assets/
2. Define resources    → sceneResources.ts: models, containedModels, animations, anchorKeys
3. Generate DSL        → pnpm gen:scene-dsl  →  typed DSL components + scene-manifest.json
4. Build widgets       → Implement custom widgets using Widget SDK interfaces (optional)
5. Register widgets    → widgetSetup.ts: createDefaultWidgetRegistry(manifest).register(...)
6. Author scenes       → scene files using generated DSL + widget DSL components
7. Compose groups      → SceneGroup: scenes[] + timeline
8. Embed player        → <ScenePlayer sceneGroup={...} manifestUrl="..." widgetSetup={...} />
9. Build + deploy      → pnpm build; browser loads manifest, compiles, plays on scroll
```

---

## Repository Structure After Redesign

```
src/                         ← NEW: the library (no "robot" namespace anywhere)
├── widget/                  ← Widget SDK: interfaces, registry, variable store
│   ├── types.ts             ← IWidget, ISceneElement, IRenderable, ILoadable,
│   │                           IDslComposite, IContainedModel,
│   │                           IAnimationController, IVariableProvider
│   ├── WidgetRegistry.ts    ← registration + type guards
│   ├── VariableStore.ts     ← tick-driven reactive key/value store
│   ├── VariableStoreContext.ts
│   ├── useVariable.ts       ← React hook for variable consumption
│   └── index.ts
├── compiler/                ← Generic compiler: DSL → SceneTrack (pure, no Three.js)
│   ├── sceneTrackCompiler.ts
│   ├── sceneDslCompiler.ts
│   ├── sceneTrackSampler.ts
│   ├── sceneTrackCache.ts   ← widget-registry-aware cache invalidation
│   ├── sceneTrackTypes.ts   ← SceneTrack, SceneTrackTick, SceneFrameDelta, SceneWindow
│   ├── sceneTypes.ts        ← SceneDefinition, SceneFrameContext, SceneGroup, SceneTimeline
│   ├── sceneDslTypes.ts     ← CompileApi, CompileHelpers, NodeHandler
│   ├── sceneDefaults.ts     ← createBaseSceneState (builds defaults from registry)
│   ├── sceneUtils.ts        ← applySceneTransitions
│   ├── registry.ts          ← nodeRegistry (global DSL node handler map)
│   ├── annotationCompiler.ts
│   ├── labelCompiler.ts     ← NEW
│   ├── transitions/         ← re-export barrels → elements/*/compile.ts
│   ├── primitives/          ← re-export barrels → elements/*/dsl component
│   └── index.ts             ← DSL-only public surface
├── runtime/                 ← Generic runtime: tick loop, driver
│   ├── RuntimeDriver.ts     ← generic widget-based driver
│   ├── RuntimeLoop.ts       ← RAF loop (unchanged logic)
│   ├── types.ts             ← World, Node, Model, AnimationPlayer, MotionSystem interfaces
│   └── mocks/               ← interface-conforming test doubles
├── elements/                ← First-party widget implementations
│   ├── model/               ← ModelWidget: ISceneElement+IRenderable+ILoadable+IDslComposite
│   │   ├── types.ts         ← SceneModelInstanceState (no "Robot" prefix anywhere)
│   │   ├── ModelWidget.ts   ← implements all 4 interfaces
│   │   ├── ModelRenderer.ts ← Three.js application (internal to ModelWidget)
│   │   ├── compile.ts       ← modelTransitionSpec, compileAnimation
│   │   ├── metadata.ts      ← AssetManifest v2 schema
│   │   └── index.ts
│   ├── lighting/            ← LightingWidget: ISceneElement+IRenderable+IDslComposite
│   ├── background/          ← BackgroundWidget
│   ├── environment/         ← EnvironmentWidget: ILoadable (HDRI async load)
│   └── floor/               ← FloorWidget
├── labels/                  ← Label system (world-space text on body parts)
│   ├── types.ts
│   ├── dsl.tsx
│   ├── compile.ts
│   └── render.ts
├── annotations/             ← Screen-space HTML/React overlays
│   ├── annotationTypes.ts   ← simplified: AnnotationPlacement, no mode union
│   ├── annotationDefaults.ts
│   ├── annotationLayout.ts
│   ├── annotationLineMath.ts
│   ├── annotationTargets.ts
│   ├── annotationFonts.ts
│   └── index.ts
├── timeline/                ← SceneTimeline algebra (renamed from robotTimeline*)
│   ├── index.ts             ← SceneTimeline, createSceneTimeline, createQualityTimeline
│   └── math.ts              ← clamp01, lerp, invLerp, rangeProgress, smoothstep, easing
├── math/                    ← Pure math utilities
│   ├── index.ts             ← Vec3, Mat4, lerp, quaternion ops, matrix ops
│   └── pose.ts              ← capturePose, applyPoseSnapshot, blendPoseSnapshot
└── player/                  ← Consumer-facing API
    ├── ScenePlayer.tsx       ← top-level consumer component
    ├── useSceneEngine.ts     ← revised: takes sceneGroup+widgetRegistry, not internals
    ├── useEngineScroll.ts
    ├── useSceneProgress.ts   ← NEW: hook for consumer progress/scene access
    ├── useCurrentScene.ts    ← NEW: hook for current scene id/index
    ├── EngineScrollRegion.tsx
    ├── useEngineScrubber.ts
    ├── defaultWidgets.ts     ← createDefaultWidgetRegistry(manifest)
    ├── ContentSlotContext.ts ← NEW: context for annotation contentId slots
    └── index.ts

src/legacy/                  ← RENAMED from src/robot/; excluded from tsconfig
                                Read-only reference. Deleted when new code is green.

examples/
├── simple/                  ← Complete consumer demo; imports from src/
│   ├── sceneResources.ts
│   ├── widgetSetup.ts       ← createDefaultWidgetRegistry(manifest)
│   ├── scenes/
│   └── pages/
└── widgets/                 ← Optional consumer widget examples
    ├── ribbon/              ← RibbonWidget (ISceneElement+IRenderable)
    ├── logo-rotator/        ← LogoRotatorWidget (IAnimationController+IVariableProvider)
    └── brain-model/         ← BrainModelWidget (IContainedModel+IDslComposite)
```

---

## The Core Architectural Principle: Everything Is a Widget

The compiler and runtime have **zero knowledge** of specific element types. They do not
know what a "model" or "lighting" or "ribbon" is. They only know how to:

1. Call registered widget DSL node handlers to produce state
2. Interpolate registered widget states using their transition specs
3. Call `compileExtra()` on widgets that need tick-level compilation
4. Tick animation controllers
5. Call `apply()` on all registered renderable widgets

The built-in elements (`model`, `lighting`, `background`, `environment`, `floor`) are
first-party Widget implementations shipped with the library. Consumer widgets use the
exact same interfaces. The only difference is that `createDefaultWidgetRegistry()` pre-registers
the first-party widgets as a convenience.

---

## Part 1: The Widget SDK

### 1.1 Capability Interfaces

**File:** `src/robot/widget/types.ts`

A widget is any object implementing one or more capability interfaces. There are no required
base classes. Combining interfaces determines how the engine interacts with the widget.

```typescript
// src/robot/widget/types.ts

import type { Scene as ThreeScene } from 'three';
import type { ElementTransitionSpec } from '../runtime/compiler/transitions/transitionTypes';
import type { VariableStore, VariableStoreReader } from './VariableStore';
import type { ClipMeta } from '../elements/model/types';
import type { AssetManifest } from '../elements/model/metadata';

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Every widget must have a stable unique string ID.
 * This is the key used in SceneFrame.widgets and SceneTrackTick.widgetExtras.
 */
export interface IWidget {
  readonly widgetId: string;
}

// ─── Compiler-time capability ─────────────────────────────────────────────────

/**
 * ISceneElement: The widget participates in scene compilation and interpolation.
 *
 * A widget implementing this:
 * - Provides a DSL component (JSX, returns null) for scene getFrame() authoring
 * - Provides a default state used when the scene does not specify the widget
 * - Provides a transition spec (enter/exit/interpolate) for the compiler
 * - Optionally provides compile-time extra data beyond interpolated state
 *
 * TState must be a plain serializable object (no Three.js, no functions).
 * TExtra is any additional compile-time output (e.g., CompiledAnimation for ModelWidget).
 */
export interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec: ElementTransitionSpec<TState>;
  readonly DslComponent: React.ComponentType<Partial<TState> & { children?: React.ReactNode }>;

  /**
   * Optional. Called during the tick-baking pass AFTER state interpolation.
   * Returns widget-specific compiled data stored in SceneTrackTick.widgetExtras[widgetId].
   * Receives the interpolated state and context with manifest-derived information.
   *
   * Use this for work that must happen at compile time but does not fit in the
   * interpolated state — e.g., resolving animation clip names and durations.
   * The ModelWidget uses this to produce CompiledAnimation.
   */
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
}

// ─── DSL Composition capability ──────────────────────────────────────────────

/**
 * IDslComposite: A widget whose DSL component accepts typed child sub-components
 * that contribute structured sub-state to the parent's TState.
 *
 * This formalizes Pattern A containment: children have NO independent widget state
 * and are only meaningful inside this widget's DslComponent. They are NOT registered
 * as top-level scene elements.
 *
 * Examples:
 *   LightingWidget   → children: Ambient, Directional, Point, Spot, Panel
 *   ModelWidget      → children: BodyPart, BodyParts, Playback, Animation, Motion, ModelPart
 *
 * Contrast with IContainedModel (Pattern B), where the child IS a full registered widget
 * with its own state, authored at the top level of the scene DSL.
 *
 * When a widget implementing IDslComposite is registered, WidgetRegistry automatically
 * registers all declared child components with protective handlers — either noop (silent)
 * or error-throwing (explicit) — preventing accidental top-level use and giving the
 * consumer a clear error message if they misplace a child component.
 */
export interface IDslComposite extends IWidget {
  /**
   * The child DSL components that are valid inside this widget's DslComponent.
   * The parent's node handler is responsible for reading and processing these
   * children — they are never dispatched through the global nodeRegistry.
   *
   * Each entry declares:
   *   component  — the React component function (used as the registry key)
   *   displayName — human-readable name for error messages
   *   topLevelError — if true, using this component at the top level throws a
   *                   descriptive error. If false, it is silently ignored.
   */
  readonly childDslComponents: ReadonlyArray<{
    component: React.ComponentType<unknown>;
    displayName: string;
    topLevelError?: boolean;
  }>;
}

// ─── Async loading capability ─────────────────────────────────────────────────

/**
 * ILoadable: The widget loads async assets (GLBs, textures, HDRIs).
 *
 * The engine collects all ILoadable widgets and awaits them after the Three.js
 * scene is initialized. When all are loaded, the engine marks assetsReady and
 * triggers a recompile. This replaces ModelResourceManager as a standalone class.
 *
 * initialize() is still called sync first to allow the widget to create placeholder
 * objects. load() is then called for the async phase.
 */
export interface ILoadable extends IWidget {
  /**
   * Load assets asynchronously. Receives the manifest for GLB URL resolution.
   * Called once after the Three.js scene is initialized.
   * Throws on failure — the engine will surface the error via onError().
   */
  load(manifest: AssetManifest | null): Promise<void>;

  /** True once load() has resolved successfully. */
  readonly isLoaded: boolean;
}

// ─── Render-time capability ───────────────────────────────────────────────────

/**
 * IRenderable: The widget has a Three.js representation, updated every frame.
 *
 * Can be combined with ISceneElement (state-driven rendering) or with
 * IAnimationController alone (self-managed rendering).
 */
export interface IRenderable<TState> extends IWidget {
  /**
   * Called once when the engine attaches the widget to the Three.js scene.
   * Create Three.js objects and add them to context.scene here.
   * Sync — for async asset loading, also implement ILoadable.
   */
  initialize(context: WidgetInitContext): void;

  /**
   * Called every frame.
   * @param state   The interpolated widget state for this tick (from ISceneElement).
   *                For pure IAnimationController widgets, state is the widget's own
   *                tracked state, not from the compiler.
   * @param context Render context including delta, extras, and variable store.
   */
  apply(state: TState, context: WidgetRenderContext): void;

  /** Dispose Three.js resources when the widget is removed. */
  dispose(): void;
}

/**
 * IContainedModel: IRenderable that attaches to a named anchor on a primary model.
 *
 * The engine resolves anchorKey → actual bone name from the manifest at load time
 * and attaches the widget's Three.js group to that bone node.
 */
export interface IContainedModel<TState> extends IRenderable<TState> {
  /** widgetId of the primary model widget this attaches to. */
  readonly anchorModelId: string;
  /** Key into the primary model's anchorTargets map (from manifest). */
  readonly anchorKey: string;
}

// ─── Animation capability ─────────────────────────────────────────────────────

/**
 * IAnimationController: Runs a tick every frame, independent of scene state.
 *
 * Controllers are ticked BEFORE renderers. They receive write access to the
 * VariableStore, allowing them to publish state for other widgets and React components.
 */
export interface IAnimationController extends IWidget {
  onTick(context: AnimationTickContext): void;
}

/**
 * IVariableProvider: Declares variables this widget publishes to the VariableStore.
 *
 * Companion to IAnimationController. Declaration enables typed access via useVariable().
 */
export interface IVariableProvider extends IWidget {
  readonly variableNamespace: string;
  readonly variableKeys: readonly string[];
}

// ─── Context types ────────────────────────────────────────────────────────────

/** Context passed to ISceneElement.compileExtra(). */
export type CompileExtraContext = {
  sceneProgress: number;
  globalProgress: number;
  /** Animation clips available for this compilation, derived from the manifest. */
  clipMeta: ClipMeta[];
  prefersReducedMotion: boolean;
};

/** Context passed to IRenderable.initialize(). */
export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
};

/** Context passed to IRenderable.apply(). */
export type WidgetRenderContext = {
  deltaSeconds: number;
  globalProgress: number;
  wallTimeSeconds: number;
  variables: VariableStoreReader;
  /**
   * The compile-time extra for this widget from the current tick.
   * Cast to TExtra as defined by the widget's ISceneElement implementation.
   * Undefined for widgets that do not implement compileExtra().
   */
  extra: unknown;
};

/** Context passed to IAnimationController.onTick(). */
export type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  scene: ThreeScene;
  /** Write access to the variable store. */
  variables: VariableStore;
  /**
   * The current compiled tick. Null before the first compilation completes.
   * Animation controllers can read tick.state.widgets[id] to make their
   * behavior scene-state-aware (e.g., enable breathing only in certain scenes)
   * without coupling to specific widget implementations.
   * Read-only — do not mutate.
   */
  tick: SceneTrackTick | null;
};

export type VariableStoreReader = {
  // Returns JsonPrimitive | undefined (NOT unknown) for type-safe use in useVariable<T>
  get(namespace: string, key: string): JsonPrimitive | undefined;
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>;
};
```

### 1.2 Why Built-ins Fit These Interfaces

Every current built-in element maps directly:

| Built-in | ISceneElement | IRenderable | ILoadable | IDslComposite | compileExtra |
|---|---|---|---|---|---|
| `LightingWidget` | `SceneLighting` | ✓ | — | ✓ (Ambient, Directional, Point, Spot, Panel) | — |
| `BackgroundWidget` | `SceneBackground` | ✓ | optional | — | — |
| `EnvironmentWidget` | `SceneEnvironment` | ✓ | ✓ (HDRI) | — | — |
| `FloorWidget` | `SceneFloor` | ✓ | optional | — | — |
| `ModelWidget` | `SceneModelInstanceState` | ✓ | ✓ (GLB) | ✓ (BodyPart, Playback, Animation, Motion, ModelPart) | ✓ (CompiledAnimation) |

The existing `types.ts` → `compile.ts` → `render.ts` files map to:
- `types.ts` → `TState` type, `defaultState`
- `compile.ts` → `transitionSpec` (and `compileExtra` for ModelWidget)
- `dsl.tsx` → `DslComponent` + child components declared in `childDslComponents`
- `render.ts` → the body of `initialize()` + `apply()` + `dispose()`

**No existing logic is discarded.** The refactor is structural: wrapping the existing
functions into class instances that implement the interfaces.

### 1.3 The Two Containment Patterns — Formally Distinguished

This is worth stating explicitly because the two patterns look superficially similar
but have fundamentally different semantics:

**Pattern A — DSL Composition (`IDslComposite`):**
Children contribute sub-state to the parent's `TState`. They have no independent
widget registration, no state in `SceneFrame.widgets`, and no lifetime outside their
parent's DSL context. They are authored *inside* the parent component in scene files.

```tsx
// Pattern A: child components build up the parent widget's state
<Lighting>
  <Ambient intensity={2.6} color="#ffffff" />  {/* ← modifies SceneLighting.ambient */}
  <Spot intensity={2.2} color="#b384ef" ... />  {/* ← modifies SceneLighting.spots[] */}
</Lighting>

<Model id="primary" scale={0.2}>
  <BodyPart id="head" color="#dddddd" />        {/* ← modifies bodyPartOverrides */}
  <Playback>
    <Animation id="chat-relax-f" />             {/* ← modifies playback.animation */}
  </Playback>
</Model>
```

**Pattern B — Runtime Attachment (`IContainedModel`):**
The child IS a full registered widget with its own state in `SceneFrame.widgets[id]`.
The anchor relationship (which bone it attaches to) is a static runtime configuration
declared at construction time, not in the scene DSL. The child is authored at the
*top level* of the scene, as a sibling of the parent model — not inside it.

```tsx
// Pattern B: brain is an independent widget authored at scene top-level
<Scene>
  <PrimaryModel id="primary" scale={0.2} />  {/* widgetId: 'primary' */}
  <Brain opacity={0.8}>                       {/* widgetId: 'brain', attaches to primary.head at runtime */}
    <Subpart id="frontal_lobe" opacity={1.0} />
  </Brain>
</Scene>
```

The `<Brain>` component's `<Subpart>` children ARE Pattern A relative to Brain —
they have no independent state and contribute to the `BrainModelWidget`'s state.
`BrainModelWidget` therefore implements both `IContainedModel` AND `IDslComposite`.

### 1.3 The One Gap: ModelWidget Needs `compileExtra()`

The only thing built-ins need that the current interface doesn't have is `compileExtra()`.
This is because `ModelWidget` currently calls `compileAnimation()` from inside
`sceneTrackCompiler.ts` during the tick-baking pass. With the new architecture, the
compiler no longer knows about animation compilation — it calls `compileExtra()` on any
widget that implements it, passing `CompileExtraContext` (which includes `clipMeta`).

`ModelWidget.compileExtra(state, ctx)`:
```typescript
compileExtra(state: SceneModelInstanceState, ctx: CompileExtraContext): CompiledAnimation {
  return compileAnimation(state.playback.animation, ctx.clipMeta, ctx.prefersReducedMotion);
}
```

The `compileAnimation` function itself is unchanged — it stays in `elements/model/compile.ts`.

### 1.4 WidgetRegistry

**File:** `src/robot/widget/WidgetRegistry.ts`

```typescript
export class WidgetRegistry {
  private widgets = new Map<string, IWidget>();

  register(widget: IWidget): this {
    if (this.widgets.has(widget.widgetId)) {
      console.warn(`[WidgetRegistry] "${widget.widgetId}" already registered. Overwriting.`);
    }
    this.widgets.set(widget.widgetId, widget);

    // Register the widget's root DSL component.
    // Widgets with simple prop-only DSL get a default merge handler.
    // Widgets with complex DSL (children, context-sensitive logic) register a custom
    // handler in their constructor BEFORE calling register() — it takes precedence.
    if (isSceneElement(widget) && !nodeRegistry.has(widget.DslComponent)) {
      registerNode(widget.DslComponent, (node, api) => {
        const props = { ...widget.defaultState, ...node.props };
        api.setWidgetState(widget.widgetId, props);
      });
    }

    // If the widget declares child DSL components (IDslComposite), register protective
    // handlers for all of them. This replaces the manual registerNode(BodyPart, noopHandler)
    // calls that currently live at the bottom of each element's dsl.tsx.
    if (isDslComposite(widget)) {
      for (const { component, displayName, topLevelError } of widget.childDslComponents) {
        if (nodeRegistry.has(component)) continue; // widget registered its own handler
        if (topLevelError) {
          registerNode(component, () => {
            throw new Error(
              `<${displayName}> must be used inside <${widget.DslComponent.displayName ?? widget.widgetId}>. ` +
              `It cannot appear at the top level of a scene.`,
            );
          });
        } else {
          registerNode(component, () => {}); // noop — silently ignored at top level
        }
      }
    }

    return this;
  }

  getAll(): IWidget[] { return Array.from(this.widgets.values()); }
  get(id: string): IWidget | undefined { return this.widgets.get(id); }
  getSceneElements(): Array<ISceneElement<unknown>> { return this.getAll().filter(isSceneElement); }
  getRenderables(): Array<IRenderable<unknown>> { return this.getAll().filter(isRenderable); }
  getAnimationControllers(): IAnimationController[] { return this.getAll().filter(isAnimationController); }
  getLoadables(): ILoadable[] { return this.getAll().filter(isLoadable); }
  getContainedModels(): Array<IContainedModel<unknown>> { return this.getAll().filter(isContainedModel); }
  getDslComposites(): IDslComposite[] { return this.getAll().filter(isDslComposite); }
}

// ─── Type guards ──────────────────────────────────────────────────────────────
// (defined alongside WidgetRegistry for co-location; also exported from widget/types.ts)

export const isSceneElement = (w: IWidget): w is ISceneElement<unknown> =>
  'defaultState' in w && 'transitionSpec' in w && 'DslComponent' in w;

export const isRenderable = (w: IWidget): w is IRenderable<unknown> =>
  'initialize' in w && 'apply' in w && 'dispose' in w;

export const isLoadable = (w: IWidget): w is ILoadable =>
  'load' in w && 'isLoaded' in w;

export const isAnimationController = (w: IWidget): w is IAnimationController =>
  'onTick' in w;

export const isVariableProvider = (w: IWidget): w is IVariableProvider =>
  'variableNamespace' in w && 'variableKeys' in w;

export const isContainedModel = (w: IWidget): w is IContainedModel<unknown> =>
  isRenderable(w) && 'anchorModelId' in w && 'anchorKey' in w;

export const isDslComposite = (w: IWidget): w is IDslComposite =>
  'childDslComponents' in w && Array.isArray((w as IDslComposite).childDslComponents);
```

### 1.5 `createDefaultWidgetRegistry()`

**File:** `src/robot/engine/defaultWidgets.ts`

This factory pre-registers the first-party built-in widgets. Consumers call this and
chain `.register()` for their custom additions:

```typescript
import { WidgetRegistry } from '../widget/WidgetRegistry';
import { ModelWidget } from '../elements/model/ModelWidget';
import { LightingWidget } from '../elements/lighting/LightingWidget';
import { BackgroundWidget } from '../elements/background/BackgroundWidget';
import { EnvironmentWidget } from '../elements/environment/EnvironmentWidget';
import { FloorWidget } from '../elements/floor/FloorWidget';
import type { AssetManifest } from '../elements/model/metadata';
import { clipMetaFromManifest, findModelMeta } from '../elements/model/metadata';

export type DefaultWidgetConfig = {
  /**
   * Model instances to register. Each creates a separate ModelWidget.
   * The widgetId is the model id (e.g. 'primary').
   */
  models: Array<{ id: string; role: string }>;
  /** Manifest for GLB URL resolution and clip metadata. Null before manifest loads. */
  manifest: AssetManifest | null;
};

export const createDefaultWidgetRegistry = (config: DefaultWidgetConfig): WidgetRegistry => {
  const registry = new WidgetRegistry();
  const clipMeta = config.manifest ? clipMetaFromManifest(config.manifest) : [];

  for (const modelDef of config.models) {
    const modelMeta = config.manifest ? findModelMeta(config.manifest, modelDef.id) : null;
    registry.register(new ModelWidget({ ...modelDef, modelMeta, clipMeta }));
  }

  registry
    .register(new LightingWidget())
    .register(new BackgroundWidget())
    .register(new EnvironmentWidget())
    .register(new FloorWidget());

  return registry;
};
```

**Consumer usage:**

```typescript
// Consumer's widgetSetup.ts
import { createDefaultWidgetRegistry } from '../../src/robot/engine/defaultWidgets';
import { RibbonWidget } from './widgets/ribbon/RibbonWidget';
import { LogoRotatorWidget } from './widgets/logo-rotator/LogoRotatorWidget';
import type { AssetManifest } from '../../src/robot/elements/model/metadata';

export const createWidgetSetup = (manifest: AssetManifest | null) =>
  createDefaultWidgetRegistry({
    models: [{ id: 'primary', role: 'primary' }],
    manifest,
  })
    .register(new RibbonWidget())
    .register(new LogoRotatorWidget('logoRotator', { logos: LOGO_PALETTE, intervalMs: 3000 }));
```

### 1.6 VariableStore

**File:** `src/robot/widget/VariableStore.ts`

```typescript
export type JsonPrimitive = string | number | boolean | null;

export class VariableStore {
  private store = new Map<string, Map<string, JsonPrimitive>>();
  private listeners = new Map<string, Set<() => void>>();

  set(namespace: string, key: string, value: JsonPrimitive): void {
    let ns = this.store.get(namespace);
    if (!ns) { ns = new Map(); this.store.set(namespace, ns); }
    if (ns.get(key) === value) return;
    ns.set(key, value);
    this.notify(`${namespace}.${key}`);
    this.notify(namespace);
  }

  get(namespace: string, key: string): JsonPrimitive | undefined {
    return this.store.get(namespace)?.get(key);
  }

  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>> {
    const ns = this.store.get(namespace);
    return ns ? Object.fromEntries(ns.entries()) : {};
  }

  subscribe(key: string, listener: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) { set = new Set(); this.listeners.set(key, set); }
    set.add(listener);
    return () => { set?.delete(listener); };
  }

  private notify(key: string): void { this.listeners.get(key)?.forEach((l) => l()); }
}
```

**File:** `src/robot/widget/useVariable.ts`:

```typescript
import { useContext, useSyncExternalStore } from 'react';
import { VariableStoreContext } from './VariableStoreContext';
import type { JsonPrimitive } from './VariableStore';

export const useVariable = <T extends JsonPrimitive = JsonPrimitive>(
  namespace: string, key: string,
): T | undefined => {
  const store = useContext(VariableStoreContext);
  if (!store) throw new Error('[useVariable] must be used inside <ScenePlayer>');
  return useSyncExternalStore(
    (cb) => store.subscribe(`${namespace}.${key}`, cb),
    () => store.get(namespace, key) as T | undefined,
    () => store.get(namespace, key) as T | undefined,
  );
};
```

### 1.8 Widget SDK Public Exports

**File:** `src/robot/widget/index.ts`

```typescript
export type {
  IWidget,
  ISceneElement,
  IRenderable,
  IContainedModel,
  ILoadable,
  IDslComposite,           // ← Pattern A: parent widget with typed child DSL components
  IAnimationController,
  IVariableProvider,
  CompileExtraContext,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
  VariableStoreReader,
} from './types';
export {
  WidgetRegistry,
  isSceneElement, isRenderable, isLoadable, isContainedModel,
  isDslComposite,          // ← type guard for IDslComposite
  isAnimationController, isVariableProvider,
} from './WidgetRegistry';
export { VariableStore } from './VariableStore';
export { useVariable } from './useVariable';
```

---

## Part 2: The Truly Generic SceneFrame

With all elements as widgets, `SceneFrame` sheds its typed element fields and becomes:

**File:** `src/robot/model/robotSceneTypes.ts` (rewritten)

```typescript
import type { AnnotationDefinition, AnnotationDefaults } from '../annotations/annotationTypes';
import type { LabelDefinition } from '../labels/types';

/**
 * The resolved state for a single tick in the scene track.
 * All element states (model, lighting, background, environment, floor, ribbon,
 * and any consumer widget) live in widgets[widgetId].
 */
export type SceneFrame = {
  id: string;
  scrollProgress: number;
  isLightScene: boolean;
  /**
   * All widget states, keyed by widgetId.
   * The type of each value is determined by the corresponding ISceneElement<TState>.
   */
  widgets: Record<string, unknown>;
  annotations?: AnnotationDefinition[];
  annotationDefaults?: Partial<AnnotationDefaults>;
  labels?: LabelDefinition[];
};

export type SceneFrameOverride = Partial<
  Omit<SceneFrame, 'widgets'>
> & {
  widgets?: Record<string, Partial<unknown>>;
};
```

**What is removed from SceneFrame:**
- `lighting: SceneLighting` → now `widgets['lighting']`
- `environment: SceneEnvironment` → now `widgets['environment']`
- `floor: SceneFloor` → now `widgets['floor']`
- `background: SceneBackground` → now `widgets['background']`
- `ribbon: SceneRibbon` → gone (consumer widget, not core)
- `models?: Record<string, SceneModelInstanceState>` → now `widgets['primary']`, `widgets['secondary']`, etc.

**What stays on SceneFrame:**
- `annotations` and `labels` — kept as typed arrays because they have their own compile-time
  processing (`annotationPrimitives`, `labelPrimitives`) that is distinct from the widget system.
  These are not Three.js rendered; their "rendering" is a React/DOM overlay handled separately.
- `isLightScene` — page-level CSS theming hint, not an element state.

---

## Part 3: The Generic SceneTrackTick

**File:** `src/robot/runtime/compiler/sceneTrackTypes.ts` (rewritten)

```typescript
import type { AnnotationResolved } from '../../annotations/annotationNormalized';
import type { LabelResolved } from '../../labels/types';

export type SceneWindow = {
  id: string;
  index: number;
  start: number;
  end: number;
  entryStart: number;
};

/**
 * Delta between adjacent ticks, used for forward/backward scrubbing optimization.
 * Contains only the fields that changed between ticks.
 */
export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  annotations?: SceneFrame['annotations'];
  annotationDefaults?: SceneFrame['annotationDefaults'];
  labels?: SceneFrame['labels'];
  isLightScene?: boolean;
};

export type SceneTrackTick = {
  index: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  state: SceneFrame;
  annotationPrimitives?: AnnotationResolved[];
  labelPrimitives?: LabelResolved[];
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  /**
   * Widget-specific compile-time extras, keyed by widgetId.
   * Present for widgets implementing ISceneElement.compileExtra().
   * The ModelWidget stores CompiledAnimation here; other widgets may store
   * their own compile-time computed data.
   */
  widgetExtras?: Record<string, unknown>;
};

export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
};
```

**What is removed:**
- `CompiledAnimation` no longer lives at the tick level as `modelAnimations`. It is in
  `widgetExtras['primary']` (or whatever the model's widgetId is). Its type definition stays
  in `elements/model/compile.ts` — the compiler just passes it through generically.
- `anchorTargets: AnchorTargetMap` removed from `SceneTrack` — anchor resolution is the
  `ModelWidget`'s internal concern, not a track-level field.

---

## Part 4: The Generic Compiler

### 4.1 CompileApi — Fully Generic

**File:** `src/robot/runtime/compiler/sceneDslTypes.ts`

```typescript
export type CompileApi = {
  context: SceneFrameContext;
  state: SceneFrameState;
  transitions: SceneTransition[];
  pushAnnotation: (annotation: AnnotationDefinition) => void;
  pushLabel: (label: LabelDefinition) => void;
  /**
   * Store the compiled state for a widget by its ID.
   * Called by each widget's registered DSL node handler.
   * This is the ONLY way to write element state during DSL compilation.
   */
  setWidgetState: (widgetId: string, state: unknown) => void;
  setSceneMeta: (meta: { id?: string; isLightScene?: boolean }) => void;
};
```

**Removed:** `setLighting()`, `setRibbon()`, `setModelInstance()`. These are replaced
by `setWidgetState('lighting', state)`, `setWidgetState('ribbon', state)`, etc.

### 4.2 SceneFrameContext — Clean

**File:** `src/robot/runtime/compiler/sceneTypes.ts`

```typescript
import type { VariableStoreReader } from '../../widget/types';

export type SceneFrameContext = {
  progress: number;
  sceneProgress: number;
  sceneProgressRaw?: number;
  globalProgress: number;
  sceneStart: number;
  sceneEnd: number;
  assetsReady: boolean;
  timeline: RobotTimeline;
  baseState?: SceneFrameState;
  baseStateRaw?: SceneFrameState;
  nextState?: SceneFrameState;
  /** Read-only access to the VariableStore for layout math in getFrame(). */
  variables?: VariableStoreReader;
  /** Viewport for aspect-ratio-dependent layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
};
```

**Removed:** `ui?: { logo?: LogoRotationRuntime; ar?: number }`, `resourceRegistry?`

### 4.3 CompileSceneTrackOptions — Fully Generic

**File:** `src/robot/runtime/compiler/sceneTrackCompiler.ts`

```typescript
export type CompileSceneTrackOptions = {
  scenes: SceneSource[];
  timeline: SceneTimeline;
  assetsReady: boolean;
  // NOTE: prefersReducedMotion is NOT here — it belongs only in CompileExtraContext,
  // which is passed to individual widget.compileExtra() calls. The core compiler
  // is a pure function with no knowledge of browser accessibility settings.
  widgetRegistry: WidgetRegistry;
  /**
   * Clip metadata passed into CompileExtraContext for ISceneElement.compileExtra().
   * Derived from the manifest via clipMetaFromManifest(). Empty before manifest loads.
   */
  clipMeta: ClipMeta[];
  /**
   * Whether the user prefers reduced motion (from window.matchMedia).
   * Passed into CompileExtraContext ONLY — not used by the compiler core.
   * Default: false.
   */
  prefersReducedMotion?: boolean;
};
```

**Removed:** `manifest`, `availableClips`, `ui`, `resourceRegistry`

### 4.4 Generic Tick-Baking Pass

The core of the tick-baking pass becomes:

```typescript
// For every tick in the baking pass:

// 1. Build the base SceneFrame with all widget default states
const frame: SceneFrame = {
  id: scene.id,
  scrollProgress: sceneProgress,
  isLightScene: false,
  widgets: {},
};
for (const element of widgetRegistry.getSceneElements()) {
  frame.widgets[element.widgetId] = structuredClone(element.defaultState);
}

// 2. Apply DSL (scene's getFrame() call) → widget states are set via setWidgetState()
const { frame: dslFrame, transitions } = resolveSceneFromDsl(scene.getFrame(context), context);
// dslFrame.widgets now has consumer-specified states merged in

// 3. Apply scene transitions (standard enter/exit/interpolate per widget)
for (const element of widgetRegistry.getSceneElements()) {
  const fromState = fromFrame.widgets[element.widgetId] ?? element.defaultState;
  const toState = toFrame.widgets[element.widgetId] ?? element.defaultState;
  tick.state.widgets[element.widgetId] = element.transitionSpec.interpolate(
    fromState, toState, transitionContext,
  );
}

// 4. Call compileExtra() for widgets that implement it
const compileExtraCtx: CompileExtraContext = { sceneProgress, globalProgress, clipMeta, prefersReducedMotion };
for (const element of widgetRegistry.getSceneElements()) {
  if (element.compileExtra) {
    const extra = element.compileExtra(tick.state.widgets[element.widgetId], compileExtraCtx);
    tick.widgetExtras = tick.widgetExtras ?? {};
    tick.widgetExtras[element.widgetId] = extra;
  }
}

// 5. Compile annotations and labels (special-cased for their React/DOM rendering path)
tick.annotationPrimitives = compileAnnotations(tick.state.annotations ?? [], context);
tick.labelPrimitives = compileLabels(tick.state.labels ?? [], context);
```

The compiler imports zero element-specific modules. It does not call `compileAnimation()`,
does not reference `SceneLighting`, `SceneModel`, `SceneRibbon`, or any other concrete type.

### 4.5 DSL Node Registration — Side-Effect Import Removed

Currently `sceneDslCompiler.ts` has `import './primitives'` which triggers all built-in
element registrations as a module side effect. This implicit coupling is replaced by
`WidgetRegistry.register()` explicitly calling `registerNode()` for each widget's
`DslComponent`. There is no global module-side-effect registration.

The built-in elements' `dsl.tsx` files change from:
```typescript
// OLD — side-effect registration on module import
registerNode(Lighting, (node, api) => { ... });
```
To: registration happening in `WidgetRegistry.register(new LightingWidget())`.

---

## Part 5: The Generic Runtime Driver

### 5.1 Tick Ordering

```typescript
// RuntimeDriverImpl.apply(progress: number, delta: number):

// ── Step 1: Tick all animation controllers ───────────────────────────────────
const animCtx: AnimationTickContext = { deltaSeconds, wallTimeSeconds, scene, variables: variableStore };
for (const controller of widgetRegistry.getAnimationControllers()) {
  controller.onTick(animCtx);
}

// ── Step 2: Sample scene track ───────────────────────────────────────────────
const tick = sceneSampler.sample(progress);

// ── Step 3: Apply all renderable widgets ─────────────────────────────────────
const renderCtx: WidgetRenderContext = { deltaSeconds, globalProgress: progress, wallTimeSeconds, variables: variableStore };
for (const renderable of widgetRegistry.getRenderables()) {
  const state = tick.state.widgets[renderable.widgetId] ?? renderable.defaultState;
  const extra = tick.widgetExtras?.[renderable.widgetId];
  renderable.apply(state, { ...renderCtx, extra });
}

// ── Step 4: Resolve label world→screen projections ───────────────────────────
if (tick.labelPrimitives) { labelOverlay.apply(tick.labelPrimitives); }
```

**Removed from RuntimeDriverImpl:**
- `lightingRenderer`, `environmentRenderer`, `floorRenderer`, `ribbonRenderer`, `backgroundRenderer` — all replaced by the generic widget renderer loop
- `particleContext` — was site-specific state for the ChestParticle
- `sceneRuntime: ModelRenderer` as a direct field — the ModelWidget now owns its ModelRenderer internally
- All model-instance management code — the ModelWidget handles this
- `clipsReady`, `particleContextReady` — asset readiness is now tracked by `ILoadable.isLoaded`
- Direct `manifest` field — consumed at widget construction time, not held by the driver

### 5.2 Asset Loading — ILoadable Protocol

The `RuntimeDriverImpl` initialization sequence:

```typescript
async initialize(config: RuntimeConfig): Promise<void> {
  this.setupThreeScene();

  // Initialize all renderable widgets (sync — creates placeholder Three.js objects)
  for (const renderable of widgetRegistry.getRenderables()) {
    renderable.initialize({ scene: this.threeScene, widgetId: renderable.widgetId });
  }

  // Load all async assets in parallel
  const loadables = widgetRegistry.getLoadables();
  await Promise.all(loadables.map((w) => w.load(this.manifest)));

  // All loaded → recompile with assetsReady: true
  this.assetsReady = true;
  this.recompile();
}
```

This replaces the current `ModelResourceManager` coordination, the `clipsReady` flag,
the `particleContextReady` flag, and the `needsSeed` pattern.

---

## Part 6: How Each Built-in Becomes a Widget

The existing element module structure is preserved but wrapped in a widget class.
No logic is rewritten — it is wrapped.

### LightingWidget

**File:** `src/robot/elements/lighting/LightingWidget.ts`

`LightingWidget` implements `IDslComposite` because `<Ambient>`, `<Spot>`, `<Point>`,
`<Panel>`, and `<Directional>` are only valid inside `<Lighting>`. They contribute to
`SceneLighting` state — they are not independent widgets.

```typescript
import * as THREE from 'three';
import type { ISceneElement, IRenderable, IDslComposite, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import type { SceneLighting } from './types';
import { lightingTransitionSpec, DEFAULT_LIGHTING } from './compile';
import { Lighting, Ambient, Directional, Point, Spot, Panel } from './dsl';

export class LightingWidget
  implements ISceneElement<SceneLighting>, IRenderable<SceneLighting>, IDslComposite {

  readonly widgetId = 'lighting';
  readonly defaultState = DEFAULT_LIGHTING;
  readonly transitionSpec = lightingTransitionSpec;
  readonly DslComponent = Lighting;

  // Pattern A: these components build up SceneLighting state, they are NOT widgets.
  // Registering them here means WidgetRegistry will add protective top-level handlers.
  readonly childDslComponents = [
    { component: Ambient,     displayName: 'Ambient',     topLevelError: true },
    { component: Directional, displayName: 'Directional', topLevelError: true },
    { component: Point,       displayName: 'Point',       topLevelError: true },
    { component: Spot,        displayName: 'Spot',        topLevelError: true },
    { component: Panel,       displayName: 'Panel',       topLevelError: true },
  ] as const;

  // LightingWidget registers its own node handler in the constructor (complex children)
  constructor() {
    registerNode(Lighting, (node, api, helpers) => {
      // Same logic as current elements/lighting/dsl.tsx — unchanged
      const state = compileLightingFromDsl(node, api, helpers);
      api.setWidgetState(this.widgetId, state);
    });
  }

  private ambient: THREE.AmbientLight | null = null;
  private directional: THREE.DirectionalLight | null = null;
  private spots: THREE.SpotLight[] = [];

  initialize({ scene }: WidgetInitContext): void {
    this.ambient = new THREE.AmbientLight();
    this.directional = new THREE.DirectionalLight();
    scene.add(this.ambient, this.directional);
  }

  apply(state: SceneLighting, _ctx: WidgetRenderContext): void {
    // Identical to current elements/lighting/render.ts — unchanged
    applyLightingState(state, this.ambient, this.directional, this.spots);
  }

  dispose(): void { this.ambient?.removeFromParent(); /* ... */ }
}
```

### ModelWidget

**File:** `src/robot/elements/model/ModelWidget.ts`

`ModelWidget` implements `IDslComposite` because `<BodyPart>`, `<Playback>`, `<Animation>`,
`<Motion>`, and `<ModelPart>` are only valid inside `<Model>`. They build up the model's
`SceneModelInstanceState` — they are not independent widgets.

Note that `<ModelPart>` children can include `<ContainedModel>` and `<Subpart>`, which are
Pattern A relative to `ModelPart` (they contribute to the part's spec). The `BrainModelWidget`
(Pattern B) is authored separately at the scene top level and declares its anchor relationship
via `IContainedModel` — it does NOT appear as a child of `<Model>` in the DSL.

```typescript
import type {
  ISceneElement, IRenderable, ILoadable, IDslComposite,
  WidgetInitContext, WidgetRenderContext, CompileExtraContext,
} from '../../widget/types';
import type { SceneModelInstanceState, ClipMeta } from './types';
import type { ModelMeta, AssetManifest } from './metadata';
import type { CompiledAnimation } from '../compiler/sceneTrackTypes';
import { modelTransitionSpec } from './compile';
import { Model, BodyPart, BodyParts, Pose, ModelPart, ContainedModel, Subpart,
         Playback, Motion, Animation } from './dsl';
import { ModelRenderer } from './ModelRenderer';
import { compileAnimation } from './compile';

export type ModelWidgetConfig = {
  id: string;
  role: string;
  modelMeta: ModelMeta | null;
  clipMeta: ClipMeta[];
};

export class ModelWidget
  implements
    ISceneElement<SceneModelInstanceState, CompiledAnimation>,
    IRenderable<SceneModelInstanceState>,
    ILoadable,
    IDslComposite {

  readonly widgetId: string;
  readonly defaultState: SceneModelInstanceState;
  readonly transitionSpec = modelTransitionSpec;
  readonly DslComponent = Model;

  // Pattern A: these components only make sense inside <Model>.
  // WidgetRegistry registers protective top-level handlers for all of them.
  readonly childDslComponents = [
    { component: BodyPart,       displayName: 'BodyPart',       topLevelError: true  },
    { component: BodyParts,      displayName: 'BodyParts',      topLevelError: true  },
    { component: Pose,           displayName: 'Pose',           topLevelError: true  },
    { component: ModelPart,      displayName: 'ModelPart',      topLevelError: true  },
    { component: ContainedModel, displayName: 'ContainedModel', topLevelError: false }, // silently ignored
    { component: Subpart,        displayName: 'Subpart',        topLevelError: false }, // silently ignored
    { component: Playback,       displayName: 'Playback',       topLevelError: true  },
    { component: Motion,         displayName: 'Motion',         topLevelError: true  },
    { component: Animation,      displayName: 'Animation',      topLevelError: true  },
  ] as const;

  isLoaded = false;
  private config: ModelWidgetConfig;
  private renderer: ModelRenderer | null = null;

  constructor(config: ModelWidgetConfig) {
    this.widgetId = config.id;
    this.config = config;
    this.defaultState = createDefaultModelInstanceState(config.id);
    // Register the complex DSL node handler before WidgetRegistry.register() is called.
    // This handler contains the full child-processing logic from the current dsl.tsx.
    registerNode(Model, (node, api, helpers) => {
      const state = compileModelFromDsl(node, api, helpers, this.widgetId);
      api.setWidgetState(this.widgetId, state);
    });
  }

  compileExtra(state: SceneModelInstanceState, ctx: CompileExtraContext): CompiledAnimation {
    return compileAnimation(state.playback.animation, this.config.clipMeta, ctx.prefersReducedMotion);
  }

  async load(manifest: AssetManifest | null): Promise<void> {
    const meta = manifest ? findModelMeta(manifest, this.config.id) : this.config.modelMeta;
    if (!meta) {
      console.warn(`[ModelWidget] No manifest entry for model "${this.config.id}". Rendering disabled.`);
      return;
    }
    await this.renderer!.loadGlb(meta.glb, meta.anchorTargets);
    this.isLoaded = true;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.renderer = new ModelRenderer(scene);
  }

  apply(state: SceneModelInstanceState, ctx: WidgetRenderContext): void {
    this.renderer?.apply(state, ctx.extra as CompiledAnimation | undefined, ctx);
  }

  dispose(): void { this.renderer?.dispose(); }
}
```

### BackgroundWidget, EnvironmentWidget, FloorWidget

Same pattern as `LightingWidget` — wrap the existing `render.ts` logic in
`initialize()` / `apply()` / `dispose()` with the same `defaultState` and `transitionSpec`
from their `compile.ts` files. No logic changes.

---

## Part 7: Labels and Annotations

### Labels — New Element

**File:** `src/robot/labels/types.ts`

```typescript
export type LabelStyle = {
  color?: string;
  lineColor?: string;
  fontSize?: number;
  lineOpacity?: number;
  labelOpacity?: number;
  lineThickness?: number;
};

export type LabelDefinition = {
  id: string;
  text: string;
  /** ID of a bone or subpart node to attach to. Resolved at render time. */
  targetPartId: string;
  labelOffset?: [number, number, number];
  enabled?: boolean;
  style?: LabelStyle;
};

export type LabelResolved = LabelDefinition & {
  screenPosition?: { x: number; y: number };  // populated at render time
};
```

**File:** `src/robot/labels/dsl.tsx` — `<Label>` and `<Labels>` components with
`registerNode` handlers that call `api.pushLabel(...)`.

**File:** `src/robot/labels/compile.ts` — `compileLabelTransitions()` for opacity blending.

**File:** `src/robot/labels/render.ts` — Canvas overlay rendering (excluded from coverage).

### Annotations — Simplified

Remove the `mode: 'world' | 'screen' | 'hud'` union. Replace with typed `placement`:

```typescript
export type AnnotationPlacement =
  | { mode: 'fixed';
      reference: { x: 'left' | 'center' | 'right'; y: 'top' | 'middle' | 'bottom' };
      offset: { xPct: number; yPct: number }; }
  | { mode: 'follow';
      targetPartId: string;
      targetOffset?: [number, number, number];
      screenOffset?: { xPct: number; yPct: number }; };

export type AnnotationDefinition = {
  id: string;
  label: string;
  enabled?: boolean;
  content?: { node: ReactNode } | { contentId: string };
  placement: AnnotationPlacement;
  style?: Partial<AnnotationStyle>;
};
```

Remove `annotationNormalized.ts` — the normalization layer that bridged old `mode` naming.

---

## Part 8: Consumer Widgets as Examples

### Ribbon Widget

**Location:** `examples/widgets/ribbon/`

```typescript
// RibbonWidget.ts
export class RibbonWidget implements ISceneElement<RibbonConfig>, IRenderable<RibbonConfig> {
  readonly widgetId = 'ribbon';
  readonly defaultState = DEFAULT_RIBBON_CONFIG; // neutral white, not purple
  readonly transitionSpec = ribbonTransitionSpec; // from old compile.ts, unchanged
  readonly DslComponent = RibbonDsl;

  initialize(ctx: WidgetInitContext): void { /* create Three.js ribbon geometry */ }
  apply(state: RibbonConfig, ctx: WidgetRenderContext): void { /* update ribbon */ }
  dispose(): void { /* cleanup */ }
}
```

### LogoRotator Widget

**Location:** `examples/widgets/logo-rotator/`

```typescript
// LogoRotatorWidget.ts
export class LogoRotatorWidget implements IAnimationController, IVariableProvider {
  readonly widgetId: string;
  readonly variableNamespace: string;
  readonly variableKeys = ['currentLogoId', 'currentColor', 'currentLabel'] as const;

  constructor(id: string, private config: LogoRotatorConfig) {
    this.widgetId = id;
    this.variableNamespace = id;
  }

  onTick(ctx: AnimationTickContext): void {
    // advance state machine, publish to ctx.variables
    ctx.variables.set(this.variableNamespace, 'currentColor', this.currentColor);
    ctx.variables.set(this.variableNamespace, 'currentLogoId', this.currentId);
    ctx.variables.set(this.variableNamespace, 'currentLabel', this.currentLabel);
  }
}
```

**React annotation component:**
```tsx
const LogoColorAnnotation = () => {
  const color = useVariable<string>('logoRotator', 'currentColor') ?? '#ffffff';
  return <div style={{ color }}>...</div>;
};
```

### Brain Model Widget

**Location:** `examples/widgets/brain-model/`

`BrainModelWidget` implements **both containment patterns** simultaneously:
- **`IContainedModel` (Pattern B)**: the brain widget attaches to the 'head' anchor of
  the 'primary' model widget at runtime — an anchor declared at construction, not in the DSL.
- **`IDslComposite` (Pattern A)**: the `<Brain>` component accepts `<Subpart>` children
  that control individual region visibility/opacity — they contribute to `BrainState`, they
  are not independent widgets.

```typescript
// BrainModelWidget.ts
export class BrainModelWidget
  implements
    ISceneElement<BrainState>,
    IContainedModel<BrainState>,  // Pattern B: attaches to primary model's 'head' anchor
    ILoadable,
    IDslComposite {               // Pattern A: <Subpart> children build up BrainState

  readonly widgetId = 'brain';
  readonly anchorModelId = 'primary';  // IContainedModel: attach to this widget's scene graph
  readonly anchorKey = 'head';         // IContainedModel: attach to this anchor bone

  // Pattern A: <Subpart> is only valid inside <Brain>
  readonly childDslComponents = [
    { component: Subpart, displayName: 'Subpart', topLevelError: false },
  ] as const;

  // authored at scene TOP LEVEL (not inside <Model>), but renders attached to the head bone
}
```

The scene author writes:
```tsx
<Scene>
  <Model id="primary" scale={0.2} />
  {/* Brain is a sibling of Model in the DSL — Pattern B, top-level widget */}
  <Brain opacity={0.8}>
    {/* Subpart is a child of Brain — Pattern A, no independent state */}
    <Subpart id="frontal_lobe" opacity={1.0} />
    <Subpart id="temporal_lobe" opacity={0.6} />
  </Brain>
</Scene>
```

---

## Part 9: Asset Manifest and Script Unification

### Generalized AssetManifest

**File:** `src/robot/elements/model/metadata.ts`

```typescript
export const ASSET_MANIFEST_VERSION = 2;

export type AnchorTargetMap = Record<string, string>;

export type ModelMeta = {
  id: string; glb: string; bones: string[]; meshes: string[];
  anchorTargets: AnchorTargetMap;
};

export type ContainedModelMeta = {
  id: string; glb: string; subparts: string[];
};

export type AnimationEntry = {
  id: string; glb: string; clipName: string; duration: number;
};

export type AssetManifest = {
  version: number;
  models: ModelMeta[];
  containedModels: ContainedModelMeta[];
  animations: AnimationEntry[];
};
```

### Updated `sceneResources.ts` Format

```typescript
export const sceneResources = {
  models: [
    { id: 'primary', role: 'primary' as const, path: '/assets/robot.no-normals.glb',
      anchorKeys: ['head', 'chest'] },
  ],
  containedModels: [
    { id: 'brain', path: '/assets/brain_separated.glb' },
  ],
  animations: [
    { id: 'chat-relax-f', path: '/assets/motion/ChatRelaxF/chat-relax-f.glb' },
  ],
} as const;
```

### `gen-scene-dsl.mjs` Unified Script

```
node scripts/gen-scene-dsl.mjs \
  --input    examples/simple/sceneResources.ts \
  --out-dir  src/resources/ \
  --manifest-out  public/assets/scene-manifest.json
```

The `--manifest-out` flag triggers bone extraction and anchor resolution alongside DSL
generation. No separate `extract-model-metadata.mjs` run is needed.

Anchor key resolution heuristic (for each `anchorKey` in `model.anchorKeys`):
1. Exact node name match (case-insensitive)
2. Node name contains key as substring
3. First node matching common patterns for that key (e.g., 'head' → matches `*Head*`, `*head*`)
4. If no match: warn; store key itself as value

---

## Part 10: ScenePlayer Component

**File:** `src/robot/engine/ScenePlayer.tsx`

```typescript
export type ScenePlayerProps = {
  sceneGroup: SceneGroup;
  manifestUrl: string;
  /** Factory function called with the loaded manifest to create the widget registry. */
  widgetSetup: (manifest: AssetManifest | null) => WidgetRegistry;
  className?: string;
  scrollHeightPx?: number;
  framesPerScene?: number;
  fpsCap?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  children?: ReactNode;
};

export const ScenePlayer = (props: ScenePlayerProps): JSX.Element => {
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(props.manifestUrl)
      .then((r) => r.json())
      .then((raw) => setManifest(assertManifestValid(raw)))
      .catch((e: unknown) => {
        const err = e instanceof Error ? e : new Error(String(e));
        setLoadError(err);
        props.onError?.(err);
      });
  }, [props.manifestUrl]);

  // Recreate widget registry when manifest loads
  const widgetRegistry = useMemo(() => props.widgetSetup(manifest), [manifest, props.widgetSetup]);
  const variableStore = useMemo(() => new VariableStore(), []);

  const engine = useSceneEngine({
    sceneGroup: props.sceneGroup,
    widgetRegistry,
    clipMeta: manifest ? clipMetaFromManifest(manifest) : [],
    framesPerScene: props.framesPerScene ?? 30,
    fpsCap: props.fpsCap ?? 60,
    onReady: props.onReady,
  });

  return (
    <VariableStoreContext.Provider value={variableStore}>
      <div className={props.className} style={{ position: 'relative' }}>
        {loadError && <div role="alert">Scene engine error: {loadError.message}</div>}
        <EngineScrollRegion
          engine={engine}
          scrollHeightPx={props.scrollHeightPx ?? props.sceneGroup.scenes.length * 800}
        />
        {props.children && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {props.children}
          </div>
        )}
      </div>
    </VariableStoreContext.Provider>
  );
};
```

**Consumer usage (simplest possible):**

```tsx
// pages/ExamplePage.tsx
import { ScenePlayer, createDefaultWidgetRegistry } from '../../src/robot/engine';
import { coreMessageSceneGroup } from '../scenes/sceneGroup';

export default function ExamplePage() {
  return (
    <ScenePlayer
      sceneGroup={coreMessageSceneGroup}
      manifestUrl="/assets/scene-manifest.json"
      widgetSetup={(manifest) =>
        createDefaultWidgetRegistry({
          models: [{ id: 'primary', role: 'primary' }],
          manifest,
        })
      }
    />
  );
}
```

**Consumer usage (with custom widgets):**

```tsx
<ScenePlayer
  sceneGroup={coreMessageSceneGroup}
  manifestUrl="/assets/scene-manifest.json"
  widgetSetup={(manifest) =>
    createDefaultWidgetRegistry({ models: [{ id: 'primary', role: 'primary' }], manifest })
      .register(new RibbonWidget())
      .register(new LogoRotatorWidget('logoRotator', { logos: PALETTE, intervalMs: 3000 }))
      .register(new BrainModelWidget())
  }
/>
```

---

## Part 11: Site-Specific Code Removal

All of the following must be gone from `src/robot/`:

| Source | Action |
|---|---|
| `src/robot/elements/ribbon/` | Delete. Move to `examples/widgets/ribbon/` as consumer widget |
| `src/robot/elements/model/brainModel/` | Delete. Move to `examples/widgets/brain-model/` |
| `src/robot/logoRotator/` | Delete. Move to `examples/widgets/logo-rotator/` |
| `src/robot/runtime/compiler/blocks/LogoAnnotation` | Delete |
| `src/robot/runtime/compiler/blocks/BrainLabelAnnotations` | Delete |
| `src/robot/runtime/compiler/transitions/ribbonTransitions.ts` | Delete |
| `src/robot/runtime/compiler/primitives/` (ribbon line) | Delete |
| `import './primitives'` in `sceneDslCompiler.ts` | Delete (widget registration replaces it) |
| `MODEL_BONE_NAME_MAP`, `buildNameCandidates` imports in `ModelRenderer.ts` | Delete entirely |
| All fallback bone-resolution code in `ModelRenderer.ts` | Delete (manifest required, no fallback) |
| `particleContext` in `RuntimeDriverImpl` | Delete |
| `ribbonRenderer`, `floorRenderer`, etc. in `RuntimeDriverImpl` | Delete |
| `import type { ResourceRegistry }` everywhere | Delete |
| `import type { LogoRotationRuntime }` everywhere | Delete |
| `ui?: { logo?, ar? }` in `SceneFrameContext` | Delete |
| `local.brewblast.ai` in `vite.config.ts` | Delete |
| `fontFamily: 'General Sans'` in `MessageAnnotation` | Delete |
| Default purple `#b344ef` anywhere | Delete |

---

## Part 12: Testing Strategy

### Widget SDK Tests

**`WidgetRegistry.test.ts`:**
```typescript
// register() stores widget by widgetId
// register() warns on duplicate, overwrites
// getSceneElements() returns only ISceneElement implementors
// getRenderables() filters correctly
// getLoadables() filters correctly
// getContainedModels() filters correctly
// getDslComposites() filters correctly

// IDslComposite registration:
// register(IDslComposite widget) registers noop top-level handlers for child components
// register(IDslComposite widget) registers error-throwing handlers when topLevelError=true
// using a child component (e.g. <Ambient>) at scene top level throws descriptive error
// using a child component at scene top level with topLevelError=false is silently ignored
// child handler registered by widget constructor takes precedence over WidgetRegistry default

// Custom handler precedence:
// widget that calls registerNode() in constructor uses that handler, not the default merge
```

**`VariableStore.test.ts`:**
```typescript
// set/get round-trip
// same value → no notification
// subscribe → notified after set
// unsubscribe → no further notifications
// getNamespace → all keys in namespace
```

**`useVariable.test.ts`:**
```typescript
// Returns current value from store
// Re-renders when value changes
// Throws when used outside VariableStoreContext
```

### Generic Compiler Tests

**`sceneTrackCompiler.generic.test.ts`:**
```typescript
// Compiles scene track with only registered ISceneElement widgets
// Uses widget defaultState when scene does not specify widget
// Calls transitionSpec.interpolate during transition ticks
// Calls compileExtra() on widgets that implement it
// Stores compileExtra() result in tick.widgetExtras[widgetId]
// No model/lighting/ribbon-specific code in compiler
```

### Generic Runtime Tests

**`RuntimeDriver.generic.test.ts`:**
```typescript
// Ticks all IAnimationControllers before renderers
// Variables written in onTick() are available in apply() call
// Calls apply() on all IRenderables with correct state + extra
// initialize() called for all IRenderables at startup
// load() awaited for all ILoadables before assetsReady=true
```

### Built-in Widget Tests

**`LightingWidget.test.ts`:** Verify state changes in apply() produce correct Three.js light intensities.
**`ModelWidget.test.ts`:** Verify compileExtra() produces correct CompiledAnimation; verify load() calls renderer with correct GLB URL.
**`BackgroundWidget.test.ts`:** Verify CSS opacity and image URL are applied.

### IAnimationController Integration Tests

```typescript
// LogoRotatorWidget publishes 3 variable keys each tick
// Variables are readable via variableStore.get() after tick
// React component re-renders when variable changes (via useVariable)
```

### Test Updates Required

| Old | New |
|---|---|
| `brainModel.mock.test.ts` | `containedModel.widget.test.ts` |
| `scenePlayback.brainAttachment.test.ts` | `containedModel.attachment.test.ts` |
| `particleSystem.mock.test.ts` | `animationController.test.ts` |
| `ribbonTransitions.test.ts` | Move to `examples/widgets/ribbon/__tests__/` |
| All tests creating `AssetManifest { robot, brain }` | Update to v2 `{ models, containedModels }` |
| All tests using `SceneFrame.ribbon`, `.lighting`, `.floor`, `.background` | Update to `SceneFrame.widgets['...']` |
| All tests with `tick.modelAnimations` | Update to `tick.widgetExtras['primary']` |
| All tests for `CompileApi.setLighting`, `.setRibbon` | Update to `setWidgetState(...)` |

---

## Remaining Design Details

### Generics: Naming Cleanup

All "Robot" prefixes are removed from the new `src/`:

| Legacy name | New name |
|---|---|
| `RobotTimeline` | `SceneTimeline` |
| `createRobotTimeline()` | `createSceneTimeline()` |
| `robotTimeline.ts` | `src/timeline/index.ts` |
| `robotTimelineMath.ts` | `src/timeline/math.ts` |
| `RobotAxisRotation` | `AxisRotation` |
| `RobotAxisTranslation` | `AxisTranslation` |
| `RobotMotionCommand` | `MotionCommand` |
| `RobotPose` | `ModelPose` |
| `RobotPoseGroup` | `PoseGroup` |
| `RobotMotionScene` | `MotionScene` |
| `RobotGroupLimits` | `MotionGroupLimits` |
| `sceneAnimationMultiplier` | `oversamplingRate` |

### `isLightScene` Removed from SceneFrame

`isLightScene` is a BrewBlast CSS theming concept — it toggled the page background class.
It has no place in the library's `SceneFrame`.

**Replacement:** A built-in `SceneMetaWidget` (an `IAnimationController`) reads the current
tick's `sceneId` each frame and publishes it to the variable store. Consumers can react to
it in their own CSS or React components:

```typescript
// In src/player/:
// ScenePlayer automatically registers SceneMetaWidget if not overridden.
// It publishes 'scene.id', 'scene.index', 'scene.progress' to the variable store.

// Consumer React component:
const sceneId = useVariable<string>('scene', 'id');
// Consumer applies their own theming based on sceneId
```

Alternatively, `SceneDefinition` can carry arbitrary `meta: Record<string, JsonPrimitive>`
that the `SceneMetaWidget` publishes. Scene authors write:
```typescript
export const scene02 = {
  id: 'robot',
  index: 1,
  meta: { theme: 'light', background: '#ffffff' },  // consumer-defined
  getFrame: (ctx) => ( ... ),
};
```

### `prefersReducedMotion` Removed from Compiler Core

`CompileSceneTrackOptions` does not include `prefersReducedMotion`. The compiler is pure
and has no knowledge of browser accessibility settings.

`prefersReducedMotion` is detected by the engine once at startup:
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

It is passed only through `CompileExtraContext` (the argument to `ISceneElement.compileExtra()`).
The `ModelWidget` reads it there. No other widget currently uses it.

### `createDefaultWidgetRegistry(manifest)` Reads Models from Manifest

The consumer does NOT declare model IDs twice. `createDefaultWidgetRegistry` reads
model IDs and metadata directly from the manifest:

```typescript
export const createDefaultWidgetRegistry = (manifest: AssetManifest | null): WidgetRegistry => {
  const registry = new WidgetRegistry();
  const clipMeta = manifest ? clipMetaFromManifest(manifest) : [];

  // One ModelWidget per model in the manifest — no separate model config needed
  for (const modelMeta of manifest?.models ?? []) {
    registry.register(new ModelWidget({ modelMeta, clipMeta }));
  }

  registry
    .register(new LightingWidget())
    .register(new BackgroundWidget())
    .register(new EnvironmentWidget())
    .register(new FloorWidget())
    .register(new SceneMetaWidget()); // publishes scene.id, scene.index, scene.progress

  return registry;
};
```

The `ModelWidget` `widgetId` is `modelMeta.id`. The `role` field is removed — it was
an authoring validation hint that no longer belongs in the runtime.

### Widget Tick Priority

When multiple `IAnimationController` widgets run per frame and one depends on another's
published variables, the registration order may not be correct. An optional
`tickPriority` property controls order: lower numbers tick first (default 0).

```typescript
// Extended IAnimationController:
export interface IAnimationController extends IWidget {
  /** Tick order relative to other controllers. Lower = earlier. Default: 0. */
  readonly tickPriority?: number;
  onTick(context: AnimationTickContext): void;
}
```

`WidgetRegistry.getAnimationControllers()` returns controllers sorted by `tickPriority`
ascending. Controllers with the same priority maintain registration order.

### Scene-Aware Animation Controllers

`IAnimationController.onTick()` receives the current compiled tick, allowing controllers
to respond to scene state:

```typescript
export type AnimationTickContext = {
  deltaSeconds: number;
  wallTimeSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  /**
   * The current scene track tick. Read widget states from tick.state.widgets[id].
   * Null before the first compilation completes.
   * Enables animation controllers to vary their behavior per scene without
   * coupling to other widgets.
   */
  tick: SceneTrackTick | null;
};
```

Example use: a breathing controller reads `tick.state.widgets['primary']` to check
whether `playback.customAnimations` contains an active breathing spec for this scene,
then varies its intensity accordingly. The controller does not need to be an `ISceneElement`
to do this — it reads compiled state without owning it.

### Consumer Progress and Scene Hooks

`ScenePlayer` provides a context containing live engine state. Consumer React components
(e.g., custom HUD overlays, progress indicators, navigation) access it via hooks:

**File:** `src/player/useSceneProgress.ts`
```typescript
/** Returns the current global scroll progress as a [0, 1] value. Updates each frame. */
export const useSceneProgress = (): number => { ... };
```

**File:** `src/player/useCurrentScene.ts`
```typescript
/** Returns the active scene id and index. Updates when the scene changes. */
export const useCurrentScene = (): { id: string; index: number } => { ... };
```

These hooks read from `EngineStateContext`, a React context that `ScenePlayer` provides
and updates each frame via the `SceneMetaWidget` publishing to the VariableStore.

### Scene Change Events

`ScenePlayer` emits a callback when the active scene changes:

```typescript
export type ScenePlayerProps = {
  // ...existing props...
  /** Called when the active scene changes. Useful for triggering one-time effects. */
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
};
```

Internally, the `SceneMetaWidget` detects scene ID changes and calls this callback.
It is NOT called on every tick — only when the scene boundary is crossed.

### Annotation `contentId` Slots

Annotations can reference external React content by ID:
```typescript
content: { contentId: 'hero-overlay' }
```

The consumer provides slot content via a `ScenePlayer` prop:

```typescript
export type ScenePlayerProps = {
  // ...existing props...
  /**
   * Named React content slots for annotations that specify contentId.
   * Example: contentSlots={{ 'hero-overlay': <HeroText /> }}
   * The slot content is rendered inside the annotation's positioned container.
   */
  contentSlots?: Record<string, ReactNode>;
};
```

**File:** `src/player/ContentSlotContext.ts`

```typescript
export const ContentSlotContext = createContext<Record<string, ReactNode>>({});

export const useContentSlot = (contentId: string): ReactNode | undefined =>
  useContext(ContentSlotContext)[contentId];
```

The annotation renderer reads from this context when `content.contentId` is specified.

### Three.js Scene Ownership

Explicit ownership chain:
1. `EngineScrollRegion` creates and owns the HTML `<canvas>` element
2. `ScenePlayer` / `useSceneEngine` creates and owns the `THREE.WebGLRenderer`, passing the canvas
3. `RuntimeDriver` creates and owns the `THREE.Scene` and `THREE.PerspectiveCamera`
4. `RuntimeDriver.initialize()` calls `widget.initialize({ scene, widgetId })` for all `IRenderable` widgets, passing the `THREE.Scene` — widgets add their objects to it
5. The `THREE.Scene` is never passed to the compiler or variable store
6. On unmount: `RuntimeDriver.dispose()` calls `widget.dispose()` for all renderables, then disposes the renderer

SSR guard: every `IRenderable.initialize()` implementation must be safe to call in a
non-browser environment (it will not be called by the engine in SSR, but the widget class
must not crash on module import). Three.js imports should be dynamic or guarded.

### Quality Tier Cache — Widget-Registry-Aware

`src/compiler/sceneTrackCache.ts` cache invalidation is based on a key derived from the
widget registry, replacing the legacy `ui.logo` WeakMap and `clipKey` string.

`WidgetRegistry` exposes:
```typescript
buildCacheKey(): string
```

Which produces a stable string from all registered widget IDs and their
compilation-relevant configuration (for `ModelWidget`: sorted clip names + durations;
for other widgets: just `widgetId`). This key is included in `buildSceneTrackKey()`.

The `WeakMap<object, Map<SceneTrackKey, CacheEntry>>` keyed on `ui.logo` is removed.
The global `Map<SceneTrackKey, CacheEntry>` keyed on the full composite key handles
all cases correctly, since the widget registry's cache key changes when clips are added
(manifest loads) or new widgets are registered.

### SSR / Non-Browser Environments

The library has a two-tier SSR story:

**Compiler and math utilities** (`src/compiler/`, `src/timeline/`, `src/math/`): fully
SSR-safe. No browser APIs, no Three.js. Can run in Node for testing or pre-compilation.

**Renderable widgets** (`src/elements/*/`, `examples/widgets/*/`): NOT SSR-safe.
`initialize()` uses Three.js and DOM APIs. These are never called by the engine when
`typeof window === 'undefined'`. Widget class definitions must not reference Three.js
at module import time — imports must be inside `initialize()` or use dynamic imports.

`ScenePlayer` returns a configurable placeholder when rendered server-side:
```typescript
export type ScenePlayerProps = {
  // ...
  /** Rendered on the server and before the engine initializes. Default: null. */
  placeholder?: ReactNode;
};
```

---

## Implementation Reference

This section provides the complete detail a coding bot needs to implement the library
without reading `src/legacy/`. It covers timing guarantees, full type definitions,
algorithmic specifications, and implementation patterns.

---

### IR-1: Variable Update Timing and the Two-Tier Overlay Pattern

This is the most critical implementation detail for correctness.

#### The RAF Frame Sequence

Every frame, `RuntimeLoop.step()` executes this sequence **synchronously**:

```
Step 1  driver.tick(deltaSeconds, globalProgress, wallTimeSeconds)
        ├─ Animation controllers tick in tickPriority order
        │   └─ variableStore.set(ns, key, value) is called
        │       └─ notify() fires all listeners SYNCHRONOUSLY
        │           └─ useSyncExternalStore listeners called
        │               └─ React schedules a synchronous flush (deferred, not immediate)
        └─ Widget renderers apply() called in registration order
            └─ Reads variableStore.get(ns, key) DIRECTLY — zero lag

Step 2  render()   → THREE.WebGLRenderer.render(scene, camera)
                   → Three.js frame drawn to canvas

Step 3  annotationPositioner.update(tick, camera)
                   → Reads bone world positions from Three.js scene
                   → Projects to screen coordinates
                   → Sets element.style.transform DIRECTLY on DOM nodes
                   → NO React involved — this happens every frame at 60fps

[RAF callback ends]

Step 4  React synchronous flush (triggered by step 1 notifications)
        → Components using useVariable() re-render with new values
        → Annotation content (text, colors) updates

Step 5  Browser paint: Three.js canvas + DOM changes merged into single visual frame
```

**Key guarantees:**
- Three.js widget renderers read variables with **zero lag** (same frame as write)
- React annotation content updates with at most **one-frame lag**, but in practice
  the browser merges steps 2-4 into a single paint — no visible lag
- Annotation **positions** update with **zero lag** via direct DOM manipulation (step 3)
- Annotation **content** updates via React re-render (step 4) — one-frame lag is invisible

#### Why This Is Correct

`useSyncExternalStore` is the right React API for this pattern:
- It prevents "tearing" — all components see the same variable snapshot during a render pass
- When notified outside of React (from RAF), React schedules a synchronous flush that
  completes before the next `requestAnimationFrame` callback — so the DOM is updated
  before the next visual frame
- It works correctly in React 18+ concurrent mode

**The wrong approach:** Do not put annotation positions in React state or `useVariable()`.
React state re-renders are asynchronous relative to the RAF loop. Setting a position via
React state would cause annotations to lag one full frame behind bone movement at 60fps —
visibly wrong.

#### The Two-Tier Overlay Architecture

Overlays (annotations, labels) have two completely separate update pathways:

```
TIER 1 — POSITIONS (every frame, no React)
  Source:  Three.js bone worldMatrix (computed by THREE.WebGLRenderer)
  Path:    Three.js → computeScreenPosition() → element.style.transform
  When:    After render() in every RAF frame (step 3 above)
  React:   Never involved

TIER 2 — CONTENT (when content changes, via React)
  Source:  variableStore, annotationPrimitives, labelPrimitives
  Path:    variableStore.set() → notify() → useSyncExternalStore → React re-render
  When:    Only when content actually changes (text, color, visibility, etc.)
  React:   Manages this entirely via useSyncExternalStore
```

#### The `AnnotationPositioner` — Implementation Specification

**File:** `src/player/AnnotationPositioner.ts`

```typescript
// AnnotationPositioner.ts
// Updates annotation/label overlay DOM positions every frame via direct mutation.
// React is NOT involved in position updates. React manages content only.

import type { Camera } from 'three';
import type { AnnotationResolved } from '../annotations/annotationTypes';
import type { LabelResolved } from '../labels/types';

export class AnnotationPositioner {
  // Map from annotation/label id to the DOM element holding its container.
  // Populated by React components via registerElement().
  private elements = new Map<string, HTMLElement>();
  private containerWidth = 0;
  private containerHeight = 0;

  /** Called by React annotation components via useEffect to register their DOM node. */
  registerElement(id: string, el: HTMLElement | null): void {
    if (el) this.elements.set(id, el);
    else this.elements.delete(id);
  }

  /** Called by ScenePlayer when the container resizes. */
  setContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  /**
   * Called every frame AFTER Three.js render(), BEFORE React flush.
   * Directly mutates element.style.transform — no React state, no re-render.
   */
  update(
    annotations: AnnotationResolved[],
    labels: LabelResolved[],
    camera: Camera,
    boneWorldPositions: Map<string, [number, number, number]>,
  ): void {
    for (const annotation of annotations) {
      const el = this.elements.get(annotation.id);
      if (!el) continue;

      let x: number;
      let y: number;

      if (annotation.placement.mode === 'fixed') {
        x = annotation.placement.reference.x === 'left' ? 0
          : annotation.placement.reference.x === 'right' ? this.containerWidth
          : this.containerWidth / 2;
        y = annotation.placement.reference.y === 'top' ? 0
          : annotation.placement.reference.y === 'bottom' ? this.containerHeight
          : this.containerHeight / 2;
        x += annotation.placement.offset.xPct * this.containerWidth;
        y += annotation.placement.offset.yPct * this.containerHeight;
      } else {
        // 'follow' mode: project bone world position to screen
        const bonePos = boneWorldPositions.get(annotation.placement.targetPartId);
        if (!bonePos) continue;
        const screen = projectToScreen(bonePos, camera, this.containerWidth, this.containerHeight);
        x = screen.x + (annotation.placement.screenOffset?.xPct ?? 0) * this.containerWidth;
        y = screen.y + (annotation.placement.screenOffset?.yPct ?? 0) * this.containerHeight;
      }

      // Direct DOM mutation — bypasses React's virtual DOM entirely
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.display = annotation.enabled === false ? 'none' : '';
    }

    // Same pattern for labels
    for (const label of labels) {
      const el = this.elements.get(label.id);
      if (!el || !label.enabled) { el && (el.style.display = 'none'); continue; }
      const bonePos = boneWorldPositions.get(label.targetPartId);
      if (!bonePos) continue;
      const screen = projectToScreen(bonePos, camera, this.containerWidth, this.containerHeight);
      el.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
      el.style.display = '';
    }
  }
}

/** Projects a world-space position to container-relative screen pixels. */
const projectToScreen = (
  worldPos: [number, number, number],
  camera: Camera,
  width: number,
  height: number,
): { x: number; y: number } => {
  // Uses THREE.Vector3.project(camera) math — no Three.js object needed
  // Implementation: multiply worldPos by camera.matrixWorldInverse, then projectionMatrix
  // Map NDC [-1,1] to [0,width] / [0,height]
  // Reference: src/legacy/annotations/annotationLayout.ts for the exact math
  // ...
  return { x: 0, y: 0 }; // placeholder — implement using the math from legacy
};
```

#### How React Annotation Components Register Their DOM Node

```tsx
// src/annotations/AnnotationItem.tsx
// React renders this for each annotation. Content is managed by React.
// Position is managed by AnnotationPositioner (no React involvement).

import { useEffect, useRef } from 'react';
import { useAnnotationPositioner } from '../player/AnnotationPositionerContext';
import { useContentSlot } from '../player/ContentSlotContext';
import { useVariable } from '../widget/useVariable';
import type { AnnotationResolved } from './annotationTypes';

export const AnnotationItem = ({ annotation }: { annotation: AnnotationResolved }) => {
  const ref = useRef<HTMLDivElement>(null);
  const positioner = useAnnotationPositioner();

  // Register this DOM node with the positioner so it can set transform directly
  useEffect(() => {
    positioner.registerElement(annotation.id, ref.current);
    return () => positioner.registerElement(annotation.id, null);
  }, [annotation.id, positioner]);

  // Content slot resolution (contentId system)
  const slotContent = useContentSlot(
    'contentId' in (annotation.content ?? {}) ? (annotation.content as { contentId: string }).contentId : '',
  );

  return (
    // position: absolute; top: 0; left: 0 — NEVER change these via React
    // transform is set by AnnotationPositioner via DOM mutation
    <div
      ref={ref}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {'node' in (annotation.content ?? {})
        ? (annotation.content as { node: React.ReactNode }).node
        : slotContent}
    </div>
  );
};
```

**File:** `src/player/AnnotationPositionerContext.ts` — React context holding the
`AnnotationPositioner` instance. `ScenePlayer` creates one instance and provides it:

```typescript
export const AnnotationPositionerContext = createContext<AnnotationPositioner | null>(null);
export const useAnnotationPositioner = () => {
  const ctx = useContext(AnnotationPositionerContext);
  if (!ctx) throw new Error('[useAnnotationPositioner] must be inside ScenePlayer');
  return ctx;
};
```

#### The `VariableStore.subscribe` / `useSyncExternalStore` Contract

```typescript
// Correct implementation of useVariable using useSyncExternalStore:
export const useVariable = <T extends JsonPrimitive>(
  namespace: string,
  key: string,
): T | undefined => {
  const store = useContext(VariableStoreContext);
  if (!store) throw new Error('[useVariable] must be inside ScenePlayer');

  // subscribe: React calls this to register a listener.
  // Returns an unsubscribe function.
  // IMPORTANT: this function reference must be stable across renders,
  // so it's constructed outside of the render — or memoized.
  const subscribe = useCallback(
    (callback: () => void) => store.subscribe(`${namespace}.${key}`, callback),
    [store, namespace, key],
  );

  // getSnapshot: React calls this to read the current value.
  // Must be idempotent and return referentially stable values when unchanged.
  const getSnapshot = useCallback(
    () => store.get(namespace, key) as T | undefined,
    [store, namespace, key],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
```

**Correctness rule for `VariableStore.set()`**: If the new value equals the old value
(strict equality for primitives), do NOT call `notify()`. This prevents unnecessary
React re-renders on every tick for stable variables. The implementation already includes
this guard: `if (ns.get(key) === value) return;`

---

### IR-2: Complete Core Type Definitions

These are the exact types coding bots must implement. Every field matters.

#### `SceneTimeline`

**File:** `src/timeline/index.ts`

```typescript
export type SceneTimeline = {
  /** One stop per scene, in order. */
  stops: ReadonlyArray<{ id: string }>;
  sceneCount: number;
  /** Number of pre-baked ticks per scene segment. Controls interpolation resolution. */
  framesPerScene: number;
  /** Quality multiplier — number of sub-ticks per segment. 1 = low, 4 = high. */
  subTicksPerSegment: number;
  /** Upsampling rate for animation interpolation. Default 10. */
  oversamplingRate: number;
  /** Progress step between scene stops: 1 / (sceneCount - 1). */
  tickStep: number;
  /** Total number of pre-baked ticks in the compiled track. */
  subTickCount: number;
  /** Maps stop index to global progress value [0, 1]. tick(0) = 0, tick(N-1) = 1. */
  tick: (index: number) => number;
  /** Maps global progress to scene-local progress [0, 1]. */
  mapToSceneProgress: (progress: number) => number;
  /** Snaps a progress value to the nearest tick boundary. */
  snapToTick: (progress: number) => number;
};

export const createSceneTimeline = (
  scenes: ReadonlyArray<{ id: string }>,
  options?: {
    framesPerScene?: number;
    subTicksPerSegment?: number;
    oversamplingRate?: number;
  },
): SceneTimeline => { /* ... */ };

export const createQualityTimeline = (
  base: SceneTimeline,
  subTicksPerSegment: number,
): SceneTimeline => { /* ... */ };
```

#### `SceneFrame`

**File:** `src/compiler/sceneTrackTypes.ts`

```typescript
export type SceneFrame = {
  /** Scene definition id. Set by setSceneMeta(). */
  id: string;
  /** Scene-local progress [0, 1] at this tick. */
  scrollProgress: number;
  /**
   * All element states, keyed by widgetId.
   * The compiler populates this for every registered ISceneElement widget.
   * Widget type: widgets[widgetId] has type TState for that widget's ISceneElement<TState>.
   */
  widgets: Record<string, unknown>;
  annotations?: AnnotationDefinition[];
  annotationDefaults?: Partial<AnnotationDefaults>;
  labels?: LabelDefinition[];
};
```

#### `SceneTrackTick`

```typescript
export type SceneTrackTick = {
  /** Zero-based index in the compiled track array. */
  index: number;
  /** Global progress [0, 1]. */
  progress: number;
  /** ID of the active scene at this tick. */
  sceneId: string;
  /** Zero-based index of the active scene. */
  sceneIndex: number;
  /** Scene-local progress [0, 1] at this tick. */
  sceneProgress: number;
  /** Full resolved scene state for this tick. */
  state: SceneFrame;
  /** Compiled annotation primitives ready for rendering. */
  annotationPrimitives?: AnnotationResolved[];
  /** Compiled label primitives ready for rendering. */
  labelPrimitives?: LabelResolved[];
  /**
   * Forward delta: what changed between this tick and tick[index+1].
   * Used for optimized forward scrubbing — only apply changed fields.
   * Undefined for the last tick.
   */
  deltaForward: SceneFrameDelta;
  /**
   * Backward delta: what changed between this tick and tick[index-1].
   * Used for optimized backward scrubbing.
   * Undefined for the first tick.
   */
  deltaBackward: SceneFrameDelta;
  /**
   * Widget-specific compile-time outputs, keyed by widgetId.
   * Populated for widgets implementing ISceneElement.compileExtra().
   * ModelWidget stores CompiledAnimation here.
   * Access as: tick.widgetExtras?.['primary'] as CompiledAnimation
   */
  widgetExtras?: Record<string, unknown>;
};

export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
};

export type SceneWindow = {
  id: string;
  index: number;
  start: number;   // global progress where this scene begins
  end: number;     // global progress where this scene ends
  entryStart: number; // global progress where entry transitions begin (≤ start)
};

export type SceneFrameDelta = {
  widgets?: Record<string, unknown>;
  annotations?: SceneFrame['annotations'];
  annotationDefaults?: SceneFrame['annotationDefaults'];
  labels?: SceneFrame['labels'];
};
```

#### `SceneDefinition` and `SceneGroup`

**File:** `src/compiler/sceneTypes.ts`

```typescript
export type SceneFrameContext = {
  /** Scene-local progress [0, 1]. Same as sceneProgress. */
  progress: number;
  sceneProgress: number;
  /** Scene-local progress without clamping. May be <0 or >1 during entry/exit. */
  sceneProgressRaw?: number;
  /** Global progress [0, 1] across all scenes. */
  globalProgress: number;
  /** Global progress where this scene's window begins. */
  sceneStart: number;
  /** Global progress where this scene's window ends. */
  sceneEnd: number;
  /** False until all ILoadable widgets complete load(). */
  assetsReady: boolean;
  /** The per-scene timeline (progress 0→1 maps to this scene's tick range). */
  timeline: SceneTimeline;
  /** The compiled state of the PREVIOUS scene (for scene continuity). */
  baseState?: SceneFrame;
  baseStateRaw?: SceneFrame;
  /** The compiled state of the NEXT scene (for look-ahead transitions). */
  nextState?: SceneFrame;
  /** Read-only variable store. Scene authors read variables from here. */
  variables?: VariableStoreReader;
  /** Viewport dimensions. Updated each frame. */
  viewport?: { width: number; height: number; aspectRatio: number };
};

export type SceneTransition = {
  id: string;
  /** Start progress [0, 1] within the scene. Negative values start before the scene. */
  start: number | ((context: SceneFrameContext) => number);
  /** End progress [0, 1] within the scene. */
  end: number | ((context: SceneFrameContext) => number);
  scope?: 'active' | 'persist';
  apply: (state: SceneFrame, context: SceneFrameContext, t: number) => SceneFrame;
};

export type SceneDefinition = {
  id: string;
  index: number;
  /** Optional: metadata published to the variable store each frame. */
  meta?: Record<string, JsonPrimitive>;
  /** How far before the scene boundary this scene starts being active. 0 = no lead. */
  entryLead?: number;
  /** Explicit override for when entry transitions begin. */
  entryStart?: number;
  /** Returns the scene's element state as JSX. Pure function of context. */
  getFrame: (context: SceneFrameContext) => React.ReactNode;
  /** Transitions applied during this scene's time window. */
  transitions?: SceneTransition[];
};

export type SceneGroup = {
  id: string;
  scenes: SceneDefinition[];
  timeline: SceneTimeline;
};
```

#### `CompileApi`

**File:** `src/compiler/sceneDslTypes.ts`

```typescript
export type CompileApi = {
  context: SceneFrameContext;
  state: SceneFrame;
  transitions: SceneTransition[];
  /** Push an annotation to state.annotations[]. */
  pushAnnotation: (annotation: AnnotationDefinition) => void;
  /** Push a label to state.labels[]. */
  pushLabel: (label: LabelDefinition) => void;
  /**
   * Set compiled widget state by widget ID.
   * ONLY method for writing element state during DSL compilation.
   * Called by registered DSL node handlers (never directly by scene authors).
   */
  setWidgetState: (widgetId: string, state: unknown) => void;
  /** Set scene metadata (id, meta fields). */
  setSceneMeta: (meta: { id?: string; meta?: Record<string, JsonPrimitive> }) => void;
};

export type CompileHelpers = {
  /** Recursively process child JSX nodes of a parent element. */
  compileChildren: (node: React.ReactElement, api: CompileApi) => void;
  /** Resolve a value that may be a function of SceneFrameContext. */
  resolveValue: <T>(value: T | ((context: SceneFrameContext) => T), context: SceneFrameContext) => T;
  /** Recursively resolve all function-valued fields in an object. */
  resolveObjectValues: <T extends Record<string, unknown>>(value: T, context: SceneFrameContext) => T;
  /** Remove undefined fields from an object (deep). */
  stripUndefinedDeep: <T extends Record<string, unknown>>(value: T) => T;
  /** Collect immediate React children as a flat array. */
  collectChildren: (node: React.ReactElement) => unknown[];
};

export type NodeHandler = (
  node: React.ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;
```

#### `ElementTransitionSpec<T>` and Helpers

**File:** `src/compiler/transitions/transitionTypes.ts`

```typescript
export type TransitionContext = {
  /** Exit-side progress [0, 1]. 0 = start of exit transition, 1 = end. */
  tExit: number;
  /** Enter-side progress [0, 1]. 0 = start of enter transition, 1 = end. */
  tEnter: number;
  /** Full transition progress [0, 1] across the entire overlap window. */
  tFull: number;
  /** Raw global progress of this tick. */
  progress: number;
  exitStart: number;
  exitEnd: number;
  enterStart: number;
  enterEnd: number;
};

export type ElementTransitionSpec<T> = {
  /**
   * Called when a scene is leaving. Only the FROM state is available.
   * Returns modified FROM state (typically fades it out).
   */
  exit: (from: T, context: TransitionContext) => T;
  /**
   * Called when a scene is entering. Only the TO state is available.
   * Returns modified TO state (typically fades it in from default).
   */
  enter: (to: T, context: TransitionContext) => T;
  /**
   * Called when two scenes overlap (both active simultaneously).
   * Both FROM and TO states are available. Interpolate between them.
   * NEVER collapse tExit/tEnter/tFull into a single t — different elements
   * use different t values for different visual effects.
   */
  interpolate: (from: T, to: T, context: TransitionContext) => T;
};

// All blend helpers from legacy transitionTypes.ts are preserved:
export { blendNumber, blendVec3, blendColor, blendOpacity,
         blendAxisRotation, blendAxisTranslation, blendStyleValues,
         lerp, lerpVec3, clamp01 };
```

#### `RuntimeDriver` (Generic)

**File:** `src/runtime/types.ts`

```typescript
export type RuntimeDriver = {
  assetsReady: boolean;
  /** Called every RAF frame by RuntimeLoop. */
  tick(options: {
    deltaSeconds: number;
    globalProgress: number;
    wallTimeSeconds: number;
  }): void;
  /** Called when compilation produces a new SceneTrack. */
  setSceneTrack(track: SceneTrack, sampler: SceneTrackSampler): void;
  /** Called to signal that assetsReady has changed (triggers recompile). */
  setAssetsReady(ready: boolean): void;
  /** Called to provide a world snapshot for annotation target resolution. */
  getBoneWorldPositions(): Map<string, [number, number, number]>;
};
```

Note: The generic `RuntimeDriver` interface is minimal. The `RuntimeDriverImpl` class
implements this and holds the `WidgetRegistry`, `VariableStore`, and manages the
widget lifecycle. The interface is what `RuntimeLoop` and `SceneCompiler` depend on.

#### `World` and `Node` (Three.js Scene Graph Abstraction)

**File:** `src/runtime/types.ts` (continued)

The `World`/`Node` abstraction wraps Three.js `Object3D` objects. It provides the
interface through which widget `ModelRenderer` code manipulates the scene graph without
importing Three.js in the pure layers. Three.js code implements these interfaces.

```typescript
export type Vec3 = [number, number, number];

export type Node = {
  readonly name: string;
  parent?: Node;
  children: Node[];
  localPosition: Vec3;
  localRotation: Vec3; // Euler angles in radians, XYZ order
  localScale: Vec3;
  readonly worldPosition: Vec3;
  readonly worldRotation: Vec3;
  readonly worldScale: Vec3;
  /** The 4x4 world matrix as a flat 16-element array (column-major). */
  readonly matrixWorld?: number[];
  add(child: Node): void;
  remove(child: Node): void;
};

export type World = {
  readonly nodesByName: ReadonlyMap<string, Node>;
  readonly root: Node;
  createNode(name: string): Node;
  addNode(node: Node, parentName?: string): void;
  removeNode(name: string): void;
  getNode(name: string): Node | null;
  /** Recomputes all world matrices. Call after modifying local transforms. */
  updateWorldMatrix(): void;
};
```

---

### IR-3: The Three Compiler Passes — Algorithmic Specification

**File:** `src/compiler/sceneTrackCompiler.ts`

The compiler runs three sequential passes over the scene list. All passes are pure
functions — no Three.js, no browser APIs.

#### Pass 1: Base State Resolution

Purpose: Give each scene knowledge of what the PREVIOUS scene looked like at its end,
so scenes can smoothly continue the prior state.

```
for scene at index i = 0 to N-1:
  context = buildSceneContext(progress=sceneEnd[i], assetsReady, ...)
  { frame } = resolveSceneFromDsl(scene.getFrame(context), context)
  scene.endState = frame       // the scene's state at its own end (sceneProgress=1)

for scene at index i = 1 to N-1:
  scene.baseState = scenes[i-1].endState   // start from where prior scene ended
```

#### Pass 2: Auto-Entry Detection

Purpose: Detect transitions with `start < 0` (they begin before the scene's nominal
window) and pull the scene's `entryStart` earlier so the sampler knows to activate
this scene before its nominal start time.

```
for each scene:
  for each transition in scene.transitions:
    resolvedStart = resolveTransitionStart(transition, entryContext)
    if resolvedStart < 0:
      entryStart = min(entryStart, sceneWindow.start + resolvedStart * sceneWindow.span)
  scene.entryStart = entryStart
```

Entry transitions belong to the **incoming** (to) scene — they describe how the
incoming scene fades in. They must NOT be placed in the outgoing scene's transitions.

#### Pass 3: Tick Baking

Purpose: For every tick across [0, 1], determine the active scene, apply transitions,
call compileExtra(), compile annotations and labels, compute forward/backward deltas.

```
for tickIndex = 0 to subTickCount-1:
  progress = tickIndex / (subTickCount - 1)
  activeScene = findActiveScene(progress, sceneWindows)
  prevScene = findPrevScene(progress, sceneWindows)

  // 1. Build base frame with all widget default states
  frame = createBaseSceneState(widgetRegistry)

  // 2. Resolve DSL for active scene
  context = buildSceneContext(progress, activeScene, ...)
  // IMPORTANT: widgetRegistry is required as the third argument
  { frame: dslFrame, transitions } = resolveSceneFromDsl(activeScene.getFrame(context), context, widgetRegistry)
  merge dslFrame.widgets into frame.widgets

  // 3. Apply element transitions for each registered ISceneElement widget
  for widget of widgetRegistry.getSceneElements():
    fromState = prevFrame.widgets[widget.widgetId] ?? widget.defaultState
    toState   = dslFrame.widgets[widget.widgetId] ?? widget.defaultState
    transitionCtx = buildTransitionContext(progress, activeScene, prevScene)
    frame.widgets[widget.widgetId] = widget.transitionSpec.interpolate(fromState, toState, transitionCtx)

  // 4. Apply scene-level transitions (SceneTransition[])
  for transition of transitions:
    t = resolveTransitionT(progress, transition, activeScene)
    frame = transition.apply(frame, context, t)

  // 5. Call compileExtra() for widgets that implement it
  compileExtraCtx = { sceneProgress, globalProgress, clipMeta, prefersReducedMotion }
  for widget of widgetRegistry.getSceneElements():
    if widget.compileExtra:
      widgetExtras[widget.widgetId] = widget.compileExtra(frame.widgets[widget.widgetId], compileExtraCtx)

  // 6. Compile annotations and labels
  annotationPrimitives = compileAnnotations(frame.annotations ?? [], context)
  labelPrimitives = compileLabels(frame.labels ?? [], context)

  // 7. Store tick
  tick = { index: tickIndex, progress, sceneId, sceneIndex, sceneProgress,
           state: frame, annotationPrimitives, labelPrimitives, widgetExtras }
  ticks.push(tick)

// 8. Compute forward/backward deltas after all ticks are baked
for i = 0 to ticks.length-1:
  ticks[i].deltaForward = computeDelta(ticks[i].state, ticks[i+1]?.state)
  ticks[i].deltaBackward = computeDelta(ticks[i].state, ticks[i-1]?.state)
```

#### `resolveSceneFromDsl` — DSL Compiler Entry Point

**File:** `src/compiler/sceneDslCompiler.ts`

```typescript
export const resolveSceneFromDsl = (
  tree: unknown,
  context: SceneFrameContext,
  widgetRegistry: WidgetRegistry,
): ResolvedScene => {
  // tree must be a JSX element with <Scene> as root
  if (!isValidElement(tree)) throw new Error('Scene DSL must return a JSX element.');

  const api = createApi(context, widgetRegistry);
  const handler = getNodeHandler(treeEl.type);
  if (!handler) throw new Error('Scene DSL root must be <Scene>.');
  handler(treeEl, api, helpers);

  return { frame: api.state, transitions: api.transitions };
};
```

The `expandNode` function recursively unwraps non-primitive React components (those
not in the `nodeRegistry`) by calling them as functions and expanding their output.
This allows consumer-defined compound JSX components to be used in scene files —
they are transparent to the compiler.

```typescript
const expandNode = (node: unknown): unknown[] => {
  if (!isValidElement(node)) return [node];
  const element = node as ReactElement;
  // Fragment: expand children
  if (element.type === Fragment) return Children.toArray(element.props.children).flatMap(expandNode);
  // Registered primitive: stop here — the handler processes it
  if (isPrimitiveComponent(element.type)) return [node];
  // User component: call it as a function and expand the result
  if (typeof element.type === 'function') {
    const result = (element.type as Function)(element.props);
    return expandNode(result);
  }
  return [node];
};
```

---

### IR-4: The DSL Node Handler Registration Pattern

**File:** `src/compiler/registry.ts`

```typescript
// Global map: React component function → NodeHandler
// Built-in element widgets register their handlers in their widget constructors.
// Consumer widgets register via WidgetRegistry.register() which calls registerNode().
const nodeRegistry = new Map<unknown, NodeHandler>();

export const registerNode = (component: unknown, handler: NodeHandler): void => {
  nodeRegistry.set(component, handler);
  // Also index by display name for hot-module-reload stability
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name) nodeRegistryByName.set(name, handler);
  }
};

export const getNodeHandler = (component: unknown): NodeHandler | undefined => {
  return nodeRegistry.get(component) ?? nodeRegistryByName.get(getName(component));
};

export const isPrimitiveComponent = (component: unknown): boolean =>
  Boolean(getNodeHandler(component));
```

**Registration order matters:**
- Widgets call `registerNode(widget.DslComponent, handler)` in their constructor
- `WidgetRegistry.register(widget)` is called after the constructor
- If the widget registers a custom handler in its constructor, `WidgetRegistry` sees
  it already in the registry and does NOT overwrite with the default merge handler
- The check in `WidgetRegistry.register()`:
  ```typescript
  if (isSceneElement(widget) && !nodeRegistry.has(widget.DslComponent)) {
    registerNode(widget.DslComponent, defaultMergeHandler(widget));
  }
  ```

**The `<Scene>` root handler:**

The compiler's root handler for `<Scene>` delegates child processing to `compileChildren`:

```typescript
// Registered by the Scene primitive (built into the compiler, not a widget)
registerNode(Scene, (node, api, helpers) => {
  helpers.compileChildren(node, api);
  // Extract scene meta from props if provided
  const props = node.props as { id?: string; meta?: Record<string, JsonPrimitive> };
  if (props.id) api.setSceneMeta({ id: props.id });
  if (props.meta) api.setSceneMeta({ meta: props.meta });
});
```

---

### IR-5: The RuntimeLoop and Driver Integration

**File:** `src/runtime/RuntimeLoop.ts` (copy from legacy with renames)

The loop calls `driver.tick()` then `render()`. The `render()` function is provided
by the engine layer — it calls `THREE.WebGLRenderer.render(scene, camera)`. After
rendering, the annotation positioner runs (step 3 in the frame sequence).

```typescript
// In ScenePlayer / useSceneEngine:
const render = () => {
  renderer.render(threeScene, camera);
  annotationPositioner.update(
    currentTick?.annotationPrimitives ?? [],
    currentTick?.labelPrimitives ?? [],
    camera,
    driver.getBoneWorldPositions(),
  );
};

// Pass to RuntimeLoop:
const loop = new RuntimeLoop({
  driver,
  getGlobalProgress: () => scrollProgress.current,
  render,
  onAfterTick: ({ deltaSeconds, wallTimeSeconds }) => {
    // SceneMetaWidget publishes scene.id, scene.progress here
  },
  fpsCap: 60,
});
```

---

### IR-6: Widget Implementation Patterns

#### Minimal `ISceneElement + IRenderable` (e.g., FogWidget)

```typescript
import type { ISceneElement, IRenderable, WidgetInitContext, WidgetRenderContext } from '../widget/types';
import type { ElementTransitionSpec } from '../compiler/transitions/transitionTypes';
import { blendNumber } from '../compiler/transitions/transitionTypes';
import { registerNode } from '../compiler/registry';

type FogState = { enabled: boolean; color: string; near: number; far: number };

const DEFAULT_FOG: FogState = { enabled: false, color: '#ffffff', near: 10, far: 100 };

export const FogDsl = (_props: Partial<FogState>) => null;
FogDsl.displayName = 'Fog';

const fogTransitionSpec: ElementTransitionSpec<FogState> = {
  exit: (from, ctx) => ({ ...from, enabled: false }),
  enter: (to, ctx) => ({ ...to, enabled: to.enabled && ctx.tEnter > 0.01 }),
  interpolate: (from, to, ctx) => ({
    enabled: to.enabled,
    color: blendColor(from.color, to.color, ctx.tFull),
    near: blendNumber(from.near, to.near, ctx.tFull)!,
    far: blendNumber(from.far, to.far, ctx.tFull)!,
  }),
};

export class FogWidget implements ISceneElement<FogState>, IRenderable<FogState> {
  readonly widgetId = 'fog';
  readonly defaultState = DEFAULT_FOG;
  readonly transitionSpec = fogTransitionSpec;
  readonly DslComponent = FogDsl;

  constructor() {
    // Register the DSL handler BEFORE WidgetRegistry.register() is called
    registerNode(FogDsl, (node, api) => {
      const props = node.props as Partial<FogState>;
      api.setWidgetState(this.widgetId, { ...DEFAULT_FOG, ...props });
    });
  }

  initialize({ scene }: WidgetInitContext): void {
    // Create Three.js fog object — guard against SSR
    if (typeof window === 'undefined') return;
    // scene.fog = new THREE.Fog(...) etc.
  }

  apply(state: FogState, _ctx: WidgetRenderContext): void {
    // Apply state to Three.js fog object
  }

  dispose(): void { /* cleanup */ }
}
```

#### Minimal `IAnimationController + IVariableProvider`

```typescript
export class ClockWidget implements IAnimationController, IVariableProvider {
  readonly widgetId = 'clock';
  readonly variableNamespace = 'clock';
  readonly variableKeys = ['seconds', 'minutes', 'formatted'] as const;
  readonly tickPriority = 0; // default: runs before widgets with tickPriority > 0

  onTick({ deltaSeconds, wallTimeSeconds, variables }: AnimationTickContext): void {
    const totalSeconds = Math.floor(wallTimeSeconds);
    variables.set(this.variableNamespace, 'seconds', totalSeconds % 60);
    variables.set(this.variableNamespace, 'minutes', Math.floor(totalSeconds / 60));
    variables.set(this.variableNamespace, 'formatted', `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`);
  }
}
```

---

### IR-7: Test Patterns for the New Architecture

#### Testing a Pure `ISceneElement` Transition Spec

```typescript
// src/elements/lighting/__tests__/LightingWidget.test.ts
import { describe, it, expect } from 'vitest';
import { LightingWidget } from '../LightingWidget';
import type { TransitionContext } from '../../compiler/transitions/transitionTypes';

const widget = new LightingWidget();
const makeCtx = (tFull: number): TransitionContext => ({
  tExit: tFull, tEnter: tFull, tFull,
  progress: tFull, exitStart: 0, exitEnd: 1, enterStart: 0, enterEnd: 1,
});

describe('LightingWidget transitionSpec', () => {
  it('interpolates ambient intensity', () => {
    const from = { ...widget.defaultState, ambient: { intensity: 0, color: '#fff' } };
    const to   = { ...widget.defaultState, ambient: { intensity: 2, color: '#fff' } };
    const result = widget.transitionSpec.interpolate(from, to, makeCtx(0.5));
    expect(result.ambient.intensity).toBeCloseTo(1.0);
  });

  it('enter() fades in from zero intensity', () => {
    const to = { ...widget.defaultState, ambient: { intensity: 2, color: '#fff' } };
    const result = widget.transitionSpec.enter(to, makeCtx(0.5));
    expect(result.ambient.intensity).toBeLessThan(to.ambient.intensity);
  });
});
```

#### Testing the Compiler with a Mock Widget

```typescript
// src/compiler/__tests__/sceneTrackCompiler.generic.test.ts
import { describe, it, expect } from 'vitest';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { compileSceneTrack } from '../sceneTrackCompiler';
import { createSceneTimeline } from '../../timeline';

// A minimal ISceneElement widget for testing
const mockWidget = {
  widgetId: 'mock',
  defaultState: { value: 0 },
  transitionSpec: {
    exit: (from: { value: number }) => ({ value: 0 }),
    enter: (to: { value: number }) => to,
    interpolate: (from: { value: number }, to: { value: number }, ctx: any) =>
      ({ value: from.value + (to.value - from.value) * ctx.tFull }),
  },
  DslComponent: () => null,
  childDslComponents: [],
};

it('stores widget default state when scene does not specify it', () => {
  const registry = new WidgetRegistry();
  registry.register(mockWidget as any);

  const scenes = [
    { id: 's1', index: 0, getFrame: () => <Scene />, transitions: [] },
  ];
  const timeline = createSceneTimeline(scenes, { framesPerScene: 2 });
  const track = compileSceneTrack({ scenes, timeline, widgetRegistry: registry, clipMeta: [], prefersReducedMotion: false, assetsReady: true });

  expect(track.ticks[0].state.widgets['mock']).toEqual({ value: 0 });
});
```

#### Testing `VariableStore` + `useSyncExternalStore` Integration

```typescript
// src/widget/__tests__/VariableStore.test.ts
import { describe, it, expect, vi } from 'vitest';
import { VariableStore } from '../VariableStore';

it('notifies subscriber when value changes', () => {
  const store = new VariableStore();
  const listener = vi.fn();
  store.subscribe('ns.key', listener);
  store.set('ns', 'key', 42);
  expect(listener).toHaveBeenCalledTimes(1);
});

it('does NOT notify subscriber when value is unchanged', () => {
  const store = new VariableStore();
  const listener = vi.fn();
  store.set('ns', 'key', 42); // set before subscribe
  store.subscribe('ns.key', listener);
  store.set('ns', 'key', 42); // same value
  expect(listener).not.toHaveBeenCalled();
});

it('unsubscribe stops notifications', () => {
  const store = new VariableStore();
  const listener = vi.fn();
  const unsubscribe = store.subscribe('ns.key', listener);
  unsubscribe();
  store.set('ns', 'key', 'hello');
  expect(listener).not.toHaveBeenCalled();
});
```

#### Mock Widget Implementations for Runtime Tests

**File:** `src/runtime/mocks/MockWidgetRegistry.ts`

```typescript
import { WidgetRegistry } from '../../widget/WidgetRegistry';

// Creates a WidgetRegistry with no widgets registered.
// Tests that need specific widget behavior create and register mock widgets inline.
export const createEmptyWidgetRegistry = (): WidgetRegistry => new WidgetRegistry();

// A mock IRenderable that records apply() calls for assertion
export const createMockRenderable = (id: string) => ({
  widgetId: id,
  applyCalls: [] as Array<{ state: unknown; extra: unknown }>,
  initialize: vi.fn(),
  apply(state: unknown, ctx: { extra: unknown }) {
    this.applyCalls.push({ state, extra: ctx.extra });
  },
  dispose: vi.fn(),
});
```

---

### IR-8: The `SceneTrackCache` — Invalidation Strategy

**File:** `src/compiler/sceneTrackCache.ts`

The cache key is a composite string. A cached track is reused when ALL of:
1. Scene IDs and order are the same
2. Timeline parameters are the same (sceneCount, subTickCount, tickStep)
3. Widget registry cache key is the same (all widget IDs + their clip configs)
4. `assetsReady` flag is the same
5. `prefersReducedMotion` is the same

```typescript
export const buildSceneTrackKey = (options: {
  scenes: SceneDefinition[];
  timeline: SceneTimeline;
  widgetRegistry: WidgetRegistry;
  prefersReducedMotion: boolean;
  assetsReady: boolean;
}): string => [
  options.scenes.map((s) => s.id).join('|'),
  `t:${options.timeline.sceneCount}|${options.timeline.subTickCount}`,
  `w:${options.widgetRegistry.buildCacheKey()}`,
  `rm:${options.prefersReducedMotion ? 1 : 0}`,
  `ar:${options.assetsReady ? 1 : 0}`,
].join('::');
```

`WidgetRegistry.buildCacheKey()`:
```typescript
buildCacheKey(): string {
  return Array.from(this.widgets.values())
    .map((w) => {
      // Include clip metadata for ModelWidget (which changes when manifest loads)
      const extra = 'clipMeta' in w
        ? (w as { clipMeta: ClipMeta[] }).clipMeta.map((c) => `${c.name}:${c.duration.toFixed(3)}`).join(',')
        : '';
      return `${w.widgetId}:${extra}`;
    })
    .sort()
    .join('|');
}
```

The cache is a module-level `Map<string, CacheEntry>`. No WeakMap keyed on mutable
objects (the old `ui.logo` approach is gone). The cache must be cleared when the
page unmounts or when a new `ScenePlayer` instance mounts with different scenes.

**File:** `src/compiler/sceneTrackCache.ts` should expose:
```typescript
export const clearCache = (): void => { trackCache.clear(); };
```

And `ScenePlayer` calls `clearCache()` on unmount.

---

### IR-9: The `gen-scene-dsl.mjs` Script Specification

#### Input: `sceneResources.ts`

```typescript
// The script reads this file using Babel to parse the JSX/TS statically.
// It extracts the exported 'sceneResources' object.
export const sceneResources = {
  models: [
    {
      id: 'primary',                          // becomes ModelId union type + ModelWidget widgetId
      role: 'primary' as const,              // authoring hint only, not used at runtime
      path: '/assets/robot.no-normals.glb',  // must start with /assets/
      anchorKeys: ['head', 'chest'],          // names for anchor point resolution
    },
  ],
  containedModels: [
    { id: 'brain', path: '/assets/brain_separated.glb' },
  ],
  animations: [
    { id: 'chat-relax-f', path: '/assets/motion/ChatRelaxF/chat-relax-f.glb' },
  ],
} as const;
```

#### Outputs

**`sceneResources.generated.ts`** — TypeScript types for scene authoring:
```typescript
export type ModelId = 'primary';
export type AnimationId = 'chat-relax-f';
export type ContainedModelId = 'brain';

// Body part ids extracted from model GLB node names
export type PrimaryBodyPartId = 'Head' | 'Spine1' | /* ... */;

// Subpart ids for contained models
export type BrainSubpartId = 'frontal_lobe' | /* ... */;
```

**`sceneDsl.generated.tsx`** — Typed DSL component wrappers:
```tsx
// Wraps the generic ModelWidget DslComponent with type-safe props
export const PrimaryModel = (props: ModelDslProps<PrimaryBodyPartId>) => <Model id="primary" {...props} />;
```

**`scene-manifest.json`** (with `--manifest-out`):
```json
{
  "version": 2,
  "models": [
    {
      "id": "primary",
      "glb": "/assets/robot.no-normals.glb",
      "bones": ["mixamorig:Hips", "mixamorig:Head", /* ... */],
      "meshes": ["Body_Mesh", "Eyes_Mesh", /* ... */],
      "anchorTargets": {
        "head": "mixamorig:Head",
        "chest": "mixamorig:Spine2"
      }
    }
  ],
  "containedModels": [
    {
      "id": "brain",
      "glb": "/assets/brain_separated.glb",
      "subparts": ["frontal_lobe", "temporal_lobe", /* ... */]
    }
  ],
  "animations": [
    { "id": "chat-relax-f", "glb": "/assets/motion/ChatRelaxF/chat-relax-f.glb",
      "clipName": "ChatRelaxF", "duration": 3.467 }
  ]
}
```

#### Anchor Key Resolution Algorithm

For each `anchorKey` in `model.anchorKeys[]`, the script searches the GLB node list:

```
1. Exact match (case-insensitive): node.name.toLowerCase() === key.toLowerCase()
2. Suffix match: node.name.toLowerCase().endsWith(':' + key.toLowerCase())
   (catches 'mixamorig:Head' for key 'head')
3. Contains match: node.name.toLowerCase().includes(key.toLowerCase())
   AND node is a bone (has children or is leaf in skeleton hierarchy)
   AND does NOT contain 'end' (avoids 'HeadEnd', 'FootEnd' etc.)
4. If no match found: console.warn and store key itself as the value
   (consumer must verify the skeleton structure manually)
```

---

## Implementation Phase Sequence

Phases must be executed in dependency order. Phases at the same level can proceed in parallel.

```
── SETUP ──────────────────────────────────────────────────────────────────────

Phase 0:  Repository setup
          - Rename src/robot/ → src/legacy/
          - Remove src/legacy/ from tsconfig.json include paths
          - Create src/ directory structure (all empty index.ts stubs)
          - Update vite.config.ts: coverage targets point to new src/
          - Remove local.brewblast.ai from vite.config.ts allowedHosts
          - Verify pnpm build produces a clean (empty) bundle
          └─ No dependencies. Do this first.

── CORE SDK ──────────────────────────────────────────────────────────────────

Phase 1:  Timeline + math utilities
          - src/timeline/index.ts  (SceneTimeline, createSceneTimeline — renamed from RobotTimeline)
          - src/timeline/math.ts   (copy from robotTimelineMath.ts — unchanged logic)
          - src/math/index.ts      (copy from runtime/math.ts — Vec3, Mat4, quaternion ops)
          - src/math/pose.ts       (copy from runtime/pose.ts — unchanged logic)
          └─ Depends on: Phase 0

Phase 2:  Widget SDK
          - src/widget/types.ts        (IWidget, ISceneElement, IDslComposite, IRenderable,
                                        IContainedModel, ILoadable, IAnimationController,
                                        IVariableProvider + all context types)
          - src/widget/WidgetRegistry.ts  (register, type guards, buildCacheKey)
          - src/widget/VariableStore.ts
          - src/widget/VariableStoreContext.ts
          - src/widget/useVariable.ts
          - src/widget/index.ts
          └─ Depends on: Phase 0

Phase 3:  Core types
          - src/compiler/sceneTypes.ts    (SceneTimeline ref, SceneDefinition, SceneFrameContext,
                                           SceneGroup — no LogoRotationRuntime, no ResourceRegistry)
          - src/compiler/sceneTrackTypes.ts  (SceneFrame with widgets only, SceneTrackTick
                                              with widgetExtras, SceneFrameDelta)
          - src/compiler/sceneDslTypes.ts (CompileApi with setWidgetState only — no setLighting etc.)
          └─ Depends on: Phase 1, 2

── COMPILER ──────────────────────────────────────────────────────────────────

Phase 4:  Compiler infrastructure
          - src/compiler/registry.ts          (nodeRegistry — unchanged logic)
          - src/compiler/sceneDefaults.ts     (createBaseSceneState uses WidgetRegistry for defaults)
          - src/compiler/sceneUtils.ts        (applySceneTransitions — unchanged logic, updated types)
          - src/compiler/annotationCompiler.ts (unchanged logic, updated types)
          - src/compiler/labelCompiler.ts      (NEW: compileLabels)
          - src/compiler/sceneTrackSampler.ts  (unchanged logic)
          └─ Depends on: Phase 2, 3

Phase 5:  Generic compiler
          - src/compiler/sceneDslCompiler.ts  (resolveSceneFromDsl — updated CompileApi)
          - src/compiler/sceneTrackCompiler.ts (generic tick-baking: widget loop,
                                                compileExtra dispatch, no element specifics)
          - src/compiler/sceneTrackCache.ts   (widget-registry-aware cache key)
          - src/compiler/index.ts             (DSL-only public surface)
          └─ Depends on: Phase 3, 4

── RUNTIME ──────────────────────────────────────────────────────────────────

Phase 6:  Runtime infrastructure
          - src/runtime/types.ts       (World, Node, Model, AnimationPlayer, MotionSystem)
          - src/runtime/RuntimeLoop.ts (copy — unchanged logic)
          - src/runtime/mocks/         (copy interface-conforming test doubles)
          └─ Depends on: Phase 1

Phase 7:  Generic RuntimeDriver
          - src/runtime/RuntimeDriver.ts  (controller tick loop in priority order,
                                           ILoadable init protocol, generic widget render loop,
                                           SceneMetaWidget events, onSceneChange callback)
          └─ Depends on: Phase 2, 5, 6

── BUILT-IN ELEMENTS (first-party widgets) ─────────────────────────────────

Phase 8:  Manifest schema v2
          - src/elements/model/metadata.ts  (AssetManifest v2: models[], containedModels[],
                                             animations[], no robot/brain named fields)
          └─ Depends on: Phase 0

Phase 9:  Simple built-in widgets (no GLB loading, no complex DSL children)
          - src/elements/lighting/   (LightingWidget: IDslComposite for Ambient/Spot/etc.)
          - src/elements/background/ (BackgroundWidget)
          - src/elements/environment/(EnvironmentWidget: ILoadable for HDRI)
          - src/elements/floor/      (FloorWidget)
          All: existing compile.ts transition specs copied, render.ts logic moved to apply()
          └─ Depends on: Phase 2, 3, 8

Phase 10: ModelWidget
          - src/elements/model/types.ts     (SceneModelInstanceState — all Robot* names removed:
                                             AxisRotation, MotionCommand, ModelPose, PoseGroup, etc.)
          - src/elements/model/compile.ts   (modelTransitionSpec, compileAnimation — unchanged logic)
          - src/elements/model/ModelRenderer.ts  (all broken imports removed, all fallback
                                                  bone-resolution code removed, manifest required)
          - src/elements/model/ModelWidget.ts    (ISceneElement+IRenderable+ILoadable+IDslComposite,
                                                  compileExtra → compileAnimation,
                                                  load() → GLB load via manifest)
          └─ Depends on: Phase 2, 3, 6, 8

── LABELS, ANNOTATIONS, PLAYER ─────────────────────────────────────────────

Phase 11: Labels element
          - src/labels/types.ts    (LabelDefinition, LabelStyle, LabelResolved)
          - src/labels/dsl.tsx     (Label, Labels — register node handlers)
          - src/labels/compile.ts  (label transition spec: opacity blend)
          - src/labels/render.ts   (canvas overlay — excluded from coverage)
          └─ Depends on: Phase 3, 4

Phase 12: Annotations simplification
          - src/annotations/annotationTypes.ts  (AnnotationPlacement replaces mode union,
                                                  no annotationNormalized.ts)
          - src/annotations/annotationDefaults.ts (neutral defaults, no site fonts/colors)
          - src/annotations/ (remaining files: layout, lineMath, targets, fonts — copy/update)
          └─ Depends on: Phase 3

Phase 13: Consumer-facing built-in annotation blocks
          - src/compiler/blocks/annotationBlocks.tsx  (MessageAnnotation only — no brand colors,
                                                        no font, no BrainLabelAnnotations,
                                                        no LogoAnnotation)
          └─ Depends on: Phase 12

Phase 14: createDefaultWidgetRegistry + SceneMetaWidget
          - src/player/defaultWidgets.ts   (reads models from manifest directly, no separate
                                             models[] config; registers SceneMetaWidget)
          - src/player/SceneMetaWidget.ts  (IAnimationController: publishes scene.id,
                                             scene.index, scene.progress; fires onSceneChange)
          └─ Depends on: Phase 2, 7, 9, 10

Phase 15: ScenePlayer + consumer hooks
          - src/player/ContentSlotContext.ts  (contentId slot system)
          - src/player/useSceneProgress.ts    (live progress for consumer React components)
          - src/player/useCurrentScene.ts     (live scene id/index)
          - src/player/EngineScrollRegion.tsx (canvas mounting, Three.js renderer ownership)
          - src/player/useEngineScroll.ts     (scroll → progress mapping)
          - src/player/useEngineScrubber.ts
          - src/player/useSceneEngine.ts      (revised: takes sceneGroup+widgetRegistry,
                                               manages compilation and driver internally)
          - src/player/ScenePlayer.tsx        (manifest fetch, WidgetRegistry lifecycle,
                                               VariableStoreContext, ContentSlotContext,
                                               onSceneChange, placeholder prop, SSR guard)
          - src/player/index.ts
          └─ Depends on: Phase 7, 14, 11, 12

── SCRIPTS ──────────────────────────────────────────────────────────────────

Phase 16: Script unification
          - scripts/gen-scene-dsl.mjs: add --manifest-out flag
            Generates: sceneResources.generated.ts + sceneDsl.generated.tsx + scene-manifest.json
            Anchor key resolution heuristic (exact → substring → pattern)
          - scripts/prune-dist.mjs: remove brain/FBX hardcoding
          - package.json: update gen:scene-dsl script, remove extract-metadata
          └─ Depends on: Phase 8

── CONSUMER WIDGETS (examples) ──────────────────────────────────────────────

Phase 17: Example consumer widgets
          - examples/widgets/ribbon/       (RibbonWidget: ISceneElement+IRenderable;
                                            ported from src/legacy/elements/ribbon/)
          - examples/widgets/logo-rotator/ (LogoRotatorWidget: IAnimationController+IVariableProvider;
                                            ported from src/legacy/logoRotator/)
          - examples/widgets/brain-model/  (BrainModelWidget: IContainedModel+IDslComposite+ILoadable;
                                            ported from src/legacy/elements/model/brainModel/)
          └─ Depends on: Phase 2, 10, 15

── ACCEPTANCE ───────────────────────────────────────────────────────────────

Phase 18: examples/simple/ end-to-end
          - Update sceneResources.ts to new format (anchorKeys, containedModels: [])
          - Write widgetSetup.ts using createDefaultWidgetRegistry(manifest)
          - Update scene files (no isLightScene, no ribbon, Labels instead of world annotations)
          - Write ExamplePage.tsx using <ScenePlayer>
          - Run gen-scene-dsl --manifest-out to generate manifest
          - Verify pnpm build produces a working dist
          └─ Depends on: all phases

Phase 19: Tests
          - Write tests for each new module alongside its phase (not after)
          - Verify pnpm test passes green
          - Verify pnpm coverage meets targets
          - Delete src/legacy/ once all acceptance criteria pass
          └─ Continuous: written per-phase, final verification after Phase 18
```

---

## Public API Surface

### `src/robot/engine/index.ts`
```typescript
export { ScenePlayer } from './ScenePlayer';
export type { ScenePlayerProps } from './ScenePlayer';
export { useSceneEngine } from './useSceneEngine';
export { useEngineScroll } from './useEngineScroll';
export { EngineScrollRegion } from './EngineScrollRegion';
export { useEngineScrubber } from './useEngineScrubber';
export { createDefaultWidgetRegistry } from './defaultWidgets';
export type { DefaultWidgetConfig } from './defaultWidgets';
```

### `src/robot/widget/index.ts`
```typescript
export type {
  IWidget, ISceneElement, IRenderable, IContainedModel, ILoadable,
  IAnimationController, IVariableProvider,
  CompileExtraContext, WidgetInitContext, WidgetRenderContext, AnimationTickContext,
} from './types';
export { WidgetRegistry } from './WidgetRegistry';
export { VariableStore } from './VariableStore';
export { useVariable } from './useVariable';
```

### `src/robot/runtime/compiler/index.ts` (DSL authoring surface)
Unchanged API — still exports scene DSL primitives. The built-in DSL components
(`Lighting`, `Model`, `Background`, etc.) are still exported here, sourced from
their widget's `DslComponent`. The consumer imports them for use in scene files.
The compiler index remains DSL-only; no infrastructure types.

---

## Acceptance Criteria

Complete when all of the following are true:

**Build and tests:**
1. `pnpm typecheck` passes with zero errors on `src/` (legacy excluded)
2. `pnpm test` passes with all tests green
3. `pnpm build` produces a working dist that renders in a browser

**No site-specific content in `src/`:**
4. `src/` contains zero references to: `Robot` (as a prefix), `ribbon`, `brain`, `Brain`,
   `particle`, `logoRotator`, `local.brewblast.ai`, `#b344ef`, `General Sans`,
   `components/logoParticleOptimizedViewer`, `sceneResources.generated`,
   `LogoRotationRuntime`, `MODEL_BONE_NAME_MAP`, `buildNameCandidates`, `isLightScene`

**Generic types:**
5. `SceneFrame` has no typed element fields — only `widgets: Record<string, unknown>`,
   `annotations`, `labels`, and the `id`/`scrollProgress` scalars
6. `SceneTimeline` contains no reference to "robot" anywhere in its type or file names
7. All motion/pose types use generic names: `AxisRotation`, `MotionCommand`, `ModelPose`, etc.

**Generic compiler:**
8. `src/compiler/sceneTrackCompiler.ts` imports zero element-specific modules
   (no `compileAnimation`, no `SceneLighting`, no `SceneModel`, no clip-specific code)
9. `prefersReducedMotion` does not appear in `CompileSceneTrackOptions` — only in `CompileExtraContext`

**Generic runtime:**
10. `RuntimeDriver.apply()` iterates the widget registry generically — no element-specific render calls
11. Animation controllers are ticked in `tickPriority` order before any renderer runs
12. `AnimationTickContext` includes `tick: SceneTrackTick | null` for scene-state-aware controllers

**Widget SDK completeness:**
13. A new scene element (fog, volumetric light, custom shader effect) can be added by:
    - Writing a widget class implementing `ISceneElement + IRenderable`
    - Calling `widgetRegistry.register(new FogWidget())`
    - Zero changes to `src/compiler/`, `src/runtime/`, or `src/player/`
14. A new animation controller + variable provider can publish variables readable by
    consumer React components via `useVariable()` — zero engine changes required
15. `IDslComposite` child component protection is automatic: registering a widget
    that implements `IDslComposite` causes `WidgetRegistry` to install error-throwing
    top-level handlers for all declared child components

**Consumer API:**
16. `createDefaultWidgetRegistry(manifest)` registers one `ModelWidget` per model in
    `manifest.models[]` — no separate model ID declaration required from the consumer
17. `<ScenePlayer>` renders a `placeholder` on the server and the Three.js scene in the browser
18. `useSceneProgress()`, `useCurrentScene()`, and `useVariable()` are available to any
    React component inside `<ScenePlayer>` without prop drilling
19. `onSceneChange` fires exactly once per scene boundary crossing (not per tick)
20. Annotation `contentId` references resolve from `ScenePlayer.contentSlots` prop

**Scripts:**
21. `gen-scene-dsl.mjs --manifest-out` generates a valid v2 `AssetManifest` JSON
    from any `sceneResources.ts` with no hardcoded model names in the script

**End-to-end:**
22. `examples/simple/` demonstrates the complete consumer journey from
    `sceneResources.ts` → `<ScenePlayer>` with zero references to `src/legacy/`
23. `src/legacy/` can be deleted and `pnpm typecheck` still passes

---

## Appendix A: Gap Fixes and Missing Specifications

This section resolves gaps identified during plan review. Treat these as authoritative
overrides/additions to the sections above.

---

### A-1: `SceneDefinition.getFrame` Return Type

**Clarification (GAP-4):** The current legacy `SceneDefinition.getFrame` has a misleading
TypeScript return type of `SceneFrameState` (a plain object), but scene files have ALWAYS
returned JSX in practice — `resolveSceneFromDsl` begins with `if (!isValidElement(tree))`.
The new type simply corrects this to match reality:

```typescript
// src/compiler/sceneTypes.ts
export type SceneDefinition = {
  id: string;
  index: number;
  meta?: Record<string, JsonPrimitive>;
  entryLead?: number;
  entryStart?: number;
  /**
   * Returns JSX describing the scene's element state.
   * Must return a <Scene> root element.
   * ALREADY RETURNS JSX in all legacy scene files — this is a type correction only.
   * No scene file content changes are required.
   */
  getFrame: (context: SceneFrameContext) => React.ReactNode;
  transitions?: SceneTransition[];
};
```

---

### A-2: `createBaseSceneState` Specification

**New function (GAP-3):** File `src/compiler/sceneDefaults.ts`

```typescript
/**
 * Creates a blank SceneFrame with all registered ISceneElement widget states
 * set to their defaultState. Called at the start of each tick-baking iteration.
 *
 * @param widgetRegistry  The registry of all registered widgets.
 * @param context         The SceneFrameContext for this tick (used for id/scrollProgress).
 */
export const createBaseSceneState = (
  widgetRegistry: WidgetRegistry,
  context: SceneFrameContext,
): SceneFrame => {
  const widgets: Record<string, unknown> = {};
  for (const element of widgetRegistry.getSceneElements()) {
    // structuredClone is safe because ISceneElement.defaultState must be serializable.
    // If a widget's defaultState contains non-serializable values, it is a bug in that widget.
    widgets[element.widgetId] = structuredClone(element.defaultState as object);
  }
  return {
    id: 'scene',
    scrollProgress: context.sceneProgress,
    widgets,
    annotations: [],
    labels: [],
  };
};
```

---

### A-3: Multiple `ModelWidget` Instances — `WidgetRegistry` Dispatch Handler

**Critical fix (GAP-6):** When multiple `ModelWidget` instances are registered (e.g.,
`primary` and `secondary`), they share the same `Model` DSL component. Only ONE handler
can be registered per DSL component in the `nodeRegistry`. The solution:

**`ModelWidget` constructors must NOT register their own handler.** Instead,
`WidgetRegistry.register()` manages a single routing handler that dispatches to the
correct `ModelWidget` by the `id` prop:

```typescript
// src/widget/WidgetRegistry.ts

register(widget: IWidget): this {
  this.widgets.set(widget.widgetId, widget);

  if (isSceneElement(widget)) {
    if (!nodeRegistry.has(widget.DslComponent)) {
      // First widget with this DslComponent — install the routing handler
      const registry = this;
      registerNode(widget.DslComponent, (node, api, helpers) => {
        const props = node.props as Record<string, unknown>;
        // Route by 'id' prop (matches widgetId). Falls back to widgetId if no 'id' prop.
        const targetId = typeof props['id'] === 'string' ? props['id'] : undefined;

        const target = targetId
          ? registry.get(targetId)
          : Array.from(registry.widgets.values()).find(
              (w) => isSceneElement(w) && (w as ISceneElement<unknown>).DslComponent === widget.DslComponent,
            );

        if (!target || !isSceneElement(target)) {
          console.warn(`[WidgetRegistry] No widget found for DSL component with id="${targetId ?? 'unset'}"`);
          return;
        }

        // Widgets with complex DSL register a symbol-keyed custom handler on themselves
        const customHandler = (target as Record<symbol, NodeHandler | undefined>)[CUSTOM_NODE_HANDLER];
        if (customHandler) {
          customHandler(node, api, helpers);
        } else {
          // Default: merge defaultState with props, set widget state
          api.setWidgetState(target.widgetId, { ...target.defaultState, ...props });
        }
      });
    }
    // else: routing handler already installed for this DslComponent
  }

  if (isDslComposite(widget)) {
    for (const { component, displayName, topLevelError } of widget.childDslComponents) {
      if (nodeRegistry.has(component)) continue;
      if (topLevelError) {
        registerNode(component, () => {
          throw new Error(`<${displayName}> must be used inside <${widget.DslComponent.displayName ?? widget.widgetId}>.`);
        });
      } else {
        registerNode(component, () => {});
      }
    }
  }

  return this;
}
```

**File:** `src/widget/WidgetRegistry.ts` — add at top:
```typescript
// Symbol used by widgets to register a custom node handler for complex DSL
export const CUSTOM_NODE_HANDLER = Symbol('customNodeHandler');
```

**In `ModelWidget.ts` constructor** — instead of calling `registerNode()` directly:
```typescript
constructor(config: ModelWidgetConfig) {
  this.widgetId = config.id;
  // Register custom handler on self via the symbol key
  (this as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
    const state = compileModelFromDsl(node, api, helpers, this.widgetId);
    api.setWidgetState(this.widgetId, state);
  };
}
```

Similarly for `LightingWidget`, which also uses a custom handler:
```typescript
(this as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = (node, api, helpers) => {
  const state = compileLightingFromDsl(node, api, helpers);
  api.setWidgetState(this.widgetId, state);
};
```

---

### A-4: `SceneMetaWidget` Complete Specification

**Missing spec (GAP-7):** File: `src/player/SceneMetaWidget.ts`

```typescript
// SceneMetaWidget: built-in IAnimationController that publishes scene identity
// and scene.meta fields to the VariableStore. Also fires onSceneChange callback.

export class SceneMetaWidget implements IAnimationController {
  readonly widgetId = '__scene_meta__';
  readonly tickPriority = -1000; // Run first among all controllers

  private lastSceneId: string | null = null;
  private onSceneChange?: (sceneId: string, sceneIndex: number) => void;

  constructor(options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void }) {
    this.onSceneChange = options?.onSceneChange;
  }

  onTick({ variables, tick }: AnimationTickContext): void {
    if (!tick) return;

    const sceneId = tick.sceneId;
    const sceneIndex = tick.sceneIndex;
    const sceneProgress = tick.sceneProgress;

    // Publish core scene identity
    variables.set('scene', 'id', sceneId);
    variables.set('scene', 'index', sceneIndex);
    variables.set('scene', 'progress', sceneProgress);

    // Fire onSceneChange exactly once per scene boundary crossing
    if (sceneId !== this.lastSceneId) {
      this.lastSceneId = sceneId;
      this.onSceneChange?.(sceneId, sceneIndex);
    }
  }
}
```

`createDefaultWidgetRegistry` constructs `SceneMetaWidget` with the `onSceneChange`
callback from `ScenePlayer`:

```typescript
export const createDefaultWidgetRegistry = (
  manifest: AssetManifest | null,
  options?: { onSceneChange?: (sceneId: string, sceneIndex: number) => void },
): WidgetRegistry => {
  const registry = new WidgetRegistry();
  // ... model, lighting, etc. registrations ...
  registry.register(new SceneMetaWidget({ onSceneChange: options?.onSceneChange }));
  return registry;
};
```

And `ScenePlayer` passes the callback:
```typescript
const widgetRegistry = useMemo(
  () => props.widgetSetup(manifest, { onSceneChange: props.onSceneChange }),
  [manifest, props.widgetSetup, props.onSceneChange],
);
```

---

### A-5: `EngineFrameDriver` in the New Architecture

**Missing (GAP-8):** `EngineFrameDriver` from the legacy codebase is preserved in the
new architecture. It lives at `src/player/EngineFrameDriver.ts` (copied unchanged from
`src/legacy/engine/EngineFrameDriver.ts`).

Its role: Detects when the compiled frame index changes (not every RAF tick) and notifies
`onScrollFrameChange`. This keeps React re-renders cheap — React state only updates when
the scene track tick index changes, not on every animation frame.

In `useSceneEngine`:
- `EngineFrameDriver` is created in a `useEffect` keyed on `sceneSampler`
- It is called from `RuntimeLoop.onAfterTick` callback
- It calls `setFrameState(newFrameState)` only when `tick.index` changes

Add `EngineFrameDriver.ts` to Phase 15 alongside the other player files.
The type it emits, `EngineFrameState`, also moves to `src/player/engineTypes.ts`.

---

### A-6: `getBoneWorldPositions()` Implementation Path

**Missing (GAP-9):** `RuntimeDriver.getBoneWorldPositions()` aggregates bone world
positions from all loaded `ModelWidget` instances.

`ModelWidget` exposes an internal method:
```typescript
// Inside ModelWidget (not part of IRenderable interface — internal to RuntimeDriver)
getBoneWorldPositions(): Map<string, [number, number, number]> {
  return this.renderer?.getBoneWorldPositions() ?? new Map();
}
```

`ModelRenderer.getBoneWorldPositions()` iterates the Three.js scene graph for all
bones in the loaded model and returns their world positions:
```typescript
getBoneWorldPositions(): Map<string, [number, number, number]> {
  const result = new Map<string, [number, number, number]>();
  this.threeGroup?.traverse((obj) => {
    if (obj.isBone || obj.type === 'Bone') {
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      result.set(obj.name, [wp.x, wp.y, wp.z]);
    }
  });
  return result;
}
```

`RuntimeDriverImpl.getBoneWorldPositions()` merges from all `IRenderable` widgets
that have a `getBoneWorldPositions()` method:
```typescript
getBoneWorldPositions(): Map<string, [number, number, number]> {
  const result = new Map<string, [number, number, number]>();
  for (const renderable of this.widgetRegistry.getRenderables()) {
    if ('getBoneWorldPositions' in renderable && typeof renderable.getBoneWorldPositions === 'function') {
      const positions = (renderable as { getBoneWorldPositions(): Map<string, [number, number, number]> }).getBoneWorldPositions();
      for (const [key, val] of positions) result.set(key, val);
    }
  }
  return result;
}
```

This is called AFTER `THREE.WebGLRenderer.render()` (when world matrices are current)
and passed to `AnnotationPositioner.update()`.

---

### A-7: `IContainedModel` Anchor Resolution Lifecycle

**Missing (GAP-10):** The sequence for attaching a contained model widget to a primary
model's bone:

```
1. WidgetRegistry.register(new BrainModelWidget())
   → BrainModelWidget declares: anchorModelId='primary', anchorKey='head'

2. RuntimeDriverImpl.initialize()
   → Calls initialize({ scene }) for all IRenderables including BrainModelWidget
   → BrainModelWidget creates its Three.js group (placeholder, not yet loaded)

3. ILoadable.load(manifest) for all loadables
   → ModelWidget('primary').load(manifest) → loads robot GLB, populates Three.js scene
   → BrainModelWidget.load(manifest) → loads brain GLB, populates its group

4. RuntimeDriverImpl — after all ILoadables complete:
   for each IContainedModel widget:
     primaryWidget = registry.get(containedModel.anchorModelId) as ModelWidget
     anchorBoneName = primaryWidget.getAnchorBoneName(containedModel.anchorKey)
     // getAnchorBoneName() looks up manifest.anchorTargets[key]
     anchorNode = primaryWidget.renderer.findBoneNode(anchorBoneName)
     if (anchorNode) anchorNode.add(containedModel.threeGroup)
     else console.warn(`[RuntimeDriver] Anchor bone "${anchorBoneName}" not found`)

5. Per-frame: BrainModelWidget.apply(state, ctx) updates its group's properties
   (opacity, subpart visibility, etc.) — the Three.js parent-child relationship
   means the group automatically follows the anchor bone's world transform.
```

`ModelWidget` must expose:
```typescript
getAnchorBoneName(anchorKey: string): string | undefined {
  return this.config.modelMeta?.anchorTargets[anchorKey];
}
findBoneNode(boneName: string): THREE.Object3D | undefined {
  return this.renderer?.findNodeByName(boneName) ?? undefined;
}
```

---

### A-8: Generic `computeDelta` Algorithm

**Missing (GAP-13):** The delta between two `SceneFrame` instances for scrubbing
optimization. File: `src/compiler/sceneTrackCompiler.ts` (internal helper).

```typescript
const computeSceneFrameDelta = (
  from: SceneFrame,
  to: SceneFrame | undefined,
): SceneFrameDelta => {
  if (!to) return {};
  const delta: SceneFrameDelta = {};

  // Widget state deltas: include any widget where the state changed
  // Use JSON.stringify for structural equality (widget states must be serializable)
  const widgetDelta: Record<string, unknown> = {};
  const allWidgetIds = new Set([...Object.keys(from.widgets), ...Object.keys(to.widgets)]);
  for (const id of allWidgetIds) {
    const fromState = from.widgets[id];
    const toState = to.widgets[id];
    if (JSON.stringify(fromState) !== JSON.stringify(toState)) {
      widgetDelta[id] = toState;
    }
  }
  if (Object.keys(widgetDelta).length > 0) delta.widgets = widgetDelta;

  // Annotations delta
  if (JSON.stringify(from.annotations) !== JSON.stringify(to.annotations)) {
    delta.annotations = to.annotations;
  }

  // Labels delta
  if (JSON.stringify(from.labels) !== JSON.stringify(to.labels)) {
    delta.labels = to.labels;
  }

  return delta;
};
```

Performance note: JSON.stringify comparison is acceptable here because delta computation
happens at compile time, not at render time. The compiled track is cached.

---

### A-9: `AnnotationResolved` Type — New Location

**Import fix (GAP-14):** `annotationNormalized.ts` is deleted. `AnnotationResolved` is
redefined directly in `src/annotations/annotationTypes.ts`:

```typescript
// src/annotations/annotationTypes.ts

/**
 * A fully compiled annotation, ready for the overlay renderer.
 * Produced by compileAnnotations() during the tick-baking pass.
 * All optional fields from AnnotationDefinition are resolved to their final values.
 */
export type AnnotationResolved = {
  id: string;
  enabled: boolean;
  placement: AnnotationPlacement;
  content?: { node: React.ReactNode } | { contentId: string };
  style: AnnotationStyle; // fully resolved, no Partial<>
};
```

`SceneTrackTick.annotationPrimitives` imports `AnnotationResolved` from
`src/annotations/annotationTypes.ts` directly — no normalization layer.

---

### A-10: `compileLightingFromDsl` Function Specification

**Missing (GAP-15):** This is the extracted DSL handler logic for `LightingWidget`.
File: `src/elements/lighting/compile.ts` (alongside the transition spec).

```typescript
// Extracted from legacy elements/lighting/dsl.tsx registerNode(Lighting, ...) handler
export const compileLightingFromDsl = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
): SceneLighting => {
  const props = node.props as LightingProps;
  const children = helpers.collectChildren(node);

  const ambient: AmbientProps[] = [];
  const directionals: DirectionalProps[] = [];
  const points: PointProps[] = [];
  const spots: SpotProps[] = [];
  const panels: PanelProps[] = [];

  for (const child of children) {
    if (!isValidElement(child)) continue;
    const childEl = child as ReactElement;
    if (childEl.type === Ambient) ambient.push(helpers.resolveObjectValues(childEl.props as AmbientProps, api.context));
    if (childEl.type === Directional) directionals.push(helpers.resolveObjectValues(childEl.props as DirectionalProps, api.context));
    if (childEl.type === Point) points.push(helpers.resolveObjectValues(childEl.props as PointProps, api.context));
    if (childEl.type === Spot) spots.push(helpers.resolveObjectValues(childEl.props as SpotProps, api.context));
    if (childEl.type === Panel) panels.push(helpers.resolveObjectValues(childEl.props as PanelProps, api.context));
  }

  const base = api.state.widgets['lighting'] as SceneLighting ?? DEFAULT_LIGHTING;
  return {
    ...base,
    ambient: ambient[0] ?? { intensity: 0, color: base.ambient.color },
    directional: directionals[0] ?? { ...base.directional, intensity: 0 },
    points: points.length > 0 ? points : [],
    spots: spots.length > 0 ? spots : [],
    panels: panels.length > 0 ? panels : [],
    intensityScale: props.intensityScale ?? base.intensityScale,
    color: props.color ?? base.color,
  };
};
```

---

### A-11: `animationTrackMapping.ts` Disposition

**Missing (GAP-18):** `src/legacy/runtime/animationTrackMapping.ts` contains:
1. `resolveTrackTargetName(trackName)` — extracts bone name from GLTF track name format (e.g., `".bones[mixamorig:Head].quaternion"` → `"mixamorig:Head"`)
2. `mapTrackTargetName(rawTarget)` — maps standard bone names to model-specific names
3. `filterAndRenameTrack(trackName, targetNodeNames, boneNames)` — filters animation tracks to only those targeting bones in the loaded model

In the new architecture:
- `resolveTrackTargetName` and `filterAndRenameTrack` are **pure utility functions with no site-specific dependencies** — the GLTF track name format is a Three.js standard
- `mapTrackTargetName` uses `STANDARD_TO_MODEL_BONE_NAME` and `MODEL_BONE_NAME_MAP` from the deleted `components/logoParticleOptimizedViewer/` path — **this is the broken import**

**New location:** `src/elements/model/animationTrackMapping.ts`

**Fix:** `mapTrackTargetName` is simplified — the name mapping table is gone (bone names in GLTF files are already correct when loaded via `GLTFLoader`). The function becomes a passthrough:

```typescript
// src/elements/model/animationTrackMapping.ts
// Pure utilities for mapping GLTF AnimationClip track names to scene graph node names.

const BONE_TRACK_PATTERN = /\.bones\[([^\]]+)\]\./;

export const resolveTrackTargetName = (trackName: string): string | null => {
  const boneMatch = trackName.match(BONE_TRACK_PATTERN);
  if (boneMatch) return boneMatch[1] ?? null;
  const dot = trackName.indexOf('.');
  if (dot <= 0) return null;
  return trackName.slice(0, dot) || null;
};

// mapTrackTargetName: in the new architecture, bone names are already in the model's
// native format (Mixamo, CC_Base, etc.) and do not need remapping.
// If a consumer needs custom remapping, they can wrap this function.
export const mapTrackTargetName = (rawTarget: string): string => rawTarget;

export const filterAndRenameTrack = (
  trackName: string,
  targetNodeNames: Set<string>,
  boneNames?: Set<string>,
): { allowed: boolean; name: string } => {
  const rawTarget = resolveTrackTargetName(trackName);
  if (!rawTarget) return { allowed: true, name: trackName };
  const mapped = mapTrackTargetName(rawTarget);
  const allowed = targetNodeNames.has(mapped) || (boneNames?.has(mapped) ?? false);
  const renamedTrack = trackName.replace(rawTarget, mapped);
  return { allowed, name: renamedTrack };
};
```

---

### A-12: `useSceneEngine` New Signature

**Missing (GAP-20):** File: `src/player/useSceneEngine.ts`

The new hook manages the full engine lifecycle internally (compilation, driver, loop).
Consumer-facing; does not require passing internals like `sceneTrack` or `driver`.

```typescript
export type UseSceneEngineOptions = {
  sceneGroup: SceneGroup;
  widgetRegistry: WidgetRegistry;
  clipMeta: ClipMeta[];
  fpsCap?: number;
  pixelsPerScene?: number;
  onReady?: () => void;
};

export type UseSceneEngineResult = {
  /** Updated when scroll crosses a compiled frame boundary. */
  frameState: EngineFrameState;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  scrollRegionHeightPx: number;
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  variableStore: VariableStore;
};

export const useSceneEngine = (options: UseSceneEngineOptions): UseSceneEngineResult => {
  // Internally manages:
  // - SceneCompiler (recompiles when widgetRegistry, clipMeta, or assetsReady changes)
  // - RuntimeDriverImpl (created once, receives new SceneTrack via setSceneTrack())
  // - RuntimeLoop (started when driver is ready, stopped on unmount)
  // - EngineFrameDriver (frame-change detection → setFrameState)
  // - VariableStore (single instance per hook invocation)
  // - Asset loading (calls widgetRegistry.getLoadables().load(manifest))
  // Returns stable VariableStore for VariableStoreContext.Provider
  ...
};
```

---

### A-13: `examples/simple/` Files Specification

**Missing (GAP-17):** The minimum viable example consumer.

```
examples/simple/
├── sceneResources.ts          ← resource definitions (models, animations, anchorKeys)
│   export const sceneResources = {
│     models: [{ id: 'primary', role: 'primary', path: '/assets/robot.no-normals.glb', anchorKeys: ['head', 'chest'] }],
│     containedModels: [],
│     animations: [{ id: 'chat-relax-f', path: '/assets/motion/ChatRelaxF/chat-relax-f.glb' }],
│   } as const;
│
├── widgetSetup.ts             ← widget registry factory; import and call in ScenePlayer
│   export const createWidgetSetup = (manifest: AssetManifest | null) =>
│     createDefaultWidgetRegistry(manifest);
│
├── scenes/
│   ├── customAnimations.ts    ← BreathingControllerWidget + BlinkingControllerWidget
│   │   (IAnimationController; reads tick.state.widgets['primary'] for enabled flag)
│   │
│   ├── sceneMotion.ts         ← helper functions for motion commands (pure data)
│   │
│   ├── scene01_intro.tsx      ← SceneDefinition: id='intro', index=0
│   │   Uses: <PrimaryModel>, <Lighting><Ambient/><Spot/></Lighting>, <Annotations>
│   │   No ribbon, no brain, no isLightScene
│   │
│   ├── scene02_model.tsx      ← SceneDefinition: id='model', index=1
│   │   Uses: <PrimaryModel> with BodyParts, <Labels>, <Annotations>
│   │   World-space labels replace the old world-mode annotations
│   │
│   └── sceneGroup.ts          ← assembles SceneGroup
│       export const coreMessageSceneGroup: SceneGroup = {
│         id: 'core-message',
│         scenes: [scene01, scene02],
│         timeline: createSceneTimeline([scene01, scene02], { framesPerScene: 30 }),
│       };
│
└── pages/
    └── ExamplePage.tsx        ← single-file consumer demo
        export default function ExamplePage() {
          return (
            <ScenePlayer
              sceneGroup={coreMessageSceneGroup}
              manifestUrl="/assets/scene-manifest.json"
              widgetSetup={(manifest) => createWidgetSetup(manifest)}
            />
          );
        }
```

---

### A-14: `tsconfig.json` and `vite.config.ts` Changes

**GAP-22/23:** Exact changes required.

**`tsconfig.json`** — change `include` from `["src"]` to explicitly exclude legacy:
```json
{
  "include": ["src", "examples"],
  "exclude": ["src/legacy", "node_modules", "dist"]
}
```

**`vite.config.ts`** coverage targets (replace `src/robot/` prefix with `src/`):
```typescript
include: [
  'src/{compiler,runtime,elements,widget,labels,annotations,timeline,math,player}/**/*.ts',
],
exclude: [
  'src/**/render.ts',    // Three.js render files
  'src/**/*.test.ts',
  'src/**/index.ts',     // barrel exports
  'src/**/mocks/**',
  'src/legacy/**',
],
```

**`vite.config.ts`** `allowedHosts` — remove `local.brewblast.ai`:
```typescript
server: {
  port: 5173,
  host: true,
  // Removed: 'local.brewblast.ai'
},
```

---

### A-15: `createDefaultWidgetRegistry` — Single Definitive Version

**Inconsistency fix (GAP-19):** The single definitive API (overrides all earlier versions):

```typescript
// src/player/defaultWidgets.ts

export const createDefaultWidgetRegistry = (
  manifest: AssetManifest | null,
  options?: {
    onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  },
): WidgetRegistry => {
  const registry = new WidgetRegistry();
  const clipMeta = manifest ? clipMetaFromManifest(manifest) : [];

  // One ModelWidget per model in manifest — no separate model list needed
  for (const modelMeta of manifest?.models ?? []) {
    registry.register(new ModelWidget({ modelMeta, clipMeta }));
    // ModelWidget.widgetId = modelMeta.id
    // role field is not used at runtime — removed from ModelWidgetConfig
  }

  registry
    .register(new LightingWidget())
    .register(new BackgroundWidget())
    .register(new EnvironmentWidget())
    .register(new FloorWidget())
    .register(new SceneMetaWidget({ onSceneChange: options?.onSceneChange }));

  return registry;
};
```

`ModelWidgetConfig` (final version):
```typescript
export type ModelWidgetConfig = {
  modelMeta: ModelMeta | null; // null before manifest loads
  clipMeta: ClipMeta[];        // empty before manifest loads
  // role: removed — authoring hint only, not needed at runtime
};
// widgetId is derived from modelMeta.id (or a placeholder when modelMeta is null)
```

---

### A-16: `SceneTrackCache` Multi-Instance Strategy

**GAP-16:** The cache uses a module-level `Map` (a singleton). Multiple `ScenePlayer`
instances share it, which is correct — they benefit from shared compilation results.
`clearCache()` is NOT called on single-instance unmount. Instead:

```typescript
// src/compiler/sceneTrackCache.ts

// Module-level singleton — intentionally shared across all ScenePlayer instances
const trackCache = new Map<string, CacheEntry>();

// Called only on full page navigation (router-level unmount of all ScenePlayer instances)
// or explicitly by tests for isolation.
export const clearCache = (): void => { trackCache.clear(); };

// Cache entries are replaced (not accumulated) when keys collide.
// Cache size is bounded by the number of distinct (scenes, timeline, widget, quality) combinations.
// In practice: 2-4 entries per ScenePlayer (low/high quality tiers × assetsReady states).
// No eviction is needed for typical usage; call clearCache() in tests.
```

For test isolation: each test that compiles a scene track must call `clearCache()` in
`beforeEach`. This is already idiomatic in the legacy test suite.

---

### A-17: `blendStyleValues` Function

**Clarification (GAP-21):** `blendStyleValues` IS already defined in the legacy
`src/robot/runtime/compiler/transitions/transitionTypes.ts` (lines 134–153). It is
preserved in the new `src/compiler/transitions/transitionTypes.ts` unchanged. The
export list in IR-2 is correct — no new implementation needed.

---

### Summary of Changes Made

| Gap | Fix Applied |
|---|---|
| GAP-1 (file paths) | Added PATH CONVENTION note at top of document |
| GAP-2 (VariableStoreReader types) | Fixed inline to `JsonPrimitive \| undefined` |
| GAP-3 (createBaseSceneState) | Appendix A-2 |
| GAP-4 (getFrame return type) | Appendix A-1 |
| GAP-5 (resolveSceneFromDsl missing arg) | Fixed inline in compiler pseudocode |
| GAP-6 (multiple ModelWidget handlers) | Appendix A-3 |
| GAP-7 (AnimationTickContext missing tick) | Fixed inline in Part 1.1; Appendix A-4 |
| GAP-8 (EngineFrameDriver) | Appendix A-5 |
| GAP-9 (getBoneWorldPositions) | Appendix A-6 |
| GAP-10 (IContainedModel anchor resolution) | Appendix A-7 |
| GAP-11 (prefersReducedMotion contradiction) | Fixed inline in §4.3 |
| GAP-12 (SceneFrame canonical location) | Added to PATH CONVENTION note |
| GAP-13 (computeDelta algorithm) | Appendix A-8 |
| GAP-14 (AnnotationResolved location) | Appendix A-9 |
| GAP-15 (compileLightingFromDsl) | Appendix A-10 |
| GAP-16 (cache multi-instance) | Appendix A-16 |
| GAP-17 (examples/simple files) | Appendix A-13 |
| GAP-18 (animationTrackMapping) | Appendix A-11 |
| GAP-19 (createDefaultWidgetRegistry) | Appendix A-15 |
| GAP-20 (useSceneEngine signature) | Appendix A-12 |
| GAP-21 (blendStyleValues) | Appendix A-17 |
| GAP-22/23 (tsconfig/vite) | Appendix A-14 |
| GAP-24 (projectToScreen placeholder) | Acknowledged; implement from legacy `annotationLayout.ts` |
