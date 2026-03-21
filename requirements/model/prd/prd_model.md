---
title: "@brewsite/model — GLTF Model & Label System"
doc_type: prd
status: approved
owner: Toolkit Product
last_updated: 2026-03-21
change_history:
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents @brewsite/model as a published extension package: ModelWidget, LabelPositioner, label compiler, modelPlugin() factory, asset manifest contract, ViewportScaleContext integration (replaces EngineARContainerContext), and the post-cleanup API surface."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "DSL stub co-location: dsl.tsx files are now pure type modules. DSL stub functions (Model, ModelRouter, BodyParts, BodyPart, Pose, ModelPart, ContainedModel, Subpart, Playback, Motion, Animation, Label, Labels) moved to ModelWidget.ts. Updated ModelWidget implementation pattern description accordingly."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "View/Region Architecture: documented ModelWidget CUSTOM_NODE_HANDLER composeBounds integration. ModelWidget calls api.composeBounds() to resolve absolute nvsBounds when inside a parent <View>."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Model/diagram overhaul audit: LabelStyle.fontSize documented as intentional number|string union. All model sizing fields verified correct."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Comprehensive audit against actual codebase. Corrected SceneModel coordinate system (nvsX/nvsY/z replace position Vec3). Corrected SceneAnimation shape (many new fields: gltfClipName, fbxClipName, fbxRetarget, clipStart, clipEnd, clipRangeUnit, clipRepeat, clipStartOnce, trimStartKeyframes, trimEndKeyframes, holdStartPose, allowRotation, allowScale). Corrected SceneMotion shape (commands/scenes/customAnimations/pose/reset). Corrected MotionCommand shape (groupId, rotate, translate, weight, space — replaces old discriminated union). Added MotionScene, PoseGroup, ModelPose, CustomAnimation, CustomAnimationContext, CustomAnimationOp, BodyPartOverride. Documented ModelPartSpec correctly. Corrected ModelPluginOptions (manifestUrl and defaultModelStates replace widgetDefaults). Corrected LabelPositionerContext API (provides LabelPositioner instance directly, not a subscribe-based map). Corrected LabelItem API (takes label: LabelResolved prop, not id string). Corrected IContainedModel interface (extends IContainedRenderable from core, not IContainedModel standalone). Added IAttachmentHost, IRenderContributor, IHasCustomDslHandler to ModelWidget's interface list. Corrected ModelWidget implements IDslComposite via childDslComponents. Documented mergeSnapshot() method. Added AssetManifest v2 schema. Corrected wrapProvider pattern (LabelPositionerContext provides LabelPositioner instance directly). Added modelPlugin.getManifest() and fetchManifest() methods. Corrected label placement rule (Label must be under BodyPart or Subpart, not direct Model child). Added compileLabels() from compiler/labelCompiler.ts. Corrected LabelStyle.color/lineColor as LabelColor union ('target-color' | string). Added target-color inheritance behavior."
  - date: 2026-03-14
    author: "Toolkit Product"
    summary: "Package refactor documentation update. Documented viewport-relative scale semantics (worldScale = scale * visibleWorldHeight). Removed instanceTransitionSpec (no longer exported). Replaced __authored type-bypass description with WeakMap pattern in modelDslHandler.ts. Added Module Structure table to Section 8. Added NVS Scale sub-section. Updated launch criteria: 5-scene model-showcase, ≥80% branch coverage, instanceTransitionSpec absent from codebase."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment audit. Documented BodyPartProps as exported from barrel alongside BodyPartByIdProps. Documented registerModelHandlers as exported but previously undocumented. Documented types NOT on the barrel that are internal: AxisRotation, AxisTranslation, PoseGroup, ModelPose, CustomAnimationContext, CustomAnimationOp, LabelColor, SceneMotion — these require sub-path imports. Clarified the distinction between barrel-exported and internal types."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Added comprehensive barrel exports section (Section 14). Clarified Labels DSL stub: exported from labels/index.ts but NOT re-exported from the package barrel — it is an internal DSL component used by the CUSTOM_NODE_HANDLER. Confirmed ModelMaterialManager, modelBlend.ts, and modelDslHandler.ts are internal modules (already in Module Structure table, not on the barrel). Confirmed BodyPartByIdProps is on the barrel (already documented)."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "v1 release readiness audit: barrel export audit completed. Promoted 12 types to public barrel including AxisRotation, AxisTranslation, PoseGroup, ModelPose, CustomAnimationContext, CustomAnimationOp, LabelColor, SceneMotion, modelTransitionSpec, playbackTransitionSpec, compileAnimation, resolveClipRangeSeconds. These are now importable from the main @brewsite/model entry point."
  - date: 2026-03-21
    author: "Toolkit Product"
    summary: "Scene unit system migration. ModelProps.rotation changed from Resolvable<[number, number, number]> to Resolvable<[SceneAngle, SceneAngle, SceneAngle]> as part of the cross-package CSS-inspired unit system. SceneAngle accepts '${number}deg' | '${number}rad' | 0. Compiled state (SceneModel.rotation: Vec3) remains number (radians) — only DSL authoring surface changed. Semver impact is major. Added SceneAngle to @brewsite/core dependency list. Documented known gap: ModelProps x/y/w/h not yet migrated to SceneLength (low-priority follow-up). Updated DSL examples to use unit strings. Referenced migration guide at packages/claude-author/docs/migration/unit-system.md."
---

# @brewsite/model — GLTF Model & Label System

## 1. Overview

`@brewsite/model` is a published extension package for `@brewsite/core` that adds GLTF model loading, GLTF and FBX animation playback, procedural motion, body-part material overrides, and a 3D-tracked HTML label system. It is the canonical way to add animated 3D model content to a BrewSite scene. The package integrates with `@brewsite/core` exclusively through public APIs — it does not deep-import internal modules.

**Affects:** `packages/model/` (published as `@brewsite/model`). Consumers add both `@brewsite/core` and `@brewsite/model` as dependencies.

---

## 2. Problem Statement

Consumers building product marketing scenes need to display GLTF models with GLTF/FBX animation playback, per-bone-group procedural motion, per-mesh material overrides, and overlaid HTML labels that track 3D bone positions in world space. These concerns require Three.js `GLTFLoader`, `AnimationMixer`, material traversal, and per-frame 3D-to-screen projection — none of which belong in `@brewsite/core`.

