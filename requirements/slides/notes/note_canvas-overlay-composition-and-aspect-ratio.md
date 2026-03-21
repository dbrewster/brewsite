---
title: "Canvas/Overlay Composition Model and Aspect Ratio Strategy"
doc_type: note
owner: Toolkit Product
status: final
updated: 2026-03-20
change_history:
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Initial draft — incorrectly framed composition as 90% HTML with 3D opt-in."
  - date: 2026-03-20
    author: Toolkit Product
    summary: "Corrected to 3D-first product direction. Multiple View regions per slide as the recommended pattern. HTML overlay for text/labels only. Added lazy loading requirement. Fixed misunderstanding of View system capabilities."
---

# Canvas/Overlay Composition Model and Aspect Ratio Strategy

This note addresses three foundational design questions for the slides expansion:
1. How should 3D content and HTML overlay coexist within slides?
2. How should slides handle varying aspect ratios across displays?
3. What needs to change in core to support per-slide lazy loading?

---

## 1. How the Current System Works

### Single Canvas, Single Camera, Multiple 3D Regions

BrewSite uses one `<SceneCanvas>` per `<SceneEngine>`. The `<View>` system positions multiple independent 3D content regions in world-space using NVS→world coordinate conversion. All 3D elements (diagrams, charts, models) coexist in the same Three.js scene, visible through a single camera.

