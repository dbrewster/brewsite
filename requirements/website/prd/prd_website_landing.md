---
title: "BrewSite Marketing Website — Landing Page"
doc_type: prd
status: approved
owner: Toolkit Product
last_updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: "Toolkit PM"
    summary: "Initial PRD created. Full scroll-driven landing page showcasing all toolkit capabilities across 8 acts. Makerspace/steampunk/nerd-cool aesthetic anchored by a neon sign hero. Approved for implementation."
---

# BrewSite Marketing Website — Landing Page

## Overview

The BrewSite marketing website (`apps/website`) is a long-scroll, single-page showcase for `@brewsite/core` and `@brewsite/diagram`. It is the product's primary public-facing presence for technical evaluators — developers and product managers who are deciding whether to adopt the toolkit. The site lives at the root of the `@brewsite/website` app in the monorepo.

The page is itself a proof of concept: it demonstrates the toolkit's capabilities by using the toolkit to power its own animated sections. Every major feature — HUD overlays, declarative transitions, 3D models, animated crowds, immersive diagrams, and multi-layer compositions — appears in an authored scene, narrated by HUD content. The site argues for the toolkit by showing it working.

The aesthetic is **steampunk makerspace meets high-tech**: industrial dark metal frames, riveted bezels, neon signs, warm amber + electric blue industrial lighting, and the satisfaction of a machine coming to life.

Target audience: TypeScript developers and PMs evaluating the toolkit for websites, slide decks, presentations, and marketing pages.

---

## Problem Statement

`@brewsite/core` and `@brewsite/diagram` have no public-facing marketing presence. Engineers discovering the toolkit through GitHub have no demonstration of capability beyond reading source code and example pages that lack narrative context. The gap between "I found this repo" and "I understand what this does and want to use it" is too large.

The packages need a website that:
1. Immediately establishes the aesthetic power of the toolkit through the hero experience
2. Progressively demonstrates every major capability in context
3. Speaks to the technical evaluator (developer + PM) without condescension
4. Makes the toolkit feel ready, polished, and worth the learning investment

---

## Goals & Success Metrics

**Primary Goals:**
- A visitor who lands on the page should understand what the toolkit does within 30 seconds (the hero section)
- A visitor who scrolls the full page should be able to enumerate all major toolkit capabilities
- The site should function as a live demo — every 3D section is a real ScenePlayer rendering real scenes
- The TypeScript DSL code shown in sections should be real, copy-pasteable, and accurate

**Success Metrics:**
- Time-to-understand: Qualitative assessment — can a developer unfamiliar with the toolkit describe its core capability after seeing the hero?
- Demo fidelity: All 5 ScenePlayer sections render correctly with no console errors on Chrome + Safari
- Mobile graceful degradation: On screens < 768px, layout stacks vertically, ScenePlayers render at correct aspect ratio
- Performance: First Contentful Paint < 2s; Hero section renders before any ScenePlayer assets load

**Guardrail Metrics:**
- No changes to `@brewsite/core` or `@brewsite/diagram` package APIs
- `apps/website` must remain a private app — not published to npm
- No changes that would affect the `apps/examples` app

---

## Non-Goals

- Dark/light mode toggle — the site is dark only; this is a design decision, not a gap
- Internationalization — English only
- CMS-driven content — all content is authored directly in React components
- A docs site — this is marketing, not reference documentation
- Interactive editor or playground — future scope
- Server-side rendering — this is a Vite SPA, not a Next.js/SSR app
- Performance optimization for slow networks beyond basic lazy loading — target audience is on fast connections

---

## Consumer Stories

*In this context, "consumer" = a visitor to the website.*

1. As a developer evaluating new tools, I want to understand what BrewSite does in under 30 seconds so that I can decide whether to read further.
2. As a developer who builds marketing pages, I want to see code examples alongside live 3D output so that I can evaluate how much I'd need to learn.
3. As a PM evaluating tools for a design team, I want to see real output quality (diagrams, animations, scenes) so that I can gauge production-readiness.
4. As a developer unfamiliar with Three.js, I want to see that the DSL abstracts away the renderer so that I feel confident I can adopt it without graphics programming expertise.
5. As a developer ready to try the toolkit, I want a clear install command and GitHub link so that I can get started immediately.

---

## Functional Requirements

