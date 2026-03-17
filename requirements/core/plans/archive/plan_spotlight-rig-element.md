---
title: SpotlightRig Element
doc_type: plan
owner: architect
status: ready
updated: 2026-03-12
---

# SpotlightRig Element — Implementation Plan

## Overview

Adds a `SpotlightRig` core element: N autonomous rotating spotlights with visible beam
cones and optional ground halos, driven by `IAnimationController` (wall-clock time, not
scroll progress). All cinematic/reel settings live on both the element and a typed
`SpotlightRigTheme`; element props override the theme. `count` and `showHelper` are
element-only.

---

## Package Placement

`packages/core/src/elements/spotlight-rig/`

**Rationale**: Pure Three.js, no diagram dependency. Follows the same
`types → dsl → compile → render → Widget → index` module pattern as all other core
elements. `@brewsite/core` must never import from `@brewsite/diagram`.

---

## Module Structure

```
packages/core/src/elements/spotlight-rig/
  types.ts                       # SpotlightRigTheme, SpotlightRigState
  dsl.tsx                        # SpotlightRigProps + DSL type exports
  compile.ts                     # DEFAULT_SPOTLIGHT_RIG_THEME, resolveSpotlightRigState(),
                                 # transition spec, blend helpers
  render.ts                      # applySpotlightRig(), SpotlightRigRefs, SpotlightRigCache
  SpotlightRigWidget.ts          # ISceneElement + IRenderable + IAnimationController
  themes/
    index.ts                     # re-exports presets
    moviePremiere.ts             # deep-blue / white dramatic sweeping rigs
    concertStage.ts              # fast multicolor stage sweep
  __tests__/
    SpotlightRigCompile.test.ts
    SpotlightRigWidget.test.ts
  index.ts                       # public re-exports
```

---

## Dependency Direction (mandatory)

| File | May import | Must NOT import |
|---|---|---|
| `types.ts` | nothing | Three.js, React, compile.ts, render.ts |
| `dsl.tsx` | `types.ts`, `@brewsite/core` SceneSnapshotContext | Three.js, render.ts, compile.ts |
| `compile.ts` | `types.ts`, transition utilities from `../../compiler/transitions/` | Three.js, React, render.ts |
| `render.ts` | `types.ts`, `three` | React, compile.ts |
| `SpotlightRigWidget.ts` | `types.ts`, `dsl.tsx` (props), `compile.ts`, `render.ts`, `../../widget/types` | Direct React rendering |
| `themes/*.ts` | `types.ts` only | Everything else |

---

## `types.ts`

```typescript
// SpotlightRig element types — interface contracts only.

/**
 * Theming contract for SpotlightRig.
 *
 * All "reel" / cinematic settings live here AND on the DSL element.
 * Element-level props override corresponding theme values.
 * `count` and `showHelper` are intentionally absent — they are element-only.
 */
export type SpotlightRigTheme = {
  /** CSS hex/rgb color string for the spotlight sources. */
  color: string;
  /** Peak intensity of each spotlight (physical units, same scale as Three.js SpotLight). */
  intensity: number;
  /** Rotation speed in radians per second. Negative = counter-clockwise. */
  speed: number;
  /** Radius of the circular sweep path in world units. */
  radius: number;
  /** World-space Y position of the spotlight source origins. */
  height: number;
  /** World-space Y position of the target ground plane. */
  targetY: number;
  /** Spotlight cone half-angle in radians (Three.js SpotLight.angle). Max π/2. */
  angle: number;
  /** Penumbra falloff (0 = hard edge, 1 = fully soft edge). */
  penumbra: number;
  /** Physical distance decay exponent. Use 2.0 for physically-based rendering. */
  decay: number;
  /** Max light reach in world units. 0 = unlimited. */
  distance: number;
  /** Whether spotlights cast shadows. Shadow maps are expensive — disable for fill lights. */
  castShadow: boolean;
  /** Shadow map size in pixels (width and height). Must be a power of two. */
  shadowMapSize: number;
  /** Whether to render visible beam cone meshes. */
  showBeam: boolean;
  /** Opacity of the beam cone mesh (0 = invisible, 0.12 = subtle, 0.25 = dramatic). */
  beamOpacity: number;
  /** CSS color string for the beam cone mesh. Usually a lighter/whiter version of `color`. */
  beamColor: string;
  /** Whether to render a ground halo sprite at the spotlight target position. */
  showHalo: boolean;
  /** Opacity of the ground halo sprite. */
  haloOpacity: number;
  /** Diameter of the ground halo sprite in world units. */
  haloSize: number;
};

/**
 * Compiled runtime state for one SpotlightRig.
 * Flows through the SceneTrack and is sampled each tick by the RuntimeDriver.
 */
export type SpotlightRigState = SpotlightRigTheme & {
  /** Number of individual spotlights in the rig. Element-only — not interpolated. */
  count: number;
  /**
   * Whether to add Three.js SpotLightHelpers to the scene.
   * Element-only debug flag — not interpolated between scenes.
   * Only respected in development; ignored in production builds if desired.
   */
  showHelper: boolean;
  /**
   * Runtime enable gate — false when the widget is absent from the current scene.
   * Controlled by disableWhenAbsent = true on the widget.
   */
  enabled: boolean;
};
```

