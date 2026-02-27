---
title: "Diagram Theming & Visual Refresh"
doc_type: plan
owner: brewflow-architect
status: draft
updated: 2026-02-26
---

# Diagram Theming & Visual Refresh Plan

## 1. The Problem — Why They Look Clunky

After reading the full rendering stack, here's the honest diagnosis:

### 1a. Material defaults are industrial-matte, not polished
```
metalness: 0.15   ← barely metallic
roughness: 0.65   ← strongly matte / diffuse
```
This combination produces flat, chalky-looking surfaces. There's no catch-light, no specularity, no sheen. PBR materials only look *good* when there is either (a) a point light with tight falloff, or (b) **an environment map** providing high-frequency lighting information. The current setup has neither — only ambient + directional lights, which produce gradient shading, not reflections.

**Fix:** Raise metalness to 0.35–0.45, lower roughness to 0.25–0.40 for default nodes, AND add an envMap to the scene.

### 1b. No environment map = no reflections, ever
`MeshStandardMaterial` uses `scene.environment` for image-based lighting (IBL). Without it, even `metalness=1, roughness=0` produces nothing interesting — just a dark mirror. The scene never sets `scene.environment`, so every surface is purely relying on the two simple lights.

**Fix:** Pass a generated procedural envMap (or a bundled HDR) via the theme. The DiagramRenderer should apply it to the Three.js scene.

### 1c. Depth of 0.6 diagram units makes nodes look like blocks
At the default camera angle (~25° elevation, ~100 units back), a 4×2×0.6 node reads as a thick chunky block rather than a sleek card. Nodes look like old-school UI "buttons" rather than architectural diagram chips.

**Fix:** Reduce default depth to 0.28 (cards), while offering a "thick" preset via theme. Keep the API — just change the default.

### 1d. BoxGeometry with sharp edges = clunky silhouette
Sharp 90° edges are the single biggest contributor to the "clunky" feel. A `RoundedBoxGeometry` with a 2–4px radius at typical viewing distance transforms the silhouette from "raw CAD box" to "polished device component."

Three.js doesn't ship one, but it's ~60 lines of geometry code using `Shape` + `ExtrudeGeometry`. The fix is: implement `createRoundedBoxGeometry()` in `geometryFactory.ts`, and make it the default behind a theme flag (`cornerRadius: 0.06`, where 0 = BoxGeometry).

### 1e. No emissive on nodes = dead in 3D space
The current front face material has zero emissive. Nodes look like painted cardboard under the scene lights. A subtle `emissive: color × 0.12` on the front face (the "screen" face) gives the appearance of a faintly lit panel — the thing that makes tech diagrams feel alive vs. inert.

**Fix:** Add `emissiveIntensity` and `emissiveFactor` to node theme defaults. Front face gets `emissive: node.color`, intensity 0.12.

### 1f. Arrowheads are MeshBasicMaterial flat triangles
Arrowheads use `MeshBasicMaterial` (no lighting) as flat 2D triangles. This means they look like stickers pasted on top of 3D objects — visually inconsistent with the PBR tube geometry they're attached to.

**Fix:** Optionally use `MeshStandardMaterial` matching the edge's metalness/roughness, or thin 3D cone geometry instead of a flat triangle.

### 1g. Edge defaults are muddy
`color: '#555e7a'` — very desaturated blue-grey. `thickness: 0.08` — visible but reads as generic.

**Fix:** `color: '#3d5a9a'` (brighter electric blue), `thickness: 0.065` (slightly finer), with metalness 0.5 / roughness 0.3 for a "wire" appearance.

### 1h. Font is whatever troika loads by default
troika-three-text uses a built-in Roboto SDF as its default. It's fine but has no character. The theme system should allow specifying a `fontUrl` (MSDF font) so per-theme fonts are possible.

---

## 2. Proposed Architecture — DiagramTheme

