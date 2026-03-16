---
title: "Carousel Tray Overhaul — Repositioning, Dot Removal, and Theme Integration"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-15
---

# Carousel Tray Overhaul

## Problem Statement

The carousel scrubber tray (`packages/core/src/elements/carousel-scrubber/`) has three structural problems:

1. **Hard-coded Y position.** The tray positions itself at `Y=-0.5` regardless of where the carousel views actually sit. The tray should sit directly beneath the bottom edge of the carousel views, extending downward to the floor.

2. **Indicator dots are dead weight.** The dots were a placeholder UI. They add visual noise, consume geometry/material resources, and will never be part of the final tray design. They must be removed entirely.

3. **No theme integration.** Every visual property is either hard-coded in `render.ts` or set per-instance via DSL props. There is no way to set tray appearance at the theme level, forcing authors to repeat style props on every `<CarouselTray>` instance.

This plan resolves all three problems and restructures `render.ts` for a clean follow-up LAF (look-and-feel) update.

## Scope

### In scope
- Reposition tray based on NVS view bottom edge and floor Y
- Remove all dot rendering code
- Add `SceneThemeCarouselTray` to the theme type system
- Expose all visual tokens on both DSL props and theme
- Increase default tray depth from 0.12 to 0.36
- Restructure `render.ts` to separate positioning from geometry
- Update tests

### Out of scope
- Tray LAF redesign (geometry, materials, visual style) — follow-up plan
- Carousel scrubbing interaction (covered by `plan_carousel-scrubbing.md`)
- Knurled dial redesign — stays functional, will be restyled in LAF phase

## Files Changed

| File | Action |
|---|---|
| `packages/core/src/elements/carousel-scrubber/types.ts` | Modify |
| `packages/core/src/elements/carousel-scrubber/dsl.tsx` | Modify |
| `packages/core/src/elements/carousel-scrubber/compile.ts` | Modify |
| `packages/core/src/elements/carousel-scrubber/render.ts` | Modify (major) |
| `packages/core/src/elements/carousel-scrubber/CarouselScrubberWidget.ts` | Modify |
| `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts` | Modify |
| `packages/core/src/theme/types.ts` | Modify |
| `packages/core/src/compiler/blocks/viewHandlers.ts` | Modify |

---

## 1. `packages/core/src/theme/types.ts` — Add `SceneThemeCarouselTray`

Add a new theme token type and attach it to `SceneTheme`.

### New type: `SceneThemeCarouselTray`

Insert this type definition **immediately before** the `SceneTheme` type definition (after `SceneThemeFloor`):

```typescript
/**
 * Theme tokens for the carousel tray rendered beneath ViewLayout carousels.
 *
 * All fields are optional. When a DSL prop is set on `<CarouselTray>`, it
 * takes precedence over the theme value. When neither is set, the compiled
 * default applies.
 */
export type SceneThemeCarouselTray = {
  /** Tray base color. */
  readonly color?: string;
  /** Tray base opacity [0-1]. */
  readonly opacity?: number;
  /** Dial knob color. When omitted, auto-computed from tray color. */
  readonly dialColor?: string;
  /** Accent/highlight color for future tray LAF elements. */
  readonly accentColor?: string;
  /** Depth (thickness) of the tray in world units. */
  readonly depth?: number;
  /** Gap between tray bottom and floor top in world units. */
  readonly gap?: number;
  /** Material metalness [0-1]. */
  readonly metalness?: number;
  /** Material roughness [0-1]. */
  readonly roughness?: number;
};
```

### Modify `SceneTheme`

Add one field to the `SceneTheme` type:

```typescript
export type SceneTheme = {
  readonly colorMode: SceneColorMode;
  readonly font: SceneThemeFontTokens;
  readonly fontSize: SceneThemeFontSizeScale;
  readonly background?: SceneThemeBackground;
  readonly floor?: SceneThemeFloor;
  /** Optional carousel tray visual tokens. */       // <-- NEW
  readonly carouselTray?: SceneThemeCarouselTray;     // <-- NEW
};
```

---

## 2. `packages/core/src/elements/carousel-scrubber/types.ts` — Remove dots, add material tokens

### Full replacement of `CarouselScrubberStyle`

Remove `dotGlowIntensity`. Add `metalness`, `roughness`, and `gap`:

