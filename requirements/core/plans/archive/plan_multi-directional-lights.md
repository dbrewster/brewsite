---
title: "Multiple Directional Lights Support"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-03
---

# Plan: Multiple Directional Lights Support

## Bug

When multiple `<Directional>` elements are declared inside a `<Lighting>` block, only the first
one is applied at runtime. All subsequent `<Directional>` elements are silently discarded.

## Root Cause (Three-Layer)

**Layer 1 — `types.ts`:** `SceneLighting.directional` is typed as a single `SceneLightDirectional`
object. There is no array field in the compiled state.

**Layer 2 — `LightingWidget.ts` (compile handler, line ≈ 90–285):** The handler correctly
collects all `<Directional>` children into a local `directionals: SceneLighting['directional'][]`
array. But the compiled output at line 285 discards everything after the first:

```typescript
directional: directionals[0] ?? base.directional,   // only [0] survives
```

**Layer 3 — `render.ts`:** `LightingCache.directional` is a single `THREE.DirectionalLight` slot.
`applyLighting` creates exactly one `DirectionalLight` and updates it from `state.directional`.
There is no data structure or loop capable of rendering multiple directional lights.

The existing `blendLightArray` helper in `compile.ts` already handles
`Array<{ id?: string; intensity: number; color: string; position: Vec3 }>`, which matches
`SceneLightDirectional`. It is reused for transitions.

---

## Fix Design

Replace the single `directional: SceneLightDirectional` field with
`directionals: SceneLightDirectional[]` throughout the lighting stack.

**Backward compatibility:** `SceneLighting` is an internal compiled-state type. Scene authors
write `<Directional>` JSX — they never construct `SceneLighting` directly. The `DEFAULT_LIGHTING`
exported constant is the only public-ish surface; it is updated to use the new field.

**Shadow casting policy:** The first directional (index 0) casts shadows, matching the prior
single-light behavior. Subsequent directionals do not cast shadows (fill/rim lights), avoiding
shadow-map budget exhaustion on common GPUs (typically max 2–4 shadow maps before artifacts).

---

## Files to Modify

### 1. `packages/core/src/elements/lighting/types.ts`

**What:** Replace `directional: SceneLightDirectional` with `directionals: SceneLightDirectional[]`.

**Full updated `SceneLighting` type:**

```typescript
export type SceneLighting = {
  ambient: SceneLightAmbient;
  directionals: SceneLightDirectional[];   // ← was: directional: SceneLightDirectional
  glowPoint?: SceneLightGlowPoint;
  lightStrands?: SceneLightStrand[];
  points?: SceneLightPoint[];
  spots?: SceneLightSpot[];
  panels?: SceneLightPanel[];
  intensityScale: number;
  color: string;
};
```

No other changes to this file.

---

### 2. `packages/core/src/elements/lighting/compile.ts`

**What:** Update `DEFAULT_LIGHTING`, `applyLightingExit`, `applyLightingEnter`,
`applyLightingInterpolate` to use `directionals: SceneLightDirectional[]`.

**`DEFAULT_LIGHTING`** (≈ line 290):

```typescript
export const DEFAULT_LIGHTING: SceneLighting = {
  ambient: { intensity: 1, color: '#ffffff' },
  directionals: [{ id: 'directional-0', intensity: 1, color: '#ffffff', position: [10, 10, 10] }],
  lightStrands: [],
  points: [],
  spots: [],
  panels: [],
  intensityScale: 1,
  color: '#ffffff',
};
```

**`applyLightingExit`** — replace the single `directional` blend with a mapped array:

```typescript
export const applyLightingExit = (from: SceneLighting, t: number): SceneLighting => ({
  ...from,
  ambient: {
    id: from.ambient.id,
    intensity: blendNumber(from.ambient.intensity, 0, t) ?? 0,
    color: from.ambient.color,
  },
  directionals: from.directionals.map((d) => ({
    ...d,
    intensity: blendNumber(d.intensity, 0, t) ?? 0,
  })),
  glowPoint: blendGlowPoint(from.glowPoint, undefined, t),
  lightStrands: blendLightStrands(from.lightStrands, undefined, t),
  points: blendLightArray(from.points, undefined, t),
  spots: blendSpots(from.spots, undefined, t),
  panels: blendPanels(from.panels, undefined, t),
  intensityScale: blendNumber(from.intensityScale, 0, t) ?? 0,
});
```