```
┌─────────────────────────────────────────────────────────────┐
│  EngineARContainer (AR-locked box)                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  BackgroundLayer                          zIndex: 0  │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  SceneCanvas (single Three.js canvas)     zIndex: 1  │   │
│  │                                                      │   │
│  │  ┌─── View A ────┐  ┌─── View B ────┐               │   │
│  │  │  3D Diagram   │  │  3D BarChart  │               │   │
│  │  │  (NVS region) │  │  (NVS region) │               │   │
│  │  └───────────────┘  └───────────────┘               │   │
│  │                                                      │   │
│  │  ┌─── View C ──────────────────────┐                │   │
│  │  │  3D Timeline (NVS region)       │                │   │
│  │  └─────────────────────────────────┘                │   │
│  │                                                      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  EngineOverlayHost (HTML)             zIndex: 10     │   │
│  │    ├─ Slide title text                               │   │
│  │    ├─ Body text / labels                             │   │
│  │    └─ Speaker notes indicator                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**How Views work:**
- `ViewWidget` applies **delta transforms** (position, scale, opacity) to child widgets
- No scissor rendering, no viewport clipping, no per-region cameras
- All Views' 3D content exists in the same world-space, positioned via `NVSCoordService.toWorld()`
- The single camera sees all Views simultaneously
- Views can be stacked, side-by-side, or arranged via `ViewLayout` (stack/carousel)

**Proven in production:** The linked-brush chart example has 3 independent charts in 3 Views, each with different data, all rendering in the same scene.

### HTML Overlay Layer

`EngineOverlayHost` renders HTML content at `zIndex: 10` above the canvas. Overlay content is positioned absolutely within the same `EngineARContainer`. This layer handles:
- Slide titles and body text (via `TextBox` / text primitives)
- Labels and annotations
- Interactive controls (buttons, links)
- Chrome elements (footer, logo, progress indicator)

### The Composition: 3D Content + HTML Text

The recommended model for slides is:

**3D layer (canvas):** Charts, diagrams, timelines, stat displays, process visualizations, models — the "graphical elements" of the slide. These render in `<View>` regions positioned via NVS coordinates.

**HTML layer (overlay):** Titles, body text, bullet points, labels, annotations — the "text content" of the slide. These render in `TextBox` regions positioned via the layout compiler's NVS regions.

**Both layers share the same NVS coordinate space.** A `<View>` at `x=0.5, y=0.2, w=0.45, h=0.6` and a `TextBox` title at `x=0.02, y=0.02, w=0.96, h=0.16` are spatially coordinated within the same AR-locked container.

---

## 2. Product Direction: 3D-First

### Push 3D as the Primary Content Layer

BrewSite's unique advantage is native Three.js rendering. The slides expansion should lean into this — not retreat to HTML React components for graphical elements.

**3D graphical elements (rendered on canvas via View regions):**
- 3D Timelines — milestone markers with depth, glow, material
- 3D Stat displays — big numbers with PBR materials, counting animation
- 3D Process steps — sequential nodes connected by edges (reuse diagram element patterns)
- 3D Comparison matrices — 2x2 grids with depth and lighting
- 3D Progress indicators — rings/bars with material, glow, animation
- 3D Funnel/pyramid — tapering geometry with material per stage
- Charts (bar, line, pie, scatter, heatmap, area) — already in `@brewsite/charts`
- Diagrams (nodes, edges, groups) — already in `@brewsite/diagram`

**HTML elements (rendered in overlay):**
- Titles and headings
- Body text and bullet points
- Labels and annotations
- Interactive controls
- Template chrome (logo, footer, watermark)

### What This Means for the Graphics Components (Phase 1C)

The research note identified 13 graphical components (StatCard, Timeline, ProcessSteps, etc.). The product direction shifts where these live:

| Component | Was (HTML React) | Should Be | Package |
|-----------|-----------------|-----------|---------|
| StatCard / MetricRow | HTML overlay | **3D element** — big numbers with PBR materials | `@brewsite/slides` or new element module |
| Timeline | HTML overlay | **3D element** — milestones with depth, connectors | `@brewsite/slides` or new element module |
| ProcessSteps | HTML overlay | **3D element** — sequential nodes with edges | `@brewsite/diagram` patterns |
| ProgressRing / ProgressBar | HTML overlay | **3D element** — ring/bar with material + glow | `@brewsite/slides` or new element module |
| ComparisonTable | HTML overlay | **HTML overlay** — tables are inherently 2D text | `@brewsite/slides` |
| IconGrid | HTML overlay | **Could go either way** — 3D icon grid with extruded icons, or HTML | TBD |
| CalloutBox | HTML overlay | **HTML overlay** — text container | `@brewsite/slides` |
| QuoteBlock | HTML overlay | **HTML overlay** — styled text | `@brewsite/slides` |
| Badge | HTML overlay | **HTML overlay** — small text tag | `@brewsite/slides` |
| Divider | HTML overlay | **HTML overlay** — simple line | `@brewsite/slides` |

This splits the graphics library into:
- **3D elements** (new element modules following `types.ts → dsl.tsx → compile.ts → render.ts → Widget.ts` pattern)
- **HTML components** (React components for text-centric content that doesn't benefit from 3D)

### Slide Composition Example: 3D-First

```tsx
<Slide key="metrics" sceneDsl={<>
  <Camera mode="world" position={[0, 1.5, 5]} />
  <Lighting><Ambient intensity={0.8} /><Directional intensity={1.0} position={[2, 3, 5]} /></Lighting>

  {/* 3D stat cards in a row — big numbers with PBR materials */}
  <View id="stats" x={0.05} y={0.25} w={0.90} h={0.25}>
    <StatDisplay id="users" value={42000} label="Users" trend="+12%" />
    <StatDisplay id="revenue" value={1200000} label="Revenue" format="$,.0f" trend="+8%" />
    <StatDisplay id="uptime" value={99.9} label="Uptime" format=".1f%" />
  </View>

  {/* 3D bar chart below */}
  <View id="chart" x={0.05} y={0.55} w={0.55} h={0.40}>
    <BarChart id="quarterly" data={revenueData} animateEntry ... />
  </View>

  {/* 3D timeline in bottom right */}
  <View id="timeline" x={0.65} y={0.55} w={0.30} h={0.40}>
    <Timeline3D id="roadmap" items={milestones} orientation="vertical" />
  </View>
</>}>
  {/* HTML overlay: just the title */}
  <ContentSlide title="Q1 Performance" />
