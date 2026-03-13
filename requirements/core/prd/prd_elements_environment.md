---
title: "BrewSite Core — Environment Elements"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-13
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full authoring surface, compiled state types, widget contracts, and transition behavior for Background, Lighting, Floor, and Environment (HDR) elements in @brewsite/core."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening update: replaced createDefaultWidgetRegistry() references with corePlugin() to reflect the plugin-based registration model."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "PRD audit: major update to reflect expanded element APIs. Lighting element now supports GlowPoint, LightStrand (with Wave, Circle, Rectangle shapes), and expanded Spot/Directional with shadow-related fields. Floor element expanded with FloorPhysical and FloorMirror variant DSL components, FloorVariant discriminant, FloorPlacement, grid overlay with configurable cell size/colors/opacity, negativeZ extent controls, and SceneThemeFloor integration. Environment element expanded with EnvironmentHdri, EnvironmentExr, EnvironmentCube discriminated DSL components replacing the single generic Environment component; EnvironmentSource discriminated union replaces flat url/preset fields. SceneFloor type substantially expanded. SceneLighting type expanded with glowPoints, strands, and new directional fields. Updated all API Design sections with current type signatures."
---

# BrewSite Core — Environment Elements

## 1. Overview

The environment elements — Background, Lighting, Floor, and Environment (HDR) — control the visual context of every scene in a BrewSite composition. Together they establish the atmosphere, material fidelity, and spatial grounding of the 3D canvas. Each element follows the mandatory module pattern (`types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts`) and integrates with the compiler pipeline as a registered node handler producing per-frame state entries inside `SceneTrack`.

All four elements are first-party widget implementations registered by `corePlugin()`. They are distinct concerns and are individually tree-shakeable: consuming only `<Background>` does not pull in Lighting or Environment code.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

Animated 3D scenes require consistent visual grounding across every frame of every transition. Without the environment elements, a raw Three.js scene renders with default grey background, flat unlit surfaces, and no spatial anchoring. The environment elements close the gap between "Three.js defaults" and "production-quality visual context" through a declarative authoring surface that requires no Three.js knowledge from the scene author.

The secondary problem is transition fidelity. Environment state must interpolate smoothly between scenes — background images must crossfade, light intensities must lerp, the floor must transition opacity. Without per-frame state baked into the `SceneTrack`, these transitions require imperative logic scattered across consumer code, which defeats the toolkit's declarative model.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- A scene author can establish full visual context (background, lighting, floor, HDR) using only DSL props, with no Three.js knowledge required.
- All four environment elements transition smoothly between scenes: no hard cuts, no flicker, no Z-fighting on background geometry.
- HDR textures and background images are preloaded during the `ILoadable` phase, never loading mid-playback.

**Success Metrics:**
- Background crossfade: visually smooth at 60fps between two scenes with different `imageUrl` values.
- Lighting transition: all light channels (intensity, color, position) lerp to target state within the scene's configured transition duration, with no per-frame JavaScript allocations.
- Bundle size contribution: all four elements combined add less than 15 KB gzipped to the consumer bundle (excluding Three.js peer dependency).
- TypeScript: zero `any` types on public-facing props and state interfaces.

**Guardrail Metrics:**
- No change to any environment element's `SceneBackground`, `SceneLighting`, `SceneFloor`, or `SceneEnvironment` types causes a major semver bump without an explicit migration path.
- Existing `apps/examples/` scenes that use these elements continue to compile and render correctly after any change.

---

## 4. Non-Goals

