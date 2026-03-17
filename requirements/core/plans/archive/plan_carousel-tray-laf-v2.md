---
title: "Carousel Tray LAF Overhaul v2 — Shape, Theme Reactivity, Surface Texture"
doc_type: plan
owner: "Toolkit Architecture"
status: active
updated: 2026-03-15
---

# Carousel Tray LAF Overhaul v2

## 1. Goal

Address four interrelated issues with the carousel tray visual system:

1. **Linear tray shape** — Replace the hardcoded ellipse with a parabolic (x²) cross-section that matches the fan-out arrangement of linear carousels.
2. **Theme reactivity** — Fix color/polarity not updating when the scene theme changes at runtime.
3. **Surface texture** — Formalize the accidental "onyx" striated look as an intentional, configurable procedural surface pattern with per-theme intensity and style.
4. **Texture rotation** — For ring carousels, rotate the surface texture in sync with carousel rotation so the pattern tracks the disc's logical orientation.

Additionally: make the surface pattern **fully themeable** and allow developers to supply their own `THREE.Texture` as a custom surface map.

## 2. Summary of Changes

| Area | What changes |
|---|---|
| **Linear tray geometry** | Flat ellipse → parabolic-arc shape. The Z-profile of the front/back edges follows `z = -k·x²`, matching the fan-out curve of linear carousel views. |
| **Ring tray geometry** | Stays elliptical (matches ring layout). No shape change. |
| **Surface pattern system** | New `CarouselTraySurfacePattern` union type. Procedural normal map generated on canvas. Replaces the accidental vertex-facet striations. |
| **Texture UV rotation** | For ring carousels, `material.normalMap.rotation` tracks `(activeIndex / childCount) * 2π` so the pattern rotates with the ring. |
| **Theme reactivity fix** | (a) Add `material.needsUpdate = true` when `transparent` changes, (b) add defensive last-theme-ref tracking in cache, (c) ensure scene recompilation fires on theme change for any scene with a `<CarouselTray>`. |
| **Theme type expansion** | `SceneThemeCarouselTray` gains `surfacePattern?`, `surfaceIntensity?`, `surfaceMapUrl?` fields. |
| **Per-theme LAF tuning** | Distinct surface patterns and material parameters for each of the 12 theme-polarity combinations. |
| **Custom texture support** | New `surfaceMapUrl` prop on `<CarouselTray>` and theme type — loads a developer-provided texture as the surface normal map. |

## 3. Architecture Design

### 3.1. Linear Tray Shape — Parabolic Arc

**Current state**: `render.ts` line 478 hardcodes `const isEllipse = true`, so all carousels (both ring and linear) get an elliptical footprint.

**New design**: Two distinct shape generators depending on `state.loop`:

- **Ring (`loop=true`)**: Ellipse (unchanged) — matches the ring arrangement.
- **Linear (`loop=false`)**: Parabolic-arc shape. The 2D outline (viewed from above, in the XZ plane after rotation) follows two parallel parabolas:

```
Front edge: z_front(x) = -k·x² + bandWidth/2
Back edge:  z_back(x)  = -k·x² - bandWidth/2
```

Where:
- `k = zStep / (halfWidth²)` — curvature derived from the carousel's `zStep` and total tray width.
- `halfWidth = worldWidth / 2`
- `bandWidth` = Z thickness of the tray band (computed from `zStep`): `max(zStep * 0.25, worldWidth * 0.15, 1.5)`
- If `zStep === 0` (flat linear), fall back to a rounded rectangle (no parabolic curvature).

The shape is created as a `THREE.Shape` by sampling the parabola at regular intervals along X:

```typescript
function createParabolicShape(
  halfWidth: number,
  zStep: number,
  bandWidth: number,
  segments: number,
): THREE.Shape {
  const k = zStep > 0 ? zStep / (halfWidth * halfWidth) : 0;
  const shape = new THREE.Shape();

  // Front edge: left to right (positive X)
  // At x=0 (center): z = bandWidth/2 (closest to camera)
  // At x=±halfWidth: z = -k·halfWidth² + bandWidth/2 = -zStep + bandWidth/2
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -halfWidth + t * 2 * halfWidth;
    const z = -k * x * x + bandWidth / 2;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }

  // Back edge: right to left (cap at edges)
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const x = -halfWidth + t * 2 * halfWidth;
    const z = -k * x * x - bandWidth / 2;
    shape.lineTo(x, z);
  }

  shape.closePath();
  return shape;
}
```

**Compile-time parameters**: `zStep` and `viewExtent.w` (which determines `worldWidth`) are already in `CarouselScrubberState`. No new compile-time fields needed — the parabolic shape is computed from existing state in the render layer.

**Segments**: 32 segments is sufficient for a smooth parabola at typical tray widths.

### 3.2. Surface Texture System

**Current state**: The "onyx" striation pattern in the current build is accidental — it comes from the 48-segment ellipse creating faceted normals that interact with metallic material and directional lighting. This is uncontrolled, varies with camera angle, and doesn't respond to theme changes.

**New design**: Procedural normal map generated on an offscreen `<canvas>`, applied as `material.normalMap`. This gives:
- Controllable pattern (theme-configurable)
- Controllable intensity (theme-configurable via `material.normalScale`)
- UV-based rotation for ring carousel tracking
- Developer-customizable via `surfaceMapUrl`