---

## `dsl.tsx`

```typescript
// SpotlightRig DSL prop types — no runtime logic, no Three.js.

import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { SpotlightRigTheme, SpotlightRigState } from './types';

type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

/**
 * DSL props for <SpotlightRig>.
 *
 * Priority chain (highest wins):
 *   individual prop override > props.theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * Element-only (no theme equivalent): count, showHelper.
 * All SpotlightRigTheme keys are individually overridable.
 */
export type SpotlightRigProps = {
  // ── Element-only ──────────────────────────────────────────────────────────
  /** Number of individual spotlights. Default: 3. NOT in theme. */
  count?: Resolvable<number>;
  /**
   * Render Three.js SpotLightHelpers for all lights.
   * NOT Resolvable — consumed at initialize()/apply() time, not baked into SceneTrack.
   * NOT in theme.
   */
  showHelper?: boolean;

  // ── Theme + per-element override ──────────────────────────────────────────
  /**
   * Base theme object. Individual props below override matching theme fields.
   * Build custom themes with the provided preset + override pattern:
   *   theme={mergeSpotlightRigTheme(moviePremiereTheme, { speed: 0.8 })}
   */
  theme?: SpotlightRigTheme;

  color?: Resolvable<string>;
  intensity?: Resolvable<number>;
  speed?: Resolvable<number>;
  radius?: Resolvable<number>;
  height?: Resolvable<number>;
  targetY?: Resolvable<number>;
  angle?: Resolvable<number>;
  penumbra?: Resolvable<number>;
  decay?: Resolvable<number>;
  distance?: Resolvable<number>;
  castShadow?: Resolvable<boolean>;
  shadowMapSize?: Resolvable<number>;
  showBeam?: Resolvable<boolean>;
  beamOpacity?: Resolvable<number>;
  beamColor?: Resolvable<string>;
  showHalo?: Resolvable<boolean>;
  haloOpacity?: Resolvable<number>;
  haloSize?: Resolvable<number>;
};

// Re-export so consumers import from dsl.tsx without touching types.ts directly.
export type { SpotlightRigTheme, SpotlightRigState };
```

---

## `compile.ts`

### Default Theme

```typescript
export const DEFAULT_SPOTLIGHT_RIG_THEME: SpotlightRigTheme = {
  color: '#ffffff',
  intensity: 80,           // high — spotlights are typically bright
  speed: 0.5,              // radians/second
  radius: 15,              // world units
  height: 25,              // spotlight source Y
  targetY: 0,              // ground plane Y
  angle: Math.PI / 16,     // ~11° — narrow dramatic cone
  penumbra: 0.25,
  decay: 2.0,              // physically-based
  distance: 60,
  castShadow: false,       // default off — expensive
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.10,
  beamColor: '#e8f0ff',    // slightly cool white
  showHalo: false,         // opt-in
  haloOpacity: 0.3,
  haloSize: 6,
};

export const DEFAULT_SPOTLIGHT_RIG_COUNT = 3;
```

### `resolveSpotlightRigState()`

```typescript
/**
 * Pure function — resolves SpotlightRigProps into SpotlightRigState.
 * Priority: individual prop override > props.theme > DEFAULT_SPOTLIGHT_RIG_THEME.
 */
export function resolveSpotlightRigState(
  props: SpotlightRigProps,
  context: SceneSnapshotContext,
): SpotlightRigState {
  const base = DEFAULT_SPOTLIGHT_RIG_THEME;
  const theme: SpotlightRigTheme = props.theme
    ? { ...base, ...props.theme }
    : base;

  const r = <T>(v: T | ((ctx: SceneSnapshotContext) => T) | undefined): T | undefined =>
    typeof v === 'function' ? (v as (c: SceneSnapshotContext) => T)(context) : v;

  return {
    count:        r(props.count)        ?? DEFAULT_SPOTLIGHT_RIG_COUNT,
    showHelper:   props.showHelper      ?? false,
    enabled:      true,
    color:        r(props.color)        ?? theme.color,
    intensity:    r(props.intensity)    ?? theme.intensity,
    speed:        r(props.speed)        ?? theme.speed,
    radius:       r(props.radius)       ?? theme.radius,
    height:       r(props.height)       ?? theme.height,
    targetY:      r(props.targetY)      ?? theme.targetY,
    angle:        r(props.angle)        ?? theme.angle,
    penumbra:     r(props.penumbra)     ?? theme.penumbra,
    decay:        r(props.decay)        ?? theme.decay,
    distance:     r(props.distance)     ?? theme.distance,
    castShadow:   r(props.castShadow)   ?? theme.castShadow,
    shadowMapSize:r(props.shadowMapSize)?? theme.shadowMapSize,
    showBeam:     r(props.showBeam)     ?? theme.showBeam,
    beamOpacity:  r(props.beamOpacity)  ?? theme.beamOpacity,
    beamColor:    r(props.beamColor)    ?? theme.beamColor,
    showHalo:     r(props.showHalo)     ?? theme.showHalo,
    haloOpacity:  r(props.haloOpacity)  ?? theme.haloOpacity,
    haloSize:     r(props.haloSize)     ?? theme.haloSize,
  };
}
```

