---
title: "Carousel Tray View Highlights"
doc_type: plan
owner: architect
status: draft
updated: 2026-03-17
---

# Carousel Tray View Highlights

## Goal

Add per-view highlight effects to the carousel tray. Effects render in 3D space above the tray surface, aligned to individual view bounds. Two visual modes:

1. **Glow** — A soft emissive rectangle in the XZ plane above the tray, under the target view. Think status-indicator glow on a control panel.
2. **Holographic** — A soft vertical volumetric beam rising from the view's footprint. Soft edges, translucent, non-occluding. Plus an optional animated smoke/mist particle ring at the base.

Both modes are opt-in per-view via DSL props, and the **active carousel item** can auto-highlight via a single flag. All visual parameters are theme-controllable via `SceneThemeCarouselTray`.

---

## Architecture Overview

The highlight system is a **render-only extension** of the existing `CarouselScrubberWidget`. No new widgets, no new DSL components, no changes to the compiler pipeline. The tray already has access to all the data it needs:

- **Individual view positions**: The tray's `CarouselScrubberState` gains a new `viewHighlights` array compiled from ViewLayout child state. Each entry carries the view's NVS bounds plus highlight config.
- **World-space conversion**: The render function already receives `NVSCoordService` via `ctx.coords`.
- **Tray surface Y**: Already computed as `trayPos.topY` in the render path.

### Data Flow

```
DSL: <CarouselTray highlightActive={true} />
                    ↓
compileTray.ts: reads ViewState bounds for each view,
                builds ViewHighlight[] from theme + DSL props
                    ↓
CarouselScrubberState.viewHighlights: ViewHighlight[]
                    ↓
render.ts: for each highlight, creates/updates Three.js meshes
           positioned in world space above the tray surface
```

---

## Types

### File: `packages/core/src/elements/carousel-scrubber/types.ts`

```typescript
/**
 * Highlight mode for a view on the carousel tray.
 * 'glow'        — Flat emissive rectangle in XZ plane above the tray.
 * 'holographic' — Vertical volumetric beam + optional smoke ring.
 * 'none'        — No highlight (default).
 */
export type ViewHighlightMode = 'glow' | 'holographic' | 'none';

/**
 * Per-view highlight configuration. One entry per carousel child view.
 * Built at compile time from DSL props + theme defaults.
 */
export type ViewHighlight = {
  /** View widget ID this highlight targets. */
  readonly viewId: string;
  /** NVS bounds of the view (copied from ViewState.bounds). */
  readonly bounds: { x: number; y: number; w: number; h: number };
  /** Highlight mode. Default: 'none'. */
  readonly mode: ViewHighlightMode;
  /** Highlight color. Falls through: DSL → theme → accentColor. */
  readonly color: string;
  /** Glow/beam opacity [0-1]. Default: 0.6 for glow, 0.4 for holographic. */
  readonly intensity: number;
  /** Beam height in world units (holographic only). Default: 1.5. */
  readonly beamHeight?: number;
  /** Enable smoke/mist ring at base (holographic only). Default: false. */
  readonly smoke?: boolean;
};
```

Add to `CarouselScrubberState`:

```typescript
export type CarouselScrubberState = {
  // ... existing fields ...
  /** Per-view highlight effects. Empty array = no highlights. */
  readonly viewHighlights: readonly ViewHighlight[];
};
```

### File: `packages/core/src/theme/types.ts`

Add to `SceneThemeCarouselTray`:

```typescript
export type SceneThemeCarouselTray = {
  // ... existing fields ...
  /** Default highlight mode for the active carousel item. */
  readonly highlightActive?: ViewHighlightMode;
  /** Default highlight color. Falls back to accentColor. */
  readonly highlightColor?: string;
  /** Default highlight intensity [0-1]. */
  readonly highlightIntensity?: number;
  /** Default beam height for holographic mode [world units]. */
  readonly highlightBeamHeight?: number;
  /** Enable smoke ring for holographic highlights. */
  readonly highlightSmoke?: boolean;
};
```

---

## DSL Changes

### File: `packages/core/src/elements/carousel-scrubber/dsl.tsx`

Add props to `CarouselTrayProps` (the child DSL component inside `<ViewLayout>`):

```typescript
export type CarouselTrayProps = {
  // ... existing props ...
  /**
   * Highlight the active (front) carousel item. Value is the highlight mode.
   * true = 'glow' (shorthand). false/'none' = disabled.
   * Theme: SceneThemeCarouselTray.highlightActive
   */
  highlightActive?: ViewHighlightMode | boolean;
  /**
   * Highlight color override. Falls back to theme → accentColor.
   */
  highlightColor?: string;
  /**
   * Highlight intensity override [0-1].
   */
  highlightIntensity?: number;
  /**
   * Beam height for holographic mode [world units].
   */
  highlightBeamHeight?: number;
  /**
   * Enable smoke ring for holographic highlights.
   */
  highlightSmoke?: boolean;
};
```

