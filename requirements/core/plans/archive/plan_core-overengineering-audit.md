---
title: "Core Over-Engineering Audit — Implementation Plan"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-18
---

# Core Over-Engineering Audit — Implementation Plan

Implements all actionable findings from `requirements/core/notes/note_core-overengineering-audit.md`, incorporating all PM review flags. Four waves are designed for parallel execution (up to 5 developers simultaneously). No two developers modify the same file.

---

## PM Flag Resolutions

| Flag | Decision |
|------|----------|
| **Flag 1** | M4 (CameraWidget split) is excluded from this plan entirely. CameraWidget is assessed as KEEP AS-IS. |
| **Flag 2** | H3: Keep `ElementTransitionSpec` as a `@deprecated` type alias. Remove all implementations and the `sceneTrackCompiler.ts` code path. Minor version bump. |
| **Flag 3** | M8: ThemeKeyContext deletion gets a CHANGELOG entry. Minor version bump. |
| **Flag 4** | CP9: Add `@deprecated` JSDoc to zero-consumer public exports in Wave 2. `useEngineScrubber` is listed in CP9 (unused) AND CP10 (consumer-facing). Resolution: it IS exported from `player/index.ts` and has tests. Do NOT deprecate it. Mark the others only. |
| **Flag 5** | M7 (6 scroll contexts) is labeled "evaluate as part of next major version planning only." Not implemented here. |
| **Flag 6** | L6 (InputHud): **KEEP as intentional extension point.** The source comment explicitly states the data model and event plumbing were "implemented in this release." The null stub is a design contract, not dead code. Wave 2 task: add clarifying JSDoc to reinforce the intent; do not remove. |

---

## Wave 1 — Safe Deduplication (no API changes)

All items are pure internal deduplication. Zero consumer-facing changes. Safe to land in any order as a patch. All 5 developers can work simultaneously — no shared files across work streams.

### W1-A (Developer A): H1 + H4 + H5 — `transitionTypes.ts` cleanup

All three items modify `packages/core/src/compiler/transitions/transitionTypes.ts`. Assign to a single developer.

---

#### H1 — Quaternion Math Extraction

**Architectural note (critical):** The four private quaternion functions in `transitionTypes.ts` (`normalizeQuat`, `eulerToQuaternionXYZ`, `quaternionToEulerXYZ`, `slerpQuat`) use a **different rotation order convention** from `math/index.ts` (`quatNormalize`, `quatFromEuler`, `quatToEuler`, `quatSlerp`). `math/index.ts` uses intrinsic YXZ order; `transitionTypes.ts` uses ZYX intrinsic (= XYZ extrinsic) order matching how pitchPct/yawPct/rollPct map to actual rotation axes in `blendAxisRotation`. **Do NOT replace with imports from `math/index.ts`** — that would silently change rotation behavior.

**Correct fix:** Extract to a new file that makes the convention explicit.

**New file:** `packages/core/src/compiler/transitions/rotationMath.ts`

```typescript
// rotationMath.ts — Quaternion helpers for blendAxisRotation.
//
// Uses ZYX intrinsic (= XYZ extrinsic) Euler angle convention so that
// pitchPct/yawPct/rollPct in blendAxisRotation map correctly to scene-space
// rotations. This convention differs from math/index.ts (which uses a different
// order for composeMatrix/decomposeMatrix). Do NOT merge with math/quatFromEuler.

type Quat = { x: number; y: number; z: number; w: number };

export const normalizeQuat = (q: Quat): Quat => {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
};

export const eulerToQuaternionXYZ = (x: number, y: number, z: number): Quat => { ... };
export const quaternionToEulerXYZ = (q: Quat): [number, number, number] => { ... };
export const slerpQuat = (from: Quat, to: Quat, t: number): Quat => { ... };
```

**Files to modify:**
- **Create:** `packages/core/src/compiler/transitions/rotationMath.ts`
  - Copy the 4 private functions (`normalizeQuat`, `eulerToQuaternionXYZ`, `quaternionToEulerXYZ`, `slerpQuat`) exactly from `transitionTypes.ts` lines 181–248
  - Add the JSDoc header explaining the convention
  - Export all four functions
  - **Export `type Quat`** — `blendAxisRotation` remains in `transitionTypes.ts` and calls `eulerToQuaternionXYZ`/`slerpQuat`/`quaternionToEulerXYZ`. After extraction, `transitionTypes.ts` imports those functions from `rotationMath.ts` and must also import `Quat` as a type to satisfy TypeScript (the return type of `eulerToQuaternionXYZ` and `slerpQuat`). Do not make it private.
- **Modify:** `packages/core/src/compiler/transitions/transitionTypes.ts`
  - Delete lines 177–248 (local `type Quaternion`, `clampUnit`, `normalizeQuat`, `eulerToQuaternionXYZ`, `quaternionToEulerXYZ`, `slerpQuat`)
  - Add import: `import { normalizeQuat, eulerToQuaternionXYZ, quaternionToEulerXYZ, slerpQuat } from './rotationMath';`
  - Remove the `// ====================\n// Quaternion Utilities\n// ====================` section header

**Tests:** No test changes needed. The private functions were untested. `blendAxisRotation` has tests — run them to confirm behavior is unchanged.

**LOC saved:** ~65 lines removed from `transitionTypes.ts`.

---

#### H4 — Color Conversion Consolidation

**Correct fix:** Add a `blendHexColors` utility to `packages/core/src/math/index.ts` that encapsulates the RGB interpolation. `blendColor` in `transitionTypes.ts` delegates to it.

The private `hexToRgb` in `transitionTypes.ts` returns `{ r, g, b }` as 0–255 integers. `parseHexColor` in `math/index.ts` returns `{ rgb: string, alpha: number }`. These are different shapes — do not combine. Instead, add a new dedicated blend utility.

**Files to modify:**
- **Modify:** `packages/core/src/math/index.ts`
  - Add at end:
    ```typescript
    /**
     * Blends two CSS hex color strings by interpolating RGB components.
     * Both inputs must be '#RRGGBB' format. Returns undefined if either
     * input cannot be parsed. Does not handle alpha channels.
     */
    export const blendHexColors = (
      from: string | undefined,
      to: string | undefined,
      t: number,
    ): string | undefined => {
      if (!from || !to) return to ?? from;
      const a = hexToRgbInts(from);
      const b = hexToRgbInts(to);
      if (!a || !b) return to ?? from;
      return rgbIntsToHex({
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
      });
    };

    // Private helpers — not exported (callers use blendHexColors).
    const hexToRgbInts = (value: string): { r: number; g: number; b: number } | null => {
      if (!value.startsWith('#')) return null;
      const normalized = value.length === 4
        ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
        : value;
      const int = Number.parseInt(normalized.slice(1), 16);
      if (Number.isNaN(int)) return null;
      return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
    };

    const rgbIntsToHex = (rgb: { r: number; g: number; b: number }): string =>
      `#${[rgb.r, rgb.g, rgb.b]
        .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
        .join('')}`;
    ```
- **Modify:** `packages/core/src/compiler/transitions/transitionTypes.ts`
  - Add import: `import { blendHexColors } from '../../math';`
  - Delete lines 313–334 (private `hexToRgb` and `rgbToHex` functions)
  - Update `blendColor` to use `blendHexColors`:
    ```typescript
    export const blendColor = (from?: string, to?: string, t?: number): string | undefined => {
      if (t === undefined) return to ?? from;
      return blendHexColors(from, to, t) ?? (to ?? from);
    };
    ```

**Tests:**
- No new tests needed for `blendHexColors` if the existing `blendColor` tests in `packages/core/src/compiler/__tests__/transitionTypes.test.ts` pass — they test the same behavior through the public API.
- Run `blendColor` tests to confirm no regression.

**LOC saved:** ~25 lines from `transitionTypes.ts`.

---

#### H5 — `blendStyleValues` / `blendStyleValuesPartial` Deduplication

**Fix:** Keep both exported names for backward compatibility but have `blendStyleValuesPartial` delegate to `blendStyleValues` with an extra parameter.

