---
title: "Carousel Tray Visual (LAF) Overhaul"
doc_type: plan
owner: "Toolkit Product"
status: active
updated: 2026-03-15
---

# Carousel Tray Visual (LAF) Overhaul

## 1. Goal

Replace the current auto-sized disc/track tray with a full-width rounded-rectangle platform that spans the entire carousel layout width, remove the standalone knurled dial knob, add front-edge surface treatments as part of the tray geometry, and wire up per-theme-preset material values for all 12 theme-polarity combinations.

## 2. Summary of Changes

| Area | What changes |
|---|---|
| **Tray geometry** | Disc (`LatheGeometry`) and narrow track (`ExtrudeGeometry`) replaced by a single rounded-rect `ExtrudeGeometry` for all carousel shapes. Width comes from NVS bounds converted to world space. |
| **Dial removal** | The knurled dial knob mesh is removed entirely. No cylinder, no rotation tracking. |
| **Edge treatment** | A new `edgeStyle` discriminant replaces the dial. The front face (+Z) of the tray geometry gets vertex displacement baked in at creation time. |
| **Bevel radius** | Increased from `Math.min(0.03, depth * 0.2)` to `Math.min(0.06, depth * 0.25)`, bevel segments from 3 to 5. |
| **Shadows** | `castShadow = true` added alongside existing `receiveShadow = true`. |
| **Theme presets** | `carouselTray` added to all 12 scene theme preset files plus the 2 default presets in core. |
| **Type removals** | `dialColor` removed from `CarouselScrubberStyle`, `SceneThemeCarouselTray`, `CarouselTrayProps`, and all transition/blend code. |
| **Type additions** | `edgeStyle` added to `CarouselScrubberStyle` and `SceneThemeCarouselTray`. `baseShape` discriminant removed from `CarouselScrubberState` (always rounded-rect now). |

## 3. Type Changes

### 3.1. `packages/core/src/elements/carousel-scrubber/types.ts`

Replace the existing file contents with:

```typescript
// CarouselScrubber element types -- interface contracts only.

/**
 * Front-edge surface treatment style for the carousel tray.
 * Applied as vertex displacement on the front face (+Z) of the tray geometry.
 */
export type CarouselTrayEdgeStyle = 'smooth' | 'knurled' | 'ridged' | 'matte';

/** Visual style configuration for the carousel scrubber. */
export type CarouselScrubberStyle = {
  /** Tray base color. Default: '#2C3E55'. */
  baseColor: string;
  /** Tray base opacity. Default: 0.6. */
  baseOpacity: number;
  /** Accent/highlight color for tray edge glow or future LAF elements. Default: '#5090e0'. */
  accentColor: string;
  /** Material metalness [0-1]. Default: 0.4. */
  metalness: number;
  /** Material roughness [0-1]. Default: 0.55. */
  roughness: number;
  /** Front-edge surface treatment. Default: 'knurled'. */
  edgeStyle: CarouselTrayEdgeStyle;
};

/** Compiled state for the 3D carousel scrubber. */
export type CarouselScrubberState = {
  /** ViewLayout ID this scrubber tracks. */
  layoutId: string;
  /** Current active index. */
  activeIndex: number;
  /** Total child count. */
  childCount: number;
  /** Whether the carousel loops. */
  loop: boolean;
  /** Visual style. */
  style: CarouselScrubberStyle;
  /** Whether to show the base platform. */
  showBase: boolean;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  trayDepth: number;
  /** Gap between tray bottom edge and floor top in world units. Default: 0.02. */
  gap: number;
  /** NVS bounds of the carousel layout -- used by render to compute world position and width. */
  nvsBounds: { x: number; y: number; w: number; h: number };
  /** Carousel zStep -- used to compute ring center Z position and tray Z depth for ring carousels. */
  zStep: number;
  /** Carousel spread -- used to compute ring X radius for disc sizing (legacy compat). */
  spread: number;
};
```

**Removals from the current types:**
- `dialColor` field removed from `CarouselScrubberStyle`.
- `baseShape` field removed from `CarouselScrubberState` (always rounded-rect now).
- `baseSize` field removed from `CarouselScrubberState` (computed from NVS bounds in render).

**Additions:**
- `CarouselTrayEdgeStyle` union type.
- `edgeStyle` field on `CarouselScrubberStyle`.

### 3.2. `packages/core/src/theme/types.ts` -- `SceneThemeCarouselTray`

Replace the existing `SceneThemeCarouselTray` type:

```typescript
/**
 * Theme tokens for the carousel tray rendered beneath ViewLayout carousels.
 *
 * All fields are optional. When a DSL prop is set on <CarouselTray>, it
 * takes precedence over the theme value. When neither is set, the compiled
 * default applies.
 */
export type SceneThemeCarouselTray = {
  /** Tray base color. */
  readonly color?: string;
  /** Tray base opacity [0-1]. */
  readonly opacity?: number;
  /** Accent/highlight color. */
  readonly accentColor?: string;
  /** Depth (thickness) of the tray in world units. */
  readonly depth?: number;
  /** Gap between tray bottom and floor top in world units. */
  readonly gap?: number;
  /** Material metalness [0-1]. */
  readonly metalness?: number;
  /** Material roughness [0-1]. */
  readonly roughness?: number;
  /** Front-edge surface treatment style. */
  readonly edgeStyle?: 'smooth' | 'knurled' | 'ridged' | 'matte';
};
```

**Removal:** `dialColor` field.
**Addition:** `edgeStyle` field.

### 3.3. `packages/core/src/elements/carousel-scrubber/dsl.tsx` -- `CarouselTrayProps`

Replace the `CarouselTrayProps` type:

```typescript
export type CarouselTrayProps = {
  /** Tray base color. Default: '#2C3E55'. */
  color?: string;
  /** Tray base opacity [0..1]. Default: 0.6. */
  opacity?: number;
  /** Accent color for tray highlights. Default: '#5090e0'. */
  accentColor?: string;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  depth?: number;
  /** Gap between tray bottom edge and floor in world units. Default: 0.02. */
  gap?: number;
  /** Material metalness [0-1]. Default: 0.4. */
  metalness?: number;
  /** Material roughness [0-1]. Default: 0.55. */
  roughness?: number;
  /** Front-edge surface treatment. Default: 'knurled'. */
  edgeStyle?: 'smooth' | 'knurled' | 'ridged' | 'matte';
};
```

**Removal:** `dialColor` prop.
**Addition:** `edgeStyle` prop.

Also update `CarouselScrubberProps` (backwards compat type) to remove `baseShape` and `baseSize`:

```typescript
export type CarouselScrubberProps = {
  id: string;
  layoutId: string;
  showBase?: boolean;
  trayDepth?: number;
  gap?: number;
  style?: Partial<CarouselScrubberStyle>;
};
```

## 4. Compile Layer Changes

### 4.1. `packages/core/src/elements/carousel-scrubber/compile.ts`

**Updated defaults:**

```typescript
export const DEFAULT_CAROUSEL_SCRUBBER_STYLE: CarouselScrubberStyle = {
  baseColor: '#2C3E55',
  baseOpacity: 0.6,
  accentColor: '#5090e0',
  metalness: 0.4,
  roughness: 0.55,
  edgeStyle: 'knurled',
};

export const DEFAULT_CAROUSEL_SCRUBBER_STATE: CarouselScrubberState = {
  layoutId: '',
  activeIndex: 0,
  childCount: 0,
  loop: false,
  style: DEFAULT_CAROUSEL_SCRUBBER_STYLE,
  showBase: true,
  trayDepth: 0.36,
  gap: 0.02,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  zStep: 0,
  spread: 0.45,
};
```

**Remove** the `autoDialColor` function, `parseHex`, `toHex`, `luminance` helpers (no longer needed -- `dialColor` is gone).

**Update** `compileCarouselScrubber` signature -- remove `baseShape` and `baseSize` from the output:

```typescript
export function compileCarouselScrubber(
  props: CarouselScrubberProps,
  activeIndex: number,
  childCount: number,
  loop: boolean,
  nvsBounds?: { x: number; y: number; w: number; h: number },
  carouselConfig?: { zStep?: number; spread?: number },
): CarouselScrubberState {
  const style: CarouselScrubberStyle = {
    ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
    ...props.style,
  };

  return {
    layoutId: props.layoutId,
    activeIndex,
    childCount,
    loop,
    style,
    showBase: props.showBase ?? true,
    trayDepth: props.trayDepth ?? 0.36,
    gap: props.gap ?? 0.02,
    nvsBounds: nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 },
    zStep: carouselConfig?.zStep ?? 0,
    spread: carouselConfig?.spread ?? 0.45,
  };
}
```

**Update** `blendStyle` -- remove `dialColor` blend, add `edgeStyle` (discrete at midpoint):

```typescript
function blendStyle(
  from: CarouselScrubberStyle,
  to: CarouselScrubberStyle,
  t: number,
): CarouselScrubberStyle {
  return {
    baseColor: blendColor(from.baseColor, to.baseColor, t) ?? to.baseColor,
    baseOpacity: blendNumber(from.baseOpacity, to.baseOpacity, t) ?? to.baseOpacity,
    accentColor: blendColor(from.accentColor, to.accentColor, t) ?? to.accentColor,
    metalness: blendNumber(from.metalness, to.metalness, t) ?? to.metalness,
    roughness: blendNumber(from.roughness, to.roughness, t) ?? to.roughness,
    edgeStyle: t < 0.5 ? from.edgeStyle : to.edgeStyle,
  };
}
```