```typescript
// CarouselScrubber element types — interface contracts only.

/** Visual style configuration for the carousel scrubber. */
export type CarouselScrubberStyle = {
  /** Tray base color. Default: '#1a2a40'. */
  baseColor: string;
  /** Tray base opacity. Default: 0.6. */
  baseOpacity: number;
  /**
   * Dial knob color. When empty string, auto-computed from baseColor:
   * 30% brighter if base is dark (luminance < 0.5), 30% darker if light.
   */
  dialColor: string;
  /** Accent/highlight color for future tray LAF elements. Default: '#5090e0'. */
  accentColor: string;
  /** Material metalness [0-1]. Default: 0.3. */
  metalness: number;
  /** Material roughness [0-1]. Default: 0.6. */
  roughness: number;
};
```

### Modify `CarouselScrubberState`

Add a `gap` field. Remove the `position` field (positioning is now computed at render time from NVS bounds + floor Y, not baked into state):

```typescript
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
  /** Base shape: 'disc' for ring carousels, 'track' for linear. */
  baseShape: 'disc' | 'track';
  /** Radius/width of the base in world units. */
  baseSize: number;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  trayDepth: number;
  /** Gap between tray bottom edge and floor top in world units. Default: 0.02. */
  gap: number;
  /** NVS bounds of the carousel layout — used by render to compute world position. */
  nvsBounds: { x: number; y: number; w: number; h: number };
  /** Carousel zStep — used to compute ring center Z position. */
  zStep: number;
  /** Carousel spread — used to compute ring X radius for disc sizing. */
  spread: number;
};
```

**Key change:** The `position` field is removed. Tray Y is now derived at render time from:
- Top: world Y of `nvsBounds.y + nvsBounds.h` (bottom edge of NVS carousel region)
- Bottom: floor Y + `gap`

The tray `trayDepth` acts as a minimum depth. If the vertical space between view bottom and floor is larger, the tray fills that space.

---

## 3. `packages/core/src/elements/carousel-scrubber/dsl.tsx` — Update props

### Full replacement of `CarouselTrayProps`

Remove `glowIntensity` and `yOffset`. Add `gap`, `metalness`, `roughness`:

```typescript
// CarouselTray — DSL child component for ViewLayout carousel tray/dial.

import type { CarouselScrubberStyle } from './types';

/**
 * Props for the <CarouselTray> DSL component.
 *
 * Place as a child of <ViewLayout kind="carousel"> to render a 3D tray base
 * with a knurled dial knob underneath the carousel. Position and size are
 * computed automatically from the carousel's layout bounds and floor position.
 *
 * All visual settings can also be set at the theme level via
 * `SceneTheme.carouselTray`. DSL props override theme values.
 */
export type CarouselTrayProps = {
  /** Tray base color. Default: '#1a2a40'. */
  color?: string;
  /** Tray base opacity [0..1]. Default: 0.6. */
  opacity?: number;
  /**
   * Dial knob color. When omitted, auto-computed from tray color:
   * 30% brighter if tray is dark (luminance < 0.5), 30% darker if tray is light.
   */
  dialColor?: string;
  /** Accent color for tray highlights. Default: '#5090e0'. */
  accentColor?: string;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  depth?: number;
  /** Gap between tray bottom edge and floor in world units. Default: 0.02. */
  gap?: number;
  /** Material metalness [0-1]. Default: 0.3. */
  metalness?: number;
  /** Material roughness [0-1]. Default: 0.6. */
  roughness?: number;
};

/** Null-returning DSL stub. Consumed by viewLayoutHandler, not rendered directly. */
export const CarouselTray = (_props: CarouselTrayProps): null => null;
CarouselTray.displayName = 'CarouselTray';

// Keep the old type for backward compatibility with the standalone element.
export type CarouselScrubberProps = {
  id: string;
  layoutId: string;
  showBase?: boolean;
  baseShape?: 'disc' | 'track';
  baseSize?: number;
  trayDepth?: number;
  gap?: number;
  style?: Partial<CarouselScrubberStyle>;
};
```

**Key change:** `CarouselScrubberProps.position` is removed (positioning is render-time). `CarouselScrubberProps.gap` is added.

---

## 4. `packages/core/src/elements/carousel-scrubber/compile.ts` — Update defaults, remove dots

### Changes to `DEFAULT_CAROUSEL_SCRUBBER_STYLE`

```typescript
export const DEFAULT_CAROUSEL_SCRUBBER_STYLE: CarouselScrubberStyle = {
  baseColor: '#1a2a40',
  baseOpacity: 0.6,
  dialColor: '', // empty = auto-compute from baseColor
  accentColor: '#5090e0',
  metalness: 0.3,
  roughness: 0.6,
};
```