1. The site shall render in a single scroll on a desktop viewport (≥ 1024px wide).
2. The hero section shall fill 100vh and display a cursive neon "BrewSite" sign in a Three.js metal room. The sign shall animate from off to fully lit on page load.
3. A non-discrete hamburger menu shall be fixed to the top-right corner of the viewport at all times. Activating it shall reveal a slide-out navigation panel with anchor links to each section.
4. A scroll indicator shall appear at the bottom of the hero section and animate to prompt the user to scroll down. It shall fade out once the user begins scrolling.
5. Following the hero, eight content acts shall appear in sequence, each with its own visual identity and content narrative.
6. Acts 1 through 7 shall each contain at least one live `ScenePlayer` rendering real toolkit scenes with the full runtime pipeline (compiler → track → runtime → Three.js).
7. Each ScenePlayer section shall be scroll-driven: scrolling through the section advances the scene, as in the examples app.
8. Act 8 (GitHub CTA) shall be a CSS-only section with an install command, terminal aesthetic, and a GitHub link.
9. All code snippets shown on the page shall be real, valid DSL code that matches the scene being demonstrated.
10. On mobile (< 768px), each act shall stack vertically: scene above, narrative text below (or scene only if text is embedded in HUD).
11. The page shall load without errors on Chrome 120+ and Safari 17+.
12. Public assets (model GLBs, animation GLBs) shall be served from `/public/assets/` matching the same paths as `apps/examples`.

---

## Visual Design: The Aesthetic

### Hero Section

The hero establishes the makerspace identity. It is a full-viewport dark room rendered in Three.js, with a physical metal-framed sign at the center. The room has:

**Three.js Background Scene:**
- Dark metallic back wall: `MeshPhysicalMaterial`, `metalness: 0.85`, `roughness: 0.25`, color `#0f1018`
- Reflective floor: `MeshPhysicalMaterial`, `metalness: 0.95`, `roughness: 0.06`, dark charcoal
- Warm point light: amber `#ff8800`, intensity 3, positioned upper-left
- Cool point light: electric blue `#0055ff`, intensity 2, positioned upper-right
- Dim ambient: near-black blue `#0a0f1a`
- Camera: very slow drift (sine-wave position offset, ~0.3 units amplitude, ~15s period)
- Renderer: ACES filmic tone mapping, exposure 0.9
- Post-effect approximation: Three.js `UnrealBloomPass` if available, otherwise use high emissive values

**Sign Bezel (CSS overlay):**
- Centered div, ~80% viewport width, ~35% viewport height
- Multi-layer border creating physical depth illusion:
  - Outer: 1px solid `rgba(255,255,255,0.05)` with outer box-shadow
  - Inner: 4px inset dark shadow
  - Fill: subtle diagonal gradient (lighter top-left, darker bottom-right)
- Four L-bracket corner accents using CSS `::before`/`::after` — metallic gradient, 40px arm length
- Rivet dots: 8px circles along top and bottom edges, 8 per edge, radial gradient (highlight at 35% 35%)
- Side channel strips (top and bottom bar): 12px high, full width, metallic gradient

**Neon Sign (SVG + CSS):**
- Font: Google Fonts "Dancing Script" weight 700, loaded via `<link>` in `index.html`
- SVG `<text>` element with:
  - `fontFamily: 'Dancing Script, cursive'`
  - `fontSize: 88` (SVG units, viewBox 700x130)
  - `textAnchor: middle`, centered
  - `stroke: #00f5ff`, `strokeWidth: 2`
  - `fill: #00f5ff`
  - CSS `filter: drop-shadow(0 0 6px #00f5ff) drop-shadow(0 0 18px rgba(0,245,255,0.8))`
- Second SVG layer (blurred glow): same text, `strokeWidth: 8`, opacity 0.4, `filter: blur(4px)`
- Animation: `neon-power-on` keyframes trigger 0.8s after page load, ~2.5s duration
  - Flicker pattern: off → brief flash → off → sustained dim → flicker → full brightness
  - After power-on: continuous `neon-pulse` animation (subtle brightness oscillation, 4s period)
- Color: primary cyan `#00f5ff` — neon cold-cathode look. The "B" and "S" capitals glow slightly more intensely (achieved by separate SVG elements with slightly higher opacity).

**Hero Footer:**
- Tagline below sign: `"Author in JSX. Ship to any surface."` — small caps, letter-spaced, muted white
- Package badges below tagline: `@brewsite/core` and `@brewsite/diagram` pill chips in cyan border
- Scroll indicator: centered at bottom, animated bouncing chevron arrows + "scroll to explore" label. Fades when `window.scrollY > 50`.

### Section Design Language

Between and around the ScenePlayer sections, CSS-only structural elements establish the makerspace context:

**Section Headers (between acts):**
- Act number: monospace, large (100–120px), 3% opacity — decorative watermark
- Act label: small caps, letter-spaced, 12px, muted cyan
- Title: 36–48px, bold, gradient from white to cyan-tinted
- Description: 16px, 1.6 line-height, muted grey

