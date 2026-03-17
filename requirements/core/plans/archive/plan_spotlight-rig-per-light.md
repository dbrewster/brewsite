---
title: "SpotlightRig Per-Light Refactor — IDslComposite with <Spotlight> Children"
doc_type: plan
owner: architect
status: ready
updated: 2026-03-12
---

# SpotlightRig Per-Light Refactor

## Summary

Refactor `SpotlightRigWidget` from a flat uniform-config element (all lights share identical settings) into an `IDslComposite` parent that accepts `<Spotlight>` child elements with per-light overrides and custom orbit functions. The public DSL changes from:

```tsx
<SpotlightRig count={5} color="#ffffff" speed={0.5} />
```

to:

```tsx
<SpotlightRig center={[0, 0, 0]} target={[0, 0, -4]} showBeam castShadow>
  <Spotlight color="#ff0000" intensity={80} orbit={(t) => [Math.sin(t * 0.5) * 4, 3, Math.cos(t * 0.7) * 6]} />
  <Spotlight color="#00ff00" intensity={60} speed={1.2} radius={3} />
  <Spotlight color="#0000ff" intensity={70} phase={Math.PI} />
</SpotlightRig>
```

**No backward compatibility.** The `count` prop is removed. `<Spotlight>` children are required — each light must be explicitly declared. `<SpotlightRig>` with zero children produces zero lights.

---

## Files to Modify or Create

### Modified files

| File | Change |
|---|---|
| `packages/core/src/elements/spotlight-rig/types.ts` | Replace flat `SpotlightRigState` with `SpotlightLightState[]` array shape |
| `packages/core/src/elements/spotlight-rig/dsl.tsx` | Add `SpotlightProps` and `Spotlight` stub; update `SpotlightRigProps.children` |
| `packages/core/src/elements/spotlight-rig/compile.ts` | Replace `resolveSpotlightRigState()` with `resolveSpotlightRig()` that returns `SpotlightRigState` with `lights[]`; update transition spec |
| `packages/core/src/elements/spotlight-rig/SpotlightRigWidget.ts` | Add `IDslComposite`, `Spotlight` DSL stub, orbit-function store, updated `CUSTOM_NODE_HANDLER` |
| `packages/core/src/elements/spotlight-rig/render.ts` | Update `applySpotlightRig()` signature to accept per-light state and orbit functions |
| `packages/core/src/elements/spotlight-rig/index.ts` | Export new `Spotlight` component and `SpotlightProps` |
| `packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigCompile.test.ts` | Full rewrite for new state shape |
| `packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigWidget.test.ts` | Full rewrite for per-light cache shape |

### New files

| File | Purpose |
|---|---|
| `packages/core/src/elements/spotlight-rig/__tests__/SpotlightRigOrbit.test.ts` | Tests for orbit function storage/lookup and per-light resolution |

---

## 1. `types.ts` — Complete Replacement

**Single responsibility:** Interface contracts only. No runtime, no Three.js, no React.

```typescript
// SpotlightRig element types — interface contracts only.

/** XYZ world-space coordinate triple. */
export type Vec3Tuple = [number, number, number];

/**
 * Theming contract for SpotlightRig.
 *
 * All cinematic settings live here AND on the DSL element.
 * Element-level props override corresponding theme values.
 * `center`, `target`, `showHelper` are intentionally absent — they are element-only.
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
  /** World-space Y position of the target ground plane (used when no per-light or rig-level target is set). */
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
 * Compiled runtime state for one individual spotlight within a SpotlightRig.
 * All properties are concrete resolved values — no Resolvable<T> here.
 *
 * `phase` and `orbit` are not part of SpotlightRigTheme because they are
 * per-light structural concerns, not visual theme values.
 */
export type SpotlightLightState = {
  /** Resolved light color. */
  color: string;
  /** Resolved intensity. */
  intensity: number;
  /** Radians per second for circular orbit. Negative = counter-clockwise. */
  speed: number;
  /** Radius of circular orbit in world units. */
  radius: number;
  /** World-space Y of the light source origin. */
  height: number;
  /** Y of the target ground plane (only used when no per-light target and no rig target). */
  targetY: number;
  /** Cone half-angle in radians. */
  angle: number;
  /** Penumbra softness (0–1). */
  penumbra: number;
  /** Decay exponent. */
  decay: number;
  /** Max reach in world units. */
  distance: number;
  /** Whether this light casts shadows. */
  castShadow: boolean;
  /** Shadow map size in pixels. */
  shadowMapSize: number;
  /** Whether the beam cone mesh is visible. */
  showBeam: boolean;
  /** Beam cone mesh opacity. */
  beamOpacity: number;
  /** Beam cone CSS color. */
  beamColor: string;
  /** Whether the ground halo is rendered. */
  showHalo: boolean;
  /** Halo sprite opacity. */
  haloOpacity: number;
  /** Halo sprite diameter in world units. */
  haloSize: number;
  /**
   * Explicit angular phase offset for circular orbit, in radians.
   * When provided, overrides the auto-distributed phase (2π × i / count).
   * Not part of the theme — structural per-light position control.
   */
  phase: number;
  /**
   * Per-light world-space target point override.
   * When null, falls back to the rig-level target, then targetY below the source.
   */
  target: Vec3Tuple | null;
};

/**
 * Compiled runtime state for one SpotlightRig.
 * Flows through the SceneTrack and is sampled each tick by the RuntimeDriver.
 *
 * `lights` replaces the old flat `SpotlightRigTheme` spread — each light is
 * fully resolved with its own color, intensity, speed, radius, etc.
 */
export type SpotlightRigState = {
  /** World-space center of the circular orbit. Default: [0, 0, 0]. Element-only — not in theme. */
  center: Vec3Tuple;
  /**
   * World-space rig-level target point. Fallback when a light has no per-light target.
   * When null and per-light target is also null, each light targets below itself at targetY.
   */
  target: Vec3Tuple | null;
  /**
   * Whether to add Three.js SpotLightHelpers to the scene.
   * Element-only debug flag — not interpolated between scenes.
   */
  showHelper: boolean;
  /**
   * Runtime enable gate — false when the widget is absent from the current scene.
   * Controlled by disableWhenAbsent = true on the widget.
   */
  enabled: boolean;
  /**
   * Per-light resolved states. Length determines the number of active spotlights.
   * Replaces the old `count` + flat theme approach.
   */
  lights: SpotlightLightState[];
};
```

**Key change:** `SpotlightRigState` no longer extends `SpotlightRigTheme`. The flat theme fields move into `SpotlightLightState`, one entry per light. `count` is removed as an explicit field — the length of `lights[]` is the count.

