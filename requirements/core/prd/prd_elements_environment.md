---
title: "BrewSite Core — Environment Elements"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-17
change_history:
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: added surfaceMaterial (string — named material preset) and materialApplication (MaterialApplication) fields to FloorSurfacePhysical type and DSL props documentation. Updated module pattern listing to note these fields."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full authoring surface, compiled state types, widget contracts, and transition behavior for Background, Lighting, Floor, and Environment (HDR) elements in @brewsite/core."
  - date: 2026-03-03
    author: "Toolkit Product"
    summary: "API hardening update: replaced createDefaultWidgetRegistry() references with corePlugin() to reflect the plugin-based registration model."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "PRD audit: major update to reflect expanded element APIs. Lighting element now supports GlowPoint, LightStrand (with Wave, Circle, Rectangle shapes), and expanded Spot/Directional with shadow-related fields. Floor element expanded with FloorPhysical and FloorMirror variant DSL components, FloorVariant discriminant, FloorPlacement, grid overlay with configurable cell size/colors/opacity, negativeZ extent controls, and SceneThemeFloor integration. Environment element expanded with EnvironmentHdri, EnvironmentExr, EnvironmentCube discriminated DSL components replacing the single generic Environment component; EnvironmentSource discriminated union replaces flat url/preset fields. SceneFloor type substantially expanded. SceneLighting type expanded with glowPoints, strands, and new directional fields. Updated all API Design sections with current type signatures."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Full PRD reconciliation against source code. Background: removed position Vec3 field, made imageUrl optional, made opacity required, added color/gradient/cssFilter/overlayGradient/backdropFilter fields. Lighting: made ambient/directionals/intensityScale/color required; changed directionals to required array (no singular directional); changed glowPoints to singular glowPoint; renamed strands to lightStrands; added points array; removed all shadow fields from directional/spot; made spot target/angle/penumbra required; rewrote Panel as grid-of-point-lights (not RectAreaLight); fixed strand shape discriminant from shape to kind; made strand id/shape required singular. Floor: made enabled required; removed opacity/y/size top-level fields; added position/rotation/rotationRelative/scale/debug fields; changed surface discriminant from kind to type; rewrote FloorSurfacePhysical with full PBR material fields; rewrote FloorSurfaceMirror with mirror-prefixed fields. Environment: changed source discriminant from kind to type; changed hdri variant to hdr; made enabled/intensity required; removed backgroundBlur/backgroundIntensity; added background field to each source variant. Removed RectAreaLight references and EnvironmentPreset throughout. Updated all DSL examples, functional requirements, technical considerations, risks, and open questions."
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

- **Custom shader materials for the floor** — reflectivity is controlled through `MeshPhysicalMaterial` properties and a mirror Reflector setup, not custom GLSL.
- **Animated sky / skybox geometry** — the Background element is CSS DOM-rendered; spherical sky domes are not in scope.
- **Multiple simultaneous HDR environments per scene** — one active environment per scene tick.
- **Runtime-mutable environment state outside the compiler** — environment state is declared in DSL and baked into `SceneTrack`; no imperative environment API is exposed.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to set a background image for a scene so that my 3D canvas has a contextual environment without needing to manage Three.js geometry myself.
- As a toolkit consumer, I want background images to crossfade smoothly when transitioning between scenes so that the visual experience is cinematic rather than abrupt.
- As a toolkit consumer, I want to configure ambient, directional, point, spot, glow-point, strand, and panel lights through DSL props so that I can match lighting to my brand identity without writing Three.js code.
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
7. The `FloorWidget` shall render a shadow-receiving floor plane and shall transition between `enabled: true` and `enabled: false` states rather than toggling visibility instantly.
8. The `EnvironmentWidget` shall apply the pre-filtered environment map to `scene.environment` and shall lerp `intensity` between scenes.
9. All environment elements shall function correctly when any subset is omitted from a scene; missing elements shall not cause runtime errors in widgets that are present.
10. Panel lights (`SceneLightPanel`) shall be implemented as a grid of Three.js `PointLight` instances arranged by `rows`, `cols`, and `spacing` from an `origin` position.
11. The `Background` DSL component shall accept CSS fallback props (`cssPosition`, `cssSize`, `cssRepeat`) and CSS effect props (`cssFilter`, `overlayGradient`, `backdropFilter`) that are rendered to the host container element as inline styles.

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
export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;
  gradient?: string;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
  cssFilter?: string;
  overlayGradient?: string;
  backdropFilter?: string;
};
```

#### DSL (`elements/background/dsl.tsx`)

```tsx
export type BackgroundProps = {
  imageUrl?: string;
  opacity?: number;
  color?: string;
  gradient?: string;
  cssPosition?: React.CSSProperties['backgroundPosition'];
  cssSize?: React.CSSProperties['backgroundSize'];
  cssRepeat?: React.CSSProperties['backgroundRepeat'];
  cssFilter?: string;
  overlayGradient?: string;
  backdropFilter?: string;
  theme?: SceneTheme;
};
```

```tsx
// Minimal usage — solid color
<Background color="#0a0a14" />