**`applyLightingEnter`** — replace the single `directional` blend:

```typescript
export const applyLightingEnter = (to: SceneLighting, t: number): SceneLighting => ({
  ...to,
  ambient: {
    id: to.ambient.id,
    intensity: blendNumber(0, to.ambient.intensity, t) ?? to.ambient.intensity,
    color: to.ambient.color,
  },
  directionals: to.directionals.map((d) => ({
    ...d,
    intensity: blendNumber(0, d.intensity, t) ?? d.intensity,
  })),
  glowPoint: blendGlowPoint(undefined, to.glowPoint, t),
  lightStrands: blendLightStrands(undefined, to.lightStrands, t),
  points: blendLightArray(undefined, to.points, t),
  spots: blendSpots(undefined, to.spots, t),
  panels: blendPanels(undefined, to.panels, t),
  intensityScale: blendNumber(0, to.intensityScale, t) ?? to.intensityScale,
});
```

**`applyLightingInterpolate`** — replace the single `directional` blend with `blendLightArray`:

```typescript
export const applyLightingInterpolate = (from: SceneLighting, to: SceneLighting, t: number): SceneLighting => ({
  ...from,
  ...to,
  ambient: {
    id: to.ambient.id ?? from.ambient.id,
    intensity: blendNumber(from.ambient.intensity, to.ambient.intensity, t) ?? to.ambient.intensity,
    color: blendColor(from.ambient.color, to.ambient.color, t) ?? to.ambient.color,
  },
  directionals: blendLightArray(from.directionals, to.directionals, t) ?? to.directionals,
  glowPoint: blendGlowPoint(from.glowPoint, to.glowPoint, t) ?? to.glowPoint,
  lightStrands: blendLightStrands(from.lightStrands, to.lightStrands, t) ?? to.lightStrands,
  points: blendLightArray(from.points, to.points, t) ?? to.points,
  spots: blendSpots(from.spots, to.spots, t) ?? to.spots,
  panels: blendPanels(from.panels, to.panels, t) ?? to.panels,
  intensityScale: blendNumber(from.intensityScale, to.intensityScale, t) ?? to.intensityScale,
  color: blendColor(from.color, to.color, t) ?? to.color,
});
```

`blendLightArray` is already typed as
`<T extends { id?: string; intensity: number; color: string; position: [number, number, number] }>`
which matches `SceneLightDirectional`. No changes to `blendLightArray` itself.

---

### 3. `packages/core/src/elements/lighting/LightingWidget.ts`

**What:** Two changes in the `[CUSTOM_NODE_HANDLER]` method.

**Change A** — remove the `ambients.length > 1` warning block at line ≈ 274 and replace
the compiled output to use `directionals`:

```typescript
// BEFORE (≈ lines 282–293):
const compiled: SceneLighting = {
  ...base,
  ambient: ambients[0] ?? base.ambient,
  directional: directionals[0] ?? base.directional,    // ← bug: drops [1..n]
  glowPoint: glowPoints[0] ?? undefined,
  ...
};

// AFTER:
if (ambients.length > 1) {
  console.warn(
    `[Lighting] ${ambients.length} <Ambient> elements found — only the first will be used. ` +
    `Combine them into a single <Ambient> with the desired intensity and color.`,
  );
}
const compiled: SceneLighting = {
  ...base,
  ambient: ambients[0] ?? base.ambient,
  directionals: directionals.length > 0 ? directionals : base.directionals,   // ← FIX
  glowPoint: glowPoints[0] ?? undefined,
  lightStrands: lightStrands.length > 0 ? lightStrands : [],
  points: points.length > 0 ? points : [],
  spots: spots.length > 0 ? spots : [],
  panels: panels.length > 0 ? panels : [],
  intensityScale: resolvedIntensityScale ?? base.intensityScale,
  color: resolvedColor ?? base.color,
};
api.setWidgetState(this.widgetId, compiled);
```