**Files to modify:**
- **Modify:** `packages/core/src/compiler/transitions/transitionTypes.ts`
  - Replace the two functions (lines 436–501) with:
    ```typescript
    export const blendStyleValues = <T extends Record<string, StyleValue>>(
      from: T | undefined,
      to: T | undefined,
      t: number,
      includeAllKeys = true,
    ): T | undefined => {
      if (!from && !to) return undefined;
      const fromValues = (from ?? {}) as Record<string, StyleValue>;
      const toValues = (to ?? {}) as Record<string, StyleValue>;
      const result: Record<string, StyleValue> = includeAllKeys
        ? { ...fromValues, ...toValues }
        : {};
      const keys = new Set([...Object.keys(fromValues), ...Object.keys(toValues)]);
      for (const key of keys) {
        const prev = fromValues[key];
        const next = toValues[key];
        if (isNumber(prev) && isNumber(next)) {
          result[key] = lerp(prev, next, t);
        } else if (
          typeof prev === 'string' &&
          typeof next === 'string' &&
          prev.startsWith('#') &&
          next.startsWith('#')
        ) {
          result[key] = blendColor(prev, next, t);
        } else if (includeAllKeys) {
          // non-blendable: value already set from spread
        } else if (next !== undefined) {
          result[key] = next;
        }
      }
      return result as T;
    };

    /** Like blendStyleValues but only includes keys present in the target object. */
    export const blendStyleValuesPartial = <T extends Record<string, StyleValue>>(
      from: T | undefined,
      to: T | undefined,
      t: number,
    ): T | undefined => blendStyleValues(from, to, t, false);
    ```

**Tests:**
- Existing tests in `compiler/__tests__/transitionTypes.test.ts` cover both functions — run them to confirm no regression.
- No new tests needed.

**LOC saved:** ~30 lines.

---

### W1-B (Developer B): H2 — Easing Deduplication

**Files to modify:**
- **Modify:** `packages/core/src/input/transitionAnimator.ts`
  - Delete `easeInOut` function (lines 10–13) — it is byte-for-byte identical to `easeInOutCubic` in `transitionPresets.ts`
  - Delete `easeLinear` function (lines 17–18) — it is identical to `easeLinear` in `transitionPresets.ts`
  - Add import: `import { easeInOutCubic, easeLinear } from '../compiler/transitions/transitionPresets';`
  - Update any local references from `easeInOut` to `easeInOutCubic` (check usages in the same file with grep)
  - Keep `TransitionEasing` type export, `TransitionAnimatorState` type, and all other functions

**Verify no callers of the local `easeInOut` export from outside this file:**
```bash
pnpm --filter @brewsite/core vitest run --grep "easeInOut"
grep -r "from.*transitionAnimator" packages/
```
If any caller imports `easeInOut` from `transitionAnimator`, update those callers to import from `transitionPresets`.

**Tests:**
- `packages/core/src/input/__tests__/ActionInputController.test.ts` — run to verify no regression
- No new tests needed

**LOC saved:** ~10 lines.

---

### W1-C (Developer C): H6 — Lighting Blend Array Deduplication

**Files to modify:**
- **Modify:** `packages/core/src/elements/lighting/compile.ts`
  - Extract a private generic `blendIdKeyedArray<T extends { id?: string; intensity: number }>` function
  - Replace `blendLightArray` body with a call to `blendIdKeyedArray` providing a blend callback
  - Replace `blendSpots` body with a call to `blendIdKeyedArray` with spots-specific extra field blending

**Implementation:**
```typescript
// packages/core/src/elements/lighting/compile.ts

/** Generic id-keyed array blender for light arrays. */
const blendIdKeyedArray = <T extends { id?: string; intensity: number }>(
  from: T[] | undefined,
  to: T[] | undefined,
  t: number,
  blendItem: (prev: T, next: T, t: number) => T,
): T[] | undefined => {
  const fromMap = new Map<string, T>();
  const toMap = new Map<string, T>();
  for (let i = 0; i < (from?.length ?? 0); i++) {
    const prev = from?.[i];
    if (!prev) continue;
    fromMap.set(prev.id ?? `idx-${i}`, prev);
  }
  for (let i = 0; i < (to?.length ?? 0); i++) {
    const next = to?.[i];
    if (!next) continue;
    toMap.set(next.id ?? `idx-${i}`, next);
  }
  if (fromMap.size === 0 && toMap.size === 0) return undefined;
  const result: T[] = [];
  const ids = new Set<string>([...fromMap.keys(), ...toMap.keys()]);
  for (const id of ids) {
    const prev = fromMap.get(id);
    const next = toMap.get(id);
    if (!prev && !next) continue;
    if (prev && next) {
      result.push(blendItem(prev, next, t));
      continue;
    }
    if (prev) {
      result.push({ ...prev, intensity: blendNumber(prev.intensity, 0, t) ?? 0 } as T);
      continue;
    }
    if (next) {
      result.push({ ...next, intensity: blendNumber(0, next.intensity, t) ?? next.intensity } as T);
    }
  }
  return result.length > 0 ? result : undefined;
};

const blendLightArray = <T extends { id?: string; intensity: number; color: string; position: [number, number, number] }>(
  from: T[] | undefined,
  to: T[] | undefined,
  t: number,
): T[] | undefined =>
  blendIdKeyedArray(from, to, t, (prev, next, t2) => ({
    ...next,
    id: next.id ?? prev.id,
    intensity: blendNumber(prev.intensity, next.intensity, t2) ?? next.intensity,
    color: blendColor(prev.color, next.color, t2) ?? next.color,
    position: blendVec3(prev.position ?? [0, 0, 0], next.position ?? [0, 0, 0], t2) ?? next.position ?? prev.position,
  } as T));

const blendSpots = (
  from: SceneLighting['spots'],
  to: SceneLighting['spots'],
  t: number,
) =>
  blendIdKeyedArray(from, to, t, (prev, next, t2) => ({
    ...next,
    id: next.id ?? prev.id,
    intensity: blendNumber(prev.intensity, next.intensity, t2) ?? next.intensity,
    color: blendColor(prev.color, next.color, t2) ?? next.color,
    position: blendVec3(prev.position, next.position, t2) ?? next.position,
    target: blendVec3(prev.target, next.target, t2) ?? next.target,
    angle: blendNumber(prev.angle, next.angle, t2) ?? next.angle,
    penumbra: blendNumber(prev.penumbra, next.penumbra, t2) ?? next.penumbra,
    distance: blendNumber(prev.distance, next.distance, t2) ?? next.distance,
    decay: blendNumber(prev.decay, next.decay, t2) ?? next.decay,
  }));
```

Also remove the `// DEBT: blendLightArray and blendSpots...` comment.

**Tests:**
- Run lighting compile tests: `pnpm --filter @brewsite/core vitest run src/elements/lighting`
- No new tests needed — behavior is unchanged

**LOC saved:** ~60 lines.

---

### W1-D (Developer D): H7 — Inline Clamp Replacement

**NOTE: `math/index.ts` is handled by W1-A.** Developer D must NOT modify `math/index.ts`. W1-A adds both `blendHexColors` (for H4) and `clamp` (for H7) to `math/index.ts`. Developer D only imports and uses the already-added `clamp` and `clamp01`. Coordinate with W1-A to confirm `clamp` is exported before merging W1-D.

**Files to modify:**

1. **`packages/core/src/player/SceneProgressMapper.ts`**
   - Add `clamp01` to import from `'../math'` (it currently only imports `IDENTITY_FN`)
   - Line 21: `Math.max(0, Math.min(1, rawProgress))` → `clamp01(rawProgress)`
   - Line 48: `Math.max(0, Math.min(1, engineProgress))` → `clamp01(engineProgress)`
   - Line 34: `Math.max(0, Math.min(1, localT))` → `clamp01(localT)`

2. **`packages/core/src/compiler/transitions/transitionPresets.ts`**
   - Add `import { clamp } from '../../math';` (W1-A adds `clamp` to math/index.ts — confirm W1-A is merged first)
   - Line 66: `Math.min(Math.max(exitStart ?? DEFAULT_EXIT_START, 0), 0.99)` → `clamp(0, 0.99, exitStart ?? DEFAULT_EXIT_START)`

