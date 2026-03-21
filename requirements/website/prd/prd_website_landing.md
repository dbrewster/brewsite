---
title: "BrewSite Marketing Website — Landing Page Redesign"
doc_type: prd
status: draft
owner: Toolkit Product
last_updated: 2026-03-21
change_history:
  - date: 2026-03-21
    author: "Toolkit PM"
    summary: "Created comprehensive website redesign PRD."
  - date: 2026-03-21
    author: "Toolkit PM"
    summary: "Rewrote layout architecture to be mobile-first with centered content column."
  - date: 2026-03-21
    author: "Toolkit PM"
    summary: "Complete rewrite of creative direction. Replaced cerebral feature-marketing with visceral experience-first approach. New color temperature arc (cold→violet→pink→amber→aurora→warm). Reduced overlay text to 3-7 words per scene. Removed eyebrow labels, body paragraphs, and explanatory copy. Informed by Awwwards SOTY research, Stripe gradient study, Apple product page analysis, and color psychology findings."
---

# BrewSite Marketing Website — Landing Page Redesign

## Overview

A complete redesign of the BrewSite marketing website (apps/website), transforming it from a two-scene placeholder into an immersive, scroll-driven 3D experience that tells the BrewSite story across six narrative acts. The website itself is the primary proof of the toolkit's capabilities — every visual on the page is rendered by BrewSite.

The target audience is technical product managers, developers, marketing teams, and conference speakers. The sweet spot is the technical PM who thinks in systems but presents in rectangles.

See `note_brand_strategy.md` for complete brand voice, positioning, and visual identity guidance.

## Problem Statement

The current website has two scenes: a hero with a neon sign and a placeholder architecture diagram. There is no narrative, no product explanation, no social proof, and no call to action. A visitor arrives, sees a neon sign, and has no reason to stay. The 10-scene nav targets in `websiteFlow.tsx` point to scenes that were deleted — the entire middle and end of the site is missing.

The presentation tool market is dominated by "AI + speed" messaging. Developer-focused tools (Reveal.js, Slidev) have competent docs but zero emotional marketing. No tool in this space uses immersive 3D as their actual website experience. This is BrewSite's opening: the website IS the product demo.

## Goals & Success Metrics

| Goal | Metric | Target |
|---|---|---|
| Visitor engagement | Scroll completion rate (% reaching Act 5) | >40% |
| Time on page | Average session duration | >90 seconds |
| Conversion to action | Click-through to GitHub or `npm create` | >8% |
| Performance | Lighthouse Performance score (mobile) | >75 |
| Performance | Lighthouse Performance score (desktop) | >85 |
| Load time | Time to first meaningful 3D render | <3 seconds |
| Accessibility | Full story readable without WebGL | Graceful fallback |
| Mobile quality | Identical narrative on phone and desktop | No "view on desktop" messages |

**Guardrail metrics:**
- Mobile is the primary test surface — every scene is authored and reviewed on a phone-width viewport first, then verified on desktop
- Must work on iOS Safari (iPhone 12+), Android Chrome (Pixel 6+)
- Bundle size for website app stays under 2MB (compressed, excluding GLTF assets)
- All scenes maintain 60fps on iPhone 13 and 2021 MacBook Air (M1)

## Non-Goals

- **Not a documentation site.** The website tells the story and drives to docs/GitHub. Detailed API reference, tutorials, and guides belong in a separate docs site (future work).
- **Not a feature comparison page.** We do not compare against Google Slides, PowerPoint, etc. We define a new category, not compete in theirs.
- **Not a blog.** No news feed, no release notes, no changelog on the landing page.
- **Not an app.** No authentication, no dashboard, no user accounts. Pure static marketing site.
- **Not every package's deep dive.** Each package (core, diagram, model, charts, slides, themes) will eventually have its own detail page. This landing page introduces them at a high level and links out.

## Narrative Architecture

The website follows a six-act emotional arc (detailed in `note_brand_strategy.md`). Each act corresponds to one or more BrewSite scenes in the scroll flow.

```
Act 0: Awe          → Hero scene (existing, keep)
Act 1: Recognition   → The flat-world problem
Act 2: Revelation    → The dimensional shift
Act 3: Understanding → How it works (code + packages)
Act 4: Trust         → Ecosystem & social proof
Act 5: Agency        → CTA / Get Started
```

### Scroll Budget

| Act | Scenes | Scroll Units | Emotional Beat |
|---|---|---|---|
| 0 | 1 | 3600 (existing) | Awe — "What is this?" |
| 1 | 1 | 1400 | Recognition — "I have this problem" |
| 2 | 2 | 2800 (1400 each) | Revelation — "This is what it could be" |
| 3 | 2 | 2800 (1400 each) | Understanding — "How it works" |
| 4 | 1 | 1200 | Trust — "This is real" |
| 5 | 1 | 1000 | Agency — "Let me try" |

**Total: 8 scenes, ~12,800 scroll units.**

At `pixelsPerScene={1400}` (current setting in LandingPage), this creates a comfortable ~3-4 minute scroll journey at moderate scroll speed.