**Note on `ambients` warning:** The `ambients.length > 1` warning block that existed at
line ≈ 274 is RETAINED (moved above the compiled output). The original code had the block
before the compiled object but after the loop. Keep it there.

No other changes to `LightingWidget.ts`.

---

### 4. `packages/core/src/elements/lighting/render.ts`

**What:** Replace the single `directional?: THREE.DirectionalLight` cache slot with
`directionals: Map<string, THREE.DirectionalLight>`. Update `applyLighting` to manage
a map of directional lights (same structural pattern as `points`).

**Updated `LightingCache` type:**

```typescript
type LightingCache = {
  ambient?: THREE.AmbientLight;
  directionals: Map<string, THREE.DirectionalLight>;   // ← was: directional?: THREE.DirectionalLight
  glowPoint?: THREE.PointLight;
  strands: Map<string, THREE.PointLight[]>;
  points: Map<string, THREE.PointLight>;
  spots: Map<string, { light: THREE.SpotLight; target: THREE.Object3D }>;
  panels: Map<string, THREE.PointLight[]>;
  enabledById: Map<string, boolean>;
};
```

**Updated `getCache`** — initialize `directionals` as an empty Map:

```typescript
const getCache = (scene: THREE.Scene): LightingCache => {
  const existing = scene.userData[LIGHTING_KEY] as LightingCache | undefined;
  if (existing) return existing;
  const created: LightingCache = {
    directionals: new Map(),   // ← was: (no directional field in initial state)
    strands: new Map(),
    points: new Map(),
    spots: new Map(),
    panels: new Map(),
    enabledById: new Map(),
  };
  scene.userData[LIGHTING_KEY] = created;
  return created;
};
```

**Replace the directional light section** of `applyLighting` (≈ lines 80–103).
Remove the old single-light block entirely. Insert the following loop in its place:

```typescript
// Apply directional lights — keyed by id.
// Index 0 is the primary (shadow-casting) light; subsequent lights are fill lights only.
const directionalSpecs = state.directionals;
const activeDirectionalIds = new Set(
  directionalSpecs.map((d, i) => d.id ?? `directional-${i}`),
);
for (const [id, light] of cache.directionals.entries()) {
  if (activeDirectionalIds.has(id)) continue;
  scene.remove(light);
  cache.directionals.delete(id);
}
for (let i = 0; i < directionalSpecs.length; i += 1) {
  const spec = directionalSpecs[i]!;
  const directionalId = spec.id ?? `directional-${i}`;
  const directionalEnabled = isLightEnabled(cache, directionalId);
  let light = cache.directionals.get(directionalId);
  if (!light) {
    light = new THREE.DirectionalLight();
    const isPrimary = i === 0;
    light.castShadow = isPrimary;
    if (isPrimary) {
      light.shadow.mapSize.set(1024, 1024);
    }
    cache.directionals.set(directionalId, light);
    scene.add(light);
  }
  light.color.set(spec.color);
  light.intensity = (directionalEnabled ? spec.intensity : 0) * intensityScale;
  light.position.set(spec.position[0], spec.position[1], spec.position[2]);
  // Only update shadow camera for the primary (index 0) light.
  if (i === 0 && light.castShadow) {
    const dirCam = light.shadow.camera as THREE.OrthographicCamera;
    dirCam.near = DIRECTIONAL_SHADOW_NEAR;
    dirCam.far = DIRECTIONAL_SHADOW_FAR;
    dirCam.left = -DIRECTIONAL_SHADOW_RANGE;
    dirCam.right = DIRECTIONAL_SHADOW_RANGE;
    dirCam.top = DIRECTIONAL_SHADOW_RANGE;
    dirCam.bottom = -DIRECTIONAL_SHADOW_RANGE;
  }
}
```

