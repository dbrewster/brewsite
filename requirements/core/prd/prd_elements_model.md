---
title: "BrewSite Core — Model Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-03
change_history:
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Initial PRD created. Comprehensive specification of the Model element covering state types, DSL surface, transition system, animation and motion systems, part overrides, widget interfaces, and asset manifest integration."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening update: replaced createDefaultWidgetRegistry() references with corePlugin() + modelPlugin() to reflect the plugin-based registration model."
---

# BrewSite Core — Model Element

## 1. Overview

The Model element is the primary 3D content primitive in `@brewsite/core`. It loads GLTF/GLB assets, positions them in world space, drives per-scene transform and material state, and manages animation clip playback through the Three.js `AnimationMixer`. It is the element authors interact with most when building scenes, and its API surface must be ergonomic for declarative authoring while remaining powerful enough to express complex multi-scene motion sequences.

The Model element lives entirely within `packages/core/src/elements/model/` and follows the mandatory module pattern: `types.ts → dsl.tsx → compile.ts → render.ts → ModelWidget.ts → index.ts`. Three.js is confined to `render.ts` and `ModelWidget.ts`. The compiler and type layers contain no Three.js imports.

---

## 2. Problem Statement

Toolkit consumers need a single, well-designed element to represent any GLTF/GLB 3D asset in a scene. Before a formal element API, authors had to wire up Three.js loaders, AnimationMixer, material traversal, and transform interpolation by hand inside widget subclasses. This produced per-project duplication, inconsistent transition quality, and no shared vocabulary for animation blend weights, part visibility overrides, or procedural motion commands.

The Model element consolidates all of this into a compiler-driven, declarative API. Authors describe what the model looks like in each scene; the compiler and widget handle the interpolation, animation crossfading, and material application at runtime. The author never writes a lerp or touches Three.js directly.

Evidence for priority: Model is used in every example scene in `apps/examples/`. It has the widest API surface of any core element and the most complex runtime behavior. Getting this API right reduces integration time for all toolkit consumers.

---

## 3. Goals & Success Metrics

**Primary metrics:**
- A new toolkit consumer can place and animate a GLTF model in a two-scene sequence in under 15 minutes using the README alone.
- TypeScript inference catches incorrect `Vec3` arity (wrong tuple length) at authoring time, not at runtime.
- Zero Three.js imports required in consumer scene files — all Three.js is encapsulated inside the element.
- Animation crossfade between two scenes produces visually correct blending with no T-pose flash.

**Guardrail metrics:**
- No regression to existing consumers using the `<Model>` DSL component or `SceneModelInstanceState` type.
- No increase in widget registration boilerplate compared to the current `corePlugin()` + `modelPlugin()` pattern.
- Model element tree-shakes cleanly — importing `<Camera>` alone does not pull in the GLTF loader.

---

## 4. Non-Goals

- The Model element does not implement inverse kinematics (IK). IK belongs in a consumer-defined widget that implements `IContainedModel`.
- The Model element does not parse or validate GLTF file contents at compile time. Asset integrity is an asset pipeline concern.
- Particle systems and procedural geometry are not part of the Model element. Those are separate elements.
- The Model element does not handle WebXR hand tracking, avatar retargeting, or physics simulation.
- Exporting animation data back to the host application is not in scope — the element is a playback consumer, not an animation authoring tool.
- Multi-instance instancing via `InstancedMesh` is not part of this element. It requires a separate `InstancedModel` element.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to place a GLTF model by declaring `<Model id="hero-bot" position={[0, 0, 0]} />` so that I can add 3D content to a scene without writing any Three.js.
- As a toolkit consumer, I want to declare different position and rotation values for the same model across two scenes so that the toolkit automatically interpolates the transform transition between them.
- As a toolkit consumer, I want to reference a named animation clip by `clipName` in a scene so that the model plays back that clip during that scene without me managing an AnimationMixer.
- As a toolkit consumer, I want to blend two animation clips together using `weight` so that I can create layered motion effects across scenes.
- As a toolkit consumer, I want to control the visibility and material color of individual sub-meshes using `parts` overrides so that I can show different model configurations across scenes.
- As a toolkit consumer, I want to declare a motion command sequence (axis-rotate, axis-translate, pose) in the DSL so that I can produce procedural additive motion without writing imperative Three.js code.
- As a toolkit consumer, I want to attach a secondary model to a named bone on a parent model using `anchorModelId` and `anchorKey` so that accessories follow the parent's skeleton automatically.
- As a toolkit consumer, I want full TypeScript inference on all model props so that typos in `clipName` or wrong-arity `Vec3` tuples are flagged at compile time.

