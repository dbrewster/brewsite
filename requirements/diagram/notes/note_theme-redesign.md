---
title: "Theme Redesign — Unified Cross-Package Theming"
doc_type: note
owner: pm-1
status: complete
updated: 2026-03-11
---

# Theme Redesign — Unified Cross-Package Theming

## Prerequisites (Ships Before This Work)

**Group label rendering bug:** `GroupRenderer.ts:245` hardcodes `'#ffffff'` for group title labels and does not read `DiagramGroupState.labelColor`. All four `DiagramTheme` presets already have a `group.defaultLabelColor` field set correctly (`lightMinimalTheme` uses `'#1a2240'`), but the renderer ignores it. This is a standalone 5-line rendering fix, entirely independent of palette redesign. It ships in its own PR before this work begins. Bundling it into a palette redesign PR would conflate two unrelated concerns and introduce revert risk.

The fix scope: delete the hardcoded color constant from `GroupRenderer.ts:245`; read `DiagramGroupState.labelColor` instead. Ensure `compileGroup()` propagates `theme.group.defaultLabelColor` into `DiagramGroupState.labelColor`. No palette files change.

---

## 1. Problem Statement

BrewSite's theming surface is split across four separate systems with no unifying entry point. A scene author using diagrams, charts, and overlay text must manage three independent theme objects — `DiagramTheme`, `ChartTheme`, and `SceneTheme` — each with different authoring ergonomics, different type shapes, and different entry points. The visual output of the four "matching" presets (`darkGlass`, `neonCyber`, `enterprise`, `lightMinimal`) does not look coherent across packages, because each package chose its own palette independently.

Specific, verified problems:

**1. No single authoring entry point.** To use the "dark glass" aesthetic across a scene, a developer must:
- Import and pass the full `darkGlassTheme` object to `<Diagram theme={darkGlassTheme}>` (or `<DiagramCanvas>`)
- Pass the string `theme="darkGlass"` to each chart element — a different API (string vs. object)
- Separately construct a `SceneTheme` or use `darkSceneTheme` on `EngineProvider` for CSS variables
- Manually set background color, overlay font styles, and `SceneLighting` values to match

None of these inform each other. There is no mechanism to say "use darkGlass for this scene family" in one place.

**2. The dark themes have incoherent palette choices.** Reading the source reveals:
- `darkGlassTheme` (diagram): Edge `#702dc6` (violet-purple), flow `#53ec68` (neon green), and group default color `#ad8176` (terra-cotta/dusty rose) share no color story. The navy nodes and purple edges are a reasonable pairing, but neon-green flow creates an unresolved two-accent tension, and terra-cotta group borders are disconnected from the rest of the palette.
- `darkGlassChartTheme`: Series palette leads with cyan (`#00d4ff`) and indigo (`#6c63ff`) — unrelated to the diagram version's purple+green story. A scene using both packages would look inconsistent.
- `enterpriseChartTheme`: Its series palette is the Tailwind CSS default palette verbatim (`#3b82f6` = Tailwind blue-500, followed by the Tailwind 8-color set in order). This is not a design decision; it is an accident of implementation.
- `neonCyberTheme` (diagram): The concept is coherent but execution is generic — it reads as "any neon cyberpunk library." The neon set has no color hierarchy; all eight chart series run at `emissiveIntensity: 0.9`, producing an undifferentiated wash.

**3. No usable premium light theme.** `lightMinimal` exists in both packages as a flat, matte, documentation-grade style — this is an intentional design choice and appropriate for that use case. But there is no premium light theme that makes a diagram or chart look polished on a light background (e.g., a product marketing page or an investor deck). `lightMinimal` is the only option and it was not designed to be the premium option.

**4. Diagram and chart APIs for theme selection diverge.** Charts accept a string name directly on the DSL element (`theme="darkGlass"`), resolved against `CHART_THEMES` at compile time. Diagram requires importing the full `DiagramTheme` object. There is no `DIAGRAM_THEMES` constant. This creates an ergonomic asymmetry for authors working across both packages.