### 2a. Where it lives
```
packages/diagram/src/elements/diagram/
├── types.ts         ← add DiagramTheme, EdgeRoutingAlgorithm, EdgeLandingAlgorithm
├── themes/
│   ├── index.ts     ← re-export all presets
│   ├── darkGlass.ts
│   ├── neonCyber.ts
│   ├── enterprise.ts
│   └── lightMinimal.ts
├── compile.ts       ← accept theme, apply in resolveDefaults()
├── render.ts        ← accept themeConfig from state, apply envMap
└── dsl.tsx          ← add `theme?` prop to <Diagram> and <DiagramCanvas>
```

### 2b. DiagramTheme type
```typescript
// packages/diagram/src/elements/diagram/types.ts — new additions

export type EdgeRoutingAlgorithm =
  | 'curved'       // current: CatmullRom through face-exit stubs
  | 'orthogonal'   // Manhattan 90° routing (like draw.io)
  | 'straight'     // Direct line between face attachment points
  | 'organic';     // More waypoints, slight curve variation per edge

export type EdgeLandingAlgorithm =
  | 'nearest-face'    // current: pick face by dominant delta direction
  | 'shortest-path'   // enumerate all 6×6 face pairs, pick min distance
  | 'center'          // connect center-to-center (for straight routing)
  | 'port';           // author-specified port on DiagramEdgeDSL

export interface DiagramThemeNodeConfig {
  /** Default fill color for nodes that don't specify one */
  defaultColor: string;
  /** PBR metalness [0–1]. ~0.35 = polished plastic, ~0.7 = brushed metal */
  defaultMetalness: number;
  /** PBR roughness [0–1]. ~0.25 = glossy, ~0.65 = matte */
  defaultRoughness: number;
  /** Emissive intensity on the front face [0–1], tinted to node color */
  defaultEmissiveIntensity: number;
  /** Physical depth of nodes in diagram units. 0.28 = card, 0.6 = block */
  defaultDepth: number;
  /** Corner radius in diagram units. 0 = sharp BoxGeometry, >0 = rounded */
  cornerRadius: number;
  /** Glow sprite intensity behind each node [0–1]. 0 = disabled */
  glowIntensity: number;
  /** Default label text color */
  defaultLabelColor: string;
  /** Default sublabel text color */
  defaultSublabelColor: string;
  /** troika-three-text fontUrl override (MSDF .ttf/.woff or URL) */
  fontUrl?: string;
  /** Label font size multiplier relative to node height */
  labelSizeFactor: number;
  /** Sublabel font size multiplier relative to node height */
  sublabelSizeFactor: number;
  /** Default icon style when not specified per-node */
  defaultIconStyle: SvgIcon3DStyle;
}

export interface DiagramThemeEdgeConfig {
  /** Default edge color */
  defaultColor: string;
  /** Default tube radius in diagram units */
  defaultThickness: number;
  /** PBR metalness for edge tubes */
  defaultMetalness: number;
  /** PBR roughness for edge tubes */
  defaultRoughness: number;
  /** Routing algorithm applied to all edges in the diagram */
  routing: EdgeRoutingAlgorithm;
  /** Attachment point selection for edge endpoints */
  landing: EdgeLandingAlgorithm;
  /** CatmullRom segment multiplier (higher = smoother but more geometry) */
  smoothness: number;
  /** Use 3D cone arrowheads instead of flat 2D triangles */
  use3DArrows: boolean;
}

export interface DiagramThemeGroupConfig {
  /** Default group background fill color */
  defaultColor: string;
  /** Default group border color */
  defaultBorderColor: string;
  /** Default fill opacity [0–1] */
  defaultFillOpacity: number;
  /** Default border opacity [0–1] */
  defaultBorderOpacity: number;
}

export interface DiagramThemeEnvironmentConfig {
  /**
   * URL of an equirectangular HDR or EXR for image-based lighting.
   * If null, a simple procedural sky gradient is used.
   * If 'none', no environment map is applied.
   */
  envMapUrl: string | null | 'none';
  /** IBL intensity [0–2]. Default 0.8 */
  envMapIntensity: number;
  /** Tint color for the procedural sky (when envMapUrl is null) */
  skyColor?: string;
  /** Horizon color for the procedural sky */
  horizonColor?: string;
}

/**
 * Defines the complete visual and behavioral contract for a diagram.
 * Applied at compile time (defaults) and render time (envMap, glow).
 * Per-node / per-edge overrides still take precedence.
 */
export interface DiagramTheme {
  node: DiagramThemeNodeConfig;
  edge: DiagramThemeEdgeConfig;
  group: DiagramThemeGroupConfig;
  environment: DiagramThemeEnvironmentConfig;
  /** Sequential accent color palette for auto-coloring (rotation). Length ≥ 1 */
  palette?: readonly string[];
}
```