---

## 2. `dsl.tsx` — Add `SpotlightProps`, Update `SpotlightRigProps`

**Single responsibility:** DSL prop types only. No component function bodies, no Three.js.

```typescript
// SpotlightRig DSL prop types — no runtime logic, no Three.js.

import type { ReactNode } from 'react';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';
import type { SpotlightRigTheme, SpotlightRigState, SpotlightLightState, Vec3Tuple } from './types';

type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);

/**
 * Orbit function type for custom per-light positioning.
 *
 * Receives wall-clock time in seconds. Returns a world-space [x, y, z] position.
 * This function is NOT serialized into the SceneTrack — it is stored on the
 * widget instance and evaluated at tick time. Do not reference React state or
 * closure variables that change between renders.
 *
 * When `orbit` is provided, the `speed`, `radius`, `height`, and `phase` props
 * on the same `<Spotlight>` are ignored for position computation. `target` on
 * that light (or the rig) still applies for aim direction.
 */
export type OrbitFn = (wallTimeSeconds: number) => Vec3Tuple;

/**
 * DSL props for a single <Spotlight> child of <SpotlightRig>.
 *
 * Priority chain (highest wins):
 *   individual prop > parent <SpotlightRig> prop > theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * All SpotlightRigTheme keys are individually overridable per-light.
 * Additional per-light-only props: phase, orbit, target.
 */
export type SpotlightProps = {
  // ── Per-light-only ───────────────────────────────────────────────────────────
  /**
   * Explicit angular phase offset for circular orbit, in radians.
   * When omitted, defaults to auto-distributed phase: (2π × lightIndex / totalLights).
   * NOT in theme.
   */
  phase?: number;
  /**
   * Custom orbit function. When provided, overrides the default circular orbit
   * computation for this light. Evaluated at tick time — not baked into SceneTrack.
   * NOT in theme. NOT Resolvable — must be a plain function reference.
   */
  orbit?: OrbitFn;
  /**
   * Per-light target point. Overrides the rig-level `target` for this light only.
   * Default: null (uses rig-level target or auto-aim).
   */
  target?: Resolvable<Vec3Tuple | null>;

  // ── Theme + per-light override ───────────────────────────────────────────────
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

/**
 * DSL props for <SpotlightRig>.
 *
 * Priority chain (highest wins per theme field):
 *   individual <Spotlight> prop > rig-level prop > props.theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * When children are provided, `count` is ignored (child count determines light count).
 * When no children are provided, `count` auto-generates that many identical lights
 * from the resolved rig-level defaults.
 */
export type SpotlightRigProps = {
  // ── Element-only ──────────────────────────────────────────────────────────────
  /** World-space center of the circular orbit. Default: [0, 0, 0]. NOT in theme. */
  center?: Resolvable<Vec3Tuple>;
  /**
   * Rig-level world-space target that all spotlights aim at (unless overridden per-light).
   * Default: null (each light targets straight down below itself at `targetY`).
   */
  target?: Resolvable<Vec3Tuple | null>;
  /**
   * Number of auto-generated spotlights when no <Spotlight> children are present.
   * Ignored when children are provided. Default: 3. NOT in theme.
   */
  count?: Resolvable<number>;
  /**
   * Render Three.js SpotLightHelpers for all lights.
   * NOT Resolvable — consumed at tick time. NOT in theme.
   */
  showHelper?: boolean;

  // ── Theme + per-rig override ──────────────────────────────────────────────────
  /**
   * Base theme object. Individual props below override matching theme fields.
   * Per-light <Spotlight> props override rig-level props.
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

  /** <Spotlight> children. Each child defines one light in the rig. */
  children?: ReactNode;
};

// Re-export so consumers import from dsl.tsx without touching types.ts directly.
export type { SpotlightRigTheme, SpotlightRigState, SpotlightLightState, Vec3Tuple, OrbitFn };
```

---

## 3. `compile.ts` — Full Replacement

**Single responsibility:** Pure state resolution and transition spec. No React, no Three.js.

### Constants (unchanged from current)

`DEFAULT_SPOTLIGHT_RIG_THEME` and `DEFAULT_SPOTLIGHT_RIG_CENTER` remain identical to the current implementation. `DEFAULT_SPOTLIGHT_RIG_COUNT` remains `3`.

### New helper: `resolveSpotlightLightState()`

```typescript
/**
 * Resolves a single <Spotlight> child's props into a SpotlightLightState.
 *
 * Priority chain: lightProp > rigProp > theme > DEFAULT_SPOTLIGHT_RIG_THEME
 *
 * `phase` is passed in as a parameter because the auto-distribution formula
 * (2π × index / count) requires knowing the total count, which is determined
 * by the caller after all children have been collected.
 *
 * This function is pure: no side effects, no Three.js, no React.
 */
export function resolveSpotlightLightState(
  lightProps: SpotlightProps,
  rigProps: SpotlightRigProps,
  theme: SpotlightRigTheme,
  context: SceneSnapshotContext,
  autoPhase: number,
): SpotlightLightState {
  const r = <T>(v: T | ((ctx: SceneSnapshotContext) => T) | undefined): T | undefined =>
    typeof v === 'function' ? (v as (c: SceneSnapshotContext) => T)(context) : v;

  return {
    color:         r(lightProps.color)         ?? r(rigProps.color)         ?? theme.color,
    intensity:     r(lightProps.intensity)     ?? r(rigProps.intensity)     ?? theme.intensity,
    speed:         r(lightProps.speed)         ?? r(rigProps.speed)         ?? theme.speed,
    radius:        r(lightProps.radius)        ?? r(rigProps.radius)        ?? theme.radius,
    height:        r(lightProps.height)        ?? r(rigProps.height)        ?? theme.height,
    targetY:       r(lightProps.targetY)       ?? r(rigProps.targetY)       ?? theme.targetY,
    angle:         r(lightProps.angle)         ?? r(rigProps.angle)         ?? theme.angle,
    penumbra:      r(lightProps.penumbra)      ?? r(rigProps.penumbra)      ?? theme.penumbra,
    decay:         r(lightProps.decay)         ?? r(rigProps.decay)         ?? theme.decay,
    distance:      r(lightProps.distance)      ?? r(rigProps.distance)      ?? theme.distance,
    castShadow:    r(lightProps.castShadow)    ?? r(rigProps.castShadow)    ?? theme.castShadow,
    shadowMapSize: r(lightProps.shadowMapSize) ?? r(rigProps.shadowMapSize) ?? theme.shadowMapSize,
    showBeam:      r(lightProps.showBeam)      ?? r(rigProps.showBeam)      ?? theme.showBeam,
    beamOpacity:   r(lightProps.beamOpacity)   ?? r(rigProps.beamOpacity)   ?? theme.beamOpacity,
    beamColor:     r(lightProps.beamColor)     ?? r(rigProps.beamColor)     ?? theme.beamColor,
    showHalo:      r(lightProps.showHalo)      ?? r(rigProps.showHalo)      ?? theme.showHalo,
    haloOpacity:   r(lightProps.haloOpacity)   ?? r(rigProps.haloOpacity)   ?? theme.haloOpacity,
    haloSize:      r(lightProps.haloSize)      ?? r(rigProps.haloSize)      ?? theme.haloSize,
    phase:         lightProps.phase             ?? autoPhase,
    target:        r(lightProps.target)         ?? null,
  };
}
```