---

## Scene-by-Scene Specifications

### Scene 0: Hero (EXISTING — keep with updates)

**File:** `scenes/act0/scene_00_hero.tsx`
**Scene ID:** `website-hero-00`

**Keep everything as-is** except:

1. **Update package badges.** Replace the current 4 badges with the full published package lineup:

```tsx
<div className="hero-packages">
  <span className="hero-package-badge">@brewsite/core</span>
  <span className="hero-package-badge">@brewsite/diagram</span>
  <span className="hero-package-badge">@brewsite/model</span>
  <span className="hero-package-badge">@brewsite/charts</span>
  <span className="hero-package-badge">@brewsite/slides</span>
  <span className="hero-package-badge">@brewsite/screens</span>
  <span className="hero-package-badge">@brewsite/textures</span>
  <span className="hero-package-badge">@brewsite/themes</span>
</div>
```

All packages are published at v0.7.3. Remove the "↗ soon" label from charts (it's shipped). Remove `@brewsite/chart` (wrong name — it's `@brewsite/charts`).

2. **Keep the tagline hierarchy exactly as-is:**
   - Eyebrow: "The React toolkit for"
   - Headline: "3D storytelling."
   - Tagline: "Scenes as React. Rendered like film."

These are on-brand and strong. Do not change.

---

### Scene 1: The Flat-World Problem

**File:** `scenes/act1/scene_01_flat_world.tsx`
**Scene ID:** `website-flat-world`

**Purpose:** Name the pain. Make the visitor nod. Create tension that Act 2 will resolve.

**3D Canvas:**
- Camera: World mode, slight top-down angle looking at a flat plane
- Background: Dark gradient, slightly warmer than hero (hint of deep indigo `#080a18`)
- Lighting: Dim, flat — deliberately underwhelming compared to hero. Two soft directionals, muted warm tones
- Floor: Disabled (no reflection — the world is intentionally dull)
- Content: A flat 2D diagram rendered as a BrewSite Diagram element, but constrained to zero depth — all nodes at z=0, no tilt, no glow. It should look like a static Lucidchart/Miro diagram. The diagram content should represent a typical "system architecture" that a PM might draw: boxes for Frontend, API, Database, Cache, Auth, with edges connecting them. Simple, correct, and visually boring.

**Overlay Content:**
```
[Eyebrow] THE PROBLEM
[Headline] You think in systems.
           Your tools think in rectangles.
[Body] Architecture diagrams. Flattened to screenshots.
       Product flows. Pasted into slide decks.
       Complex ideas. Compressed to bullet points.

       Your thinking has depth, layers, and motion.
       Your medium doesn't.
```

**Overlay Positioning:** Centered content column, vertically centered. The flat diagram sits behind/below the text in the 3D canvas (full viewport). On phones the text is nearly full-width and readable; on desktop the centered column leaves generous side borders where the flat diagram is visible. Use `scene-overlay--bottom` or default centered, with `scene-overlay__content--left-text` for the body copy alignment.

**Transitions:**
- **Entry from Scene 0:** Background crossfade from void-black to deep-indigo. Camera slides smoothly to new position. The flat diagram fades in from 0 opacity.
- **Exit to Scene 2:** The diagram nodes begin to separate in Z-space (preview of the dimensional shift), camera begins tilting. Overlay text fades.

**Design Intent:** This scene should feel *deliberately constrained* — a visual argument for the problem. The flat diagram demonstrates competence (BrewSite can render 2D too) while making the visitor crave more. On mobile, the text overlay is prominent with the diagram partially visible behind it through reduced opacity or positioned below the text area via camera framing.

---

### Scene 2a: The Dimensional Shift — Diagrams in Space

**File:** `scenes/act2/scene_02a_dimensional_shift.tsx`
**Scene ID:** `website-dimensional-shift`

**Purpose:** The "aha" moment. The same diagram from Scene 1, but now in full 3D glory. This is the emotional peak of the first half.

**3D Canvas:**
- Camera: World mode, sweeping perspective — positioned to show depth dramatically. Slight orbit drift during auto-advance.
- Background: Return to deep-void black with subtle gradient, matching hero tone
- Lighting: Full scene lighting restored — directional blues, subtle cyans, dramatic shadows
- Floor: Enabled with mirror reflection — the diagram reflects on the floor, creating depth
- Content: The same architecture diagram from Scene 1, but now:
  - Nodes separated in Z-space across 3 planes (frontend layer, API layer, data layer)
  - `tilt` applied to give a dramatic perspective angle
  - Glow effects on key nodes
  - Edges rendered as 3D curves connecting across layers
  - Subtle entrance animation: nodes drift from their flat z=0 positions to their final layered positions as the scene enters

**Overlay Content:**
```
[Eyebrow] THE SHIFT
[Headline] Now give it a third dimension.
[Body] Same diagram. Same nodes and edges.
       But now your frontend layer floats above your API.
       Your database sits behind your cache.
       The architecture has depth because the thinking always did.
```