#### 3.2.1. Surface Pattern Types

New union type in `types.ts`:

```typescript
/**
 * Procedural surface pattern applied as a normal map to the carousel tray.
 *
 * - `'brushed'` — Fine parallel lines radiating from center. Anisotropic metallic look.
 * - `'radial'` — Concentric circles from center. Machined/turned metal look.
 * - `'crosshatch'` — Crossed diagonal lines. Knurled/textured feel.
 * - `'grain'` — Subtle random noise grain. Organic stone/onyx feel.
 * - `'none'` — No surface pattern. Clean flat material.
 */
export type CarouselTraySurfacePattern =
  | 'brushed'
  | 'radial'
  | 'crosshatch'
  | 'grain'
  | 'none';
```

#### 3.2.2. Normal Map Generation

New file: `packages/core/src/elements/carousel-scrubber/surfaceTexture.ts`

This is a render-adjacent utility (uses canvas 2D API, produces THREE.Texture). It does NOT import React or compiler internals. It MAY import Three.js for `THREE.CanvasTexture`, `THREE.RepeatWrapping`, and `THREE.Vector2`.

**Module responsibility**: Generate procedural normal maps for carousel tray surfaces.

```typescript
// surfaceTexture.ts — Procedural normal-map generation for carousel tray surfaces.
// Render-adjacent utility: uses Canvas 2D API, produces THREE.CanvasTexture.

import * as THREE from 'three';
import type { CarouselTraySurfacePattern } from './types';

/** Resolution of the generated normal map canvas. */
const TEX_SIZE = 512;

/**
 * Generates a procedural normal map for the given surface pattern.
 *
 * Returns a THREE.CanvasTexture with RepeatWrapping. The texture is ready
 * for use as material.normalMap. Caller controls intensity via
 * material.normalScale.
 *
 * @param pattern - The surface pattern to generate.
 * @returns A THREE.CanvasTexture, or null for 'none'.
 */
export function generateSurfaceNormalMap(
  pattern: CarouselTraySurfacePattern,
): THREE.CanvasTexture | null;

/**
 * Loads an external texture URL as a normal map.
 * Uses THREE.TextureLoader. Returns a promise that resolves
 * when the texture is loaded.
 */
export function loadCustomSurfaceMap(
  url: string,
): Promise<THREE.Texture>;
```

Pattern generation algorithms (all produce RGBA pixel data encoding a normal map in tangent space — R=x, G=y, B=z, A=1):

**`'brushed'`** — Fine radial lines emanating from the center of the canvas:
- For each pixel (u, v), compute angle from center: `θ = atan2(v - 0.5, u - 0.5)`
- Displacement = `sin(θ * lineCount) * 0.5 + 0.5` where `lineCount = 120`
- Convert displacement gradient to normal: perturb X/Y normal components based on angular derivative
- This creates a "turned on a lathe" look, like brushed stainless steel

**`'radial'`** — Concentric rings from center:
- For each pixel, compute distance from center: `r = sqrt((u-0.5)² + (v-0.5)²)`
- Displacement = `sin(r * ringCount * 2π) * 0.5 + 0.5` where `ringCount = 40`
- Normal perturbation along the radial direction

**`'crosshatch'`** — Two sets of diagonal lines at ±45°:
- `d1 = sin((u + v) * lineCount * 2π)` where `lineCount = 60`
- `d2 = sin((u - v) * lineCount * 2π)`
- Combined displacement = `d1 * d2`
- This creates a diamond knurl pattern (the "onyx" look, but controlled)

**`'grain'`** — Pseudo-random noise with smooth interpolation:
- Use a seeded 2D noise function (value noise or simplex approximation)
- Frequency = 80 (fine grain), Amplitude = 0.3 (subtle)
- The seed is deterministic per canvas generation (stable across frames)
- Produces an organic, stone-like texture

**`'none'`** — Returns `null`. No normal map applied.

**Intensity**: The caller sets `material.normalScale = new THREE.Vector2(intensity, intensity)` where `intensity` comes from the theme. Range: `0.0` (invisible) to `1.0` (full). Recommended per-theme defaults:

| Theme | Pattern | Intensity |
|---|---|---|
| enterprise dark | brushed | 0.25 |
| enterprise light | brushed | 0.15 |
| darkGlass dark | grain | 0.20 |
| darkGlass light | grain | 0.12 |
| midnight dark | brushed | 0.30 |
| midnight light | brushed | 0.18 |
| neonCyber dark | crosshatch | 0.35 |
| neonCyber light | crosshatch | 0.20 |
| lightCanvas light | none | 0 |
| lightCanvas dark | grain | 0.15 |
| lightMinimal light | none | 0 |
| lightMinimal dark | none | 0 |

**Caching**: Normal map textures are cached by pattern name in a module-level `Map<string, THREE.CanvasTexture>`. Generating a normal map is a one-time cost (~5ms for 512×512). Custom URL textures are cached by URL.

### 3.3. Texture UV Rotation for Ring Carousels

For ring carousels, the tray visually represents a rotating disc. When the carousel advances, the disc should appear to rotate. We achieve this by rotating the normal map's UV mapping.