Note: `orbit` is intentionally absent from `SpotlightLightState` and therefore not processed here. It is extracted separately in the `CUSTOM_NODE_HANDLER` and stored on the widget instance.

### New resolver: `resolveSpotlightRig()`

Replaces `resolveSpotlightRigState()`. Takes `lightPropsList` (already extracted from JSX children by the handler) rather than the raw JSX node.

```typescript
/**
 * Resolves SpotlightRigProps and an optional list of per-light SpotlightProps
 * into SpotlightRigState.
 *
 * When lightPropsList is empty (no <Spotlight> children), auto-generates
 * `count` identical lights from rig-level defaults.
 *
 * This function is pure — the caller is responsible for extracting JSX children.
 */
export function resolveSpotlightRig(
  rigProps: SpotlightRigProps,
  lightPropsList: SpotlightProps[],
  context: SceneSnapshotContext,
): SpotlightRigState {
  const base = DEFAULT_SPOTLIGHT_RIG_THEME;
  const theme: SpotlightRigTheme = rigProps.theme ? { ...base, ...rigProps.theme } : base;

  const r = <T>(v: T | ((ctx: SceneSnapshotContext) => T) | undefined): T | undefined =>
    typeof v === 'function' ? (v as (c: SceneSnapshotContext) => T)(context) : v;

  const center: Vec3Tuple = r(rigProps.center) ?? DEFAULT_SPOTLIGHT_RIG_CENTER;
  const target: Vec3Tuple | null = r(rigProps.target) ?? null;
  const showHelper = rigProps.showHelper ?? false;

  let lights: SpotlightLightState[];

  if (lightPropsList.length > 0) {
    // Children present — one SpotlightLightState per <Spotlight> child.
    lights = lightPropsList.map((lightProps, i) => {
      const autoPhase = (Math.PI * 2 * i) / lightPropsList.length;
      return resolveSpotlightLightState(lightProps, rigProps, theme, context, autoPhase);
    });
  } else {
    // No children — auto-generate `count` identical lights from rig defaults.
    const count = Math.max(1, Math.round(r(rigProps.count) ?? DEFAULT_SPOTLIGHT_RIG_COUNT));
    lights = Array.from({ length: count }, (_, i) => {
      const autoPhase = (Math.PI * 2 * i) / count;
      return resolveSpotlightLightState({}, rigProps, theme, context, autoPhase);
    });
  }

  return { center, target, showHelper, enabled: true, lights };
}
```

### Updated transition spec

The transition spec changes from blending a flat state to blending per-light arrays. Use `FunctionalTransitionSpec<SpotlightRigState>`.

```typescript
/**
 * Blends two SpotlightLightState arrays.
 *
 * Rules:
 * - Matching indices: blend all numeric/color fields.
 * - Extra lights in `to` (new lights): enter by fading intensity from 0.
 * - Extra lights in `from` (removed lights): exit by fading intensity to 0.
 * - Discrete fields (castShadow, shadowMapSize, showBeam, showHalo): take `to` value.
 *
 * Phase and target are NOT blended — they are discrete structural fields.
 */
function blendLights(
  from: SpotlightLightState[],
  to: SpotlightLightState[],
  t: number,
): SpotlightLightState[] {
  const maxLen = Math.max(from.length, to.length);
  const result: SpotlightLightState[] = [];
  for (let i = 0; i < maxLen; i++) {
    const f = from[i];
    const toLight = to[i];
    if (f && toLight) {
      // Both present — full blend.
      result.push({
        ...toLight,
        color:        blendColor(f.color, toLight.color, t) ?? toLight.color,
        intensity:    blendNumber(f.intensity, toLight.intensity, t) ?? toLight.intensity,
        speed:        blendNumber(f.speed, toLight.speed, t) ?? toLight.speed,
        radius:       blendNumber(f.radius, toLight.radius, t) ?? toLight.radius,
        height:       blendNumber(f.height, toLight.height, t) ?? toLight.height,
        targetY:      blendNumber(f.targetY, toLight.targetY, t) ?? toLight.targetY,
        angle:        blendNumber(f.angle, toLight.angle, t) ?? toLight.angle,
        penumbra:     blendNumber(f.penumbra, toLight.penumbra, t) ?? toLight.penumbra,
        decay:        blendNumber(f.decay, toLight.decay, t) ?? toLight.decay,
        distance:     blendNumber(f.distance, toLight.distance, t) ?? toLight.distance,
        beamOpacity:  blendNumber(f.beamOpacity, toLight.beamOpacity, t) ?? toLight.beamOpacity,
        beamColor:    blendColor(f.beamColor, toLight.beamColor, t) ?? toLight.beamColor,
        haloOpacity:  blendNumber(f.haloOpacity, toLight.haloOpacity, t) ?? toLight.haloOpacity,
        haloSize:     blendNumber(f.haloSize, toLight.haloSize, t) ?? toLight.haloSize,
        // Discrete: take to value
        castShadow:    toLight.castShadow,
        shadowMapSize: toLight.shadowMapSize,
        showBeam:      toLight.showBeam,
        showHalo:      toLight.showHalo,
        phase:         toLight.phase,
        target:        toLight.target,
      });
    } else if (f && !toLight) {
      // Removed light — fade out intensity.
      result.push({
        ...f,
        intensity:   blendNumber(f.intensity, 0, t) ?? 0,
        beamOpacity: blendNumber(f.beamOpacity, 0, t) ?? 0,
        haloOpacity: blendNumber(f.haloOpacity, 0, t) ?? 0,
      });
    } else if (!f && toLight) {
      // New light — fade in intensity.
      result.push({
        ...toLight,
        intensity:   blendNumber(0, toLight.intensity, t) ?? toLight.intensity,
        beamOpacity: blendNumber(0, toLight.beamOpacity, t) ?? toLight.beamOpacity,
        haloOpacity: blendNumber(0, toLight.haloOpacity, t) ?? toLight.haloOpacity,
      });
    }
  }
  return result;
}

/**
 * Functional transition spec for SpotlightRig.
 *
 * enter/exit: fade all lights' intensity, beamOpacity, haloOpacity to/from zero.
 * interpolate: per-light blend with fade-in/out for count mismatches.
 */
export const spotlightRigTransitionSpec: FunctionalTransitionSpec<SpotlightRigState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    lights: from.lights.map((light) => ({
      ...light,
      intensity:   blendNumber(light.intensity,   0, t) ?? 0,
      beamOpacity: blendNumber(light.beamOpacity, 0, t) ?? 0,
      haloOpacity: blendNumber(light.haloOpacity, 0, t) ?? 0,
    })),
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    lights: to.lights.map((light) => ({
      ...light,
      intensity:   blendNumber(0, light.intensity,   t) ?? light.intensity,
      beamOpacity: blendNumber(0, light.beamOpacity, t) ?? light.beamOpacity,
      haloOpacity: blendNumber(0, light.haloOpacity, t) ?? light.haloOpacity,
    })),
  }),
  interpolateFn: (from, to) => ({ t }) => ({
    ...to,
    center: [
      blendNumber(from.center[0], to.center[0], t) ?? to.center[0],
      blendNumber(from.center[1], to.center[1], t) ?? to.center[1],
      blendNumber(from.center[2], to.center[2], t) ?? to.center[2],
    ],
    target: from.target && to.target ? [
      blendNumber(from.target[0], to.target[0], t) ?? to.target[0],
      blendNumber(from.target[1], to.target[1], t) ?? to.target[1],
      blendNumber(from.target[2], to.target[2], t) ?? to.target[2],
    ] : to.target,
    lights: blendLights(from.lights, to.lights, t),
  }),
};
```