// Image background with CSS fallback
<Background
  imageUrl="/images/office.jpg"
  opacity={1}
  cssPosition="center center"
  cssSize="cover"
/>

// Gradient background with overlay
<Background
  gradient="linear-gradient(180deg, #1a1a2e 0%, #0f0f23 100%)"
  overlayGradient="linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 50%)"
  backdropFilter="blur(12px)"
/>

// Theme-driven background
<Background theme={darkGlassSceneTheme} />
```

#### Compiled State Entry

The compiler emits one `SceneBackground` entry per scene frame. Between two scenes with different `imageUrl` values, the compiler emits a blend record that the widget resolves to a crossfade: old texture fades from its current `opacity` to `0`, new texture fades from `0` to the target `opacity`.

### 7.3 Lighting Element

#### State Types (`elements/lighting/types.ts`)

```typescript
export type SceneLightAmbient = {
  id?: string;
  intensity: number;
  color: string;
};

export type SceneLightDirectional = {
  id?: string;
  intensity: number;
  color: string;
  position: Vec3;
};

export type SceneLightPoint = {
  id?: string;
  intensity: number;
  color: string;
  position: Vec3;
};

export type SceneLightGlowPoint = {
  id?: string;
  intensity: number;
  color: string;
  position: Vec3;
  distance?: number;
  decay?: number;
};

export type SceneLightStrandCurve = {
  length: number;
  /** @deprecated Use length. */
  width?: number;
  yOffset: number;
  z: number;
  waveAmplitude: number;
  waveFrequency: number;
  depthAmplitude: number;
  depthFrequency: number;
  depthPhase: number;
};

export type LightStrandAxis = 'xy' | 'xz' | 'yz';

export type SceneLightStrandWave = {
  kind: 'wave';
  curve: SceneLightStrandCurve;
};

export type SceneLightStrandCircle = {
  kind: 'circle';
  radius: number;
  axis?: LightStrandAxis;
  offset?: Vec3;
};

export type SceneLightStrandRectangle = {
  kind: 'rectangle';
  width: number;
  height: number;
  axis?: LightStrandAxis;
  offset?: Vec3;
};

export type SceneLightStrandShape =
  | SceneLightStrandWave
  | SceneLightStrandCircle
  | SceneLightStrandRectangle;

export type SceneLightStrand = {
  id: string;
  count: number;
  intensity: number;
  color: string;
  position?: Vec3;
  distance?: number;
  decay?: number;
  shape: SceneLightStrandShape;
};

export type SceneLightSpot = {
  id?: string;
  intensity: number;
  color: string;
  position: Vec3;
  target: Vec3;
  angle: number;
  penumbra: number;
  distance?: number;
  decay?: number;
};

export type SceneLightPanel = {
  id: string;
  origin: Vec3;
  rows: number;
  cols: number;
  spacing: Vec3;
  intensity: number;
  distance?: number;
  decay?: number;
  color?: string;
  matrix?: number[];
};