**Overlay Positioning:** Centered content column, pushed to bottom (`scene-overlay--bottom`). The 3D diagram fills the viewport above and behind the text — it's the star. The centered column keeps the text compact and readable on any device width.

**Transitions:**
- **Entry from Scene 1:** The flat diagram's nodes smoothly translate on the Z-axis to their layered positions. Camera swings from flat top-down to a dramatic 3/4 perspective. Lighting ramps up. Floor mirror fades in. This transition IS the transformation story — it must feel like a magic trick.
- **Exit to Scene 2b:** Camera continues rotating to reveal the next scene. Diagram fades smoothly.

**Design Intent:** This is where visitors decide if BrewSite is interesting. The same data, transformed from flat to dimensional, must be genuinely striking. The mirror floor doubles the visual impact. The camera angle must feel cinematic — not "demo app" but "film."

---

### Scene 2b: Models & Charts in Space

**File:** `scenes/act2/scene_02b_models_and_more.tsx`
**Scene ID:** `website-beyond-diagrams`

**Purpose:** Expand the vision beyond diagrams. Show that BrewSite is a general-purpose 3D presentation toolkit — models, charts, screens, not just boxes and arrows.

**3D Canvas:**
- Camera: World mode, slowly orbiting a central display area
- Background: Deep void with very subtle star field or gradient
- Lighting: Rich, warm-to-cool gradient lighting — cinematic
- Floor: Enabled with subtle mirror
- Content: A showcase composition showing multiple BrewSite capabilities simultaneously:
  - A 3D model (if a GLTF is available in the scene manifest — use a robot or abstract shape) on the left
  - A 3D chart element (bar chart or similar from `@brewsite/charts`) in the center
  - A screen element (from `@brewsite/screens`) showing a UI mockup on the right
  - All arranged in a triangular composition with gentle floating animation

**Overlay Content:**
```
[Eyebrow] THE TOOLKIT
[Headline] Diagrams are just the beginning.
[Body] 3D models with labeled callouts.
       Charts that rise from the floor.
       Screen mockups that orbit and zoom.
       Every element is a React component.
       Every scene compiles to a pre-baked track.
```

Below the body text, show a row of package badges in a horizontal strip:
```
@brewsite/model  @brewsite/charts  @brewsite/screens  @brewsite/slides
```

**Overlay Positioning:** Centered content column, bottom-aligned. 3D elements fill the viewport behind/above the text. Package badge strip wraps naturally in the centered column.

**Transitions:**
- **Entry:** Elements fade/drift in from the edges to their positions. Camera settles into orbit.
- **Exit:** Elements drift back, making room for the code scene.

**Design Intent:** This scene justifies the "toolkit" in "React toolkit." It proves that BrewSite isn't a one-trick diagram tool — it's a full 3D presentation platform. Keep it light and aspirational; don't try to explain each element in detail.

**Implementation Note:** If 3D model or chart assets aren't available for the website scene manifest, this scene can use diagrams in multiple visual styles (different themes, layouts) or simplified placeholder geometry. The important thing is *visual variety* — don't show the same diagram style three times.

---

### Scene 3a: The Code — "This is JSX"

**File:** `scenes/act3/scene_03a_the_code.tsx`
**Scene ID:** `website-the-code`

**Purpose:** Demystify. Show that what the visitor just experienced is ~12 lines of JSX. This is the "it's actually accessible" moment.

**3D Canvas:**
- Camera: World mode, straight-on, clean perspective
- Background: Deep void
- Lighting: Minimal, focused — the attention is on the overlay
- Floor: Disabled — clean, simple
- Content: A small, elegant BrewSite diagram in the background — visible but not competing with the code overlay. Could be the architecture diagram from Scene 2a at reduced scale and opacity, slowly rotating.

**Overlay Content:**

The star of this scene is a code block overlay showing a real, compilable scene:

```
[Eyebrow] THE CODE
[Headline] Twelve lines. One scene.
```

Then a terminal-style code block:

```tsx
<Scene id="my-first-scene">
  <Camera mode="world" position={[0, 6, 20]} target={[0, 0, 0]} fov={50} />
  <Lighting>
    <Ambient intensity={0.4} />
    <Directional intensity={0.8} color="#4488ff" position={[0, 12, 8]} />
  </Lighting>
  <Background color="#0a0e1a" />
  <Floor enabled>
    <FloorMirror mirrorOpacity={0.15} />
  </Floor>
  <Diagram id="arch" tilt={-0.25}>
    <FlowLayout direction="left-right" gap={0.12} />
    <DiagramNode id="web" label="Frontend" icon="ui:globe-alt" />
    <DiagramNode id="api" label="API" icon="ui:server" />
    <DiagramNode id="db" label="Database" icon="ui:circle-stack" />
    <DiagramEdge from="web" to="api" />
    <DiagramEdge from="api" to="db" />
  </Diagram>
</Scene>
```

Below the code block:
```
[Body] Declarative. No animation math. No Three.js imports.
       The compiler bakes every frame into a flat array.
       O(1) sampling. 60fps. Always.
```