**Update** `interpolateFn` -- remove `baseShape` and `baseSize` blend fields:

```typescript
interpolateFn: (from, to) => ({ t }) => ({
  layoutId: t < 0.5 ? from.layoutId : to.layoutId,
  activeIndex: blendNumber(from.activeIndex, to.activeIndex, t) ?? to.activeIndex,
  childCount: t < 0.5 ? from.childCount : to.childCount,
  loop: t < 0.5 ? from.loop : to.loop,
  style: blendStyle(from.style, to.style, t),
  showBase: t < 0.5 ? from.showBase : to.showBase,
  trayDepth: blendNumber(from.trayDepth, to.trayDepth, t) ?? to.trayDepth,
  gap: blendNumber(from.gap, to.gap, t) ?? to.gap,
  nvsBounds: {
    x: blendNumber(from.nvsBounds.x, to.nvsBounds.x, t) ?? to.nvsBounds.x,
    y: blendNumber(from.nvsBounds.y, to.nvsBounds.y, t) ?? to.nvsBounds.y,
    w: blendNumber(from.nvsBounds.w, to.nvsBounds.w, t) ?? to.nvsBounds.w,
    h: blendNumber(from.nvsBounds.h, to.nvsBounds.h, t) ?? to.nvsBounds.h,
  },
  zStep: blendNumber(from.zStep, to.zStep, t) ?? to.zStep,
  spread: blendNumber(from.spread, to.spread, t) ?? to.spread,
}),
```

### 4.2. `packages/core/src/compiler/blocks/viewHandlers.ts`

In the `viewLayoutHandler` carousel tray compilation block, remove `dialColor` from the style object and remove `baseShape`/`baseSize` from props:

```typescript
const trayState = compileCarouselScrubber(
  {
    id: trayWidgetId,
    layoutId,
    showBase: true,
    trayDepth,
    gap: trayProps.gap,
    style: {
      baseColor: trayProps.color,
      baseOpacity: trayProps.opacity,
      accentColor: trayProps.accentColor,
      metalness: trayProps.metalness,
      roughness: trayProps.roughness,
      edgeStyle: trayProps.edgeStyle,
    },
  },
  carouselConfig.activeIndex,
  viewIds.length,
  isLoop,
  composedContainerBounds,
  { zStep: carouselConfig.zStep, spread: carouselConfig.spread },
);
```

Note: The `baseShape` assignment (`isLoop ? 'disc' : 'track'`) and `trayBaseSize = 0` lines are both removed since those fields no longer exist.

## 5. Render Layer Changes

### 5.1. `packages/core/src/elements/carousel-scrubber/render.ts` -- Major Rewrite

#### 5.1.1. Updated Cache Type

```typescript
export type CarouselScrubberCache = {
  root: THREE.Group;
  base: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  /** Last NVS-derived world width used for geometry creation. */
  lastWorldWidth: number;
  /** Last Z depth used for geometry creation. */
  lastZDepth: number;
  lastTrayDepth: number;
  lastShowBase: boolean;
  lastEdgeStyle: CarouselTrayEdgeStyle | null;
};
```

**Removals from cache:** `dial`, `currentDialAngle`, `lastChildCount`, `lastBaseShape`, `lastBaseSize`.

#### 5.1.2. Remove Dial Constants and Functions

Remove entirely:
- `DIAL_RADIUS`, `DIAL_THICKNESS`, `DIAL_SEGMENTS`, `KNURL_COUNT`, `KNURL_DEPTH` constants.
- `createKnurledCylinderGeometry()` function.
- `createDiscBase()` function.
- `createTrackBase()` function.

#### 5.1.3. New Geometry: `createTrayGeometry`

```typescript
/**
 * Creates a rounded-rectangle tray geometry using ExtrudeGeometry.
 *
 * @param width   - X extent of the tray in world units.
 * @param zDepth  - Z extent (front-to-back) of the tray in world units.
 * @param height  - Y extent (thickness/height) of the tray in world units.
 * @param bevelRadius - Corner bevel radius.
 * @param bevelSegments - Number of bevel segments for smooth corners.
 * @param edgeStyle - Front-face surface treatment.
 *
 * The geometry is created in XZ plane (width along X, depth along Z),
 * extruded along Y. The origin is at the bottom-center of the tray.
 */
function createTrayGeometry(
  width: number,
  zDepth: number,
  height: number,
  bevelRadius: number,
  bevelSegments: number,
  edgeStyle: CarouselTrayEdgeStyle,
): THREE.ExtrudeGeometry {
  const halfW = width * 0.5;
  const halfZ = zDepth * 0.5;
  const r = Math.min(bevelRadius * 3, halfW * 0.15, halfZ * 0.15);

  // Rounded rectangle in XZ plane
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfZ);
  shape.lineTo(halfW - r, -halfZ);
  shape.quadraticCurveTo(halfW, -halfZ, halfW, -halfZ + r);
  shape.lineTo(halfW, halfZ - r);
  shape.quadraticCurveTo(halfW, halfZ, halfW - r, halfZ);
  shape.lineTo(-halfW + r, halfZ);
  shape.quadraticCurveTo(-halfW, halfZ, -halfW, halfZ - r);
  shape.lineTo(-halfW, -halfZ + r);
  shape.quadraticCurveTo(-halfW, -halfZ, -halfW + r, -halfZ);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevelRadius,
    bevelSize: bevelRadius,
    bevelSegments,
  });

  // Rotate so the extrusion direction is along +Y (up), shape in XZ.
  geometry.rotateX(-Math.PI / 2);

  // Apply front-edge surface treatment to vertices on the +Z face.
  if (edgeStyle !== 'smooth' && edgeStyle !== 'matte') {
    applyEdgeTreatment(geometry, zDepth, height, edgeStyle);
  }

  return geometry;
}
```