### Changes to `DEFAULT_CAROUSEL_SCRUBBER_STATE`

```typescript
export const DEFAULT_CAROUSEL_SCRUBBER_STATE: CarouselScrubberState = {
  layoutId: '',
  activeIndex: 0,
  childCount: 0,
  loop: false,
  style: DEFAULT_CAROUSEL_SCRUBBER_STYLE,
  showBase: true,
  baseShape: 'disc',
  baseSize: 1.5,
  trayDepth: 0.36,
  gap: 0.02,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  zStep: 0,
  spread: 0.45,
};
```

### Changes to `compileCarouselScrubber()`

Remove the `position` field from the return value. Add `gap`. Update `trayDepth` default to `0.36`:

```typescript
export function compileCarouselScrubber(
  props: CarouselScrubberProps,
  activeIndex: number,
  childCount: number,
  loop: boolean,
  nvsBounds?: { x: number; y: number; w: number; h: number },
  carouselConfig?: { zStep?: number; spread?: number },
): CarouselScrubberState {
  const baseColor = props.style?.baseColor ?? DEFAULT_CAROUSEL_SCRUBBER_STYLE.baseColor;
  const dialColor = props.style?.dialColor || autoDialColor(baseColor);

  const style: CarouselScrubberStyle = {
    ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
    ...props.style,
    baseColor,
    dialColor,
  };

  return {
    layoutId: props.layoutId,
    activeIndex,
    childCount,
    loop,
    style,
    showBase: props.showBase ?? true,
    baseShape: props.baseShape ?? 'disc',
    baseSize: props.baseSize ?? 1.5,
    trayDepth: props.trayDepth ?? 0.36,
    gap: props.gap ?? 0.02,
    nvsBounds: nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 },
    zStep: carouselConfig?.zStep ?? 0,
    spread: carouselConfig?.spread ?? 0.45,
  };
}
```

### Changes to `blendStyle()`

Remove `dotGlowIntensity` blending. Add `metalness` and `roughness` blending:

```typescript
function blendStyle(
  from: CarouselScrubberStyle,
  to: CarouselScrubberStyle,
  t: number,
): CarouselScrubberStyle {
  return {
    baseColor: blendColor(from.baseColor, to.baseColor, t) ?? to.baseColor,
    baseOpacity: blendNumber(from.baseOpacity, to.baseOpacity, t) ?? to.baseOpacity,
    dialColor: blendColor(from.dialColor, to.dialColor, t) ?? to.dialColor,
    accentColor: blendColor(from.accentColor, to.accentColor, t) ?? to.accentColor,
    metalness: blendNumber(from.metalness, to.metalness, t) ?? to.metalness,
    roughness: blendNumber(from.roughness, to.roughness, t) ?? to.roughness,
  };
}
```

### Changes to `carouselScrubberTransitionSpec`

Remove `dotGlowIntensity` from `exitFn` and `enterFn`. Remove `position` blending from `interpolateFn`. Add `gap` blending:

```typescript
export const carouselScrubberTransitionSpec: FunctionalTransitionSpec<CarouselScrubberState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    style: {
      ...from.style,
      baseOpacity: blendNumber(from.style.baseOpacity, 0, t) ?? 0,
    },
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    style: {
      ...to.style,
      baseOpacity: blendNumber(0, to.style.baseOpacity, t) ?? to.style.baseOpacity,
    },
  }),
  interpolateFn: (from, to) => ({ t }) => ({
    layoutId: t < 0.5 ? from.layoutId : to.layoutId,
    activeIndex: blendNumber(from.activeIndex, to.activeIndex, t) ?? to.activeIndex,
    childCount: t < 0.5 ? from.childCount : to.childCount,
    loop: t < 0.5 ? from.loop : to.loop,
    style: blendStyle(from.style, to.style, t),
    showBase: t < 0.5 ? from.showBase : to.showBase,
    baseShape: t < 0.5 ? from.baseShape : to.baseShape,
    baseSize: blendNumber(from.baseSize, to.baseSize, t) ?? to.baseSize,
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
};
```

---

## 5. `packages/core/src/elements/carousel-scrubber/render.ts` — Major rewrite

This is the largest change. The file is restructured into three clearly separated sections:
1. **Positioning** — computes world-space tray position from NVS bounds and floor Y
2. **Geometry management** — creates/updates tray base and dial meshes
3. **Apply function** — orchestrates positioning and geometry each frame

### Delete entirely