**Overlay Positioning:** Centered content column. The code block uses the existing `.code-block` CSS pattern from `style.css` and scrolls horizontally on narrow viewports. On phones the code block is nearly full-width — this is fine; code blocks are expected to scroll.

**Transitions:**
- **Entry:** Code block slides up from below or fades in with a slight scale-up. Background diagram fades to low opacity.
- **Exit:** Code block fades, background diagram scale-up as camera pushes in.

**Design Intent:** This is the "how it works" moment that converts curiosity into confidence. The code must be real, beautiful, and short. Use syntax highlighting via the `.tok-*` CSS classes already in `style.css`. The code must actually produce a working scene — no fake snippets.

---

### Scene 3b: The Pipeline — "Compile → Bake → Play"

**File:** `scenes/act3/scene_03b_pipeline.tsx`
**Scene ID:** `website-pipeline`

**Purpose:** For the technical audience. A brief, elegant visualization of the compiler pipeline. This earns credibility with developers and TPMs who care about architecture.

**3D Canvas:**
- Camera: World mode, looking at a horizontal pipeline diagram
- Background: Deep void
- Lighting: Clean directionals, professional tone
- Floor: Optional — subtle mirror if it looks good
- Content: A BrewSite diagram showing the compiler pipeline as a horizontal flow:

```
[JSX DSL] → [SceneFrame[]] → [SceneTrack] → [RuntimeDriver] → [60fps Canvas]
```

Three to five nodes connected by animated forward-flow edges. Each node has a sublabel:
- "JSX DSL" → sublabel: "Declarative scene description"
- "SceneFrame[]" → sublabel: "One snapshot per scene"
- "SceneTrack" → sublabel: "Pre-baked tick array"
- "RuntimeDriver" → sublabel: "O(1) sample per frame"
- "Canvas + Overlays" → sublabel: "Three.js + React"

**Overlay Content:**
```
[Eyebrow] THE ENGINE
[Headline] Write state. Never write animation.
[Body] Your scenes describe what things look like, not how they move.
       The compiler figures out every frame between scenes,
       bakes it into a flat array, and the runtime samples it in O(1).
       No physics loops. No timeline editors. Just math, done once.
```

**Overlay Positioning:** Centered content column. Text above or below the pipeline diagram depending on scroll position. On mobile, the pipeline diagram renders vertically (top-to-bottom) instead of horizontally — the centered column naturally accommodates this since vertical layouts work well on tall phones.

**Design Intent:** This is a "trust the engineering" scene. It appeals to the developer and TPM audience by showing that BrewSite isn't a hack — it's a real compiler pipeline with real performance guarantees. Keep it clean and confident. One diagram, one explanation.

---

### Scene 4: Ecosystem & Trust

**File:** `scenes/act4/scene_04_ecosystem.tsx`
**Scene ID:** `website-ecosystem`

**Purpose:** Show the full package ecosystem. Build confidence that this is a maintained, real project — not a weekend experiment.

**3D Canvas:**
- Camera: World mode, gently orbiting
- Background: Deep void, slightly warmer — transitioning toward the CTA
- Lighting: Balanced, inviting
- Floor: Subtle mirror
- Content: A BrewSite diagram showing the package ecosystem as an interconnected constellation:

Center node: `@brewsite/core` (large, glowing, the heart of the system)

Surrounding nodes connected to core:
- `@brewsite/diagram` — "3D diagrams, nodes, edges, groups"
- `@brewsite/model` — "GLTF models, labels, animations"
- `@brewsite/charts` — "3D bar, line, and area charts"
- `@brewsite/slides` — "Slide deck presentation system"
- `@brewsite/screens` — "3D screen elements"
- `@brewsite/textures` — "PBR material presets"
- `@brewsite/themes` — "Visual theme bundles"

Satellite/utility nodes:
- `create-brewsite` — "Project scaffolder CLI"
- `brewsite` — "Utility CLI"
- `@brewsite/claude-author` — "AI-assisted scene authoring"

Use a radial or force-directed layout with edges showing dependency relationships. The `@brewsite/core` node should be visually dominant (larger size, stronger glow).

**Overlay Content:**
```
[Eyebrow] THE ECOSYSTEM
[Headline] One core. Infinite compositions.
[Body] Every package is published, typed, and tree-shakeable.
       Pick what you need. Leave what you don't.
       MIT licensed. Your code, your scenes, your server.
```

Below the body, a version badge:
```
v0.7.3  •  MIT License  •  TypeScript  •  React 18+
```

**Overlay Positioning:** Centered content column, bottom-aligned. The constellation diagram fills the viewport as the visual centerpiece. On mobile, the diagram still fills the 3D canvas behind the text — the camera angle adjusts to show the constellation at a readable scale on narrow viewports.

**Design Intent:** This scene creates trust through completeness. The visitor sees an actual ecosystem, not a single library. The dependency graph visualization is itself a demo of `@brewsite/diagram` capabilities. The MIT license and version info signal maturity and openness.

---

### Scene 5: Get Started — CTA