#### 5.1.4. Edge Treatment Functions

```typescript
/**
 * Applies vertex displacement to front-face (+Z) vertices of the tray geometry.
 * Called once at geometry creation time -- not per-frame.
 *
 * "Front face" is defined as vertices where the normal Z component > 0.5
 * (after the rotation into XZ-up orientation).
 */
function applyEdgeTreatment(
  geometry: THREE.ExtrudeGeometry,
  zDepth: number,
  height: number,
  style: 'knurled' | 'ridged',
): void {
  const posAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');

  for (let i = 0; i < posAttr.count; i++) {
    const nz = normalAttr.getZ(i);
    // Only displace vertices on the front face (facing +Z / camera).
    if (nz < 0.5) continue;

    const x = posAttr.getX(i);
    const y = posAttr.getY(i);

    let displacement = 0;

    if (style === 'knurled') {
      // Diamond knurl pattern: two intersecting sine waves keyed on X and Y.
      const knurlCountX = 40;
      const knurlCountY = 8;
      const knurlDepth = 0.005;
      const patternX = Math.sin(x * knurlCountX * Math.PI);
      const patternY = Math.cos(y * knurlCountY * Math.PI / height);
      displacement = patternX * patternY * knurlDepth;
    } else if (style === 'ridged') {
      // Horizontal ridges: sine-wave displacement keyed on Y position.
      const ridgeCount = 6;
      const ridgeDepth = 0.004;
      const yNorm = y / height;
      displacement = Math.sin(yNorm * ridgeCount * Math.PI * 2) * ridgeDepth;
    }

    posAttr.setZ(i, posAttr.getZ(i) + displacement);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}
```

**Edge treatment semantics by style:**
- `'smooth'` -- No displacement. The beveled corners and polished material create a glass-like front edge.
- `'knurled'` -- Diamond crosshatch pattern. Two sine waves (high-frequency along X, low-frequency along Y) multiplied together, displaced along the +Z normal. Depth: 0.005 world units.
- `'ridged'` -- Parallel horizontal ridges. Sine wave along Y, displaced along +Z normal. 6 ridges across tray height. Depth: 0.004 world units.
- `'matte'` -- No displacement. Plain front face; visual difference comes from lower metalness/higher roughness material values.

#### 5.1.5. Updated `getOrCreateCache`

```typescript
export function getOrCreateCache(
  scene: THREE.Scene,
  widgetId: string,
): CarouselScrubberCache {
  const key = `${CACHE_KEY}_${widgetId}`;
  const existing = scene.userData[key] as CarouselScrubberCache | undefined;
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = `CarouselScrubber_${widgetId}`;
  scene.add(root);

  const cache: CarouselScrubberCache = {
    root,
    base: null,
    lastWorldWidth: 0,
    lastZDepth: 0,
    lastTrayDepth: 0,
    lastShowBase: false,
    lastEdgeStyle: null,
  };

  scene.userData[key] = cache;
  return cache;
}
```

No dial mesh is created on init.

#### 5.1.6. Updated `ensureBase`