### Blend Helpers (pure)

```typescript
// Internal — not exported. Used only by the transition spec.

const blendSpotlightRig = (
  from: SpotlightRigState,
  to: SpotlightRigState,
  t: number,
): SpotlightRigState => ({
  ...to,
  // Numeric interpolation
  intensity:   blendNumber(from.intensity,   to.intensity,   t) ?? to.intensity,
  speed:       blendNumber(from.speed,       to.speed,       t) ?? to.speed,
  radius:      blendNumber(from.radius,      to.radius,      t) ?? to.radius,
  height:      blendNumber(from.height,      to.height,      t) ?? to.height,
  targetY:     blendNumber(from.targetY,     to.targetY,     t) ?? to.targetY,
  angle:       blendNumber(from.angle,       to.angle,       t) ?? to.angle,
  penumbra:    blendNumber(from.penumbra,    to.penumbra,    t) ?? to.penumbra,
  decay:       blendNumber(from.decay,       to.decay,       t) ?? to.decay,
  distance:    blendNumber(from.distance,    to.distance,    t) ?? to.distance,
  beamOpacity: blendNumber(from.beamOpacity, to.beamOpacity, t) ?? to.beamOpacity,
  haloOpacity: blendNumber(from.haloOpacity, to.haloOpacity, t) ?? to.haloOpacity,
  haloSize:    blendNumber(from.haloSize,    to.haloSize,    t) ?? to.haloSize,
  // Color interpolation
  color:       blendColor(from.color,     to.color,     t) ?? to.color,
  beamColor:   blendColor(from.beamColor, to.beamColor, t) ?? to.beamColor,
  // Discrete — take destination value immediately
  count:       to.count,
  castShadow:  to.castShadow,
  shadowMapSize: to.shadowMapSize,
  showBeam:    to.showBeam,
  showHalo:    to.showHalo,
  showHelper:  to.showHelper,
  enabled:     to.enabled,
});
```

### Transition Spec

Use `FunctionalTransitionSpec<SpotlightRigState>` — the rotation is time-driven and
never baked into the SceneTrack, so there is no benefit to `ElementTransitionSpec`'s
batch-fill model. Closures are clean and the interpolation computation is cheap.

```typescript
export const spotlightRigTransitionSpec: FunctionalTransitionSpec<SpotlightRigState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    intensity:   blendNumber(from.intensity,   0, t) ?? 0,
    beamOpacity: blendNumber(from.beamOpacity, 0, t) ?? 0,
    haloOpacity: blendNumber(from.haloOpacity, 0, t) ?? 0,
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    intensity:   blendNumber(0, to.intensity,   t) ?? to.intensity,
    beamOpacity: blendNumber(0, to.beamOpacity, t) ?? to.beamOpacity,
    haloOpacity: blendNumber(0, to.haloOpacity, t) ?? to.haloOpacity,
  }),
  interpolateFn: (from, to) => ({ t }) => blendSpotlightRig(from, to, t),
};
```

Also export the `mergeSpotlightRigTheme()` utility for consumers:

```typescript
/**
 * Shallow-merges overrides onto base, producing a new SpotlightRigTheme.
 * Neither argument is mutated.
 */
export function mergeSpotlightRigTheme(
  base: SpotlightRigTheme,
  overrides: Partial<SpotlightRigTheme>,
): SpotlightRigTheme {
  return { ...base, ...overrides };
}
```

---

## `render.ts`

### Data structures

```typescript
// Per-light Three.js objects managed in the cache.
type SpotRigEntry = {
  light: THREE.SpotLight;
  target: THREE.Object3D;
  beam: THREE.Mesh;            // cone mesh for visible beam
  helper: THREE.SpotLightHelper | null;
};

type SpotlightRigCache = {
  entries: SpotRigEntry[];
  haloSprite: THREE.Sprite | null;
  haloTex: THREE.CanvasTexture | null;
};

export type SpotlightRigRefs = {
  scene: THREE.Scene;
  cache: SpotlightRigCache;
};

// Cache key stored on scene.userData — unique per widget instance.
const CACHE_KEY = '__brewsite_spotlight_rig_';
```

### Entry management

```typescript
export function getOrCreateCache(scene: THREE.Scene, widgetId: string): SpotlightRigCache {
  const key = CACHE_KEY + widgetId;
  const existing = scene.userData[key] as SpotlightRigCache | undefined;
  if (existing) return existing;
  const created: SpotlightRigCache = { entries: [], haloSprite: null, haloTex: null };
  scene.userData[key] = created;
  return created;
}

export function disposeCache(scene: THREE.Scene, cache: SpotlightRigCache): void {
  for (const entry of cache.entries) {
    scene.remove(entry.light);
    scene.remove(entry.target);
    scene.remove(entry.beam);
    if (entry.helper) scene.remove(entry.helper);
    entry.beam.geometry.dispose();
    (entry.beam.material as THREE.MeshBasicMaterial).dispose();
    if (entry.helper) entry.helper.dispose();
  }
  cache.entries = [];
  if (cache.haloSprite) {
    scene.remove(cache.haloSprite);
    (cache.haloSprite.material as THREE.SpriteMaterial).dispose();
    cache.haloSprite = null;
  }
  if (cache.haloTex) {
    cache.haloTex.dispose();
    cache.haloTex = null;
  }
}
```