Separating model/label concerns into `@brewsite/model` keeps the `@brewsite/core` bundle lean for consumers who do not use GLTF models, and avoids coupling the core runtime to Three.js GLTF infrastructure.

---

## 3. Goals & Success Metrics

**Primary metrics:**
- Consumers can load a GLTF model, author its NVS position/rotation/scale per scene, and play back named animation clips via a simple DSL without writing Three.js code.
- Consumers can attach HTML labels to named bone groups; labels track the bone's world-space position in real time via direct DOM transform updates.
- All types required for standard scene authoring and plugin integration are importable from the `@brewsite/core` and `@brewsite/model` main barrels. Types previously internal (`AxisRotation`, `AxisTranslation`, `PoseGroup`, `ModelPose`, `CustomAnimationContext`, `CustomAnimationOp`, `LabelColor`, `SceneMotion`) are now promoted to the public barrel.

**Guardrail metrics:**
- `@brewsite/model` does not import from `@brewsite/diagram`, `@brewsite/charts`, or any non-peer package not listed in its own `package.json`.
- `@brewsite/core` does not import from `@brewsite/model`.

---

## 4. Non-Goals

- Video or audio asset playback.
- Skeletal physics / ragdoll simulation.
- Real-time LOD management.
- Server-side rendering of Three.js content (labels use DOM transforms; SSR outputs empty label containers with no hydration mismatch).
- Label click interaction (`pointer-events: none` on all labels).
- Label collision avoidance or automatic spreading.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare a GLTF model in a scene DSL with NVS position, rotation, scale, and a named animation clip so that the model renders and animates without writing Three.js code.
- As a toolkit consumer, I want to attach HTML label components to named body-part groups so that labels track model animations in real time.
- As a toolkit consumer, I want to register the model plugin with a single `modelPlugin({ manifestUrl })` call so that I do not need to manually construct `ModelWidget` instances or fetch the manifest separately.
- As a toolkit consumer, I want to override individual mesh opacity, color, metalness, and roughness per scene using `<BodyPart>` DSL elements so that I can show different model configurations.
- As a toolkit consumer, I want to declare procedural motion commands and time-coded motion scenes in the DSL so that bones animate in sync with scene progress.

---

## 6. Functional Requirements

1. `ModelWidget` shall implement `ISceneElement`, `IRenderable`, `ILoadable`, `IDslComposite`, `IAttachmentHost`, `IRenderContributor`, `IHasCustomDslHandler`, and `INVSBounded` from `@brewsite/core`.
2. `ModelWidget` shall declare `readonly disableWhenAbsent = true` on `ISceneElement`. When a scene does not reference the model widget, the compiler substitutes `makeDisabledDefault(defaultState)` — the model is hidden rather than frozen at its default position.
3. `ModelWidget.load(manifest)` shall use `THREE.GLTFLoader` to load the GLTF asset specified in the asset manifest, and set `isLoaded = true` when complete.
4. `ModelWidget.apply()` shall convert NVS position (`nvsX`, `nvsY`, `z`) to world-space coordinates using `context.coords.toWorld()` before passing to `ModelRenderer`.
5. The label system shall project named body-part world positions to screen space using the active `Camera` and update CSS `transform` on label DOM nodes each frame via direct DOM mutation (not React state).
6. `LabelPositioner.update()` computes screen-space positions for both the bone target and the offset label point, computing connector line angle and length from the two screen points.
7. `LabelPositioner.setContainerSize(width, height, nvsBounds?)` shall accept an optional NVS sub-region to restrict label projection.
8. `LabelPositionerContext` shall provide the `LabelPositioner` instance directly — consumers use `useLabelPositioner()` to retrieve it and call `registerElement(id, el)` imperative API.
9. `modelPlugin(options)` shall be the sole registration entry point. It creates `ModelWidget` instances lazily via `WidgetRegistry.registerTypeFactory()` — one instance per `<Model type="...">` id encountered during compilation.
10. `modelPlugin()` shall expose `getManifest()` and `fetchManifest()` methods in addition to the `WidgetPlugin` interface, enabling the host application to inspect or pre-load the manifest.
11. `modelPlugin()` shall wrap the provider tree in `LabelPositionerContext.Provider`, providing the `LabelPositioner` instance.
12. `<Label>` shall be valid only as a direct child of `<BodyPart>` or `<Subpart>` DSL elements. Placing `<Label>` directly under `<Model>` or anywhere else shall throw a compile-time error.
13. All types required to integrate `@brewsite/model` in standard consumer scenarios shall be importable from `@brewsite/core` or `@brewsite/model` main barrels. The following types are exported from the public barrel: `AxisRotation`, `AxisTranslation`, `PoseGroup`, `ModelPose`, `CustomAnimationContext`, `CustomAnimationOp`, `LabelColor`, `SceneMotion`, `modelTransitionSpec`, `playbackTransitionSpec`, `compileAnimation`, `resolveClipRangeSeconds`.
14. `LabelStyle.color` and `LabelStyle.lineColor` shall support the special value `'target-color'`, which causes the label to inherit the resolved color of its target body part at runtime.

---

## 7. API Design

### Plugin Entry Point

```typescript
// packages/model/src/plugin.ts

export interface ModelPluginOptions {
  /**
   * URL to fetch the asset manifest JSON from (e.g. '/assets/manifest.json').
   * Mutually exclusive with `manifest`. Fetched asynchronously during EngineProvider mount.
   */
  manifestUrl?: string;

  /**
   * Pre-loaded asset manifest. Use when you have already fetched and validated the manifest.
   * Mutually exclusive with `manifestUrl`.
   */
  manifest?: AssetManifest | null;

  /**
   * Per-model default state overrides. Key = widgetId used by <Model id="...">.
   * Applied to each ModelWidget created by the factory.
   */
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
}

export function modelPlugin(options?: ModelPluginOptions): WidgetPlugin & {
  getManifest(): AssetManifest | null;
  fetchManifest(): Promise<AssetManifest | null>;
};
```

Register via `EngineProvider.plugins`:

```tsx
<EngineProvider plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}>
  {/* scenes */}
</EngineProvider>
```

### Handler Registration