```typescript
function ensureBase(
  cache: CarouselScrubberCache,
  showBase: boolean,
  worldWidth: number,
  zDepth: number,
  trayDepth: number,
  style: CarouselScrubberStyle,
): void {
  if (!showBase) {
    if (cache.base) cache.base.visible = false;
    return;
  }

  const needsRecreate =
    !cache.base ||
    cache.lastWorldWidth !== worldWidth ||
    cache.lastZDepth !== zDepth ||
    cache.lastTrayDepth !== trayDepth ||
    cache.lastEdgeStyle !== style.edgeStyle;

  if (needsRecreate) {
    if (cache.base) {
      cache.root.remove(cache.base);
      cache.base.geometry.dispose();
      cache.base.material.dispose();
    }

    const bevelRadius = Math.min(0.06, trayDepth * 0.25);
    const bevelSegments = 5;
    const geometry = createTrayGeometry(
      worldWidth, zDepth, trayDepth, bevelRadius, bevelSegments, style.edgeStyle,
    );

    const material = new THREE.MeshStandardMaterial({
      color: style.baseColor,
      opacity: style.baseOpacity,
      transparent: style.baseOpacity < 1,
      metalness: style.metalness,
      roughness: style.roughness,
      side: THREE.DoubleSide,
    });

    const base = new THREE.Mesh(geometry, material);
    base.name = 'CarouselScrubberBase';
    base.receiveShadow = true;
    base.castShadow = true;

    cache.root.add(base);
    cache.base = base as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  }

  cache.base!.visible = true;
  cache.base!.material.color.set(style.baseColor);
  cache.base!.material.opacity = style.baseOpacity;
  cache.base!.material.transparent = style.baseOpacity < 1;
  cache.base!.material.metalness = style.metalness;
  cache.base!.material.roughness = style.roughness;
}
```

#### 5.1.7. Updated `applyCarouselScrubber`

The main changes:
1. Compute world width from NVS bounds using `coords.toWorldSize()`.
2. Compute Z depth: for loop carousels use `zStep`, for linear use a fraction of world height.
3. Add padding (5% each side).
4. Remove all dial logic.
5. Update change-detection cache keys.

```typescript
export function applyCarouselScrubber(
  state: CarouselScrubberState,
  cache: CarouselScrubberCache,
  scene: THREE.Scene,
  coords?: NVSCoordService,
): void {
  if (state.childCount === 0 || state.layoutId === '') {
    cache.root.visible = false;
    return;
  }
  cache.root.visible = true;

  // -- Theme resolution -------------------------------------------------------
  const theme = (scene.userData as Record<string, unknown>)[SCENE_THEME_USERDATA_KEY] as SceneTheme | null | undefined;
  const style = resolveThemedStyle(state.style, theme);
  const { depth: trayDepth, gap } = resolveThemedDepthAndGap(state.trayDepth, state.gap, theme);

  const zStep = state.zStep;

  // -- Width from NVS bounds --------------------------------------------------
  let worldWidth: number;
  let zDepth: number;

  if (coords) {
    const [wW] = coords.toWorldSize(state.nvsBounds.w, state.nvsBounds.h);
    const padding = wW * 0.05;
    worldWidth = wW + padding * 2;

    // Z depth: ring carousels span the full zStep ring depth.
    // Linear carousels use a smaller fraction.
    if (state.loop && zStep > 0) {
      zDepth = zStep * 1.1; // slight overshoot so tray extends past ring edges
    } else {
      // Linear: use a fixed proportion of tray depth for a thin platform feel.
      zDepth = Math.max(trayDepth * 2.5, 0.8);
    }
  } else {
    // Fallback: no coord service available.
    worldWidth = 4.0;
    zDepth = 1.5;
  }

  // -- Positioning ------------------------------------------------------------
  const trayPos = coords
    ? computeTrayPosition(state.nvsBounds, zStep, state.loop, trayDepth, gap, coords, scene)
    : null;

  const effectiveDepth = trayPos?.effectiveDepth ?? trayDepth;
  const centerZ = trayPos?.centerZ ?? (state.loop && zStep > 0 ? -zStep / 2 : 0);

  if (trayPos) {
    cache.root.position.set(0, trayPos.bottomY, centerZ);
  } else {
    cache.root.position.set(0, -0.5, centerZ);
  }

  // -- Geometry ---------------------------------------------------------------
  ensureBase(cache, state.showBase, worldWidth, zDepth, effectiveDepth, style);

  // -- Change detection -------------------------------------------------------
  cache.lastWorldWidth = worldWidth;
  cache.lastZDepth = zDepth;
  cache.lastShowBase = state.showBase;
  cache.lastTrayDepth = effectiveDepth;
  cache.lastEdgeStyle = style.edgeStyle;
}
```

Note: The `coords` parameter type changes from the inline `{ toWorld: ... }` to `NVSCoordService` (import from `../../widget/types`). The `computeTrayPosition` helper's `coords` parameter also needs the same update since `toWorld` is on `NVSCoordService`.

#### 5.1.8. Updated `resolveThemedStyle`

Remove `dialColor` field. Add `edgeStyle` resolution:

```typescript
function resolveThemedStyle(
  style: CarouselScrubberStyle,
  theme: SceneTheme | null | undefined,
): CarouselScrubberStyle {
  const trayTheme = theme?.carouselTray;
  if (!trayTheme) return style;

  const defaults = DEFAULT_CAROUSEL_SCRUBBER_STYLE;
  return {
    baseColor: style.baseColor !== defaults.baseColor ? style.baseColor : (trayTheme.color ?? style.baseColor),
    baseOpacity: style.baseOpacity !== defaults.baseOpacity ? style.baseOpacity : (trayTheme.opacity ?? style.baseOpacity),
    accentColor: style.accentColor !== defaults.accentColor ? style.accentColor : (trayTheme.accentColor ?? style.accentColor),
    metalness: style.metalness !== defaults.metalness ? style.metalness : (trayTheme.metalness ?? style.metalness),
    roughness: style.roughness !== defaults.roughness ? style.roughness : (trayTheme.roughness ?? style.roughness),
    edgeStyle: style.edgeStyle !== defaults.edgeStyle ? style.edgeStyle : (trayTheme.edgeStyle ?? style.edgeStyle),
  };
}
```

#### 5.1.9. Updated `disposeCarouselScrubber`

Remove dial disposal:

```typescript
export function disposeCarouselScrubber(
  scene: THREE.Scene,
  cache: CarouselScrubberCache,
  widgetId: string,
): void {
  if (cache.base) {
    cache.root.remove(cache.base);
    cache.base.geometry.dispose();
    cache.base.material.dispose();
  }
  scene.remove(cache.root);
  delete scene.userData[`${CACHE_KEY}_${widgetId}`];
}
```

### 5.2. `packages/core/src/elements/carousel-scrubber/CarouselScrubberWidget.ts`

**Changes:**
1. Remove `baseShape` and `baseSize` from `isCarouselScrubberStateLike` guard.
2. Update JSDoc comment on the class (remove "knurled dial knob" reference).
3. No structural changes to the widget class itself; it delegates to `render.ts`.

Updated `isCarouselScrubberStateLike`:

```typescript
export function isCarouselScrubberStateLike(state: unknown): state is CarouselScrubberState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s['layoutId'] === 'string' &&
    typeof s['activeIndex'] === 'number' &&
    typeof s['childCount'] === 'number' &&
    typeof s['loop'] === 'boolean' &&
    typeof s['showBase'] === 'boolean' &&
    typeof s['gap'] === 'number' &&
    s['style'] !== undefined
  );
}
```

Also remove `baseShape` and `baseSize` references from the `carouselScrubberNodeHandler` (no longer passed to `compileCarouselScrubber`).

### 5.3. `packages/core/src/elements/carousel-scrubber/index.ts`

Update to export `CarouselTrayEdgeStyle` type:

```typescript
export type { CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle } from './types';
// ... rest unchanged
```

## 6. Theme Preset Values

### 6.1. `packages/core/src/theme/presets.ts` -- Default Presets

Add `carouselTray` to both default presets:

```typescript
// In defaultSceneTheme (enterprise dark):
carouselTray: {
  color: '#2C3E55',
  opacity: 0.6,
  accentColor: '#5090e0',
  metalness: 0.4,
  roughness: 0.55,
  edgeStyle: 'knurled',
},

// In defaultLightSceneTheme (enterprise light):
carouselTray: {
  color: '#C0CCD8',
  opacity: 0.6,
  accentColor: '#3A6DB5',
  metalness: 0.3,
  roughness: 0.5,
  edgeStyle: 'knurled',
},
```

### 6.2. Theme Preset Files in `packages/themes/src/presets/scene/`

Each file gets a `carouselTray` field on both its dark and light export. Exact values:

#### `enterprise.ts`

```typescript
// enterpriseSceneTheme (dark):
carouselTray: {
  color: '#2C3E55',
  opacity: 0.6,
  accentColor: '#5090e0',
  metalness: 0.4,
  roughness: 0.55,
  edgeStyle: 'knurled',
},

// enterpriseLightSceneTheme (light):
carouselTray: {
  color: '#C0CCD8',
  opacity: 0.6,
  accentColor: '#3A6DB5',
  metalness: 0.3,
  roughness: 0.5,
  edgeStyle: 'knurled',
},
```

#### `darkGlass.ts`

```typescript
// darkGlassSceneTheme (dark):
carouselTray: {
  color: '#1A0E0A',
  opacity: 0.85,
  accentColor: '#E36A2E',
  metalness: 0.7,
  roughness: 0.1,
  edgeStyle: 'smooth',
},

// darkGlassLightSceneTheme (light):
carouselTray: {
  color: '#E8DDD5',
  opacity: 0.9,
  accentColor: '#C4704A',
  metalness: 0.5,
  roughness: 0.15,
  edgeStyle: 'smooth',
},
```

#### `neonCyber.ts`

```typescript
// neonCyberSceneTheme (dark):
carouselTray: {
  color: '#0A0A2A',
  opacity: 0.6,
  accentColor: '#8A3DFF',
  metalness: 0.6,
  roughness: 0.3,
  edgeStyle: 'ridged',
},

// neonCyberLightSceneTheme (light):
carouselTray: {
  color: '#D0D8F0',
  opacity: 0.6,
  accentColor: '#6E55D1',
  metalness: 0.4,
  roughness: 0.35,
  edgeStyle: 'ridged',
},
```