- The `DOT_RADIUS` constant
- The `DOT_SEGMENTS` constant
- The `DOT_OVERHANG` constant
- The `ensureDots()` function (lines 191-240 in current file)
- All dot-related fields from `CarouselScrubberCache`: `dots`, `activeDotMaterial`, `inactiveDotMaterial`
- All dot code in `getOrCreateCache()`: the `activeDotMaterial` creation, `inactiveDotMaterial` creation
- All dot code in `applyCarouselScrubber()`: the `ensureDots()` call, dot material updates, dot active/inactive loop
- All dot code in `disposeCarouselScrubber()`: the dot disposal loop, dot material disposal

### New `CarouselScrubberCache` type

```typescript
export type CarouselScrubberCache = {
  root: THREE.Group;
  base: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  dial: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  currentDialAngle: number;
  lastChildCount: number;
  lastBaseShape: 'disc' | 'track' | null;
  lastShowBase: boolean;
  lastBaseSize: number;
  lastTrayDepth: number;
};
```

### New constant: `SCENE_THEME_USERDATA_KEY`

Add at the top of `render.ts`, matching the pattern in `FloorWidget.ts`:

```typescript
const SCENE_THEME_USERDATA_KEY = '__brewsite_scene_theme';
```

### New function: `resolveThemedStyle()`

This function merges theme defaults into the compiled style. It is called at the top of `applyCarouselScrubber()`. Theme values fill in only where the compiled state matches the compiled default (i.e., the DSL author did not explicitly set that prop).

```typescript
import type { SceneTheme } from '../../theme/types';
import { DEFAULT_CAROUSEL_SCRUBBER_STYLE } from './compile';

/**
 * Merges SceneTheme.carouselTray tokens into the compiled style.
 * Priority: DSL props (in compiled style) > theme tokens > compiled defaults.
 *
 * A compiled value is considered "explicitly set by DSL" if it differs from
 * the compiled default. Theme values only fill in default-valued fields.
 */
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
    dialColor: style.dialColor !== defaults.dialColor ? style.dialColor : (trayTheme.dialColor ?? style.dialColor),
    accentColor: style.accentColor !== defaults.accentColor ? style.accentColor : (trayTheme.accentColor ?? style.accentColor),
    metalness: style.metalness !== defaults.metalness ? style.metalness : (trayTheme.metalness ?? style.metalness),
    roughness: style.roughness !== defaults.roughness ? style.roughness : (trayTheme.roughness ?? style.roughness),
  };
}
```

**Important design note:** The `resolveThemedStyle` approach compares against compiled defaults. This means if a DSL author explicitly sets `color="#1a2a40"` (same as default), it will be treated as "not explicitly set" and the theme will override it. This is the same behavior as `FloorWidget`'s `resolveThemedFloorState` and is the accepted pattern in this codebase. The alternative (tracking which props were explicitly passed) would require compiler-level changes and is not worth the complexity.

### New function: `resolveThemedDepthAndGap()`

Same pattern for non-style scalar fields that are also theme-settable:

```typescript
/**
 * Resolves tray depth and gap from compiled state + theme.
 * DSL-set values take precedence over theme values.
 */
function resolveThemedDepthAndGap(
  compiledDepth: number,
  compiledGap: number,
  theme: SceneTheme | null | undefined,
): { depth: number; gap: number } {
  const trayTheme = theme?.carouselTray;
  if (!trayTheme) return { depth: compiledDepth, gap: compiledGap };

  const DEFAULT_DEPTH = 0.36;
  const DEFAULT_GAP = 0.02;

  return {
    depth: compiledDepth !== DEFAULT_DEPTH ? compiledDepth : (trayTheme.depth ?? compiledDepth),
    gap: compiledGap !== DEFAULT_GAP ? compiledGap : (trayTheme.gap ?? compiledGap),
  };
}
```

### New function: `computeTrayPosition()`

This is the core positioning logic, cleanly separated from geometry:

```typescript
/**
 * Computes the world-space Y position for the tray's top and bottom edges.
 *
 * - Top edge: world Y of the NVS carousel region's bottom edge.
 * - Bottom edge: floor Y + gap. If no floor Y is determinable, uses top - depth.
 * - The tray depth adapts: max(compiledDepth, topY - bottomY).
 *
 * @returns { topY, bottomY, effectiveDepth, centerZ }
 */
function computeTrayPosition(
  nvsBounds: { x: number; y: number; w: number; h: number },
  zStep: number,
  loop: boolean,
  trayDepth: number,
  gap: number,
  coords: { toWorld: (x: number, y: number, z: number) => readonly [number, number, number] },
  scene: THREE.Scene,
): { topY: number; bottomY: number; effectiveDepth: number; centerZ: number } {
  // Convert the NVS bottom edge (y + h) to world Y.
  // NVS Y increases downward (0 = top, 1 = bottom), but world Y increases upward.
  // toWorld handles this conversion.
  const nvsBottomX = nvsBounds.x + nvsBounds.w / 2;
  const nvsBottomY = nvsBounds.y + nvsBounds.h;
  const [, viewBottomWorldY] = coords.toWorld(nvsBottomX, nvsBottomY, 0);

  // The tray top sits at the view bottom world Y.
  const topY = viewBottomWorldY;

  // Attempt to determine floor Y by scanning the scene bounding box.
  // This mirrors computeSceneBaseY() from floor/render.ts, but we inline
  // a simplified version here to avoid importing from floor/render.ts
  // (which would create a cross-element dependency within the render layer).
  //
  // The floor mesh is tagged with __brewsite_floor_part userData. We look for
  // the floor mesh's Y position directly.
  const floorY = findFloorY(scene);

  let bottomY: number;
  if (floorY !== null) {
    bottomY = floorY + gap;
  } else {
    // No floor found. Fall back to topY - trayDepth.
    bottomY = topY - trayDepth;
  }

  // The effective depth is the distance between top and bottom, but never
  // less than the compiled trayDepth.
  const spaceAvailable = topY - bottomY;
  const effectiveDepth = Math.max(trayDepth, spaceAvailable);

  // If effectiveDepth exceeds spaceAvailable (no floor or floor too close),
  // push bottomY down to accommodate.
  if (effectiveDepth > spaceAvailable) {
    bottomY = topY - effectiveDepth;
  }

  // Z: ring center is at -zStep/2 for loop carousels, 0 for linear.
  const centerZ = loop && zStep > 0 ? -zStep / 2 : 0;

  return { topY, bottomY, effectiveDepth, centerZ };
}
```

### New helper function: `findFloorY()`

```typescript
const FLOOR_PART_KEY = '__brewsite_floor_part';

/**
 * Finds the floor mesh Y position in the scene, or null if no floor exists.
 * Scans scene.children for objects tagged with __brewsite_floor_part userData.
 */
function findFloorY(scene: THREE.Scene): number | null {
  for (const child of scene.children) {
    const userData = child.userData as Record<string, unknown>;
    if (userData[FLOOR_PART_KEY] === true && child.name === 'Floor') {
      return child.position.y;
    }
  }
  return null;
}
```

### Updated `getOrCreateCache()`