---

## 6. Functional Requirements

1. The `<Model>` DSL component must accept an `id` prop that maps to an entry in the asset manifest. The `id` is required; the element cannot render without a valid manifest entry.
2. The `<Model>` DSL component must accept `position`, `rotation`, and `scale` as `Vec3` (3-tuple) props. Default values must be `[0,0,0]`, `[0,0,0]`, and `[1,1,1]` respectively.
3. The `<Model>` DSL component must accept `opacity` as a `number` between 0 and 1, defaulting to 1.
4. The `<Model>` DSL component must accept `enabled` as a `boolean` that shows or hides the model entirely, defaulting to `true`.
5. The `<Model>` DSL component must accept `metalness` and `roughness` as PBR material scalars (0–1) applied uniformly to all mesh materials on the model.
6. The compiler must produce a `SceneModelInstanceState` for every scene that contains a `<Model>` with a given `id`, merging explicit props with per-element defaults.
7. When the same model `id` appears in two consecutive scenes, the runtime must interpolate position (Vec3 lerp), rotation (quaternion slerp via `quatFromEuler`), scale (Vec3 lerp), and opacity (number lerp) between them.
8. When a model `id` is present in the current scene but absent in the prior scene, the runtime must apply an enter transition: fade in from opacity 0 using the compiled `fadeInSeconds` value.
9. When a model `id` is present in the current scene but absent in the next scene, the runtime must apply an exit transition: fade out to opacity 0 using the compiled `fadeOutSeconds` value.
10. The `playback.animation` field must support `clipName` selection, `weight` blending, `fadeInSeconds`/`fadeOutSeconds` crossfade, `timeScale` playback speed, and `loop` mode (`once`, `repeat`, `pingpong`).
11. The `playback.motion.commands` array must be evaluated each frame. Commands of type `axis-rotate` and `axis-translate` apply additive transforms on top of the compiled base transform. Commands of type `pose` activate a named pose group.
12. The `parts` array must allow per-mesh overrides for `visible`, `opacity`, `color`, `metalness`, `roughness`, `emissive`, and `emissiveIntensity`. Overrides are applied by matching the mesh name to `partId` using exact string equality.
13. The `IContainedModel` interface must allow a model widget to declare `anchorModelId` and `anchorKey`. The RuntimeDriver must wire up the bone attachment after all models have completed loading.
14. All exported types from the model element must be re-exported from the element's `index.ts` barrel. No internal type should require a deep import path by consumers.
15. The ModelWidget must register itself with the compiler via `CUSTOM_NODE_HANDLER` on its DSL component. No external registration call is required from the consumer.

---

## 7. API Design

### 7.1 Core State Types

```typescript
// packages/core/src/elements/model/types.ts

export type Vec3 = [number, number, number];

export interface SceneModel {
  scale?: Vec3;           // default [1, 1, 1]
  position?: Vec3;        // default [0, 0, 0]
  rotation?: Vec3;        // Euler angles in radians, XYZ order, default [0, 0, 0]
  opacity?: number;       // default 1.0, range 0–1
  metalness?: number;     // PBR metalness, range 0–1
  roughness?: number;     // PBR roughness, range 0–1
  enabled?: boolean;      // show/hide toggle, default true
}

export interface SceneAnimation {
  enabled?: boolean;
  clipName?: string;          // GLTF AnimationClip name (exact or partial match)
  gltfUrl?: string;           // override GLTF source URL for this animation clip
  fbxUrl?: string;            // FBX animation source URL
  weight?: number;            // blend weight, range 0–1, default 1.0
  fadeInSeconds?: number;     // crossfade in duration in seconds
  fadeOutSeconds?: number;    // crossfade out duration in seconds
  timeScale?: number;         // playback speed multiplier, default 1.0
  loop?: 'once' | 'repeat' | 'pingpong';
}

export type MotionCommandAxisRotate = {
  type: 'axis-rotate';
  axis: Vec3;
  angle: number;             // radians
  duration?: number;         // seconds; if omitted, instantaneous
};

export type MotionCommandAxisTranslate = {
  type: 'axis-translate';
  axis: Vec3;
  distance: number;          // world units
  duration?: number;
};

export type MotionCommandPose = {
  type: 'pose';
  poseGroup: string;         // named pose group identifier
  duration?: number;
};

export type MotionCommand =
  | MotionCommandAxisRotate
  | MotionCommandAxisTranslate
  | MotionCommandPose;

export interface MotionScene {
  sceneIndex: number;
  commands?: MotionCommand[];
  pose?: string;
}

export interface CustomAnimation {
  id: string;
  clips: string[];           // clip names to blend together
  weights?: number[];        // per-clip blend weights, must match clips.length if provided
  timeScale?: number;
}

export interface SceneMotion {
  commands?: MotionCommand[];
  scenes?: MotionScene[];              // per-scene motion state overrides
  customAnimations?: CustomAnimation[];
  pose?: string;                       // default active pose group
}

export interface ScenePlayback {
  motion: SceneMotion;
  animation: SceneAnimation;
}

export interface SceneModelInstanceState {
  model: SceneModel;
  playback: ScenePlayback;
}
```