### Beam cone geometry

The beam is a `ConeGeometry` with apex at the top (light origin), base at the bottom
(target). The cone is translated so its local pivot is at the apex:

```typescript
function buildBeamGeometry(angle: number, distance: number): THREE.ConeGeometry {
  const baseRadius = Math.tan(angle) * distance;
  const geo = new THREE.ConeGeometry(baseRadius, distance, 32, 1, true);
  // Translate pivot to cone apex (top)
  geo.translate(0, -distance / 2, 0);
  return geo;
}

function buildBeamMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
```

### Ground halo

A radial gradient canvas texture baked once per widget:

```typescript
function buildHaloTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  grad.addColorStop(0,    'rgba(255,255,255,0.8)');
  grad.addColorStop(0.4,  'rgba(255,255,255,0.3)');
  grad.addColorStop(1.0,  'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
```

### `applySpotlightRig()`

```typescript
export function applySpotlightRig(
  state: SpotlightRigState,
  refs: SpotlightRigRefs,
  wallTimeSeconds: number,   // from AnimationTickContext.clock.wallTimeSeconds
): void {
  const { scene, cache } = refs;

  if (!state.enabled) {
    // Disable all lights without removing them — avoids Three.js re-upload next frame.
    for (const entry of cache.entries) {
      entry.light.intensity = 0;
      entry.beam.visible = false;
      if (entry.helper) entry.helper.visible = false;
    }
    if (cache.haloSprite) cache.haloSprite.visible = false;
    return;
  }

  const count = Math.max(1, Math.round(state.count));

  // ── Resize pool ───────────────────────────────────────────────────────────
  while (cache.entries.length > count) {
    const entry = cache.entries.pop()!;
    scene.remove(entry.light);
    scene.remove(entry.target);
    scene.remove(entry.beam);
    if (entry.helper) { scene.remove(entry.helper); entry.helper.dispose(); }
    entry.beam.geometry.dispose();
    (entry.beam.material as THREE.MeshBasicMaterial).dispose();
  }
  while (cache.entries.length < count) {
    const light = new THREE.SpotLight();
    const target = new THREE.Object3D();
    const geo = buildBeamGeometry(state.angle, state.distance || 60);
    const mat = buildBeamMaterial(state.beamColor, state.beamOpacity);
    const beam = new THREE.Mesh(geo, mat);
    scene.add(light);
    scene.add(target);
    scene.add(beam);
    light.target = target;
    cache.entries.push({ light, target, beam, helper: null });
  }

  // ── Per-light update ──────────────────────────────────────────────────────
  const TWO_PI = Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const entry = cache.entries[i]!;
    const { light, target, beam } = entry;

    const phase = (TWO_PI * i) / count;
    const theta = wallTimeSeconds * state.speed + phase;

    // Light source position (elevated, orbiting)
    light.position.set(
      Math.sin(theta) * state.radius,
      state.height,
      Math.cos(theta) * state.radius,
    );

    // Target position (ground plane, matching orbit in XZ)
    target.position.set(
      Math.sin(theta) * state.radius,
      state.targetY,
      Math.cos(theta) * state.radius,
    );
    target.updateMatrixWorld();

    // Light properties
    light.color.set(state.color);
    light.intensity = state.intensity;
    light.angle = state.angle;
    light.penumbra = state.penumbra;
    light.decay = state.decay;
    light.distance = state.distance;

    // castShadow: only update if changed — toggling castShadow is expensive
    // (forces a shadow map re-upload). Shadow map size is set once at creation time.
    if (light.castShadow !== state.castShadow) {
      light.castShadow = state.castShadow;
      if (state.castShadow) {
        light.shadow.mapSize.set(state.shadowMapSize, state.shadowMapSize);
        light.shadow.needsUpdate = true;
      }
    }

    // Beam cone: position at light, point toward target
    beam.visible = state.showBeam && state.beamOpacity > 0;
    if (beam.visible) {
      beam.position.copy(light.position);
      // lookAt puts -Z toward target; ConeGeometry points along +Y, so rotate X by π/2.
      _tmpVec.subVectors(target.position, light.position).normalize();
      _tmpQuat.setFromUnitVectors(_UP, _tmpVec);
      beam.quaternion.copy(_tmpQuat);

      const mat = beam.material as THREE.MeshBasicMaterial;
      mat.color.set(state.beamColor);
      mat.opacity = state.beamOpacity;
    }

    // SpotLightHelper
    if (state.showHelper && !entry.helper) {
      entry.helper = new THREE.SpotLightHelper(light);
      scene.add(entry.helper);
    } else if (!state.showHelper && entry.helper) {
      scene.remove(entry.helper);
      entry.helper.dispose();
      entry.helper = null;
    }
    if (entry.helper) {
      entry.helper.visible = true;
      entry.helper.update();
    }
  }

  // ── Halo sprite (single, centered at average target) ────────────────────
  // V1: Single halo at world origin at targetY. Phase 2: per-light halos.
  if (state.showHalo && state.haloOpacity > 0) {
    if (!cache.haloSprite) {
      cache.haloTex = buildHaloTexture();
      cache.haloSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: cache.haloTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      scene.add(cache.haloSprite);
    }
    cache.haloSprite.visible = true;
    cache.haloSprite.position.set(0, state.targetY + 0.01, 0);
    cache.haloSprite.scale.set(state.haloSize, state.haloSize, 1);
    (cache.haloSprite.material as THREE.SpriteMaterial).opacity = state.haloOpacity;
  } else if (cache.haloSprite) {
    cache.haloSprite.visible = false;
  }
}

// Module-level scratch objects to avoid per-frame allocation.
const _tmpVec = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _UP = new THREE.Vector3(0, 1, 0);
```