**Feature Tags:**
- Pill badges: `border: 1px solid rgba(0,245,255,0.25)`, background `rgba(0,245,255,0.06)`, text cyan, 12px monospace, letter-spaced

**Code Snippets:**
- Dark panel: `background: #0d1117`, `border: 1px solid rgba(255,255,255,0.08)`, top bar showing filename
- Syntax: React/JSX, no third-party highlighter needed — manual `<span>` coloring with classes
- Colors: keywords blue `#ff7b72`, props teal `#79c0ff`, strings orange `#ffa657`, JSX brackets grey `#6e7681`

**Interstitial Dividers:**
- A horizontal rule with a central gem/diamond accent
- The accent is a rotated square (45°) with neon fill — `background: #00f5ff`, 8px, `box-shadow: 0 0 8px #00f5ff`

---

## The Eight Acts

### Act 0: Hero — The Neon Sign (CSS + Three.js, no ScenePlayer)

**Narrative:** First impression. The room is dark. The sign flickers to life.

**Visual:** Three.js metal room + CSS bezel + SVG neon sign + scroll indicator.

**Message:** "BrewSite" — product name. Tagline below: `"Author in JSX. Ship to any surface."`

---

### Act 1: The Core — Scenes & HUD (ScenePlayer, 2 scenes)

**Narrative:** The simplest possible thing. A dark background, a glowing HUD, text that fades in as you scroll.

**Visual:** ScenePlayer with dark scene, HUD text centered in frame. Second scene shows feature tags and a code snippet (as part of the HUD). No 3D models — the emptiness is the point. Clean, minimal.

**Scene 1 HUD content:**
- Eyebrow: `@brewsite/core`
- Headline: `"Scenes as JSX. Rendered like film."`
- Body: `"Declare 3D scene states. Let the compiler handle transitions. No animation loops. No frame math."`
- Animation: `MidFade` on headline, `SlideUp` on body (delay 200ms)

**Scene 2 HUD content:**
- Bottom-anchored panel
- Headline: `"Pre-baked for O(1) sampling. Zero animation math at runtime."`
- Tags: Declarative · Scroll-Driven · SSR-Safe · TypeScript-First
- Animation: `Fade` on headline, `SlideUp` on tags (delay 150ms)

**Section text (CSS, right of player or below):**
```
// The DSL that drives Scene 1
<Scene id="intro">
  <Background enabled color="#04080f" />
  <Camera mode="world" position={[0, 1, 8]} target={[0, 0, 0]} fov={70} />
  <Hud>
    <HudItem id="intro-hud">
      <MidFade duration={1200}>
        <h2>Scenes as JSX.</h2>
      </MidFade>
    </HudItem>
  </Hud>
</Scene>
```

---

### Act 2: Libraries — Composability (ScenePlayer, 2 more scenes, combined with Act 1 player)

**Narrative:** The HUD is just React. Any library works inside it. AnimeJS drives the transitions built into the framework.

**Visual:** Same ScenePlayer continues from Act 1. Scenes 3–4 show anime.js transitions (`SlideUp`, `ScrollOn`, `ScrollOff`) in action, narrated by the HUD itself.

**Scene 3 HUD:** Headline: `"The HUD is React."` Body: `"Every HudItem is a React subtree. Use any library, any component, any animation system."` Uses `ScrollOn` transition for dramatic entrance.

**Scene 4 HUD:** Eyebrow: `"Built-in transitions"` → animated list of: `Fade` / `SlideUp` / `MidFade` / `ScrollOn` / `ScrollOff`. Each pill appears with a staggered `SlideUp` delay. Uses `ScrollOff` to exit cleanly.

**Section text:** Short code example showing `import { SlideUp } from '@brewsite/core/hud/animejs'`

---

### Act 3: Models — 3D Characters (ScenePlayer, 2 scenes)

**Narrative:** Drop any GLTF model. Floor, lighting, camera — handled.

**Visual:** Worker model appears in a wide, slightly misty industrial space with floor mirror. Camera starts at distance, second scene tightens to a close-up. Industrial lighting: warm key, cool fill.

**Scene 1:** Wide shot. Worker model, full height visible. Floor mirror reflection.

**Scene 2:** Camera moves in close (head/torso level). HUD bottom-right: `"Physically Based Materials"` + `"GLTF · Normals · Reflections"`. Light shifts to highlight the model's material quality.

**Section text:** Code snippet showing `<ModelRouter type="Worker" .../>` + `<Floor>` + `<FloorMirror>` + `<Camera mode="world" .../>`.