```typescript
// packages/model/src/handlers.ts

/**
 * Registers DSL NodeHandlers for all @brewsite/model DSL components.
 * Idempotent — safe to call multiple times. Must be called before any scene
 * that uses <Model>, <Label>, or related components is compiled.
 * Typically called automatically by modelPlugin().registerHandlers(),
 * but exported for consumers who need to register handlers without the full plugin.
 */
export function registerModelHandlers(): void;
```

The `modelPlugin()` factory:
- Registers a `ModelWidget` type factory on `WidgetRegistry` via `reg.registerTypeFactory(ModelRouter, ...)`. The factory is keyed on the `<Model type="...">` prop, which it looks up in the manifest's `models` array.
- Creates a `LabelPositioner` instance and wraps the provider tree in `LabelPositionerContext.Provider` via the `wrapProvider` hook.
- Mounts a `LabelPositionerSyncer` component that reads `ViewportScaleContext` and calls `labelPositioner.setContainerSize()` on every resize.
- Registers the `onRendererDisposing` hook to call `ModelRenderer.disposeKtx2Loader()` when the WebGL renderer is torn down.

### DSL Components

The full DSL surface lives in `ModelWidget.ts` as null-returning stubs. `dsl.tsx` contains only prop type interfaces.

```tsx
// Model DSL — one per GLTF asset per scene
<Model
  type="robot"          // Required: matches manifest model type; determines widget to route to
  id="robot-1"          // Required: widget instance ID in the runtime registry
  scale={1}             // Dimensionless multiplier (viewport-relative)
  z={0}                 // World-space Z depth (default 0)
  rotation={["0deg", "0deg", "0deg"]}  // SceneAngle triples: "Ndeg" or "Nrad"
  opacity={1}
  x={0} y={0} w={1} h={1}  // NVS sub-region (bare numbers; see Known Gaps below)
  enabled={true}
>
  <Playback>
    <Animation clipName="idle" weight={1} />
    <Motion commands={[...]} scenes={[...]} />
  </Playback>
  <BodyParts>
    <BodyPart id="head" opacity={0.8} color="#ff0000">
      <Pose pitchPct={0.5} />
      <Label id="head-label" text="CPU Unit" labelOffset={[0, 0.3, 0]} />
    </BodyPart>
  </BodyParts>
  <ModelPart id="arm-left" anchor="shoulder_L" position={[0.1, 0, 0]} />
</Model>
```

**DSL component hierarchy:**
- `<Model>` — root; accepts `<Playback>`, `<BodyParts>`, `<BodyPart>` (direct), `<ModelPart>`
- `<Playback>` — container for `<Animation>` and `<Motion>` children
- `<BodyParts>` — container for `<BodyPart id="...">` children
- `<BodyPart id="...">` — single body-part override; accepts optional `<Pose>` and `<Label>` children
- `<ModelPart id="...">` — contained sub-model attachment; accepts `<ContainedModel>` and `<Subpart>` children
- `<Subpart id="...">` — mesh-level override inside a `<ModelPart>`; accepts `<Label>` children
- `<Label>` — label declaration; valid only under `<BodyPart>` or `<Subpart>`

### State Types