export type SceneLighting = {
  ambient: SceneLightAmbient;
  directionals: SceneLightDirectional[];
  glowPoint?: SceneLightGlowPoint;
  lightStrands?: SceneLightStrand[];
  points?: SceneLightPoint[];
  spots?: SceneLightSpot[];
  panels?: SceneLightPanel[];
  intensityScale: number;
  color: string;
};
```

#### DSL (`elements/lighting/dsl.tsx`)

The Lighting DSL uses a compositional model: a `<Lighting>` container with individual sub-element children. All numeric and color props support `Resolvable<T>` (either a literal value or a function receiving `SceneSnapshotContext`).

```tsx
<Lighting intensityScale={1.0} color="#ffffff">
  <Ambient intensity={0.5} color="#ddeeff" />
  <Directional intensity={1.2} color="#ffffff" position={[10, 10, 10]} />
  <Point intensity={0.8} color="#ffffff" position={[2, 1, 0]} />
  <GlowPoint intensity={0.8} color="#ffd700" position={[2, 1, 0]} distance={5} decay={2} />
  <Spot
    intensity={1.0}
    color="#ffffff"
    position={[0, 4, 2]}
    target={[0, 0, 0]}
    angle={0.4}
    penumbra={0.2}
  />
  <Panel
    id="key-panel"
    origin={[-1, 3, -2]}
    rows={3}
    cols={4}
    spacing={[0.5, 0.5, 0]}
    intensity={0.6}
  />
  <LightStrand id="strand-1" count={12} intensity={0.3} color="#ffd700">
    <Circle radius={1.5} axis="xz" />
  </LightStrand>
</Lighting>
```

Key DSL component prop types:

- `<Ambient>`: `intensity` (required), `color` (required)
- `<Directional>`: `intensity` (required), `color` (required), `position` (required)
- `<Point>`: `intensity` (required), `color` (required), `position` (required)
- `<GlowPoint>`: `intensity` (required), `color` (required), `position` (required), `distance?`, `decay?`
- `<Spot>`: `intensity` (required), `color` (required), `position` (required), `target` (required), `angle` (required), `penumbra` (required), `distance?`, `decay?`
- `<Panel>`: `id` (required), `origin` (required), `rows` (required), `cols` (required), `spacing` (required), `intensity` (required), `distance?`, `decay?`, `color?`, `matrix?`
- `<LightStrand>`: `id` (required), `count` (required), `intensity` (required), `color` (required), `position?`, `distance?`, `decay?`. Accepts one shape child: `<Wave>`, `<Circle>`, or `<Rectangle>`.
- `<Wave>`: `length` (required), `yOffset` (required), `z` (required), `waveAmplitude` (required), `waveFrequency` (required), `depthAmplitude` (required), `depthFrequency` (required), `depthPhase` (required)
- `<Circle>`: `radius` (required), `axis?`, `offset?`
- `<Rectangle>`: `width` (required), `height` (required), `axis?`, `offset?`

#### Transition Behavior

All numeric fields in `SceneLighting` participate in per-frame lerp. The compiler emits a blend specification per transition block. The `LightingWidget.apply()` implementation uses the `blockProgress` value from `SceneTrackTick` to lerp each field independently.

- `ambient.intensity` and `ambient.color` lerp independently.
- `directionals[]` are matched by array index. Excess lights in the outgoing scene transition to `intensity: 0` at the target scene's array length. Missing lights in the outgoing scene enter from `intensity: 0`.
- `points[]` and `spots[]` are matched by array index with the same fade-in/fade-out behavior.
- `intensityScale` lerps as a single number.
- `color` transitions through HSL space to prevent unexpected hue shifts at midpoint.

### 7.4 Floor Element

#### State Type (`elements/floor/types.ts`)

```typescript
export type FloorVariant = 'grid' | 'mirror' | 'physical';
export type FloorPlacement = 'origin' | 'sceneBase';
export type FloorNegativeZEdge = 'hard' | 'fade';

export type SceneFloor = {
  enabled: boolean;
  debug?: boolean;
  placement?: FloorPlacement;
  position?: [number, number, number];
  rotation?: [number, number, number];
  rotationRelative?: [number, number, number];
  scale?: number;
  negativeZExtent?: number;
  negativeZEdge?: FloorNegativeZEdge;
  negativeZFadeDistance?: number;
  surface?: FloorSurface;
};