- **Shadow map configuration** beyond `castShadow: boolean` on directional and spot lights — shadow quality tuning (map size, bias, camera frustum) is not exposed as DSL props.
- **Custom shader materials for the floor** — reflectivity is controlled through `MeshStandardMaterial` roughness and a simple Reflector setup, not custom GLSL.
- **Animated sky / skybox geometry** — the Background element is a flat plane mesh; spherical sky domes are not in scope.
- **Multiple simultaneous HDR environments per scene** — one active environment per scene tick.
- **Runtime-mutable environment state outside the compiler** — environment state is declared in DSL and baked into `SceneTrack`; no imperative environment API is exposed.
- **CSS-only background rendering** — the CSS fallback props exist for graceful degradation, not as a primary rendering path.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to set a background image for a scene so that my 3D canvas has a contextual environment without needing to manage Three.js geometry myself.
- As a toolkit consumer, I want background images to crossfade smoothly when transitioning between scenes so that the visual experience is cinematic rather than abrupt.
- As a toolkit consumer, I want to configure ambient, directional, point, spot, and panel lights through DSL props so that I can match lighting to my brand identity without writing Three.js code.
- As a toolkit consumer, I want lighting values to interpolate automatically between scenes so that atmosphere changes feel intentional and smooth.
- As a toolkit consumer, I want to enable or disable the reflective floor per scene so that I can choose between grounded and floating object presentations.
- As a toolkit consumer, I want to apply a studio HDR environment map so that PBR materials on my models reflect their environment realistically.
- As a toolkit consumer, I want HDR textures to preload before playback starts so that there is no mid-playback texture pop.

---

## 6. Functional Requirements

1. The system shall compile `<Background>`, `<Lighting>`, `<Floor>`, and `<Environment>` DSL components to per-frame state entries baked into the `SceneTrack`.
2. The system shall lerp all numeric fields of `SceneBackground`, `SceneLighting`, `SceneFloor`, and `SceneEnvironment` between the outgoing and incoming scene states across the configured transition duration.
3. The `BackgroundWidget` shall preload all background image textures declared across all scenes during the `ILoadable.load()` phase.
4. The `EnvironmentWidget` shall preload all HDR textures declared across all scenes during the `ILoadable.load()` phase using `RGBELoader` and `PMREMGenerator`.
5. The `LightingWidget` shall create and cache Three.js light objects once at initialization and update their properties each tick; it shall not create new light objects during playback.
6. Point and spot light arrays declared in `SceneLighting` shall be matched by array index across scenes; lights present in one scene but absent in another shall transition to/from `intensity: 0`.
7. The `FloorWidget` shall render a shadow-receiving reflective plane at `y=0` and shall transition its `opacity` between `enabled: true` and `enabled: false` states rather than toggling visibility instantly.
8. The `EnvironmentWidget` shall apply the pre-filtered environment map to `scene.environment` and shall lerp `intensity` between scenes.
9. All environment elements shall function correctly when any subset is omitted from a scene; missing elements shall not cause runtime errors in widgets that are present.
10. Panel lights (`SceneLightPanel`) shall be implemented using Three.js `RectAreaLight` and shall not support shadow casting.
11. The `Background` DSL component shall accept CSS fallback props (`cssPosition`, `cssSize`, `cssRepeat`) that are rendered to the host container element as inline styles when Three.js is unavailable.

---

## 7. API Design

### 7.1 Shared Types

```typescript
// packages/core/src/math/types.ts
type Vec3 = [number, number, number];
type Vec2 = [number, number];
```

### 7.2 Background Element

#### State Type (`elements/background/types.ts`)

```typescript
export interface SceneBackground {
  imageUrl: string;
  opacity?: number;        // default 1.0; range [0, 1]
  position?: Vec3;         // world-space position of background plane; default [0, 0, -10]
  cssPosition?: string;    // CSS background-position for fallback rendering
  cssSize?: string;        // CSS background-size for fallback rendering
  cssRepeat?: string;      // CSS background-repeat for fallback rendering
}
```

#### DSL (`elements/background/dsl.tsx`)

```tsx
// Minimal usage
<Background imageUrl="/images/office.jpg" />

// Full usage
<Background
  imageUrl="/images/office.jpg"
  opacity={1}
  position={[0, 0, -12]}
  cssPosition="center center"
  cssSize="cover"
/>
```

#### Compiled State Entry

The compiler emits one `SceneBackground` entry per scene frame. Between two scenes with different `imageUrl` values, the compiler emits a blend record that the widget resolves to a crossfade: old texture fades from its current `opacity` to `0`, new texture fades from `0` to the target `opacity`.

### 7.3 Lighting Element

#### State Types (`elements/lighting/types.ts`)