**Implementation**: In `applyCarouselScrubber`, after setting the normal map:

```typescript
if (normalMapTexture && state.loop && state.childCount > 0) {
  // Rotation angle: active index position on the ring
  const angle = (state.activeIndex / state.childCount) * Math.PI * 2;
  normalMapTexture.rotation = angle;
  normalMapTexture.center.set(0.5, 0.5); // rotate around texture center
  normalMapTexture.needsUpdate = true;
}
```

For linear carousels, no rotation is applied — the texture stays fixed.

**Transition blending**: The `activeIndex` is already blended numerically in the `FunctionalTransitionSpec`, producing fractional values during transitions. The rotation angle will smoothly interpolate as a natural consequence.

### 3.4. Theme Reactivity Fix

**Root cause analysis**: The theme reactivity chain was traced end-to-end:

1. `ThemeToggle` → `setPolarity`/`setFamily` → new `ActiveTheme` object
2. `SceneEngine` → `resolveSceneTheme(family, polarity)` → new `SceneTheme` from registry
3. `useSceneEngine` → theme sync effect → `scene.userData.__brewsite_scene_theme` updated
4. Next frame → `resolveThemedStyle` reads new theme → returns new style
5. `ensureBase` → material properties updated

The chain is structurally correct. However, three defensive fixes address possible edge cases:

**Fix A — `material.needsUpdate` on transparency change**:
When `transparent` changes from `false` to `true` or vice versa, Three.js needs to re-sort the render queue. While all current theme presets have `opacity < 1`, a developer could configure `opacity: 1.0` (opaque), and switching to a theme with `opacity < 1` would need `needsUpdate`.

In `ensureBase`, after setting material properties:
```typescript
const transparentNow = style.baseOpacity < 1;
if (cache.base!.material.transparent !== transparentNow) {
  cache.base!.material.transparent = transparentNow;
  cache.base!.material.needsUpdate = true;
}
```

**Fix B — Force material update on theme reference change**:
Add `lastThemeRef` to the cache. When the theme object reference changes, force a full material property update even if the style values appear identical (handles floating-point comparison edge cases in resolveThemedStyle).

Add to `CarouselScrubberCache`:
```typescript
lastThemeRef: SceneTheme | null | undefined;
```

In `applyCarouselScrubber`, before `ensureBase`:
```typescript
const themeChanged = theme !== cache.lastThemeRef;
cache.lastThemeRef = theme;
```

Pass `themeChanged` into `ensureBase` and force `needsRecreate = true` if the edge style changed due to theme, or at minimum, ensure material properties are always written (which they already are — this is a safety net).

**Fix C — Ensure CarouselTray re-emits on scene recompilation**:
When the scene track is recompiled (because the scene components re-render with a new theme), the `viewLayoutHandler` re-runs and emits new `CarouselScrubberState`. The compiled state has default style values, which is correct — theme resolution happens at render time. No change needed here, but document this invariant in the code.

### 3.5. Developer-Custom Surface Texture

The `surfaceMapUrl` prop allows developers to supply their own normal map texture URL:

```tsx
<CarouselTray surfaceMapUrl="/textures/carbon-fiber-normal.png" surfaceIntensity={0.4} />
```

When `surfaceMapUrl` is set:
- The procedural texture is NOT generated
- The URL is loaded via `THREE.TextureLoader`
- The loaded texture is applied as `material.normalMap`
- `surfaceIntensity` controls `material.normalScale`

At the theme level:
```typescript
carouselTray: {
  surfaceMapUrl: '/textures/custom-normal.png',
  surfaceIntensity: 0.3,
}
```

Priority: DSL prop > theme value > compiled default.

Loading is async. The tray renders immediately with no normal map; when the texture loads, `material.normalMap` is assigned and `material.needsUpdate = true`.

## 4. Type Changes

### 4.1. `packages/core/src/elements/carousel-scrubber/types.ts`

Add:
```typescript
/**
 * Procedural surface pattern applied as a normal map to the carousel tray.
 *
 * - `'brushed'` — Fine parallel lines radiating from center. Anisotropic metallic look.
 * - `'radial'` — Concentric rings from center. Machined/turned metal look.
 * - `'crosshatch'` — Crossed diagonal lines. Knurled/textured feel.
 * - `'grain'` — Subtle random noise grain. Organic stone/onyx feel.
 * - `'none'` — No surface pattern. Clean flat material.
 */
export type CarouselTraySurfacePattern =
  | 'brushed'
  | 'radial'
  | 'crosshatch'
  | 'grain'
  | 'none';
```

Update `CarouselScrubberStyle` — add three fields:
```typescript
export type CarouselScrubberStyle = {
  baseColor: string;
  baseOpacity: number;
  accentColor: string;
  metalness: number;
  roughness: number;
  edgeStyle: CarouselTrayEdgeStyle;
  /** Surface texture pattern. Default: 'brushed'. */
  surfacePattern: CarouselTraySurfacePattern;
  /** Surface texture intensity [0-1]. Default: 0.25. */
  surfaceIntensity: number;
  /** Optional URL to a custom normal map texture. Overrides surfacePattern when set. */
  surfaceMapUrl: string | null;
};
```