```typescript
// packages/model/src/elements/model/types.ts

export type Vec3 = [number, number, number]; // re-export from @brewsite/core

export type ClipMeta = {
  name: string;
  duration: number;
  clipStart?: number;
  clipEnd?: number;
};

// ─── Body part overrides ─────────────────────────────────────────────────────

export type BodyPartOverride = {
  opacity?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  targetKind?: 'bone' | 'mesh';
  pose?: PoseGroup;
  reset?: boolean;
  poseReset?: boolean;
  meshId?: string;   // alternate mesh ID for material lookups
  boneId?: string;   // alternate bone ID for pose lookups
};

export type BodyPartOverrideMap = Partial<Record<string, BodyPartOverride>>;

// ─── Model parts (contained sub-model attachments) ───────────────────────────

export type ModelSubpartSpec = {
  id: string;
  enabled?: boolean;
  opacity?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  reset?: boolean;
};

export type ModelPartSpec = {
  id: string;
  anchor: string;         // bone name on the parent model
  enabled: boolean;
  space?: 'local' | 'world';
  position: Vec3;
  rotation: Vec3;
  scale: number;
  containedPosition?: Vec3;
  containedRotation?: Vec3;
  containedScale?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  modelId?: string;       // type of contained model widget
  subparts?: Partial<Record<string, ModelSubpartSpec>>;
  reset?: boolean;
};

// ─── Motion ──────────────────────────────────────────────────────────────────

export type AxisRotation = {
  yawPct?: number;
  pitchPct?: number;
  rollPct?: number;
};

export type AxisTranslation = {
  xPct?: number;
  yPct?: number;
  zPct?: number;
};

export type PoseGroup = {
  rotate?: AxisRotation;
  translate?: AxisTranslation;
  reset?: boolean;
};

export type ModelPose = {
  mode?: 'override' | 'add';
  groups: Partial<Record<string, PoseGroup>>;
};

export type MotionCommand = {
  groupId: string;               // named bone group in the model rig
  rotate?: AxisRotation;
  translate?: AxisTranslation;
  weight?: number;               // blend weight, default 1.0
  space?: 'local' | 'world';
};

export type CustomAnimationContext = {
  tickTimeSeconds: number;
  wallTimeSeconds: number;
  sceneProgress: number;
  globalProgress: number;
  getBaseTransform: (name: string) => { position: Vec3; rotation: Vec3; scale: Vec3 } | null;
};

export type CustomAnimationOp = {
  targetName: string;
  type: 'rotation' | 'position' | 'scale';
  value: Vec3;
  mode?: 'add' | 'set';
  weight?: number;
};

export type CustomAnimation = {
  id: string;
  enabled: boolean;
  layer?: 'base' | 'overlay';
  weight?: number;
  apply: (context: CustomAnimationContext) => CustomAnimationOp[];
};

export type MotionScene = {
  id: string;
  start: number;
  end: number;
  ease?: (t: number) => number;
  commands: MotionCommand[] | ((t: number, timeSeconds: number) => MotionCommand[]);
  holdAtEnd?: boolean;
};

export type SceneMotion = {
  commands: MotionCommand[];
  scenes: MotionScene[];
  customAnimations?: CustomAnimation[];
  pose?: ModelPose;
  reset?: boolean;
};

// ─── Animation (clip playback) ───────────────────────────────────────────────

export type SceneAnimation = {
  enabled: boolean;
  clipName?: string;            // Clip name from the manifest animation list
  gltfUrl?: string;             // Override GLTF source URL for this animation clip
  gltfClipName?: string;        // Clip name inside the override GLTF
  fbxUrl?: string;              // FBX animation source URL
  fbxClipName?: string;         // Clip name inside the FBX
  fbxRetarget?: boolean;
  fadeInSeconds?: number;       // Crossfade in duration in seconds
  weight?: number;              // Blend weight [0, 1], default 1.0
  clipStart?: number;           // Start offset within the clip
  clipEnd?: number;             // End offset within the clip (negative = from end)
  clipRangeUnit?: 'seconds' | 'percent';  // Unit for clipStart/clipEnd, default 'seconds'
  clipRepeat?: boolean;
  clipStartOnce?: number;       // Start offset applied only the first time the animation starts
  trimStartKeyframes?: number;  // Trim N keyframes from clip start before playback
  trimEndKeyframes?: number;    // Trim N keyframes from clip end before playback
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
  reset?: boolean;
};

// ─── Playback ────────────────────────────────────────────────────────────────

export type ScenePlayback = {
  motion: SceneMotion;
  animation: SceneAnimation;
  reset?: boolean;
};

// ─── Model base state ───────────────────────────────────────────────────────

export type SceneModel = {
  /**
   * Viewport-relative scale factor (dimensionless). The world-space scale applied to the
   * model's Object3D is: `worldScale = scale * context.coords.visibleWorldHeight`.
   * A value of `0.06` is typical for a human figure (≈ 6% of viewport height).
   */
  scale: number;
  /**
   * NVS horizontal center position [0..1]. 0 = left, 1 = right.
   * Converted to world X at render time using the active camera.
   * Default: center of nvsBounds = (nvsBounds.x + nvsBounds.w / 2).
   */
  nvsX: number;
  /**
   * NVS vertical center position [0..1]. 0 = top, 1 = bottom.
   * Default: center of nvsBounds = (nvsBounds.y + nvsBounds.h / 2).
   */
  nvsY: number;
  /** World-space Z depth of the model center. Default: 0. */
  z: number;
  /** Rotation in radians (Euler XYZ). Compiled from SceneAngle DSL props at compile time. */
  rotation: Vec3;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  metalnessMultiplier?: number;
  roughnessMultiplier?: number;
  bodyPartOverrides?: BodyPartOverrideMap;
  parts?: Record<string, ModelPartSpec>;
  enabled?: boolean;
  reset?: boolean;
};

// ─── Instance state ──────────────────────────────────────────────────────────

export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  /** Label definitions compiled for this model instance. Populated by CUSTOM_NODE_HANDLER. */
  labels?: LabelResolved[];
  /**
   * NVS bounds for this model's viewport region.
   * Fullscreen is { x: 0, y: 0, w: 1, h: 1 }. Always filled by the compile step.
   */
  nvsBounds: NVSRect;
};
```

### DSL Prop Types

```typescript
// packages/model/src/elements/model/dsl.tsx (prop type interfaces only)

export type ModelProps = {
  type: string;                         // Required: manifest model type
  id: string;                           // Required: widget instance ID
  scale?: Resolvable<number>;           // Dimensionless viewport-relative multiplier
  z?: Resolvable<number>;               // World-space Z depth
  rotation?: Resolvable<[SceneAngle, SceneAngle, SceneAngle]>;  // e.g. ["0deg", "45deg", "0deg"]
  opacity?: Resolvable<number>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  metalnessMultiplier?: Resolvable<number>;
  roughnessMultiplier?: Resolvable<number>;
  enabled?: Resolvable<boolean>;
  reset?: Resolvable<boolean>;
  x?: number;   // NVS x-coordinate of viewport region [0, 1], default 0 (see Known Gaps)
  y?: number;   // NVS y-coordinate of viewport region [0, 1], default 0 (see Known Gaps)
  w?: number;   // NVS width of viewport region [0, 1], default 1 (see Known Gaps)
  h?: number;   // NVS height of viewport region [0, 1], default 1 (see Known Gaps)
  children?: ReactNode;
};

export type BodyPartProps = {
  opacity?: Resolvable<number>;
  color?: Resolvable<string>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type BodyPartByIdProps = BodyPartProps & {
  id: string;
  targetKind?: 'bone' | 'mesh';
  /** When set, this bone ID is used for pose lookups (enables unified bone+mesh component). */
  boneId?: string;
  /** When set, this mesh ID is used for material lookups (enables unified bone+mesh component). */
  meshId?: string;
};

export type PoseProps = {
  rotate?: Resolvable<AxisRotation>;
  translate?: Resolvable<AxisTranslation>;
  reset?: Resolvable<boolean>;
  // Flat shortcuts merged into rotate/translate at compilation:
  yawPct?: Resolvable<number>;
  pitchPct?: Resolvable<number>;
  rollPct?: Resolvable<number>;
  xPct?: Resolvable<number>;
  yPct?: Resolvable<number>;
  zPct?: Resolvable<number>;
};

export type AnimationProps = {
  reset?: Resolvable<boolean>;
  enabled?: Resolvable<boolean>;
  clipName?: string;
  gltfUrl?: string;
  gltfClipName?: string;
  fbxUrl?: string;
  fbxClipName?: string;
  fbxRetarget?: boolean;
  fadeInSeconds?: number;
  weight?: number;
  clipStart?: number;
  clipEnd?: number;
  clipRangeUnit?: 'seconds' | 'percent';
  clipRepeat?: boolean;
  clipStartOnce?: number;
  trimStartKeyframes?: number;
  trimEndKeyframes?: number;
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

export type MotionProps = {
  reset?: Resolvable<boolean>;
  commands?: MotionCommand[];
  scenes?: MotionScene[];
  customAnimations?: CustomAnimation[];
};
```

### Asset Manifest (v2 Schema)