export type FloorSurfacePhysical = {
  type: 'physical';
  pattern?: 'grid';
  textureUrl?: string;
  color?: string;
  gridColor?: string;
  gridMajorColor?: string;
  gridCellSize?: number;
  gridMajorEvery?: number;
  gridLineOpacity?: number;
  gridFillOpacity?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  reflectivity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  textureRepeat?: [number, number];
  textureOffset?: [number, number];
  textureRotation?: number;
  normalMapUrl?: string;
  normalScale?: [number, number];
  roughnessMapUrl?: string;
  metalnessMapUrl?: string;
  aoMapUrl?: string;
  aoMapIntensity?: number;
  displacementMapUrl?: string;
  displacementScale?: number;
  displacementBias?: number;
  alphaMapUrl?: string;
  emissiveMapUrl?: string;
  wireframe?: boolean;
  /** Named material preset. When set, PBR textures from the manifest are applied. */
  surfaceMaterial?: string;
  /** Application controls for the material preset. */
  materialApplication?: MaterialApplication;
};

export type FloorSurfaceMirror = {
  type: 'mirror';
  mirrorColor?: string;
  mirrorOpacity?: number;
  shadowOpacity?: number;
  mirrorResolution?: number;
  mirrorClipBias?: number;
  mirrorUseEnvironmentBackground?: boolean;
  mirrorEnvironmentIntensity?: number;
};

export type FloorSurface = FloorSurfacePhysical | FloorSurfaceMirror;
```

#### DSL (`elements/floor/dsl.tsx`)

The Floor DSL uses a container `<Floor>` component with optional `<FloorPhysical>` or `<FloorMirror>` surface children:

```tsx
// Physical floor with grid overlay
<Floor enabled placement="origin" position={[0, 0, 0]}>
  <FloorPhysical
    pattern="grid"
    gridCellSize={0.1}
    gridColor="rgba(255,255,255,0.15)"
    gridMajorColor="rgba(255,255,255,0.3)"
    gridMajorEvery={5}
    roughness={0.9}
  />
</Floor>

// Mirror/reflection floor
<Floor enabled>
  <FloorMirror
    mirrorColor="#0a0a14"
    mirrorOpacity={0.6}
    shadowOpacity={0.3}
    mirrorResolution={1024}
  />
</Floor>

// Physical floor with PBR textures
<Floor enabled placement="sceneBase" scale={2}>
  <FloorPhysical
    textureUrl="/textures/concrete.jpg"
    normalMapUrl="/textures/concrete-normal.jpg"
    roughness={0.85}
    metalness={0.1}
    textureRepeat={[4, 4]}
  />
</Floor>

// Hide floor
<Floor enabled={false} />

// Theme-driven floor
<Floor theme={darkGlassSceneTheme} />

// Debug mode — red line at Z=0
<Floor enabled debug>
  <FloorPhysical pattern="grid" />
</Floor>
```

Key DSL prop types:

- `<Floor>`: `enabled?` (boolean), `debug?`, `theme?` (SceneTheme), `variant?` (FloorVariant), `placement?`, `position?`, `rotation?`, `rotationRelative?`, `scale?`, `negativeZExtent?`, `negativeZEdge?`, `negativeZFadeDistance?`, `children?`
- `<FloorPhysical>`: `pattern?`, `textureUrl?`, `color?`, `gridColor?`, `gridMajorColor?`, `gridCellSize?`, `gridMajorEvery?`, `gridLineOpacity?`, `gridFillOpacity?`, `opacity?`, `metalness?`, `roughness?`, `reflectivity?`, `clearcoat?`, `clearcoatRoughness?`, `emissive?`, `emissiveIntensity?`, `envMapIntensity?`, `textureRepeat?`, `textureOffset?`, `textureRotation?`, `normalMapUrl?`, `normalScale?`, `roughnessMapUrl?`, `metalnessMapUrl?`, `aoMapUrl?`, `aoMapIntensity?`, `displacementMapUrl?`, `displacementScale?`, `displacementBias?`, `alphaMapUrl?`, `emissiveMapUrl?`, `wireframe?`, `surfaceMaterial?` (string — named material preset), `materialApplication?` (MaterialApplication — runtime application controls)
- `<FloorMirror>`: `mirrorColor?`, `mirrorOpacity?`, `shadowOpacity?`, `mirrorResolution?`, `mirrorClipBias?`, `mirrorUseEnvironmentBackground?`, `mirrorEnvironmentIntensity?`

#### Transition Behavior

When `enabled` toggles between `true` and `false` across scenes, the compiler transitions the floor's surface opacity. The floor plane remains in the scene graph; only opacity transitions. When the surface type changes between scenes, the compiler crossfades between surface types.

### 7.5 Environment (HDR) Element

#### State Type (`elements/environment/types.ts`)

```typescript
export type SceneEnvironment = {
  enabled: boolean;
  intensity: number;
  source?: EnvironmentSource;
};