```typescript
export type SceneLightAmbient = {
  intensity: number;
  color?: string;          // CSS hex color string; default '#ffffff'
};

export type SceneLightDirectional = {
  intensity: number;
  color?: string;          // default '#ffffff'
  position?: Vec3;         // normalized direction vector; default [1, 2, 3]
  castShadow?: boolean;    // default false
  shadowBias?: number;     // shadow bias; default -0.0001
  shadowNormalBias?: number;
  shadowMapSize?: number;  // shadow map resolution; default 1024
  shadowCameraSize?: number; // orthographic shadow camera frustum size
};

export type SceneLightGlowPoint = {
  intensity: number;
  color?: string;          // default '#ffffff'
  position?: Vec3;         // world-space position
  size?: number;           // glow sprite size in world units
  distance?: number;       // attenuation range; 0 = no attenuation
  decay?: number;          // physical attenuation exponent; default 2
};

export type SceneLightStrandWave = { shape: 'wave'; amplitude: number; frequency: number; phaseOffset?: number };
export type SceneLightStrandCircle = { shape: 'circle'; radius: number; segments?: number; arcStart?: number; arcEnd?: number };
export type SceneLightStrandRectangle = { shape: 'rectangle'; width: number; height: number };
export type SceneLightStrandShape = SceneLightStrandWave | SceneLightStrandCircle | SceneLightStrandRectangle;

export type SceneLightStrand = {
  count: number;           // number of point lights along the strand
  intensity?: number;
  color?: string;
  position?: Vec3;         // strand center position
  spread?: number;         // spread factor along the strand path
  curve?: SceneLightStrandCurve;
  shapes?: SceneLightStrandShape[];
};

export type SceneLightSpot = {
  intensity: number;
  color?: string;          // default '#ffffff'
  position?: Vec3;         // world-space position
  target?: Vec3;           // look-at world position; default [0, 0, 0]
  angle?: number;          // cone half-angle in radians; default Math.PI / 6
  penumbra?: number;       // cone edge softness [0, 1]; default 0
  castShadow?: boolean;    // default false
};

export type SceneLightPanel = {
  intensity: number;
  color?: string;          // default '#ffffff'
  position?: Vec3;
  rotation?: Vec3;         // Euler angles in radians; default [0, 0, 0]
  width?: number;          // panel width in world units; default 2
  height?: number;         // panel height in world units; default 2
};

export type SceneLighting = {
  ambient?: SceneLightAmbient;
  directional?: SceneLightDirectional;
  directionals?: SceneLightDirectional[];  // multiple directional lights
  glowPoints?: SceneLightGlowPoint[];
  spots?: SceneLightSpot[];
  strands?: SceneLightStrand[];
  panels?: SceneLightPanel[];
  intensityScale?: number; // global multiplier applied to all light intensities; default 1
  color?: string;          // global color tint blended into all lights; default '#ffffff'
};
```

#### DSL (`elements/lighting/dsl.tsx`)

The Lighting DSL supports both the legacy compound `<Lighting>` component (with all light types as props) and individual sub-element components for a cleaner compositional authoring style:

```tsx
// Individual sub-elements (preferred for v2 scenes):
<Ambient intensity={0.5} color="#ddeeff" />
<Directional intensity={1.2} position={[1, 2, 3]} castShadow />
<GlowPoint intensity={0.8} position={[2, 1, 0]} size={0.1} />
<Spot intensity={1.0} position={[0, 4, 2]} target={[0, 0, 0]} angle={0.4} penumbra={0.2} />
<Panel intensity={0.6} position={[0, 2, -1]} width={3} height={2} />
<LightStrand count={12} intensity={0.3} color="#ffd700" position={[0, 3, 0]}>
  <Wave amplitude={0.5} frequency={2} />
</LightStrand>

// Legacy compound form (still supported):
<Lighting
  ambient={{ intensity: 0.5, color: '#ddeeff' }}
  directional={{ intensity: 1.2, position: [1, 2, 3], castShadow: true }}
  spots={[
    { intensity: 1.0, position: [0, 4, 2], target: [0, 0, 0], angle: 0.4, penumbra: 0.2 },
  ]}
  intensityScale={1.0}
/>
```

#### Transition Behavior