**5. Same theme name, different color vocabulary.** `darkGlass`, `neonCyber`, `enterprise`, and `lightMinimal` exist in both `@brewsite/diagram` and `@brewsite/charts`. The palette choices were made independently. A consumer using "the same theme" across both packages gets two unrelated color sets.

---

## 2. Current State Inventory

### `@brewsite/core` — SceneTheme

**Type:** `SceneTheme` in `packages/core/src/theme/types.ts`

**Fields:**
- `colorMode: 'dark' | 'light'` — background polarity
- `font: { htmlFamily: string; webglFontUrl?: string }` — HTML and WebGL font tokens
- `fontSize: { heading, body, label, caption, annotation }` — semantic scale multipliers
- `background?: { fill?, effects? }` — DOM background fill and CSS effects
- `accentColor?: string` — documented as "drives diagram node palette defaults and chart series[0]" but not consumed by any package

**Presets:** `darkSceneTheme`, `lightSceneTheme` — minimal, system-font defaults

**Injection path:** `EngineProvider.sceneTheme` → `ThemeContext` → `EngineOverlayHost` injects CSS custom properties (`--brewsite-font-family`, `--brewsite-text-primary`, etc.)

**Limitation:** SceneTheme is purely additive and opt-in. It does NOT auto-configure `DiagramTheme` or `ChartTheme`. The `webglFontUrl` only reaches diagram/chart if the consumer manually attaches `sceneTheme` to `DiagramTheme.sceneTheme` or `ChartTheme.sceneTheme`. The `colorMode` has no effect on diagram label colors when using built-in presets (all four presets have explicit `defaultLabelColor` values that override the colorMode fallback).

---

### `@brewsite/diagram` — DiagramTheme

**Type:** `DiagramTheme` in `packages/diagram/src/elements/diagram/types.ts`

**Structure:**
```
DiagramTheme
  node: DiagramThemeNodeConfig        (20+ fields: color, PBR params, glow, label colors, font sizes...)
  edge: DiagramThemeEdgeConfig        (20+ fields: color, thickness, routing, flow params...)
  group: DiagramThemeGroupConfig      (12 fields: border color/width/opacity/PBR, label color...)
  environment: DiagramThemeEnvironmentConfig (envMapUrl, envMapIntensity, skyColor, horizonColor)
  layout?: DiagramThemeLayoutConfig   (grid, hierarchical, manual, flow spacing defaults)
  fontUrl?: string                    (diagram-wide troika font URL)
  input?: DiagramCanvasInputConfig    (default canvas input actions)
  sceneTheme?: SceneTheme             (optional cross-package integration)
  palette?: readonly string[]         (node color cycling)
```

**Presets:** `darkGlassTheme`, `neonCyberTheme`, `enterpriseTheme`, `lightMinimalTheme` — each in its own file under `packages/diagram/src/elements/diagram/themes/`

**Usage in DSL:**
```tsx
import { darkGlassTheme } from '@brewsite/diagram';
<Diagram theme={darkGlassTheme}>...</Diagram>
```
Full theme object required. No string name API. No `DIAGRAM_THEMES` keyed constant.

**Utilities:** `mergeTheme(base, overrides)` for deep-partial override; `withColorMode(base, colorMode)` for colorMode-derived label colors (note: currently only applies to `node` sub-config, does not update `group.defaultLabelColor`)

**Compilation:** `buildThemeRenderConfig(theme)` in `themeResolver.ts` flattens `DiagramTheme` into `DiagramThemeRenderConfig` at compile time. Renderers read only `DiagramThemeRenderConfig`.

---

### `@brewsite/charts` — ChartTheme

**Type:** `ChartTheme` in `packages/charts/src/themes/types.ts`

**`ChartThemeName`:** `'darkGlass' | 'neonCyber' | 'enterprise' | 'lightMinimal'`