The constants `DIRECTIONAL_SHADOW_RANGE`, `DIRECTIONAL_SHADOW_NEAR`, `DIRECTIONAL_SHADOW_FAR`
are unchanged and remain at the top of the file.

---

## Transition Behavior

All three transition modes are correct after the fix:

| Transition | Behavior |
|---|---|
| **interpolate** (both scenes have lighting) | `blendLightArray` blends matched lights by id, fades out departing lights, fades in entering lights |
| **exit** (lighting absent in next scene) | All directionals fade to intensity 0 |
| **enter** (lighting absent in previous scene) | All directionals fade in from intensity 0 |

The existing `blendLightArray` function handles all three cases already via its id-keyed map logic.

---

## Test Strategy

Interface-based stateful tests. No mocks. No Three.js in test code (Three.js is in render.ts
which is excluded from coverage). Tests target `compile.ts` (pure) and `LightingWidget.ts`
(stateful compile output).

### Test File 1: `packages/core/src/elements/lighting/__tests__/LightingCompile.test.ts` (EXISTING — extend)

Add test cases in the existing file. Import `applyLightingExit`, `applyLightingEnter`,
`applyLightingInterpolate` and test with multiple-directional states.

```typescript
describe('applyLightingExit — directionals array', () => {
  it('fades all directional lights to intensity 0', () => {
    const state: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        { id: 'd-1', intensity: 0.5, color: '#ff0000', position: [-5, 5, 5] },
      ],
    };
    const result = applyLightingExit(state, 1.0);
    expect(result.directionals[0]!.intensity).toBe(0);
    expect(result.directionals[1]!.intensity).toBe(0);
  });

  it('preserves directional count and ids', () => {
    const state: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        { id: 'd-1', intensity: 0.5, color: '#ff0000', position: [-5, 5, 5] },
      ],
    };
    const result = applyLightingExit(state, 0.5);
    expect(result.directionals).toHaveLength(2);
    expect(result.directionals[0]!.id).toBe('d-0');
    expect(result.directionals[1]!.id).toBe('d-1');
  });
});

describe('applyLightingEnter — directionals array', () => {
  it('fades in all directional lights from intensity 0', () => {
    const state: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        { id: 'd-1', intensity: 0.5, color: '#ff0000', position: [-5, 5, 5] },
      ],
    };
    const result = applyLightingEnter(state, 1.0);
    expect(result.directionals[0]!.intensity).toBeCloseTo(1.0);
    expect(result.directionals[1]!.intensity).toBeCloseTo(0.5);
  });

  it('is at near-zero intensity at t=0', () => {
    const state: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
      ],
    };
    const result = applyLightingEnter(state, 0);
    expect(result.directionals[0]!.intensity).toBe(0);
  });
});

describe('applyLightingInterpolate — directionals array', () => {
  it('interpolates matched directionals by id', () => {
    const from: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 0.0, color: '#000000', position: [0, 0, 0] },
      ],
    };
    const to: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
      ],
    };
    const result = applyLightingInterpolate(from, to, 0.5);
    expect(result.directionals[0]!.intensity).toBeCloseTo(0.5);
  });

  it('fades out a directional not in the target scene', () => {
    const from: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
        { id: 'd-extra', intensity: 0.8, color: '#ffff00', position: [5, 5, 5] },
      ],
    };
    const to: SceneLighting = {
      ...DEFAULT_LIGHTING,
      directionals: [
        { id: 'd-0', intensity: 1.0, color: '#ffffff', position: [10, 10, 10] },
      ],
    };
    const result = applyLightingInterpolate(from, to, 1.0);
    const extra = result.directionals.find((d) => d.id === 'd-extra');
    expect(extra).toBeDefined();
    expect(extra!.intensity).toBe(0);
  });
});
```

### Test File 2: `packages/core/src/elements/lighting/__tests__/LightingWidget.test.ts` (EXISTING — extend)