### 7.2 Part Override Types

```typescript
// packages/core/src/elements/model/types.ts (continued)

export interface MaterialOverride {
  color?: string;                  // hex color string, e.g. '#ff0000'
  metalness?: number;
  roughness?: number;
  emissive?: string;               // hex color string
  emissiveIntensity?: number;      // range 0–1+
}

export interface ModelPartSpec {
  partId: string;                  // exact mesh name in GLTF scene graph
  visible?: boolean;
  opacity?: number;
  material?: Partial<MaterialOverride>;
}

export type BodyPartOverrideMap = Record<string, ModelPartSpec>;
```

### 7.3 DSL Component

```typescript
// packages/core/src/elements/model/dsl.tsx

export interface ModelProps {
  id: string;                              // required; matches asset manifest key
  type?: string;                           // widget type for factory routing; defaults to 'model'
  scale?: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  opacity?: number;
  enabled?: boolean;
  metalness?: number;
  roughness?: number;
  playback?: Partial<ScenePlayback>;
  motion?: Partial<SceneMotion>;          // shorthand; merged into playback.motion
  animation?: Partial<SceneAnimation>;    // shorthand; merged into playback.animation
  parts?: ModelPartSpec[];
  overrides?: BodyPartOverrideMap;        // alternative to parts array; keyed by partId
}

export declare function Model(props: ModelProps): null;
```

The `<Model>` component returns `null` at runtime — it is a pure compiler DSL node. Its props are consumed during the compilation pass by the registered node handler. Rendering occurs through the widget system, not through React.

### 7.4 Compiled State Merge Order

When both `animation` shorthand and `playback.animation` are present, the compiler merges them with `playback` taking precedence over the shorthand:

```typescript
const resolvedAnimation: SceneAnimation = {
  ...defaultSceneAnimation,
  ...props.animation,
  ...props.playback?.animation,
};

const resolvedMotion: SceneMotion = {
  ...defaultSceneMotion,
  ...props.motion,
  ...props.playback?.motion,
};
```

This allows authors to use the shorthand props for common cases without losing the option to express full `ScenePlayback` when needed.

### 7.5 Transition Helpers

```typescript
// packages/core/src/elements/model/compile.ts

export function applyModelEnter(
  state: SceneModelInstanceState,
  tickProgress: number
): SceneModelInstanceState;

export function applyModelExit(
  state: SceneModelInstanceState,
  tickProgress: number
): SceneModelInstanceState;

export function applyModelInterpolate(
  from: SceneModelInstanceState,
  to: SceneModelInstanceState,
  t: number
): SceneModelInstanceState;

export function modelTransitionSpec(
  from: SceneModel,
  to: SceneModel,
  t: number
): SceneModel;

export function playbackTransitionSpec(
  from: ScenePlayback,
  to: ScenePlayback,
  t: number
): ScenePlayback;

export function instanceTransitionSpec(
  from: SceneModelInstanceState,
  to: SceneModelInstanceState,
  t: number
): SceneModelInstanceState;
```

All transition functions are pure and side-effect-free. They operate on state value objects only and contain no Three.js references.

### 7.6 IContainedModel Interface

```typescript
// packages/core/src/widget/types.ts

export interface IContainedModel {
  readonly anchorModelId: string;   // widget ID of the parent model
  readonly anchorKey: string;       // bone name on parent skeleton
}

// Type guard
export function isContainedModel(widget: unknown): widget is IContainedModel {
  return (
    typeof widget === 'object' &&
    widget !== null &&
    'anchorModelId' in widget &&
    'anchorKey' in widget
  );
}
```