### 2c. How the theme flows through the system

```
DSL authoring
  <Diagram theme={darkGlassTheme}>          ← author passes theme
    <DiagramNode color="#ff0000" />          ← per-node still overrides
  </Diagram>
        |
        ↓
compile.ts::compileDiagram(dsl, theme)
  - mergeThemeDefaults(theme, dsl.node)     ← pure function, no Three.js
  - routeEdges(nodes, edges, theme.edge.routing, theme.edge.landing)
  - compileNode() uses theme values as fallback when DSL doesn't specify
  - DiagramState gets a new `themeConfig` field (render-time properties only)
        |
        ↓
types.ts::DiagramState
  themeConfig: DiagramThemeRenderConfig     ← new field
    envMapUrl: string | null | 'none'
    envMapIntensity: number
    nodeGlowIntensity: number
    use3DArrows: boolean
    edgeSmoothness: number
        |
        ↓
render.ts::DiagramRenderer
  - Reads themeConfig on first update
  - Sets scene.environment from envMapUrl (cached per URL)
  - Creates glow sprites for all nodes at nodeGlowIntensity > 0
```

**Key constraint maintained:** The theme resolves to concrete values at compile time. `types.ts` stays runtime-free. `render.ts` only receives the already-resolved `DiagramThemeRenderConfig` struct — it never imports from `themes/`.

---

## 3. Edge Routing Algorithms

All routing happens in `compile.ts::routeEdges()`. The routing algorithm is chosen per-diagram via `theme.edge.routing`. Individual edges can override via `<DiagramEdge routing="orthogonal" />` (per-edge `routing` field on DSL + state).

### 3a. `curved` (current, improved)
CatmullRom curve through 4 control points. Existing behavior. Only change: `smoothness` multiplier on segment count.

```
[srcFaceCenter → srcFaceCenter + srcNormal×stub → dstFaceCenter + dstNormal×stub → dstFaceCenter]
CatmullRomCurve3 → TubeGeometry(segments = max(20, pts * 8 * smoothness))
```

### 3b. `orthogonal` (new)
Manhattan routing — all segments are axis-aligned (X or Y only). Produces the draw.io / Mermaid look. Works as follows:

```
1. Determine source and destination face attachment points (uses landing algorithm).
2. Compute the midpoint between the two stub exit points.
3. If source exits horizontally (left/right face):
   - Horizontal stub → vertical segment at midX → horizontal entry → dest
   - Results in Z-shape or L-shape path
4. If source exits vertically (top/bottom face):
   - Vertical stub → horizontal segment at midY → vertical entry → dest
5. Waypoints are snapped to horizontal/vertical only.
6. CatmullRom over these waypoints with tight tension=0.0 (linear segments).
   OR use LineCurve3 for perfectly hard 90° bends (no spline).
```

Segment count = number of waypoints × 4 (less geometry than curved).

**Collision avoidance for orthogonal**: Simple midpoint shifting — if the mid-segment would pass through another node's bounding box (grown by 0.5 units), shift it to clear the obstruction. O(n×e) pass after initial routing.

### 3c. `straight` (new)
Direct line between face attachment points. Two control points only.

```
[srcFaceCenter → dstFaceCenter]
```
Uses `landing: 'center'` or `landing: 'nearest-face'` depending on configuration.
TubeGeometry with 8 segments (barely curved line vs. perfectly straight — TubeGeometry always curves slightly with very short segments). Could use `THREE.Line` instead of tube for pure straight lines — but that requires a different render path. Use the tube with very high segment count or use `LineCurve3`.

### 3d. `organic` (new)
Like `curved` but with:
- A slight perpendicular offset injected at the midpoint (seeded deterministically by edge ID hash)
- Extra guide point count (6 instead of 4) for more "wiggly" path
- Tension slightly randomized per-edge (0.4–0.6 range, seeded by ID)