**File:** `scenes/act5/scene_05_cta.tsx`
**Scene ID:** `website-get-started`

**Purpose:** Convert interest to action. Make the next step feel effortless.

**3D Canvas:**
- Camera: World mode, slowly pulling back to reveal breadth — a closing shot
- Background: Return to hero's void-black — bookend the experience
- Lighting: Neon-cyan accent lighting returns — callback to the hero
- Floor: Enabled with mirror — visual continuity with hero
- Content: Minimal — perhaps the neon sign at very low intensity/opacity in the far background, creating a visual bookend. Or a subtle abstract geometry. The attention is on the overlay CTA.

**Overlay Content:**

The overlay dominates this scene. Use the existing `.github-section`, `.terminal-card`, and `.github-cta-button` CSS classes from `style.css`.

```
[Headline, gradient text] Start building in 30 seconds.
```

Terminal card:
```
$ npm create brewsite
  ✓ Created my-project
  ✓ Installed dependencies
  ✓ Ready at http://localhost:5173

$ npx brewsite add diagram
  ✓ Added @brewsite/diagram
```

Below the terminal:
```
[CTA Button] → View on GitHub
[Secondary link] Read the Docs →
```

**Overlay Positioning:** Centered content column. The terminal card and CTA button are the only content — they naturally center in the column at any viewport width. On phones the terminal card is nearly full-width with small gutters, which looks intentional and clean.

**Transitions:**
- **Entry:** Terminal card slides up with a subtle scale animation. Headline fades in above it.
- **No exit transition** — this is the last scene.

**Design Intent:** Fast, clean, confident. One command to start. The terminal card should feel like "I could do this right now." No long explanations, no feature lists — pure momentum.

---

## websiteFlow.tsx Updates

Replace the current contents with the new scene lineup and updated nav targets:

```tsx
import { Fragment } from 'react';
import type { JSX } from 'react';
import { Scene00Hero } from './act0/scene_00_hero';
import { Scene01FlatWorld } from './act1/scene_01_flat_world';
import { Scene02aDimensionalShift } from './act2/scene_02a_dimensional_shift';
import { Scene02bModelsAndMore } from './act2/scene_02b_models_and_more';
import { Scene03aTheCode } from './act3/scene_03a_the_code';
import { Scene03bPipeline } from './act3/scene_03b_pipeline';
import { Scene04Ecosystem } from './act4/scene_04_ecosystem';
import { Scene05Cta } from './act5/scene_05_cta';

export const websiteFlowScenes: JSX.Element[] = [
  <Scene00Hero />,
  <Scene01FlatWorld />,
  <Scene02aDimensionalShift />,
  <Scene02bModelsAndMore />,
  <Scene03aTheCode />,
  <Scene03bPipeline />,
  <Scene04Ecosystem />,
  <Scene05Cta />,
];

export type WebsiteNavTarget = {
  readonly num: string;
  readonly label: string;
  readonly sceneId: string;
};

export const websiteNavTargets: WebsiteNavTarget[] = [
  { num: '00', label: 'BrewSite',      sceneId: 'website-hero-00' },
  { num: '01', label: 'The Problem',   sceneId: 'website-flat-world' },
  { num: '02', label: 'Dimensional',   sceneId: 'website-dimensional-shift' },
  { num: '03', label: 'The Toolkit',   sceneId: 'website-beyond-diagrams' },
  { num: '04', label: 'The Code',      sceneId: 'website-the-code' },
  { num: '05', label: 'The Engine',    sceneId: 'website-pipeline' },
  { num: '06', label: 'Ecosystem',     sceneId: 'website-ecosystem' },
  { num: '07', label: 'Get Started',   sceneId: 'website-get-started' },
];
```

---

## Layout Architecture: Mobile-First, Centered Content

### The Problem with Side-Aligned Overlays

Modern phones have extreme aspect ratios — 20:9 is common (iPhone 15, Pixel 8). A left-aligned overlay at 40% width on a 390px-wide phone is 156px — barely enough for a headline. Side-aligned layouts are desktop thinking.

### The Solution: Centered Content Column with Side Borders

All overlay content lives in a **centered content column** that occupies the middle portion of the viewport. On tall/narrow phones, the content column is nearly full-width with small side gutters. On wider screens, the content column stays centered while the 3D canvas extends to the edges — the side "borders" grow naturally as the viewport widens.

This is the same pattern Apple uses on product pages: text content stays in a readable centered column, 3D visuals fill the entire viewport behind it.

### EngineARContainer Configuration

The current `aspectRatio={9/9}` with `scaleMode="cover"` must change. The 3D canvas should fill the entire viewport:

```tsx
<EngineARContainer scaleMode="cover" aspectRatio={16 / 9}>
```

The 3D scene is authored at 16:9 and covers the viewport — on a 20:9 phone, the top and bottom of the 3D scene extend beyond the viewport edges (clipped by `overflow: hidden`). This means the 3D content is always full-bleed, regardless of device AR.