```typescript
// packages/model/src/elements/model/metadata.ts

export const ASSET_MANIFEST_VERSION = 2;

export type AnchorTargetMap = Record<string, string>;

export type BodyPartGroup = {
  name: string;       // PascalCase component name derived from bone display name
  boneIds: string[];  // GLB bone/joint names for pose overrides
  meshIds: string[];  // GLB mesh names for material overrides
};

export type ModelMeta = {
  type: string;
  glb: string;
  bones: string[];
  meshes: string[];
  subparts?: string[];
  footOffsetY?: number;
  anchorTargets: AnchorTargetMap;
  bodyParts?: string[];
  bodyPartGroups?: BodyPartGroup[];
  baseRotation?: [number, number, number];
  identity: SceneModelInstanceState;  // default state derived from the GLB
};

export type AnimationEntry = {
  type: string;
  glb: string;
  clipName: string;
  duration: number;
  clipStart?: number;
  clipEnd?: number;
};

export type AssetManifest = {
  version: number;      // must equal ASSET_MANIFEST_VERSION = 2
  models: ModelMeta[];
  animations: AnimationEntry[];
};

// Helpers
export function clipMetaFromManifest(manifest: AssetManifest): ClipMeta[];
export function findModelMeta(manifest: AssetManifest, modelType: string): ModelMeta | undefined;
export function assertManifestValid(raw: unknown): AssetManifest;
```

### ModelWidget Interface Summary

```typescript
// packages/model/src/elements/model/ModelWidget.ts

export class ModelWidget
  implements
    ISceneElement<SceneModelInstanceState, CompiledAnimation>,
    IRenderable<SceneModelInstanceState>,
    ILoadable,
    IDslComposite,
    IAttachmentHost,
    IRenderContributor,
    IHasCustomDslHandler,
    INVSBounded {

  readonly widgetId: string;
  readonly defaultState: SceneModelInstanceState;
  readonly transitionSpec: FunctionalTransitionSpec<SceneModelInstanceState>;
  readonly DslComponent: typeof ModelRouter;
  readonly disableWhenAbsent = true;
  readonly childDslComponents: readonly { component: React.ComponentType<unknown>; displayName: string; topLevelError?: boolean; }[];
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler;
  isLoaded: boolean;
  readonly clipMeta: ClipMeta[];

  constructor(config: ModelWidgetConfig, defaultStateOverride?: Partial<SceneModel>);

  // ISceneElement — DSL compilation (handled by CUSTOM_NODE_HANDLER, not compileState)
  compileExtra(state: SceneModelInstanceState, ctx: CompileExtraContext): CompiledAnimation;
  mergeSnapshot(prev: SceneModelInstanceState | undefined, next: SceneModelInstanceState | undefined): SceneModelInstanceState | undefined;

  // IRenderable
  initialize(context: WidgetInitContext): void;
  apply(state: SceneModelInstanceState, context: WidgetRenderContext): void;
  dispose(): void;

  // ILoadable
  async load(manifest: unknown): Promise<void>;

  // INVSBounded
  get nvsBounds(): NVSRect;

  // IAttachmentHost
  getAttachmentPoint(key: string): THREE.Object3D | null;

  // IRenderContributor
  contributeRenderData(): RenderContribution;  // { namedPositions, targetColors }

  // Bone access utilities (used by LabelPositioner)
  getBoneWorldPositions(): Map<string, [number, number, number]>;
  getTargetColors(): Map<string, string>;
  getAnchorBoneName(anchorKey: string): string | undefined;
  findBoneNode(boneName: string): THREE.Object3D | undefined;
}

export type ModelWidgetConfig = {
  modelMeta: ModelMeta;
  clipMeta: ClipMeta[];
  widgetId?: string;
};
```

> **Authored flags:** Authored flags are stored in a module-level WeakMap in `modelDslHandler.ts`. `SceneModelInstanceState` objects are clean — no string-property pollution, no unsafe casts. `buildModelNodeHandler`, `getModelAuthoredFlags`, and `ModelAuthoredFlags` are internal to the package and not exported from the package barrel.

### Transition Functions

```typescript
// packages/model/src/elements/model/compile.ts

// Functional transition spec — evaluates at runtime for infinite easing fidelity
export const functionalInstanceTransitionSpec: FunctionalTransitionSpec<SceneModelInstanceState>;

// Component transition helpers (exported for testing and custom transitions)
export const modelTransitionSpec: {
  exit(from: SceneModel, t: number): SceneModel;
  enter(to: SceneModel, t: number): SceneModel;
  interpolate(from: SceneModel, to: SceneModel, t: number): SceneModel;
};

export const playbackTransitionSpec: {
  exit(from: ScenePlayback, t: number): ScenePlayback;
  enter(to: ScenePlayback, t: number): ScenePlayback;
  interpolate(from: ScenePlayback, to: ScenePlayback, t: number): ScenePlayback;
};

export function applyModelExit(from: SceneModelInstanceState, t: number): SceneModelInstanceState;
export function applyModelEnter(to: SceneModelInstanceState, t: number): SceneModelInstanceState;
export function applyModelInterpolate(from: SceneModelInstanceState, to: SceneModelInstanceState, t: number): SceneModelInstanceState;

// Animation compilation
export type CompiledAnimation = {
  enabled: boolean;
  clipName?: string;
  clipDuration?: number;
  range?: { startSeconds: number; endSeconds: number; span: number };
};

export function compileAnimation(
  animation: SceneAnimation | undefined,
  clipMeta: ClipMeta[],
  prefersReducedMotion: boolean,
): CompiledAnimation;

export function resolveClipRangeSeconds(
  animation: SceneAnimation,
  clipDuration: number,
): { startSeconds: number; endSeconds: number; span: number };

// Default state factory
export function createDefaultModelInstanceState(
  modelId: string,
  identity: SceneModelInstanceState,
): SceneModelInstanceState;
```

### Label System

#### LabelStyle and LabelDefinition