3. **`packages/core/src/elements/camera/compile.ts`**
   - Import `blendNumber` (already imported from transitionTypes)
   - Delete private `lerpNum` function (lines ~116–122) — it is functionally equivalent to `blendNumber(a, b, t)` when both values are defined
   - Replace all `lerpNum(a, b, t)` calls with `blendNumber(a, b, t)` — note: `lerpNum` returns `number | undefined` like `blendNumber`, so types are compatible
   - **Exception:** `lerpNum(a, b, t) as number` casts — keep as `blendNumber(a, b, t) as number`

**Tests:**
- `SceneProgressMapper` has full test coverage — run: `pnpm --filter @brewsite/core vitest run src/player/__tests__/SceneProgressMapper`
- Camera compile has full test coverage — run: `pnpm --filter @brewsite/core vitest run src/elements/camera/__tests__/compile.test.ts`
- No new tests needed

**LOC saved:** ~15 lines + `clamp` addition.

---

### W1-E (Developer E): L4 — Rename `useCarouselIndex.ts` → `useCarouselState.ts`

**Files to modify:**
1. **Rename** `packages/core/src/widget/useCarouselIndex.ts` → `packages/core/src/widget/useCarouselState.ts`
   - No code changes inside the file
2. **Find all importers:**
   ```bash
   grep -r "useCarouselIndex" packages/ apps/
   ```
   Update each import path from `./useCarouselIndex` (or `../widget/useCarouselIndex`) to the new name.