Remove all dot-related code:

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

  const dialGeometry = createKnurledCylinderGeometry(
    DIAL_RADIUS, DIAL_THICKNESS, DIAL_SEGMENTS, KNURL_COUNT, KNURL_DEPTH,
  );
  const dialMaterial = new THREE.MeshStandardMaterial({
    color: '#2a3a50',
    metalness: 0.5,
    roughness: 0.4,
  });
  const dial = new THREE.Mesh(dialGeometry, dialMaterial);
  dial.rotation.x = Math.PI / 2;
  root.add(dial);

  scene.add(root);

  const cache: CarouselScrubberCache = {
    root,
    base: null,
    dial,
    currentDialAngle: 0,
    lastChildCount: 0,
    lastBaseShape: null,
    lastShowBase: false,
    lastBaseSize: 0,
    lastTrayDepth: 0,
  };

  scene.userData[key] = cache;
  return cache;
}
```

### Updated `ensureBase()`

Add `metalness` and `roughness` from style:

```typescript
function ensureBase(
  cache: CarouselScrubberCache,
  showBase: boolean,
  baseShape: 'disc' | 'track',
  baseSize: number,
  trayDepth: number,
  style: CarouselScrubberStyle,
): void {
  if (!showBase) {
    if (cache.base) cache.base.visible = false;
    return;
  }

  const needsRecreate =
    !cache.base ||
    cache.lastBaseShape !== baseShape ||
    cache.lastBaseSize !== baseSize ||
    cache.lastTrayDepth !== trayDepth;

  if (needsRecreate) {
    if (cache.base) {
      cache.root.remove(cache.base);
      cache.base.geometry.dispose();
      cache.base.material.dispose();
    }

    const geometry = baseShape === 'disc'
      ? createDiscBase(baseSize, trayDepth)
      : createTrackBase(baseSize, trayDepth);

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

    if (baseShape === 'track') {
      base.rotation.x = -Math.PI / 2;
    }

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

### Updated `applyCarouselScrubber()` signature and body

The function now accepts `scene` (for floor Y lookup and theme access) in addition to existing parameters:

```typescript
/**
 * Applies the carousel scrubber state to the Three.js scene.
 * Called each frame by the widget's apply() method.
 *
 * Positioning logic:
 * 1. Converts NVS bounds bottom edge to world Y via coords.toWorld()
 * 2. Positions tray top at that world Y
 * 3. Finds floor Y and positions tray bottom at floor Y + gap
 * 4. Tray depth adapts to fill the space (min: compiled trayDepth)
 */
export function applyCarouselScrubber(
  state: CarouselScrubberState,
  cache: CarouselScrubberCache,
  scene: THREE.Scene,
  coords?: { toWorld: (x: number, y: number, z: number) => readonly [number, number, number] },
): void {
  if (state.childCount === 0 || state.layoutId === '') {
    cache.root.visible = false;
    return;
  }
  cache.root.visible = true;

  // ── Theme resolution ──────────────────────────────────────────────────
  const theme = (scene.userData as Record<string, unknown>)[SCENE_THEME_USERDATA_KEY] as SceneTheme | null | undefined;
  const style = resolveThemedStyle(state.style, theme);
  const { depth: trayDepth, gap } = resolveThemedDepthAndGap(state.trayDepth, state.gap, theme);

  const zStep = state.zStep;
  const spread = state.spread ?? 0.45;

  // ── Positioning ───────────────────────────────────────────────────────
  if (coords) {
    const pos = computeTrayPosition(
      state.nvsBounds,
      zStep,
      state.loop,
      trayDepth,
      gap,
      coords,
      scene,
    );
    // Position root so the top of the tray geometry aligns with pos.topY.
    // The base geometry (disc/track) has its bottom at local Y=0 and top at Y=trayDepth.
    // We want the top (Y=effectiveDepth) to be at pos.topY in world space.
    // So root.position.y = pos.topY - pos.effectiveDepth = pos.bottomY.
    cache.root.position.set(0, pos.bottomY, pos.centerZ);
  } else {
    // Fallback when coords not available (should not happen in normal operation).
    const centerZ = state.loop && zStep > 0 ? -zStep / 2 : 0;
    cache.root.position.set(0, -0.5, centerZ);
  }

  // ── Size ──────────────────────────────────────────────────────────────
  let baseSize = state.baseSize;
  if (baseSize <= 0) {
    if (state.baseShape === 'disc') {
      baseSize = Math.max(zStep * 0.4, 1.5);
    } else {
      baseSize = Math.max(zStep * 0.6, 2.5);
    }
  }

  // ── Geometry ──────────────────────────────────────────────────────────
  const effectiveDepth = coords
    ? computeTrayPosition(state.nvsBounds, zStep, state.loop, trayDepth, gap, coords, scene).effectiveDepth
    : trayDepth;

  ensureBase(cache, state.showBase, state.baseShape, baseSize, effectiveDepth, style);

  // ── Dial ──────────────────────────────────────────────────────────────
  cache.dial.material.color.set(style.dialColor);

  const maxIndex = Math.max(0, state.childCount - 1);
  const normalizedPosition = maxIndex > 0 ? state.activeIndex / maxIndex : 0;
  const totalRotation = state.loop ? Math.PI * 2 : Math.PI * 1.5;
  const targetAngle = normalizedPosition * totalRotation;

  cache.currentDialAngle += (targetAngle - cache.currentDialAngle) * 0.12;
  cache.dial.rotation.z = cache.currentDialAngle;

  const frontZ = state.baseShape === 'disc'
    ? baseSize * 0.95
    : baseSize * 0.15;
  cache.dial.position.set(0, effectiveDepth * 0.5, frontZ + DIAL_RADIUS * 0.3);

  // ── Change detection ──────────────────────────────────────────────────
  cache.lastChildCount = state.childCount;
  cache.lastBaseShape = state.baseShape;
  cache.lastShowBase = state.showBase;
  cache.lastBaseSize = baseSize;
  cache.lastTrayDepth = effectiveDepth;
}
```

**Performance note:** `computeTrayPosition` is called twice in the above pseudocode (once for root positioning, once for effectiveDepth in geometry). The implementer should cache the result in a local variable instead. The plan shows the logic flow; the implementation should compute it once:

```typescript
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
```

### Updated `disposeCarouselScrubber()`

Remove all dot disposal code:

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
  cache.root.remove(cache.dial);
  cache.dial.geometry.dispose();
  cache.dial.material.dispose();
  scene.remove(cache.root);
  delete scene.userData[`${CACHE_KEY}_${widgetId}`];
}
```

### Retained functions (no changes needed)

- `createKnurledCylinderGeometry()` — stays as-is
- `createDiscBase()` — stays as-is
- `createTrackBase()` — stays as-is

---

## 6. `packages/core/src/elements/carousel-scrubber/CarouselScrubberWidget.ts` — Pass scene to apply

### Changes to `apply()` method

The `apply` method must now pass `this.threeScene` to `applyCarouselScrubber`:

```typescript
apply(state: CarouselScrubberState, ctx: WidgetRenderContext): void {
  if (!this.cache || !this.threeScene) return;
  applyCarouselScrubber(state, this.cache, this.threeScene, ctx.coords);
}
```

### Changes to `isCarouselScrubberStateLike()` guard

Remove the `position` check (field was removed from state), add `gap` check:

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
    (s['baseShape'] === 'disc' || s['baseShape'] === 'track') &&
    typeof s['gap'] === 'number' &&
    s['style'] !== undefined
  );
}
```

### No other structural changes

The widget class, constructor, `initialize()`, `dispose()`, `mergeSnapshot()`, `DslComponent`, `transitionSpec`, and `defaultState` remain the same structurally. The `defaultState` picks up the new `DEFAULT_CAROUSEL_SCRUBBER_STATE` automatically via the import.

---

## 7. `packages/core/src/compiler/blocks/viewHandlers.ts` — Update tray compilation

### Changes in the `CarouselTray` detection block

Update the default `trayDepth` from `0.12` to `0.36`. Remove `dotGlowIntensity` from the style props. Add `gap`, `metalness`, `roughness`:

Find this block (around line 260):

```typescript
const trayDepth = trayProps.depth ?? 0.12;
```

Replace with:

```typescript
const trayDepth = trayProps.depth ?? 0.36;
```

Find the `compileCarouselScrubber` call and update the props object. Replace:

```typescript
const trayState = compileCarouselScrubber(
  {
    id: trayWidgetId,
    layoutId,
    showBase: true,
    baseShape: isLoop ? 'disc' : 'track',
    position: [0, 0, 0],
    baseSize: trayBaseSize,
    trayDepth,
    style: {
      baseColor: trayProps.color,
      baseOpacity: trayProps.opacity,
      dialColor: trayProps.dialColor,
      accentColor: trayProps.accentColor,
      dotGlowIntensity: trayProps.glowIntensity,
    },
  },
  carouselConfig.activeIndex,
  viewIds.length,
  isLoop,
  composedContainerBounds,
  { zStep: carouselConfig.zStep, spread: carouselConfig.spread },
);
```

With:

```typescript
const trayState = compileCarouselScrubber(
  {
    id: trayWidgetId,
    layoutId,
    showBase: true,
    baseShape: isLoop ? 'disc' : 'track',
    baseSize: trayBaseSize,
    trayDepth,
    gap: trayProps.gap,
    style: {
      baseColor: trayProps.color,
      baseOpacity: trayProps.opacity,
      dialColor: trayProps.dialColor,
      accentColor: trayProps.accentColor,
      metalness: trayProps.metalness,
      roughness: trayProps.roughness,
    },
  },
  carouselConfig.activeIndex,
  viewIds.length,
  isLoop,
  composedContainerBounds,
  { zStep: carouselConfig.zStep, spread: carouselConfig.spread },
);
```

---

## 8. `packages/core/src/elements/carousel-scrubber/index.ts` — No changes needed

The barrel re-exports reference `CarouselScrubberStyle` from `types.ts` and the compile/widget exports. Since `CarouselScrubberStyle` is a named type export, the shape change is transparent. No fields are removed from the public API surface that would break consumers (only `dotGlowIntensity` is removed, and `position` is removed from the state type).

**However**, if any external consumer directly accesses `state.position` or `style.dotGlowIntensity`, this is a breaking change. Since the carousel scrubber element is new and has no known external consumers beyond the internal viewHandler, this is acceptable.

---

## 9. Test Plan

### `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts`

#### Tests to modify

1. **`produces default state for minimal props`** -- Update expectations:
   - Remove: `expect(state.position).toEqual([0, -0.5, 0]);`
   - Change: `expect(state.trayDepth).toBe(0.12);` to `expect(state.trayDepth).toBe(0.36);`
   - Add: `expect(state.gap).toBe(0.02);`
   - Add: `expect(state.style.metalness).toBe(0.3);`
   - Add: `expect(state.style.roughness).toBe(0.6);`

2. **`applies explicit position`** -- Delete this test entirely (position field removed).

3. **`merges partial style overrides with defaults`** -- Change:
   - `style: { baseColor: '#ff0000', dotGlowIntensity: 1.0 }` to `style: { baseColor: '#ff0000', metalness: 0.8 }`
   - `expect(state.style.dotGlowIntensity).toBe(1.0)` to `expect(state.style.metalness).toBe(0.8)`

4. **`DEFAULT_CAROUSEL_SCRUBBER_STATE has sensible default values`** -- Update:
   - Remove: `expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.position).toEqual([0, -0.5, 0]);`
   - Change: `expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.baseSize).toBe(1.5);` stays
   - Add: `expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.trayDepth).toBe(0.36);`
   - Add: `expect(DEFAULT_CAROUSEL_SCRUBBER_STATE.gap).toBe(0.02);`

#### Tests to delete

5. **`exitFn` > `fades dotGlowIntensity to 0 at t=1`** -- Delete entirely.

6. **`enterFn` > `fades dotGlowIntensity from 0 to target`** -- Delete entirely.

7. **`interpolateFn` > `blends style numeric values`** -- Remove `dotGlowIntensity` from the test. Replace with `metalness`/`roughness` blending assertions:

```typescript
it('blends style numeric values', () => {
  const from = makeState({
    style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 0.2, metalness: 0.0 },
  });
  const to = makeState({
    style: { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE, baseOpacity: 1.0, metalness: 1.0 },
  });
  const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
  const result = fn(makeCtx(0.5));
  expect(result.style.baseOpacity).toBeCloseTo(0.6, 5);
  expect(result.style.metalness).toBeCloseTo(0.5, 5);
});
```

#### Tests to add

8. **`blends position` test replacement** -- Replace position blending test with `gap` blending:

```typescript
it('blends gap linearly', () => {
  const from = makeState({ gap: 0.01 });
  const to = makeState({ gap: 0.05 });
  const fn = carouselScrubberTransitionSpec.interpolateFn(from, to);
  const result = fn(makeCtx(0.5));
  expect(result.gap).toBeCloseTo(0.03, 5);
});
```

9. **`applies explicit gap`** -- New test:

```typescript
it('applies explicit gap', () => {
  const props: CarouselScrubberProps = { ...minimalProps, gap: 0.05 };
  const state = compileCarouselScrubber(props, 0, 3, false);
  expect(state.gap).toBe(0.05);
});
```

### Tests NOT needed

- `render.ts` is excluded from test coverage (Three.js rendering logic). No render tests.
- `CarouselScrubberWidget.ts` integration tests are not currently in the test suite and this plan does not add them (widget tests require Three.js mocking infrastructure that does not exist).
- Theme resolution in `render.ts` (`resolveThemedStyle`) is not tested directly because it lives in the render layer. Theme integration is validated visually.

---

## Implementation Order

Execute in this exact order to avoid intermediate type errors:

1. `packages/core/src/theme/types.ts` -- Add `SceneThemeCarouselTray` and the `carouselTray` field on `SceneTheme`.
2. `packages/core/src/elements/carousel-scrubber/types.ts` -- Remove `dotGlowIntensity`, remove `position`, add `metalness`, `roughness`, `gap`.
3. `packages/core/src/elements/carousel-scrubber/dsl.tsx` -- Update `CarouselTrayProps` and `CarouselScrubberProps`.
4. `packages/core/src/elements/carousel-scrubber/compile.ts` -- Update defaults, `compileCarouselScrubber`, `blendStyle`, transition spec.
5. `packages/core/src/compiler/blocks/viewHandlers.ts` -- Update tray compilation call.
6. `packages/core/src/elements/carousel-scrubber/render.ts` -- Full rewrite: delete dots, add positioning, add theme resolution.
7. `packages/core/src/elements/carousel-scrubber/CarouselScrubberWidget.ts` -- Update `apply()` signature, update duck-type guard.
8. `packages/core/src/elements/carousel-scrubber/__tests__/compile.test.ts` -- Update and add tests.

## Verification

After implementation, run:

```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/core vitest run src/elements/carousel-scrubber/__tests__/compile.test.ts
pnpm --filter @brewsite/core test
```

All three must pass with zero errors.