Keep `mergeSpotlightRigTheme()` unchanged. It still applies to the theme preset pattern.

### Updated `defaultState` in `compile.ts`

```typescript
export const DEFAULT_SPOTLIGHT_RIG_LIGHTS: SpotlightLightState[] = Array.from(
  { length: DEFAULT_SPOTLIGHT_RIG_COUNT },
  (_, i) => ({
    ...DEFAULT_SPOTLIGHT_RIG_THEME,
    phase: (Math.PI * 2 * i) / DEFAULT_SPOTLIGHT_RIG_COUNT,
    target: null,
  }),
);

export const DEFAULT_SPOTLIGHT_RIG_STATE: SpotlightRigState = {
  center: DEFAULT_SPOTLIGHT_RIG_CENTER,
  target: null,
  showHelper: false,
  enabled: false,
  lights: DEFAULT_SPOTLIGHT_RIG_LIGHTS,
};
```

---

## 4. `SpotlightRigWidget.ts` — Full Replacement

**Single responsibility:** `IWidget` implementation — bridges compile state to render. Houses orbit-function store.

### Orbit Function Storage Mechanism

Orbit functions cannot be serialized into `SceneTrack`. The widget stores them in a nested map keyed by `sceneIndex → lightIndex`:

```typescript
/** Scene-indexed orbit function store. Populated by CUSTOM_NODE_HANDLER at compile time. */
type OrbitFnStore = Map<number, Map<number, OrbitFn>>;
```

The `CUSTOM_NODE_HANDLER` fires once per scene during compilation. It extracts `orbit` from each `<Spotlight>` child's props and calls `this._storeOrbitFn(context.sceneIndex, lightIndex, orbitFn)`.

At tick time, `onTick()` reads `this._orbitStore.get(sceneIndex)` to obtain the per-light orbit functions for the current scene, and passes them to `applySpotlightRig()` as an optional `orbitFns` parameter.

### DSL Stub Components

Both `SpotlightRig` and `Spotlight` are null-returning stub components defined in `SpotlightRigWidget.ts`:

```typescript
/** DSL stub — renders null; all output is Three.js via onTick(). */
export const SpotlightRig = (_props: SpotlightRigProps): null => null;
SpotlightRig.displayName = 'SpotlightRig';

/** DSL stub — child of <SpotlightRig>; must not be used at the top level. */
export const Spotlight = (_props: SpotlightProps): null => null;
Spotlight.displayName = 'Spotlight';
```

### Complete Widget Class