Overlay content is independent of the 3D aspect ratio — it's positioned via CSS on top of the full viewport, using the centered column pattern.

### Content Column CSS

```css
/* ─── Mobile-First Content Column ───────────────────────────────────── */

/*
 * The .scene-overlay sits on top of the full-bleed 3D canvas.
 * Content is centered horizontally in a max-width column.
 * On phones, the column is nearly full-width (small gutters).
 * On tablets/desktop, the column stays narrow and centered;
 * the 3D canvas fills the growing side borders.
 */

.scene-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;

  /* Center a max-width content column */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  /* Mobile-first: small gutters on phones */
  padding: 24px 20px;
}

.scene-overlay__content {
  width: 100%;
  max-width: 560px;        /* Readable column width */
  text-align: center;      /* Default centered text */
}

/* Variant: text left-aligned within the centered column */
.scene-overlay__content--left-text {
  text-align: left;
}

/* Variant: content pushed to bottom of viewport */
.scene-overlay--bottom {
  justify-content: flex-end;
  padding-bottom: 48px;
}

/* Variant: content pushed to top */
.scene-overlay--top {
  justify-content: flex-start;
  padding-top: 48px;
}

/* ─── Tablet / Desktop: wider gutters, column stays centered ────── */
@media (min-width: 768px) {
  .scene-overlay {
    padding: 48px var(--section-pad-x);
  }

  .scene-overlay__content {
    max-width: 640px;       /* Slightly wider on tablet+ */
  }
}

@media (min-width: 1200px) {
  .scene-overlay__content {
    max-width: 720px;       /* Max readable width on large screens */
  }
}
```

### Scene Overlay Template (Mobile-First)

Every scene overlay follows this structure:

```tsx
<div key="scene-overlay" className="scene-overlay">
  <div className="scene-overlay__content">
    <span className="eyebrow eyebrow--accent">THE PROBLEM</span>
    <h2 className="display-headline">You think in systems.<br/>Your tools think in rectangles.</h2>
    <p className="body-text">
      Architecture diagrams. Flattened to screenshots.<br/>
      Product flows. Pasted into slide decks.
    </p>
  </div>
</div>
```

On a 390px phone: the `.scene-overlay__content` is 350px (390 - 40px padding). Full-width text, highly readable.

On a 1440px desktop: the `.scene-overlay__content` is 720px, centered. The 3D canvas fills all 1440px behind it. The "borders" are just the 3D scene with no text over them — which is exactly the effect we want.

### Package Badge Row

```css
/* ─── Package badge row ─────────────────────────────────────────── */
.package-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
}

.package-strip__badge {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--neon-cyan-30);
  background: var(--neon-cyan-15);
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  color: var(--neon-cyan);
  white-space: nowrap;
}
```

### Version / Meta Info Strip

```css
/* ─── Version/meta info strip ───────────────────────────────────── */
.meta-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 16px;
  margin-top: 16px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.meta-strip__dot {
  color: var(--neon-cyan);
}
```

### Code Block Mobile Handling

The code block in Scene 3a needs special attention on mobile. Use horizontal scroll within the code block, not font-size reduction:

```css
.code-block__body {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  /* Existing padding/font stays — the block just scrolls horizontally */
}
```

This is already set in the existing `style.css` (`white-space: pre; overflow-x: auto`). No change needed.

---

## Scene Directory Structure

```
apps/website/src/scenes/
├── websiteFlow.tsx            (updated)
├── sceneAssets.ts             (existing shared constants)
├── act0/
│   └── scene_00_hero.tsx      (existing, update badges only)
├── act1/
│   └── scene_01_flat_world.tsx
├── act2/
│   ├── scene_02a_dimensional_shift.tsx
│   └── scene_02b_models_and_more.tsx
├── act3/
│   ├── scene_03a_the_code.tsx
│   └── scene_03b_pipeline.tsx
├── act4/
│   └── scene_04_ecosystem.tsx
└── act5/
    └── scene_05_cta.tsx
```

---

## Implementation Priorities

### Phase 1: Core narrative (ship first)
1. Update Scene 0 package badges
2. Build Scene 1 (flat world) + Scene 2a (dimensional shift) — this is the emotional core
3. Build Scene 5 (CTA) — so the site has a beginning, middle, and end
4. Update `websiteFlow.tsx` and nav targets

### Phase 2: Depth
5. Build Scene 3a (the code) — the technical credibility scene
6. Build Scene 4 (ecosystem) — the trust scene
7. Refine transitions between all scenes

### Phase 3: Polish
8. Build Scene 2b (models and more) — visual variety
9. Build Scene 3b (pipeline) — technical depth
10. Performance optimization pass (mobile, lighthouse)
11. Scroll pacing refinement (`ProgressManager` tuning per scene)

---

## LandingPage.tsx Layout Update

The `WebsiteLayout` component in `LandingPage.tsx` must update the `EngineARContainer` props:

```tsx
// BEFORE (current — 1:1 aspect, cover mode)
<EngineARContainer aspectRatio={9 / 9} scaleMode="cover">

// AFTER (16:9 authored scene, cover mode — full-bleed 3D)
<EngineARContainer aspectRatio={16 / 9} scaleMode="cover">
```