```typescript
// packages/model/src/labels/types.ts

/** Special sentinel value causing the label to inherit the target body part's resolved color. */
export type LabelColor = 'target-color' | (string & {});

export type LabelStyle = {
  color?: LabelColor;          // label text color; 'target-color' inherits from body part
  lineColor?: LabelColor;      // connector line color; 'target-color' inherits from body part
  /**
   * number | string is intentional — number renders as px, string is any valid CSS font-size.
   */
  fontSize?: number | string;
  lineOpacity?: number;
  labelOpacity?: number;
  lineThickness?: number;
  fontFamily?: string;         // per-label font override; absent = inherit from CSS cascade
};

export type LabelDefinition = {
  id: string;
  text: string;
  labelOffset?: [number, number, number];
  enabled?: boolean;
  style?: LabelStyle;
};

export type LabelResolved = LabelDefinition & {
  targetPartId: string;   // body-part ID resolved from parent <BodyPart> or <Subpart>
  screenPosition?: { x: number; y: number };
};
```

#### LabelProps (DSL)

```typescript
// packages/model/src/labels/dsl.tsx
export type LabelProps = LabelDefinition & { children?: never };
```

#### Label Compiler

```typescript
// packages/model/src/compiler/labelCompiler.ts

export type LabelCompileContext = { sceneProgress: number };

/**
 * Compiles label definitions for a transition block.
 * Fades labels in/out on enter/exit, interpolates labelOffset and opacity between scenes.
 * Filters out labels with enabled: false before blending.
 */
export function compileLabels(
  fromLabels: LabelResolved[] | undefined,
  toLabels: LabelResolved[] | undefined,
  context: LabelCompileContext,
): LabelResolved[];
```

#### LabelPositioner

```typescript
// packages/model/src/player/LabelPositioner.ts

export class LabelPositioner {
  /**
   * Register or unregister a DOM element for a label ID.
   * Called by LabelItem via useEffect when mounting/unmounting.
   */
  registerElement(id: string, el: HTMLElement | null): void;

  /**
   * Update container dimensions and optional NVS sub-region.
   * When nvsBounds is omitted, defaults to fullscreen { x:0, y:0, w:1, h:1 }.
   */
  setContainerSize(width: number, height: number, nvsBounds?: NVSRect): void;

  /**
   * Project all active labels and update CSS transforms on their DOM nodes.
   * Called once per render frame by the runtime driver.
   *
   * Computes screen position for both the bone target and the offset label point.
   * Sets CSS custom properties on each label DOM node:
   *   --label-line-length, --label-line-angle, --label-line-origin-x, --label-line-origin-y
   *   --label-color, --label-line-color (when style.color === 'target-color')
   * Applies transform: translate(x, y) for the label position.
   */
  update(
    labels: LabelResolved[],
    camera: Camera,
    namedPositions: ReadonlyMap<string, [number, number, number]>,
    targetColors?: ReadonlyMap<string, string>,
  ): void;
}
```

#### LabelPositionerContext

```typescript
// packages/model/src/player/LabelPositionerContext.ts

/**
 * Provides the LabelPositioner instance to LabelItem components.
 * Value is the LabelPositioner class instance directly.
 */
export const LabelPositionerContext: React.Context<LabelPositioner | null>;

/**
 * Hook to access the LabelPositioner.
 * Throws if called outside a ScenePlayer / EngineProvider with modelPlugin().
 */
export function useLabelPositioner(): LabelPositioner;
```

#### LabelItem Component

```typescript
// packages/model/src/labels/LabelItem.tsx

/**
 * Renders a single label and its connector line.
 * Calls positioner.registerElement(label.id, ref.current) to register its DOM node.
 * Reads LabelPositioner via useLabelPositioner().
 * Position updates come via CSS transforms set directly on the DOM node — no React state.
 *
 * Connector line is rendered as a <span> with CSS custom properties for angle and length.
 */
export const LabelItem: React.FC<{ label: LabelResolved }>;
```

#### IContainedModel Interface

```typescript
// packages/model/src/widget/types.ts

/**
 * Model-specific extension of IContainedRenderable (from @brewsite/core).
 * Widget whose rootObject is a model anchored to a bone on another ModelWidget.
 * anchorWidgetId must be the widgetId of a registered ModelWidget implementing IAttachmentHost.
 * anchorKey is resolved via ModelWidget.getAttachmentPoint(key).
 */
export interface IContainedModel<TState> extends IRenderable<TState>, IContainedRenderable {
  // anchorWidgetId is always a ModelWidget widgetId.
  // anchorKey resolved by ModelWidget.getAttachmentPoint() via bone name lookup.
}
```

### ViewportScaleContext Integration

`LabelPositionerSyncer` (internal to `modelPlugin`) reads viewport dimensions from `ViewportScaleContext`:

```typescript
// Internal to plugin.ts
const LabelPositionerSyncer = (): ReactElement | null => {
  const { containerWidth, containerHeight } = useContext(ViewportScaleContext);
  const currentBounds = modelWidgets.find(w => w.nvsBounds != null)?.nvsBounds ?? undefined;
  useEffect(() => {
    labelPositioner.setContainerSize(containerWidth, containerHeight, currentBounds);
  }, [containerWidth, containerHeight, currentBounds]);
  return null;
};
```

`EngineARContainerContext` is deprecated and aliased to `ViewportScaleContext`. All `@brewsite/model` code imports from `ViewportScaleContext`.

---

## 8. Technical Considerations

### Module Structure

| File | Responsibility |
|---|---|
| `types.ts` | State types and shape contracts |
| `dsl.tsx` | DSL prop interfaces |
| `modelBlend.ts` | Pure blend/interpolation helpers |
| `compile.ts` | Transition specs and animation compilation |
| `modelDslHandler.ts` | CUSTOM_NODE_HANDLER factory, DSL merge helpers, authored-flags WeakMap |
| `render.ts` | Stateless world-space transform application |
| `ModelMaterialManager.ts` | Material base caching and override application |
| `ModelAnimationPlayer.ts` | AnimationMixer management and clip application |
| `ModelRenderer.ts` | GLTF loading, scene management, apply() orchestrator |
| `ModelWidget.ts` | IWidget implementation — bridges compile state to render |

### NVS Coordinate System

`SceneModel` does not use a world-space `position: Vec3`. Instead it uses `nvsX` (horizontal center [0..1]), `nvsY` (vertical center [0..1]), and `z` (world-space depth). These are computed in the `CUSTOM_NODE_HANDLER` from the `<Model x= y= w= h=>` props via `api.composeBounds()`, then stored in `SceneModelInstanceState`. At render time, `ModelWidget.apply()` converts `(nvsX, nvsY, z)` to world space using `context.coords.toWorld(nvsX, nvsY, z)` — a live NVS coordinate service injected by the engine.