Good for "flow" diagrams where strict geometry would feel sterile.

---

## 4. Landing / Attachment Point Algorithms

"Landing" = which point on the source/destination node does the edge attach to?

### 4a. `nearest-face` (current)
The current algorithm:
```
deltaX = dst.x - src.x
deltaY = dst.y - src.y
if (|deltaY| > |deltaX|) → use top/bottom face
else if (|deltaX| > |deltaZ|) → use left/right face
else → use front/back face
```
Fast and usually correct for orthogonal-ish layouts. Breaks on diagonals.

### 4b. `shortest-path` (new)
Enumerate all 6 source faces × 6 destination faces = 36 combinations. Pick the pair with minimum 3D distance between face centers. More robust than `nearest-face` for diagonal connections.

Cost: O(36) per edge — negligible at compile time.

### 4c. `center` (new)
Attach to node center `[x, y, z]`. No face normal exit stub. Pairs naturally with `routing: 'straight'` for simple arrow diagrams. The edge simply draws a line from center to center.

### 4d. `port` (new)
Add `fromPort` / `toPort` props to `<DiagramEdge>`:
```typescript
type DiagramEdgePort = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
```
DSL:
```tsx
<DiagramEdge from="a" to="b" fromPort="right" toPort="left" />
```
compile.ts resolves the port to the corresponding face center + normal. Port overrides the landing algorithm for that specific connection. This is the most important one for authors who want precise control over dense diagrams.

---

## 5. Pre-built Themes

### Theme 1: `darkGlassTheme` (new default)
The replacement default. Deep navy + polish.
```typescript
{
  node: {
    defaultColor: '#1a2240',
    defaultMetalness: 0.40,
    defaultRoughness: 0.30,
    defaultEmissiveIntensity: 0.10,
    defaultDepth: 0.28,
    cornerRadius: 0.06,
    glowIntensity: 0.25,
    defaultLabelColor: '#e8eeff',
    defaultSublabelColor: '#8ba4d4',
    defaultIconStyle: 'layered',
    labelSizeFactor: 1.0,
    sublabelSizeFactor: 1.0,
  },
  edge: {
    defaultColor: '#3d5a9a',
    defaultThickness: 0.065,
    defaultMetalness: 0.50,
    defaultRoughness: 0.30,
    routing: 'curved',
    landing: 'nearest-face',
    smoothness: 1.2,
    use3DArrows: false,
  },
  group: {
    defaultColor: '#0d1126',
    defaultBorderColor: '#2a4080',
    defaultFillOpacity: 0.10,
    defaultBorderOpacity: 0.65,
  },
  environment: {
    envMapUrl: null,  // use procedural sky
    envMapIntensity: 0.9,
    skyColor: '#1a2a6c',
    horizonColor: '#b21f1f',
  },
  palette: ['#2a4fa0', '#1e7a5a', '#8a2a70', '#a06a20', '#2a8090'],
}
```

### Theme 2: `neonCyberTheme`
Dark backgrounds, saturated neon accents, high emissive.
```typescript
{
  node: {
    defaultColor: '#0a0e1a',
    defaultMetalness: 0.55,
    defaultRoughness: 0.20,
    defaultEmissiveIntensity: 0.22,
    defaultDepth: 0.22,
    cornerRadius: 0.04,
    glowIntensity: 0.55,
    defaultLabelColor: '#00ffcc',
    defaultSublabelColor: '#80ffe6',
    defaultIconStyle: 'extruded',
    labelSizeFactor: 1.0,
    sublabelSizeFactor: 1.0,
  },
  edge: {
    defaultColor: '#00ccff',
    defaultThickness: 0.055,
    defaultMetalness: 0.70,
    defaultRoughness: 0.15,
    routing: 'orthogonal',
    landing: 'nearest-face',
    smoothness: 1.0,
    use3DArrows: true,
  },
  group: {
    defaultColor: '#050810',
    defaultBorderColor: '#00ccff',
    defaultFillOpacity: 0.07,
    defaultBorderOpacity: 0.80,
  },
  environment: {
    envMapUrl: null,
    envMapIntensity: 0.6,
    skyColor: '#001020',
    horizonColor: '#002040',
  },
  palette: ['#00ffcc', '#00ccff', '#cc00ff', '#ff6600', '#00ff66'],
}
```