```typescript
export class SpotlightRigWidget
  implements
    ISceneElement<SpotlightRigState>,
    IRenderable<SpotlightRigState>,
    IAnimationController,
    IDslComposite,
    IHasCustomDslHandler
{
  readonly widgetId: string;

  // ── ISceneElement ────────────────────────────────────────────────────────────

  readonly defaultState: SpotlightRigState = DEFAULT_SPOTLIGHT_RIG_STATE;
  readonly transitionSpec = spotlightRigTransitionSpec;
  readonly DslComponent = SpotlightRig as React.ComponentType<SpotlightRigProps>;
  readonly disableWhenAbsent = true;

  mergeSnapshot(
    prev: SpotlightRigState | undefined,
    next: SpotlightRigState | undefined,
  ): SpotlightRigState | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    if (!prev) return next;
    // Shallow-merge rig-level fields; replace lights[] entirely from next.
    return { ...prev, ...next };
  }

  // ── IDslComposite ────────────────────────────────────────────────────────────

  readonly childDslComponents: IDslComposite['childDslComponents'] = [
    {
      component: Spotlight as React.ComponentType<unknown>,
      displayName: 'Spotlight',
      topLevelError: true,   // <Spotlight> outside <SpotlightRig> is an error
    },
  ];

  // ── IAnimationController ─────────────────────────────────────────────────────

  readonly tickPriority = 10;

  // ── Orbit function store ─────────────────────────────────────────────────────

  /**
   * Per-scene, per-light orbit function store.
   * Key: sceneIndex → Map<lightIndex, OrbitFn>.
   * Populated by CUSTOM_NODE_HANDLER during compilation.
   * Read by onTick() each frame.
   */
  private _orbitStore: OrbitFnStore = new Map();

  /**
   * Stores an orbit function for a specific scene and light index.
   * Called from CUSTOM_NODE_HANDLER.
   */
  storeOrbitFn(sceneIndex: number, lightIndex: number, fn: OrbitFn): void {
    let sceneMap = this._orbitStore.get(sceneIndex);
    if (!sceneMap) {
      sceneMap = new Map();
      this._orbitStore.set(sceneIndex, sceneMap);
    }
    sceneMap.set(lightIndex, fn);
  }

  /**
   * Returns the orbit functions for all lights in the given scene, as a sparse
   * array where index matches light index. Lights without a custom orbit function
   * have undefined at their index.
   */
  getOrbitFns(sceneIndex: number): (OrbitFn | undefined)[] {
    const sceneMap = this._orbitStore.get(sceneIndex);
    if (!sceneMap) return [];
    // Determine the maximum light index stored.
    let maxIndex = -1;
    for (const k of sceneMap.keys()) {
      if (k > maxIndex) maxIndex = k;
    }
    if (maxIndex < 0) return [];
    const result: (OrbitFn | undefined)[] = new Array(maxIndex + 1).fill(undefined);
    for (const [idx, fn] of sceneMap.entries()) {
      result[idx] = fn;
    }
    return result;
  }

  // ── CUSTOM_NODE_HANDLER ──────────────────────────────────────────────────────

  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    const rigProps = node.props as SpotlightRigProps;
    const sceneIndex = api.context.sceneIndex;
    const children = helpers.collectChildren(node);

    const lightPropsList: SpotlightProps[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!isValidElement(child)) continue;
      const childEl = child as React.ReactElement;
      if (childEl.type !== Spotlight) continue;

      const rawLightProps = childEl.props as SpotlightProps;

      // Extract orbit function BEFORE resolveObjectValues — it is a function
      // that should NOT be resolved as a Resolvable<T> value.
      if (typeof rawLightProps.orbit === 'function') {
        this.storeOrbitFn(sceneIndex, i, rawLightProps.orbit);
      }

      // Resolve all Resolvable<T> props, excluding orbit (not serializable).
      const { orbit: _orbit, ...serializableLightProps } = rawLightProps;
      const resolved = helpers.resolveObjectValues(
        helpers.stripUndefinedDeep(serializableLightProps as Record<string, unknown>),
        api.context,
      ) as SpotlightProps;

      lightPropsList.push(resolved);
    }

    // Resolve rig-level props for theme chain and center/target.
    const resolvedRigProps = helpers.resolveObjectValues(
      helpers.stripUndefinedDeep(
        // Exclude children from resolution — they are JSX nodes, not serializable values.
        (({ children: _c, ...rest }) => rest)(rigProps as Record<string, unknown>),
      ),
      api.context,
    ) as SpotlightRigProps;

    const state = resolveSpotlightRig(resolvedRigProps, lightPropsList, api.context);
    api.setWidgetState(this.widgetId, state);
  };

  // ── Constructor ──────────────────────────────────────────────────────────────

  constructor(widgetId = 'spotlight-rig') {
    this.widgetId = widgetId;
  }

  // ── IRenderable ──────────────────────────────────────────────────────────────

  private threeScene: THREE.Scene | null = null;
  private cache: ReturnType<typeof getOrCreateCache> | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
    this.cache = getOrCreateCache(scene as THREE.Scene, this.widgetId);
  }

  /**
   * Intentionally empty.
   *
   * All Three.js mutations happen in onTick() which fires before apply() each frame.
   * SpotlightRig is entirely time-driven: compiled state is configuration, not position.
   */
  apply(_state: SpotlightRigState, _ctx: WidgetRenderContext): void {
    // Intentionally empty — see JSDoc above.
  }

  dispose(): void {
    if (this.threeScene && this.cache) {
      disposeCache(this.threeScene, this.cache);
    }
    this.threeScene = null;
    this.cache = null;
    this._orbitStore.clear();
  }

  // ── IAnimationController ─────────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    if (!this.threeScene || !this.cache) return;
    const state = (context.resolvedState as SpotlightRigState | null) ?? this.defaultState;
    const sceneIndex = context.tick?.sceneIndex ?? 0;
    const orbitFns = this.getOrbitFns(sceneIndex);
    const refs: SpotlightRigRefs = { scene: this.threeScene, cache: this.cache };
    applySpotlightRig(state, refs, context.clock.wallTimeSeconds, orbitFns);
  }
}
```

**Important implementation note on `tick?.sceneIndex`:** The `SceneTrackTick` type must expose `sceneIndex`. Check `packages/core/src/compiler/sceneTrackTypes.ts` — if `sceneIndex` is not present on `SceneTrackTick`, read it from `context.track` via `track?.ticks.indexOf(context.tick)` or use a different approach. The simplest safe fallback: store the most-recently-seen sceneIndex as a widget instance field and update it in `onTick()` when `context.tick?.sceneIndex` is defined.

The precise implementation of sceneIndex extraction from tick context must be verified against the actual `SceneTrackTick` type before coding. If `sceneIndex` is not available on the tick, fall back to:

```typescript
// In onTick():
if (context.tick && 'sceneIndex' in context.tick) {
  this._lastSceneIndex = (context.tick as { sceneIndex: number }).sceneIndex;
}
const orbitFns = this.getOrbitFns(this._lastSceneIndex);
```

with `private _lastSceneIndex = 0;` declared on the class. Verify the actual field name in `sceneTrackTypes.ts` before implementing.

---

## 5. `render.ts` — Updated `applySpotlightRig()` Signature

**Single responsibility:** Three.js scene management. No React, no compile.ts imports.

### Updated Cache Structure

`SpotRigEntry` and `SpotlightRigCache` remain structurally identical to the current implementation. The cache entries are still keyed by array index. The light pool grow/shrink logic still applies.

### Updated Function Signature

```typescript
/**
 * Applies SpotlightRigState to the Three.js scene for the given wall-clock time.
 * Called once per frame from SpotlightRigWidget.onTick().
 *
 * @param state           - Current per-light compiled state from SceneTrack.
 * @param refs            - Scene + cache references from widget instance.
 * @param wallTimeSeconds - Monotonically increasing wall clock (not scene-relative).
 * @param orbitFns        - Optional sparse array of custom orbit functions, indexed
 *                          by light index. Undefined entries use default circular orbit.
 */
export function applySpotlightRig(
  state: SpotlightRigState,
  refs: SpotlightRigRefs,
  wallTimeSeconds: number,
  orbitFns?: (OrbitFn | undefined)[],
): void { ... }
```

### Per-Light Iteration — Replacing Uniform Logic

The current implementation uses `state.count` and a single set of uniform properties. Replace the per-light update block as follows:

**Pool resize:** Replace `const count = Math.max(1, Math.round(state.count))` with `const count = state.lights.length`. The grow/shrink loop uses `state.lights[cache.entries.length]` for the initial geometry when growing.