</Slide>
```

**The HTML overlay provides the title.** Everything else is 3D — stat numbers, bar chart, timeline — all in `<View>` regions within the single canvas.

---

## 3. Lazy Loading: The Missing Piece

### The Problem

`RuntimeDriver._loadAssets()` loads ALL `ILoadable` widgets upfront — every View, every chart, every model, every diagram across ALL scenes in the deck. For a 30-slide deck with 3D content on each slide, this means:
- Loading 30+ charts/diagrams/models before the first slide appears
- Potentially hundreds of GLTF models, textures, font files
- Long initial load time, wasted bandwidth for slides never viewed

### What's Needed

**Per-scene (per-slide) deferred loading.** Assets for slide N should load when:
1. Slide N is about to become visible (e.g., user is on slide N-1)
2. Or slide N is preloaded during idle time after the initial slides are ready

### Proposed Architecture

This is a **core engine change**, not a slides-only change. It benefits all BrewSite use cases (long scroll-driven pages, multi-scene experiences).

**Phase 0 addition: `@brewsite/core` — Scene-Level Lazy Loading**

```typescript
interface SceneLoadPolicy {
  /** Which scenes to load eagerly on engine init. Default: first scene + adjacent. */
  eager?: number[];
  /** How many scenes ahead to preload. Default: 1 */
  preloadAhead?: number;
  /** How many scenes behind to keep loaded. Default: 1. Beyond this, assets MAY be unloaded. */
  keepBehind?: number;
}
```

**How it would work:**
1. `RuntimeDriver` partitions `ILoadable` widgets by their scene membership (which scene's compilation produced them)
2. On init, only widgets belonging to eager scenes call `load()`
3. As the user navigates, the driver preloads widgets for upcoming scenes
4. Optionally, widgets for distant past scenes are unloaded (requires `ILoadable.unload()` — new interface method)

**Widget-level changes:**
- `ILoadable` gains optional `unload(): void` method for resource cleanup
- `WidgetRegistry` tracks scene-to-widget membership
- `RuntimeDriver` manages a `loadedScenes: Set<string>` and `loadingScenes: Set<string>`

**SlidePlayer integration:**
- `SlidePlayer` configures `SceneLoadPolicy` on the engine: `{ eager: [0, 1], preloadAhead: 1, keepBehind: 1 }`
- First two slides load immediately; others load as the user approaches them
- A loading indicator can show on slides whose assets are still loading

### Impact on Slide Authoring

Scene-level lazy loading is transparent to slide authors. The DSL doesn't change. The engine handles preloading internally. The only visible effect: slides further in the deck may show a brief loading state on first visit.

### Placeholder While Loading

When a slide's 3D assets haven't loaded yet, the slide should show:
- The HTML overlay content (title, text) immediately — these don't require loading
- A themed placeholder in the 3D region (e.g., themed background with subtle loading indicator)
- Once assets load, the 3D content appears (with entrance animation if configured)

This requires `SceneCanvas` / `EngineGate` to support per-scene loading states, not just a global "engine loading" gate.

---

## 4. Aspect Ratio Strategy

### Industry Standard: Fixed AR, Uniform Scaling

Every major tool uses a single fixed-AR virtual canvas per deck with uniform scaling to fit the display:

| Tool | Default AR | Mismatch Handling |
|------|-----------|-------------------|
| PowerPoint | 16:9 | Letterbox/pillarbox (OS-level) |
| Google Slides | 16:9 | Letterbox/pillarbox + uniform scale |
| Keynote | 16:9 | Letterbox/pillarbox |
| reveal.js | ~4:3 (960×700) | CSS transform scale + letterbox |
| Slidev | 16:9 (980×552) | Uniform scale + letterbox |

No tool supports per-slide AR. No tool does responsive reflow (except Gamma.app's card model). All use uniform scaling — preserving AR, never stretching, never cropping.

### The Display Landscape

| Display Type | Common AR | Prevalence |
|-------------|-----------|------------|
| Conference room TV | 16:9 | Dominant |
| Modern projector | 16:9 | Most common new install |
| Premium projector | 16:10 | Education/corporate |
| Legacy projector | 4:3 | Still exists in older rooms |
| Windows laptop | 16:9 | Most common |
| MacBook | ~16:10 | Standard since 2021 |
| iPad | 4:3 | Tablet presenting |
| Ultrawide | 21:9 | Emerging |

**16:9 is the safe universal default.** On 16:10 displays, barely-noticeable bars. On 4:3, letterboxes but fully visible. On 21:9, pillarboxes centered.

### Recommended: Expose AR on SlidePlayer

```tsx
<SlidePlayer aspectRatio={16/9} scaleMode="contain">  {/* defaults */}
```

The `EngineARContainer` already handles all the scaling math. `SlidePlayer` exposes these props and passes them through. Layout computations are AR-independent (NVS normalized coordinates).

**Supported presets:**
- `16/9` — default, industry standard
- `4/3` — legacy projector support
- `16/10` — MacBook / WUXGA native
- Custom number — any ratio

**Scale modes:**
- `contain` (default) — letterbox/pillarbox, content fully visible
- `cover` — fill display, clip overflow (kiosk/signage)
- `fit-width` — width fills, height derived (web-embedded)

**Reference width:** 1920px default. Content authored at 1080p scales proportionally to all displays via `--scene-scale` CSS variable.

---

## 5. Impact on the Change Plan

### Phase 0: New Addition — Scene-Level Lazy Loading

This is a **core engine change** that should be added to Phase 0 as a prerequisite for slide decks with heavy 3D content:

| File | Change |
|------|--------|
| `packages/core/src/runtime/types.ts` | Add `SceneLoadPolicy` type. Add optional `unload()` to `ILoadable` |
| `packages/core/src/runtime/RuntimeDriver.ts` | Scene-partitioned asset loading. Track `loadedScenes` / `loadingScenes` |
| `packages/core/src/widget/types.ts` | Add scene membership tracking to `WidgetRegistry` |
| `packages/core/src/player/SceneEngine.tsx` | Accept `loadPolicy` prop |
| `packages/core/src/player/EngineGate.tsx` | Support per-scene loading states, not just global |

### Phase 1A: SlidePlayer Props

Add `aspectRatio` and `scaleMode` props to `SlidePlayer`:

```typescript
interface SlidePlayerProps {
  /** Slide deck aspect ratio. Default: 16/9 */
  aspectRatio?: number;
  /** How the deck fits within the display. Default: 'contain' */
  scaleMode?: 'contain' | 'cover' | 'fit-width' | 'fit-height';
}
```

### Phase 1C: Graphics Component Split

The graphics component strategy splits into:
- **3D elements** (new element modules): StatDisplay, Timeline3D, ProcessSteps3D, ProgressRing3D, ProgressBar3D — these follow the standard element module pattern and render in `<View>` regions
- **HTML components** (React): ComparisonTable, CalloutBox, QuoteBlock, Badge, Divider — these render in the overlay for text-centric content
- **Both consumed via slide DSL** — the slide author doesn't care whether a component is 3D or HTML; the layout compiler places them in the correct NVS regions

### Phase 3: Claude-Author Docs

The `3d-content.md` doc becomes the most important file. It should cover:
- `## Multiple View Regions in a Single Slide` — the primary pattern
- `## Mixing 3D Views with HTML Overlay Text` — how title/body text overlays above 3D content
- `## Aligning View Regions with Layout Regions` — NVS coordinate alignment between sceneDsl Views and layout compiler regions
- `## When to Use 3D Elements vs HTML Components` — decision guide: 3D for data visualization, metrics, diagrams, timelines; HTML for tables, text blocks, quotes
- `## Slide Aspect Ratio and Display Sizing` — AR props, scale modes, reference width

---

## Summary

| Question | Answer |
|----------|--------|
| Composition model? | **3D-first.** Charts, diagrams, timelines, stat displays are 3D elements in `<View>` regions. HTML overlay for titles, text, labels only. Single canvas, single camera, multiple NVS-positioned 3D regions. |
| Same region or separate? | **Same AR container, different z-layers.** 3D content in `<View>` regions on the canvas (zIndex 1). HTML text in overlay (zIndex 10). NVS coordinates shared across both layers. |
| Multiple canvases? | **One canvas, multiple `<View>` regions.** Views position child 3D elements in world-space via NVS→world conversion. No scissor rendering — all content visible through one camera. |
| Lazy loading? | **New core capability needed.** Per-scene asset loading with preload-ahead and keep-behind policies. First slides load eagerly; later slides load on approach. |
| Aspect ratio? | **16:9 default, configurable per-deck.** `contain` scale mode with letterbox/pillarbox. Exposed as props on `SlidePlayer`. Industry-standard model. |
| Industry alignment? | **AR handling fully aligned** with PowerPoint/Google Slides/reveal.js. **3D-first composition is our differentiator** — no competitor has this. |