**Important**: Beam cone geometry and material are created once at pool growth time. If
`angle` or `distance` changes between scenes (causing a different cone shape), the
geometry must be rebuilt. The widget's `apply()` detects this by comparing the current
geometry's parameters against the incoming state — if they differ, it disposes and
rebuilds the geometry in place (not by clearing the pool). This avoids spurious
SpotLight/Object3D re-adds on every frame.

Track geometry parameters in `SpotRigEntry`:

```typescript
type SpotRigEntry = {
  light: THREE.SpotLight;
  target: THREE.Object3D;
  beam: THREE.Mesh;
  helper: THREE.SpotLightHelper | null;
  // Geometry fingerprint — rebuild cone if these change
  builtAngle: number;
  builtDistance: number;
};
```

Add a geometry rebuild check inside the per-light update loop:

```typescript
if (entry.builtAngle !== state.angle || entry.builtDistance !== state.distance) {
  entry.beam.geometry.dispose();
  entry.beam.geometry = buildBeamGeometry(state.angle, state.distance || 60);
  entry.builtAngle = state.angle;
  entry.builtDistance = state.distance;
}
```

---

## `SpotlightRigWidget.ts`

### DSL stub

```typescript
export const SpotlightRig = (_props: SpotlightRigProps): null => null;
SpotlightRig.displayName = 'SpotlightRig';
```

### Widget class

```typescript
export class SpotlightRigWidget
  implements
    ISceneElement<SpotlightRigState>,
    IRenderable<SpotlightRigState>,
    IAnimationController,
    IHasCustomDslHandler
{
  readonly widgetId: string;

  // ISceneElement
  readonly defaultState: SpotlightRigState = {
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    count: DEFAULT_SPOTLIGHT_RIG_COUNT,
    showHelper: false,
    enabled: false,   // disabled by default — enabled by disableWhenAbsent machinery
  };
  readonly transitionSpec = spotlightRigTransitionSpec;
  readonly DslComponent = SpotlightRig as React.ComponentType<SpotlightRigProps>;
  readonly disableWhenAbsent = true;

  // IAnimationController — run before default priority (lower number = earlier)
  readonly tickPriority = 10;

  constructor(widgetId = 'spotlight-rig') {
    this.widgetId = widgetId;
  }

  // CUSTOM_NODE_HANDLER — needed for theme resolution chain
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const props = node.props as SpotlightRigProps;
    // resolveObjectValues handles Resolvable<T> on every field except showHelper
    // (which is boolean, not Resolvable, and consumed at runtime)
    const resolvedProps = helpers.resolveObjectValues(
      helpers.stripUndefinedDeep(props as Record<string, unknown>),
      api.context,
    ) as SpotlightRigProps;
    const state = resolveSpotlightRigState(resolvedProps, api.context);
    api.setWidgetState(this.widgetId, state);
  };

  // IRenderable
  private threeScene: THREE.Scene | null = null;
  private cache: SpotlightRigCache | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
    this.cache = getOrCreateCache(scene as THREE.Scene, this.widgetId);
  }

  apply(_state: SpotlightRigState, _ctx: WidgetRenderContext): void {
    // Intentionally empty — rotation is driven by onTick() via clock.wallTimeSeconds.
    // apply() is called after onTick(), so the lights are already positioned correctly
    // by the time Three.js renders the frame.
    //
    // The one exception: if state.enabled === false, we need to zero intensities.
    // That is handled inside applySpotlightRig() when it receives the current state
    // from onTick(). We store the latest resolved state in lastState for onTick().
  }

  private lastState: SpotlightRigState | null = null;

  // IAnimationController
  onTick(context: AnimationTickContext): void {
    if (!this.threeScene || !this.cache) return;
    // resolvedState is populated by RuntimeDriverImpl for FunctionalTransitionSpec widgets
    const state = (context.resolvedState as SpotlightRigState | null) ?? this.defaultState;
    this.lastState = state;
    applySpotlightRig(state, { scene: this.threeScene, cache: this.cache }, context.clock.wallTimeSeconds);
  }

  dispose(): void {
    if (this.threeScene && this.cache) {
      disposeCache(this.threeScene, this.cache);
    }
    this.threeScene = null;
    this.cache = null;
    this.lastState = null;
  }
}
```

**Design note**: `apply()` is intentionally empty because `applySpotlightRig()` is
called from `onTick()`, which fires before `apply()` each frame. All Three.js state
mutations happen in `onTick`. This is the correct pattern for time-driven elements
where the compiled state is just configuration — not a per-tick baked position.