---

### Act 4: Animation — The Meeting (ScenePlayer, 1 scene)

**Narrative:** 30 characters, procedurally placed, all looping real animation clips. Authored in 50 lines of JSX.

**Visual:** The meeting crowd scene adapted from `apps/examples/meeting`. Procedural character placement with collision-aware distribution. Business characters + dummy avatars with varied animation clips. HUD panel at bottom with narrative text.

**HUD content:**
- Eyebrow: `"Procedural Composition"`
- Headline: `"30 characters. 50 lines of JSX."`
- Body: `"Random placement, collision detection, animation assignment — all at author time. Runtime is just playback."`

**Section text:** Key excerpt from the scene DSL showing the `generatePairCenters` + `Actor` component pattern.

---

### Act 5: Diagrams — Simple (ScenePlayer, 1 scene)

**Narrative:** From whiteboard to 3D in JSX. No Figma. No designer needed.

**Visual:** A compact 5-node tech stack diagram: React App → API Gateway → (Postgres | Redis). `neonCyberTheme`. Tilted ~15° on the X-axis. Glowing edges, emissive nodes.

**HUD content:**
- Bottom-left panel
- Headline: `"@brewsite/diagram"`
- Body: `"3D immersive diagrams in JSX. Themes, icons, routed edges, groups — out of the box."`

**Section text:** Full scene DSL code for the 5-node diagram.

---

### Act 6: Diagrams — Complex (ScenePlayer, 2 scenes)

**Narrative:** Production-ready architecture diagrams. Presentation-grade.

**Visual:** AWS architecture diagram from `apps/examples/diagram`: CDN → ALB → API → (ECS | Lambda) → (RDS | Cache | S3). `darkGlassTheme`. Second scene drills into ECS cluster detail.

**HUD content Scene 1:**
- Top-right badge: `"16 nodes · 4 tiers · 8 edges"`
- Bottom: `"Architecture diagrams. Presentation-ready."`

**HUD content Scene 2:**
- `"Drill down. Stay in the scene."`
- Feature: `"DiagramGroups · Focus Regions · Theme System"`

---

### Act 7: The Full Stack — Everything Together (ScenePlayer, 2 scenes)

**Narrative:** Models, diagrams, HUD, React — all in one scene. This is what a real presentation looks like.

**Visual:** A business presenter model (left side), a floating 3D architecture diagram (right side, slightly angled), dramatic lighting, floor mirror. HUD content narrates. Second scene is a cinematic camera pull-back showing both the model and diagram in frame simultaneously.

**Scene 1 HUD:** Center-top: `"BrewSite"`. Centered: `"One framework. Every medium."`

**Scene 2 HUD:** Bottom-left: `"Models + Diagrams + HUD + React"`. Then: `"Web apps. Decks. Pitches. Marketing sites."`

---

### Act 8: GitHub CTA (CSS only, no ScenePlayer)

**Narrative:** You've seen what it can do. Here's how to start.

**Visual:** Terminal-aesthetic dark section. macOS-style terminal chrome (dots, title bar), install command with animated cursor, GitHub link styled as a glowing CTA.

**Content:**
```
$ npm install @brewsite/core @brewsite/diagram
added 2 packages in 1.1s

$ ▊
```

Below terminal: `"Open Source. Production Ready."` headline, body text about TypeScript-first design, link: `"★ Star on GitHub →"` (styled as a glowing neon button).

---

## Technical Considerations

### Multiple ScenePlayers on One Page

The `useEngineScroll` hook computes progress relative to each ScenePlayer's own `scrollRegionRef` element position in the document:

```typescript
const regionTop = scrollTop + rect.top;
const progress = clamp01((scrollTop - regionTop) / maxScroll);
```

This means multiple ScenePlayers placed in sequence in the document will each independently track their own scroll section. Acts 1+2 share a single ScenePlayer (4 scenes total); Acts 3, 4, 5+6, and 7 each have their own ScenePlayer. This is both valid and expected behavior.

### Vite Config — Root Directory Fix

The current `apps/website/vite.config.ts` points to `root: resolve(__dirname, 'vite-app')` but all source files live in `src/`. This must be corrected to `root: resolve(__dirname, 'src')` before any development work begins.

### Public Assets

All 3D models and animation GLBs must be available at `/assets/...` paths in `apps/website/public/`. The same paths are used as in `apps/examples/public/`. The implementing engineer must ensure these files are present (symlink or copy from examples/public).

### Fonts