### 7.7 ModelWidget Interface Summary

```typescript
// packages/core/src/elements/model/ModelWidget.ts

class ModelWidget
  implements
    IWidget,
    ISceneElement<SceneModelInstanceState>,
    IRenderable<SceneModelInstanceState>,
    ILoadable,
    IAnimationController {

  readonly id: string;
  readonly tickPriority = 0;  // ticks before camera (priority 100)

  // ILoadable
  async load(manifest: AssetManifest): Promise<void>;

  // ISceneElement
  compileState(props: ModelProps, ctx: CompileExtraContext): SceneModelInstanceState;

  // IRenderable
  apply(state: SceneModelInstanceState, ctx: RenderContext): void;

  // IAnimationController
  onTick(ctx: TickContext): void;

  dispose(): void;
}
```

---

## 8. Technical Considerations

### 8.1 Module Boundary Enforcement

The element strictly follows the mandatory module pattern. Any attempt to import Three.js types in `types.ts`, `dsl.tsx`, or `compile.ts` must be caught by the TypeScript project references configuration and fail the build. The `tsconfig.json` for the compiler layer must exclude Three.js from its type roots.

### 8.2 GLTF Loading

`ModelWidget.load()` uses `THREE.GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader`. The loader is instantiated inside `render.ts`; no consumer code interacts with it directly. The GLTF `scene` object is added to the Three.js scene graph inside `apply()` on first state application.

GLTF loading is async and must complete before the first `apply()` call. The RuntimeDriver must not call `apply()` on a widget that has not completed `ILoadable.load()`. `ModelWidget.load()` returns a `Promise<void>` that the runtime awaits before starting the tick loop.

### 8.3 AnimationMixer

A single `THREE.AnimationMixer` is created per `ModelWidget` instance during `load()`. Clip selection by `clipName` uses partial string matching as a fallback when exact match fails. `AnimationAction` instances are cached by clip name to avoid repeated `mixer.clipAction()` calls.

Crossfade uses `action.fadeIn(fadeInSeconds)` and `action.fadeOut(fadeOutSeconds)`. When `weight` is specified, `action.setEffectiveWeight(weight)` is called after the fade. The mixer is advanced in `onTick()` using the frame delta time from `TickContext.deltaSeconds`.

### 8.4 Material Traversal

Material overrides are applied by traversing the GLTF scene graph using `object.traverse()`, matching mesh names against `partId`. Material updates use `mesh.material.clone()` to avoid mutating shared material instances. The cloned material is cached per mesh per widget instance to avoid per-frame allocations.

Opacity changes update both `mesh.material.opacity` and `mesh.material.transparent`. When `opacity < 1`, `transparent` must be `true`; when `opacity === 1`, `transparent` must be `false` to preserve correct render order.

### 8.5 Shadow Configuration

Shadow casting is enabled by default on all meshes in a loaded GLTF. Shadow receiving is enabled only on meshes that are marked as floor-adjacent by the manifest (`shadow: 'receive'`). This is configured in `render.ts` during `load()` by traversing the GLTF graph.

### 8.6 Bone Attachment (IContainedModel)

After all widgets complete `ILoadable.load()`, the RuntimeDriver calls `attachContainedModels()`. This function iterates all registered widgets, identifies those implementing `IContainedModel`, retrieves the parent widget by `anchorModelId`, extracts the named bone object from the parent's skeleton, and re-parents the child widget's root object under that bone.

The attachment is a One-time operation after load. It does not rerun on scene changes. The child model's transform is applied relative to the bone's world transform at each frame.

### 8.7 Tree-shaking

`@brewsite/core` must tree-shake such that importing only `<Camera>` does not pull in the GLTF loader or AnimationMixer. This requires that `ModelWidget` is not imported by any shared module. The widget is registered only by `modelPlugin()` from `@brewsite/model`, which is explicitly included by the consumer. Consumers who omit `modelPlugin()` from their `plugins` array get no GLTF loader in their bundle.

Named exports in `index.ts` must not re-export Three.js classes. Only value-level types (interfaces, type aliases) and the DSL component (which returns `null`) are safe to re-export from the barrel.

### 8.8 Compiler Pipeline Integration

The `<Model>` DSL component registers a node handler on the compiler via the `CUSTOM_NODE_HANDLER` symbol attached to the component function. This handler receives the JSX props and the `CompileExtraContext` (which includes `ClipMeta` for animation duration information) and produces a `SceneModelInstanceState` for that scene.