All numeric fields in `SceneLighting` participate in per-frame lerp. The compiler emits a blend specification per transition block. The `LightingWidget.apply()` implementation uses the `blockProgress` value from `SceneTrackTick` to lerp each field independently.

- `ambient.intensity` and `ambient.color` lerp independently.
- `directional.intensity`, `directional.color`, and `directional.position` lerp independently.
- `points[]` and `spots[]` are matched by array index. Excess lights in the outgoing scene transition to `intensity: 0` at the target scene's array length. Missing lights in the outgoing scene enter from `intensity: 0`.
- `intensityScale` lerps as a single number.
- `color` transitions through HSL space to prevent unexpected hue shifts at midpoint.

### 7.4 Floor Element

#### State Type (`elements/floor/types.ts`)

```typescript
export type FloorVariant = 'grid' | 'mirror' | 'physical';
export type FloorPlacement = 'origin' | 'sceneBase';
export type FloorNegativeZEdge = 'hard' | 'fade';

export type SceneFloor = {
  enabled?: boolean;
  variant?: FloorVariant;        // default 'physical'
  placement?: FloorPlacement;    // default 'origin'
  opacity?: number;              // [0, 1]; default 1
  y?: number;                    // Y position of floor plane
  size?: number;                 // floor plane size in world units
  negativeZExtent?: number;      // world-space reach in negative Z
  negativeZEdge?: FloorNegativeZEdge;
  negativeZFadeDistance?: number;
  surface?: FloorSurface;        // FloorSurfacePhysical | FloorSurfaceMirror
};

export type FloorSurfacePhysical = {
  kind: 'physical';
  color?: string;
  roughness?: number;
  metalness?: number;
  gridCellSize?: number;         // grid line spacing in world units
  gridColor?: string;            // minor grid line color
  gridMajorColor?: string;       // major grid line color
  gridLineOpacity?: number;
  gridFillOpacity?: number;
  gridMajorEvery?: number;       // minor cells per major grid line
};

export type FloorSurfaceMirror = {
  kind: 'mirror';
  color?: string;
  opacity?: number;
  blur?: number;
  mixStrength?: number;
};

export type FloorSurface = FloorSurfacePhysical | FloorSurfaceMirror;
```

#### DSL (`elements/floor/dsl.tsx`)

The Floor element supports three DSL variants:

```tsx
// Generic floor (defaults to 'physical')
<Floor enabled opacity={0.8} />

// Physical floor with grid overlay
<FloorPhysical
  gridCellSize={0.1}
  gridColor="rgba(255,255,255,0.15)"
  gridMajorColor="rgba(255,255,255,0.3)"
  gridMajorEvery={5}
  roughness={0.9}
/>

// Mirror/reflection floor
<FloorMirror
  color="#0a0a14"
  opacity={0.6}
  blur={0.5}
  mixStrength={0.8}
/>

// Hide floor
<Floor enabled={false} />

// Theme-driven floor
<Floor theme={darkGlassSceneTheme} />
```

#### Transition Behavior

When `enabled` toggles between `true` and `false` across scenes, the compiler transitions the floor's `opacity` (from `1` to `0` or vice versa). The floor plane remains in the scene graph; only opacity transitions. When `variant` changes between scenes, the compiler crossfades between surface types.

### 7.5 Environment (HDR) Element

#### State Type (`elements/environment/types.ts`)

```typescript
export type EnvironmentSourceHdri = {
  kind: 'hdri';
  url: string;              // URL to .hdr or .hdri file
};

export type EnvironmentSourceExr = {
  kind: 'exr';
  url: string;              // URL to .exr file
};

export type EnvironmentSourceCube = {
  kind: 'cube';
  urls: [string, string, string, string, string, string]; // +x, -x, +y, -y, +z, -z
};

export type EnvironmentSource = EnvironmentSourceHdri | EnvironmentSourceExr | EnvironmentSourceCube;

export type SceneEnvironment = {
  enabled?: boolean;        // default true
  intensity?: number;       // environment map intensity [0, 2+]; default 1.0
  source?: EnvironmentSource;
  backgroundBlur?: number;  // blur factor for scene.backgroundBlurriness
  backgroundIntensity?: number; // separate intensity for scene background
};
```

#### DSL (`elements/environment/dsl.tsx`)