### Theme 3: `enterpriseTheme`
Professional, clean, moderate polish. Suitable for slide decks.
```typescript
{
  node: {
    defaultColor: '#1e3a6e',
    defaultMetalness: 0.25,
    defaultRoughness: 0.45,
    defaultEmissiveIntensity: 0.06,
    defaultDepth: 0.32,
    cornerRadius: 0.05,
    glowIntensity: 0.0,
    defaultLabelColor: '#ffffff',
    defaultSublabelColor: '#a8c0e0',
    defaultIconStyle: 'flat',
    labelSizeFactor: 1.0,
    sublabelSizeFactor: 1.0,
  },
  edge: {
    defaultColor: '#4a7abf',
    defaultThickness: 0.070,
    defaultMetalness: 0.30,
    defaultRoughness: 0.50,
    routing: 'curved',
    landing: 'nearest-face',
    smoothness: 1.0,
    use3DArrows: false,
  },
  group: {
    defaultColor: '#0f1e3a',
    defaultBorderColor: '#2a5090',
    defaultFillOpacity: 0.09,
    defaultBorderOpacity: 0.55,
  },
  environment: {
    envMapUrl: null,
    envMapIntensity: 0.75,
    skyColor: '#0a1530',
    horizonColor: '#1e3060',
  },
}
```

### Theme 4: `lightMinimalTheme`
White/light backgrounds, high contrast, clean lines. Good for documentation.
```typescript
{
  node: {
    defaultColor: '#f0f4fc',
    defaultMetalness: 0.10,
    defaultRoughness: 0.55,
    defaultEmissiveIntensity: 0.0,
    defaultDepth: 0.20,
    cornerRadius: 0.08,
    glowIntensity: 0.0,
    defaultLabelColor: '#1a2240',
    defaultSublabelColor: '#4a5a80',
    defaultIconStyle: 'flat',
    labelSizeFactor: 1.0,
    sublabelSizeFactor: 1.0,
  },
  edge: {
    defaultColor: '#3060b0',
    defaultThickness: 0.060,
    defaultMetalness: 0.10,
    defaultRoughness: 0.60,
    routing: 'orthogonal',
    landing: 'nearest-face',
    smoothness: 1.0,
    use3DArrows: false,
  },
  group: {
    defaultColor: '#e0e8f8',
    defaultBorderColor: '#8090c0',
    defaultFillOpacity: 0.35,
    defaultBorderOpacity: 0.60,
  },
  environment: {
    envMapUrl: 'none',
    envMapIntensity: 0,
  },
}
```

---

## 6. Implementation Plan

### Phase 1 — Visual defaults only (no API change)
**Goal:** Make the current diagrams look significantly better without touching DSL API.

Changes:
1. `compile.ts` — Update `NODE_DEFAULTS`:
   - `depth: 0.6 → 0.28`
   - `metalness: 0.15 → 0.35`
   - `roughness: 0.65 → 0.35`
   - `color: '#2a2d3e' → '#1a2240'`
   - Add `emissiveIntensity: 0.10` to compiled node state
2. `compile.ts` — Update `EDGE_DEFAULTS`:
   - `color: '#555e7a' → '#3d5a9a'`
   - `thickness: 0.08 → 0.065`
3. `types.ts` — Add `emissiveIntensity: number` to `DiagramNodeState`
4. `render.ts` — Apply `emissive: nodeColor, emissiveIntensity: state.emissiveIntensity` on front face material
5. `render.ts` — Generate procedural environment map on scene init (simple `PMREMGenerator` from color gradient `THREE.Color`), apply to `scene.environment`
6. `render.ts` — Implement `createRoundedBoxGeometry(w, h, d, radius)` using `Shape` + `ExtrudeGeometry` as the geometry for nodes with `cornerRadius > 0`

**Result:** Immediate visual upgrade with zero breaking changes.