The compiler does not know about Three.js, GLTF, or AnimationMixer. It operates only on the state value types defined in `types.ts`. The compiler output is a plain JSON-serializable value.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** — This PRD describes the current, stable element API. No breaking changes are introduced.

Existing consumers using `<Model id="..." position={[0,0,0]} />` continue to work without modification. The `SceneModelInstanceState` type is stable. The `playback`, `motion`, and `animation` shorthand props are backward compatible as all are optional.

If the `MotionCommand` discriminated union gains new members in a future release, that is a minor change (additive). If any existing union member changes its shape, that is a major change requiring a migration guide.

---

## 10. Dependencies

- `three` — peer dependency; `GLTFLoader`, `AnimationMixer`, `AnimationAction`, `Euler`, `Quaternion`, `Vector3`. Must not be bundled; must remain a peer.
- `@types/three` — dev dependency for TypeScript types.
- No new external dependencies are introduced by this element.
- Internal dependency: `packages/core/src/math/` — Vec3 lerp, quaternion utilities, pose utilities.
- Internal dependency: `packages/core/src/widget/` — `IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `IAnimationController`, `CUSTOM_NODE_HANDLER`.
- Internal dependency: `packages/core/src/compiler/` — `CompileExtraContext`, `ClipMeta`.

---

## 11. Risks & Mitigations

**API regret — `motion.commands` ordering:** The `MotionCommand[]` array implies order-dependent application. If commands interact (e.g., two `axis-rotate` commands on orthogonal axes), composition order matters. Risk: consumers disagree on expected order, and changing it is breaking. Mitigation: document that commands apply in array order, and add an integration test that asserts the specific order of application.

**API regret — `parts` vs `overrides` duality:** Two mechanisms (`parts: ModelPartSpec[]` and `overrides: BodyPartOverrideMap`) achieve the same goal. This duality exists for historical reasons. Risk: confusion about which to use. Mitigation: document that `parts` is preferred for new code; `overrides` is retained for backward compatibility. In a future major version, deprecate `overrides`.

**Bundle bloat from GLTF Loader:** `THREE.GLTFLoader` and its dependencies (Draco decoder, KTX2 loader) are large. Consumers who do not use models should not pay this cost. Mitigation: GLTFLoader is instantiated only inside `ModelWidget`, which is only registered when the consumer includes `modelPlugin()` in their `EngineProvider` plugins. Tree-shaking must be verified with bundle analysis on every release.

**AnimationMixer memory leaks:** If `ModelWidget.dispose()` is not called correctly, AnimationMixer instances leak. Mitigation: dispose test in the test suite that verifies the mixer is stopped and all actions are removed.

**Partial clip name matching ambiguity:** If multiple clips partially match `clipName`, the first match wins. Risk: silent wrong-clip selection. Mitigation: log a warning when partial match is used and more than one candidate exists.

---

## 12. Open Questions

- Should `CustomAnimation` IDs be resolvable at compile time (requiring the manifest to declare them) or resolved at runtime only? Compile-time resolution enables type safety on `customAnimations[].id` references but requires manifest changes. Current implementation is runtime-only.
- Should `MotionScene.sceneIndex` use scene index or scene `id` string for identification? Index is fragile to reordering; ID requires every scene to have a unique string identifier. Preference: migrate to scene ID strings in a future minor version.
- Should `overrides` (BodyPartOverrideMap) be formally deprecated in the current release, or deferred to a major version bump?

---

## 13. Launch Criteria

- All `SceneModelInstanceState` transitions (enter, exit, interpolate) are covered by unit tests in `packages/core/src/elements/model/__tests__/compile.test.ts`.
- `ModelWidget` tick lifecycle (load → apply → onTick → dispose) is covered by integration tests using the interface-conforming runtime doubles from `packages/core/src/runtime/mocks/`.
- At least one example scene in `apps/examples/` demonstrates: GLTF load, multi-scene position interpolation, animation clip selection, and part visibility override.
- TypeScript strict mode passes with zero errors on the model element module files.
- `packages/core/README.md` documents the `<Model>` props table.
- CHANGELOG entry written for any API additions.
- Bundle analysis confirms `GLTFLoader` is absent from builds that do not register `ModelWidget`.
- `IContainedModel` bone attachment is demonstrated in an example that attaches an accessory model to a named bone.