**`CHART_THEMES`:** A keyed constant `{ darkGlass, neonCyber, enterprise, lightMinimal }` — enables runtime/compile-time selection by string key

**Presets:** `darkGlassChartTheme`, `neonCyberChartTheme`, `enterpriseChartTheme`, `lightMinimalChartTheme` — each in its own file

**Usage in DSL:**
```tsx
<BarChart theme="darkGlass" ... />          // string name — resolves via CHART_THEMES
<BarChart theme={darkGlassChartTheme} ... /> // full object
<BarChart theme={createChartTheme('darkGlass', { ... })} ... /> // factory override
```

**Factory:** `createChartTheme(base, overrides)` — merges overrides on top of a named or object base

---

### `@brewsite/model` — Labels

No dedicated theme type. `LabelItem` renders as HTML; font-family is inherited from DOM ancestors. When `EngineOverlayHost` injects `--brewsite-font-family` via `SceneTheme`, labels inside the overlay host's subtree inherit it automatically.

---

### How Theme Names Align Today

| Theme Name | Diagram Preset | Chart Preset | `SceneTheme` Preset |
|---|---|---|---|
| `darkGlass` | `darkGlassTheme` | `darkGlassChartTheme` | None (use `darkSceneTheme`) |
| `neonCyber` | `neonCyberTheme` | `neonCyberChartTheme` | None |
| `enterprise` | `enterpriseTheme` | `enterpriseChartTheme` | None |
| `lightMinimal` | `lightMinimalTheme` | `lightMinimalChartTheme` | None (use `lightSceneTheme`) |

Names match across packages; palettes were designed independently.

---

## 3. Proposed Solution

### 3.1 Canonical Theme Name Set

Establish six theme names that work across all packages. Four names are preserved; two are added:

| Name | Concept | Background Polarity | Status |
|---|---|---|---|
| `darkGlass` | Refined — deep navy, metallic, IBL, coherent blue-violet story | dark | existing (redesigned) |
| `midnight` | New — near-black, amber+gold accents, warm dark theme | dark | new |
| `neonCyber` | Tightened — electric violet + laser cyan, high emissive | dark | existing (redesigned) |
| `enterprise` | Polished — professional slate-blue, muted but distinguished | dark | existing (refined) |
| `lightCanvas` | Premium light — white ceramic nodes, jewel-tone series | light | new |
| `lightMinimal` | Fixed — flat/matte light, group label rendering bug resolved | light | existing (minor fix) |

`lightCanvas` is not a replacement for `lightMinimal`. Both ship. `lightCanvas` is the premium light option; `lightMinimal` is the documentation-grade flat option.

### 3.2 Theme Name Type and Registries

**`DiagramThemeName`** lives in `@brewsite/diagram`; **`ChartThemeName`** lives in `@brewsite/charts`. Both unions contain the same six names as a coordinated product decision, not a code coupling. Each package independently defines its registry constant (`DIAGRAM_THEMES`, `CHART_THEMES`).