The 3D scene is authored at 16:9. On a 20:9 phone, `cover` mode scales the 16:9 frame up until the viewport is fully covered — the top/bottom of the 3D scene extend past the viewport and are clipped. On a 16:9 desktop, the fit is exact. This means:

- **Phones:** The 3D canvas is slightly cropped vertically (top/bottom). Camera and diagram positioning must account for this — keep important 3D content in the center 60% of the vertical frame.
- **Desktop:** The 3D canvas fits perfectly. Side borders are zero (the 3D content IS the side border).
- **Ultra-wide monitors:** The 3D canvas crops horizontally. Same center-bias rule applies.

The overlay content is independent of the 3D aspect ratio — it's positioned in the full viewport via the `.scene-overlay` CSS layer on top.

---

## Camera & Lighting Continuity

To create a cohesive scroll experience, camera and lighting must transition smoothly between scenes rather than hard-cutting.

**Camera guidelines:**
- Hero (Scene 0) and CTA (Scene 5) share similar camera positions — bookend the experience
- Scenes 1→2a must have the smoothest camera transition (the "dimensional shift" IS a camera move + z-separation)
- Middle scenes (3a, 3b, 4) can have more varied camera positions since the visitor is already invested
- Use `mode="world"` for all scenes — no orbit controls on the marketing site
- **Vertical safe area:** On 20:9 phones with `cover` mode, the top and bottom ~20% of the 16:9 frame are cropped. Keep all important 3D content (diagram nodes, key geometry) within the center 60% of the vertical frame. Use the existing `isMobile` flag to widen FOV on phones (Scene 0 already does this).

**Lighting guidelines:**
- Acts 0, 2, 5 share the hero's cyan/blue palette — these are the "wow" scenes
- Act 1 is deliberately muted — low contrast, warm-grey tones, flat feeling
- Acts 3–4 use clean, professional lighting — not dramatic, just clear

**Background continuity:**
- All scenes use solid or gradient backgrounds in the `#030508` to `#0a1020` range
- No scene uses a background that's lighter than `#121830` — maintain the dark-void feeling throughout
- Background transitions are crossfade via the `<Background>` element's built-in transition support

---

## Diagram Content Design

### Scene 1: Flat Architecture Diagram

Nodes (all at z=0, no tilt, no glow):
| ID | Label | Sublabel | Icon |
|---|---|---|---|
| `flat-web` | Frontend | React SPA | `ui:globe-alt` |
| `flat-api` | API Gateway | REST + GraphQL | `ui:server` |
| `flat-auth` | Auth Service | OAuth 2.0 | `ui:lock-closed` |
| `flat-cache` | Cache | Redis | `ui:bolt` |
| `flat-db` | Database | PostgreSQL | `ui:circle-stack` |

Edges: web→api, api→auth, api→cache, api→db, auth→db

Layout: Grid or flow layout, compact, all in one plane. Use `tilt={0}` and no glow on any node.

### Scene 2a: Same Diagram, Now 3D

Same node IDs and content, but:
- Frontend at z=2 (closest to viewer)
- API + Auth at z=0 (middle)
- Cache + DB at z=-2 (farthest)
- `tilt={-Math.PI / 10}` for perspective
- Glow on core nodes (API, DB)
- Edges rendered as 3D curves across z-planes

### Scene 4: Ecosystem Constellation

Layout: Radial with `@brewsite/core` at center. Use a `DiagramGroup` variant of `"cluster"` or `"boundary"` for visual grouping by package category:
- **Core elements:** core, diagram, model, charts
- **Presentation:** slides, screens
- **System:** textures, themes, create-brewsite, brewsite, claude-author

---

## Widget Setup Updates

The `widgetSetup.ts` file already loads core, model, diagram, and neon-sign plugins. The charts plugin must be added for Scene 2b if a chart element is used:

```tsx
import { chartPlugin } from '@brewsite/charts';

export function createWebsitePlugins(manifestUrl: string): WidgetPlugin[] {
  return [
    corePlugin(),
    modelPlugin({ manifestUrl }),
    diagramPlugin(),
    chartPlugin(),     // Add for Scene 2b
    neonSignPlugin(),
  ];
}
```

---

## Mobile-First Design Strategy

**Philosophy:** Mobile is the primary design surface. Every scene is authored for a 390×844 viewport (iPhone 14) first, then verified on 1440×900 desktop. The centered content column layout means mobile and desktop share the same HTML and CSS — no conditional rendering, no "view on desktop" messages.

### Why Mobile-First Works Here

1. **Phones are 20:9** — tall, narrow screens where centered content columns are the natural layout.
2. **The 3D canvas is full-bleed behind everything** — on phones the text overlays most of the 3D, on desktop the 3D extends into the side borders. Both look intentional.
3. **Scroll is the primary input on phones** — and scroll-driven 3D storytelling is exactly what BrewSite does.
4. **The centered column pattern scales UP gracefully** — a 350px text block on a phone becomes a 720px text block on a 1440px desktop, still centered, still readable, with the 3D canvas filling the extra 720px of side borders.