---

## Registration in `corePlugin()`

Add `SpotlightRigWidget` to `packages/core/src/player/plugins.ts`:

```typescript
import { SpotlightRigWidget } from '../elements/spotlight-rig/SpotlightRigWidget';

export function corePlugin(options?: CorePluginOptions): WidgetPlugin {
  const lightingWidget = new LightingWidget();
  const backgroundWidget = new BackgroundWidget();
  const environmentWidget = new EnvironmentWidget();
  const floorWidget = new FloorWidget();
  const cameraWidget = new CameraWidget();
  const sceneMetaWidget = new SceneMetaWidget({ ... });
  const spotlightRigWidget = new SpotlightRigWidget();

  return {
    createWidgets() {
      return [
        lightingWidget, backgroundWidget, environmentWidget,
        floorWidget, cameraWidget, sceneMetaWidget,
        spotlightRigWidget,           // ← add here
      ];
    },
    // ...
  };
}
```

**Why in `corePlugin()` rather than a separate plugin?** `disableWhenAbsent = true`
means the widget registers `enabled: false` as its default state. When no `<SpotlightRig>`
appears in any scene, `onTick` receives `state.enabled === false` and immediately
returns — zero GPU work, zero Three.js objects created. The cost of including it
unconditionally is negligible.

---

## Theme Presets

### `themes/moviePremiere.ts`

```typescript
import type { SpotlightRigTheme } from '../types';

/**
 * Movie premiere / red-carpet look: tall slow-sweeping blue-white beams,
 * dramatic narrow cone, subtle beam opacity.
 */
export const moviePremiereTheme: SpotlightRigTheme = {
  color: '#d0e8ff',
  intensity: 120,
  speed: 0.35,
  radius: 18,
  height: 30,
  targetY: 0,
  angle: Math.PI / 20,
  penumbra: 0.15,
  decay: 2.0,
  distance: 70,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.12,
  beamColor: '#e8f4ff',
  showHalo: false,
  haloOpacity: 0.25,
  haloSize: 8,
};
```

### `themes/concertStage.ts`

```typescript
import type { SpotlightRigTheme } from '../types';

/**
 * Concert stage: fast sweeping warm-white beams, wider cone,
 * more visible beam with optional halo.
 */
export const concertStageTheme: SpotlightRigTheme = {
  color: '#fff5e0',
  intensity: 150,
  speed: 1.2,
  radius: 12,
  height: 20,
  targetY: 0,
  angle: Math.PI / 10,
  penumbra: 0.4,
  decay: 2.0,
  distance: 50,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.20,
  beamColor: '#fffaf0',
  showHalo: true,
  haloOpacity: 0.35,
  haloSize: 10,
};
```

### `themes/darkGlass.ts`

Paired with `darkGlassTheme` from `@brewsite/diagram`. Sky `#100A09` (warm near-black).
Accent palette anchored on `#E36A2E` (ember orange) and `#B33A2B` (deep red). Warm
incandescent tone — like a film premiere staged in a control room.

```typescript
import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with darkGlassTheme — warm incandescent spotlights against near-black sky.
 * Slow sweep, narrow cone, ember-warm beam for a moody control-room aesthetic.
 */
export const spotlightDarkGlassTheme: SpotlightRigTheme = {
  color: '#FFD0A0',        // warm incandescent white (matches ember accent palette)
  intensity: 100,
  speed: 0.3,              // slow and deliberate
  radius: 16,
  height: 28,
  targetY: 0,
  angle: Math.PI / 18,    // ~10° — very narrow, dramatic
  penumbra: 0.20,
  decay: 2.0,
  distance: 65,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.11,
  beamColor: '#FFE8CC',   // slightly lighter than the light color
  showHalo: false,
  haloOpacity: 0.25,
  haloSize: 7,
};
```

### `themes/enterprise.ts`

Paired with `enterpriseTheme`. Sky `#0A1424` (deep navy). Accent `#4F76B8` (steel blue).
Restrained, boardroom-appropriate — cool blue-white beams, moderate pace.

```typescript
import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with enterpriseTheme — cool blue-white spotlights against deep navy sky.
 * Measured sweep, medium cone, professional and unobtrusive.
 */
export const spotlightEnterpriseTheme: SpotlightRigTheme = {
  color: '#C8D8F0',        // steel blue-white (matches #4F76B8 palette desaturated)
  intensity: 90,
  speed: 0.45,
  radius: 18,
  height: 26,
  targetY: 0,
  angle: Math.PI / 14,    // ~13° — moderate cone
  penumbra: 0.30,
  decay: 2.0,
  distance: 60,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.08,       // subtle — enterprise aesthetic is restrained
  beamColor: '#E0E8F8',
  showHalo: false,
  haloOpacity: 0.20,
  haloSize: 6,
};
```

### `themes/neonCyber.ts`

Paired with `neonCyberTheme`. Sky `#02030D` (void black). Accent palette `#00E7FF`
(electric cyan) and `#8A3DFF` (violet). Fast, tight, electric — the most dramatic rig.