The Environment element supports discriminated DSL components for each source type, plus a generic fallback:

```tsx
// Generic environment (legacy, accepts url and preset)
<Environment intensity={1.0} />

// HDRI source (most common)
<EnvironmentHdri url="/envmaps/warehouse.hdr" intensity={1.2} />

// EXR source
<EnvironmentExr url="/envmaps/studio.exr" intensity={0.9} />

// Cube map source
<EnvironmentCube urls={['+x.jpg', '-x.jpg', '+y.jpg', '-y.jpg', '+z.jpg', '-z.jpg']} />

// Disabled — removes scene.environment (unlit fallback)
<Environment enabled={false} />
```

#### Behavior

The `EnvironmentWidget` uses `RGBELoader` for HDRI, `EXRLoader` for EXR, and `CubeTextureLoader` for cube maps. Loaded textures are passed through `PMREMGenerator` to produce pre-filtered environment maps for PBR materials. The resulting `THREE.Texture` is assigned to `scene.environment`.

When `intensity` transitions between scenes, the widget lerps `scene.environmentIntensity` (Three.js r154+). Crossfading between different environment maps is handled by blending intensity values.

---

## 8. Technical Considerations

### 8.1 Module Pattern Compliance

Each element follows the mandatory module pattern with strict layer isolation:

```
elements/background/
  types.ts        — SceneBackground interface; no Three.js, no React
  dsl.tsx         — <Background> component; no Three.js
  compile.ts      — pure state extraction; no Three.js, no React
  render.ts       — Three.js plane mesh, texture loading, opacity management
  BackgroundWidget.ts — IWidget, ISceneElement, IRenderable, ILoadable
  index.ts        — re-exports only

elements/lighting/
  types.ts        — SceneLighting interface; no Three.js, no React
  dsl.tsx         — <Lighting> component; no Three.js
  compile.ts      — pure state extraction; no Three.js, no React
  render.ts       — Three.js light object management
  LightingWidget.ts — IWidget, ISceneElement, IRenderable
  index.ts        — re-exports only

elements/floor/
  types.ts        — SceneFloor interface
  dsl.tsx         — <Floor> component
  compile.ts      — pure state extraction
  render.ts       — Three.js plane, MeshStandardMaterial, shadow receiver
  FloorWidget.ts  — IWidget, ISceneElement, IRenderable
  index.ts

elements/environment/
  types.ts        — SceneEnvironment interface, EnvironmentPreset union
  dsl.tsx         — <Environment> component
  compile.ts      — pure state extraction
  render.ts       — RGBELoader, PMREMGenerator, scene.environment assignment
  EnvironmentWidget.ts — IWidget, ISceneElement, IRenderable, ILoadable
  index.ts
```

### 8.2 ILoadable Contract

`BackgroundWidget` and `EnvironmentWidget` implement `ILoadable`. Their `load(manifest)` methods receive the full `SceneManifest` — a pre-processed list of all unique URLs referenced across all scenes. Both widgets iterate the manifest and initiate parallel `TextureLoader` / `RGBELoader` fetches, resolving their `Promise<void>` when all textures are ready. Textures are stored in an internal `Map<string, THREE.Texture>` keyed by URL.

The player layer awaits all `ILoadable.load()` promises before transitioning out of the loading state. This guarantees no texture pop during playback.

### 8.3 RectAreaLight and LightUtils

`RectAreaLight` requires `RectAreaLightUniformsLib.init()` to be called once before use. The `LightingWidget.initialize()` method calls this once. Without this call, panel lights render with incorrect falloff. This is a Three.js-specific constraint that must be documented in the `LightingWidget` source with a clear comment.

### 8.4 Background Plane Depth

The background plane is positioned at `position.z` from the DSL prop, defaulting to `z = -10`. The plane's width and height are computed from the scene's camera frustum at that depth, ensuring the plane fills the viewport regardless of aspect ratio. This computation runs in `BackgroundWidget.initialize()` and on `resize` events.

### 8.5 Tree-Shaking

All four elements are registered individually by `corePlugin()`. A consumer who excludes an element from registration does not pay its bundle cost. DSL components are zero-weight stubs (null-returning React functions) — they contribute no bundle weight at the DSL authoring layer. All Three.js and loader code is contained in `render.ts` and `{Name}Widget.ts`.