### Per-Scene Mobile Considerations

| Scene | Mobile Consideration |
|---|---|
| 0 (Hero) | Already mobile-adapted (wider FOV, closer camera). Package badges wrap to 2 rows — this is fine. |
| 1 (Flat World) | Text overlay is prominent; flat diagram visible through camera framing below text. Diagram uses fewer nodes if needed (3 instead of 5). |
| 2a (Dimensional Shift) | Reduce z-separation slightly. Adjust camera FOV to show depth at narrow viewport. This scene must be just as impressive on mobile — it's the emotional peak. |
| 2b (Models & More) | Show fewer elements or a single rotating showcase instead of a triptych. The centered column text still describes the full toolkit. |
| 3a (Code) | Code block scrolls horizontally — this is expected and natural for code on mobile. No font-size reduction. |
| 3b (Pipeline) | Pipeline diagram renders top-to-bottom instead of left-to-right on mobile. Use `isMobile` flag to pass different `FlowLayout direction` prop. |
| 4 (Ecosystem) | Full constellation renders in 3D — camera pulls back farther on mobile to fit more nodes. If needed, reduce to core + direct-dependency packages only. |
| 5 (CTA) | Terminal card is nearly full-width with 20px gutters — looks clean and intentional. CTA button full-width on mobile. |

### Performance Budget (Mobile)

| Resource | Budget |
|---|---|
| Floor mirror resolution | 512px (already set via `isMobile`) |
| Floor mirror usage | Hero + Dimensional Shift + CTA only. Disabled on Scenes 1, 3a, 3b, 4. |
| Quality preset | `'balanced'` on mobile (already set in LandingPage) |
| Diagram node count | Max 8 nodes per scene on mobile; max 12 on desktop |
| GLTF model poly count | <50K tris for any model on mobile |
| Texture resolution | Max 1024px on mobile |

### Scroll Pacing (Mobile)

On mobile, reduce scroll units by ~25% per scene so the experience feels faster to thumb-scroll through. The `isMobile` flag is already available at module scope:

```tsx
const SCROLL_SCALE = isMobile ? 0.75 : 1.0;

<ProgressManager scrollUnits={1400 * SCROLL_SCALE} />
```

This keeps the total scroll distance manageable on mobile (~7,200px total vs ~9,600px on desktop) while preserving the same scene sequence and transitions.

---

## Open Questions

1. **3D model for Scene 2b:** Is there a GLTF model in the scene manifest suitable for the website? If not, should we create/source one, or should Scene 2b use alternative visuals?

2. **Chart data for Scene 2b:** What data should the chart element display? Could be abstract/demo data, or could be real npm download stats if available.

3. **Scene 1→2a transition implementation:** The "flat diagram unfolding into 3D" transition is the emotional centerpiece. Can this be achieved with the current transition system (node z-position interpolation between scenes), or does it require custom transition logic?

4. **Scroll pacing for Scene 0:** The current `dwellFn` is an identity function (linear pacing). Should the hero scene keep its 3600 scroll units and dwell function, or should it be shortened now that there are more scenes below?

5. **GitHub stars / npm downloads:** Should Scene 4 display live metrics (fetched at build time or runtime), or static badges? Live data creates trust but adds complexity and potential staleness.

6. **Loading experience:** With 8 scenes, initial load time may increase. Should we implement progressive scene loading (compile scenes 0-2 immediately, lazy-compile 3-5)?

---

## Launch Criteria

**Mobile (primary test surface — verify first):**
- [ ] All 8 scenes render correctly on iOS Safari (iPhone 12+ / 390×844)
- [ ] All 8 scenes render correctly on Android Chrome (Pixel 6+ / 412×915)
- [ ] Scroll flow is smooth and continuous — no jarring transitions on thumb-scroll
- [ ] All overlay text is readable over 3D backgrounds at phone width
- [ ] Code block in Scene 3a scrolls horizontally without layout breakage
- [ ] Terminal card in Scene 5 is readable and CTA button tappable (44px+ touch target)
- [ ] Package badges in Scene 0 wrap cleanly to multiple rows
- [ ] Lighthouse Performance ≥ 75 on mobile (iPhone throttled profile)
- [ ] 60fps on iPhone 13

**Desktop (verify second):**
- [ ] All 8 scenes render correctly on Chrome, Firefox, Safari at 1440×900
- [ ] Centered content column stays readable; side borders show 3D canvas
- [ ] Lighthouse Performance ≥ 85 on desktop
- [ ] 60fps on M1 MacBook Air at 1440×900

**Content correctness:**
- [ ] Package badges in Scene 0 match all current published packages
- [ ] Code snippet in Scene 3a actually compiles as a valid BrewSite scene
- [ ] Terminal commands in Scene 5 are correct (`npm create brewsite` works)
- [ ] Nav menu updated with correct scene IDs and labels
- [ ] No console errors or warnings in production build