### Phase 2 — DiagramTheme type + compile plumbing
**Goal:** Theme flows from DSL → compile → state with zero render.ts changes.

Files to change:
- `types.ts`: Add `DiagramTheme`, `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEnvironmentConfig`, `DiagramThemeRenderConfig`, `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`
- `types.ts`: Add `themeConfig: DiagramThemeRenderConfig` to `DiagramState`
- `compile.ts`: Accept optional `theme?: DiagramTheme` in `compileDiagram()`
- `compile.ts`: `mergeThemeDefaults(theme, dsl)` — pure function, replaces hardcoded defaults with theme values
- `dsl.tsx`: Add `theme?: DiagramTheme` prop to `<Diagram>` and `<DiagramCanvas>`
- `themes/index.ts` + individual theme files: Implement the 4 preset themes

### Phase 3 — Routing algorithms
**Goal:** Multiple routing strategies in `compile.ts::routeEdges()`.

Files to change:
- `compile.ts`: Refactor `routeEdges()` into a strategy dispatch:
  ```typescript
  function routeEdges(nodes, edges, routing, landing): DiagramEdgeState[]
  ```
- `compile.ts`: Implement `routeOrthogonal()` — Manhattan routing with midpoint
- `compile.ts`: Implement `routeStraight()` — two-point direct
- `compile.ts`: Implement `routeOrganic()` — curved with deterministic variation
- `compile.ts`: Implement `resolveLandingPoint(node, face)` for port-based
- `types.ts`: Add `fromPort?: DiagramEdgePort` / `toPort?: DiagramEdgePort` to `DiagramEdgeDSL`
- `types.ts`: Add `routing?: EdgeRoutingAlgorithm` per-edge override to `DiagramEdgeDSL`
- `dsl.tsx`: Expose `fromPort`, `toPort`, `routing` on `<DiagramEdge>`

### Phase 4 — Environment map + glow + render.ts theme integration
**Goal:** render.ts reads `themeConfig` from state, applies IBL and glow.

Files to change:
- `render.ts`: Read `state.themeConfig` in `update()`
- `render.ts`: `applyEnvironmentMap(scene, themeConfig)` — create PMREMGenerator from procedural gradient or load from URL (cached)
- `render.ts`: `createNodeGlow(node, intensity)` — reuse `glowSprite.ts` pattern
- `render.ts`: Cache env maps by URL key, dispose on theme change

### Phase 5 — 3D arrowheads (optional, lower priority)
- `render.ts`: When `themeConfig.use3DArrows === true`, replace flat triangle with `ConeGeometry` positioned at curve endpoint, oriented along tangent
- Cone: radius = thickness × 2.5, height = thickness × 6, radialSegments = 8
- MeshStandardMaterial matching edge metalness/roughness

---

## 7. DiagramState Changes (Required Types Delta)

```typescript
// Additions to DiagramNodeState
emissiveIntensity: number;  // [0-1], front face emissive glow factor
cornerRadius: number;        // diagram units, 0 = BoxGeometry, >0 = rounded

// Additions to DiagramEdgeState
routing?: EdgeRoutingAlgorithm;  // per-edge override (optional)

// New field on DiagramEdgeDSL
fromPort?: DiagramEdgePort;
toPort?: DiagramEdgePort;
routing?: EdgeRoutingAlgorithm;

// New field on DiagramState
themeConfig: DiagramThemeRenderConfig;

// New type
interface DiagramThemeRenderConfig {
  envMapUrl: string | null | 'none';
  envMapIntensity: number;
  nodeGlowIntensity: number;
  use3DArrows: boolean;
  edgeSmoothness: number;
  skyColor: string;
  horizonColor: string;
}
```

---

## 8. Dependency Direction Validation

All changes respect the hard dependency rules:

| Layer | New imports | Allowed? |
|-------|-------------|----------|
| `types.ts` | none | ✅ |
| `themes/*.ts` | `types.ts` only | ✅ |
| `compile.ts` | `types.ts`, `themes/*.ts` (for type guards only) | ✅ |
| `render.ts` | `types.ts` (for `DiagramThemeRenderConfig`) | ✅ |
| `dsl.tsx` | `types.ts`, `themes/*.ts` | ✅ |