3. Check `packages/core/src/widget/index.ts` (or wherever it's re-exported) and update the export path.

**Tests:** Run all tests to verify no broken imports.

**LOC saved:** 0 (rename only).

---

### Wave 1 Completion Gate

Before merging Wave 1, run:
```bash
pnpm typecheck
pnpm test
```

All 5 work streams are file-disjoint. Merge order does not matter.

---

## Wave 2 — Dead Code Removal + Deprecations

Depends on Wave 1 completing first (particularly W1-A which modifies `transitionTypes.ts`). Within Wave 2, the four work streams are file-disjoint.

### W2-A (Developer A): H3 — Remove `ElementTransitionSpec` Implementations

This is the largest Wave 2 item. Per PM Flag 2: **keep `ElementTransitionSpec` as a `@deprecated` type alias**; remove all implementations and the `sceneTrackCompiler.ts` code path.

#### Step 1: Mark type as deprecated in `transitionTypes.ts`

**File:** `packages/core/src/compiler/transitions/transitionTypes.ts`

- Add `@deprecated` JSDoc to `ElementTransitionSpec`:
  ```typescript
  /**
   * @deprecated All widgets now use FunctionalTransitionSpec. ElementTransitionSpec
   * will be removed in the next major version. The sceneTrackCompiler no longer
   * processes this spec type — registering a widget with an ElementTransitionSpec
   * will log a runtime warning and produce no transitions.
   * @see FunctionalTransitionSpec
   */
  export type ElementTransitionSpec<T> = { ... };
  ```
- Add `@deprecated` JSDoc to `transitionT`:
  ```typescript
  /**
   * @deprecated Used exclusively by ElementTransitionSpec implementations, which are
   * deprecated. Will be removed in the next major version.
   */
  export const transitionT = ...
  ```
- Add `@deprecated` to the `isFunctionalSpec` export (it will become a no-op since all specs are functional):
  ```typescript
  /**
   * @deprecated All widgets use FunctionalTransitionSpec; this guard is no longer needed.
   * Will be removed in the next major version.
   */
  export const isFunctionalSpec = ...
  ```

#### Step 2: `ISceneElement.transitionSpec` — Conservative Path (No Type Change This Version)

**Decision (PM-approved conservative path):** Do NOT narrow `ISceneElement.transitionSpec` to `FunctionalTransitionSpec<TState>` only in this release. While zero cross-package consumers use `ElementTransitionSpec`, external npm consumers outside the monorepo cannot be audited with certainty. Narrowing the union is a breaking TypeScript type change.

**Action:** Keep `transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>` in `ISceneElement`. Add `@deprecated` to the union option in JSDoc:

```typescript
/**
 * Transition spec for this widget.
 * @deprecated Using ElementTransitionSpec is deprecated. The sceneTrackCompiler
 * no longer processes it — transitions will not animate. Migrate to
 * FunctionalTransitionSpec. The ElementTransitionSpec option in this union will
 * be removed in the next major version.
 */
readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
```

**Deferral:** The narrowing to `FunctionalTransitionSpec<TState>` only happens in the **next major version** alongside the full removal of `ElementTransitionSpec` type.

This removes the TypeScript "Breaking Change" from the CHANGELOG (see updated CHANGELOG section below).

#### Step 3: Remove `ElementTransitionSpec` code path from sceneTrackCompiler

**File:** `packages/core/src/compiler/sceneTrackCompiler.ts`
- Lines ~589–611: The `else` block after `if (isFunctionalSpec(transitionSpec))` that handles `ElementTransitionSpec` (calls `transitionSpec.interpolate`, `transitionSpec.exit`, `transitionSpec.enter`)
- **Replace** the else block with:
  ```typescript
  } else {
    // ElementTransitionSpec is deprecated and no longer supported.
    // All widgets should use FunctionalTransitionSpec.
    // If this path is reached, log a warning and fill frames with absent default.
    console.warn(
      `[BrewSite] Widget "${widgetId}" uses deprecated ElementTransitionSpec. ` +
      `Migrate to FunctionalTransitionSpec. Transitions will not animate for this widget.`,
    );
    for (const frame of block) {
      frame.state.widgets[widgetId] = absentDefault;
    }
  }
  ```
- Remove import of `isFunctionalSpec` from line 18 (it's no longer used as a type guard — or keep it until major version if you want to preserve the type for others)
  - Decision: **keep** `isFunctionalSpec` import and the guard — just replace the else block body. This keeps the code structurally intact for the major version cleanup.

#### Step 4: Delete `ElementTransitionSpec` implementations from element `compile.ts` files

For each element, delete the `ElementTransitionSpec` variant. Keep the `Functional*` variant. Remove `transitionT` and `ElementTransitionSpec` type imports where they are now unused.

**File: `packages/core/src/elements/background/compile.ts`**
- Delete `backgroundTransitionSpec` (lines 43–79, ~37 lines)
- Remove import `ElementTransitionSpec` from line 7
- Remove import `transitionT` from line 10 (now unused)
- Remove `functionalBackgroundTransitionSpec` export remains — **keep it**

**File: `packages/core/src/elements/floor/compile.ts`**
- Delete `floorTransitionSpec` (lines 62–119, ~58 lines)
- Remove import `ElementTransitionSpec` from line 6
- Remove import `transitionT` from line 14 (now unused)
- Keep `functionalFloorTransitionSpec`

**File: `packages/core/src/elements/environment/compile.ts`**
- Delete `environmentTransitionSpec` (lines 18–52, ~35 lines)
- Remove import `ElementTransitionSpec` from line 7
- Remove import `transitionT` from line 10 (now unused)
- Keep `functionalEnvironmentTransitionSpec`

**File: `packages/core/src/elements/lighting/compile.ts`**
- Delete `lightingTransitionSpec` (lines 361–380, ~20 lines)
- Remove import `ElementTransitionSpec` from line 8
- Remove import `transitionT` from line 10 (now unused after this deletion)
- Keep `functionalLightingTransitionSpec`

**File: `packages/core/src/elements/camera/compile.ts`**
- Delete `cameraTransitionSpec` (lines 336–end of function, ~25 lines)
- Remove import `ElementTransitionSpec` from line 12
- Remove import `transitionT` from line 15 (now unused after H7 and this deletion)
- Keep `functionalCameraTransitionSpec`

**File: `packages/core/src/elements/carousel-scrubber/compile.ts`**
- Verify: does this file have an `ElementTransitionSpec` impl? (grep confirmed: no, uses `FunctionalTransitionSpec` only)
- No changes needed here.

#### Step 5: Update element `index.ts` barrel exports

**File: `packages/core/src/elements/background/index.ts`**
- Remove `backgroundTransitionSpec` from export line 3

**File: `packages/core/src/elements/floor/index.ts`**
- Remove `floorTransitionSpec` from export (keep `functionalFloorTransitionSpec`)

**File: `packages/core/src/elements/environment/index.ts`**
- Remove `environmentTransitionSpec` (keep `functionalEnvironmentTransitionSpec`)

**File: `packages/core/src/elements/lighting/index.ts`**
- Remove `lightingTransitionSpec` (keep `functionalLightingTransitionSpec`)

**File: `packages/core/src/elements/camera/index.ts`**
- Remove `cameraTransitionSpec` (keep `functionalCameraTransitionSpec`)

#### Step 6: Update `makeSimpleContext` deprecation

**File:** `packages/core/src/compiler/transitions/transitionResolver.ts`
- Add `@deprecated` JSDoc to `makeSimpleContext`:
  ```typescript
  /**
   * @deprecated Used only by ElementTransitionSpec implementations, which are
   * deprecated. Will be removed in the next major version.
   */
  export const makeSimpleContext = ...
  ```

**File:** `packages/core/src/compiler/index.ts`
- Add inline `@deprecated` comment to `makeSimpleContext` export

#### Step 7: Update test files

**`packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts`**
- The `TestWidget` fixture currently has `transitionSpec: ElementTransitionSpec<T>`. Migrate to `FunctionalTransitionSpec<T>`.
- Replace the discrete `spec` with a functional equivalent:
  ```typescript
  const spec: FunctionalTransitionSpec<number> = {
    exitFn: (from) => (ctx) => lerp(from, 0, ctx.t),
    enterFn: (to) => (ctx) => lerp(0, to, ctx.t),
    interpolateFn: (from, to) => (ctx) => lerp(from, to, ctx.t),
  };
  ```
- **Key behavioral difference — concrete assertion guidance:**
  `ElementTransitionSpec` writes state directly to `frame.state.widgets[widgetId]` in every tick. `FunctionalTransitionSpec` writes closures into `sceneTrack.transitionBlocks[blockIndex].widgetFns[widgetId]`, NOT into `frame.state.widgets`. Tests must be updated to evaluate the closure at a specific blockProgress:

  ```typescript
  // OLD (ElementTransitionSpec): state pre-baked into ticks
  expect(sceneTrack.ticks[frameIndex]!.state.widgets['testWidget']).toBe(expectedValue);

  // NEW (FunctionalTransitionSpec): state produced by closure at blockProgress
  const blockIdx = 0; // transition block index
  const bp = 0.5;     // blockProgress ∈ [0, 1]
  const block = sceneTrack.transitionBlocks[blockIdx];
  const widgetFn = block?.widgetFns['testWidget'];
  expect(widgetFn).toBeDefined();
  const result = widgetFn?.fn(bp);
  expect(result).toBeCloseTo(expectedValue, 5);
  ```

  For interpolate tests: bp=0 → fromState, bp=1 → toState, bp=0.5 → midpoint.
  For exit tests: bp starts at fromState, increases until widget hits absent/defaultState.
  For enter tests: widget is at absent/defaultState until enter window starts.

- Remove `import type { ElementTransitionSpec }` from line 2

**`packages/core/src/compiler/__tests__/functionalTransitions.test.ts`**
- Remove the `describe` block that tests `ElementTransitionSpec` compatibility (lines ~55–100 and ~190–220)
- These tests verify that `ElementTransitionSpec` works with `sceneTrackCompiler` — which is no longer supported

**`packages/core/src/compiler/__tests__/compileWarnings.test.tsx`**
- `makeNoopSpec` (line 10) uses `ElementTransitionSpec<T>` — migrate to `FunctionalTransitionSpec`:
  ```typescript
  const makeNoopSpec = <T,>(): FunctionalTransitionSpec<T> => ({
    exitFn: (from) => () => from,
    enterFn: (to) => () => to,
    interpolateFn: (_from, to) => () => to,
  });
  ```
- Remove `import type { ElementTransitionSpec }` from line 7

**`packages/core/src/runtime/__tests__/RuntimeDriver.test.ts`**
- `import type { ElementTransitionSpec }` — check if it's actually used. If only used for test widget setup, migrate to `FunctionalTransitionSpec`.

**`packages/core/src/runtime/__tests__/ErrorRecovery.test.ts`**
- Same: migrate any `ElementTransitionSpec` widget fixtures to `FunctionalTransitionSpec`

**`packages/core/src/runtime/__tests__/SceneLifecycle.test.ts`**
- Same migration

**`packages/core/src/runtime/mocks/widgetMocks.ts`**
- Check if any mock widget uses `ElementTransitionSpec`. Migrate to `FunctionalTransitionSpec`.

**`packages/core/src/widget/__tests__/WidgetRegistry.test.ts`**
- Check usage. Migrate any `ElementTransitionSpec` fixtures.

**`packages/core/src/widget/__tests__/ISceneElementTExtra.test.ts`**
- Check usage. Migrate.

**`packages/core/src/widget/__tests__/typeContracts.test.ts`**
- Check usage. The type contract tests that verify `ISceneElement.transitionSpec` accepts `ElementTransitionSpec` will need to be updated — once `transitionSpec` is narrowed to `FunctionalTransitionSpec`, these tests should verify the functional spec instead.

**`packages/core/src/widget/__tests__/CustomDslHandler.test.ts`**
- Check usage. Migrate.

**`packages/core/src/widget/__tests__/requiresTypeProp.test.ts`**
- Check usage. Migrate.

**`packages/core/src/elements/__tests__/index.test.ts`**
- Tests at lines ~87–104 verify that `lightingTransitionSpec`, `backgroundTransitionSpec`, etc. are NOT exported from the elements barrel. Once these specs are deleted, the assertions `toBeUndefined()` remain correct — no changes needed.

**`packages/core/src/elements/background/__tests__/BackgroundCompile.test.ts`**
- Remove `describe('backgroundTransitionSpec', ...)` block (lines ~132–165). The functional spec tests remain unchanged.

**`packages/core/src/elements/floor/__tests__/FloorCompile.test.ts`**
- Remove `floorTransitionSpec.exit/enter/interpolate` test cases (lines ~77–92). Keep functional spec tests.

**`packages/core/src/elements/environment/__tests__/EnvironmentCompile.test.ts`**
- Remove `environmentTransitionSpec.exit/interpolate` test cases (lines ~100–109). Keep functional.

**`packages/core/src/elements/camera/__tests__/compile.test.ts`**
- Remove `describe('cameraTransitionSpec', ...)` block (lines ~247+). Keep functional spec tests.

**LOC saved:** ~300+ lines across element compile.ts files and tests.

---

### W2-B (Developer B): M8 + M9 — Dead Code Deletion

#### M8 — Delete `ThemeKeyContext`

**Background:** `ThemeKeyContext.Provider` is never rendered anywhere in the codebase. `useThemeKey()` is never called outside its definition file. All packages use `useTheme()` + `api.context.themeFamily/themePolarity` instead. ThemeKeyContext.ts is not exported from `theme/index.ts` but IS accessible as a deep path import.

**Files to modify:**
1. **Delete:** `packages/core/src/theme/ThemeKeyContext.ts` — the entire file
2. **Verify:** `theme/index.ts` does NOT currently export ThemeKeyContext (confirmed: it does not) — no change needed
3. **Verify:** `packages/core/src/index.ts` does NOT export ThemeKeyContext — confirm with grep before deleting

**If any import of ThemeKeyContext is found in apps/ or packages/ (should be zero per cross-package analysis), update those callers to use `useTheme()` from `ThemeContext` instead.**

**CHANGELOG entry required** (see below).

**Tests:** No ThemeKeyContext tests exist. No test changes needed.

**LOC saved:** ~35 lines.

---

#### M9 — Inline `EngineFrameDriver` into `useSceneEngine.ts`

**Background:** `EngineFrameDriver` is a 29-line class that does only two things: caches the last tick index (dedup), and calls a callback when it changes. It is ONLY imported by `useSceneEngine.ts`. Zero external consumers.

**Files to modify:**
1. **Modify:** `packages/core/src/player/useSceneEngine.ts`
   - Remove import of `EngineFrameDriver` (line 15)
   - Replace the `frameDriverRef = useRef<EngineFrameDriver | null>(null)` ref (line 248) with two simpler refs:
     ```typescript
     const lastTickIndexRef = useRef(-1);
     const onFrameChange = useRef<((state: EngineFrameState) => void) | null>(null);
     ```
   - In the RAF loop effect (lines ~683–704), replace:
     ```typescript
     const frameDriver = new EngineFrameDriver((state) => setFrameState(state));
     frameDriverRef.current = frameDriver;
     // ...
     onAfterTick: () => {
       frameDriver.handleTick(driver.getCurrentTick());
     },
     ```
     with:
     ```typescript
     lastTickIndexRef.current = -1; // reset on each RAF loop lifecycle
     onAfterTick: () => {
       const tick = driver.getCurrentTick();
       if (!tick) return;
       if (tick.index === lastTickIndexRef.current) return;
       lastTickIndexRef.current = tick.index;
       setFrameState({
         tickIndex: tick.index,
         progress: tick.progress,
         sceneId: tick.sceneId,
         sceneIndex: tick.sceneIndex,
         sceneProgress: tick.blockProgress,
         tick,
       });
     },
     ```
   - In the cleanup function: remove `frameDriverRef.current?.reset()` — replace with `lastTickIndexRef.current = -1;`
   - Remove the `frameDriverRef` ref declaration

2. **Delete:** `packages/core/src/player/EngineFrameDriver.ts` — the entire file

3. **Delete:** `packages/core/src/player/__tests__/EngineFrameDriver.test.ts` — the entire test file

4. **Verify:** no other file imports `EngineFrameDriver` (grep to confirm)

5. **Verify:** `EngineFrameDriver` is NOT exported from `player/index.ts` (check — if it is, remove that export and add to CHANGELOG)

**Tests:**
- Run `pnpm --filter @brewsite/core vitest run src/player` to confirm useSceneEngine behavior unchanged
- The behavior being tested (dedup by tick index, setFrameState dispatch) is covered by integration-level tests via the runtime test suite

**LOC saved:** ~30 lines.

---

### W2-C (Developer C): CP9 Deprecation JSDoc + L1 Guard Cleanup

#### CP9 — Zero-Consumer Public Export Deprecations

Per PM Flag 4: add `@deprecated` JSDoc to these exports. **Do NOT remove them.** External npm consumers may use them.

**`useEngineScrubber` exception:** The CP9 note lists it as "unused in direct consumption" but CP10 confirms it IS in the consumer-facing imports list (`apps/` use `useEngineScrubber`). It has tests and is exported from `player/index.ts`. Do NOT deprecate it.

**Files to modify:**

1. **`packages/core/src/player/TimeInput.tsx`**
   - Add to the `TimeInput` component JSDoc:
     ```typescript
     /**
      * @deprecated No known consumers in current packages or apps.
      * This export will be removed in a future version. Use InputCoordinator
      * with an appropriate scroll source configuration instead.
      */
     ```

2. **`packages/core/src/player/ControlledInput.tsx`**
   - Add `@deprecated` JSDoc to `ControlledInput`:
     ```typescript
     /**
      * @deprecated No known consumers in current packages or apps.
      * This export will be removed in a future version.
      */
     ```

3. **`packages/core/src/player/useNativeScrollSource.ts`**
   - Add `@deprecated` JSDoc to `useNativeScrollSource`:
     ```typescript
     /**
      * @deprecated No known consumers in current packages or apps.
      * This export will be removed in a future version.
      */
     ```

4. **`packages/core/src/player/StageScrollSources.ts`** (exports `CustomScrollSource`, `ElementScrollSource`)
   - Add `@deprecated` JSDoc to both `CustomScrollSource` and `ElementScrollSource`

5. **`packages/core/src/player/useSceneRuntime.ts`**
   - Add `@deprecated` JSDoc to `useSceneRuntime`:
     ```typescript
     /**
      * @deprecated No known consumers in current packages or apps.
      * This export will be removed in a future version.
      */
     ```

**Tests:** No test changes needed.

---

#### L1 — Remove Redundant Guard Checks in `coreHandlers.ts`

**File:** `packages/core/src/compiler/coreHandlers.ts`
- The `coreHandlersRegistered` guard at the top of `registerCoreHandlers()` already guarantees idempotency. The inner `if (!getNodeHandler(X))` checks on each `registerNode()` call are always true (since `coreHandlersRegistered = true` was just set).
- Remove all inner `if (!getNodeHandler(X)) {` guards, leaving just the bare `registerNode(...)` calls
- Remove the `getNodeHandler` import if it's no longer used after this change (check: it might be used in the guard logic only)
- Keep the `// DEBT: Inner getNodeHandler() checks are redundant...` comment removal (delete the comment too since the debt is being paid)

**Example — before:**
```typescript
if (!getNodeHandler(Scene)) {
  registerNode(Scene, createSceneRootHandler({ viewHandler, View, ViewLayout }), { category: 'ambient' });
}
```
**After:**
```typescript
registerNode(Scene, createSceneRootHandler({ viewHandler, View, ViewLayout }), { category: 'ambient' });
```

**Tests:**
- Run `pnpm --filter @brewsite/core vitest run src/compiler/__tests__` — the handler registration tests should still pass (idempotency is now guaranteed by the outer guard alone)

**LOC saved:** ~10 lines.

---

### W2-D (Developer D): L6 — InputHud Documentation

Per PM Flag 6 decision: **KEEP InputHud as an intentional extension point.**

**File:** `packages/core/src/hud/InputHud.tsx`
- Update the JSDoc to be explicit about intent:
  ```typescript
  /**
   * InputHud — Renders an overlay showing available input actions.
   *
   * @intentional_stub This component intentionally returns null. It is a documented
   * extension point — the data model (InputHudState) and event plumbing
   * (onActionFired from ActionInputController) are fully implemented. The rendering
   * layer is deferred to a future release. Do NOT remove this stub; its presence
   * in the public API surface is intentional.
   *
   * Implementation: When ready to implement, render the action labels from
   * props.state.actions using an absolutely-positioned overlay inside the
   * EngineOverlayHost. The HudPhaseContext pattern from the existing HUD
   * system provides a reference implementation.
   */
  ```

**Tests:** No test changes needed.

**LOC saved:** 0 (documentation update only).

---

### Wave 2 Completion Gate

Before merging Wave 2:
```bash
pnpm typecheck
pnpm test
```

W2-A must land before Wave 3 begins (Wave 3's M1 splits `transitionTypes.ts` and requires the file to be in its Wave 1+2 state).

---

## Wave 3 — Structural Improvements

Depends on Wave 1 and Wave 2 completing. Within Wave 3, all items are file-disjoint (with the M1/M2 exception noted).

### W3-A (Developer A): M1 — Split `transitionTypes.ts`

**Prerequisite:** Wave 1 W1-A must be complete (H1 extracted rotation math to `rotationMath.ts`, H4 hex helpers moved to `math/`, H5 deduplication done). Wave 2 W2-A must be complete (deprecated/removed `ElementTransitionSpec` code).

**Goal:** `transitionTypes.ts` currently mixes type definitions with blend helper functions (~560 lines after Wave 1+2 cleanups). Split into:
- `transitionTypes.ts` — types only: `ElementTransitionSpec` (deprecated alias), `EaseFn`, `TransitionPhase`, `CompiledTransitionGroup`, `WithTransitionConfig`, `TransitionContext`, `FunctionalTransitionSpec`, `isFunctionalSpec`, `transitionT` (deprecated), re-exports from math, `transitionT`
- `transitionBlendHelpers.ts` — all `blend*` functions: `blendNumber`, `blendDistance`, `blendOpacity`, `blendVec3`, `blendColor`, `blendAxisRotation`, `blendAxisTranslation`, `blendStyleValues`, `blendStyleValuesPartial`, `blendMaterialApplication`, `mergeCssOpacity`, `resolveTransitionOpacity`, `resolveEnabledByOpacity`

**Files to create/modify:**

1. **Create:** `packages/core/src/compiler/transitions/transitionBlendHelpers.ts`
   - Move all `blend*`, `merge*`, `resolve*` functions from `transitionTypes.ts`
   - Keep import of `lerp`, `lerpVec3`, `blendHexColors` from `../../math`
   - Import `blendColor` is defined HERE, so no circular imports
   - Export everything that was exported from `transitionTypes.ts`

2. **Modify:** `packages/core/src/compiler/transitions/transitionTypes.ts`
   - Remove all moved functions
   - Add re-exports: `export { blendNumber, blendColor, ... } from './transitionBlendHelpers';`
   - This preserves backward compatibility for any importer using `from './transitionTypes'`

3. **Modify:** `packages/core/src/compiler/transitions/transitionResolver.ts`
   - Update import to import `clamp01` from `./transitionTypes` (it currently does this — no change needed since types still re-exports it)

4. **Do NOT modify** `compiler/index.ts`, `math/index.ts`, or element `compile.ts` files — they import from `transitionTypes` which still re-exports everything. No cascading changes needed.

**Tests:**
- `packages/core/src/compiler/__tests__/transitionTypes.test.ts` — tests still pass since `transitionTypes.ts` re-exports everything
- Run full test suite: `pnpm --filter @brewsite/core test`

---

### W3-B (Developer B): M2 — WeakMap Side-Channel → `CompileApi.layoutContext`

**Problem:** `viewHandlers.ts` uses a module-level WeakMap to pass layout context from `viewLayoutHandler` to `viewHandler`. This is an invisible side-channel that violates the handler contract.

**Files to modify:**

1. **Modify:** `packages/core/src/compiler/sceneDslTypes.ts` (the `CompileApi` interface definition)
   - Add to `CompileApi`:
     ```typescript
     /**
      * Layout context set by viewLayoutHandler during child compilation.
      * Present only when a View is being compiled inside a ViewLayout.
      * Undefined for standalone Views.
      */
     readonly layoutContext?: {
       readonly layoutId: string;
       readonly viewResults: ReadonlyMap<string, ViewLayoutResult>;
     };

     /**
      * Returns a new CompileApi with the given layout context active.
      * Used by viewLayoutHandler to scope child View compilation.
      */
     withLayoutContext(ctx: { layoutId: string; viewResults: Map<string, ViewLayoutResult> }): CompileApi;
     ```
   - Import `ViewLayoutResult` from the appropriate layout types file

2. **Modify:** `packages/core/src/compiler/childApi.ts` (the factory for child `CompileApi` instances)
   - Update `createChildApi` to accept and propagate a `layoutContext` parameter
   - Implement `withLayoutContext` that returns a new API instance with the context set

3. **Modify:** `packages/core/src/compiler/blocks/viewHandlers.ts`
   - Delete the `layoutContextMap` WeakMap (lines 23–30) and the `ViewLayoutContext` type
   - In `viewLayoutHandler`: replace `layoutContextMap.set(api, ...)` with `childApi = api.withLayoutContext({...})` and `helpers.compileChildren(node, childApi)` instead of `helpers.compileChildren(node, api)`
   - In `viewHandler`: replace `layoutContextMap.get(api)` with `api.layoutContext`
   - The save/restore pattern for nested layouts becomes handled naturally since `withLayoutContext` creates a new scoped API

**Note:** This is a behavioral refactor with no externally visible API change. `CompileApi` is in the public surface (`compiler/index.ts` exports its type) but the `layoutContext` field and `withLayoutContext` method are additive.

**Tests:**
- `packages/core/src/compiler/__tests__/viewHandlers.test.tsx` — must pass unchanged
- **New tests required** for `withLayoutContext` scoping. Add to `viewHandlers.test.tsx` (or create `childApi.test.ts`):

  1. **Context propagation:** `withLayoutContext({layoutId, viewResults})` returns a new API; calling `api.layoutContext` on the original returns `undefined`; calling it on the child returns the set context. Verifies no mutation of the base API.

  2. **Scoped child view:** When `viewLayoutHandler` calls `withLayoutContext` before compiling child Views, a child `viewHandler` running against the scoped API sees `api.layoutContext` with the correct `layoutId` and `viewResults`. Verifies layout-aware positioning path.

  3. **Nested ViewLayout restore:** When a second `ViewLayout` is encountered inside the first, the inner handler calls `withLayoutContext` on the already-contexted API. After the inner handler finishes, the outer Views compiled after the inner `ViewLayout` still see the original outer context — not the inner one. This tests that `withLayoutContext` creates a new scoped API (not mutation) so the save/restore semantics are guaranteed structurally.

  All three tests use real `CompileApi` instances (via the existing test factory pattern in `viewHandlers.test.tsx`) — no mocks.

- Run view layout integration tests

---

### W3-C (Developer C): M3 — Registry Consolidation

**Problem:** `compiler/registry.ts` maintains 4 parallel maps for what could be 2.

**Files to modify:**

1. **Modify:** `packages/core/src/compiler/registry.ts`
   - Replace the 4 maps with 2 composite-value maps:
     ```typescript
     type RegistryEntry = {
       readonly handler: NodeHandler;
       readonly category: NodeHandlerCategory | undefined;
     };

     const nodeRegistry = new Map<unknown, RegistryEntry>();
     const nodeRegistryByName = new Map<string, RegistryEntry>();
     ```
   - Extract `getComponentDisplayName` utility:
     ```typescript
     const getComponentDisplayName = (component: unknown): string | undefined => {
       if (typeof component !== 'function') return undefined;
       return (component as { displayName?: string; name?: string }).displayName
         ?? (component as { name?: string }).name;
     };
     ```
   - Update `registerNode`, `getNodeHandler`, `getHandlerCategory`, `clearRegistry` to use the new maps
   - All public function signatures remain unchanged — this is internal refactoring

**Tests:**
- `packages/core/src/compiler/__tests__/` — run all compiler tests
- No new tests needed

**LOC saved:** ~20 lines.

---

### W3-D (Developer D): M5 — LightingWidget Handler Map

**Problem:** `LightingWidget.ts` `CUSTOM_NODE_HANDLER` dispatches 10+ child DSL components via a sequential if/else chain (~100+ lines).

**Files to modify:**

1. **Modify:** `packages/core/src/elements/lighting/LightingWidget.ts`
   - Replace the sequential `if (childEl.type === Ambient) { ... } else if (childEl.type === Directional) { ... }` chain with a handler map **keyed by component reference** (not by display name string).

   **Why component reference, not display name:** The existing if/else chain uses `childEl.type === Ambient` — strict reference equality, which is refactor-safe and minification-safe. Keying by display name string (e.g., `'Ambient'`) would silently break if anyone renames a `displayName` property. Since the handler receives the actual `ReactElement` with `childEl.type` as the component reference, keying by reference is both correct and consistent with how the rest of the compiler works (e.g., `registry.ts` uses component reference as map key).

   ```typescript
   type ChildHandlerFn = (
     childEl: React.ReactElement,
     api: CompileApi,
     helpers: CompileHelpers,
     state: {
       ambients: SceneLighting['ambient'][];
       directionals: SceneLightDirectional[];
       // ... all mutable accumulator arrays
     },
   ) => void;

   // Keyed by component function reference — NOT display name string.
   // This is minification-safe and refactor-safe.
   const CHILD_HANDLERS = new Map<unknown, ChildHandlerFn>([
     [Ambient, (childEl, api, helpers, acc) => {
       const resolved = helpers.resolveObjectValues(
         childEl.props as AmbientProps, api.context,
       ) as SceneLighting['ambient'];
       acc.ambients.push({ ...resolved, id: resolved.id ?? `ambient-${acc.ambients.length}` });
     }],
     [Directional, (childEl, api, helpers, acc) => {
       // push to acc.directionals
     }],
     // ... one entry per component type (Spot, Point, GlowPoint, LightStrand, Wave, Circle, Rectangle, Panel)
   ]);

   readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
     const children = helpers.collectChildren(node);
     const acc = { ambients: [], directionals: [], /* ... */ };
     for (const child of children) {
       if (!isValidElement(child)) continue;
       const handler = CHILD_HANDLERS.get((child as React.ReactElement).type);
       if (handler) {
         handler(child as React.ReactElement, api, helpers, acc);
       } else {
         const name = ((child as React.ReactElement).type as { displayName?: string })?.displayName;
         console.warn(`[Lighting] Unexpected child component: ${name ?? 'unknown'}`);
       }
     }
     // assemble final SceneLighting state from acc and call api.setWidgetState(...)
   };
   ```

   The `CHILD_HANDLERS` map is module-level (outside the class) and initialized once. It closes over the DSL component references (`Ambient`, `Directional`, etc.) which are defined at the top of the same file.

**Tests:**
- Lighting integration tests (if any exist in `elements/lighting/__tests__/`) must pass
- Manual smoke test: a scene with multiple lighting types (directional, spots, glow) renders correctly

**LOC saved:** ~30 lines.

---

### W3-E (Developer E): Minor Cleanups L2, L3, L5, L7, L8, L9, L10

These are small independent cleanups that don't justify full work stream scope. One developer handles all.

**L2 — WidgetRegistry routing logic duplication:**
- **File:** `packages/core/src/widget/WidgetRegistry.ts`
- Extract shared routing logic from `dispatchToWidget`, `registerTypeFactory`, and `register` into a private `resolveNodeHandler(component)` helper
- Keep all public method signatures unchanged

**L3 — `MaterialLoader.getLoadedPreset()` always returns null:**
- **File:** `packages/core/src/widget/MaterialLoader.ts` (lines 150–160)
- The method loops with `void preset` (loop variable unused) and always returns null
- Decision: remove the loop, keep only the final `return null` comment explaining that callers must use `getLoadedPresetByKey`:
  ```typescript
  getLoadedPreset(_presetName: string): LoadedMaterialPreset | null {
    // Cache is keyed by resolved URL, not preset name. Use getLoadedPresetByKey()
    // with the full preset + basePath to perform a direct lookup.
    return null;
  }
  ```

**L5 — `useEngineState` name conflict:**
- **Resolution (researched):** `EngineStateContext.ts` exports `useEngineState` (a low-level context hook). `player/index.ts` exports `useEngineState` from `./useEngineState` (a different, more sophisticated overloaded hook). These have the same name but different behaviors. The `EngineStateContext.useEngineState` is **NOT** re-exported from `player/index.ts` — it is internal-only. It is imported directly by 3 internal files:
  - `packages/core/src/player/useCurrentScene.ts`
  - `packages/core/src/player/EngineGate.tsx`
  - `packages/core/src/player/useSceneProgress.ts`
- **Action (concrete, no ambiguity):**
  1. In `packages/core/src/player/EngineStateContext.ts`: rename `useEngineState` → `useEngineStateContext`. No deprecation alias needed — it's not a public export.
  2. Update the 3 internal callers above: change `import { useEngineState } from './EngineStateContext'` to `import { useEngineStateContext } from './EngineStateContext'` and update usage sites accordingly.
  3. No CHANGELOG entry needed — this is a purely internal rename.
- **Do NOT touch** `packages/core/src/player/useEngineState.ts` or its export in `player/index.ts` — that is the public API and stays unchanged.

**L7 — DSL component return type consistency:**
- Globally: standardize all DSL stub components to use explicit `(): null => null` return type form
- Grep for inconsistent patterns across `elements/*/...Widget.ts` and `compiler/blocks/*.tsx`
- Apply consistent style

**L8 — Type guard pattern standardization in WidgetRegistry:**
- **File:** `packages/core/src/widget/WidgetRegistry.ts` (lines 435–487)
- Standardize 15 type guards to use `'methodName' in widget` pattern (the `in` operator is most readable for interface checking)
- Do not change guard logic, only style

**L9 — `expandNode` swallows errors silently:**
- **File:** `packages/core/src/compiler/sceneDslCompiler.ts` (lines 100–108)
- Replace the silent error discard with `console.warn`:
  ```typescript
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[BrewSite] DSL component threw during expansion: ${message}. ` +
      `Check your scene DSL for invalid JSX props or runtime errors.`,
    );
  }
  ```

**M10 — SceneCanvas RAF Retry Loop Has No Timeout:**
- **File:** `packages/core/src/player/SceneCanvas.tsx` (lines 51–68)
- The `engineId` binding path retries `requestAnimationFrame(tryBind)` indefinitely when `getCanvasBinding(engineId)` returns null. Code has a DEBT comment flagging this risk.
- **Fix:** Add a retry counter with ~300 frame cap:
  ```typescript
  let rafId: number;
  let retries = 0;
  const MAX_RETRIES = 300; // ~5 seconds at 60fps
  const tryBind = () => {
    const binding = getCanvasBinding(engineId);
    if (binding) {
      binding.setCanvasRef(el);
    } else if (retries < MAX_RETRIES) {
      retries++;
      rafId = requestAnimationFrame(tryBind);
    } else {
      console.warn(
        `[SceneCanvas] Engine "${engineId}" not found after ${MAX_RETRIES} frames (~5s). ` +
        `Verify the engine with this ID is mounted and its engineId prop matches.`,
      );
    }
  };
  rafId = requestAnimationFrame(tryBind);
  ```
- Remove the DEBT comment once fixed.
- **Tests:** No new tests needed — this guards an error path. Manual verification: mounting a `SceneCanvas` with a nonexistent `engineId` produces a `console.warn` after ~300 frames instead of spinning forever.

**L10 — Duplicate scroll progress computation in ScrollStage:**
- **File:** `packages/core/src/player/ScrollStage.tsx`
- Extract `computeRawProgress(scrollTop: number, maxScrollTop: number): number` pure function
- Replace the 3 inline `maxScrollTop <= 0 ? 0 : clamp01(scrollTop / maxScrollTop)` computations with calls to this function

---

### Wave 3 Completion Gate

```bash
pnpm typecheck
pnpm test
pnpm --filter @brewsite/diagram test
pnpm --filter @brewsite/model test
pnpm --filter @brewsite/charts test
```

---

## Wave 4 — Large Refactors (Evaluate ROI, No Planned Implementation)

These items are documented here for future roadmap consideration. **Do not implement in this sprint.**

### M6 — InputCoordinator Ref Sprawl → State Machine

**File:** `packages/core/src/player/InputCoordinator.tsx` (683 lines, 5+ raw refs)

**Evaluation criteria:**
- Effort: High (~1–2 days)
- Risk: Medium (touches scroll inertia, carousel step, touch handling, axis arbitration)
- Benefit: Improved testability; reduced state debugging complexity
- Recommendation: Evaluate when InputCoordinator bugs become common or a new input feature is planned

### M7 — 6 Scroll-Related Contexts → Grouped Contexts

**Per PM Flag 5: Evaluate as part of next major version planning only.**

Reason: merging contexts changes the public API surface (`useScrollRegion`, `useScrollNavigator`, etc. become properties of a single context object). Apps importing individual hooks would need updates. This is a minor→major version concern.

---

## Parallelization Summary

### Wave 1 (5 parallel streams, 2–3 hours)

| Stream | Developer | Items | Files touched |
|--------|-----------|-------|---------------|
| W1-A | Dev A | H1 + H4 + H5 | `transitionTypes.ts`, `rotationMath.ts` (new), `math/index.ts` |
| W1-B | Dev B | H2 | `input/transitionAnimator.ts` |
| W1-C | Dev C | H6 | `elements/lighting/compile.ts` |
| W1-D | Dev D | H7 | `math/index.ts`¹, `SceneProgressMapper.ts`, `transitionPresets.ts`, `camera/compile.ts` |
| W1-E | Dev E | L4 | `widget/useCarouselIndex.ts` → `useCarouselState.ts` |

¹ **`math/index.ts` belongs exclusively to W1-A.** W1-A adds both `blendHexColors` (H4) and `clamp` (H7) to `math/index.ts`. W1-D task description has been updated to explicitly exclude `math/index.ts` — Developer D imports `clamp` and `clamp01` from math but does not modify the file. W1-D depends on W1-A landing first, or can be merged in any order since W1-D only reads math exports (no conflict).

### Wave 2 (4 parallel streams, 3–5 hours)

| Stream | Developer | Items | Files touched |
|--------|-----------|-------|---------------|
| W2-A | Dev A | H3 | `transitionTypes.ts`, `sceneTrackCompiler.ts`, `widget/types.ts`, 5× element `compile.ts`, 5× element `index.ts`, 10+ test files |
| W2-B | Dev B | M8 + M9 | `theme/ThemeKeyContext.ts` (delete), `player/EngineFrameDriver.ts` (delete), `player/useSceneEngine.ts`, test files |
| W2-C | Dev C | CP9 + L1 | 5 player files (JSDoc only), `compiler/coreHandlers.ts` |
| W2-D | Dev D | L6 | `hud/InputHud.tsx` (JSDoc only) |

### Wave 3 (5 parallel streams, 4–6 hours)

| Stream | Developer | Items | Files touched |
|--------|-----------|-------|---------------|
| W3-A | Dev A | M1 | `compiler/transitions/transitionBlendHelpers.ts` (new), `transitionTypes.ts` |
| W3-B | Dev B | M2 | `compiler/sceneDslTypes.ts`, `compiler/childApi.ts`, `compiler/blocks/viewHandlers.ts` |
| W3-C | Dev C | M3 | `compiler/registry.ts` |
| W3-D | Dev D | M5 | `elements/lighting/LightingWidget.ts` |
| W3-E | Dev E | M10, L2, L3, L5, L7, L8, L9, L10 | `SceneCanvas.tsx`, `WidgetRegistry.ts`, `MaterialLoader.ts`, `EngineStateContext.ts`, misc |

---

## Testing Strategy

### Per-change test requirements

| Item | Test approach |
|------|--------------|
| H1 | Existing `blendAxisRotation` tests pass unchanged — verify rotation behavior is preserved |
| H2 | Existing `ActionInputController.test.ts` passes — no new tests |
| H3 | Migrate element `*TransitionSpec` test blocks to functional equivalents; compiler test fixtures updated |
| H4 | Existing `blendColor` tests pass — new `blendHexColors` in math covered by delegation |
| H5 | Existing `blendStyleValues`/`blendStyleValuesPartial` tests pass after consolidation |
| H6 | Lighting compile tests pass unchanged — verify light array blending behavior preserved |
| H7 | `SceneProgressMapper` tests pass; camera compile tests pass |
| M1 | Full test suite passes — `transitionTypes` still re-exports everything |
| M2 | View handler tests pass; layout context propagation verified |
| M3 | Registry tests pass; all handler lookup behaviors preserved |
| M8 | No ThemeKeyContext tests exist; typecheck passes |
| M9 | `useSceneEngine` integration behavior unchanged; `EngineFrameDriver.test.ts` deleted |
| L1 | Handler registration tests pass; duplicate registration is still prevented by outer guard |

### Regression gate

Before each wave merge to main:
```bash
pnpm typecheck           # all packages
pnpm test                # all packages
pnpm --filter @brewsite/examples build  # verify no broken imports in apps
```

---

## CHANGELOG Entries

### Version X.Y.0 (minor bump)

**Breaking Changes:**
- `ThemeKeyContext` and `useThemeKey` are removed from `@brewsite/core`. All theme consumers should use `useTheme()` from `ThemeContext`, or `api.context.themeFamily` / `api.context.themePolarity` in NodeHandlers. [M8]

**Note on `ISceneElement.transitionSpec`:** The union type `ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>` is retained in this version. `ElementTransitionSpec` is deprecated — the compiler no longer processes it and will emit a `console.warn` at runtime. Narrowing the type to `FunctionalTransitionSpec<TState>` only is deferred to the next major version. [H3]

**Deprecated (will be removed in next major version):**
- `ElementTransitionSpec<T>` type — replace with `FunctionalTransitionSpec<T>`. [H3]
- `transitionT(i, len)` — was used only by `ElementTransitionSpec` implementations. [H3]
- `isFunctionalSpec()` — no longer needed; all widgets use `FunctionalTransitionSpec`. [H3]
- `makeSimpleContext()` — used only by `ElementTransitionSpec` delegates. [H3]
- `TimeInput` component — no known consumers. [CP9]
- `ControlledInput` component — no known consumers. [CP9]
- `useNativeScrollSource()` hook — no known consumers. [CP9]
- `CustomScrollSource` class — no known consumers. [CP9]
- `ElementScrollSource` class — no known consumers. [CP9]
- `useSceneRuntime()` hook — no known consumers. [CP9]

**Removed (per-element discrete transition specs):**
- `backgroundTransitionSpec` — use `functionalBackgroundTransitionSpec`. [H3]
- `floorTransitionSpec` — use `functionalFloorTransitionSpec`. [H3]
- `environmentTransitionSpec` — use `functionalEnvironmentTransitionSpec`. [H3]
- `lightingTransitionSpec` — use `functionalLightingTransitionSpec`. [H3]
- `cameraTransitionSpec` — use `functionalCameraTransitionSpec`. [H3]

**Internal improvements (no API changes):**
- Quaternion math extracted to `compiler/transitions/rotationMath.ts`, clarifying rotation convention. [H1]
- `blendHexColors` added to `math/index.ts`. [H4]
- `clamp(min, max, value)` added to `math/index.ts`. [H7]
- `blendStyleValues` and `blendStyleValuesPartial` unified under a single implementation. [H5]
- Lighting compile.ts: `blendLightArray` and `blendSpots` unified via `blendIdKeyedArray`. [H6]
- Easing functions consolidated — `input/transitionAnimator.ts` now re-exports from `transitionPresets.ts`. [H2]
- `EngineFrameDriver` inlined into `useSceneEngine.ts` (internal only). [M9]
- `compiler/transitions/transitionTypes.ts` split into types + blend helpers. [M1]
- ViewLayout layout context passes through `CompileApi` instead of a WeakMap side-channel. [M2]
- Compiler registry consolidated from 4 parallel maps to 2 composite maps. [M3]
- LightingWidget child handler chain replaced with handler map. [M5]

---

## Version Bump Guidance

**Bump type:** Minor (X.Y+1.0)

**Rationale:**
- One public API deletion: `ThemeKeyContext` and `useThemeKey` (M8)
- Per-element `ElementTransitionSpec` impls removed, but they were not in the root barrel — only in element subpath `index.ts` files
- `ISceneElement.transitionSpec` union type preserved (conservative path — no type narrowing this version)
- Deprecations added to `ElementTransitionSpec` type and 6 previously-public exports (CP9) — additive

**NOT major because:**
- `ElementTransitionSpec` type itself is retained as `@deprecated` alias (not deleted)
- `ISceneElement.transitionSpec` union type NOT narrowed this version (deferred to major)
- No widget interface (`IWidget` hierarchy) additions or removals
- No `compiler/index.ts` authoring surface changes
- The removed specs (`backgroundTransitionSpec`, etc.) were NOT exported from the root `packages/core/src/index.ts` barrel — only from element `index.ts` subpaths accessible only via deep path imports

**Patch bump items (if shipped alone):**
- Wave 1 all items are patch-safe (pure internal deduplication, zero API changes)
- Waves 3+4 structural improvements are patch-safe if Wave 2 ships first

**Recommended release strategy:**
1. Ship Wave 1 as a patch (X.Y.Z+1) — zero risk, pure deduplication
2. Ship Waves 2+3 together as the minor bump (X.Y+1.0) — includes all deprecations and dead code removal
3. Major version: remove deprecated `ElementTransitionSpec` type and CP9 exports entirely

---

## File Inventory

### New files created
- `packages/core/src/compiler/transitions/rotationMath.ts` (H1)
- `packages/core/src/compiler/transitions/transitionBlendHelpers.ts` (M1, Wave 3)

### Files deleted
- `packages/core/src/theme/ThemeKeyContext.ts` (M8)
- `packages/core/src/player/EngineFrameDriver.ts` (M9)
- `packages/core/src/player/__tests__/EngineFrameDriver.test.ts` (M9)
- `packages/core/src/widget/useCarouselIndex.ts` → renamed to `useCarouselState.ts` (L4)

### Files with significant modifications
- `packages/core/src/compiler/transitions/transitionTypes.ts` (H1, H4, H5, H3 deprecations, M1 split)
- `packages/core/src/compiler/sceneTrackCompiler.ts` (H3 code path replacement with warn)
- `packages/core/src/widget/types.ts` (H3 deprecation JSDoc on transitionSpec union — no type change)
- `packages/core/src/math/index.ts` (H4 blendHexColors, H7 clamp)
- `packages/core/src/player/useSceneEngine.ts` (M9 inline)
- `packages/core/src/player/SceneCanvas.tsx` (M10 retry guard)
- `packages/core/src/player/EngineStateContext.ts` (L5 rename)
- `packages/core/src/player/useCurrentScene.ts` + `EngineGate.tsx` + `useSceneProgress.ts` (L5 callers)
- 5× element `compile.ts` files (H3 spec deletion)
- 5× element `index.ts` files (H3 export removal)
- 10+ test files (H3 migration)