### 4.2. `packages/core/src/theme/types.ts` — `SceneThemeCarouselTray`

Add three optional fields:
```typescript
export type SceneThemeCarouselTray = {
  // ... existing fields ...
  /** Surface texture pattern. */
  readonly surfacePattern?: 'brushed' | 'radial' | 'crosshatch' | 'grain' | 'none';
  /** Surface texture intensity [0-1]. */
  readonly surfaceIntensity?: number;
  /** URL to a custom normal map texture. Overrides surfacePattern when set. */
  readonly surfaceMapUrl?: string;
};
```

### 4.3. `packages/core/src/elements/carousel-scrubber/dsl.tsx` — `CarouselTrayProps`

Add three optional props:
```typescript
export type CarouselTrayProps = {
  // ... existing props ...
  /** Surface texture pattern. Default: 'brushed'. */
  surfacePattern?: 'brushed' | 'radial' | 'crosshatch' | 'grain' | 'none';
  /** Surface texture intensity [0-1]. Default: 0.25. */
  surfaceIntensity?: number;
  /** URL to a custom normal map texture. Overrides surfacePattern when set. */
  surfaceMapUrl?: string;
};
```

### 4.4. `CarouselScrubberProps` (backward compat type)

The `style` partial already accepts `Partial<CarouselScrubberStyle>`, which will automatically include the new fields. No change needed.

## 5. Compile Layer Changes

### 5.1. `packages/core/src/elements/carousel-scrubber/compile.ts`

Update `DEFAULT_CAROUSEL_SCRUBBER_STYLE`:
```typescript
export const DEFAULT_CAROUSEL_SCRUBBER_STYLE: CarouselScrubberStyle = {
  baseColor: '#1E2F44',
  baseOpacity: 0.82,
  accentColor: '#5090e0',
  metalness: 0.35,
  roughness: 0.6,
  edgeStyle: 'knurled',
  surfacePattern: 'brushed',
  surfaceIntensity: 0.25,
  surfaceMapUrl: null,
};
```

Update `blendStyle` — add new fields:
```typescript
function blendStyle(from: CarouselScrubberStyle, to: CarouselScrubberStyle, t: number): CarouselScrubberStyle {
  return {
    // ... existing blends ...
    surfacePattern: t < 0.5 ? from.surfacePattern : to.surfacePattern,
    surfaceIntensity: blendNumber(from.surfaceIntensity, to.surfaceIntensity, t) ?? to.surfaceIntensity,
    surfaceMapUrl: t < 0.5 ? from.surfaceMapUrl : to.surfaceMapUrl,
  };
}
```

### 5.2. `packages/core/src/compiler/blocks/viewHandlers.ts`

In the CarouselTray detection block, add new props to the style object:
```typescript
style: {
  // ... existing fields ...
  surfacePattern: trayProps.surfacePattern,
  surfaceIntensity: trayProps.surfaceIntensity,
  surfaceMapUrl: trayProps.surfaceMapUrl,
},
```

## 6. Render Layer Changes

### 6.1. `packages/core/src/elements/carousel-scrubber/render.ts` — Major Updates

#### 6.1.1. Cache Type Update

Add to `CarouselScrubberCache`:
```typescript
export type CarouselScrubberCache = {
  // ... existing fields ...
  /** Last surface pattern used for normal map generation. */
  lastSurfacePattern: CarouselTraySurfacePattern | null;
  /** Last surface map URL. */
  lastSurfaceMapUrl: string | null;
  /** Cached normal map texture. */
  normalMapTexture: THREE.Texture | null;
  /** Last theme reference for change detection. */
  lastThemeRef: unknown;
  /** Whether the shape is elliptical (ring) or parabolic (linear). */
  lastIsLinearParabolic: boolean;
};
```

#### 6.1.2. New Shape Generator — `createParabolicShape`

```typescript
/**
 * Creates a parabolic-arc Shape for linear carousel trays.
 *
 * The outline (viewed from above) follows two parallel parabolic curves:
 *   Front edge: z = -k·x² + bandWidth/2   (closest to camera at center)
 *   Back edge:  z = -k·x² - bandWidth/2   (recedes at center and edges)
 *
 * This matches the fan-out arrangement where the active item (center) is at
 * z=0 and inactive items recede along z = -distance·zStep.
 *
 * @param halfWidth  Half the total tray width along X.
 * @param zStep      Z-depth step per carousel position (from layout config).
 * @param bandWidth  Thickness of the tray band in Z (front-to-back extent).
 * @param segments   Number of segments along each parabolic edge.
 */
function createParabolicShape(
  halfWidth: number,
  zStep: number,
  bandWidth: number,
  segments: number,
): THREE.Shape;
```

The curvature constant `k = zStep / (halfWidth²)`. When `zStep = 0`, `k = 0` and the shape degenerates to a rectangle — which is correct for flat linear carousels.

The parabola is sampled at `segments + 1` points along each edge. With 32 segments, this yields 64 vertices for the outline — comparable to the ellipse's 48.

#### 6.1.3. Updated `createTrayGeometry`