Add test cases verifying the compile handler collects multiple `<Directional>` children.

```typescript
describe('LightingWidget — multiple <Directional> children', () => {
  it('includes all <Directional> children in compiled directionals', () => {
    // Build a <Lighting> with two <Directional> children using the existing test
    // helper pattern in this file (React.createElement + invokeCustomHandler).
    // Assert result.directionals.length === 2.
    // Assert result.directionals[0].position matches first <Directional> position.
    // Assert result.directionals[1].position matches second <Directional> position.
  });

  it('falls back to base.directionals when no <Directional> children', () => {
    // Build a <Lighting> with no <Directional> children.
    // Assert result.directionals equals base.directionals.
  });

  it('assigns auto-ids when <Directional> has no id prop', () => {
    // Build two <Directional> children without id prop.
    // Assert directionals[0].id === 'directional-0'.
    // Assert directionals[1].id === 'directional-1'.
  });
});
```

> The existing `LightingWidget.test.ts` uses a real `LightingWidget` instance and calls
> its `[CUSTOM_NODE_HANDLER]` with a minimal real `CompileApi` double. Follow that exact
> pattern — no mocks of internals.

---

## Pure vs Stateful Summary

| Module/Function | Classification | Reason |
|---|---|---|
| `applyLightingExit/Enter/Interpolate` | **Pure function** | Same inputs → same output; no side effects |
| `blendLightArray` usage for directionals | **Pure function** | Existing helper, unchanged |
| `LightingWidget[CUSTOM_NODE_HANDLER]` change | **Pure transformation** | Reads DSL children, writes to api.state |
| `applyLighting` directionals section | **Stateful / render** | Mutates Three.js scene graph via LightingCache |

---

## Existing Test Migrations

The following references to `.directional` (singular) in existing test files must be updated.
TypeScript strict-mode will flag every one of them as a compile error after `types.ts` is changed.

### `__tests__/LightingCompile.test.ts`

| Line | Before | After |
|---|---|---|
| 35 | `DEFAULT_LIGHTING.directional.position` | `DEFAULT_LIGHTING.directionals[0]!.position` |
| 144 | `directional: { intensity: 1, color: '#ff0000', position: [0, 0, 0] }` | `directionals: [{ intensity: 1, color: '#ff0000', position: [0, 0, 0] }]` |
| 147 | `directional: { intensity: 1, color: '#00ff00', position: [2, 2, 2] }` | `directionals: [{ intensity: 1, color: '#00ff00', position: [2, 2, 2] }]` |
| 150 | `result.directional.color` | `result.directionals[0]!.color` |
| 151 | `result.directional.position` | `result.directionals[0]!.position` |
| 383 | `directional: { intensity: 1, color: '#ffffff', position: [1, 2, 3] }` | `directionals: [{ intensity: 1, color: '#ffffff', position: [1, 2, 3] }]` |

The `it('prefers first ambient/directional')` test at lines 89–106 in `LightingWidgetDsl.test.tsx`
tests the old "only first directional is used" behavior which is now the bug. Delete this test
case entirely; the new multi-light tests (added below) cover the corrected behavior.

### `__tests__/LightingWidgetDsl.test.tsx`

| Line | Before | After |
|---|---|---|
| 75 | `state.directional.position` | `state.directionals[0]?.position` |
| 150 | `directional: { intensity: 1, color: '#ffffff', position: [1, 2, 3] }` | `directionals: [{ intensity: 1, color: '#ffffff', position: [1, 2, 3] }]` |
| 89–106 | entire `it('prefers first ambient/directional')` block | **delete** |

### `__tests__/LightingWidget.test.ts`

| Line | Before | After |
|---|---|---|
| 18 | `directional: { intensity, color, position: [0, 1, 0] }` | `directionals: [{ intensity, color, position: [0, 1, 0] }]` |
| 38 | `widget.defaultState.directional.intensity` | `widget.defaultState.directionals[0]!.intensity` |
| 170 | `captured?.directional.position` | `captured?.directionals[0]?.position` |