export type EnvironmentSourceHdri = {
  type: 'hdr';
  url: string;
  background?: boolean;
};

export type EnvironmentSourceExr = {
  type: 'exr';
  url: string;
  background?: boolean;
};

export type EnvironmentSourceCube = {
  type: 'cube';
  urls: [string, string, string, string, string, string];
  background?: boolean;
};

export type EnvironmentSource = EnvironmentSourceHdri | EnvironmentSourceExr | EnvironmentSourceCube;
```

#### DSL (`elements/environment/dsl.tsx`)

The Environment element uses a container `<Environment>` component with a discriminated source child:

```tsx
// HDRI source (most common)
<Environment intensity={1.2}>
  <EnvironmentHdri url="/envmaps/warehouse.hdr" />
</Environment>

// HDRI as both lighting and visible background
<Environment intensity={1.0}>
  <EnvironmentHdri url="/envmaps/warehouse.hdr" background />
</Environment>

// EXR source
<Environment intensity={0.9}>
  <EnvironmentExr url="/envmaps/studio.exr" />
</Environment>

// Cube map source
<Environment>
  <EnvironmentCube urls={['+x.jpg', '-x.jpg', '+y.jpg', '-y.jpg', '+z.jpg', '-z.jpg']} />
</Environment>

// Disabled — removes scene.environment (unlit fallback)
<Environment enabled={false} />
```

Key DSL prop types:

- `<Environment>`: `enabled?` (boolean), `intensity?` (number), `children?`
- `<EnvironmentHdri>`: `url` (required), `background?` (boolean)
- `<EnvironmentExr>`: `url` (required), `background?` (boolean)
- `<EnvironmentCube>`: `urls` (required 6-tuple), `background?` (boolean)

#### Behavior

The `EnvironmentWidget` uses `RGBELoader` for HDR, `EXRLoader` for EXR, and `CubeTextureLoader` for cube maps. Loaded textures are passed through `PMREMGenerator` to produce pre-filtered environment maps for PBR materials. The resulting `THREE.Texture` is assigned to `scene.environment`. When the `background` flag is set on a source, the texture is also assigned to `scene.background`.

When `intensity` transitions between scenes, the widget lerps `scene.environmentIntensity` (Three.js r154+). Crossfading between different environment maps is handled by blending intensity values.

---

## 8. Technical Considerations

### 8.1 Module Pattern Compliance

Each element follows the mandatory module pattern with strict layer isolation:

```
elements/background/
  types.ts        — SceneBackground interface; no Three.js, no React
  dsl.tsx         — BackgroundProps type, <Background> DSL component; no Three.js
  compile.ts      — pure state extraction; no Three.js, no React
  render.ts       — DOM-based background rendering, opacity management
  BackgroundWidget.ts — IWidget, ISceneElement, IRenderable, ILoadable
  index.ts        — re-exports only

elements/lighting/
  types.ts        — SceneLighting, SceneLightAmbient, SceneLightDirectional, SceneLightPoint,
                     SceneLightGlowPoint, SceneLightSpot, SceneLightPanel, SceneLightStrand,
                     SceneLightStrandShape (Wave/Circle/Rectangle with kind discriminant),
                     SceneLightStrandCurve, LightStrandAxis; no Three.js, no React
  dsl.tsx         — <Lighting>, <Ambient>, <Directional>, <Point>, <GlowPoint>, <Spot>,
                     <Panel>, <LightStrand>, <Wave>, <Circle>, <Rectangle> DSL components;
                     no Three.js
  compile.ts      — pure state extraction; no Three.js, no React
  render.ts       — Three.js light object management
  LightingWidget.ts — IWidget, ISceneElement, IRenderable
  index.ts        — re-exports only

elements/floor/
  types.ts        — SceneFloor, FloorSurfacePhysical (type: 'physical', includes
                     surfaceMaterial and materialApplication fields),
                     FloorSurfaceMirror (type: 'mirror'), FloorSurface, FloorVariant,
                     FloorPlacement, FloorNegativeZEdge
  dsl.tsx         — <Floor>, <FloorPhysical>, <FloorMirror> DSL components
  compile.ts      — pure state extraction
  render.ts       — Three.js plane, MeshPhysicalMaterial, Reflector, shadow receiver
  FloorWidget.ts  — IWidget, ISceneElement, IRenderable
  index.ts