```typescript
import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with neonCyberTheme — electric cyan beams against void-black sky.
 * Fast sweep, tight cone, high intensity for a sci-fi / club aesthetic.
 */
export const spotlightNeonCyberTheme: SpotlightRigTheme = {
  color: '#00E7FF',        // direct match to neonCyber edge flow color
  intensity: 160,          // high — void background can handle it
  speed: 1.4,              // fast and electric
  radius: 14,
  height: 24,
  targetY: 0,
  angle: Math.PI / 20,    // ~9° — tightest cone, laser-like
  penumbra: 0.12,          // hard edge matches the sharp neon aesthetic
  decay: 2.0,
  distance: 55,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.18,       // more visible against pure black
  beamColor: '#80F4FF',    // lighter cyan
  showHalo: true,          // halo looks great against void background
  haloOpacity: 0.40,
  haloSize: 9,
};
```

### `themes/lightMinimal.ts`

Paired with `lightMinimalTheme`. Sky `#FFFFFF` (white). A light background makes
traditional beam cones invisible and halos counter-productive. This theme uses
barely-there lights for subtle depth — or set `count={0}` to omit entirely.

```typescript
import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with lightMinimalTheme — soft warm-white spotlights on a bright background.
 * Very low intensity, no beam (invisible on light bg), no halo.
 * Primarily contributes subtle directional fill; visible effect is minimal by design.
 */
export const spotlightLightMinimalTheme: SpotlightRigTheme = {
  color: '#FFF8F0',        // barely-warm white
  intensity: 25,           // low — scene is already bright from ambient
  speed: 0.25,             // gentle, almost imperceptible
  radius: 20,
  height: 30,
  targetY: 0,
  angle: Math.PI / 8,     // wide cone — softer, less defined
  penumbra: 0.7,           // very soft edges
  decay: 2.0,
  distance: 70,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: false,         // beams are invisible and look wrong on light backgrounds
  beamOpacity: 0.0,
  beamColor: '#ffffff',
  showHalo: false,         // halos look wrong on white
  haloOpacity: 0.0,
  haloSize: 6,
};
```

### `themes/index.ts`

```typescript
export { moviePremiereTheme } from './moviePremiere';
export { concertStageTheme } from './concertStage';
export { spotlightDarkGlassTheme } from './darkGlass';
export { spotlightEnterpriseTheme } from './enterprise';
export { spotlightNeonCyberTheme } from './neonCyber';
export { spotlightLightMinimalTheme } from './lightMinimal';
```

---

## `index.ts` (public exports)

```typescript
// SpotlightRig element — public surface.
export { SpotlightRig, SpotlightRigWidget } from './SpotlightRigWidget';
export type { SpotlightRigProps } from './dsl';
export type { SpotlightRigTheme, SpotlightRigState } from './types';
export { mergeSpotlightRigTheme, DEFAULT_SPOTLIGHT_RIG_THEME } from './compile';
export {
  moviePremiereTheme, concertStageTheme,
  spotlightDarkGlassTheme, spotlightEnterpriseTheme,
  spotlightNeonCyberTheme, spotlightLightMinimalTheme,
} from './themes';
```

---

## DSL Authoring Example

```tsx
// Minimal — uses all defaults (3 lights, 0.5 rad/s, white)
<SpotlightRig />

// Preset theme
<SpotlightRig theme={moviePremiereTheme} count={4} />

// Theme + individual overrides (overrides win over theme)
<SpotlightRig
  theme={moviePremiereTheme}
  count={5}
  speed={0.8}
  castShadow={true}
  shadowMapSize={2048}
/>

// Debug: show helpers in development
<SpotlightRig theme={concertStageTheme} count={3} showHelper={true} />

// Resolvable prop (speed varies by scene index)
<SpotlightRig
  theme={moviePremiereTheme}
  count={3}
  speed={({ sceneIndex }) => sceneIndex === 0 ? 0.3 : 0.8}
/>
```

---

## Test Strategy

### `__tests__/SpotlightRigCompile.test.ts`

Tests the pure compilation layer. No mocks, no Three.js.

```
1. resolveSpotlightRigState() with no props → returns DEFAULT_SPOTLIGHT_RIG_THEME + defaults
2. resolveSpotlightRigState() with props.theme → theme values applied over defaults
3. resolveSpotlightRigState() with theme + individual override → override wins over theme
4. resolveSpotlightRigState() with Resolvable<number> speed → resolved correctly
5. showHelper prop is NOT resolved (boolean passthrough, not Resolvable)

6. spotlightRigTransitionSpec.enterFn(toState)(t=0) → intensity=0, beamOpacity=0
7. spotlightRigTransitionSpec.enterFn(toState)(t=1) → intensity=toState.intensity
8. spotlightRigTransitionSpec.exitFn(fromState)(t=1) → intensity=0
9. spotlightRigTransitionSpec.interpolateFn(from, to)(t=0.5) → midpoint intensity
10. blendSpotlightRig: discrete fields (count, castShadow, showHelper) → take `to` value
11. mergeSpotlightRigTheme() → produces merged object, neither input mutated
```

All tests use real inputs and assert real outputs. Vitest, `node` environment.

### `__tests__/SpotlightRigWidget.test.ts`

Tests the widget contract via interface-based stateful testing.