```typescript
function createTrayGeometry(
  width: number,
  zDepth: number,
  height: number,
  isRing: boolean,
  zStep: number,
  bevelRadius: number,
  bevelSegments: number,
  edgeStyle: CarouselTrayEdgeStyle,
): THREE.ExtrudeGeometry {
  let shape: THREE.Shape;

  if (isRing) {
    shape = createEllipseShape(width * 0.5, zDepth * 0.5);
  } else if (zStep > 0) {
    const bandWidth = Math.max(zStep * 0.25, width * 0.15, 1.5);
    shape = createParabolicShape(width * 0.5, zStep, bandWidth, 32);
  } else {
    // Flat linear carousel: rounded rectangle fallback
    shape = createRoundedRectShape(width * 0.5, zDepth * 0.5);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevelRadius,
    bevelSize: bevelRadius,
    bevelSegments,
  });

  // Apply edge treatment for non-ellipse shapes with knurled/ridged style
  if (!isRing && edgeStyle !== 'smooth' && edgeStyle !== 'matte') {
    applyEdgeTreatment(geometry, height, edgeStyle);
  }

  // Rotate so extrusion goes along +Y (up), shape in XZ plane
  geometry.rotateX(-Math.PI / 2);

  return geometry;
}
```

#### 6.1.4. Updated `resolveThemedStyle`

Add the three new fields to the resolution logic:
```typescript
surfacePattern: style.surfacePattern !== defaults.surfacePattern
  ? style.surfacePattern
  : (trayTheme.surfacePattern ?? style.surfacePattern),
surfaceIntensity: style.surfaceIntensity !== defaults.surfaceIntensity
  ? style.surfaceIntensity
  : (trayTheme.surfaceIntensity ?? style.surfaceIntensity),
surfaceMapUrl: style.surfaceMapUrl !== defaults.surfaceMapUrl
  ? style.surfaceMapUrl
  : (trayTheme.surfaceMapUrl ?? style.surfaceMapUrl),
```

#### 6.1.5. Updated `ensureBase`

After setting material color/opacity/metalness/roughness, add normal map management:

```typescript
// -- Surface texture (normal map) --
const wantedPattern = style.surfacePattern;
const wantedMapUrl = style.surfaceMapUrl;
const patternChanged = cache.lastSurfacePattern !== wantedPattern;
const mapUrlChanged = cache.lastSurfaceMapUrl !== wantedMapUrl;

if (patternChanged || mapUrlChanged || needsRecreate) {
  // Dispose old normal map if we created it
  if (cache.normalMapTexture) {
    cache.normalMapTexture.dispose();
    cache.normalMapTexture = null;
  }

  if (wantedMapUrl) {
    // Custom URL: async load
    loadCustomSurfaceMap(wantedMapUrl).then((tex) => {
      if (cache.base && cache.lastSurfaceMapUrl === wantedMapUrl) {
        cache.base.material.normalMap = tex;
        cache.base.material.normalScale.set(style.surfaceIntensity, style.surfaceIntensity);
        cache.base.material.needsUpdate = true;
        cache.normalMapTexture = tex;
      }
    });
  } else {
    // Procedural pattern
    const tex = generateSurfaceNormalMap(wantedPattern);
    cache.normalMapTexture = tex;
    cache.base!.material.normalMap = tex;
    cache.base!.material.needsUpdate = true;
  }

  cache.lastSurfacePattern = wantedPattern;
  cache.lastSurfaceMapUrl = wantedMapUrl;
}

// Always update normalScale (intensity may change between frames via theme)
if (cache.base!.material.normalMap) {
  cache.base!.material.normalScale.set(style.surfaceIntensity, style.surfaceIntensity);
}

// -- Transparency safety --
const transparentNow = style.baseOpacity < 1;
if (cache.base!.material.transparent !== transparentNow) {
  cache.base!.material.transparent = transparentNow;
  cache.base!.material.needsUpdate = true;
}
```

#### 6.1.6. UV Rotation for Ring Carousels

In `applyCarouselScrubber`, after `ensureBase`:

```typescript
// -- Texture rotation for ring carousels --
if (cache.normalMapTexture && state.loop && state.childCount > 0) {
  const rotationAngle = (state.activeIndex / state.childCount) * Math.PI * 2;
  cache.normalMapTexture.rotation = rotationAngle;
  cache.normalMapTexture.center.set(0.5, 0.5);
}
```

#### 6.1.7. Updated `applyCarouselScrubber` Shape Decision

Replace `const isEllipse = true;` with:

```typescript
const isRing = state.loop;
```

Pass `isRing` and `state.zStep` into `ensureBase` → `createTrayGeometry`.

Update the `needsRecreate` check in `ensureBase` to include `lastIsLinearParabolic`:
```typescript
const isLinearParabolic = !isRing && zStep > 0;
const needsRecreate =
  !cache.base ||
  cache.lastWorldWidth !== worldWidth ||
  cache.lastZDepth !== zDepth ||
  cache.lastTrayDepth !== trayDepth ||
  cache.lastEdgeStyle !== style.edgeStyle ||
  cache.lastIsLinearParabolic !== isLinearParabolic;
```

#### 6.1.8. Linear Z-Depth Computation Fix

For linear carousels, the Z-depth of the tray should be the parabola span, not a fraction of zStep. The parabola already defines the Z extent:

```typescript
if (isRing && zStep > 0) {
  // Ring: full ellipse depth
  zDepth = zStep + zStep * 0.15;
} else if (zStep > 0) {
  // Linear parabolic: the parabola Z span is zStep (from center to edge).
  // Band width adds thickness. Total Z extent = zStep + bandWidth.
  const bandWidth = Math.max(zStep * 0.25, worldWidth * 0.15, 1.5);
  zDepth = zStep + bandWidth;
} else {
  // Flat: proportional depth
  zDepth = Math.max(worldWidth * 0.25, 2.0);
}
```

### 6.2. New File: `packages/core/src/elements/carousel-scrubber/surfaceTexture.ts`

**Module responsibility**: Procedural normal-map generation for carousel tray surface textures.

**Imports**:
- `THREE.CanvasTexture`, `THREE.RepeatWrapping`, `THREE.Vector2`, `THREE.TextureLoader` from `'three'`
- `CarouselTraySurfacePattern` from `'./types'`

**Forbidden imports**: React, compiler internals.

**Exports**:
- `generateSurfaceNormalMap(pattern: CarouselTraySurfacePattern): THREE.CanvasTexture | null`
- `loadCustomSurfaceMap(url: string): Promise<THREE.Texture>`

**Internal cache**: `Map<CarouselTraySurfacePattern, THREE.CanvasTexture>` for procedural textures. `Map<string, THREE.Texture>` for URL textures.

**Normal map encoding**: Each pixel encodes a tangent-space normal as (R, G, B) = ((nx+1)/2, (ny+1)/2, (nz+1)/2) × 255. A flat surface (no perturbation) is (128, 128, 255).

**Pattern algorithms** (all operate on a 512×512 canvas):

`'brushed'`:
```
For each pixel (u, v) in [0, 1]:
  θ = atan2(v - 0.5, u - 0.5)
  d = sin(θ × 120) × 0.5  // 120 radial lines
  // Perturb normal based on angular derivative
  nx = cos(θ) × d × 0.5
  ny = sin(θ) × d × 0.5
  nz = sqrt(1 - nx² - ny²)
```

`'radial'`:
```
For each pixel (u, v) in [0, 1]:
  r = sqrt((u - 0.5)² + (v - 0.5)²) × 2
  d = sin(r × 40 × 2π) × 0.5  // 40 concentric rings
  // Perturb normal along radial direction
  dirX = (u - 0.5) / max(r, 0.001)
  dirY = (v - 0.5) / max(r, 0.001)
  nx = dirX × d × 0.5
  ny = dirY × d × 0.5
  nz = sqrt(1 - nx² - ny²)
```

`'crosshatch'`:
```
For each pixel (u, v) in [0, 1]:
  d1 = sin((u + v) × 60 × 2π) × 0.5  // diagonal set 1
  d2 = sin((u - v) × 60 × 2π) × 0.5  // diagonal set 2
  d = d1 × d2  // crosshatch product
  nx = d × 0.4
  ny = d × 0.4
  nz = sqrt(1 - nx² - ny²)
```

`'grain'`:
```
For each pixel (u, v) in [0, 1]:
  // Simple value noise with 2D hash
  noise = hash2D(u × 80, v × 80)  // 80 = grain frequency
  // Smooth with bilinear interpolation between hash points
  smoothNoise = bilinearLerp(floor(u×80), floor(v×80), frac(u×80), frac(v×80))
  nx = ddx(smoothNoise) × 0.3
  ny = ddy(smoothNoise) × 0.3
  nz = sqrt(1 - nx² - ny²)
```

Where `hash2D` is a deterministic hash function like:
```typescript
function hash2D(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
```

## 7. Theme Preset Updates

### 7.1. `packages/core/src/theme/presets.ts`

Update both default presets to include the new surface fields:

```typescript
// defaultSceneTheme (enterprise dark):
carouselTray: {
  color: '#1E2F44',
  opacity: 0.82,
  accentColor: '#5090e0',
  metalness: 0.35,
  roughness: 0.6,
  edgeStyle: 'knurled',
  surfacePattern: 'brushed',
  surfaceIntensity: 0.25,
},

// defaultLightSceneTheme (enterprise light):
carouselTray: {
  color: '#D0DAE4',
  opacity: 0.88,
  accentColor: '#3A6DB5',
  metalness: 0.25,
  roughness: 0.55,
  edgeStyle: 'knurled',
  surfacePattern: 'brushed',
  surfaceIntensity: 0.15,
},
```

### 7.2. Theme Preset Files in `packages/themes/src/presets/scene/`

Complete table of per-theme surface configuration:

| Theme | Polarity | surfacePattern | surfaceIntensity | Notes |
|---|---|---|---|---|
| enterprise | dark | `'brushed'` | 0.25 | Polished steel look |
| enterprise | light | `'brushed'` | 0.15 | Softer, muted |
| darkGlass | dark | `'grain'` | 0.20 | Onyx/obsidian feel |
| darkGlass | light | `'grain'` | 0.12 | Subtle marble |
| midnight | dark | `'brushed'` | 0.30 | Brushed gold/brass |
| midnight | light | `'brushed'` | 0.18 | Lighter brushed metal |
| neonCyber | dark | `'crosshatch'` | 0.35 | Tech/carbon fiber look |
| neonCyber | light | `'crosshatch'` | 0.20 | Softer geometric |
| lightCanvas | light | `'none'` | 0 | Clean/minimal |
| lightCanvas | dark | `'grain'` | 0.15 | Subtle texture |
| lightMinimal | light | `'none'` | 0 | Ultra-clean |
| lightMinimal | dark | `'none'` | 0 | Still minimal |