**Per-light update block:** Each `SpotRigEntry` now reads from `state.lights[i]` instead of the flat `state`. The orbit position calculation becomes:

```typescript
for (let i = 0; i < count; i++) {
  const entry = cache.entries[i]!;
  const light = state.lights[i]!;
  const { light: threeLight, target: threeTarget, beam } = entry;

  // Position computation
  const orbitFn = orbitFns?.[i];
  let lightPos: Vec3Tuple;
  if (orbitFn) {
    // Custom orbit function — evaluate at wall time and offset by rig center.
    const raw = orbitFn(wallTimeSeconds);
    lightPos = [
      state.center[0] + raw[0],
      state.center[1] + raw[1],
      state.center[2] + raw[2],
    ];
  } else {
    // Default circular orbit: phase from light.phase, speed from light.speed.
    const theta = wallTimeSeconds * light.speed + light.phase;
    lightPos = [
      state.center[0] + Math.sin(theta) * light.radius,
      state.center[1] + light.height,
      state.center[2] + Math.cos(theta) * light.radius,
    ];
  }
  threeLight.position.set(lightPos[0], lightPos[1], lightPos[2]);

  // Target computation
  // Priority: per-light target > rig-level target > auto-aim below source
  const effectiveTarget = light.target ?? state.target;
  if (effectiveTarget) {
    threeTarget.position.set(effectiveTarget[0], effectiveTarget[1], effectiveTarget[2]);
  } else {
    // Auto-aim: straight down to targetY (or straight below source for orbit fn lights)
    if (orbitFn) {
      threeTarget.position.set(lightPos[0], state.center[1] + light.targetY, lightPos[2]);
    } else {
      const theta = wallTimeSeconds * light.speed + light.phase;
      threeTarget.position.set(
        state.center[0] + Math.sin(theta) * light.radius,
        state.center[1] + light.targetY,
        state.center[2] + Math.cos(theta) * light.radius,
      );
    }
  }
  threeTarget.updateMatrixWorld();

  // Per-light properties (replacing flat state.* references)
  const colorParsed = parseHexColor(light.color);
  threeLight.color.set(colorParsed.rgb);
  threeLight.intensity = light.intensity * colorParsed.alpha;
  threeLight.angle = light.angle;
  threeLight.penumbra = light.penumbra;
  threeLight.decay = light.decay;
  threeLight.distance = light.distance;

  if (threeLight.castShadow !== light.castShadow) {
    threeLight.castShadow = light.castShadow;
    if (light.castShadow) {
      threeLight.shadow.mapSize.set(light.shadowMapSize, light.shadowMapSize);
      threeLight.shadow.needsUpdate = true;
    }
  }

  // Beam geometry rebuild using per-light angle and distance
  if (entry.builtAngle !== light.angle || entry.builtDistance !== light.distance) {
    entry.beam.geometry.dispose();
    entry.beam.geometry = buildBeamGeometry(light.angle, light.distance || 60);
    entry.builtAngle = light.angle;
    entry.builtDistance = light.distance;
  }

  beam.visible = light.showBeam && light.beamOpacity > 0;
  if (beam.visible) {
    beam.position.set(lightPos[0], lightPos[1], lightPos[2]);
    _tmpVec.subVectors(threeTarget.position, threeLight.position).normalize();
    _tmpQuat.setFromUnitVectors(_CONE_AXIS, _tmpVec);
    beam.quaternion.copy(_tmpQuat);

    const mat = beam.material as THREE.MeshBasicMaterial;
    const beamParsed = parseHexColor(light.beamColor);
    mat.color.set(beamParsed.rgb);
    mat.opacity = light.beamOpacity * beamParsed.alpha;
  }

  // showHelper — uses rig-level flag (not per-light)
  if (state.showHelper && !entry.helper) {
    entry.helper = new THREE.SpotLightHelper(threeLight);
    markAsFloorPart(entry.helper);
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
```

**Halo sprite:** The halo sprite is currently a single centered sprite. For the per-light refactor, maintain the single-halo behavior as before (Phase 2 per-light halos is a future work item, per the existing code comment). The halo reads from the first light's `showHalo`, `haloOpacity`, and `haloSize` for backward compatibility, falling back to `state.lights[0]` values. If `state.lights` is empty, hide the halo.

```typescript
const firstLight = state.lights[0];
if (firstLight && firstLight.showHalo && firstLight.haloOpacity > 0) {
  // ... halo creation/update using firstLight.haloOpacity, firstLight.haloSize
  cache.haloSprite.position.set(
    state.center[0],
    state.center[1] + firstLight.targetY + 0.01,
    state.center[2],
  );
  cache.haloSprite.scale.set(firstLight.haloSize, firstLight.haloSize, 1);
  (cache.haloSprite.material as THREE.SpriteMaterial).opacity = firstLight.haloOpacity;
} else if (cache.haloSprite) {
  cache.haloSprite.visible = false;
}
```

**Pool grow — initial geometry from first-light state:** When adding a new entry to the pool, use `state.lights[cache.entries.length]` for the initial geometry:

```typescript
while (cache.entries.length < count) {
  const lightState = state.lights[cache.entries.length]!;
  const threeLight = new THREE.SpotLight();
  const target = new THREE.Object3D();
  const geo = buildBeamGeometry(lightState.angle, lightState.distance || 60);
  const mat = buildBeamMaterial(lightState.beamColor, lightState.beamOpacity);
  const beam = new THREE.Mesh(geo, mat);
  markAsFloorPart(threeLight);
  markAsFloorPart(target);
  markAsFloorPart(beam);
  scene.add(threeLight);
  scene.add(target);
  scene.add(beam);
  threeLight.target = target;
  cache.entries.push({
    light: threeLight, target, beam, helper: null,
    builtAngle: lightState.angle,
    builtDistance: lightState.distance,
  });
}
```