elements/environment/
  types.ts        — SceneEnvironment, EnvironmentSource (EnvironmentSourceHdri type:'hdr',
                     EnvironmentSourceExr type:'exr', EnvironmentSourceCube type:'cube')
  dsl.tsx         — <Environment>, <EnvironmentHdri>, <EnvironmentExr>, <EnvironmentCube>
                     DSL components
  compile.ts      — pure state extraction
  render.ts       — RGBELoader, EXRLoader, PMREMGenerator, scene.environment assignment
  EnvironmentWidget.ts — IWidget, ISceneElement, IRenderable, ILoadable
  index.ts
```

### 8.2 ILoadable Contract

`BackgroundWidget` and `EnvironmentWidget` implement `ILoadable`. Their `load(manifest)` methods receive the full `SceneManifest` — a pre-processed list of all unique URLs referenced across all scenes. Both widgets iterate the manifest and initiate parallel `TextureLoader` / `RGBELoader` fetches, resolving their `Promise<void>` when all textures are ready. Textures are stored in an internal `Map<string, THREE.Texture>` keyed by URL.

The player layer awaits all `ILoadable.load()` promises before transitioning out of the loading state. This guarantees no texture pop during playback.

### 8.3 Panel Lights as Point Light Grids

`SceneLightPanel` is implemented as a grid of Three.js `PointLight` instances, not `RectAreaLight`. The `origin` field specifies the top-left grid position, and `rows * cols` individual point lights are created at positions computed from `origin + [row * spacing, col * spacing]`. The optional `matrix` field allows per-light intensity multipliers for non-uniform panel patterns. This approach avoids the `RectAreaLightUniformsLib` initialization requirement and provides shadow-capable panel lighting.

### 8.4 Background DOM Rendering

The Background element renders to the DOM using CSS properties, not a Three.js plane mesh. The `BackgroundWidget` manages one or two DOM elements: a primary background element (for `imageUrl`, `color`, `gradient`, and CSS fallback properties) and an optional overlay element (for `overlayGradient` and `backdropFilter`). Opacity transitions are handled via CSS opacity on the DOM elements.

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

- **Three.js** (peer dependency): `RGBELoader`, `EXRLoader`, `PMREMGenerator`, `PointLight`, `DirectionalLight`, `SpotLight`, `AmbientLight`, `MeshPhysicalMaterial`. No new external dependencies.
- **@brewsite/core internal**: `IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `WidgetRegistry`, `SceneTrack`, `SceneTrackTick`, compiler node handler registry.
- **No new peer dependencies introduced** by any of the four elements.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Panel grid creates many PointLight instances | High light count degrades GPU performance | Document recommended maximums (rows*cols); consider LOD or distance culling in render.ts |
| Background DOM element wrong size after viewport resize | Background fails to cover canvas | Subscribe to ResizeObserver in `BackgroundWidget`; recompute element dimensions on resize |
| HDR texture loading blocks playback start | User sees black scene until HDR loads | All HDR textures must be in the `ILoadable.load()` manifest; player awaits all loadables |
| `PMREMGenerator` is expensive per-frame | Frame rate drops during environment transitions | Generate PMREMGenerator outputs once at load time; crossfade using intensity values, not re-generation |
| Point light index drift as consumer edits scenes | Lights jump to wrong positions at transition | Document the index-stability requirement explicitly; future `id`-based matching is planned as a minor additive change |
| Environment crossfade between two HDR maps | Visual glitch if both cannot be held in memory | Hold at most two environment textures simultaneously; dispose outgoing after transition completes |
| Floor PBR texture maps not preloaded | Texture pop during floor surface transitions | Include floor texture URLs in `ILoadable` manifest |

---

## 12. Open Questions

- Should `SceneBackground` support video URLs (`imageUrl` pointing to `.mp4`)? Video textures require specialized DOM playback management. Deferred to a future minor release.
- Should the floor's mirror surface support blur/softness controls beyond the current `mirrorResolution` setting?
- Should `SceneLightPanel.matrix` support named presets (e.g., "checkerboard", "border") in addition to raw number arrays?

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