`render.ts` never imports from `compile.ts` or `themes/*.ts` — it only reads the compiled `DiagramThemeRenderConfig` struct that compile.ts already resolved.

---

## 9. Testing Strategy

All new routing algorithms are pure functions — test via interface-based stateful tests with no mocks:

```typescript
// __tests__/compile.routing.test.ts
describe('routeEdges - orthogonal', () => {
  it('produces only axis-aligned segments', () => {
    const nodes = [mockNode('a', [0,0,0], [4,2]), mockNode('b', [10,0,0], [4,2])];
    const edges = [{ from: 'a', to: 'b', id: 'e1' }];
    const result = routeEdges(nodes, edges, 'orthogonal', 'nearest-face');
    const pts = result[0].controlPoints;
    // Every consecutive segment must be purely horizontal or purely vertical
    pts.forEach((p, i) => {
      if (i === 0) return;
      const dx = Math.abs(p[0] - pts[i-1][0]);
      const dy = Math.abs(p[1] - pts[i-1][1]);
      expect(dx === 0 || dy === 0).toBe(true);
    });
  });
});
```

```typescript
// __tests__/compile.theme.test.ts
describe('mergeThemeDefaults', () => {
  it('applies theme node defaults when DSL omits color', () => {
    const state = compileDiagram(dslWithNoColors, neonCyberTheme);
    expect(state.nodes[0].color).toBe('#0a0e1a');
  });
  it('author per-node color still wins over theme', () => {
    const state = compileDiagram(dslWithRedNode, neonCyberTheme);
    expect(state.nodes[0].color).toBe('#ff0000');
  });
});
```

Test files: `packages/diagram/src/elements/diagram/__tests__/compile.routing.test.ts`, `compile.theme.test.ts`.

---

## 10. What I'd Prioritize First

If I were picking the single highest-ROI change: **Phase 1, item 5** — procedural environment map in `render.ts`.

A two-line `PMREMGenerator` from a `THREE.Color` sky gradient will transform the look immediately. Every PBR surface suddenly catches specular highlights. This costs zero API surface and zero schema changes.

Second: `cornerRadius` in geometry + lower depth. Node silhouette is what the eye reads first.

Third: Emissive on front face. Makes the architecture "come alive" — nodes look like active panels, not painted bricks.

The theme system is the right long-term architecture but it can follow after the defaults are already looking good.

---

## 11. Resolved Design Decisions

1. **Routing default per-diagram**: `'curved'` is universal default. Themes can override to `'orthogonal'` (e.g., neonCyberTheme). ✅

2. **Rounded corners on non-rect shapes**: `cornerRadius` only applies to `flow:rect` (the default BoxGeometry path). Cylinders, hexagons, ovals — geometry is inherently smooth, cornerRadius is ignored for those. ✅

3. **Environment map**: Generate a real procedural HDR via `scripts/gen-diagram-envmap.mjs` using Radiance RGBE format, stored at `packages/diagram/public/assets/envmaps/diagram-default.hdr`. Three.js `RGBELoader` loads it. Theme can override with a custom URL or `'none'` to disable. `package.json` gets a `gen-envmap` script. ✅

4. **Canvas-level theme propagates to child diagrams**: Pure data merge at compile time — canvas theme is the fallback, child `<Diagram theme={...}>` overrides per-diagram. No React context, no runtime theme resolution. `handlers.ts` passes canvas theme into `compileDiagram()` calls. ✅

5. **Pipe routing**: Pipes travel in the **Z plane** (orthogonal to the diagram faces). Default attachment is **left or right face** of each node, determined by which side the destination diagram is relative to the source (canvas-local X position). This routes around icons and labels (which live on the front Z+ face). Pipe exit uses the diagram's local X-axis normal (±1, 0, 0 in diagram space, rotated into canvas space by the diagram's rotation). A stub exits perpendicularly before curving through 3D space. Canvas theme adds `pipeRouting: 'curved' | 'straight'` and `pipeLanding: 'sides' | 'nearest-face'`. ✅