The `OrbitFn` type must be imported into `render.ts` from `./dsl` or from `./types`. The cleanest option: define `OrbitFn` in `types.ts` (it has no React or DSL dependency — it's a pure function type), then import it from `./types` in both `render.ts` and `dsl.tsx`.

**Move `OrbitFn` to `types.ts`:**

```typescript
// In types.ts
/**
 * Custom orbit function for a single spotlight.
 * Receives wall-clock time in seconds, returns world-space [x, y, z].
 * Stored on the widget instance — not serialized into SceneTrack.
 */
export type OrbitFn = (wallTimeSeconds: number) => Vec3Tuple;
```

This does not violate the `types.ts` prohibition on runtime imports — `OrbitFn` is a pure function type with no Three.js or React dependency.

---

## 6. `index.ts` — Updated Public Surface

```typescript
// SpotlightRig element — public surface.
export { SpotlightRig, Spotlight, SpotlightRigWidget } from './SpotlightRigWidget';
export type { SpotlightRigProps, SpotlightProps } from './dsl';
export type {
  SpotlightRigTheme,
  SpotlightRigState,
  SpotlightLightState,
  OrbitFn,
  Vec3Tuple as SpotlightRigVec3,
} from './types';
export {
  mergeSpotlightRigTheme,
  DEFAULT_SPOTLIGHT_RIG_THEME,
  DEFAULT_SPOTLIGHT_RIG_STATE,
} from './compile';
export {
  moviePremiereTheme, concertStageTheme,
  spotlightDarkGlassTheme, spotlightEnterpriseTheme,
  spotlightNeonCyberTheme, spotlightLightMinimalTheme,
} from './themes';
```

---

## 7. Theme Presets — No Changes Needed

All six theme presets (`moviePremiere.ts`, `concertStage.ts`, `darkGlass.ts`, `enterprise.ts`, `neonCyber.ts`, `lightMinimal.ts`) only export `SpotlightRigTheme` objects. `SpotlightRigTheme` itself is not changing — the type definition remains identical. No theme file needs modification.

---

## 8. `plugins.ts` — No Changes Needed

`corePlugin()` already instantiates `new SpotlightRigWidget()`. No change required.

---

## 9. Test Strategy

### Test Files to Rewrite

#### `__tests__/SpotlightRigCompile.test.ts`

Full rewrite. All tests now operate on `SpotlightRigState.lights[]` rather than the flat state shape. The file must import `resolveSpotlightRig` (replacing `resolveSpotlightRigState`) and `resolveSpotlightLightState`.

**Specific test cases required:**

**`resolveSpotlightRig` — no children:**
- Empty props produce `lights` array of length `DEFAULT_SPOTLIGHT_RIG_COUNT` (3).
- Each light has theme defaults.
- Auto-phase: `lights[0].phase === 0`, `lights[1].phase === (2π/3)`, `lights[2].phase === (4π/3)`.
- `props.count = 5` produces `lights` array of length 5.
- `props.theme` applies theme values to all generated lights.
- Rig-level `color` override applies to all generated lights.

**`resolveSpotlightRig` — with children:**
- Two children produce `lights` array of length 2.
- `count` prop is ignored when children are present.
- Per-light `color` override wins over rig-level `color`.
- Per-light `color` override wins over theme `color`.
- Rig-level `color` applies to lights that do not override it.
- Per-light `target` is resolved into `lights[i].target`; `null` when absent.
- Per-light `phase` explicit value overrides auto-distribution.
- Resolvable props on children are resolved using context.

**`resolveSpotlightLightState` — unit tests:**
- With all props absent: uses rig defaults, then theme defaults.
- With light-level `intensity`: wins over rig and theme.
- With rig-level `intensity` and no light-level override: rig value used.
- With only theme: theme value used.
- `phase` explicit: returned as-is. `phase` absent: `autoPhase` argument used.

**`spotlightRigTransitionSpec` — updated for `lights[]`:**
- `enterFn` at t=0: all lights have intensity=0, beamOpacity=0, haloOpacity=0.
- `enterFn` at t=1: all lights have their `toState` intensity and opacity.
- `exitFn` at t=1: all lights have intensity=0, beamOpacity=0, haloOpacity=0.
- `interpolateFn` at t=0.5 with matching light counts: midpoint intensities.
- `interpolateFn` with `from.lights.length = 2`, `to.lights.length = 4`:
  - Result has length 4.
  - Lights 0 and 1 are blended.
  - Lights 2 and 3 fade in (intensity at t=0.5 is half of toState intensity).
- `interpolateFn` with `from.lights.length = 4`, `to.lights.length = 2`:
  - Result has length 4.
  - Lights 0 and 1 are blended.
  - Lights 2 and 3 fade out (intensity at t=0.5 is half of fromState intensity).
- Discrete field `castShadow`: takes `to` value at all t values.
- `center` interpolation: [0,0,0] → [4,0,0] at t=0.5 produces [2,0,0].
- `target` interpolation: null → [1,2,3] takes `to.target` (null→non-null discrete).
- `target` interpolation: [0,0,-4] → [0,0,-8] at t=0.5 produces [0,0,-6].

**`mergeSpotlightRigTheme` — unchanged tests (keep as-is).**

#### `__tests__/SpotlightRigWidget.test.ts`

Full rewrite. The `MockScene` helper is unchanged. Replace `makeState()` to produce `SpotlightRigState` with `lights[]`.

**New `makeState()` helper:**

```typescript
const makeLightState = (overrides: Partial<SpotlightLightState> = {}): SpotlightLightState => ({
  ...DEFAULT_SPOTLIGHT_RIG_THEME,
  phase: 0,
  target: null,
  showHalo: false,
  haloOpacity: 0,
  ...overrides,
});

const makeState = (
  lightOverrides: Partial<SpotlightLightState>[] = [{}],
  rigOverrides: Partial<Omit<SpotlightRigState, 'lights'>> = {},
): SpotlightRigState => ({
  center: [0, 0, 0],
  target: null,
  showHelper: false,
  enabled: true,
  lights: lightOverrides.map(makeLightState),
  ...rigOverrides,
});
```

**Specific test cases required:**

- `widgetId` and `tickPriority` — same as current.
- `defaultState.enabled === false` — same as current.
- `IDslComposite.childDslComponents` has one entry with `displayName: 'Spotlight'` and `topLevelError: true`.
- `onTick` with `enabled=false`: pool remains empty.
- `onTick` with 3 lights: cache has 3 entries.
- `onTick` with 3 lights then 5 lights: pool grows to 5.
- `onTick` with 5 lights then 2 lights: pool shrinks to 2; removed lights not in scene.
- `showHelper` toggle — same logic as current but reads `state.showHelper`.
- `dispose` clears entries and orbit store.
- `onTick` after `dispose` does not throw.
- `castShadow` toggle reads from `lights[0].castShadow` — same observable behavior.
- `showBeam=false` reads from `lights[0].showBeam`.
- Angle change triggers geometry rebuild using `lights[0].angle`.
- `mergeSnapshot` — same four cases as current (both undefined, prev only, next only, shallow merge).

**Orbit function store tests:**
- `storeOrbitFn(0, 0, fn)` then `getOrbitFns(0)` returns array with `fn` at index 0.
- `storeOrbitFn(0, 0, fn0)`, `storeOrbitFn(0, 2, fn2)`: `getOrbitFns(0)` returns `[fn0, undefined, fn2]`.
- `storeOrbitFn(1, 0, fn)` does not affect `getOrbitFns(0)`.
- After `dispose()`, `getOrbitFns(0)` returns `[]`.

**Orbit function render tests:**
- `onTick` with a custom orbit fn: the light's `position` is set to the orbit fn's return value + center offset.
- `onTick` with no orbit fn: light is positioned at the circular orbit formula.

#### `__tests__/SpotlightRigOrbit.test.ts` (new file)

Tests for `CUSTOM_NODE_HANDLER` orbit extraction and per-light resolution. These tests exercise the handler in isolation using a minimal `CompileApi` / `CompileHelpers` stub (following the `NodeHandler` test pattern documented in testing philosophy).

**Specific test cases required:**

- Handler with `<SpotlightRig>` + two `<Spotlight>` children: `api.setWidgetState` called with `lights` array of length 2.
- Handler with `<SpotlightRig count={4}>` + no children: `api.setWidgetState` called with `lights` array of length 4.
- Handler with `<Spotlight orbit={fn}>`: `widget._orbitStore` contains the fn at `sceneIndex → 0`.
- Handler with `<Spotlight orbit={fn0}>` and `<Spotlight orbit={fn1}>`: both fns stored at indices 0 and 1.
- Handler with `<Spotlight>` (no orbit): orbit store is empty for that scene.
- Handler fires twice (simulating two different scenes): orbit store maps both scene indices independently.
- Non-`<Spotlight>` children are skipped silently.

**Minimal test double for `CompileApi`:**

```typescript
// A real minimal implementation that satisfies CompileApi contract for testing.
const makeApi = (sceneIndex = 0): {
  api: CompileApi;
  capturedWidgetState: Map<string, unknown>;
} => {
  const captured = new Map<string, unknown>();
  const api: CompileApi = {
    context: { sceneIndex, numScenes: 3, assetsReady: true },
    state: { widgets: {} } as never,
    setWidgetState: (id, s) => { captured.set(id, s); },
    pushHudItem: () => {},
    pushLabel: () => {},
    setSceneMeta: () => {},
  };
  return { api, capturedWidgetState: captured };
};
```

---

## 10. Backward Compatibility: `count` Without Children

When `<SpotlightRig count={N}>` is used without `<Spotlight>` children, `resolveSpotlightRig()` checks `lightPropsList.length === 0` and falls back to auto-generating `count` lights from rig-level defaults. This is verified in `SpotlightRigCompile.test.ts` (`resolveSpotlightRig — no children` section).

All existing per-element theme overrides (`color`, `intensity`, `speed`, etc.) on `<SpotlightRig>` continue to work — they propagate to all auto-generated lights via `resolveSpotlightLightState({}, rigProps, theme, context, autoPhase)`.

Existing scene files using `<SpotlightRig count={3} color="#ffffff" speed={0.5} />` require no changes.

---

## 11. Dependency Direction Verification

| File | Imports | Compliant |
|---|---|---|
| `types.ts` | Nothing | Yes |
| `dsl.tsx` | `types.ts`, `../../compiler/sceneTypes` | Yes |
| `compile.ts` | `types.ts`, `dsl.tsx` (type only), transition utilities | Yes |
| `render.ts` | `types.ts`, Three.js | Yes |
| `SpotlightRigWidget.ts` | `types.ts`, `dsl.tsx`, `compile.ts`, `render.ts`, `../../widget/*` | Yes |
| `index.ts` | Re-exports only | Yes |

`OrbitFn` lives in `types.ts`. `render.ts` imports `OrbitFn` from `./types` — no React, no DSL dependency. `SpotlightRigWidget.ts` imports `Spotlight` component for `CUSTOM_NODE_HANDLER` child matching and `IDslComposite` from `../../widget/types`. This is within the allowed pattern from `LightingWidget.ts`.

---

## 12. `SceneTrackTick.sceneIndex` Availability

Before implementing `onTick()`, check `packages/core/src/compiler/sceneTrackTypes.ts` for the `SceneTrackTick` type definition and whether `sceneIndex` is a field. If it is not present, implement the fallback described in Section 4:

```typescript
private _lastSceneIndex = 0;

onTick(context: AnimationTickContext): void {
  if (!this.threeScene || !this.cache) return;
  // Update scene index tracking from tick data when available.
  if (context.tick != null && typeof (context.tick as Record<string, unknown>)['sceneIndex'] === 'number') {
    this._lastSceneIndex = (context.tick as Record<string, unknown>)['sceneIndex'] as number;
  }
  const state = (context.resolvedState as SpotlightRigState | null) ?? this.defaultState;
  const orbitFns = this.getOrbitFns(this._lastSceneIndex);
  const refs: SpotlightRigRefs = { scene: this.threeScene, cache: this.cache };
  applySpotlightRig(state, refs, context.clock.wallTimeSeconds, orbitFns);
}
```

Alternatively, if `context.tick` is a `SceneTrackTick` that carries its scene's index, use that directly. Do not introduce a new mechanism — verify the type before writing the implementation.

---

## 13. Implementation Order

Implement in this order to minimize compile errors at each step:

1. `types.ts` — new type definitions (no imports from this package).
2. `compile.ts` — update `resolveSpotlightRig`, `resolveSpotlightLightState`, `blendLights`, `spotlightRigTransitionSpec`, and export `DEFAULT_SPOTLIGHT_RIG_STATE`.
3. `dsl.tsx` — add `SpotlightProps`, update `SpotlightRigProps` with `children`.
4. `render.ts` — update `applySpotlightRig()` signature and per-light loop.
5. `SpotlightRigWidget.ts` — add `Spotlight` stub, `IDslComposite`, orbit store, updated handler.
6. `index.ts` — add `Spotlight` and `SpotlightProps` to exports.
7. Test files — rewrite all three test files.

After step 6, run `pnpm --filter @brewsite/core typecheck` to verify no type errors before writing tests.

---

## 14. Technical Debt

```
// DEBT: Halo sprite is still a single centered sprite (one per rig, not per light).
// The original V1 comment ("Phase 2: per-light halos") has been preserved.
// Per-light halos require SpotlightRigCache to hold a halo sprite per entry
// rather than a single haloSprite on the top-level cache. Deferred.
```

Document this in `render.ts` adjacent to the halo block. No architectural issue — the design supports it by adding `haloSprite: THREE.Sprite | null` and `haloTex: THREE.CanvasTexture | null` fields to `SpotRigEntry` in a future pass.