Each theme preset file adds `surfacePattern` and `surfaceIntensity` to its existing `carouselTray` block.

## 8. Test Strategy

### 8.1. `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts`

**New tests**:

```typescript
it('defaults surfacePattern to brushed', () => {
  const state = compileCarouselScrubber(minimalProps, 0, 0, false);
  expect(state.style.surfacePattern).toBe('brushed');
  expect(state.style.surfaceIntensity).toBe(0.25);
  expect(state.style.surfaceMapUrl).toBeNull();
});

it('applies explicit surfacePattern', () => {
  const props = { ...minimalProps, style: { surfacePattern: 'crosshatch' as const } };
  const state = compileCarouselScrubber(props, 0, 3, false);
  expect(state.style.surfacePattern).toBe('crosshatch');
});

it('applies explicit surfaceMapUrl', () => {
  const props = { ...minimalProps, style: { surfaceMapUrl: '/textures/custom.png' } };
  const state = compileCarouselScrubber(props, 0, 3, false);
  expect(state.style.surfaceMapUrl).toBe('/textures/custom.png');
});
```

**Transition tests**:

```typescript
it('switches surfacePattern at midpoint', () => {
  const from = makeState({ style: { ...DEFAULT, surfacePattern: 'brushed' } });
  const to = makeState({ style: { ...DEFAULT, surfacePattern: 'grain' } });
  const fn = spec.interpolateFn(from, to);
  expect(fn(makeCtx(0.3)).style.surfacePattern).toBe('brushed');
  expect(fn(makeCtx(0.7)).style.surfacePattern).toBe('grain');
});

it('blends surfaceIntensity', () => {
  const from = makeState({ style: { ...DEFAULT, surfaceIntensity: 0.1 } });
  const to = makeState({ style: { ...DEFAULT, surfaceIntensity: 0.5 } });
  const fn = spec.interpolateFn(from, to);
  const mid = fn(makeCtx(0.5));
  expect(mid.style.surfaceIntensity).toBeCloseTo(0.3, 2);
});
```

### 8.2. New: `packages/core/src/elements/carousel-scrubber/__tests__/surfaceTexture.test.ts`

**Module boundary test**: Tests that `generateSurfaceNormalMap` returns proper textures.

Since `surfaceTexture.ts` depends on Three.js (canvas rendering), these tests use `vitest` with `jsdom` or `node` environment and mock `document.createElement('canvas')`:

```typescript
// Mock canvas for Node environment
vi.stubGlobal('document', {
  createElement: (tag: string) => {
    if (tag === 'canvas') return createMockCanvas(512, 512);
    throw new Error(`Unexpected createElement: ${tag}`);
  },
});
```

Tests:
- `generateSurfaceNormalMap('none')` returns `null`
- `generateSurfaceNormalMap('brushed')` returns a `THREE.CanvasTexture` with `wrapS/wrapT = RepeatWrapping`
- `generateSurfaceNormalMap('radial')` returns a texture (not null)
- `generateSurfaceNormalMap('crosshatch')` returns a texture (not null)
- `generateSurfaceNormalMap('grain')` returns a texture (not null)
- Calling `generateSurfaceNormalMap` twice with same pattern returns the SAME cached instance
- `loadCustomSurfaceMap` returns a Promise that resolves to a `THREE.Texture`

### 8.3. `packages/core/src/theme/__tests__/presets.test.ts`

Add assertions that `carouselTray.surfacePattern` and `carouselTray.surfaceIntensity` are present on both default presets.

## 9. New File List

| # | File | Action |
|---|---|---|
| 1 | `packages/core/src/elements/carousel-scrubber/types.ts` | Modify: add `CarouselTraySurfacePattern`, `surfacePattern`/`surfaceIntensity`/`surfaceMapUrl` to style |
| 2 | `packages/core/src/elements/carousel-scrubber/dsl.tsx` | Modify: add surface props to `CarouselTrayProps` |
| 3 | `packages/core/src/elements/carousel-scrubber/compile.ts` | Modify: update defaults, blend function, transition spec |
| 4 | `packages/core/src/elements/carousel-scrubber/surfaceTexture.ts` | **NEW**: procedural normal map generation |
| 5 | `packages/core/src/elements/carousel-scrubber/render.ts` | Major modify: parabolic shape, surface texture, UV rotation, theme reactivity |
| 6 | `packages/core/src/elements/carousel-scrubber/CarouselScrubberWidget.ts` | No change needed |
| 7 | `packages/core/src/elements/carousel-scrubber/index.ts` | Modify: export `CarouselTraySurfacePattern` |
| 8 | `packages/core/src/theme/types.ts` | Modify: add surface fields to `SceneThemeCarouselTray` |
| 9 | `packages/core/src/theme/presets.ts` | Modify: add surface values to both default presets |
| 10 | `packages/core/src/compiler/blocks/viewHandlers.ts` | Modify: pass surface props through to compile |
| 11 | `packages/themes/src/presets/scene/enterprise.ts` | Modify: add surface values |
| 12 | `packages/themes/src/presets/scene/darkGlass.ts` | Modify: add surface values |
| 13 | `packages/themes/src/presets/scene/midnight.ts` | Modify: add surface values |
| 14 | `packages/themes/src/presets/scene/neonCyber.ts` | Modify: add surface values |
| 15 | `packages/themes/src/presets/scene/lightCanvas.ts` | Modify: add surface values |
| 16 | `packages/themes/src/presets/scene/lightMinimal.ts` | Modify: add surface values |
| 17 | `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts` | Modify: add surface tests |
| 18 | `packages/core/src/elements/carousel-scrubber/__tests__/surfaceTexture.test.ts` | **NEW**: surface texture tests |
| 19 | `packages/core/src/theme/__tests__/presets.test.ts` | Modify: add surface assertions |