Two custom fonts are required:
- `Dancing Script` (Google Fonts, weight 700) — for the neon sign
- `JetBrains Mono` (Google Fonts, weights 400 500) — for code snippets

Both must be loaded via `<link rel="preconnect">` and `<link rel="stylesheet">` in `src/index.html` before any content renders.

### Dependencies to Add

The following packages must be added to `apps/website/package.json`:
- `react-router` — already imported but not listed (use v7 pattern)
- `animejs` — used by `@brewsite/core/hud/animejs` transitions (peer dep, but website should list it)

### Three.js Neon Sign Renderer

The hero section uses raw Three.js directly (not through ScenePlayer). This avoids bootstrapping the entire animation engine for a decorative background. The renderer disposes of itself on component unmount. It uses:
- `THREE.WebGLRenderer` with `antialias: true`
- `THREE.ACESFilmicToneMapping`
- `THREE.MeshPhysicalMaterial` for metal surfaces
- `requestAnimationFrame` loop with slow camera drift

### Scene Manifest

Each ScenePlayer loads `/scene-manifest.json` which is generated by `pnpm --filter @brewsite/website gen:scene-dsl`. This generates the manifest from `siteResources.ts`. The manifest must be generated before running the dev server.

### HUD Transitions

All HUD animations in website scenes use `@brewsite/core/hud/animejs` transitions (`Fade`, `MidFade`, `SlideUp`, `ScrollOn`, `ScrollOff`). These are the same transitions used throughout `apps/examples/complex`.

### Widget Setup

All ScenePlayers use the same `createWidgetSetup` function:
```typescript
export const createWidgetSetup = (manifest: AssetManifest) =>
  createDefaultWidgetRegistry(manifest);
```

This is identical to the examples app widget setup.

---

## Breaking Change Assessment

**None.** `apps/website` is a private app. No published package APIs change. No `apps/examples` code changes.

---

## Dependencies

- `@brewsite/core` workspace version — ScenePlayer, HUD, models, camera, lighting, floor
- `@brewsite/diagram` workspace version — DiagramCanvas, Diagram, DiagramNode, DiagramEdge, DiagramGroup
- `three` (peer dep, already installed) — for hero neon sign canvas
- `react` + `react-dom` — already installed
- `react-router` — must be added to package.json
- `animejs` — must be added to package.json (already transitive via @brewsite/core)
- Google Fonts CDN — Dancing Script, JetBrains Mono

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Public assets not present in website/public | High | Plan specifies exact asset paths; implementing engineer must populate from examples |
| Multiple ScenePlayers cause memory issues | Medium | Each player disposes WebGL context on unmount; test on low-end GPU |
| Neon sign font not available on load, causing FOUT | Medium | Use `font-display: block` for Dancing Script; neon animation only starts after 0.8s delay |
| `DiagramCanvas` position prop not supported | Unknown | If position prop isn't in DiagramCanvas API, use CSS transform on wrapper div |
| Meeting crowd scene is heavy (30 models × animations) | Medium | Lower `framesPerTick` to 40 for Act 4 to reduce compile time |
| ScenePlayer fails silently when manifest missing | Medium | Website should show clear "run gen:scene-dsl first" error in dev mode |

---

## Open Questions

1. Does `DiagramCanvas` support a `position` prop for 3D placement, or does it only accept rotation/scale? (Review `packages/diagram/src/elements/diagram/canvas/` DSL props.)
2. Are the neonCyber and other themes exported as `neonCyberTheme` from `@brewsite/diagram`? (Review `packages/diagram/src/index.ts`.)
3. Does the Worker model have a suitable idle animation in the current animation set, or does it only have character animation clips? (Worker appears in examples/simple but without animation.)
4. Should the website have its own Google Analytics or tracking? (Out of scope for v1 — omit.)
5. What is the GitHub URL for the BrewSite project? (Placeholder: `https://github.com/brewsite/brewsite` — confirm before launch.)

---

## Launch Criteria

- [ ] All 5 ScenePlayer sections render with no console errors in Chrome and Safari
- [ ] Neon sign hero animation plays correctly on page load
- [ ] Hamburger menu opens and closes with proper animation
- [ ] Scroll indicator appears and fades when scrolling begins
- [ ] All code snippets shown are valid, compilable DSL code
- [ ] Page renders without errors when `/public/assets/` contains the required model files
- [ ] All scene HUD text is readable against the 3D backgrounds
- [ ] Act 8 GitHub CTA links to the correct repository URL
- [ ] `gen:scene-dsl` script runs without errors and produces `/public/scene-manifest.json`
- [ ] TypeScript strict-mode build passes (`pnpm --filter @brewsite/website typecheck`)