---

## Concrete New Tests

### In `__tests__/LightingWidget.test.ts` — replace the three placeholder tests with these:

```typescript
describe('LightingWidget — multiple <Directional> children', () => {
  it('includes all <Directional> children in compiled directionals', () => {
    const widget = new LightingWidget();
    let captured: SceneLighting | undefined;
    const handler = (widget as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as (
      node: { props: unknown },
      api: { setWidgetState: (id: string, s: SceneLighting) => void; state: { widgets: Record<string, unknown> }; context: unknown },
      helpers: { collectChildren: (n: { props: unknown }) => React.ReactNode[]; resolveObjectValues: (v: unknown) => unknown; resolveValue: (v: unknown) => unknown },
    ) => void;

    const node = {
      props: {
        children: [
          React.createElement(Directional, { intensity: 1, color: '#ff0000', position: [1, 0, 0] as [number, number, number] }),
          React.createElement(Directional, { intensity: 2, color: '#00ff00', position: [0, 1, 0] as [number, number, number] }),
          React.createElement(Directional, { intensity: 3, color: '#0000ff', position: [0, 0, 1] as [number, number, number] }),
        ],
      },
    };
    handler(
      node,
      { setWidgetState: (_id, s) => { captured = s; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => { const c = (n.props as { children?: React.ReactNode }).children; return Array.isArray(c) ? c : (c ? [c] : []); },
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.directionals).toHaveLength(3);
    expect(captured?.directionals[0]?.position).toEqual([1, 0, 0]);
    expect(captured?.directionals[1]?.position).toEqual([0, 1, 0]);
    expect(captured?.directionals[2]?.position).toEqual([0, 0, 1]);
  });

  it('falls back to base.directionals when no <Directional> children', () => {
    const widget = new LightingWidget();
    let captured: SceneLighting | undefined;
    const handler = (widget as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as Parameters<typeof handler>[0];
    // (use same minimal handler invocation as above, with empty children array)
    const node = { props: { children: [] } };
    handler(
      node,
      { setWidgetState: (_id, s) => { captured = s; }, state: { widgets: {} }, context: {} } as never,
      { collectChildren: () => [], resolveObjectValues: (v) => v, resolveValue: (v) => v },
    );
    expect(captured?.directionals).toEqual(widget.defaultState.directionals);
  });

  it('assigns auto-ids when <Directional> has no id prop', () => {
    const widget = new LightingWidget();
    let captured: SceneLighting | undefined;
    const handler = (widget as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as Parameters<typeof handler>[0];
    const node = {
      props: {
        children: [
          React.createElement(Directional, { intensity: 1, color: '#ffffff', position: [0, 0, 0] as [number, number, number] }),
          React.createElement(Directional, { id: 'named', intensity: 1, color: '#ffffff', position: [1, 0, 0] as [number, number, number] }),
        ],
      },
    };
    handler(
      node,
      { setWidgetState: (_id, s) => { captured = s; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => { const c = (n.props as { children?: React.ReactNode }).children; return Array.isArray(c) ? c : (c ? [c] : []); },
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.directionals[0]?.id).toBe('directional-0');
    expect(captured?.directionals[1]?.id).toBe('named');
  });
});
```

---

## Migration Notes

- Existing scenes with a single `<Directional>` continue to work unchanged. The compile
  handler puts it in `directionals[0]`; the render layer picks it up from the Map.
- The legacy `directional` key is completely removed from `SceneLighting`. There is no
  compatibility shim — this is an internal type refactor.
- `DEFAULT_LIGHTING` now has `directionals: [{ id: 'directional-0', ... }]`. Any code that
  spreads `DEFAULT_LIGHTING` and then overwrites `directional` will now get a TypeScript error
  pointing it to use `directionals` instead. This is intentional — the error guides migration.
- Scenes that previously relied on the single default directional light will see identical
  runtime behavior because `DEFAULT_LIGHTING.directionals[0]` has the same values as the
  former `DEFAULT_LIGHTING.directional`.