### 8.6 Three.js Version Coupling

`scene.environmentIntensity` is available from Three.js r154. The `EnvironmentWidget` implementation must check for its availability and fall back to intensity manipulation through the PMREMGenerator output for older Three.js versions. The minimum supported Three.js version is documented in the package's `peerDependencies`.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** for initial introduction of all four elements.

No existing public API is modified. These are new exports added to `@brewsite/core`. The `SceneBackground`, `SceneLighting`, `SceneFloor`, and `SceneEnvironment` types are new named exports. The DSL components (`Background`, `Lighting`, `Floor`, `Environment`) are new named exports from `compiler/index.ts`.

Future breaking change risk: `SceneLighting.points[]` index-based matching across scenes is a design choice that will be hard to change without a major version. If consumers need named point lights (add/remove by name, not index), that requires an additive API change (adding an optional `id` field to `SceneLightPoint`) rather than a replacement, preserving backward compatibility.

---

## 10. Dependencies

- **Three.js** (peer dependency): `RGBELoader`, `PMREMGenerator`, `RectAreaLight`, `RectAreaLightUniformsLib`, `MeshStandardMaterial`, `MeshBasicMaterial`. No new external dependencies.
- **@brewsite/core internal**: `IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `WidgetRegistry`, `SceneTrack`, `SceneTrackTick`, compiler node handler registry.
- **No new peer dependencies introduced** by any of the four elements.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `RectAreaLight` initialization not called before first render | Panel lights render incorrectly | Guard `RectAreaLightUniformsLib.init()` in `LightingWidget.initialize()` with a `once` flag |
| Background plane wrong size after viewport resize | Background fails to cover canvas | Subscribe to ResizeObserver in `BackgroundWidget`; recompute plane dimensions on resize |
| HDR texture loading blocks playback start | User sees black scene until HDR loads | All HDR textures must be in the `ILoadable.load()` manifest; player awaits all loadables |
| `PMREMGenerator` is expensive per-frame | Frame rate drops during environment transitions | Generate PMREMGenerator outputs once at load time; crossfade using intensity values, not re-generation |
| Point light index drift as consumer edits scenes | Lights jump to wrong positions at transition | Document the index-stability requirement explicitly; future `id`-based matching is planned as a minor additive change |
| Environment crossfade between two HDR maps | Visual glitch if both cannot be held in memory | Hold at most two environment textures simultaneously; dispose outgoing after transition completes |

---

## 12. Open Questions

- Should `SceneLightPanel` support `castShadow` in a future iteration, given that `RectAreaLight` does not natively support shadows in Three.js without custom shadow extensions?
- Should `EnvironmentPreset` ship with bundled HDR assets (embedded as base64) or require the consumer to host them? Bundled assets inflate the package size significantly. Current position: consumer-hosted assets with documented CDN URLs for the built-in presets.
- Should `SceneBackground` support video URLs (`imageUrl` pointing to `.mp4`)? Video textures require `THREE.VideoTexture` and playback management. Deferred to a future minor release.
- Should the floor support a `Reflector` (camera-based reflection) or only `MeshStandardMaterial` with an environment map reflection? Camera-based Reflector is more realistic but more expensive. Current position: environment map reflection only, matching the toolkit's performance target.

---

## 13. Launch Criteria

- All four element `compile.ts` functions have unit tests covering: state extraction from DSL props, interpolation input/output, and edge cases (missing optional fields, empty `points[]` array).
- `BackgroundWidget` and `EnvironmentWidget` have integration tests verifying that `ILoadable.load()` resolves after texture load and that the texture cache is populated.
- `LightingWidget` has a test verifying that point light arrays of differing lengths transition correctly (shorter array to longer array and vice versa).
- At least one example scene in `apps/examples/` demonstrates all four environment elements changing between scenes.
- TypeScript types for all four state interfaces are exported from `packages/core/src/index.ts`.
- `packages/core/README.md` includes a section documenting the environment elements DSL with a usage example.
- `CHANGELOG.md` entry written for the release that introduces these elements.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for all new source files.