---

## Compilation Changes

### File: `packages/core/src/elements/carousel-scrubber/compileTray.ts`

In `compileTrayFromViewLayout()`, after computing the existing state:

1. Resolve highlight mode: `trayProps.highlightActive ?? trayTheme?.highlightActive ?? 'none'`
2. Normalize boolean shorthand: `true → 'glow'`, `false → 'none'`
3. If mode is not `'none'`, build `ViewHighlight[]`:
   - For each viewId in the layout's `viewIds`, look up the view's compiled `ViewState` from `viewBoundsMap`
   - Mark the view at `activeIndex` with the resolved mode; all others get `'none'`
   - Color: `trayProps.highlightColor ?? trayTheme?.highlightColor ?? resolvedStyle.accentColor`
   - Intensity: `trayProps.highlightIntensity ?? trayTheme?.highlightIntensity ?? (mode defaults)`
   - Beam height / smoke: same fallback chain

4. Set `state.viewHighlights = highlights` on the compiled `CarouselScrubberState`

### Transition spec

`viewHighlights` does **not** interpolate — it snaps. The visual smoothness comes from the render layer (opacity fade-in/out on the Three.js meshes). Add `viewHighlights` to the compile output; the existing `FunctionalTransitionSpec` passes it through unchanged.

---

## Render Implementation

### File: `packages/core/src/elements/carousel-scrubber/render.ts`

#### Cache additions

```typescript
export type CarouselScrubberCache = {
  // ... existing fields ...
  /** Per-view highlight mesh groups, keyed by viewId. */
  highlightMeshes: Map<string, HighlightMeshSet>;
};

type HighlightMeshSet = {
  group: THREE.Group;
  glowPlane: THREE.Mesh | null;     // For 'glow' mode
  beamMesh: THREE.Mesh | null;      // For 'holographic' mode
  smokeMesh: THREE.Points | null;   // For holographic smoke
  currentOpacity: number;           // For fade transitions
  mode: ViewHighlightMode;
};
```

#### New render function: `applyViewHighlights()`

Called at the end of `applyCarouselScrubber()`, after tray positioning is resolved:

```typescript
function applyViewHighlights(
  highlights: readonly ViewHighlight[],
  cache: CarouselScrubberCache,
  trayTopY: number,
  coords: NVSCoordService,
): void
```

**For each highlight entry:**

1. **Convert view NVS bounds to world rectangle:**
   ```
   const [worldX, worldY] = coords.toWorld(bounds.x + bounds.w/2, bounds.y + bounds.h/2, 0);
   const [worldW, worldH] = coords.toWorldSize(bounds.w, bounds.h);
   ```
   The glow/beam footprint: `worldW × worldH` centered at `(worldX, trayTopY + offset, worldZ)`.

2. **Glow mode** — create or reuse a `PlaneGeometry` in XZ plane:
   - Geometry: `PlaneGeometry(worldW, worldH)` rotated to lie flat in XZ
   - Material: `MeshBasicMaterial({ color, transparent: true, opacity: intensity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide })`
   - Position: `(worldX, trayTopY + 0.01, 0)` — 0.01 above tray to avoid z-fight
   - Add a soft radial gradient via a canvas texture (bright center, transparent edges)

3. **Holographic mode** — create or reuse a cylinder/cone mesh:
   - Geometry: `CylinderGeometry(radiusTop, radiusBottom, beamHeight, 32, 1, true)` — open-ended
   - `radiusBottom` ≈ `Math.max(worldW, worldH) * 0.5` (fits the view footprint)
   - `radiusTop` ≈ `radiusBottom * 0.6` (tapers upward)
   - Material: `ShaderMaterial` with:
     - Vertical gradient: full opacity at base → 0 at top
     - Radial softness: center brighter, edges transparent
     - `AdditiveBlending`, `depthWrite: false`, `transparent: true`
     - Uniform `u_color`, `u_intensity`, `u_time` (for subtle animation)
   - Position: `(worldX, trayTopY, 0)`, beam rises in +Y
   - Optional `smoke`: a `Points` mesh with a small particle buffer, animated in a ring at the base via `onTick`

4. **Cleanup**: remove meshes for views that no longer have highlights (or mode changed to 'none'). Dispose geometries and materials.

5. **Fade transitions**: lerp `currentOpacity` toward target intensity each frame (LERP 0.08). When opacity < 0.01, set `visible = false`.

#### Ring carousel rotation

For ring carousels, highlight meshes must rotate with the tray. Since they're added as children of `cache.root` (the tray group), they inherit `cache.root.rotation.y` automatically.

---

## Holographic Beam Shader

A simple vertex+fragment shader for the volumetric beam effect:

```glsl
// Vertex
varying float vHeight;   // 0 at base, 1 at top
varying float vRadial;   // 0 at center, 1 at edge

void main() {
  vHeight = uv.y;
  vRadial = length(position.xz) / u_radius;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment
uniform vec3 u_color;
uniform float u_intensity;
uniform float u_time;

varying float vHeight;
varying float vRadial;

void main() {
  // Vertical falloff: bright at base, transparent at top
  float vertFade = 1.0 - smoothstep(0.0, 0.85, vHeight);
  // Radial softness: bright center, soft edges
  float radFade = 1.0 - smoothstep(0.3, 1.0, vRadial);
  // Subtle pulse animation
  float pulse = 0.95 + 0.05 * sin(u_time * 2.0 + vHeight * 3.0);

  float alpha = vertFade * radFade * u_intensity * pulse;
  gl_FragColor = vec4(u_color, alpha);
}
```

---

## Smoke Ring (Optional)

Minimal particle system using `THREE.Points`:

- **Buffer**: 64-128 particles in a ring at `radius ≈ viewFootprintRadius * 0.7`
- **Geometry**: `BufferGeometry` with position + custom attributes (age, speed, angle)
- **Material**: `PointsMaterial({ size, map: softCircleTexture, transparent, blending: AdditiveBlending, depthWrite: false })`
- **Animation**: each particle orbits slowly, drifts upward, fades by age. Recycled when age > lifetime.
- **Update**: driven by the existing render loop — `applyViewHighlights()` is called every frame, so we advance particle positions there using `dt` from a simple `Date.now()` delta.

---

## Default Values

| Parameter | Glow default | Holographic default |
|-----------|-------------|-------------------|
| color | accentColor | accentColor |
| intensity | 0.5 | 0.35 |
| beamHeight | n/a | 1.5 world units |
| smoke | n/a | false |

---

## Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `elements/carousel-scrubber/types.ts` | Modify | Add `ViewHighlight`, `ViewHighlightMode`, add `viewHighlights` to `CarouselScrubberState` |
| `theme/types.ts` | Modify | Add highlight tokens to `SceneThemeCarouselTray` |
| `elements/carousel-scrubber/dsl.tsx` | Modify | Add highlight props to `CarouselTrayProps` |
| `elements/carousel-scrubber/compileTray.ts` | Modify | Build `ViewHighlight[]` from DSL + theme + view bounds |
| `elements/carousel-scrubber/compile.ts` | Modify | Add `viewHighlights` to default state and transition spec |
| `elements/carousel-scrubber/render.ts` | Modify | Add `applyViewHighlights()`, cache management, cleanup in dispose |
| `elements/carousel-scrubber/highlightShader.ts` | **Create** | GLSL vertex/fragment for holographic beam |
| `elements/carousel-scrubber/highlightParticles.ts` | **Create** | Smoke ring particle system (Points buffer, animation) |
| `elements/carousel-scrubber/__tests__/compile.test.ts` | Modify | Test highlight compilation from DSL + theme |

---

## Test Strategy

| Module | Strategy |
|--------|----------|
| `compileTray.ts` | Pass real `CarouselTrayProps` with highlight flags + mock theme → assert `viewHighlights[]` shape, color fallback chain, active-index targeting |
| `compile.ts` | Verify `DEFAULT_CAROUSEL_SCRUBBER_STATE.viewHighlights` is `[]`. Verify transition spec passes through `viewHighlights` without interpolation |
| `highlightShader.ts` | No test (GLSL — tested visually) |
| `highlightParticles.ts` | Unit test particle recycling math: given age > lifetime, particle resets. Pure function, no Three.js needed |
| `render.ts` | No test (Three.js render code excluded from coverage) |

---

## Usage Example

```tsx
<ViewLayout kind="carousel" id="metrics">
  <CarouselTray
    surface="obsidian"
    highlightActive="holographic"
    highlightColor="#E36A2E"
    highlightSmoke
  />
  <View id="chart-1"><MyChart /></View>
  <View id="chart-2"><MyChart /></View>
  <View id="chart-3"><AlertingChart /></View>
</ViewLayout>
```

Or theme-only (no DSL props needed):

```typescript
export const darkGlassSceneTheme: SceneTheme = {
  // ...
  carouselTray: {
    surfaceMaterial: 'obsidian',
    highlightActive: 'holographic',
    highlightColor: '#E36A2E',
    highlightIntensity: 0.4,
    highlightBeamHeight: 1.2,
    highlightSmoke: true,
  },
};
```

---

## Implementation Order

1. **Types** — `ViewHighlight`, `ViewHighlightMode`, state + theme additions
2. **Compile** — build highlights array, defaults, transition passthrough
3. **Tests** — compile tests for highlight generation
4. **Glow render** — flat XZ glow plane with gradient texture
5. **Holographic render** — beam shader + mesh
6. **Smoke particles** — optional particle ring
7. **Theme presets** — add highlight defaults to darkGlass (and optionally others)