This design means `SceneModel` is free of Three.js camera math. All camera-dependent coordinate conversion happens in the render layer.

### NVS Scale

`SceneModel.scale` is a viewport-relative factor. The world-space scale applied to the model's Object3D is always: `worldScale = scale * context.coords.visibleWorldHeight`. A value of `0.06` is typical for a human figure (≈ 6% of viewport height). This matches how diagram sizes geometry, ensuring models appear at a consistent visual size across viewport dimensions.

### ModelWidget Registration Pattern

`ModelWidget` uses `CUSTOM_NODE_HANDLER` on its constructor rather than a static `registerNode()` call. The plugin's `configureRegistry` hook calls `reg.registerTypeFactory(ModelRouter, factory)` which installs a routing handler on first `<Model>` encounter. Each `ModelWidget` instance registers its own `CUSTOM_NODE_HANDLER` for its specific `type`/`id` combination. This allows multiple model types to coexist in the same scene with independent DSL compilation.

### mergeSnapshot Pattern

`ModelWidget` implements `mergeSnapshot(prev, next)` to perform authored-flag-aware state merging. Authored flags are stored in a module-level WeakMap in `modelDslHandler.ts` — `SceneModelInstanceState` objects are clean with no string-property pollution. `mergeSnapshot` retrieves flags via `getModelAuthoredFlags(state)` to determine which fields were explicitly set by the DSL author (versus inherited from the previous scene's state). This enables per-field scene inheritance: an author can set only `animation.clipName` in a scene and inherit all other state from the previous scene.

### DSL Stub Co-location

`dsl.tsx` contains only TypeScript prop type interfaces — no React function components. All DSL stub functions (`Model`, `ModelRouter`, `BodyParts`, `BodyPart`, `Pose`, `ModelPart`, `ContainedModel`, `Subpart`, `Playback`, `Motion`, `Animation`, `Label`, `Labels`) are defined as null-returning arrow functions in `ModelWidget.ts`. `Label` and `Labels` additionally set `displayName` for runtime component identity checks.

### Label Architecture

Labels are collected during CUSTOM_NODE_HANDLER compilation and stored in `SceneModelInstanceState.labels`. The `compileLabels()` function (in `compiler/labelCompiler.ts`) handles transition blending — fading labels in/out and interpolating `labelOffset`. `LabelPositioner.update()` handles the screen-space projection each frame via `Vector3.project(camera)`, then maps NDC coordinates to the NVS sub-region's pixel footprint. DOM updates are direct mutations via CSS custom properties and `element.style.transform` — React state is not used for per-frame position updates.

### IContainedModel vs IContainedRenderable

`IContainedRenderable` (in `@brewsite/core`) is the generic interface for any widget anchored to another widget's attachment point. `IContainedModel<TState>` (in `@brewsite/model/widget/types.ts`) is the model-specific extension that additionally implements `IRenderable<TState>` and constrains `anchorWidgetId` to be a `ModelWidget` widgetId. Use `IContainedRenderable` for non-model attachment cases.

### disableWhenAbsent

`ModelWidget` declares `readonly disableWhenAbsent = true`. The compiler calls `makeDisabledDefault(defaultState)` for scenes that omit the model — hiding the model (setting `enabled: false`) rather than freezing it at its default position. This is the correct behavior for models that should only appear in scenes that explicitly reference them.

### Animation Compilation

The `compileAnimation()` function (called from `ModelWidget.compileExtra()`) resolves `SceneAnimation` to a `CompiledAnimation` at compile time. It handles clip lookup by name from `ClipMeta[]`, range resolution (`clipStart`/`clipEnd` in seconds or percent), and `prefersReducedMotion` gating. The result is stored in `SceneTrackTick.widgetExtras[widgetId]` and read by `ModelWidget.apply()` via `context.extra`.

### View/Region Composition

Inside the `CUSTOM_NODE_HANDLER`, the model calls `api.composeBounds(localBounds)` to resolve its NVS bounds when placed inside a parent `<View>`. This returns `localBounds` unchanged at the root level (identity). The composed `nvsBounds` is stored on `SceneModelInstanceState.nvsBounds` and reflected by `ModelWidget.nvsBounds` (satisfying `INVSBounded`) for use by `LabelPositionerSyncer`.

### Scene Unit System

The `@brewsite/model` DSL uses the cross-package CSS-inspired scene unit system for angular props. `ModelProps.rotation` accepts `Resolvable<[SceneAngle, SceneAngle, SceneAngle]>` where `SceneAngle` is `"${number}deg"` | `"${number}rad"` | 0. The `modelDslHandler` resolves these to radians at compile time before storing in `SceneModel.rotation: Vec3`. Compiled state remains pure `number` throughout — the unit system is confined to the DSL authoring surface.

Dimensionless props (`scale`, `opacity`, `metalness`, `roughness`, `metalnessMultiplier`, `roughnessMultiplier`) remain `number` because they are multipliers or normalized [0, 1] values, not spatial measurements. World-space `z` remains `number` because it is a raw world-space depth value, not an NVS coordinate.

**Known gap (low priority):** `ModelProps.x`, `y`, `w`, `h` (NVS sub-region) remain bare `number` and have not been migrated to `SceneLength`. These are static NVS layout coordinates (not animatable `Resolvable` props) and are consumed directly by `api.composeBounds()`. Migration to `SceneLength` with `%` units is a low-priority follow-up.

---

## 9. Breaking Change Assessment

**Semver impact: Major** (scene unit system). The `ModelProps.rotation` DSL prop changed from `Resolvable<[number, number, number]>` to `Resolvable<[SceneAngle, SceneAngle, SceneAngle]>`. Consumers must update rotation values from bare numbers (e.g., `rotation={[0, Math.PI / 4, 0]}`) to explicit angle unit strings (e.g., `rotation={["0deg", "45deg", "0deg"]}`). The `SceneAngle` type is `"${number}deg"` | `"${number}rad"` | 0. The literal `0` is accepted as a shorthand for zero rotation on any axis.

This is part of a cross-package CSS-inspired scene unit system. All BrewSite DSL spatial props now require explicit unit strings. Compiled state types (`SceneModel.rotation: Vec3`) remain `number` (radians) — only the DSL authoring surface changed. The `modelDslHandler` resolves `SceneAngle` values to radians at compile time.

See the migration guide at `packages/claude-author/docs/migration/unit-system.md` for a comprehensive list of changes across all packages.

Previous breaking changes (already shipped):
- `SceneModel` coordinate representation changed from `position: Vec3` to `nvsX/nvsY/z` (scalars) — internal migration; `SceneModelInstanceState` is not expected to be constructed directly by consumers.
- `instanceTransitionSpec` has been removed. Consumers must use `functionalInstanceTransitionSpec` instead.

---

## 10. Dependencies

- `@brewsite/core` (peer): `ISceneElement`, `IRenderable`, `ILoadable`, `IDslComposite`, `IAttachmentHost`, `IRenderContributor`, `IHasCustomDslHandler`, `INVSBounded`, `IContainedRenderable`, `CUSTOM_NODE_HANDLER`, `ViewportScaleContext`, `NVSRect`, `Vec3`, `Resolvable`, `SceneAngle`, `FunctionalTransitionSpec`, `ElementTransitionSpec`, `blendNumber`, `blendVec3`, `blendOpacity`, `blendColor`, `blendAxisRotation`, `blendAxisTranslation`, `resolveEnabledByOpacity`, `transitionT`, `registerNode`, `getNodeHandler`, `validateNVSScalar`, `validateNVSRect`.
- `three` (peer): `GLTFLoader`, `AnimationMixer`, `AnimationAction`, `Camera`, `Vector3`.
- `react` (peer): context, hooks, element creation.

---

## 11. Risks & Mitigations

**Risk: LabelPositioner projects incorrectly when ViewportScaleContext is absent.**
**Mitigation:** `LabelPositionerSyncer` reads `ViewportScaleContext`. If the context is missing, `containerWidth` and `containerHeight` default to `0` — labels are silently skipped (no projection when dimensions are 0).

**Risk: `nvsBounds` changes across scenes without a concurrent container resize.**
**Mitigation:** Known limitation documented in `requirements/core/notes/note_nvs-known-limitations.md`. `LabelPositionerSyncer` reads `nvsBounds` from `modelWidgets[0]` on every render, so the next resize event will correct the projection. Per-frame `nvsBounds` tracking is a future improvement.

**Risk: Multiple models with distinct NVS sub-regions produce incorrect label projections.**
**Mitigation:** `LabelPositionerSyncer` uses the first registered `ModelWidget` with a non-null `nvsBounds`. Multi-model label projection with distinct sub-regions requires a per-widget LabelPositioner — tracked as a future improvement.

**Risk: `target-color` label color falls back to white when `targetColors` is absent.**
**Mitigation:** `LabelItem` defaults `'target-color'` to `'#ffffff'` for text and `'rgba(255,255,255,0.8)'` for lines when no target color is resolved. This is a safe fallback.

---

## 12. Open Questions

None. All design decisions are resolved in the current implementation.

---

## 14. Barrel Exports (`packages/model/src/index.ts`)

### Plugin
`modelPlugin`, `ModelPluginOptions` (type).

### State Types
`SceneModel` (type), `SceneModelInstanceState` (type), `SceneAnimation` (type), `ScenePlayback` (type), `BodyPartOverride` (type), `BodyPartOverrideMap` (type), `ModelPartSpec` (type), `ModelSubpartSpec` (type), `MotionCommand` (type), `MotionScene` (type), `CustomAnimation` (type), `Vec3` (type), `ClipMeta` (type), `NVSRect` (type — re-export from `@brewsite/core`).

### Widget
`ModelWidget`, `ModelWidgetConfig` (type).

### Metadata
`AssetManifest` (type), `ModelMeta` (type), `AnimationEntry` (type), `clipMetaFromManifest`, `assertManifestValid`, `findModelMeta`.

### DSL Components
`Model`, `ModelRouter`, `BodyParts`, `BodyPart`, `Pose`, `ModelPart`, `ContainedModel`, `Subpart`, `Playback`, `Motion`, `Animation`.

Note: `Labels` is a DSL stub defined in `ModelWidget.ts` and exported from `labels/index.ts`, but it is NOT re-exported from the package barrel. It is an internal DSL component used by the CUSTOM_NODE_HANDLER during compilation.

### DSL Prop Types
`ModelProps` (type), `BodyPartProps` (type), `BodyPartByIdProps` (type), `PoseProps` (type), `ModelPartProps` (type), `ContainedModelProps` (type), `SubpartProps` (type), `PlaybackProps` (type), `MotionProps` (type), `AnimationProps` (type).

### Labels
`Label`, `LabelItem`, `LabelPositioner`, `LabelPositionerContext`, `useLabelPositioner`, `LabelDefinition` (type), `LabelResolved` (type), `LabelStyle` (type).

### Widget Contract Extensions
`IContainedModel` (type).

### Handler Registration
`registerModelHandlers`.

### Internal Modules (not on barrel)
- `ModelMaterialManager` (`ModelMaterialManager.ts`) — Material base caching and override application
- `modelBlend.ts` — Pure blend/interpolation helpers for model state transitions
- `modelDslHandler.ts` — CUSTOM_NODE_HANDLER factory, DSL merge helpers, authored-flags WeakMap

---

## 15. Launch Criteria

- `modelPlugin()` registers `ModelWidget` instances lazily and mounts `LabelPositionerSyncer` correctly.
- All consumer-facing types are importable from `@brewsite/core` or `@brewsite/model` main barrels. Previously internal types (`AxisRotation`, `AxisTranslation`, `PoseGroup`, `ModelPose`, `CustomAnimationContext`, `CustomAnimationOp`, `LabelColor`, `SceneMotion`) have been promoted to the public barrel.
- Tests pass: `ModelWidget` unit tests, `LabelPositioner` unit tests, `AnimationTrackMapping` tests, `labelCompiler` tests.
- `apps/examples/src/model-showcase/` exists with **5 scenes**: idle intro, animation, body part labels, model in a View, and a three-model carousel.
- Branch coverage for `packages/model/src` is ≥ 80% (excluding render.ts files).
- `instanceTransitionSpec` does not appear anywhere in the codebase.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/model` with coverage targets met.