## 10. Implementation Order

Execute in this sequence to maintain type-safety at each step:

1. **Types** — Update `types.ts` (add `CarouselTraySurfacePattern`, expand `CarouselScrubberStyle`)
2. **Theme types** — Update `SceneThemeCarouselTray` in `packages/core/src/theme/types.ts`
3. **DSL props** — Update `CarouselTrayProps` in `dsl.tsx`
4. **Compile layer** — Update `compile.ts` (defaults, blend, transition spec)
5. **viewHandlers** — Pass surface props through in `viewHandlers.ts`
6. **Index** — Export `CarouselTraySurfacePattern` from `index.ts`
7. **surfaceTexture.ts** — New file: procedural normal map generation
8. **Render layer** — Major update to `render.ts`:
   a. Add `createParabolicShape` function
   b. Update `createTrayGeometry` with ring/linear/flat branching
   c. Remove `const isEllipse = true` hardcode
   d. Add normal map management to `ensureBase`
   e. Add UV rotation for ring carousels
   f. Add `material.needsUpdate` safety for transparency changes
   g. Add theme reference tracking to cache
9. **Theme presets (core)** — Update `packages/core/src/theme/presets.ts`
10. **Theme presets (themes package)** — Update all 6 files in `packages/themes/src/presets/scene/`
11. **Tests** — Update compile tests, add surfaceTexture tests, update presets tests
12. **Typecheck** — `pnpm typecheck`
13. **Test** — `pnpm --filter @brewsite/core test`

## 11. Dependency Direction Verification

| File | Imports | Verified |
|---|---|---|
| `types.ts` | Nothing | ✅ |
| `dsl.tsx` | `./types` | ✅ |
| `compile.ts` | `./types`, `./dsl`, `../../compiler/transitions/transitionTypes` | ✅ |
| `surfaceTexture.ts` | `three`, `./types` | ✅ (render-adjacent, Three.js allowed) |
| `render.ts` | `three`, `./types`, `./compile` (DEFAULT only), `./surfaceTexture`, `../../theme/types`, `../../widget/types` | ✅ |
| Theme presets | `@brewsite/core` types | ✅ |

No violations of the dependency direction table.

## 12. Backward Compatibility

**Non-breaking additions**:
- `surfacePattern`, `surfaceIntensity`, `surfaceMapUrl` on DSL props and theme types are all optional
- Default values preserve existing visual appearance (`'brushed'` at 0.25 intensity is close to the current accidental striation, but intentional and controlled)
- Linear parabolic shape is an automatic visual improvement — no DSL change needed
- Theme reactivity fix is transparent to consumers

**No breaking changes** in this plan.

## 13. Visual Design Notes per Theme

### Enterprise (professional, polished)
- **Dark**: Brushed steel tray with fine radial grain. Medium metalness (0.35), moderate roughness (0.6). The brush pattern catches directional light for a premium hardware feel.
- **Light**: Same brush pattern but subtler (intensity 0.15). Higher roughness, lower metalness — muted satin finish.

### Dark Glass (warm, luxurious)
- **Dark**: Grain texture gives an onyx/obsidian feel. Low roughness (0.35), moderate metalness (0.3). The organic grain pattern varies across the surface.
- **Light**: Same grain but very subtle (intensity 0.12). Higher roughness — like frosted marble.

### Midnight (warm gold)
- **Dark**: Brushed gold/brass look. Higher intensity (0.30) for visible grain. The warm color + brushed pattern = machined brass.
- **Light**: Lighter brushed metal, reduced intensity.

### Neon Cyber (sci-fi, electric)
- **Dark**: Crosshatch pattern creates a technical/carbon-fiber look. Higher intensity (0.35) for strong geometric pattern.
- **Light**: Same crosshatch but softer.

### Light Canvas (clean, minimal)
- **Light**: No surface texture at all. Very low metalness (0.08), high roughness (0.72). Matte ceramic.
- **Dark**: Subtle grain texture (0.15). Slightly more metallic.

### Light Minimal (ultra-minimal)
- **Both polarities**: No surface texture. Near-zero metalness, very high roughness. Paper-like.