```
Setup: Construct SpotlightRigWidget. Create a mock THREE.Scene (using the
  interface-conforming scene double from runtime/mocks/ if one exists, otherwise
  a minimal plain object with userData and add/remove methods).
  Call widget.initialize({ scene: mockScene, widgetId: 'spotlight-rig', renderer: undefined }).

1. onTick with enabled=false → applySpotlightRig called, no entries created
2. onTick with count=3, enabled=true → cache.entries.length === 3 after first tick
3. onTick with count=3 then count=5 → pool grows to 5
4. onTick with count=5 then count=2 → pool shrinks to 2, removed entries disposed
5. onTick with showHelper=true → helper created and added to scene
6. onTick with showHelper=true then showHelper=false → helper removed and disposed
7. dispose() → all entries removed, cache cleared, scene references nulled
8. onTick after dispose() → no throw, no scene mutations
9. castShadow toggle → light.castShadow updated
10. Beam visibility: showBeam=false → beam.visible === false
11. Beam geometry rebuild: angle changes → geometry disposed and rebuilt
```

Use the `AnimationTickContext` factory helper from `CameraWidget.test.ts` as a reference
for constructing minimal valid tick contexts.

---

## `packages/core/src/player/index.ts` — Exports to Add

```typescript
export { SpotlightRig, SpotlightRigWidget } from '../elements/spotlight-rig';
export type { SpotlightRigProps, SpotlightRigTheme, SpotlightRigState } from '../elements/spotlight-rig';
export {
  mergeSpotlightRigTheme, DEFAULT_SPOTLIGHT_RIG_THEME,
  moviePremiereTheme, concertStageTheme,
  spotlightDarkGlassTheme, spotlightEnterpriseTheme,
  spotlightNeonCyberTheme, spotlightLightMinimalTheme,
} from '../elements/spotlight-rig';
```

---

## Files to Create

| File | Action |
|---|---|
| `packages/core/src/elements/spotlight-rig/types.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/dsl.tsx` | **Create** |
| `packages/core/src/elements/spotlight-rig/compile.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/render.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/SpotlightRigWidget.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/moviePremiere.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/concertStage.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/darkGlass.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/enterprise.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/neonCyber.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/lightMinimal.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/themes/index.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/index.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigCompile.test.ts` | **Create** |
| `packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigWidget.test.ts` | **Create** |

## Files to Modify

| File | Change |
|---|---|
| `packages/core/src/player/plugins.ts` | Add `SpotlightRigWidget` to `corePlugin()` |
| `packages/core/src/player/index.ts` | Add SpotlightRig exports |

---

## Architectural Decisions

### Why `CUSTOM_NODE_HANDLER`?
The default `dispatchToWidget` path does `{ ...existing, ...resolved }` — a shallow
merge of resolved props onto the existing widget state. This is insufficient for
`SpotlightRig` because the theme resolution chain requires:
`DEFAULT_SPOTLIGHT_RIG_THEME → props.theme → individual props`. The `CUSTOM_NODE_HANDLER`
gives the widget full control over state construction via `resolveSpotlightRigState()`.

### Why `IAnimationController` instead of `apply()`?
`apply()` receives pre-baked or closure-evaluated state from the SceneTrack. It has no
access to wall-clock time. `IAnimationController.onTick()` receives `context.clock` and
runs before `apply()` each frame — making it the correct hook for time-driven procedural
motion. `apply()` is left empty intentionally.

### Why `FunctionalTransitionSpec` (not `ElementTransitionSpec`)?
The rotation is not baked into the SceneTrack. The transition spec only needs to handle
**intensity/opacity fades** for enter/exit. `FunctionalTransitionSpec` closures are
cheap (just arithmetic on a few floats) and integrate cleanly with the existing
`blendNumber`/`blendColor` utilities.

### Why is `showHelper` in `SpotlightRigState` (not a widget field)?
Placing it in the compiled state keeps all configuration in one place and allows
different scenes to independently show/hide helpers. The alternative — storing it as a
runtime field set during `initialize()` — would mean helpers couldn't be toggled between
scenes without re-initializing the widget. The cost of passing it through the SceneTrack
is trivial (one boolean per tick slot, never interpolated).

### Why is `castShadow` change-guarded?
Toggling `castShadow` on a live `SpotLight` forces Three.js to invalidate and re-upload
the shadow map the next frame — an expensive GPU operation. The `apply` loop checks
`light.castShadow !== state.castShadow` before writing, so steady-state frames (no
change) incur no cost.

### Beam cone orientation
`ConeGeometry` points along +Y. `THREE.Object3D.lookAt()` orients -Z toward the target.
The conversion from "axis pointing at target" to "cone pointing at target" requires
computing the quaternion from the unit vector `(target - source).normalize()` and the
+Y up vector using `Quaternion.setFromUnitVectors(_UP, direction)`. This avoids the
`lookAt` + rotateX(π/2) pattern which has gimbal edge cases at straight-down alignment.

---

## Out of Scope (Phase 2)

- Per-light halos (V1 has a single centered halo)
- Color-cycled lights (animated color per light, e.g. RGB concert style)
- `ISceneLifecycle` to reset phase on scene entry (not needed for atmospheric use)
- Volumetric post-processing integration (requires `IExtraRenderPass`)