#### `midnight.ts`

```typescript
// midnightSceneTheme (dark):
carouselTray: {
  color: '#1A120D',
  opacity: 0.6,
  accentColor: '#E2A33A',
  metalness: 0.5,
  roughness: 0.35,
  edgeStyle: 'knurled',
},

// midnightLightSceneTheme (light):
carouselTray: {
  color: '#E8DCC8',
  opacity: 0.6,
  accentColor: '#C39B52',
  metalness: 0.4,
  roughness: 0.4,
  edgeStyle: 'knurled',
},
```

#### `lightCanvas.ts`

```typescript
// lightCanvasSceneTheme (light):
carouselTray: {
  color: '#E8ECF2',
  opacity: 0.6,
  accentColor: '#3D63D9',
  metalness: 0.1,
  roughness: 0.7,
  edgeStyle: 'matte',
},

// lightCanvasDarkSceneTheme (dark):
carouselTray: {
  color: '#1C2533',
  opacity: 0.6,
  accentColor: '#5D7194',
  metalness: 0.2,
  roughness: 0.6,
  edgeStyle: 'matte',
},
```

#### `lightMinimal.ts`

```typescript
// lightMinimalSceneTheme (light):
carouselTray: {
  color: '#F0F2F5',
  opacity: 0.6,
  accentColor: '#AAB8CB',
  metalness: 0.05,
  roughness: 0.8,
  edgeStyle: 'matte',
},

// lightMinimalDarkSceneTheme (dark):
carouselTray: {
  color: '#191E24',
  opacity: 0.6,
  accentColor: '#647488',
  metalness: 0.15,
  roughness: 0.65,
  edgeStyle: 'matte',
},
```

## 7. Test Changes

### 7.1. `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts`

**Tests to remove:**
- `'uses explicit dialColor when provided'` -- `dialColor` no longer exists.
- Any assertion on `state.style.dialColor` (auto-compute tests).

**Tests to update:**
- `'produces default state for minimal props'` -- Remove `baseShape`, `baseSize` assertions. Add `edgeStyle` assertion. Update default `metalness` to `0.4`, `roughness` to `0.55`, `baseColor` to `'#2C3E55'`.
- `'applies explicit baseShape=track'` -- Remove entirely (`baseShape` is gone).
- `'applies explicit baseSize'` -- Remove entirely (`baseSize` is gone).
- `'merges partial style overrides with defaults'` -- Remove `dialColor` assertion, add `edgeStyle` assertion.

**Tests to add:**
- `'applies explicit edgeStyle'`:
  ```typescript
  it('applies explicit edgeStyle', () => {
    const props: CarouselScrubberProps = {
      ...minimalProps,
      style: { edgeStyle: 'ridged' },
    };
    const state = compileCarouselScrubber(props, 0, 3, false);
    expect(state.style.edgeStyle).toBe('ridged');
  });
  ```

- `'defaults edgeStyle to knurled'`:
  ```typescript
  it('defaults edgeStyle to knurled', () => {
    const state = compileCarouselScrubber(minimalProps, 0, 0, false);
    expect(state.style.edgeStyle).toBe('knurled');
  });
  ```

**Transition spec tests to update:**
- `'blends style colors'` -- Remove `dialColor` from the constructed styles.
- `'blends style numeric values'` -- Remove `dialColor` field.
- `'switches discrete fields at midpoint'` -- Remove `baseShape` assertion. Add `edgeStyle` discrete-switch test:
  ```typescript
  it('switches edgeStyle at midpoint', () => {
    const from = makeState({
      style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, edgeStyle: 'smooth' },
    });
    const to = makeState({
      style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, edgeStyle: 'ridged' },
    });
    const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
    expect(fn(makeCtx(0.3)).style.edgeStyle).toBe('smooth');
    expect(fn(makeCtx(0.7)).style.edgeStyle).toBe('ridged');
  });
  ```

### 7.2. `packages/core/src/theme/__tests__/presets.test.ts`

If this test file validates the shape of `defaultSceneTheme` / `defaultLightSceneTheme`, add assertions that `carouselTray` is present with expected defaults.

## 8. Implementation Order

Execute in this order to maintain type-safety at each step:

1. **Types first** -- Update `types.ts` (remove `dialColor`, `baseShape`, `baseSize`; add `edgeStyle` and `CarouselTrayEdgeStyle`).
2. **Theme types** -- Update `SceneThemeCarouselTray` in `packages/core/src/theme/types.ts` (remove `dialColor`, add `edgeStyle`).
3. **DSL props** -- Update `dsl.tsx` (remove `dialColor` prop, `baseShape`, `baseSize`; add `edgeStyle` prop).
4. **Compile layer** -- Update `compile.ts` (new defaults, remove `autoDialColor`, update `blendStyle`, update `compileCarouselScrubber` signature, update transition spec).
5. **viewHandlers** -- Update `viewHandlers.ts` carousel tray block (remove `dialColor`, `baseShape`, `baseSize`; add `edgeStyle`).
6. **Widget** -- Update `CarouselScrubberWidget.ts` (remove `baseShape`/`baseSize` from state guard, update node handler).
7. **Index** -- Update `index.ts` to export `CarouselTrayEdgeStyle`.
8. **Render** -- Rewrite `render.ts` (new geometry, edge treatments, remove dial, new cache type, width from NVS bounds, castShadow).
9. **Theme presets (core)** -- Add `carouselTray` to `packages/core/src/theme/presets.ts`.
10. **Theme presets (themes package)** -- Add `carouselTray` to all 6 files in `packages/themes/src/presets/scene/`.
11. **Tests** -- Update `compile.test.ts` and `presets.test.ts`.
12. **Typecheck** -- Run `pnpm typecheck` across the monorepo.
13. **Test** -- Run `pnpm --filter @brewsite/core test`.

## 9. Files Changed (Complete List)

| # | File | Change Type |
|---|---|---|
| 1 | `packages/core/src/elements/carousel-scrubber/types.ts` | Modify: remove `dialColor`, `baseShape`, `baseSize`; add `CarouselTrayEdgeStyle`, `edgeStyle` |
| 2 | `packages/core/src/elements/carousel-scrubber/dsl.tsx` | Modify: remove `dialColor`, `baseShape`, `baseSize` props; add `edgeStyle` |
| 3 | `packages/core/src/elements/carousel-scrubber/compile.ts` | Modify: new defaults, remove `autoDialColor` + helpers, update `blendStyle`, `compileCarouselScrubber`, transition spec |
| 4 | `packages/core/src/elements/carousel-scrubber/render.ts` | Rewrite: new `createTrayGeometry`, `applyEdgeTreatment`, remove dial, width from NVS, `castShadow`, updated cache type |
| 5 | `packages/core/src/elements/carousel-scrubber/CarouselScrubberWidget.ts` | Modify: remove `baseShape`/`baseSize` from state guard and node handler |
| 6 | `packages/core/src/elements/carousel-scrubber/index.ts` | Modify: export `CarouselTrayEdgeStyle` |
| 7 | `packages/core/src/theme/types.ts` | Modify: `SceneThemeCarouselTray` remove `dialColor`, add `edgeStyle` |
| 8 | `packages/core/src/theme/presets.ts` | Modify: add `carouselTray` to both default presets |
| 9 | `packages/core/src/compiler/blocks/viewHandlers.ts` | Modify: remove `dialColor`, `baseShape`, `baseSize` from tray compilation; add `edgeStyle` |
| 10 | `packages/themes/src/presets/scene/enterprise.ts` | Modify: add `carouselTray` to both presets |
| 11 | `packages/themes/src/presets/scene/darkGlass.ts` | Modify: add `carouselTray` to both presets |
| 12 | `packages/themes/src/presets/scene/neonCyber.ts` | Modify: add `carouselTray` to both presets |
| 13 | `packages/themes/src/presets/scene/midnight.ts` | Modify: add `carouselTray` to both presets |
| 14 | `packages/themes/src/presets/scene/lightCanvas.ts` | Modify: add `carouselTray` to both presets |
| 15 | `packages/themes/src/presets/scene/lightMinimal.ts` | Modify: add `carouselTray` to both presets |
| 16 | `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts` | Modify: remove dialColor/baseShape/baseSize tests, add edgeStyle tests, update defaults |
| 17 | `packages/core/src/theme/__tests__/presets.test.ts` | Modify: assert carouselTray presence if not already covered |

## 10. Backward Compatibility

**Breaking changes:**
- `CarouselScrubberStyle.dialColor` removed. Any scene DSL that sets `dialColor` on `<CarouselTray>` will get a TypeScript compile error. The fix is to remove the prop.
- `CarouselScrubberState.baseShape` and `CarouselScrubberState.baseSize` removed. Any code that reads these fields will get a compile error. The geometry is now always a rounded rectangle sized from NVS bounds.
- `SceneThemeCarouselTray.dialColor` removed. Any custom theme that sets `dialColor` will get a compile error.

**Non-breaking:**
- All other existing DSL props (`color`, `opacity`, `accentColor`, `depth`, `gap`, `metalness`, `roughness`) continue to work identically.
- The new `edgeStyle` prop defaults to `'knurled'`, which preserves the existing diamond-pattern visual (now on the front face instead of a separate cylinder).
- NVS-based width sizing is automatic; no DSL change required.