**No `BrewSiteThemeName` type in `@brewsite/core`.** Core encodes architectural contracts, not product content. Theme names are product content — they change with the product roadmap, not with the engine architecture. Locking the name list in core would require a core version bump every time a new theme is added, even if nothing in the core engine changed. Since `DiagramThemeName` and `ChartThemeName` happen to contain the same values, divergence (one package adding a theme the other doesn't have yet) is valid, not a bug.

### 3.3 String Name API for `<Diagram>`

The diagram `theme` prop accepts `DiagramThemeName | DiagramTheme`. The compiler resolves string names via `DIAGRAM_THEMES` at compile time, identical to the chart pattern. Existing code that passes a full `DiagramTheme` object continues to compile identically — this is a union widening, a **non-breaking minor version addition**.

```tsx
// New — string name:
<Diagram theme="darkGlass">...</Diagram>

// Existing — still valid:
import { darkGlassTheme } from '@brewsite/diagram';
<Diagram theme={darkGlassTheme}>...</Diagram>

// Custom themes still use full object:
<Diagram theme={myCustomTheme}>...</Diagram>
```

TypeScript discriminates the union cleanly: string literals satisfy `DiagramThemeName`; objects with the required sub-configs satisfy `DiagramTheme`. No ambiguity.

### 3.4 Cross-Package Palette Coherence

Each theme name maps to a shared 8-color accent palette. The diagram's `palette` array and the chart's `series[0..7].color` values draw from the same 8 hex values in the same order.

This coordination is by design discipline, not code coupling — each package's theme file contains an explicit comment block listing the 8 shared values and cross-referencing the paired package's file. Divergence becomes detectable by code review. See Section 6 (Constraints) for the required comment format.

### 3.5 SceneTheme Presets Extended

Core exports one `SceneTheme` preset per theme name: `darkGlassSceneTheme`, `midnightSceneTheme`, `neonCyberSceneTheme`, `enterpriseSceneTheme`, `lightCanvasSceneTheme`, `lightMinimalSceneTheme`. Each captures background color, color mode, and font size scale appropriate to that theme family. Not required for consumers to use — the existing `darkSceneTheme`/`lightSceneTheme` remain and are unchanged.

### 3.6 `withColorMode()` Extended to Group Labels

`withColorMode(base, colorMode)` currently only applies `node.defaultLabelColor` and `node.defaultSublabelColor`. It must also apply `group.defaultLabelColor`:
- `'dark'` → `group.defaultLabelColor: '#e8eeff'`
- `'light'` → `group.defaultLabelColor: '#1a1a2e'`

This is a non-breaking improvement to an existing utility function.

---

## 4. Key Design Decisions

### 4.1 Theme Name Type Ownership

`DiagramThemeName` lives in `@brewsite/diagram`. `ChartThemeName` lives in `@brewsite/charts`. Both unions contain the same six names as a coordinated product decision. Per-package independence allows valid divergence (one package shipping a theme before the other). No shared union in core.

### 4.2 String API for `<Diagram>` is a Non-Breaking Minor Addition

Changing `theme?: DiagramTheme` to `theme?: DiagramThemeName | DiagramTheme` is a union widening. Existing code that passes a `DiagramTheme` object continues to work identically. This is a **minor version addition**, not a breaking change. The concern here is not TypeScript compatibility — it is spec clarity that the compiler must resolve string names at compile time via `DIAGRAM_THEMES`.

### 4.3 Palette Coherence Mechanism

Cross-package palette alignment is enforced through code review via comment blocks in each theme file (see Section 6), not through shared code or a central registry. The coordinator is the PM and the code review process, not the type system.

### 4.4 Additive Theme Names

All four existing names are preserved with aesthetic improvements. Two new names are added. Consumers using existing preset names continue to work — they receive palette improvements but no API migration. New names are available immediately. Visual changes to existing presets are **not** API breaking changes (presets are not contractually pixel-stable).

---

## 5. Open Questions

**5.1 Migration story for existing palette consumers.**
The darkGlass, neonCyber, and enterprise aesthetic changes are visually breaking — a consumer who tuned their scene to the current `darkGlassTheme` colors will see different output after upgrade. Options: (a) ship as minor version with changelog documentation of visual differences; (b) ship new palettes under new names only and freeze existing names. Decision: ship as minor version (option a). Preset palette values are product content, not API contracts, per section 5.2. Visual changes are documented in the CHANGELOG. No theme name migration is required.

**5.2 Which palette changes trigger semver discussion?**
Adding `midnight` and `lightCanvas` is clearly a minor version addition. Changing existing preset colors is a judgment call. Document in the PRD whether preset palette values are covered by semver stability guarantees. Recommended: no — preset aesthetics are product content, not API contracts.

**5.3 `DiagramTheme.background` field.**
Out of scope. Adding `DiagramTheme.background` to drive the scene's DOM background is a separate feature tracked in the cross-package theming PRD (deferred in that document). It does not ship simultaneously with this palette redesign.

---

## 6. Constraints

1. **Dependency rule is hard.** `@brewsite/core` must never import from diagram, charts, or model. Any shared type in core must carry no product content (no theme name lists, no palette values).

2. **`DiagramTheme` has required fields with major-version implications.** Adding new required fields to any sub-config breaks every non-spread custom theme. The redesign adds only optional fields (layout defaults) and changes values in existing required fields. No new required fields on this work.

3. **The shared HDR (`/assets/envmaps/diagram-default.hdr`) is used by three existing diagram presets.** `midnight` and `lightCanvas` must each decide: use the shared HDR, commission a different HDR, or disable IBL (`envMapUrl: 'none'`). `lightCanvas` should use `'none'` (IBL creates distracting reflections on white surfaces). `midnight` should initially use the shared HDR at reduced intensity to be unblocked, with a follow-on task to commission a warm-cast HDR if needed.

4. **Chart series `emissiveIntensity` must be stepped, not uniform.** Uniform emissive across 8 series (as in the current `neonCyber` chart theme: all at 0.9) produces an undifferentiated wash. All redesigned dark themes should use stepped emissive intensity: `[0.90, 0.85, 0.82, 0.78, 0.74, 0.70, 0.66, 0.62]` or similar. Flat/light themes use `0.0` throughout.

5. **Chart series `depth` values are a design variable.** Depth controls the Z-extrusion of bar/area geometries. Glass themes look best with medium depth (0.28–0.32); neon themes with thin depth (0.20–0.25) to reduce the metallic bulk; flat/light themes with minimal depth (0.15–0.20).

6. **`fontUrl` lives at `DiagramTheme` root, not on `node`.** The 2026-03-08 changes moved `fontUrl` from `DiagramThemeNodeConfig` to `DiagramTheme` root. New presets must not include `fontUrl` on the `node` sub-config.

7. **Cross-package palette comment block format.** Every diagram theme file and its paired chart theme file must contain the following comment block:
   ```ts
   // SHARED ACCENT PALETTE — must match packages/[counterpart-package]/src/themes/[themeName].ts
   // Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
   // '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx', '#xxxxxx'
   ```
   This makes palette divergence visible to code reviewers. The hex values in the comment must match the actual values in the file.

8. **`SceneTheme.accentColor` is removed.** The field is defined in `packages/core/src/theme/types.ts` as "drives diagram node palette defaults and chart series[0]" but no package reads it. Implementing partial behavior (series[0] only) would be confusing and provide minimal value over the existing `palette` override in `DiagramTheme` and `createChartTheme()`. It is deleted with a deprecation notice in the CHANGELOG. The architect adds it to the implementation as a required change to `SceneTheme` in core.

---

## 7. Aesthetic Vision

Section 7 is the authoritative color spec for all six themes. All hex values are final. Sections 3 and 4 describe concepts and rationale only — Section 7 governs implementation.

### `darkGlass` (refined)

**Mood:** Polished intelligence. A deep-sea intelligence interface. The kind of diagram you'd see in a high-budget product demo.

**Color family:** Navy-blue spectrum. All colors share the cool-blue base. No warm accents.

**Surface treatment:** Nodes have visible metalness (0.65–0.75) and moderate roughness (0.25–0.35). Ceramic-coated metal feel. IBL environment contributes specular highlights. Nodes read as physical objects.

**Color values:**

| Role | Hex | Notes |
|---|---|---|
| Scene background | `#070b18` | Very deep navy, nearly black |
| Node default color | `#111a35` | Dark navy blue, distinct from background |
| Node box color | `#1e2d52` | Slightly elevated navy |
| Edge color | `#5040b0` | Deep indigo-violet — same cool family as nodes |
| Flow animation | `#00c8f0` | Electric cyan — energy/motion only, not static geometry |
| Group default color | `#151c38` | Dark navy-slate, nearly invisible but present |
| Group border | `#2e3d6e` | Slightly elevated navy |
| Node label | `#dce8ff` | Cool off-white |
| Node sublabel | `#8898cc` | Mid-value cool blue |
| Sky color | `#0a1530` | Deep navy for procedural sky fallback |
| Horizon color | `#182648` | Slightly lighter navy |

**Shared accent palette (diagram `palette` + chart `series[0..7].color`):**
`'#4455aa'`, `'#2266bb'`, `'#7744cc'`, `'#1188aa'`, `'#335588'`, `'#3dbccc'`, `'#9966ff'`, `'#44aadd'`

Blue hue family, stepped in lightness and saturation — no warm accents, no disconnected colors.

**Chart series material (darkGlass):**
All 8 series: `metalness: 0.2`, `roughness: 0.18`, `transmission: 0.28`, `depth: 0.30`
Emissive stepped: `[0.40, 0.36, 0.32, 0.28, 0.26, 0.24, 0.22, 0.20]`

**What makes it distinctive:** Monochromatic cool spectrum. Cyan flow is the only visual departure and only appears as motion. Result is calm and focused.

---

### `midnight` (new)

**Mood:** Warm authority. Late-night data review. Amber dashboard glow.

**Color family:** Near-black background with amber-gold as the single accent. All geometry leans warm.

**Surface treatment:** Low metalness (0.28–0.38), medium-high roughness (0.40–0.52). Matte-metal feel — brushed bronze in dim light. Less specular highlight than darkGlass.

**Color values:**

| Role | Hex | Notes |
|---|---|---|
| Scene background | `#0d0a07` | Near-black with slight warm-brown cast |
| Node default color | `#18140a` | Very dark warm charcoal |
| Node box color | `#252010` | Slightly elevated warm charcoal |
| Edge color | `#c8851a` | Warm amber — dominant accent |
| Flow animation | `#f0b030` | Bright gold — payoff/motion |
| Group default color | `#120f08` | Very dark warm gray |
| Group border | `#2a2010` | Warm charcoal border |
| Node label | `#f0e8d8` | Warm off-white |
| Node sublabel | `#b0986a` | Warm mid-tone |
| Sky color | `#1a1208` | Dark warm brown |
| Horizon color | `#2a2010` | Slightly elevated warm brown |

**Shared accent palette (diagram `palette` + chart `series[0..7].color`):**
`'#d08c20'`, `'#c24840'`, `'#d4ac30'`, `'#2e8870'`, `'#c05578'`, `'#8a6028'`, `'#6a8430'`, `'#b84530'`

Warm-family: amber, coral, gold, teal, rose, bronze, olive, red. All desaturated-warm.

**Chart series material (midnight):**
All 8 series: `metalness: 0.08`, `roughness: 0.48`, `transmission: 0.0`, `depth: 0.22`
Emissive stepped: `[0.28, 0.24, 0.22, 0.20, 0.18, 0.16, 0.14, 0.12]`

**What makes it distinctive:** The only warm dark theme in the toolkit. Appropriate for financial, business intelligence, or "serious" data visualization that doesn't need to look like a sci-fi interface.

---

### `neonCyber` (tightened)

**Mood:** Pure digital energy. Not a cyberpunk movie set — a live system monitor at peak load.

**Color family:** Electric violet as primary structural accent. Laser cyan as energy/motion accent. Everything else near-black or very dark.

**Surface treatment:** High metalness (0.60–0.70), low roughness (0.10–0.18). High emissive. Nodes glow.

**Color values:**

| Role | Hex | Notes |
|---|---|---|
| Scene background | `#030610` | Near-black with blue cast |
| Node default color | `#060b1a` | Dark charcoal-blue |
| Node box color | `#0e1530` | Slightly elevated charcoal-blue |
| Edge color | `#7b2dff` | Electric violet — primary structural color |
| Flow animation | `#00eeff` | Laser cyan — directional energy |
| Group default color | `#050810` | Near-black, slight blue |
| Group border | `#7b2dff` | Electric violet — matches edge |
| Node label | `#b090ff` | Soft violet — readable, thematic |
| Node sublabel | `#8068cc` | Dimmer violet |
| Sky color | `#010310` | Almost black with blue |
| Horizon color | `#06102a` | Very dark blue |

**Shared accent palette (diagram `palette` + chart `series[0..7].color`):**
`'#7b2dff'`, `'#00eeff'`, `'#b855ff'`, `'#00ccdd'`, `'#5020cc'`, `'#44ddee'`, `'#9944ff'`, `'#00aacc'`

Electric violet and laser cyan, alternating and stepping — two-color story with clear hierarchy.

**Chart series material (neonCyber):**
All 8 series: `metalness: 0.12`, `roughness: 0.08`, `transmission: 0.0`, `depth: 0.22`
Emissive stepped: `[0.90, 0.85, 0.82, 0.78, 0.74, 0.70, 0.66, 0.62]` (highest in toolkit — this is the neon theme)

**What makes it distinctive:** Commits to two accent colors (violet and cyan) with semantic roles: violet = structure, cyan = motion. Prior version scattered accents without hierarchy.

---

### `enterprise` (polished)

**Mood:** Professional credibility. Board-ready. Not flashy, but unimpeachably polished.

**Color family:** Slate-blue as the primary structural color. Muted, desaturated accents.

**Surface treatment:** Low metalness (0.12–0.22), medium roughness (0.48–0.58). Matte professional feel. No glow.

**Color values:**

| Role | Hex | Notes |
|---|---|---|
| Scene background | `#0a1525` | Very dark slate-navy — richer than current |
| Node default color | `#182844` | Deep slate-blue — richer than current `#1e3a6e` |
| Node box color | `#243d60` | Elevated slate |
| Edge color | `#3a6aaa` | Muted steel-blue |
| Flow animation | none (disabled by default) | No flow animation in enterprise theme |
| Group default color | `#0f1e38` | Dark slate |
| Group border | `#243d60` | Matched to node box |
| Node label | `#e8f0ff` | Clean white with slight cool tint |
| Node sublabel | `#8898c0` | Mid-value cool blue |
| Sky color | `#0a1828` | Dark slate for procedural sky |
| Horizon color | `#182840` | Slightly lighter slate |

**Shared accent palette (diagram `palette` + chart `series[0..7].color`):**
`'#3a5fa0'`, `'#38766a'`, `'#c87830'`, `'#5a4e7a'`, `'#2e7280'`, `'#7a5c38'`, `'#456040'`, `'#7a3840'`

Curated professional palette — steel blue, slate teal, warm amber, muted purple, deep teal, bronze, forest green, dark wine. Intentionally not the Tailwind palette.

**Chart series material (enterprise):**
All 8 series: `metalness: 0.04`, `roughness: 0.62`, `transmission: 0.0`, `depth: 0.26`
Emissive: `0.04` uniform — near-zero, consistent with the no-flash aesthetic

**What makes it distinctive:** No effects, no emissive, no flow. This theme says the data matters, not the presentation.

---

### `lightCanvas` (new)

**Mood:** Product documentation meets premium SaaS. Clean, spatial, confident.

**Color family:** White nodes on warm-neutral gray background. Slate-blue structure.

**Surface treatment:** Very low metalness (0.03–0.06), medium-high roughness (0.52–0.66). Ceramic or matte plastic feel — substantial but non-reflective. No IBL (`envMapUrl: 'none'`).

**Color values:**

| Role | Hex | Notes |
|---|---|---|
| Scene background | `#f0f2f4` | Warm neutral gray — not pure white |
| Node default color | `#ffffff` | Pure white |
| Node box color | `#f0f4fa` | Very slightly blue-tinted white |
| Edge color | `#3a5fa8` | Medium slate-blue — has visual weight and authority |
| Flow animation | `#1a5fd8` | Vivid cobalt — strong directional signal |
| Group default color | `#e8edf6` | Pale blue-gray — subtle fill |
| Group border | `#b8c5dc` | Light slate border |
| Node label | `#18202c` | Near-black with blue cast |
| Node sublabel | `#4a5a80` | Mid-value blue-gray |
| Sky color | `#ffffff` | White sky for procedural sky fallback |
| Horizon color | `#e0e8f8` | Very light blue-gray |
| Corner radius | `0.09` | More generous radius — softer, more premium |

**Shared accent palette (diagram `palette` + chart `series[0..7].color`):**
`'#3355cc'`, `'#1a9966'`, `'#cc3355'`, `'#cc8800'`, `'#6644bb'`, `'#0088aa'`, `'#996622'`, `'#448822'`

Jewel tones — deep blue, forest green, berry, amber, deep violet, teal, bronze, olive. Saturated enough to read in 3D at near-zero metalness; not neon.

**Chart series material (lightCanvas):**
All 8 series: `metalness: 0.02`, `roughness: 0.72`, `transmission: 0.0`, `depth: 0.18`
Emissive: `0.0` uniform — zero emissive; light background renders pure matte geometry

**What makes it distinctive:** Where `lightMinimal` is intentionally flat and documentary, `lightCanvas` has physical depth and visual richness. Jewel-tone series work on white backgrounds in a way pastels and neons do not.

---

### `lightMinimal` (minor fix, not redesigned)

**Mood:** Technical documentation. Diagrams embedded in documentation sites, white-background slides, GitHub READMEs.

**Color family:** White nodes, light blue-gray accents. Flat. Matte. Documentation-grade.

**Surface treatment:** Near-zero metalness, high roughness. Intentionally flat — this is the correct design choice for this use case.

**Palette:** The current `lightMinimalChartTheme` series palette (pastel light blue, lavender, mint, pink, yellow, cyan, chartreuse, peach) is the most carefully assembled palette in the codebase. It is preserved unchanged.

**What changes:**
- The group label rendering fix (see Prerequisites section) makes group labels visible — the fix reads `DiagramGroupState.labelColor` which already carries `'#1a2240'` from the `lightMinimalTheme` group config
- `withColorMode()` extension adds correct `group.defaultLabelColor` coverage
- Series depth reduced from 0.20 to 0.16 to minimize the 3D effect on an intentionally flat theme
- Palette comment block added for cross-package coordination documentation

**Shared accent palette (for comment block coordination only — chart series unchanged):**
Same as current `lightMinimalChartTheme.series` colors: `'#93c5fd'`, `'#c4b5fd'`, `'#86efac'`, `'#fca5a5'`, `'#fde68a'`, `'#67e8f9'`, `'#d9f99d'`, `'#fed7aa'`

---

## 8. Existing Requirements Context

The cross-package theming PRD (`requirements/core/prd/prd_theming.md`) and cross-package theming note (`requirements/core/notes/note_cross-package-theming.md`) document the `SceneTheme` system as implemented. This note addresses what those documents deferred: the aesthetic quality of the themes, palette coherence across packages, and the authoring ergonomics gap (string name API for diagram).

The diagram sizing/theming architecture audit (`requirements/diagram/notes/note_diagram-sizing-theming-architecture.md`) identified the group label rendering bug (item 2), the dead `sceneTheme.accentColor` contract (item 15), and the `withColorMode()` gap on group labels (section 3.6). All three are addressed here.

The diagram theming PRD (`requirements/diagram/prd/prd_theming.md`) explicitly deferred `DiagramTheme.background` and the `DiagramThemeName` string API. The string API is now in scope. `DiagramTheme.background` remains deferred.
